require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut, session, screen } = require("electron");

// Verrou mono-instance : relancer le launcher pendant qu'une instance tourne deja creait
// jusqu'ici un second process totalement independant (deux lancements Minecraft simultanes
// sur le meme GAME_ROOT, ecritures concurrentes sans verrou sur settings.json/accounts.bin,
// double enregistrement du raccourci global de debug). Doit etre demande avant toute autre
// initialisation (avant meme la creation de la premiere fenetre).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}
// Un second lancement a quand meme tente de demarrer (et echoue sur le verrou ci-dessus) :
// on ramene la fenetre existante au premier plan plutot que de laisser l'utilisateur croire
// que rien ne s'est passe.
app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
});

const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const logStore = require("./logStore");

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
const dottedUserDataPath = path.join(path.dirname(defaultUserDataPath), isDev ? ".omniscient-launcher-dev" : ".omniscient-launcher");
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

const msAuth = require("./msAuth");
const { launchMinecraft, GAME_ROOT } = require("./mcLaunch");
const {
  installModpack,
  ensureVanillaVersion,
  hasVanillaFilesInstalled,
  isInstalled,
  installLoader,
  prepareLaunchVersion,
  readInstalledState,
  listInstalledInstances,
} = require("./modpack");
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
let SITE_URL = process.env.MCHUB_SITE_URL || generatedEnv.MCHUB_SITE_URL || "http://localhost:3000";
// Adresses de secours du site de production : si l'adresse principale ne
// répond pas au démarrage, le launcher prend la première qui répond. Pas
// utilisées pour le développement en local (localhost).
const FALLBACK_SITE_URLS = ["https://omniscient-theta.vercel.app", "https://omniscientlauncher.com"];

async function pickSiteUrl() {
  if (!SITE_URL.startsWith("https://")) return;
  const candidates = [SITE_URL, ...FALLBACK_SITE_URLS.filter((url) => url !== SITE_URL)];
  for (const url of candidates) {
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/api/public/servers`, { signal: AbortSignal.timeout(4000) });
      if (res.status < 500) {
        SITE_URL = url.replace(/\/$/, "");
        return;
      }
    } catch {
      // Pas de réponse : on essaie l'adresse suivante.
    }
  }
}
// Pose la Content-Security-Policy une fois SITE_URL connu (voir pickSiteUrl) : les images
// de serveur (bannerUrl/iconUrl) viennent du site et doivent pouvoir se charger, mais
// seulement depuis une adresse https, ou depuis SITE_URL lui-meme quand c'est localhost en
// http (developpement local). Jamais de http: autorise en general, pour ne pas ouvrir la
// porte a une image chargee en clair depuis n'importe quel autre site.
function setContentSecurityPolicy() {
  const siteOrigin = new URL(SITE_URL).origin;
  const isLocalHttp = siteOrigin.startsWith("http://localhost:") || siteOrigin.startsWith("http://127.0.0.1:");
  const imgSrc = isLocalHttp ? `'self' https: data: ${siteOrigin}` : "'self' https: data:";
  const csp = `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src ${imgSrc};`;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] } });
  });
}

// Secret partage avec la route /api/launcher/servers/[slug] du site : c'est
// la SEULE route qui renvoie l'IP d'un serveur, jamais l'API publique. Jamais
// de valeur par défaut en dur ici, une ancienne clé a fuité dans le dépôt
// public pour cette raison exacte.
const LAUNCHER_API_KEY = process.env.LAUNCHER_API_KEY || generatedEnv.LAUNCHER_API_KEY;
// Optionnel (voir discordPresence.js) : Rich Presence desactivee proprement
// si absent, jamais une erreur bloquante comme LAUNCHER_API_KEY ci-dessus.
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || generatedEnv.DISCORD_CLIENT_ID;
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
const LAUNCHER_SESSION_USABLE_MARGIN_MS = 30_000;

function usableLauncherSessionToken() {
  if (!currentSession || !launcherSession) return null;
  if (launcherSession.uuid !== currentSession.profile.id) return null;
  if (launcherSession.expiresAt - LAUNCHER_SESSION_USABLE_MARGIN_MS <= Date.now()) return null;
  return launcherSession.token;
}


function requestLauncherSession() {
  if (!currentSession || launcherSessionRequest) return;
  const uuid = currentSession.profile.id;
  const mojangToken = currentSession.authorization.access_token;
  launcherSessionRequest = (async () => {
    try {
      const res = await fetch(`${SITE_URL}/api/launcher/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LAUNCHER_API_KEY}`,
          "X-Minecraft-Token": mojangToken,
        },
        body: JSON.stringify({ minecraftUuid: uuid }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        logStore.pushLog({ level: "warn", source: "launcher", message: `Session launcher : échange refusé (HTTP ${res.status}), repli sur le jeton Mojang` });
        return;
      }
      const data = await res.json();
      // Joueur deconnecte pendant l'echange : on ne garde pas sa session.
      if (currentSession?.profile.id !== uuid) return;
      launcherSession = { uuid, token: data.token, expiresAt: data.expiresAt };
      logStore.pushLog({ source: "launcher", message: `Session launcher : jeton obtenu, valable jusqu'à ${new Date(data.expiresAt).toLocaleTimeString("fr-FR")}` });
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
    return { Authorization: `Bearer ${LAUNCHER_API_KEY}`, "X-Launcher-Session": sessionToken };
  }
  // Pas encore connecte (2026-10-11 : "Installer" peut maintenant s'utiliser
  // sans compte, voir server:install) — la cle du launcher seule suffit pour
  // les endpoints publics (fiche serveur public, fichiers de modpack) ;
  // X-Minecraft-Token n'est qu'une preuve d'identite en plus, jamais lu que
  // pour les serveurs prives. Avant ce controle : currentSession.authorization
  // etait lu sans garde, "Cannot read properties of null" des le premier
  // appel sans session (trouve en testant le bouton "Installer").
  if (!currentSession) {
    return { Authorization: `Bearer ${LAUNCHER_API_KEY}` };
  }
  requestLauncherSession();
  return { Authorization: `Bearer ${LAUNCHER_API_KEY}`, "X-Minecraft-Token": currentSession.authorization.access_token };
}

