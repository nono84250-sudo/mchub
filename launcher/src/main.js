require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut, session, screen, nativeImage } = require("electron");

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
// rien lancer (cloud:* = mondes en ligne, play:* = mode Jouer, friends:* = amis). Voir features.js.
const FEATURE_IPC = [
  ["cloud:", "worlds"],
  ["play:", "play"],
  ["friends:", "friends"],
  // Page d'une version (27/10) : Mon pack, version vanilla (« vanillaPage ») ou Pack Omniscient.
  ["myPack:", ["myPack", "vanillaPage", "omniPack"]],
  // 03/11 (Rushi) : l'export « Pour un ami » suit l'interrupteur « packExport » (bêta publique), pas
  // « omniPack » (bêta fermée). Avant, il ne marchait que pour les bêta testeurs. Ces trois lignes
  // passent avant « omniPack: » (la première qui correspond compte).
  ["omniPack:exportFriend", ["packExport", "omniPack"]],
  ["omniPack:friendPlan", ["packExport", "omniPack"]],
  ["omniPack:exportPreview", ["packExport", "omniPack"]],
  ["omniPack:", "omniPack"],
  // « Importer un pack » (27/10) : export CurseForge ou pack Modrinth, l'un des deux suffit.
  ["cfPack:", ["cfImport", "mrImport"]],
  // Aide Discord dans les bugs (02/11) : copier tout, zip, lien du Discord.
  ["bugHelp:", "bugDiscord"],
];
const registerIpcHandler = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) =>
  registerIpcHandler(channel, (event, ...args) => {
    if (!isLocalSender(event)) throw new Error("Appel refusé : origine non autorisée");
    const gate = FEATURE_IPC.find(([prefix]) => channel.startsWith(prefix));
    if (gate && ![].concat(gate[1]).some((id) => features.visible(id))) return { ok: false, code: "feature_off" };
    // Dossier d'une version vanilla : le sien avec la séparation stricte, sinon le dossier commun.
    if (/^(play|myPack|omniPack|cfPack):/.test(channel)) {
      playMode.setStrict(features.visible("strictDirs"));
      playMode.setKeysSync(features.visible("keysSync"));
    }
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
  deliverPackFile(packFileIn(argv));
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
  // omniscient://test-pack/<jeton> (31/10) : « Tester dans le launcher » de l'admin du site. Le jeton
  // est signé par le site (10 min, pour UN pack proposé) ; le lien n'installe qu'une copie privée.
  if (url.hostname === "test-pack" && /^[\w-]{8,64}\.\d{9,11}\.[\w-]{32}$/.test(value)) return { kind: "test-pack", value };
  // omniscient://test-bug/<slug> (31/10) : « Essayer dans le launcher » de l'admin. Montre la fenêtre d'une
  // fiche déjà reçue, sans jamais réparer ni compter : rien à protéger par un jeton.
  if (url.hostname === "test-bug" && /^[a-z0-9-]{1,80}$/.test(value)) return { kind: "test-bug", value };
  return null;
}

// Double-clic sur un .omnipack (audit du 01/11) : le fichier arrive dans la ligne de commande, et la
// fenêtre habituelle d'import s'ouvre. Elle montre le pack et attend une confirmation : rien ne
// s'installe tout seul, et l'import ne garde que les fichiers permis (voir omniPack.js).
let pendingPackFile = null;
function packFileIn(argv) {
  return (Array.isArray(argv) ? argv : []).find((arg) => typeof arg === "string" && /\.omnipack$/i.test(arg) && fs.existsSync(arg)) || null;
}
function deliverPackFile(file) {
  if (!file) return;
  const win = BrowserWindow.getAllWindows()[0];
  if (packFileRendererReady && win && !win.isDestroyed()) win.webContents.send("app:packFile", file);
  else pendingPackFile = file;
}
let packFileRendererReady = false;

function deliverServerLink(raw) {
  const link = parseServerLink(raw);
  if (!link) return;
  if (link.kind === "test-bug") {
    showBugTest(link.value).catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Essai de fiche : ${error.message}` }));
    return;
  }
  if (link.kind === "test-pack") {
    installTestPack(link.value).catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Test de pack : ${error.message}` }));
    return;
  }
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
// Fichiers .omnipack avec le logo Omniscient (28/10, Rushi). Version installée : l'installateur s'en
// charge (fileAssociations de package.json). En développement (electron .) : écrit pour ce compte
// Windows seulement (HKCU), le logo seul (l'ouverture par double-clic demande la version installée).
if (process.platform === "win32" && process.defaultApp) {
  const ico = path.join(__dirname, "..", "build", "icon.ico");
  if (fs.existsSync(ico)) {
    const { execFile } = require("node:child_process");
    const reg = (args) => new Promise((resolve) => execFile("reg", ["add", ...args, "/f"], { windowsHide: true }, () => resolve()));
    (async () => {
      await reg(["HKCU\\Software\\Classes\\.omnipack", "/ve", "/d", "Omniscient.omnipack"]);
      await reg(["HKCU\\Software\\Classes\\Omniscient.omnipack", "/ve", "/d", "Pack Omniscient"]);
      await reg(["HKCU\\Software\\Classes\\Omniscient.omnipack\\DefaultIcon", "/ve", "/d", `${ico},0`]);
    })().catch(() => {});
  }
}
{
  const startupLink = process.argv.find((arg) => typeof arg === "string" && arg.startsWith(`${SERVER_LINK_SCHEME}://`));
  if (startupLink) deliverServerLink(startupLink);
  deliverPackFile(packFileIn(process.argv));
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
  findOnModrinth,
} = require("./modpack");
const { createPlayMode, supportsQuickPlay } = require("./playMode");
const playPacks = require("./playPacks");
const { createOmniPack } = require("./omniPack");
const crashHelp = require("./crashHelp");
const { createBugCatalog, canRepairKind, repair: repairBug } = require("./bugCatalog");
const { readLevelBuffer } = require("./levelDat");
const { extractZip, listZip, writeZip } = require("./zipStream");
const { createWorldCloud } = require("./worldCloud");
const { createSaveOverlay } = require("./saveOverlay");
const { createLiveSave } = require("./liveSave");
const { createFeatures } = require("./features");
const { trackGameWindow } = require("./gameWindow");
const { pingMinecraftServer } = require("./mcPing");
const sessionStore = require("./sessionStore");
const settingsStore = require("./settingsStore");
const packRam = require("./packRam");
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
// Audit du 01/11 : le launcher installé ignore la variable, elle ne sert qu'aux tests en local.
const SITE_URL = ((!app.isPackaged && process.env.MCHUB_SITE_URL) || generatedEnv.MCHUB_SITE_URL || "http://localhost:3000").trim().replace(/\/$/, "");
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
errorReports.init({ dsn: process.env.SENTRY_DSN || generatedEnv.SENTRY_DSN, release: app.getVersion(), isEnabled: () => settingsStore.loadSettings().errorReports !== false });
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
let featuresSessionUuid = null;
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
      // Laboratoire : ce joueur est peut-être testeur, on relit ses fonctionnalités (une fois par
      // compte : le rafraîchissement des 10 min suffit ensuite, audit du 25/10).
      if (featuresSessionUuid !== uuid) {
        featuresSessionUuid = uuid;
        features.refresh();
      }
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
    try {
      // État relu d'abord : la synchro ne démarre jamais sur un état ancien.
      // Audit du 28/10 (correctif 6) : réponse reçue il y a moins d'une minute pour ce compte
      // (écran de chargement, jeton de session) : reprise telle quelle, pas de 3e lecture.
      features.recent(60_000).then(() => features.visible("worlds") && worldCloud.start()).catch(() => {});
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
  currentUuid: () => currentSession?.profile?.id || null,
  fetchJson: (url, options) => fetchJson(url, options),
  log: (message, level = "info") => logStore.pushLog({ level, source: "launcher", message }),
  onChange: (state) => {
    for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("features:changed", state);
    try {
      if (state.worlds?.visible && currentSession) worldCloud.start();
      else if (!state.worlds?.visible) rawWorldCloud.suspend();
    } catch {
      /* worldCloud pas encore prêt : setSession s'en charge */
    }
  },
});
ipcMain.handle("features:get", () => features.all());
// Écran de chargement (retour de Rushi du 25/10 : une icône surgissait 3 s après l'affichage) :
// le menu attend les droits de CE compte. Compte mémorisé : on laisse d'abord sa reprise de
// session aboutir (au plus 1,5 s), puis au plus 3,5 s en tout ; sinon le dernier état connu.
ipcMain.handle("features:ready", async () => {
  const start = Date.now();
  let remembered = false;
  try {
    remembered = !!sessionStore.loadAccounts().activeId;
  } catch {
    /* pas de compte lisible : visiteur */
  }
  while (remembered && !currentSession && Date.now() - start < 1500) await new Promise((r) => setTimeout(r, 100));
  return features.ready(Math.max(500, 3500 - (Date.now() - start)));
});
app.whenReady().then(() => features.start());
// Catalogue de bugs (31/10, Laboratoire « bugCatalog ») : fiches reçues du site, voir bugCatalog.js.
const bugCatalog = createBugCatalog({
  cacheDir: app.getPath("userData"),
  siteUrl: SITE_URL,
  authHeaders: () => launcherAuthHeaders(),
  fetchJson: (url, options, extra) => fetchJson(url, options, extra),
  isOn: () => features.visible("bugCatalog"),
  log: (message, level = "info") => logStore.pushLog({ level, source: "launcher", message }),
});
app.whenReady().then(() => bugCatalog.start(features.recent(60_000)));

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
      devTools: !app.isPackaged,
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
      devTools: !app.isPackaged,
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

