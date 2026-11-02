// Packs du mode Jouer (26/10, previews validées par Rushi) : « Mon pack » (mods choisis sur
// Modrinth, liste CurseForge à la main), import d'un export CurseForge (.zip) et vérification des
// mods avant de jouer. Node pur (aucune dépendance à Electron), comme modpack.js.
//
// Règles (Rushi, 26/10) :
// - Modrinth : le launcher télécharge (cdn.modrinth.com seulement), comme pour les packs officiels.
// - CurseForge, Mon pack : JAMAIS de téléchargement par le launcher, même pour un mod nécessaire.
//   Le joueur ouvre la page exacte du fichier et le télécharge ; le launcher le retrouve dans
//   Téléchargements (taille + SHA-1, voir modpack.js/findManualFiles).
// - Export CurseForge d'un joueur : mêmes règles que les packs des serveurs (fichiers autorisés par
//   leur auteur via notre route du site, les autres à la main).
// - Rien n'est publié : un pack reste sur ce PC.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { listZip, readZipEntry } = require("./zipStream");

const MODRINTH_API = "https://api.modrinth.com/v2";
const MODRINTH_USER_AGENT = "Omniscient-Launcher (app.omniscient.launcher)";
const LOADER_IDS = ["neoforge", "forge", "fabric", "quilt"];
// Mods Fabric acceptés par Quilt (Quilt charge les mods Fabric).
const MR_LOADERS = { fabric: ["fabric"], quilt: ["quilt", "fabric"], forge: ["forge"], neoforge: ["neoforge"] };
// Les packs de ressources qui ont besoin d'un mod (modèles et textures « à la OptiFine »).
const RP_NEEDS = {
  entity_model_features: { slug: "entity-model-features", name: "Entity Model Features" },
  entity_texture_features: { slug: "entitytexturefeatures", name: "Entity Texture Features" },
};
// Mod proposé à la création d'un Mon pack (Rushi, 26/10) : sa licence permet de l'ajouter à un pack
// quand il est téléchargé depuis sa page Modrinth (pas de JAR redistribué par nous).
const CRASH_ASSISTANT = "crash-assistant";

