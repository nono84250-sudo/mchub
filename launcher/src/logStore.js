// Journal en memoire partage par la fenetre principale et la console de
// debug (fenetre separee, voir main.js/debug-console.js) : un buffer circulaire
// + un systeme d'abonnement, pour que la console affiche l'historique recent
// des qu'elle s'ouvre puis les nouvelles lignes en direct.
const MAX_ENTRIES = 2000;

const entries = [];
const listeners = new Set();
let nextId = 1;

// Le jeton Microsoft/Minecraft transite en clair sur la ligne de commande
// Java (--accessToken ...) passee a minecraft-launcher-core — jamais
// affiche, meme dans cette console de debug (voir le commentaire dans
// mcLaunch.js). Coupe aussi les en-tetes Bearer par prudence.
function redact(message) {
  return message
    .replace(/--accessToken\s+\S+/gi, "--accessToken [REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
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

module.exports = { pushLog, getAll, clear, onLog };
