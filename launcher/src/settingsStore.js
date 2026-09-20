const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");

const DEFAULTS = {
  memoryMinGB: 1,
  memoryMaxGB: 4,
  // Chemin vers un java.exe gere par le launcher (voir javaManager.js) —
  // null tant que le joueur utilise le Java deja installe sur sa machine.
  javaPath: null,
  // Passe a true apres le premier assistant de demarrage (choix de la RAM,
  // verification de Java) — evite de le remontrer a chaque lancement.
  onboarded: false,
  // Coche a l'assistant ou dans les parametres : saute l'avertissement de
  // securite RAM (voir main.js/game:launch) et lance direct avec la valeur
  // recommandee a chaque fois.
  alwaysUseRecommendedRam: false,
  // Slugs des serveurs mis en favoris (barre de lancement rapide en bas de
  // l'appli), dernier serveur reellement lance (favori ou non — affiche en
  // "Dernier joue" s'il n'est pas deja dans les favoris), et nombre de
  // lancements reussis par serveur (pour ne montrer que les 3 favoris les
  // plus joues dans le menu rapide plutot que tous, voir renderer.js).
  favoriteServers: [],
  lastPlayedSlug: null,
  playCounts: {},
  // Historique des derniers serveurs reellement lances, du plus recent au
  // plus ancien (page "Recents" de la barre laterale) — deja limite en
  // taille par renderer.js avant d'etre enregistre.
  recentlyPlayed: [],
};

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

// Fusionne generiquement (`...current, ...partial`) plutot que de relister
// chaque champ connu a la main : une whitelist figee avait deja laisse
// passer silencieusement une ecriture vers une cle inexistante (aucune
// erreur, juste une valeur jamais enregistree) — seuls les champs qui ont
// vraiment besoin d'une validation/coercion sont traites a part ici.
function saveSettings(partial) {
  const current = loadSettings();
  const next = { ...current, ...partial };

  next.memoryMinGB = clampGB(partial.memoryMinGB ?? current.memoryMinGB, current.memoryMinGB);
  next.memoryMaxGB = clampGB(partial.memoryMaxGB ?? current.memoryMaxGB, current.memoryMaxGB);
  if (next.memoryMinGB > next.memoryMaxGB) next.memoryMinGB = next.memoryMaxGB;

  if (partial.onboarded !== undefined) next.onboarded = !!partial.onboarded;
  if (partial.alwaysUseRecommendedRam !== undefined) next.alwaysUseRecommendedRam = !!partial.alwaysUseRecommendedRam;

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { loadSettings, saveSettings, clampGB };