// --- Modrinth ----------------------------------------------------------------------------------
const cache = new Map();
async function mrGet(pathAndQuery, { ttl = 30 * 60_000 } = {}) {
  const hit = cache.get(pathAndQuery);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  const res = await fetch(`${MODRINTH_API}${pathAndQuery}`, { headers: { "User-Agent": MODRINTH_USER_AGENT }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Modrinth a répondu ${res.status}.`);
  const data = await res.json();
  cache.set(pathAndQuery, { at: Date.now(), data });
  if (cache.size > 600) cache.delete(cache.keys().next().value);
  return data;
}
const q = (v) => encodeURIComponent(JSON.stringify(v));

function cleanFile(file) {
  try {
    const url = new URL(file.url);
    if (url.protocol !== "https:" || url.hostname !== "cdn.modrinth.com") return null;
  } catch {
    return null;
  }
  if (!/^[\w.+() \[\]!'-]+\.jar$/i.test(file.filename || "")) return null;
  return { filename: file.filename, url: file.url, sha1: file.hashes?.sha1 || null, size: file.size || null };
}

// Versions d'un projet pour cette version de Minecraft et ce chargeur, la plus récente d'abord.
async function mrVersions(idOrSlug, mc, loader) {
  const list = await mrGet(`/project/${encodeURIComponent(idOrSlug)}/version?loaders=${q(MR_LOADERS[loader] || [loader])}&game_versions=${q([mc])}`);
  return (list || [])
    .map((v) => {
      const file = cleanFile((v.files || []).find((f) => f.primary) || (v.files || [])[0] || {});
      return file && {
        id: v.id,
        projectId: v.project_id,
        v: v.version_number,
        type: v.version_type,
        deps: (v.dependencies || []).filter((d) => d.dependency_type === "required" && d.project_id).map((d) => ({ projectId: d.project_id, versionId: d.version_id || null })),
        file,
      };
    })
    .filter(Boolean);
}

async function mrProjects(ids) {
  const out = new Map();
  const list = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < list.length; i += 100) {
    const data = (await mrGet(`/projects?ids=${q(list.slice(i, i + 100))}`)) || [];
    for (const p of data) {
      out.set(p.id, p);
      out.set(p.slug, p);
    }
  }
  return out;
}

const fmtDownloads = (n, fr) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", fr ? "," : ".")} M` : `${Math.round(n / 1e3)} k`) + (fr ? " téléchargements" : " downloads");

// Recherche « Mon pack » : mods pour ce chargeur ; ceux qui n'existent pas pour cette version de
// Minecraft sont montrés « Pas pour … ». Versions (et mods nécessaires) des mods compatibles.
async function searchModrinth(query, { mc, loader, fr = true }) {
  const facets = [["project_type:mod"], (MR_LOADERS[loader] || [loader]).map((l) => `categories:${l}`)];
  const text = String(query || "").trim().slice(0, 80);
  const data = await mrGet(`/search?limit=${text ? 20 : 12}&index=${text ? "relevance" : "downloads"}&facets=${q(facets)}${text ? `&query=${encodeURIComponent(text)}` : ""}`, { ttl: 5 * 60_000 });
  const hits = data?.hits || [];
  const mods = await Promise.all(
    hits.map(async (h) => {
      const compatible = (h.versions || []).includes(mc);
      let versions = [];
      if (compatible) versions = await mrVersions(h.project_id, mc, loader).catch(() => []);
      return { slug: h.slug, projectId: h.project_id, name: h.title, author: h.author, downloads: fmtDownloads(h.downloads || 0, fr), icon: h.icon_url || null, compatible: compatible && versions.length > 0, versions };
    }),
  );
  // Noms des mods nécessaires (une seule requête pour toute la liste).
  const depIds = mods.flatMap((m) => m.versions.flatMap((v) => v.deps.map((d) => d.projectId)));
  const projects = depIds.length ? await mrProjects(depIds).catch(() => new Map()) : new Map();
  for (const m of mods) {
    m.versions = m.versions.slice(0, 30).map((v) => ({
      v: v.v,
      id: v.id,
      deps: v.deps.map((d) => ({ slug: projects.get(d.projectId)?.slug || d.projectId, name: projects.get(d.projectId)?.title || d.projectId, version: "", projectId: d.projectId, versionId: d.versionId })),
    }));
  }
  return mods;
}

/**
 * Liste finale des mods Modrinth d'un pack : chaque mod choisi dans sa version, plus ses mods
 * nécessaires (récursif), dans la version demandée par le mod si elle est imposée, sinon la plus
 * récente. `wanted` : [{ slug, version (version_number), on }]. Renvoie des entrées de pack.
 */
async function resolveModrinth(wanted, { mc, loader, keep = [] }) {
  const out = new Map();
  const byProject = new Map();
  const add = async (idOrSlug, pickVersion, { auto, by } = {}) => {
    const versions = await mrVersions(idOrSlug, mc, loader);
    if (!versions.length) return null;
    const projectId = versions[0].projectId;
    if (byProject.has(projectId)) {
      const cur = byProject.get(projectId);
      if (by) cur.by = [...new Set([...(cur.by || []), by])];
      return cur;
    }
    const chosen = (pickVersion && versions.find((v) => v.v === pickVersion || v.id === pickVersion)) || versions[0];
    const entry = {
      id: null,
      projectId,
      source: "mr",
      version: chosen.v,
      versionId: chosen.id,
      file: chosen.file,
      deps: chosen.deps,
      auto: !!auto,
      by: by ? [by] : [],
      on: true,
    };
    byProject.set(projectId, entry);
    return entry;
  };
  for (const w of wanted) {
    const e = await add(w.slug, w.version);
    if (e && w.on === false) e.on = false;
    if (e) e.auto = false;
  }
  // Mods nécessaires : par vagues, jusqu'à ce que plus rien ne manque.
  for (let round = 0; round < 6; round++) {
    let added = false;
    for (const e of [...byProject.values()]) {
      for (const d of e.deps || []) {
        if (byProject.has(d.projectId)) {
          const cur = byProject.get(d.projectId);
          if (cur.auto) cur.by = [...new Set([...(cur.by || []), e.projectId])];
          continue;
        }
        const pinned = d.versionId ? keep.find((k) => k.versionId === d.versionId) : null;
        const n = await add(d.projectId, d.versionId || keep.find((k) => k.projectId === d.projectId)?.version || pinned?.version, { auto: true, by: e.projectId });
        if (n) added = true;
      }
    }
    if (!added) break;
  }
  const projects = await mrProjects([...byProject.keys()]);
  for (const e of byProject.values()) {
    const p = projects.get(e.projectId);
    e.id = p?.slug || e.projectId;
    e.name = p?.title || e.file.filename;
    e.author = null;
    e.icon = p?.icon_url || null;
    out.set(e.projectId, e);
  }
  // `by` : identifiants de projet → slugs (affichage « nécessaire pour … »).
  for (const e of out.values()) e.by = (e.by || []).map((pid) => out.get(pid)?.id || pid);
  return [...out.values()];
}

// Chargeur à installer pour un Mon pack : version stable la plus récente pour cette version de Minecraft.
async function latestLoaderVersion(loader, mc) {
  const get = async (url) => {
    const res = await fetch(url, { headers: { "User-Agent": MODRINTH_USER_AGENT }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  if (loader === "fabric") {
    const list = await get(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mc)}`);
    return (list.find((x) => x.loader?.stable) || list[0])?.loader?.version || null;
  }
  if (loader === "quilt") {
    const list = await get(`https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(mc)}`);
    return (list.find((x) => !/beta|pre|rc/i.test(x.loader?.version || "")) || list[0])?.loader?.version || null;
  }
  if (loader === "forge") {
    const promos = (await get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")).promos || {};
    return promos[`${mc}-recommended`] || promos[`${mc}-latest`] || null;
  }
  if (loader === "neoforge") {
    // NeoForge numérote d'après Minecraft : 1.21.1 → 21.1.x, 1.20.4 → 20.4.x, 1.21 → 21.0.x.
    const m = /^1\.(\d+)(?:\.(\d+))?$/.exec(mc);
    if (!m) return null;
    const prefix = `${m[1]}.${m[2] || 0}.`;
    const list = ((await get("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge")).versions || []).filter((v) => v.startsWith(prefix));
    return list.filter((v) => !/beta|alpha/i.test(v)).pop() || list.pop() || null;
  }
  return null;
}

// --- Lecture des .jar (mods) ---------------------------------------------------------------------
// Ce que chaque mod fournit et demande : fabric.mod.json, quilt.mod.json, META-INF/mods.toml ou
// neoforge.mods.toml, et les mods inclus dans le jar (jar-in-jar). Lecture seule.
function tomlTables(text) {
  const tables = [];
  let cur = { name: "", values: {} };
  tables.push(cur);
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    // Commentaire après l'en-tête (« [[mods]] #mandatory », Placebo, JEI… 27/10) : accepté. Avant, la
    // table « mods » était manquée : le mod n'avait pas d'identifiant et ceux qui en dépendent le
    // croyaient absent (79 problèmes faux sur ATM10).
    const t = /^\[\[\s*([^\]]+?)\s*\]\]\s*(?:#.*)?$/.exec(line) || /^\[\s*([^\]]+?)\s*\]\s*(?:#.*)?$/.exec(line);
    if (t) {
      cur = { name: t[1], values: {} };
      tables.push(cur);
      continue;
    }
    const kv = /^([\w."-]+)\s*=\s*(.*)$/.exec(line);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value.startsWith('"""') || value.startsWith("'''")) {
      const end = value.slice(0, 3);
      let body = value.slice(3);
      while (!body.includes(end) && i + 1 < lines.length) body += `\n${lines[++i]}`;
      value = body.slice(0, body.indexOf(end));
    } else if (value.startsWith('"')) value = (/^"((?:[^"\\]|\\.)*)"/.exec(value) || [, ""])[1];
    else if (value.startsWith("'")) value = (/^'([^']*)'/.exec(value) || [, ""])[1];
    else value = value.replace(/\s+#.*$/, "");
    cur.values[kv[1].replace(/"/g, "")] = value;
  }
  return tables;
}

function readManifestVersion(zip) {
  const mf = zip.getEntry("META-INF/MANIFEST.MF");
  if (!mf) return null;
  const m = /Implementation-Version:\s*(\S+)/.exec(zip.readAsText(mf));
  return m ? m[1] : null;
}

let bugSignal = null;
const setBugSignal = (fn) => {
  bugSignal = fn;
};
// `prefer` : chargeur du pack. Un jar multi-chargeurs (27/10, ATM10 : journeymap-neoforge contient aussi
// un fabric.mod.json « wrongloader », Nullscape les quatre) est lu avec la description de ce chargeur.
// « forge-legacy » (30/10) : pack Forge avant 1.13. Certains jars 1.12.2 contiennent un mods.toml
// oublié de leur version 1.16 (EnhancedVisuals v1.4.4 : « CreativeCore 2.0.0 ou plus ») que Forge
// 1.12.2 ignore ; seul mcmod.info compte, sinon le launcher signale un faux problème impossible à corriger.
function jarMeta(zip, depth = 0, prefer = null) {
  const legacyPack = prefer === "forge-legacy";
  if (legacyPack) prefer = "forge";
  const meta = { loader: null, loaders: [], ids: [], provides: [], name: null, version: null, deps: [], nested: [] };
  const fab = zip.getEntry("fabric.mod.json");
  const qui = zip.getEntry("quilt.mod.json");
  const neo = zip.getEntry("META-INF/neoforge.mods.toml");
  const old = zip.getEntry("META-INF/mods.toml");
  const toml = prefer === "forge" ? old || neo : neo || old;
  meta.loaders = [qui && "quilt", fab && "fabric", neo && "neoforge", old && "forge"].filter(Boolean);
  // Forge avant 1.13 (28/10) : « mcmod.info », lu seulement pour le nom, l'id et le chargeur (ses
  // dépendances sont trop rarement remplies pour servir de contrôle).
  const legacy = zip.getEntry("mcmod.info");
  if (legacy && !meta.loaders.length) meta.loaders.push("forge");
  let use = qui ? "quilt" : fab ? "fabric" : toml ? "toml" : legacy ? "mcmod" : null;
  if ((prefer === "neoforge" || prefer === "forge") && toml) use = "toml";
  else if (prefer === "fabric" && fab) use = "fabric";
  else if (prefer === "quilt" && (qui || fab)) use = qui ? "quilt" : "fabric";
  if (legacyPack && legacy) use = "mcmod";
  // Catalogue de bugs (31/10) : le faux problème « CreativeCore 2.0.0 » vient d'être écarté (voir plus haut).
  if (legacyPack && legacy && old) {
    try {
      if (/modId\s*=\s*"creativecore"/.test(zip.readAsText(old))) bugSignal?.("creativecore [2.0.0,)", { loader: "forge" });
    } catch {
      /* mods.toml illisible : Forge 1.12.2 l'ignore de toute façon */
    }
  }
  try {
    if (use === "quilt") {
      const j = JSON.parse(zip.readAsText(qui).replace(/^﻿/, ""));
      const ql = j.quilt_loader || {};
      meta.loader = "quilt";
      if (ql.id) meta.ids.push(ql.id);
      meta.version = ql.version || null;
      meta.name = ql.metadata?.name || null;
      for (const p of [].concat(ql.provides || [])) meta.provides.push(typeof p === "string" ? p : p?.id);
      for (const d of [].concat(ql.depends || [])) {
        if (typeof d === "string") meta.deps.push({ id: d, range: "*", kind: "fabric" });
        else if (d?.id && !d.optional) meta.deps.push({ id: d.id, range: d.versions || "*", kind: "fabric" });
      }
      for (const n of [].concat(ql.jars || [])) meta.nested.push(typeof n === "string" ? n : n?.file);
    } else if (use === "fabric") {
      // Certains fabric.mod.json contiennent des retours à la ligne dans des chaînes : tolérés.
      const j = JSON.parse(zip.readAsText(fab).replace(/^﻿/, "").replace(/[\u0000-\u001f]+/g, " "));
      meta.loader = "fabric";
      if (j.id) meta.ids.push(j.id);
      meta.version = j.version || null;
      meta.name = j.name || null;
      for (const p of [].concat(j.provides || [])) meta.provides.push(p);
      for (const [id, range] of Object.entries(j.depends || {})) meta.deps.push({ id, range, kind: "fabric" });
      for (const n of [].concat(j.jars || [])) meta.nested.push(n?.file);
    } else if (use === "mcmod") {
      const j = JSON.parse(zip.readAsText(legacy).replace(/^\uFEFF/, "").replace(/[\u0000-\u001f]+/g, " "));
      const list = Array.isArray(j) ? j : Array.isArray(j?.modList) ? j.modList : [];
      meta.loader = "forge";
      for (const m of list) {
        if (m?.modid) meta.ids.push(String(m.modid));
        if (!meta.name && m?.name) meta.name = String(m.name);
        if (!meta.version && m?.version && !String(m.version).includes("${")) meta.version = String(m.version);
      }
    } else if (use === "toml") {
      const text = zip.readAsText(toml);
      const tables = tomlTables(text);
      meta.loader = toml.entryName.includes("neoforge") ? "neoforge" : "forge";
      const mods = tables.filter((t) => t.name === "mods");
      // Autre écriture TOML : « mods = [ { modId = '…', version = '…' }, ] » (27/10 : packs de données
      // convertis en mods par Modrinth, structures de Moog).
      if (!mods.length) {
        const arr = /^\s*mods\s*=\s*\[([\s\S]*?)^\s*\]/m.exec(text);
        for (const t of arr ? arr[1].match(/\{[^}]*\}/g) || [] : []) {
          const values = {};
          for (const kv of t.matchAll(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) values[kv[1]] = kv[2] ?? kv[3];
          mods.push({ name: "mods", values });
        }
      }
      // Un jar peut déclarer plusieurs mods, chacun avec sa version (27/10 : Accessories CCLayer
      // déclare « cclayer » 0.beta.28 et « curios » 9.3.1, Embeddium aussi « rubidium »).
      meta.idVersions = {};
      for (const m of mods) {
        let v = m.values.version || null;
        if (v && v.includes("${")) v = readManifestVersion(zip);
        if (m.values.modId) {
          meta.ids.push(m.values.modId);
          meta.idVersions[m.values.modId] = v;
        }
        if (!meta.name) meta.name = m.values.displayName || null;
        if (!meta.version) meta.version = v;
      }
      for (const t of tables) {
        const m = /^dependencies\.(.+)$/.exec(t.name);
        if (!m) continue;
        const v = t.values;
        const required = v.type ? String(v.type).toLowerCase() === "required" : String(v.mandatory) !== "false";
        if (!required || String(v.side || "BOTH").toUpperCase() === "SERVER") continue;
        if (v.modId) meta.deps.push({ id: v.modId, range: v.versionRange || "", kind: "maven" });
      }
    }
  } catch {
    /* fichier de description illisible : le mod est gardé sans contrôle */
  }
  // Jars inclus NeoForge/Forge. Lus même sans fichier de description à la racine (27/10, ATM10 :
  // « kotlinforforge-…-all.jar » n'est qu'un conteneur, le vrai mod est dans META-INF/jarjar).
  // Sinytra Connector pour Forge 1.20.1 : le mod est déclaré dans le MANIFEST (« Embedded-Dependencies-Mod »).
  const mf = zip.getEntry("META-INF/MANIFEST.MF");
  if (mf) {
    try {
      const em = /^Embedded-Dependencies-Mod:\s*(.+)$/m.exec(zip.readAsText(mf).replace(/\r?\n /g, ""));
      if (em) meta.nested.push(em[1].trim());
    } catch {
      /* MANIFEST illisible */
    }
  }
  const jarjar = zip.getEntry("META-INF/jarjar/metadata.json");
  if (jarjar) {
    try {
      for (const j of JSON.parse(zip.readAsText(jarjar)).jars || []) meta.nested.push(j.path);
    } catch {
      /* liste illisible : ignorée */
    }
  }
  meta.provides = meta.provides.filter(Boolean);
  // Mods inclus (ex. modules de Fabric API, MixinExtras) : ils comptent comme présents.
  if (depth < 2) {
    for (const n of meta.nested.filter(Boolean)) {
      const e = zip.getEntry(n);
      if (!e) continue;
      try {
        const inner = jarMeta(new AdmZip(e.getData()), depth + 1, legacyPack ? "forge-legacy" : prefer);
        for (const id of [...inner.ids, ...inner.provides]) meta.provides.push(id);
        meta.innerVersions = { ...(meta.innerVersions || {}), ...(inner.innerVersions || {}), ...Object.fromEntries(inner.ids.map((id) => [id, inner.version])) };
      } catch {
        /* jar inclus illisible */
      }
    }
  }
  delete meta.nested;
  return meta;
}

// Lecture rapide (27/10, Rushi : la page d'ATM10 mettait très longtemps à s'ouvrir) : seulement les
// fichiers de description et les jars inclus, pas tout le .jar en mémoire (plusieurs Go pour 400 mods).
const META_FILES = ["fabric.mod.json", "quilt.mod.json", "META-INF/neoforge.mods.toml", "META-INF/mods.toml", "META-INF/MANIFEST.MF", "META-INF/jarjar/metadata.json", "mcmod.info"];
async function readJarMeta(file, { loader = null } = {}) {
  try {
    const entries = await listZip(file);
    const data = new Map();
    for (const e of entries) {
      const nested = /^META-INF\/(?:jars|jarjar)\/.+\.jar$/i.test(e.name) && e.size < 32 * 1024 * 1024;
      if (META_FILES.includes(e.name) || nested) data.set(e.name, await readZipEntry(file, e));
    }
    const zip = {
      getEntry: (n) => (data.has(n) ? { entryName: n, getData: () => data.get(n) } : null),
      readAsText: (e) => data.get(e.entryName).toString("utf8"),
    };
    return jarMeta(zip, 0, loader);
  } catch {
    // Archive que notre lecteur refuse : ancienne lecture complète.
  }
  try {
    return jarMeta(new AdmZip(file), 0, loader);
  } catch {
    return null;
  }
}

// --- Versions et plages de versions ------------------------------------------------------------
function parseVer(s) {
  const m = /^v?(\d+(?:\.\d+)*)/.exec(String(s || "").trim().split("+")[0]);
  return m ? m[1].split(".").map(Number) : null;
}
function cmpVer(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}
function fabricPart(ver, part) {
  part = part.trim();
  if (!part || part === "*") return true;
  const m = /^(>=|<=|>|<|=|~|\^)?\s*(.+)$/.exec(part);
  const op = m[1] || "";
  const raw = m[2];
  if (/[xX*]$/.test(raw)) {
    const pre = raw.replace(/\.?[xX*]$/, "");
    const p = parseVer(pre);
    return !p || p.every((n, i) => ver[i] === n);
  }
  const t = parseVer(raw);
  if (!t) return true;
  const c = cmpVer(ver, t);
  if (op === ">=") return c >= 0;
  if (op === ">") return c > 0;
  if (op === "<=") return c <= 0;
  if (op === "<") return c < 0;
  if (op === "~") return c >= 0 && ver[0] === t[0] && (ver[1] || 0) === (t[1] || 0);
  if (op === "^") return c >= 0 && ver[0] === t[0]; // Fabric : même version majeure, même pour 0.x
  return c === 0 || cmpVer(ver.slice(0, t.length), t) === 0;
}
function mavenSatisfies(ver, range) {
  const r = String(range || "").trim();
  if (!r || r === "*" || !/[[(]/.test(r)) return true; // sans crochets : simple souhait
  const parts = r.match(/[[(][^\])]*[\])]/g) || [];
  if (!parts.length) return true;
  return parts.some((p) => {
    const [lo, hi] = p.slice(1, -1).split(",").map((x) => (x === undefined ? undefined : x.trim()));
    if (!p.includes(",")) return !lo || mavenCompare(ver, lo) === 0;
    if (lo && (p[0] === "[" ? mavenCompare(ver, lo) < 0 : mavenCompare(ver, lo) <= 0)) return false;
    if (hi && (p.endsWith("]") ? mavenCompare(ver, hi) > 0 : mavenCompare(ver, hi) >= 0)) return false;
    return true;
  });
}
// Version Maven comparée comme NeoForge/Forge (ComparableVersion de Maven, 27/10) : « 1.20.1-1.3.2 »
// est plus récent que « 1.20-1.2 », « 0.12.15.5-beta.1 » que « 0.12.15-beta.9 », « 1.6.9a » que
// « 1.6.9 ». Le suffixe « +… » (version de Minecraft) est ignoré.
const MQ = ["alpha", "beta", "milestone", "rc", "snapshot", "", "sp"];
function mvItem(digit, s, followedByDigit = false) {
  if (digit) return { t: "i", v: BigInt(s.replace(/^0+(?=\d)/, "")) };
  let v = s;
  if (followedByDigit && v.length === 1) v = { a: "alpha", b: "beta", m: "milestone" }[v] || v;
  v = { ga: "", final: "", release: "", cr: "rc" }[v] ?? v;
  return { t: "s", v };
}
function mavenVer(str) {
  const s = String(str || "").split("+")[0].trim().toLowerCase();
  if (!/\d/.test(s)) return null;
  const root = { t: "l", v: [] };
  const stack = [root];
  let list = root;
  let digit = false;
  let start = 0;
  const sub = () => { const l = { t: "l", v: [] }; list.v.push(l); list = l; stack.push(l); };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === ".") {
      list.v.push(i === start ? { t: "i", v: 0n } : mvItem(digit, s.slice(start, i)));
      start = i + 1;
    } else if (c === "-") {
      list.v.push(i === start ? { t: "i", v: 0n } : mvItem(digit, s.slice(start, i)));
      start = i + 1;
      sub();
    } else if (c >= "0" && c <= "9") {
      if (!digit && i > start) {
        list.v.push(mvItem(false, s.slice(start, i), true));
        start = i;
        sub();
      }
      digit = true;
    } else {
      if (digit && i > start) {
        list.v.push(mvItem(true, s.slice(start, i)));
        start = i;
        sub();
      }
      digit = false;
    }
  }
  if (s.length > start) list.v.push(mvItem(digit, s.slice(start)));
  const isNull = (x) => (x.t === "i" ? x.v === 0n : x.t === "s" ? x.v === "" : x.v.length === 0);
  while (stack.length) {
    const l = stack.pop();
    for (let i = l.v.length - 1; i >= 0; i--) {
      if (isNull(l.v[i])) l.v.splice(i, 1);
      else if (l.v[i].t !== "l") break;
    }
  }
  return root;
}
const mq = (q) => { const i = MQ.indexOf(q); return i >= 0 ? String(i) : `${MQ.length}-${q}`; };
function mvCmp(a, b) {
  if (a.t === "i") {
    if (!b) return a.v === 0n ? 0 : 1;
    if (b.t === "i") return a.v === b.v ? 0 : a.v < b.v ? -1 : 1;
    return 1;
  }
  if (a.t === "s") {
    if (!b) return mq(a.v) < mq("") ? -1 : mq(a.v) > mq("") ? 1 : 0;
    if (b.t === "s") return mq(a.v) < mq(b.v) ? -1 : mq(a.v) > mq(b.v) ? 1 : 0;
    return -1;
  }
  if (!b) return a.v.length ? mvCmp(a.v[0], null) : 0;
  if (b.t === "i") return -1;
  if (b.t === "s") return 1;
  for (let i = 0; i < Math.max(a.v.length, b.v.length); i++) {
    const l = a.v[i], r = b.v[i];
    const c = !l ? (!r ? 0 : -mvCmp(r, null)) : mvCmp(l, r || null);
    if (c) return c;
  }
  return 0;
}
function mavenCompare(a, b) {
  const x = mavenVer(a), y = mavenVer(b);
  return x && y ? mvCmp(x, y) : 0;
}
function satisfies(version, dep) {
  const ver = parseVer(version);
  if (!ver) return true; // version illisible : on ne bloque pas
  if (dep.kind === "maven") return mavenSatisfies(version, dep.range);
  const ranges = [].concat(dep.range ?? "*");
  return ranges.some((r) => String(r).split(/\s+/).every((part) => fabricPart(ver, part)));
}
// Version minimale lisible d'une plage (« 0.16.0 » pour « >=0.16.0 » ou « [0.16.0,) »).
function minOf(dep) {
  const r = [].concat(dep.range ?? "")[0];
  const m = /(?:>=|>|\^|~|\[|\()\s*v?([\d][\w.+-]*)/.exec(String(r || ""));
  if (m) return m[1].replace(/,$/, "");
  return /^\d/.test(String(r || "")) ? String(r) : null;
}

// Identifiants toujours présents (le jeu et les chargeurs eux-mêmes).
const BUILTIN = new Set(["minecraft", "java", "fabricloader", "fabric-loader", "quilt_loader", "quilt_base", "forge", "neoforge", "javafml", "lowcodefml", "fml", "mixin", "mixinextras"]);

/**
 * Problèmes d'un pack : un mod demande un autre mod absent, ou dans une version trop ancienne.
 * `jars` : [{ ref, on, meta }] (ref = l'entrée du pack). Renvoie [{ type, a, b?, depId, min, have }].
 */
const newer = (a, b) => !!a && !!b && mavenCompare(a, b) > 0;
// Alias que Connector connaît déjà (ids Fabric vers ids Forge/NeoForge).
const CONNECTOR_ALIAS = { "cloth-config2": "cloth_config", "cloth-config": "cloth_config", "fabric-api": "fabric_api", "fabric": "fabric_api" };
function checkJars(jars, { loader }) {
  const providers = new Map();
  for (const j of jars) {
    if (!j.on || !j.meta) continue;
    for (const id of j.meta.ids) {
      const version = j.meta.idVersions?.[id] || j.meta.version;
      const cur = providers.get(id);
      // Le même mod deux fois : le jeu garde le plus récent (27/10, lionfishapi 2.4 et 3.0).
      if (!cur || newer(version, cur.version)) providers.set(id, { ref: j.ref, version, own: true });
    }
  }
  // Un même module inclus dans plusieurs mods (ex. une API Fabric) : le jeu garde le plus récent.
  const providedBy = new Map();
  for (const j of jars) {
    if (!j.on || !j.meta) continue;
    for (const id of j.meta.provides) {
      providedBy.set(id, [...(providedBy.get(id) || []), j.ref]);
      const version = j.meta.innerVersions?.[id] || null;
      const cur = providers.get(id);
      if (!cur || (!cur.own && newer(version, cur.version))) providers.set(id, { ref: j.ref, version });
    }
  }
  const out = [];
  // Sinytra Connector (27/10, Bubule Land RP 2) : fait tourner les mods Fabric sur NeoForge/Forge, avec
  // Forgified Fabric API pour les modules « fabric-… ». Ces mods ne sont alors pas « du mauvais chargeur ».
  const connector = (loader === "neoforge" || loader === "forge") && (providers.has("connector") || providers.has("connectormod"));
  for (const j of jars) {
    if (!j.on || !j.meta) continue;
    const viaConnector = connector && (j.meta.loader === "fabric" || j.meta.loader === "quilt");
    // Fabric écarte un mod remplacé par un autre qui « fournit » le même id (27/10 : Sodium 0.6
    // fournit « indium », le vieux Indium est ignoré au lieu de bloquer le jeu).
    if ((loader === "fabric" || loader === "quilt") && j.meta.ids.some((id) => (providedBy.get(id) || []).some((r) => r !== j.ref))) continue;
    // Un mod pour un autre chargeur (ex. un mod Forge dans un pack Fabric) ne se chargera pas.
    const fits = (l) => l === loader || (loader === "quilt" && l === "fabric") || (loader === "neoforge" && l === "forge");
    if (j.meta.loader && loader && !viaConnector && !fits(j.meta.loader) && !(j.meta.loaders || []).some(fits)) {
      out.push({ type: "loader", a: j.ref, loader: j.meta.loader });
      continue;
    }
    for (const d of j.meta.deps) {
      if (BUILTIN.has(d.id)) continue;
      if (viaConnector && /^fabric(?:-|_|$)|^quilt/.test(d.id) && !providers.has(d.id)) continue;
      // Connector traduit les ids Fabric (« fabric-api-base » devient « fabric_api_base »).
      const p = providers.get(d.id) || (viaConnector ? providers.get(CONNECTOR_ALIAS[d.id] || d.id.replace(/-/g, "_")) : null);
      if (!p) {
        out.push({ type: "missing", a: j.ref, depId: d.id, min: minOf(d) });
        continue;
      }
      if (p.ref === j.ref) continue;
      if (p.version && !satisfies(p.version, d)) out.push({ type: "version", a: j.ref, b: p.ref, depId: d.id, min: minOf(d), have: p.version });
    }
  }
  return out;
}

// --- Packs de ressources -------------------------------------------------------------------------
// Ce dont un pack de ressources a besoin : modèles d'entités (EMF) et textures aléatoires (ETF).
async function resourcePackNeeds(file) {
  let names = [];
  try {
    const st = await fsp.stat(file);
    if (st.isDirectory()) {
      const walk = async (dir, rel, depth) => {
        if (depth > 6 || names.length > 20000) return;
        for (const e of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
          const r = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) await walk(path.join(dir, e.name), r, depth + 1);
          else names.push(r);
        }
      };
      await walk(file, "", 0);
    } else names = (await listZip(file)).map((e) => e.name);
  } catch {
    return [];
  }
  const needs = [];
  if (names.some((n) => /assets\/[^/]+\/(optifine\/cem|emf\/cem)\/.+\.(jem|jpm)$/i.test(n))) needs.push("entity_model_features");
  if (needs.length || names.some((n) => /assets\/[^/]+\/(optifine\/(random|mob)|etf)\//i.test(n))) needs.push("entity_texture_features");
  return needs;
}

// --- Export CurseForge (.zip) --------------------------------------------------------------------
const SKIP_IN_CFG = /^(mods|resourcepacks|shaderpacks|saves|screenshots|logs|crash-reports)\//i;
async function readCfExport(zipFile, { readLevel }) {
  const entries = await listZip(zipFile);
  const manifestEntry = entries.find((e) => e.name === "manifest.json");
  if (!manifestEntry) throw new Error("Ce fichier n'est pas un export CurseForge (manifest.json introuvable). Dans l'appli CurseForge : ⋯ › « Exporter le profil ».");
  const manifest = JSON.parse((await readZipEntry(zipFile, manifestEntry)).toString("utf8"));
  if (manifest.manifestType !== "minecraftModpack" || !manifest.minecraft?.version || !Array.isArray(manifest.files)) throw new Error("Export CurseForge illisible ou incomplet.");
  const loaders = manifest.minecraft.modLoaders || [];
  const loaderId = (loaders.find((l) => l.primary) || loaders[0])?.id || null;
  const lm = /^(neoforge|forge|fabric|quilt)-(.+)$/.exec(loaderId || "");
  const ov = `${(manifest.overrides || "overrides").replace(/\/+$/, "")}/`;
  const inOv = entries.filter((e) => e.name.startsWith(ov) && !e.name.endsWith("/")).map((e) => ({ ...e, rel: e.name.slice(ov.length).replace(/\\/g, "/") }));
  const top = (prefix) => [...new Set(inOv.filter((e) => e.rel.toLowerCase().startsWith(prefix)).map((e) => e.rel.slice(prefix.length).split("/")[0]))].filter(Boolean);
  const worlds = [];
  for (const folder of top("saves/")) {
    const files = inOv.filter((e) => e.rel.startsWith(`saves/${folder}/`));
    const level = files.find((e) => e.rel === `saves/${folder}/level.dat`);
    if (!level) continue;
    const info = (await readLevel(await readZipEntry(zipFile, level)).catch(() => null)) || {};
    const icon = files.find((e) => e.rel === `saves/${folder}/icon.png` && e.size < 512 * 1024);
    worlds.push({
      folder,
      name: info.name || folder,
      lastPlayed: info.lastPlayed || null,
      minecraftVersion: info.version || manifest.minecraft.version,
      sizeBytes: files.reduce((a, e) => a + e.size, 0),
      icon: icon ? `data:image/png;base64,${(await readZipEntry(zipFile, icon)).toString("base64")}` : null,
    });
  }
  const required = manifest.files.filter((f) => Number.isInteger(f.fileID) && f.fileID > 0 && f.required !== false);
  return {
    name: String(manifest.name || path.basename(zipFile, ".zip")).slice(0, 60),
    packVersion: manifest.version ? String(manifest.version).slice(0, 40) : null,
    author: manifest.author ? String(manifest.author).slice(0, 60) : null,
    minecraftVersion: manifest.minecraft.version,
    loaderId,
    loader: lm?.[1] || null,
    loaderVersion: lm?.[2] || null,
    files: required.map((f) => ({ projectID: f.projectID, fileID: f.fileID })),
    overrideJars: inOv.filter((e) => /^mods\/[^/]+\.jar$/i.test(e.rel)).map((e) => e.rel),
    configFiles: inOv.filter((e) => !SKIP_IN_CFG.test(e.rel)).length,
    resourcepacks: top("resourcepacks/"),
    shaders: top("shaderpacks/"),
    worlds,
    overridesPrefix: ov,
  };
}

// --- Pack Modrinth (.mrpack, 27/10) ---------------------------------------------------------------
// modrinth.index.json liste chaque fichier avec ses liens et empreintes ; overrides/ (tous les
// côtés) et client-overrides/ (client, gagne sur overrides/). Rien ne passe par CurseForge.
// Mêmes hôtes autorisés que modpack.js (spécification Modrinth).
const MRPACK_HOSTS = new Set(["cdn.modrinth.com", "github.com", "raw.githubusercontent.com", "gitlab.com"]);
const MR_LOADER_KEYS = { neoforge: "neoforge", forge: "forge", "fabric-loader": "fabric", "quilt-loader": "quilt" };
const MR_PREFIXES = ["overrides/", "client-overrides/"];
const MR_CDN = /^https:\/\/cdn\.modrinth\.com\/data\/([A-Za-z0-9]{8})\/versions\/([A-Za-z0-9]{8})\//;
const SAFE_MOD_JAR = /^mods\/[\w.+() \[\]!'&,-]+\.jar$/i;

// Type d'un pack d'après son contenu : "mr" (modrinth.index.json), "cf" (manifest.json) ou null.
async function packKindOf(zipFile) {
  const names = new Set((await listZip(zipFile)).map((e) => e.name));
  if (names.has("omnipack.json")) return "omni";
  if (names.has("modrinth.index.json")) return "mr";
  if (names.has("manifest.json")) return "cf";
  return null;
}

// Entrées des overrides, une seule par chemin (client-overrides/ gagne). `shadow` : chemins de
// overrides/ remplacés par client-overrides/, à ne pas extraire.
function mergedOverrides(entries, prefixes) {
  const byRel = new Map();
  const shadow = new Set();
  for (const ov of prefixes) {
    for (const e of entries) {
      if (!e.name.startsWith(ov) || e.name.endsWith("/")) continue;
      const rel = e.name.slice(ov.length).replace(/\\/g, "/");
      if (!rel) continue;
      const before = byRel.get(rel);
      if (before) shadow.add(before.name);
      byRel.set(rel, { ...e, rel });
    }
  }
  return { list: [...byRel.values()], shadow };
}

async function worldsIn(zipFile, inOv, { readLevel, mc }) {
  const top = [...new Set(inOv.filter((e) => e.rel.toLowerCase().startsWith("saves/")).map((e) => e.rel.split("/")[1]))].filter(Boolean);
  const worlds = [];
  for (const folder of top) {
    const files = inOv.filter((e) => e.rel.startsWith(`saves/${folder}/`));
    const level = files.find((e) => e.rel === `saves/${folder}/level.dat`);
    if (!level) continue;
    const info = (await readLevel(await readZipEntry(zipFile, level)).catch(() => null)) || {};
    const icon = files.find((e) => e.rel === `saves/${folder}/icon.png` && e.size < 512 * 1024);
    worlds.push({
      folder,
      name: info.name || folder,
      lastPlayed: info.lastPlayed || null,
      minecraftVersion: info.version || mc,
      sizeBytes: files.reduce((a, e) => a + e.size, 0),
      icon: icon ? `data:image/png;base64,${(await readZipEntry(zipFile, icon)).toString("base64")}` : null,
    });
  }
  return worlds;
}

// Où va un fichier listé par l'index : "mods", "rp", "sh", "cfg" (null = ignoré).
const partOfPath = (rel) => {
  const low = rel.toLowerCase();
  if (low.startsWith("mods/")) return "mods";
  if (low.startsWith("resourcepacks/")) return "rp";
  if (low.startsWith("shaderpacks/")) return "sh";
  if (SKIP_IN_CFG.test(rel)) return null;
  return "cfg";
};

async function readMrpack(zipFile, { readLevel }) {
  const entries = await listZip(zipFile);
  const indexEntry = entries.find((e) => e.name === "modrinth.index.json");
  if (!indexEntry) throw new Error("Ce fichier n'est pas un pack Modrinth (modrinth.index.json introuvable). Sur la page du pack Modrinth : « Télécharger ».");
  const index = JSON.parse((await readZipEntry(zipFile, indexEntry)).toString("utf8"));
  const deps = index.dependencies || {};
  if (index.formatVersion !== 1 || index.game !== "minecraft" || !Array.isArray(index.files) || !deps.minecraft) throw new Error("Pack Modrinth illisible ou incomplet.");
  const loaderKey = Object.keys(MR_LOADER_KEYS).find((k) => deps[k]);
  const mods = [];
  const extras = [];
  for (const file of index.files) {
    if (file.env?.client === "unsupported") continue; // fichier pour le serveur seulement
    const rel = String(file.path || "").replace(/\\/g, "/");
    if (!rel || rel.startsWith("/") || /^[a-z]:/i.test(rel) || rel.split("/").includes("..")) throw new Error(`Chemin refusé dans le pack : ${rel || "(vide)"}`);
    const url = (file.downloads || []).find((u) => {
      try {
        const p = new URL(u);
        return p.protocol === "https:" && !p.username && !p.password && MRPACK_HOSTS.has(p.hostname);
      } catch {
        return false;
      }
    });
    if (!url) throw new Error(`Le fichier « ${rel} » du pack se télécharge depuis un site non autorisé.`);
    const sha1 = file.hashes?.sha1 || null;
    if (!sha1) throw new Error(`Le fichier « ${rel} » du pack n'a pas d'empreinte.`);
    const item = { path: rel, url, sha1, sha512: file.hashes?.sha512 || null, size: file.fileSize || null, optional: file.env?.client === "optional" };
    if (SAFE_MOD_JAR.test(rel)) mods.push(item);
    else if (partOfPath(rel)) extras.push(item);
  }
  // Noms des mods (Modrinth), sinon le nom du fichier.
  const ids = mods.map((m) => MR_CDN.exec(m.url)?.[1]).filter(Boolean);
  const projects = await mrProjects(ids).catch(() => new Map());
  const packMods = mods.map((m) => {
    const hit = MR_CDN.exec(m.url);
    const filename = m.path.slice(5);
    const project = hit ? projects.get(hit[1]) : null;
    return {
      id: hit ? hit[1] : `file:${filename}`,
      name: String(project?.title || filename.replace(/\.jar$/i, "")).slice(0, 80),
      source: "mr",
      projectId: hit?.[1] || null,
      versionId: hit?.[2] || null,
      version: filename,
      file: { filename, url: m.url, sha1: m.sha1, sha512: m.sha512, size: m.size },
      auto: false,
      by: [],
      on: true,
    };
  });
  const { list: inOv, shadow } = mergedOverrides(entries, MR_PREFIXES);
  const topOf = (prefix) => [...new Set([...inOv.map((e) => e.rel), ...extras.map((x) => x.path)].filter((r) => r.toLowerCase().startsWith(prefix)).map((r) => r.slice(prefix.length).split("/")[0]))].filter(Boolean);
  return {
    name: String(index.name || path.basename(zipFile).replace(/\.(mrpack|zip)$/i, "")).slice(0, 60),
    packVersion: index.versionId ? String(index.versionId).slice(0, 40) : null,
    author: null,
    minecraftVersion: String(deps.minecraft),
    loader: loaderKey ? MR_LOADER_KEYS[loaderKey] : null,
    loaderVersion: loaderKey ? String(deps[loaderKey]) : null,
    mods: packMods,
    extras,
    overrideJars: inOv.filter((e) => /^mods\/[^/]+\.jar$/i.test(e.rel)).map((e) => e.rel),
    configFiles: inOv.filter((e) => !SKIP_IN_CFG.test(e.rel)).length + extras.filter((x) => partOfPath(x.path) === "cfg").length,
    resourcepacks: topOf("resourcepacks/"),
    shaders: topOf("shaderpacks/"),
    worlds: await worldsIn(zipFile, inOv, { readLevel, mc: String(deps.minecraft) }),
    overridesPrefix: MR_PREFIXES,
    shadow: [...shadow],
  };
}

// Choisit, pour chaque entrée des overrides, où elle va dans l'instance (null = ignorée).
// `ov` : un préfixe (export CurseForge) ou plusieurs (Modrinth : overrides/ puis client-overrides/,
// `shadow` = entrées de overrides/ remplacées par client-overrides/).
function cfOverridePicker(ov, { parts, worlds, shadow = [] }) {
  const want = new Set(parts);
  const wantedWorlds = new Set(worlds);
  const prefixes = [].concat(ov);
  const hidden = new Set(shadow);
  return (name) => {
    const pre = prefixes.find((p) => name.startsWith(p));
    if (!pre || hidden.has(name)) return null;
    const rel = name.slice(pre.length).replace(/\\/g, "/");
    if (!rel || rel.endsWith("/")) return null;
    const low = rel.toLowerCase();
    if (low.startsWith("saves/")) return wantedWorlds.has(rel.split("/")[1]) ? rel : null;
    if (low.startsWith("mods/")) return want.has("mods") ? rel : null;
    if (low.startsWith("resourcepacks/")) return want.has("rp") ? rel : null;
    if (low.startsWith("shaderpacks/")) return want.has("sh") ? rel : null;
    if (SKIP_IN_CFG.test(rel)) return null;
    return want.has("cfg") ? rel : null;
  };
}

// --- options.txt : packs de ressources actifs --------------------------------------------------
async function readOptions(gameDir) {
  try {
    return await fsp.readFile(path.join(gameDir, "options.txt"), "utf8");
  } catch {
    return "";
  }
}
function activeResourcePacks(optionsText) {
  const m = /^resourcePacks:(.*)$/m.exec(optionsText);
  try {
    return m ? JSON.parse(m[1]) : [];
  } catch {
    return [];
  }
}
async function setResourcePack(gameDir, file, on) {
  const text = await readOptions(gameDir);
  const list = activeResourcePacks(text).filter((x) => x !== `file/${file}`);
  if (on) list.push(`file/${file}`);
  const line = `resourcePacks:${JSON.stringify(list)}`;
  const next = /^resourcePacks:.*$/m.test(text) ? text.replace(/^resourcePacks:.*$/m, line) : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`;
  await fsp.mkdir(gameDir, { recursive: true });
  await fsp.writeFile(path.join(gameDir, "options.txt"), next);
}
// Shader actif (Iris : config/iris.properties).
async function readIrisShader(gameDir) {
  try {
    const t = await fsp.readFile(path.join(gameDir, "config", "iris.properties"), "utf8");
    const on = /^enableShaders\s*=\s*true/m.test(t);
    const name = (/^shaderPack\s*=\s*(.*)$/m.exec(t) || [])[1]?.trim() || null;
    return on ? name : null;
  } catch {
    return null;
  }
}
async function setIrisShader(gameDir, name) {
  const file = path.join(gameDir, "config", "iris.properties");
  let t = "";
  try {
    t = await fsp.readFile(file, "utf8");
  } catch {
    /* pas encore de réglages Iris */
  }
  const set = (k, v) => {
    const line = `${k}=${v}`;
    t = new RegExp(`^${k}\\s*=.*$`, "m").test(t) ? t.replace(new RegExp(`^${k}\\s*=.*$`, "m"), line) : `${t}${t && !t.endsWith("\n") ? "\n" : ""}${line}\n`;
  };
  set("enableShaders", name ? "true" : "false");
  if (name) set("shaderPack", name.replace(/[\r\n]/g, ""));
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, t);
}

// --- Packs de ressources, shaders et data packs sur Modrinth (27/10, Pack Omniscient) ---------------
// Même règle que les mods : seulement des fichiers de cdn.modrinth.com, vérifiés par leur SHA-1.
const CONTENT_TYPES = { rp: "resourcepack", sh: "shader", dp: "datapack" };
function cleanZip(file) {
  try {
    const url = new URL(file.url);
    if (url.protocol !== "https:" || url.hostname !== "cdn.modrinth.com") return null;
  } catch {
    return null;
  }
  if (!/^[\w.+() \[\]!'&,-]+\.zip$/i.test(file.filename || "")) return null;
  return { filename: file.filename, url: file.url, sha1: file.hashes?.sha1 || null, sha512: file.hashes?.sha512 || null, size: file.size || null };
}
async function searchContent(kind, query, { mc, fr = true }) {
  const type = CONTENT_TYPES[kind];
  if (!type) throw new Error("Type de contenu inconnu.");
  const facets = [[`project_type:${type}`], ...(mc ? [[`versions:${mc}`]] : [])];
  const text = String(query || "").trim().slice(0, 80);
  const data = await mrGet(`/search?limit=20&index=${text ? "relevance" : "downloads"}&facets=${q(facets)}${text ? `&query=${encodeURIComponent(text)}` : ""}`, { ttl: 5 * 60_000 });
  return (data?.hits || []).map((h) => ({ slug: h.slug, projectId: h.project_id, name: h.title, author: h.author, downloads: fmtDownloads(h.downloads || 0, fr), icon: h.icon_url || null }));
}
// Fichier .zip le plus récent d'un projet pour cette version de Minecraft (release d'abord).
async function contentFile(kind, idOrSlug, mc) {
  const params = [`game_versions=${q([mc])}`];
  if (kind === "dp") params.push(`loaders=${q(["datapack"])}`);
  const list = (await mrGet(`/project/${encodeURIComponent(idOrSlug)}/version?${params.join("&")}`)) || [];
  const sorted = [...list].sort((a, b) => Number(a.version_type !== "release") - Number(b.version_type !== "release") || String(b.date_published).localeCompare(String(a.date_published)));
  for (const v of sorted) {
    const file = cleanZip((v.files || []).find((f) => f.primary && /\.zip$/i.test(f.filename)) || (v.files || []).find((f) => /\.zip$/i.test(f.filename)) || {});
    if (file) {
      const project = (await mrProjects([v.project_id]).catch(() => new Map())).get(v.project_id);
      return { projectId: v.project_id, versionId: v.id, version: v.version_number, name: project?.title || file.filename.replace(/\.zip$/i, ""), slug: project?.slug || idOrSlug, file };
    }
  }
  return null;
}
// Télécharge un fichier Modrinth (lien déjà vérifié) en vérifiant son SHA-1. `.part` puis renommé.
async function downloadChecked(file, target) {
  const res = await fetch(file.url, { headers: { "User-Agent": MODRINTH_USER_AGENT }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status}) : ${file.filename}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (file.sha1 && require("node:crypto").createHash("sha1").update(buf).digest("hex") !== file.sha1) throw new Error(`Fichier abîmé pendant le téléchargement : ${file.filename}`);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(`${target}.part`, buf);
  await fsp.rename(`${target}.part`, target);
  return buf.length;
}
// Logo d'un pack Modrinth importé (.mrpack, 27/10) : le fichier est retrouvé sur Modrinth par son
// SHA-1, puis le logo de son projet (seulement depuis cdn.modrinth.com, 1 Mo au plus). null sinon.
async function mrPackIcon(sha1) {
  if (!/^[0-9a-f]{40}$/.test(String(sha1 || ""))) return null;
  const ver = await mrGet(`/version_file/${sha1}?algorithm=sha1`);
  if (!ver?.project_id || !/^[A-Za-z0-9]{1,16}$/.test(ver.project_id)) return null;
  const proj = await mrGet(`/project/${ver.project_id}`);
  let url;
  try {
    url = new URL(proj?.icon_url || "");
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "cdn.modrinth.com") return null;
  const res = await fetch(url, { headers: { "User-Agent": MODRINTH_USER_AGENT }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length && buf.length <= 1024 * 1024 ? buf : null;
}
// Fichiers retrouvés sur Modrinth par leur SHA-1 (export : lien plutôt que fichier). sha1 → infos.
async function lookupHashes(sha1s) {
  const out = new Map();
  const list = [...new Set(sha1s.filter((h) => /^[0-9a-f]{40}$/.test(h)))];
  for (let i = 0; i < list.length; i += 200) {
    const res = await fetch(`${MODRINTH_API}/version_files`, {
      method: "POST",
      headers: { "User-Agent": MODRINTH_USER_AGENT, "Content-Type": "application/json" },
      body: JSON.stringify({ hashes: list.slice(i, i + 200), algorithm: "sha1" }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) continue;
    const data = await res.json();
    for (const [hash, v] of Object.entries(data || {})) {
      const f = (v.files || []).find((x) => x.hashes?.sha1 === hash);
      if (!f) continue;
      try {
        if (new URL(f.url).hostname !== "cdn.modrinth.com") continue;
      } catch {
        continue;
      }
      out.set(hash, { projectId: v.project_id, versionId: v.id, url: f.url, filename: f.filename, sha1: hash, sha512: f.hashes?.sha512 || null, size: f.size || null });
    }
  }
  return out;
}
// --- « Un pack existant » (28/10, Laboratoire « packBrowse ») ------------------------------------
// Parcourir les modpacks publics de Modrinth et de FTB (API publiques, sans clé). CurseForge passe
// par le site (clé côté site). Le renderer ne reçoit que du texte et des liens d'images ; les liens
// de fichiers restent ici et sont relus au moment d'installer.
const PACK_LOADERS = ["neoforge", "forge", "fabric", "quilt"];
const okImg = (u, hosts) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`)) ? url.href : null;
  } catch {
    return null;
  }
};
const newestMc = (list) => [...(list || [])].filter((v) => /^\d+\.\d+(\.\d+)?$/.test(v)).sort((a, b) => cmpVer(b, a))[0] || null;
async function searchModrinthPacks(query, { mc, loader } = {}) {
  const text = String(query || "").trim().slice(0, 80);
  const facets = [["project_type:modpack"]];
  if (mc && /^[\w.-]{1,20}$/.test(mc)) facets.push([`versions:${mc}`]);
  if (PACK_LOADERS.includes(loader)) facets.push([`categories:${loader}`]);
  const data = await mrGet(`/search?limit=30&index=${text ? "relevance" : "downloads"}&facets=${q(facets)}${text ? `&query=${encodeURIComponent(text)}` : ""}`, { ttl: 5 * 60_000 });
  return (data?.hits || []).map((h) => ({
    src: "mr",
    id: String(h.project_id),
    name: String(h.title || "?").slice(0, 80),
    author: String(h.author || "").slice(0, 60),
    desc: String(h.description || "").slice(0, 300),
    dl: Number(h.downloads) || 0,
    icon: okImg(h.icon_url, ["cdn.modrinth.com"]),
    mc: newestMc(h.versions),
    loader: PACK_LOADERS.find((l) => (h.categories || []).includes(l)) || null,
    page: /^[\w-]{1,80}$/.test(h.slug || "") ? `https://modrinth.com/modpack/${h.slug}` : null,
  }));
}
// Versions d'un modpack Modrinth qui ont un .mrpack sur cdn.modrinth.com, la plus récente d'abord.
async function modrinthPackVersions(projectId) {
  if (!/^[A-Za-z0-9]{1,16}$/.test(String(projectId || ""))) return [];
  const list = await mrGet(`/project/${projectId}/version`, { ttl: 5 * 60_000 });
  return (list || [])
    .map((v) => {
      const f = (v.files || []).find((x) => x.primary && /\.mrpack$/i.test(x.filename || "")) || (v.files || []).find((x) => /\.mrpack$/i.test(x.filename || ""));
      let okUrl = false;
      try {
        const url = new URL(f?.url || "");
        okUrl = url.protocol === "https:" && url.hostname === "cdn.modrinth.com";
      } catch {
        okUrl = false;
      }
      if (!f || !okUrl) return null;
      return {
        id: String(v.id),
        name: String(v.version_number || v.name || "?").slice(0, 60),
        type: v.version_type === "release" ? "release" : v.version_type === "beta" ? "beta" : "alpha",
        mc: newestMc(v.game_versions),
        loader: PACK_LOADERS.find((l) => (v.loaders || []).includes(l)) || null,
        file: { url: f.url, filename: f.filename, sha1: f.hashes?.sha1 || null, sha512: f.hashes?.sha512 || null, size: f.size || null },
      };
    })
    .filter(Boolean)
    .slice(0, 60);
}

const FTB_PUBLIC = "https://api.feed-the-beast.com/v1/modpacks/public/modpack";
const ftbCache = new Map();
async function ftbGet(pathAndQuery, ttl = 30 * 60_000) {
  const hit = ftbCache.get(pathAndQuery);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  const res = await fetch(`${FTB_PUBLIC}${pathAndQuery}`, { headers: { "User-Agent": MODRINTH_USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`FTB a répondu ${res.status}.`);
  const data = await res.json();
  if (data?.status !== "success") throw new Error("Réponse de FTB illisible.");
  ftbCache.set(pathAndQuery, { at: Date.now(), data });
  if (ftbCache.size > 300) ftbCache.delete(ftbCache.keys().next().value);
  return data;
}
function ftbTargets(targets) {
  const mc = (targets || []).find((t) => t?.name === "minecraft")?.version || null;
  const ld = (targets || []).find((t) => PACK_LOADERS.includes(t?.name));
  return { mc: mc ? String(mc) : null, loader: ld?.name || null, loaderVersion: ld ? String(ld.version || "") : null };
}
// Fiche d'un pack FTB : nom, logo, versions (sans les versions privées ou archivées).
async function ftbPack(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  const d = await ftbGet(`/${n}`);
  if (d.private) return null;
  const versions = (d.versions || [])
    .filter((v) => v && !v.private && Number.isInteger(Number(v.id)) && ["release", "beta"].includes(String(v.type).toLowerCase()))
    .map((v) => ({ id: String(v.id), name: String(v.name || "?").slice(0, 60), type: String(v.type).toLowerCase(), ...ftbTargets(v.targets), updated: Number(v.updated) || 0 }))
    .sort((a, b) => b.updated - a.updated);
  const art = (d.art || []).find((a) => a.type === "square") || (d.art || [])[0];
  return {
    src: "ftb",
    id: String(n),
    name: String(d.name || "?").slice(0, 80),
    author: String(d.authors?.[0]?.name || "FTB").slice(0, 60),
    desc: String(d.synopsis || "").slice(0, 300),
    dl: Number(d.installs) || 0,
    icon: okImg(art?.url, ["feed-the-beast.com"]),
    mc: versions[0]?.mc || null,
    loader: versions[0]?.loader || null,
    page: /^[\w-]{1,80}$/.test(d.slug || "") ? `https://www.feed-the-beast.com/modpacks/${n}-${d.slug}` : null,
    versions: versions.slice(0, 40),
  };
}
async function searchFtbPacks(query, { mc, loader } = {}) {
  const text = String(query || "").trim().slice(0, 60);
  const list = text ? await ftbGet(`/search/30?term=${encodeURIComponent(text)}`, 5 * 60_000) : await ftbGet(`/popular/installs/30`, 30 * 60_000);
  const ids = (list.packs || []).filter((x) => Number.isInteger(Number(x))).slice(0, 30);
  const packs = (await Promise.all(ids.map((id) => ftbPack(id).catch(() => null)))).filter(Boolean);
  return packs
    .filter((p) => p.versions.length && (!mc || p.versions.some((v) => v.mc === mc)) && (!loader || p.versions.some((v) => v.loader === loader)))
    .map(({ versions, ...p }) => p);
}
// Liste des fichiers d'une version FTB (chemin, lien, SHA-1, taille, identifiants CurseForge).
async function ftbVersionFiles(packId, versionId) {
  const d = await ftbGet(`/${Number(packId)}/${Number(versionId)}`, 10 * 60_000);
  if (!Array.isArray(d.files) || !Array.isArray(d.targets)) throw new Error("Version de pack FTB illisible ou incomplète.");
  return { files: d.files, ...ftbTargets(d.targets), name: String(d.name || "") };
}

// Chargeurs de data packs « dans tous les mondes » (mods) : dossier où ils lisent les data packs.
const DP_LOADERS = {
  paxi: { slug: "paxi", name: "Paxi", ids: ["paxi"], dir: "config/paxi/datapacks" },
  "global-packs": { slug: "globalpacks", name: "Global Packs", ids: ["globalpacks", "global_packs"], dir: "global_packs/required_data" },
};

// --- Nouveaux menus d'ajout (31/10, preview validée par Rushi, Laboratoire « addMenus ») ----------
// Une seule fenêtre « Ajouter » : par défaut, seulement ce qui marche avec la version ET le chargeur du
// pack ; le reste est compté à part (« N pas pour cette version »). La fiche d'un élément montre la
// grille exacte versions × chargeurs (lue dans ses versions Modrinth), la version minimale, les mods
// nécessaires, les images et les liens donnés par l'auteur. Rien n'est recopié de la page Modrinth.
const ADD_TYPES = { mods: "mod", rp: "resourcepack", sh: "shader", dp: "datapack", mp: "modpack" };
const MC_RELEASE = /^\d+\.\d+(\.\d+)?$/;
const mcSorted = (vs) => [...new Set((vs || []).filter((v) => MC_RELEASE.test(v)))].sort(cmpVer);
const MR_PAGE_TYPE = { mods: "mod", rp: "resourcepack", sh: "shader", dp: "datapack", mp: "modpack" };
const httpsLink = (u) => {
  try {
    const url = new URL(String(u || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};
function addHit(h, kind) {
  const withLoader = kind === "mods" || kind === "mp";
  return {
    src: "mr",
    id: String(h.project_id),
    slug: String(h.slug || h.project_id),
    name: String(h.title || "?").slice(0, 80),
    author: String(h.author || "").slice(0, 60),
    desc: String(h.description || "").slice(0, 300),
    dl: Number(h.downloads) || 0,
    icon: okImg(h.icon_url, ["cdn.modrinth.com"]),
    // Approximation de la recherche (le projet entier) ; la fiche lit la grille exacte.
    mcs: mcSorted(h.versions),
    loaders: withLoader ? PACK_LOADERS.filter((l) => (h.categories || []).includes(l)) : [],
    wg: kind === "dp" && (h.categories || []).includes("worldgen"),
    updated: h.date_modified || null,
    page: /^[\w-]{1,80}$/.test(h.slug || "") ? `https://modrinth.com/${MR_PAGE_TYPE[kind]}/${h.slug}` : null,
  };
}
// Recherche Modrinth de la fenêtre « Ajouter ». `mc`/`loader` : le pack (absents = toutes versions).
// Les mods « compatibles » sont vérifiés version par version (la recherche de Modrinth regarde le
// projet entier : Create existe en 1.16.5 et sur Fabric, mais pas « Fabric 1.16.5 »).
async function addSearch(kind, query, { mc = null, loader = null, offset = 0 } = {}) {
  const type = ADD_TYPES[kind];
  if (!type) throw new Error("Type de contenu inconnu.");
  const text = String(query || "").trim().slice(0, 80);
  const base = [[`project_type:${type}`]];
  const withLoader = (kind === "mods" || kind === "mp") && LOADER_IDS.includes(loader);
  const tgt = [...base];
  if (mc && MC_RELEASE.test(mc)) tgt.push([`versions:${mc}`]);
  if (withLoader) tgt.push((MR_LOADERS[loader] || [loader]).map((l) => `categories:${l}`));
  const url = (facets, limit) => `/search?limit=${limit}&offset=${Math.max(0, Number(offset) || 0)}&index=${text ? "relevance" : "downloads"}&facets=${q(facets)}${text ? `&query=${encodeURIComponent(text)}` : ""}`;
  const targeted = tgt.length > 1;
  const [okData, allData] = await Promise.all([targeted ? mrGet(url(tgt, 30), { ttl: 5 * 60_000 }) : null, mrGet(url(base, 30), { ttl: 5 * 60_000 })]);
  const all = (allData?.hits || []).map((h) => addHit(h, kind));
  if (!targeted) return { items: all, okTotal: allData?.total_hits || all.length, allTotal: allData?.total_hits || all.length, others: [] };
  let ok = (okData?.hits || []).map((h) => addHit(h, kind));
  // Mods : vérifiés pour ce chargeur ET cette version (mrVersions est gardé 30 min).
  if (kind === "mods" && withLoader) {
    const checks = await Promise.all(ok.map((x) => mrVersions(x.id, mc, loader).then((v) => v.length > 0).catch(() => true)));
    ok = ok.filter((_, i) => checks[i]);
  }
  const okIds = new Set(ok.map((x) => x.id));
  const others = all.filter((x) => !okIds.has(x.id));
  const okTotal = Math.max(ok.length, (okData?.total_hits || 0) - ((okData?.hits || []).length - ok.length));
  return { items: ok, okTotal, allTotal: Math.max(allData?.total_hits || 0, okTotal), others };
}
// Fiche d'un élément Modrinth : grille exacte, fichier qui sera pris et mods nécessaires pour le pack.
async function addSheet(kind, id, { mc = null, loader = null } = {}) {
  if (!/^[\w-]{1,80}$/.test(String(id || ""))) throw new Error("Élément inconnu.");
  const [p, vers] = await Promise.all([mrGet(`/project/${id}`, { ttl: 10 * 60_000 }), mrGet(`/project/${id}/version`, { ttl: 10 * 60_000 })]);
  if (!p) throw new Error("Cet élément n'existe plus sur Modrinth.");
  const withLoader = kind === "mods" || kind === "mp";
  const av = {};
  for (const v of vers || []) {
    const keys = withLoader ? (v.loaders || []).filter((l) => PACK_LOADERS.includes(l)) : ["mc"];
    for (const k of keys) for (const g of v.game_versions || []) if (MC_RELEASE.test(g)) (av[k] ||= new Set()).add(g);
  }
  // Quilt lance aussi les mods Fabric.
  if (withLoader && av.fabric) for (const g of av.fabric) (av.quilt ||= new Set()).add(g);
  const out = {};
  for (const [k, set] of Object.entries(av)) out[k] = mcSorted([...set]);
  // Version qui serait prise pour le pack : stable d'abord, la plus récente.
  let file = null;
  let deps = [];
  if (mc) {
    const okLoaders = withLoader ? MR_LOADERS[loader] || [loader] : null;
    const fit = (vers || [])
      .filter((v) => (v.game_versions || []).includes(mc) && (!okLoaders || (v.loaders || []).some((l) => okLoaders.includes(l))))
      .sort((a, b) => Number(a.version_type !== "release") - Number(b.version_type !== "release") || String(b.date_published).localeCompare(String(a.date_published)))[0];
    if (fit) {
      const f = (fit.files || []).find((x) => x.primary) || (fit.files || [])[0];
      file = f ? { name: String(f.filename || "").slice(0, 160), version: fit.version_number, size: f.size || null } : null;
      const ids = (fit.dependencies || []).filter((d) => d.dependency_type === "required" && d.project_id).map((d) => d.project_id);
      if (ids.length) {
        const projects = await mrProjects(ids).catch(() => new Map());
        deps = ids.map((pid) => ({ id: pid, slug: projects.get(pid)?.slug || pid, name: projects.get(pid)?.title || pid, icon: okImg(projects.get(pid)?.icon_url, ["cdn.modrinth.com"]) }));
      }
    }
  }
  const gallery = [...(p.gallery || [])].sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || (a.ordering || 0) - (b.ordering || 0));
  return {
    av: out,
    file,
    deps,
    images: gallery.map((g) => okImg(g.raw_url || g.url, ["cdn.modrinth.com"])).filter(Boolean).slice(0, 3),
    side: withLoader ? { client: p.client_side || null, server: p.server_side || null } : null,
    license: p.license ? { id: String(p.license.id || "").slice(0, 60), name: String(p.license.name || p.license.id || "").slice(0, 80) } : null,
    updated: p.updated || null,
    published: p.published || null,
    dl: Number(p.downloads) || 0,
    followers: Number(p.followers) || 0,
    links: {
      page: /^[\w-]{1,80}$/.test(p.slug || "") ? `https://modrinth.com/${MR_PAGE_TYPE[kind] || "mod"}/${p.slug}` : null,
      source: httpsLink(p.source_url),
      wiki: httpsLink(p.wiki_url),
      discord: httpsLink(p.discord_url),
      issues: httpsLink(p.issues_url),
      donate: (p.donation_urls || []).map((d) => ({ url: httpsLink(d.url), platform: String(d.platform || d.id || "").slice(0, 30) })).filter((d) => d.url).slice(0, 4),
    },
  };
}
// « Créer une copie en … » : pour chaque mod Modrinth du pack (par son SHA-1), la version qui va avec
// le nouveau chargeur et la nouvelle version de Minecraft. Une seule requête. sha1 → { projectId, versionId }.
async function copyCheck(sha1s, { mc, loader }) {
  const out = new Map();
  const list = [...new Set(sha1s.filter((h) => /^[0-9a-f]{40}$/.test(h)))];
  for (let i = 0; i < list.length; i += 200) {
    const res = await fetch(`${MODRINTH_API}/version_files/update`, {
      method: "POST",
      headers: { "User-Agent": MODRINTH_USER_AGENT, "Content-Type": "application/json" },
      body: JSON.stringify({ hashes: list.slice(i, i + 200), algorithm: "sha1", loaders: MR_LOADERS[loader] || [loader], game_versions: [mc] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Modrinth a répondu ${res.status}.`);
    const data = await res.json();
    for (const [hash, v] of Object.entries(data || {})) out.set(hash, { projectId: v.project_id, versionId: v.id, version: v.version_number });
  }
  return out;
}
// Empreinte CurseForge d'un fichier (MurmurHash2, graine 1, sans les octets d'espacement 9, 10, 13, 32).
function cfFingerprint(buf) {
  const keep = Buffer.allocUnsafe(buf.length);
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b !== 9 && b !== 10 && b !== 13 && b !== 32) keep[n++] = b;
  }
  const m = 0x5bd1e995;
  let h = (1 ^ n) >>> 0;
  let i = 0;
  while (n - i >= 4) {
    let k = keep[i] | (keep[i + 1] << 8) | (keep[i + 2] << 16) | (keep[i + 3] << 24);
    k = Math.imul(k, m);
    k ^= k >>> 24;
    k = Math.imul(k, m);
    h = Math.imul(h, m) ^ k;
    i += 4;
  }
  const rest = n - i;
  if (rest === 3) h ^= keep[i + 2] << 16;
  if (rest >= 2) h ^= keep[i + 1] << 8;
  if (rest >= 1) {
    h ^= keep[i];
    h = Math.imul(h, m);
  }
  h ^= h >>> 13;
  h = Math.imul(h, m);
  h ^= h >>> 15;
  return h >>> 0;
}

module.exports = {
  setBugSignal,
  searchModrinthPacks,
  modrinthPackVersions,
  searchFtbPacks,
  ftbPack,
  ftbVersionFiles,
  mrPackIcon,
  LOADER_IDS,
  RP_NEEDS,
  CRASH_ASSISTANT,
  mrVersions,
  mrProjects,
  searchModrinth,
  resolveModrinth,
  latestLoaderVersion,
  readJarMeta,
  checkJars,
  satisfies,
  parseVer,
  cmpVer,
  resourcePackNeeds,
  readCfExport,
  readMrpack,
  packKindOf,
  partOfPath,
  cfOverridePicker,
  readOptions,
  activeResourcePacks,
  setResourcePack,
  readIrisShader,
  setIrisShader,
  searchContent,
  fmtDownloads,
  contentFile,
  downloadChecked,
  lookupHashes,
  DP_LOADERS,
  MR_LOADERS,
  addSearch,
  addSheet,
  copyCheck,
  cfFingerprint,
};
