require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("node:path");
const msAuth = require("./msAuth");
const { launchMinecraft, GAME_ROOT } = require("./mcLaunch");
const sessionStore = require("./sessionStore");
const settingsStore = require("./settingsStore");

// URL du site Omniscient, source de vérité (voir cahier des charges, section
// "modèle de synchronisation"). En dur sur le localhost de dev pour l'instant
// — deviendra configurable (token de launcher brandé, Phase 4).
const SITE_URL = process.env.MCHUB_SITE_URL || "http://localhost:3000";
// Secret partage avec la route /api/launcher/servers/[slug] du site : c'est
// la SEULE route qui renvoie l'IP d'un serveur, jamais l'API publique. Vient
// du fichier .env (non versionné) — jamais de valeur par défaut en dur ici,
// une ancienne clé a fuité dans le dépôt public pour cette raison exacte.
const LAUNCHER_API_KEY = process.env.LAUNCHER_API_KEY;
const REQUEST_TIMEOUT_MS = 8000;

// Session du joueur connecté (compte Microsoft/Minecraft), en mémoire.
// Le refresh_token est en plus sauvegardé chiffré sur disque si le joueur a
// coché "se souvenir de moi" (voir sessionStore.js).
let currentSession = null;

function setSession(profile, authorization) {
  currentSession = { profile, authorization };
  return profile;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Réponse ${res.status} du site Omniscient`);
    }
    return await res.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Le site Omniscient n'a pas répondu à temps.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
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
  const sendMaximizedState = () => win.webContents.send("window:maximized-changed", win.isMaximized());
  win.on("maximize", sendMaximizedState);
  win.on("unmaximize", sendMaximizedState);

  win.loadFile(path.join(__dirname, "index.html"));
}

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

ipcMain.handle("auth:signIn", async (_event, remember) => {
  try {
    const { profile, authorization, refreshToken } = await msAuth.signIn();
    // Toujours défini avant la tentative de sauvegarde : si le compte
    // signIn a réussi, cette réponse doit rester "ok" même si la
    // persistance échoue ensuite (écriture disque, coffre indisponible...).
    setSession(profile, authorization);

    let remembered = false;
    try {
      if (remember && refreshToken) {
        remembered = sessionStore.saveRefreshToken(refreshToken);
      } else {
        // Pas de "se souvenir de moi" : on efface toute session mémorisée
        // précédente (ex: un autre compte sur une machine partagée), sinon
        // elle resterait accessible au prochain démarrage malgré ce choix.
        sessionStore.clearRefreshToken();
      }
    } catch {
      remembered = false;
    }

    return { ok: true, profile, rememberFailed: remember && !remembered };
  } catch (error) {
    if (error instanceof msAuth.PendingApprovalError) {
      return { ok: false, pendingApproval: true, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

// Appelé une fois au démarrage de l'app : tente de reprendre la session
// mémorisée sans ouvrir de fenêtre de connexion.
ipcMain.handle("auth:tryRestore", async () => {
  const refreshToken = sessionStore.loadRefreshToken();
  if (!refreshToken) return { ok: false };

  try {
    const { profile, authorization, refreshToken: newRefreshToken } = await msAuth.refreshSession(refreshToken);
    setSession(profile, authorization);
    try {
      sessionStore.saveRefreshToken(newRefreshToken);
    } catch {
      // La session reste valide en mémoire pour cette fois ; seule la
      // mémorisation pour la prochaine fois est perdue.
    }
    return { ok: true, profile };
  } catch (error) {
    // Ne vider le refresh_token mémorisé que s'il est vraiment invalide/
    // révoqué côté Microsoft ("invalid_grant") — pas sur une panne réseau
    // passagère, ni sur le blocage temporaire "en attente d'approbation"
    // (les identifiants Microsoft/Xbox restent valides dans ce cas).
    if (error.code === "invalid_grant") {
      try {
        sessionStore.clearRefreshToken();
      } catch {
        // Rien de plus à faire : le refresh_token est de toute façon invalide
        // côté Microsoft, seul le nettoyage du fichier local a échoué.
      }
    } else if (error.rotatedRefreshToken) {
      // Microsoft a quand même pu renouveler (et donc invalider l'ancien)
      // le refresh_token avant que la suite échoue : on garde le nouveau
      // pour ne pas se retrouver avec un token déjà mort au prochain essai.
      try {
        sessionStore.saveRefreshToken(error.rotatedRefreshToken);
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
  // currentSession n'est mis à null qu'après le nettoyage disque : si celui-ci
  // échoue, l'appelant le sait (ok:false) plutôt que de désynchroniser l'état
  // du processus principal de celui affiché dans le renderer.
  try {
    sessionStore.clearRefreshToken();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
  currentSession = null;
  return { ok: true };
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

ipcMain.handle("settings:get", () => ({
  ...settingsStore.loadSettings(),
  gameRoot: GAME_ROOT,
  appVersion: app.getVersion(),
}));

ipcMain.handle("settings:set", (_event, partial) => settingsStore.saveSettings(partial || {}));

ipcMain.handle("settings:openGameFolder", () => shell.openPath(GAME_ROOT));

let gameLaunchInProgress = false;

ipcMain.handle("game:launch", async (event, slug) => {
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

  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${LAUNCHER_API_KEY}` },
    });
    const server = data.server;
    const settings = settingsStore.loadSettings();

    await launchMinecraft({
      authorization: currentSession.authorization,
      version: server.minecraftVersion,
      serverIp: server.ip,
      onProgress: (status) => event.sender.send("game:progress", status),
      memory: { min: `${settings.memoryMinGB}G`, max: `${settings.memoryMaxGB}G` },
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
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
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
