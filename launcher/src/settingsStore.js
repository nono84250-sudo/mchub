const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");

const DEFAULTS = { memoryMinGB: 1, memoryMaxGB: 4 };

// Bornes larges mais raisonnables — evite qu'un mauvais reglage empeche le
// jeu de demarrer (0 Go) ou epuise la RAM de la machine (au-dela de 32 Go).
const MIN_GB = 1;
const MAX_GB = 32;

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function clampGB(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_GB, Math.max(MIN_GB, Math.round(n)));
}

function saveSettings(partial) {
  const current = loadSettings();
  let memoryMinGB = clampGB(partial.memoryMinGB ?? current.memoryMinGB, current.memoryMinGB);
  let memoryMaxGB = clampGB(partial.memoryMaxGB ?? current.memoryMaxGB, current.memoryMaxGB);
  if (memoryMinGB > memoryMaxGB) memoryMinGB = memoryMaxGB;

  const next = { memoryMinGB, memoryMaxGB };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { loadSettings, saveSettings };
