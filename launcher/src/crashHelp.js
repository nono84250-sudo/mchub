// Aide au crash, première version (26/10, Rushi) : à CHAQUE fermeture du jeu lancé depuis Jouer, le
// launcher lit logs/latest.log et le rapport de crash de cette partie (crash-reports/), et dit le
// problème au joueur quand il le reconnaît. Pas seulement quand le jeu plante : l'écran « mods
// incompatibles » de Fabric/Forge est fermé par le joueur, le code de sortie peut être 0.
// Lecture seule ; rien n'est envoyé nulle part (le joueur copie les logs lui-même s'il veut de l'aide).
// Node pur (aucune dépendance à Electron).
const fsp = require("node:fs/promises");
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

module.exports = { analyze, analyzeGame, logsForHelp };
