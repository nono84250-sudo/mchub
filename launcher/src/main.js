require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const { app, BrowserWindow, ipcMain, dialog, shell, session, screen } = require("electron");

// Verrou de navigation (audit 14/10, L1). Avant : un lien glisse sur la fenetre, ou un
// window.open, chargeait une page distante DANS la fenetre du launcher, avec le preload, donc
// avec toute l'API window.mchub (lancer un serveur piege, envoyer des demandes d'ami...).
//  - Aucune page ne peut ouvrir de nouvelle fenetre (toutes les webContents, celle de la
//    connexion Microsoft comprise : elle n'en a pas besoin).
//  - Les fenetres du launcher (principale, console) ne naviguent jamais ailleurs : voir
//    lockAppNavigation, appele a leur creation. La fenetre Microsoft garde sa navigation
//    (pages de connexion), surveillee par msAuth.js.
//  - Chaque appel IPC doit venir d'une page locale (file://) : une page distante qui
//    reussirait malgre tout a se charger ne peut rien demander au processus principal.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // Lien « Regarder sur YouTube » du lecteur integre a la fiche : ouvert dans le navigateur,
    // jamais dans une fenetre du launcher.
    if (isYoutubeWatchUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

function isYoutubeWatchUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ["www.youtube.com", "youtube.com", "youtu.be"].includes(u.hostname);
  } catch {
    return false;
  }
}

function lockAppNavigation(contents) {
  contents.on("will-navigate", (event) => event.preventDefault());
  contents.on("will-redirect", (event) => event.preventDefault());
}

function isLocalSender(event) {
  try {
    return new URL(event.senderFrame?.url ?? "").protocol === "file:";
  } catch {
    return false;
  }
}

// Laboratoire (25/10) : chaque canal d'une fonctionnalité cachée répond « feature_off » sans
// rien lancer (cloud:* = mondes en ligne, play:* = mode Jouer). Voir features.js.
const FEATURE_IPC = [
  ["cloud:", "worlds"],
  ["play:", "play"],
];
const registerIpcHandler = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) =>
  registerIpcHandler(channel, (event, ...args) => {
    if (!isLocalSender(event)) throw new Error("Appel refusé : origine non autorisée");
    const gate = FEATURE_IPC.find(([prefix]) => channel.startsWith(prefix));
    if (gate && !features.visible(gate[1])) return { ok: false, code: "feature_off" };
    return listener(event, ...args);
  });

// Verrou mono-instance : relancer le launcher pendant qu'une instance tourne deja creait
// jusqu'ici un second process totalement independant (deux lancements Minecraft simultanes
// sur le meme GAME_ROOT, ecritures concurrentes sans verrou sur settings.json/accounts.bin,
// double enregistrement du raccourci global de debug). Doit etre demande avant toute autre
// initialisation (avant meme la creation de la premiere fenetre).
// Icone de la barre des taches Windows (17/10, vu par Rushi : logo Electron en dev). Sans
// AppUserModelId, Windows range la fenetre sous electron.exe et prend son icone ; avec le meme id
// que electron-builder (build.appId), la fenetre garde l'icone Omniscient, en dev comme installe.
// 18/10 : en npm start, l'id seul ne suffisait pas (toujours logo Electron, notifications
// « Electron »). Windows tire le nom et l'icone des notifications d'un raccourci du menu Demarrer
// portant cet id : l'installateur le cree, en dev voir ensureDevStartMenuShortcut. Id a part en dev
// pour ne pas se melanger avec une version installee sur le meme PC.
const APP_USER_MODEL_ID = app.isPackaged ? "app.omniscient.launcher" : "app.omniscient.launcher.dev";
if (process.platform === "win32") app.setAppUserModelId(APP_USER_MODEL_ID);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}
// Un second lancement a quand meme tente de demarrer (et echoue sur le verrou ci-dessus) :
// on ramene la fenetre existante au premier plan plutot que de laisser l'utilisateur croire
// que rien ne s'est passe.
// Un lien omniscient:// clique pendant que le launcher tourne arrive aussi par ici (Windows/Linux :
// le lien est dans la ligne de commande du second lancement), voir deliverServerLink plus bas.
app.on("second-instance", (_event, argv) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  }
  const link = Array.isArray(argv) ? argv.find((arg) => typeof arg === "string" && arg.startsWith(`${SERVER_LINK_SCHEME}://`)) : null;
  if (link) deliverServerLink(link);
});
// macOS : le lien arrive par cet evenement, au demarrage comme pendant que l'appli tourne.
app.on("open-url", (event, url) => {
  event.preventDefault();
  deliverServerLink(url);
});

const path = require("node:path");
// Delais de rafraichissement (liste, fiches, presence) : un seul fichier de reglages, partage avec renderer.js.
const REFRESH = require("./refreshSettings");
// .ico sous Windows (plusieurs tailles, net dans la barre des taches), .png ailleurs.
const WINDOW_ICON = path.join(__dirname, "..", "build", process.platform === "win32" ? "icon.ico" : "icon.png");
const os = require("node:os");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const logStore = require("./logStore");

// Liens « Ouvrir dans le launcher » de la fiche serveur du site (16/10) :
//   omniscient://server/<slug>  ouvre la fiche de ce serveur ;
//   omniscient://join/<CODE>    rejoint un serveur prive par son code d'invitation, puis l'ouvre ;
//   omniscient://team/<slug>    ouvre la page Serveurs filtree sur cette team.
// Rien d'autre n'est accepte : le lien vient d'une page web, donc seul un slug ou un code au
// format attendu passe, et il ne fait qu'ouvrir une fiche (jamais lancer le jeu tout seul).
// Le renderer recupere le lien en attente quand il est pret (app:takeServerLink) ; ensuite les
// liens suivants lui sont envoyes directement (app:serverLink).
const SERVER_LINK_SCHEME = "omniscient";
let pendingServerLink = null;
let serverLinkRendererReady = false;

function parseServerLink(raw) {
  if (typeof raw !== "string" || raw.length > 200) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== `${SERVER_LINK_SCHEME}:`) return null;
  const value = url.pathname.replace(/^\/+|\/+$/g, "");
  if (url.hostname === "server" && /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(value)) return { kind: "server", value };
  if (url.hostname === "join" && /^[A-Za-z0-9]{4,16}$/.test(value)) return { kind: "join", value: value.toUpperCase() };
  // omniscient://team/<slug> (19/10) : la page Serveurs filtree sur cette team.
  if (url.hostname === "team" && /^[a-z0-9-]{1,80}$/.test(value)) return { kind: "team", value };
  return null;
}

function deliverServerLink(raw) {
  const link = parseServerLink(raw);
  if (!link) return;
  logStore.pushLog({ level: "info", source: "launcher", message: `Lien du site : ${link.kind === "server" ? `fiche ${link.value}` : link.kind === "team" ? `team ${link.value}` : "code d'invitation"}` });
  const win = BrowserWindow.getAllWindows()[0];
  if (serverLinkRendererReady && win && !win.isDestroyed()) win.webContents.send("app:serverLink", link);
  else pendingServerLink = link;
}

// Associe omniscient:// a ce launcher. En developpement (electron .), Windows doit aussi
// recevoir le dossier de l'appli, sinon il lancerait Electron seul. Un lien present des le
// premier lancement (launcher ferme au moment du clic) est dans process.argv.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(SERVER_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(SERVER_LINK_SCHEME);
}
{
  const startupLink = process.argv.find((arg) => typeof arg === "string" && arg.startsWith(`${SERVER_LINK_SCHEME}://`));
  if (startupLink) deliverServerLink(startupLink);
}

// Dossier de donnees renomme en ".omniscient-launcher" (convention "dotfile") plutot que
// "Omniscient Launcher" (le defaut d'Electron, derive de productName) — doit etre fixe ICI,
// avant tout require() local : mcLaunch, sessionStore, settingsStore et javaManager calculent
// chacun leur chemin via app.getPath("userData") des le chargement du module.
//
// Dev et production ont CHACUN leur propre dossier (".omniscient-launcher-dev" vs
// ".omniscient-launcher", distingues via app.isPackaged) — decision du 2026-10-10, pour que
// tester en dev ne touche jamais aux vrais comptes/reglages de production, et inversement.
// Avant cette separation, les deux environnements partageaient le meme dossier, ce qui rendait
// impossible de "repartir de zero" en dev sans affecter la prod (et vice-versa).
const isDev = !app.isPackaged;
const defaultUserDataPath = app.getPath("userData");
// MCHUB_USER_DATA_DIR (dev seulement) : profil jetable pour tester sans toucher au dossier dev
// habituel (ex. deplacement du dossier des jeux, serie 2 idee 9).
const dottedUserDataPath =
  (isDev && process.env.MCHUB_USER_DATA_DIR) || path.join(path.dirname(defaultUserDataPath), isDev ? ".omniscient-launcher-dev" : ".omniscient-launcher");
// Migration ponctuelle de l'ancien dossier par defaut d'Electron — uniquement en production :
// seuls de vrais joueurs ont pu avoir des comptes/reglages enregistres dans ce dossier avant
// l'introduction de la convention dotfile. En dev, un dossier par defaut trouve n'est que du
// residu de test sans valeur, qu'on ne veut surtout pas ressusciter.
if (!isDev && !fs.existsSync(dottedUserDataPath) && fs.existsSync(defaultUserDataPath)) {
  try {
    fs.renameSync(defaultUserDataPath, dottedUserDataPath);
  } catch {
    // Renommage impossible (dossier verrouille, volumes differents...) — le
    // launcher redemarre avec un dossier vide plutot que de planter ici.
  }
}
app.setPath("userData", dottedUserDataPath);

// Dossier des jeux (serie 2, idee 9) : a lire avant mcLaunch et javaManager.
const gamesLocation = require("./gamesLocation");
const msAuth = require("./msAuth");
const { launchMinecraft, GAME_ROOT, getRunningGame, stopGame } = require("./mcLaunch");
const {
  installModpack,
  ensureVanillaVersion,
  hasVanillaFilesInstalled,
  isInstalled,
  installLoader,
  prepareLaunchVersion,
  readInstalledState,
  listInstalledInstances,
  installFiles,
} = require("./modpack");
const { createPlayMode, supportsQuickPlay } = require("./playMode");
const { createWorldCloud } = require("./worldCloud");
const { createSaveOverlay } = require("./saveOverlay");
const { createLiveSave } = require("./liveSave");
const { createFeatures } = require("./features");
const { trackGameWindow } = require("./gameWindow");
const { pingMinecraftServer } = require("./mcPing");
const sessionStore = require("./sessionStore");
const settingsStore = require("./settingsStore");
const { checkServicesStatus, measureConnection } = require("./servicesStatus");
const javaManager = require("./javaManager");
const diagnostics = require("./diagnostics");
const discordPresence = require("./discordPresence");
const { autoUpdater } = require("electron-updater");

// Repli sur src/env.generated.js (voir scripts/generate-env.js) : une fois
// packagee, l'appli n'a plus de fichier .env du tout (jamais inclus dans le
// paquet distribue — cf. commentaire sur LAUNCHER_API_KEY ci-dessous), donc
// process.env.* est toujours vide a ce stade pour un vrai utilisateur. En
// dev (`electron .`), .env existe et process.env.* est deja rempli par le
// require("dotenv").config() plus haut, donc ce fichier genere n'est ni
// necessaire ni present — d'ou le try/catch.
let generatedEnv = {};
try {
  generatedEnv = require("./env.generated.js");
} catch {
  // Pas encore genere (avant le tout premier `npm run dist`) — normal en dev.
}

// URL du site Omniscient, source de vérité (voir cahier des charges, section
// "modèle de synchronisation").
// Plus d'adresse de secours ni de sonde au démarrage (audit 25/10) : l'ancienne adresse
// vercel.app est retirée, et la fenêtre ne doit plus attendre jusqu'à 4 s par adresse avant de
// s'ouvrir. Un build publié vise toujours https://omniscientlauncher.com (vérifié au build par
// scripts/generate-env.js) ; en dev, MCHUB_SITE_URL=http://localhost:3000 reste accepté.
const SITE_URL = (process.env.MCHUB_SITE_URL || generatedEnv.MCHUB_SITE_URL || "http://localhost:3000").trim().replace(/\/$/, "");
// Pose la Content-Security-Policy (SITE_URL est fixe dès le chargement) : les images
// de serveur (bannerUrl/iconUrl) viennent du site et doivent pouvoir se charger, mais
// seulement depuis une adresse https, ou depuis SITE_URL lui-meme quand c'est localhost en
// http (developpement local). Jamais de http: autorise en general, pour ne pas ouvrir la
// porte a une image chargee en clair depuis n'importe quel autre site.
function setContentSecurityPolicy() {
  const siteOrigin = new URL(SITE_URL).origin;
  const isLocalHttp = siteOrigin.startsWith("http://localhost:") || siteOrigin.startsWith("http://127.0.0.1:");
  const imgSrc = isLocalHttp ? `'self' https: data: ${siteOrigin}` : "'self' https: data:";
  // frame-src : le lecteur video des fiches (youtube-nocookie, voir setupPageVideo). Cette
  // politique s'ajoute a celle de index.html : sans cette ligne, elle bloquait le lecteur.
  const csp = `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src ${imgSrc}; frame-src https://www.youtube-nocookie.com;`;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Le lecteur video de la fiche (youtube-nocookie, voir setupPageVideo dans renderer.js)
    // garde sa propre politique : la notre bloquerait ses scripts.
    if (isYoutubeEmbedUrl(details.url)) return callback({});
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] } });
  });
  // Une page chargee en file:// n'envoie pas d'en-tete Referer, et YouTube refuse alors de lire
  // la video integree (erreur 153) : on presente l'adresse du site Omniscient, seulement pour
  // le lecteur youtube-nocookie.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["https://www.youtube-nocookie.com/*"] }, (details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders, Referer: "https://omniscientlauncher.com/" } });
  });
}

function isYoutubeEmbedUrl(url) {
  try {
    return new URL(url).hostname === "www.youtube-nocookie.com";
  } catch {
    return false;
  }
}

// Secret partage avec la route /api/launcher/servers/[slug] du site : c'est
// la SEULE route qui renvoie l'IP d'un serveur, jamais l'API publique. Jamais
// de valeur par défaut en dur ici, une ancienne clé a fuité dans le dépôt
// public pour cette raison exacte.
const LAUNCHER_API_KEY = process.env.LAUNCHER_API_KEY || generatedEnv.LAUNCHER_API_KEY;
// Optionnel (voir discordPresence.js) : Rich Presence desactivee proprement
// si absent, jamais une erreur bloquante comme LAUNCHER_API_KEY ci-dessus.
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || generatedEnv.DISCORD_CLIENT_ID;
// Optionnel aussi (idee 3 du lancement, 19/10) : rapports d'erreurs Sentry, voir errorReports.js.
const errorReports = require("./errorReports");
errorReports.init({ dsn: process.env.SENTRY_DSN || generatedEnv.SENTRY_DSN, release: app.getVersion() });
const REQUEST_TIMEOUT_MS = 8000;

// En-tetes des routes /api/launcher/* qui agissent au nom du joueur connecte
// (Mes instances, notifications, signalement) : LAUNCHER_API_KEY prouve que
// c'est ce launcher, X-Minecraft-Token (le vrai jeton d'acces Mojang de la
// session, verifie cote site aupres de Mojang) prouve QUI joue — avant, le
// site croyait sur parole le minecraftUuid envoye en parametre (faille IDOR,
// audit de securite du 2026-09-28). Les deux se cumulent, l'un ne remplace
// pas l'autre. Pas de session => pas de jeton a envoyer (les appelants
// verifient deja currentSession avant d'appeler ceci).
// Jeton de session (point 3) : le site echange le jeton Mojang contre un jeton
// signe valable 15 min (POST /api/launcher/session). Quand il est utilisable, on
// l'envoie dans X-Launcher-Session a la place de X-Minecraft-Token, qui n'est
// alors plus transmis a chaque requete. Tant qu'il n'y en a pas (premier appel,
// expire, echange en echec), on envoie le jeton Mojang comme avant.
// En memoire seulement : un redemarrage refait l'echange.
// Le jeton de session vaut 15 min cote site et reste utilisable jusqu'a 30
// secondes avant sa vraie expiration (LAUNCHER_SESSION_USABLE_MARGIN_MS). Une
// fois cette marge depassee, un nouvel echange est demande en arriere-plan
// (voir requestLauncherSession) et le jeton Mojang est envoye en repli pour
// cet appel-ci (et les suivants) jusqu'a ce que le nouvel echange reussisse.
let launcherSession = null; // { uuid, token, expiresAt (ms) }
let launcherSessionRequest = null;
// UUID du joueur qui vient de se connecter avec le bouton Microsoft (pas une reprise de
// session ni un renouvellement) : le prochain echange le signale au site (freshLogin), qui
// recree alors son compte s'il l'avait supprime. Garde jusqu'a un echange reussi.
let pendingFreshLoginUuid = null;
const LAUNCHER_SESSION_USABLE_MARGIN_MS = 30_000;

function usableLauncherSessionToken() {
  if (!currentSession || !launcherSession) return null;
  if (launcherSession.uuid !== currentSession.profile.id) return null;
  if (launcherSession.expiresAt - LAUNCHER_SESSION_USABLE_MARGIN_MS <= Date.now()) return null;
  return launcherSession.token;
}


function requestLauncherSession() {
  if (!currentSession || launcherSessionRequest) return;
  // Site sature (voir siteBusyUntil) : pas d'echange pour l'instant, repli sur le jeton Mojang.
  if (Date.now() < siteBusyUntil) return;
  const uuid = currentSession.profile.id;
  const mojangToken = currentSession.authorization.access_token;
  const freshLogin = pendingFreshLoginUuid === uuid;
  launcherSessionRequest = (async () => {
    try {
      const res = await fetch(`${SITE_URL}/api/launcher/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LAUNCHER_API_KEY}`,
          "X-Minecraft-Token": mojangToken,
        },
        body: JSON.stringify({ minecraftUuid: uuid, ...(freshLogin ? { freshLogin: true } : {}) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        if (res.status === 429 || (res.status === 503 && (await res.json().catch(() => null))?.busy === true)) markSiteBusy(res);
        logStore.pushLog({ level: "warn", source: "launcher", message: `Session launcher : échange refusé (HTTP ${res.status}), repli sur le jeton Mojang` });
        return;
      }
      const data = await res.json();
      if (freshLogin && pendingFreshLoginUuid === uuid) pendingFreshLoginUuid = null;
      // Joueur deconnecte pendant l'echange : on ne garde pas sa session.
      if (currentSession?.profile.id !== uuid) return;
      launcherSession = { uuid, token: data.token, expiresAt: data.expiresAt };
      // Laboratoire : ce joueur est peut-être testeur, on relit ses fonctionnalités.
      features.refresh();
      logStore.pushLog({ level: "debug", source: "launcher", message: `Session launcher : jeton obtenu, valable jusqu'à ${new Date(data.expiresAt).toLocaleTimeString("fr-FR")}` });
    } catch (error) {
      // Sans importance : les requetes continuent avec le jeton Mojang.
      logStore.pushLog({ level: "warn", source: "launcher", message: `Session launcher : échange impossible (${error.message}), repli sur le jeton Mojang` });
    } finally {
      launcherSessionRequest = null;
    }
  })();
}

// Deconnexion : le site refuse les jetons de session de ce joueur (revocation).
// Echec silencieux : le jeton expire de toute facon dans 15 min au plus.
async function revokeLauncherSession() {
  const session = launcherSession;
  launcherSession = null;
  if (!session || session.expiresAt <= Date.now()) return;
  try {
    const res = await fetch(`${SITE_URL}/api/launcher/session/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LAUNCHER_API_KEY}`, "X-Launcher-Session": session.token },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) logStore.pushLog({ source: "launcher", message: "Session launcher : révoquée à la déconnexion" });
    else logStore.pushLog({ level: "warn", source: "launcher", message: `Session launcher : révocation refusée (HTTP ${res.status})` });
  } catch (error) {
    // Hors ligne : rien a faire, le jeton expire seul.
    logStore.pushLog({ level: "warn", source: "launcher", message: `Session launcher : révocation impossible (${error.message}), le jeton expire seul` });
  }
}

function launcherAuthHeaders() {
  const sessionToken = usableLauncherSessionToken();
  if (sessionToken) {
    return { Authorization: `Bearer ${LAUNCHER_API_KEY}`, "X-Launcher-Session": sessionToken, "X-Launcher-Version": app.getVersion() };
  }
  // Pas encore connecte (2026-10-11 : "Installer" peut maintenant s'utiliser
  // sans compte, voir server:install) — la cle du launcher seule suffit pour
  // les endpoints publics (fiche serveur public, fichiers de modpack) ;
  // X-Minecraft-Token n'est qu'une preuve d'identite en plus, jamais lu que
  // pour les serveurs prives. Avant ce controle : currentSession.authorization
  // etait lu sans garde, "Cannot read properties of null" des le premier
  // appel sans session (trouve en testant le bouton "Installer").
  if (!currentSession) {
    return { Authorization: `Bearer ${LAUNCHER_API_KEY}`, "X-Launcher-Version": app.getVersion() };
  }
  requestLauncherSession();
  return { Authorization: `Bearer ${LAUNCHER_API_KEY}`, "X-Minecraft-Token": currentSession.authorization.access_token, "X-Launcher-Version": app.getVersion() };
}

// Session du joueur connecté (compte Microsoft/Minecraft), en mémoire.
// Le refresh_token est en plus sauvegardé chiffré sur disque si le joueur a
// coché "se souvenir de moi" (voir sessionStore.js).
let currentSession = null;
// Vrai seulement si la session courante a un refresh_token mémorisé : sans
// lui, pas de renouvellement silencieux (comportement d'avant).
let sessionRemembered = false;

function setSession(profile, authorization, { freshLogin = false } = {}) {
  currentSession = { profile, authorization };
  clearServerCaches();
  pendingFreshLoginUuid = freshLogin ? profile.id : null;
  requestLauncherSession();
  // Mode Jouer : reprend un envoi de mondes laissé en cours (worldCloud, défini plus bas).
  setTimeout(() => {
    features.refresh();
    try {
      if (features.visible("worlds")) worldCloud.start();
    } catch {
      /* pas encore prêt au tout premier démarrage */
    }
  }, 5000);
  return profile;
}

// Le jeton Minecraft expire au bout d'environ 24 h. Quand le site renvoie 401
// sur un appel authentifié, on renouvelle la session via le refresh_token
// mémorisé (relu chiffré depuis sessionStore à chaque fois, jamais gardé en
// mémoire) puis on relance l'appel une seule fois (voir withSessionRetry).
let sessionRefresh = null;
let lastSessionRefreshAt = 0;
const SESSION_REFRESH_COOLDOWN_MS = 5 * 60_000;

async function doRefreshSession() {
  const { accounts } = sessionStore.loadAccounts();
  const account = accounts.find((a) => a.id === currentSession?.profile.id);
  if (!account) return false;
  try {
    const { profile, authorization, refreshToken } = await msAuth.refreshSession(account.refreshToken);
    setSession(profile, authorization);
    try {
      sessionStore.rememberAccount(profile.id, profile.name, refreshToken);
    } catch {
      // Session valide en mémoire pour cette fois ; seule la mémorisation est perdue.
    }
    return true;
  } catch (error) {
    // Microsoft a pu renouveler (et donc invalider l'ancien) le refresh_token
    // avant l'échec : on garde le nouveau, comme auth:tryRestore.
    if (error.rotatedRefreshToken) {
      try {
        sessionStore.rememberAccount(account.id, account.name, error.rotatedRefreshToken);
      } catch {
        // tant pis pour cette fois
      }
    }
    return false;
  }
}

// Un seul renouvellement à la fois, pas plus d'un toutes les 5 min. Un jeton
// tout juste renouvelé n'est pas expiré : un 401 juste après ne vient donc pas
// de l'expiration (refus côté site) et ne doit pas relancer Microsoft à chaque
// appel (notifications:list tourne toutes les 30 s).
function refreshSessionOnce(staleToken) {
  if (!sessionRemembered) return Promise.resolve(false);
  // Un autre appel a déjà renouvelé le jeton entre-temps : on relance avec.
  if (currentSession?.authorization.access_token !== staleToken) return Promise.resolve(true);
  if (sessionRefresh) return sessionRefresh;
  if (Date.now() - lastSessionRefreshAt < SESSION_REFRESH_COOLDOWN_MS) return Promise.resolve(false);
  lastSessionRefreshAt = Date.now();
  sessionRefresh = doRefreshSession().finally(() => {
    sessionRefresh = null;
  });
  return sessionRefresh;
}

// Appelle le site avec la session courante ; sur 401, renouvelle la session
// puis relance l'appel UNE seule fois. Pas de boucle : si la relance échoue
// encore, son erreur (401 inclus) remonte telle quelle.
async function withSessionRetry(send) {
  const staleToken = currentSession?.authorization.access_token;
  try {
    return await send();
  } catch (error) {
    if (error.status !== 401 || !currentSession) throw error;
    if (!(await refreshSessionOnce(staleToken)) || !currentSession) throw error;
    return send();
  }
}

