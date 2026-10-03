require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require("electron");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const logStore = require("./logStore");

// Dossier de donnees renomme en ".omniscient-launcher" (convention "dotfile")
// plutot que "Omniscient Launcher" (le defaut d'Electron, derive de
// productName) — doit etre fixe ICI, avant tout require() local : mcLaunch,
// sessionStore, settingsStore et javaManager calculent chacun leur chemin
// via app.getPath("userData") des le chargement du module. Renomme l'ancien
// dossier s'il existe encore, pour ne pas perdre les comptes/reglages deja
// enregistres localement pendant les tests.
const defaultUserDataPath = app.getPath("userData");
const dottedUserDataPath = path.join(path.dirname(defaultUserDataPath), ".omniscient-launcher");
if (!fs.existsSync(dottedUserDataPath) && fs.existsSync(defaultUserDataPath)) {
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
const { installModpack, ensureVanillaVersion } = require("./modpack");
const sessionStore = require("./sessionStore");
const settingsStore = require("./settingsStore");
const { checkServicesStatus } = require("./servicesStatus");
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
const SITE_URL = process.env.MCHUB_SITE_URL || generatedEnv.MCHUB_SITE_URL || "http://localhost:3000";
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
function launcherAuthHeaders() {
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
      const error = new Error(`Réponse ${res.status} du site Omniscient`);
      error.status = res.status;
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

function createWindow() {
  const win = new BrowserWindow({
    width: BOOTSTRAP_SIZE.width,
    height: BOOTSTRAP_SIZE.height,
    resizable: false,
    center: true,
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
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (status) => {
    if (!win.isDestroyed()) win.webContents.send("update:status", status);
  };

  autoUpdater.on("checking-for-update", () => send({ phase: "checking" }));
  autoUpdater.on("update-available", (info) => {
    logStore.pushLog({ source: "launcher", message: `Mise à jour disponible : v${info.version}` });
    send({ phase: "downloading", version: info.version, percent: 0 });
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
function checkForUpdates() {
  return new Promise((resolve) => {
    if (!app.isPackaged) {
      resolve();
      return;
    }
    const betaChannel = settingsStore.loadSettings().betaChannel;
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
    const data = await fetchJson(`${SITE_URL}/api/public/servers/${encodeURIComponent(slug)}`);
    return { ok: true, server: data.server };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Tous les serveurs (publies ou en pause) du compte Omniscient lie au
// joueur actuellement connecte, pour la vue "Mes instances" (voir
// site/src/lib/public-servers.ts:listServersOwnedByMinecraftUuid). Vide si
// aucun compte n'est encore lie, plutot qu'une erreur — cas normal pour la
// plupart des joueurs (uniquement les proprietaires de serveur ont besoin
// de cette liaison).
ipcMain.handle("servers:mine", async () => {
  if (!currentSession) return { ok: false, status: 401, error: "Pas de compte Microsoft connecté." };
  try {
    const data = await withSessionRetry(() =>
      fetchJson(
        `${SITE_URL}/api/launcher/servers/mine?minecraftUuid=${encodeURIComponent(currentSession.profile.id)}`,
        { headers: launcherAuthHeaders() },
      ),
    );
    return { ok: true, servers: data.servers };
  } catch (error) {
    return { ok: false, status: error.status, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Rien n'est configurable dans le launcher : la console de gestion d'un
// serveur (Mes instances) et la creation d'une nouvelle instance ouvrent
// toujours le site dans le navigateur par defaut, jamais une fenetre interne.
ipcMain.handle("servers:openManage", (_event, serverId) => {
  if (typeof serverId === "string" && serverId) shell.openExternal(`${SITE_URL}/manage/${encodeURIComponent(serverId)}`);
});
ipcMain.handle("servers:openNewInstance", () => shell.openExternal(`${SITE_URL}/dashboard/servers/new`));
// Pour construire le lien d'invitation (copie dans le presse-papier depuis
// "Mes instances") sans dupliquer la logique SITE_URL cote renderer.
ipcMain.handle("app:getSiteUrl", () => SITE_URL);
ipcMain.handle("app:restart", () => {
  app.relaunch();
  app.exit(0);
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
ipcMain.handle("reports:submit", async (_event, { slug, issue, message, clientVersion, attachDiagnostics }) => {
  if (!currentSession) return { ok: false, error: "Pas de compte Microsoft connecté." };
  try {
    const res = await fetch(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...launcherAuthHeaders() },
      body: JSON.stringify({
        reporterMinecraftUuid: currentSession.profile.id,
        reporterMinecraftUsername: currentSession.profile.name,
        issue,
        message,
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

ipcMain.handle("auth:signOut", () => {
  // Ne retire pas le compte de la liste mémorisée (juste désactive la
  // reprise automatique) : on peut y rebasculer rapidement depuis la page
  // de gestion du compte sans se reconnecter à Microsoft.
  try {
    sessionStore.clearActiveAccount();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
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
    sessionStore.rememberAccount(profile.id, profile.name, newRefreshToken);
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

ipcMain.handle("account:remove", (_event, id) => {
  sessionStore.forgetAccount(id);
  if (currentSession?.profile?.id === id) currentSession = null;
  return { ok: true };
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
  win.setResizable(true);
  win.setMinimumSize(APP_MIN_SIZE.width, APP_MIN_SIZE.height);
  win.setSize(APP_SIZE.width, APP_SIZE.height);
  win.center();
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
  return next;
});

ipcMain.handle("settings:reset", () => {
  const next = settingsStore.resetSettings();
  logStore.setMinFileLevel(next.logLevel);
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
  const groups = await checkServicesStatus();
  statusCache = { fetchedAt: now, groups };
  return statusCache;
});

let gameLaunchInProgress = false;

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

  logStore.pushLog({ source: "launcher", message: `Demande de lancement pour "${slug}"` });
  try {
    // Serveur prive : le site exige la preuve (jeton du proprietaire, ou code
    // d'invitation du serveur rejoint), voir canSeeServer cote site.
    const data = await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}`, {
      headers: { ...launcherAuthHeaders(), ...inviteHeaders(slug) },
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

    const onProgress = (status) => event.sender.send("game:progress", status);

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
          // Les mises a jour chiffrees (une par mod) ne sont pas journalisees.
          if (status.text && typeof status.task !== "number") logStore.pushLog({ source: "launcher", message: status.text });
          onProgress(status);
        },
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
      } catch (error) {
        // Version inconnue de Mojang (snapshot, personnalisee…) : Java par defaut, comme avant.
        logStore.pushLog({ level: "warn", source: "launcher", message: `Java par défaut (version de Minecraft non résolue) : ${error instanceof Error ? error.message : error}` });
      }
    }

    await launchMinecraft({
      authorization: currentSession.authorization,
      version: modded?.minecraftVersion ?? server.minecraftVersion,
      serverIp: server.ip,
      serverName: server.name,
      onProgress,
      memory: { min: `${memoryMinGB}G`, max: `${memoryMaxGB}G` },
      // Serveur moddé : le Java demandé par sa version de Minecraft (Forge plante
      // sur un Java trop récent) ; sinon celui des réglages, comme avant.
      javaPath: gameJava || settings.javaPath || undefined,
      gameDirectory: modded?.instanceDir,
      customVersion: modded?.customVersion,
      customJvmArgs: modded?.jvmArgs,
    });

    discordPresence.setPlayingActivity(server.name);

    // Compteur indicatif pour la page de gestion du serveur (site) — ne
    // doit jamais faire echouer un lancement par ailleurs reussi.
    fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}/launch`, {
      method: "POST",
      headers: launcherAuthHeaders(),
    }).catch((error) => console.debug("[game:launch] suivi du lancement echoue :", error));

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    logStore.pushLog({ level: "error", source: "launcher", message: `Échec du lancement de "${slug}" : ${message}` });
    return { ok: false, error: message };
  } finally {
    gameLaunchInProgress = false;
  }
});

app.whenReady().then(() => {
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
  discordPresence.init(DISCORD_CLIENT_ID);
  discordPresence.setBrowsingActivity();
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
