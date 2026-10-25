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
const { writeZip, extractZip } = require("./zipStream");
const { readLevelDat } = require("./levelDat");

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
function planBackups(list, cfg) {
  const keep = [];
  const drop = [];
  const lastRestore = list.find((b) => b.reason === "before-restore");
  let n = 0;
  let used = 0;
  list.forEach((b, i) => {
    const size = Number(b.sizeBytes) || 0;
    // Protégée (nommée, ou la dernière « avant restauration ») : jamais supprimée, mais elle compte
    // dans le nombre et la place (une limite de 10 = 10 sauvegardes au total sur le PC).
    if ((cfg.named && b.label) || b === lastRestore) {
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
  const SAVES = path.join(GAME_DIR, "saves");
  const MODS_ROOT = path.join(PLAY_ROOT, "mods");
  const BACKUPS = path.join(PLAY_ROOT, "backups");
  const STATE_FILE = path.join(PLAY_ROOT, "play.json");

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
  async function saveState() {
    await fsp.mkdir(PLAY_ROOT, { recursive: true });
    await fsp.writeFile(`${STATE_FILE}.part`, JSON.stringify(state, null, 2));
    await fsp.rename(`${STATE_FILE}.part`, STATE_FILE);
  }
  function worldState(key) {
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
    return loadState().versions.map((v) => ({ ...v, files: undefined, modCount: (v.files || []).length }));
  }
  function getVersion(id) {
    return loadState().versions.find((v) => v.id === id) || null;
  }

  // `pack` : version publiée d'un pack officiel, telle que renvoyée par le site
  // (/api/public/play/packs), ou null pour Vanilla.
  async function createVersion({ minecraftVersion, pack = null, name = "" }) {
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
  async function renameVersion(id, name) {
    const v = getVersion(id);
    if (!v) return false;
    v.name = String(name || "").trim().slice(0, 60);
    await saveState();
    return true;
  }
  // Retire une version : ses mods sont supprimés, jamais les mondes (dossier commun).
  async function removeVersion(id) {
    const s = loadState();
    const at = s.versions.findIndex((v) => v.id === id);
    if (at < 0) return false;
    s.versions.splice(at, 1);
    await saveState();
    if (VERSION_ID_PATTERN.test(id)) await fsp.rm(path.join(MODS_ROOT, id), { recursive: true, force: true });
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
  async function prepareVersion(id, { deps, onProgress = () => {}, signal, waitIfPaused, javaPreferred }) {
    const v = getVersion(id);
    if (!v) throw new Error("Cette version n'existe plus dans Mes versions.");
    await fsp.mkdir(SAVES, { recursive: true });
    const versionsDir = path.join(gameRoot, "versions");
    onProgress({ step: "java" });
    const vanilla = await deps.ensureVanillaVersion(versionsDir, v.minecraftVersion);
    const javaPath = await deps.ensureJavaForMajor(vanilla.javaVersion?.majorVersion ?? 8, {
      preferredPath: javaPreferred,
      onProgress: (text) => onProgress({ text }),
    });
    if (!v.pack) return { minecraftVersion: v.minecraftVersion, customVersion: null, jvmArgs: [], javaPath, gameDirectory: GAME_DIR };

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
    const file = backupIndexFile(key);
    await fsp.writeFile(`${file}.part`, JSON.stringify(list, null, 2));
    await fsp.rename(`${file}.part`, file);
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
  async function scanWorlds() {
    const s = loadState();
    let dirs = [];
    try {
      dirs = (await fsp.readdir(SAVES, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith(".omni-"));
    } catch {
      return [];
    }
    const seen = new Set();
    const worlds = [];
    let changed = false;
    for (const d of dirs) {
      const dir = path.join(SAVES, d.name);
      const levelPath = path.join(dir, "level.dat");
      let levelStat;
      try {
        levelStat = await fsp.stat(levelPath);
      } catch {
        continue;
      }
      let key = await readWorldKey(dir);
      // Monde copié à la main dans le jeu : même clé que l'original, on lui en donne une nouvelle.
      if (!key || seen.has(key)) {
        key = crypto.randomUUID();
        await writeWorldKey(dir, key).catch(() => {});
        changed = true;
      }
      seen.add(key);
      const ws = worldState(key);
      ws.folder = d.name;
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
      worlds.push({
        key,
        folder: d.name,
        name: level.name || d.name,
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
        icon: await iconDataUrl(dir),
        cloud: ws.cloud || null,
      });
    }
    if (changed) await saveState();
    worlds.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return worlds;
  }
  // Monde ouvert dans le jeu en ce moment : Minecraft réécrit session.lock à l'ouverture d'un monde.
  // On prend le plus récent, ouvert depuis `sinceMs` (début de la partie ou dernière entrée dans
  // un monde lue dans le journal du jeu).
  async function openWorld(sinceMs) {
    let dirs = [];
    try {
      dirs = (await fsp.readdir(SAVES, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith(".omni-"));
    } catch {
      return null;
    }
    let best = null;
    for (const d of dirs) {
      const dir = path.join(SAVES, d.name);
      const stat = await fsp.stat(path.join(dir, "session.lock")).catch(() => null);
      if (!stat || stat.mtimeMs < sinceMs - 5_000) continue;
      if (!best || stat.mtimeMs > best.mtimeMs) best = { dir, folder: d.name, mtimeMs: stat.mtimeMs };
    }
    if (!best) return null;
    const key = await readWorldKey(best.dir);
    if (!key) return null;
    const level = (await readLevelDat(path.join(best.dir, "level.dat")).catch(() => null)) || {};
    const ws = worldState(key);
    return { key, folder: best.folder, name: level.name || best.folder, backup: ws.backup !== false };
  }
  // Infos d'un monde (même forme que openWorld), pour la sauvegarde en jeu.
  async function worldInfo(key) {
    const found = await worldDir(key);
    if (!found) return null;
    return { key, folder: found.world.folder, name: found.world.name, backup: worldState(key).backup !== false };
  }
  async function worldDir(key) {
    const worlds = await listWorlds();
    const w = worlds.find((x) => x.key === key);
    return w ? { world: w, dir: path.join(SAVES, w.folder) } : null;
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

  async function backupWorld(key, { reason = "auto", label = null, force = false, live = false, onProgress } = {}) {
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
    const optionsFile = path.join(GAME_DIR, "options.txt");
    if (fs.existsSync(optionsFile)) extra.push({ abs: optionsFile, rel: `${META_DIR}/options.txt`, mtimeMs: createdAt.getTime() });
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
    };
    list.unshift(entry);
    await pruneBackups(key, list);
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
  async function pruneBackups(key, list) {
    const { keep, drop } = planBackups(list, keepConfig(key));
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
  const CLOUD_GAME_REASONS = new Set(["auto", "world-exit", "named", "manual", "import"]);
  function wantedInCloud(b) {
    if (b.cloudDropped) return false; // retirée du cloud (limite en ligne ou ✕) : reste sur le PC
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
    worldState(key).backup = !!on;
    await saveState();
    if (!on && deleteExisting) await fsp.rm(path.join(BACKUPS, key), { recursive: true, force: true });
    return { ok: true };
  }

  // Remplace le monde par une sauvegarde. Une sauvegarde « avant restauration » est faite
  // d'abord : la version actuelle n'est jamais perdue.
  async function restoreFromZip(key, zipFile) {
    const found = await worldDir(key);
    if (!found) throw new Error("Monde introuvable.");
    const { dir, world } = found;
    await backupWorld(key, { reason: "before-restore", force: true });
    const tmp = path.join(SAVES, `.omni-restore-${crypto.randomBytes(4).toString("hex")}`);
    const old = path.join(SAVES, `.omni-old-${crypto.randomBytes(4).toString("hex")}`);
    let meta = null;
    try {
      await extractZip(zipFile, tmp);
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
      target = path.join(SAVES, await uniqueFolder(name || taken?.meta?.name || "Monde"));
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
    await fsp.rm(path.join(BACKUPS, key, path.basename(b.file)), { force: true });
    await writeBackups(key, list.filter((x) => x !== b));
    return b;
  }
  async function restoreBackup(key, backupId) {
    const b = (await readBackups(key)).find((x) => x.id === backupId);
    if (!b) throw new Error("Sauvegarde introuvable.");
    return restoreFromZip(key, backupFile(key, b));
  }

  // Après une partie : les mondes modifiés retiennent la version jouée, puis sont sauvegardés
  // (le jeu est fermé, plus rien n'écrit dedans). Renvoie les sauvegardes créées (pour le cloud).
  async function afterGame(versionId, startedAt) {
    const worlds = await listWorlds();
    const created = [];
    for (const w of worlds) {
      if (!w.lastPlayed || w.lastPlayed < startedAt - 5_000) continue;
      const ws = worldState(w.key);
      // Seulement un monde vraiment ouvert avec cette version (le jeu réécrit sa version dans
      // level.dat) : un monde juste copié ou importé pendant la partie garde la sienne.
      const played = versionId ? getVersion(versionId) : null;
      if (played && (!w.minecraftVersion || w.minecraftVersion === played.minecraftVersion)) ws.lastVersionId = versionId;
      if (w.minecraftVersion) ws.minecraftVersion = w.minecraftVersion;
      if (ws.backup === false) continue;
      try {
        const r = await backupWorld(w.key, { reason: "auto" });
        if (r.backup) created.push({ key: w.key, backup: r.backup });
      } catch (error) {
        created.push({ key: w.key, error: error instanceof Error ? error.message : String(error) });
      }
    }
    await saveState();
    return created;
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
      worlds.push({ folder: d.name, name: level.name || d.name, minecraftVersion: level.version, lastPlayed: level.lastPlayed, sizeBytes: bytes, icon: await iconDataUrl(dir) });
    }
    worlds.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return { dir: base, worlds };
  }
  async function uniqueFolder(name) {
    const clean = String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").slice(0, 60) || "Monde";
    let candidate = clean;
    for (let i = 2; fs.existsSync(path.join(SAVES, candidate)); i++) candidate = `${clean} (${i})`;
    return candidate;
  }
  async function importWorlds(fromDir, folders) {
    const base = fromDir || defaultMinecraftSaves();
    await fsp.mkdir(SAVES, { recursive: true });
    const done = [];
    for (const folder of folders) {
      if (typeof folder !== "string" || folder.includes("/") || folder.includes("\\") || folder === ".." || folder === ".") continue;
      const src = path.join(base, folder);
      if (!fs.existsSync(path.join(src, "level.dat"))) continue;
      const target = path.join(SAVES, await uniqueFolder(folder));
      // Copie (jamais de déplacement) : le monde d'origine reste intact dans .minecraft.
      await fsp.cp(src, target, { recursive: true, errorOnExist: true, force: false, filter: (p) => path.basename(p) !== "session.lock" });
      const key = crypto.randomUUID();
      await writeWorldKey(target, key);
      const level = await readLevelDat(path.join(target, "level.dat"));
      const ws = worldState(key);
      ws.backup = true;
      ws.imported = true;
      ws.minecraftVersion = level?.version || null;
      done.push({ key, folder: path.basename(target), name: level?.name || folder });
    }
    await saveState();
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
    if (!mc) {
      const chosen = pick ? getVersion(pick) : last;
      if (chosen) return { versionId: chosen.id, world };
      throw Object.assign(new Error("La version de Minecraft de ce monde n'a pas pu être lue : choisis avec quelle version l'ouvrir."), { code: "chooseVersion", worldName: world.name });
    }
    const same = versions.filter((v) => v.minecraftVersion === mc);
    const chosen =
      same.find((v) => v.id === pick) ||
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

  return {
    PLAY_ROOT,
    GAME_DIR,
    SAVES,
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
    scanImportable,
    importWorlds,
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