const SITE_BUSY_MESSAGE = "Le site Omniscient est très demandé : réessaie dans une minute.";
// Site sature (audit 25/10) : quand la base du site deborde, il repond 503 avec { busy: true } et
// Retry-After (ou 429 quand un frein par adresse saute). Jusqu'a siteBusyUntil, les appels de fond
// periodiques (presence, amis des listes, notifications, maintenance, liste des serveurs) ne
// partent plus du tout : des milliers de launchers qui reessaient chaque minute empecheraient le
// site de se remettre. Les actions du joueur (clic) partent quand meme, et renvoient l'erreur.
const SITE_BUSY_DEFAULT_MS = 60_000;
const SITE_BUSY_MAX_MS = 10 * 60_000;
let siteBusyUntil = 0;

// Le message est celui du site quand il en donne un (« réessaie dans une minute »...).
function siteBusyError(message, status = 503) {
  const error = new Error(message || `Réponse ${status} du site Omniscient`);
  error.code = "busy";
  error.status = status;
  return error;
}

function markSiteBusy(res) {
  const seconds = Number(res.headers.get("retry-after"));
  const pauseMs = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, SITE_BUSY_MAX_MS) : SITE_BUSY_DEFAULT_MS;
  const until = Date.now() + pauseMs;
  if (until > siteBusyUntil) {
    siteBusyUntil = until;
    logStore.pushLog({ level: "warn", source: "launcher", message: `Site Omniscient saturé (HTTP ${res.status}) : appels de fond en pause ${Math.round(pauseMs / 1000)} s` });
  }
}

// `options.background` : appel de fond periodique, saute tant que le site est sature.
// Laboratoire (25/10) : fonctionnalités visibles pour ce launcher, voir features.js.
const features = createFeatures({
  cacheDir: app.getPath("userData"),
  siteUrl: SITE_URL,
  authHeaders: () => launcherAuthHeaders(),
  fetchJson: (url, options) => fetchJson(url, options),
  log: (message, level = "info") => logStore.pushLog({ level, source: "launcher", message }),
  onChange: (state) => {
    for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("features:changed", state);
    try {
      if (state.worlds?.visible && currentSession) worldCloud.start();
    } catch {
      /* worldCloud pas encore prêt : setSession s'en charge */
    }
  },
});
ipcMain.handle("features:get", () => features.all());
app.whenReady().then(() => features.start());

async function fetchJson(url, { background = false, ...options } = {}, { withEtag = false } = {}) {
  // Jamais affiche au joueur : les appels de fond echouent en silence (voir renderer.js).
  if (background && Date.now() < siteBusyUntil) throw siteBusyError("Site Omniscient saturé : appel de fond reporté.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    // 21/10 : « pas de changement » (le site a compare l'ETag envoye) : l'appelant garde ce qu'il a.
    if (res.status === 304) return { notModified: true };
    if (!res.ok) {
      // Le site renvoie un message et parfois un code (ex. « frozen ») : on les garde.
      const body = await res.json().catch(() => null);
      // Audit de charge du 19/10 (B5) + audit 25/10 : site saturé (503 « busy », ou 429 du frein
      // par adresse) -> appels de fond en pause et message clair au lieu de « Réponse 500 ».
      const busy = res.status === 429 || (res.status === 503 && (body?.busy === true || body?.code === "busy"));
      if (busy) {
        markSiteBusy(res);
        throw siteBusyError(body?.error || SITE_BUSY_MESSAGE, res.status);
      }
      const error = new Error(res.status === 503 ? SITE_BUSY_MESSAGE : body?.error || `Réponse ${res.status} du site Omniscient`);
      error.status = res.status;
      error.code = busy ? "busy" : body?.code;
      throw error;
    }
    const data = await res.json();
    return withEtag ? { etag: res.headers.get("etag"), data } : data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Le site Omniscient n'a pas répondu à temps.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Taille "petite fenetre au lancement" de la maquette (00 - Bootstrap) :
// 420px de large, hauteur calee sur notre propre titlebar (36px, contre
// 32px dans la maquette) + la zone de contenu du splash (340px). Fenetre
// non redimensionnable tant qu'on est sur cet ecran — elle n'a jamais
// besoin de l'etre, et un utilisateur qui l'agrandirait casserait la mise
// en page pensee pour du contenu centre a taille fixe.
const BOOTSTRAP_SIZE = { width: 420, height: 376 };
const APP_SIZE = { width: 1100, height: 720 };
const APP_MIN_SIZE = { width: 720, height: 480 };

// Taille/position de la fenetre : ouverture agrandie au tout premier lancement,
// puis on rouvre comme le joueur l'a laissee (taille normale + agrandie ou non),
// sur le meme ecran. Fichier a part (pas settings.json) : "Reinitialiser les
// parametres" ne doit pas faire oublier la disposition de la fenetre.
function windowStateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadWindowState() {
  try {
    const raw = JSON.parse(fs.readFileSync(windowStateFile(), "utf8"));
    const ok = ["x", "y", "width", "height"].every((k) => Number.isFinite(raw[k]));
    if (!ok || raw.width < 200 || raw.height < 200) return null;
    return { x: raw.x, y: raw.y, width: raw.width, height: raw.height, maximized: !!raw.maximized };
  } catch {
    return null;
  }
}

function saveWindowState(win) {
  try {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    const b = win.getNormalBounds();
    const data = { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() };
    const file = windowStateFile();
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
    fs.renameSync(`${file}.tmp`, file);
  } catch {
    // Purement du confort : ne jamais empecher la fermeture a cause de ca.
  }
}

// Ramene une taille/position dans la zone de travail d'un ecran : la fenetre
// ne depasse jamais l'ecran (cas du 1080p a 150 %, ou 1100x720 etait trop haut).
function fitBoundsToWorkArea(bounds, workArea) {
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width);
  const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height);
  return { x, y, width, height };
}