// Monte a chaque vidage des amis (ajouter / accepter / retirer) : une liste partie avant n'est
// ni remise en cache ni renvoyee au renderer (voir presence:heartbeat).
let friendsCacheGeneration = 0;
function clearFriendsCache() {
  friendsCacheGeneration++;
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
// 26/10 : section « reports » = page Signalements du serveur (clic sur une notification de
// nouveau signalement). Seule valeur acceptee, jamais une adresse venue du renderer.
ipcMain.handle("servers:openManage", (_event, serverId, section) => {
  if (typeof serverId !== "string" || !serverId) return;
  const suffix = section === "reports" ? "/reports" : "";
  shell.openExternal(`${SITE_URL}/manage/${encodeURIComponent(serverId)}${suffix}`);
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

ipcMain.handle("app:takePackFile", () => {
  packFileRendererReady = true;
  const file = pendingPackFile;
  pendingPackFile = null;
  return file;
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
      { headers: { ...launcherAuthHeaders(), ...inviteHeaders(slug) } },
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
      headers: { ...launcherAuthHeaders(), ...inviteHeaders(slug), "Content-Type": "application/json" },
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
      // Audit du 28/10 (correctif 2) : un nombre. Avant, un objet { maxAgeMs } : la comparaison
      // de cachedFetch etait toujours fausse et la liste etait redemandee au site a chaque fois.
      background ? FRIENDS_BACKGROUND_CACHE_MS : SERVER_CACHE_MS,
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
// Heartbeat de presence (voir lib/presence.ts cote site) : envoye par le renderer
// (schedulePresence : 3 min hors partie, 5 min fenetre reduite ou en jeu, depuis le 28/10).
// Echec silencieux cote renderer (voir sendPresenceHeartbeat la-bas) : un heartbeat rate
// ne fait que retarder un peu le passage "hors ligne" d'un ami, jamais a signaler au joueur.
// Idee 2 du lancement (19/10) : ce meme appel passe par /api/launcher/pulse, qui renvoie en plus
// l'etat de maintenance (lu en cache cote site) et, si withNotifications, les notifications.
// Le renderer evite ainsi deux appels separes. Site pas encore a jour (404) : ancienne route
// /api/launcher/presence, retenue pour toute la session.
// Correctif 3 de l'audit du 28/10 : si withFriends, le site renvoie aussi la liste d'amis (meme
// forme que GET /api/launcher/friends), gardee dans le meme cache que friends:list. Un site plus
// ancien ignore la demande : le renderer garde alors l'appel a part.
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
    const withFriends = opts?.withFriends === true;
    const cacheGeneration = serverCacheGeneration;
    const friendsGeneration = friendsCacheGeneration;
    if (!pulseUnsupported) {
      try {
        result = await post("pulse", { ...payload, withNotifications: opts?.withNotifications === true, withFriends });
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
    let friends;
    const overview = withFriends ? result?.friends : null;
    if (
      overview &&
      Array.isArray(overview.friends) &&
      currentSession?.profile.id === uuid &&
      cacheGeneration === serverCacheGeneration &&
      friendsGeneration === friendsCacheGeneration
    ) {
      friends = { friends: overview.friends, incoming: overview.incoming ?? [], outgoing: overview.outgoing ?? [] };
      serverCache.set(`friends:${uuid}`, { at: Date.now(), data: friends });
    }
    if (result?.maintenance) {
      return {
        ok: true,
        grouped: true,
        maintenance: {
          active: !!result.maintenance.active,
          message: result.maintenance.message || "",
          system: result.maintenance.system || null,
          startsAt: result.maintenance.startsAt || null,
          endsAt: result.maintenance.endsAt || null,
        },
        disruption: result.disruption || null,
        notifications: Array.isArray(result.notifications) ? result.notifications : undefined,
        friends,
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
    return {
      ok: true,
      active: !!data.active,
      message: data.message || "",
      system: data.system || null,
      startsAt: data.startsAt || null,
      endsAt: data.endsAt || null,
      disruption: data.disruption || null,
    };
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
ipcMain.handle("instances:deleteFiles", async (_event, slug, { keepPersonal = true, uninstall = false } = {}) => {
  try {
    const busy = instanceBusy(slug);
    if (busy) return { ok: false, code: busy };
    const { instanceDir, modded } = await instanceDirs(slug);
    // Serveur vanilla retiré du site (23/10) : son dossier n'a que le marqueur « prêt » ; le retirer
    // suffit pour qu'il quitte Ma bibliothèque. Jamais pour un serveur encore en ligne, sauf
    // « Désinstaller » (26/10, demande de Rushi) : les fichiers du jeu sont partagés, seul le
    // marqueur part ; mondes, réglages et dossier partagé ne sont pas touchés.
    if (!modded && (uninstall || isKnownRemoved(slug))) {
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

ipcMain.handle("notifications:markRead", async (_event, id) => {
  if (!currentSession) return { ok: false, error: "Pas de compte Microsoft connecté." };
  try {
    const res = await fetch(`${SITE_URL}/api/launcher/notifications/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...launcherAuthHeaders() },
      body: JSON.stringify({ minecraftUuid: currentSession.profile.id, ...(typeof id === "string" ? { id } : {}) }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Article complet d'une actualite (centre de notifications, 25/10) :
// site/src/app/api/launcher/news/[id]/route.ts.
ipcMain.handle("news:get", async (_event, id) => {
  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/news/${encodeURIComponent(String(id))}`, { headers: launcherAuthHeaders() });
    return { ok: true, news: { title: String(data.news.title || ""), body: String(data.news.body || "") } };
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
    // network : pas d'internet (voir msAuth.js) — le renderer peut alors lancer en solo hors ligne.
    return { ok: false, network: error?.code === "network", error: error instanceof Error ? error.message : "Erreur inconnue" };
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

// Debut du nom d'un fichier de mod, avant sa version : "anima" pour "Anima-1.0.3+Neoforge-26.1.2.jar",
// "ancient_remnants" pour "ancient_remnants-1.0.2.2-26.1.2.jar". Sert seulement a reconnaitre une
// autre version du meme mod dans Telechargements, jamais a accepter un fichier.
function modFileStem(fileName) {
  const stem = String(fileName).toLowerCase().split(/[-+\s]|(?=\d)/)[0].replace(/[_.]+$/, "");
  return stem.length >= 3 ? stem : null;
}

// Mods a ajouter a la main (point 4, L3-F) : quels fichiers attendus sont deja arrives dans le
// dossier Telechargements. Seul le nom est regarde ici (pour cocher la ligne) ; « Réessayer »
// verifie ensuite taille et empreinte avant de s'en servir.
// 26/10 (Rushi, pack FTB) : le joueur prenait le gros bouton Download de CurseForge et recevait une
// autre version, refusee sans explication. `wrong` donne, pour chaque fichier attendu, le fichier
// du meme mod mais d'une autre version trouve dans Telechargements, pour que la fenetre le dise.
// Un doublon renomme par le navigateur (« nom (1).jar ») compte comme trouve.
ipcMain.handle("modpack:findInDownloads", async (_event, fileNames) => {
  if (!Array.isArray(fileNames)) return { found: [], wrong: {} };
  const wanted = new Set(fileNames.filter((name) => typeof name === "string" && name && name === path.basename(name)).slice(0, 200));
  const found = new Set();
  const others = [];
  for (const dir of manualModsSearchDirs()) {
    let names;
    try {
      names = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (wanted.has(name)) found.add(name);
      else if (/\.(jar|zip)$/i.test(name)) {
        const unduplicated = name.replace(/ \(\d+\)(\.(jar|zip))$/i, "$1");
        if (wanted.has(unduplicated)) found.add(unduplicated);
        else others.push(name);
      }
    }
  }
  const wrong = {};
  for (const expected of wanted) {
    if (found.has(expected)) continue;
    const stem = modFileStem(expected);
    const other = stem && others.find((name) => modFileStem(name) === stem);
    if (other) wrong[expected] = other;
  }
  return { found: [...found], wrong };
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
// Audit du 01/11 : au lancement, jamais plus que la RAM du PC moins 2 Go (un PC de 8 Go pouvait partir
// en -Xmx32G : échec ou blocage). Le réglage du joueur n'est pas modifié, seul ce lancement est borné.
function launchMemory(minGB, maxGB) {
  const totalGB = os.totalmem() / 1024 ** 3;
  const ceiling = Math.max(1, Math.floor(totalGB - 2));
  const max = Math.min(Number(maxGB) || 4, ceiling);
  if (max < Number(maxGB)) logStore.pushLog({ level: "warn", source: "launcher", message: `Mémoire demandée (${maxGB} Go) trop haute pour ce PC (${Math.round(totalGB)} Go) : limitée à ${max} Go pour ce lancement.` });
  return { min: `${Math.min(Number(minGB) || 1, max)}G`, max: `${max}G` };
}

// RAM par pack (01/11, Laboratoire « packRam ») : la RAM de l'installation (auto, Paramètres ou
// choisie), ou `ramGB` pour CE lancement seulement (« Lancer avec X Go cette fois »).
function playLaunchMemory(version, settings, ramGB) {
  if (!features.visible("packRam")) return launchMemory(settings.memoryMinGB, settings.memoryMaxGB);
  const gb = packRam.intGB(ramGB) || packRam.resolveGB(playMode.getVersion(version?.id) || version, settings.memoryMaxGB);
  // 02/11 (test ram7) : la ligne donne la RAM vraiment passée au jeu, après le plafond du PC.
  const mem = launchMemory(Math.min(settings.memoryMinGB, gb), gb);
  const given = parseInt(mem.max, 10);
  logStore.pushLog({ level: "info", source: "launcher", message: `Jouer : ${given} Go de RAM (${packRam.intGB(ramGB) ? "juste cette fois" : version?.ram?.mode || "auto"}${given < gb ? `, ${gb} Go demandés, limité par la RAM du PC` : ""}).` });
  return mem;
}

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
  // Mon cloud (03/11) : modpack relie par le proprietaire. « Obligatoire pour rejoindre » : installe
  // avant de se connecter ; « Conseillé » : seulement si le joueur l'a choisi sur la fiche. Il
  // remplace alors le modpack du serveur pour ce lancement (meme dossier d'instance).
  const cloudPack = await fetchCloudPack(slug);
  const useCloud = Boolean(cloudPack && (cloudPack.mode === "required" || cloudChoice(slug) === true));
  // Choix « juste cette fois » : il ne sert qu'à ce lancement (03/11, bug vu par Rushi : sans
  // « Retenir mon choix », la question ne revenait plus jusqu'à la fermeture du launcher).
  cloudChoiceOnce.delete(slug);
  // Nom et type du serveur pour le panneau de la pilule (etapes moddé / vanilla).
  onProgress({ name: server.name, modded: useCloud || (server.type === "modded" && Boolean(server.curseforgeModpackId)) });
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
  if (useCloud || (server.type === "modded" && server.curseforgeModpackId)) {
    modded = await installModpack({
      cloud: useCloud,
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

// Mon cloud (03/11) : modpack relie au serveur par son proprietaire (voir
// site/src/app/api/launcher/cloud-pack). null s'il n'y en a pas, si l'interrupteur
// du Laboratoire est cache pour ce joueur, ou si le site ne repond pas (le serveur se lance alors
// comme avant).
async function fetchCloudPack(slug) {
  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/cloud-pack?slug=${encodeURIComponent(slug)}`, {
      headers: { ...launcherAuthHeaders(), ...inviteHeaders(slug) },
    });
    return data?.pack && typeof data.pack === "object" ? data.pack : null;
  } catch {
    return null;
  }
}

// Choix du joueur pour un modpack « Conseillé » (03/11, preview « Modpack relié au serveur ») :
// true = avec le modpack, false = sans (vanilla), absent = lui demander au clic sur Jouer.
// « Retenir mon choix » l'écrit dans les réglages (modifiable dans ⋯ › Réglages) ; sinon il ne vaut
// que pour le lancement qui suit, et la question revient au prochain clic sur Jouer.
const cloudChoiceOnce = new Map();
function savedCloudChoice(slug) {
  const saved = settingsStore.loadSettings().cloudPackOptIn?.[slug];
  return typeof saved === "boolean" ? saved : null;
}
function cloudChoice(slug) {
  if (cloudChoiceOnce.has(slug)) return cloudChoiceOnce.get(slug);
  return savedCloudChoice(slug);
}

ipcMain.handle("cloudPack:get", async (_event, slug) => {
  if (!isValidInstanceSlug(slug)) return null;
  const pack = await fetchCloudPack(slug);
  if (!pack) return null;
  // `choice` : seulement le choix RETENU (sinon le launcher redemande au clic sur Jouer).
  const choice = savedCloudChoice(slug);
  return { ...pack, optedIn: choice === true, choice };
});

ipcMain.handle("cloudPack:choose", (_event, slug, withPack, remember) => {
  if (!isValidInstanceSlug(slug)) return false;
  const map = { ...(settingsStore.loadSettings().cloudPackOptIn || {}) };
  if (remember) {
    cloudChoiceOnce.delete(slug);
    map[slug] = Boolean(withPack);
  } else {
    cloudChoiceOnce.set(slug, Boolean(withPack));
    delete map[slug];
  }
  settingsStore.saveSettings({ cloudPackOptIn: map });
  return true;
});

// « Envoyer dans le cloud » (03/11, Rushi) : le modpack se fait dans le launcher. Trois envois :
//   1. un .mrpack : mods Modrinth en liens, configs, packs de ressources et shaders de l'installation ;
//   2. la liste des mods CurseForge (une REFERENCE projet + fichier : chaque joueur le telecharge
//      depuis CurseForge, Omniscient ne garde jamais le fichier) et des mods perso (.jar hors
//      Modrinth et CurseForge), que le site autorise a deposer dans le stockage ;
//   3. chaque mod perso, directement vers le stockage (lien signe), puis le site les controle un par
//      un (programme cache, vrai mod, virus connus) et dit ce qu'il a garde.
// Modpack PRIVE, relie au serveur du proprietaire : CurseForge y est permis en liens. Le jour ou des
// modpacks seront publies sur Omniscient, CurseForge y sera bloque (decision de Rushi, 03/11).
const CLOUD_PACK_MAX = 100 * 1000 * 1000;
// Traces de débogage (03/11, test de Rushi) : dans la console du launcher et dans ses journaux.
// Jamais la signature d'un lien signé : seulement l'hôte et le chemin (bucket/clé).
function cloudDebug(step, url, status, detail) {
  let where = String(url || "");
  try {
    const u = new URL(where);
    where = `${u.host}${u.pathname}`;
  } catch {
    // adresse illisible : gardée telle quelle
  }
  const message = `[Mon cloud] ${step} → ${status} ${where}${detail ? ` | ${String(detail).replace(/\s+/g, " ").slice(0, 400)}` : ""}`;
  console.log(message);
  logStore.pushLog({ level: status >= 400 ? "warn" : "info", source: "launcher", message });
}
const CLOUD_JAR_MAX = 30 * 1000 * 1000;
// Liste de la fenêtre « Envoyer dans le cloud » (cases à cocher, comme l'export pour un ami).
const cloudKind = (x) => (x.mrpack === "link" ? "mr" : x.cf ? "cf" : x.abs ? "custom" : "missing");
const cloudModKey = (x) => `${x.file || ""}|${x.name}`;
ipcMain.handle("cloudPack:plan", async (_event, id) => {
  if (!features.visible("cloudPacks")) return pageOff;
  const v = playMode.getVersion(String(id));
  if (!v) return { ok: false, error: "Cette version n'existe plus." };
  try {
    const plan = await omniPack.friendMods(v.id, { cfMatch: currentSession ? cfFingerprintMatch : null });
    return {
      ok: true,
      signedIn: !!currentSession,
      vanilla: !v.pack,
      mods: plan.mods.map((x) => ({ key: cloudModKey(x), name: x.name.slice(0, 80), file: x.file, kind: cloudKind(x) })),
    };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("cloudPack:upload", async (event, id, opts = {}) => {
  const progress = (step, done = 0, total = 0) => {
    if (!event.sender.isDestroyed()) event.sender.send("cloudPack:progress", { id: String(id), step, done, total });
  };
  const skip = new Set(Array.isArray(opts?.skip) ? opts.skip.map(String) : []);
  const parts = { cfg: opts?.parts?.cfg !== false, rp: opts?.parts?.rp !== false, dp: false, w: false };
  if (!features.visible("cloudPacks")) return pageOff;
  if (!currentSession) return { ok: false, error: "Connecte-toi d'abord à ton compte Minecraft." };
  const v = playMode.getVersion(String(id));
  if (!v) return { ok: false, error: "Cette version n'existe plus." };
  if (!v.pack) return { ok: false, error: "Une version vanilla n'a pas de mods : choisis une version avec Fabric, NeoForge, Forge ou Quilt." };
  const uuid = currentSession.profile.id;
  const tmp = path.join(os.tmpdir(), `omni-cloud-${crypto.randomBytes(4).toString("hex")}.mrpack`);
  try {
    progress("prepare");
    const plan0 = await omniPack.friendMods(v.id, { cfMatch: cfFingerprintMatch });
    const plan = { ...plan0, mods: plan0.mods.filter((x) => !skip.has(cloudModKey(x))) };
    const isCf = (x) => x.mrpack !== "link" && !!x.cf;
    const r = await omniPack.exportMrpack(v.id, tmp, { parts, plan: { ...plan, mods: plan.mods.filter((x) => !isCf(x)) }, cloud: true });
    if (r.size > CLOUD_PACK_MAX) return { ok: false, error: `Le modpack fait ${Math.ceil(r.size / 1e6)} Mo sans les mods : 100 Mo au maximum (souvent de gros packs de ressources).` };
    const curseforge = [];
    for (const x of plan.mods.filter(isCf)) {
      const st = x.abs ? await fsp.stat(x.abs).catch(() => null) : null;
      curseforge.push({ file: x.file || `${x.name}.jar`, name: x.name.slice(0, 80), projectId: x.cf.projectId, fileId: x.cf.fileId, sha1: x.sha1 || null, size: st?.size || null });
    }
    const custom = [];
    for (const x of r.custom || []) {
      const st = await fsp.stat(x.abs).catch(() => null);
      if (!st?.isFile()) continue;
      if (st.size > CLOUD_JAR_MAX) return { ok: false, error: `${x.file} fait plus de 30 Mo : trop gros pour le cloud.` };
      custom.push({ file: x.file, name: x.name.slice(0, 80), size: st.size, sha1: x.sha1 || crypto.createHash("sha1").update(await fsp.readFile(x.abs)).digest("hex"), abs: x.abs });
    }
    const base = `${SITE_URL}/api/launcher/cloud-pack?minecraftUuid=${encodeURIComponent(uuid)}`;
    const send = async (url, body, type) => {
      const res = await fetch(url, { method: "POST", headers: { ...launcherAuthHeaders(), "Content-Type": type }, body, signal: AbortSignal.timeout(120000) });
      const data = await res.json().catch(() => null);
      cloudDebug("site", url.replace(/minecraftUuid=[^&]+/, "minecraftUuid=…"), res.status, data?.error || "");
      if (!res.ok || !data?.ok) throw Object.assign(new Error(data?.error || `Réponse ${res.status} du site Omniscient`), { status: res.status });
      return data;
    };
    const name = String(v.name || v.pack?.name || `Minecraft ${v.minecraftVersion}`).slice(0, 60);
    // Le fichier part directement vers le stockage (lien signé), jamais par le site (Rushi, 03/11).
    progress("pack", 0, r.size);
    const slot = await withSessionRetry(async () => send(`${base}&start=1`, "{}", "application/json"));
    if (typeof slot.url !== "string" || !/^https:\/\/[a-z0-9-]+\.r2\.cloudflarestorage\.com\//.test(slot.url)) throw new Error("Lien de stockage refusé.");
    const put = await fetch(slot.url, { method: "PUT", body: await fsp.readFile(tmp), signal: AbortSignal.timeout(10 * 60 * 1000) });
    cloudDebug("dépôt du modpack", slot.url, put.status, put.ok ? "" : await put.text().catch(() => ""));
    if (!put.ok) throw new Error(`Envoi du modpack impossible (réponse ${put.status}). Réessaie.`);
    progress("check");
    const up = await send(`${base}&upload=1&name=${encodeURIComponent(name)}&key=${encodeURIComponent(slot.key)}`, "{}", "application/json");
    const refs = await send(`${base}&refs=1&pack=${encodeURIComponent(up.id)}`, JSON.stringify({ curseforge, custom: custom.map(({ file, name: n, size, sha1 }) => ({ file, name: n, size, sha1 })) }), "application/json");
    // Mods perso : envoyés un par un vers le lien signé que le site a donné (1 h).
    const jarsToSend = Array.isArray(refs.uploads) ? refs.uploads : [];
    let sentJars = 0;
    for (const u of jarsToSend) {
      progress("jars", sentJars++, jarsToSend.length);
      const x = custom.find((c) => c.sha1 === u.sha1);
      if (!x || typeof u.url !== "string" || !/^https:\/\/[a-z0-9-]+\.r2\.cloudflarestorage\.com\//.test(u.url)) continue;
      const res = await fetch(u.url, { method: "PUT", body: await fsp.readFile(x.abs), signal: AbortSignal.timeout(10 * 60 * 1000) });
      cloudDebug(`dépôt de ${x.file}`, u.url, res.status, res.ok ? "" : await res.text().catch(() => ""));
      if (!res.ok) throw new Error(`Envoi de ${x.file} impossible (réponse ${res.status}). Réessaie.`);
    }
    if (jarsToSend.length) progress("checkJars", jarsToSend.length, jarsToSend.length);
    const fin = refs.uploads?.length ? await send(`${base}&finalize=1&pack=${encodeURIComponent(up.id)}`, "{}", "application/json") : refs;
    return {
      ok: true,
      name: up.name,
      updated: !!up.updated,
      mods: up.mods,
      configs: up.configs,
      curseforge: curseforge.length,
      custom: fin.custom ?? 0,
      modrinth: fin.modrinth || [],
      refused: fin.refused || [],
      missing: r.manual || [],
      usage: fin.usage || null,
    };
  } catch (error) {
    return playError(error);
  } finally {
    await fsp.rm(tmp, { force: true }).catch(() => {});
  }
});

ipcMain.handle("cloudPack:setOptIn", (_event, slug, on) => {
  if (!isValidInstanceSlug(slug)) return false;
  // Bouton de la carte « Modpack du serveur » et ⋯ › Réglages : un choix retenu (avec ou sans le
  // modpack), ou null pour ne plus retenir (le launcher redemande à chaque clic sur Jouer).
  const map = { ...(settingsStore.loadSettings().cloudPackOptIn || {}) };
  cloudChoiceOnce.delete(slug);
  if (on === null) delete map[slug];
  else map[slug] = Boolean(on);
  settingsStore.saveSettings({ cloudPackOptIn: map });
  return true;
});

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
      memory: launchMemory(memoryMinGB, memoryMaxGB),
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
      memory: launchMemory(memoryMinGB, memoryMaxGB),
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
const omniPack = createOmniPack({ playMode });
playMode.setModsFor((v, mc) => omniPack.modsFor(v, mc));

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
// Nom du pack d'une version : pack officiel ({ fr, en }) ou Mon pack / pack CurseForge (texte).
const playPackName = (pack) => (pack ? (typeof pack.name === "string" ? pack.name : pack.name?.fr || pack.slug) : null);
// Mêmes fonctions de modpack.js / javaManager.js pour toutes les préparations de version.
const PLAY_DEPS = { ensureVanillaVersion, ensureJavaForMajor: (...a) => javaManager.ensureJavaForMajor(...a), installLoader, prepareLaunchVersion, installFiles };
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
      deps: PLAY_DEPS,
      javaPreferred: settings.javaPath || undefined,
      gameDir: await playMode.launchDir(versionId, null, { strict: features.visible("strictDirs") }),
    });
  })().finally(() => versionInstalls.delete(versionId));
  versionInstalls.set(versionId, run);
  return run;
}
const rawWorldCloud = createWorldCloud({
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
// Laboratoire (25/10) : « Mondes en ligne » coupé pour ce joueur = aucune méthode de la synchro ne
// tourne (aucun appel au site, aucun minuteur, aucun téléchargement), d'où qu'elle soit appelée.
const worldCloud = new Proxy(rawWorldCloud, {
  get(target, prop) {
    const value = target[prop];
    // setGameRunning ne fait que noter l'état du jeu (audit du 25/10) : toujours transmis, sinon il
    // restait « en jeu » si l'interrupteur changeait pendant une partie.
    if (typeof value !== "function" || prop === "suspend" || prop === "setGameRunning") return value;
    return (...args) => {
      if (features.visible("worlds")) return value.apply(target, args);
      return prop === "downloadJob" || prop === "lastStatus" || prop === "isTracked" ? null : Promise.resolve({ ok: false, code: "feature_off" });
    };
  },
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
// Archive d'un Pack Omniscient publié : liens signés (R2, quelques minutes) donnés par le site, morceaux
// mis bout à bout puis vérifiés (SHA-256) avant l'installation.
async function installPublishedOmni(p, minecraftVersion) {
  const info = await fetchJson(`${SITE_URL}/api/launcher/play/omnipack?packId=${encodeURIComponent(p.id)}`, { headers: launcherAuthHeaders() });
  const parts = Array.isArray(info?.parts) ? info.parts : [];
  if (!parts.length || !/^[0-9a-f]{64}$/.test(info?.sha256 || "")) throw new Error("Archive du pack introuvable sur le site.");
  const tmp = path.join(os.tmpdir(), `omnipack-${crypto.randomBytes(4).toString("hex")}.omnipack`);
  const hash = crypto.createHash("sha256");
  const out = fs.createWriteStream(tmp);
  try {
    for (const url of parts) {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`Téléchargement du pack impossible (${res.status}).`);
      const buf = Buffer.from(await res.arrayBuffer());
      hash.update(buf);
      await new Promise((resolve, reject) => out.write(buf, (e) => (e ? reject(e) : resolve())));
    }
    await new Promise((resolve) => out.end(resolve));
    if (hash.digest("hex") !== info.sha256) throw new Error("Archive du pack abîmée pendant le téléchargement.");
    const r = await omniPack.installOmni(tmp, { only: minecraftVersion, pub: { packId: p.id, slug: p.slug, name: p.name }, worlds: null });
    return r.created[0];
  } finally {
    out.destroy();
    await fsp.rm(tmp, { force: true });
  }
}
// « Tester dans le launcher » (31/10) : l'admin du site clique sur un pack proposé par un joueur, le
// site ouvre omniscient://test-pack/<jeton>. Une fenêtre du launcher demande « Installer ce pack pour
// le tester ? » : Annuler = rien ne se passe ; Installer = téléchargement vérifié (SHA-256, avec une
// barre de progression), puis le pack apparaît dans Jouer avec la mention « Test Omnipack ».
// Accepter ou refuser le pack se fait sur le site, pas ici. Rien n'est publié.
let testPackBusy = false;
let testPackAnswer = null;
ipcMain.handle("testPack:answer", (_event, yes) => {
  const done = testPackAnswer;
  testPackAnswer = null;
  done?.(!!yes);
  return { ok: true };
});
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function testPackUi(payload) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) win.webContents.send("testPack:event", payload);
}
async function installTestPack(token) {
  await app.whenReady();
  if (testPackBusy) return testPackUi({ kind: "error", message: "Un test de pack est déjà en cours." });
  testPackBusy = true;
  const tmp = path.join(os.tmpdir(), `omnipack-test-${crypto.randomBytes(4).toString("hex")}.omnipack`);
  try {
    // Launcher fermé au clic : au démarrage le Laboratoire n'est pas encore lu (session pas encore
    // reprise) et la fenêtre n'est pas prête. On attend (30 s au plus) avant de conclure.
    for (let i = 0; i < 20 && !features.visible("omniPack"); i++) {
      await features.recent(30_000).catch(() => {});
      if (!features.visible("omniPack")) await sleepMs(1500);
    }
    for (let i = 0; i < 120 && !serverLinkRendererReady; i++) await sleepMs(500);
    if (!features.visible("omniPack")) return testPackUi({ kind: "error", message: "Pack Omniscient est coupé dans le Laboratoire pour ton compte." });
    let info;
    try {
      info = await fetchJson(`${SITE_URL}/api/launcher/play/omnipack?testToken=${encodeURIComponent(token)}`, { headers: launcherAuthHeaders() });
    } catch (error) {
      return testPackUi({ kind: "error", message: `Impossible de récupérer le pack (${error.message}). Connecte-toi au launcher puis reclique sur « Tester dans le launcher » depuis le site (le lien dure 10 minutes).` });
    }
    const parts = Array.isArray(info?.parts) ? info.parts : [];
    if (!parts.length || !/^[0-9a-f]{64}$/.test(info?.sha256 || "")) return testPackUi({ kind: "error", message: "Archive du pack introuvable sur le site." });
    const name = String(info.name || "Pack").slice(0, 80);
    // 1) La question : Annuler = rien ne se passe.
    const yes = await new Promise((resolve) => {
      testPackAnswer = resolve;
      testPackUi({ kind: "ask", name });
    });
    if (!yes) return;
    // 2) Téléchargement vérifié, avec progression.
    const hash = crypto.createHash("sha256");
    const out = fs.createWriteStream(tmp);
    try {
      for (const [i, url] of parts.entries()) {
        testPackUi({ kind: "progress", name, step: "download", part: i + 1, parts: parts.length, pct: Math.round((i / parts.length) * 70) });
        const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) throw new Error(`Téléchargement du pack impossible (${res.status}).`);
        const buf = Buffer.from(await res.arrayBuffer());
        hash.update(buf);
        await new Promise((resolve, reject) => out.write(buf, (e) => (e ? reject(e) : resolve())));
      }
      await new Promise((resolve) => out.end(resolve));
    } finally {
      out.destroy();
    }
    if (hash.digest("hex") !== info.sha256) throw new Error("Archive du pack abîmée pendant le téléchargement.");
    // 3) Installation (toutes les versions du pack), marquées « Test Omnipack ».
    testPackUi({ kind: "progress", name, step: "install", pct: 70 });
    const r = await omniPack.installOmni(tmp, {
      worlds: [],
      onProgress: (p) => {
        const o = p?.detail?.overall;
        if (typeof o === "number") testPackUi({ kind: "progress", name, step: "install", pct: 70 + Math.round(o * 28) });
      },
    });
    for (const c of r.created) {
      const ver = playMode.getVersion(c.id);
      if (ver) ver.testPack = true;
    }
    await playMode.saveState();
    for (const c of r.created) installVersionInBackground(c.id).catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Test de pack : préparation impossible (${error.message}).` }));
    sendAll("play:worldsChanged");
    testPackUi({ kind: "done", name: r.name || name, versions: r.created.map((c) => c.mc) });
  } catch (error) {
    testPackUi({ kind: "error", message: `Test du pack impossible : ${error.message}` });
  } finally {
    testPackBusy = false;
    await fsp.rm(tmp, { force: true }).catch(() => {});
  }
}
ipcMain.handle("play:listVersions", () => ({ ok: true, versions: playMode.listVersions() }));
ipcMain.handle("play:createVersion", async (_event, { minecraftVersion, packId = null, name = "", omni = false } = {}) => {
  try {
    let pack = null;
    if (packId) {
      const data = await fetchPlayPacks();
      const p = (data.packs || []).find((x) => x.id === packId);
      const v = p?.versions?.find((x) => x.minecraftVersion === minecraftVersion);
      if (!p || !v) return { ok: false, error: "Ce pack n'est pas encore prêt pour cette version." };
      // Pack Omniscient publié (27/10) : son archive vient du site, on installe cette version.
      if (p.kind === "omni") {
        if (!features.visible("omniPack")) return pageOff;
        const created = await installPublishedOmni(p, minecraftVersion);
        installVersionInBackground(created.id).catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Pack Omniscient : préparation impossible (${error.message}).` }));
        sendAll("play:worldsChanged");
        return { ok: true, version: playMode.listVersions().find((x) => x.id === created.id) };
      }
      pack = flattenPackVersion(p, v);
    }
    // « Créer un Pack Omniscient » en vanilla : la version a son dossier et son groupe de versions.
    const om = omni && !packId && features.visible("omniPack") ? { base: true, tested: true } : null;
    return { ok: true, version: await playMode.createVersion({ minecraftVersion, pack, name, omni: om }) };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:renameVersion", async (_event, id, name) => ({ ok: await playMode.renameVersion(id, name) }));
ipcMain.handle("play:removeVersion", async (_event, id, worlds) => {
  if (playRunning?.versionId === id) return { ok: false, error: "Cette version est en train de tourner." };
  // Case « Retirer aussi ses mondes » (27/10) : chaque monde part à la Corbeille avec ses sauvegardes,
  // sans sauvegarde avant (rien ne reste dans le launcher, sauf une Version d'origine).
  let removed = 0;
  try {
    for (const key of Array.isArray(worlds) ? worlds : []) {
      await liveSave.enqueue(() => playMode.removeItem(String(id), { kind: "w", key: String(key) }, { trash: trashItem, deps: PLAY_DEPS, withBackups: true }));
      removed++;
    }
  } catch (error) {
    if (removed) sendAll("play:worldsChanged");
    return playError(error);
  }
  const ok = await playMode.removeVersion(id);
  if (removed) sendAll("play:worldsChanged");
  return { ok, worlds: removed };
});
// Séparation stricte (Laboratoire « strictDirs », 26/10) : la première fois qu'elle est active
// pendant ce démarrage (jeu fermé), chaque monde qui a déjà une version va dans le dossier de cette
// version, après une sauvegarde. Les autres seront rangés à leur premier lancement.
let strictMigration = null;
function ensureStrictLayout() {
  if (!features.visible("strictDirs") || getRunningGame() || gameLaunchInProgress || gamesMove.active) return Promise.resolve();
  if (!strictMigration) {
    strictMigration = liveSave
      .enqueue(() => playMode.migrateToInstances())
      .then((moved) => moved.length && logStore.pushLog({ source: "launcher", message: `Jouer : ${moved.length} monde(s) rangé(s) dans le dossier de leur version (${moved.slice(0, 5).join(", ")}).` }))
      .catch((error) => {
        strictMigration = null;
        logStore.pushLog({ level: "warn", source: "launcher", message: `Jouer : rangement des mondes par version impossible (${error.message}).` });
      });
  }
  return strictMigration;
}
ipcMain.handle("play:listWorlds", async () => {
  try {
    await ensureStrictLayout();
    // gone : mondes supprimés dans le jeu dont les sauvegardes sont encore sur le PC (26/10).
    const [worlds, gone] = await Promise.all([playMode.listWorlds(), playMode.listGone().catch(() => [])]);
    return { ok: true, worlds, gone, running: playRunning ? { versionId: playRunning.versionId } : null };
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
// Mettre à jour une installation (27/10, preview validée par Rushi, Laboratoire « versionGuard ») :
// ses mondes sont sauvegardés 🛡 « Avant X » et vérifiés AVANT, puis l'installation change de version.
ipcMain.handle("play:updateCheck", async (_event, id, mc) => {
  if (!features.visible("versionGuard")) return { ok: false, error: "Fonction pas encore disponible." };
  try {
    return { ok: true, ...(await playMode.updateCheck(String(id || ""), String(mc || ""))) };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:updateVersion", async (event, id, opts) => {
  if (!features.visible("versionGuard")) return { ok: false, error: "Fonction pas encore disponible." };
  const busy = playGameBusy();
  if (busy) return busy;
  const o = opts && typeof opts === "object" ? opts : {};
  try {
    let freeBytes = null;
    try {
      const st = await fsp.statfs(playMode.PLAY_ROOT);
      freeBytes = Number(st.bavail) * Number(st.bsize);
    } catch {
      /* place libre inconnue : on tente quand même, une sauvegarde ratée arrête tout */
    }
    const out = await liveSave.enqueue(() =>
      playMode.updateVersion(String(id || ""), { minecraftVersion: String(o.minecraftVersion || ""), keepCopy: !!o.keepCopy, modsOff: !!o.modsOff }, {
        freeBytes,
        onStep: (st) => !event.sender.isDestroyed() && event.sender.send("play:updateStep", st),
      }),
    );
    for (const b of out.backups) if (b.backup) worldCloud.queueBackup(b.key, b.backup);
    logStore.pushLog({ level: "info", source: "launcher", message: `Jouer : installation mise à jour ${out.from} → ${out.to} (${out.backups.length} monde(s) sauvegardé(s) avant${out.copyId ? ", copie gardée" : ""}).` });
    sendAll("play:worldsChanged");
    return out;
  } catch (error) {
    logStore.pushLog({ level: "warn", source: "launcher", message: `Jouer : mise à jour de l'installation arrêtée : ${error.message}` });
    return { ...playError(error), missing: error.missing || null };
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
    // Partiel : les versions en trop sortent du cloud (restent sur le PC) ; Toutes : celles qui
    // manquent en ligne partent.
    worldCloud.applySettings().catch(() => {});
    return out;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});
// Une sauvegarde ou une restauration ne touche jamais un monde pendant que le jeu tourne.
function playGameBusy() {
  // Audit du 25/10 : pendant le déplacement du dossier des jeux, rien n'écrit dans les mondes
  // (l'ancien dossier est vidé à la fin).
  if (gamesMove.active) return { ok: false, error: GAMES_MOVE_BUSY };
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
    // Dans la file des sauvegardes (audit du 25/10) : jamais en même temps que celle de fin de partie.
    const result = await liveSave.enqueue(() => playMode.backupWorld(key, { reason: "manual", label, force: true }));
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
    return await liveSave.enqueue(() => playMode.restoreBackup(key, backupId));
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("play:scanImport", async (_event, dir) => {
  try {
    const out = await playMode.scanImportable(dir || null);
    // Dossier d'une instance de l'appli CurseForge (…\Instances\<nom>\saves) : le launcher conseille
    // d'importer le pack avec (export .zip), pour que le monde garde ses mods.
    const inst = /[\\/]Instances[\\/]([^\\/]+)[\\/]saves[\\/]?$/i.exec(out.dir || "");
    const cfInstance = inst && fs.existsSync(path.join(out.dir, "..", "minecraftinstance.json")) ? { name: inst[1].slice(0, 60) } : null;
    return { ok: true, ...out, cfInstance };
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
// Version d'origine en cours d'écriture, par monde : « Jouer » attend qu'elle soit finie, pour
// qu'elle soit toujours le monde tel qu'il était à l'import (26/10).
const importBackups = new Map();
ipcMain.handle("play:import", async (event, dir, folders) => {
  try {
    const imported = await playMode.importWorlds(dir || null, Array.isArray(folders) ? folders : [], {
      onProgress: (p) => !event.sender.isDestroyed() && event.sender.send("play:importProgress", p),
    });
    // Sauvegarde activée par défaut : une première sauvegarde de chaque copie (la Version d'origine).
    for (const w of imported) {
      const job = playMode
        .backupWorld(w.key, { reason: "import" })
        .then((r) => r.backup && worldCloud.queueBackup(w.key, r.backup))
        .catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Première sauvegarde de « ${w.name} » impossible : ${error.message}` }))
        .finally(() => importBackups.delete(w.key));
      importBackups.set(w.key, job);
    }
    return { ok: true, imported };
  } catch (error) {
    return playError(error);
  }
});
// Copie d'essai d'un monde modé, ouverte à la place de l'original (26/10).
ipcMain.handle("play:copyWorld", async (_event, key, opts) => {
  const busy = playGameBusy();
  if (busy) return busy;
  if (typeof key !== "string") return { ok: false, error: "Monde introuvable." };
  try {
    await importBackups.get(key);
    return await liveSave.enqueue(() => playMode.copyWorld(key, { name: typeof opts?.name === "string" ? opts.name.slice(0, 80) : "" }));
  } catch (error) {
    return playError(error);
  }
});
// Suppression définitive (26/10) : monde, toutes ses sauvegardes (Version d'origine comprise) et
// ses versions dans le cloud. La fenêtre a déjà demandé le mot et attendu 10 secondes.
// Audit du 28/10 (correctif 4) : suppression de plusieurs mondes d'un coup : l'etat du cloud est
// lu une fois pour tout le lot (avant, une lecture forcee par monde : ~6 appels a la base chacun).
// `sameBatch` : envoye par la selection multiple a partir du 2e monde ; au-dela de 2 min, relu.
let foreverCloudStatus = null;
ipcMain.handle("play:deleteWorldForever", async (_event, key, opts) => {
  const busy = playGameBusy();
  if (busy) return busy;
  if (typeof key !== "string") return { ok: false, error: "Monde introuvable." };
  try {
    await importBackups.get(key);
    let cloudError = null;
    if (features.visible("worlds")) {
      const reuse = opts?.sameBatch === true && foreverCloudStatus?.status && Date.now() - foreverCloudStatus.at < 2 * 60_000;
      if (!reuse) foreverCloudStatus = { at: Date.now(), status: await worldCloud.status({ force: true }).catch(() => null) };
      const status = foreverCloudStatus.status;
      if (status?.worlds?.some((x) => x.worldKey === key)) {
        const r = await worldCloud.remove(key);
        if (!r?.ok) cloudError = r?.error || "cloud";
      }
    }
    const out = await liveSave.enqueue(() => playMode.deleteWorldForever(key));
    return { ...out, cloudError };
  } catch (error) {
    return playError(error);
  }
});
// Aide au crash : le texte à copier pour demander de l'aide (fin du journal + rapport de crash).
let lastCrash = null;
ipcMain.handle("play:crashLogs", async () => {
  if (!lastCrash) return { ok: false };
  return { ok: true, text: await crashHelp.logsForHelp(lastCrash.files) };
});
ipcMain.handle("play:openCrashFolder", () => {
  const f = lastCrash?.files?.crash || lastCrash?.files?.log;
  if (f) shell.showItemInFolder(f);
});
// Aide Discord dans les bugs (02/11, preview validée par Rushi, Laboratoire « bugDiscord ») : rapport
// nettoyé à copier ou à zipper (voir crashHelp.js). L'interface ne donne jamais d'adresse ni de chemin.
const BUG_DISCORD_URL = "https://discord.gg/HGXN34umC2";
async function bugHelpReport(lang) {
  const system = await diagnostics.getSystemInfo({ ...settingsStore.loadSettings(), gameRoot: GAME_ROOT, appVersion: app.getVersion() });
  return crashHelp.buildReport({ lang: lang === "en" ? "en" : "fr", crash: lastCrash, system: { ...system, ramGB: Math.round(os.totalmem() / 1024 ** 3) } });
}
ipcMain.handle("bugHelp:text", async (_event, lang) => {
  try {
    return { ok: true, text: await bugHelpReport(lang) };
  } catch (error) {
    logStore.pushLog({ level: "warn", source: "launcher", message: `Aide Discord : rapport impossible (${error.message}).` });
    return { ok: false };
  }
});
ipcMain.handle("bugHelp:zip", async (_event, lang) => {
  let tmp = null;
  try {
    tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "omniscient-rapport-"));
    const rapport = path.join(tmp, "rapport.txt");
    await fsp.writeFile(rapport, await bugHelpReport(lang), "utf8");
    const logs = await crashHelp.writeZipLogs(tmp, lastCrash?.files);
    const day = new Date().toISOString().slice(0, 10);
    const downloads = app.getPath("downloads");
    let name = `omniscient-rapport-${day}.zip`;
    for (let i = 2; await fsp.stat(path.join(downloads, name)).then(() => true, () => false); i++) name = `omniscient-rapport-${day}-${i}.zip`;
    const zip = path.join(downloads, name);
    await writeZip(zip, [{ abs: rapport, rel: "rapport.txt", mtimeMs: Date.now() }, ...logs]);
    const { size } = await fsp.stat(zip);
    shell.showItemInFolder(zip);
    return { ok: true, name, kb: Math.max(1, Math.round(size / 1024)) };
  } catch (error) {
    logStore.pushLog({ level: "warn", source: "launcher", message: `Aide Discord : zip impossible (${error.message}).` });
    return { ok: false };
  } finally {
    if (tmp) fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
});
ipcMain.handle("bugHelp:discord", () => shell.openExternal(BUG_DISCORD_URL));
// Catalogue de bugs : un signal du launcher (problème évité ou fenêtre à montrer), une fois par session.
function bugSignal(code, ctx) {
  const entry = bugCatalog.signal(code, ctx);
  if (!entry) return;
  logStore.pushLog({ level: "info", source: "launcher", message: `Catalogue de bugs : ${entry.slug} (${code}).` });
  bugCatalog.stat(entry.slug, "seen");
  sendAll("bugs:found", { entry, canRepair: false, hasLogs: false });
}
require("./modpack").setBugSignal(bugSignal);
playPacks.setBugSignal(bugSignal);
// Les seuls signaux que l'interface peut envoyer.
ipcMain.handle("bugs:signal", (_event, code) => {
  if (code === "manual_download_required") bugSignal(code);
});
ipcMain.handle("bugs:refused", (_event, slug) => {
  if (bugCatalog.bySlug(String(slug))) bugCatalog.stat(String(slug), "refused");
});
ipcMain.handle("bugs:openPage", (_event, slug) => {
  if (/^[a-z0-9-]{1,80}$/.test(String(slug))) shell.openExternal(`${SITE_URL}/aide/bugs/${slug}`);
});
// « Corriger » : le geste vient de la fiche gardée ici, jamais de l'interface.
ipcMain.handle("bugs:repair", async (_event, slug, versionId) => {
  const entry = bugCatalog.bySlug(String(slug));
  if (!entry || !features.visible("bugCatalog")) return pageOff;
  const id = String(versionId || "");
  const busy = packBusy(id);
  if (busy) return busy;
  try {
    const out = await repairBug(
      entry,
      id,
      {
        getVersion: (x) => playMode.getVersion(x),
        modsDirOf: (x) => playMode.modsDirOf(x),
        setLoaderVersion: (x, v) => playMode.setLoaderVersion(x, v),
        addMods: (x, slugOrId) => playMode.addPackMods(x, [{ slug: slugOrId }], { deps: PLAY_DEPS }),
        removeItem: (x, item) => playMode.removeItem(x, item, { trash: trashItem, deps: PLAY_DEPS }),
        updateMod: async (x, mod) => {
          const v = playMode.getVersion(x);
          const m = (v.mods || []).find((o) => o.source === "mr" && (o.id === mod || o.slug === mod));
          if (!m) throw new Error(`Mod introuvable dans ce pack : ${mod}.`);
          const latest = (await playPacks.mrVersions(m.projectId, v.minecraftVersion, v.pack.loader))[0];
          if (!latest) throw new Error("Aucune version compatible sur Modrinth.");
          return playMode.setPackMod(x, m.id, { version: latest.v }, { deps: PLAY_DEPS });
        },
        syncFiles: (x) => playMode.syncPackFiles(playMode.getVersion(x), { deps: PLAY_DEPS }),
        clearCache: async () => diagnostics.clearCache(),
      },
      (step) => sendAll("bugs:repairStep", step),
    );
    bugCatalog.stat(entry.slug, "repaired");
    logStore.pushLog({ level: "info", source: "launcher", message: `Catalogue de bugs : ${entry.slug} réparé (sauvegarde : ${out.backup || "aucun dossier mods"}).` });
    return { ok: true };
  } catch (error) {
    logStore.pushLog({ level: "warn", source: "launcher", message: `Catalogue de bugs : réparation impossible (${entry.slug}) : ${error.message}` });
    return playError(error);
  }
});
// « Essayer dans le launcher » : au démarrage, le Laboratoire n'est pas encore lu (même attente que test-pack).
async function showBugTest(slug) {
  for (let i = 0; i < 20 && !(features.visible("bugCatalog") && serverLinkRendererReady); i++) await new Promise((r) => setTimeout(r, 1500));
  if (!features.visible("bugCatalog")) return;
  if (!bugCatalog.bySlug(slug)) await bugCatalog.refresh();
  const entry = bugCatalog.bySlug(slug);
  if (entry) sendAll("bugs:found", { entry, test: true, canRepair: false, hasLogs: false });
  else logStore.pushLog({ level: "warn", source: "launcher", message: `Essai de fiche : ${slug} n'est pas dans les fiches publiées.` });
}
ipcMain.handle("play:openWorldFolder", async (_event, key) => {
  const found = key ? await playMode.worldDir(key) : null;
  return shell.openPath(found ? found.dir : playMode.SAVES);
});

// --- Mon pack et import d'un pack CurseForge (26/10, Laboratoire « myPack », « myPackCf », « cfImport ») ---
// Mon pack : mods de Modrinth (téléchargés), plus une liste CurseForge que le JOUEUR télécharge :
// « Ouvrir la page », il télécharge, le launcher trouve le fichier dans Téléchargements, le vérifie
// (empreinte SHA-1 quand on la connaît, sinon le contenu du .jar) et le range dans le pack. Jamais
// de téléchargement depuis CurseForge pour Mon pack, même pour un mod nécessaire.
const cfAllowed = () => features.visible("myPackCf") || features.visible("cfImport");
const packBusy = (id) => (playRunning?.versionId === id ? { ok: false, code: "gameRunning", error: "Ce pack est en train de tourner : ferme Minecraft d'abord." } : null);
ipcMain.handle("myPack:get", async (_event, id, opts) => {
  if (!pageAllowed(id)) return pageOff;
  try {
    return { ok: true, pack: await playMode.packInfo(String(id || ""), { quick: opts?.quick === true }) };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("myPack:searchModrinth", async (_event, q, opts) => {
  try {
    const loader = playPacks.LOADER_IDS.includes(opts?.loader) ? opts.loader : "fabric";
    return { ok: true, mods: await playPacks.searchModrinth(String(q || ""), { mc: String(opts?.mc || ""), loader, fr: settingsStore.loadSettings().locale !== "en" }) };
  } catch (error) {
    return playError(error);
  }
});
// Recherche CurseForge par le site (clé de l'API CurseForge côté site) : nom, page, fichier conseillé.
// Audit du 28/10 (correctif 5) : la fenêtre « Créer Mon pack » se redessine à chaque clic (ajouter,
// changer de version...) et relançait la même recherche : réponse gardée 5 min par recherche.
const cfSearchCache = new Map();
const CF_SEARCH_CACHE_MS = 5 * 60_000;
ipcMain.handle("myPack:searchCurseForge", async (_event, q, opts) => {
  if (!features.visible("myPackCf")) return { ok: false, code: "feature_off", mods: [] };
  const text = String(q || "").trim().slice(0, 80);
  const cacheKey = JSON.stringify([text.toLowerCase(), String(opts?.mc || ""), String(opts?.loader || "")]);
  const hit = cfSearchCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CF_SEARCH_CACHE_MS) return { ok: true, mods: hit.mods };
  try {
    const params = new URLSearchParams(text ? { q: text } : {});
    if (opts?.mc) params.set("mc", String(opts.mc));
    if (opts?.loader) params.set("loader", String(opts.loader));
    const data = await fetchJson(`${SITE_URL}/api/launcher/curseforge/mods?${params}`, { headers: launcherAuthHeaders() });
    const mods = (Array.isArray(data?.mods) ? data.mods : []).slice(0, 30).map((m) => ({
      slug: `cf-${Number(m.projectId) || 0}`,
      projectId: Number(m.projectId) || null,
      name: String(m.name || "?").slice(0, 80),
      author: String(m.author || "").slice(0, 60),
      fileId: Number(m.fileId) || null,
      fileName: typeof m.fileName === "string" ? m.fileName.slice(0, 120) : null,
      pageUrl: safeModPageUrl(m.pageUrl),
    }));
    if (cfSearchCache.size >= 50) cfSearchCache.delete(cfSearchCache.keys().next().value);
    cfSearchCache.set(cacheKey, { at: Date.now(), mods });
    return { ok: true, mods };
  } catch (error) {
    return { ...playError(error), mods: [] };
  }
});
// Mods d'un monde Forge/NeoForge (liste lue dans level.dat) : trouvés sur Modrinth, ou à la main.
ipcMain.handle("myPack:scanWorld", async (_event, key) => {
  try {
    const found = await playMode.worldDir(String(key || ""));
    const world = found?.world;
    const mods = world?.modded;
    const ids = (mods?.ids || []).filter((x) => typeof x === "string" && /^[a-z0-9_.-]{2,64}$/.test(x) && !["minecraft", "forge", "neoforge", "fml", "mcp"].includes(x)).slice(0, 80);
    const loader = playPacks.LOADER_IDS.includes(mods?.loader) ? mods.loader : "forge";
    const mr = [];
    const cf = [];
    let i = 0;
    const worker = async () => {
      while (i < ids.length) {
        const id = ids[i++];
        let hit = null;
        for (const slug of [...new Set([id, id.replace(/_/g, "-")])]) {
          const vers = await playPacks.mrVersions(slug, world.minecraftVersion, loader).catch(() => []);
          if (vers.length) {
            hit = { slug, name: id };
            break;
          }
        }
        (hit ? mr : cf).push(hit || { slug: `cf-${id}`, name: id, search: id });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return { ok: true, total: ids.length, mr, cf };
  } catch (error) {
    return playError(error);
  }
});

// Fichiers trouvés dans Téléchargements avant que le pack existe (fenêtre « Mon pack »).
const stagedCfFiles = new Map();
const cfWatchers = new Map();
async function sha1Of(file) {
  const hash = crypto.createHash("sha1");
  await require("node:stream/promises").pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
}
/**
 * Ouvre la page CurseForge d'un mod et attend (15 min au plus) son fichier dans Téléchargements.
 * `want` : { sha1, size, fileName, depId } ; un fichier n'est pris que s'il a la bonne empreinte,
 * ou (empreinte inconnue) le bon nom exact, ou (mod cherché par son id) un .jar récent qui
 * déclare cet id. `want.ext` : extension cherchée (.jar par défaut, .zip pour les packs de ressources,
 * shaders, maps et data packs). Renvoie { file, sha1, size, fileName, meta } ou null.
 */
function watchDownloads(watchKey, want) {
  cfWatchers.get(watchKey)?.cancel();
  const started = Date.now();
  let stop = false;
  const p = (async () => {
    const seen = new Map();
    while (!stop && Date.now() - started < 15 * 60_000) {
      for (const dir of manualModsSearchDirs()) {
        const names = await fsp.readdir(dir).catch(() => []);
        for (const name of names) {
          if (!(want.ext || /\.jar$/i).test(name)) continue;
          const file = path.join(dir, name);
          const st = await fsp.stat(file).catch(() => null);
          if (!st || !st.isFile()) continue;
          const sig = `${st.size}|${st.mtimeMs}`;
          if (seen.get(file) === sig) continue;
          seen.set(file, sig);
          const plain = name.replace(/ \(\d+\)(\.\w+)$/i, "$1");
          // Autre version du même mod (30/10) : jamais prise, mais signalée au joueur, une fois par fichier.
          if (want.onWrong && want.fileName && st.mtimeMs >= started - 10 * 60_000 && plain !== want.fileName && modFileStem(plain) && modFileStem(plain) === modFileStem(want.fileName)) {
            want.onWrong(plain);
            continue;
          }
          if (want.sha1) {
            // Seule l'empreinte compte (31/10 : une taille annoncée fausse d'un octet refusait le bon fichier).
            const sha1 = await sha1Of(file).catch(() => null);
            if (sha1 !== want.sha1) continue;
            return { file, sha1, size: st.size, fileName: want.fileName || plain, meta: want.ext ? null : await playPacks.readJarMeta(file).catch(() => null) };
          }
          if (want.fileName && plain === want.fileName) {
            return { file, sha1: await sha1Of(file), size: st.size, fileName: plain, meta: want.ext ? null : await playPacks.readJarMeta(file).catch(() => null) };
          }
          if (want.depId && !want.ext && st.mtimeMs >= started - 10 * 60_000) {
            const meta = await playPacks.readJarMeta(file).catch(() => null);
            if (meta && [...meta.ids, ...meta.provides].includes(want.depId)) return { file, sha1: await sha1Of(file), size: st.size, fileName: plain, meta };
          }
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
  })().finally(() => cfWatchers.delete(watchKey));
  cfWatchers.set(watchKey, { cancel: () => (stop = true) });
  return p;
}
function curseforgePageFor(info) {
  return (
    safeModPageUrl(info.pageUrl) ||
    (Number(info.projectId) > 0 ? `https://www.curseforge.com/projects/${Number(info.projectId)}` : null) ||
    `https://www.curseforge.com/minecraft/search?page=1&pageSize=20&sortBy=relevancy&class=mc-mods&search=${encodeURIComponent(String(info.search || info.name || "").slice(0, 60))}`
  );
}
// Empreinte et taille du fichier attendu, par le site (route des packs des serveurs).
async function cfFileInfo(fileId) {
  if (!(Number(fileId) > 0)) return null;
  const data = await fetchJson(`${SITE_URL}/api/launcher/curseforge/files`, {
    method: "POST",
    headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ fileIds: [Number(fileId)] }),
  }).catch(() => null);
  return data?.files?.find((f) => f.id === Number(fileId)) || null;
}
// « Corriger le pack » (30/10, Rushi : « il ouvre la page normale, pas celle de la bonne version ») :
// fichiers CurseForge d'un mod pour la version et le chargeur du pack (route du site, avec la page
// exacte et l'empreinte de chaque fichier). Gardés 10 min.
const cfModFilesCache = new Map();
// Petits caches de session (audit du 01/11, L7) : au-delà de `max` entrées, la plus ancienne part.
function rememberCapped(map, key, value, max) {
  if (map.size >= max && !map.has(key)) map.delete(map.keys().next().value);
  map.set(key, value);
}
async function cfModFiles(projectId, mc, loader) {
  if (!(Number(projectId) > 0)) return [];
  const key = `${projectId}|${mc}|${loader}`;
  const hit = cfModFilesCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.files;
  const params = new URLSearchParams({ projectId: String(Number(projectId)) });
  if (mc) params.set("mc", String(mc));
  if (loader) params.set("loader", String(loader));
  const data = await fetchJson(`${SITE_URL}/api/launcher/curseforge/modfiles?${params}`, { headers: launcherAuthHeaders() });
  const files = (Array.isArray(data?.files) ? data.files : []).slice(0, 50).map((f) => ({
    fileId: Number(f.fileId) || 0,
    fileName: String(f.fileName || ""),
    sha1: /^[0-9a-f]{40}$/i.test(f.sha1 || "") ? f.sha1.toLowerCase() : null,
    size: Number(f.fileLength) || null,
    pageUrl: safeModPageUrl(f.pageUrl),
  })).filter((f) => f.fileId && f.fileName);
  rememberCapped(cfModFilesCache, key, { at: Date.now(), files }, 200);
  return files;
}
// Fichier à prendre pour une ligne CurseForge de l'assistant. Mise à jour (« demande X ou plus ») :
// le fichier le plus récent pour cette version de Minecraft et ce chargeur, s'il est différent de
// celui du pack ; sinon `none` (aucune version ne va : l'assistant propose les autres solutions).
// Mod du pack pas encore téléchargé : son propre fichier. Retenu pour « Ouvrir la page ».
const cfTargets = new Map();
ipcMain.handle("myPack:cfTarget", async (_event, id, problem) => {
  if (!cfAllowed()) return { ok: false, code: "feature_off" };
  try {
    const modId = String(problem?.fix?.modId || "");
    const info = playMode.cfPending(String(id), modId);
    if (!info) return { ok: false };
    if (!problem.fix.update) return { ok: true, fileName: info.fileName || null };
    const v = playMode.getVersion(String(id));
    const files = await cfModFiles(info.projectId, v?.minecraftVersion, v?.pack?.loader);
    const best = files[0];
    if (!best || best.fileId === info.fileId || best.sha1 === info.sha1) return { ok: true, none: true };
    cfTargets.set(`${id}|${modId}`, best);
    bugSignal("cf_wrong_file"); // catalogue de bugs : le launcher a trouvé le bon fichier à la place de l'ancien
    return { ok: true, fileName: best.fileName, pageUrl: best.pageUrl };
  } catch (error) {
    return playError(error);
  }
});
// « Changer la version de {mod} » pour un mod CurseForge : ses fichiers pour cette version de
// Minecraft et ce chargeur, celui du pack marqué `current`.
ipcMain.handle("myPack:cfFiles", async (_event, id, modId) => {
  if (!cfAllowed()) return { ok: false, code: "feature_off", files: [] };
  try {
    const info = playMode.cfPending(String(id), String(modId || ""));
    if (!info) return { ok: true, files: [] };
    const v = playMode.getVersion(String(id));
    const files = await cfModFiles(info.projectId, v?.minecraftVersion, v?.pack?.loader);
    return { ok: true, files: files.map((f) => ({ ...f, current: f.fileId === info.fileId || (!!f.sha1 && f.sha1 === info.sha1) })) };
  } catch (error) {
    return { ...playError(error), files: [] };
  }
});
// `arg` : { packId, modId } (mod du pack), { packId, depId, name } (mod manquant cherché par son id)
// ou, pendant la création, { slug, name, projectId, fileId, fileName, pageUrl } (sans pack).
ipcMain.handle("myPack:openCurseForge", async (_event, arg) => {
  if (!cfAllowed()) return { ok: false, code: "feature_off" };
  try {
    const packId = typeof arg?.packId === "string" ? arg.packId : null;
    let info = packId && arg.modId ? playMode.cfPending(packId, String(arg.modId)) : null;
    // 30/10 : un fichier précis (liste des versions), ou le bon fichier d'une mise à jour, plutôt que
    // le fichier déjà dans le pack (avant : page de l'ancien fichier, et c'est lui qu'on attendait).
    const target = packId && arg.modId && !arg.fileId ? cfTargets.get(`${packId}|${arg.modId}`) : null;
    if (info && target) info = { ...info, fileId: target.fileId, fileName: target.fileName, sha1: target.sha1, size: target.size, pageUrl: target.pageUrl };
    else if (info && Number(arg.fileId) > 0) info = { ...info, fileId: Number(arg.fileId), fileName: arg.fileName, sha1: null, size: null, pageUrl: safeModPageUrl(arg.pageUrl) };
    if (!info) info = { name: arg?.name, projectId: arg?.projectId, fileId: arg?.fileId, fileName: arg?.fileName, pageUrl: arg?.pageUrl, search: arg?.search || arg?.depId };
    if (!info.sha1 && info.fileId) {
      const f = await cfFileInfo(info.fileId);
      if (f) Object.assign(info, { sha1: /^[0-9a-f]{40}$/i.test(f.sha1 || "") ? f.sha1.toLowerCase() : null, size: f.fileLength || null, fileName: f.fileName || info.fileName, pageUrl: info.pageUrl || f.pageUrl });
    }
    shell.openExternal(curseforgePageFor(info));
    const watchKey = `${packId || "new"}|${arg?.modId || arg?.depId || arg?.slug || info.name}`;
    const wrongSeen = new Set();
    const onWrong = arg?.modId
      ? (fileName) => {
          if (wrongSeen.has(fileName)) return;
          wrongSeen.add(fileName);
          sendAll("myPack:cfWrong", { modId: String(arg.modId), fileName });
        }
      : null;
    const got = await watchDownloads(watchKey, { sha1: info.sha1 || null, size: info.size || null, fileName: info.fileName || null, depId: arg?.depId || null, onWrong });
    if (!got) return { ok: true, found: false };
    if (!packId) {
      const token = crypto.randomUUID();
      stagedCfFiles.set(token, got);
      return { ok: true, found: true, token, name: got.meta?.name || info.name };
    }
    const modId = arg.modId || `cf-${String(arg.depId || got.meta?.ids?.[0] || "mod").slice(0, 60)}`;
    const out = await playMode.acceptManualJar(packId, modId, got.file, { ...got, fileId: info.fileId || null, pageUrl: info.pageUrl || null });
    cfTargets.delete(`${packId}|${arg.modId}`);
    sendAll("play:worldsChanged");
    return { ok: true, found: true, name: out.name };
  } catch (error) {
    return playError(error);
  }
});
// 03/11 (Rushi) : une installation impossible est bloquée avant la création. La fenêtre « Nouveau
// pack » demande si le chargeur existe pour cette version de Minecraft (ex. un chargeur pas encore
// sorti) et ne propose pas ces cases. Réponse gardée 30 min ; site injoignable = pas de blocage.
const loaderOkCache = new Map();
ipcMain.handle("myPack:loaderOk", async (_event, loader, mc) => {
  const l = playPacks.LOADER_IDS.includes(loader) ? loader : null;
  const v = String(mc || "").slice(0, 40);
  if (!l || !v) return { ok: true, exists: false };
  const key = `${l}|${v}`;
  const hit = loaderOkCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return { ok: true, exists: hit.exists };
  try {
    const exists = !!(await playPacks.latestLoaderVersion(l, v));
    loaderOkCache.set(key, { at: Date.now(), exists });
    return { ok: true, exists };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("myPack:create", async (_event, o) => {
  try {
    const loader = playPacks.LOADER_IDS.includes(o?.loader) ? o.loader : null;
    if (!loader) return { ok: false, error: "Choisis un chargeur de mods." };
    const mc = String(o?.minecraftVersion || "");
    const loaderVersion = await playPacks.latestLoaderVersion(loader, mc);
    const list = Array.isArray(o?.mods) ? o.mods.slice(0, 300) : [];
    const wanted = list.filter((m) => m.source !== "cf" && typeof m.slug === "string").map((m) => ({ slug: m.slug, version: m.version || null }));
    const mods = wanted.length ? await playPacks.resolveModrinth(wanted, { mc, loader }) : [];
    // Pack Omniscient (27/10) : Modrinth seulement, jamais de CurseForge ; la version est la base du pack.
    const omni = o?.omni && features.visible("omniPack") ? { base: true, tested: true } : null;
    if (!omni && !features.visible("myPack")) return pageOff;
    const v = await playMode.createCustomVersion({ kind: "mine", name: o?.name, minecraftVersion: mc, loader, loaderVersion, mods, omni });
    const cf = features.visible("myPackCf") && !omni ? list.filter((m) => m.source === "cf") : [];
    if (cf.length) {
      await playMode.addPackMods(
        v.id,
        cf.map((c) => ({ ...c, source: "cf", id: c.projectId ? `cf-${c.projectId}` : String(c.slug || "").slice(0, 80) })),
      );
      for (const c of cf) {
        const got = c.token && stagedCfFiles.get(c.token);
        if (!got) continue;
        stagedCfFiles.delete(c.token);
        await playMode.acceptManualJar(v.id, c.projectId ? `cf-${c.projectId}` : String(c.slug), got.file, got).catch(() => {});
      }
    }
    if (typeof o?.worldKey === "string" && o.worldKey) await playMode.setWorldVersion(o.worldKey, v.id);
    installVersionInBackground(v.id).catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Mon pack : préparation impossible (${error.message}).` }));
    sendAll("play:worldsChanged");
    return { ok: true, version: v, name: v.pack.name };
  } catch (error) {
    return playError(error);
  }
});
// « + Ajouter des mods » sur la page d'un pack.
ipcMain.handle("myPack:add", async (_event, id, list) => {
  const busy = packBusy(id);
  if (busy) return busy;
  try {
    const mods = (Array.isArray(list) ? list.slice(0, 200) : [])
      .filter((m) => m.source !== "cf" || features.visible("myPackCf"))
      .map((m) => (m.source === "cf" ? { ...m, id: m.projectId ? `cf-${m.projectId}` : String(m.slug || "") } : { slug: m.slug, version: m.version || null }));
    await playMode.addPackMods(String(id), mods, { deps: PLAY_DEPS });
    for (const m of list || []) {
      const got = m.token && stagedCfFiles.get(m.token);
      if (!got) continue;
      stagedCfFiles.delete(m.token);
      await playMode.acceptManualJar(String(id), m.projectId ? `cf-${m.projectId}` : String(m.slug), got.file, got).catch(() => {});
    }
    return { ok: true };
  } catch (error) {
    return playError(error);
  }
});
// « J'ai le fichier (.jar) » dans « Corriger le pack » (27/10) : copie, jamais déplacé ni supprimé.
ipcMain.handle("myPack:addJar", async (event, id, opts) => {
  const busy = packBusy(id);
  if (busy) return busy;
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: "Fichier du mod (.jar)",
      defaultPath: manualModsSearchDirs()[0],
      filters: [{ name: "Mod Minecraft", extensions: ["jar"] }],
      properties: ["openFile"],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
    const out = await playMode.addLooseJar(String(id), result.filePaths[0]);
    const depId = typeof opts?.depId === "string" ? opts.depId : null;
    sendAll("play:worldsChanged");
    return { ok: true, name: out.name, matches: !depId || out.ids.includes(depId) };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("myPack:setMod", async (_event, id, modId, patch) => {
  const busy = packBusy(id);
  if (busy) return busy;
  try {
    const clean = {};
    if (typeof patch?.on === "boolean") clean.on = patch.on;
    if (typeof patch?.version === "string") clean.version = patch.version.slice(0, 80);
    return await playMode.setPackMod(String(id), String(modId), clean, { deps: PLAY_DEPS });
  } catch (error) {
    return playError(error);
  }
});
// « Corriger » : la solution trouvée par packProblems (Modrinth). CurseForge passe par openCurseForge.
ipcMain.handle("myPack:fix", async (_event, id, problem) => {
  const busy = packBusy(id);
  if (busy) return busy;
  const fix = problem?.fix;
  try {
    if (fix?.action === "version") return await playMode.setPackMod(String(id), String(fix.modId), { version: String(fix.to) }, { deps: PLAY_DEPS });
    if (fix?.action === "enable") return await playMode.setPackMod(String(id), String(fix.modId), { on: true }, { deps: PLAY_DEPS });
    if (fix?.action === "add") {
      return await playMode.addPackMods(String(id), [{ slug: String(fix.slug), version: fix.versionId || fix.version, pinned: true, by: problem?.a?.id ? [String(problem.a.id)] : [] }], { deps: PLAY_DEPS });
    }
    return { ok: false, error: "Pas de correction automatique pour ce problème." };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("myPack:setResourcePack", async (_event, id, file, on) => {
  try {
    return await playMode.setResourcePack(String(id), file, on);
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("myPack:setShader", async (_event, id, file) => {
  try {
    return await playMode.setShader(String(id), file || null);
  } catch (error) {
    return playError(error);
  }
});
// Dossier du pack, ou un de ses sous-dossiers (resourcepacks, shaderpacks, config…).
ipcMain.handle("myPack:openFolder", async (_event, id, sub) => {
  if (!pageAllowed(id)) return pageOff;
  const dir = playMode.pageDir(String(id || ""));
  const name = typeof sub === "string" && sub === path.basename(sub) && sub !== ".." ? sub : "";
  const target = name ? path.join(dir, name) : dir;
  if (name && ["resourcepacks", "shaderpacks", "mods"].includes(name)) await fsp.mkdir(target, { recursive: true }).catch(() => {});
  return shell.openPath(fs.existsSync(target) ? target : dir);
});


// --- Page d'une version, Pack Omniscient (27/10, preview v22 validée par Rushi) ----------------------
// Laboratoire : « vanillaPage » (page des versions vanilla), « dataPacks » (onglet Data packs),
// « packFiles » (explorateur de fichiers), « omniPack » (Pack Omniscient), « packExport » (export
// .mrpack pour un ami). Tout passe par myPack:* (voir FEATURE_IPC) puis par ces vérifications.
const pageAllowed = (id) => {
  const v = playMode.getVersion(String(id || ""));
  if (!v) return false;
  if (v.omni && !features.visible("omniPack")) return false;
  return v.pack ? features.visible("myPack") || v.pack.kind === "omnipub" : features.visible("vanillaPage") || (!!v.omni && features.visible("omniPack"));
};
const pageOff = { ok: false, code: "feature_off", error: "Cette fonction est coupée pour le moment." };
const trashItem = (abs) => shell.trashItem(abs);
async function pickZipFile(event, title, name = "Fichier .zip") {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, { title, defaultPath: manualModsSearchDirs()[0], filters: [{ name, extensions: ["zip"] }], properties: ["openFile"] });
  return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
}
ipcMain.handle("myPack:remove", async (_event, id, item) => {
  if (!pageAllowed(id)) return pageOff;
  const busy = packBusy(id);
  if (busy) return busy;
  const kind = String(item?.kind || "");
  if (kind === "dp" && !features.visible("dataPacks")) return pageOff;
  try {
    // Un monde ou un data pack touche aux mondes : dans la file des sauvegardes (jamais en même temps).
    const out = await liveSave.enqueue(() => playMode.removeItem(String(id), { kind, key: String(item?.key || "") }, { trash: trashItem, deps: PLAY_DEPS }));
    if (kind === "w") sendAll("play:worldsChanged");
    return { ok: true, ...out };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("myPack:searchContent", async (_event, id, kind, q, opts) => {
  if (!pageAllowed(id)) return pageOff;
  try {
    const v = playMode.getVersion(String(id));
    const fr = settingsStore.loadSettings().locale !== "en";
    if (opts?.src === "cf") return { ok: true, items: await cfContentSearch(kind, String(q || ""), v.minecraftVersion, fr) };
    return { ok: true, items: await playPacks.searchContent(kind === "sh" ? "sh" : "rp", String(q || ""), { mc: v.minecraftVersion, fr }) };
  } catch (error) {
    return { ...playError(error), items: [] };
  }
});
// Fenêtre « Ajouter » commune (28/10, preview validée par Rushi, Laboratoire « contentCf ») : packs
// de ressources, shaders, mondes et data packs CurseForge, cherchés par le site (notre clé). Un
// fichier que son auteur réserve à l'appli CurseForge (`blocked`) n'est jamais téléchargé : le
// joueur ouvre sa page, télécharge, puis « Importer un fichier .zip ».
const CF_CONTENT_KINDS = ["rp", "sh", "w", "dp"];
const cfContentCache = new Map();
async function cfContentSearch(kind, q, mc, fr) {
  if (!features.visible("contentCf")) throw Object.assign(new Error("CurseForge est coupé ici pour le moment."), { code: "feature_off" });
  if (!CF_CONTENT_KINDS.includes(kind)) throw new Error("Type de contenu inconnu.");
  if (!currentSession) throw new Error("Connecte-toi avec ton compte Microsoft d'abord : CurseForge passe par le site Omniscient.");
  const text = q.trim().slice(0, 80);
  const key = JSON.stringify([kind, text.toLowerCase(), mc]);
  const hit = cfContentCache.get(key);
  if (hit && Date.now() - hit.at < CF_SEARCH_CACHE_MS) return hit.items;
  const params = new URLSearchParams({ kind, q: text, mc: String(mc || "") });
  const data = await fetchJson(`${SITE_URL}/api/launcher/curseforge/content?${params}`, { headers: launcherAuthHeaders() });
  const items = (Array.isArray(data?.items) ? data.items : []).slice(0, 30).map((x) => ({
    slug: `cf-${Number(x.projectId) || 0}-${Number(x.fileId) || 0}`,
    src: "cf",
    name: String(x.name || "?").slice(0, 80),
    author: String(x.author || "").slice(0, 60),
    downloads: playPacks.fmtDownloads ? playPacks.fmtDownloads(Number(x.downloads) || 0, fr) : String(x.downloads || ""),
    icon: /^https:\/\/media\.forgecdn\.net\//.test(x.iconUrl || "") ? x.iconUrl : null,
    blocked: !!x.blocked || !(Number(x.fileId) > 0),
    page: safeModPageUrl(x.pageUrl),
  }));
  if (cfContentCache.size >= 50) cfContentCache.delete(cfContentCache.keys().next().value);
  cfContentCache.set(key, { at: Date.now(), items });
  return items;
}
// Télécharge le fichier conseillé d'un résultat CurseForge (`cf-<projet>-<fichier>`) dans un dossier
// temporaire : lien du site, seulement sur *.forgecdn.net, SHA-1 vérifié. Renvoie le chemin du .zip.
async function cfContentDownload(slug) {
  if (!features.visible("contentCf")) throw Object.assign(new Error("CurseForge est coupé ici pour le moment."), { code: "feature_off" });
  const fileId = Number(/^cf-\d+-(\d+)$/.exec(String(slug || ""))?.[1]) || 0;
  const f = await cfFileInfo(fileId);
  let okUrl = false;
  try {
    const url = new URL(f?.downloadUrl || "");
    okUrl = url.protocol === "https:" && url.hostname.endsWith(".forgecdn.net") && !url.username;
  } catch {
    okUrl = false;
  }
  if (!f || !okUrl) throw Object.assign(new Error("Son auteur réserve ce fichier à l'appli CurseForge : ouvre sa page, télécharge-le, puis « Importer un fichier .zip »."), { code: "no_download" });
  const base = String(f.fileName || "").replace(/[^\w.+() \[\]!'&,-]/g, "_");
  if (!/\.zip$/i.test(base)) throw new Error("Ce fichier CurseForge n'est pas un .zip.");
  const dir = path.join(browseDir(), `cf-${fileId}`);
  browseBusy.add(dir);
  try {
    await cleanBrowseDir().catch(() => {});
    await fs.promises.mkdir(dir, { recursive: true });
    await installFiles({ entries: [{ path: base, url: f.downloadUrl, sha1: /^[0-9a-f]{40}$/i.test(f.sha1 || "") ? f.sha1.toLowerCase() : null, size: Number(f.fileLength) || null }], instanceDir: dir, previousFiles: [] });
    await touchFile(dir);
    await touchFile(path.join(dir, base));
  } finally {
    browseBusy.delete(dir);
  }
  return path.join(dir, base);
}
ipcMain.handle("myPack:addContent", async (event, id, o) => {
  if (!pageAllowed(id)) return pageOff;
  const busy = packBusy(id);
  if (busy) return busy;
  try {
    const kind = o?.kind === "sh" ? "sh" : "rp";
    let sourceFile = null;
    if (o?.from === "cf") sourceFile = await cfContentDownload(o.slug);
    else if (o?.from !== "mr") {
      sourceFile = await pickZipFile(event, kind === "sh" ? "Shader (.zip)" : "Pack de ressources (.zip)");
      if (!sourceFile) return { ok: false, cancelled: true };
    }
    return { ok: true, ...(await playMode.addContent(String(id), { kind, from: o?.from === "mr" ? "mr" : "file", slug: String(o?.slug || ""), sourceFile })) };
  } catch (error) {
    return playError(error);
  }
});
// CurseForge (packs de ressources, shaders, maps) : seulement la page de recherche, le joueur
// télécharge lui-même (jamais de téléchargement par le launcher).
const CF_CLASS = { rp: "texture-packs", sh: "shaders", w: "worlds", dp: "data-packs" };
ipcMain.handle("myPack:openCurseForgePage", async (_event, o) => {
  const page = safeModPageUrl(o?.url);
  if (page) {
    shell.openExternal(page);
    return { ok: true };
  }
  const cls = CF_CLASS[o?.kind] || "texture-packs";
  const mc = /^[\w.+-]+$/.test(o?.minecraftVersion || "") ? o.minecraftVersion : "";
  shell.openExternal(`https://www.curseforge.com/minecraft/search?class=${cls}${mc ? `&gameVersion=${encodeURIComponent(mc)}` : ""}`);
  return { ok: true };
});
// Fichier CurseForge réservé à l'appli CurseForge (28/10, Rushi : « dès qu'il télécharge, ça le détecte
// et ça le déplace ») : on ouvre la page du fichier exact, puis on attend (15 min au plus) ce fichier
// dans Téléchargements, comme pour les mods. Il n'est pris que s'il a la bonne empreinte (ou, sans
// empreinte connue, le bon nom). Il est copié, installé, puis retiré de Téléchargements (avec ses
// doublons identiques « nom (1).zip »). Le launcher ne télécharge rien lui-même.
ipcMain.handle("myPack:watchCfContent", async (_event, id, o) => {
  if (!pageAllowed(id) || !features.visible("contentCf")) return pageOff;
  const kind = CF_CONTENT_KINDS.includes(o?.kind) ? o.kind : null;
  const fileId = Number(/^cf-\d+-(\d+)$/.exec(String(o?.slug || ""))?.[1]) || 0;
  if (!kind || !fileId) return { ok: false, error: "Fichier CurseForge inconnu." };
  if (kind === "dp" && !features.visible("dataPacks")) return pageOff;
  try {
    const f = await cfFileInfo(fileId);
    const sha1 = /^[0-9a-f]{40}$/i.test(f?.sha1 || "") ? f.sha1.toLowerCase() : null;
    const fileName = String(f?.fileName || "");
    if (!sha1 && !fileName) return { ok: false, error: "Fichier CurseForge introuvable." };
    if (!/\.zip$/i.test(fileName || ".zip")) return { ok: false, error: "Ce fichier CurseForge n'est pas un .zip." };
    shell.openExternal(safeModPageUrl(f?.pageUrl) || safeModPageUrl(o?.url) || `https://www.curseforge.com/minecraft/search?class=${CF_CLASS[kind]}`);
    const got = await watchDownloads(`content|${id}|${fileId}`, { sha1, size: Number(f?.fileLength) || null, fileName: fileName || null, ext: /\.zip$/i });
    if (!got) return { ok: true, found: false };
    const busy = packBusy(id);
    if (busy) return busy;
    const base = String(got.fileName || `cf-${fileId}.zip`).replace(/[^\w.+() \[\]!'&,-]/g, "_");
    const dir = path.join(browseDir(), `cf-${fileId}`);
    await fsp.mkdir(dir, { recursive: true });
    const copy = path.join(dir, base);
    await fsp.copyFile(got.file, copy);
    if ((await sha1Of(copy)) !== got.sha1) throw new Error("La copie du fichier a échoué, réessaie.");
    let out;
    if (kind === "w") out = await importMapFile(id, copy);
    else if (kind === "dp") out = { ok: true, ...(await liveSave.enqueue(() => playMode.addDatapack(String(id), { from: "file", slug: "", sourceFile: copy, worldKey: null }))) };
    else out = { ok: true, ...(await playMode.addContent(String(id), { kind, from: "file", slug: "", sourceFile: copy })) };
    // Installé : on le retire de Téléchargements, lui et ses doublons identiques, 30 s plus tard
    // (28/10 : le navigateur fait analyser le fichier par l'antivirus juste après le téléchargement,
    // et le retirer pendant l'analyse affichait « Échec, erreur de l'analyse antivirus »).
    const stem = base.replace(/\.zip$/i, "");
    setTimeout(async () => {
      for (const d of manualModsSearchDirs()) {
        for (const name of await fsp.readdir(d).catch(() => [])) {
          const file = path.join(d, name);
          if (file !== got.file && name.replace(/ \(\d+\)(\.zip)$/i, "$1") !== `${stem}.zip`) continue;
          if ((await sha1Of(file).catch(() => null)) !== got.sha1) continue;
          await fsp.unlink(file).catch(() => {});
        }
      }
    }, 30_000);
    sendAll("play:worldsChanged");
    return { ...out, found: true };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("myPack:openMapsPage", async (_event, mc) => {
  const v = /^[\w.+-]+$/.test(mc || "") ? mc : "";
  shell.openExternal(`https://www.curseforge.com/minecraft/search?class=worlds${v ? `&gameVersion=${encodeURIComponent(v)}` : ""}`);
  return { ok: true };
});
// Basculer une installation vanilla en version modée (28/10, preview validée par Rushi, Laboratoire
// « vanillaModded ») : pour lancer des shaders, ou charger un data pack dans tous les mondes. Seuls
// les mods qui existent sur Modrinth pour CETTE version de Minecraft (et leur chargeur) sont proposés.
const SWITCH_CHOICES = {
  sh: [
    { loader: "fabric", slug: "iris", mod: "Iris Shaders", with: ["sodium"], fr: "Le plus utilisé, va avec Sodium (plus d'images par seconde).", en: "The most used, comes with Sodium (more FPS)." },
    { loader: "neoforge", slug: "iris", mod: "Iris Shaders", with: ["sodium"], fr: "Si tu comptes ajouter des mods NeoForge plus tard.", en: "If you plan to add NeoForge mods later." },
    { loader: "forge", slug: "oculus", mod: "Oculus", with: ["embeddium"], fr: "Iris pour Forge.", en: "Iris for Forge." },
  ],
  dp: [
    { loader: "fabric", slug: "paxi", mod: "Paxi", with: [], fr: "Simple, charge aussi les packs de ressources.", en: "Simple, also loads resource packs." },
    { loader: "fabric", slug: "globalpacks", mod: "Global Packs", with: [], fr: "Alternative, mêmes fonctions.", en: "Alternative, same features." },
    { loader: "neoforge", slug: "paxi", mod: "Paxi", with: [], fr: "Si tu comptes ajouter des mods NeoForge plus tard.", en: "If you plan to add NeoForge mods later." },
    { loader: "forge", slug: "paxi", mod: "Paxi", with: [], fr: "Pour Forge.", en: "For Forge." },
  ],
};
const switchAllowed = (id) => {
  const v = playMode.getVersion(String(id || ""));
  return !!v && !v.pack && pageAllowed(id) && features.visible("vanillaModded");
};
ipcMain.handle("myPack:loaderOptions", async (_event, id, need) => {
  if (!switchAllowed(id)) return { ...pageOff, options: [] };
  const list = SWITCH_CHOICES[need === "dp" ? "dp" : "sh"];
  const mc = playMode.getVersion(String(id)).minecraftVersion;
  const fr = settingsStore.loadSettings().locale !== "en";
  try {
    const found = [];
    for (const c of list) {
      const ok = (await playPacks.mrVersions(c.slug, mc, c.loader).catch(() => [])).length > 0 && !!(await playPacks.latestLoaderVersion(c.loader, mc).catch(() => null));
      if (ok) found.push({ loader: c.loader, slug: c.slug, mod: c.mod, info: fr ? c.fr : c.en });
    }
    if (found[0]) found[0].rec = true;
    return { ok: true, options: found };
  } catch (error) {
    return { ...playError(error), options: [] };
  }
});
ipcMain.handle("myPack:switchToModded", async (_event, id, o) => {
  if (!switchAllowed(id)) return pageOff;
  const busy = packBusy(id);
  if (busy) return busy;
  const choice = Object.values(SWITCH_CHOICES).flat().find((c) => c.loader === o?.loader && c.slug === o?.mod);
  if (!choice) return { ok: false, error: "Choix inconnu." };
  try {
    const v = playMode.getVersion(String(id));
    const loaderVersion = await playPacks.latestLoaderVersion(choice.loader, v.minecraftVersion);
    await liveSave.enqueue(() => playMode.switchToModded(String(id), { loader: choice.loader, loaderVersion }));
    await playMode.addPackMods(String(id), [choice.slug, ...choice.with].map((slug) => ({ slug })), { deps: PLAY_DEPS });
    installVersionInBackground(String(id)).catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Version modée : préparation impossible (${error.message}).` }));
    sendAll("play:worldsChanged");
    return { ok: true };
  } catch (error) {
    return playError(error);
  }
});
// Shader sans mod de shaders : Iris (+ Sodium) pour Fabric/Quilt, Oculus (+ Embeddium) pour Forge.
const SHADER_LOADERS = { iris: ["iris", "sodium"], oculus: ["oculus", "embeddium"] };
ipcMain.handle("myPack:addShaderLoader", async (_event, id, which) => {
  if (!pageAllowed(id)) return pageOff;
  const busy = packBusy(id);
  if (busy) return busy;
  const slugs = SHADER_LOADERS[which];
  if (!slugs) return { ok: false, error: "Mod de shaders inconnu." };
  try {
    await playMode.addPackMods(String(id), slugs.map((slug) => ({ slug })), { deps: PLAY_DEPS });
    return { ok: true };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("myPack:searchDatapacks", async (_event, id, q) => {
  if (!pageAllowed(id) || !features.visible("dataPacks")) return { ...pageOff, packs: [] };
  try {
    const v = playMode.getVersion(String(id));
    return { ok: true, packs: await playPacks.searchContent("dp", String(q || ""), { mc: v.minecraftVersion, fr: settingsStore.loadSettings().locale !== "en" }) };
  } catch (error) {
    return { ...playError(error), packs: [] };
  }
});
ipcMain.handle("myPack:addDatapack", async (event, id, o) => {
  if (!pageAllowed(id) || !features.visible("dataPacks")) return pageOff;
  const busy = packBusy(id);
  if (busy) return busy;
  try {
    let sourceFile = null;
    if (o?.from === "cf") sourceFile = await cfContentDownload(o.slug);
    else if (o?.from !== "mr") {
      sourceFile = await pickZipFile(event, "Data pack (.zip)", "Data pack");
      if (!sourceFile) return { ok: false, cancelled: true };
    }
    const worldKey = typeof o?.worldKey === "string" && o.worldKey ? o.worldKey : null;
    const out = await liveSave.enqueue(() => playMode.addDatapack(String(id), { from: o?.from === "mr" ? "mr" : "file", slug: String(o?.slug || ""), sourceFile, worldKey }));
    return { ok: true, ...out };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("myPack:setDatapack", async (_event, id, file, o) => {
  if (!pageAllowed(id) || !features.visible("dataPacks")) return pageOff;
  const busy = packBusy(id);
  if (busy) return busy;
  try {
    // « Tous les mondes » sans chargeur : on ajoute d'abord Paxi ou Global Packs (Modrinth).
    const loader = o?.loader && playPacks.DP_LOADERS[o.loader];
    if (o?.auto && loader && !playMode.loaderOf(playMode.getVersion(String(id)))) await playMode.addPackMods(String(id), [{ slug: loader.slug }], { deps: PLAY_DEPS });
    const worlds = Array.isArray(o?.worlds) ? o.worlds.filter((k) => typeof k === "string").slice(0, 200) : [];
    return await liveSave.enqueue(() => playMode.setDatapack(String(id), String(file || ""), { worlds, auto: !!o?.auto }));
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("myPack:importMap", async (event, id) => {
  if (!pageAllowed(id)) return pageOff;
  const busy = packBusy(id);
  if (busy) return busy;
  try {
    const zip = await pickZipFile(event, "Map Minecraft (.zip)", "Map");
    if (!zip) return { ok: false, cancelled: true };
    return await importMapFile(id, zip);
  } catch (error) {
    return playError(error);
  }
});
// Map CurseForge (28/10, fenêtre « Ajouter un monde », Laboratoire « contentCf ») : même chemin
// qu'un .zip choisi par le joueur, après le téléchargement vérifié.
ipcMain.handle("myPack:addMap", async (_event, id, o) => {
  if (!pageAllowed(id)) return pageOff;
  const busy = packBusy(id);
  if (busy) return busy;
  try {
    return await importMapFile(id, await cfContentDownload(o?.slug));
  } catch (error) {
    return playError(error);
  }
});
async function importMapFile(id, zip) {
  {
    const w = await playMode.importMap(String(id), zip);
    // Première sauvegarde « Version d'origine » (comme un monde importé).
    const run = liveSave
      .enqueue(() => playMode.backupWorld(w.key, { reason: "import" }))
      .then((r) => r.backup && worldCloud.queueBackup(w.key, r.backup))
      .catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Première sauvegarde de « ${w.name} » impossible : ${error.message}` }))
      .finally(() => importBackups.delete(w.key));
    importBackups.set(w.key, run);
    sendAll("play:worldsChanged");
    // Un monde arrive dans une installation qui n'en avait pas : les data packs en attente y vont.
    if (features.visible("dataPacks")) await applyPendingDp(String(id));
    return { ok: true, name: w.name, key: w.key };
  }
}
// Data packs en attente du premier monde (28/10) : posés dans le plus récent, sauvegarde avant.
async function applyPendingDp(versionId) {
  const done = await liveSave.enqueue(() => playMode.applyPendingDatapacks(versionId)).catch((error) => {
    logStore.pushLog({ level: "warn", source: "launcher", message: `Data packs en attente : ${error.message}` });
    return [];
  });
  if (done.length) sendAll("play:dpApplied", done);
  return done;
}
// Explorateur de fichiers de la version (Laboratoire « packFiles »).
const filesGate = (id) => (pageAllowed(id) && features.visible("packFiles") ? null : pageOff);
const filesCall = (fn) => async (_event, id, rel, ...rest) => {
  const off = filesGate(id);
  if (off) return off;
  try {
    return await fn(String(id), String(rel || ""), ...rest);
  } catch (error) {
    return playError(error);
  }
};
ipcMain.handle("myPack:filesList", filesCall(async (id, rel) => ({ ok: true, entries: await playMode.filesList(id, rel) })));
ipcMain.handle("myPack:filesRead", filesCall((id, rel) => playMode.filesRead(id, rel)));
ipcMain.handle("myPack:filesWrite", filesCall((id, rel, text) => (packBusy(id) || playMode.filesWrite(id, rel, String(text ?? "")))));
ipcMain.handle("myPack:filesRename", filesCall((id, rel, name) => (packBusy(id) || playMode.filesRename(id, rel, name))));
ipcMain.handle("myPack:filesMkdir", filesCall((id, rel) => playMode.filesMkdir(id, rel)));
ipcMain.handle("myPack:filesTrash", filesCall(async (id, rel) => {
  const busy = packBusy(id);
  if (busy) return busy;
  if (!rel) return { ok: false, error: "Chemin refusé." };
  await shell.trashItem(playMode.filePath(id, rel));
  return { ok: true };
}));
// Audit du 01/11 : un .bat ou un .exe livré par un pack ne s'ouvre pas d'un simple clic. Windows ignore
// les points et espaces en fin de nom (« run.bat. ») : retirés avant de regarder l'extension.
const NEVER_OPEN = /\.(exe|bat|cmd|com|scr|pif|msi|msp|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|url|reg|cpl|jar|jnlp|dll|scf|inf|sh)$/i;
ipcMain.handle("myPack:filesOpenExternal", filesCall(async (id, rel) => {
  if (NEVER_OPEN.test(String(rel).replace(/[. ]+$/, ""))) return { ok: false, error: "Ce type de fichier ne s'ouvre pas depuis le launcher : il pourrait lancer un programme." };
  const err = await shell.openPath(playMode.filePath(id, rel));
  return err ? { ok: false, error: err } : { ok: true };
}));
ipcMain.handle("myPack:filesShow", filesCall(async (id, rel) => {
  const abs = playMode.filePath(id, rel);
  await fsp.mkdir(playMode.pageDir(id), { recursive: true });
  if (!rel) shell.openPath(abs);
  else shell.showItemInFolder(abs);
  return { ok: true };
}));

// --- Pack Omniscient : générer, exporter (Laboratoire « omniPack », « packExport ») ----------------
// Génération en arrière-plan : une seule à la fois, une version à la fois ; l'avancement est envoyé
// à toutes les fenêtres (« omniPack:job ») pour la petite carte de la page du pack.
let omniJob = null;
const omniJobView = () => (omniJob ? { baseId: omniJob.baseId, list: omniJob.list, results: omniJob.results, running: omniJob.running, done: omniJob.done, stopped: omniJob.stopped } : null);
ipcMain.handle("omniPack:targets", async (_event, id) => {
  try {
    return { ok: true, versions: await omniPack.targetVersions(String(id)) };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("omniPack:job", () => ({ ok: true, job: omniJobView() }));
ipcMain.handle("omniPack:generate", async (_event, id, o) => {
  if (omniJob && !omniJob.done) return { ok: false, error: "Une génération est déjà en cours." };
  const v = playMode.getVersion(String(id));
  if (!v) return { ok: false, error: "Cette version n'existe plus." };
  const targets = (Array.isArray(o?.targets) ? o.targets : []).filter((x) => typeof x === "string").slice(0, 80);
  const keep = (Array.isArray(o?.keep) ? o.keep : []).filter((x) => typeof x === "string").slice(0, 300);
  if (!targets.length) return { ok: false, error: "Choisis au moins une version." };
  omniJob = { baseId: v.id, list: targets, results: [], running: null, done: false, stopped: false, stop: false };
  const job = omniJob;
  const push = () => sendAll("omniPack:job", omniJobView());
  omniPack
    .generate(v.id, { targets, keep }, {
      deps: PLAY_DEPS,
      isStopped: () => job.stop,
      onEvent: (ev) => {
        if (ev.type === "run") job.running = ev.mc;
        if (ev.type === "done") {
          job.running = null;
          job.results.push({ mc: ev.mc, kind: ev.kind, miss: ev.miss || [], keepMiss: ev.keepMiss || [], added: ev.added || [], id: ev.id || null, noLoader: !!ev.noLoader, error: ev.error || null, stale: ev.stale || null });
        }
        if (ev.type === "end") {
          job.done = true;
          job.stopped = !!ev.stopped;
        }
        push();
      },
    })
    .catch((error) => {
      job.done = true;
      job.error = error.message;
      logStore.pushLog({ level: "warn", source: "launcher", message: `Pack Omniscient : génération impossible (${error.message}).` });
      push();
    })
    .finally(() => sendAll("play:worldsChanged"));
  push();
  return { ok: true };
});
ipcMain.handle("omniPack:stop", () => {
  if (omniJob && !omniJob.done) omniJob.stop = true;
  return { ok: true };
});
ipcMain.handle("omniPack:clearJob", () => {
  if (omniJob?.done) omniJob = null;
  return { ok: true };
});
ipcMain.handle("omniPack:exportPreview", async (_event, id) => {
  try {
    return { ok: true, ...(await omniPack.exportPreview(String(id))) };
  } catch (error) {
    return playError(error);
  }
});
async function saveDialog(event, { title, name, ext, label }) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const clean = String(name || "pack").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim().slice(0, 60) || "pack";
  const result = await dialog.showSaveDialog(win, { title, defaultPath: path.join(app.getPath("downloads"), `${clean}.${ext}`), filters: [{ name: label, extensions: [ext] }] });
  return result.canceled || !result.filePath ? null : result.filePath;
}
ipcMain.handle("omniPack:export", async (event, id, o) => {
  const v = playMode.getVersion(String(id));
  if (!v?.omni) return { ok: false, error: "Ce n'est pas un Pack Omniscient." };
  try {
    const out = await saveDialog(event, { title: "Exporter pour Omniscient", name: v.name || v.pack?.name || v.minecraftVersion, ext: "omnipack", label: "Pack Omniscient" });
    if (!out) return { ok: false, cancelled: true };
    const r = await omniPack.exportOmni(v.id, out, { parts: { ...(o?.parts || {}), ram: features.visible("packRam") && o?.parts?.ram !== false }, worlds: Array.isArray(o?.worlds) ? o.worlds : [] });
    shell.showItemInFolder(out);
    return { ok: true, name: path.basename(out), size: r.size, versions: r.versions };
  } catch (error) {
    return { ...playError(error), mods: error?.mods || null };
  }
});
ipcMain.handle("omniPack:exportFriend", async (event, id, o) => {
  if (!features.visible("packExport")) return pageOff;
  const v = playMode.getVersion(String(id));
  if (!v) return { ok: false, error: "Cette version n'existe plus." };
  try {
    // Menus d'ajout (31/10) : .mrpack ou .zip CurseForge, avec les .jar hors liens dans le fichier.
    const fresh = features.visible("addMenus");
    const zip = fresh && o?.format === "zip" && !!v.pack;
    const out = await saveDialog(event, zip ? { title: "Exporter pour un ami", name: v.name || v.pack?.name || v.minecraftVersion, ext: "zip", label: "Pack CurseForge" } : { title: "Exporter pour un ami", name: v.name || v.pack?.name || v.minecraftVersion, ext: "mrpack", label: "Pack Modrinth" });
    if (!out) return { ok: false, cancelled: true };
    const opts = { parts: o?.parts || {}, worlds: Array.isArray(o?.worlds) ? o.worlds : [], ramGB: features.visible("packRam") ? packRam.intGB(o?.ramGB) : null };
    const plan = fresh ? await omniPack.friendMods(v.id, { cfMatch: currentSession && features.visible("myPackCf") ? cfFingerprintMatch : null }) : null;
    const r = zip ? await omniPack.exportCfZip(v.id, out, { ...opts, plan }) : await omniPack.exportMrpack(v.id, out, { ...opts, plan });
    shell.showItemInFolder(out);
    return { ok: true, name: path.basename(out), size: r.size, manual: r.manual };
  } catch (error) {
    return playError(error);
  }
});
// Liste de l'export « Pour un ami » pour les deux formats (la fenêtre change de liste sans relire).
ipcMain.handle("omniPack:friendPlan", async (_event, id) => {
  if (!features.visible("packExport") || !features.visible("addMenus")) return pageOff;
  try {
    const cfOk = !!currentSession && features.visible("myPackCf");
    const plan = await omniPack.friendMods(String(id), { cfMatch: cfOk ? cfFingerprintMatch : null });
    return {
      ok: true,
      zipOk: !!plan.v.pack,
      cfChecked: cfOk,
      mods: plan.mods.map((x) => ({ name: x.name.slice(0, 80), source: x.source, file: x.file, mrpack: x.mrpack, zip: x.zip, page: x.page })),
    };
  } catch (error) {
    return playError(error);
  }
});
// Empreintes CurseForge → projet et fichier (route du site, notre clé). Map fingerprint → infos.
async function cfFingerprintMatch(fps) {
  const out = new Map();
  const list = [...new Set(fps.filter((x) => Number.isInteger(x) && x >= 0))];
  for (let i = 0; i < list.length; i += 500) {
    // Site injoignable : les mods restent « .jar dans le fichier », l'export ne casse pas.
    const data = await fetchJson(`${SITE_URL}/api/launcher/curseforge/fingerprints`, {
      method: "POST",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprints: list.slice(i, i + 500) }),
    }).catch(() => null);
    for (const m of Array.isArray(data?.matches) ? data.matches : []) {
      if (Number(m.projectId) > 0 && Number(m.fileId) > 0) out.set(Number(m.fingerprint), { projectId: Number(m.projectId), fileId: Number(m.fileId) });
    }
  }
  return out;
}

// --- Nouveaux menus d'ajout (31/10, preview validée par Rushi, Laboratoire « addMenus ») ----------
// Recherche (Modrinth en direct, CurseForge par le site avec notre clé), fiche d'un élément, et
// vérification avant « Créer une copie en … ». Le renderer ne reçoit que du texte et des liens https.
const ADD_KINDS = ["mods", "rp", "sh", "dp", "w", "mp"];
const addCfCache = new Map();
const forgeImg = (u) => {
  try {
    const url = new URL(String(u || ""));
    return url.protocol === "https:" && url.hostname === "media.forgecdn.net" ? url.href : null;
  } catch {
    return null;
  }
};
const httpsOnly = (u) => {
  try {
    const url = new URL(String(u || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.href.slice(0, 400) : null;
  } catch {
    return null;
  }
};
function cleanAv(av) {
  const out = {};
  for (const [k, vs] of Object.entries(av && typeof av === "object" ? av : {})) {
    if (!["mc", ...playPacks.LOADER_IDS].includes(k) || !Array.isArray(vs)) continue;
    out[k] = vs.filter((v) => /^\d+\.\d+(\.\d+)?$/.test(String(v))).slice(0, 300).map(String);
  }
  return out;
}
async function addCfSearch(kind, text, mc, loader) {
  const key = JSON.stringify([kind, text.toLowerCase(), mc, loader]);
  const hit = addCfCache.get(key);
  if (hit && Date.now() - hit.at < CF_SEARCH_CACHE_MS) return hit.items;
  let list;
  if (kind === "mods") {
    const params = new URLSearchParams({ q: text, all: "1" });
    if (mc) params.set("mc", mc);
    if (loader) params.set("loader", loader);
    list = (await fetchJson(`${SITE_URL}/api/launcher/curseforge/mods?${params}`, { headers: launcherAuthHeaders() }))?.mods;
  } else if (kind === "mp") {
    const params = new URLSearchParams(text ? { q: text } : {});
    list = ((await fetchJson(`${SITE_URL}/api/launcher/curseforge/modpacks?${params}`, { headers: launcherAuthHeaders() }))?.packs || []).map((p) => ({ ...p, projectId: p.id }));
  } else {
    const params = new URLSearchParams({ kind, q: text, mc: String(mc || ""), all: "1" });
    list = (await fetchJson(`${SITE_URL}/api/launcher/curseforge/content?${params}`, { headers: launcherAuthHeaders() }))?.items;
  }
  const items = (Array.isArray(list) ? list : []).slice(0, 30).map((x) => {
    const files = {};
    for (const [k, f] of Object.entries(x.files && typeof x.files === "object" ? x.files : {}).slice(0, 400)) {
      if (/^[a-z]+\|\d+\.\d+(\.\d+)?$/.test(k) && Number(f?.fileId) > 0) files[k] = { fileId: Number(f.fileId), fileName: typeof f.fileName === "string" ? f.fileName.slice(0, 160) : null };
    }
    return {
      src: "cf",
      id: String(Number(x.projectId) || 0),
      name: String(x.name || "?").slice(0, 80),
      author: String(x.author || "").slice(0, 60),
      desc: String(x.summary || "").slice(0, 300),
      dl: Number(x.downloads) || 0,
      icon: forgeImg(x.iconUrl),
      av: cleanAv(x.av),
      files,
      blocked: !!x.blocked,
      images: (Array.isArray(x.images) ? x.images : []).map(forgeImg).filter(Boolean).slice(0, 3),
      updated: typeof x.updated === "string" ? x.updated : null,
      page: safeModPageUrl(x.websiteUrl || x.pageUrl),
      fileId: Number(x.fileId) || null,
      fileName: typeof x.fileName === "string" ? x.fileName.slice(0, 160) : null,
      filePage: safeModPageUrl(x.pageUrl),
      links: { source: httpsOnly(x.sourceUrl), wiki: httpsOnly(x.wikiUrl), issues: httpsOnly(x.issuesUrl) },
    };
  });
  if (addCfCache.size >= 60) addCfCache.delete(addCfCache.keys().next().value);
  addCfCache.set(key, { at: Date.now(), items });
  return items;
}
ipcMain.handle("addMenu:search", async (_event, o) => {
  if (!features.visible("addMenus")) return { ...pageOff, items: [] };
  const kind = ADD_KINDS.includes(o?.kind) ? o.kind : null;
  if (!kind) return { ok: false, error: "Type de contenu inconnu.", items: [] };
  const text = String(o?.q || "").trim().slice(0, 80);
  const mc = /^\d+\.\d+(\.\d+)?$/.test(String(o?.mc || "")) ? String(o.mc) : null;
  const loader = playPacks.LOADER_IDS.includes(o?.loader) ? o.loader : null;
  try {
    if (o?.src === "cf") {
      const allowed = kind === "mods" ? features.visible("myPackCf") : kind === "mp" ? features.visible("packBrowse") : features.visible("contentCf");
      if (!allowed) return { ok: false, code: "feature_off", items: [] };
      if (!currentSession) return { ok: false, code: "signed_out", error: "Connecte-toi avec ton compte Microsoft : CurseForge passe par le site Omniscient.", items: [] };
      return { ok: true, items: await addCfSearch(kind, text, mc, loader) };
    }
    if (kind === "w") return { ok: true, items: [] }; // Modrinth n'a pas de maps.
    return { ok: true, ...(await playPacks.addSearch(kind, text, { mc, loader, offset: o?.offset })) };
  } catch (error) {
    return { ...playError(error), items: [] };
  }
});
ipcMain.handle("addMenu:sheet", async (_event, o) => {
  if (!features.visible("addMenus")) return pageOff;
  try {
    const kind = ADD_KINDS.includes(o?.kind) ? o.kind : "mods";
    const mc = /^\d+\.\d+(\.\d+)?$/.test(String(o?.mc || "")) ? String(o.mc) : null;
    const loader = playPacks.LOADER_IDS.includes(o?.loader) ? o.loader : null;
    return { ok: true, sheet: await playPacks.addSheet(kind, String(o?.id || ""), { mc, loader }) };
  } catch (error) {
    return playError(error);
  }
});
// Avant « Créer une copie en … » : quels mods du pack existent pour le nouveau chargeur et la
// nouvelle version. Modrinth : par l'empreinte du fichier (une requête). CurseForge et mods perso :
// « à vérifier » (copiés, le joueur les retrouve dans « Corriger le pack »).
ipcMain.handle("addMenu:copyCheck", async (_event, id, o) => {
  if (!features.visible("addMenus") || !pageAllowed(id)) return pageOff;
  try {
    const v = playMode.getVersion(String(id));
    if (!v?.pack) return { ok: false, error: "Ce pack n'a pas de mods." };
    const mc = /^\d+\.\d+(\.\d+)?$/.test(String(o?.mc || "")) ? String(o.mc) : null;
    const loader = playPacks.LOADER_IDS.includes(o?.loader) ? o.loader : null;
    if (!mc || !loader) return { ok: false, error: "Version invalide." };
    const mods = (v.mods || []).filter((m) => !m.auto);
    const found = await playPacks.copyCheck(mods.filter((m) => m.source === "mr" && m.file?.sha1).map((m) => m.file.sha1), { mc, loader });
    return {
      ok: true,
      mods: mods.map((m) => {
        const hit = m.source === "mr" && m.file?.sha1 ? found.get(m.file.sha1) : null;
        return { id: m.id, name: String(m.name || m.id).slice(0, 80), source: m.source === "cf" ? "cf" : m.source === "mr" ? "mr" : "local", ok: m.source === "mr" ? !!hit : null, projectId: hit?.projectId || m.projectId || null, version: hit?.version || null, cf: m.source === "cf" ? { projectId: m.projectId || null, pageUrl: m.cf?.pageUrl || null } : null };
      }),
    };
  } catch (error) {
    return playError(error);
  }
});
// Liens donnés par l'auteur dans une fiche (page, don, code source, Discord) : https seulement.
ipcMain.handle("addMenu:openLink", (_event, u) => {
  const url = httpsOnly(u);
  if (!url) return { ok: false };
  shell.openExternal(url);
  return { ok: true };
});

// --- Importer un export CurseForge (.zip « Exporter le profil ») avec ses mondes -------------------
// Comme les packs des serveurs : les mods dont l'auteur autorise le téléchargement passent par le
// site ; ceux qui ont exactement le même fichier sur Modrinth sont pris là ; les autres, le joueur les
// télécharge (« Ouvrir la page »). Le .zip n'est jamais modifié.
const cfReads = new Map();
// Pack Modrinth (.mrpack, 27/10) : tout vient de Modrinth (ou GitHub/GitLab, comme le prévoit le
// format), aucun mod à télécharger à la main, pas besoin du site.
const PACK_EXT = /\.(zip|mrpack|omnipack)$/i;
ipcMain.handle("cfPack:pickZip", async (event, kind) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  // 27/10 (Rushi) : chaque carte ne montre que son type de fichier (.omnipack, .mrpack ou .zip).
  const k = kind === "omni" && features.visible("omniPack") ? "omni" : kind === "mr" && features.visible("mrImport") ? "mr" : "cf";
  const filter = { omni: { name: "Pack Omniscient", extensions: ["omnipack"] }, mr: { name: "Pack Modrinth", extensions: ["mrpack"] }, cf: { name: "Export CurseForge", extensions: ["zip"] } }[k];
  const result = await dialog.showOpenDialog(win, {
    title: { omni: "Pack Omniscient (.omnipack)", mr: "Pack Modrinth (.mrpack)", cf: "Export CurseForge (.zip)" }[k],
    defaultPath: manualModsSearchDirs()[0],
    filters: [filter],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
  // Le fichier choisi décide, pas la carte cliquée (« le launcher reconnaît le fichier tout seul »).
  const found = await playPacks.packKindOf(result.filePaths[0]).catch(() => null);
  return { ok: true, path: result.filePaths[0], kind: found || k };
});
// Logo d'un .mrpack publié sur Modrinth (27/10) : null si introuvable ou hors ligne. PNG et JPEG
// sont réduits à 128 px ; WebP et GIF (que nativeImage ne lit pas) sont gardés tels quels s'ils sont petits.
async function mrpackIcon(zip) {
  try {
    const buf = await playPacks.mrPackIcon(await sha1Of(zip));
    if (!buf) return null;
    const head = buf.subarray(0, 12).toString("latin1");
    if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return buf.length <= 150_000 ? `data:image/webp;base64,${buf.toString("base64")}` : null;
    if (head.startsWith("GIF8")) return buf.length <= 150_000 ? `data:image/gif;base64,${buf.toString("base64")}` : null;
    const img = nativeImage.createFromBuffer(buf);
    if (img.isEmpty()) return null;
    const { width } = img.getSize();
    return (width > 128 ? img.resize({ width: 128, quality: "best" }) : img).toDataURL();
  } catch {
    return null;
  }
}
async function readMrpackForImport(zip, src) {
  if (!features.visible("mrImport")) return { ok: false, error: "L'import des packs Modrinth est coupé pour le moment." };
  const pack = await playPacks.readMrpack(zip, { readLevel: readLevelBuffer });
  // Pack sans mods (vanilla, ex. « Pour un ami » d'une version vanilla, 27/10) : accepté.
  if (!pack.loader && (pack.mods.length || pack.overrideJars.length)) return { ok: false, error: "Ce pack n'a pas de chargeur de mods connu (NeoForge, Forge, Fabric ou Quilt)." };
  const id = crypto.randomUUID();
  const icon = await mrpackIcon(zip);
  rememberCapped(cfReads, id, { kind: "mr", zip, pack, mods: pack.mods, worldKey: typeof src?.worldKey === "string" ? src.worldKey : null, versionId: null, icon }, 20);
  return {
    ok: true,
    id,
    from: "mrpack",
    path: zip,
    name: pack.name,
    minecraftVersion: pack.minecraftVersion,
    loader: pack.loader,
    loaderVersion: pack.loaderVersion,
    modCount: pack.mods.length + pack.overrideJars.length,
    // Mods déjà dans le fichier du pack (overrides/mods) : copiés, pas téléchargés (27/10).
    packedJars: pack.overrideJars.length,
    manual: [],
    configFiles: pack.configFiles,
    resourcepacks: pack.resourcepacks,
    shaders: pack.shaders,
    worlds: pack.worlds,
    icon,
    recommendedRamGB: pack.recommendedRamGB || null,
  };
}
// Erreurs d'import notées dans le journal (02/11 : Rushi voyait « fichier non trouvé » sans capture, et
// rien n'était écrit dans les logs). Annulations et sources coupées : pas notées.
function importHandle(channel, label, fn) {
  ipcMain.handle(channel, async (...args) => {
    const r = await fn(...args);
    if (r && r.ok === false && !r.cancelled && r.code !== "feature_off") {
      logStore.pushLog({ level: "warn", source: "launcher", message: `Import de pack (${label}) : ${r.error || r.code || "erreur inconnue"}` });
    }
    return r;
  });
}
importHandle("cfPack:read", "lecture du fichier", async (_event, src) => {
  try {
    const zip = String(src?.zip || "");
    if (!PACK_EXT.test(zip) || !fs.existsSync(zip)) return { ok: false, error: "Fichier introuvable." };
    const kind = await playPacks.packKindOf(zip);
    if (kind === "mr") return await readMrpackForImport(zip, src);
    if (kind === "omni") {
      // Pack Omniscient (.omnipack, 27/10) : toutes ses versions sont installées.
      if (!features.visible("omniPack")) return { ok: false, error: "Les Packs Omniscient sont coupés pour le moment." };
      const d = await omniPack.describeForImport(zip);
      const id = crypto.randomUUID();
      rememberCapped(cfReads, id, { kind: "omni", zip, pack: { ...d, worlds: d.worlds }, mods: [], worldKey: null, versionId: null }, 20);
      const { json, ...view } = d;
      return { ok: true, id, from: "omnipack", path: zip, ...view, manual: [], icon: null };
    }
    if (!kind) return { ok: false, error: "Ce fichier n'est ni un pack Modrinth (.mrpack) ni un export CurseForge (.zip)." };
    if (!features.visible("cfImport")) return { ok: false, error: "Ce fichier n'est pas un pack Modrinth (.mrpack). Sur la page du pack Modrinth : « Télécharger »." };
    const pack = await playPacks.readCfExport(zip, { readLevel: readLevelBuffer });
    if (!pack.loader) return { ok: false, error: "Ce pack n'a pas de chargeur de mods connu (NeoForge, Forge, Fabric ou Quilt)." };
    if (!currentSession) return { ok: false, error: "Connecte-toi avec ton compte Microsoft d'abord : la liste des mods passe par le site Omniscient." };
    const infos = new Map();
    const ids = pack.files.map((f) => f.fileID);
    // Audit du 28/10 (correctif 7) : lots de 500, le maximum accepte par le site (MAX_FILE_IDS de
    // /api/launcher/curseforge/files) ; avant 100 (ATM10, 414 mods : 5 appels au lieu de 1).
    for (let i = 0; i < ids.length; i += 500) {
      const data = await fetchJson(`${SITE_URL}/api/launcher/curseforge/files`, {
        method: "POST",
        headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: ids.slice(i, i + 500) }),
      });
      for (const f of data?.files || []) infos.set(f.id, f);
    }
    const mods = [];
    const blocked = [];
    for (const f of pack.files) {
      const info = infos.get(f.fileID);
      const name = (typeof info?.modName === "string" && info.modName) || info?.fileName || `fichier ${f.fileID}`;
      const mod = {
        id: `cf-${f.projectID}`,
        name: String(name).slice(0, 80),
        source: "cf",
        projectId: f.projectID,
        version: info?.fileName || "",
        file: info ? { filename: path.basename(info.fileName), url: info.downloadUrl || null, sha1: info.sha1 || null, size: info.fileLength || null } : null,
        cf: { fileID: f.fileID, pageUrl: safeModPageUrl(info?.pageUrl) || `https://www.curseforge.com/projects/${f.projectID}`, got: info?.downloadUrl ? "api" : null },
        auto: false,
        by: [],
        on: true,
      };
      mods.push(mod);
      if (!info?.downloadUrl && mod.file) blocked.push({ mod, entry: { sha1: mod.file.sha1, size: mod.file.size } });
    }
    // Même fichier (empreinte et taille) sur Modrinth : pris là-bas, comme pour les packs des serveurs.
    await findOnModrinth(blocked).catch(() => 0);
    for (const b of blocked) {
      if (!b.ready) continue;
      b.mod.file.url = b.entry.url;
      b.mod.cf.got = "api";
    }
    const manual = mods.filter((m) => !m.file?.url);
    const id = crypto.randomUUID();
    const icon = browseIcons.get(zip) || null;
    rememberCapped(cfReads, id, { zip, pack, mods, worldKey: typeof src?.worldKey === "string" ? src.worldKey : null, versionId: null, icon }, 20);
    return {
      ok: true,
      id,
      from: "zip",
      path: zip,
      name: pack.name,
      minecraftVersion: pack.minecraftVersion,
      loader: pack.loader,
      loaderVersion: pack.loaderVersion,
      modCount: mods.length + pack.overrideJars.length,
      packedJars: pack.overrideJars.length,
      manual: manual.map((m) => ({ packId: id, modId: m.id, name: m.name, fileName: m.file?.filename || "", pageUrl: m.cf.pageUrl })),
      configFiles: pack.configFiles,
      resourcepacks: pack.resourcepacks,
      shaders: pack.shaders,
      worlds: pack.worlds,
      icon,
      recommendedRamGB: pack.recommendedRamGB || null,
    };
  } catch (error) {
    return playError(error);
  }
});
// --- « Un pack existant » (28/10, preview B validée par Rushi, Laboratoire « packBrowse ») ---------
// Chercher un modpack public (Modrinth, CurseForge, FTB) puis le préparer en fichier de pack local :
// la suite est exactement l'import d'un fichier (cfPack:read puis cfPack:install), avec les mêmes
// règles. Modrinth : le .mrpack de cdn.modrinth.com. CurseForge : le .zip du pack, seulement si son
// auteur autorise les autres launchers (lien donné par le site) ; ses mods passent ensuite par la
// route du site et les mods bloqués se prennent à la main. FTB : la liste de la version (API publique
// de FTB) est rangée en export CurseForge (manifest.json + overrides/) : les mods CurseForge passent
// donc aussi par le site, jamais par les liens edge.forgecdn.net que donne FTB ; les autres fichiers
// viennent seulement des serveurs de FTB, SHA-1 vérifié.
const browseIcons = new Map();
const browseDir = () => path.join(app.getPath("userData"), "pack-downloads");
const browseOk = (src) => features.visible("packBrowse") && (src === "mr" ? features.visible("mrImport") : src === "cf" || src === "ftb" ? features.visible("cfImport") : false);
const BROWSE_OFF = { ok: false, code: "feature_off", error: "Cette source de packs est coupée pour le moment." };
const FTB_FILE_HOSTS = new Set(["files.feed-the-beast.com", "cdn.feed-the-beast.com"]);
const BROWSE_LOADERS = ["neoforge", "forge", "fabric", "quilt"];
// Fichiers préparés il y a plus d'un jour : retirés (un import se fait juste après la préparation).
// 02/11 (Rushi : « fichier non trouvé » de temps en temps) : le nettoyage tournait EN MÊME TEMPS que
// la préparation. Une version déjà téléchargée il y a plus d'un jour était gardée (même empreinte, donc
// pas retéléchargée, date inchangée) puis effacée par le nettoyage juste après : « Fichier introuvable. »
// Maintenant : le nettoyage est attendu avant de télécharger, il saute les fichiers en cours de
// préparation ou en attente d'import, et un fichier réutilisé reprend la date du jour.
const browseBusy = new Set();
const browseInUse = (abs) => {
  const hit = (z) => typeof z === "string" && (z === abs || z.startsWith(abs + path.sep));
  for (const z of browseBusy) if (hit(z)) return true;
  for (const j of cfReads.values()) if (hit(j?.zip)) return true;
  return false;
};
async function touchFile(file) {
  const now = new Date();
  await fs.promises.utimes(file, now, now).catch(() => {});
}
async function cleanBrowseDir() {
  const dir = browseDir();
  for (const name of await fs.promises.readdir(dir).catch(() => [])) {
    const abs = path.join(dir, name);
    if (browseInUse(abs)) continue;
    const st = await fs.promises.stat(abs).catch(() => null);
    if (st && Date.now() - st.mtimeMs > 24 * 3600_000) await fs.promises.rm(abs, { recursive: true, force: true }).catch(() => {});
  }
}
// Logo d'un pack (lien d'image vérifié) en data: URL, comme mrpackIcon.
async function browseIconData(u) {
  try {
    const url = new URL(String(u || ""));
    if (url.protocol !== "https:" || !["cdn.modrinth.com", "media.forgecdn.net", "cdn.feed-the-beast.com"].includes(url.hostname)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 1024 * 1024) return null;
    const head = buf.subarray(0, 12).toString("latin1");
    if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return buf.length <= 150_000 ? `data:image/webp;base64,${buf.toString("base64")}` : null;
    if (head.startsWith("GIF8")) return buf.length <= 150_000 ? `data:image/gif;base64,${buf.toString("base64")}` : null;
    const img = nativeImage.createFromBuffer(buf);
    if (img.isEmpty()) return null;
    const { width } = img.getSize();
    return (width > 128 ? img.resize({ width: 128, quality: "best" }) : img).toDataURL();
  } catch {
    return null;
  }
}
const browseMc = (v) => (typeof v === "string" && /^\d+\.\d+(\.\d+)?$/.test(v) ? v : "");
ipcMain.handle("packBrowse:sources", () => ({ ok: true, on: features.visible("packBrowse"), mr: browseOk("mr"), cf: browseOk("cf"), ftb: browseOk("ftb") }));
ipcMain.handle("packBrowse:search", async (_event, src, query, opts) => {
  if (!browseOk(src)) return { ...BROWSE_OFF, packs: [] };
  const text = String(query || "").trim().slice(0, 80);
  const mc = browseMc(opts?.mc);
  const loader = BROWSE_LOADERS.includes(opts?.loader) ? opts.loader : "";
  try {
    if (src === "mr") return { ok: true, packs: await playPacks.searchModrinthPacks(text, { mc, loader }) };
    if (src === "ftb") return { ok: true, packs: await playPacks.searchFtbPacks(text, { mc, loader }) };
    if (!currentSession) return { ok: false, code: "signed_out", error: "Connecte-toi avec ton compte Microsoft : la recherche CurseForge passe par le site Omniscient.", packs: [] };
    const params = new URLSearchParams();
    if (text) params.set("q", text);
    if (mc) params.set("mc", mc);
    if (loader) params.set("loader", loader);
    const data = await fetchJson(`${SITE_URL}/api/launcher/curseforge/modpacks?${params}`, { headers: launcherAuthHeaders() });
    const img = (u) => {
      try {
        const url = new URL(String(u || ""));
        return url.protocol === "https:" && url.hostname === "media.forgecdn.net" ? url.href : null;
      } catch {
        return null;
      }
    };
    const packs = (Array.isArray(data?.packs) ? data.packs : []).slice(0, 30).map((p) => ({
      src: "cf",
      id: String(Number(p.id) || 0),
      name: String(p.name || "?").slice(0, 80),
      author: String(p.author || "").slice(0, 60),
      desc: String(p.summary || "").slice(0, 300),
      dl: Number(p.downloads) || 0,
      icon: img(p.iconUrl),
      mc: browseMc(p.minecraftVersion) || null,
      loader: BROWSE_LOADERS.includes(p.loader) ? p.loader : null,
      page: safeModPageUrl(p.pageUrl),
      // Menus d'ajout (31/10) : versions où le pack existe et images, pour sa fiche.
      av: cleanAv(p.av),
      images: (Array.isArray(p.images) ? p.images : []).map(forgeImg).filter(Boolean).slice(0, 3),
    }));
    return { ok: true, packs };
  } catch (error) {
    return { ...playError(error), packs: [] };
  }
});
// Versions proposées dans la fiche d'un pack (Modrinth et FTB ; CurseForge : sa dernière version).
ipcMain.handle("packBrowse:versions", async (_event, src, id) => {
  if (!browseOk(src)) return { ...BROWSE_OFF, versions: [] };
  try {
    if (src === "mr") return { ok: true, versions: (await playPacks.modrinthPackVersions(String(id || ""))).map(({ file, ...v }) => ({ ...v, size: file.size || null })) };
    if (src === "ftb") return { ok: true, versions: (await playPacks.ftbPack(String(id || "")))?.versions || [] };
    return { ok: true, versions: [] };
  } catch (error) {
    return { ...playError(error), versions: [] };
  }
});
async function ftbAsCurseforgeExport(packId, versionId, progress) {
  const ver = await playPacks.ftbVersionFiles(packId, versionId);
  if (!ver.mc) throw new Error("Ce pack FTB n'indique pas sa version de Minecraft.");
  let loaderVersion = ver.loaderVersion || "";
  if (ver.loader === "forge" && loaderVersion.startsWith(`${ver.mc}-`)) loaderVersion = loaderVersion.slice(ver.mc.length + 1);
  const pack = await playPacks.ftbPack(packId).catch(() => null);
  const work = path.join(browseDir(), `ftb-${Number(packId)}-${Number(versionId)}`);
  await fs.promises.rm(work, { recursive: true, force: true });
  await fs.promises.mkdir(work, { recursive: true });
  const files = [];
  const entries = [];
  let skipped = 0;
  for (const f of ver.files) {
    if (!f || f.serveronly || !f.name) continue;
    const rel = path.posix.normalize(`${String(f.path || ".").replace(/\\/g, "/")}/${String(f.name)}`).replace(/^(\.\/)+/, "");
    if (!rel || rel.startsWith("../") || path.posix.isAbsolute(rel)) continue;
    const cfFile = Number(f.curseforge?.file);
    if (f.curseforge && Number.isInteger(cfFile) && cfFile > 0) {
      // Mods CurseForge : par le site, comme un export CurseForge. Packs de ressources ou shaders
      // CurseForge du pack (pas des mods) : laissés de côté, le pack se lance sans eux.
      if (f.type === "mod") files.push({ projectID: Number(f.curseforge.project) || 0, fileID: cfFile, required: true });
      else skipped++;
      continue;
    }
    let host = null;
    try {
      const url = new URL(f.url);
      if (url.protocol === "https:") host = url.hostname;
    } catch {
      host = null;
    }
    if (!host || !FTB_FILE_HOSTS.has(host)) {
      skipped++;
      continue;
    }
    entries.push({ path: `overrides/${rel}`, url: f.url, sha1: /^[0-9a-f]{40}$/i.test(f.sha1 || "") ? f.sha1.toLowerCase() : null, size: Number.isInteger(f.size) && f.size > 0 ? f.size : null });
  }
  await installFiles({
    entries,
    instanceDir: work,
    previousFiles: [],
    onProgress: (p) => {
      if (p?.type === "mods-bytes") progress({ step: "ftb", bytes: p.bytes, total: p.totalBytes });
      else if (p?.type === "mods") progress({ step: "ftb", files: p.task, filesOf: entries.length, bytes: p.bytes, total: p.totalBytes });
    },
  });
  const manifest = {
    minecraft: { version: ver.mc, modLoaders: ver.loader ? [{ id: `${ver.loader}-${loaderVersion}`, primary: true }] : [] },
    manifestType: "minecraftModpack",
    manifestVersion: 1,
    name: (pack?.name || "Pack FTB").slice(0, 60),
    version: ver.name.slice(0, 40),
    author: pack?.author || "FTB",
    files,
    overrides: "overrides",
  };
  const manifestFile = path.join(work, "manifest.json");
  await fs.promises.writeFile(manifestFile, JSON.stringify(manifest));
  const zip = path.join(browseDir(), `ftb-${Number(packId)}-${Number(versionId)}.zip`);
  progress({ step: "zip" });
  await writeZip(zip, [{ abs: manifestFile, rel: "manifest.json", mtimeMs: Date.now() }, ...entries.map((e) => ({ abs: path.join(work, e.path), rel: e.path, mtimeMs: Date.now() }))]);
  await fs.promises.rm(work, { recursive: true, force: true }).catch(() => {});
  if (skipped) logStore.pushLog({ level: "info", source: "launcher", message: `Pack FTB ${manifest.name} : ${skipped} fichier(s) hors mods non repris (packs de ressources CurseForge ou hôte inconnu).` });
  return { zip, icon: pack?.icon || null, skipped };
}
importHandle("packBrowse:prepare", "téléchargement", async (event, src, id, versionId, extra) => {
  if (!browseOk(src)) return BROWSE_OFF;
  const progress = (step) => !event.sender.isDestroyed() && event.sender.send("packBrowse:progress", step);
  try {
    await fs.promises.mkdir(browseDir(), { recursive: true });
    await cleanBrowseDir().catch(() => {});
    let zip;
    let iconUrl = typeof extra?.icon === "string" ? extra.icon : null;
    if (src === "mr") {
      const v = (await playPacks.modrinthPackVersions(String(id || ""))).find((x) => x.id === String(versionId || ""));
      if (!v) return { ok: false, error: "Cette version du pack n'existe plus sur Modrinth." };
      const name = `mr-${v.id}.mrpack`;
      zip = path.join(browseDir(), name);
      browseBusy.add(zip);
      try {
        await installFiles({
          entries: [{ path: name, url: v.file.url, sha1: v.file.sha1, sha512: v.file.sha512, size: v.file.size }],
          instanceDir: browseDir(),
          previousFiles: [],
          onProgress: (p) => p?.type === "mods-bytes" && progress({ step: "dl", bytes: p.bytes, total: p.totalBytes }),
        });
        await touchFile(zip);
      } finally {
        browseBusy.delete(zip);
      }
      iconUrl = null; // retrouvé par son SHA-1 à la lecture (mrpackIcon)
    } else if (src === "cf") {
      if (!currentSession) return { ok: false, error: "Connecte-toi avec ton compte Microsoft d'abord : CurseForge passe par le site Omniscient." };
      const params = new URLSearchParams({ id: String(Number(id) || 0), name: String(extra?.name || "").slice(0, 80) });
      let data;
      try {
        data = await fetchJson(`${SITE_URL}/api/launcher/curseforge/modpacks?${params}`, { headers: launcherAuthHeaders() });
      } catch (error) {
        return { ok: false, code: "no_download", error: error instanceof Error ? error.message : String(error) };
      }
      const f = data?.file;
      let okUrl = false;
      try {
        const url = new URL(f?.downloadUrl || "");
        okUrl = url.protocol === "https:" && url.hostname.endsWith(".forgecdn.net") && !url.username;
      } catch {
        okUrl = false;
      }
      if (!f || !okUrl) return { ok: false, code: "no_download", error: "L'auteur de ce pack ne permet pas de le télécharger depuis un autre launcher." };
      const name = `cf-${Number(f.id) || 0}.zip`;
      zip = path.join(browseDir(), name);
      browseBusy.add(zip);
      try {
        await installFiles({
          entries: [{ path: name, url: f.downloadUrl, sha1: /^[0-9a-f]{40}$/i.test(f.sha1 || "") ? f.sha1.toLowerCase() : null, size: Number(f.fileLength) || null }],
          instanceDir: browseDir(),
          previousFiles: [],
          onProgress: (p) => p?.type === "mods-bytes" && progress({ step: "dl", bytes: p.bytes, total: p.totalBytes }),
        });
        await touchFile(zip);
      } finally {
        browseBusy.delete(zip);
      }
    } else {
      const ftbBase = path.join(browseDir(), `ftb-${Number(id)}-${Number(versionId)}`);
      browseBusy.add(ftbBase);
      browseBusy.add(`${ftbBase}.zip`);
      try {
        const r = await ftbAsCurseforgeExport(id, versionId, progress);
        zip = r.zip;
        iconUrl = r.icon || iconUrl;
      } finally {
        browseBusy.delete(ftbBase);
        browseBusy.delete(`${ftbBase}.zip`);
      }
    }
    if (iconUrl) {
      const icon = await browseIconData(iconUrl);
      if (icon) rememberCapped(browseIcons, zip, icon, 30);
    }
    return { ok: true, path: zip, kind: src === "mr" ? "mr" : "cf" };
  } catch (error) {
    return playError(error);
  }
});
ipcMain.handle("packBrowse:openPage", (_event, u) => {
  try {
    const url = new URL(String(u || ""));
    if (url.protocol === "https:" && ["modrinth.com", "www.curseforge.com", "www.feed-the-beast.com"].includes(url.hostname)) shell.openExternal(url.href);
  } catch {
    /* lien refusé */
  }
  return { ok: true };
});
// Progression détaillée des imports (27/10, preview « Progression des imports » C + B validée par
// Rushi) : chaque étape reçoit fichiers et octets faits, le fichier en cours et la part de tout
// l'import déjà faite (`overall`, 0 à 1, en octets). Envoyée au plus toutes les 150 ms.
function importMeter(send, totalBytes) {
  const parts = new Map();
  let last = 0;
  const overall = () => {
    if (!(totalBytes > 0)) return null;
    let done = 0;
    for (const v of parts.values()) done += v;
    return Math.min(0.99, done / totalBytes);
  };
  return {
    set(key, bytes) {
      parts.set(key, bytes);
    },
    add(key, bytes) {
      parts.set(key, (parts.get(key) || 0) + bytes);
    },
    send(step, force = false) {
      const now = Date.now();
      if (!force && now - last < 150) return;
      last = now;
      send({ ...step, overall: overall() });
    },
  };
}
// Étape de la fenêtre d'import d'un fichier extrait du pack (chemin dans le dossier du jeu).
const IMPORT_STEP_ORDER = ["packed", "cfg", "rp", "sh", "world"];
function importStepOf(rel) {
  const low = String(rel).toLowerCase();
  if (low.startsWith("mods/")) return "packed";
  if (low.startsWith("saves/")) return "world";
  if (low.startsWith("resourcepacks/")) return "rp";
  if (low.startsWith("shaderpacks/")) return "sh";
  return "cfg";
}
importHandle("cfPack:install", "installation", async (event, id, opts) => {
  const job = cfReads.get(String(id || ""));
  if (!job) return { ok: false, error: "Relis le pack d'abord." };
  if (job.versionId) return { ok: false, error: "Ce pack est déjà installé." };
  const busy = playGameBusy();
  if (busy) return busy;
  const progress = (step) => !event.sender.isDestroyed() && event.sender.send("cfPack:progress", { id, ...step });
  const parts = Array.isArray(opts?.parts) ? opts.parts.filter((x) => ["mods", "cfg", "rp", "sh"].includes(x)) : [];
  const folders = (Array.isArray(opts?.worlds) ? opts.worlds : []).filter((f) => job.pack.worlds.some((w) => w.folder === f));
  try {
    if (job.kind === "omni") {
      const r = await omniPack.installOmni(job.zip, { worlds: folders, parts: [...parts, "dp"], onProgress: (p) => p.detail && progress({ step: "omcopy", ...p.detail }) });
      job.versionId = r.created[0]?.id || null;
      if (opts?.ram && features.visible("packRam")) for (const c of r.created) await playMode.setVersionRam(c.id, opts.ram).catch(() => false);
      for (const c of r.created) {
        for (const w of c.worlds) {
          const run = playMode
            .backupWorld(w.key, { reason: "import" })
            .then((b) => b.backup && worldCloud.queueBackup(w.key, b.backup))
            .catch(() => {})
            .finally(() => importBackups.delete(w.key));
          importBackups.set(w.key, run);
        }
        installVersionInBackground(c.id).catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Pack Omniscient : préparation impossible (${error.message}).` }));
      }
      progress({ step: "omcopy", n: r.created.length, done: true });
      sendAll("play:worldsChanged");
      return { ok: true, versionId: job.versionId, worldKey: r.created.flatMap((c) => c.worlds)[0]?.key || null };
    }
    const { pack } = job;
    const withMods = parts.includes("mods");
    const mr = job.kind === "mr";
    const v = mr && !pack.loader
      ? await playMode.createVersion({ minecraftVersion: pack.minecraftVersion, name: pack.name, own: true })
      : await playMode.createCustomVersion({
      kind: mr ? "mr" : "cf",
      name: pack.name,
      minecraftVersion: pack.minecraftVersion,
      loader: pack.loader,
      loaderVersion: pack.loaderVersion,
      mods: withMods ? job.mods : [],
      extra: mr ? { mrName: pack.name, packVersion: pack.packVersion } : { cfName: pack.name, packVersion: pack.packVersion },
    });
    job.versionId = v.id;
    if (job.icon) await playMode.setVersionIcon(v.id, job.icon).catch(() => false);
    if (features.visible("packRam") && (opts?.ram || pack.recommendedRamGB)) await playMode.setVersionRam(v.id, { ...(opts?.ram || { mode: "auto" }), packGB: pack.recommendedRamGB || null }).catch(() => false);
    const gameDir = playMode.gameDirOf(v.id);
    // Ce qui sera fait, en octets : mods téléchargés, fichiers de l'index Modrinth, fichiers du pack.
    const autoMods = withMods && v.pack ? job.mods.filter((m) => m.file?.url) : [];
    const extras = mr ? pack.extras.filter((x) => parts.includes(playPacks.partOfPath(x.path))) : [];
    const pick = playPacks.cfOverridePicker(pack.overridesPrefix, { parts, worlds: folders, shadow: pack.shadow });
    const rank = (name) => {
      const rel = pick(name);
      return rel ? IMPORT_STEP_ORDER.indexOf(importStepOf(rel)) : 99;
    };
    const inZip = { packed: { files: 0, bytes: 0 }, cfg: { files: 0, bytes: 0 }, rp: { files: 0, bytes: 0 }, sh: { files: 0, bytes: 0 }, world: { files: 0, bytes: 0 } };
    for (const e of await listZip(job.zip)) {
      const rel = pick(e.name);
      if (!rel || rel.endsWith("/")) continue;
      const c = inZip[importStepOf(rel)];
      c.files++;
      c.bytes += e.size || 0;
    }
    const sum = (list, f) => list.reduce((a, x) => a + (Number(f(x)) || 0), 0);
    const meter = importMeter(progress, sum(autoMods, (m) => m.file.size) + sum(extras, (x) => x.size) + sum(Object.values(inZip), (c) => c.bytes));
    if (autoMods.length) {
      let n = 0;
      let bytes = 0;
      let totalBytes = 0;
      await playMode.syncPackFiles(playMode.getVersion(v.id), {
        deps: PLAY_DEPS,
        onProgress: (p) => {
          if (p?.type === "mods-bytes") {
            bytes = p.bytes;
            totalBytes = p.totalBytes;
          } else if (p?.type === "mods") n = Math.min(p.task, autoMods.length);
          else return;
          meter.set("dl", bytes);
          meter.send({ step: "dl", n, bytes, total: totalBytes });
        },
      });
      meter.set("dl", totalBytes);
      progress({ step: "dl", n: autoMods.length, done: true });
    } else if (withMods) progress({ step: "dl", n: 0, done: true });
    // Pack Modrinth : packs de ressources, shaders et réglages listés dans l'index (même vérification
    // d'empreinte que les mods). Une étape à la fois ; elle repasse « en attente » jusqu'à la copie
    // des fichiers du pack qui la termine.
    for (const part of ["cfg", "rp", "sh"]) {
      const group = extras.filter((x) => playPacks.partOfPath(x.path) === part);
      if (!group.length) continue;
      const total = sum(group, (x) => x.size);
      await PLAY_DEPS.installFiles({
        entries: group,
        instanceDir: gameDir,
        previousFiles: [],
        onProgress: (p) => {
          if (p?.type === "mods-bytes") meter.set(`x-${part}`, p.bytes);
          if (p?.type === "mods") meter.send({ step: part, files: p.task, filesOf: group.length, bytes: p.bytes, total, file: path.basename(group[Math.min(p.task, group.length - 1)].path) });
        },
      });
      meter.set(`x-${part}`, total);
      progress({ step: part, idle: true });
    }
    // Version neuve : avec « Réglages du pack », son options.txt (touches, packs de ressources) remplace
    // la copie des réglages de Jouer (27/10, testé avec un vrai export ATM10). Extraction rangée par
    // étape (mods du pack, réglages, ressources, shaders, mondes) pour que chaque ligne avance à son tour.
    let cur = null;
    const seen = { files: 0, bytes: 0, file: "" };
    // Étapes sans rien à copier (pack sans shader…) : validées dès qu'on les dépasse, pas à la fin
    // (27/10, Rushi). Le monde est validé après son enregistrement.
    const skipEmpty = (from, to) => {
      const a = from ? IMPORT_STEP_ORDER.indexOf(from) + 1 : 0;
      const b = to ? IMPORT_STEP_ORDER.indexOf(to) : IMPORT_STEP_ORDER.length;
      for (const k of IMPORT_STEP_ORDER.slice(a, b)) if (k !== "world") progress({ step: k, n: k === "packed" ? pack.overrideJars.length : undefined, done: true });
    };
    const tell = (force = false) => {
      const c = inZip[cur];
      meter.send({ step: cur, n: cur === "packed" ? Math.min(seen.files, pack.overrideJars.length) : undefined, files: seen.files, filesOf: c.files, bytes: seen.bytes, total: c.bytes, file: seen.file }, force);
    };
    await extractZip(job.zip, gameDir, {
      pick,
      order: (a, b) => rank(a.name) - rank(b.name),
      onEntry: (entry, rel) => {
        const st = importStepOf(rel);
        const fresh = st !== cur;
        if (fresh) {
          if (cur) progress({ step: cur, n: cur === "packed" ? pack.overrideJars.length : undefined, done: true });
          skipEmpty(cur, st);
          cur = st;
          seen.files = 0;
          seen.bytes = 0;
        }
        seen.files++;
        seen.file = rel;
        tell(fresh);
      },
      // Gros fichier (région d'un monde) : la ligne avance aussi pendant sa copie.
      onBytes: (n) => {
        seen.bytes += n;
        meter.add("zip", n);
        tell();
      },
    });
    if (cur && cur !== "world") progress({ step: cur, n: cur === "packed" ? pack.overrideJars.length : undefined, done: true });
    skipEmpty(cur, null);
    // Mods rangés dans le fichier du pack (overrides/mods) : copiés juste au-dessus.
    if (withMods && pack.overrideJars?.length) progress({ step: "packed", n: pack.overrideJars.length, done: true });
    for (const s of ["cfg", "rp", "sh"]) if (parts.includes(s)) progress({ step: s, done: true });
    let worldKey = job.worldKey;
    if (folders.length) {
      const imported = await playMode.registerImported(v.id, folders);
      for (const w of imported) {
        const run = playMode
          .backupWorld(w.key, { reason: "import" })
          .then((r) => r.backup && worldCloud.queueBackup(w.key, r.backup))
          .catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Première sauvegarde de « ${w.name} » impossible : ${error.message}` }))
          .finally(() => importBackups.delete(w.key));
        importBackups.set(w.key, run);
      }
      worldKey = worldKey || imported.find((w) => w.folder === folders[0])?.key || null;
      progress({ step: "world", done: true });
    }
    if (job.worldKey) await playMode.setWorldVersion(job.worldKey, v.id);
    const manual = withMods ? job.mods.filter((m) => !m.file?.url).length : 0;
    progress({ step: "manual", n: 0, done: manual === 0 });
    installVersionInBackground(v.id).catch((error) => logStore.pushLog({ level: "warn", source: "launcher", message: `Pack ${mr ? "Modrinth" : "CurseForge"} : préparation impossible (${error.message}).` }));
    sendAll("play:worldsChanged");
    return { ok: true, versionId: v.id, worldKey };
  } catch (error) {
    return playError(error);
  }
});
// Mod d'un export à télécharger à la main : sa page, puis Téléchargements (fichier exact).
ipcMain.handle("cfPack:openManual", async (_event, item) => {
  const job = cfReads.get(String(item?.packId || ""));
  if (!job) return { ok: false, error: "Pack introuvable." };
  for (let i = 0; !job.versionId && i < 600; i++) await new Promise((r) => setTimeout(r, 500));
  if (!job.versionId) return { ok: false, error: "Le pack n'est pas encore installé." };
  const info = playMode.cfPending(job.versionId, String(item.modId || ""));
  if (!info) return { ok: false, error: "Mod introuvable dans le pack." };
  shell.openExternal(curseforgePageFor(info));
  const got = await watchDownloads(`${job.versionId}|${info.id}`, { sha1: info.sha1, size: info.size, fileName: info.fileName });
  if (!got) return { ok: true, found: false };
  await playMode.acceptManualJar(job.versionId, info.id, got.file, got);
  return { ok: true, found: true };
});

// Partie en cours lancée depuis Jouer : version et heure de départ (mondes modifiés ensuite).
let playRunning = null;

// RAM par pack (01/11) : ce que la fenêtre montre (calcul, RAM du PC, RAM libre) et l'enregistrement.
ipcMain.handle("play:ram:info", (_event, id) => {
  if (!features.visible("packRam")) return pageOff;
  const v = playMode.getVersion(String(id || ""));
  if (!v) return { ok: false, error: "Cette version n'existe plus." };
  const ctx = packRam.ctxOf(v);
  const settings = settingsStore.loadSettings();
  return {
    ok: true,
    ram: packRam.cleanRam(v.ram) || { mode: "auto" },
    ...ctx,
    totalGB: packRam.totalGB(),
    freeGB: packRam.freeGB(),
    settingsGB: settings.memoryMaxGB,
    needGB: packRam.needGB(ctx),
    autoGB: packRam.autoGB(ctx),
    gb: packRam.resolveGB(v, settings.memoryMaxGB),
  };
});
ipcMain.handle("play:ram:set", async (_event, id, ram) => {
  if (!features.visible("packRam")) return pageOff;
  try {
    return { ok: await playMode.setVersionRam(String(id || ""), ram) };
  } catch (error) {
    return playError(error);
  }
});
// Toutes les installations et leur RAM (Paramètres › Mémoire).
ipcMain.handle("play:ram:list", () => {
  if (!features.visible("packRam")) return pageOff;
  const settings = settingsStore.loadSettings();
  return {
    ok: true,
    totalGB: packRam.totalGB(),
    settingsGB: settings.memoryMaxGB,
    versions: playMode.listVersions().map((x) => {
      const v = playMode.getVersion(x.id);
      const ctx = packRam.ctxOf(v);
      return { id: v.id, name: v.name || v.pack?.name || `Minecraft ${v.minecraftVersion}`, minecraftVersion: v.minecraftVersion, modded: !!v.pack, ram: packRam.cleanRam(v.ram) || { mode: "auto" }, mods: ctx.mods, needGB: packRam.needGB(ctx), gb: packRam.resolveGB(v, settings.memoryMaxGB) };
    }),
  };
});
ipcMain.handle("play:launch", async (event, { versionId, worldKey = null, force = false, ramGB = null } = {}) => {
  if (gamesMove.active) return { ok: false, error: GAMES_MOVE_BUSY };
  if (!currentSession) return { ok: false, code: "signin", error: "Connecte-toi avec ton compte Microsoft pour jouer." };
  if (gameLaunchInProgress || getRunningGame()) return { ok: false, code: "gameRunning", error: "Minecraft est déjà lancé." };
  gameLaunchInProgress = true;
  let task = null;
  try {
    let quickPlayWorld = null;
    if (worldKey) {
      // Version d'origine encore en cours d'écriture (monde juste importé) : on attend la fin.
      await importBackups.get(worldKey);
      // Toujours la version du monde (jamais une autre) : sinon « needVersion » / « chooseVersion »,
      // et le launcher demande au joueur avant de lancer quoi que ce soit.
      await ensureStrictLayout();
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
    // Dossier de jeu de cette version ; un monde d'un autre dossier y est rangé (sauvegarde avant).
    const gameDir = await playMode.launchDir(versionId, worldKey, { strict: features.visible("strictDirs") });
    if (worldKey) quickPlayWorld = await liveSave.enqueue(() => playMode.placeWorld(worldKey, gameDir));
    // Bouclier (27/10, « versionGuard ») : sans monde choisi, le jeu peut ouvrir depuis son menu un
    // monde plus ancien du même dossier et le convertir. On le sauvegarde d'abord.
    if (!worldKey && features.visible("versionGuard")) {
      const fr = settingsStore.loadSettings().locale !== "en";
      const guarded = await liveSave.enqueue(() =>
        playMode.guardBeforeLaunch(versionId, gameDir, {
          onWorld: (w, i, n) =>
            event.sender.send("game:progress", {
              text: fr ? `🛡 Sauvegarde de « ${w.name} » (${w.minecraftVersion}) avant d'ouvrir ${version.minecraftVersion}… (${i + 1}/${n})` : `🛡 Backing up “${w.name}” (${w.minecraftVersion}) before opening ${version.minecraftVersion}… (${i + 1}/${n})`,
              guard: fr ? `🛡 Sauvegarde ${i + 1}/${n}…` : `🛡 Backup ${i + 1}/${n}…`,
            }),
        }),
      );
      for (const g of guarded) {
        if (g.backup) worldCloud.queueBackup(g.key, g.backup);
        else if (g.error) logStore.pushLog({ level: "warn", source: "launcher", message: `Sauvegarde avant ${version.minecraftVersion} impossible : ${g.error}` });
      }
    }
    const label = version.name || `${version.minecraftVersion}${version.pack ? ` · ${playPackName(version.pack)}` : ""}`;
    task = createInstallTask(`play:${versionId}`, label, "launch");
    broadcastTasks();
    const onProgress = (status) => {
      updateTaskFromProgress(task, status);
      broadcastTasks();
      event.sender.send("game:progress", status);
    };
    onProgress({ name: label, modded: !!version.pack });

    // Pack : la liste des mods la plus récente publiée par l'équipe (sinon celle déjà connue).
    if (version.pack && !version.pack.kind) {
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
      deps: PLAY_DEPS,
      onProgress,
      signal: task.controller.signal,
      waitIfPaused: taskWaitIfPaused(task),
      javaPreferred: settings.javaPath || undefined,
      gameDir,
    });
    // Mon pack / pack CurseForge : vérification des mods AVANT de lancer (26/10). S'il reste un
    // problème, le launcher le dit au lieu de laisser Minecraft planter (« Jouer quand même » passe
    // `force`).
    if (version.pack?.kind && !force) {
      const problems = await playMode.packProblems(versionId, { network: false }).catch(() => []);
      if (problems.length) {
        task.status = "cancelled";
        broadcastTasks();
        event.sender.send("game:progress", { step: "idle" });
        return { ok: false, code: "packProblems", versionId, count: problems.length };
      }
    }
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
        // Pack Omniscient : fermé normalement et sans rapport de crash = version « testée ✓ ».
        if (version.omni && exitCode === 0) {
          fsp
            .readdir(path.join(prepared.gameDirectory, "crash-reports"))
            .catch(() => [])
            .then(async (names) => {
              for (const n of names) {
                const st = await fsp.stat(path.join(prepared.gameDirectory, "crash-reports", n)).catch(() => null);
                if (st && st.mtimeMs >= startedAt) return false;
              }
              return playMode.markTested(versionId);
            })
            .then((changed) => changed && sendAll("play:worldsChanged"))
            .catch(() => {});
        }
        // Aide au crash v1 (Laboratoire « crashHelp ») : journal et rapport de crash de CETTE partie,
        // lus à chaque fermeture (l'écran « mods incompatibles » n'est pas un crash).
        if (features.visible("crashHelp")) {
          crashHelp
            .analyzeGame(prepared.gameDirectory, { startedAt, exitCode })
            .then((found) => {
              if (!found) return;
              lastCrash = {
                files: found.files,
                versionId,
                at: Date.now(),
                info: { kind: found.kind, description: found.description, lines: found.lines, deps: found.deps, exitCode },
                version: { name: version.name || version.pack?.name, mc: version.minecraftVersion || prepared.minecraftVersion, loader: version.pack?.loader, loaderVersion: version.pack?.loaderVersion },
              };
              logStore.pushLog({ level: "warn", source: "launcher", message: `Jouer : problème détecté à la fermeture du jeu (${found.kind}).` });
              const { files, texts, ...info } = found;
              const packKind = version.pack?.kind || (version.pack ? "official" : null);
              // Catalogue de bugs : une fiche reconnue remplace la fenêtre générale, sauf une fiche
              // « se corrige toute seule » (le jeu vient quand même de s'arrêter).
              const known = bugCatalog.game({ logText: texts.log, crashText: texts.crash, mc: version.minecraftVersion || prepared.minecraftVersion, loader: version.pack?.loader || "" });
              if (known) {
                lastCrash.known = known.slug;
                bugCatalog.stat(known.slug, "seen");
                logStore.pushLog({ level: "info", source: "launcher", message: `Catalogue de bugs : ${known.slug} reconnu.` });
                sendAll("bugs:found", { entry: known, versionId, canRepair: canRepairKind(packKind), hasLogs: true });
                if (known.status !== "auto") return;
              }
              sendAll("play:crashHelp", { ...info, versionId, packKind, hasCrash: !!files.crash, hasLog: !!files.log });
            })
            .catch(() => {});
        }
        liveDone
          .then(() => liveSave.enqueue(() => playMode.afterGame(ended?.versionId || versionId, ended?.startedAt || startedAt)))
          .then((created) => {
            for (const c of created) {
              if (c.backup) worldCloud.queueBackup(c.key, c.backup);
              else if (c.error) logStore.pushLog({ level: "warn", source: "launcher", message: `Sauvegarde du monde impossible : ${c.error}` });
            }
            for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send("play:worldsChanged");
            if (features.visible("dataPacks")) applyPendingDp(ended?.versionId || versionId).catch(() => {});
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
      memory: playLaunchMemory(version, settings, ramGB),
      javaPath: prepared.javaPath || settings.javaPath || undefined,
      gameDirectory: prepared.gameDirectory,
      customVersion: prepared.customVersion,
      customJvmArgs: prepared.jvmArgs,
      slug: `play:${versionId}`,
      onGameLine: (text) => liveSave.line(text),
      quickPlayWorld: quickPlayWorld && supportsQuickPlay(prepared.minecraftVersion) ? quickPlayWorld : null,
    });
    await playMode.touchVersion(versionId);
    discordPresence.setPlayingActivity(`Minecraft ${prepared.minecraftVersion}`, playPackName(version.pack), { playMode: true });
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
        memory: launchMemory(settings.memoryMinGB, settings.memoryMaxGB),
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
