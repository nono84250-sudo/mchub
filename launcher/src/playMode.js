// Mode « Jouer » (bêta, preview C validée par Rushi le 24/10) : jouer à n'importe quelle version
// de Minecraft sans passer par un serveur, en vanilla ou avec un pack officiel (liste de mods
// Modrinth préparée par l'équipe, rien n'est hébergé chez nous), et garder ses mondes sauvegardés.
//
// Organisation sur le disque (dans le dossier des jeux, donc déplaçable avec lui) :
//   minecraft/play/game/            dossier de jeu COMMUN à toutes les versions (comme le
//                                   .minecraft du launcher officiel) : saves/, options.txt,
//                                   resourcepacks/… Les mondes ne dépendent donc pas d'une version.
//   minecraft/play/mods/<id>/       mods d'une version avec pack, chargés par Fabric via
//                                   -Dfabric.addMods (le dossier game/mods reste vide).
//   minecraft/play/backups/<clé>/   sauvegardes .zip d'un monde + index.json.
//   minecraft/play/play.json        mes versions et réglages par monde.
//   minecraft/play/instances/<id>/  (26/10, séparation stricte, Laboratoire « strictDirs ») dossier
//                                   de jeu PROPRE à une version : ses mondes (saves/), ses réglages,
//                                   ses packs de ressources, ses mods (Mon pack, pack CurseForge).
//                                   game/ ne garde alors que les mondes pas encore rangés (importés,
//                                   jamais joués) : un monde va dans le dossier de sa version au
//                                   premier lancement (après une sauvegarde).
// Chaque monde garde sa clé dans <monde>/omniscient-world.json (Minecraft ignore ce fichier),
// pour le retrouver même si son dossier est renommé.
//
// Règles (Rushi, 24/10) : sauvegarde activée par défaut sur chaque monde, désactivable ; import
// depuis .minecraft TOUJOURS par copie. Un monde fermé est zippé directement (afterGame) ; un monde
// ouvert dans le jeu (F6, toutes les 30 min, voir liveSave.js) est d'abord copié dans un dossier
// figé, recopié tant que le jeu écrit dedans, puis zippé depuis cette copie.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { writeZip, extractZip, listZip } = require("./zipStream");
const { readLevelDat } = require("./levelDat");
const packs = require("./playPacks");
const packRam = require("./packRam");

const WORLD_FILE = "omniscient-world.json";
// Combien de sauvegardes garder sur le PC, monde par monde (preview validée par Rushi le 24/10) :
// un nombre OU une taille max. La plus ancienne part en premier, la plus récente est toujours
// gardée, la dernière « avant restauration » aussi. Les sauvegardes avec un nom (Maj+F6) ne sont
// jamais supprimées toutes seules si `named` (coché par défaut) ; elles comptent quand même dans
// la place utilisée. Le cloud n'est jamais touché par ce réglage.
// every : une sauvegarde automatique toutes les X min de jeu ; send : envoi automatique dans le
// cloud (« all » toutes, « game » une par partie + celles avec un nom, « manual » à la main).
// online : versions gardées en ligne par monde (25/10), sans compter les ★ ni les envois à la main.
const DEFAULT_KEEP = { mode: "count", count: 10, sizeMb: 1000, named: true, every: 30, send: "all", online: 3 };
const ONLINE_MAX = 10;
const EVERY_CHOICES = [5, 10, 15, 30, 60];
const LOCAL_KEEP = DEFAULT_KEEP.count;

// Ce que le réglage garde et supprime vraiment (même calcul dans play.js pour l'aperçu).
const validWorldKey = (key) => typeof key === "string" && /^[\w-]{8,64}$/.test(key);

// `protectId` (audit du 25/10) : la sauvegarde qu'on est en train de restaurer n'est jamais retirée
// par la sauvegarde « avant restauration » faite juste avant.
function planBackups(list, cfg, protectId = null) {
  const keep = [];
  const drop = [];
  const lastRestore = list.find((b) => b.reason === "before-restore");
  let n = 0;
  let used = 0;
  list.forEach((b, i) => {
    const size = Number(b.sizeBytes) || 0;
    // Protégée (nommée, ou la dernière « avant restauration ») : jamais supprimée, mais elle compte
    // dans le nombre et la place (une limite de 10 = 10 sauvegardes au total sur le PC).
    // La sauvegarde « Import » (Version d'origine, 26/10) non plus : seule la Suppression
    // définitive l'efface. Les sauvegardes 🛡 « Avant 26.3 » d'un changement de version (27/10,
    // Laboratoire « versionGuard ») non plus : seulement si le joueur les supprime lui-même.
    if ((cfg.named && b.label) || b === lastRestore || b.reason === "import" || b.reason === "upgrade" || b.guardKeep || (protectId && b.id === protectId)) {
      keep.push(b);
      n++;
      used += size;
      return;
    }
    const fits = cfg.mode === "size" ? used + size <= cfg.sizeMb * 1_000_000 : cfg.count === 0 || n < cfg.count;
    if (i === 0 || fits) {
      keep.push(b);
      n++;
      used += size;
    } else drop.push(b);
  });
  return { keep, drop };
}

function cleanKeep(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : {};
  return {
    mode: c.mode === "size" ? "size" : "count",
    // 0 = tout garder (curseur « ∞ » de la fenêtre Sauvegardes, 25/10).
    count: Number(c.count) === 0 ? 0 : Math.min(500, Math.max(1, Math.round(Number(c.count) || DEFAULT_KEEP.count))),
    sizeMb: Math.min(1_000_000, Math.max(1, Math.round(Number(c.sizeMb) || DEFAULT_KEEP.sizeMb))),
    named: c.named !== false,
    every: EVERY_CHOICES.includes(Number(c.every)) ? Number(c.every) : DEFAULT_KEEP.every,
    send: ["all", "game", "manual"].includes(c.send) ? c.send : DEFAULT_KEEP.send,
    online: Math.min(ONLINE_MAX, Math.max(1, Math.round(Number(c.online) || DEFAULT_KEEP.online))),
  };
}
// Dossier ajouté dans chaque .zip de sauvegarde (version, pack, options du jeu), retiré du monde
// à la restauration.
const META_DIR = "omniscient-meta";
const MOJANG_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
// Seul hôte accepté pour un fichier de pack : le CDN de Modrinth (même règle que les .mrpack).
const PACK_FILE_HOSTS = new Set(["cdn.modrinth.com"]);
const VERSION_ID_PATTERN = /^[\w.+-]+$/;