function pickStartDisplay(saved) {
  if (saved) return screen.getDisplayMatching(saved);
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

// Remet une fenetre normale (non agrandie) entierement sur un ecran existant,
// par ex. apres le debranchement d'un ecran ou un changement d'echelle Windows.
function ensureWindowVisible(win) {
  if (win.isDestroyed() || win.isMaximized() || win.isMinimized()) return;
  const b = win.getBounds();
  const fitted = fitBoundsToWorkArea(b, screen.getDisplayMatching(b).workArea);
  if (fitted.x !== b.x || fitted.y !== b.y || fitted.width !== b.width || fitted.height !== b.height) win.setBounds(fitted);
}

// Dev (npm start) sous Windows : la fenetre appartient a electron.exe, dont Windows prend le nom
// et le logo. On donne a chaque fenetre l'id, l'icone et le nom d'Omniscient pour la barre des
// taches. La version installee n'en a pas besoin (son .exe porte deja l'icone et le nom).
function applyDevTaskbarIdentity(win) {
  if (process.platform !== "win32" || app.isPackaged) return;
  win.setAppDetails({
    appId: APP_USER_MODEL_ID,
    appIconPath: WINDOW_ICON,
    appIconIndex: 0,
    relaunchCommand: `"${process.execPath}" "${app.getAppPath()}"`,
    relaunchDisplayName: "Omniscient Launcher (dev)",
  });
}

// Raccourci « Omniscient Launcher (dev) » dans le menu Demarrer, recree seulement s'il manque ou a
// change : sans lui, Windows affiche les notifications sous « Electron » avec son logo.
function ensureDevStartMenuShortcut() {
  if (process.platform !== "win32" || app.isPackaged) return;
  const shortcutPath = path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", "Omniscient Launcher (dev).lnk");
  const options = {
    target: process.execPath,
    args: `"${app.getAppPath()}"`,
    cwd: app.getAppPath(),
    icon: WINDOW_ICON,
    iconIndex: 0,
    appUserModelId: APP_USER_MODEL_ID,
    description: "Omniscient Launcher (version de dev, npm start)",
  };
  try {
    const current = fs.existsSync(shortcutPath) ? shell.readShortcutLink(shortcutPath) : null;
    if (current && current.target === options.target && current.args === options.args && current.icon === options.icon && current.appUserModelId === options.appUserModelId) return;
    shell.writeShortcutLink(shortcutPath, current ? "replace" : "create", options);
  } catch (error) {
    logStore.pushLog({ source: "launcher", level: "warn", message: `Raccourci de dev du menu Démarrer non créé : ${error instanceof Error ? error.message : error}` });
  }
}

const expandedWindows = new WeakSet();

function createWindow() {
  const startWorkArea = pickStartDisplay(loadWindowState()).workArea;
  const win = new BrowserWindow({
    width: BOOTSTRAP_SIZE.width,
    height: BOOTSTRAP_SIZE.height,
    x: Math.round(startWorkArea.x + (startWorkArea.width - BOOTSTRAP_SIZE.width) / 2),
    y: Math.round(startWorkArea.y + (startWorkArea.height - BOOTSTRAP_SIZE.height) / 2),
    resizable: false,
    backgroundColor: "#070c16",
    frame: false,
    icon: WINDOW_ICON,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  applyDevTaskbarIdentity(win);
  // Sans barre de titre native (frame: false), l'etat maximise/restaure
  // n'est visible nulle part ailleurs : le renderer doit le connaitre pour
  // afficher la bonne icone sur son propre bouton.
  const sendMaximizedState = () => {
    if (!win.isDestroyed()) win.webContents.send("window:maximized-changed", win.isMaximized());
  };
  win.on("maximize", sendMaximizedState);
  win.on("unmaximize", sendMaximizedState);
  // Memorise la disposition une fois la fenetre passee en taille d'appli (pas
  // pendant le splash 420x376, qui ecraserait la vraie taille du joueur).
  let saveTimer = null;
  const scheduleSave = () => {
    if (!expandedWindows.has(win)) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 400);
  };
  win.on("resize", scheduleSave);
  win.on("move", scheduleSave);
  win.on("maximize", scheduleSave);
  win.on("unmaximize", scheduleSave);
  win.on("restore", () => ensureWindowVisible(win));
  win.on("close", () => {
    clearTimeout(saveTimer);
    if (expandedWindows.has(win)) saveWindowState(win);
  });
  // Fermer le launcher ferme aussi la console de debug, sinon elle garde l'appli ouverte.
  win.on("closed", () => {
    if (consoleWindow && !consoleWindow.isDestroyed()) consoleWindow.close();
  });

  // Ctrl+Shift+D (Cmd+Shift+D sur macOS) : console de debug. Seulement quand la fenetre du
  // launcher a le focus (audit 25/10) : l'ancien raccourci global (globalShortcut) volait cette
  // combinaison a toutes les autres applis du PC, Minecraft compris.
  win.webContents.on("before-input-event", (event, input) => {
    const modifier = process.platform === "darwin" ? input.meta : input.control;
    if (input.type === "keyDown" && modifier && input.shift && !input.alt && input.key.toLowerCase() === "d") {
      event.preventDefault();
      createConsoleWindow();
    }
  });

  lockAppNavigation(win.webContents);
  win.loadFile(path.join(__dirname, "index.html"));

  wireAutoUpdater(win);
}

// Console de debug (maquette "04f · Debug console — separate window") :
// fenetre unique reutilisee (focus au lieu d'en recreer une deuxieme) tant
// qu'elle reste ouverte, alimentee par logStore (voir logStore.js) via l'IPC
// "logs:entry". Ctrl+Shift+D et Parametres > Debug y menent tous les deux.
let consoleWindow = null;

function createConsoleWindow() {
  if (consoleWindow && !consoleWindow.isDestroyed()) {
    consoleWindow.show();
    consoleWindow.focus();
    return consoleWindow;
  }

  consoleWindow = new BrowserWindow({
    width: 860,
    height: 560,
    minWidth: 560,
    minHeight: 360,
    backgroundColor: "#161826",
    frame: false,
    icon: WINDOW_ICON,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  applyDevTaskbarIdentity(consoleWindow);

  const sendMaximizedState = () => {
    if (!consoleWindow.isDestroyed()) consoleWindow.webContents.send("window:maximized-changed", consoleWindow.isMaximized());
  };
  consoleWindow.on("maximize", sendMaximizedState);
  consoleWindow.on("unmaximize", sendMaximizedState);

  const stopForwarding = logStore.onLog((entry) => {
    if (!consoleWindow.isDestroyed()) consoleWindow.webContents.send("logs:entry", entry);
  });
  consoleWindow.on("closed", () => {
    stopForwarding();
    consoleWindow = null;
  });

  lockAppNavigation(consoleWindow.webContents);
  consoleWindow.loadFile(path.join(__dirname, "debug-console.html"));
  return consoleWindow;
}

// Mise a jour automatique (voir Deploiement Vercel.md) : le .exe distribue
// publiquement ne contient que ce launcher a une version donnee — les
// nouvelles fonctionnalites arrivent en telechargeant une nouvelle version
// ici, jamais en repassant par l'installateur d'origine. electron-updater lit
// app-update.yml (genere par electron-builder a partir de build.publish dans
// package.json) pour savoir ou chercher — inutilisable tel quel en dev
// (app.isPackaged est faux via `electron .`), donc on saute la vraie
// verification hors app packagee plutot que de planter sur un fichier absent.
let updateCheckResolve = null;

function wireAutoUpdater(win) {
  // Pas de telechargement automatique : on ne telecharge qu'une version PLUS
  // RECENTE que celle qui tourne (voir update-available ci-dessous).
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (status) => {
    if (!win.isDestroyed()) win.webContents.send("update:status", status);
  };

  autoUpdater.on("checking-for-update", () => send({ phase: "checking" }));
  autoUpdater.on("update-available", (info) => {
    // Canal bêta : la dernière bêta publiée est prise si son numéro est plus récent
    // (electron-updater écarte déjà les numéros plus bas, allowDowngrade étant faux sur ce
    // canal depuis l'audit 25/10, voir checkForUpdates). Canal stable : seule une version plus
    // récente est prise, SAUF quand le joueur vient de décocher le canal bêta
    // alors qu'une bêta tourne (ex. 0.4.0-beta.1) : il revient alors sur la
    // dernière version stable publiée (ex. 0.3.3), même si son numéro est plus bas.
    const onBeta = autoUpdater.channel === "beta";
    const leavingBeta = !onBeta && app.getVersion().includes("-") && !info.version.includes("-");
    const isUpdate = onBeta ? info.version !== app.getVersion() : leavingBeta || isNewerVersion(info.version, app.getVersion());
    if (!isUpdate) {
      logStore.pushLog({ level: "warn", source: "launcher", message: `Mise à jour ignorée : v${info.version} n'est pas plus récente que v${app.getVersion()}` });
      autoUpdater.emit("update-not-available", info);
      return;
    }
    logStore.pushLog({ source: "launcher", message: `Mise à jour disponible : v${info.version}` });
    send({ phase: "downloading", version: info.version, percent: 0 });
    autoUpdater.downloadUpdate().catch(() => {});
  });
  autoUpdater.on("download-progress", (progress) => send({ phase: "downloading", percent: Math.round(progress.percent) }));

  autoUpdater.on("update-not-available", () => {
    send({ phase: "up-to-date" });
    updateCheckResolve?.();
    updateCheckResolve = null;
  });
  autoUpdater.on("error", (error) => {
    logStore.pushLog({ level: "error", source: "launcher", message: `Vérification de mise à jour échouée : ${error?.message || error}` });
    send({ phase: "error", message: error?.message || String(error) });
    updateCheckResolve?.();
    updateCheckResolve = null;
  });
  autoUpdater.on("update-downloaded", () => {
    logStore.pushLog({ source: "launcher", message: "Mise à jour téléchargée, installation au redémarrage." });
    send({ phase: "ready-to-install" });
    updateCheckResolve?.();
    updateCheckResolve = null;
    // Laisse le temps au message de s'afficher avant que l'appli ne
    // redemarre pour appliquer la mise a jour telechargee. quitAndInstall()
    // sans argument lance l'installateur assiste (oneClick:false) EN CLAIR,
    // avec son propre assistant visible — isSilent=true passe /S a NSIS pour
    // qu'il s'installe sans aucune fenetre, isForceRunAfter=true relance
    // l'appli toute seule ensuite : le bootstrap reste le seul ecran visible
    // pendant toute la mise a jour, jamais un installateur Windows a part.
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 1200);
  });
}

// Resout des que le resultat est connu (a jour, en erreur, ou mise a jour
// telechargee et prete) — jamais bloque en attente indefinie si
// electron-updater ne trouve rien a faire. Le bootstrap attend cette
// promesse avant de passer a l'etape suivante (verification de Java).
// Compare "x.y.z" et "x.y.z-beta.N" : une version stable (sans suffixe) est
// plus récente que n'importe quelle bêta de même numéro de base.
function isNewerVersion(candidate, current) {
  const parse = (version) => {
    const [base, pre] = version.split("-");
    return {
      nums: base.split(".").map(Number),
      preNum: pre ? Number((pre.match(/\d+$/) || [0])[0]) : Infinity,
    };
  };
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < 3; i += 1) {
    if (a.nums[i] !== b.nums[i]) return a.nums[i] > b.nums[i];
  }
  return a.preNum > b.preNum;
}

function checkForUpdates() {
  return new Promise((resolve) => {
    // Version Linux : build de test personnel, jamais publie (pas de latest-linux.yml
    // dans les releases) — pas de verification de mise a jour.
    if (!app.isPackaged || process.platform === "linux") {
      resolve();
      return;
    }
    // Le canal suit l'option des Réglages : une bêta installée dont le joueur a
    // décoché l'option repasse sur le canal stable (retour à la dernière version
    // stable, voir leavingBeta dans update-available).
    // Sans choix explicite du joueur (betaChannelChosen faux), une bêta installée reste
    // sur le canal bêta comme avant.
    const settings = settingsStore.loadSettings();
    const betaChannel = settings.betaChannelChosen ? !!settings.betaChannel : settings.betaChannel || app.getVersion().includes("-beta");
    autoUpdater.channel = betaChannel ? "beta" : "latest";
    autoUpdater.allowPrerelease = betaChannel;
    // Le setter de channel active déjà allowDowngrade ; on le fixe explicitement après.
    // Retour à un numéro plus bas autorisé SEULEMENT pendant le retour bêta -> stable choisi
    // par le joueur (case décochée alors qu'une bêta tourne). Avant (audit 25/10), il était
    // permis en permanence, donc aussi sur le canal bêta : n'importe quelle version plus
    // ancienne publiée pouvait y être réinstallée.
    const leavingBeta = !betaChannel && app.getVersion().includes("-");
    autoUpdater.allowDowngrade = leavingBeta;
    updateCheckResolve = resolve;
    autoUpdater.checkForUpdates().catch(() => resolve());
  });
}

ipcMain.handle("update:check", () => checkForUpdates());

ipcMain.handle("logs:getAll", () => logStore.getAll());
ipcMain.handle("logs:clear", () => logStore.clear());
ipcMain.handle("logs:openConsole", () => {
  createConsoleWindow();
});
ipcMain.handle("logs:openLogsFolder", () => shell.openPath(logStore.logsDir()));
ipcMain.handle("logs:copyLatest", () => {
  try {
    return fs.readFileSync(logStore.todayLogPath(), "utf8");
  } catch {
    return "";
  }
});
// Rapport texte simple (pas de zip — voir le choix de scope dans le commit) :
// infos systeme + fin du fichier de log du jour, dans un seul fichier revele
// dans l'explorateur pour etre joint facilement a un message de support.
ipcMain.handle("diagnostics:exportReport", async () => {
  const settings = settingsStore.loadSettings();
  const info = { ...(await diagnostics.getSystemInfo({ ...settings, gameRoot: GAME_ROOT, appVersion: app.getVersion() })), ...(await gamesFolderInfo()) };
  let recentLog = "";
  try {
    recentLog = fs.readFileSync(logStore.todayLogPath(), "utf8").split("\n").slice(-200).join("\n");
  } catch {
    recentLog = "(aucun fichier de log pour aujourd'hui)";
  }
  const lines = [
    `Rapport de diagnostic — Omniscient Launcher ${info.launcherVersion}`,
    `Généré le ${new Date().toISOString()}`,
    "",
    `Electron    : ${info.electronVersion}`,
    `OS          : ${info.os}`,
    `Java        : ${info.java || "non détecté"}`,
    `Mémoire     : ${info.memory}`,
    `GPU         : ${info.gpu || "inconnu"}`,
    `Jeux        : ${info.gamesFolder}${info.gamesFree ? ` (${info.gamesFree} libres)` : ""}`,
    "",
    "--- Journal recent ---",
    recentLog,
  ];
  const reportPath = path.join(logStore.logsDir(), `rapport-diagnostic-${Date.now()}.txt`);
  fs.writeFileSync(reportPath, lines.join("\n"));
  shell.showItemInFolder(reportPath);
  return { ok: true, path: reportPath };
});

// Infos systeme + dossier des jeux et sa place libre (serie 2, idee 9).
ipcMain.handle("diagnostics:getSystemInfo", async () => ({
  ...(await diagnostics.getSystemInfo({ ...settingsStore.loadSettings(), gameRoot: GAME_ROOT, appVersion: app.getVersion() })),
  ...(await gamesFolderInfo()),
}));
ipcMain.handle("diagnostics:getCacheSizeBytes", () => diagnostics.getCacheSizeBytes());
// Refuses pendant une partie, un lancement ou une installation (audit 25/10) : versions/,
// libraries/ et assets/ sont partages par tous les serveurs, les effacer a ce moment-la casse le
// jeu en cours ou laisse une installation a moitie ecrite. Meme garde que « Supprimer les
// fichiers » d'une instance (instanceBusy, ici pour n'importe quel serveur).
ipcMain.handle("diagnostics:repair", () => {
  const busy = instanceBusy(null);
  if (busy) return { ok: false, code: busy };
  diagnostics.repairGameFiles();
  logStore.pushLog({ source: "launcher", message: "Fichiers du jeu réparés (versions/libraries effacés)." });
  return { ok: true };
});
ipcMain.handle("diagnostics:clearCache", () => {
  const busy = instanceBusy(null);
  if (busy) return { ok: false, code: busy };
  diagnostics.clearCache();
  logStore.pushLog({ source: "launcher", message: "Cache vidé (assets/téléchargements)." });
  return { ok: true };
});

// Toutes les requêtes réseau vers le site passent par le processus principal
// (jamais par le renderer) : évite le CORS et garde le renderer sans accès
// réseau direct, conformément aux bonnes pratiques Electron.
// Cache des lectures « serveurs » (règle de Rushi, 14/10) : le launcher ne redemande pas au site
// ce qu'il sait depuis moins d'une minute. Un « introuvable » ou « gelé » (404/403) est gardé
// 30 s, pour ne plus refaire à chaque page la rafale de 404 des serveurs privés ou en pause.
// Une panne réseau n'est jamais gardée. Vidé quand le joueur agit (rejoindre, quitter,
// Actualiser, test de publication, changement de compte) : voir clearServerCaches. Le lancement
// et l'installation lisent toujours le site en direct.
const SERVER_CACHE_MS = REFRESH.SERVER_DETAIL_CACHE_MS;
const SERVER_MISS_CACHE_MS = 30_000;
// Liste d'amis lue pour les listes de serveurs (« Un ami y joue », appel de fond) : gardée
// 5 minutes (audit 25/10, charge du site). La page Amis, elle, reste à une minute.
const FRIENDS_BACKGROUND_CACHE_MS = 5 * 60_000;
const serverCache = new Map();
// Demandes en cours : deux pages qui veulent la même fiche au même moment n'en font qu'une.
const serverInFlight = new Map();
// Derniere liste de l'annuaire et son ETag (voir fetchServerListFromSite).
let lastServerList = null;

async function cachedFetch(key, load, ttlMs = SERVER_CACHE_MS) {
  const hit = serverCache.get(key);
  if (hit && Date.now() - hit.at < (hit.error ? SERVER_MISS_CACHE_MS : ttlMs)) {
    if (hit.error) throw hit.error;
    return hit.data;
  }
  if (serverInFlight.has(key)) return serverInFlight.get(key);
  const generation = serverCacheGeneration;
  const pending = (async () => {
    try {
      const data = await load();
      if (generation === serverCacheGeneration) serverCache.set(key, { at: Date.now(), data });
      return data;
    } catch (error) {
      if ((error?.status === 404 || error?.status === 403) && generation === serverCacheGeneration) {
        serverCache.set(key, { at: Date.now(), error });
      }
      throw error;
    } finally {
      serverInFlight.delete(key);
    }
  })();
  serverInFlight.set(key, pending);
  return pending;
}

function clearFriendsCache() {
  for (const key of serverCache.keys()) if (key.startsWith("friends:")) serverCache.delete(key);
  for (const key of serverInFlight.keys()) if (key.startsWith("friends:")) serverInFlight.delete(key);
}

// Une réponse partie avant un vidage n'est pas remise en cache (elle peut dater d'avant l'action).
let serverCacheGeneration = 0;

function clearServerCaches() {
  serverCacheGeneration++;
  lastServerList = null;
  serverCache.clear();
  serverInFlight.clear();
}

ipcMain.handle("servers:clearCache", () => {
  clearServerCaches();
  return { ok: true };
});

// 21/10 (cache des fiches) : le site repond 304 « pas de changement » si la liste n'a pas bouge
// depuis la derniere recue (lastServerList, avec son empreinte ETag) : on garde alors celle-ci,
// sans la retelecharger. Gardee en memoire REFRESH.LIST_CACHE_MS (3 min) ; « Actualiser » vide tout.
async function fetchServerListFromSite({ background = false } = {}) {
  const previous = lastServerList;
  const res = await fetchJson(`${SITE_URL}/api/public/servers`, { background, ...(previous?.etag ? { headers: { "If-None-Match": previous.etag } } : {}) }, { withEtag: true });
  if (res.notModified && previous) return previous.data;
  if (res.notModified) return fetchJson(`${SITE_URL}/api/public/servers`, { background });
  lastServerList = res.etag ? { etag: res.etag, data: res.data } : null;
  return res.data;
}

ipcMain.handle("servers:list", async (_event, opts) => {
  try {
    const data = await cachedFetch("list", () => fetchServerListFromSite({ background: !!opts?.background }), REFRESH.LIST_CACHE_MS);
    forgetRemovedServers(data.servers);
    return { ok: true, servers: data.servers };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Serveurs du joueur absents de l'annuaire public (privé, en pause, en attente de vérification),
// retenus via « Mes serveurs » ou après un premier 404 : leur fiche publique est demandée avec la
// preuve du propriétaire (voir servers:get), la route propriétaire restant le secours.
const ownerOnlySlugs = new Set();

async function fetchOwnerServer(slug) {
  const data = await cachedFetch(`owner:${currentSession.profile.id}:${slug}`, () =>
    fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}`, {
      headers: { ...launcherAuthHeaders(), ...inviteHeaders(slug) },
    }),
  );
  const { ip: _ip, ...server } = data.server || {};
  // Cette route ne renvoie pas le slug : sans lui, « Jouer » partait avec un slug
  // undefined (GET /api/launcher/servers/undefined vu dans les logs du 14/10).
  return data.server ? { ...server, slug } : null;
}

// « Petit serveur du jour » (19/10, variante A validee par Rushi) : choisi par le site, un par jour
// (heure de Bruxelles). server peut etre null ; le renderer retombe alors sur l'ancien choix.
ipcMain.handle("servers:featured", async () => {
  try {
    const data = await cachedFetch("featured", () => fetchJson(`${SITE_URL}/api/launcher/servers/featured`, { headers: launcherAuthHeaders() }));
    return { ok: true, server: data.server || null, launches7d: data.launches7d ?? null, fillPercent: data.fillPercent ?? null, automatic: data.automatic !== false };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Serveur retiré du site (20/10, Bubule Land en 404 à chaque ouverture de Ma bibliothèque : son
// instance est encore sur le disque, donc l'onglet Installés redemandait sa fiche à chaque fois).
// Un vrai 404 (joueur connecté, route propriétaire essayée aussi) est retenu dans
// settings.removedServers et la fiche n'est redemandée qu'une fois toutes les 12 h. Le serveur
// redevient normal dès qu'il revient dans l'annuaire. Les fichiers de l'instance ne sont jamais touchés.
// 23/10 (Rushi : « pas de demandes à la con au site ») : une fois par jour au plus, et sans
// session le 404 public est retenu en mémoire jusqu'à la fermeture du launcher (pas enregistré :
// le serveur privé d'un propriétaire déconnecté ne doit pas passer pour retiré au démarrage suivant).
const REMOVED_SERVER_RECHECK_MS = 24 * 60 * 60 * 1000;
const SLUG_KEY_RE = /^[a-z0-9-]{1,80}$/;
const guestRemovedSlugs = new Set();

function isRecentlyRemoved(slug) {
  if (!currentSession && guestRemovedSlugs.has(slug)) return true;
  const at = settingsStore.loadSettings().removedServers?.[slug];
  return typeof at === "number" && Date.now() - at < REMOVED_SERVER_RECHECK_MS;
}

// Retiré du site d'après un vrai 404 déjà vu (enregistré, ou en mémoire sans session) : seule
// condition pour que « Supprimer les fichiers » accepte aussi le marqueur d'un serveur vanilla.
function isKnownRemoved(slug) {
  return guestRemovedSlugs.has(slug) || typeof settingsStore.loadSettings().removedServers?.[slug] === "number";
}

function markRemovedServer(slug, removed) {
  if (typeof slug !== "string" || !SLUG_KEY_RE.test(slug)) return;
  const current = settingsStore.loadSettings().removedServers || {};
  if (!removed && !Object.prototype.hasOwnProperty.call(current, slug)) return;
  const next = { ...current };
  if (removed) next[slug] = Date.now();
  else delete next[slug];
  settingsStore.saveSettings({ removedServers: next });
}

function forgetRemovedServers(servers) {
  const removed = settingsStore.loadSettings().removedServers || {};
  for (const server of servers || []) {
    if (server?.slug && Object.prototype.hasOwnProperty.call(removed, server.slug)) markRemovedServer(server.slug, false);
  }
}

ipcMain.handle("servers:get", async (_event, slug) => {
  if (isRecentlyRemoved(slug)) return { ok: false, error: "Serveur retiré", frozen: false, notFound: true, removed: true };
  // Fiche complete d'un de SES serveurs pas encore dans l'annuaire (19/10, Hypixel « en attente »
  // vu vide par Rushi) : la route propriétaire ne renvoie que de quoi lancer (ni bannière, ni
  // description, ni page). La fiche publique est donc demandée avec la preuve du propriétaire
  // (jeton de session) ; la route propriétaire ne sert plus que de secours, marquée « partielle ».
  const asOwner = Boolean(currentSession && ownerOnlySlugs.has(slug));
  try {
    // Serveur privé rejoint : le code d'invitation est nécessaire pour voir la fiche.
    const data = await cachedFetch(asOwner ? `public-owner:${currentSession.profile.id}:${slug}` : `public:${slug}`, () =>
      fetchJson(`${SITE_URL}/api/public/servers/${encodeURIComponent(slug)}`, {
        headers: asOwner ? { ...launcherAuthHeaders(), ...inviteHeaders(slug) } : inviteHeaders(slug),
      }),
    );
    markRemovedServer(slug, false);
    guestRemovedSlugs.delete(slug);
    return { ok: true, server: data.server };
  } catch (publicError) {
    let error = publicError;
    // 404 public sur un serveur que le joueur connecté peut quand même voir (14/10, bug « Récents
    // vide ») : le SIEN (privé, en pause, en attente de vérification), absent de l'annuaire
    // public. Sans ce second essai, le renderer le croyait supprimé et l'effaçait des Récents et
    // des Favoris (pruneDeadSlug), alors que le menu rapide le montrait encore. Même route que
    // le lancement ; l'IP est retirée, comme dans la fiche publique.
    if (publicError?.status === 404 && publicError?.code !== "frozen" && currentSession) {
      try {
        const server = await fetchOwnerServer(slug);
        if (server) {
          ownerOnlySlugs.add(slug);
          markRemovedServer(slug, false);
          // partial : le renderer explique pourquoi la fiche est incomplète au lieu d'une page vide.
          return { ok: true, server: { ...server, partial: true } };
        }
      } catch (ownerError) {
        error = ownerError;
      }
    }
    // Serveur gelé : signalé pour afficher « gelé » plutôt que « introuvable ». notFound
    // distingue un vrai 404 (fiche supprimée, voir resolveServersBySlug côté renderer) d'une
    // panne réseau/timeout, qu'il ne faut surtout pas confondre avec une suppression.
    if (error?.status === 404 && error?.code !== "frozen") {
      if (currentSession) markRemovedServer(slug, true);
      else guestRemovedSlugs.add(slug);
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
      frozen: error?.code === "frozen",
      notFound: error?.status === 404 && error?.code !== "frozen",
    };
  }
});

// Le bouton "Installer" d'une fiche (2026-10-11) : une fois CE serveur precis
// pret (moddé OU vanilla — un vanilla vaut aussi la peine d'etre prepare a
// l'avance), plus besoin de le reafficher — jamais une desactivation
// globale, juste pour ce slug-la (voir renderDetail cote renderer.js).
// Deux marqueurs possibles selon le type : STATE_FILE de modpack.js pour les
// moddes (deja ecrit par installModpack), .omniscient-ready.json pour les
// vanilla (ecrit par prepareServerFiles ci-dessus) — on teste les deux sans
// avoir besoin de connaitre le type a l'avance.
ipcMain.handle("servers:installStatus", async (_event, slug) => {
  if (!isValidInstanceSlug(slug)) return { installed: false };
  if (await isInstalled(GAME_ROOT, slug)) return { installed: true };
  const ready = await fsp
    .access(path.join(GAME_ROOT, "instances", slug, ".omniscient-ready.json"))
    .then(() => true)
    .catch(() => false);
  return { installed: ready };
});

// Tous les serveurs (publies ou en pause) du compte Omniscient lie au
// joueur actuellement connecte, pour la vue "Mes instances" (voir
// site/src/lib/public-servers.ts:listServersOwnedByMinecraftUuid). Vide si
// aucun compte n'est encore lie, plutot qu'une erreur — cas normal pour la
// plupart des joueurs (uniquement les proprietaires de serveur ont besoin
// de cette liaison).
// Résultat gardé 60 secondes par compte (cachedFetch) : évite de redemander le site à chaque ouverture.

ipcMain.handle("servers:mine", async () => {
  if (!currentSession) {
    logStore.pushLog({ level: "warn", source: "launcher", message: "Mes instances : pas de session Microsoft active" });
    return { ok: false, status: 401, error: "Pas de compte Microsoft connecté." };
  }
  const uuid = currentSession.profile.id;
  try {
    const data = await cachedFetch(`mine:${uuid}`, async () => {
      const fresh = await withSessionRetry(() =>
        fetchJson(
          `${SITE_URL}/api/launcher/servers/mine?minecraftUuid=${encodeURIComponent(uuid)}`,
          { headers: launcherAuthHeaders() },
        ),
      );
      logStore.pushLog({ level: "debug", source: "launcher", message: `Mes instances : ${fresh.servers?.length ?? 0} serveur(s) chargé(s)` });
      // Ses serveurs qui ne sont pas dans l'annuaire public : fiche ouverte directement par la
      // route propriétaire (voir ownerOnlySlugs plus haut).
      for (const owned of fresh.servers || []) {
        // Gelé : jamais ici, la route publique dit « gelé » et la fiche l'affiche comme tel.
        if (owned?.slug && !owned.frozenAt && (!owned.published || owned.isPrivate || owned.verificationStatus !== "approved")) {
          ownerOnlySlugs.add(owned.slug);
        } else if (owned?.slug && ownerOnlySlugs.delete(owned.slug)) {
          // Redevenu public (republié, validé) : sa fiche publique en cache est peut-être un 404.
          serverCache.delete(`public:${owned.slug}`);
        }
      }
      return fresh;
    });
    return { ok: true, servers: data.servers };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    logStore.pushLog({ level: "error", source: "launcher", message: `Mes instances : échec (${error.status ?? "pas de réponse"}) : ${message}` });
    return { ok: false, status: error.status, error: message };
  }
});

// "Mes instances" sans session Microsoft active (2026-10-12, jouer en solo hors ligne) :
// servers:mine ci-dessus exige currentSession (refuse tout sans ça, voir son premier
// controle) — dans ce cas, le renderer bascule sur cette liste a la place, qui ne lit QUE le
// disque local (listInstalledInstances, voir modpack.js), jamais le site. Volontairement
// disponible meme AVEC une session active (un joueur hors ligne peut quand meme avoir une
// session Microsoft perimee en memoire) : c'est le renderer qui decide quand l'utiliser,
// jamais ce handler.
ipcMain.handle("instances:listInstalled", async () => {
  try {
    const instances = await listInstalledInstances(GAME_ROOT);
    return { ok: true, instances };
  } catch (error) {
    logStore.pushLog({ level: "error", source: "launcher", message: `Instances locales : échec de la lecture (${error instanceof Error ? error.message : error})` });
    return { ok: false, instances: [] };
  }
});

// Rien n'est configurable dans le launcher : la console de gestion d'un
// serveur (Mes instances) et la creation d'une nouvelle instance ouvrent
// toujours le site dans le navigateur par defaut, jamais une fenetre interne.
ipcMain.handle("servers:openManage", (_event, serverId) => {
  if (typeof serverId === "string" && serverId) shell.openExternal(`${SITE_URL}/manage/${encodeURIComponent(serverId)}`);
});

// Teams (19/10) : le renderer ne donne qu'un type et un slug (verifie ici), jamais une adresse.
//   team  : page de la team (/team/<slug>) ;
//   claim : page Contact avec le sujet « C'est mon serveur » et la fiche deja indiquee.
ipcMain.handle("site:openTeamLink", (_event, kind, slug) => {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) return;
  if (kind === "team") shell.openExternal(`${SITE_URL}/team/${slug}`);
  else if (kind === "claim") shell.openExternal(`${SITE_URL}/contact?sujet=claim&serveur=${slug}`);
});

// Parametres > Divers > A propos (exige par les regles Discord pour developpeurs : la politique
// de confidentialite doit etre accessible depuis l'application). Adresses fixes du site en ligne,
// pas SITE_URL : en developpement, SITE_URL pointe sur localhost, ou ces pages peuvent manquer.
// Le renderer ne choisit qu'une cle, jamais une adresse.
const LEGAL_URLS = {
  terms: "https://omniscientlauncher.com/cgu",
  privacy: "https://omniscientlauncher.com/confidentialite",
};
ipcMain.handle("app:openLegal", (_event, page) => {
  // « Récupérer mes données » (Mon compte, 23/10) : la page Paramètres du site, où le bouton existe
  // déjà (même logique que « Supprimer mon compte », qui vit sur le site). SITE_URL pour suivre
  // le site local pendant les tests.
  if (page === "myData") return shell.openExternal(`${SITE_URL}/dashboard/parametres#mes-donnees`);
  const url = Object.hasOwn(LEGAL_URLS, page) ? LEGAL_URLS[page] : null;
  if (url) shell.openExternal(url);
});

ipcMain.handle("app:takeServerLink", () => {
  serverLinkRendererReady = true;
  const link = pendingServerLink;
  pendingServerLink = null;
  return link;
});

// Liens de la fiche personnalisable (reseaux, video) : saisis par le proprietaire, donc
// re-verifies ici avec les memes regles que le site (site/src/lib/serverPage.ts, isValidLink)
// avant d'ouvrir le navigateur. La video arrive comme simple identifiant YouTube.
function isValidPageLink(kind, input) {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s || s.length > 200 || /[\s<>"'`\\]/.test(s)) return false;
  let url;
  try {
    url = new URL(s);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  const p = url.pathname;
  switch (kind) {
    case "discord":
      return (host === "discord.gg" && /^\/[A-Za-z0-9-]{2,32}\/?$/.test(p)) ||
        ((host === "discord.com" || host === "www.discord.com") && /^\/invite\/[A-Za-z0-9-]{2,32}\/?$/.test(p));
    case "youtube":
      return (host === "youtube.com" || host === "www.youtube.com") && /^\/(@[\w.-]{3,30}|channel\/[\w-]{10,40})\/?$/.test(p);
    case "tiktok":
      return (host === "tiktok.com" || host === "www.tiktok.com") && /^\/@[\w.]{2,24}\/?$/.test(p);
    case "website":
      return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && host !== "localhost";
    default:
      return false;
  }
}

ipcMain.handle("servers:openPageLink", (_event, kind, value) => {
  if (kind === "video") {
    if (typeof value === "string" && /^[\w-]{11}$/.test(value)) shell.openExternal(`https://www.youtube.com/watch?v=${value}`);
    return;
  }
  if (isValidPageLink(kind, value)) shell.openExternal(new URL(value.trim()).href);
});

// Mods qu'un modpack CurseForge interdit de telecharger par les autres launchers (14/10) : le
// joueur les telecharge lui-meme et les laisse dans son dossier Telechargements, ou
// installModpack les retrouve (taille + empreinte SHA-1, voir modpack.js/findManualFiles).
function manualModsSearchDirs() {
  try {
    return [app.getPath("downloads")];
  } catch {
    return [];
  }
}

// Champs d'erreur transmis au renderer pour la fenetre des mods bloques. Les liens sont
// re-verifies a l'ouverture (modpack:openModPage), jamais ouverts tels quels.
function modpackErrorFields(error) {
  if (error?.code !== "manual_mods" || !Array.isArray(error.manualMods)) return {};
  return {
    code: "manual_mods",
    // Noms des mods bloques retrouves sur Modrinth (liste « Installés depuis Modrinth », point 4).
    fromModrinthMods: Array.isArray(error.fromModrinthMods) ? error.fromModrinthMods.slice(0, 200).map((name) => String(name).slice(0, 120)) : [],
    manualMods: error.manualMods.slice(0, 200).map((mod) => ({
      fileId: mod.fileId,
      modName: mod.modName || null,
      fileName: mod.fileName || null,
      pageUrl: mod.pageUrl || null,
      reason: mod.reason === "removed" ? "removed" : "blocked",
    })),
    // Mods bloques deja pris sur Modrinth (bandeau de la fenetre, repere B de la preview du 16/10).
    fromModrinth: Number.isInteger(error.fromModrinth) && error.fromModrinth > 0 ? error.fromModrinth : 0,
  };
}

// Page CurseForge d'un mod bloque : uniquement https://www.curseforge.com. Le lien vient de
// modpack.js (page exacte du fichier donnee par le site, sinon page du projet par son id). Plus
// de recherche par nom (14/10, Rushi) : plusieurs mods peuvent porter le meme nom.
// Lien de page de mod accepte seulement vers https://www.curseforge.com (lot 5, rapport au site).
function safeModPageUrl(pageUrl) {
  try {
    const parsed = new URL(String(pageUrl || ""));
    return parsed.protocol === "https:" && parsed.hostname === "www.curseforge.com" ? parsed.href.slice(0, 300) : null;
  } catch {
    return null;
  }
}

ipcMain.handle("modpack:openModPage", (_event, pageUrl) => {
  try {
    const parsed = new URL(pageUrl);
    if (parsed.protocol === "https:" && parsed.hostname === "www.curseforge.com") shell.openExternal(parsed.href);
  } catch {
    // pas de lien valable : rien a ouvrir
  }
});

ipcMain.handle("modpack:openDownloads", () => {
  const [downloads] = manualModsSearchDirs();
  if (downloads) shell.openPath(downloads);
});
// Petite fenetre "Reglages" d'une instance (Mes instances, 2026-10-13) : lit/modifie le canal
// du modpack (release/beta, voir server.modpackChannel et /api/launcher/servers/[slug]/channel)
// SANS ouvrir le site — nouveau bouton distinct de "Gerer" ci-dessus, qui continue d'ouvrir le
// navigateur comme avant. Meme pattern reseau que selftest:report (pas de retry de session,
// reglage rarement utilise).
ipcMain.handle("servers:getChannel", async (_event, slug) => {
  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/channel`, {
      headers: launcherAuthHeaders(),
    });
    return { ok: true, modpackChannel: data.modpackChannel };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});
ipcMain.handle("servers:setChannel", async (_event, { slug, modpackChannel }) => {
  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/channel`, {
      method: "PATCH",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ modpackChannel }),
    });
    return { ok: true, modpackChannel: data.modpackChannel };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});
// Case "Me prevenir du changement de statut de cette instance" (point 9, meme petite fenetre
// "Reglages" que getChannel/setChannel ci-dessus, voir INSTANCE_SETTINGS_FIELDS cote renderer).
// Contrairement au canal du modpack, PAS reserve au proprietaire : s'applique a TOUTE instance
// de "Mes instances" (possedee OU rejointe) — exige donc juste une session Microsoft active
// (meme controle que servers:mine), jamais une preuve de propriete. L'UUID envoye au site est
// celui du profil Minecraft/Xbox DEJA connu du launcher (currentSession), jamais saisi par
// l'utilisateur : /api/launcher/servers/[slug]/watch le revérifie de toute facon (voir
// verifyLauncherIdentity cote site).
ipcMain.handle("servers:getWatch", async (_event, slug) => {
  if (!currentSession) {
    return { ok: false, error: "Pas de compte Microsoft connecté." };
  }
  try {
    const uuid = currentSession.profile.id;
    const data = await fetchJson(
      `${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/watch?minecraftUuid=${encodeURIComponent(uuid)}`,
      { headers: launcherAuthHeaders() },
    );
    return { ok: true, notifyOnStatusChange: !!data.notifyOnStatusChange };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});
ipcMain.handle("servers:setWatch", async (_event, { slug, notifyOnStatusChange }) => {
  if (!currentSession) {
    return { ok: false, error: "Pas de compte Microsoft connecté." };
  }
  try {
    const uuid = currentSession.profile.id;
    const data = await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/watch`, {
      method: "PATCH",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ minecraftUuid: uuid, notifyOnStatusChange: !!notifyOnStatusChange }),
    });
    return { ok: true, notifyOnStatusChange: !!data.notifyOnStatusChange };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Systeme d'amis (2026-10-14, demande puis accord) : page "Amis" de la sidebar (voir nav-friends dans
// index.html / wireFriends dans renderer.js). Comme servers:getWatch/setWatch ci-dessus, exige
// juste une session Microsoft active (pas de preuve de propriete a verifier ici) — l'UUID et le
// pseudo envoyes au site sont ceux du profil DEJA connu du launcher (currentSession), jamais
// saisis par l'utilisateur.
ipcMain.handle("friends:list", async (_event, opts) => {
  const background = !!opts?.background;
  if (!currentSession) {
    return { ok: false, error: "Pas de compte Microsoft connecté." };
  }
  try {
    const uuid = currentSession.profile.id;
    // Page Amis : même règle d'une minute que les serveurs. Listes de serveurs (background) :
    // 5 minutes. Vidé après ajouter / accepter / retirer.
    const data = await cachedFetch(
      `friends:${uuid}`,
      () => fetchJson(`${SITE_URL}/api/launcher/friends?minecraftUuid=${encodeURIComponent(uuid)}`, { headers: launcherAuthHeaders(), background }),
      { maxAgeMs: background ? FRIENDS_BACKGROUND_CACHE_MS : SERVER_CACHE_MS },
    );
    return { ok: true, friends: data.friends ?? [], incoming: data.incoming ?? [], outgoing: data.outgoing ?? [] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});
// Envoie une DEMANDE d'ami (l'autre joueur doit l'accepter). Reponse TOUJOURS { ok: true } quoi
// qu'il arrive cote site (pseudo introuvable, deja ami — voir sendFriendRequest dans
// lib/friends.ts cote site) : anti-enumeration, le renderer ne
// doit jamais pouvoir distinguer ces cas d'apres cet appel, seul un rafraichissement de la
// liste (friends:list) dit si ca a vraiment ajoute quelqu'un. error/ok:false ici ne couvre que
// les pannes reseau/validation (pseudo vide), jamais "pseudo introuvable".
ipcMain.handle("friends:add", async (_event, minecraftUsername) => {
  if (!currentSession) {
    return { ok: false, error: "Pas de compte Microsoft connecté." };
  }
  try {
    const uuid = currentSession.profile.id;
    await fetchJson(`${SITE_URL}/api/launcher/friends`, {
      method: "POST",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      // `query` = pseudo OU code d'ami (reglage « Qui peut m'ajouter », 18/10) ; targetUsername garde
      // pour un site plus ancien.
      body: JSON.stringify({ minecraftUuid: uuid, minecraftUsername: currentSession.profile.name, targetUsername: minecraftUsername, query: minecraftUsername }),
    });
    clearFriendsCache();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});
// « Qui peut m'ajouter en ami » (variante C, 18/10) : meme reglage que sur le site (page Amis et
// Parametres > Confidentialite). friendPolicy = "all" | "code" | "none", friendCode = « K7Q-9XM ».
ipcMain.handle("friends:getSettings", async () => {
  if (!currentSession) return { ok: false, error: "Pas de compte Microsoft connecté." };
  try {
    const uuid = currentSession.profile.id;
    const data = await fetchJson(`${SITE_URL}/api/launcher/friends/settings?minecraftUuid=${encodeURIComponent(uuid)}`, { headers: launcherAuthHeaders() });
    return { ok: true, friendPolicy: data.friendPolicy || "code", friendCode: data.friendCode || null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

async function patchFriendSettings(body) {
  if (!currentSession) return { ok: false, error: "Pas de compte Microsoft connecté." };
  try {
    const uuid = currentSession.profile.id;
    const data = await fetchJson(`${SITE_URL}/api/launcher/friends/settings`, {
      method: "PATCH",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ minecraftUuid: uuid, ...body }),
    });
    return { ok: true, friendPolicy: data.friendPolicy || "code", friendCode: data.friendCode || null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

ipcMain.handle("friends:setPolicy", (_event, policy) => {
  if (!["all", "code", "none"].includes(policy)) return { ok: false, error: "Réglage inconnu." };
  return patchFriendSettings({ friendPolicy: policy });
});
ipcMain.handle("friends:newCode", () => patchFriendSettings({ regenerateCode: true }));

// Accepter une demande recue (seul le destinataire peut, verifie cote site).
ipcMain.handle("friends:accept", async (_event, friendUserId) => {
  if (!currentSession) {
    return { ok: false, error: "Pas de compte Microsoft connecté." };
  }
  try {
    const uuid = currentSession.profile.id;
    await fetchJson(`${SITE_URL}/api/launcher/friends/${encodeURIComponent(friendUserId)}`, {
      method: "POST",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ minecraftUuid: uuid }),
    });
    clearFriendsCache();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});
// Retirer un ami, refuser une demande recue ou annuler une demande envoyee (meme route DELETE).
ipcMain.handle("friends:remove", async (_event, friendUserId) => {
  if (!currentSession) {
    return { ok: false, error: "Pas de compte Microsoft connecté." };
  }
  try {
    const uuid = currentSession.profile.id;
    await fetchJson(`${SITE_URL}/api/launcher/friends/${encodeURIComponent(friendUserId)}`, {
      method: "DELETE",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ minecraftUuid: uuid }),
    });
    clearFriendsCache();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});
// Heartbeat de presence (voir lib/presence.ts cote site) : greffe sur le cycle de 60s existant
// du launcher (REFRESH_INTERVAL_MS/scheduleRefresh dans renderer.js), jamais un intervalle a
// part. Echec silencieux cote renderer (voir sendPresenceHeartbeat la-bas) : un heartbeat rate
// ne fait que retarder un peu le passage "hors ligne" d'un ami, jamais a signaler au joueur.
// Idee 2 du lancement (19/10) : ce meme appel passe par /api/launcher/pulse, qui renvoie en plus
// l'etat de maintenance (lu en cache cote site) et, si withNotifications, les notifications.
// Le renderer evite ainsi deux appels separes. Site pas encore a jour (404) : ancienne route
// /api/launcher/presence, retenue pour toute la session.
let pulseUnsupported = false;
ipcMain.handle("presence:heartbeat", async (_event, opts) => {
  if (!currentSession) {
    return { ok: false, error: "Pas de compte Microsoft connecté." };
  }
  try {
    const uuid = currentSession.profile.id;
    // playingSlug (16/10, « Un ami y joue ») : le serveur du jeu lancé, dans le même appel que
    // d'habitude. Le site ne le garde que s'il est dans l'annuaire public (jamais un privé).
    const payload = { minecraftUuid: uuid, minecraftUsername: currentSession.profile.name, playingSlug: publicPlayingSlug() };
    const post = (route, body) =>
      fetchJson(`${SITE_URL}/api/launcher/${route}`, {
        method: "POST",
        background: true,
        headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    let result = null;
    if (!pulseUnsupported) {
      try {
        result = await post("pulse", { ...payload, withNotifications: opts?.withNotifications === true });
      } catch (error) {
        if (error.status !== 404) throw error;
        pulseUnsupported = true;
      }
    }
    if (!result) result = await post("presence", payload);
    // Compte Omniscient supprime par le joueur (sur le site) alors que le launcher etait encore
    // connecte : le site ne le recree pas tout seul. On deconnecte et on oublie ce compte, pour
    // que seule une vraie connexion Microsoft le recree (freshLogin, voir setSession).
    if (result?.accountDeleted && currentSession?.profile.id === uuid) {
      logStore.pushLog({ level: "warn", source: "launcher", message: "Compte Omniscient supprimé : déconnexion du launcher" });
      try {
        sessionStore.forgetAccount(uuid);
      } catch {
        // Le fichier local n'a pas pu etre mis a jour : la session est quand meme coupee.
      }
      launcherSession = null;
      pendingFreshLoginUuid = null;
      currentSession = null;
      sessionRemembered = false;
      await clearMicrosoftLoginStorage();
      return { ok: true, accountDeleted: true };
    }
    if (result?.maintenance) {
      return {
        ok: true,
        grouped: true,
        maintenance: { active: !!result.maintenance.active, message: result.maintenance.message || "" },
        notifications: Array.isArray(result.notifications) ? result.notifications : undefined,
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Pour construire le lien d'invitation (copie dans le presse-papier depuis
// "Mes instances") sans dupliquer la logique SITE_URL cote renderer.
ipcMain.handle("app:getSiteUrl", () => SITE_URL);
ipcMain.handle("app:reportError", (_event, info) => errorReports.reportRendererError(info));
ipcMain.handle("app:restart", () => {
  app.relaunch();
  app.exit(0);
});

// Mode maintenance (voir renderer.js ensureNotInMaintenance/showMaintenanceScreen) : verifie
// au demarrage et depuis le pop-up d'une notification "maintenance". Pas de session requise
// (joignable avant meme la connexion Microsoft).
// Ces deux appels n'ont besoin QUE de la cle API (comme joinServerByCode plus bas) : la
// route /api/launcher/maintenance n'exige aucune identite joueur cote site, et
// launcherAuthHeaders() dereferencerait currentSession (null avant toute connexion) —
// exactement le moment ou l'ecran de maintenance doit pouvoir bloquer (voir audit 2026-10-10,
// §3.3 : le TypeError resultant etait avale par le catch ci-dessous, fail-open silencieux).
ipcMain.handle("maintenance:check", async (_event, opts) => {
  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/maintenance`, {
      headers: { Authorization: `Bearer ${LAUNCHER_API_KEY}` },
      background: !!opts?.background,
    });
    return { ok: true, active: !!data.active, message: data.message || "" };
  } catch (error) {
    // Site injoignable : ne bloque jamais le launcher pour ca, seule une vraie reponse
    // "active: true" du site doit bloquer. On garde une trace pour distinguer ce cas d'une
    // vraie panne reseau au besoin.
    logStore.pushLog({ level: "warn", source: "launcher", message: `Vérification de maintenance impossible (${error instanceof Error ? error.message : error})` });
    return { ok: true, active: false, message: "" };
  }
});
ipcMain.handle("maintenance:verifyCode", async (_event, code) => {
  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LAUNCHER_API_KEY}` },
      body: JSON.stringify({ code }),
    });
    return { ok: !!data.ok };
  } catch (error) {
    logStore.pushLog({ level: "warn", source: "launcher", message: `Vérification du code de maintenance impossible (${error instanceof Error ? error.message : error})` });
    return { ok: false };
  }
});

// Onglet "Rejoint" de "Mes instances" (voir renderer.js) : serveurs prives
// rejoints via le code/lien d'invitation de quelqu'un d'autre — jamais ceux
// que ce joueur possede (voir servers:mine ci-dessus, une liste separee).
// Stockage 100% local (settingsStore.joinedServers). Le code d'invitation est
// garde avec le serveur : c'est la preuve que le site demande pour donner la
// fiche et l'IP d'un serveur prive (voir canSeeServer cote site). Si le
// proprietaire regenere le code, le serveur disparait de cet onglet.
function addJoinedServer(slug, inviteCode) {
  const current = settingsStore.loadSettings().joinedServers || [];
  const joinedServers = [...current.filter((j) => j.slug !== slug), { slug, inviteCode, joinedAt: Date.now() }];
  settingsStore.saveSettings({ joinedServers });
}

function removeJoinedServer(slug) {
  const current = settingsStore.loadSettings().joinedServers || [];
  const joinedServers = current.filter((j) => j.slug !== slug);
  settingsStore.saveSettings({ joinedServers });
  return joinedServers;
}

// En-tete de preuve pour un serveur prive rejoint (vide sinon). Les serveurs
// rejoints avant cette version n'ont pas de code garde : ils ne se lisent plus
// avant d'etre rajoutes avec leur code.
function inviteHeaders(slug) {
  const joined = (settingsStore.loadSettings().joinedServers || []).find((j) => j.slug === slug);
  return joined?.inviteCode ? { "X-Invite-Code": joined.inviteCode } : {};
}

// Presence Discord : un serveur prive n'est jamais nomme. Le site le dit (server.isPrivate) ;
// en plus, un serveur rejoint par code d'invitation compte comme prive, pour qu'un site plus
// ancien (sans isPrivate dans sa reponse) ne fasse jamais afficher son nom.
function isPrivateServer(server, slug) {
  return server?.isPrivate === true || Boolean(inviteHeaders(slug)["X-Invite-Code"]);
}

// Resout un code d'invitation (voir site/src/app/api/launcher/servers/join/
// [code]/route.ts) puis l'ajoute aux serveurs rejoints localement. Pas besoin
// de session Minecraft : resoudre un code est volontairement anonyme, comme
// la page /join/[code] du site — seul LAUNCHER_API_KEY prouve que c'est bien
// ce launcher qui demande.
async function joinServerByCode(code) {
  const trimmed = (code || "").trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "Code d'invitation manquant." };

  try {
    const resolveRes = await fetch(`${SITE_URL}/api/launcher/servers/join/${encodeURIComponent(trimmed)}`, {
      headers: { Authorization: `Bearer ${LAUNCHER_API_KEY}` },
    });
    if (resolveRes.status === 404) return { ok: false, error: "Ce code d'invitation est invalide." };
    if (!resolveRes.ok) throw new Error(`HTTP ${resolveRes.status}`);
    const { slug } = await resolveRes.json();
    // Le slug sert ensuite de nom de dossier (instances/<slug>) : jamais pris tel quel.
    if (!isValidInstanceSlug(slug)) return { ok: false, error: "Serveur invalide." };

    const data = await fetchJson(`${SITE_URL}/api/public/servers/${encodeURIComponent(slug)}`, {
      headers: { "X-Invite-Code": trimmed },
    });
    addJoinedServer(slug, trimmed);
    clearServerCaches();
    return { ok: true, server: data.server };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

ipcMain.handle("servers:joinByCode", (_event, code) => joinServerByCode(code));

ipcMain.handle("servers:leaveJoined", (_event, slug) => {
  removeJoinedServer(slug);
  clearServerCaches();
  return { ok: true };
});

// --- Menu « ⋯ » des cartes d'instance + « Arrêter le jeu » (16/10, choix A de Rushi) ---------
// Serveur moddé : son dossier instances/<slug>. Vanilla : les fichiers du jeu sont partagés
// (GAME_ROOT), instances/<slug> ne contient qu'un marqueur — rien de propre à supprimer.
const INSTANCE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;
// Tout handler qui construit instances/<slug> verifie d'abord le slug (audit 25/10) : un slug
// comme "../x" sortirait sinon du dossier des instances.
function isValidInstanceSlug(slug) {
  return typeof slug === "string" && INSTANCE_SLUG_RE.test(slug);
}
// Toujours gardés (mondes solo) ; « captures et réglages » gardés si la case est cochée.
const INSTANCE_ALWAYS_KEEP = ["saves"];
const INSTANCE_PERSONAL_KEEP = ["screenshots", "options.txt", "optionsof.txt", "optionsshaders.txt"];

async function instanceDirs(slug) {
  if (!isValidInstanceSlug(slug)) throw new Error("Serveur invalide.");
  const instanceDir = path.join(GAME_ROOT, "instances", slug);
  const modded = !!(await readInstalledState(instanceDir));
  return { instanceDir, modded, gameDir: modded ? instanceDir : GAME_ROOT };
}

async function pathSize(target) {
  let stat;
  try {
    stat = await fsp.lstat(target);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.size;
  let total = 0;
  for (const name of await fsp.readdir(target).catch(() => [])) total += await pathSize(path.join(target, name));
  return total;
}

// Entrées du dossier d'instance qui partiraient avec « Supprimer », et leur poids.
async function removableEntries(instanceDir, keepPersonal) {
  const keep = new Set([...INSTANCE_ALWAYS_KEEP, ...(keepPersonal ? INSTANCE_PERSONAL_KEEP : [])]);
  const names = await fsp.readdir(instanceDir).catch(() => []);
  const entries = [];
  for (const name of names) {
    if (keep.has(name.toLowerCase())) continue;
    entries.push({ name, bytes: await pathSize(path.join(instanceDir, name)) });
  }
  return entries;
}

// slug null : n'importe quel serveur (Reparer / Vider le cache, fichiers partages).
function instanceBusy(slug) {
  if (gamesMove.active) return "moving";
  if (getRunningGame()) return "running";
  if (gameLaunchInProgress) return "launching";
  if ([...installTasks.values()].some((t) => (slug === null || t.slug === slug) && (t.status === "active" || t.status === "paused"))) return "installing";
  return null;
}

// Mode Jouer : le slug interne "play:<id>" n'est pas un serveur de l'annuaire, on ne l'envoie pas au site.
function publicPlayingSlug() {
  const slug = getRunningGame()?.slug ?? null;
  return slug && String(slug).startsWith("play:") ? null : slug;
}

ipcMain.handle("game:status", () => {
  const game = getRunningGame();
  return { running: !!game, slug: game?.slug ?? null };
});

ipcMain.handle("game:stop", () => {
  const stopped = stopGame();
  if (stopped) logStore.pushLog({ source: "launcher", message: "Minecraft arrêté par le joueur." });
  return { ok: stopped };
});

ipcMain.handle("instances:openFolder", async (_event, slug) => {
  try {
    const { gameDir } = await instanceDirs(slug);
    await fsp.mkdir(gameDir, { recursive: true });
    const error = await shell.openPath(gameDir);
    return { ok: !error, error: error || undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("instances:readLog", async (_event, slug) => {
  try {
    const { gameDir } = await instanceDirs(slug);
    const text = await fsp.readFile(path.join(gameDir, "logs", "latest.log"), "utf8");
    // La fin seulement : un latest.log moddé peut faire plusieurs Mo.
    const lines = text.split(/\r?\n/);
    return { ok: true, text: lines.slice(-600).join("\n"), truncated: lines.length > 600, fullText: text.length <= 2_000_000 ? text : null };
  } catch (error) {
    if (error?.code === "ENOENT") return { ok: true, text: "", missing: true };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("instances:openLogsFolder", async (_event, slug) => {
  try {
    const { gameDir } = await instanceDirs(slug);
    const logsDir = path.join(gameDir, "logs");
    const exists = await fsp.access(logsDir).then(() => true, () => false);
    const error = await shell.openPath(exists ? logsDir : gameDir);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
});

// Taille sur le disque de chaque serveur installe (Ma bibliotheque > Installes, lot 3). Lue en
// arriere-plan apres l'affichage de la liste.
ipcMain.handle("instances:sizes", async (_event, slugs) => {
  const out = {};
  if (!Array.isArray(slugs)) return out;
  for (const slug of slugs.slice(0, 200)) {
    if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/i.test(slug)) continue;
    out[slug] = await pathSize(path.join(GAME_ROOT, "instances", slug));
  }
  return out;
});

ipcMain.handle("instances:filesInfo", async (_event, slug) => {
  try {
    const { instanceDir, modded } = await instanceDirs(slug);
    const sum = (entries) => entries.reduce((total, entry) => total + entry.bytes, 0);
    return {
      ok: true,
      modded,
      bytesKeep: sum(await removableEntries(instanceDir, true)),
      bytesAll: sum(await removableEntries(instanceDir, false)),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// « Supprimer les fichiers » : retire mods/config/ressources de l'instance, le serveur reste dans
// la liste (tout revient au prochain « Rejoindre »). Refusé tant que le jeu tourne ou qu'une
// installation de ce serveur est en cours (fichiers verrouillés / à moitié écrits).
ipcMain.handle("instances:deleteFiles", async (_event, slug, { keepPersonal = true } = {}) => {
  try {
    const busy = instanceBusy(slug);
    if (busy) return { ok: false, code: busy };
    const { instanceDir, modded } = await instanceDirs(slug);
    // Serveur vanilla retiré du site (23/10) : son dossier n'a que le marqueur « prêt » ; le retirer
    // suffit pour qu'il quitte Ma bibliothèque. Jamais pour un serveur encore en ligne.
    if (!modded && isKnownRemoved(slug)) {
      await fsp.rm(path.join(instanceDir, ".omniscient-ready.json"), { force: true });
      await fsp.rmdir(instanceDir).catch(() => {});
      logStore.pushLog({ source: "launcher", message: `Serveur retiré "${slug}" : marqueur vanilla supprimé.` });
      return { ok: true, freedBytes: 0 };
    }
    if (!modded) return { ok: false, code: "vanilla" };
    const entries = await removableEntries(instanceDir, keepPersonal);
    let freedBytes = 0;
    for (const entry of entries) {
      await fsp.rm(path.join(instanceDir, entry.name), { recursive: true, force: true });
      freedBytes += entry.bytes;
    }
    clearServerCaches();
    logStore.pushLog({ source: "launcher", message: `Fichiers de "${slug}" supprimés (${Math.round(freedBytes / 1024 / 1024)} Mo libérés).` });
    return { ok: true, freedBytes };
  } catch (error) {
    logStore.pushLog({ level: "error", source: "launcher", message: `Suppression des fichiers de "${slug}" échouée : ${error instanceof Error ? error.message : error}` });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// --- Suppression en masse avec corbeille et Annuler (serie 2, idee 7, version A) ---------------
// Les fichiers de chaque instance cochee partent d'abord dans GAME_ROOT/.corbeille/<lot>/<slug>
// (simple deplacement sur le meme disque : instantane, et « Annuler » les remet en place). Passe
// le delai d'Annuler, le lot part dans la corbeille de Windows (encore recuperable tant qu'on ne
// la vide pas). Un lot oublie (launcher ferme pendant le delai) y part au demarrage suivant.
const TRASH_ROOT = path.join(GAME_ROOT, ".corbeille");

ipcMain.handle("instances:trashFiles", async (_event, slugs, { keepPersonal = true } = {}) => {
  if (!Array.isArray(slugs) || !slugs.length) return { ok: false, error: "Rien à supprimer." };
  const batch = `lot-${Date.now()}`;
  const done = [];
  const refused = [];
  let freedBytes = 0;
  const runningSlug = getRunningGame()?.slug || null;
  for (const slug of slugs.slice(0, 200)) {
    try {
      if (slug === runningSlug) {
        refused.push({ slug, code: "running" });
        continue;
      }
      if ([...installTasks.values()].some((t) => t.slug === slug && (t.status === "active" || t.status === "paused" || t.status === "queued"))) {
        refused.push({ slug, code: "installing" });
        continue;
      }
      const { instanceDir, modded } = await instanceDirs(slug);
      if (!modded) {
        refused.push({ slug, code: "vanilla" });
        continue;
      }
      const target = path.join(TRASH_ROOT, batch, slug);
      await fsp.mkdir(target, { recursive: true });
      for (const entry of await removableEntries(instanceDir, keepPersonal)) {
        await fsp.rename(path.join(instanceDir, entry.name), path.join(target, entry.name));
        freedBytes += entry.bytes;
      }
      done.push(slug);
    } catch (error) {
      refused.push({ slug, code: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }
  clearServerCaches();
  logStore.pushLog({ source: "launcher", message: `Suppression en masse : ${done.length} instance(s) mises de côté (${Math.round(freedBytes / 1024 / 1024)} Mo), lot ${batch}.` });
  return { ok: true, batch, done, refused, freedBytes };
});

ipcMain.handle("instances:undoTrash", async (_event, batch) => {
  if (typeof batch !== "string" || !/^lot-\d+$/.test(batch)) return { ok: false };
  const batchDir = path.join(TRASH_ROOT, batch);
  const slugs = await fsp.readdir(batchDir).catch(() => []);
  for (const slug of slugs) {
    const { instanceDir } = await instanceDirs(slug);
    const from = path.join(batchDir, slug);
    for (const name of await fsp.readdir(from).catch(() => [])) {
      // Un fichier recree entre-temps (nouvelle installation) n'est jamais ecrase.
      await fsp.rename(path.join(from, name), path.join(instanceDir, name)).catch(() => {});
    }
  }
  await fsp.rm(batchDir, { recursive: true, force: true }).catch(() => {});
  clearServerCaches();
  logStore.pushLog({ source: "launcher", message: `Suppression annulée : lot ${batch} remis en place.` });
  return { ok: true, slugs };
});

async function finalizeTrashBatch(batch) {
  const batchDir = path.join(TRASH_ROOT, batch);
  try {
    await shell.trashItem(batchDir);
  } catch {
    // Corbeille Windows indisponible (disque reseau, corbeille desactivee) : suppression simple.
    await fsp.rm(batchDir, { recursive: true, force: true }).catch(() => {});
  }
}

ipcMain.handle("instances:finalizeTrash", async (_event, batch) => {
  if (typeof batch !== "string" || !/^lot-\d+$/.test(batch)) return { ok: false };
  await finalizeTrashBatch(batch);
  return { ok: true };
});

// Lots restes de la derniere session (launcher ferme pendant le delai d'Annuler).
app.whenReady().then(async () => {
  for (const batch of await fsp.readdir(TRASH_ROOT).catch(() => [])) {
    if (/^lot-\d+$/.test(batch)) await finalizeTrashBatch(batch);
  }
});

// Fiches des serveurs rejoints, triees du plus recemment rejoint au plus
// ancien. Une entree dont la fiche a disparu (serveur supprime, ou republie
// autrement) est simplement ignoree plutot que de casser tout l'onglet.
ipcMain.handle("servers:listJoined", async () => {
  const joined = [...(settingsStore.loadSettings().joinedServers || [])].sort((a, b) => b.joinedAt - a.joinedAt);
  const servers = await Promise.all(
    joined.map(async (j) => {
      try {
        // Même cache que servers:get : rouvrir « Mes instances » ne redemande plus chaque fiche.
        const data = await cachedFetch(`public:${j.slug}`, () =>
          fetchJson(`${SITE_URL}/api/public/servers/${encodeURIComponent(j.slug)}`, { headers: inviteHeaders(j.slug) }),
        );
        return data.server;
      } catch {
        return null;
      }
    }),
  );
  return { ok: true, servers: servers.filter(Boolean) };
});

// Signalement "Probleme technique" depuis la fiche d'un serveur (voir
// renderer.js/openReportDialog et site/src/app/api/launcher/servers/[slug]/
// report/route.ts) — necessite d'etre connecte, le joueur qui signale doit
// etre identifiable par le proprietaire.
ipcMain.handle("reports:submit", async (_event, { slug, category, issue, behaviorIssue, message, clientVersion, attachDiagnostics, proofUrl }) => {
  if (!currentSession) return { ok: false, error: "Pas de compte Microsoft connecté." };
  try {
    const res = await fetch(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...launcherAuthHeaders(), ...inviteHeaders(slug) },
      body: JSON.stringify({
        reporterMinecraftUuid: currentSession.profile.id,
        reporterMinecraftUsername: currentSession.profile.name,
        category,
        issue,
        behaviorIssue,
        message,
        proofUrl: proofUrl || null,
        clientVersion: attachDiagnostics ? clientVersion || null : null,
        launcherVersion: attachDiagnostics ? app.getVersion() : null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// « Prévenir le serveur » (design 17/10, point 6) : rapport d'echec d'installation/lancement envoye
// au proprietaire, seulement apres le clic du joueur sur « Envoyer » ou « Prévenir le serveur ».
// Audit du 19/10 (L-B1) : plus aucune ligne du journal (il contenait le chat du jeu, l'adresse
// d'autres serveurs, parfois prives, et le nom de la session Windows). Ne partent que le type
// d'erreur, une phrase lisible, un court detail nettoye (mod concerne, message d'erreur) et les
// versions. Jamais l'e-mail ni le compte Microsoft : seul l'UUID Minecraft sert a compter les
// joueurs touches (verifie par le site).
function scrubReportText(text) {
  let out = String(text || "");
  // Tout ce qui suivrait un message du chat (« [CHAT] <Joueur> ... ») : jamais envoye.
  out = out.replace(/\[CHAT\][^\n]*/gi, "[chat]");
  const home = os.homedir();
  if (home) {
    for (const form of [home, home.replace(/\\/g, "/"), encodeURI(home.replace(/\\/g, "/"))]) {
      out = out.replace(new RegExp(form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "~");
    }
  }
  return out
    // Filet de securite : tout autre dossier de session Windows (C:\Users\<nom>).
    .replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/"'<>\n]+/gi, "~")
    // Adresses de serveurs : IP (avec ou sans port), nom d'hote suivi d'un port.
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, "[adresse]")
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+:\d{2,5}\b/gi, "[adresse]")
    .replace(/Connecting to [^\n,]+,\s*\d+/gi, "Connecting to [adresse]")
    .slice(0, 300);
}

ipcMain.handle("servers:reportInstallProblem", async (_event, { slug, kind, summary, detail, minecraftVersion } = {}) => {
  if (!currentSession) return { ok: false, error: "Pas de compte Microsoft connecté." };
  if (typeof slug !== "string" || !slug) return { ok: false, error: "Serveur inconnu." };
  try {
    const res = await fetch(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/install-problem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...launcherAuthHeaders(), ...inviteHeaders(slug) },
      body: JSON.stringify({
        reporterMinecraftUuid: currentSession.profile.id,
        kind,
        summary: scrubReportText(summary).slice(0, 200),
        detail: detail ? scrubReportText(detail) || null : null,
        launcherVersion: app.getVersion(),
        minecraftVersion: typeof minecraftVersion === "string" ? minecraftVersion.slice(0, 40) : null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Cloche de notifications : alertes personnelles (reponse/resolution de
// signalement) pour le joueur connecte, voir renderer.js/refreshNotifications
// et site/src/app/api/launcher/notifications/route.ts.
ipcMain.handle("notifications:list", async (_event, opts) => {
  if (!currentSession) return { ok: true, notifications: [] };
  try {
    const data = await withSessionRetry(() =>
      fetchJson(
        `${SITE_URL}/api/launcher/notifications?minecraftUuid=${encodeURIComponent(currentSession.profile.id)}`,
        { headers: launcherAuthHeaders(), background: !!opts?.background },
      ),
    );
    return { ok: true, notifications: data.notifications };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

ipcMain.handle("notifications:markRead", async () => {
  if (!currentSession) return { ok: false, error: "Pas de compte Microsoft connecté." };
  try {
    const res = await fetch(`${SITE_URL}/api/launcher/notifications/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...launcherAuthHeaders() },
      body: JSON.stringify({ minecraftUuid: currentSession.profile.id }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

ipcMain.handle("notifications:delete", async (_event, id) => {
  if (!currentSession) return { ok: false, error: "Pas de compte Microsoft connecté." };
  try {
    const res = await fetch(`${SITE_URL}/api/launcher/notifications/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...launcherAuthHeaders() },
      body: JSON.stringify({ minecraftUuid: currentSession.profile.id, id }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

ipcMain.handle("notifications:clearRead", async () => {
  if (!currentSession) return { ok: false, error: "Pas de compte Microsoft connecté." };
  try {
    const res = await fetch(`${SITE_URL}/api/launcher/notifications/clear-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...launcherAuthHeaders() },
      body: JSON.stringify({ minecraftUuid: currentSession.profile.id }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

ipcMain.handle("auth:signIn", async (_event, remember) => {
  try {
    const { profile, authorization, refreshToken } = await msAuth.signIn();
    // Toujours défini avant la tentative de sauvegarde : si le compte
    // signIn a réussi, cette réponse doit rester "ok" même si la
    // persistance échoue ensuite (écriture disque, coffre indisponible...).
    setSession(profile, authorization, { freshLogin: true });

    let remembered = false;
    if (remember && refreshToken) {
      try {
        remembered = !!sessionStore.rememberAccount(profile.id, profile.name, refreshToken);
      } catch {
        remembered = false;
      }
    }
    sessionRemembered = remembered;
    // Pas de "se souvenir de moi" : on ne touche plus aux AUTRES comptes
    // déjà mémorisés (multi-compte) — juste cette session-ci ne survivra
    // pas au redémarrage.

    return { ok: true, profile, rememberFailed: remember && !remembered };
  } catch (error) {
    if (error instanceof msAuth.PendingApprovalError) {
      return { ok: false, pendingApproval: true, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Appelé une fois au démarrage de l'app : tente de reprendre le compte actif
// mémorisé sans ouvrir de fenêtre de connexion.
ipcMain.handle("auth:tryRestore", async () => {
  const { accounts, activeId } = sessionStore.loadAccounts();
  const active = accounts.find((a) => a.id === activeId);
  if (!active) return { ok: false };

  try {
    const { profile, authorization, refreshToken: newRefreshToken } = await msAuth.refreshSession(
      active.refreshToken,
    );
    setSession(profile, authorization);
    sessionRemembered = true;
    try {
      sessionStore.rememberAccount(profile.id, profile.name, newRefreshToken);
    } catch {
      // La session reste valide en mémoire pour cette fois ; seule la
      // mémorisation pour la prochaine fois est perdue.
    }
    return { ok: true, profile };
  } catch (error) {
    // N'oublier le compte que s'il est vraiment invalide/révoqué côté
    // Microsoft ("invalid_grant") — pas sur une panne réseau passagère, ni
    // sur le blocage temporaire "en attente d'approbation" (les identifiants
    // Microsoft/Xbox restent valides dans ce cas).
    if (error.code === "invalid_grant") {
      try {
        sessionStore.forgetAccount(active.id);
      } catch {
        // Rien de plus à faire : le refresh_token est de toute façon invalide
        // côté Microsoft, seul le nettoyage du fichier local a échoué.
      }
    } else if (error.rotatedRefreshToken) {
      // Microsoft a quand même pu renouveler (et donc invalider l'ancien)
      // le refresh_token avant que la suite échoue : on garde le nouveau
      // pour ne pas se retrouver avec un token déjà mort au prochain essai.
      try {
        sessionStore.rememberAccount(active.id, active.name, error.rotatedRefreshToken);
      } catch {
        // idem : tant pis pour cette fois.
      }
    }
    if (error instanceof msAuth.PendingApprovalError) {
      return { ok: false, pendingApproval: true, error: error.message };
    }
    return { ok: false };
  }
});

// Cookies Microsoft de la fenetre de connexion effaces a la deconnexion et a la suppression d'un
// compte (voir msAuth.clearLoginStorage) : un echec est seulement journalise.
async function clearMicrosoftLoginStorage() {
  if (!(await msAuth.clearLoginStorage())) {
    logStore.pushLog({ level: "warn", source: "launcher", message: "Déconnexion : cookies Microsoft de la fenêtre de connexion non effacés" });
  }
}

ipcMain.handle("auth:signOut", async () => {
  // Ne retire pas le compte de la liste mémorisée (juste désactive la
  // reprise automatique) : on peut y rebasculer rapidement depuis la page
  // de gestion du compte sans se reconnecter à Microsoft.
  try {
    sessionStore.clearActiveAccount();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
  await revokeLauncherSession();
  currentSession = null;
  features.refresh();
  await clearMicrosoftLoginStorage();
  return { ok: true };
});

// Multi-compte : liste des comptes mémorisés (jamais leur refresh_token),
// bascule vers un autre compte déjà mémorisé, et oubli définitif d'un
// compte. "Ajouter un compte" réutilise auth:signIn tel quel côté renderer.
ipcMain.handle("account:list", () => {
  const { accounts, activeId } = sessionStore.loadAccounts();
  return { accounts: accounts.map((a) => ({ id: a.id, name: a.name })), activeId };
});

ipcMain.handle("account:switch", async (_event, id) => {
  const { accounts } = sessionStore.loadAccounts();
  const account = accounts.find((a) => a.id === id);
  if (!account) return { ok: false, error: "Compte introuvable." };

  try {
    const { profile, authorization, refreshToken: newRefreshToken } = await msAuth.refreshSession(
      account.refreshToken,
    );
    setSession(profile, authorization);
    sessionRemembered = true;
    // La bascule elle-meme a deja reussi (currentSession a change) : un echec de
    // persistance ici ne doit pas etre rapporte comme un echec total (comparer avec
    // auth:signIn/auth:tryRestore, qui isolent deja ce cas) — juste averti par log, le
    // compte reste simplement pas remis a jour sur disque pour la prochaine fois.
    try {
      sessionStore.rememberAccount(profile.id, profile.name, newRefreshToken);
    } catch (persistError) {
      logStore.pushLog({ level: "warn", source: "launcher", message: `Bascule de compte : mémorisation échouée (${persistError instanceof Error ? persistError.message : persistError})` });
    }
    return { ok: true, profile };
  } catch (error) {
    if (error.code === "invalid_grant") {
      sessionStore.forgetAccount(id);
    }
    if (error instanceof msAuth.PendingApprovalError) {
      return { ok: false, pendingApproval: true, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Impossible de basculer sur ce compte." };
  }
});

ipcMain.handle("account:remove", async (_event, id) => {
  try {
    sessionStore.forgetAccount(id);
    if (currentSession?.profile?.id === id) {
      await revokeLauncherSession();
      currentSession = null;
    }
    await clearMicrosoftLoginStorage();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Changement de skin : le renderer lit le fichier choisi et envoie ses
// octets bruts par IPC (jamais d'accès réseau direct depuis le renderer,
// même principe que fetchJson côté serveurs — voir plus haut).
ipcMain.handle("account:changeSkin", async (_event, { variant, fileBuffer }) => {
  if (!currentSession) return { ok: false, error: "Connecte-toi d'abord avec ton compte Microsoft." };
  try {
    const form = new FormData();
    form.append("variant", variant === "slim" ? "slim" : "classic");
    form.append("file", new Blob([fileBuffer], { type: "image/png" }), "skin.png");

    const res = await fetch("https://api.minecraftservices.com/minecraft/profile/skins", {
      method: "POST",
      headers: { Authorization: `Bearer ${currentSession.authorization.access_token}` },
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.errorMessage || `Le serveur Minecraft a refusé le skin (${res.status}).` };
    }
    const profile = await res.json();
    setSession(profile, currentSession.authorization);
    return { ok: true, profile };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

ipcMain.handle("account:resetSkin", async () => {
  if (!currentSession) return { ok: false, error: "Connecte-toi d'abord avec ton compte Microsoft." };
  try {
    const res = await fetch("https://api.minecraftservices.com/minecraft/profile/skins/active", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${currentSession.authorization.access_token}` },
    });
    if (!res.ok) {
      return { ok: false, error: `Le serveur Minecraft a refusé la réinitialisation (${res.status}).` };
    }
    let profile = currentSession.profile;
    try {
      profile = await res.json();
    } catch {
      // Corps de réponse vide : on relit le profil pour renvoyer l'état à
      // jour au renderer plutôt que de garder l'ancien skin en mémoire.
      const profileRes = await fetch("https://api.minecraftservices.com/minecraft/profile", {
        headers: { Authorization: `Bearer ${currentSession.authorization.access_token}` },
      });
      if (profileRes.ok) profile = await profileRes.json();
    }
    setSession(profile, currentSession.authorization);
    return { ok: true, profile };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Boutons de la barre de titre custom (fenêtre sans cadre natif, voir
// createWindow) — chaque handler agit sur la fenêtre de l'appelant, jamais
// une fenêtre codée en dur, au cas où plusieurs fenêtres existeraient.
// Clic sur une notification Windows (« prêt à jouer », point 4) : ramene la fenetre devant.
ipcMain.handle("window:focus", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

// Place libre sur le disque du dossier du jeu (ecran avant la 1re installation, point 4).
ipcMain.handle("system:diskFree", async () => {
  try {
    await fsp.mkdir(GAME_ROOT, { recursive: true });
    const stats = await fsp.statfs(GAME_ROOT);
    return { ok: true, freeBytes: Number(stats.bavail) * Number(stats.bsize) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Mods a ajouter a la main (point 4, L3-F) : quels fichiers attendus sont deja arrives dans le
// dossier Telechargements. Seule la presence d'un fichier de ce nom est regardee ici (pour cocher
// la ligne) ; « Réessayer » verifie ensuite taille et empreinte avant de s'en servir.
ipcMain.handle("modpack:findInDownloads", async (_event, fileNames) => {
  if (!Array.isArray(fileNames)) return [];
  const wanted = new Set(fileNames.filter((name) => typeof name === "string" && name && name === path.basename(name)).slice(0, 200));
  const found = [];
  for (const dir of manualModsSearchDirs()) {
    let names;
    try {
      names = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) if (wanted.has(name)) found.push(name);
  }
  return [...new Set(found)];
});

ipcMain.handle("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle("window:toggleMaximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  // Pendant le splash la fenetre n'est pas redimensionnable : pas d'agrandissement non plus.
  if (!win.isResizable()) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.handle("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle("window:isMaximized", (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
});

// Appele une seule fois par le renderer (voir boot() dans renderer.js) des
// que le splash de demarrage a fini son travail reel (Java + reprise de
// session) — fait passer la fenetre de la petite taille fixe du bootstrap a
// la taille normale, redimensionnable, de l'appli.
ipcMain.handle("window:expandFromBootstrap", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  // Appele deux fois par le renderer quand l'installation de Java echoue puis
  // reussit : on ne fait l'agrandissement qu'une fois.
  if (expandedWindows.has(win)) return;
  const saved = loadWindowState();
  const workArea = screen.getDisplayMatching(win.getBounds()).workArea;
  let bounds;
  let maximize;
  if (saved) {
    bounds = fitBoundsToWorkArea(saved, workArea);
    maximize = saved.maximized;
  } else {
    // Premier lancement : taille normale bornee a 90 % de l'ecran (c'est elle que
    // retrouve le bouton "Restaurer"), puis agrandie.
    const width = Math.min(APP_SIZE.width, Math.floor(workArea.width * 0.9));
    const height = Math.min(APP_SIZE.height, Math.floor(workArea.height * 0.9));
    bounds = fitBoundsToWorkArea(
      { x: workArea.x + Math.round((workArea.width - width) / 2), y: workArea.y + Math.round((workArea.height - height) / 2), width, height },
      workArea,
    );
    maximize = true;
  }
  win.setResizable(true);
  win.setMinimumSize(Math.min(APP_MIN_SIZE.width, workArea.width), Math.min(APP_MIN_SIZE.height, workArea.height));
  win.setBounds(bounds);
  // Echelle Windows differente selon l'ecran : la taille posee peut etre relue
  // autrement, on la repose une fois.
  const got = win.getBounds();
  if (got.width !== bounds.width || got.height !== bounds.height) win.setBounds(bounds);
  expandedWindows.add(win);
  if (maximize) win.maximize();
  logStore.pushLog({ level: "debug", source: "launcher", message: `[fenetre] ${JSON.stringify(bounds)} agrandie=${maximize}` });
});

// Suggestion simple et prudente : la moitie de la RAM systeme, plafonnee a
// 8 Go (rarement utile pour du Minecraft vanilla meme sur une grosse
// machine) et jamais en dessous de 2 Go pour la valeur max suggeree.
function suggestMemoryGB() {
  const totalGB = Math.round(os.totalmem() / 1024 ** 3);
  const suggestedMaxGB = Math.max(2, Math.min(8, Math.floor(totalGB / 2)));
  const suggestedMinGB = Math.max(1, Math.floor(suggestedMaxGB / 2));
  return { totalGB, suggestedMinGB, suggestedMaxGB };
}

ipcMain.handle("settings:get", () => ({
  ...settingsStore.loadSettings(),
  gameRoot: GAME_ROOT,
  logsDir: logStore.logsDir(),
  appVersion: app.getVersion(),
  ...suggestMemoryGB(),
}));

ipcMain.handle("settings:set", (_event, partial) => {
  const next = settingsStore.saveSettings(partial || {});
  if (partial && partial.logLevel !== undefined) logStore.setMinFileLevel(next.logLevel);
  // Effet immediat sur Discord, sans redemarrer : interrupteur coupe = presence effacee tout de
  // suite ; changement de langue = texte Discord retraduit.
  if (partial && partial.discordPresence !== undefined) discordPresence.setEnabled(next.discordPresence);
  if (partial && partial.locale !== undefined) discordPresence.setLocale(next.locale);
  return next;
});

ipcMain.handle("settings:reset", () => {
  const next = settingsStore.resetSettings();
  logStore.setMinFileLevel(next.logLevel);
  discordPresence.setEnabled(next.discordPresence);
  discordPresence.setLocale(next.locale);
  return next;
});

ipcMain.handle("settings:openGameFolder", () => shell.openPath(GAME_ROOT));

ipcMain.handle("java:detect", async () => {
  const settings = settingsStore.loadSettings();
  const result = await javaManager.detectJava(settings.javaPath || undefined);
  return { ...result, managed: !!settings.javaPath, installed: await javaManager.installedJavaMajors() };
});

// Installe les Java que Minecraft demande selon sa version (8, 17, 21, 25) : les
// quatre depuis les Reglages, seulement le 21 depuis le verrou de demarrage
// (`majors`) — les autres sont telecharges au lancement d'un serveur qui en a
// besoin, chaque lancement prenant ensuite celui de sa version (voir game:launch).
ipcMain.handle("java:install", async (event, majors) => {
  const wanted = Array.isArray(majors) ? majors.filter((m) => javaManager.SUPPORTED_JAVA_MAJORS.includes(m)) : [];
  const paths = await javaManager.installAllJava((status) => event.sender.send("java:installProgress", status), wanted.length ? wanted : undefined);
  // Java 21 reste le Java "par defaut" des reglages (ce que le verrou de demarrage controle) ;
  // un autre qui aurait echoue sera retente au lancement du serveur qui en a besoin.
  const done = Object.keys(paths).filter((major) => paths[major]);
  if (!paths[21]) return { ok: false, error: `Java 21 n'a pas pu être installé (obtenus : ${done.join(", ") || "aucun"}).` };
  settingsStore.saveSettings({ javaPath: paths[21] });
  return { ok: true, version: done.join(", ") };
});

// "Reparer Java" (Reglages) : supprime les Java telecharges par le launcher puis
// reinstalle les quatre. Les Java installes sur le PC ne sont pas touches.
ipcMain.handle("java:repair", async (event) => {
  try {
    javaManager.removeManagedJava();
  } catch (error) {
    return { ok: false, error: `impossible de supprimer l'ancien Java (Minecraft est-il ouvert ?) — ${error instanceof Error ? error.message : "erreur inconnue"}` };
  }
  const paths = await javaManager.installAllJava((status) => event.sender.send("java:installProgress", status));
  const failed = Object.keys(paths).filter((major) => !paths[major]);
  if (paths[21]) settingsStore.saveSettings({ javaPath: paths[21] });
  if (failed.length) return { ok: false, error: `Java ${failed.join(", ")} n'a pas pu être réinstallé.` };
  return { ok: true, version: Object.keys(paths).join(", ") };
});

// Mis en cache brievement : un clic repete sur le bouton de statut ne doit
// pas re-solliciter les services externes a chaque fois. Le bouton
// "Actualiser" du panneau (`force`) passe outre.
const STATUS_CACHE_MS = 30_000;
let statusCache = null;

ipcMain.handle("status:getServicesStatus", async (_event, force) => {
  const now = Date.now();
  if (!force && statusCache && now - statusCache.fetchedAt < STATUS_CACHE_MS) {
    return statusCache;
  }
  // Un test de debit en cours fausserait les pings : on attend qu'il soit fini.
  if (connectionRun) await connectionRun;
  const groups = await checkServicesStatus();
  statusCache = { fetchedAt: now, groups };
  return statusCache;
});

// Test de debit : une seule mesure a la fois, et une seule par jour (demande de
// Rushi, 15/10 : le test lourd a chaque ouverture faisait ramer le launcher).
// Le dernier resultat est garde sur disque : au lancement ou a l'ouverture du
// panneau, on le reaffiche s'il date d'aujourd'hui (jour local), sinon on refait
// la mesure. Seul "Actualiser" (`force`) la relance le meme jour. La progression
// est envoyee a la fenetre qui l'a demandee (barre dans le panneau).
let connectionRun = null;

function connectionTestFile() {
  return path.join(app.getPath("userData"), "connection-test.json");
}

function sameLocalDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function loadConnectionCache() {
  try {
    const saved = JSON.parse(fs.readFileSync(connectionTestFile(), "utf8"));
    return saved && typeof saved.fetchedAt === "number" ? saved : null;
  } catch {
    return null;
  }
}

function saveConnectionCache(result) {
  try {
    fs.writeFileSync(connectionTestFile(), JSON.stringify(result));
  } catch {
    // Pas grave : le test sera simplement refait au prochain lancement.
  }
}

let connectionCache = loadConnectionCache();

ipcMain.handle("status:getConnection", (event, force) => {
  if (!force && connectionCache && sameLocalDay(connectionCache.fetchedAt, Date.now())) {
    return connectionCache;
  }
  if (connectionRun) return connectionRun;
  connectionRun = measureConnection((progress) => {
    if (!event.sender.isDestroyed()) event.sender.send("status:connectionProgress", progress);
  })
    .then((result) => {
      const { down, up, errors } = result.details;
      const errorText = Object.keys(errors).length ? ` · erreurs : ${JSON.stringify(errors)}` : "";
      logStore.pushLog({
        source: "launcher",
        message: `Test de connexion : ping ${result.pingMs ?? "—"} ms · téléchargement ${result.downloadMbps ?? "—"} Mb/s (${down ? (down.bytes / 1e6).toFixed(1) : "—"} Mo en ${down?.seconds ?? "—"} s) · envoi ${result.uploadMbps ?? "—"} Mb/s (${up ? (up.bytes / 1e6).toFixed(1) : "—"} Mo en ${up?.seconds ?? "—"} s)${errorText}`,
      });
      connectionCache = { ...result, fetchedAt: result.fetchedAt ?? Date.now() };
      saveConnectionCache(connectionCache);
      return connectionCache;
    })
    .catch((error) => ({ error: error.message }))
    .finally(() => {
      connectionRun = null;
    });
  return connectionRun;
});

let gameLaunchInProgress = false;

// Registre des telechargements en cours (2026-10-11, panneau "Taches" façon
// Modrinth) — plusieurs installations en parallele pour des serveurs
// differents sont volontairement permises (modpack.js protege deja chaque
// instance/fichier individuellement : installLocks/downloadFileLocks). Ce
// registre ne remplace PAS gameLaunchInProgress, qui reste reserve au
// lancement du jeu lui-meme (minecraft-launcher-core, lui, ne supporte pas
// deux lancements simultanes) — jamais au telechargement.
let nextTaskId = 1;
const installTasks = new Map();

function serializeTask(task) {
  return {
    id: task.id,
    slug: task.slug,
    name: task.name,
    status: task.status, // "queued" | "active" | "paused" | "complete" | "error" | "cancelled"
    // Place dans la file d'attente des installations (1 = la prochaine), 0 hors file.
    queuePosition: installQueue.indexOf(task.id) + 1,
    // "launch" (Rejoindre), "install" (bouton Installer) ou "selftest" — la pilule ne propose
    // « Lancer le jeu quand c'est fini » que pour une simple installation.
    kind: task.kind,
    // Etapes visibles du panneau de la pilule (design 17/10, point 4).
    step: task.step,
    modded: task.modded,
    blocked: task.blocked,
    origins: task.origins || null,
    modsDone: task.modsDone,
    modsTotal: task.modsTotal,
    text: task.text,
    bytes: task.bytes,
    totalBytes: task.totalBytes,
    speedBps: task.speedBps,
    error: task.error,
  };
}

// File d'attente des installations (serie 2, idee 4, version A validee) : les boutons « Installer »
// passent un par un, dans l'ordre des clics. « Passer en premier » place un serveur juste apres
// celui en cours (qui continue), ✕ le retire de la file. « Rejoindre » n'attend pas dans cette file.
const installQueue = [];
let installRunning = null;

function waitForInstallTurn(task) {
  if (!installRunning) {
    installRunning = task.id;
    return Promise.resolve();
  }
  task.status = "queued";
  installQueue.push(task.id);
  return new Promise((resolve, reject) => {
    task.queueResolve = resolve;
    task.queueReject = reject;
  });
}

function releaseInstallTurn(task) {
  if (installRunning !== task.id) return;
  installRunning = null;
  const nextId = installQueue.shift();
  const next = nextId ? installTasks.get(nextId) : null;
  if (next) {
    installRunning = next.id;
    next.status = "active";
    next.lastTickAt = Date.now();
    next.queueResolve?.();
  }
  broadcastTasks();
}

ipcMain.handle("tasks:moveFirst", (_event, id) => {
  const at = installQueue.indexOf(id);
  if (at < 0) return { ok: false };
  installQueue.splice(at, 1);
  installQueue.unshift(id);
  broadcastTasks();
  return { ok: true };
});

function broadcastTasks() {
  const tasks = [...installTasks.values()].map(serializeTask);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("tasks:update", tasks);
  }
}

function createInstallTask(slug, name, kind = "launch") {
  const task = {
    id: nextTaskId++,
    slug,
    name: name || slug,
    kind,
    step: "prepare",
    modded: null,
    blocked: null,
    modsDone: 0,
    modsTotal: 0,
    status: "active",
    text: "",
    bytes: 0,
    totalBytes: 0,
    speedBps: 0,
    error: null,
    controller: new AbortController(),
    // Pause cooperative (2026-10-11) : le worker de telechargement (modpack.js)
    // attend cette promesse entre deux fichiers — resolue au clic sur Reprendre.
    pausePromise: null,
    resumeResolve: null,
    lastTickAt: Date.now(),
    lastTickBytes: 0,
  };
  installTasks.set(task.id, task);
  return task;
}

// Vitesse lissee sur des paliers d'au moins 400ms (pas a chaque chunk reçu,
// trop saccade pour un affichage lisible) — voir downloadFileLocked/
// installFiles dans modpack.js, qui appellent onProgress a chaque morceau.
function updateTaskFromProgress(task, status) {
  if (status.text) task.text = status.text;
  if (status.step) task.step = status.step;
  if (typeof status.modded === "boolean") task.modded = status.modded;
  if (status.name) task.name = status.name;
  if (status.blocked) task.blocked = status.blocked;
  // Pack FTB (21/10) : nombre de mods venus de CurseForge / Modrinth / serveurs FTB (modpack.js).
  if (status.origins) task.origins = status.origins;
  if (status.type === "mods" && typeof status.task === "number") {
    task.modsDone = status.task;
    task.modsTotal = status.total || task.modsTotal;
  }
  if (typeof status.bytes === "number") {
    const now = Date.now();
    const elapsed = now - task.lastTickAt;
    if (elapsed >= 400) {
      const deltaBytes = status.bytes - task.lastTickBytes;
      task.speedBps = elapsed > 0 ? Math.max(0, (deltaBytes / elapsed) * 1000) : task.speedBps;
      task.lastTickAt = now;
      task.lastTickBytes = status.bytes;
    }
    task.bytes = status.bytes;
  }
  if (status.totalBytes) task.totalBytes = status.totalBytes;
}

function taskWaitIfPaused(task) {
  return async () => {
    while (task.pausePromise) await task.pausePromise;
  };
}

ipcMain.handle("tasks:list", () => [...installTasks.values()].map(serializeTask));

ipcMain.handle("tasks:pause", (_event, id) => {
  const task = installTasks.get(id);
  if (!task || task.status !== "active") return { ok: false };
  task.status = "paused";
  task.pausePromise = new Promise((resolve) => {
    task.resumeResolve = resolve;
  });
  broadcastTasks();
  return { ok: true };
});

ipcMain.handle("tasks:resume", (_event, id) => {
  const task = installTasks.get(id);
  if (!task || task.status !== "paused") return { ok: false };
  task.status = "active";
  task.resumeResolve?.();
  task.pausePromise = null;
  broadcastTasks();
  return { ok: true };
});

ipcMain.handle("tasks:cancel", (_event, id) => {
  const task = installTasks.get(id);
  if (!task) return { ok: false };
  // Encore dans la file : il suffit de l'en retirer (rien n'a commence).
  const queued = installQueue.indexOf(id);
  if (queued >= 0) {
    installQueue.splice(queued, 1);
    task.status = "cancelled";
    const abort = new Error("Annulé");
    abort.name = "AbortError";
    task.queueReject?.(abort);
    broadcastTasks();
    return { ok: true };
  }
  task.controller.abort();
  // Si la tache etait en pause, il faut aussi la lever : sinon le worker
  // reste bloque a attendre une reprise qui ne viendra jamais, sans jamais
  // constater l'annulation (voir waitIfPaused dans modpack.js).
  task.resumeResolve?.();
  task.pausePromise = null;
  return { ok: true };
});

ipcMain.handle("tasks:clearCompleted", () => {
  for (const [id, task] of installTasks) {
    if (task.status === "complete" || task.status === "error" || task.status === "cancelled") installTasks.delete(id);
  }
  broadcastTasks();
  return { ok: true };
});

// Prepare les fichiers d'un serveur (modpack + Java requis) sans jamais lancer
// le jeu — partagee par "Installer" (server:install, aucune connexion requise)
// et "Rejoindre" (game:launch, qui enchaine avec launchMinecraft). Extraite le
// 2026-10-11 (audit onboarding) : avant, les deux etaient fusionnes dans
// game:launch, qui exigeait donc une session Microsoft rien que pour
// telecharger un modpack.
async function prepareServerFiles(slug, { memoryOverride, onProgress, signal, waitIfPaused }) {
  // Deux routes possibles (2026-10-11, bouton "Installer" sans connexion) :
  // /api/launcher/servers/[slug] exige desormais un joueur identifie (audit
  // securite, "Point 3") car elle renvoie l'IP reelle du serveur — jamais
  // utile pour une simple installation, seulement pour launchMinecraft() plus
  // bas. Sans session, on prend donc /api/public/servers/[slug] (memes infos
  // utiles a l'installation, jamais d'IP, aucune identite requise). Avec
  // session (Rejoindre passe toujours par attemptSignIn() avant), on garde la
  // route privilegiee comme avant, pour avoir l'IP necessaire au lancement.
  // Serveur prive : le site exige la preuve (jeton du proprietaire, ou code
  // d'invitation du serveur rejoint), voir canSeeServer cote site.
  const data = currentSession
    ? await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}`, {
        headers: { ...launcherAuthHeaders(), ...inviteHeaders(slug) },
      })
    : await fetchJson(`${SITE_URL}/api/public/servers/${encodeURIComponent(slug)}`, {
        headers: inviteHeaders(slug),
      });
  const server = data.server;
  // Nom et type du serveur pour le panneau de la pilule (etapes moddé / vanilla).
  onProgress({ name: server.name, modded: server.type === "modded" && Boolean(server.curseforgeModpackId) });
  const settings = settingsStore.loadSettings();
  // `memoryOverride` sert un lancement "juste cette fois" avec la RAM
  // recommandee du serveur (voir applyRecommendedRamIfNeeded cote
  // renderer) — jamais ecrit dans settings.json, seulement utilise pour
  // CE lancement, toujours borne par la meme limite de securite que les
  // reglages persistants.
  const memoryMinGB = memoryOverride ? settingsStore.clampGB(memoryOverride.minGB, settings.memoryMinGB) : settings.memoryMinGB;
  const memoryMaxGB = memoryOverride ? settingsStore.clampGB(memoryOverride.maxGB, settings.memoryMaxGB) : settings.memoryMaxGB;

  // Serveur moddé : installe (ou met à jour) son modpack CurseForge dans une
  // instance propre au serveur avant de lancer. Voir modpack.js.
  let modded = null;
  if (server.type === "modded" && server.curseforgeModpackId) {
    modded = await installModpack({
      config: { siteUrl: SITE_URL, apiKey: LAUNCHER_API_KEY, headers: { ...launcherAuthHeaders(), ...inviteHeaders(slug) } },
      slug,
      gameRoot: GAME_ROOT,
      javaPath: settings.javaPath || undefined,
      // Java de la version que Mojang demande pour ce jeu (voir javaManager.js).
      resolveJava: (major, onJavaProgress) =>
        javaManager.ensureJavaForMajor(major, { preferredPath: settings.javaPath || undefined, onProgress: onJavaProgress }),
      onProgress: (status) => {
        // Les mises a jour chiffrees (une par mod, ou en octets) ne sont pas journalisees.
        if (status.text && typeof status.task !== "number") logStore.pushLog({ source: "launcher", message: status.text });
        onProgress(status);
      },
      signal,
      waitIfPaused,
      manualSearchDirs: manualModsSearchDirs(),
      onWarning: (message) => logStore.pushLog({ level: "warn", source: "launcher", message }),
    });
    logStore.pushLog({
      source: "launcher",
      message: `Modpack "${modded.modpackName}" prêt (${modded.customVersion})${modded.javaMajor ? ` — Java ${modded.javaMajor}` : ""}.`,
    });
  }

  // Java de cette version de Minecraft (Mojang l'indique dans le JSON de la version ;
  // sans indication = Java 8, les versions anciennes). Un serveur moddé l'a deja resolu.
  let gameJava = modded?.javaPath;
  if (!gameJava) {
    try {
      onProgress({ step: "java" });
      const vanilla = await ensureVanillaVersion(path.join(GAME_ROOT, "versions"), server.minecraftVersion);
      gameJava = await javaManager.ensureJavaForMajor(vanilla.javaVersion?.majorVersion ?? 8, {
        preferredPath: settings.javaPath || undefined,
        onProgress: (text) => onProgress({ text }),
      });
      // Marqueur de "pret" pour un serveur vanilla (2026-10-11, bouton
      // "Installer" ouvert a tous les serveurs, pas seulement les moddes —
      // meme un vanilla vaut la peine d'etre prepare a l'avance, par exemple
      // avant un evenement programme, pour qui a une connexion lente). Les
      // moddes ont deja leur propre marqueur via installModpack/STATE_FILE ;
      // celui-ci ne sert qu'aux vanilla, qui n'ont pas de dossier d'instance
      // propre (version/Java partages entre tous les serveurs de meme version).
      await fsp.mkdir(path.join(GAME_ROOT, "instances", slug), { recursive: true });
      await fsp.writeFile(
        path.join(GAME_ROOT, "instances", slug, ".omniscient-ready.json"),
        JSON.stringify({ minecraftVersion: server.minecraftVersion, readyAt: new Date().toISOString() }),
      );
    } catch (error) {
      // Version inconnue de Mojang (snapshot, personnalisee…) : Java par defaut, comme avant.
      logStore.pushLog({ level: "warn", source: "launcher", message: `Java par défaut (version de Minecraft non résolue) : ${error instanceof Error ? error.message : error}` });
    }
  }

  return { server, settings, modded, gameJava, memoryMinGB, memoryMaxGB };
}

// Installe un serveur (modpack + Java) sans le lancer : le bouton "Installer"
// a cote de "Rejoindre" (2026-10-11, audit onboarding) — aucune connexion
// Microsoft requise, juste le telechargement des fichiers. Ne partage PAS
// gameLaunchInProgress (reserve au lancement du jeu) : plusieurs installations
// peuvent tourner en parallele pour des serveurs differents, affichees comme
// autant de taches dans le panneau — voir installTasks ci-dessus.
ipcMain.handle("server:install", async (event, slug, displayName) => {
  if (gamesMove.active) return { ok: false, error: GAMES_MOVE_BUSY };
  const already = [...installTasks.values()].find((t) => t.slug === slug && (t.status === "active" || t.status === "paused" || t.status === "queued"));
  if (!isValidInstanceSlug(slug)) return { ok: false, error: "Serveur invalide." };
  if (already) {
    return { ok: false, error: "Une installation est déjà en cours pour ce serveur.", taskId: already.id };
  }

  const task = createInstallTask(slug, displayName, "install");
  broadcastTasks();
  logStore.pushLog({ source: "launcher", message: `Demande d'installation pour "${slug}"` });
  try {
    await waitForInstallTurn(task);
    broadcastTasks();
    const onProgress = (status) => {
      updateTaskFromProgress(task, status);
      broadcastTasks();
    };
    const { modded } = await prepareServerFiles(slug, { onProgress, signal: task.controller.signal, waitIfPaused: taskWaitIfPaused(task) });
    task.status = "complete";
    task.bytes = task.totalBytes || task.bytes;
    broadcastTasks();
    return { ok: true, modded: !!modded };
  } catch (error) {
    const cancelled = error?.name === "AbortError";
    task.status = cancelled ? "cancelled" : "error";
    task.error = cancelled ? null : error instanceof Error ? error.message : "Erreur inconnue";
    broadcastTasks();
    if (cancelled) {
      logStore.pushLog({ source: "launcher", message: `Installation de "${slug}" annulée.` });
      return { ok: false, cancelled: true };
    }
    logStore.pushLog({ level: "error", source: "launcher", message: `Échec de l'installation de "${slug}" : ${task.error}` });
    return { ok: false, error: task.error, frozen: error?.code === "frozen", ...modpackErrorFields(error) };
  } finally {
    releaseInstallTurn(task);
  }
});

ipcMain.handle("game:launch", async (event, slug, memoryOverride) => {
  if (gamesMove.active) return { ok: false, error: GAMES_MOVE_BUSY };
  if (!isValidInstanceSlug(slug)) return { ok: false, error: "Serveur invalide." };
  if (!currentSession) {
    return { ok: false, error: "Connecte-toi avec ton compte Microsoft avant de rejoindre un serveur." };
  }
  if (gameLaunchInProgress) {
    // minecraft-launcher-core n'est pas conçu pour deux lancements simultanés
    // (même GAME_ROOT, mêmes fichiers) : un double-clic ou un deuxième appel
    // IPC pendant un lancement en cours pourrait corrompre le téléchargement.
    return { ok: false, error: "Un lancement du jeu est déjà en cours." };
  }
  gameLaunchInProgress = true;

  // Meme registre de taches que "Installer" (2026-10-11) : "Rejoindre" telecharge
  // aussi (voir prepareServerFiles), donc apparait dans le meme panneau — la tache
  // se termine des que les fichiers sont prets, avant launchMinecraft() (qui, lui,
  // reste suivi par la barre de progression existante, pas une tache de telechargement).
  const task = createInstallTask(slug, null, "launch");
  broadcastTasks();

  logStore.pushLog({ source: "launcher", message: `Demande de lancement pour "${slug}"` });
  try {
    const onProgress = (status) => {
      updateTaskFromProgress(task, status);
      broadcastTasks();
      event.sender.send("game:progress", status);
    };
    const { server, settings, modded, gameJava, memoryMinGB, memoryMaxGB } = await prepareServerFiles(slug, {
      memoryOverride,
      onProgress,
      signal: task.controller.signal,
      waitIfPaused: taskWaitIfPaused(task),
    });
    task.name = server.name;
    task.status = "complete";
    task.step = "start";
    task.bytes = task.totalBytes || task.bytes;
    broadcastTasks();
    // Derniere etape du panneau : « Vérification et démarrage » (bibliotheques, assets, ouverture).
    event.sender.send("game:progress", { step: "start" });

    await launchMinecraft({
      // Jeu lance / ferme : les fenetres ralentissent leurs interrogations pendant la partie.
      onGameState: (running, exitCode) => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send("game:state", running, exitCode ?? null);
        }
        // Jeu ferme : Discord revient sur « Parcourt les serveurs » (audit 14/10, K3).
        if (!running) discordPresence.setBrowsingActivity();
        // Le launcher s'était caché pendant la partie (réglage « garder le launcher ouvert » décoché) :
        // il se réaffiche tout seul quand le jeu se ferme.
        if (!running && settingsStore.shouldRestoreAfterPlaying()) {
          for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed()) continue;
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
          }
        }
      },
      authorization: currentSession.authorization,
      version: modded?.minecraftVersion ?? server.minecraftVersion,
      serverIp: server.ip,
      serverName: server.name,
      autoConnect: server.autoConnect,
      addToServerList: server.addToServerList !== false,
      onProgress,
      memory: { min: `${memoryMinGB}G`, max: `${memoryMaxGB}G` },
      // Serveur moddé : le Java demandé par sa version de Minecraft (Forge plante
      // sur un Java trop récent) ; sinon celui des réglages, comme avant.
      javaPath: gameJava || settings.javaPath || undefined,
      gameDirectory: modded?.instanceDir,
      customVersion: modded?.customVersion,
      customJvmArgs: modded?.jvmArgs,
      slug,
    });

    discordPresence.setPlayingActivity(server.name, modded?.modpackName, { isPrivate: isPrivateServer(server, slug) });

    // Compteur indicatif pour la page de gestion du serveur (site) — ne
    // doit jamais faire echouer un lancement par ailleurs reussi.
    fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/launch`, {
      method: "POST",
      headers: { ...launcherAuthHeaders(), ...inviteHeaders(slug) },
    }).catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Suivi du lancement échoué pour "${slug}" : ${error instanceof Error ? error.message : error}` }));

    return { ok: true };
  } catch (error) {
    const cancelled = error?.name === "AbortError";
    if (task.status === "active" || task.status === "paused") {
      task.status = cancelled ? "cancelled" : "error";
      task.error = cancelled ? null : error instanceof Error ? error.message : "Erreur inconnue";
      broadcastTasks();
    }
    if (cancelled) return { ok: false, cancelled: true };
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    logStore.pushLog({ level: "error", source: "launcher", message: `Échec du lancement de "${slug}" : ${message}` });
    return { ok: false, error: message, frozen: error?.code === "frozen", ...modpackErrorFields(error) };
  } finally {
    gameLaunchInProgress = false;
  }
});

// Lancement solo hors ligne (2026-10-12) : pour une instance DEJA installee (voir
// instances:listInstalled), sans session Microsoft, sans jamais contacter SITE_URL ni le
// serveur distant du proprietaire — juste ouvrir le jeu avec les mods deja presents sur le
// disque pour jouer a son propre monde local. Condition d'activation cote renderer : pas de
// session active (!currentProfile), donc probablement hors ligne ou pas connecte ; ce handler
// lui-meme ne verifie pas currentSession (un joueur avec une session perimee en memoire doit
// pouvoir s'en servir aussi), c'est au renderer de ne proposer ce bouton que dans ce cas.
// Partage gameLaunchInProgress avec game:launch : les deux lancent reellement Minecraft, un
// seul a la fois quel que soit le chemin.
ipcMain.handle("game:launchOffline", async (event, slug, memoryOverride) => {
  if (gamesMove.active) return { ok: false, error: GAMES_MOVE_BUSY };
  if (!isValidInstanceSlug(slug)) return { ok: false, error: "Serveur invalide." };
  if (gameLaunchInProgress) {
    return { ok: false, error: "Un lancement du jeu est déjà en cours." };
  }
  gameLaunchInProgress = true;

  const task = createInstallTask(slug, null, "launch");
  broadcastTasks();
  logStore.pushLog({ source: "launcher", message: `Demande de lancement hors ligne pour "${slug}"` });

  try {
    const instanceDir = path.join(GAME_ROOT, "instances", slug);
    const moddedState = await readInstalledState(instanceDir);
    let vanillaReady = null;
    if (!moddedState) {
      try {
        vanillaReady = JSON.parse(await fsp.readFile(path.join(instanceDir, ".omniscient-ready.json"), "utf8"));
      } catch {
        // Pas de marqueur du tout : rien a lancer hors ligne pour ce slug.
      }
    }
    if (!moddedState && !vanillaReady) {
      throw new Error("Cette instance n'est pas installée sur cet ordinateur.");
    }

    const settings = settingsStore.loadSettings();
    const memoryMinGB = memoryOverride ? settingsStore.clampGB(memoryOverride.minGB, settings.memoryMinGB) : settings.memoryMinGB;
    const memoryMaxGB = memoryOverride ? settingsStore.clampGB(memoryOverride.maxGB, settings.memoryMaxGB) : settings.memoryMaxGB;

    const onProgress = (status) => {
      updateTaskFromProgress(task, status);
      broadcastTasks();
      event.sender.send("game:progress", status);
    };

    const minecraftVersion = moddedState ? moddedState.minecraftVersion : vanillaReady.minecraftVersion;
    let customVersion = null;
    let jvmArgs = null;
    let gameJava = settings.javaPath || undefined;

    if (moddedState) {
      // Memes briques que prepareServerFiles/installModpack (installLoader, prepareLaunchVersion),
      // mais JAMAIS installModpack lui-meme : il commence par interroger le site
      // (/api/launcher/servers/[slug]/modpack) pour redemander le modpack, ce qui echouerait (ou
      // pire, attendrait un timeout) sans internet et n'est de toute facon pas necessaire — les
      // fichiers sont deja sur le disque (STATE_FILE), seul le profil de lancement (version
      // "-omniscient" fusionnee) doit etre recalcule. installLoader/ensureVanillaVersion ne font
      // de requete reseau que si le fichier attendu manque localement (installateur/JSON deja en
      // cache ici, puisque l'instance a ete installee en ligne avant).
      const loaderVersionId = await installLoader({
        loaderId: moddedState.loaderId,
        minecraftVersion,
        gameRoot: GAME_ROOT,
        javaPath: settings.javaPath || undefined,
        onProgress,
      });
      const prepared = await prepareLaunchVersion({ gameRoot: GAME_ROOT, loaderVersionId, minecraftVersion });
      customVersion = prepared.customVersion;
      jvmArgs = prepared.jvmArgs;
    }

    try {
      const vanilla = await ensureVanillaVersion(path.join(GAME_ROOT, "versions"), minecraftVersion);
      gameJava = await javaManager.ensureJavaForMajor(vanilla.javaVersion?.majorVersion ?? 8, {
        preferredPath: settings.javaPath || undefined,
        onProgress: (text) => onProgress({ text }),
      });
    } catch (error) {
      logStore.pushLog({ level: "warn", source: "launcher", message: `Java par défaut (hors ligne, version non résolue) : ${error instanceof Error ? error.message : error}` });
    }

    task.status = "complete";
    task.bytes = task.totalBytes || task.bytes;
    broadcastTasks();

    // Profil "hors connexion" (voir Authenticator.getAuth de minecraft-launcher-core, meme forme
    // de sortie) : aucun jeton Mojang reel, aucun appel reseau — exactement ce que fait le
    // launcher officiel avec son bouton "Jouer hors connexion". On reprend l'UUID/pseudo du
    // dernier compte Microsoft memorise sur CET ordinateur (sessionStore, lu localement, jamais
    // envoye nulle part) plutot qu'en generer un nouveau : le monde solo et les stats du joueur
    // restent lies au MEME identifiant qu'en ligne. Aucun compte memorise (jamais connecte sur ce
    // poste) : profil local generique.
    const { accounts, activeId } = sessionStore.loadAccounts();
    const rememberedAccount = accounts.find((a) => a.id === activeId) || accounts[0] || null;
    const offlineName = rememberedAccount?.name || "Joueur";
    const offlineUuid = rememberedAccount?.id || crypto.randomUUID();
    const offlineAuthorization = {
      access_token: offlineUuid,
      client_token: offlineUuid,
      uuid: offlineUuid,
      name: offlineName,
      user_properties: "{}",
      meta: { type: "mojang", demo: false },
    };

    await launchMinecraft({
      onGameState: (running) => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send("game:state", running);
        }
        if (!running) discordPresence.setBrowsingActivity();
        if (!running && settingsStore.shouldRestoreAfterPlaying()) {
          for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed()) continue;
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
          }
        }
      },
      authorization: offlineAuthorization,
      version: minecraftVersion,
      // Jamais d'IP/autoConnect ici : impossible de joindre le serveur du proprietaire sans
      // internet, et ce n'est pas le but — juste ouvrir le jeu pour une partie solo locale.
      serverIp: null,
      serverName: null,
      autoConnect: false,
      onProgress,
      memory: { min: `${memoryMinGB}G`, max: `${memoryMaxGB}G` },
      javaPath: gameJava || settings.javaPath || undefined,
      gameDirectory: moddedState ? instanceDir : undefined,
      customVersion,
      customJvmArgs: jvmArgs,
      slug,
    });

    logStore.pushLog({ source: "launcher", message: `Jeu lancé hors ligne pour "${slug}" (profil local "${offlineName}").` });
    return { ok: true, offline: true };
  } catch (error) {
    const cancelled = error?.name === "AbortError";
    if (task.status === "active" || task.status === "paused") {
      task.status = cancelled ? "cancelled" : "error";
      task.error = cancelled ? null : error instanceof Error ? error.message : "Erreur inconnue";
      broadcastTasks();
    }
    if (cancelled) return { ok: false, cancelled: true };
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    logStore.pushLog({ level: "error", source: "launcher", message: `Échec du lancement hors ligne de "${slug}" : ${message}` });
    return { ok: false, error: message };
  } finally {
    gameLaunchInProgress = false;
  }
});

// --- Mode « Jouer » (bêta, 24/10) ---------------------------------------------------------
// Jouer à n'importe quelle version sans serveur, en vanilla ou avec un pack officiel, et garder
// ses mondes sauvegardés. Tout le travail sur le disque est dans playMode.js ; ici : les appels
// du renderer, le lancement (même verrou et même panneau de tâches que « Rejoindre ») et les
// sauvegardes à la fermeture du jeu.
const playMode = createPlayMode({ gameRoot: GAME_ROOT, appDataDir: app.getPath("appData") });

// Packs officiels publiés (site) : gardés 10 min en mémoire et sur le disque, pour pouvoir
// relancer une version avec pack même si le site est injoignable.
const PLAY_PACKS_CACHE = path.join(playMode.PLAY_ROOT, "packs-cache.json");
let playPacksCache = null;
async function fetchPlayPacks({ force = false } = {}) {
  if (!force && playPacksCache && Date.now() - playPacksCache.at < 10 * 60_000) return playPacksCache.data;
  try {
    const data = await fetchJson(`${SITE_URL}/api/public/play/packs`, { headers: launcherAuthHeaders() });
    playPacksCache = { at: Date.now(), data };
    fsp.mkdir(playMode.PLAY_ROOT, { recursive: true }).then(() => fsp.writeFile(PLAY_PACKS_CACHE, JSON.stringify(data))).catch(() => {});
    return data;
  } catch (error) {
    try {
      const data = JSON.parse(await fsp.readFile(PLAY_PACKS_CACHE, "utf8"));
      return { ...data, offline: true };
    } catch {
      // Pas de cache : le badge bêta reste affiché, aucun pack proposé (Vanilla seulement).
      return { beta: true, packs: [], offline: true, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
// Version publiée d'un pack, aplatie pour playMode.createVersion (packId, versionId, files…).
function flattenPackVersion(pack, version) {
  return {
    packId: pack.id,
    slug: pack.slug,
    name: pack.name,
    versionId: version.id,
    loaderVersion: version.loaderVersion,
    files: version.files,
    updatedAt: version.updatedAt,
  };
}

// Synchro cloud des mondes (Supporter ; voir worldCloud.js) : envoi en arrière-plan, en pause
// pendant le jeu, reprise au prochain démarrage. L'état est poussé au renderer (« cloud:update »).
// Monde téléchargé d'un autre PC : on retrouve son pack et sa version (meta.json du zip).
async function ensureVersionForMeta(meta) {
  const mc = meta?.minecraftVersion;
  if (!mc) return null;
  const versions = playMode.listVersions();
  if (meta.pack) {
    const local = versions.find((v) => v.minecraftVersion === mc && v.pack && (v.pack.packId === meta.pack.packId || v.pack.slug === meta.pack.slug));
    if (local) return local.id;
    const data = await fetchPlayPacks();
    const p = (data.packs || []).find((x) => x.id === meta.pack.packId || x.slug === meta.pack.slug);
    const v = p?.versions?.find((x) => x.minecraftVersion === mc);
    if (p && v) return (await playMode.createVersion({ minecraftVersion: mc, pack: flattenPackVersion(p, v) })).id;
  }
  const vanilla = versions.find((v) => v.minecraftVersion === mc && !v.pack);
  if (vanilla) return vanilla.id;
  await playMode.listMinecraftVersions().catch(() => {});
  return (await playMode.createVersion({ minecraftVersion: mc })).id;
}
// Plusieurs PC : identité de cet appareil pour le site (verrou « monde ouvert », version envoyée).
// Nom = nom de l'ordinateur ; en dev, MCHUB_DEVICE_NAME le remplace, et un profil jetable
// (MCHUB_USER_DATA_DIR) a son propre identifiant : de quoi simuler un 2e PC sur le même ordinateur.
function loadDevice() {
  const file = path.join(app.getPath("userData"), "device.json");
  let id = null;
  try {
    id = JSON.parse(fs.readFileSync(file, "utf8")).id;
  } catch {
    /* premier lancement */
  }
  if (!/^[\w-]{8,64}$/.test(id || "")) {
    id = require("node:crypto").randomUUID();
    try {
      fs.writeFileSync(file, JSON.stringify({ id }));
    } catch {
      /* dossier en lecture seule : identifiant de cette session seulement */
    }
  }
  const name = ((isDev && process.env.MCHUB_DEVICE_NAME) || os.hostname() || "PC").slice(0, 60);
  return { id, name };
}
// Version d'un monde téléchargé : installée en arrière-plan (Minecraft, Java, pack). Un « Jouer »
// sur la même version attend la fin, pour ne jamais installer deux fois les mêmes fichiers.
const versionInstalls = new Map();
let downloadedCount = 0;
function installVersionInBackground(versionId) {
  if (versionInstalls.has(versionId)) return versionInstalls.get(versionId);
  const run = (async () => {
    const settings = settingsStore.loadSettings();
    await playMode.prepareVersion(versionId, {
      deps: { ensureVanillaVersion, ensureJavaForMajor: javaManager.ensureJavaForMajor, installLoader, prepareLaunchVersion, installFiles },
      javaPreferred: settings.javaPath || undefined,
    });
  })().finally(() => versionInstalls.delete(versionId));
  versionInstalls.set(versionId, run);
  return run;
}
const worldCloud = createWorldCloud({
  playMode,
  siteUrl: SITE_URL,
  authHeaders: launcherAuthHeaders,
  currentUuid: () => currentSession?.profile?.id || null,
  log: (level, message) => logStore.pushLog({ level, source: "launcher", message }),
  onUpdate: (job) => {
    for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("cloud:update", job);
  },
  onDownload: (djob) => {
    for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("cloud:downloadUpdate", djob);
    // Un monde de plus arrivé sur ce PC : la liste se met à jour (une fois par monde).
    const arrived = djob ? djob.items.filter((i) => i.phase === "install" || i.done).length : 0;
    if (arrived !== downloadedCount) {
      downloadedCount = arrived;
      if (arrived) for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("play:worldsChanged");
    }
  },
  ensureVersionForMeta,
  installVersion: installVersionInBackground,
  device: loadDevice(),
});
// Versions miroir : la limite d'un monde sur ce PC s'applique aussi à ses versions en ligne.
playMode.onBackupsPruned((key, drop) => worldCloud.dropPruned(key, drop));
// Sauvegarde pendant la partie (F6, Maj+F6, toutes les X min, sortie d'un monde) : voir liveSave.js.
const liveSave = createLiveSave({
  playMode,
  overlay: createSaveOverlay({ lockNavigation: lockAppNavigation, log: (entry) => logStore.pushLog(entry) }),
  globalShortcut,
  onBackup: (key, backup) => {
    worldCloud.queueBackup(key, backup);
    for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("play:worldsChanged");
  },
  onActivity: sendSaveActivity,
  log: (entry) => logStore.pushLog(entry),
  getLocale: () => settingsStore.loadSettings().locale,
  getToastEnabled: () => settingsStore.loadSettings().playSaveToast !== false,
  getDiscreet: () => settingsStore.loadSettings().discreetMode === true,
  trackWindow: trackGameWindow,
});
const cloudError = (error) => ({ ok: false, error: error instanceof Error ? error.message : String(error), code: error?.code });
ipcMain.handle("cloud:status", async (_event, opts) => {
  if (!currentSession) return { ok: false, code: "session" };
  try {
    return await worldCloud.status({ force: opts?.force === true });
  } catch (error) {
    return cloudError(error);
  }
});
ipcMain.handle("cloud:testConnection", () => worldCloud.testConnection());
ipcMain.handle("cloud:sync", async (_event, keys) => {
  try {
    return await worldCloud.sync(Array.isArray(keys) ? keys.filter((k) => typeof k === "string") : []);
  } catch (error) {
    return cloudError(error);
  }
});
ipcMain.handle("cloud:remove", (_event, key) => worldCloud.remove(String(key || "")));
ipcMain.handle("cloud:pause", () => worldCloud.pause());
ipcMain.handle("cloud:resume", () => worldCloud.resume());
ipcMain.handle("cloud:stop", () => worldCloud.stop());
// « Versions en ligne » (25/10) : ☁ Envoyer / ✕ Retirer du cloud sur une sauvegarde.
ipcMain.handle("cloud:sendBackup", (_e, key, backupId) => worldCloud.sendBackup(String(key || ""), String(backupId || "")));
ipcMain.handle("cloud:uncloudBackup", (_e, key, backupId) => worldCloud.uncloudBackup(String(key || ""), String(backupId || "")));
// Plusieurs PC (voir worldCloud.js) : vérification avant « Jouer », récupération de la dernière
// version, attente qu'un monde soit fermé ailleurs, choix entre deux versions, téléchargements.
const sendAll = (channel, payload) => {
  for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send(channel, payload);
};
ipcMain.handle("cloud:beforePlay", async (_event, key, opts) => {
  try {
    return await worldCloud.beforePlay(String(key || ""), { force: opts?.force === true });
  } catch (error) {
    // Site injoignable : on ne bloque pas la partie (rien n'est écrasé : un split est détecté à l'envoi).
    logStore.pushLog({ level: "warn", source: "launcher", message: `Cloud : vérification avant de jouer impossible (${error.message})` });
    return { ok: true, conflict: null, offline: true };
  }
});
ipcMain.handle("cloud:fetchLatest", async (_event, key) => {
  const busy = playGameBusy();
  if (busy) return busy;
  try {
    const out = await worldCloud.fetchLatest(String(key || ""));
    sendAll("play:worldsChanged");
    return out;
  } catch (error) {
    return cloudError(error);
  }
});
ipcMain.handle("cloud:waitClosed", (_event, key) => {
  const k = String(key || "");
  return worldCloud.waitClosed(k, (result) => {
    sendAll("cloud:waitDone", { key: k, ...result });
    if (result.fetched) sendAll("play:worldsChanged");
  });
});
ipcMain.handle("cloud:cancelWait", (_event, key) => {
  worldCloud.cancelWait(String(key || ""));
  return { ok: true };
});
ipcMain.handle("cloud:resolveSplit", async (_event, key, versionId) => {
  const busy = playGameBusy();
  if (busy) return busy;
  const out = await worldCloud.resolveSplit(String(key || ""), String(versionId || ""));
  if (out.ok) sendAll("play:worldsChanged");
  return out;
});
ipcMain.handle("cloud:downloadMany", async (_event, ids) => {
  try {
    return await worldCloud.downloadMany(Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : []);
  } catch (error) {
    return cloudError(error);
  }
});
ipcMain.handle("cloud:downloadJob", () => worldCloud.downloadJob());
ipcMain.handle("cloud:download", async (_event, worldId) => {
  if (playRunning) return { ok: false, error: "Quitte le jeu d'abord." };
  const out = await worldCloud.download(String(worldId || ""));
  if (out.ok) for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("play:worldsChanged");
  return out;
});

const playError = (error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) });

ipcMain.handle("play:packs", async (_event, { force = false } = {}) => {
  const data = await fetchPlayPacks({ force });
  return { ok: true, ...data };
});
ipcMain.handle("play:mcVersions", async () => {
  try {
    return { ok: true, versions: await playMode.listMinecraftVersions() };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:listVersions", () => ({ ok: true, versions: playMode.listVersions() }));
ipcMain.handle("play:createVersion", async (_event, { minecraftVersion, packId = null, name = "" } = {}) => {
  try {
    let pack = null;
    if (packId) {
      const data = await fetchPlayPacks();
      const p = (data.packs || []).find((x) => x.id === packId);
      const v = p?.versions?.find((x) => x.minecraftVersion === minecraftVersion);
      if (!p || !v) return { ok: false, error: "Ce pack n'est pas encore prêt pour cette version." };
      pack = flattenPackVersion(p, v);
    }
    return { ok: true, version: await playMode.createVersion({ minecraftVersion, pack, name }) };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:renameVersion", async (_event, id, name) => ({ ok: await playMode.renameVersion(id, name) }));
ipcMain.handle("play:removeVersion", async (_event, id) => {
  if (playRunning?.versionId === id) return { ok: false, error: "Cette version est en train de tourner." };
  return { ok: await playMode.removeVersion(id) };
});
ipcMain.handle("play:listWorlds", async () => {
  try {
    return { ok: true, worlds: await playMode.listWorlds(), running: playRunning ? { versionId: playRunning.versionId } : null };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:setWorldBackup", async (_event, key, on, opts) => {
  try {
    return await playMode.setWorldBackup(key, on, opts);
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:listBackups", async (_event, key) => ({ ok: true, backups: key ? await playMode.listBackups(key) : [], keep: playMode.keepConfig() }));
// Limite des sauvegardes gardées sur ce PC, monde par monde (nombre ou taille). Dans la file des
// sauvegardes : jamais pendant qu'une sauvegarde en jeu écrit la liste du même monde.
ipcMain.handle("play:testOverlay", async (event) => {
  await liveSave.testOverlay(BrowserWindow.fromWebContents(event.sender)?.getBounds() || null);
  return { ok: true };
});
// Réglages des sauvegardes, les mêmes pour tous les mondes (25/10) : `key` n'est plus utilisé.
ipcMain.handle("play:setBackupLimit", async (_event, _key, cfg) => {
  if (!cfg || typeof cfg !== "object") return { ok: false, error: "Réglage invalide." };
  try {
    const out = await liveSave.enqueue(() => playMode.setKeepConfig(cfg));
    // Moins de versions en ligne qu'avant : les plus vieilles sortent du cloud (restent sur le PC).
    worldCloud.limitAllOnline().catch(() => {});
    return out;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});
// Une sauvegarde ou une restauration ne touche jamais un monde pendant que le jeu tourne.
function playGameBusy() {
  return getRunningGame() || gameLaunchInProgress ? { ok: false, code: "gameRunning", error: "Ferme Minecraft d'abord : on ne touche pas à un monde ouvert." } : null;
}
// Sauvegarde en cours, montrée dans la pilule en haut à droite (play.js, retour de Rushi du 25/10).
function sendSaveActivity(activity) {
  for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("play:saveActivity", activity);
}
ipcMain.handle("play:backupNow", async (_event, key, label) => {
  const busy = playGameBusy();
  if (busy) return busy;
  sendSaveActivity({ key, label: label || null, phase: "start" });
  try {
    const result = await playMode.backupWorld(key, { reason: "manual", label, force: true });
    if (result.backup) worldCloud.queueBackup(key, result.backup);
    sendSaveActivity({ key, label: label || null, phase: result.backup ? "done" : "skip" });
    return result;
  } catch (error) {
    sendSaveActivity({ key, label: label || null, phase: "fail" });
    return playError(error);
  }
});
// Supprimer une sauvegarde à la main (confirmée en tapant « supprimer ») : sur ce PC, et aussi dans
// le cloud (versions miroir), sauf la version à continuer, que le site garde.
ipcMain.handle("play:deleteBackup", async (_event, key, backupId) => {
  if (typeof key !== "string" || typeof backupId !== "string") return { ok: false, error: "Sauvegarde introuvable." };
  try {
    const b = await liveSave.enqueue(() => playMode.deleteBackup(key, backupId));
    worldCloud.dropPruned(key, [b], { explicit: true });
    return { ok: true };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:restoreBackup", async (_event, key, backupId) => {
  const busy = playGameBusy();
  if (busy) return busy;
  try {
    return await playMode.restoreBackup(key, backupId);
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:scanImport", async (_event, dir) => {
  try {
    return { ok: true, ...(await playMode.scanImportable(dir || null)) };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:pickImportDir", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: "Dossier de mondes Minecraft (saves)",
    defaultPath: playMode.defaultMinecraftSaves(),
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
  return { ok: true, dir: result.filePaths[0] };
});
ipcMain.handle("play:import", async (_event, dir, folders) => {
  try {
    const imported = await playMode.importWorlds(dir || null, Array.isArray(folders) ? folders : []);
    // Sauvegarde activée par défaut : une première sauvegarde de chaque copie.
    for (const w of imported) {
      playMode
        .backupWorld(w.key, { reason: "import" })
        .then((r) => r.backup && worldCloud.queueBackup(w.key, r.backup))
        .catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Première sauvegarde de « ${w.name} » impossible : ${error.message}` }));
    }
    return { ok: true, imported };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:openWorldFolder", async (_event, key) => {
  const found = key ? await playMode.worldDir(key) : null;
  return shell.openPath(found ? found.dir : playMode.SAVES);
});

// Partie en cours lancée depuis Jouer : version et heure de départ (mondes modifiés ensuite).
let playRunning = null;

ipcMain.handle("play:launch", async (event, { versionId, worldKey = null } = {}) => {
  if (gamesMove.active) return { ok: false, error: GAMES_MOVE_BUSY };
  if (!currentSession) return { ok: false, code: "signin", error: "Connecte-toi avec ton compte Microsoft pour jouer." };
  if (gameLaunchInProgress || getRunningGame()) return { ok: false, code: "gameRunning", error: "Minecraft est déjà lancé." };
  gameLaunchInProgress = true;
  let task = null;
  try {
    let quickPlayWorld = null;
    if (worldKey) {
      // Toujours la version du monde (jamais une autre) : sinon « needVersion » / « chooseVersion »,
      // et le launcher demande au joueur avant de lancer quoi que ce soit.
      const chosen = await playMode.versionForWorld(worldKey, { pick: versionId || null });
      versionId = chosen.versionId;
      quickPlayWorld = chosen.world.folder;
      // Restauration demandée sur le site : faite maintenant, avant d'ouvrir le monde.
      await worldCloud.applyPendingRestore(worldKey).catch((error) =>
        logStore.pushLog({ level: "warn", source: "launcher", message: `Restauration en attente non appliquée : ${error.message}` }),
      );
    }
    const version = playMode.getVersion(versionId);
    if (!version) return { ok: false, error: "Cette version n'existe plus dans Mes versions." };
    const label = version.name || `${version.minecraftVersion}${version.pack ? ` · ${version.pack.name?.fr || version.pack.slug}` : ""}`;
    task = createInstallTask(`play:${versionId}`, label, "launch");
    broadcastTasks();
    const onProgress = (status) => {
      updateTaskFromProgress(task, status);
      broadcastTasks();
      event.sender.send("game:progress", status);
    };
    onProgress({ name: label, modded: !!version.pack });

    // Pack : la liste des mods la plus récente publiée par l'équipe (sinon celle déjà connue).
    if (version.pack) {
      const data = await fetchPlayPacks();
      const p = (data.packs || []).find((x) => x.id === version.pack.packId);
      const v = p?.versions?.find((x) => x.id === version.pack.versionId || x.minecraftVersion === version.minecraftVersion);
      if (p && v) await playMode.refreshPackFiles(versionId, flattenPackVersion(p, v));
    }

    // Version d'un monde téléchargé encore en cours d'installation : on attend qu'elle finisse.
    if (versionInstalls.has(versionId)) {
      onProgress({ text: "Installation de la version du monde…" });
      await versionInstalls.get(versionId).catch(() => {});
    }
    const settings = settingsStore.loadSettings();
    const prepared = await playMode.prepareVersion(versionId, {
      deps: { ensureVanillaVersion, ensureJavaForMajor: javaManager.ensureJavaForMajor, installLoader, prepareLaunchVersion, installFiles },
      onProgress,
      signal: task.controller.signal,
      waitIfPaused: taskWaitIfPaused(task),
      javaPreferred: settings.javaPath || undefined,
    });
    task.status = "complete";
    task.step = "start";
    task.bytes = task.totalBytes || task.bytes;
    broadcastTasks();
    event.sender.send("game:progress", { step: "start" });

    const startedAt = Date.now();
    await launchMinecraft({
      onGameState: (running, exitCode) => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send("game:state", running, exitCode ?? null);
        }
        if (running) {
          playRunning = { versionId, startedAt };
          worldCloud.setGameRunning(true);
          if (features.visible("liveSave")) liveSave.start({ startedAt, pid: getRunningGame()?.pid, worldKey });
          return;
        }
        // Avant de réafficher les fenêtres : ferme le petit menu en jeu et libère F6.
        const liveDone = liveSave.stop();
        discordPresence.setBrowsingActivity();
        if (settingsStore.shouldRestoreAfterPlaying()) {
          for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed()) continue;
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
          }
        }
        // Jeu fermé : plus rien n'écrit dans les mondes, on peut les sauvegarder.
        const ended = playRunning;
        playRunning = null;
        liveDone
          .then(() => liveSave.enqueue(() => playMode.afterGame(ended?.versionId || versionId, ended?.startedAt || startedAt)))
          .then((created) => {
            for (const c of created) {
              if (c.backup) worldCloud.queueBackup(c.key, c.backup);
              else if (c.error) logStore.pushLog({ level: "warn", source: "launcher", message: `Sauvegarde du monde impossible : ${c.error}` });
            }
            for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("play:worldsChanged");
          })
          .catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Sauvegarde après la partie impossible : ${error.message}` }))
          .finally(() => worldCloud.setGameRunning(false));
      },
      authorization: currentSession.authorization,
      version: prepared.minecraftVersion,
      serverIp: null,
      serverName: null,
      autoConnect: false,
      addToServerList: false,
      onProgress,
      memory: { min: `${settings.memoryMinGB}G`, max: `${settings.memoryMaxGB}G` },
      javaPath: prepared.javaPath || settings.javaPath || undefined,
      gameDirectory: prepared.gameDirectory,
      customVersion: prepared.customVersion,
      customJvmArgs: prepared.jvmArgs,
      slug: `play:${versionId}`,
      onGameLine: (text) => liveSave.line(text),
      quickPlayWorld: quickPlayWorld && supportsQuickPlay(prepared.minecraftVersion) ? quickPlayWorld : null,
    });
    await playMode.touchVersion(versionId);
    discordPresence.setPlayingActivity(`Minecraft ${prepared.minecraftVersion}`, version.pack?.name?.fr || null, { isPrivate: true });
    return { ok: true, versionId };
  } catch (error) {
    const cancelled = error?.name === "AbortError";
    // Lancement raté : le verrou « monde ouvert » pris avant (plusieurs PC) est rendu.
    worldCloud.releaseLocks().catch(() => {});
    if (task && (task.status === "active" || task.status === "paused")) {
      task.status = cancelled ? "cancelled" : "error";
      task.error = cancelled ? null : error instanceof Error ? error.message : "Erreur inconnue";
      broadcastTasks();
    }
    if (cancelled) return { ok: false, cancelled: true };
    if (error?.code === "needVersion" || error?.code === "chooseVersion") {
      logStore.pushLog({ level: "warn", source: "launcher", message: `Jouer : ${error.message} Rien n'a été lancé.` });
      return { ok: false, code: error.code, error: error.message, minecraftVersion: error.minecraftVersion || null, worldName: error.worldName || null };
    }
    logStore.pushLog({ level: "error", source: "launcher", message: `Échec du lancement (Jouer) : ${error instanceof Error ? error.message : error}` });
    return playError(error);
  } finally {
    gameLaunchInProgress = false;
  }
});

// "Tester pour publication" (Mes instances) : auto-test que le PROPRIETAIRE lance lui-meme
// avant de pouvoir publier son serveur (voir le nouveau flux cote site, selfTestPassedAt).
// Reutilise les memes briques que game:launch (ping, installModpack, launchMinecraft) —
// jamais dupliquees, seulement orchestrees differemment ici pour produire 3 resultats
// distincts plutot qu'un simple ok/erreur. Un seul test (ou lancement normal) a la fois,
// meme verrou que game:launch (gameLaunchInProgress) puisque les deux lancent reellement
// Minecraft.
// 2026-10-11 : le 4e controle ("Connexion au serveur", un re-ping pendant que le jeu reste
// ouvert) est retire — intestable de maniere fiable pour le moment (demande de laisser le jeu
// ouvert le temps du re-ping, pas de manière simple de le valider en conditions reelles). Les
// 3 controles restants (joignabilite, fichiers installes, demarrage du jeu) suffisent a
// debloquer la publication pour l'instant.
let selfTestInProgress = false;

// Annulation ("Annuler le test") : un simple drapeau vérifié entre chaque étape. Pas besoin
// d'identifiant de requête : un seul test à la fois (selfTestInProgress), donc un seul
// drapeau global, réinitialisé au début de chaque appel.
let selfTestAbortRequested = false;
// Reference vers la tache du panneau de telechargements (voir installTasks) creee par le
// test en cours (2026-10-11 : le telechargement du check #2 restait invisible du panneau,
// signale par le proprietaire). "Annuler le test" abat aussi cette tache, pour reellement
// interrompre un telechargement en cours plutot que d'attendre qu'il finisse tout seul.
let selfTestTask = null;

ipcMain.handle("selftest:abort", async () => {
  if (!selfTestInProgress) return { ok: false, code: "not_running" };
  selfTestAbortRequested = true;
  selfTestTask?.controller.abort();
  // Aide guidee ouverte pendant le test (lot 5) : l'annulation la referme comme « Plus tard ».
  if (selfTestManualAnswer) {
    const answer = selfTestManualAnswer;
    selfTestManualAnswer = null;
    answer("close");
  }
  return { ok: true };
});

// Lot 5 (audit 17/10, choix de Rushi le 18/10 : « aide puis lancement ») : quand seuls des mods
// bloques manquent, le test ouvre l'aide guidee pour le proprietaire. S'il ajoute les mods, le
// test continue et lance le jeu ; sinon « Jeu démarré » reste « non testé » et la publication
// reste possible avec l'avertissement. false = pas d'aide ni de lancement pendant le test.
const SELFTEST_GUIDE_THEN_LAUNCH = true;
let selfTestManualAnswer = null;
ipcMain.handle("selftest:manualModsAnswer", (_event, answer) => {
  const resolve = selfTestManualAnswer;
  selfTestManualAnswer = null;
  resolve?.(answer === "retry" ? "retry" : "close");
  return { ok: true };
});
function askOwnerForManualMods(sender, fields) {
  return new Promise((resolve) => {
    // Filet : fenetre rechargee ou fermee sans reponse -> on continue comme « Plus tard ».
    const timer = setTimeout(() => {
      if (selfTestManualAnswer) {
        selfTestManualAnswer = null;
        resolve("close");
      }
    }, 20 * 60 * 1000);
    selfTestManualAnswer = (answer) => {
      clearTimeout(timer);
      resolve(answer);
    };
    if (sender.isDestroyed()) return selfTestManualAnswer("close");
    sender.send("selftest:manualMods", fields);
  });
}

ipcMain.handle("selftest:run", async (event, slug) => {
  if (!isValidInstanceSlug(slug)) return { ok: false, error: "Serveur invalide." };
  if (!currentSession) {
    return { ok: false, error: "Connecte-toi avec ton compte Microsoft avant de lancer le test.", code: "not_signed_in" };
  }
  if (gameLaunchInProgress || selfTestInProgress) {
    return { ok: false, error: "Un lancement ou un test est déjà en cours.", code: "busy" };
  }
  gameLaunchInProgress = true;
  selfTestInProgress = true;
  selfTestAbortRequested = false;

  // Meme registre de taches que "Installer"/"Rejoindre" (2026-10-11) : le telechargement du
  // check #2 doit apparaitre dans le meme panneau, pas rester invisible pendant qu'il tourne.
  const task = createInstallTask(slug, null, "selftest");
  selfTestTask = task;
  broadcastTasks();
  const onProgress = (status) => {
    updateTaskFromProgress(task, status);
    broadcastTasks();
    event.sender.send("game:progress", status);
  };

  const report = (step, status, detail) => event.sender.send("selftest:progress", { step, status, detail });
  const checks = { reachable: false, modpackInstalled: false, gameStarted: false };
  let detectedVersion = null;
  // Lot 5 : mods a ajouter a la main (tous « bloques ») — le test passe avec un avertissement.
  let manualModsReport = null;
  let fromModrinthMods = [];

  // Si le test a été annulé, marque le check en cours comme échoué/annulé et conclut
  // immédiatement — les checks suivants, jamais atteints, restent "pending" côté UI et
  // sont automatiquement forcés à "échoué" par le même mécanisme que le bug du timeout
  // (voir renderer.js/finalizeSelfTestStatuses), donc rien d'autre à faire ici.
  const bailIfAborted = (step) => {
    if (!selfTestAbortRequested) return false;
    report(step, "fail", { aborted: true });
    if (task.status === "active" || task.status === "paused") {
      task.status = "cancelled";
      broadcastTasks();
    }
    logStore.pushLog({ source: "launcher", message: `Auto-test de publication annulé pour "${slug}"` });
    return true;
  };

  logStore.pushLog({ source: "launcher", message: `Auto-test de publication lancé pour "${slug}"` });

  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}`, {
      headers: launcherAuthHeaders(),
    });
    const server = data.server;
    const settings = settingsStore.loadSettings();

    // Les 3 controles s'enchainent TOUJOURS, meme si l'un d'eux echoue — seule une annulation
    // explicite ("Annuler le test") interrompt la suite. Un controle rate n'empeche pas les
    // suivants de tourner : le proprietaire doit voir le diagnostic complet (quels controles
    // passent, lesquels non) plutot qu'un test qui s'arrete au premier probleme rencontre —
    // decision du 2026-10-10, suite a un retour explicite ("le joueur doit savoir ce qui ne va
    // pas, meme si une section a echoue il faut faire le test suivant").

    // 1. Serveur joignable — ping direct (TCP + Server List Ping), independant de Minecraft
    // lui-meme (voir mcPing.js, le meme protocole que site/src/lib/mc-ping.ts).
    report("reachable", "running");
    const before = await pingMinecraftServer(server.ip);
    if (bailIfAborted("reachable")) return { ok: true, checks, detectedVersion, allPassed: false, aborted: true };
    if (before) {
      checks.reachable = true;
      detectedVersion = before.versionName;
      report("reachable", "pass", { detectedVersion, onlineBefore: before.online, pingMs: before.pingMs });
    } else {
      report("reachable", "fail");
    }

    // 2. Fichiers du jeu installés — reutilise exactement le meme flux que game:launch. Pour un
    // serveur vanilla, ensureVanillaVersion ne garantit que le JSON et le jar : bibliotheques et
    // assets (le gros du volume) ne sont reellement telecharges que par minecraft-launcher-core
    // lui-meme, au moment du lancement (etape 3 ci-dessous, via launchMinecraft) — impossible de
    // les telecharger separement sans dupliquer sa logique interne. Donc ce check reste "en
    // cours" pendant que l'etape 3 s'execute, et n'est confirme "reussi" qu'au moment ou ce
    // lancement a reellement reussi (preuve que les fichiers sont bien la) — jamais devine a
    // l'avance a partir d'un simple JSON+jar (constate le 2026-10-10 : "reussi" s'affichait a
    // tort juste apres suppression manuelle des fichiers pour tester).
    if (bailIfAborted("modpack")) return { ok: true, checks, detectedVersion, allPassed: false, aborted: true };
    report("modpack", "running");
    let modded = null;
    let vanilla = null;
    const runModpackInstall = () =>
      installModpack({
        config: { siteUrl: SITE_URL, apiKey: LAUNCHER_API_KEY, headers: launcherAuthHeaders() },
        slug,
        gameRoot: GAME_ROOT,
        javaPath: settings.javaPath || undefined,
        resolveJava: (major, onJavaProgress) =>
          javaManager.ensureJavaForMajor(major, { preferredPath: settings.javaPath || undefined, onProgress: onJavaProgress }),
        onProgress,
        signal: task.controller.signal,
        waitIfPaused: taskWaitIfPaused(task),
        manualSearchDirs: manualModsSearchDirs(),
        onWarning: (message) => logStore.pushLog({ level: "warn", source: "launcher", message }),
      });
    try {
      if (server.type === "modded" && server.curseforgeModpackId) {
        modded = await runModpackInstall();
        fromModrinthMods = modded?.fromModrinthMods || [];
      } else {
        vanilla = await ensureVanillaVersion(path.join(GAME_ROOT, "versions"), server.minecraftVersion);
      }
    } catch (error) {
      const fields = modpackErrorFields(error);
      const onlyBlocked = fields.code === "manual_mods" && fields.manualMods.length > 0 && fields.manualMods.every((mod) => mod.reason === "blocked");
      if (onlyBlocked) {
        // Lot 5 : ce n'est plus un echec. Les joueurs seront guides pas a pas pour ces mods.
        manualModsReport = fields.manualMods;
        fromModrinthMods = fields.fromModrinthMods || [];
        checks.modpackInstalled = true;
        report("modpack", "warn", fields);
        if (SELFTEST_GUIDE_THEN_LAUNCH && !selfTestAbortRequested) {
          const answer = await askOwnerForManualMods(event.sender, fields);
          if (answer === "retry") {
            try {
              modded = await runModpackInstall();
            } catch (retryError) {
              logStore.pushLog({ source: "launcher", message: `Auto-test : mods encore manquants apres l'aide (${retryError instanceof Error ? retryError.message : retryError})` });
            }
          }
        }
      } else {
        // Fichier retire de CurseForge ou autre erreur : vrai echec (liste montree sous le controle).
        report("modpack", "fail", { error: error instanceof Error ? error.message : String(error), ...fields });
      }
    }
    // Moddé : le téléchargement du modpack (mods inclus) est entièrement fini à cet instant — on
    // peut juger ce check tout de suite, sans attendre le lancement. Bug trouvé le 2026-10-13 (test
    // réel du propriétaire, 5 mods bloqués par CurseForge) : si installModpack échouait, "modded"
    // restait vide, launchMinecraft() se rabattait alors silencieusement sur du Minecraft vanilla
    // (aucun rapport avec le modpack testé), et le succès de CE lancement de secours écrasait
    // l'échec pourtant réel du check modpack plus bas. Le vanilla, lui, reste décidé par le
    // lancement (ensureVanillaVersion ne télécharge que JSON+jar, pas bibliothèques/assets).
    if (server.type === "modded" && server.curseforgeModpackId && modded && !manualModsReport) {
      checks.modpackInstalled = true;
      report("modpack", "pass", { fromModrinthMods });
    }
    if (bailIfAborted("gameStarted")) return { ok: true, checks, detectedVersion, allPassed: false, aborted: true };

    // 3. Jeu démarré (RAM correcte) — launchMinecraft() ne résout qu'une fois Minecraft
    // réellement démarré (started = true / onGameState(true)), avec la RAM des réglages
    // actuels du joueur (c'est bien SA configuration qui doit être testée, pas une valeur
    // arbitraire). Tente de lancer meme si le check #2 a echoue (fichiers manquants, etc.) :
    // l'erreur rencontree ici est elle-meme une information utile pour le proprietaire. Pour un
    // serveur moddé le check #2 est déjà tranché (voir plus haut) et n'est plus réévalué ici —
    // seul le vanilla décide encore son check #2 à ce stade (voir plus bas).
    // Serveur moddé dont le pack n'a pas pu s'installer (14/10) : ne plus lancer Minecraft
    // vanilla à la place, ce lancement ne prouverait rien sur le pack testé.
    if (server.type === "modded" && server.curseforgeModpackId && !modded) {
      if (task.status === "active" || task.status === "paused") {
        task.status = "error";
        task.error = "Modpack incomplet";
        broadcastTasks();
      }
      report("gameStarted", "skipped", { incompletePack: !manualModsReport, manualModsSkipped: !!manualModsReport });
      // Seuls des mods a ajouter a la main manquent : publication possible avec l'avertissement.
      const canPublish = !!manualModsReport && checks.reachable;
      logStore.pushLog({ source: "launcher", message: `Auto-test de publication terminé pour "${slug}" : ${canPublish ? "publiable avec avertissement (mods à ajouter à la main)" : "échoué (modpack incomplet)"}` });
      return { ok: true, checks, detectedVersion, allPassed: false, canPublish, manualMods: manualModsReport, fromModrinthMods };
    }
    report("gameStarted", "running");
    let gameJava = modded?.javaPath;
    if (!gameJava) {
      try {
        gameJava = await javaManager.ensureJavaForMajor(vanilla?.javaVersion?.majorVersion ?? 8, {
          preferredPath: settings.javaPath || undefined,
          onProgress: (text) => onProgress({ text }),
        });
      } catch (error) {
        logStore.pushLog({ level: "warn", source: "launcher", message: `Auto-test : Java par défaut (${error instanceof Error ? error.message : error})` });
      }
    }

    // Meme convention que game:launch : la tache de telechargement se termine ici (fichiers
    // du modpack/vanilla prets), avant launchMinecraft() qui telecharge encore bibliotheques/
    // assets en interne mais reste suivi par la barre de progression du test, pas une
    // deuxieme tache.
    task.status = "complete";
    task.bytes = task.totalBytes || task.bytes;
    broadcastTasks();

    try {
      await launchMinecraft({
        onGameState: (running) => {
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) win.webContents.send("game:state", running);
          }
          if (!running) discordPresence.setBrowsingActivity();
        },
        authorization: currentSession.authorization,
        version: modded?.minecraftVersion ?? server.minecraftVersion,
        serverIp: server.ip,
        serverName: server.name,
        autoConnect: server.autoConnect,
        addToServerList: server.addToServerList !== false,
        onProgress,
        memory: { min: `${settings.memoryMinGB}G`, max: `${settings.memoryMaxGB}G` },
        javaPath: gameJava || settings.javaPath || undefined,
        gameDirectory: modded?.instanceDir,
        customVersion: modded?.customVersion,
        customJvmArgs: modded?.jvmArgs,
      });
      // Vanilla seulement : la preuve que bibliothèques/assets sont bien là ne vient que d'ici
      // (voir le commentaire du check #2 plus haut). Pour un serveur moddé, ce check a déjà été
      // tranché juste après installModpack() — ne plus l'écraser ici avec un lancement de
      // secours qui n'a jamais rapport au modpack réellement testé.
      if (!(server.type === "modded" && server.curseforgeModpackId)) {
        checks.modpackInstalled = true;
        report("modpack", "pass");
      }
      checks.gameStarted = true;
      report("gameStarted", "pass");
      discordPresence.setPlayingActivity(server.name, modded?.modpackName, { isPrivate: isPrivateServer(server, slug) });
    } catch (error) {
      report("gameStarted", "fail", { error: error instanceof Error ? error.message : String(error) });
    }

    const allPassed = checks.reachable && checks.modpackInstalled && checks.gameStarted;
    logStore.pushLog({ source: "launcher", message: `Auto-test de publication terminé pour "${slug}" : ${allPassed ? "réussi" : "échoué"}` });
    return { ok: true, checks, detectedVersion, allPassed, canPublish: allPassed, manualMods: manualModsReport, fromModrinthMods };
  } catch (error) {
    // Echec avant que l'etape 2 n'ait eu l'occasion de marquer la tache "complete"
    // (ex. fetchJson initial echoue) : evite de la laisser "active" pour toujours.
    if (task.status === "active" || task.status === "paused") {
      task.status = error?.name === "AbortError" ? "cancelled" : "error";
      task.error = error?.name === "AbortError" ? null : error instanceof Error ? error.message : "Erreur inconnue";
      broadcastTasks();
    }
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    logStore.pushLog({ level: "error", source: "launcher", message: `Auto-test de publication : échec pour "${slug}" (${message})` });
    return { ok: false, error: message };
  } finally {
    gameLaunchInProgress = false;
    selfTestInProgress = false;
    selfTestAbortRequested = false;
    selfTestTask = null;
  }
});

// Rapporte un test 100% réussi au site (voir /api/launcher/servers/[slug]/self-test) — seule la
// fiche le stocke (selfTestPassedAt) et seulement si les 3 contrôles sont vrais ; le site
// re-vérifie aussi côté serveur (jamais confiance au client seul pour débloquer la publication).
ipcMain.handle("selftest:report", async (_event, { slug, checks, detectedVersion, manualMods }) => {
  try {
    // Lot 5 : mods a ajouter a la main, pour le badge « X mods à ajouter » de la fiche.
    const list = Array.isArray(manualMods)
      ? manualMods.slice(0, 200).map((mod) => ({
          modName: mod?.modName ? String(mod.modName).slice(0, 120) : null,
          fileName: mod?.fileName ? String(mod.fileName).slice(0, 200) : null,
          pageUrl: safeModPageUrl(mod?.pageUrl),
        }))
      : [];
    const data = await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/self-test`, {
      method: "POST",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ checks, detectedVersion, manualMods: list }),
    });
    // 2026-10-11 : un test reussi envoie maintenant directement la fiche en file d'attente
    // (isPrivate passe a false cote site, voir self-test/route.ts) — sans vider le cache,
    // "Mes instances" pouvait reafficher "Tester pour publication" jusqu'a 60s (SERVER_CACHE_MS)
    // apres une demande reussie, le temps que le cache expire tout seul.
    if (data.passed) clearServerCaches();
    return { ok: true, passed: !!data.passed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

app.whenReady().then(async () => {
  setContentSecurityPolicy();
  if (!LAUNCHER_API_KEY) {
    // Erreur visible (dialog) plutôt qu'un throw silencieux avant toute
    // fenêtre : sinon l'app quitte sans qu'on sache pourquoi.
    dialog.showErrorBox(
      "Configuration manquante",
      "LAUNCHER_API_KEY est introuvable — vérifie le fichier .env du launcher.",
    );
    app.exit(1);
    return;
  }
  logStore.setMinFileLevel(settingsStore.loadSettings().logLevel);
  logStore.pruneOldLogs();
  logStore.pushLog({ source: "launcher", message: `Démarrage d'Omniscient Launcher ${app.getVersion()}` });
  ensureDevStartMenuShortcut();
  createWindow();
  const startupSettings = settingsStore.loadSettings();
  discordPresence.init(DISCORD_CLIENT_ID, {
    enabled: startupSettings.discordPresence !== false,
    locale: startupSettings.locale,
    log: (level, message) => logStore.pushLog({ level, source: "launcher", message }),
  });
  discordPresence.setBrowsingActivity();
}).catch((error) => {
  // Exception inattendue pendant le demarrage (createWindow/setContentSecurityPolicy/
  // discordPresence.init...) : sans ce .catch(), le launcher restait figue/invisible sans
  // aucune trace exploitable (voir audit 2026-10-10, §3.5). Meme modele que le cas
  // "LAUNCHER_API_KEY manquante" juste au-dessus : log + dialogue explicite pour l'utilisateur.
  logStore.pushLog({ level: "error", source: "launcher", message: `Démarrage échoué : ${error instanceof Error ? error.message : error}` });
  dialog.showErrorBox(
    "Erreur de démarrage",
    `Omniscient Launcher n'a pas pu démarrer correctement :\n${error instanceof Error ? error.message : String(error)}`,
  );
  app.exit(1);
});

app.on("will-quit", () => {
  discordPresence.shutdown();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- Dossier des jeux sur un autre disque (serie 2, idee 9, version validee) --------------------
// Tout le dossier des jeux (instances, mondes, mods, Java, cache) part en entier : copier, verifier,
// basculer (pointeur dans userData + redemarrage du launcher), puis effacer l'ancien au demarrage
// suivant. Voir gamesLocation.js. Pendant le deplacement, rien ne peut s'installer ni se lancer.
const GAMES_MOVE_BUSY = "Déplacement de tes jeux en cours : attends la fin pour jouer ou installer.";
const gamesMove = { active: false, cancel: false, progress: null };
let gamesJustMoved = null;
let gamesSizeCache = null;

function formatGB(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} Go`;
}

async function gamesFolderInfo() {
  const free = await gamesLocation.freeBytesOf(gamesLocation.GAMES_BASE).catch(() => null);
  return { gamesFolder: gamesLocation.GAMES_BASE, gamesFree: free ? formatGB(free.free) : "" };
}

function broadcastGamesMove(payload) {
  gamesMove.progress = payload;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("games:moveProgress", payload);
  }
}

function gamesBusyReason() {
  if (getRunningGame() || gameLaunchInProgress) return "gameRunning";
  if ([...installTasks.values()].some((t) => t.status === "active" || t.status === "paused" || t.status === "queued")) return "installing";
  return null;
}

ipcMain.handle("games:info", async () => {
  const journal = gamesLocation.readJournal();
  const interrupted = journal && journal.stage !== "switched" && !gamesMove.active ? journal : null;
  return {
    base: gamesLocation.GAMES_BASE,
    drive: gamesLocation.driveOf(gamesLocation.GAMES_BASE),
    isDefault: gamesLocation.samePath(gamesLocation.GAMES_BASE, gamesLocation.USER_DATA),
    missingRoot: gamesLocation.MISSING_ROOT,
    interrupted: interrupted ? { to: interrupted.to, toDrive: gamesLocation.driveOf(interrupted.to), copiedBytes: interrupted.copiedBytes || 0, totalBytes: interrupted.totalBytes || 0 } : null,
    justMoved: gamesJustMoved,
    moving: gamesMove.active ? gamesMove.progress : null,
  };
});

ipcMain.handle("games:size", async (_event, { refresh = false } = {}) => {
  if (!gamesSizeCache || refresh) {
    const { files, bytes } = await gamesLocation.listFiles(gamesLocation.GAMES_BASE);
    gamesSizeCache = { bytes, files: files.length };
  }
  return gamesSizeCache;
});

ipcMain.handle("games:drives", async () => {
  const drives = await gamesLocation.listDrives();
  const current = gamesLocation.driveOf(gamesLocation.GAMES_BASE);
  return drives.map((drive) => ({ ...drive, current: drive.drive === current, target: gamesLocation.targetForDrive(drive.drive) }));
});

ipcMain.handle("games:openFolder", () => shell.openPath(gamesLocation.GAMES_BASE));

ipcMain.handle("games:move", async (_event, { drive, deleteOld = true, resume = false } = {}) => {
  if (gamesMove.active) return { ok: false, code: "moving" };
  const from = gamesLocation.GAMES_BASE;
  const journal = gamesLocation.readJournal();
  const to = resume && journal ? journal.to : gamesLocation.targetForDrive(drive);
  if (!to) return { ok: false, code: "badDrive" };
  if (gamesLocation.samePath(to, from)) return { ok: false, code: "sameDrive" };
  if (gamesLocation.isInside(to, from) || gamesLocation.isInside(from, to)) return { ok: false, code: "nested" };
  const busy = gamesBusyReason();
  if (busy) return { ok: false, code: busy };

  const toIsHome = gamesLocation.samePath(to, gamesLocation.USER_DATA);
  const ours = toIsHome || fs.existsSync(path.join(to, gamesLocation.MARKER));
  if (!ours && fs.existsSync(to) && (await fsp.readdir(to).catch(() => [])).length) return { ok: false, code: "targetNotEmpty", target: to };

  gamesMove.active = true;
  gamesMove.cancel = false;
  const keepDelete = resume && journal ? journal.deleteOld !== false : deleteOld !== false;
  try {
    broadcastGamesMove({ stage: "scan", doneBytes: 0, totalBytes: 0, to, drive: gamesLocation.driveOf(to) });
    const { files, bytes } = await gamesLocation.listFiles(from);
    // Place necessaire : ce qui n'est pas deja copie (reprise) + 300 Mo de marge.
    let already = 0;
    if (ours) {
      for (const file of files) {
        const stat = await fsp.stat(path.join(to, file.rel)).catch(() => null);
        if (stat && stat.size === file.size) already += file.size;
      }
    }
    const space = await gamesLocation.freeBytesOf(to);
    const need = bytes - already + 300 * 1024 ** 2;
    if (space.free < need) return { ok: false, code: "noSpace", needBytes: need, freeBytes: space.free };

    await fsp.mkdir(to, { recursive: true });
    if (!toIsHome) await fsp.writeFile(path.join(to, gamesLocation.MARKER), "Dossier des jeux d'Omniscient Launcher. Ne pas supprimer ce fichier.\n");
    gamesLocation.writeJournal({ from, to, deleteOld: keepDelete, stage: "copy", totalBytes: bytes, startedAt: new Date().toISOString() });
    logStore.pushLog({ source: "launcher", message: `Déplacement des jeux : ${from} -> ${to} (${formatGB(bytes)})` });

    let lastJournal = 0;
    await gamesLocation.copyAndVerify({
      from,
      to,
      files,
      totalBytes: bytes,
      isCancelled: () => gamesMove.cancel,
      onProgress: (progress) => {
        broadcastGamesMove({ ...progress, to, drive: gamesLocation.driveOf(to) });
        if (Date.now() - lastJournal > 3000) {
          lastJournal = Date.now();
          gamesLocation.writeJournal({ from, to, deleteOld: keepDelete, stage: progress.stage, totalBytes: bytes, copiedBytes: progress.doneBytes });
        }
      },
    });
    // Bascule : le pointeur designe le nouveau dossier ; l'ancien sera efface au redemarrage.
    gamesLocation.writeJournal({ from, to, deleteOld: keepDelete, stage: "switched", totalBytes: bytes, copiedBytes: bytes });
    gamesLocation.setPointer(to);
    logStore.pushLog({ source: "launcher", message: `Déplacement des jeux vérifié, bascule vers ${to}` });
    broadcastGamesMove({ stage: "switched", doneBytes: bytes, totalBytes: bytes, to, drive: gamesLocation.driveOf(to) });
    return { ok: true, to, drive: gamesLocation.driveOf(to) };
  } catch (error) {
    if (error?.code === "cancelled") {
      // Annuler est sans risque : on n'a jamais touche a l'ancien dossier ; la copie a moitie
      // faite est effacee (sauf vers userData, ou elle peut se meler a d'anciens fichiers).
      if (!toIsHome) await gamesLocation.removeGamesFrom(to).catch(() => {});
      gamesLocation.clearJournal();
      logStore.pushLog({ source: "launcher", message: "Déplacement des jeux annulé" });
      return { ok: false, code: "cancelled" };
    }
    const code = error?.code === "ENOSPC" ? "noSpace" : ["ENOENT", "EIO", "ENODEV", "EBUSY", "EPERM", "EACCES", "UNKNOWN"].includes(error?.code) && !fs.existsSync(to) ? "targetLost" : "failed";
    logStore.pushLog({ level: "error", source: "launcher", message: `Échec du déplacement des jeux : ${error instanceof Error ? error.message : String(error)}` });
    return { ok: false, code, error: error instanceof Error ? error.message : String(error) };
  } finally {
    gamesMove.active = false;
    gamesSizeCache = null;
  }
});

ipcMain.handle("games:cancelMove", () => {
  if (gamesMove.active) gamesMove.cancel = true;
  return { ok: true };
});

// Deplacement interrompu (launcher ferme, coupure) : « Annuler et rester ici » efface la copie a
// moitie faite. « Reprendre » repasse par games:move avec resume.
ipcMain.handle("games:abandonInterrupted", async () => {
  const journal = gamesLocation.readJournal();
  if (!journal || journal.stage === "switched" || gamesMove.active) return { ok: false };
  if (!gamesLocation.samePath(journal.to, gamesLocation.USER_DATA) && !gamesLocation.samePath(journal.to, gamesLocation.GAMES_BASE)) {
    await gamesLocation.removeGamesFrom(journal.to).catch(() => {});
  }
  gamesLocation.clearJournal();
  return { ok: true };
});

ipcMain.handle("games:ackMoved", () => {
  gamesJustMoved = null;
});

ipcMain.handle("games:restart", () => {
  app.relaunch();
  app.exit(0);
});

// Au demarrage : fin d'un deplacement bascule (effacer l'ancien dossier si demande).
app.whenReady().then(async () => {
  const journal = gamesLocation.readJournal();
  if (!journal || journal.stage !== "switched") return;
  if (!gamesLocation.samePath(gamesLocation.GAMES_BASE, journal.to)) return; // nouveau dossier introuvable : on garde tout
  let deleted = false;
  if (journal.deleteOld !== false && !gamesLocation.samePath(journal.from, journal.to)) {
    try {
      deleted = await gamesLocation.removeGamesFrom(journal.from);
    } catch (error) {
      logStore.pushLog({ level: "warn", source: "launcher", message: `Ancien dossier des jeux pas entièrement effacé : ${error instanceof Error ? error.message : String(error)}` });
    }
  }
  gamesLocation.clearJournal();
  gamesJustMoved = { to: journal.to, drive: gamesLocation.driveOf(journal.to), fromDrive: gamesLocation.driveOf(journal.from), freedBytes: deleted ? journal.totalBytes || 0 : 0 };
  logStore.pushLog({ source: "launcher", message: `Jeux maintenant dans ${journal.to}${deleted ? ", ancien dossier effacé" : ""}` });
});
