// Catalogue de bugs (31/10, preview validée par Rushi, Laboratoire « bugCatalog ») : les fiches viennent
// du site (/api/launcher/bugs, avec ETag, toutes les 10 min) et restent sur le disque pour jouer hors
// ligne. Le launcher compare un journal ou un signal avec ces fiches ; une réparation ne suit que des
// gestes de la liste fixe, jamais un ordre libre venu du site, et ne touche jamais aux mondes.
// Node pur (aucune dépendance à Electron) : tout le reste est passé en paramètre.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const REFRESH_MS = 10 * 60_000;
const BACKUPS_KEPT = 3;
const STATUS_RANK = { consent: 0, manual: 1, auto: 2 };

// Repère : texte exact sans tenir compte des majuscules, plusieurs variantes séparées par « || ».
function hasMarker(haystack, marker) {
  const text = String(haystack || "").toLowerCase();
  return String(marker || "")
    .split("||")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .some((p) => text.includes(p));
}

// Rapport de plantage : seulement la cause et la pile d'appels. La suite (« -- System Details -- »,
// « -- Last reload -- ») liste TOUS les mods du pack : un mod présent n'a pas causé ce plantage pour autant.
function crashCause(crashText) {
  const text = String(crashText || "");
  const at = text.search(/^-- (?!Head --)[^\n]*--\s*$/m);
  return at < 0 ? text : text.slice(0, at);
}

const parseVersion = (v) => String(v || "").split(/[.+-]/).map((n) => Number(n) || 0);
function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
}
// Règle Minecraft d'une fiche : vide, version exacte, ou comparaison (« < 1.13 »).
function mcMatches(rule, mc) {
  const r = String(rule || "").trim();
  if (!r) return true;
  const m = /^(<=?|>=?)\s*(.+)$/.exec(r);
  if (!m) return r === String(mc || "");
  const d = compareVersions(mc, m[2]);
  return { "<": d < 0, "<=": d <= 0, ">": d > 0, ">=": d >= 0 }[m[1]];
}

// La fiche d'une partie fermée : le journal pour « log », la cause du rapport pour « crash ». Les fiches
// qui demandent quelque chose au joueur passent avant celles qui se corrigent toutes seules.
function matchGame(entries, { logText, crashText, mc, loader }) {
  const cause = crashCause(crashText);
  const found = (entries || []).filter((e) => {
    const m = e.match || {};
    if (m.where !== "log" && m.where !== "crash") return false;
    if (!mcMatches(m.mc, mc) || (m.loader && m.loader !== loader)) return false;
    return hasMarker(m.where === "log" ? logText : cause, m.text);
  });
  return found.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9))[0] || null;
}

// La fiche d'un signal du launcher. Version et chargeur ne comptent que si l'endroit qui signale les connaît.
function matchSignal(entries, code, { mc, loader } = {}) {
  return (
    (entries || []).find((e) => {
      const m = e.match || {};
      if (m.where !== "launcher" || !hasMarker(code, m.text)) return false;
      if (mc && !mcMatches(m.mc, mc)) return false;
      return !(loader && m.loader && m.loader !== loader);
    }) || null
  );
}

// Un .jar appartient au mod « fabric-api » si son nom est ce nom + séparateur éventuel + chiffre :
// ni quilted-fabric-api-1.0.jar (début différent) ni fabric-api-base-1.0.jar (lettre après le nom).
function jarIsMod(fileName, mod) {
  const name = String(fileName || "").toLowerCase();
  const m = String(mod || "").toLowerCase();
  if (!m || !name.startsWith(m)) return false;
  return /^[-_.]?\d/.test(name.slice(m.length));
}

// Argument d'un remplacement : « cps-plus → 52ZXihCZ ».
function parseReplace(arg) {
  const parts = String(arg || "").split(/→|->/).map((s) => s.trim());
  return parts.length === 2 && parts[0] && parts[1] ? { from: parts[0], to: parts[1] } : null;
}

const canRepairKind = (kind) => ["mine", "cf", "mr"].includes(kind);

async function backupMods(modsDir, now = new Date()) {
  if (!fs.existsSync(modsDir)) return null;
  const root = path.join(path.dirname(modsDir), ".omniscient", "mods-avant-reparation");
  const target = path.join(root, now.toISOString().replace(/[:.]/g, "-"));
  await fsp.mkdir(root, { recursive: true });
  await fsp.cp(modsDir, target, { recursive: true });
  // Un dossier mods pèse parfois plusieurs Go : seules les dernières sauvegardes sont gardées.
  const all = (await fsp.readdir(root)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - BACKUPS_KEPT))) await fsp.rm(path.join(root, old), { recursive: true, force: true });
  return target;
}

// Mods du pack et .jar posés à la main qui correspondent à ce mod. Comparaison exacte sur l'id et le
// slug ; le nom de fichier sert pour ce qui n'a pas d'id (voir jarIsMod).
async function findMod(version, modsDir, mod) {
  const wanted = String(mod || "").toLowerCase();
  const inPack = (version.mods || []).filter((m) => [m.id, m.slug, m.projectId].some((x) => x && String(x).toLowerCase() === wanted) || jarIsMod(m.file?.filename, mod));
  const known = new Set((version.mods || []).map((m) => m.file?.filename).filter(Boolean));
  const names = await fsp.readdir(modsDir).catch(() => []);
  const loose = names.map((n) => n.replace(/\.disabled$/, "")).filter((n, i, list) => list.indexOf(n) === i && !known.has(n) && n.endsWith(".jar") && jarIsMod(n, mod));
  return { inPack, loose };
}

