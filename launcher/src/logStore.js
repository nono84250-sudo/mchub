// Journal en memoire partage par la fenetre principale et la console de
// debug (fenetre separee, voir main.js/debug-console.js) : un buffer circulaire
// + un systeme d'abonnement, pour que la console affiche l'historique recent
// des qu'elle s'ouvre puis les nouvelles lignes en direct. Persiste aussi
// chaque ligne sur disque (Parametres > Debogage > "Logs & rapports").
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const MAX_ENTRIES = 2000;
const LEVEL_PRIORITY = { error: 0, warn: 1, info: 2, debug: 3 };

const entries = [];
const listeners = new Set();
let nextId = 1;
// "info" par defaut : suffisant pour du support courant sans noyer le
// fichier de "debug" (tres verbeux, cote MCLC notamment) — voir
// Parametres > Debogage > "Niveau de log", qui ne filtre que le FICHIER,
// jamais le tampon en memoire ni la console (on veut tout voir en direct
// quand elle est ouverte).
let minFileLevel = "info";

function logsDir() {
  const dir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function todayLogPath() {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return path.join(logsDir(), `launcher-${stamp}.log`);
}

// Le jeton Microsoft/Minecraft transite en clair sur la ligne de commande
// Java (--accessToken ...) passee a minecraft-launcher-core — jamais
// affiche, meme dans cette console de debug (voir le commentaire dans
// mcLaunch.js). Coupe aussi les en-tetes Bearer par prudence.
function redact(message) {
  return message
    .replace(/--accessToken\s+\S+/gi, "--accessToken [REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

function setMinFileLevel(level) {
  if (level in LEVEL_PRIORITY) minFileLevel = level;
}

function appendToFile(entry) {
  if (LEVEL_PRIORITY[entry.level] > LEVEL_PRIORITY[minFileLevel]) return;
  const line = `${new Date(entry.ts).toISOString()} ${entry.level.toUpperCase().padEnd(5)} ${entry.source.padEnd(8)} ${entry.message}\n`;
  try {
    fs.appendFileSync(todayLogPath(), line);
  } catch {
    // Ecriture disque non-critique (dossier verrouille, disque plein...) —
    // le journal en memoire/la console de debug restent fonctionnels.
  }
}

function pushLog({ level = "info", source = "launcher", message }) {
  const entry = {
    id: nextId++,
    ts: Date.now(),
    level,
    source,
    message: redact(String(message ?? "")),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  appendToFile(entry);
  for (const listener of listeners) listener(entry);
  return entry;
}

function getAll() {
  return entries.slice();
}

function clear() {
  entries.length = 0;
}

function onLog(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

module.exports = { pushLog, getAll, clear, onLog, setMinFileLevel, logsDir, todayLogPath };
