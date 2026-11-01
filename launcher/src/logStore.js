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
// Parametres > Debogage > "Niveau de log". Il filtre le FICHIER ; en plus, les
// lignes "debug" ne sont gardees nulle part (ni tampon ni console) tant que ce
// niveau n'est pas choisi (voir pushLog).
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
// mcLaunch.js). MCLC repasse aussi ce meme jeton dans --xuid quand
// l'autorisation n'a pas de xuid (c'est le cas : le XSTS de Minecraft n'en
// renvoie pas), donc on coupe --xuid et, par filet de securite, tout ce qui
// ressemble a un JWT. Coupe aussi les en-tetes Bearer par prudence.
function redact(message) {
  let text = message
    .replace(/--accessToken\s+\S+/gi, "--accessToken [REDACTED]")
    .replace(/--xuid\s+\S+/gi, "--xuid [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED-JWT]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  for (const { pattern, masked } of maskedAddresses.values()) text = text.replace(pattern, masked);
  return text;
}

// Adresse (IP ou domaine) d'un serveur rejoint (audit 25/10) : le site ne la donne qu'au launcher,
// elle ne doit pas finir en clair dans les journaux (fichiers joints au support, rapport de
// diagnostic). Un domaine garde un debut lisible (« play.exa*** ») pour s'y retrouver ; une IP
// est entierement masquee.
const MASKED_IP = "[adresse masquée]";
const maskedAddresses = new Map();

function addressHost(address) {
  const value = String(address ?? "").trim();
  const bracketed = /^\[([^\]]+)\]/.exec(value);
  if (bracketed) return bracketed[1];
  // Une seule ":" = hote:port ; plusieurs = IPv6 sans crochets.
  return (value.match(/:/g) || []).length === 1 ? value.split(":")[0] : value;
}

function maskAddress(address) {
  const host = addressHost(address);
  if (!host) return MASKED_IP;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return MASKED_IP;
  return `${host.slice(0, Math.min(8, Math.floor(host.length / 2)))}***`;
}

// A appeler avant de lancer le jeu vers ce serveur : toute ligne journalisee ensuite (launcher,
// minecraft-launcher-core, sortie de Minecraft) a cette adresse masquee.
function addSensitiveAddress(address) {
  const host = addressHost(address);
  if (host.length < 3 || maskedAddresses.has(host.toLowerCase())) return;
  const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Adresse entiere seulement : « mc.exemple.fr » ne masque pas un bout de « libs.mc.exemple.fr.cdn ».
  const pattern = new RegExp(`(?<![\\w.-])${escaped}(?![\\w-]|\\.[\\w-])`, "gi");
  maskedAddresses.set(host.toLowerCase(), { pattern, masked: maskAddress(host) });
}

// Fichiers du dossier logs plus vieux que 14 jours effaces au demarrage (audit 25/10) : journaux
// du launcher et rapports de diagnostic, rien d'autre.
const LOG_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

function pruneOldLogs() {
  try {
    const dir = logsDir();
    const limit = Date.now() - LOG_RETENTION_MS;
    for (const name of fs.readdirSync(dir)) {
      if (!/^launcher-\d{4}-\d{2}-\d{2}\.log$/.test(name) && !/^rapport-diagnostic-\d+\.txt$/.test(name)) continue;
      const file = path.join(dir, name);
      try {
        if (fs.statSync(file).mtimeMs < limit) fs.rmSync(file, { force: true });
      } catch {
        // Fichier verrouille ou deja parti : on retentera au prochain demarrage.
      }
    }
  } catch {
    // Dossier illisible : jamais bloquant pour le demarrage.
  }
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
  // Traces de débogage (14/10, demande de Rushi) : masquées partout (console de debug comprise)
  // sauf si le joueur choisit « Debug » dans Paramètres > Débogage > Niveau de log. Les erreurs,
  // avertissements et messages utiles (niveau info) restent toujours visibles.
  if (level === "debug" && minFileLevel !== "debug") return null;
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

module.exports = { pushLog, getAll, clear, onLog, setMinFileLevel, logsDir, todayLogPath, maskAddress, addSensitiveAddress, pruneOldLogs };