// Session du joueur connecté (compte Microsoft/Minecraft), en mémoire.
// Le refresh_token est en plus sauvegardé chiffré sur disque si le joueur a
// coché "se souvenir de moi" (voir sessionStore.js).
let currentSession = null;
// Vrai seulement si la session courante a un refresh_token mémorisé : sans
// lui, pas de renouvellement silencieux (comportement d'avant).
let sessionRemembered = false;

function setSession(profile, authorization) {
  currentSession = { profile, authorization };
  requestLauncherSession();
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

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      // Le site renvoie un message et parfois un code (ex. « frozen ») : on les garde.
      const body = await res.json().catch(() => null);
      const error = new Error(body?.error || `Réponse ${res.status} du site Omniscient`);
      error.status = res.status;
      error.code = body?.code;
      throw error;
    }
    return await res.json();
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
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
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
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

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
    // Canal bêta : la dernière bêta publiée est toujours prise, quel que soit son
    // numéro (la bêta fait autorité). Canal stable : une version plus ancienne
    // (ex. 0.3.3 vue depuis une bêta) n'est jamais téléchargée ni installée.
    const onBeta = autoUpdater.channel === "beta";
    const isUpdate = onBeta ? info.version !== app.getVersion() : isNewerVersion(info.version, app.getVersion());
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
    if (!app.isPackaged) {
      resolve();
      return;
    }
    // Une version bêta reste sur le canal bêta, même si l'option est décochée.
    const betaChannel = settingsStore.loadSettings().betaChannel || app.getVersion().includes("-beta");
    autoUpdater.channel = betaChannel ? "beta" : "latest";
    autoUpdater.allowPrerelease = betaChannel;
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
  const info = await diagnostics.getSystemInfo({ ...settings, gameRoot: GAME_ROOT, appVersion: app.getVersion() });
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
    "",
    "--- Journal recent ---",
    recentLog,
  ];
  const reportPath = path.join(logStore.logsDir(), `rapport-diagnostic-${Date.now()}.txt`);
  fs.writeFileSync(reportPath, lines.join("\n"));
  shell.showItemInFolder(reportPath);
  return { ok: true, path: reportPath };
});

ipcMain.handle("diagnostics:getSystemInfo", () =>
  diagnostics.getSystemInfo({ ...settingsStore.loadSettings(), gameRoot: GAME_ROOT, appVersion: app.getVersion() }),
);
ipcMain.handle("diagnostics:getCacheSizeBytes", () => diagnostics.getCacheSizeBytes());
ipcMain.handle("diagnostics:repair", () => {
  diagnostics.repairGameFiles();
  logStore.pushLog({ source: "launcher", message: "Fichiers du jeu réparés (versions/libraries effacés)." });
});
ipcMain.handle("diagnostics:clearCache", () => {
  diagnostics.clearCache();
  logStore.pushLog({ source: "launcher", message: "Cache vidé (assets/téléchargements)." });
});