async function removeMod(id, version, modsDir, mod, api) {
  const { inPack, loose } = await findMod(version, modsDir, mod);
  if (!inPack.length && !loose.length) throw new Error(`Mod introuvable dans ce pack : ${mod}.`);
  for (const m of inPack) await api.removeItem(id, { kind: "mod", key: m.id });
  for (const name of loose) await api.removeItem(id, { kind: "mod", key: `file:${name}` });
  const after = await findMod(api.getVersion(id), modsDir, mod);
  // Un autre mod du pack peut en avoir besoin : il revient tout de suite. On le dit au lieu de mentir.
  if (after.inPack.length || after.loose.length) throw new Error(`${mod} est encore demandé par un autre mod du pack.`);
}

// `api` : getVersion, modsDirOf, setLoaderVersion, addMods, removeItem, updateMod, syncFiles, clearCache.
// `step(n)` : 0 sauvegarde, 1 geste, 2 vérification. Replace : ajouter d'abord, retirer ensuite.
async function repair(entry, versionId, api, step = () => {}) {
  const version = api.getVersion(versionId);
  if (!version) throw new Error("Cette version n'existe plus.");
  if (entry.status !== "consent") throw new Error("Pas de réparation pour cette fiche.");
  if (!canRepairKind(version.pack?.kind)) throw new Error("Les mods de ce pack ne se changent pas ici.");
  const modsDir = api.modsDirOf(versionId);
  step(0);
  const backup = await backupMods(modsDir);
  step(1);
  const arg = entry.fixArg;
  switch (entry.fixAction) {
    case "loader":
      await api.setLoaderVersion(versionId, arg);
      break;
    case "remove":
      await removeMod(versionId, version, modsDir, arg, api);
      break;
    case "replace": {
      const r = parseReplace(arg);
      if (!r) throw new Error("Réparation mal décrite dans la fiche.");
      await api.addMods(versionId, r.to);
      await removeMod(versionId, api.getVersion(versionId), modsDir, r.from, api);
      break;
    }
    case "update":
      await api.updateMod(versionId, arg);
      break;
    case "redownload":
      await api.syncFiles(versionId);
      break;
    case "cache":
      await api.clearCache();
      break;
    default:
      throw new Error("Pas de réparation pour cette fiche.");
  }
  step(2);
  return { ok: true, backup };
}

function createBugCatalog({ cacheDir, siteUrl, authHeaders, fetchJson, isOn, log }) {
  const file = path.join(cacheDir, "bug-catalog.json");
  let saved = { etag: null, entries: [] };
  try {
    const read = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(read?.entries)) saved = read;
  } catch {
    /* premier démarrage : aucune fiche */
  }
  let timer = null;
  const signaled = new Set(); // une fenêtre par fiche et par session pour les signaux du launcher

  async function refresh() {
    if (!isOn()) return;
    try {
      const out = await fetchJson(`${siteUrl}/api/launcher/bugs`, { background: true, headers: { ...authHeaders(), ...(saved.etag ? { "If-None-Match": saved.etag } : {}) } }, { withEtag: true });
      if (out?.notModified || !Array.isArray(out?.data?.entries)) return;
      saved = { etag: out.etag || null, entries: out.data.entries };
      await fsp.mkdir(cacheDir, { recursive: true });
      await fsp.writeFile(file, JSON.stringify(saved));
      log?.(`Catalogue de bugs : ${saved.entries.length} fiche(s) reçue(s).`);
    } catch (error) {
      log?.(`Catalogue de bugs : lecture impossible (${error instanceof Error ? error.message : error}), fiches gardées.`, "warn");
    }
  }

  function start(first = Promise.resolve()) {
    Promise.resolve(first).catch(() => {}).then(refresh);
    if (!timer) timer = setInterval(refresh, REFRESH_MS);
  }

  // Compteur du jour. Jamais bloquant : sans réseau, il est simplement perdu.
  function stat(slug, event) {
    if (!isOn()) return;
    fetchJson(`${siteUrl}/api/launcher/bugs/stat`, { background: true, method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ slug, event }) }).catch(() => {});
  }

  const bySlug = (slug) => saved.entries.find((e) => e.slug === slug) || null;
  const game = (ctx) => (isOn() ? matchGame(saved.entries, ctx) : null);
  function signal(code, ctx) {
    if (!isOn()) return null;
    const entry = matchSignal(saved.entries, code, ctx);
    if (!entry || signaled.has(entry.slug)) return null;
    signaled.add(entry.slug);
    return entry;
  }

  return { refresh, start, stat, bySlug, game, signal };
}

module.exports = { createBugCatalog, hasMarker, crashCause, mcMatches, matchGame, matchSignal, jarIsMod, parseReplace, canRepairKind, backupMods, repair };
