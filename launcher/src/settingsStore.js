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
  // Contraire : toujours lancer avec la RAM reglee par le joueur, sans jamais
  // appliquer celle du serveur (il est seulement prevenu si elle est trop basse).
  // Exclusif avec alwaysUseRecommendedRam.
  alwaysUseCustomRam: false,
  // Slugs des serveurs mis en favoris (barre de lancement rapide en bas de
  // l'appli), dernier serveur reellement lance (favori ou non — affiche en
  // "Dernier joue" s'il n'est pas deja dans les favoris), et nombre de
  // lancements reussis par serveur (pour ne montrer que les 3 favoris les
  // plus joues dans le menu rapide plutot que tous, voir renderer.js).
  favoriteServers: [],
  lastPlayedSlug: null,
  playCounts: {},
  // Serveurs prives rejoints via le code/lien d'invitation de quelqu'un
  // d'autre (onglet "Rejoint" de "Mes instances", voir renderer.js) — tableau
  // de { slug, joinedAt }, deduplique par slug. Stockage 100% local comme
  // favoriteServers ci-dessus : le site ne sait jamais qui a rejoint quel
  // serveur prive, pas de table dediee (voir main.js/addJoinedServer).
  joinedServers: [],
  // Historique des derniers serveurs reellement lances, du plus recent au
  // plus ancien (page "Recents" de la barre laterale) — deja limite en
  // taille par renderer.js avant d'etre enregistre.
  recentlyPlayed: [],
  // Langue de l'UI (voir i18n.js) — seuls "fr"/"en" ont une vraie traduction
  // pour l'instant. Theme/accent (voir globals du launcher) : "system" suit
  // prefers-color-scheme, sinon "dark"/"light" force l'un ou l'autre.
  locale: "fr",
  theme: "dark",
  // Bleu choisi par le client (2026-10-11), re-sature le meme jour suite a
  // la comparaison avec Modrinth — voir theme.js/ACCENT_PRESETS (meme
  // valeur en position 0).
  accentColor: "#2792dd",
  compactServerList: false,
  // Parametres > Debogage (voir logStore.js/renderer.js) — logLevel ne
  // filtre que ce qui est ecrit dans le fichier de log, jamais la console
  // de debug en direct.
  logLevel: "info",
  openConsoleOnLaunch: false,
  keepLauncherOpenWhilePlaying: true,
  // Canal de mise a jour "beta" (versions pre-release de omniscient-launcher).
  // Applique au prochain demarrage : checkForUpdates() lit ce reglage a chaque
  // verification du bootstrap.
  betaChannel: false,
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

// Ecriture atomique (fichier temporaire + renommage, comme les telechargements ".part" de
// modpack.js/javaManager.js) : fs.writeFileSync direct laissait un fichier tronque si le
// process etait tue pendant l'ecriture, avalee silencieusement au redemarrage par le catch de
// loadSettings() (repart sur DEFAULTS sans aucune trace — voir audit 2026-10-10, §3.7).
function writeSettingsFile(data) {
  const tmpFile = `${SETTINGS_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  fs.renameSync(tmpFile, SETTINGS_FILE);
}

// Liste blanche des cles acceptees par settings:set (IPC, voir main.js) — toute cle absente
// d'ici est silencieusement ignoree plutot que fusionnee a l'aveugle dans settings.json (voir
// audit 2026-10-10, §1.6 : un futur XSS/dependance compromise dans le renderer pourrait sinon
// ecrire n'importe quelle cle, notamment javaPath, consomme ensuite par spawn() dans
// mcLaunch.js/javaManager.js). Derivee de DEFAULTS plutot que maintenue a la main a cote : une
// liste parallele aurait reintroduit exactement le risque de desynchronisation silencieuse que
// cette liste blanche a ete ajoutee pour corriger (un futur reglage ajoute a DEFAULTS mais
// oublie ici aurait ete rejete sans erreur pour toujours — trouve en relisant le correctif du
// 2026-10-10 lors de la revue de code qui a suivi).
const ALLOWED_KEYS = Object.keys(DEFAULTS);

// javaPath n'est accepte que s'il pointe reellement vers un executable java present sur le
// disque (pas de verification "java -version" ici, juste l'existence du fichier) — consomme
// ensuite par spawn() dans mcLaunch.js/javaManager.js, donc une primitive d'execution directe
// si on acceptait n'importe quelle chaine.
function isJavaExecutablePath(value) {
  if (typeof value !== "string" || !value) return false;
  if (!/java(\.exe)?$/i.test(value)) return false;
  try {
    return fs.statSync(value).isFile();
  } catch {
    return false;
  }
}

function saveSettings(partial) {
  const current = loadSettings();
  const incoming = partial || {};
  const filtered = {};
  for (const key of ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) filtered[key] = incoming[key];
  }
  if (Object.prototype.hasOwnProperty.call(filtered, "javaPath") && !isJavaExecutablePath(filtered.javaPath)) {
    delete filtered.javaPath;
  }

  const next = { ...current, ...filtered };

  next.memoryMinGB = clampGB(filtered.memoryMinGB ?? current.memoryMinGB, current.memoryMinGB);
  next.memoryMaxGB = clampGB(filtered.memoryMaxGB ?? current.memoryMaxGB, current.memoryMaxGB);
  if (next.memoryMinGB > next.memoryMaxGB) next.memoryMinGB = next.memoryMaxGB;

  if (filtered.onboarded !== undefined) next.onboarded = !!filtered.onboarded;
  if (filtered.alwaysUseRecommendedRam !== undefined) next.alwaysUseRecommendedRam = !!filtered.alwaysUseRecommendedRam;
  if (filtered.alwaysUseCustomRam !== undefined) next.alwaysUseCustomRam = !!filtered.alwaysUseCustomRam;
  // Les deux sont exclusifs : la case qui vient d'etre cochee l'emporte.
  if (next.alwaysUseRecommendedRam && next.alwaysUseCustomRam) {
    if (filtered.alwaysUseCustomRam) next.alwaysUseRecommendedRam = false;
    else next.alwaysUseCustomRam = false;
  }
  if (filtered.locale !== undefined) next.locale = ["fr", "en"].includes(filtered.locale) ? filtered.locale : current.locale;
  if (filtered.theme !== undefined) next.theme = ["system", "dark", "light"].includes(filtered.theme) ? filtered.theme : current.theme;
  if (filtered.compactServerList !== undefined) next.compactServerList = !!filtered.compactServerList;
  if (filtered.logLevel !== undefined) next.logLevel = ["error", "warn", "info", "debug"].includes(filtered.logLevel) ? filtered.logLevel : current.logLevel;
  if (filtered.openConsoleOnLaunch !== undefined) next.openConsoleOnLaunch = !!filtered.openConsoleOnLaunch;
  if (filtered.keepLauncherOpenWhilePlaying !== undefined) next.keepLauncherOpenWhilePlaying = !!filtered.keepLauncherOpenWhilePlaying;
  if (filtered.betaChannel !== undefined) next.betaChannel = !!filtered.betaChannel;

  writeSettingsFile(next);
  return next;
}

// "Reinitialiser les parametres" (Parametres > Debogage) — remet TOUT
// settings.json a DEFAULTS (favoris/recents inclus, la maquette ne les
// distingue pas des autres reglages). Le compte connecte (sessionStore.js)
// et les fichiers du jeu (GAME_ROOT) sont des fichiers separes, jamais
// touches ici.
function resetSettings() {
  writeSettingsFile(DEFAULTS);
  return { ...DEFAULTS };
}

module.exports = { loadSettings, saveSettings, resetSettings, clampGB };