// Toutes les requêtes réseau vers le site passent par le processus principal
// (jamais par le renderer) : évite le CORS et garde le renderer sans accès
// réseau direct, conformément aux bonnes pratiques Electron.
ipcMain.handle("servers:list", async () => {
  try {
    const data = await fetchJson(`${SITE_URL}/api/public/servers`);
    return { ok: true, servers: data.servers };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

ipcMain.handle("servers:get", async (_event, slug) => {
  try {
    // Serveur privé rejoint : le code d'invitation est nécessaire pour voir la fiche.
    const data = await fetchJson(`${SITE_URL}/api/public/servers/${encodeURIComponent(slug)}`, { headers: inviteHeaders(slug) });
    return { ok: true, server: data.server };
  } catch (error) {
    // Serveur gelé : signalé pour afficher « gelé » plutôt que « introuvable ». notFound
    // distingue un vrai 404 (fiche supprimée, voir resolveServersBySlug côté renderer) d'une
    // panne réseau/timeout, qu'il ne faut surtout pas confondre avec une suppression.
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
// Résultat gardé 60 secondes par compte : évite de redemander le site à chaque ouverture.
let mineCache = null;
const MINE_CACHE_MS = 60_000;

ipcMain.handle("servers:mine", async () => {
  if (!currentSession) {
    logStore.pushLog({ level: "warn", source: "launcher", message: "Mes instances : pas de session Microsoft active" });
    return { ok: false, status: 401, error: "Pas de compte Microsoft connecté." };
  }
  const uuid = currentSession.profile.id;
  if (mineCache && mineCache.uuid === uuid && Date.now() - mineCache.at < MINE_CACHE_MS) {
    return { ok: true, servers: mineCache.servers };
  }
  try {
    const data = await withSessionRetry(() =>
      fetchJson(
        `${SITE_URL}/api/launcher/servers/mine?minecraftUuid=${encodeURIComponent(uuid)}`,
        { headers: launcherAuthHeaders() },
      ),
    );
    mineCache = { uuid, at: Date.now(), servers: data.servers };
    logStore.pushLog({ source: "launcher", message: `Mes instances : ${data.servers?.length ?? 0} serveur(s) chargé(s)` });
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

// Parametres > Divers > A propos (exige par les regles Discord pour developpeurs : la politique
// de confidentialite doit etre accessible depuis l'application). Adresses fixes du site en ligne,
// pas SITE_URL : en developpement, SITE_URL pointe sur localhost, ou ces pages peuvent manquer.
// Le renderer ne choisit qu'une cle, jamais une adresse.
const LEGAL_URLS = {
  terms: "https://omniscientlauncher.com/cgu",
  privacy: "https://omniscientlauncher.com/confidentialite",
};
ipcMain.handle("app:openLegal", (_event, page) => {
  const url = Object.hasOwn(LEGAL_URLS, page) ? LEGAL_URLS[page] : null;
  if (url) shell.openExternal(url);
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
ipcMain.handle("friends:list", async () => {
  if (!currentSession) {
    return { ok: false, error: "Pas de compte Microsoft connecté." };
  }
  try {
    const uuid = currentSession.profile.id;
    const data = await fetchJson(
      `${SITE_URL}/api/launcher/friends?minecraftUuid=${encodeURIComponent(uuid)}`,
      { headers: launcherAuthHeaders() },
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
      body: JSON.stringify({ minecraftUuid: uuid, minecraftUsername: currentSession.profile.name, targetUsername: minecraftUsername }),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});
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
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});
// Heartbeat de presence (voir lib/presence.ts cote site) : greffe sur le cycle de 60s existant
// du launcher (REFRESH_INTERVAL_MS/scheduleRefresh dans renderer.js), jamais un intervalle a
// part. Echec silencieux cote renderer (voir sendPresenceHeartbeat la-bas) : un heartbeat rate
// ne fait que retarder un peu le passage "hors ligne" d'un ami, jamais a signaler au joueur.
ipcMain.handle("presence:heartbeat", async () => {
  if (!currentSession) {
    return { ok: false, error: "Pas de compte Microsoft connecté." };
  }
  try {
    await fetchJson(`${SITE_URL}/api/launcher/presence`, {
      method: "POST",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ minecraftUuid: currentSession.profile.id, minecraftUsername: currentSession.profile.name }),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Pour construire le lien d'invitation (copie dans le presse-papier depuis
// "Mes instances") sans dupliquer la logique SITE_URL cote renderer.
ipcMain.handle("app:getSiteUrl", () => SITE_URL);
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
ipcMain.handle("maintenance:check", async () => {
  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/maintenance`, {
      headers: { Authorization: `Bearer ${LAUNCHER_API_KEY}` },
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

    const data = await fetchJson(`${SITE_URL}/api/public/servers/${encodeURIComponent(slug)}`, {
      headers: { "X-Invite-Code": trimmed },
    });
    addJoinedServer(slug, trimmed);
    return { ok: true, server: data.server };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

ipcMain.handle("servers:joinByCode", (_event, code) => joinServerByCode(code));

ipcMain.handle("servers:leaveJoined", (_event, slug) => {
  removeJoinedServer(slug);
  return { ok: true };
});

// Fiches des serveurs rejoints, triees du plus recemment rejoint au plus
// ancien. Une entree dont la fiche a disparu (serveur supprime, ou republie
// autrement) est simplement ignoree plutot que de casser tout l'onglet.
ipcMain.handle("servers:listJoined", async () => {
  const joined = [...(settingsStore.loadSettings().joinedServers || [])].sort((a, b) => b.joinedAt - a.joinedAt);
  const servers = await Promise.all(
    joined.map(async (j) => {
      try {
        const data = await fetchJson(`${SITE_URL}/api/public/servers/${encodeURIComponent(j.slug)}`, {
          headers: inviteHeaders(j.slug),
        });
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

// Cloche de notifications : alertes personnelles (reponse/resolution de
// signalement) pour le joueur connecte, voir renderer.js/refreshNotifications
// et site/src/app/api/launcher/notifications/route.ts.
ipcMain.handle("notifications:list", async () => {
  if (!currentSession) return { ok: true, notifications: [] };
  try {
    const data = await withSessionRetry(() =>
      fetchJson(
        `${SITE_URL}/api/launcher/notifications?minecraftUuid=${encodeURIComponent(currentSession.profile.id)}`,
        { headers: launcherAuthHeaders() },
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
    setSession(profile, authorization);

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
  logStore.pushLog({ source: "launcher", message: `[fenetre] ${JSON.stringify(bounds)} agrandie=${maximize}` });
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

// Test de debit : une seule mesure a la fois, gardee 5 min. La progression est
// envoyee a la fenetre qui l'a demandee (barre dans le panneau).
const CONNECTION_CACHE_MS = 5 * 60_000;
let connectionCache = null;
let connectionRun = null;

ipcMain.handle("status:getConnection", (event, force) => {
  if (!force && connectionCache && Date.now() - connectionCache.fetchedAt < CONNECTION_CACHE_MS) {
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
      connectionCache = result;
      return result;
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
    status: task.status, // "active" | "paused" | "complete" | "error" | "cancelled"
    text: task.text,
    bytes: task.bytes,
    totalBytes: task.totalBytes,
    speedBps: task.speedBps,
    error: task.error,
  };
}

function broadcastTasks() {
  const tasks = [...installTasks.values()].map(serializeTask);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("tasks:update", tasks);
  }
}

function createInstallTask(slug, name) {
  const task = {
    id: nextTaskId++,
    slug,
    name: name || slug,
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
  const already = [...installTasks.values()].find((t) => t.slug === slug && (t.status === "active" || t.status === "paused"));
  if (already) {
    return { ok: false, error: "Une installation est déjà en cours pour ce serveur.", taskId: already.id };
  }

  const task = createInstallTask(slug, displayName);
  broadcastTasks();
  logStore.pushLog({ source: "launcher", message: `Demande d'installation pour "${slug}"` });
  try {
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
    return { ok: false, error: task.error, frozen: error?.code === "frozen" };
  }
});

ipcMain.handle("game:launch", async (event, slug, memoryOverride) => {
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
  const task = createInstallTask(slug, null);
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
    task.bytes = task.totalBytes || task.bytes;
    broadcastTasks();

    await launchMinecraft({
      // Jeu lance / ferme : les fenetres ralentissent leurs interrogations pendant la partie.
      onGameState: (running) => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send("game:state", running);
        }
        // Le launcher s'était caché pendant la partie (réglage « garder le launcher ouvert » décoché) :
        // il se réaffiche tout seul quand le jeu se ferme.
        if (!running && settingsStore.loadSettings().keepLauncherOpenWhilePlaying === false) {
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
      onProgress,
      memory: { min: `${memoryMinGB}G`, max: `${memoryMaxGB}G` },
      // Serveur moddé : le Java demandé par sa version de Minecraft (Forge plante
      // sur un Java trop récent) ; sinon celui des réglages, comme avant.
      javaPath: gameJava || settings.javaPath || undefined,
      gameDirectory: modded?.instanceDir,
      customVersion: modded?.customVersion,
      customJvmArgs: modded?.jvmArgs,
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
    return { ok: false, error: message, frozen: error?.code === "frozen" };
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
  if (gameLaunchInProgress) {
    return { ok: false, error: "Un lancement du jeu est déjà en cours." };
  }
  gameLaunchInProgress = true;

  const task = createInstallTask(slug, null);
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
        if (!running && settingsStore.loadSettings().keepLauncherOpenWhilePlaying === false) {
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
  return { ok: true };
});

ipcMain.handle("selftest:run", async (event, slug) => {
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
  const task = createInstallTask(slug, null);
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
    try {
      if (server.type === "modded" && server.curseforgeModpackId) {
        modded = await installModpack({
          config: { siteUrl: SITE_URL, apiKey: LAUNCHER_API_KEY, headers: launcherAuthHeaders() },
          slug,
          gameRoot: GAME_ROOT,
          javaPath: settings.javaPath || undefined,
          resolveJava: (major, onJavaProgress) =>
            javaManager.ensureJavaForMajor(major, { preferredPath: settings.javaPath || undefined, onProgress: onJavaProgress }),
          onProgress,
          signal: task.controller.signal,
          waitIfPaused: taskWaitIfPaused(task),
        });
      } else {
        vanilla = await ensureVanillaVersion(path.join(GAME_ROOT, "versions"), server.minecraftVersion);
      }
    } catch (error) {
      report("modpack", "fail", { error: error instanceof Error ? error.message : String(error) });
    }
    // Moddé : le téléchargement du modpack (mods inclus) est entièrement fini à cet instant — on
    // peut juger ce check tout de suite, sans attendre le lancement. Bug trouvé le 2026-10-13 (test
    // réel du propriétaire, 5 mods bloqués par CurseForge) : si installModpack échouait, "modded"
    // restait vide, launchMinecraft() se rabattait alors silencieusement sur du Minecraft vanilla
    // (aucun rapport avec le modpack testé), et le succès de CE lancement de secours écrasait
    // l'échec pourtant réel du check modpack plus bas. Le vanilla, lui, reste décidé par le
    // lancement (ensureVanillaVersion ne télécharge que JSON+jar, pas bibliothèques/assets).
    if (server.type === "modded" && server.curseforgeModpackId && modded) {
      checks.modpackInstalled = true;
      report("modpack", "pass");
    }
    if (bailIfAborted("gameStarted")) return { ok: true, checks, detectedVersion, allPassed: false, aborted: true };

    // 3. Jeu démarré (RAM correcte) — launchMinecraft() ne résout qu'une fois Minecraft
    // réellement démarré (started = true / onGameState(true)), avec la RAM des réglages
    // actuels du joueur (c'est bien SA configuration qui doit être testée, pas une valeur
    // arbitraire). Tente de lancer meme si le check #2 a echoue (fichiers manquants, etc.) :
    // l'erreur rencontree ici est elle-meme une information utile pour le proprietaire. Pour un
    // serveur moddé le check #2 est déjà tranché (voir plus haut) et n'est plus réévalué ici —
    // seul le vanilla décide encore son check #2 à ce stade (voir plus bas).
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
        },
        authorization: currentSession.authorization,
        version: modded?.minecraftVersion ?? server.minecraftVersion,
        serverIp: server.ip,
        serverName: server.name,
        autoConnect: server.autoConnect,
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
    return { ok: true, checks, detectedVersion, allPassed };
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
ipcMain.handle("selftest:report", async (_event, { slug, checks, detectedVersion }) => {
  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/self-test`, {
      method: "POST",
      headers: { ...launcherAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ checks, detectedVersion }),
    });
    // 2026-10-11 : un test reussi envoie maintenant directement la fiche en file d'attente
    // (isPrivate passe a false cote site, voir self-test/route.ts) — sans vider mineCache,
    // "Mes instances" pouvait reafficher "Tester pour publication" jusqu'a 60s (MINE_CACHE_MS)
    // apres une demande reussie, le temps que le cache expire tout seul.
    if (data.passed) mineCache = null;
    return { ok: true, passed: !!data.passed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

app.whenReady().then(async () => {
  await pickSiteUrl();
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
  logStore.pushLog({ source: "launcher", message: `Démarrage d'Omniscient Launcher ${app.getVersion()}` });
  createWindow();
  globalShortcut.register("CommandOrControl+Shift+D", () => createConsoleWindow());
  const startupSettings = settingsStore.loadSettings();
  discordPresence.init(DISCORD_CLIENT_ID, { enabled: startupSettings.discordPresence !== false, locale: startupSettings.locale });
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
  globalShortcut.unregisterAll();
  discordPresence.shutdown();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
