const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const msAuth = require("./msAuth");
const { launchMinecraft } = require("./mcLaunch");

// URL du site MCHub, source de vérité (voir cahier des charges, section
// "modèle de synchronisation"). En dur sur le localhost de dev pour l'instant
// — deviendra configurable (token de launcher brandé, Phase 4).
const SITE_URL = process.env.MCHUB_SITE_URL || "http://localhost:3000";
// Secret partage avec la route /api/launcher/servers/[slug] du site : c'est
// la SEULE route qui renvoie l'IP d'un serveur, jamais l'API publique.
const LAUNCHER_API_KEY = process.env.MCHUB_LAUNCHER_KEY || "unyaHVo7GbJ4LgzEqE8Q1lQYzagV2K-g";
const REQUEST_TIMEOUT_MS = 8000;

// Session du joueur connecté (compte Microsoft/Minecraft), en mémoire pour
// l'instant — le stockage multi-comptes persistant est une étape séparée
// du roadmap (Phase 3).
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

ipcMain.handle("auth:signIn", async () => {
  try {
    const { profile, authorization } = await msAuth.signIn();
    currentSession = { profile, authorization };
    return { ok: true, profile };
  } catch (error) {
    if (error instanceof msAuth.PendingApprovalError) {
      return { ok: false, pendingApproval: true, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
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

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
