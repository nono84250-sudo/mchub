require("dotenv").config();
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const msAuth = require("./msAuth");
const { launchMinecraft } = require("./mcLaunch");
const sessionStore = require("./sessionStore");

// URL du site MCHub, source de vérité (voir cahier des charges, section
// "modèle de synchronisation"). En dur sur le localhost de dev pour l'instant
// — deviendra configurable (token de launcher brandé, Phase 4).
const SITE_URL = process.env.MCHUB_SITE_URL || "http://localhost:3000";
// Secret partage avec la route /api/launcher/servers/[slug] du site : c'est
// la SEULE route qui renvoie l'IP d'un serveur, jamais l'API publique. Vient
// du fichier .env (non versionné) — jamais de valeur par défaut en dur ici,
// une ancienne clé a fuité dans le dépôt public pour cette raison exacte.
const LAUNCHER_API_KEY = process.env.MCHUB_LAUNCHER_KEY;
const REQUEST_TIMEOUT_MS = 8000;

// TEMPORAIRE (à retirer avant toute diffusion réelle) : permet de tester le
// téléchargement/lancement du jeu tant que Microsoft n'a pas approuvé l'accès
// à l'API Minecraft (voir cahier des charges, section 4). Ne remplace jamais
// une vraie session — juste un raccourci de développement. Indexé sur
// app.isPackaged plutôt qu'un simple booléen : une version empaquetée (donc
// potentiellement distribuée) n'a jamais ce contournement, même si on oublie
// de l'enlever à la main avant de construire un build.
const TEST_MODE_ENABLED = !app.isPackaged;

// Session du joueur connecté (compte Microsoft/Minecraft), en mémoire.
// Le refresh_token est en plus sauvegardé chiffré sur disque si le joueur a
// coché "se souvenir de moi" (voir sessionStore.js).
let currentSession = null;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Réponse ${res.status} du site MCHub`);
    }
    return await res.json();
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
    backgroundColor: "#0b0b14",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

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
    currentSession = { profile, authorization };

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
    currentSession = { profile, authorization };
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
      sessionStore.clearRefreshToken();
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

// TEMPORAIRE (voir TEST_MODE_ENABLED ci-dessus).
ipcMain.handle("auth:startTestSession", () => {
  if (!TEST_MODE_ENABLED) return { ok: false, error: "Mode test désactivé." };

  const profile = { id: "00000000-0000-0000-0000-000000000000", name: "JoueurTest" };
  currentSession = {
    profile,
    authorization: msAuth.buildAuthorization({
      accessToken: "test-mode-fake-token",
      uuid: profile.id,
      name: profile.name,
      xuid: "0",
      clientId: "test-mode",
    }),
  };
  return { ok: true, profile, testMode: true };
});

ipcMain.handle("game:launch", async (event, slug) => {
  if (!currentSession) {
    return { ok: false, error: "Connecte-toi avec ton compte Microsoft avant de rejoindre un serveur." };
  }

  try {
    const data = await fetchJson(`${SITE_URL}/api/launcher/servers/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${LAUNCHER_API_KEY}` },
    });
    const server = data.server;

    await launchMinecraft({
      authorization: currentSession.authorization,
      version: server.minecraftVersion,
      serverIp: server.ip,
      onProgress: (status) => event.sender.send("game:progress", status),
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
});

app.whenReady().then(() => {
  if (!LAUNCHER_API_KEY) {
    // Erreur visible (dialog) plutôt qu'un throw silencieux avant toute
    // fenêtre : sinon l'app quitte sans qu'on sache pourquoi.
    dialog.showErrorBox(
      "Configuration manquante",
      "MCHUB_LAUNCHER_KEY est introuvable — vérifie le fichier .env du launcher.",
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