function createPlayMode({ gameRoot, appDataDir }) {
  const PLAY_ROOT = path.join(gameRoot, "play");
  const GAME_DIR = path.join(PLAY_ROOT, "game");
  const GAME_DIR_COMMON = GAME_DIR;
  const SAVES = path.join(GAME_DIR, "saves");
  const MODS_ROOT = path.join(PLAY_ROOT, "mods");
  const BACKUPS = path.join(PLAY_ROOT, "backups");
  const STATE_FILE = path.join(PLAY_ROOT, "play.json");
  const INST_ROOT = path.join(PLAY_ROOT, "instances");
  // Dossier de jeu d'une version (séparation stricte) ; null = dossier commun game/.
  const gameDirOf = (versionId) => (versionId && VERSION_ID_PATTERN.test(versionId) ? path.join(INST_ROOT, versionId) : GAME_DIR);
  const savesOf = (versionId) => path.join(gameDirOf(versionId), "saves");
  // Mon pack et pack CurseForge : toujours leur propre dossier (leurs mods sont dans mods/).
  const isCustom = (v) => ["mine", "cf", "mr", "omnipub"].includes(v?.pack?.kind);

  // --- État (play.json) -----------------------------------------------------
  let state = null;
  function loadState() {
    if (state) return state;
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    } catch {
      state = {};
    }
    if (!Array.isArray(state.versions)) state.versions = [];
    if (!state.worlds || typeof state.worlds !== "object") state.worlds = {};
    return state;
  }
  // Écriture sûre d'un fichier JSON (02/11, Rushi : « fichier non trouvé » de temps en temps à l'import
  // d'un pack). Avant, deux sauvegardes en même temps (l'import et la liste des mondes, par exemple)
  // écrivaient la même copie « play.json.part » : la 1re la renommait, la 2e ne la trouvait plus
  // (« ENOENT: no such file or directory, rename … »). Maintenant les écritures d'un même fichier
  // passent une par une, chacune avec sa propre copie temporaire, et le renommage réessaie quelques
  // fois si Windows (antivirus, indexation) tient le fichier un instant.
  const writeChains = new Map();
  function writeJsonSafe(file, data) {
    const prev = writeChains.get(file) || Promise.resolve();
    const run = prev.then(async () => {
      await fsp.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}-${crypto.randomBytes(4).toString("hex")}.part`;
      try {
        await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
        for (let attempt = 1; ; attempt++) {
          try {
            await fsp.rename(tmp, file);
            break;
          } catch (error) {
            if (attempt >= 5 || !["EPERM", "EBUSY", "EACCES"].includes(error?.code)) throw error;
            await new Promise((r) => setTimeout(r, 100 * attempt));
          }
        }
      } catch (error) {
        await fsp.rm(tmp, { force: true }).catch(() => {});
        throw error;
      }
    });
    const tail = run.catch(() => {});
    writeChains.set(file, tail);
    tail.then(() => {
      if (writeChains.get(file) === tail) writeChains.delete(file);
    });
    return run;
  }
  function saveState() {
    return writeJsonSafe(STATE_FILE, state);
  }
  // Audit du 25/10 : une clé de monde ne sert dans un chemin que si elle a la forme attendue
  // (jamais « .. » ni « __proto__ » venus de la fenêtre).
  function assertKey(key) {
    if (!validWorldKey(key)) throw new Error("Clé de monde invalide.");
  }
  function worldState(key) {
    assertKey(key);
    const s = loadState();
    if (!s.worlds[key]) s.worlds[key] = { backup: true };
    return s.worlds[key];
  }

  // --- Versions de Minecraft (liste officielle de Mojang) -------------------
  let manifestCache = null;
  async function listMinecraftVersions() {
    if (manifestCache && Date.now() - manifestCache.at < 60 * 60_000) return manifestCache.versions;
    const res = await fetch(MOJANG_MANIFEST, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Liste des versions de Minecraft injoignable (HTTP ${res.status}).`);
    const json = await res.json();
    const versions = (json.versions || []).map((v) => ({
      id: v.id,
      type: v.type === "release" ? "release" : v.type === "snapshot" ? "snapshot" : "old",
      releaseTime: v.releaseTime,
    }));
    manifestCache = { at: Date.now(), versions, latest: json.latest || {} };
    return versions;
  }
  function versionType(id) {
    return manifestCache?.versions.find((v) => v.id === id)?.type || "release";
  }

  // --- Mes versions -----------------------------------------------------------
  function listVersions() {
    return loadState().versions.map((v) => ({ ...v, pack: v.pack ? { ...v.pack, cfHand: undefined } : v.pack, files: undefined, mods: undefined, installed: undefined, modCount: modCountOf(v), problems: v.problemCount || 0, hand: handFiles(v) }));
  }
  // Nombre de mods de la tuile (05/11, Rushi : la tuile disait 10, la page du pack 11). Même compte
  // que la page du pack : les mods de la liste, plus les .jar posés à la main dans mods/ (« Fichier »),
  // allumés ou coupés.
  function modCountOf(v) {
    const list = v?.mods || v?.files || [];
    if (!v?.pack || !isCustom(v)) return list.length;
    try {
      const known = new Set((v.mods || []).map(fileNameOf).filter(Boolean));
      let extra = 0;
      for (const n of fs.readdirSync(modsDirOf(v.id))) {
        if (!/\.jar(\.disabled)?$/i.test(n)) continue;
        if (!known.has(n.replace(/\.disabled$/i, ""))) extra++;
      }
      return list.length + extra;
    } catch {
      return list.length;
    }
  }
  // Fichiers encore à télécharger à la main (04/11, pastille et « Reprendre » de Mes installations) :
  // mods CurseForge sans lien pas encore dans mods/, et .zip (packs de ressources, shaders) gardés à
  // l'import et pas encore dans leur dossier.
  function handFiles(v) {
    if (!v?.pack) return [];
    const out = [];
    try {
      const mods = modsDirOf(v.id);
      for (const m of v.mods || []) {
        if (m.source !== "cf" || m.on === false || m.file?.url) continue;
        const f = fileNameOf(m);
        if (!f || fs.existsSync(path.join(mods, f)) || fs.existsSync(path.join(mods, `${f}.disabled`))) continue;
        out.push({ id: m.id, name: m.name, fileName: f, kind: "mod" });
      }
      const dir = gameDirOf(v.id);
      for (const c of v.pack.cfHand || []) {
        // Data pack (04/11) : gardé dans .omniscient/datapacks/ de l'installation une fois trouvé.
        const where = c?.kind === "dp" ? DP_STORE(v.id) : path.join(dir, c?.kind === "sh" ? "shaderpacks" : "resourcepacks");
        if (!c?.fileName || fs.existsSync(path.join(where, c.fileName))) continue;
        out.push({ id: c.id, name: c.name, fileName: c.fileName, kind: c.kind === "sh" || c.kind === "dp" ? c.kind : "rp" });
      }
    } catch {
      return out;
    }
    return out.slice(0, 200);
  }
  function getVersion(id) {
    return loadState().versions.find((v) => v.id === id) || null;
  }

  // `pack` : version publiée d'un pack officiel, telle que renvoyée par le site
  // (/api/public/play/packs), ou null pour Vanilla.
  async function createVersion({ minecraftVersion, pack = null, name = "", omni = null, own = false }) {
    if (!VERSION_ID_PATTERN.test(minecraftVersion || "")) throw new Error("Version de Minecraft invalide.");
    const s = loadState();
    const entry = {
      id: crypto.randomUUID(),
      minecraftVersion,
      type: versionType(minecraftVersion),
      name: String(name || "").trim().slice(0, 60),
      pack: pack ? packSnapshot(pack) : null,
      files: pack ? pack.files : [],
      createdAt: new Date().toISOString(),
      lastPlayedAt: null,
      ...(omni ? { omni: { group: omni.group || crypto.randomUUID(), tested: !!omni.tested, missing: [], base: omni.base !== false } } : {}),
      ...(own ? { own: true } : {}),
    };
    s.versions.unshift(entry);
    await saveState();
    return { ...entry, files: undefined };
  }
  function packSnapshot(pack) {
    return {
      packId: pack.packId,
      slug: pack.slug,
      name: pack.name,
      versionId: pack.versionId,
      loaderVersion: pack.loaderVersion,
      updatedAt: pack.updatedAt || null,
    };
  }
  // Logo du pack (image en data: URL, préparée par main.js), affiché sur sa tuile.
  async function setVersionIcon(id, icon) {
    const v = getVersion(id);
    if (!v || typeof icon !== "string" || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(icon) || icon.length > 210_000) return false;
    v.icon = icon;
    await saveState();
    return true;
  }
  // RAM par pack (01/11, Laboratoire « packRam ») : réglage de l'installation (voir packRam.js).
  async function setVersionRam(id, ram) {
    const v = getVersion(id);
    const clean = packRam.cleanRam(ram);
    if (!v || !clean) return false;
    // La RAM conseillée par le fichier du pack reste, même quand le joueur change de mode.
    if (!clean.packGB && v.ram?.packGB) clean.packGB = v.ram.packGB;
    v.ram = clean;
    await saveState();
    return true;
  }
  async function renameVersion(id, name) {
    const v = getVersion(id);
    if (!v) return false;
    v.name = String(name || "").trim().slice(0, 60);
    await saveState();
    return true;
  }
  // Retire une version : ses mods sont supprimés, jamais les mondes. Avec un dossier propre
  // (séparation stricte), ses mondes reviennent dans le dossier commun game/saves ; le reste du
  // dossier (réglages, captures d'écran…) n'est pas effacé.
  async function removeVersion(id) {
    const s = loadState();
    const at = s.versions.findIndex((v) => v.id === id);
    if (at < 0) return false;
    const v = s.versions[at];
    if (VERSION_ID_PATTERN.test(id)) {
      const saves = savesOf(id);
      for (const d of await fsp.readdir(saves, { withFileTypes: true }).catch(() => [])) {
        if (!d.isDirectory() || d.name.startsWith(".omni-")) continue;
        await fsp.mkdir(SAVES, { recursive: true });
        await fsp.rename(path.join(saves, d.name), path.join(SAVES, await uniqueFolder(d.name, SAVES)));
      }
      // Seulement les mods que le launcher a mis lui-même (ceux du joueur restent).
      for (const m of v.mods || []) {
        const f = m.file?.filename || m.cf?.fileName || m.fileName;
        if (f && f === path.basename(f)) {
          await fsp.rm(path.join(gameDirOf(id), "mods", f), { force: true });
          await fsp.rm(path.join(gameDirOf(id), "mods", `${f}.disabled`), { force: true });
        }
      }
    }
    s.versions.splice(at, 1);
    for (const ws of Object.values(s.worlds)) if (ws.home === id) ws.home = null;
    await saveState();
    if (VERSION_ID_PATTERN.test(id)) await fsp.rm(path.join(MODS_ROOT, id), { recursive: true, force: true });
    listWorldsDirty();
    return true;
  }
  async function touchVersion(id) {
    const v = getVersion(id);
    if (!v) return;
    v.lastPlayedAt = new Date().toISOString();
    // La dernière jouée remonte en haut de la liste, comme dans le launcher officiel.
    const s = loadState();
    s.versions.splice(s.versions.indexOf(v), 1);
    s.versions.unshift(v);
    await saveState();
  }
  // Le site a peut-être mis à jour la liste des mods de ce pack (même version publiée) : on garde
  // la plus récente, et l'ancienne si le site est injoignable (jouer hors ligne reste possible).
  async function refreshPackFiles(id, latest) {
    const v = getVersion(id);
    if (!v?.pack || !latest) return;
    v.files = latest.files;
    v.pack = packSnapshot(latest);
    await saveState();
  }

  /**
   * Prépare les fichiers d'une version (vanilla, ou Fabric + mods du pack) avant le lancement.
   * `deps` : fonctions de modpack.js / javaManager.js fournies par main.js.
   * Renvoie { minecraftVersion, customVersion, jvmArgs, javaPath, gameDirectory }.
   */
  async function prepareVersion(id, { deps, onProgress = () => {}, signal, waitIfPaused, javaPreferred, gameDir = null }) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette version n'existe plus dans Mes versions.");
    const GAME_DIR = gameDir || (ownDir(v) ? gameDirOf(id) : GAME_DIR_COMMON);
    await fsp.mkdir(path.join(GAME_DIR, "saves"), { recursive: true });
    await seedOptions(GAME_DIR, v);
    await keysSnapshot(id, GAME_DIR).catch(() => {});
    const versionsDir = path.join(gameRoot, "versions");
    onProgress({ step: "java" });
    const vanilla = await deps.ensureVanillaVersion(versionsDir, v.minecraftVersion);
    const javaPath = await deps.ensureJavaForMajor(vanilla.javaVersion?.majorVersion ?? 8, {
      preferredPath: javaPreferred,
      onProgress: (text) => onProgress({ text }),
    });
    if (!v.pack) return { minecraftVersion: v.minecraftVersion, customVersion: null, jvmArgs: [], javaPath, gameDirectory: GAME_DIR };
    if (isCustom(v)) return prepareCustom(v, { deps, onProgress, signal, waitIfPaused, javaPath, gameDir: GAME_DIR });

    if (!VERSION_ID_PATTERN.test(v.pack.loaderVersion || "")) throw new Error("Version de Fabric invalide dans ce pack.");
    onProgress({ step: "mods", modded: true });
    const loaderVersionId = await deps.installLoader({
      loaderId: `fabric-${v.pack.loaderVersion}`,
      minecraftVersion: v.minecraftVersion,
      gameRoot,
      javaPath,
      onProgress,
    });
    const { customVersion, jvmArgs } = await deps.prepareLaunchVersion({ gameRoot, loaderVersionId, minecraftVersion: v.minecraftVersion });

    const modsDir = path.join(MODS_ROOT, id);
    await fsp.mkdir(modsDir, { recursive: true });
    const entries = [];
    for (const file of v.files || []) {
      let host = "";
      try {
        host = new URL(file.url).hostname;
      } catch {
        /* lien invalide : refusé juste en dessous */
      }
      if (!PACK_FILE_HOSTS.has(host)) throw new Error(`Lien de mod refusé (${file.filename || "?"}) : seul Modrinth est accepté.`);
      if (!/^[\w.+() -]+\.jar$/i.test(file.filename || "")) throw new Error(`Nom de fichier de mod refusé : ${file.filename}`);
      entries.push({ path: file.filename, url: file.url, sha1: file.sha1, size: file.size });
    }
    const previousFiles = (await fsp.readdir(modsDir).catch(() => [])).filter((f) => f.endsWith(".jar"));
    await deps.installFiles({ entries, instanceDir: modsDir, previousFiles, onProgress, signal, waitIfPaused });
    const jars = entries.map((e) => path.join(modsDir, e.path));
    return {
      minecraftVersion: v.minecraftVersion,
      customVersion,
      jvmArgs: [...jvmArgs, ...(jars.length ? [`-Dfabric.addMods=${jars.join(path.delimiter)}`] : [])],
      javaPath,
      gameDirectory: GAME_DIR,
    };
  }

  // --- Mondes -------------------------------------------------------------------
  async function readWorldKey(dir) {
    try {
      const key = JSON.parse(await fsp.readFile(path.join(dir, WORLD_FILE), "utf8")).key;
      return typeof key === "string" && /^[\w-]{8,64}$/.test(key) ? key : null;
    } catch {
      return null;
    }
  }
  async function writeWorldKey(dir, key) {
    await fsp.writeFile(path.join(dir, WORLD_FILE), JSON.stringify({ key, note: "Omniscient Launcher : identifiant de ce monde pour ses sauvegardes." }));
  }

  async function walkFiles(root, { skip = () => false } = {}) {
    const files = [];
    let bytes = 0;
    let newest = 0;
    async function walk(abs, rel) {
      let entries;
      try {
        entries = await fsp.readdir(abs, { withFileTypes: true });
      } catch (error) {
        if (error?.code === "ENOENT") return;
        throw error;
      }
      for (const entry of entries) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (skip(childRel, entry)) continue;
        const childAbs = path.join(abs, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) await walk(childAbs, childRel);
        else if (entry.isFile()) {
          const stat = await fsp.stat(childAbs);
          files.push({ abs: childAbs, rel: childRel, size: stat.size, mtimeMs: stat.mtimeMs });
          bytes += stat.size;
          if (stat.mtimeMs > newest) newest = stat.mtimeMs;
        }
      }
    }
    await walk(root, "");
    return { files, bytes, newest };
  }
  // session.lock : verrou du jeu, inutile (et parfois verrouillé par Windows) dans une copie.
  const skipWorldFile = (rel) => rel === "session.lock";

  function backupIndexFile(key) {
    assertKey(key);
    return path.join(BACKUPS, key, "index.json");
  }
  async function readBackups(key) {
    try {
      const list = JSON.parse(await fsp.readFile(backupIndexFile(key), "utf8"));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
  async function writeBackups(key, list) {
    await fsp.mkdir(path.join(BACKUPS, key), { recursive: true });
    await writeJsonSafe(backupIndexFile(key), list);
  }

  async function iconDataUrl(dir) {
    try {
      const buf = await fsp.readFile(path.join(dir, "icon.png"));
      if (buf.length > 512 * 1024 || buf[0] !== 0x89) return null;
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }

  // Tous les mondes du dossier commun. La taille est recalculée seulement si le monde a changé.
  let scanRun = null;
  function listWorlds() {
    if (!scanRun) scanRun = scanWorlds().finally(() => (scanRun = null));
    return scanRun;
  }
  // Où chercher les mondes : le dossier commun, puis celui de chaque version (séparation stricte).
  async function saveDirs() {
    const out = [];
    const homes = [null, ...loadState().versions.map((v) => v.id)];
    for (const home of homes) {
      const saves = savesOf(home);
      let dirs;
      try {
        dirs = (await fsp.readdir(saves, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith(".omni-"));
      } catch {
        continue;
      }
      for (const d of dirs) out.push({ name: d.name, dir: path.join(saves, d.name), home });
    }
    return out;
  }
  function listWorldsDirty() {
    scanRun = null;
  }
  async function scanWorlds() {
    const s = loadState();
    const dirs = await saveDirs();
    const seen = new Set();
    const worlds = [];
    let changed = false;
    for (const d of dirs) {
      const dir = d.dir;
      const levelPath = path.join(dir, "level.dat");
      let levelStat;
      try {
        levelStat = await fsp.stat(levelPath);
      } catch {
        continue;
      }
      let key = await readWorldKey(dir);
      // Monde copié à la main dans le jeu : même clé que l'original, on lui en donne une nouvelle.
      if (!validWorldKey(key) || seen.has(key)) {
        key = crypto.randomUUID();
        await writeWorldKey(dir, key).catch(() => {});
        changed = true;
      }
      seen.add(key);
      const ws = worldState(key);
      ws.folder = d.name;
      if ((ws.home || null) !== d.home) {
        ws.home = d.home;
        changed = true;
      }
      // Monde rangé dans le dossier d'une version : c'est sa version.
      if (d.home && ws.lastVersionId !== d.home) {
        ws.lastVersionId = d.home;
        changed = true;
      }
      const level = (await readLevelDat(levelPath)) || {};
      if (ws.sizeMtime !== levelStat.mtimeMs || typeof ws.sizeBytes !== "number") {
        ws.sizeBytes = (await walkFiles(dir, { skip: skipWorldFile })).bytes;
        ws.sizeMtime = levelStat.mtimeMs;
        changed = true;
      }
      const backups = await readBackups(key);
      // « Pas encore dans le cloud » : seulement celles que le réglage « Envoi au cloud » enverra.
      const plan = cloudPlan(backups);
      const toSend = backups.filter((b) => !b.cloud && plan.has(b.id));
      const lastVersion = ws.lastVersionId ? getVersion(ws.lastVersionId) : null;
      if (level.name && !ws.modCopyOf && !ws.versionCopy && ws.name !== level.name) {
        ws.name = level.name;
        changed = true;
      }
      if (!ws.minecraftVersion && level.version) ws.minecraftVersion = level.version;
      worlds.push({
        key,
        folder: d.name,
        home: d.home,
        // Copie d'essai : le nom de son dossier (« … (copie) »), le jeu garde le nom d'origine.
        // Copie gardée à un changement de version (27/10) : « Nom (1.21.4) », le nom de son dossier.
        name: ws.modCopyOf || ws.versionCopy ? d.name : level.name || d.name,
        minecraftVersion: level.version || ws.minecraftVersion || null,
        lastPlayed: level.lastPlayed || levelStat.mtimeMs,
        hardcore: !!level.hardcore,
        gameType: level.gameType,
        backup: ws.backup !== false,
        backups: backups.length,
        lastBackupAt: backups[0]?.createdAt || null,
        // Taille réelle des .zip (ce qui part dans le cloud), et ce qui n'y est pas encore.
        backupBytes: backups.reduce((a, b) => a + (Number(b.sizeBytes) || 0), 0),
        notInCloud: toSend.length,
        notInCloudBytes: toSend.reduce((a, b) => a + (Number(b.sizeBytes) || 0), 0),
        lastVersionId: lastVersion ? lastVersion.id : null,
        lastVersionLabel: lastVersion ? { minecraftVersion: lastVersion.minecraftVersion, pack: lastVersion.pack?.name || null, name: lastVersion.name } : null,
        sizeBytes: ws.sizeBytes,
        // Monde modé (détecté à l'import, ou dans level.dat pour un monde jamais ouvert avec un
        // pack officiel) : le mode Jouer ne charge pas ses mods, le launcher prévient avant.
        modded: ws.modded || (!lastVersion?.pack && level.mods) || null,
        modCopyOf: ws.modCopyOf || null,
        versionCopy: !!ws.versionCopy,
        // Changement de version (27/10) : installation mise à jour, monde converti à sa prochaine
        // ouverture ; ou monde converti récemment (étiquette 3 jours).
        pendingTo: ws.pendingTo || null,
        upgraded: ws.upgraded && Date.now() - Date.parse(ws.upgraded.at || 0) < 3 * 86400_000 ? { from: ws.upgraded.from, to: ws.upgraded.to } : null,
        icon: await iconDataUrl(dir),
        cloud: ws.cloud || null,
      });
    }
    if (changed) await saveState();
    worlds.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return worlds;
  }
  // Mondes supprimés dans le jeu (26/10) : le dossier n'est plus dans saves/, mais ses sauvegardes
  // sont encore sur le PC. Avant, ils disparaissaient du launcher et les sauvegardes restaient
  // cachées ; maintenant « Supprimés dans Minecraft » (Restaurer ou Suppression définitive).
  async function listGone() {
    const here = new Set((await listWorlds()).map((w) => w.key));
    let dirs = [];
    try {
      dirs = (await fsp.readdir(BACKUPS, { withFileTypes: true })).filter((d) => d.isDirectory() && validWorldKey(d.name) && !here.has(d.name));
    } catch {
      return [];
    }
    const s = loadState();
    const gone = [];
    for (const d of dirs) {
      const list = await readBackups(d.name);
      if (!list.length) continue;
      const ws = s.worlds[d.name] || {};
      gone.push({
        key: d.name,
        name: ws.name || ws.folder || "Monde",
        minecraftVersion: ws.minecraftVersion || null,
        backups: list.length,
        backupBytes: list.reduce((a, b) => a + (Number(b.sizeBytes) || 0), 0),
        lastBackupAt: list[0]?.createdAt || null,
      });
    }
    gone.sort((a, b) => Date.parse(b.lastBackupAt || 0) - Date.parse(a.lastBackupAt || 0));
    return gone;
  }

  // Copie d'essai d'un monde modé (26/10) : « Ouvrir une copie quand même ». Le monde et sa
  // Version d'origine ne passent jamais dans le jeu sans leurs mods.
  async function copyWorld(key, { name = "" } = {}) {
    const found = await worldDir(key);
    if (!found) throw new Error("Monde introuvable.");
    const saves = path.dirname(found.dir);
    const target = path.join(saves, await uniqueFolder(String(name || "").trim() || `${found.world.name} (copie)`, saves));
    await fsp.cp(found.dir, target, { recursive: true, errorOnExist: true, force: false, filter: (p) => path.basename(p) !== "session.lock" });
    const newKey = crypto.randomUUID();
    await writeWorldKey(target, newKey);
    const src = worldState(key);
    const ws = worldState(newKey);
    ws.backup = true;
    ws.minecraftVersion = src.minecraftVersion || found.world.minecraftVersion || null;
    ws.lastVersionId = src.lastVersionId || null;
    ws.modded = found.world.modded || src.modded || null;
    ws.modCopyOf = key;
    ws.name = path.basename(target);
    await saveState();
    listWorldsDirty();
    return { ok: true, key: newKey, folder: path.basename(target), name: path.basename(target) };
  }

  // Suppression définitive (26/10) : le monde sur ce PC s'il y est, TOUTES ses sauvegardes (la
  // Version d'origine comprise) et son état. Le cloud est retiré par main.js.
  async function deleteWorldForever(key) {
    assertKey(key);
    const found = await worldDir(key);
    if (found) await fsp.rm(found.dir, { recursive: true, force: true });
    await fsp.rm(path.join(BACKUPS, key), { recursive: true, force: true });
    delete loadState().worlds[key];
    await saveState();
    return { ok: true, name: found?.world.name || null };
  }
  // Monde ouvert dans le jeu en ce moment : Minecraft réécrit session.lock à l'ouverture d'un monde.
  // On prend le plus récent, ouvert depuis `sinceMs` (début de la partie ou dernière entrée dans
  // un monde lue dans le journal du jeu).
  async function openWorld(sinceMs) {
    const dirs = await saveDirs();
    let best = null;
    for (const d of dirs) {
      const dir = d.dir;
      const stat = await fsp.stat(path.join(dir, "session.lock")).catch(() => null);
      if (!stat || stat.mtimeMs < sinceMs - 5_000) continue;
      if (!best || stat.mtimeMs > best.mtimeMs) best = { dir, folder: d.name, mtimeMs: stat.mtimeMs };
    }
    if (!best) return null;
    const key = await readWorldKey(best.dir);
    if (!key) return null;
    const level = (await readLevelDat(path.join(best.dir, "level.dat")).catch(() => null)) || {};
    const ws = worldState(key);
    return { key, folder: best.folder, dir: best.dir, name: level.name || best.folder, backup: ws.backup !== false };
  }
  // Infos d'un monde (même forme que openWorld), pour la sauvegarde en jeu.
  async function worldInfo(key) {
    const found = await worldDir(key);
    if (!found) return null;
    return { key, folder: found.world.folder, dir: found.dir, name: found.world.name, backup: worldState(key).backup !== false };
  }
  async function worldDir(key) {
    const worlds = await listWorlds();
    const w = worlds.find((x) => x.key === key);
    return w ? { world: w, dir: path.join(savesOf(w.home), w.folder) } : null;
  }

  // --- Sauvegardes locales --------------------------------------------------------
  async function sha256File(file) {
    const hash = crypto.createHash("sha256");
    await pipeline(fs.createReadStream(file), hash);
    return hash.digest("hex");
  }

  // Copie figée d'un monde ouvert dans le jeu : on copie tout, puis on recopie les fichiers que le
  // jeu a modifiés pendant la copie, jusqu'à ce qu'un passage ne trouve plus rien de changé.
  // Le jeu a enregistré juste avant (pause, voir liveSave.js) : en pratique un ou deux passages.
  async function snapshotWorld(dir, snapDir, onBytes) {
    const copied = new Map();
    for (let pass = 0; pass < 8; pass++) {
      // Le jeu écrit par rafales (enregistrement auto) : on lui laisse un peu plus de temps à chaque passage.
      if (pass > 1) await new Promise((r) => setTimeout(r, 250 * pass));
      const { files } = await walkFiles(dir, { skip: skipWorldFile });
      const todo = files.filter((f) => {
        const c = copied.get(f.rel);
        return !c || c.size !== f.size || c.mtimeMs !== f.mtimeMs;
      });
      if (!todo.length && pass > 0) return { stable: true };
      for (const f of todo) {
        const to = path.join(snapDir, ...f.rel.split("/"));
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.copyFile(f.abs, to);
        const after = await fsp.stat(f.abs).catch(() => null);
        // Modifié pendant la copie : on le marque pour le passage suivant.
        copied.set(f.rel, after && after.size === f.size && after.mtimeMs === f.mtimeMs ? f : { ...f, size: -1 });
        onBytes?.(f.size);
      }
      if (!todo.length) return { stable: true };
    }
    return { stable: false };
  }

  // Contrôle d'une copie figée avant de la zipper : level.dat lisible, et chaque fichier de
  // régions (.mca) cohérent (sa table des chunks ne pointe pas au-delà de la fin du fichier, ce qui
  // arrive si le jeu écrivait ce fichier pendant la copie). Renvoie la liste des fichiers douteux.
  async function checkSnapshot(dir) {
    const bad = [];
    if (!(await readLevelDat(path.join(dir, "level.dat")))) bad.push("level.dat");
    const { files } = await walkFiles(dir);
    for (const f of files) {
      if (!f.rel.endsWith(".mca") || f.size === 0) continue;
      if (f.size < 8192) {
        bad.push(f.rel);
        continue;
      }
      const head = Buffer.alloc(4096);
      const fh = await fsp.open(f.abs, "r");
      try {
        await fh.read(head, 0, 4096, 0);
      } finally {
        await fh.close();
      }
      for (let i = 0; i < 1024; i++) {
        const entry = head.readUInt32BE(i * 4);
        if (!entry) continue;
        const offset = (entry >>> 8) * 4096;
        const sectors = entry & 0xff;
        if (offset < 8192 || offset + sectors * 4096 > f.size + 4096) {
          bad.push(f.rel);
          break;
        }
      }
    }
    return bad;
  }

  async function backupWorld(key, { reason = "auto", label = null, force = false, live = false, onProgress, protectId = null, fields = null } = {}) {
    const found = await worldDir(key);
    if (!found) throw new Error("Monde introuvable.");
    const { world } = found;
    let dir = found.dir;
    const list = await readBackups(key);
    let walked = await walkFiles(dir, { skip: skipWorldFile });
    // Rien n'a changé depuis la dernière sauvegarde : pas de doublon.
    if (!force && list[0] && walked.newest <= Date.parse(list[0].createdAt)) return { ok: true, skipped: true };
    const createdAt = new Date();
    const id = `${createdAt.toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
    // Progression (petit menu en jeu) : copie figée puis compression, chacune la moitié.
    const total = Math.max(1, walked.bytes) * (live ? 2 : 1);
    let done = 0;
    const onBytes = onProgress ? (n) => onProgress(Math.min(99, Math.round(((done += n) / total) * 100))) : undefined;
    let snapDir = null;
    if (live) {
      snapDir = path.join(BACKUPS, key, `.snap-${id}`);
      try {
        const snap = await snapshotWorld(dir, snapDir, onBytes);
        if (!snap.stable) throw Object.assign(new Error("Le jeu écrit sans arrêt dans le monde, réessaie dans un instant."), { code: "unsafe" });
        // Jamais une sauvegarde douteuse : si un fichier ne passe pas le contrôle, pas de sauvegarde.
        const bad = await checkSnapshot(snapDir);
        if (bad.length) throw Object.assign(new Error(`Copie pas fiable (${bad.slice(0, 3).join(", ")}), réessaie dans un instant.`), { code: "unsafe" });
      } catch (error) {
        await fsp.rm(snapDir, { recursive: true, force: true });
        throw error;
      }
      dir = snapDir;
      walked = await walkFiles(dir);
    }
    const { files, bytes } = walked;
    const zipFile = path.join(BACKUPS, key, `${id}.zip`);
    // Avec le monde, dans omniscient-meta/ : sa version et son pack (meta.json) et les options du
    // jeu (options.txt), pour tout retrouver sur un autre PC. Sorti du monde à la restauration.
    const metaFile = path.join(BACKUPS, key, `.${id}.meta.json`);
    const ws = worldState(key);
    const lastVersion = ws.lastVersionId ? getVersion(ws.lastVersionId) : null;
    await fsp.mkdir(path.dirname(metaFile), { recursive: true });
    await fsp.writeFile(metaFile, JSON.stringify({
      format: 1,
      worldKey: key,
      name: world.name,
      minecraftVersion: world.minecraftVersion,
      pack: lastVersion?.pack ? { packId: lastVersion.pack.packId, slug: lastVersion.pack.slug, name: lastVersion.pack.name } : null,
      createdAt: createdAt.toISOString(),
    }));
    const extra = [{ abs: metaFile, rel: `${META_DIR}/meta.json`, mtimeMs: createdAt.getTime() }];
    const optionsFile = path.join(gameDirOf(world.home), "options.txt");
    if (fs.existsSync(optionsFile)) extra.push({ abs: optionsFile, rel: `${META_DIR}/options.txt`, mtimeMs: createdAt.getTime() });
    for (const f of autoDatapackFiles(world.home || ws.lastVersionId)) extra.push({ ...f, mtimeMs: createdAt.getTime() });
    try {
      await writeZip(zipFile, [...files, ...extra], { onBytes });
    } finally {
      await fsp.rm(metaFile, { force: true });
      if (snapDir) await fsp.rm(snapDir, { recursive: true, force: true });
    }
    const stat = await fsp.stat(zipFile);
    const entry = {
      id,
      file: `${id}.zip`,
      createdAt: createdAt.toISOString(),
      sizeBytes: stat.size,
      worldBytes: bytes,
      sha256: await sha256File(zipFile),
      reason,
      label: label ? String(label).slice(0, 80) : null,
      minecraftVersion: world.minecraftVersion,
      name: world.name,
      cloud: null,
      ...(fields || {}),
    };
    list.unshift(entry);
    await pruneBackups(key, list, protectId);
    return { ok: true, backup: entry };
  }
  // Réglages des sauvegardes : les mêmes pour TOUS les mondes (demande de Rushi, 25/10). L'ancien
  // réglage par monde (worlds[key].keep) n'est plus lu.
  function keepConfig() {
    return cleanKeep({ ...DEFAULT_KEEP, ...(loadState().keep || {}) });
  }
  // Versions miroir (25/10) : les sauvegardes retirées par la limite du monde sont signalées au
  // cloud (worldCloud.dropPruned), qui les retire aussi en ligne, sauf les sauvegardes nommées.
  let pruneListener = null;
  async function pruneBackups(key, list, protectId = null) {
    const { keep, drop } = planBackups(list, keepConfig(key), protectId);
    for (const b of drop) await fsp.rm(path.join(BACKUPS, key, path.basename(b.file)), { force: true });
    await writeBackups(key, keep);
    if (drop.length) {
      try {
        pruneListener?.(key, drop);
      } catch {
        /* le cloud réessaiera à la prochaine synchro */
      }
    }
    return drop;
  }
  // Monde téléchargé d'un autre PC : chaque version du cloud redevient une sauvegarde de ce PC
  // (même liste que sur le site). Pas de ménage ici : rien n'est retiré pendant un téléchargement.
  async function addBackupFromZip(key, zipFile, v) {
    const list = await readBackups(key);
    if (list.some((b) => (v.backupId && b.id === v.backupId) || b.cloud?.versionId === v.versionId)) {
      await fsp.rm(zipFile, { force: true });
      return null;
    }
    const at = Number.isNaN(Date.parse(v.createdAt)) ? new Date() : new Date(v.createdAt);
    const id = v.backupId && /^[\w-]{6,80}$/.test(v.backupId) ? v.backupId : `${at.toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
    const dest = path.join(BACKUPS, key, `${id}.zip`);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fsp.rename(zipFile, dest);
    } catch {
      await fsp.copyFile(zipFile, dest);
      await fsp.rm(zipFile, { force: true });
    }
    const entry = {
      id,
      file: `${id}.zip`,
      createdAt: at.toISOString(),
      sizeBytes: Number(v.sizeBytes) || (await fsp.stat(dest)).size,
      worldBytes: null,
      sha256: v.sha256,
      reason: v.reason || "auto",
      label: v.label || null,
      minecraftVersion: v.minecraftVersion || null,
      name: v.name || null,
      cloud: { versionId: v.versionId, worldId: v.worldId || null, at: new Date().toISOString() },
    };
    list.push(entry);
    list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    await writeBackups(key, list);
    return entry;
  }
  // Nouveau réglage (tous les mondes) : enregistré, puis appliqué tout de suite à chaque monde (le
  // joueur a confirmé dans le launcher la liste exacte de ce qui part).
  async function setKeepConfig(cfg) {
    loadState().keep = cleanKeep(cfg);
    await saveState();
    let deleted = 0;
    let freedBytes = 0;
    for (const w of await listWorlds()) {
      const drop = await pruneBackups(w.key, await readBackups(w.key));
      deleted += drop.length;
      freedBytes += drop.reduce((a, b) => a + (Number(b.sizeBytes) || 0), 0);
    }
    return { ok: true, keep: keepConfig(), deleted, freedBytes };
  }
  async function listBackups(key) {
    return readBackups(key);
  }
  function backupFile(key, backup) {
    return path.join(BACKUPS, key, path.basename(backup.file));
  }
  async function markBackupCloud(key, backupId, cloud) {
    const list = await readBackups(key);
    const b = list.find((x) => x.id === backupId);
    if (!b) return;
    b.cloud = cloud;
    await writeBackups(key, list);
  }
  // Même règle que worldCloud.sendAllowed : « Partiel » (ancien nom « Une par partie ») = fin de partie, sortie du monde,
  // à la main, import, et celles avec un nom.
  const CLOUD_GAME_REASONS = new Set(["auto", "world-exit", "named", "manual", "import", "upgrade"]);
  function wantedInCloud(b) {
    // ✕ « Retirer du cloud » : reste sur le PC. L'ancienne marque `true` venait surtout de la limite
    // « Versions en ligne » de Partiel : elle ne bloque plus (avec « Toutes », tout repart).
    if (b.cloudDropped === "user") return false;
    if (b.cloudKeep) return true; // « ☁ Envoyer » : demandée par le joueur
    return !!b.label || keepConfig().send !== "game" || CLOUD_GAME_REASONS.has(b.reason);
  }
  // Les sauvegardes qui doivent être en ligne (une seule règle pour le launcher et le cloud) :
  // les N plus récentes parmi celles qui montent toutes seules (réglage « Versions en ligne »,
  // plafonné par l'offre), plus les ★ et celles envoyées à la main. Renvoie un Set d'ids.
  let offerOnlineCap = 0; // nombre max de l'offre (site), 0 = pas de plafond connu
  function setOnlineCap(n) {
    offerOnlineCap = Number(n) > 0 ? Math.round(Number(n)) : 0;
  }
  // Seulement avec « Partiel » (retour de Rushi du 25/10) : avec « Toutes » ou « À la main », pas de
  // limite par monde (restent la limite du PC, le quota de l'offre et la conservation en jours).
  function onlineLimit() {
    if (keepConfig().send !== "game") return Infinity;
    const n = keepConfig().online;
    return offerOnlineCap ? Math.min(n, offerOnlineCap) : n;
  }
  function cloudPlan(list) {
    const ids = new Set();
    let auto = 0;
    const limit = onlineLimit();
    for (const b of list) {
      if (!wantedInCloud(b)) continue;
      if (b.label || b.cloudKeep) ids.add(b.id);
      else if (auto < limit) {
        auto++;
        ids.add(b.id);
      }
    }
    return ids;
  }
  // Change quelques champs d'une sauvegarde (null = retiré). Renvoie la sauvegarde, ou null.
  async function patchBackup(key, backupId, patch) {
    const list = await readBackups(key);
    const b = list.find((x) => x.id === backupId);
    if (!b) return null;
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) delete b[k];
      else b[k] = v;
    }
    await writeBackups(key, list);
    return b;
  }
  // Monde retiré du cloud : plus aucune de ses sauvegardes n'est en ligne.
  async function clearBackupCloud(key) {
    const list = await readBackups(key);
    if (!list.some((b) => b.cloud)) return;
    for (const b of list) delete b.cloud;
    await writeBackups(key, list);
  }

  // Sauvegarde coupée : plus de nouvelles sauvegardes. Les anciennes restent, sauf si le joueur
  // a coché « Supprimer aussi les sauvegardes déjà faites ».
  async function setWorldBackup(key, on, { deleteExisting = false } = {}) {
    assertKey(key);
    worldState(key).backup = !!on;
    await saveState();
    if (!on && deleteExisting) {
      // La Version d'origine reste (seule la Suppression définitive l'efface).
      const list = await readBackups(key);
      const origin = list.filter((b) => b.reason === "import");
      for (const b of list) if (b.reason !== "import") await fsp.rm(path.join(BACKUPS, key, path.basename(b.file)), { force: true });
      if (origin.length) await writeBackups(key, origin);
      else await fsp.rm(path.join(BACKUPS, key), { recursive: true, force: true });
    }
    return { ok: true };
  }

  // Remplace le monde par une sauvegarde. Une sauvegarde « avant restauration » est faite
  // d'abord : la version actuelle n'est jamais perdue.
  async function restoreFromZip(key, zipFile, { protectId = null } = {}) {
    const found = await worldDir(key);
    if (!found) throw new Error("Monde introuvable.");
    const { dir, world } = found;
    await backupWorld(key, { reason: "before-restore", force: true, protectId });
    const tmp = path.join(path.dirname(dir), `.omni-restore-${crypto.randomBytes(4).toString("hex")}`);
    const old = path.join(path.dirname(dir), `.omni-old-${crypto.randomBytes(4).toString("hex")}`);
    let meta = null;
    try {
      await extractZip(zipFile, tmp);
      await restoreAutoDatapacks(tmp, world.home || worldState(key).lastVersionId).catch(() => {});
      meta = await takeMeta(tmp);
      await writeWorldKey(tmp, key);
      await fsp.rename(dir, old);
      await fsp.rename(tmp, dir);
    } catch (error) {
      await fsp.rm(tmp, { recursive: true, force: true });
      if (!fs.existsSync(dir) && fs.existsSync(old)) await fsp.rename(old, dir);
      throw error;
    }
    await fsp.rm(old, { recursive: true, force: true });
    worldState(key).sizeMtime = null;
    await saveState();
    return { ok: true, name: world.name, meta: meta?.meta || null };
  }

  // Sort omniscient-meta/ d'un monde extrait : { meta (meta.json), options (texte d'options.txt) }.
  async function takeMeta(dir) {
    const metaDir = path.join(dir, META_DIR);
    if (!fs.existsSync(metaDir)) return null;
    let meta = null;
    let options = null;
    try {
      meta = JSON.parse(await fsp.readFile(path.join(metaDir, "meta.json"), "utf8"));
    } catch {
      /* ancien zip ou meta illisible */
    }
    try {
      options = await fsp.readFile(path.join(metaDir, "options.txt"), "utf8");
    } catch {
      /* pas d'options dans ce zip */
    }
    await fsp.rm(metaDir, { recursive: true, force: true });
    return { meta, options };
  }

  // Monde téléchargé depuis le cloud sur un PC qui ne l'a pas : nouveau dossier, même clé que
  // l'original (c'est le même monde). Les options du jeu ne sont reprises que si ce PC n'en a pas
  // encore (on n'écrase jamais les réglages d'un joueur).
  async function importFromZip(zipFile, { key, name }) {
    if (!/^[\w-]{8,64}$/.test(key || "")) throw new Error("Clé de monde invalide.");
    if ((await listWorlds()).some((w) => w.key === key)) throw new Error("Ce monde est déjà sur ce PC.");
    await fsp.mkdir(SAVES, { recursive: true });
    const tmp = path.join(SAVES, `.omni-restore-${crypto.randomBytes(4).toString("hex")}`);
    let taken = null;
    let target;
    try {
      await extractZip(zipFile, tmp);
      if (!fs.existsSync(path.join(tmp, "level.dat"))) throw new Error("Ce fichier ne contient pas de monde Minecraft.");
      taken = await takeMeta(tmp);
      await writeWorldKey(tmp, key);
      target = path.join(SAVES, await uniqueFolder(name || taken?.meta?.name || "Monde", SAVES));
      await fsp.rename(tmp, target);
    } catch (error) {
      await fsp.rm(tmp, { recursive: true, force: true });
      throw error;
    }
    const optionsFile = path.join(GAME_DIR, "options.txt");
    if (taken?.options && !fs.existsSync(optionsFile)) {
      await fsp.mkdir(GAME_DIR, { recursive: true });
      await fsp.writeFile(optionsFile, taken.options);
    }
    const ws = worldState(key);
    ws.backup = true;
    ws.minecraftVersion = taken?.meta?.minecraftVersion || null;
    await saveState();
    listWorldsDirty();
    return { key, folder: path.basename(target), name: name || taken?.meta?.name || path.basename(target), meta: taken?.meta || null };
  }

  // Après un téléchargement : la version à utiliser pour ce monde (choisie par main.js d'après le pack).
  async function setWorldVersion(key, versionId) {
    if (!getVersion(versionId)) return;
    worldState(key).lastVersionId = versionId;
    await saveState();
  }
  // Supprimer une sauvegarde à la main (liste des sauvegardes d'un monde, 25/10). Renvoie
  // l'entrée supprimée (pour la retirer aussi du cloud).
  async function deleteBackup(key, backupId) {
    const list = await readBackups(key);
    const b = list.find((x) => x.id === backupId);
    if (!b) throw new Error("Sauvegarde introuvable.");
    if (b.reason === "import") throw new Error("La Version d'origine ne se supprime qu'avec « Suppression définitive ».");
    await fsp.rm(path.join(BACKUPS, key, path.basename(b.file)), { force: true });
    await writeBackups(key, list.filter((x) => x !== b));
    return b;
  }
  async function restoreBackup(key, backupId) {
    const b = (await readBackups(key)).find((x) => x.id === backupId);
    if (!b) throw new Error("Sauvegarde introuvable.");
    const out = (await worldDir(key)) ? await restoreFromZip(key, backupFile(key, b), { protectId: b.id }) : await restoreGone(key, backupFile(key, b));
    // Retour à une version plus ancienne (27/10) : le monde s'ouvrira avec la version de la
    // sauvegarde, plus avec l'installation mise à jour.
    const ws = worldState(key);
    if (b.minecraftVersion && ws.minecraftVersion !== b.minecraftVersion) {
      ws.minecraftVersion = b.minecraftVersion;
      delete ws.pendingTo;
      delete ws.upgraded;
      const same = loadState().versions.find((v) => v.minecraftVersion === b.minecraftVersion && (!v.pack || v.pack.kind === getVersion(ws.lastVersionId)?.pack?.kind));
      if (same) ws.lastVersionId = same.id;
      await saveState();
      listWorldsDirty();
    }
    return out;
  }
  async function restoreGone(key, zipFile) {
    const ws = worldState(key);
    const SAVES = savesOf(ws.home && getVersion(ws.home) ? ws.home : null);
    await fsp.mkdir(SAVES, { recursive: true });
    const tmp = path.join(SAVES, `.omni-restore-${crypto.randomBytes(4).toString("hex")}`);
    let target;
    try {
      await extractZip(zipFile, tmp);
      if (!fs.existsSync(path.join(tmp, "level.dat"))) throw new Error("Cette sauvegarde ne contient pas de monde Minecraft.");
      await takeMeta(tmp);
      await writeWorldKey(tmp, key);
      target = path.join(SAVES, await uniqueFolder(ws.name || ws.folder || "Monde", SAVES));
      await fsp.rename(tmp, target);
    } catch (error) {
      await fsp.rm(tmp, { recursive: true, force: true });
      throw error;
    }
    ws.sizeMtime = null;
    await saveState();
    listWorldsDirty();
    return { ok: true, name: ws.name || path.basename(target), meta: null };
  }

  // Après une partie : les mondes modifiés retiennent la version jouée, puis sont sauvegardés
  // (le jeu est fermé, plus rien n'écrit dedans). Renvoie les sauvegardes créées (pour le cloud).
  async function afterGame(versionId, startedAt) {
    const worlds = await listWorlds();
    const created = [];
    const upgradedNow = [];
    for (const w of worlds) {
      if (!w.lastPlayed || w.lastPlayed < startedAt - 5_000) continue;
      const ws = worldState(w.key);
      // Seulement un monde vraiment ouvert avec cette version (le jeu réécrit sa version dans
      // level.dat) : un monde juste copié ou importé pendant la partie garde la sienne.
      const played = versionId ? getVersion(versionId) : null;
      if (played && (!w.minecraftVersion || w.minecraftVersion === played.minecraftVersion)) ws.lastVersionId = versionId;
      // Minecraft a converti le monde vers une version plus récente pendant la partie (27/10).
      if (w.minecraftVersion && ws.minecraftVersion && cmpMc(w.minecraftVersion, ws.minecraftVersion) > 0) {
        ws.upgraded = { from: ws.minecraftVersion, to: w.minecraftVersion, at: new Date().toISOString() };
        upgradedNow.push({ key: w.key, from: ws.minecraftVersion, to: w.minecraftVersion });
        // Avant la sauvegarde de fin de partie (et son ménage) : celle d'avant la partie devient 🛡.
        await keepGuard(w.key, w.minecraftVersion).catch(() => {});
      }
      const guardId = ws.guard?.backupId || null;
      delete ws.guard;
      if (ws.pendingTo && w.minecraftVersion && cmpMc(w.minecraftVersion, ws.pendingTo) >= 0) delete ws.pendingTo;
      if (w.minecraftVersion) ws.minecraftVersion = w.minecraftVersion;
      if (ws.backup === false) continue;
      try {
        const r = await backupWorld(w.key, { reason: "auto", protectId: guardId });
        if (r.backup) created.push({ key: w.key, backup: r.backup });
      } catch (error) {
        created.push({ key: w.key, error: error instanceof Error ? error.message : String(error) });
      }
    }
    // Bouclier : les mondes pas ouverts pendant la partie n'ont plus besoin de leur marque.
    for (const ws of Object.values(loadState().worlds)) if (ws.guard) delete ws.guard;
    await saveState();
    // Mes touches : les touches changées pendant la partie vont dans le fichier commun.
    await keysAfterGame(versionId).catch(() => {});
    created.upgraded = upgradedNow;
    return created;
  }

  // --- Changement de version (27/10, preview validée par Rushi, Laboratoire « versionGuard ») ------
  // Un monde ouvert dans une version plus récente est converti par Minecraft et ne s'ouvre plus dans
  // l'ancienne. Avant toute mise à jour d'une installation : une sauvegarde 🛡 « Avant X » de chacun
  // de ses mondes, relue en entier pour la vérifier, jamais effacée automatiquement.
  // Sauvegarde relue : empreinte recalculée identique, et level.dat présent dans l'archive.
  async function verifyBackup(key, b) {
    const file = backupFile(key, b);
    if ((await sha256File(file)) !== b.sha256) throw new Error(`La sauvegarde de « ${b.name || key} » ne se relit pas correctement.`);
    const entries = await listZip(file);
    if (!entries.some((e) => e.name === "level.dat")) throw new Error(`La sauvegarde de « ${b.name || key} » n'a pas de level.dat.`);
  }
  // Mondes d'une installation : ceux qui s'ouvrent avec elle.
  async function worldsOfVersion(id) {
    return (await listWorlds()).filter((w) => w.home === id || (!w.home && w.lastVersionId === id));
  }
  const upLabel = (mc) => `Avant ${mc}`;
  async function guardBackup(key, mc, onProgress) {
    const r = await backupWorld(key, { reason: "upgrade", label: upLabel(mc), force: true, onProgress, fields: { upgradeTo: mc } });
    await verifyBackup(key, r.backup);
    return r.backup;
  }
  // Bouclier avant de lancer une version sans monde : sauvegarde des mondes plus anciens que le jeu
  // peut ouvrir depuis son propre menu (même dossier de jeu). Une sauvegarde déjà à jour suffit.
  async function guardBeforeLaunch(versionId, gameDir, { onWorld } = {}) {
    const v = getVersion(versionId);
    if (!v) return [];
    const saves = path.resolve(gameDir, "saves");
    const older = (await listWorlds()).filter((w) => path.resolve(savesOf(w.home)) === saves && w.minecraftVersion && VERSION_ID_PATTERN.test(w.minecraftVersion) && cmpMc(v.minecraftVersion, w.minecraftVersion) > 0);
    const out = [];
    for (let i = 0; i < older.length; i++) {
      const w = older[i];
      onWorld?.(w, i, older.length);
      try {
        const r = await backupWorld(w.key, { reason: "guard" });
        const list = await readBackups(w.key);
        const b = r.backup || list[0];
        if (b) {
          worldState(w.key).guard = { backupId: b.id, mc: w.minecraftVersion, at: new Date().toISOString() };
          out.push({ key: w.key, backup: r.backup || null });
        }
      } catch (error) {
        out.push({ key: w.key, error: error instanceof Error ? error.message : String(error) });
      }
    }
    await saveState();
    return out;
  }
  async function keepGuard(key, to) {
    const ws = worldState(key);
    const g = ws.guard;
    delete ws.guard;
    if (!g) return;
    const list = await readBackups(key);
    const b = list.find((x) => x.id === g.backupId);
    if (!b) return;
    // Sauvegarde sans nom : elle devient « Avant X ». Avec un nom (★) : on garde son nom, protégée.
    if (!b.label) Object.assign(b, { reason: "upgrade", label: upLabel(to), upgradeTo: to });
    else Object.assign(b, { guardKeep: true, upgradeTo: to });
    await writeBackups(key, list);
    await saveState();
  }
  // Pour un Mon pack : quels mods existent pour `mc` (même calcul que « Générer » du Pack Omniscient).
  let modsForFn = null;
  function setModsFor(fn) {
    modsForFn = fn;
  }
  const canUpdate = (v) => !!v && (!v.pack || v.pack.kind === "mine");
  async function updateCheck(id, mc) {
    const v = getVersion(id);
    if (!canUpdate(v)) throw new Error("Cette installation ne se met pas à jour ici.");
    if (!VERSION_ID_PATTERN.test(mc || "") || cmpMc(mc, v.minecraftVersion) <= 0) throw new Error("Choisis une version plus récente.");
    const worlds = await worldsOfVersion(id);
    const out = { worlds: worlds.map((w) => ({ key: w.key, name: w.name, sizeBytes: w.sizeBytes || 0, minecraftVersion: w.minecraftVersion })), mods: null };
    if (v.pack) {
      const loaderVersion = await packs.latestLoaderVersion(v.pack.loader, mc).catch(() => null);
      if (!loaderVersion) return { ...out, mods: { noLoader: true, loader: v.pack.loader, total: (v.mods || []).length, missing: [] } };
      const { list, missing } = await modsForFn(v, mc);
      // Mods ajoutés à la main (CurseForge, .jar) : pas de version connue pour `mc`.
      const manual = (v.mods || []).filter((m) => !(m.source === "mr" && m.projectId) && m.on !== false && !m.auto);
      out.mods = { total: (v.mods || []).filter((m) => !m.auto).length, missing: [...missing, ...manual].map((m) => m.name || m.id), loaderVersion, count: list.length };
    }
    return out;
  }
  /**
   * Mettre à jour une installation (vanilla ou Mon pack) vers `mc`. Ordre (preview validée) :
   * sauvegardes 🛡 de chaque monde, vérification, copie facultative (installation d'avant + copie de
   * ses mondes), puis passage de l'installation. Les mondes sont convertis par Minecraft à leur
   * prochaine ouverture (pendingTo). `onStep({ step, key?, pct? })`.
   */
  async function updateVersion(id, { minecraftVersion: mc, keepCopy = false, modsOff = false }, { onStep = () => {}, freeBytes = null } = {}) {
    const v = getVersion(id);
    if (!canUpdate(v)) throw new Error("Cette installation ne se met pas à jour ici.");
    if (!VERSION_ID_PATTERN.test(mc || "") || cmpMc(mc, v.minecraftVersion) <= 0) throw new Error("Choisis une version plus récente.");
    const from = v.minecraftVersion;
    const worlds = await worldsOfVersion(id);
    const need = worlds.reduce((a, w) => a + (w.sizeBytes || 0), 0) * (keepCopy ? 2 : 1);
    if (freeBytes != null && freeBytes < need * 1.1) throw Object.assign(new Error(`Pas assez de place sur le disque : il faut environ ${Math.ceil((need * 1.1) / 1e9)} Go de libre.`), { code: "space" });
    // Mon pack : la liste des mods pour `mc` est calculée AVANT de toucher à quoi que ce soit.
    let plan = null;
    if (v.pack) {
      const check = await updateCheck(id, mc);
      if (check.mods?.noLoader) throw new Error(`${v.pack.loader} n'existe pas encore pour Minecraft ${mc}.`);
      if (check.mods.missing.length && !modsOff) throw Object.assign(new Error("Certains mods n'ont pas encore de version pour cette version de Minecraft."), { code: "modsMissing", missing: check.mods.missing });
      plan = { ...(await modsForFn(v, mc)), loaderVersion: check.mods.loaderVersion, missingNames: check.mods.missing };
    }
    const backups = [];
    for (const w of worlds) {
      onStep({ step: `bk:${w.key}`, pct: 0 });
      backups.push({ key: w.key, backup: await guardBackup(w.key, mc, (pct) => onStep({ step: `bk:${w.key}`, pct })) });
    }
    if (worlds.length) onStep({ step: "verify" });
    let copyId = null;
    if (keepCopy && worlds.length) {
      onStep({ step: "copy" });
      copyId = await copyInstallation(v, worlds);
    }
    onStep({ step: "dl" });
    if (plan) {
      // Mods manuels de l'ancienne version : mis de côté (.disabled), jamais effacés.
      for (const m of v.mods || []) {
        if (m.source === "mr" && m.projectId) continue;
        const f = fileNameOf(m);
        const on = f && SAFE_JAR.test(f) ? path.join(modsDirOf(v.id), f) : null;
        if (on && fs.existsSync(on)) await fsp.rename(on, `${on}.disabled`).catch(() => {});
      }
      v.mods = plan.list.filter((m) => !m.file?.filename || SAFE_JAR.test(m.file.filename));
      v.pack.loaderVersion = plan.loaderVersion;
      v.installed = (v.installed || []).filter((p) => /^mods\/[^/]+\.jar$/.test(p));
      v.upMissing = plan.missingNames.slice(0, 100);
      if (v.omni) v.omni.tested = false;
    }
    v.minecraftVersion = mc;
    v.type = versionType(mc);
    v.updatedFrom = { from, to: mc, at: new Date().toISOString() };
    for (const w of worlds) {
      const ws = worldState(w.key);
      ws.pendingTo = mc;
      ws.lastVersionId = id;
    }
    await saveState();
    listWorldsDirty();
    return { ok: true, from, to: mc, backups, copyId, missing: plan?.missingNames || [] };
  }
  // Copie de l'installation d'avant (même version, mêmes mods) et de ses mondes (nouvelles clés).
  async function copyInstallation(v, worlds) {
    const s = loadState();
    const copy = JSON.parse(JSON.stringify(v));
    copy.id = crypto.randomUUID();
    copy.createdAt = new Date().toISOString();
    copy.lastPlayedAt = null;
    // Copie gardée exprès dans l'ancienne version : étiquette « Copie gardée en X » sur sa tuile, et
    // pas de bouton « Mettre à jour » (page Jouer en tuiles, 27/10).
    copy.keptCopyOf = { id: v.id, at: copy.createdAt };
    delete copy.updatedFrom;
    if (copy.omni) delete copy.omni;
    if (copy.pack && copy.pack.kind === "mine") copy.pack.name = copy.name || copy.pack.name;
    s.versions.splice(s.versions.indexOf(v) + 1, 0, copy);
    await saveState();
    const own = strictOn || ownDir(v);
    if (own && fs.existsSync(gameDirOf(v.id))) {
      await fsp.cp(gameDirOf(v.id), gameDirOf(copy.id), {
        recursive: true,
        errorOnExist: false,
        filter: (p) => !["saves", "logs", "crash-reports"].includes(path.relative(gameDirOf(v.id), p).split(path.sep)[0]) && path.basename(p) !== "session.lock",
      });
    }
    const saves = own ? savesOf(copy.id) : SAVES;
    await fsp.mkdir(saves, { recursive: true });
    for (const w of worlds) {
      const found = await worldDir(w.key);
      if (!found) continue;
      const name = `${found.world.name} (${v.minecraftVersion})`;
      const target = path.join(saves, await uniqueFolder(name, saves));
      await fsp.cp(found.dir, target, { recursive: true, errorOnExist: true, force: false, filter: (p) => path.basename(p) !== "session.lock" });
      const newKey = crypto.randomUUID();
      await writeWorldKey(target, newKey);
      const ws = worldState(newKey);
      ws.backup = true;
      ws.minecraftVersion = found.world.minecraftVersion;
      ws.lastVersionId = copy.id;
      ws.name = name;
      ws.versionCopy = true;
    }
    await saveState();
    listWorldsDirty();
    return copy.id;
  }

  // --- Mon pack et pack CurseForge (26/10) ------------------------------------------------------
  // Une version « Mon pack » (mods choisis sur Modrinth + liste CurseForge à la main) ou « pack
  // CurseForge » (export .zip d'un joueur) a toujours son propre dossier de jeu, avec ses mods dans
  // mods/. Chaque mod est une entrée de v.mods :
  //   { id, name, source: "mr"|"cf", projectId, version, versionId, file: { filename, url, sha1, size },
  //     auto (ajouté parce qu'un autre mod en a besoin), by: [ids], pinned, on, cf: { fileID, pageUrl, got } }
  // Un mod CurseForge sans lien (son auteur l'interdit, ou Mon pack) n'est JAMAIS téléchargé ici : le
  // joueur le télécharge, main.js le retrouve dans Téléchargements (acceptManualJar).
  const modsDirOf = (id) => path.join(gameDirOf(id), "mods");
  const ALLOWED_MOD_HOST = (url) => {
    try {
      const u = new URL(url);
      // github.com, raw.githubusercontent.com, gitlab.com : autorisés par la spécification .mrpack (27/10).
      return u.protocol === "https:" && (["cdn.modrinth.com", "github.com", "raw.githubusercontent.com", "gitlab.com"].includes(u.hostname) || u.hostname.endsWith(".forgecdn.net"));
    } catch {
      return false;
    }
  };
  const SAFE_JAR = /^[\w.+() \[\]!'&,-]+\.jar$/i;
  const fileNameOf = (m) => m.file?.filename || null;

  async function createCustomVersion({ kind, name, minecraftVersion, loader, loaderVersion, mods = [], extra = {}, omni = null }) {
    if (!VERSION_ID_PATTERN.test(minecraftVersion || "")) throw new Error("Version de Minecraft invalide.");
    if (!packs.LOADER_IDS.includes(loader)) throw new Error("Chargeur de mods inconnu.");
    if (!VERSION_ID_PATTERN.test(loaderVersion || "")) throw new Error(`Aucune version de ${loader} trouvée pour Minecraft ${minecraftVersion}.`);
    const clean = String(name || "").trim().slice(0, 60);
    const entry = {
      id: crypto.randomUUID(),
      minecraftVersion,
      type: versionType(minecraftVersion),
      name: clean,
      pack: { kind, slug: kind, name: clean || { mine: "Mon pack", cf: "CurseForge", mr: "Modrinth" }[kind], loader, loaderVersion, ...extra },
      mods: mods.filter((m) => !m.file?.filename || SAFE_JAR.test(m.file.filename)),
      files: [],
      createdAt: new Date().toISOString(),
      lastPlayedAt: null,
      ...(omni ? { omni: { group: omni.group || crypto.randomUUID(), tested: !!omni.tested, missing: (omni.missing || []).slice(0, 100), base: omni.base !== false } } : {}),
    };
    loadState().versions.unshift(entry);
    await saveState();
    await fsp.mkdir(modsDirOf(entry.id), { recursive: true });
    await seedOptions(gameDirOf(entry.id), entry);
    return { ...entry, files: undefined, mods: undefined };
  }

  // Met les mods qui ont un lien (Modrinth, ou CurseForge autorisé par son auteur) dans mods/, range
  // les mods coupés (.jar.disabled) et retire les anciennes versions installées par le launcher.
  async function syncPackFiles(v, { deps, onProgress = () => {}, signal, waitIfPaused } = {}) {
    const dir = modsDirOf(v.id);
    await fsp.mkdir(dir, { recursive: true });
    for (const m of v.mods || []) {
      const f = fileNameOf(m);
      if (!f || !SAFE_JAR.test(f)) continue;
      const on = path.join(dir, f);
      const off = `${on}.disabled`;
      if (m.on === false && fs.existsSync(on)) await fsp.rename(on, off).catch(() => {});
      if (m.on !== false && !fs.existsSync(on) && fs.existsSync(off)) await fsp.rename(off, on).catch(() => {});
    }
    const entries = [];
    for (const m of v.mods || []) {
      const f = fileNameOf(m);
      if (m.on === false || !f || !m.file?.url || !m.file.sha1) continue;
      if (!SAFE_JAR.test(f)) throw new Error(`Nom de fichier de mod refusé : ${f}`);
      if (!ALLOWED_MOD_HOST(m.file.url)) throw new Error(`Lien de mod refusé (${f}) : seuls Modrinth et les liens CurseForge autorisés sont acceptés.`);
      entries.push({ path: `mods/${f}`, url: m.file.url, sha1: m.file.sha1, sha512: m.file.sha512 || null, size: m.file.size || null });
    }
    const previousFiles = (v.installed || []).filter((p) => /^mods\/[^/]+\.jar$/.test(p));
    // Mods sans lien (CurseForge téléchargés à la main) : jamais retirés par la mise à jour.
    const keepPaths = (v.mods || []).filter((m) => !m.file?.url && fileNameOf(m) && SAFE_JAR.test(fileNameOf(m))).map((m) => `mods/${fileNameOf(m)}`);
    await deps.installFiles({ entries, instanceDir: gameDirOf(v.id), previousFiles, keepPaths, onProgress, signal, waitIfPaused });
    v.installed = (v.mods || []).map(fileNameOf).filter((f) => f && SAFE_JAR.test(f)).map((f) => `mods/${f}`);
    await saveState();
  }

  async function prepareCustom(v, { deps, onProgress, signal, waitIfPaused, javaPath, gameDir }) {
    const loaderId = `${v.pack.loader}-${v.pack.loaderVersion}`;
    onProgress({ step: "mods", modded: true });
    const loaderVersionId = await deps.installLoader({ loaderId, minecraftVersion: v.minecraftVersion, gameRoot, javaPath, onProgress });
    const { customVersion, jvmArgs } = await deps.prepareLaunchVersion({ gameRoot, loaderVersionId, minecraftVersion: v.minecraftVersion });
    await syncPackFiles(v, { deps, onProgress, signal, waitIfPaused });
    await syncAutoDatapacks(v).catch(() => {});
    // Data packs d'un pack CurseForge sans chargeur (04/11) : dans chaque monde de l'installation.
    await spreadAllWorldDatapacks(v.id).catch(() => {});
    return { minecraftVersion: v.minecraftVersion, customVersion, jvmArgs, javaPath, gameDirectory: gameDir };
  }

  // Chargeur pour lire les .jar du pack : Forge avant 1.13 = « forge-legacy » (mcmod.info seul, voir playPacks).
  const metaLoader = (v) => (v?.pack?.loader === "forge" && Number(/^1\.(\d+)(?:\.|$)/.exec(String(v.minecraftVersion || ""))?.[1]) < 13 ? "forge-legacy" : v?.pack?.loader || null);
  // Description de chaque .jar (fabric.mod.json / mods.toml), gardée tant que le fichier ne change pas.
  const metaCache = new Map();
  async function jarMetaCached(file, loader = null) {
    const st = await fsp.stat(file).catch(() => null);
    if (!st) return null;
    const k = `${file}|${st.size}|${st.mtimeMs}|${loader || ""}`;
    if (metaCache.has(k)) return metaCache.get(k);
    const meta = await packs.readJarMeta(file, { loader });
    metaCache.set(k, meta);
    if (metaCache.size > 3000) metaCache.delete(metaCache.keys().next().value);
    return meta;
  }

  // Les .jar présents (allumés et coupés), chacun relié à son entrée du pack quand il en a une.
  async function packJars(v) {
    const dir = modsDirOf(v.id);
    const byFile = new Map((v.mods || []).filter(fileNameOf).map((m) => [fileNameOf(m), m]));
    const names = (await fsp.readdir(dir).catch(() => [])).filter((n) => /\.jar(\.disabled)?$/i.test(n));
    // Lus 8 à la fois (un gros pack en a des centaines) ; l'ordre du dossier est gardé.
    const jars = new Array(names.length);
    let next = 0;
    const work = async () => {
      while (next < names.length) {
        const i = next++;
        const name = names[i];
        const on = /\.jar$/i.test(name);
        const base = on ? name : name.replace(/\.disabled$/i, "");
        const meta = await jarMetaCached(path.join(dir, name), metaLoader(v));
        const m = byFile.get(base);
        // Pack importé : le nom peut être le nom du fichier (27/10, « simplehats-neoforge-…jar ») ;
        // on montre alors celui que le mod donne lui-même.
        const ref = m && looksFile(m.name) && meta?.name ? { ...m, name: meta.name, version: looksFile(m.version) ? meta.version || "" : m.version } : m || { id: `file:${base}`, name: meta?.name || base.replace(/\.jar$/i, ""), source: "file", version: meta?.version || "", file: { filename: base }, on };
        jars[i] = { ref, on, meta, file: base };
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, names.length) }, work));
    return jars;
  }

  const looksFile = (s) => /\.jar$/i.test(String(s || "")) || /\.jar /i.test(String(s || ""));
  const brief = (m) => (m ? { id: m.id, name: m.name, version: m.version || "", source: m.source } : null);

  // Problèmes du pack, avec la solution trouvée pour chacun (Modrinth d'abord).
  async function packProblems(id, { network = true } = {}) {
    const v = getVersion(id);
    if (!v || !isCustom(v)) return [];
    const jars = await packJars(v);
    const out = [];
    const loader = v.pack.loader;
    for (const p of packs.checkJars(jars, { loader })) {
      if (p.type === "loader") out.push({ type: "loader", a: brief(p.a), loader: p.loader, pack: loader, fix: null });
      else if (p.type === "version") out.push({ type: "version", a: brief(p.a), b: brief(p.b), min: p.min, have: p.have, depId: p.depId, fix: null });
      else {
        // Le mod est dans le pack mais coupé : le rallumer suffit.
        const off = jars.find((j) => !j.on && j.meta && [...j.meta.ids, ...j.meta.provides].includes(p.depId));
        out.push({ type: "missing", a: brief(p.a), b: off ? brief(off.ref) : { id: p.depId, name: p.depId }, min: p.min, depId: p.depId, fix: off ? { action: "enable", modId: off.ref.id } : null });
      }
    }
    // Mods CurseForge pas encore téléchargés par le joueur.
    const present = new Set(jars.map((j) => j.file));
    for (const m of v.mods || []) {
      if (m.source !== "cf" || m.on === false || m.file?.url) continue;
      if (fileNameOf(m) && present.has(fileNameOf(m))) continue;
      const a = (v.mods || []).find((x) => (m.by || []).includes(x.id));
      out.push({ type: "cf", a: brief(a || m), b: brief(m), fix: { action: "cf", modId: m.id } });
    }
    // Packs de ressources allumés qui ont besoin d'un mod absent.
    const provided = new Set(jars.filter((j) => j.on && j.meta).flatMap((j) => [...j.meta.ids, ...j.meta.provides]));
    for (const rp of await listResourcePacks(v.id)) {
      if (!rp.on) continue;
      for (const need of rp.needIds) {
        if (provided.has(need)) continue;
        const n = packs.RP_NEEDS[need];
        out.push({ type: "rp", rp: { name: rp.name }, b: { id: need, name: n.name }, depId: need, slug: n.slug, fix: null });
      }
    }
    if (network) await findFixes(v, out).catch(() => {});
    v.problemCount = out.length;
    await saveState();
    return out;
  }

  // Solutions : Modrinth (nouvelle version, ou mod manquant trouvé), sinon CurseForge à la main.
  async function findFixes(v, list) {
    const mc = v.minecraftVersion;
    const loader = v.pack.loader;
    // Plusieurs recherches à la fois (27/10 : une par une, la page d'un gros pack attendait longtemps).
    const queue = [...list];
    await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
      while (queue.length) await fixOne(queue.shift());
    }));
    async function fixOne(p) {
      if (p.type === "version" && p.b) {
        const b = (v.mods || []).find((m) => m.id === p.b.id);
        if (b?.source === "mr") {
          const vers = await packs.mrVersions(b.projectId, mc, loader).catch(() => []);
          const newest = vers[0];
          if (newest && newest.id !== b.versionId) p.fix = { action: "version", modId: b.id, to: newest.v };
        } else if (b?.source === "cf") p.fix = { action: "cf", modId: b.id, update: true };
      } else if ((p.type === "missing" && !p.fix) || p.type === "rp") {
        const candidates = [p.slug, p.depId, String(p.depId).replace(/_/g, "-")].filter(Boolean);
        let found = null;
        for (const slug of [...new Set(candidates)]) {
          const vers = await packs.mrVersions(slug, mc, loader).catch(() => []);
          if (vers.length) {
            const proj = (await packs.mrProjects([vers[0].projectId]).catch(() => new Map())).get(vers[0].projectId);
            found = { action: "add", slug: proj?.slug || slug, name: proj?.title || p.b.name, version: vers[0].v, versionId: vers[0].id };
            break;
          }
        }
        if (found) {
          p.b.name = found.name;
          p.fix = found;
        } else if (p.type === "missing") p.fix = { action: "cf", search: p.depId, name: p.depId };
      }
    }
  }

  // Refait la liste Modrinth : les mods choisis (et ceux ajoutés par « Corriger ») dans leur version,
  // plus leurs mods nécessaires. Les mods CurseForge ne bougent pas.
  async function rebuildMr(v) {
    const mine = (v.mods || []).filter((m) => m.source === "mr" && (!m.auto || m.pinned));
    const wanted = mine.map((m) => ({ slug: m.projectId, version: m.versionId, on: m.on !== false }));
    const keep = (v.mods || []).filter((m) => m.source === "mr" && m.auto).map((m) => ({ projectId: m.projectId, version: m.version, versionId: m.versionId }));
    const next = await packs.resolveModrinth(wanted, { mc: v.minecraftVersion, loader: v.pack.loader, keep });
    const old = new Map((v.mods || []).filter((m) => m.source === "mr").map((m) => [m.projectId, m]));
    for (const n of next) {
      const o = old.get(n.projectId);
      if (o?.pinned) {
        n.pinned = true;
        n.auto = true;
        n.by = [...new Set([...(o.by || []), ...(n.by || [])])];
      }
      if (o && o.on === false) n.on = false;
    }
    v.mods = [...next, ...(v.mods || []).filter((m) => m.source !== "mr")];
  }

  // « Corriger » d'une fiche du catalogue de bugs (31/10) : seulement les packs du joueur, et seulement
  // vers une version plus récente. Le chargeur s'installe au prochain lancement.
  async function setLoaderVersion(id, version) {
    const v = getVersion(id);
    if (!v || !["mine", "cf", "mr"].includes(v.pack?.kind)) throw new Error("Le chargeur de ce pack ne se change pas ici.");
    if (!VERSION_ID_PATTERN.test(version || "")) throw new Error("Version du chargeur invalide.");
    if (String(v.pack.loaderVersion || "").localeCompare(version, "en", { numeric: true }) >= 0) return { ok: true, unchanged: true };
    v.pack.loaderVersion = version;
    await saveState();
    return { ok: true };
  }

  async function setPackMod(id, modId, patch, { deps } = {}) {
    const v = getVersion(id);
    if (!v || !isCustom(v)) throw new Error("Pack introuvable.");
    let m = (v.mods || []).find((x) => x.id === modId);
    if (!m && String(modId).startsWith("file:")) {
      // Mod ajouté à la main dans le dossier : seulement allumer / couper.
      const base = String(modId).slice(5);
      if (!SAFE_JAR.test(base) || typeof patch.on !== "boolean") throw new Error("Mod introuvable.");
      const on = path.join(modsDirOf(id), base);
      if (patch.on && fs.existsSync(`${on}.disabled`)) await fsp.rename(`${on}.disabled`, on);
      if (!patch.on && fs.existsSync(on)) await fsp.rename(on, `${on}.disabled`);
      return { ok: true };
    }
    if (!m) throw new Error("Mod introuvable.");
    if (typeof patch.on === "boolean") m.on = patch.on;
    if (patch.version && m.source === "mr") {
      const vers = await packs.mrVersions(m.projectId, v.minecraftVersion, v.pack.loader);
      const chosen = vers.find((x) => x.v === patch.version || x.id === patch.version);
      if (!chosen) throw new Error("Version introuvable sur Modrinth.");
      Object.assign(m, { version: chosen.v, versionId: chosen.id, file: chosen.file, deps: chosen.deps });
      await rebuildMr(v);
    }
    await saveState();
    if (deps) await syncPackFiles(v, { deps });
    return { ok: true };
  }

  // Ajoute des mods à un pack (« + Ajouter des mods », « Corriger »). `mods` : Modrinth
  // { slug, version, pinned?, by? } ou CurseForge { source: "cf", ... } (à télécharger à la main).
  async function addPackMods(id, mods, { deps } = {}) {
    const v = getVersion(id);
    if (!v || !isCustom(v)) throw new Error("Pack introuvable.");
    const mr = mods.filter((m) => m.source !== "cf");
    const cf = mods.filter((m) => m.source === "cf");
    if (mr.length) {
      const extra = await packs.resolveModrinth(mr.map((m) => ({ slug: m.slug, version: m.versionId || m.version })), { mc: v.minecraftVersion, loader: v.pack.loader });
      for (const e of extra) {
        if ((v.mods || []).some((x) => x.projectId === e.projectId)) continue;
        const asked = mr.find((m) => m.slug === e.id || m.slug === e.projectId);
        if (asked?.pinned) Object.assign(e, { auto: true, pinned: true, by: asked.by || [] });
        else if (asked) e.auto = false;
        v.mods.push(e);
      }
      await rebuildMr(v);
    }
    for (const c of cf) if (!(v.mods || []).some((x) => x.id === c.id)) v.mods.push(cleanCfMod(c));
    await saveState();
    if (deps) await syncPackFiles(v, { deps });
    return { ok: true };
  }

  // Mod CurseForge d'un Mon pack : jamais de lien de téléchargement gardé (le joueur télécharge).
  function cleanCfMod(c) {
    const fileId = Number(c.fileId) > 0 ? Number(c.fileId) : null;
    return {
      id: String(c.id || `cf-${c.projectId || c.slug || c.name}`).slice(0, 80),
      name: String(c.name || "?").slice(0, 80),
      source: "cf",
      projectId: Number(c.projectId) || null,
      version: c.fileName || "",
      file: c.fileName && SAFE_JAR.test(c.fileName) ? { filename: c.fileName, url: null, sha1: /^[0-9a-f]{40}$/i.test(c.sha1 || "") ? c.sha1.toLowerCase() : null, size: Number(c.size) || null } : null,
      cf: { fileID: fileId, pageUrl: c.pageUrl || null, search: c.search || null, got: null },
      auto: !!c.auto,
      by: Array.isArray(c.by) ? c.by.slice(0, 20) : [],
      on: true,
    };
  }

  // Un fichier venu de Téléchargements (vérifié par main.js) entre dans le pack : copié dans mods/
  // puis l'original retiré de Téléchargements (comme pour les packs des serveurs).
  async function acceptManualJar(id, modId, sourceFile, { sha1, size, fileName, meta, fileId = null, pageUrl = null }) {
    const v = getVersion(id);
    if (!v || !isCustom(v)) throw new Error("Pack introuvable.");
    const name = SAFE_JAR.test(fileName || "") ? fileName : path.basename(sourceFile);
    if (!SAFE_JAR.test(name)) throw new Error("Nom de fichier refusé.");
    let m = (v.mods || []).find((x) => x.id === modId);
    // Ancienne version de ce mod (mise à jour à la main) : retirée.
    const old = m && fileNameOf(m);
    const target = path.join(modsDirOf(id), name);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.copyFile(sourceFile, `${target}.part`);
    // Copie relue (28/10) : seule une copie identique au fichier vérifié est mise en place.
    if (sha1 && (await fileSha1(`${target}.part`).catch(() => null)) !== String(sha1).toLowerCase()) {
      await fsp.rm(`${target}.part`, { force: true });
      throw new Error("La copie du fichier a échoué, réessaie.");
    }
    await fsp.rename(`${target}.part`, target);
    if (old && old !== name) {
      await fsp.rm(path.join(modsDirOf(id), old), { force: true });
      await fsp.rm(path.join(modsDirOf(id), `${old}.disabled`), { force: true });
    }
    if (!m) {
      m = cleanCfMod({ id: modId, name: meta?.name || name, fileName: name });
      v.mods.push(m);
    }
    m.file = { filename: name, url: null, sha1, size };
    m.version = meta?.version || name;
    if (meta?.name && (m.name === m.cf?.search || !m.name || m.name === "?")) m.name = meta.name;
    m.cf = { ...(m.cf || {}), got: "hand" };
    // Autre fichier CurseForge choisi (30/10, « Corriger le pack ») : le pack retient ce fichier-là.
    if (Number(fileId) > 0) Object.assign(m.cf, { fileID: Number(fileId), pageUrl: pageUrl || m.cf.pageUrl || null });
    await saveState();
    // En arrière-plan : le mod est déjà en place, le joueur n'attend pas.
    dropDownloaded(sourceFile, sha1).catch(() => {});
    return { ok: true, name: m.name };
  }

  // Fichier pris dans Téléchargements : supprimé une fois copié (27/10, Rushi : il y restait). Juste
  // après le téléchargement, le navigateur ou l'antivirus le tient encore ouvert un moment, et la
  // suppression échouait sans rien dire : on réessaie pendant environ 30 s. Les doublons identiques
  // (« nom (1).jar », même empreinte) partent aussi. Renvoie false si le fichier est resté.
  // 28/10 (Rushi : « Échec, erreur de l'analyse antivirus » dans le navigateur alors que le mod était
  // bien installé) : le navigateur fait analyser le fichier juste APRÈS le téléchargement ; le retirer
  // pendant cette analyse la faisait échouer. On attend donc 30 s avant d'y toucher.
  const fileSha1 = (f) =>
    new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha1");
      fs.createReadStream(f).on("error", reject).on("data", (c) => hash.update(c)).on("end", () => resolve(hash.digest("hex")));
    });
  async function dropDownloaded(file, sha1) {
    await new Promise((r) => setTimeout(r, 30_000));
    const dir = path.dirname(file);
    const stem = (n) => n.replace(/(?: \(\d+\))?\.jar$/i, "").toLowerCase();
    const files = [file];
    if (sha1) {
      for (const n of await fsp.readdir(dir).catch(() => [])) {
        const other = path.join(dir, n);
        if (other === file || !/\.jar$/i.test(n) || stem(n) !== stem(path.basename(file))) continue;
        const h = await new Promise((resolve) => {
          const hash = crypto.createHash("sha1");
          fs.createReadStream(other).on("error", () => resolve(null)).on("data", (c) => hash.update(c)).on("end", () => resolve(hash.digest("hex")));
        });
        if (h && h.toLowerCase() === String(sha1).toLowerCase()) files.push(other);
      }
    }
    let left = 0;
    for (const f of files) {
      for (let i = 0; ; i++) {
        try {
          await fsp.rm(f);
          break;
        } catch (error) {
          if (error.code === "ENOENT") break;
          if (i >= 15) {
            left++;
            break;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    return left === 0;
  }

  // « J'ai le fichier (.jar) » (27/10) : une COPIE du .jar choisi par le joueur va dans mods/ (son
  // fichier reste où il est). Le pack le voit comme un mod « Fichier » : on peut le couper, le
  // launcher ne le retire jamais.
  async function addLooseJar(id, sourceFile) {
    const v = getVersion(id);
    if (!v || !isCustom(v)) throw new Error("Pack introuvable.");
    const name = path.basename(sourceFile);
    if (!SAFE_JAR.test(name)) throw new Error("Nom de fichier refusé (un .jar sans caractères spéciaux).");
    const meta = await packs.readJarMeta(sourceFile, { loader: metaLoader(v) });
    if (!meta) throw new Error("Ce fichier n'est pas un mod Minecraft lisible.");
    const target = path.join(modsDirOf(id), name);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.copyFile(sourceFile, `${target}.part`);
    await fsp.rename(`${target}.part`, target);
    return { name: meta.name || name.replace(/\.jar$/i, ""), ids: [...(meta.ids || []), ...(meta.provides || [])] };
  }

  async function listResourcePacks(id) {
    const gameDir = pageDir(id);
    const active = packs.activeResourcePacks(await packs.readOptions(gameDir));
    const out = [];
    for (const e of await fsp.readdir(path.join(gameDir, "resourcepacks"), { withFileTypes: true }).catch(() => [])) {
      if (!e.isDirectory() && !/\.zip$/i.test(e.name)) continue;
      const file = path.join(gameDir, "resourcepacks", e.name);
      const st = await fsp.stat(file).catch(() => null);
      out.push({ file: e.name, name: e.name.replace(/\.zip$/i, ""), dir: e.isDirectory(), bytes: st?.size || 0, on: active.includes(`file/${e.name}`), needIds: await packs.resourcePackNeeds(file) });
    }
    // Dans Minecraft, le dernier de la liste passe devant : on montre le plus fort en premier.
    out.sort((a, b) => active.indexOf(`file/${b.file}`) - active.indexOf(`file/${a.file}`));
    return out;
  }
  async function setResourcePack(id, file, on) {
    if (typeof file !== "string" || file !== path.basename(file)) throw new Error("Pack de ressources introuvable.");
    await packs.setResourcePack(pageDir(id), file, !!on);
    return { ok: true };
  }
  async function setShader(id, name) {
    if (name != null && (typeof name !== "string" || name !== path.basename(name))) throw new Error("Shader introuvable.");
    await packs.setIrisShader(pageDir(id), name || null);
    return { ok: true };
  }

  const FILE_INFO = {
    config: "config", defaultconfigs: "config", kubejs: "scripts", scripts: "scripts", schematics: "schematics",
    screenshots: "screenshots", logs: "logs", "crash-reports": "crash", "options.txt": "options", "servers.dat": "servers",
  };
  // Page d'un pack : mods, packs de ressources, shaders, fichiers et problèmes.
  // `quick` : la page s'ouvre tout de suite (rien sur Internet, pas de tailles de dossiers) ; la
  // page redemande ensuite la version complète (versions Modrinth, solutions, tailles).
  async function packInfo(id, { quick = false } = {}) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette version n'existe plus.");
    if (!v.pack) return vanillaInfo(v);
    const gameDir = gameDirOf(id);
    if (!isCustom(v)) {
      // Pack officiel : liste de l'équipe, en lecture seule.
      return {
        readonly: true,
        name: v.pack?.name?.fr || v.pack?.slug || v.name,
        minecraftVersion: v.minecraftVersion,
        loader: "fabric",
        loaderVersion: v.pack?.loaderVersion || "",
        sizeBytes: (v.files || []).reduce((a, f) => a + (Number(f.size) || 0), 0),
        mods: (v.files || []).map((f) => ({ id: f.filename, name: f.filename.replace(/\.jar$/i, "").replace(/[-_]/g, " "), author: "", source: "mr", version: "", versions: [""], on: true, auto: false, deps: [] })),
        resourcepacks: [],
        shaders: [],
        shaderOn: -1,
        files: [],
        problems: [],
      };
    }
    const jars = await packJars(v);
    const byId = new Map();
    for (const m of v.mods || []) byId.set(m.id, m);
    const providers = new Map();
    for (const j of jars) if (j.meta) for (const pid of [...j.meta.ids, ...j.meta.provides]) if (!providers.has(pid)) providers.set(pid, j.ref.id);
    const mods = [];
    const seen = new Set();
    const versionLists = new Map();
    if (!quick) await Promise.all(
      (v.mods || []).filter((m) => m.source === "mr").map(async (m) => {
        versionLists.set(m.id, (await packs.mrVersions(m.projectId, v.minecraftVersion, v.pack.loader).catch(() => [])).map((x) => x.v));
      }),
    );
    const present = new Map(jars.map((j) => [j.file, j]));
    for (const m of v.mods || []) {
      const j = present.get(fileNameOf(m));
      seen.add(fileNameOf(m));
      const list = versionLists.get(m.id) || [];
      mods.push({
        id: m.id,
        name: looksFile(m.name) && j?.meta?.name ? j.meta.name : m.name,
        author: m.author || "",
        source: m.source,
        version: looksFile(m.version) && j?.meta?.version ? j.meta.version : m.version || "",
        versions: m.source === "mr" ? (list.includes(m.version) ? list : [m.version, ...list]) : [m.version || ""],
        on: m.on !== false,
        auto: !!m.auto,
        by: m.by || [],
        have: !!j,
        got: m.cf?.got || (m.file?.url ? "api" : null),
        deps: (j?.meta?.deps || []).map((d) => ({ id: providers.get(d.id) || d.id })).filter((d) => d.id !== m.id && !["minecraft", "java", "fabricloader", "forge", "neoforge"].includes(d.id)),
      });
    }
    for (const j of jars) {
      if (seen.has(j.file)) continue;
      mods.push({ id: j.ref.id, name: j.ref.name, author: "", source: "file", version: j.meta?.version || "", versions: [j.meta?.version || ""], on: j.on, auto: false, by: [], have: true, deps: (j.meta?.deps || []).map((d) => ({ id: providers.get(d.id) || d.id })).filter((d) => !["minecraft", "java", "fabricloader", "forge", "neoforge"].includes(d.id)) });
    }
    const rps = await listResourcePacks(id);
    const shaderNames = await listShaders(gameDir);
    const activeShader = await packs.readIrisShader(gameDir);
    const files = [];
    for (const e of quick ? [] : await fsp.readdir(gameDir, { withFileTypes: true }).catch(() => [])) {
      if (e.name.startsWith(".") || ["mods", "saves", "resourcepacks", "shaderpacks"].includes(e.name)) continue;
      const abs = path.join(gameDir, e.name);
      if (e.isDirectory()) {
        const w = await walkFiles(abs).catch(() => ({ files: [], bytes: 0 }));
        files.push({ name: e.name, dir: true, n: w.files.length, bytes: w.bytes, info: FILE_INFO[e.name] || "" });
      } else {
        const st = await fsp.stat(abs).catch(() => null);
        files.push({ name: e.name, dir: false, n: 1, bytes: st?.size || 0, info: FILE_INFO[e.name] || "" });
      }
    }
    files.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
    const modsBytes = quick ? 0 : (await walkFiles(modsDirOf(id)).catch(() => ({ bytes: 0 }))).bytes;
    return {
      readonly: v.pack.kind === "omnipub",
      mine: v.pack.kind === "mine",
      kind: v.pack.kind,
      omni: omniInfo(v),
      datapacks: datapackList(v),
      dpLoader: loaderOf(v),
      name: v.pack.name,
      minecraftVersion: v.minecraftVersion,
      loader: v.pack.loader,
      loaderVersion: v.pack.loaderVersion,
      sizeBytes: quick ? null : modsBytes + files.reduce((a, f) => a + f.bytes, 0) + rps.reduce((a, r) => a + r.bytes, 0),
      partial: quick,
      mods,
      resourcepacks: rps.map((r) => ({ file: r.file, name: r.name, info: r.dir ? "" : r.bytes, on: r.on, needs: r.needIds.map((n) => packs.RP_NEEDS[n].name) })),
      shaders: shaderNames.map((n) => ({ name: n.replace(/\.zip$/i, ""), file: n })),
      shaderOn: activeShader ? shaderNames.indexOf(activeShader) : -1,
      iris: providers.has("iris") || providers.has("oculus"),
      files,
      problems: await packProblems(id, { network: !quick }),
    };
  }
  // Mods CurseForge d'un pack qui attendent encore leur fichier (avec ce qu'il faut pour le retrouver).
  function cfPending(id, modId) {
    const v = getVersion(id);
    const m = (v?.mods || []).find((x) => x.id === modId);
    return m ? { id: m.id, name: m.name, projectId: m.projectId, fileId: m.cf?.fileID || null, fileName: fileNameOf(m), sha1: m.file?.sha1 || null, size: m.file?.size || null, pageUrl: m.cf?.pageUrl || null, search: m.cf?.search || null } : null;
  }

  // --- Séparation stricte (26/10) ----------------------------------------------------------
  // Dossier de jeu pour lancer `versionId` (et `worldKey`) : celui de la version si la séparation
  // est active (ou pour Mon pack / pack CurseForge), sinon le dossier commun, ou celui où le monde
  // est déjà rangé.
  async function launchDir(versionId, worldKey, { strict }) {
    const v = getVersion(versionId);
    if (strict || ownDir(v)) return gameDirOf(versionId);
    if (worldKey) {
      const found = await worldDir(worldKey);
      if (found) return gameDirOf(found.world.home);
    }
    return GAME_DIR_COMMON;
  }
  // Réglages du jeu (touches, vidéo…) repris du dossier commun dans un nouveau dossier de version.
  // Avec « Mes touches » (Laboratoire « keysSync ») : les touches viennent ensuite du fichier de
  // touches commun de sa famille (vanilla ou modée), voir plus bas.
  async function seedOptions(gameDir, v = versionOfDir(gameDir)) {
    if (gameDir === GAME_DIR_COMMON) return;
    const target = path.join(gameDir, "options.txt");
    if (fs.existsSync(target)) return;
    const from = path.join(GAME_DIR_COMMON, "options.txt");
    const stored = keysOn && v ? await readKeys(keysFamily(v)) : new Map();
    let base = fs.existsSync(from) ? await fsp.readFile(from, "utf8").catch(() => null) : null;
    // Avant 1.13 les touches sont des numéros, après des noms (« key.keyboard.w ») : on ne mélange pas.
    if (keysOn && base != null && v && optionsLegacy(base) !== mcLegacy(v.minecraftVersion)) base = null;
    if (base == null && !stored.size) return;
    await fsp.mkdir(gameDir, { recursive: true });
    await fsp.writeFile(target, stored.size ? withKeys(base || "", stored) : base).catch(() => {});
  }

  // --- Mes touches (28/10, demande de Rushi, Laboratoire « keysSync ») -----------------------------
  // Deux fichiers de touches communs dans play/ : vanilla et modé (Minecraft vanilla efface les touches
  // des mods qu'il ne connaît pas), chacun en deux formats (avant 1.13 : numéros ; après : noms).
  // À chaque fermeture du jeu, seules les touches que le joueur a CHANGÉES pendant la partie (ou
  // celles que le fichier commun n'a pas encore, ex. un nouveau mod) y sont reportées : les touches
  // apportées par un pack (« Réglages du pack ») ne remplacent donc pas les siennes. Une nouvelle
  // installation part de ces touches. Les installations existantes ne sont pas modifiées.
  let keysOn = false;
  function setKeysSync(on) {
    keysOn = !!on;
  }
  const KEY_LINE = /^(key_[^:\r\n]+):(.*)$/;
  const mcLegacy = (mc) => cmpMc(mc || "0", "1.13") < 0;
  const keysFamily = (v) => `${v.pack ? "modded" : "vanilla"}${mcLegacy(v.minecraftVersion) ? "-old" : ""}`;
  const keysFile = (fam) => path.join(PLAY_ROOT, `keys-${fam}.txt`);
  function parseKeys(text) {
    const out = new Map();
    for (const line of String(text || "").split(/\r?\n/)) {
      const m = KEY_LINE.exec(line);
      if (m) out.set(m[1], m[2]);
    }
    return out;
  }
  // Format d'un options.txt d'après ses touches : numéros = avant 1.13.
  function optionsLegacy(text) {
    for (const v of parseKeys(text).values()) return /^-?\d+$/.test(v.trim());
    return false;
  }
  async function readKeys(fam) {
    return parseKeys(await fsp.readFile(keysFile(fam), "utf8").catch(() => ""));
  }
  // `text` avec les touches de `keys` (remplacées, ou ajoutées à la fin).
  function withKeys(text, keys) {
    const left = new Map(keys);
    const lines = String(text || "").split(/\r?\n/).map((line) => {
      const m = KEY_LINE.exec(line);
      if (!m || !left.has(m[1])) return line;
      const val = left.get(m[1]);
      left.delete(m[1]);
      return `${m[1]}:${val}`;
    });
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    for (const [k, val] of left) lines.push(`${k}:${val}`);
    return lines.join("\n") + "\n";
  }
  function versionOfDir(gameDir) {
    if (!gameDir || path.resolve(gameDir) === path.resolve(GAME_DIR_COMMON)) return null;
    const id = path.basename(gameDir);
    return path.resolve(gameDirOf(id)) === path.resolve(gameDir) ? getVersion(id) || null : null;
  }
  // Touches au début de la partie, par installation (pour savoir lesquelles le joueur a changées).
  const keysBefore = new Map();
  async function keysSnapshot(versionId, gameDir) {
    if (!keysOn || !versionId) return;
    const text = await fsp.readFile(path.join(gameDir, "options.txt"), "utf8").catch(() => "");
    keysBefore.set(versionId, { gameDir, keys: parseKeys(text) });
  }
  async function keysAfterGame(versionId) {
    const snap = keysBefore.get(versionId);
    keysBefore.delete(versionId);
    const v = getVersion(versionId);
    if (!keysOn || !snap || !v) return false;
    const now = parseKeys(await fsp.readFile(path.join(snap.gameDir, "options.txt"), "utf8").catch(() => ""));
    if (!now.size) return false;
    const fam = keysFamily(v);
    const stored = await readKeys(fam);
    let changed = false;
    for (const [k, val] of now) {
      const before = snap.keys.get(k);
      if ((before !== undefined && before !== val) || !stored.has(k)) {
        if (stored.get(k) !== val) {
          stored.set(k, val);
          changed = true;
        }
      }
    }
    if (!changed) return false;
    await fsp.mkdir(PLAY_ROOT, { recursive: true });
    const tmp = `${keysFile(fam)}.tmp`;
    await fsp.writeFile(tmp, [...stored].map(([k, val]) => `${k}:${val}`).join("\n") + "\n");
    await fsp.rename(tmp, keysFile(fam));
    return true;
  }
  /**
   * Range un monde dans le dossier de jeu `gameDir` (déplacement sur le même disque : rien n'est
   * recopié). Une sauvegarde est faite avant si le monde a changé depuis la dernière (et si ses
   * sauvegardes sont activées). Renvoie le nom de dossier du monde à l'arrivée.
   */
  async function placeWorld(key, gameDir) {
    const found = await worldDir(key);
    if (!found) throw new Error("Monde introuvable.");
    const saves = path.join(gameDir, "saves");
    if (path.resolve(path.dirname(found.dir)) === path.resolve(saves)) return found.world.folder;
    if (worldState(key).backup !== false) await backupWorld(key, { reason: "auto" }).catch(() => null);
    await fsp.mkdir(saves, { recursive: true });
    await seedOptions(gameDir);
    const folder = await uniqueFolder(found.world.folder, saves);
    await fsp.rename(found.dir, path.join(saves, folder));
    listWorldsDirty();
    await listWorlds();
    return folder;
  }
  // Première fois avec la séparation : chaque monde qui a déjà une version va dans son dossier.
  // Les mondes sans version (importés, jamais joués) restent dans game/saves jusqu'au 1er lancement.
  async function migrateToInstances() {
    const moved = [];
    for (const w of await listWorlds()) {
      if (w.home || !w.lastVersionId || !getVersion(w.lastVersionId)) continue;
      try {
        await placeWorld(w.key, gameDirOf(w.lastVersionId));
        moved.push(w.name);
      } catch {
        /* monde ouvert ou dossier bloqué : il sera rangé à son prochain lancement */
      }
    }
    return moved;
  }

  // Mondes sortis d'un export CurseForge directement dans le dossier du pack : ils reçoivent leur
  // clé (au scan) et sont marqués importés, sauvegardes activées (la Version d'origine suit).
  async function registerImported(versionId, folders) {
    listWorldsDirty();
    const all = await listWorlds();
    const out = [];
    for (const w of all) {
      if (w.home !== versionId || !folders.includes(w.folder)) continue;
      const ws = worldState(w.key);
      ws.imported = true;
      ws.backup = true;
      ws.minecraftVersion = w.minecraftVersion;
      ws.name = w.name;
      out.push({ key: w.key, folder: w.folder, name: w.name });
    }
    await saveState();
    return out;
  }
  // --- Import depuis .minecraft (toujours une copie) ----------------------------------
  function defaultMinecraftSaves() {
    return path.join(appDataDir, ".minecraft", "saves");
  }
  async function scanImportable(fromDir) {
    const base = fromDir || defaultMinecraftSaves();
    let dirs = [];
    try {
      dirs = (await fsp.readdir(base, { withFileTypes: true })).filter((d) => d.isDirectory());
    } catch {
      return { dir: base, worlds: [], missing: true };
    }
    const worlds = [];
    for (const d of dirs) {
      const dir = path.join(base, d.name);
      const level = await readLevelDat(path.join(dir, "level.dat"));
      if (!level) continue;
      const { bytes } = await walkFiles(dir, { skip: skipWorldFile });
      worlds.push({ folder: d.name, name: level.name || d.name, minecraftVersion: level.version, lastPlayed: level.lastPlayed, sizeBytes: bytes, icon: await iconDataUrl(dir), modded: level.mods || null });
    }
    worlds.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return { dir: base, worlds };
  }
  async function uniqueFolder(name, saves = SAVES) {
    const clean = String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").slice(0, 60) || "Monde";
    let candidate = clean;
    for (let i = 2; fs.existsSync(path.join(saves, candidate)); i++) candidate = `${clean} (${i})`;
    return candidate;
  }
  // Fichiers d'un monde à copier (sans session.lock) : chemins relatifs et tailles (`dirs` : dossiers,
  // même vides, recréés comme avec la copie d'avant).
  async function worldFiles(dir, rel = "", out = [], dirs = []) {
    for (const d of await fsp.readdir(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) {
        dirs.push(r);
        await worldFiles(dir, r, out, dirs);
      }
      else if (d.isFile() && d.name !== "session.lock") out.push({ rel: r, size: (await fsp.stat(path.join(dir, r))).size });
    }
    return Object.assign(out, { dirs });
  }

  // `onProgress({ i, of, name, files, filesOf, bytes, total, file, overall })` : copie en cours (27/10,
  // fenêtre d'import avec progression, preview « Progression des imports » validée par Rushi).
  async function importWorlds(fromDir, folders, { onProgress = () => {} } = {}) {
    const base = fromDir || defaultMinecraftSaves();
    await fsp.mkdir(SAVES, { recursive: true });
    const done = [];
    const todo = [];
    for (const folder of folders) {
      if (typeof folder !== "string" || folder.includes("/") || folder.includes("\\") || folder === ".." || folder === ".") continue;
      const src = path.join(base, folder);
      if (!fs.existsSync(path.join(src, "level.dat"))) continue;
      const files = await worldFiles(src);
      todo.push({ folder, src, files, bytes: files.reduce((a, f) => a + f.size, 0) });
    }
    const allBytes = todo.reduce((a, w) => a + w.bytes, 0);
    let doneBytes = 0;
    let last = 0;
    for (const [i, { folder, src, files, bytes: total }] of todo.entries()) {
      const target = path.join(SAVES, await uniqueFolder(folder, SAVES));
      // Copie (jamais de déplacement) : le monde d'origine reste intact dans .minecraft.
      let bytes = 0;
      for (const [n, f] of files.entries()) {
        const now = Date.now();
        if (n === 0 || now - last >= 150) {
          last = now;
          onProgress({ i, of: todo.length, name: folder, files: n, filesOf: files.length, bytes, total, file: f.rel, overall: allBytes ? Math.min(0.99, doneBytes / allBytes) : null });
        }
        const to = path.join(target, f.rel);
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.copyFile(path.join(src, f.rel), to, fs.constants.COPYFILE_EXCL);
        bytes += f.size;
        doneBytes += f.size;
      }
      await fsp.mkdir(target, { recursive: true });
      for (const d of files.dirs) await fsp.mkdir(path.join(target, d), { recursive: true });
      const key = crypto.randomUUID();
      await writeWorldKey(target, key);
      const level = await readLevelDat(path.join(target, "level.dat"));
      const ws = worldState(key);
      ws.backup = true;
      ws.imported = true;
      ws.minecraftVersion = level?.version || null;
      ws.name = level?.name || folder;
      ws.modded = level?.mods || null;
      done.push({ key, folder: path.basename(target), name: level?.name || folder });
    }
    await saveState();
    listWorldsDirty();
    return done;
  }

  // Version à utiliser pour « Jouer » sur un monde : la dernière qui l'a ouvert, sinon une version
  // vanilla de même numéro (créée au besoin) pour ne jamais l'ouvrir dans une version plus ancienne.
  // Version pour ouvrir un monde : TOUJOURS la version de Minecraft du monde (level.dat), jamais une
  // autre (retour de Rushi du 24/10 : un monde importé s'ouvrait avec la dernière version créée,
  // ce qui peut l'abîmer ; une version plus ancienne que le monde est refusée ou le casse).
  // - une version de « Mes versions » avec le même numéro : celle jouée en dernier, sinon celle du
  //   même pack, sinon la vanilla, sinon la première ;
  // - aucune : erreur code "needVersion" (le launcher propose de la créer, rien n'est lancé) ;
  // - numéro illisible (très vieux monde) : la version jouée en dernier, sinon code
  //   "chooseVersion" (le joueur choisit) ; `pick` = la version qu'il a choisie.
  async function versionForWorld(key, { pick = null } = {}) {
    const found = await worldDir(key);
    if (!found) throw new Error("Monde introuvable.");
    const { world } = found;
    const mc = world.minecraftVersion && VERSION_ID_PATTERN.test(world.minecraftVersion) ? world.minecraftVersion : null;
    const versions = loadState().versions;
    const last = world.lastVersionId ? getVersion(world.lastVersionId) : null;
    // Installation mise à jour (27/10) : le joueur a accepté la conversion, sauvegarde 🛡 faite.
    const pendingTo = worldState(key).pendingTo;
    const upd = (world.home ? getVersion(world.home) : null) || last;
    if (pendingTo && upd && upd.minecraftVersion === pendingTo && !pick) return { versionId: upd.id, world };
    if (!mc) {
      const chosen = (pick ? getVersion(pick) : null) || (world.home ? getVersion(world.home) : null) || last;
      if (chosen) return { versionId: chosen.id, world };
      throw Object.assign(new Error("La version de Minecraft de ce monde n'a pas pu être lue : choisis avec quelle version l'ouvrir."), { code: "chooseVersion", worldName: world.name });
    }
    const same = versions.filter((v) => v.minecraftVersion === mc);
    const home = world.home ? getVersion(world.home) : null;
    const chosen =
      same.find((v) => v.id === pick) ||
      (home && !pick ? home : null) ||
      same.find((v) => v.id === last?.id) ||
      (last?.pack ? same.find((v) => v.pack && v.pack.packId === last.pack.packId) : null) ||
      same.find((v) => !v.pack) ||
      same[0];
    if (chosen) return { versionId: chosen.id, world };
    throw Object.assign(new Error(`Version non détectée : ce monde a été créé avec Minecraft ${mc}, qui n'est pas dans Mes versions.`), {
      code: "needVersion",
      minecraftVersion: mc,
      worldName: world.name,
    });
  }


  // --- Page d'une version (27/10, preview « Pack Omniscient » v22 validée par Rushi) -------------------
  // Une version vanilla a aussi sa page (packs de ressources, mondes, data packs, fichiers). Son
  // dossier : celui de la version avec la séparation stricte (Laboratoire « strictDirs ») ou pour un
  // Pack Omniscient, sinon le dossier commun game/ (les changements valent alors pour toutes les
  // versions vanilla sans dossier propre).
  let strictOn = false;
  function setStrict(on) {
    strictOn = !!on;
  }
  // Pack Omniscient (27/10) : chaque version du pack est une version de « Mes versions » avec
  // v.omni = { group, tested, missing, base }. Toujours son propre dossier de jeu.
  const ownDir = (v) => isCustom(v) || !!v?.omni || !!v?.own;
  function pageDir(id) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette version n'existe plus.");
    return strictOn || ownDir(v) ? gameDirOf(id) : GAME_DIR_COMMON;
  }
  const SAFE_ZIP = /^[\w.+() \[\]!'&,-]+\.zip$/i;
  const cmpMc = (a, b) => packs.cmpVer(packs.parseVer(a) || [], packs.parseVer(b) || []);
  const DP_STORE = (id) => path.join(pageDir(id), ".omniscient", "datapacks");
  const groupOf = (v) => (v?.omni?.group ? loadState().versions.filter((x) => x.omni?.group === v.omni.group) : []);
  function omniInfo(v) {
    if (!v?.omni) return null;
    return {
      group: v.omni.group,
      tested: !!v.omni.tested,
      missing: v.omni.missing || [],
      base: !!v.omni.base,
      versions: groupOf(v)
        .map((x) => ({ id: x.id, mc: x.minecraftVersion, tested: !!x.omni.tested, missing: x.omni.missing || [], base: !!x.omni.base }))
        .sort((a, b) => cmpMc(b.mc, a.mc)),
    };
  }
  async function listShaders(dir) {
    const out = [];
    for (const e of await fsp.readdir(path.join(dir, "shaderpacks"), { withFileTypes: true }).catch(() => [])) {
      if (e.isDirectory() || /\.zip$/i.test(e.name)) out.push(e.name);
    }
    return out;
  }
  function datapackList(v) {
    return (v.datapacks || []).map((d) => ({ file: d.file, name: d.name, src: d.src, worlds: d.worlds || [], auto: !!d.auto, pending: !!d.pending }));
  }
  async function vanillaInfo(v) {
    const dir = pageDir(v.id);
    const rps = await listResourcePacks(v.id);
    const w = await walkFiles(dir, { skip: (rel) => /^(saves|\.omniscient)(\/|$)/.test(rel) }).catch(() => ({ bytes: 0 }));
    return {
      vanilla: true,
      readonly: false,
      kind: "vanilla",
      omni: omniInfo(v),
      name: v.name || `Minecraft ${v.minecraftVersion}`,
      minecraftVersion: v.minecraftVersion,
      loader: null,
      loaderVersion: "",
      sizeBytes: w.bytes,
      mods: [],
      resourcepacks: rps.map((r) => ({ file: r.file, name: r.name, info: r.dir ? "" : r.bytes, on: r.on, needs: [] })),
      // 28/10 : shaders rangés en vanilla, en attente de « Basculer en version modée ».
      shaders: (await listShaders(dir)).map((n) => ({ name: n.replace(/\.zip$/i, ""), file: n, info: "" })),
      shaderOn: -1,
      datapacks: datapackList(v),
      dpLoader: null,
      files: [],
      problems: [],
    };
  }

  // Retirer un élément de la page (« 🗑 Retirer », 27/10). Toujours confirmé dans la fenêtre. Un monde
  // est sauvegardé (sauvegarde nommée, jamais retirée seule) puis part à la Corbeille de Windows : il
  // apparaît dans « Supprimés » avec ses sauvegardes. `trash(abs)` : shell.trashItem (main.js).
  async function removeItem(id, { kind, key }, { trash, deps, withBackups = false } = {}) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette version n'existe plus.");
    const dir = pageDir(id);
    const plainName = (s) => typeof s === "string" && s === path.basename(s) && s !== ".." && s !== "." && !!s;
    if (kind === "mod") {
      if (!isCustom(v) || v.pack.kind === "omnipub") throw new Error("Les mods de ce pack ne se changent pas ici.");
      if (String(key).startsWith("file:")) {
        const base = String(key).slice(5);
        if (!SAFE_JAR.test(base)) throw new Error("Mod introuvable.");
        for (const f of [base, `${base}.disabled`]) if (fs.existsSync(path.join(modsDirOf(id), f))) await trash(path.join(modsDirOf(id), f));
        return { ok: true };
      }
      const m = (v.mods || []).find((x) => x.id === key);
      if (!m) throw new Error("Mod introuvable.");
      const others = (v.mods || []).filter((x) => x !== m);
      v.mods = others;
      if (m.source === "mr") {
        // Les mods nécessaires seulement à lui partent avec lui (rebuildMr ne garde que ce qui sert).
        const before = new Set(others.map((x) => fileNameOf(x)));
        await rebuildMr(v);
        for (const f of before) if (f && !(v.mods || []).some((x) => fileNameOf(x) === f)) for (const g of [f, `${f}.disabled`]) await fsp.rm(path.join(modsDirOf(id), g), { force: true });
      }
      const f = fileNameOf(m);
      if (f && SAFE_JAR.test(f)) for (const g of [f, `${f}.disabled`]) await fsp.rm(path.join(modsDirOf(id), g), { force: true });
      v.installed = (v.installed || []).filter((p) => (v.mods || []).some((x) => `mods/${fileNameOf(x)}` === p));
      await saveState();
      if (deps) await syncPackFiles(v, { deps }).catch(() => {});
      return { ok: true };
    }
    if (kind === "rp") {
      if (!plainName(key)) throw new Error("Pack de ressources introuvable.");
      await packs.setResourcePack(dir, key, false);
      const abs = path.join(dir, "resourcepacks", key);
      if (fs.existsSync(abs)) await trash(abs);
      return { ok: true };
    }
    if (kind === "sh") {
      if (!plainName(key)) throw new Error("Shader introuvable.");
      if ((await packs.readIrisShader(dir)) === key) await packs.setIrisShader(dir, null);
      const abs = path.join(dir, "shaderpacks", key);
      if (fs.existsSync(abs)) await trash(abs);
      return { ok: true };
    }
    if (kind === "dp") {
      const d = (v.datapacks || []).find((x) => x.file === key);
      if (!d) throw new Error("Data pack introuvable.");
      await setDatapack(id, key, { worlds: [], auto: false });
      v.datapacks = (v.datapacks || []).filter((x) => x !== d);
      await saveState();
      await fsp.rm(path.join(DP_STORE(id), d.file), { force: true });
      return { ok: true };
    }
    if (kind === "w") {
      assertKey(key);
      const found = await worldDir(key);
      if (!found) throw new Error("Monde introuvable.");
      // « Retirer aussi ses mondes » d'une installation (Rushi, 27/10) : pas de sauvegarde avant, le
      // monde ET ses sauvegardes vont à la Corbeille, rien ne reste dans le launcher. Seule la
      // Version d'origine d'un monde importé reste (« Suppression définitive » seulement).
      if (withBackups) {
        await trash(found.dir);
        const list = await readBackups(key);
        const keep = list.filter((b) => b.reason === "import");
        if (!keep.length) {
          if (fs.existsSync(path.join(BACKUPS, key))) await trash(path.join(BACKUPS, key));
          delete loadState().worlds[key];
          await saveState();
        } else {
          for (const b of list) {
            if (b.reason === "import") continue;
            const f = path.join(BACKUPS, key, path.basename(b.file));
            if (fs.existsSync(f)) await trash(f);
          }
          await writeBackups(key, keep);
        }
        listWorldsDirty();
        return { ok: true, name: found.world.name };
      }
      await backupWorld(key, { reason: "manual", label: "Avant « Retirer » dans le launcher", force: true });
      await trash(found.dir);
      listWorldsDirty();
      return { ok: true, name: found.world.name };
    }
    throw new Error("Élément inconnu.");
  }

  // Packs de ressources et shaders : depuis Modrinth (lien vérifié, SHA-1) ou une COPIE d'un .zip du
  // joueur (son fichier reste où il est). CurseForge : le joueur télécharge, puis « J'ai le fichier ».
  async function addContent(id, { kind, from, slug, sourceFile }) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette version n'existe plus.");
    const sub = { rp: "resourcepacks", sh: "shaderpacks" }[kind];
    if (!sub) throw new Error("Type de contenu inconnu.");
    const dir = path.join(pageDir(id), sub);
    if (from === "mr") {
      const hit = await packs.contentFile(kind, String(slug || ""), v.minecraftVersion);
      if (!hit) throw new Error(`Rien sur Modrinth pour Minecraft ${v.minecraftVersion}.`);
      await packs.downloadChecked(hit.file, path.join(dir, hit.file.filename));
      if (kind === "rp") await packs.setResourcePack(pageDir(id), hit.file.filename, true);
      return { name: hit.name, file: hit.file.filename };
    }
    const base = path.basename(String(sourceFile || ""));
    if (!SAFE_ZIP.test(base)) throw new Error("Choisis un fichier .zip (sans caractères spéciaux dans le nom).");
    await fsp.mkdir(dir, { recursive: true });
    const target = path.join(dir, base);
    await fsp.copyFile(sourceFile, `${target}.part`);
    await fsp.rename(`${target}.part`, target);
    if (kind === "rp") await packs.setResourcePack(pageDir(id), base, true);
    return { name: base.replace(/\.zip$/i, ""), file: base };
  }

  // --- Data packs, monde par monde (27/10) -------------------------------------------------------
  // Le launcher garde une copie de chaque data pack de la version (.omniscient/datapacks/) et la pose
  // dans <monde>/datapacks/ des mondes choisis. « Dans tous les mondes » (versions modées) : posé
  // dans le dossier du chargeur (Paxi ou Global Packs) et retiré des mondes (jamais en double).
  async function addDatapack(id, { from, slug, sourceFile, worldKey = null }) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette version n'existe plus.");
    const store = DP_STORE(id);
    let entry;
    if (from === "mr") {
      const hit = await packs.contentFile("dp", String(slug || ""), v.minecraftVersion);
      if (!hit) throw new Error(`Ce data pack n'existe pas pour Minecraft ${v.minecraftVersion} sur Modrinth.`);
      await packs.downloadChecked(hit.file, path.join(store, hit.file.filename));
      entry = { file: hit.file.filename, name: hit.name, src: "mr", mr: { projectId: hit.projectId, versionId: hit.versionId } };
    } else {
      const base = path.basename(String(sourceFile || ""));
      if (!SAFE_ZIP.test(base)) throw new Error("Choisis un data pack en .zip (sans caractères spéciaux dans le nom).");
      await fsp.mkdir(store, { recursive: true });
      await fsp.copyFile(sourceFile, path.join(store, `${base}.part`));
      await fsp.rename(path.join(store, `${base}.part`), path.join(store, base));
      entry = { file: base, name: base.replace(/\.zip$/i, ""), src: "file" };
    }
    v.datapacks = (v.datapacks || []).filter((d) => d.file !== entry.file);
    // 28/10 (Rushi) : sans aucun monde, le data pack attend le premier (voir applyPendingDatapacks).
    const pending = !worldKey && !(await worldsOfVersion(id)).length;
    v.datapacks.push({ ...entry, worlds: [], auto: false, ...(pending ? { pending: true } : {}) });
    await saveState();
    if (worldKey) await setDatapack(id, entry.file, { worlds: [worldKey], auto: false });
    return { name: entry.name, file: entry.file };
  }
  function loaderOf(v) {
    if (!isCustom(v)) return null;
    for (const [k, l] of Object.entries(packs.DP_LOADERS)) if ((v.mods || []).some((m) => m.on !== false && (l.ids.includes(m.id) || m.id === l.slug))) return k;
    // Pack CurseForge importé (04/11) : mods « cf-<projet> », reconnus à leur nom ou à leur .jar
    // (aussi ceux rangés dans le fichier du pack, présents seulement dans mods/).
    const names = (v.mods || []).filter((m) => m.on !== false).flatMap((m) => [m.name, fileNameOf(m)]);
    if (v.pack?.kind === "cf" || v.pack?.kind === "mr") {
      try {
        for (const f of fs.readdirSync(modsDirOf(v.id))) if (/\.jar$/i.test(f)) names.push(f);
      } catch {}
    }
    return packs.dpLoaderFromNames(names);
  }
  // Dossier (absolu) que lit le chargeur de data packs de cette installation.
  const loaderDirOf = (v, key) => path.join(pageDir(v.id), ...String(packs.dpLoaderDir(key, v.minecraftVersion) || "").split("/"));
  async function setDatapack(id, file, { worlds = [], auto = false, keepAll = false }) {
    const v = getVersion(id);
    const d = (v?.datapacks || []).find((x) => x.file === file);
    if (!d) throw new Error("Data pack introuvable.");
    const src = path.join(DP_STORE(id), d.file);
    const loader = auto ? loaderOf(v) : null;
    if (auto && !loader) throw new Error("Il faut d'abord un chargeur de data packs (Paxi ou Global Packs) dans le pack.");
    // Dans le chargeur = dans tous les mondes : on le retire des mondes (pas de doublon).
    const want = new Set(auto ? [] : worlds.filter(validWorldKey));
    const before = new Set(d.worlds || []);
    for (const key of new Set([...want, ...before])) {
      if (want.has(key) === before.has(key)) continue;
      const found = await worldDir(key);
      if (!found) continue;
      // Sauvegarde du monde avant chaque changement (même sans changement depuis la dernière).
      if (worldState(key).backup !== false) await backupWorld(key, { reason: "auto", force: true });
      const target = path.join(found.dir, "datapacks", d.file);
      if (want.has(key)) {
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.copyFile(src, target);
      } else {
        await fsp.rm(target, { force: true });
      }
    }
    for (const k of Object.keys(packs.DP_LOADERS)) {
      const target = path.join(loaderDirOf(v, k), d.file);
      if (auto && k === loader) {
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.copyFile(src, target);
      } else {
        await fsp.rm(target, { force: true });
      }
    }
    d.worlds = [...want].filter((k) => loadState().worlds[k]);
    d.auto = !!auto;
    delete d.pending;
    // Choix fait à la main dans le launcher : le data pack ne suit plus « tous les mondes » (04/11).
    if (!keepAll) delete d.allWorlds;
    await saveState();
    return { ok: true };
  }
  // Data pack d'un pack CurseForge (04/11) : son .zip est déjà dans .omniscient/datapacks/. Avec Paxi,
  // Open Loader ou Global Packs dans le pack : dans le dossier de ce mod (tous les mondes). Sinon :
  // dans chaque monde de l'installation, maintenant et à chaque lancement (nouveaux mondes compris).
  function datapackStore(id) {
    return DP_STORE(id);
  }
  async function addCfDatapack(id, { file, name }) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette installation n'existe plus.");
    if (!SAFE_ZIP.test(String(file || "")) || !fs.existsSync(path.join(DP_STORE(id), file))) throw new Error("Data pack introuvable.");
    v.datapacks = (v.datapacks || []).filter((d) => d.file !== file);
    v.datapacks.push({ file, name: String(name || file.replace(/\.zip$/i, "")).slice(0, 80), src: "cf", worlds: [], auto: false, allWorlds: true });
    await saveState();
    if (loaderOf(v)) {
      await setDatapack(id, file, { worlds: [], auto: true });
      return { where: "loader", loader: loaderOf(v) };
    }
    await spreadAllWorldDatapacks(id);
    return { where: "worlds" };
  }
  async function spreadAllWorldDatapacks(id) {
    const v = getVersion(id);
    const list = (v?.datapacks || []).filter((d) => d.allWorlds && !d.auto);
    if (!list.length) return [];
    // Un chargeur ajouté depuis : le data pack y va (une seule fois pour tous les mondes).
    if (loaderOf(v)) {
      for (const d of list) await setDatapack(id, d.file, { worlds: [], auto: true });
      return [];
    }
    listWorldsDirty();
    const worlds = await worldsOfVersion(id);
    const done = [];
    for (const d of list) {
      const have = new Set(d.worlds || []);
      const missing = worlds.filter((w) => !have.has(w.key));
      if (!missing.length) continue;
      await setDatapack(id, d.file, { worlds: [...have, ...missing.map((w) => w.key)], auto: false, keepAll: true });
      for (const w of missing) done.push({ name: d.name, world: w.name });
    }
    return done;
  }
  // Mondes d'une installation : ceux de son dossier, ou ouverts la dernière fois avec elle.
  async function worldsOfVersion(id) {
    return (await listWorlds()).filter((w) => w.home === id || w.lastVersionId === id);
  }
  // Data packs ajoutés quand l'installation n'avait encore aucun monde (28/10) : à la fermeture du
  // jeu, ils vont dans le monde le plus récent (sauvegardé juste avant par setDatapack). Ils marchent
  // à la prochaine ouverture de ce monde.
  async function applyPendingDatapacks(id) {
    const v = getVersion(id);
    const wait = (v?.datapacks || []).filter((d) => d.pending && !d.auto && !(d.worlds || []).length);
    if (!wait.length) return spreadAllWorldDatapacks(id);
    listWorldsDirty();
    const world = (await worldsOfVersion(id)).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0];
    if (!world) return [];
    const done = [];
    for (const d of wait) {
      await setDatapack(id, d.file, { worlds: [world.key], auto: false });
      done.push({ name: d.name, world: world.name });
    }
    return [...done, ...(await spreadAllWorldDatapacks(id))];
  }
  // Basculer une installation vanilla en version modée (28/10, preview validée par Rushi) : elle
  // devient un « Mon pack » avec son chargeur ; main.js ajoute ensuite le mod choisi (Iris, Paxi…).
  // Rien n'est supprimé. Sans dossier propre, ses packs de ressources, shaders, réglages et data packs
  // sont COPIÉS du dossier commun vers le sien (les autres versions vanilla gardent les leurs) ; ses
  // mondes y sont rangés à leur prochain lancement, comme d'habitude (placeWorld, sauvegarde avant).
  async function switchToModded(id, { loader, loaderVersion }) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette installation n'existe plus.");
    if (isCustom(v) || v.pack) throw new Error("Cette installation a déjà des mods.");
    if (!packs.LOADER_IDS.includes(loader)) throw new Error("Chargeur de mods inconnu.");
    if (!VERSION_ID_PATTERN.test(loaderVersion || "")) throw new Error(`Aucune version de ${loader} trouvée pour Minecraft ${v.minecraftVersion}.`);
    const from = pageDir(id);
    const to = gameDirOf(id);
    if (path.resolve(from) !== path.resolve(to)) {
      for (const sub of ["resourcepacks", "shaderpacks", path.join(".omniscient", "datapacks")]) {
        const src = path.join(from, sub);
        if (fs.existsSync(src)) await fsp.cp(src, path.join(to, sub), { recursive: true, force: false, errorOnExist: false });
      }
      for (const f of ["options.txt", "optionsshaders.txt", "servers.dat"]) {
        const src = path.join(from, f);
        if (fs.existsSync(src) && !fs.existsSync(path.join(to, f))) {
          await fsp.mkdir(to, { recursive: true });
          await fsp.copyFile(src, path.join(to, f));
        }
      }
    }
    v.pack = { kind: "mine", slug: "mine", name: v.name || `Minecraft ${v.minecraftVersion}`, loader, loaderVersion, switchedAt: new Date().toISOString() };
    v.mods = [];
    v.files = [];
    await saveState();
    await fsp.mkdir(modsDirOf(id), { recursive: true });
    await seedOptions(to, v);
    return { ok: true };
  }
  // Avant de jouer : les data packs « dans tous les mondes » sont bien dans le dossier du chargeur
  // (remis s'ils ont été effacés à la main).
  async function syncAutoDatapacks(v) {
    const loader = loaderOf(v);
    if (!loader) return;
    const dir = loaderDirOf(v, loader);
    for (const d of v.datapacks || []) {
      if (!d.auto || fs.existsSync(path.join(dir, d.file))) continue;
      const src = path.join(DP_STORE(v.id), d.file);
      if (!fs.existsSync(src)) continue;
      await fsp.mkdir(dir, { recursive: true });
      await fsp.copyFile(src, path.join(dir, d.file));
    }
  }
  // Sauvegarde d'un monde d'une version avec chargeur (OUI de Rushi, 27/10 07h01) : une copie des
  // data packs communs va dans omniscient-meta/datapacks/ ; à la restauration, ceux qui manquent
  // dans le dossier du chargeur sont remis.
  function autoDatapackFiles(versionId) {
    const v = versionId ? getVersion(versionId) : null;
    const loader = v && loaderOf(v);
    if (!loader) return [];
    const dir = loaderDirOf(v, loader);
    return (v.datapacks || []).filter((d) => d.auto && fs.existsSync(path.join(dir, d.file))).map((d) => ({ abs: path.join(dir, d.file), rel: `${META_DIR}/datapacks/${d.file}` }));
  }
  async function restoreAutoDatapacks(extractedDir, versionId) {
    const from = path.join(extractedDir, META_DIR, "datapacks");
    const v = versionId ? getVersion(versionId) : null;
    const loader = v && loaderOf(v);
    if (!loader || !fs.existsSync(from)) return;
    const dir = loaderDirOf(v, loader);
    for (const f of await fsp.readdir(from).catch(() => [])) {
      if (!SAFE_ZIP.test(f) || fs.existsSync(path.join(dir, f))) continue;
      await fsp.mkdir(dir, { recursive: true });
      await fsp.copyFile(path.join(from, f), path.join(dir, f));
    }
  }

  // Map téléchargée (CurseForge ou autre) : le .zip du joueur est lu (jamais modifié), le monde va
  // dans les mondes de cette version. Une sauvegarde « Version d'origine » est faite par main.js.
  async function importMap(id, zipFile) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette version n'existe plus.");
    const entries = await require("./zipStream").listZip(zipFile);
    const level = entries.filter((e) => /(^|\/)level\.dat$/.test(e.name)).sort((a, b) => a.name.split("/").length - b.name.split("/").length)[0];
    if (!level) throw new Error("Ce .zip ne contient pas de monde Minecraft (level.dat introuvable).");
    const prefix = level.name.slice(0, -"level.dat".length);
    const saves = path.join(pageDir(id), "saves");
    const tmp = path.join(saves, `.omni-map-${crypto.randomBytes(4).toString("hex")}`);
    await fsp.mkdir(saves, { recursive: true });
    let target;
    try {
      await extractZip(zipFile, tmp, { pick: (n) => (n.startsWith(prefix) && n.length > prefix.length && !n.startsWith(`${prefix}__MACOSX`) ? n.slice(prefix.length) : null) });
      const info = await readLevelDat(path.join(tmp, "level.dat"));
      target = path.join(saves, await uniqueFolder(info?.name || prefix.split("/").filter(Boolean).pop() || path.basename(zipFile, ".zip"), saves));
      const key = crypto.randomUUID();
      await writeWorldKey(tmp, key);
      await fsp.rename(tmp, target);
      const ws = worldState(key);
      ws.backup = true;
      ws.imported = true;
      ws.minecraftVersion = info?.version || v.minecraftVersion;
      ws.name = info?.name || path.basename(target);
      ws.lastVersionId = id;
      await saveState();
      listWorldsDirty();
      return { key, name: ws.name, folder: path.basename(target) };
    } catch (error) {
      await fsp.rm(tmp, { recursive: true, force: true });
      throw error;
    }
  }

  // --- Explorateur de fichiers de la version (27/10) -----------------------------------------------
  // Chemins relatifs au dossier de la version, avec des « / » ; jamais en dehors.
  function filePath(id, rel) {
    const root = path.resolve(pageDir(id));
    const clean = String(rel || "").replace(/\\/g, "/").split("/").filter(Boolean);
    if (clean.some((p) => p === ".." || p === "." || /[<>:"|?*\x00-\x1f]/.test(p))) throw new Error("Chemin refusé.");
    if (clean[0] === ".omniscient") throw new Error("Dossier interne du launcher.");
    const abs = path.resolve(root, ...clean);
    if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error("Chemin refusé.");
    return abs;
  }
  async function filesList(id, rel) {
    const dir = filePath(id, rel);
    await fsp.mkdir(pageDir(id), { recursive: true });
    const out = [];
    for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
      if (!rel && e.name === ".omniscient") continue;
      const abs = path.join(dir, e.name);
      const st = await fsp.stat(abs).catch(() => null);
      if (!st) continue;
      if (st.isDirectory()) {
        const w = await walkFiles(abs).catch(() => ({ files: [], bytes: 0 }));
        out.push({ name: e.name, dir: true, n: (await fsp.readdir(abs).catch(() => [])).length, bytes: w.bytes, mtime: st.mtimeMs });
      } else out.push({ name: e.name, dir: false, bytes: st.size, mtime: st.mtimeMs });
    }
    return out;
  }
  const TEXT_MAX = 2 * 1024 * 1024;
  const IMG_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };
  async function filesRead(id, rel) {
    const abs = filePath(id, rel);
    const st = await fsp.stat(abs);
    if (st.isDirectory()) throw new Error("C'est un dossier.");
    const ext = path.extname(abs).slice(1).toLowerCase();
    if (IMG_TYPES[ext]) {
      if (st.size > 15 * 1024 * 1024) return { ok: true, tooBig: true };
      return { ok: true, dataUrl: `data:${IMG_TYPES[ext]};base64,${(await fsp.readFile(abs)).toString("base64")}` };
    }
    if (st.size > TEXT_MAX) return { ok: true, tooBig: true };
    return { ok: true, text: await fsp.readFile(abs, "utf8") };
  }
  // Enregistrer : l'ancienne version est gardée à côté (.bak), le fichier est remplacé d'un coup.
  async function filesWrite(id, rel, text) {
    const abs = filePath(id, rel);
    if (typeof text !== "string" || text.length > TEXT_MAX) throw new Error("Texte trop long.");
    if (fs.existsSync(abs)) await fsp.copyFile(abs, `${abs}.bak`);
    await fsp.writeFile(`${abs}.part`, text, "utf8");
    await fsp.rename(`${abs}.part`, abs);
    return { ok: true };
  }
  async function filesRename(id, rel, name) {
    const abs = filePath(id, rel);
    if (!rel) throw new Error("Chemin refusé.");
    const n = String(name || "").trim();
    if (!n || n !== path.basename(n) || /[\\/:*?"<>|]/.test(n) || n === "." || n === "..") throw new Error("Nom refusé.");
    const target = path.join(path.dirname(abs), n);
    if (fs.existsSync(target) && target.toLowerCase() !== abs.toLowerCase()) throw new Error("Ce nom existe déjà dans ce dossier.");
    await fsp.rename(abs, target);
    return { ok: true };
  }
  async function filesMkdir(id, rel) {
    const abs = filePath(id, rel);
    if (fs.existsSync(abs)) throw new Error("Ce nom existe déjà dans ce dossier.");
    await fsp.mkdir(abs, { recursive: true });
    return { ok: true };
  }

  // « Testée » (barre « Versions du pack ») : le jeu s'est fermé normalement, sans rapport de crash.
  async function markTested(id) {
    const v = getVersion(id);
    if (!v?.omni || v.omni.tested) return false;
    v.omni.tested = true;
    await saveState();
    return true;
  }
  // Une version générée ou importée dans un groupe Pack Omniscient.
  async function setOmni(id, omni) {
    const v = getVersion(id);
    if (!v) return;
    v.omni = { group: omni.group, tested: !!omni.tested, missing: (omni.missing || []).slice(0, 100), base: !!omni.base };
    await saveState();
  }
  // Tout ce qui sert à exporter / générer (omniPack.js) : la version et son dossier.
  function omniSource(id) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette version n'existe plus.");
    return { v, dir: pageDir(id), store: DP_STORE(id) };
  }
  async function addDatapackEntry(id, entry) {
    const v = getVersion(id);
    v.datapacks = (v.datapacks || []).filter((d) => d.file !== entry.file);
    v.datapacks.push({ file: entry.file, name: entry.name, src: entry.src || "file", mr: entry.mr || null, worlds: [], auto: false });
    await saveState();
  }

  return {
    setVersionIcon,
    setVersionRam,
    PLAY_ROOT,
    GAME_DIR,
    SAVES,
    INST_ROOT,
    gameDirOf,
    launchDir,
    setStrict,
    setKeysSync,
    pageDir,
    removeItem,
    addContent,
    addDatapack,
    setDatapack,
    importMap,
    filePath,
    filesList,
    filesRead,
    filesWrite,
    filesRename,
    filesMkdir,
    markTested,
    setOmni,
    omniSource,
    addDatapackEntry,
    applyPendingDatapacks,
    addCfDatapack,
    spreadAllWorldDatapacks,
    datapackStore,
    switchToModded,
    loaderOf,
    listShaders,
    walkFiles,
    uniqueFolder,
    placeWorld,
    migrateToInstances,
    createCustomVersion,
    syncPackFiles,
    packInfo,
    packProblems,
    setLoaderVersion,
    modsDirOf,
    setPackMod,
    addPackMods,
    acceptManualJar,
    addLooseJar,
    cfPending,
    setResourcePack,
    setShader,
    modsDirOf,
    listMinecraftVersions,
    listVersions,
    getVersion,
    createVersion,
    renameVersion,
    removeVersion,
    touchVersion,
    refreshPackFiles,
    prepareVersion,
    listWorlds,
    listGone,
    copyWorld,
    deleteWorldForever,
    openWorld,
    worldDir,
    worldState,
    saveState,
    backupWorld,
    listBackups,
    keepConfig,
    setKeepConfig,
    worldInfo,
    backupFile,
    markBackupCloud,
    clearBackupCloud,
    patchBackup,
    wantedInCloud,
    cloudPlan,
    onlineLimit,
    setOnlineCap,
    deleteBackup,
    addBackupFromZip,
    onBackupsPruned: (fn) => {
      pruneListener = fn;
    },
    setWorldBackup,
    restoreBackup,
    restoreFromZip,
    importFromZip,
    setWorldVersion,
    afterGame,
    updateCheck,
    updateVersion,
    guardBeforeLaunch,
    setModsFor,
    scanImportable,
    importWorlds,
    registerImported,
    listWorldsDirty,
    versionForWorld,
    defaultMinecraftSaves,
  };
}

// Quick Play (ouvrir directement un monde) : Minecraft 1.20 et plus (23w14a).
function supportsQuickPlay(minecraftVersion) {
  const m = /^1\.(\d+)(?:\.(\d+))?$/.exec(minecraftVersion || "");
  if (m) return Number(m[1]) >= 20;
  const snap = /^(\d\d)w(\d\d)[a-z]$/.exec(minecraftVersion || "");
  if (snap) return Number(snap[1]) > 23 || (Number(snap[1]) === 23 && Number(snap[2]) >= 14);
  // Nouveau format de numéro (26.x…) : récent.
  return /^\d{2}\.\d/.test(minecraftVersion || "");
}

module.exports = { createPlayMode, supportsQuickPlay, planBackups, LOCAL_KEEP, DEFAULT_KEEP, ONLINE_MAX };
