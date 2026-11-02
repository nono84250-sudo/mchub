// Aide au crash, première version (26/10, Rushi) : à CHAQUE fermeture du jeu lancé depuis Jouer, le
// launcher lit logs/latest.log et le rapport de crash de cette partie (crash-reports/), et dit le
// problème au joueur quand il le reconnaît. Pas seulement quand le jeu plante : l'écran « mods
// incompatibles » de Fabric/Forge est fermé par le joueur, le code de sortie peut être 0.
// Lecture seule ; rien n'est envoyé nulle part (le joueur copie les logs lui-même s'il veut de l'aide).
// Node pur (aucune dépendance à Electron).
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const TAIL_BYTES = 2 * 1024 * 1024;

async function readTail(file, bytes = TAIL_BYTES) {
  const handle = await fsp.open(file, "r");
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, bytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

// Le journal et le rapport de crash écrits pendant CETTE partie (pas ceux d'une partie d'avant).
async function gameFiles(gameDir, startedAt) {
  const out = { log: null, crash: null };
  const latest = path.join(gameDir, "logs", "latest.log");
  const st = await fsp.stat(latest).catch(() => null);
  if (st && st.mtimeMs >= startedAt - 2_000) out.log = latest;
  const dir = path.join(gameDir, "crash-reports");
  let best = null;
  for (const name of await fsp.readdir(dir).catch(() => [])) {
    if (!name.endsWith(".txt")) continue;
    const s = await fsp.stat(path.join(dir, name)).catch(() => null);
    if (s && s.mtimeMs >= startedAt - 2_000 && (!best || s.mtimeMs > best.mtimeMs)) best = { file: path.join(dir, name), mtimeMs: s.mtimeMs };
  }
  out.crash = best?.file || null;
  return out;
}

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 200);

/**
 * Analyse un journal (+ rapport de crash). Renvoie null si rien d'anormal, sinon
 * { kind, deps: [{ mod, modId, needs, needsId, min, have }], lines: [texte], description }.
 * kind : "deps" (mod manquant ou trop vieux : « Corriger » possible), "java", "memory", "crash".
 */
