// Pack Omniscient (27/10, preview v22 validée par Rushi, « tu peux tout coder ») : un pack fait dans
// le launcher (Modrinth seulement, ou vanilla avec map, packs de ressources et data packs), généré
// pour d'autres versions de Minecraft, exporté en .omnipack (envoyé à Omniscient, que Rushi importe
// dans l'admin du site, teste et publie) ou en .mrpack pour un ami.
//
// Format .omnipack (un .zip) :
//   omnipack.json                          la description (toujours la 1re entrée de l'archive)
//   versions/<mc>/overrides/...            config/, defaultconfigs/, kubejs/, options.txt
//   versions/<mc>/files/<dossier>/<nom>    packs de ressources, shaders, data packs qui ne sont PAS
//                                          sur Modrinth (fichier du joueur : licence à vérifier)
//   versions/<mc>/worlds/<dossier>/...     mondes choisis (une map)
// Les mods ne sont jamais dans l'archive : seulement leur lien Modrinth (cdn.modrinth.com) et leurs
// empreintes. Rien de CurseForge (règle de Rushi : jamais de mod CurseForge redistribué).
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const packs = require("./playPacks");
const packRam = require("./packRam");
const { writeZip, listZip, readZipEntry, extractZip } = require("./zipStream");

const FORMAT = 1;
const CFG_DIRS = ["config", "defaultconfigs", "kubejs"];
const SAFE_JAR = /^[\w.+() \[\]!'&,-]+\.jar$/i;
// Nom d'un fichier .zip : pas de dossier ni de caractère interdit par Windows. Les noms décorés (§, ✦)
// de vrais packs de ressources Modrinth sont permis (audit du 01/11, pack PVP refusé à l'import).
const SAFE_ZIP = /^(?!\.)[^\/:*?"<>|\u0000-\u001f]+\.zip$/i;
const MC_ID = /^[\w.+-]+$/;
// Première version de Minecraft où chaque chargeur existe (liste des versions à générer).
const LOADER_MIN = { fabric: "1.14", quilt: "1.14", forge: "1.7.10", neoforge: "1.20.2" };
// Pause entre deux versions générées : on ne surcharge pas Modrinth (bridé exprès, preview 06h35).
const GEN_PAUSE_MS = 1500;
const isMrUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname === "cdn.modrinth.com";
  } catch {
    return false;
  }
};
// Audit du 01/11 : à l'installation, seuls les réglages sortent de overrides/ (même règle que
// lib/omniArchiveCheck.ts côté site), et jamais d'exécutable, où qu'il soit dans l'archive. Le
// fichier reste lisible par le launcher : c'est le chemin final qui est refusé.
const FORBIDDEN_EXT = /\.(jar|exe|dll|bat|cmd|com|scr|msi|msp|ps1|psm1|vbs|vbe|wsf|wsh|hta|lnk|sh|so|dylib|class|pif|reg|cpl|jse|url)$/i;
// 02/11 (test au8) : Windows retire les points et espaces en fin de nom (« evil.jar. » devient
// evil.jar) et lit « a.txt:b » comme un flux caché. Un tel nom n'existe pas dans un vrai pack : refusé.
const winUnsafe = (rel) => rel.split("/").some((seg) => /[. ]$/.test(seg) || /[<>:"|?*\x00-\x1f\\]/.test(seg));
const isAllowedOverride = (rel) => {
  if (winUnsafe(rel)) return false;
  if (rel === "overrides/options.txt") return true;
  if (FORBIDDEN_EXT.test(rel)) return false;
  const [, dir] = rel.split("/");
  if (!CFG_DIRS.includes(dir)) return false;
  return dir === "kubejs" || !/\.(js|ts|py|rb|lua)$/i.test(rel);
};
const sha1File = async (file) => {
  const h = crypto.createHash("sha1");
  for await (const c of fs.createReadStream(file)) h.update(c);
  return h.digest("hex");
};
// Ordre des versions de Minecraft (1.21.1 > 1.9 ; nouveau format 26.x en dernier venu).
const cmpMc = (a, b) => packs.cmpVer(packs.parseVer(a) || [], packs.parseVer(b) || []);
const skipCfg = (rel) => /\.bak$/i.test(rel) || /^config\/paxi\/datapacks(\/|$)/i.test(rel);

function createOmniPack({ playMode }) {
  // Versions proposées par « + » : versions finales de Minecraft où le chargeur existe.
  async function targetVersions(id) {
    const { v } = playMode.omniSource(id);
    const all = (await playMode.listMinecraftVersions()).filter((x) => x.type === "release").map((x) => x.id);
    const min = v.pack ? LOADER_MIN[v.pack.loader] : null;
    return all.filter((mc) => !min || cmpMc(mc, min) >= 0);
  }

  // Le groupe de la version (créé s'il n'existe pas : la version devient la base du pack).
  async function ensureGroup(v) {
    if (!v.omni) await playMode.setOmni(v.id, { group: crypto.randomUUID(), tested: true, base: true });
    return playMode.getVersion(v.id).omni.group;
  }
  const siblings = (group) => playMode.listVersions().filter((x) => x.omni?.group === group).map((x) => playMode.getVersion(x.id));

  // Copie ce qui ne dépend pas des mods : réglages, packs de ressources, shaders, data packs (pas les
  // mondes : une map est faite pour une version précise). `onlyMissing` : mise à jour, on garde tout.
  async function copyContent(from, toId, { onlyMissing = false } = {}) {
    const src = playMode.omniSource(from.id);
    const dst = playMode.omniSource(toId);
    const copy = async (rel) => {
      const a = path.join(src.dir, rel);
      const b = path.join(dst.dir, rel);
      if (!fs.existsSync(a) || (onlyMissing && fs.existsSync(b))) return;
      await fsp.cp(a, b, { recursive: true, force: !onlyMissing, errorOnExist: false, filter: (p) => !/\.bak$/i.test(p) });
    };
    for (const d of [...CFG_DIRS, "options.txt", "resourcepacks", "shaderpacks"]) await copy(d);
    for (const d of from.datapacks || []) {
      const a = path.join(src.store, d.file);
      if (!fs.existsSync(a)) continue;
      if (onlyMissing && (dst.v.datapacks || []).some((x) => x.file === d.file)) continue;
      await fsp.mkdir(dst.store, { recursive: true });
      await fsp.copyFile(a, path.join(dst.store, d.file));
      await playMode.addDatapackEntry(toId, d);
    }
  }

  // Mods « à moi » de la base (pas les nécessaires ajoutés tout seuls), dans l'ordre de la page.
  const wantedOf = (v) => (v.mods || []).filter((m) => m.source === "mr" && m.projectId && (!m.auto || m.pinned) && m.on !== false);

  // Liste des mods pour `mc` : chaque mod voulu s'il existe pour cette version, ses nécessaires, et
  // on retire ceux dont un nécessaire manque (le pack doit démarrer).
  async function modsFor(v, mc) {
    const wanted = wantedOf(v);
    const missing = [];
    const ok = [];
    for (const m of wanted) {
      const list = await packs.mrVersions(m.projectId, mc, v.pack.loader).catch(() => []);
      (list.length ? ok : missing).push(m);
    }
    let list = ok.length ? await packs.resolveModrinth(ok.map((m) => ({ slug: m.projectId, version: null })), { mc, loader: v.pack.loader }) : [];
    for (let round = 0; round < 6; round++) {
      const have = new Set(list.map((e) => e.projectId));
      const broken = list.filter((e) => (e.deps || []).some((d) => d.projectId && !have.has(d.projectId)));
      if (!broken.length) break;
      for (const b of broken) {
        const w = wanted.find((m) => m.projectId === b.projectId);
        if (w && !missing.includes(w)) missing.push(w);
      }
      const drop = new Set(broken.map((b) => b.projectId));
      list = list.filter((e) => !drop.has(e.projectId));
    }
    for (const e of list) {
      const w = wanted.find((m) => m.projectId === e.projectId);
      if (w?.pinned) Object.assign(e, { pinned: true, auto: true, by: w.by || [] });
    }
    return { list, missing };
  }

  /**
   * Générer pour d'autres versions (en arrière-plan, une version à la fois). `targets` : versions de
   * Minecraft ; `keep` : ids des mods à garder à tout prix (une version sans eux n'est pas créée).
   * `onEvent({ type: "run"|"done"|"end", mc, kind, … })` : avancement pour la petite carte.
   * kind : "ok" complet, "part" sans quelques mods, "no" pas créé, "same" déjà à jour, "upd" mise à jour.
   */
  async function generate(baseId, { targets = [], keep = [] }, { onEvent = () => {}, isStopped = () => false, deps } = {}) {
    const base = playMode.getVersion(baseId);
    if (!base) throw new Error("Cette version n'existe plus.");
    if (base.pack && base.pack.kind !== "mine") throw new Error("Seul un pack fait dans le launcher (Mon pack) se génère pour d'autres versions.");
    const group = await ensureGroup(base);
    const keepSet = new Set(keep);
    const list = [...new Set(targets.filter((mc) => MC_ID.test(mc) && mc !== base.minecraftVersion))];
    const results = [];
    for (let i = 0; i < list.length; i++) {
      if (isStopped()) break;
      const mc = list[i];
      onEvent({ type: "run", mc });
      let res;
      try {
        res = await generateOne(base, group, mc, keepSet, deps);
      } catch (error) {
        res = { mc, kind: "no", error: error instanceof Error ? error.message : String(error), miss: [], keepMiss: [] };
      }
      results.push(res);
      onEvent({ type: "done", ...res });
      if (i < list.length - 1) await new Promise((r) => setTimeout(r, GEN_PAUSE_MS));
    }
    onEvent({ type: "end", stopped: isStopped() });
    return results;
  }
  async function generateOne(base, group, mc, keepSet, deps) {
    const existing = siblings(group).find((x) => x.minecraftVersion === mc && x.id !== base.id);
    const name = base.name || base.pack?.name || "";
    if (!base.pack) {
      // Vanilla : même version vanilla, avec les packs de ressources, data packs et réglages.
      if (existing) {
        await copyContent(base, existing.id, { onlyMissing: true });
        return { mc, kind: "same", id: existing.id, miss: [], keepMiss: [] };
      }
      const v = await playMode.createVersion({ minecraftVersion: mc, name, omni: { group, base: false } });
      await copyContent(base, v.id);
      if (base.ram) await playMode.setVersionRam(v.id, base.ram).catch(() => false);
      return { mc, kind: "ok", id: v.id, miss: [], keepMiss: [] };
    }
    const loaderVersion = await packs.latestLoaderVersion(base.pack.loader, mc).catch(() => null);
    if (!loaderVersion) return { mc, kind: "no", noLoader: true, miss: [], keepMiss: [], stale: existing?.id || null };
    const { list, missing } = await modsFor(base, mc);
    const miss = missing.map((m) => m.name);
    const keepMiss = missing.filter((m) => keepSet.has(m.id) || keepSet.has(m.projectId)).map((m) => m.name);
    // 28/10 : `stale` = version déjà dans le pack qui ne le suit plus (proposée au retrait, jamais retirée seule).
    if (keepMiss.length) return { mc, kind: "no", miss, keepMiss, stale: existing?.id || null };
    if (existing) {
      // Déjà générée : on ajoute seulement les mods qui manquent (le reste, mondes et réglages gardés).
      const have = new Set((existing.mods || []).map((m) => m.projectId));
      const added = list.filter((e) => !e.auto && !have.has(e.projectId));
      if (!added.length) return { mc, kind: "same", id: existing.id, miss, keepMiss: [] };
      await playMode.addPackMods(existing.id, added.map((e) => ({ slug: e.projectId, version: e.versionId })), { deps });
      await playMode.setOmni(existing.id, { ...existing.omni, tested: false, missing: miss });
      await copyContent(base, existing.id, { onlyMissing: true });
      return { mc, kind: "upd", id: existing.id, added: added.map((e) => e.name), miss, keepMiss: [] };
    }
    const v = await playMode.createCustomVersion({ kind: "mine", name, minecraftVersion: mc, loader: base.pack.loader, loaderVersion, mods: list, omni: { group, base: false, missing: miss } });
    await copyContent(base, v.id);
    if (base.ram) await playMode.setVersionRam(v.id, base.ram).catch(() => false);
    return { mc, kind: miss.length ? "part" : "ok", id: v.id, miss, keepMiss: [] };
  }

  // --- Export --------------------------------------------------------------------------------------
  // Fichiers d'un dossier (packs de ressources, shaders, data packs) : lien Modrinth quand le même
  // fichier y est (empreinte SHA-1), sinon le fichier lui-même (marqué « own » pour l'admin).
  async function describeFiles(abs, names) {
    const items = [];
    for (const n of names) {
      const file = path.join(abs, n);
      const st = await fsp.stat(file).catch(() => null);
      if (!st?.isFile() || !SAFE_ZIP.test(n)) continue;
      items.push({ file: n, abs: file, size: st.size, sha1: await sha1File(file) });
    }
    const found = await packs.lookupHashes(items.map((x) => x.sha1)).catch(() => new Map());
    return items.map((x) => ({ ...x, mr: found.get(x.sha1) || null }));
  }
  const zipNames = async (dir) => (await fsp.readdir(dir).catch(() => [])).filter((n) => SAFE_ZIP.test(n));

  async function versionManifest(v, { parts, worldKeys }) {
    const src = playMode.omniSource(v.id);
    const pre = `versions/${v.minecraftVersion}`;
    const zipFiles = [];
    const notModrinth = [];
    const entry = {
      minecraftVersion: v.minecraftVersion,
      loader: v.pack?.loader || null,
      loaderVersion: v.pack?.loaderVersion || null,
      tested: !!v.omni?.tested,
      missing: v.omni?.missing || [],
      mods: [],
      resourcepacks: [],
      shaders: [],
      shaderOn: null,
      datapacks: [],
      dpLoader: playMode.loaderOf(v),
      worlds: [],
      // RAM conseillée pour cette version du pack (RAM par pack, 01/11) : calculée, pas celle du joueur.
      ...(parts.ram !== false ? { ramGB: packRam.needGB(packRam.ctxOf(v)) } : {}),
    };
    if (v.pack) {
      for (const m of v.mods || []) {
        if (m.on === false && m.auto) continue;
        if (m.source !== "mr" || !isMrUrl(m.file?.url) || !SAFE_JAR.test(m.file?.filename || "")) {
          notModrinth.push(m.name);
          continue;
        }
        entry.mods.push({ id: m.id, name: m.name, projectId: m.projectId, versionId: m.versionId, version: m.version, auto: !!m.auto, pinned: !!m.pinned, by: m.by || [], on: m.on !== false, file: { filename: m.file.filename, url: m.file.url, sha1: m.file.sha1, sha512: m.file.sha512 || null, size: m.file.size || null } });
      }
      // .jar posés à la main dans mods/ : pas de lien Modrinth connu.
      const known = new Set((v.mods || []).map((m) => m.file?.filename).filter(Boolean));
      for (const f of await fsp.readdir(playMode.modsDirOf(v.id)).catch(() => [])) {
        const base = f.replace(/\.disabled$/, "");
        if (/\.jar$/i.test(base) && !known.has(base)) notModrinth.push(base);
      }
    }
    if (parts.cfg) {
      for (const d of CFG_DIRS) {
        const w = await playMode.walkFiles(path.join(src.dir, d), { skip: (rel) => skipCfg(`${d}/${rel}`) });
        for (const f of w.files) zipFiles.push({ abs: f.abs, rel: `${pre}/overrides/${d}/${f.rel}`, mtimeMs: f.mtimeMs });
      }
      const opt = path.join(src.dir, "options.txt");
      if (fs.existsSync(opt)) zipFiles.push({ abs: opt, rel: `${pre}/overrides/options.txt`, mtimeMs: Date.now() });
    }
    const addSet = async (dir, list, sub) => {
      for (const x of await describeFiles(path.join(src.dir, dir), await zipNames(path.join(src.dir, dir)))) {
        const item = { file: x.file, size: x.size, sha1: x.sha1 };
        if (x.mr) item.mr = { projectId: x.mr.projectId, versionId: x.mr.versionId, url: x.mr.url, sha512: x.mr.sha512 };
        else {
          item.own = true;
          zipFiles.push({ abs: x.abs, rel: `${pre}/files/${sub}/${x.file}`, mtimeMs: Date.now() });
        }
        list.push(item);
      }
    };
    if (parts.rp) {
      await addSet("resourcepacks", entry.resourcepacks, "resourcepacks");
      const active = packs.activeResourcePacks(await packs.readOptions(src.dir));
      for (const r of entry.resourcepacks) r.on = active.includes(`file/${r.file}`);
    }
    if (parts.sh && v.pack) {
      await addSet("shaderpacks", entry.shaders, "shaderpacks");
      entry.shaderOn = await packs.readIrisShader(src.dir);
    }
    const worlds = (await playMode.listWorlds()).filter((w) => w.lastVersionId === v.id && worldKeys.includes(w.key));
    if (parts.dp) {
      const described = await describeFiles(src.store, (v.datapacks || []).map((d) => d.file));
      for (const d of v.datapacks || []) {
        const x = described.find((y) => y.file === d.file);
        if (!x) continue;
        const item = { file: d.file, name: d.name, size: x.size, sha1: x.sha1, auto: !!d.auto, worlds: worlds.filter((w) => (d.worlds || []).includes(w.key)).map((w) => w.folder) };
        if (x.mr) item.mr = { projectId: x.mr.projectId, versionId: x.mr.versionId, url: x.mr.url, sha512: x.mr.sha512 };
        else {
          item.own = true;
          zipFiles.push({ abs: x.abs, rel: `${pre}/files/datapacks/${d.file}`, mtimeMs: Date.now() });
        }
        entry.datapacks.push(item);
      }
    }
    for (const w of worlds) {
      const found = await playMode.worldDir(w.key);
      if (!found) continue;
      const files = await playMode.walkFiles(found.dir, { skip: (rel) => rel === "session.lock" || rel === "omniscient-world.json" });
      for (const f of files.files) zipFiles.push({ abs: f.abs, rel: `${pre}/worlds/${w.folder}/${f.rel}`, mtimeMs: f.mtimeMs });
      entry.worlds.push({ folder: w.folder, name: w.name, sizeBytes: files.bytes });
    }
    return { entry, zipFiles, notModrinth };
  }

  async function writeArchive(outFile, json, jsonName, zipFiles) {
    const tmp = path.join(os.tmpdir(), `omni-${crypto.randomBytes(4).toString("hex")}.json`);
    await fsp.writeFile(tmp, JSON.stringify(json, null, 2));
    try {
      await writeZip(outFile, [{ abs: tmp, rel: jsonName, mtimeMs: Date.now() }, ...zipFiles]);
    } finally {
      await fsp.rm(tmp, { force: true });
    }
    return (await fsp.stat(outFile)).size;
  }

  // Ce que la fenêtre « Exporter pour Omniscient » montre avant d'enregistrer.
  async function exportPreview(id) {
    const { v } = playMode.omniSource(id);
    const group = v.omni ? siblings(v.omni.group) : [v];
    const worlds = (await playMode.listWorlds()).filter((w) => group.some((g) => g.id === w.lastVersionId));
    return {
      name: v.name || v.pack?.name || `Minecraft ${v.minecraftVersion}`,
      vanilla: !v.pack,
      versions: group.map((g) => ({ mc: g.minecraftVersion, tested: !!g.omni?.tested })).sort((a, b) => cmpMc(b.mc, a.mc)),
      mods: v.pack ? (v.mods || []).filter((m) => !m.auto).length : 0,
      notModrinth: (v.mods || []).filter((m) => m.source !== "mr").map((m) => m.name),
      worlds: worlds.map((w) => ({ key: w.key, name: w.name, mc: w.minecraftVersion, sizeBytes: w.sizeBytes })),
      resourcepacks: (await zipNames(path.join(playMode.omniSource(id).dir, "resourcepacks"))).length,
      datapacks: (v.datapacks || []).length,
    };
  }

  async function exportOmni(id, outFile, { parts = {}, worlds = [] } = {}) {
    const { v } = playMode.omniSource(id);
    const group = v.omni ? siblings(v.omni.group) : [v];
    const versions = [];
    const zipFiles = [];
    const notModrinth = new Set();
    for (const g of group.sort((a, b) => cmpMc(b.minecraftVersion, a.minecraftVersion))) {
      const r = await versionManifest(g, { parts: { cfg: parts.cfg !== false, rp: parts.rp !== false, sh: parts.sh !== false, dp: parts.dp !== false, ram: parts.ram !== false }, worldKeys: parts.w === false ? [] : worlds });
      r.notModrinth.forEach((n) => notModrinth.add(n));
      versions.push(r.entry);
      zipFiles.push(...r.zipFiles);
    }
    if (notModrinth.size) {
      throw Object.assign(new Error(`Un Pack Omniscient ne contient que des mods Modrinth. Retire d'abord : ${[...notModrinth].slice(0, 8).join(", ")}.`), { code: "notModrinth", mods: [...notModrinth] });
    }
    const json = {
      format: FORMAT,
      kind: "omnipack",
      name: v.name || v.pack?.name || `Minecraft ${v.minecraftVersion}`,
      vanilla: !v.pack,
      loader: v.pack?.loader || null,
      createdAt: new Date().toISOString(),
      base: v.omni ? (group.find((g) => g.omni?.base) || v).minecraftVersion : v.minecraftVersion,
      versions,
    };
    const size = await writeArchive(outFile, json, "omnipack.json", zipFiles);
    return { file: outFile, size, versions: versions.length };
  }

  // Pour un ami (.mrpack, format Modrinth) : mods en liens Modrinth, réglages, packs, mondes cochés.
  // Les mods qui ne viennent pas de Modrinth ne sont JAMAIS dans le fichier : leur liste (avec la page)
  // est dans « omniscient-a-telecharger.txt ».
  // `cloud` (03/11, « Envoyer dans le cloud ») : les mods perso ne vont PAS dans le fichier, ils sont
  // renvoyés dans `custom` (le launcher les envoie à part, le site les contrôle un par un).
  async function exportMrpack(id, outFile, { parts = {}, worlds = [], plan = null, ramGB = null, cloud = false } = {}) {
    const { v, dir } = playMode.omniSource(id);
    const index = {
      formatVersion: 1,
      game: "minecraft",
      versionId: new Date().toISOString().slice(0, 10),
      name: v.name || v.pack?.name || `Minecraft ${v.minecraftVersion}`,
      summary: "Exporté depuis Omniscient Launcher",
      files: [],
      dependencies: { minecraft: v.minecraftVersion },
    };
    const loaderKey = { fabric: "fabric-loader", quilt: "quilt-loader", forge: "forge", neoforge: "neoforge" }[v.pack?.loader];
    if (loaderKey) index.dependencies[loaderKey] = v.pack.loaderVersion;
    const zipFiles = [];
    const manual = [];
    const custom = [];
    const mods = (v.mods || []).filter((m) => m.on !== false);
    const needHashes = plan ? [] : mods.filter((m) => isMrUrl(m.file?.url) && m.file?.sha1 && !m.file?.sha512).map((m) => m.file.sha1);
    const hashes = needHashes.length ? await packs.lookupHashes(needHashes).catch(() => new Map()) : new Map();
    // Menus d'ajout (31/10, Rushi) : liens Modrinth, et les autres mods (CurseForge ajoutés à la main,
    // mods perso) en .jar dans le fichier. Un fichier pour des amis, pas à publier.
    if (plan) {
      for (const x of plan.mods) {
        if (x.mrpack === "link") index.files.push({ path: `mods/${x.mr.filename}`, hashes: { sha1: x.mr.sha1, sha512: x.mr.sha512 }, env: { client: "required", server: "required" }, downloads: [x.mr.url], fileSize: x.mr.size || 0 });
        else if (x.mrpack === "jar" && cloud) custom.push(x);
        else if (x.mrpack === "jar") zipFiles.push({ abs: x.abs, rel: `overrides/mods/${x.file}`, mtimeMs: Date.now() });
        else manual.push(`${x.name}${x.page ? ` : ${x.page}` : ""}`);
      }
      if (!cloud) zipFiles.push(...(await creditsFile(plan)));
    }
    for (const m of plan ? [] : mods) {
      if (m.source === "mr" && isMrUrl(m.file?.url) && SAFE_JAR.test(m.file?.filename || "")) {
        const sha512 = m.file.sha512 || hashes.get(m.file.sha1)?.sha512;
        if (sha512) {
          index.files.push({ path: `mods/${m.file.filename}`, hashes: { sha1: m.file.sha1, sha512 }, env: { client: "required", server: "required" }, downloads: [m.file.url], fileSize: m.file.size || hashes.get(m.file.sha1)?.size || 0 });
          continue;
        }
      }
      manual.push(`${m.name}${m.cf?.pageUrl ? ` : ${m.cf.pageUrl}` : m.source === "cf" && m.projectId ? ` : https://www.curseforge.com/projects/${m.projectId}` : ""}`);
    }
    const addDir = async (sub, on) => {
      if (!on) return;
      for (const x of await describeFiles(path.join(dir, sub), await zipNames(path.join(dir, sub)))) {
        if (x.mr?.sha512) index.files.push({ path: `${sub}/${x.file}`, hashes: { sha1: x.sha1, sha512: x.mr.sha512 }, env: { client: "required", server: "unsupported" }, downloads: [x.mr.url], fileSize: x.size });
        else zipFiles.push({ abs: x.abs, rel: `overrides/${sub}/${x.file}`, mtimeMs: Date.now() });
      }
    };
    await addDir("resourcepacks", parts.rp !== false);
    if (v.pack) await addDir("shaderpacks", parts.rp !== false);
    if (parts.cfg !== false) {
      for (const d of CFG_DIRS) {
        const w = await playMode.walkFiles(path.join(dir, d), { skip: (rel) => skipCfg(`${d}/${rel}`) });
        for (const f of w.files) zipFiles.push({ abs: f.abs, rel: `overrides/${d}/${f.rel}`, mtimeMs: f.mtimeMs });
      }
      if (fs.existsSync(path.join(dir, "options.txt"))) zipFiles.push({ abs: path.join(dir, "options.txt"), rel: "overrides/options.txt", mtimeMs: Date.now() });
    }
    // Data packs « dans tous les mondes » : dans le dossier de leur chargeur (Paxi, Global Packs).
    const loader = playMode.loaderOf(v);
    if (parts.dp !== false && loader) {
      const ldir = packs.DP_LOADERS[loader].dir;
      for (const d of (v.datapacks || []).filter((x) => x.auto)) {
        const abs = path.join(dir, ...ldir.split("/"), d.file);
        if (fs.existsSync(abs)) zipFiles.push({ abs, rel: `overrides/${ldir}/${d.file}`, mtimeMs: Date.now() });
      }
    }
    if (parts.w) {
      for (const key of worlds) {
        const found = await playMode.worldDir(key);
        if (!found || found.world.lastVersionId !== v.id) continue;
        const files = await playMode.walkFiles(found.dir, { skip: (rel) => rel === "session.lock" || rel === "omniscient-world.json" || (parts.dp === false && /^datapacks\//.test(rel)) });
        for (const f of files.files) zipFiles.push({ abs: f.abs, rel: `overrides/saves/${found.world.folder}/${f.rel}`, mtimeMs: f.mtimeMs });
      }
    }
    if (manual.length && !cloud) {
      const txt = path.join(os.tmpdir(), `omni-manual-${crypto.randomBytes(4).toString("hex")}.txt`);
      await fsp.writeFile(txt, `Mods à télécharger à la main (pas sur Modrinth) :\r\n\r\n${manual.join("\r\n")}\r\n`);
      zipFiles.push({ abs: txt, rel: "overrides/omniscient-a-telecharger.txt", mtimeMs: Date.now(), tmp: true });
    }
    // RAM conseillée (01/11) : le .mrpack n'a pas de case pour ça ; Omniscient la lit dans ce petit
    // fichier à côté (Modrinth App et Prism l'ignorent).
    if (packRam.intGB(ramGB)) {
      const rj = path.join(os.tmpdir(), `omni-ram-${crypto.randomBytes(4).toString("hex")}.json`);
      await fsp.writeFile(rj, JSON.stringify({ recommendedRamGB: packRam.intGB(ramGB) }));
      zipFiles.push({ abs: rj, rel: "omniscient.json", mtimeMs: Date.now(), tmp: true });
    }
    try {
      const size = await writeArchive(outFile, index, "modrinth.index.json", zipFiles);
      return { file: outFile, size, manual, custom };
    } finally {
      for (const f of zipFiles) if (f.tmp) await fsp.rm(f.abs, { force: true });
    }
  }

  // --- « Exporter pour un ami » (31/10, preview validée par Rushi, Laboratoire « addMenus ») --------
  // Deux formats au choix, la liste change avec :
  // - .mrpack (Modrinth) : liens Modrinth ; tout le reste (CurseForge ajoutés à la main, mods perso)
  //   part en .jar dans le fichier. Jamais de lien CurseForge (Modrinth refuserait le fichier).
  // - .zip (CurseForge) : liens CurseForge (manifest.json) pour tout ce qui existe sur CurseForge,
  //   même les mods réservés à l'appli CurseForge ; le reste (Modrinth seulement, perso) en .jar.
  // `cfMatch(fingerprints)` : empreintes → { projectId, fileId } (route du site, notre clé).
  // Cache (Rushi 31/10 : la fenêtre mettait 6 s) : lire les .jar, leurs empreintes et demander à
  // Modrinth/CurseForge ne se refait que si le dossier mods ou la liste du pack a changé.
  const friendCache = new Map();
  async function friendMods(id, opts = {}) {
    const { v, dir } = playMode.omniSource(id);
    const modsDir = path.join(dir, "mods");
    const files = [];
    for (const name of await fsp.readdir(modsDir).catch(() => [])) {
      const stt = await fsp.stat(path.join(modsDir, name)).catch(() => null);
      if (stt?.isFile()) files.push(`${name}|${stt.size}|${stt.mtimeMs}`);
    }
    const sig = JSON.stringify([!!opts.cfMatch, files.sort(), (v.mods || []).map((m) => [m.id, m.on, m.file?.filename, m.file?.sha1])]);
    const hit = friendCache.get(id);
    if (hit && hit.sig === sig && Date.now() - hit.at < 30 * 60 * 1000) return { ...hit.plan, v, dir };
    const plan = await friendModsRaw(id, opts);
    friendCache.set(id, { sig, at: Date.now(), plan });
    return plan;
  }
  async function friendModsRaw(id, { cfMatch = null } = {}) {
    const { v, dir } = playMode.omniSource(id);
    const modsDir = path.join(dir, "mods");
    const out = [];
    const known = new Set();
    for (const m of (v.mods || []).filter((x) => x.on !== false)) {
      const fn = SAFE_JAR.test(m.file?.filename || "") ? m.file.filename : null;
      if (fn) known.add(fn);
      const abs = fn && fs.existsSync(path.join(modsDir, fn)) ? path.join(modsDir, fn) : null;
      const source = m.source === "mr" ? "mr" : m.source === "cf" ? "cf" : "local";
      out.push({
        name: String(m.name || fn || "?"),
        source,
        abs,
        file: fn,
        sha1: /^[0-9a-f]{40}$/.test(m.file?.sha1 || "") ? m.file.sha1 : null,
        mr: source === "mr" && isMrUrl(m.file?.url) && fn ? { url: m.file.url, filename: fn, sha1: m.file.sha1, sha512: m.file.sha512 || null, size: m.file.size || 0, projectId: m.projectId || null } : null,
        cf: source === "cf" && Number(m.projectId) > 0 && Number(m.cf?.fileID) > 0 ? { projectId: Number(m.projectId), fileId: Number(m.cf.fileID) } : null,
        page: m.cf?.pageUrl || (source === "cf" && m.projectId ? `https://www.curseforge.com/projects/${m.projectId}` : source === "mr" && m.projectId ? `https://modrinth.com/mod/${m.projectId}` : null),
      });
    }
    // Mods perso : un .jar posé à la main dans mods/ (« J'ai le fichier »), hors de la liste du pack.
    for (const name of await fsp.readdir(modsDir).catch(() => [])) {
      if (!/\.jar$/i.test(name) || !SAFE_JAR.test(name) || known.has(name)) continue;
      out.push({ name: name.replace(/\.jar$/i, ""), source: "local", abs: path.join(modsDir, name), file: name, sha1: null, mr: null, cf: null, page: null });
    }
    for (const x of out) if (!x.sha1 && x.abs) x.sha1 = await sha1File(x.abs).catch(() => null);
    // Le même fichier sur Modrinth (par son SHA-1) : un lien plutôt que le fichier.
    const hashes = await packs.lookupHashes(out.filter((x) => x.sha1 && (!x.mr || !x.mr.sha512)).map((x) => x.sha1)).catch(() => new Map());
    for (const x of out) {
      const h = x.sha1 && hashes.get(x.sha1);
      if (!h) continue;
      if (x.mr) x.mr.sha512 ||= h.sha512;
      else if (x.file && h.sha512) x.mr = { url: h.url, filename: x.file, sha1: x.sha1, sha512: h.sha512, size: h.size || 0, projectId: h.projectId };
      if (!x.page && h.projectId) x.page = `https://modrinth.com/mod/${h.projectId}`;
    }
    // Le même fichier sur CurseForge (par son empreinte) : un lien dans le .zip.
    if (cfMatch) {
      const todo = out.filter((x) => !x.cf && x.abs);
      for (const x of todo) x.fp = packs.cfFingerprint(await fsp.readFile(x.abs));
      const found = todo.length ? await cfMatch(todo.map((x) => x.fp)).catch(() => new Map()) : new Map();
      for (const x of todo) {
        const c = found.get(x.fp);
        if (c) x.cf = { projectId: c.projectId, fileId: c.fileId };
      }
    }
    for (const x of out) {
      x.mrpack = x.mr?.sha512 ? "link" : x.abs ? "jar" : "missing";
      x.zip = x.cf ? "link" : x.abs ? "jar" : "missing";
    }
    return { v, dir, mods: out };
  }
  // Liste des auteurs et de leurs pages, dans le fichier exporté (Rushi : honorer les moddeurs).
  async function creditsFile(plan) {
    const lines = plan.mods.map((x) => `${x.name}${x.page ? ` : ${x.page}` : ""}`);
    if (!lines.length) return [];
    const txt = path.join(os.tmpdir(), `omni-credits-${crypto.randomBytes(4).toString("hex")}.txt`);
    await fsp.writeFile(txt, `Mods de ce pack et leur page (merci à leurs auteurs) :\r\n\r\n${lines.join("\r\n")}\r\n`);
    return [{ abs: txt, rel: "overrides/omniscient-credits.txt", mtimeMs: Date.now(), tmp: true }];
  }
  async function exportCfZip(id, outFile, { parts = {}, worlds = [], plan, ramGB = null }) {
    const { v, dir } = plan;
    const loader = v.pack?.loader;
    let lv = String(v.pack?.loaderVersion || "");
    if (lv.startsWith(`${v.minecraftVersion}-`)) lv = lv.slice(v.minecraftVersion.length + 1);
    const manifest = {
      // recommendedRam (Mo) : case officielle de CurseForge, lue aussi par Prism et Omniscient (01/11).
      minecraft: { version: v.minecraftVersion, modLoaders: loader && lv ? [{ id: `${loader}-${lv}`, primary: true }] : [], ...(packRam.intGB(ramGB) ? { recommendedRam: packRam.intGB(ramGB) * 1024 } : {}) },
      manifestType: "minecraftModpack",
      manifestVersion: 1,
      name: String(v.name || v.pack?.name || `Minecraft ${v.minecraftVersion}`).slice(0, 80),
      version: new Date().toISOString().slice(0, 10),
      author: "",
      files: [],
      overrides: "overrides",
    };
    const zipFiles = [];
    const manual = [];
    for (const x of plan.mods) {
      if (x.zip === "link") manifest.files.push({ projectID: x.cf.projectId, fileID: x.cf.fileId, required: true });
      else if (x.zip === "jar") zipFiles.push({ abs: x.abs, rel: `overrides/mods/${x.file}`, mtimeMs: Date.now() });
      else manual.push(`${x.name}${x.page ? ` : ${x.page}` : ""}`);
    }
    zipFiles.push(...(await creditsFile(plan)));
    const addAll = async (sub, on) => {
      if (!on) return;
      for (const x of await describeFiles(path.join(dir, sub), await zipNames(path.join(dir, sub)))) zipFiles.push({ abs: x.abs, rel: `overrides/${sub}/${x.file}`, mtimeMs: Date.now() });
    };
    await addAll("resourcepacks", parts.rp !== false);
    if (v.pack) await addAll("shaderpacks", parts.rp !== false);
    if (parts.cfg !== false) {
      for (const d of CFG_DIRS) {
        const w = await playMode.walkFiles(path.join(dir, d), { skip: (rel) => skipCfg(`${d}/${rel}`) });
        for (const f of w.files) zipFiles.push({ abs: f.abs, rel: `overrides/${d}/${f.rel}`, mtimeMs: f.mtimeMs });
      }
      if (fs.existsSync(path.join(dir, "options.txt"))) zipFiles.push({ abs: path.join(dir, "options.txt"), rel: "overrides/options.txt", mtimeMs: Date.now() });
    }
    const dpl = playMode.loaderOf(v);
    if (parts.dp !== false && dpl) {
      const ldir = packs.DP_LOADERS[dpl].dir;
      for (const d of (v.datapacks || []).filter((x) => x.auto)) {
        const abs = path.join(dir, ...ldir.split("/"), d.file);
        if (fs.existsSync(abs)) zipFiles.push({ abs, rel: `overrides/${ldir}/${d.file}`, mtimeMs: Date.now() });
      }
    }
    if (parts.w) {
      for (const key of worlds) {
        const found = await playMode.worldDir(key);
        if (!found || found.world.lastVersionId !== v.id) continue;
        const files = await playMode.walkFiles(found.dir, { skip: (rel) => rel === "session.lock" || rel === "omniscient-world.json" || (parts.dp === false && /^datapacks\//.test(rel)) });
        for (const f of files.files) zipFiles.push({ abs: f.abs, rel: `overrides/saves/${found.world.folder}/${f.rel}`, mtimeMs: f.mtimeMs });
      }
    }
    if (manual.length) {
      const txt = path.join(os.tmpdir(), `omni-manual-${crypto.randomBytes(4).toString("hex")}.txt`);
      await fsp.writeFile(txt, `Mods à télécharger à la main :\r\n\r\n${manual.join("\r\n")}\r\n`);
      zipFiles.push({ abs: txt, rel: "overrides/omniscient-a-telecharger.txt", mtimeMs: Date.now(), tmp: true });
    }
    try {
      const size = await writeArchive(outFile, manifest, "manifest.json", zipFiles);
      return { file: outFile, size, manual };
    } finally {
      for (const f of zipFiles) if (f.tmp) await fsp.rm(f.abs, { force: true });
    }
  }

  // --- Import d'un .omnipack -----------------------------------------------------------------------
  async function readOmnipack(zipFile) {
    const entries = await listZip(zipFile);
    const head = entries.find((e) => e.name === "omnipack.json");
    if (!head) throw new Error("Ce fichier n'est pas un Pack Omniscient (omnipack.json introuvable).");
    const json = JSON.parse((await readZipEntry(zipFile, head, { maxBytes: 8 * 1024 * 1024 })).toString("utf8"));
    if (json.format !== FORMAT || json.kind !== "omnipack" || !Array.isArray(json.versions) || !json.versions.length) throw new Error("Pack Omniscient illisible ou d'un format plus récent : mets le launcher à jour.");
    for (const ver of json.versions) {
      if (!MC_ID.test(ver.minecraftVersion || "")) throw new Error("Version de Minecraft invalide dans le pack.");
      if (ver.loader && !packs.LOADER_IDS.includes(ver.loader)) throw new Error("Chargeur de mods inconnu dans le pack.");
      for (const m of ver.mods || []) {
        if (!isMrUrl(m.file?.url) || !SAFE_JAR.test(m.file?.filename || "") || !/^[0-9a-f]{40}$/.test(m.file?.sha1 || "")) throw new Error(`Mod refusé dans le pack (${m.name || "?"}) : seul Modrinth est accepté.`);
      }
      for (const list of [ver.resourcepacks, ver.shaders, ver.datapacks]) {
        for (const x of list || []) {
          if (!SAFE_ZIP.test(x.file || "") || (x.mr && !isMrUrl(x.mr.url))) throw new Error(`Fichier refusé dans le pack : ${x.file || "?"}`);
        }
      }
    }
    return { json, entries };
  }

  /**
   * Installe un .omnipack : une version de « Mes versions » par version du pack (ou seulement `only`).
   * `pub` : pack publié par Omniscient (mods en lecture seule, kind "omnipub").
   * `worlds` : dossiers "<mc>/<dossier>" à importer (une map) ; null = tous.
   */
  async function installOmni(zipFile, { only = null, worlds = null, pub = null, parts = ["mods", "cfg", "rp", "sh", "dp"], onProgress = () => {} } = {}) {
    const { json, entries } = await readOmnipack(zipFile);
    const group = crypto.randomUUID();
    const created = [];
    const list = json.versions.filter((x) => !only || x.minecraftVersion === only);
    if (!list.length) throw new Error("Cette version n'est pas dans le pack.");
    // Réglages, fichiers hors Modrinth et mondes choisis d'une version : chemin dans son dossier.
    const pickFor = (ver) => {
      const pre = `versions/${ver.minecraftVersion}/`;
      const wantWorld = (folder) => worlds == null || worlds.includes(`${ver.minecraftVersion}/${folder}`);
      return (name) => {
        if (!name.startsWith(pre) || name.endsWith("/")) return null;
        const rel = name.slice(pre.length);
        if (rel.startsWith("overrides/")) return parts.includes("cfg") && isAllowedOverride(rel) ? rel.slice(10) : null;
        if (rel.startsWith("files/")) {
          // Un fichier .zip par dossier, jamais de sous-dossier ni d'autre type.
          const [, sub, file, extra] = rel.split("/");
          if (extra !== undefined || !SAFE_ZIP.test(file || "")) return null;
          if (sub === "resourcepacks") return parts.includes("rp") ? rel.slice(6) : null;
          if (sub === "shaderpacks") return parts.includes("sh") ? rel.slice(6) : null;
          if (sub === "datapacks") return parts.includes("dp") ? `.omniscient/datapacks/${file}` : null;
          return null;
        }
        if (rel.startsWith("worlds/")) {
          if (FORBIDDEN_EXT.test(rel) || winUnsafe(rel)) return null;
          const folder = rel.split("/")[1];
          return wantWorld(folder) ? `saves/${rel.slice(7)}` : null;
        }
        return null;
      };
    };
    // Progression (27/10) : fichiers et octets à extraire, par version et en tout.
    const sizes = list.map((ver) => {
      const pick = pickFor(ver);
      const c = { files: 0, bytes: 0 };
      for (const e of entries) {
        if (!pick(e.name)) continue;
        c.files++;
        c.bytes += e.size || 0;
      }
      return c;
    });
    const allBytes = sizes.reduce((a, c) => a + c.bytes, 0);
    let doneBytes = 0;
    let last = 0;
    for (const [i, ver] of list.entries()) {
      onProgress({ step: "version", mc: ver.minecraftVersion });
      const omni = { group, base: ver.minecraftVersion === json.base, tested: !!pub, missing: ver.missing || [] };
      let v;
      if (ver.loader) {
        const mods = parts.includes("mods") ? (ver.mods || []).map((m) => ({ id: m.id, name: String(m.name || m.file.filename).slice(0, 80), source: "mr", projectId: m.projectId, versionId: m.versionId, version: m.version, file: m.file, auto: !!m.auto, pinned: !!m.pinned, by: m.by || [], on: m.on !== false })) : [];
        v = await playMode.createCustomVersion({ kind: pub ? "omnipub" : "mine", name: json.name, minecraftVersion: ver.minecraftVersion, loader: ver.loader, loaderVersion: ver.loaderVersion, mods, extra: pub ? { packId: pub.packId, slug: pub.slug, packName: pub.name } : {}, omni });
      } else {
        v = await playMode.createVersion({ minecraftVersion: ver.minecraftVersion, name: json.name, omni });
      }
      const { dir, store } = playMode.omniSource(v.id);
      const wantWorld = (folder) => worlds == null || worlds.includes(`${ver.minecraftVersion}/${folder}`);
      // Réglages, fichiers hors Modrinth et mondes choisis : extraits de l'archive (jamais modifiée).
      const seen = { files: 0, bytes: 0 };
      let cur = "";
      const tell = (file = cur, force = false) => {
        cur = file;
        const now = Date.now();
        if (!force && now - last < 150) return;
        last = now;
        onProgress({ detail: { n: i, of: list.length, mc: ver.minecraftVersion, files: seen.files, filesOf: sizes[i].files, bytes: seen.bytes, total: sizes[i].bytes, file, overall: allBytes ? Math.min(0.99, doneBytes / allBytes) : null } });
      };
      tell("", true);
      await extractZip(zipFile, dir, {
        pick: pickFor(ver),
        onEntry: (_entry, rel) => {
          seen.files++;
          tell(rel);
        },
        onBytes: (n) => {
          seen.bytes += n;
          doneBytes += n;
          tell();
        },
      });
      // Liens Modrinth : téléchargés et vérifiés.
      const fetchSet = async (items, sub, part) => {
        if (!parts.includes(part)) return;
        for (const x of items || []) {
          if (!x.mr) continue;
          await packs.downloadChecked({ url: x.mr.url, filename: x.file, sha1: x.sha1 }, path.join(dir, sub, x.file));
        }
      };
      await fetchSet(ver.resourcepacks, "resourcepacks", "rp");
      await fetchSet(ver.shaders, "shaderpacks", "sh");
      await fetchSet(ver.datapacks, ".omniscient/datapacks", "dp");
      if (parts.includes("rp")) for (const r of ver.resourcepacks || []) if (r.on) await packs.setResourcePack(dir, r.file, true);
      if (parts.includes("sh") && ver.shaderOn && (ver.shaders || []).some((s) => s.file === ver.shaderOn)) await packs.setIrisShader(dir, ver.shaderOn);
      // Mondes importés : clé, sauvegardes activées ; puis les data packs retrouvent leurs mondes.
      const folders = (ver.worlds || []).map((w) => w.folder).filter(wantWorld);
      const imported = folders.length ? await playMode.registerImported(v.id, folders) : [];
      if (parts.includes("dp")) {
        for (const d of ver.datapacks || []) {
          if (!fs.existsSync(path.join(store, d.file))) continue;
          await playMode.addDatapackEntry(v.id, { file: d.file, name: d.name || d.file.replace(/\.zip$/i, ""), src: d.mr ? "mr" : "file", mr: d.mr ? { projectId: d.mr.projectId, versionId: d.mr.versionId } : null });
          const keys = imported.filter((w) => (d.worlds || []).includes(w.folder)).map((w) => w.key);
          const cur = playMode.getVersion(v.id).datapacks.find((x) => x.file === d.file);
          cur.worlds = keys;
          if (d.auto && playMode.loaderOf(playMode.getVersion(v.id))) await playMode.setDatapack(v.id, d.file, { worlds: [], auto: true }).catch(() => {});
        }
        await playMode.saveState();
      }
      if (packRam.intGB(ver.ramGB)) await playMode.setVersionRam(v.id, { mode: "auto", packGB: packRam.intGB(ver.ramGB) }).catch(() => false);
      created.push({ id: v.id, mc: ver.minecraftVersion, worlds: imported });
    }
    return { name: json.name, group, created };
  }

  // Ce que la fenêtre d'import montre (même forme que cfPack:read, plus la liste des versions).
  async function describeForImport(zipFile) {
    const { json } = await readOmnipack(zipFile);
    const base = json.versions.find((x) => x.minecraftVersion === json.base) || json.versions[0];
    const worlds = [];
    for (const ver of json.versions) for (const w of ver.worlds || []) worlds.push({ folder: `${ver.minecraftVersion}/${w.folder}`, name: `${w.name || w.folder} (${ver.minecraftVersion})`, minecraftVersion: ver.minecraftVersion, sizeBytes: w.sizeBytes || 0, lastPlayed: null, icon: null });
    return {
      name: json.name,
      minecraftVersion: base.minecraftVersion,
      loader: base.loader,
      loaderVersion: base.loaderVersion || "",
      modCount: (base.mods || []).length,
      versions: json.versions.map((x) => x.minecraftVersion),
      recommendedRamGB: packRam.intGB(base.ramGB),
      configFiles: 1,
      resourcepacks: (base.resourcepacks || []).map((r) => r.file),
      shaders: (base.shaders || []).map((r) => r.file),
      worlds,
      json,
    };
  }

  return { targetVersions, generate, modsFor, exportPreview, exportOmni, exportMrpack, friendMods, exportCfZip, readOmnipack, installOmni, describeForImport };
}

module.exports = { createOmniPack, FORMAT };