function analyze(logText, crashText, exitCode) {
  const text = `${logText || ""}\n${crashText || ""}`;
  const deps = [];
  const lines = [];
  // Fabric / Quilt : « Some of your mods are incompatible with the game or each other! »
  const fabric = /Incompatible mods? found!|Some of your mods are incompatible|FormattedException: Mod resolution|Mod resolution (?:encountered|failed)/i.test(text);
  if (fabric) {
    const re = /Mod '([^']+)' \(([^)]+)\) (\S+) requires (?:version (\S+) or later of|any version (?:between \S+ \(inclusive\) and \S+ \(exclusive\) )?of|any version of|version (\S+) of)\s+(?:mod )?'?([^'(,!]+?)'?\s*(?:\(([^)]+)\))?,? (?:which is missing|but only the wrong version is present: (\S+?))!?(?:\r?\n|$)/g;
    let m;
    while ((m = re.exec(text))) {
      deps.push({ mod: m[1], modId: m[2], modVersion: m[3], min: m[4] || m[5] || null, needs: m[6].trim(), needsId: (m[7] || m[6]).trim(), have: m[8] || null });
    }
    // Ancien format : « - Install fabric-api, version 0.92.0 or later. »
    if (!deps.length) {
      const re2 = /- (?:Install|Replace) ([^\s,]+)(?: \[[^\]]*\])?(?:,| with)? (?:any version|version (\S+?) or later)/gi;
      while ((m = re2.exec(text))) deps.push({ mod: null, modId: null, needs: m[1], needsId: m[1], min: m[2] || null, have: null });
    }
  }
  // Forge / NeoForge : « Missing or unsupported mandatory dependencies: »
  if (/Missing or unsupported mandatory dependencies/i.test(text)) {
    const re = /Mod ID: '([^']+)', Requested by: '([^']+)', Expected range: '([^']*)', Actual version: '([^']*)'/g;
    let m;
    while ((m = re.exec(text))) {
      const missing = /MISSING/i.test(m[4]);
      const min = (/[[(]\s*([^,\])]+)/.exec(m[3]) || [])[1] || null;
      deps.push({ mod: m[2], modId: m[2], needs: m[1], needsId: m[1], min, have: missing ? null : m[4] });
    }
  }
  if (deps.length) {
    const seen = new Set();
    const unique = deps.filter((d) => {
      const k = `${d.modId}|${d.needsId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { kind: "deps", deps: unique.slice(0, 20), lines: [], description: null };
  }
  if (/UnsupportedClassVersionError|has been compiled by a more recent version of the Java Runtime/i.test(text)) {
    return { kind: "java", deps: [], lines: [], description: clean((/(\S+ has been compiled by a more recent version[^\n]*)/.exec(text) || [])[1]) };
  }
  if (/java\.lang\.OutOfMemoryError/i.test(text)) return { kind: "memory", deps: [], lines: [], description: null };
  // « Duplicate mandatory mod ids » (31/10, catalogue de bugs) : le jeu peut se fermer avec le code 0.
  if (crashText || /Duplicate mandatory mod ids/i.test(text) || (exitCode != null && exitCode !== 0 && exitCode !== 130 && exitCode !== 143)) {
    const description = clean((/^Description: (.*)$/m.exec(crashText || "") || [])[1]);
    const cause = clean((/^(?:Caused by: )?([\w.$]+(?:Exception|Error)[^\n]*)$/m.exec(crashText || logText || "") || [])[1]);
    // Mod nommé dans le rapport (« Suspected Mod(s) » / « Mod File: »).
    const suspect = clean((/Suspected Mods?:\s*\n?\s*([^\n]+)/.exec(crashText || "") || [])[1]);
    if (suspect && suspect !== "NONE") lines.push(suspect);
    return { kind: "crash", deps: [], lines, description: description || cause || null, exitCode };
  }
  return null;
}

async function analyzeGame(gameDir, { startedAt, exitCode }) {
  const files = await gameFiles(gameDir, startedAt);
  const logText = files.log ? await readTail(files.log).catch(() => "") : "";
  const crashText = files.crash ? await readTail(files.crash, 512 * 1024).catch(() => "") : "";
  const result = analyze(logText, crashText, exitCode);
  return result ? { ...result, files, texts: { log: logText, crash: crashText } } : null;
}

// Texte à coller pour demander de l'aide : la fin du journal et le rapport de crash.
async function logsForHelp(files) {
  const parts = [];
  if (files?.crash) parts.push(`===== ${path.basename(files.crash)} =====\n${await readTail(files.crash, 256 * 1024).catch(() => "")}`);
  if (files?.log) parts.push(`===== latest.log (fin) =====\n${await readTail(files.log, 256 * 1024).catch(() => "")}`);
  // Le nom du compte Windows apparaît dans les chemins : remplacé avant de partager.
  return parts.join("\n\n").replace(/([A-Za-z]:\\Users\\)[^\\]+/gi, "$1<joueur>").replace(/(\/(?:home|Users)\/)[^/]+/g, "$1<joueur>");
}

// Aide Discord dans les bugs (02/11, preview validée par Rushi, Laboratoire « bugDiscord ») : le rapport
// que le joueur copie ou met dans un zip pour l'équipe. Tout passe par sanitize avant de sortir d'ici.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function sessionName() {
  try {
    return os.userInfo().username || "";
  } catch {
    return "";
  }
}
// Jetons et mots de passe masqués, chemins du compte remplacés par « ~ », nom de session retiré.
function sanitize(text, { home = os.homedir(), user = sessionName() } = {}) {
  let out = String(text || "")
    .replace(/(--(?:accessToken|clientId|xuid|uuid)[,=\s]+)[^\s,\]]+/gi, "$1***")
    .replace(/\beyJ[\w-]{10,}\.[\w-]{10,}(?:\.[\w-]+)?/g, "***")
    .replace(/(Bearer\s+)\S+/gi, "$1***")
    .replace(/\b((?:access[_-]?token|refresh[_-]?token|token|password|passwd|pwd|secret|api[_-]?key|authorization)["']?\s*[:=]\s*["']?)[^\s"',;]+/gi, "$1***");
  // Le dossier du compte tel quel d'abord (un nom avec une espace y passe), avec \ / ou \\ entre les parties.
  const parts = String(home || "").split(/[\\/]+/).filter(Boolean);
  if (parts.length > 1) out = out.replace(new RegExp(parts.map(escapeRegExp).join("[\\\\/]+"), "gi"), "~");
  out = out.replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\r\n"':]+/gi, "~").replace(/\/(?:home|Users)\/[^/\r\n"':]+/g, "~");
  if (user.length >= 3) out = out.replace(new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(user)}(?![A-Za-z0-9_])`, "gi"), "~");
  return out;
}

const REPORT_TEXT = {
  fr: {
    title: "rapport", error: "L'erreur", launcher: "Le launcher", pc: "Le PC", install: "L'installation", log: "Journal",
    type: "Type", message: "Message", code: "Code technique", mods: "Mods en cause", known: "Problème connu", when: "Heure",
    version: "Version", name: "Nom", loader: "Chargeur", ram: "RAM", gpu: "Carte graphique", system: "Système",
    kinds: { deps: "Mod manquant ou trop vieux", java: "Mauvaise version de Java", memory: "Manque de mémoire", crash: "Le jeu a planté" },
    none: "(aucune installation)", noLogs: "(aucun rapport de plantage ni latest.log trouvé pour cette partie)", lastLines: "dernières lignes",
    note: "(Chemins remplacés par « ~ » : ni nom de session Windows, ni mot de passe, ni jeton.)",
    noCrash: "Aucun problème de jeu enregistré depuis l'ouverture du launcher.",
  },
  en: {
    title: "report", error: "The error", launcher: "The launcher", pc: "The PC", install: "The install", log: "Log",
    type: "Type", message: "Message", code: "Technical code", mods: "Mods involved", known: "Known problem", when: "Time",
    version: "Version", name: "Name", loader: "Loader", ram: "RAM", gpu: "Graphics card", system: "System",
    kinds: { deps: "Missing or outdated mod", java: "Wrong Java version", memory: "Out of memory", crash: "The game crashed" },
    none: "(no install)", noLogs: "(no crash report or latest.log found for this game)", lastLines: "last lines",
    note: "(Paths replaced by “~”: no Windows account name, password or token.)",
    noCrash: "No game problem recorded since the launcher was opened.",
  },
};
const REPORT_CRASH_LINES = 150;
const REPORT_LOG_LINES = 200;
const ZIP_LOG_BYTES = 5 * 1024 * 1024;
const ZIP_CRASH_BYTES = 1024 * 1024;

const kv = (rows) => rows.filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k} : ${v}`).join("\n");

/**
 * Le texte de « Copier tout », et rapport.txt du zip. `crash` : { files, info, version, known, at } de la
 * dernière partie à problème (ou null), `system` : infos du PC et du launcher (diagnostics.getSystemInfo).
 */
async function buildReport({ lang, crash, system }) {
  const x = REPORT_TEXT[lang] || REPORT_TEXT.fr;
  const info = crash?.info || {};
  const deps = (info.deps || []).map((d) => `${d.mod || d.modId || "?"} → ${d.needs}${d.min ? ` ${d.min}+` : ""}${d.have ? ` (${d.have})` : ""}`);
  const mods = [...(info.lines || []), ...deps].join(" ; ");
  const v = crash?.version || {};
  const logs = [];
  if (crash?.files?.crash) {
    const text = await fsp.readFile(crash.files.crash, "utf8").catch(() => "");
    if (text) logs.push(`--- ${path.basename(crash.files.crash)} ---\n${text.split(/\r?\n/).slice(0, REPORT_CRASH_LINES).join("\n")}`);
  }
  if (crash?.files?.log) {
    const text = await readTail(crash.files.log, 256 * 1024).catch(() => "");
    if (text) logs.push(`--- latest.log (${x.lastLines}) ---\n${text.split(/\r?\n/).slice(-REPORT_LOG_LINES).join("\n")}`);
  }
  const report = [
    `Omniscient Launcher — ${x.title} ${new Date().toISOString().slice(0, 10)}`, "",
    `== ${x.error} ==`,
    crash
      ? kv([[x.type, x.kinds[info.kind] || info.kind], [x.message, info.description], [x.mods, mods], [x.code, info.exitCode], [x.known, crash.known], [x.when, new Date(crash.at || Date.now()).toLocaleString(lang === "en" ? "en-US" : "fr-BE")]])
      : x.noCrash,
    "",
    `== ${x.launcher} ==`, kv([[x.version, system?.launcherVersion], ["Electron", system?.electronVersion]]), "",
    `== ${x.pc} ==`, kv([[x.system, system?.os], ["Java", system?.java], [x.ram, system?.ramGB ? `${system.ramGB} Go` : null], [x.gpu, system?.gpu]]), "",
    `== ${x.install} ==`, crash ? kv([[x.name, v.name], ["Minecraft", v.mc], [x.loader, v.loader ? `${v.loader}${v.loaderVersion ? ` ${v.loaderVersion}` : ""}` : null]]) || x.none : x.none, "",
    `== ${x.log} ==`, logs.join("\n\n") || x.noLogs, "",
    x.note,
  ].join("\n");
  return sanitize(report);
}

// Copies nettoyées à mettre dans le zip : le journal et le rapport de crash, jamais les originaux.
async function writeZipLogs(dir, files) {
  const out = [];
  const add = async (file, rel, bytes) => {
    const text = file ? await readTail(file, bytes).catch(() => null) : null;
    if (text == null) return;
    const abs = path.join(dir, rel);
    await fsp.writeFile(abs, sanitize(text), "utf8");
    out.push({ abs, rel, mtimeMs: Date.now() });
  };
  await add(files?.log, "latest.log", ZIP_LOG_BYTES);
  if (files?.crash) await add(files.crash, path.basename(files.crash), ZIP_CRASH_BYTES);
  return out;
}

module.exports = { analyze, analyzeGame, logsForHelp, sanitize, buildReport, writeZipLogs };
