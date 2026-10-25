// Installation d'un modpack (CurseForge ou Modrinth) pour un serveur moddé :
// telecharge le modpack, ses mods et ses fichiers de config dans une instance
// propre au serveur, installe le chargeur de mods (NeoForge / Forge / Fabric / Quilt) et prepare
// la version a lancer avec minecraft-launcher-core.
//
// Node pur (aucune dependance a Electron) pour pouvoir etre teste en ligne de
// commande. Le site donne le fichier du modpack (GET /api/launcher/servers/[slug]/modpack).
// CurseForge : la cle reste sur le site, qui fournit aussi les liens de
// telechargement des mods (POST /api/launcher/curseforge/files). Modrinth : le
// fichier .mrpack liste lui-meme chaque fichier avec son lien et ses empreintes,
// le launcher n'a besoin d'aucune cle.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const AdmZip = require("adm-zip");

const MOD_DOWNLOAD_CONCURRENCY = 6;
const FILE_INFO_BATCH = 100;
const INSTALLER_TIMEOUT_MS = 15 * 60 * 1000;
const STATE_FILE = ".omniscient-modpack.json";
// Meme regle que INSTANCE_SLUG_RE dans main.js : le slug devient un nom de dossier
// (instances/<slug>), jamais pris tel quel (audit 25/10).
const INSTANCE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

// Hotes autorises pour les fichiers d'un .mrpack (specification Modrinth) : un
// modpack ne doit pas pouvoir nous faire telecharger depuis n'importe quel serveur.
const MRPACK_ALLOWED_HOSTS = new Set(["cdn.modrinth.com", "github.com", "raw.githubusercontent.com", "gitlab.com"]);
// Fichier du modpack lui-meme et mods CurseForge (audit 25/10) : le site ne fait que relayer les
// liens de l'API CurseForge (CDN *.forgecdn.net : edge., mediafilez.) ou Modrinth
// (cdn.modrinth.com) — jamais un fichier heberge par le site Omniscient. Toujours en https.
function isAllowedModpackUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return url.hostname === "cdn.modrinth.com" || url.hostname.endsWith(".forgecdn.net");
  } catch {
    return false;
  }
}

// Plus aucune donnee recue pendant ce delai : le telechargement est coupe puis reessaye. Pas de
// delai total (audit 25/10) : un gros fichier sur une connexion lente doit pouvoir aboutir.
const DOWNLOAD_IDLE_TIMEOUT_MS = 60_000;

class ModpackError extends Error {
  constructor(message, { code, manualMods } = {}) {
    super(message);
    this.name = "ModpackError";
    this.code = code || "modpack_error";
    // Mods que CurseForge ne permet pas d'installer automatiquement.
    this.manualMods = manualMods || [];
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Utilitaires -----------------------------------------------------------

async function siteJson(config, pathname, init = {}) {
  const res = await fetch(`${config.siteUrl}${pathname}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(20_000),
    headers: {
      // Identite du joueur (X-Launcher-Session ou X-Minecraft-Token) : exigee par
      // les routes CurseForge du site depuis le point 3 de la securite.
      ...config.headers,
      ...init.headers,
      Authorization: `Bearer ${config.apiKey}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ModpackError(data.error || `Le site a répondu ${res.status}.`, { code: data.code || "site_error" });
  }
  return data;
}

async function sha1File(file) {
  const hash = crypto.createHash("sha1");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
}

// Chemin a l'interieur de `base` uniquement : un zip malveillant ne doit pas
// pouvoir ecrire ailleurs via des entrees "../" ("zip slip").
function safeJoin(base, relative) {
  const root = path.resolve(base);
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new ModpackError(`Entrée de modpack refusée (chemin hors du dossier) : ${relative}`, { code: "unsafe_path" });
  }
  return target;
}

// Verrou par destination : un meme fichier peut etre demande par deux installations
// concurrentes (cache de modpack partage entre deux serveurs utilisant le meme fichier,
// voir installModpack ci-dessous pour le verrou par instance) — sans ca, deux fetch ecrivaient
// vers le MEME ".part" et s'entremelaient au niveau OS sans que le SHA-1/compteur (calcules en
// memoire a partir des seuls octets ecrits par CE process) ne le detectent (course trouvee par
// l'audit du 2026-10-10).
const downloadFileLocks = new Map();

function downloadFile(url, destPath, options) {
  const existing = downloadFileLocks.get(destPath);
  if (existing) return existing;
  const promise = downloadFileLocked(url, destPath, options).finally(() => downloadFileLocks.delete(destPath));
  downloadFileLocks.set(destPath, promise);
  return promise;
}

// Telecharge vers `destPath` (fichier .part puis renommage) en verifiant la
// taille et les empreintes SHA-1 / SHA-512 quand elles sont connues, avec 3 essais.
// `signal` (2026-10-11, gestionnaire de telechargements) : annulation
// volontaire (bouton Annuler) — jamais reessayee, contrairement a une vraie
// erreur reseau. `onBytes` : octets reçus pour CE fichier depuis le dernier
// appel, pour la progression/vitesse affichees dans le panneau.
async function downloadFileLocked(url, destPath, { sha1, sha512, size, signal, onBytes } = {}) {
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  const partPath = `${destPath}.part`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (signal?.aborted) throw new DOMException("Téléchargement annulé.", "AbortError");
    // Delai d'inactivite, rearme a chaque morceau recu (voir DOWNLOAD_IDLE_TIMEOUT_MS).
    const idle = new AbortController();
    let idleTimer = null;
    const armIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => idle.abort(), DOWNLOAD_IDLE_TIMEOUT_MS);
    };
    try {
      armIdle();
      const res = await fetch(url, { signal: signal ? AbortSignal.any([idle.signal, signal]) : idle.signal });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const hash = crypto.createHash("sha1");
      const hash512 = sha512 ? crypto.createHash("sha512") : null;
      let received = 0;
      const source = Readable.fromWeb(res.body);
      source.on("data", (chunk) => {
        armIdle();
        hash.update(chunk);
        hash512?.update(chunk);
        received += chunk.length;
        onBytes?.(chunk.length);
      });
      await pipeline(source, fs.createWriteStream(partPath));
      if (size && received !== size) throw new Error(`taille reçue ${received} au lieu de ${size}`);
      if (sha1 && hash.digest("hex") !== sha1.toLowerCase()) throw new Error("empreinte SHA-1 différente de celle attendue");
      if (hash512 && hash512.digest("hex") !== sha512.toLowerCase()) throw new Error("empreinte SHA-512 différente de celle attendue");
      await fsp.rename(partPath, destPath);
      return;
    } catch (error) {
      lastError = idle.signal.aborted && !signal?.aborted
        ? new Error(`aucune donnée reçue pendant ${DOWNLOAD_IDLE_TIMEOUT_MS / 1000} s`)
        : error;
      await fsp.rm(partPath, { force: true });
      if (error?.name === "AbortError" && signal?.aborted) throw error; // annulation volontaire : jamais de reessai
      if (attempt < 3) await sleep(600 * attempt);
    } finally {
      clearTimeout(idleTimer);
    }
  }
  throw new ModpackError(`Téléchargement impossible (${path.basename(destPath)}) : ${lastError.message}`, {
    code: "download_failed",
  });
}

async function fileMatches(file, { sha1, size }) {
  try {
    const stat = await fsp.stat(file);
    if (size && stat.size !== size) return false;
    if (sha1) return (await sha1File(file)) === sha1.toLowerCase();
    return true;
  } catch {
    return false;
  }
}

// Etat ecrit par l'installation precedente de cette instance (null a la
// premiere installation, ou si le fichier est illisible/ancien format).
async function readInstalledState(instanceDir) {
  try {
    const state = JSON.parse(await fsp.readFile(path.join(instanceDir, STATE_FILE), "utf8"));
    if (Array.isArray(state.files)) return state;
    if (Array.isArray(state.mods)) return { ...state, files: state.mods.map((name) => `mods/${name}`) }; // ancien format
  } catch {
    // premiere installation
  }
  return null;
}

// Un serveur donne a-t-il deja un modpack installe ? (2026-10-11, bouton
// "Installer" — n'a plus besoin de s'afficher une fois fait, pour CE serveur
// precis seulement.) Meme fichier d'etat que readInstalledState ci-dessus,
// juste sans avoir besoin de le parser entierement.
async function isInstalled(gameRoot, slug) {
  if (typeof slug !== "string" || !INSTANCE_SLUG_RE.test(slug)) return false;
  try {
    await fsp.access(path.join(gameRoot, "instances", slug, STATE_FILE));
    return true;
  } catch {
    return false;
  }
}

// Instances deja presentes sur CE disque (2026-10-12, jouer en solo hors
// ligne) : utilisee quand il n'y a pas de session Microsoft active (donc pas
// moyen d'interroger /api/launcher/servers/mine) — scanne directement
// instances/<slug>/ plutot que d'attendre une reponse du site. Un dossier
// moddé a son STATE_FILE (readInstalledState ci-dessus) ; un serveur vanilla
// "juste prepare" (bouton Installer, voir prepareServerFiles) a son
// ".omniscient-ready.json" a la place — un dossier qui n'a ni l'un ni
// l'autre (telechargement interrompu avant le premier etat ecrit, ou dossier
// residuel) est simplement ignore plutot que de planter la liste entiere.
async function listInstalledInstances(gameRoot) {
  const instancesDir = path.join(gameRoot, "instances");
  let entries;
  try {
    entries = await fsp.readdir(instancesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const instanceDir = path.join(instancesDir, slug);

    const state = await readInstalledState(instanceDir);
    if (state) {
      out.push({
        slug,
        type: "modded",
        minecraftVersion: state.minecraftVersion,
        loaderId: state.loaderId,
        modpackName: state.modpackName || null,
      });
      continue;
    }

    try {
      const ready = JSON.parse(await fsp.readFile(path.join(instanceDir, ".omniscient-ready.json"), "utf8"));
      out.push({ slug, type: "vanilla", minecraftVersion: ready.minecraftVersion, modpackName: null });
    } catch {
      // Ni modpack installe ni vanilla pret pour ce dossier : rien a proposer hors ligne.
    }
  }
  return out;
}

// --- Formats de modpack -----------------------------------------------------

// Un "pack" decrit ce qu'il faut installer, quel que soit le format d'origine :
// { minecraftVersion, loaderId, overrideDirs, resolveFiles({ config, onProgress }) }.
// resolveFiles renvoie la liste des fichiers a telecharger :
// [{ path (relatif a l'instance), url, sha1, size }].

function readCurseforgePack(zip) {
  const entry = zip.getEntry("manifest.json");
  if (!entry) throw new ModpackError("Ce fichier n'est pas un modpack CurseForge (manifest.json introuvable).");
  const manifest = JSON.parse(zip.readAsText(entry));
  if (manifest.manifestType !== "minecraftModpack" || !manifest.minecraft?.version || !Array.isArray(manifest.files)) {
    throw new ModpackError("Manifeste de modpack illisible ou incomplet.");
  }
  const loaders = manifest.minecraft.modLoaders || [];
  return {
    minecraftVersion: manifest.minecraft.version,
    loaderId: (loaders.find((l) => l.primary) || loaders[0])?.id || null,
    overrideDirs: [manifest.overrides || "overrides"],
    resolveFiles: ({ config, onProgress, instanceDir, manualSearchDirs }) =>
      resolveCurseforgeFiles({ config, manifest, onProgress, instanceDir, manualSearchDirs }),
  };
}

// Format .mrpack de Modrinth : modrinth.index.json + dossiers overrides/ (tous
// les cotes) et client-overrides/ (client seulement).
function readModrinthPack(zip) {
  const entry = zip.getEntry("modrinth.index.json");
  if (!entry) throw new ModpackError("Ce fichier n'est pas un modpack Modrinth (modrinth.index.json introuvable).");
  const index = JSON.parse(zip.readAsText(entry));
  if (index.formatVersion !== 1 || index.game !== "minecraft" || !Array.isArray(index.files) || !index.dependencies?.minecraft) {
    throw new ModpackError("Index de modpack Modrinth illisible ou incomplet.");
  }
  const dependencies = index.dependencies;
  const loaderKey = ["neoforge", "forge", "fabric-loader", "quilt-loader"].find((key) => dependencies[key]);
  const loaderPrefix = { neoforge: "neoforge", forge: "forge", "fabric-loader": "fabric", "quilt-loader": "quilt" }[loaderKey];
  return {
    minecraftVersion: dependencies.minecraft,
    loaderId: loaderKey ? `${loaderPrefix}-${dependencies[loaderKey]}` : null,
    overrideDirs: ["overrides", "client-overrides"],
    resolveFiles: async () => resolveModrinthFiles(index),
  };
}

function resolveModrinthFiles(index) {
  const entries = [];
  for (const file of index.files) {
    if (file.env?.client === "unsupported") continue; // mod serveur uniquement
    const url = (file.downloads || []).find((candidate) => {
      try {
        const parsed = new URL(candidate);
        return parsed.protocol === "https:" && MRPACK_ALLOWED_HOSTS.has(parsed.hostname);
      } catch {
        return false;
      }
    });
    if (!url) {
      throw new ModpackError(`Le fichier "${file.path}" du modpack se télécharge depuis un site non autorisé.`, {
        code: "disallowed_download_host",
      });
    }
    // SHA-512 : toujours donne par un .mrpack conforme, verifie au telechargement en plus du SHA-1.
    entries.push({ path: file.path, url, sha1: file.hashes?.sha1 || null, sha512: file.hashes?.sha512 || null, size: file.fileSize || null });
  }
  return entries;
}

// CurseForge : les liens de telechargement des mods sont demandes au site, qui
// garde la cle. Un mod sans lien (auteur qui interdit le telechargement par les
// autres launchers, "allowModDistribution" faux) ne peut pas etre telecharge par nous.
// Le joueur peut le recuperer lui-meme (14/10, demande de Rushi, comme Prism ou
// ATLauncher) : il le telecharge depuis la page du mod et le laisse dans son dossier
// Telechargements (`manualSearchDirs`), ou il est retrouve ici par sa taille puis son
// empreinte SHA-1, et copie dans mods/. L'original reste dans Telechargements (audit 25/10 :
// avant, il y etait efface sans rien demander au joueur). Ce qui manque encore fait echouer
// l'installation avec la liste de ces mods (code "manual_mods"), affichee par le launcher.
// Pas de lien de repli vers le CDN de CurseForge : il contournerait le choix de l'auteur.
async function resolveCurseforgeFiles({ config, manifest, onProgress, instanceDir, manualSearchDirs = [] }) {
  onProgress({ text: "Récupération de la liste des mods…" });
  const wantedIds = manifest.files.map((f) => f.fileID);
  const infos = new Map();
  for (let i = 0; i < wantedIds.length; i += FILE_INFO_BATCH) {
    const data = await siteJson(config, "/api/launcher/curseforge/files", {
      method: "POST",
      body: JSON.stringify({ fileIds: wantedIds.slice(i, i + FILE_INFO_BATCH) }),
    });
    for (const file of data.files) infos.set(file.id, file);
  }

  const entries = [];
  const blocked = [];
  const manualMods = [];
  for (const fileId of wantedIds) {
    const info = infos.get(fileId);
    if (!info) {
      manualMods.push({ fileId, modId: null, modName: null, fileName: null, pageUrl: null, reason: "removed" });
      continue;
    }
    const entry = { path: `mods/${path.basename(info.fileName)}`, url: info.downloadUrl, sha1: info.sha1, size: info.fileLength };
    if (info.downloadUrl && !isAllowedModpackUrl(info.downloadUrl)) {
      throw new ModpackError(`Le mod "${info.fileName}" du modpack se télécharge depuis un site non autorisé.`, {
        code: "disallowed_download_host",
      });
    }
    if (info.downloadUrl) entries.push(entry);
    else blocked.push({ info, entry });
  }

  if (blocked.length && instanceDir) {
    const found = await findManualFiles(blocked, { instanceDir, searchDirs: manualSearchDirs });
    if (found > 0) onProgress({ text: `${found} mod(s) ajouté(s) à la main retrouvé(s) et copié(s) dans le jeu.` });
  }
  const fromModrinth = await findOnModrinth(blocked.filter((item) => !item.ready));
  if (fromModrinth > 0) onProgress({ text: `${fromModrinth} mod(s) récupéré(s) sur Modrinth.` });
  for (const { info, entry, ready } of blocked) {
    if (ready) entries.push(entry);
    else {
      manualMods.push({
        fileId: info.id,
        modId: info.modId,
        modName: typeof info.modName === "string" ? info.modName : null,
        fileName: info.fileName,
        pageUrl: safeCurseforgeUrl(info.pageUrl) || curseforgeProjectUrl(info.modId),
        reason: "blocked",
      });
    }
  }

  if (manualMods.length) {
    throw new ModpackError(
      `${manualMods.length} mod(s) du modpack ne peuvent pas être installés automatiquement : ${manualMods
        .map((m) => m.modName || m.fileName || `fichier ${m.fileId}`)
        .join(", ")}.`,
      { code: "manual_mods", manualMods, fromModrinth },
    );
  }
  return entries;
}

// Mods bloques sur CurseForge que leur auteur publie aussi sur Modrinth (16/10, demande de Rushi) :
// on cherche sur Modrinth le fichier qui a EXACTEMENT la meme empreinte SHA-1 et la meme taille
// que celui du modpack. C'est donc le meme fichier, octet pour octet, pris sur un site ou il est
// distribue avec l'accord de son auteur : on ne contourne pas le choix fait sur CurseForge, et une
// autre version (ou une copie modifiee par un tiers) n'est jamais prise a la place. Le
// telechargement reverifie taille et SHA-1 (downloadFile). Modrinth injoignable = on retombe
// simplement sur la fenetre des mods a ajouter a la main.
// Marque `ready` sur chaque mod trouve (avec son lien Modrinth) et renvoie leur nombre.
const MODRINTH_API = "https://api.modrinth.com/v2";
const MODRINTH_USER_AGENT = "Omniscient-Launcher (app.omniscient.launcher)";

async function findOnModrinth(items) {
  const wanted = items.filter((item) => /^[0-9a-f]{40}$/i.test(item.entry.sha1 || "") && item.entry.size);
  if (!wanted.length) return 0;
  let versions;
  try {
    const res = await fetch(`${MODRINTH_API}/version_files`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": MODRINTH_USER_AGENT },
      body: JSON.stringify({ hashes: wanted.map((item) => item.entry.sha1.toLowerCase()), algorithm: "sha1" }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return 0;
    versions = await res.json();
  } catch {
    return 0;
  }
  let found = 0;
  for (const item of wanted) {
    const sha1 = item.entry.sha1.toLowerCase();
    const file = versions?.[sha1]?.files?.find((f) => f?.hashes?.sha1?.toLowerCase() === sha1 && f.size === item.entry.size);
    let url;
    try {
      url = new URL(file?.url);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.hostname !== "cdn.modrinth.com") continue;
    item.entry.url = url.href;
    if (/^[0-9a-f]{128}$/i.test(file.hashes?.sha512 || "")) item.entry.sha512 = file.hashes.sha512;
    item.ready = true;
    found++;
  }
  return found;
}

// Seules les pages du site de CurseForge sont ouvertes depuis la liste des mods bloques.
// Repli quand le site ne donne pas la page exacte du fichier (site en ligne pas encore a jour) :
// https://www.curseforge.com/projects/<id du projet> redirige vers la page du mod. L'id vient du
// manifeste, donc c'est toujours le bon mod, contrairement a une recherche par nom (plusieurs
// mods peuvent porter le meme nom). On ouvre seulement la page : le joueur telecharge lui-meme.
function curseforgeProjectUrl(modId) {
  return Number.isInteger(modId) && modId > 0 ? `https://www.curseforge.com/projects/${modId}` : null;
}

function safeCurseforgeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.curseforge.com" ? url.href : null;
  } catch {
    return null;
  }
}

// Mods bloques deja presents (dans mods/ de l'instance, ou deposes par le joueur dans un
// des dossiers `searchDirs`) : un fichier n'est accepte que si sa taille ET son empreinte
// SHA-1 sont celles annoncees par CurseForge — sans les deux, il n'est jamais copie. Seuls les
// .jar/.zip de la bonne taille sont lus, rien d'autre du dossier Telechargements.
// Copie seulement (audit 25/10) : le launcher n'efface ni ne deplace jamais rien dans le dossier
// Telechargements du joueur. Copie vers un .part puis renommage, verifiee ensuite.
// Marque `ready` sur chaque mod retrouve et renvoie combien ont ete copies depuis searchDirs.
async function findManualFiles(blocked, { instanceDir, searchDirs }) {
  let copied = 0;
  const pending = [];
  for (const item of blocked) {
    const { sha1, size } = item.entry;
    if (!sha1 || !size) continue;
    item.target = safeJoin(instanceDir, item.entry.path);
    if (await fileMatches(item.target, { sha1, size })) item.ready = true;
    else pending.push(item);
  }
  if (!pending.length) return 0;

  const bySize = new Map();
  for (const item of pending) {
    if (!bySize.has(item.entry.size)) bySize.set(item.entry.size, []);
    bySize.get(item.entry.size).push(item);
  }
  for (const dir of searchDirs) {
    let dirents;
    try {
      dirents = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const dirent of dirents) {
      if (!dirent.isFile() || !/\.(jar|zip)$/i.test(dirent.name)) continue;
      const candidate = path.join(dir, dirent.name);
      let stat;
      try {
        stat = await fsp.stat(candidate);
      } catch {
        continue;
      }
      const sameSize = (bySize.get(stat.size) || []).filter((item) => !item.ready);
      if (!sameSize.length) continue;
      let hash;
      try {
        hash = await sha1File(candidate);
      } catch {
        continue;
      }
      const match = sameSize.find((item) => item.entry.sha1.toLowerCase() === hash);
      if (!match) continue;
      await fsp.mkdir(path.dirname(match.target), { recursive: true });
      await fsp.copyFile(candidate, `${match.target}.part`);
      await fsp.rename(`${match.target}.part`, match.target);
      // Copie relue : un fichier modifie entre-temps n'est pas compte comme retrouve.
      if (!(await fileMatches(match.target, { sha1: match.entry.sha1, size: match.entry.size }))) {
        await fsp.rm(match.target, { force: true }).catch(() => {});
        continue;
      }
      match.ready = true;
      copied++;
    }
  }
  return copied;
}

// Copie un dossier "overrides" du modpack (configs, etc.) dans l'instance.
// options.txt est laisse tel quel s'il existe deja : ce sont les reglages du
// joueur (touches, video), pas ceux du modpack.
// Renvoie { count, jars } : `jars` = les mods (.jar sous mods/) livres dans
// l'archive elle-meme, a suivre comme les mods telecharges — sinon, en
// changeant de modpack ou de version, ils resteraient orphelins dans mods/.
// Fichiers du pack (configs, options, mods livrés dans les overrides). Règles :
// - absent : copié ;
// - options.txt existant : jamais réécrit ;
// - modifié par le joueur (son empreinte ne correspond plus à celle installée),
//   ou inconnu de l'installation précédente : gardé tel quel ;
// - non modifié et changé dans le pack : mis à jour.
// `previousHashes` / `nextHashes` : empreintes (SHA-1) des fichiers installés.
async function extractOverrides(zip, dirName, instanceDir, previousHashes, nextHashes) {
  const prefix = `${dirName}/`;
  let count = 0;
  const jars = [];
  const kept = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.startsWith(prefix)) continue;
    // Zip fabrique sous Windows avec des "\\" dans les noms : Windows les lit comme
    // des separateurs, Linux en ferait un nom de fichier. On aligne Linux sur Windows.
    const rawRelative = entry.entryName.slice(prefix.length);
    const relative = process.platform === "win32" ? rawRelative : rawRelative.replace(/\\/g, "/");
    if (!relative) continue;
    const target = safeJoin(instanceDir, relative);
    const isJar = /^mods\/.+\.jar$/i.test(relative);
    if (isJar) jars.push(relative);
    const data = entry.getData();
    const packHash = crypto.createHash("sha1").update(data).digest("hex");

    if (fs.existsSync(target)) {
      const currentHash = await sha1File(target);
      const installedHash = previousHashes[relative];
      const untouched = installedHash && currentHash === installedHash;
      if (relative === "options.txt" || !untouched) {
        // Trace toujours la base de comparaison avec ce qui est REELLEMENT sur
        // disque (currentHash), meme quand l'installation precedente ne
        // connaissait pas ce fichier (installedHash absent : premiere
        // installation, ancien format d'etat...) — sinon ce fichier ne redevient
        // jamais traçable aux installations suivantes (trouve par l'audit du
        // 2026-10-10, point mineur).
        nextHashes[relative] = installedHash || currentHash;
        if (relative !== "options.txt" && installedHash) kept.push(relative);
        continue;
      }
      if (currentHash === packHash) {
        nextHashes[relative] = packHash;
        continue;
      }
    }

    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, data);
    nextHashes[relative] = packHash;
    count++;
  }
  return { count, jars, kept };
}

// --- Fichiers du modpack (mods, packs de ressources...) ---------------------

// Telecharge les fichiers (6 en parallele, taille et empreinte verifiees,
// fichiers deja corrects laisses tels quels) et supprime ceux que la version
// precedente du modpack avait installes et que celle-ci n'a plus (sinon deux
// versions du meme mod se retrouvent dans mods/). Les fichiers ajoutes a la
// main par le joueur ne sont jamais touches. `keepPaths` : fichiers deja
// ecrits par cette installation (mods livres dans les overrides), a ne pas
// supprimer meme s'ils figuraient dans la version precedente.
// Renvoie les chemins telecharges.
// `signal`/`waitIfPaused` (2026-10-11, gestionnaire de telechargements) :
// permettent au bouton Annuler/Pause du panneau de taches d'agir au milieu
// d'une installation — modpack.js reste sans dependance a Electron (voir
// l'en-tete du fichier), donc ni l'un ni l'autre ne connait la notion de
// "tache", juste un AbortSignal standard et une fonction a attendre.
async function installFiles({ entries, instanceDir, previousFiles, keepPaths = [], onProgress, signal, waitIfPaused }) {
  const targets = entries.map((entry) => ({ ...entry, target: safeJoin(instanceDir, entry.path) }));
  const totalBytes = targets.reduce((sum, entry) => sum + (entry.size || 0), 0);

  let done = 0;
  let downloadedBytes = 0;
  let failure = null;
  // Chemins reellement telecharges pendant CETTE execution (pas ceux deja
  // corrects avant) : les seuls a supprimer si l'installation est annulee —
  // une mise a jour annulee ne doit jamais abimer l'installation precedente.
  const freshlyDownloaded = [];
  const queue = [...targets];
  const worker = async () => {
    while (queue.length && !failure) {
      if (waitIfPaused) await waitIfPaused();
      if (signal?.aborted) {
        failure = failure || new DOMException("Installation annulée.", "AbortError");
        break;
      }
      const entry = queue.shift();
      try {
        if (!(await fileMatches(entry.target, { sha1: entry.sha1, size: entry.size }))) {
          await downloadFile(entry.url, entry.target, {
            sha1: entry.sha1,
            sha512: entry.sha512,
            size: entry.size,
            signal,
            onBytes: (n) => {
              downloadedBytes += n;
              onProgress({ type: "mods-bytes", bytes: downloadedBytes, totalBytes });
            },
          });
          freshlyDownloaded.push(entry.target);
        }
        done++;
        onProgress({ text: `Téléchargement des mods : ${done}/${targets.length}`, type: "mods", task: done, total: targets.length, bytes: downloadedBytes, totalBytes });
      } catch (error) {
        failure = failure || error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MOD_DOWNLOAD_CONCURRENCY, targets.length) }, worker));
  if (failure) {
    if (failure.name === "AbortError") {
      await Promise.all(freshlyDownloaded.map((target) => fsp.rm(target, { force: true })));
    }
    throw failure;
  }

  // Tous les nouveaux fichiers sont desormais confirmes presents sur disque
  // (telecharges avec succes, ou deja corrects) : on peut supprimer sans risque
  // les anciens fichiers que cette version du modpack n'utilise plus. Supprimer
  // AVANT le telechargement (comme avant ce correctif) laissait l'instance
  // incomplete — anciens fichiers deja effaces, nouveaux pas encore la — dès
  // qu'un mod echouait apres ses tentatives (trouve par l'audit du 2026-10-10).
  const keep = new Set([...targets.map((entry) => entry.target), ...keepPaths.map((p) => safeJoin(instanceDir, p))]);
  for (const old of previousFiles) {
    const oldTarget = safeJoin(instanceDir, old);
    if (!keep.has(oldTarget)) await fsp.rm(oldTarget, { force: true });
  }

  return entries.map((entry) => entry.path);
}

// --- Chargeur de mods (NeoForge / Forge / Fabric / Quilt) --------------------

// Identifiant de version Maven valide (ex. "1.20.1-47.2.0") : Fabric assainit
// deja loaderVersion/minecraftVersion via encodeURIComponent avant de les
// mettre dans une URL (meta.fabricmc.net) — Forge/NeoForge concatenaient ces
// memes valeurs directement dans un chemin Maven sans aucun controle (trouve
// par l'audit du 2026-10-10, point mineur). Ici on rejette plutot que
// d'encoder : un identifiant de version Maven ne contient normalement que ces
// caracteres, et encoder autoriserait silencieusement une valeur inattendue.
const MAVEN_VERSION_PATTERN = /^[\w.+-]+$/;

// Minecraft avant 1.13 : ancien format de lancement (minecraftArguments, launchwrapper, Java 8),
// pas encore pris en charge (voir prepareLaunchVersion). Teste ici, AVANT tout telechargement :
// sinon le joueur telechargeait tout le pack pour se voir refuser le lancement a la fin.
function isLegacyMinecraft(minecraftVersion) {
  const match = /^1\.(\d+)(?:\.|$)/.exec(minecraftVersion || "");
  return Boolean(match) && Number(match[1]) < 13;
}

function parseLoader(loaderId, minecraftVersion) {
  // Quilt (14/10) : derive de Fabric, meme fonctionnement (profil JSON servi par son API
  // officielle). CurseForge l'ecrit "quilt-<version>", Modrinth "quilt-loader" (voir
  // readModrinthPack, qui donne aussi "quilt-<version>").
  const match = /^(neoforge|forge|fabric|quilt)-(.+)$/.exec(loaderId || "");
  if (!match) {
    throw new ModpackError(
      `Chargeur de mods non pris en charge pour l'instant : ${loaderId || "aucun"} (NeoForge, Forge, Fabric et Quilt seulement).`,
      { code: "unsupported_loader" },
    );
  }
  const [, kind, loaderVersion] = match;
  if (isLegacyMinecraft(minecraftVersion)) {
    throw new ModpackError(
      `Les modpacks pour Minecraft ${minecraftVersion} (avant 1.13) ne sont pas encore pris en charge par le launcher.`,
      { code: "unsupported_legacy" },
    );
  }
  // Fabric aussi (audit 14/10, L2) : sa version servait telle quelle dans un chemin du dossier
  // de jeu. Un pack truque pouvait donner "x/../../instances/<slug>/evil" et faire lire un faux
  // JSON de version (depose par ses propres overrides) avec des arguments Java malveillants.
  if (!MAVEN_VERSION_PATTERN.test(loaderVersion) || !MAVEN_VERSION_PATTERN.test(minecraftVersion || "")) {
    throw new ModpackError(`Version de chargeur invalide : ${loaderId} (Minecraft ${minecraftVersion}).`, { code: "invalid_loader_version" });
  }
  if (kind === "fabric" || kind === "quilt") return { kind, loaderVersion };
  const mavenVersion = kind === "neoforge" ? loaderVersion : `${minecraftVersion}-${loaderVersion}`;
  if (!MAVEN_VERSION_PATTERN.test(mavenVersion)) {
    throw new ModpackError(`Version de chargeur invalide : ${mavenVersion}.`, { code: "invalid_loader_version" });
  }
  const installerUrl =
    kind === "neoforge"
      ? `https://maven.neoforged.net/releases/net/neoforged/neoforge/${mavenVersion}/neoforge-${mavenVersion}-installer.jar`
      : `https://maven.minecraftforge.net/net/minecraftforge/forge/${mavenVersion}/forge-${mavenVersion}-installer.jar`;
  return { kind, installerUrl };
}

// Identifiant de la version que l'installateur va creer (ex. "neoforge-21.1.200"),
// lu dans le jar de l'installateur plutot que devine.
function readInstalledVersionId(installerPath) {
  const zip = new AdmZip(installerPath);
  const profile = zip.getEntry("install_profile.json");
  if (profile) {
    const id = JSON.parse(zip.readAsText(profile)).version;
    if (typeof id === "string" && id) return id;
  }
  const version = zip.getEntry("version.json");
  if (version) return JSON.parse(zip.readAsText(version)).id;
  throw new ModpackError("Installateur du chargeur illisible (version introuvable).");
}

function runInstaller({ javaPath, installerPath, gameRoot, onProgress }) {
  return new Promise((resolve, reject) => {
    const child = spawn(javaPath || "java", ["-jar", installerPath, "--installClient", gameRoot], { cwd: gameRoot });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new ModpackError("L'installation du chargeur de mods a pris trop de temps.", { code: "installer_timeout" }));
    }, INSTALLER_TIMEOUT_MS);
    const collect = (chunk) => {
      output += chunk.toString();
      if (output.length > 200_000) output = output.slice(-100_000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new ModpackError(`Impossible de lancer Java pour installer le chargeur : ${error.message}`, { code: "installer_failed" }));
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0 && /Successfully installed/i.test(output)) return resolve();
      const tail = output.trim().split(/\r?\n/).slice(-3).join(" | ");
      reject(new ModpackError(`L'installation du chargeur de mods a échoué (code ${code}) : ${tail}`, { code: "installer_failed" }));
    });
    onProgress({ text: "Installation du chargeur de mods…" });
  });
}

// Fabric et Quilt n'ont pas d'installateur a lancer : leur API officielle sert directement le
// JSON de version (avec le lien Maven de chaque bibliotheque, que
// minecraft-launcher-core telecharge au lancement). On le pose tel quel.
// Profil Quilt verifie le 14/10 (meta.quiltmc.org) : meme forme que Fabric, id
// "quilt-loader-<version>-<minecraft>", inheritsFrom, arguments.game.
const PROFILE_LOADERS = {
  fabric: { name: "Fabric", prefix: "fabric-loader", meta: "https://meta.fabricmc.net/v2/versions/loader" },
  quilt: { name: "Quilt", prefix: "quilt-loader", meta: "https://meta.quiltmc.org/v3/versions/loader" },
};

async function installProfileLoader({ kind, loaderVersion, minecraftVersion, gameRoot, onProgress }) {
  const loader = PROFILE_LOADERS[kind];
  const versionId = `${loader.prefix}-${loaderVersion}-${minecraftVersion}`;
  const versionJson = safeJoin(path.join(gameRoot, "versions"), path.join(versionId, `${versionId}.json`));
  if (fs.existsSync(versionJson)) return versionId;

  onProgress({ text: `Téléchargement de ${loader.name}…` });
  const res = await fetch(
    `${loader.meta}/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) {
    throw new ModpackError(`${loader.name} ${loaderVersion} introuvable pour Minecraft ${minecraftVersion} (HTTP ${res.status}).`, { code: "installer_failed" });
  }
  const profile = await res.json();
  if (profile.id !== versionId || !Array.isArray(profile.libraries)) {
    throw new ModpackError(`Profil ${loader.name} illisible ou inattendu.`, { code: "installer_failed" });
  }
  await fsp.mkdir(path.dirname(versionJson), { recursive: true });
  await fsp.writeFile(`${versionJson}.part`, JSON.stringify(profile, null, 2));
  await fsp.rename(`${versionJson}.part`, versionJson);
  return versionId;
}

// Installe le chargeur : NeoForge/Forge avec leur installateur officiel, en mode
// client, dans le dossier de jeu partage. Ne refait rien s'il est deja la.
async function installLoader({ loaderId, minecraftVersion, gameRoot, javaPath, onProgress }) {
  const { kind, installerUrl, loaderVersion } = parseLoader(loaderId, minecraftVersion);
  if (PROFILE_LOADERS[kind]) return installProfileLoader({ kind, loaderVersion, minecraftVersion, gameRoot, onProgress });
  const installerPath = path.join(gameRoot, "cache", "installers", path.basename(installerUrl));

  if (!fs.existsSync(installerPath)) {
    onProgress({ text: `Téléchargement de ${kind === "neoforge" ? "NeoForge" : "Forge"}…` });
    // Les deux depots Maven publient l'empreinte SHA-1 a cote du fichier.
    const shaRes = await fetch(`${installerUrl}.sha1`, { signal: AbortSignal.timeout(15_000) });
    if (!shaRes.ok) throw new ModpackError(`Empreinte du chargeur introuvable (HTTP ${shaRes.status}).`, { code: "installer_failed" });
    const sha1 = (await shaRes.text()).trim().split(/\s+/)[0];
    await downloadFile(installerUrl, installerPath, { sha1 });
  }

  const versionId = readInstalledVersionId(installerPath);
  const versionJson = safeJoin(path.join(gameRoot, "versions"), path.join(versionId, `${versionId}.json`));
  if (!fs.existsSync(versionJson)) {
    // L'installateur refuse de demarrer sans profil de lanceur officiel.
    const profiles = path.join(gameRoot, "launcher_profiles.json");
    if (!fs.existsSync(profiles)) await fsp.writeFile(profiles, JSON.stringify({ profiles: {}, version: 3 }));
    await runInstaller({ javaPath, installerPath, gameRoot, onProgress });
    if (!fs.existsSync(versionJson)) {
      throw new ModpackError("Le chargeur de mods s'est installé mais sa version est introuvable.", { code: "installer_failed" });
    }
  }
  return versionId;
}

// --- Version a lancer -------------------------------------------------------

const MOJANG_VERSION_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

// Le JSON (et le jar) de Minecraft vanilla que le chargeur "herite". Selon le
// chargeur, l'installateur les depose ou non : celui de NeoForge oui, celui de
// Forge depose le jar mais pas le JSON. Ce qui manque est pris chez Mojang
// (manifeste officiel, empreintes SHA-1 verifiees) — un joueur qui n'a jamais
// lance cette version vanilla ne doit pas avoir a le faire d'abord.
async function ensureVanillaVersion(versionsDir, minecraftVersion) {
  const jsonPath = path.join(versionsDir, minecraftVersion, `${minecraftVersion}.json`);
  if (!fs.existsSync(jsonPath)) {
    const res = await fetch(MOJANG_VERSION_MANIFEST);
    if (!res.ok) throw new ModpackError(`Liste des versions de Minecraft injoignable (HTTP ${res.status}).`, { code: "vanilla_failed" });
    const entry = (await res.json()).versions?.find((v) => v.id === minecraftVersion);
    if (!entry) throw new ModpackError(`Version de Minecraft inconnue de Mojang : ${minecraftVersion}.`, { code: "vanilla_failed" });
    await downloadFile(entry.url, jsonPath, { sha1: entry.sha1 });
  }

  const vanilla = JSON.parse(await fsp.readFile(jsonPath, "utf8"));
  const jarPath = path.join(versionsDir, minecraftVersion, `${minecraftVersion}.jar`);
  const client = vanilla.downloads?.client;
  if (client?.url && !(await fileMatches(jarPath, { sha1: client.sha1, size: client.size }))) {
    await downloadFile(client.url, jarPath, { sha1: client.sha1, size: client.size });
  }
  return vanilla;
}

// Verifie que l'installation vanilla est REELLEMENT complete sur le disque — pas seulement le
// JSON et le jar (ce qu'ensureVanillaVersion garantit deja), mais aussi les bibliotheques et les
// assets, telecharges par minecraft-launcher-core lui-meme au moment du lancement (son API ne
// permet pas de les telecharger separement sans surveiller tout son fonctionnement interne, voir
// components/launcher.js). Sans ce controle, l'auto-test de publication annoncait "Fichiers du
// jeu installes : reussi" des que json+jar existaient, meme si le joueur avait supprime a la main
// tout le reste (bibliotheques/assets) juste avant de tester — constate le 2026-10-10.
function hasVanillaFilesInstalled(gameRoot) {
  try {
    return fs.readdirSync(path.join(gameRoot, "libraries")).length > 0 && fs.readdirSync(path.join(gameRoot, "assets", "objects")).length > 0;
  } catch {
    return false;
  }
}

function ruleAllows(rules) {
  if (!rules) return true;
  const os = { win32: "windows", darwin: "osx", linux: "linux" }[process.platform];
  let allowed = false;
  for (const rule of rules) {
    if (rule.features) return false;
    const matches = !rule.os || ((!rule.os.name || rule.os.name === os) && (!rule.os.arch || rule.os.arch === process.arch));
    if (matches) allowed = rule.action === "allow";
  }
  return allowed;
}

// minecraft-launcher-core ignore "arguments.jvm" du JSON d'un chargeur et ne
// fusionne les arguments de jeu que par hasard (moins de 11 arguments) : on lui
// fournit donc un JSON deja fusionne (arguments de jeu vanilla + chargeur) dans
// une version "-omniscient", et on calcule nous-memes les arguments JVM du
// chargeur (chemin des modules, --add-opens...) qu'on passera en customArgs.
const FORBIDDEN_JVM_ARG = /^-(javaagent|agentpath|agentlib|XX:On|Djava\.library\.path)/i;

async function prepareLaunchVersion({ gameRoot, loaderVersionId, minecraftVersion }) {
  const versionsDir = path.join(gameRoot, "versions");
  const readJson = async (id) => JSON.parse(await fsp.readFile(safeJoin(versionsDir, path.join(id, `${id}.json`)), "utf8"));

  const loader = await readJson(loaderVersionId);
  const parentId = loader.inheritsFrom || minecraftVersion;
  const parent = await ensureVanillaVersion(versionsDir, parentId);
  if (!parent.arguments?.game || !loader.arguments) {
    throw new ModpackError("Ce chargeur utilise un ancien format de lancement (avant Minecraft 1.13), pas encore pris en charge.", {
      code: "unsupported_loader",
    });
  }

  const customId = `${loaderVersionId}-omniscient`;
  const customDir = path.join(versionsDir, customId);
  await fsp.mkdir(customDir, { recursive: true });

  // Le JSON et le jar de Minecraft vanilla, sous les noms que mclc attend
  // pour une version personnalisee — evite de les retelecharger.
  const parentJson = path.join(versionsDir, parentId, `${parentId}.json`);
  const parentJar = path.join(versionsDir, parentId, `${parentId}.jar`);
  await fsp.copyFile(parentJson, path.join(customDir, `${minecraftVersion}.json`));
  const customJar = path.join(customDir, `${customId}.jar`);
  if (fs.existsSync(parentJar) && !fs.existsSync(customJar)) await fsp.copyFile(parentJar, customJar);

  const merged = {
    ...loader,
    id: customId,
    arguments: { game: [...parent.arguments.game, ...(loader.arguments.game || [])], jvm: loader.arguments.jvm || [] },
  };
  await fsp.writeFile(path.join(customDir, `${customId}.json`), JSON.stringify(merged, null, 2));

  const libraryDirectory = path.resolve(gameRoot, "libraries");
  const fill = (value) =>
    String(value)
      .replaceAll("${library_directory}", libraryDirectory)
      .replaceAll("${classpath_separator}", path.delimiter)
      .replaceAll("${version_name}", customId);
  const jvmArgs = [];
  for (const arg of loader.arguments.jvm || []) {
    if (typeof arg === "string") jvmArgs.push(fill(arg));
    else if (ruleAllows(arg.rules)) jvmArgs.push(...[].concat(arg.value).map(fill));
  }
  // Aucun chargeur officiel (NeoForge, Forge, Fabric, Quilt) n'a besoin de ces options, qui permettent
  // de lancer du code ou une commande au demarrage de Java (audit 14/10, L2) : refus net.
  const forbidden = jvmArgs.find((arg) => FORBIDDEN_JVM_ARG.test(arg));
  if (forbidden) {
    throw new ModpackError(`Argument Java refusé dans le chargeur du modpack : ${forbidden.slice(0, 80)}`, { code: "unsafe_jvm_arg" });
  }

  return { customVersion: customId, jvmArgs };
}

// --- Point d'entree ---------------------------------------------------------

/**
 * Installe (ou met a jour) le modpack d'un serveur (CurseForge ou Modrinth) et
 * prepare son lancement. `config` : { siteUrl, apiKey }.
 * `onProgress({ text, type?, task?, total? })` recoit des mises a jour lisibles
 * (meme forme que la progression du jeu).
 * `resolveJava(major, onProgress(texte))` (facultatif) : renvoie le chemin d'un Java
 * de cette version (ou null) — voir javaManager.ensureJavaForMajor. Il sert au
 * chargeur ET au jeu : un Java trop recent fait planter Forge (voir javaManager.js).
 * Renvoie { instanceDir, minecraftVersion, customVersion, jvmArgs, modpackName,
 * javaPath, javaMajor } — `javaPath` = le Java a utiliser pour lancer le jeu.
 */
// Verrou par instance : deux installations concurrentes pour le MEME serveur (double-clic sur
// "Jouer", ou "Jouer" + "Réinstaller" avant que le premier ait fini) ecrivaient sinon vers le
// meme fichier ".part" (downloadFile) — ecritures entremelees au niveau OS que le SHA-1/compteur
// calcules en memoire (a partir des seuls octets ecrits par CE process) ne detectent pas :
// chaque appelant peut croire son hash valide alors que le fichier final sur disque est
// corrompu (course trouvee par l'audit du 2026-10-10). Le second appelant attend simplement le
// resultat du premier.
const installLocks = new Map();

function installModpack(options) {
  if (typeof options.slug !== "string" || !INSTANCE_SLUG_RE.test(options.slug)) {
    return Promise.reject(new ModpackError("Serveur invalide.", { code: "invalid_slug" }));
  }
  const instanceDir = path.join(options.gameRoot, "instances", options.slug);
  const existing = installLocks.get(instanceDir);
  if (existing) return existing;
  const promise = installModpackLocked(options).finally(() => installLocks.delete(instanceDir));
  installLocks.set(instanceDir, promise);
  return promise;
}

// `manualSearchDirs` : dossiers ou chercher les mods bloques que le joueur a telecharges lui-meme
// (le dossier Telechargements, voir main.js et resolveCurseforgeFiles).
// `onWarning(texte)` (facultatif) : avertissements pour le journal seulement (jamais affiches
// dans la progression), ex. fichier sans empreinte a verifier.
async function installModpackLocked({ config, slug, gameRoot, javaPath, resolveJava, onProgress = () => {}, onWarning = () => {}, signal, waitIfPaused, manualSearchDirs = [] }) {
  onProgress({ text: "Recherche du modpack…" });
  // Serveur prive : preuve d'acces (voir config.headers dans main.js, game:launch).
  const info = await siteJson(config, `/api/launcher/servers/${encodeURIComponent(slug)}/modpack`, { headers: config.headers });
  const source = info.source === "modrinth" ? "modrinth" : "curseforge";
  const { file } = info;
  if (!file?.downloadUrl) throw new ModpackError("Ce modpack n'a pas de lien de téléchargement.", { code: "no_download_url" });
  if (!isAllowedModpackUrl(file.downloadUrl)) {
    throw new ModpackError("Le fichier du modpack se télécharge depuis un site non autorisé.", { code: "disallowed_download_host" });
  }
  // L'API CurseForge/Modrinth ne donne pas toujours l'empreinte : pas bloquant, mais trace.
  if (!file.sha1) onWarning(`Modpack "${info.modpack?.name ?? slug}" : aucune empreinte SHA-1 fournie, fichier vérifié sur sa taille seulement.`);

  const instanceDir = path.join(gameRoot, "instances", slug);
  await fsp.mkdir(instanceDir, { recursive: true });

  const cacheName = `${source}-${String(file.id).replace(/[^\w.-]/g, "_")}-${path.basename(file.fileName)}`;
  const zipPath = path.join(gameRoot, "cache", "modpacks", cacheName);
  if (!(await fileMatches(zipPath, { sha1: file.sha1, size: file.fileLength }))) {
    if (waitIfPaused) await waitIfPaused();
    onProgress({ text: `Téléchargement du modpack ${info.modpack.name}…` });
    let packBytes = 0;
    await downloadFile(file.downloadUrl, zipPath, {
      sha1: file.sha1,
      size: file.fileLength,
      signal,
      onBytes: (n) => {
        packBytes += n;
        onProgress({ type: "mods-bytes", bytes: packBytes, totalBytes: file.fileLength || 0 });
      },
    });
  }

  const zip = new AdmZip(zipPath);
  const pack = source === "modrinth" ? readModrinthPack(zip) : readCurseforgePack(zip);

  // Chargeur non gere = echec immediat, avant de telecharger quoi que ce soit.
  const { kind: loaderKind } = parseLoader(pack.loaderId, pack.minecraftVersion);

  // Java que Mojang demande pour cette version de Minecraft (17 pour la 1.20.1,
  // 21 pour la 1.21.1…) : le chargeur et le jeu tourneront avec lui.
  const vanilla = await ensureVanillaVersion(path.join(gameRoot, "versions"), pack.minecraftVersion);
  let javaMajor = vanilla.javaVersion?.majorVersion ?? null;
  // Mojang donne un minimum. Fabric tourne tres bien sur Java 21 et ses mods sont
  // souvent compiles pour lui (le pack « Ce Soir la Vendée » plante sous Java 17 :
  // "compatibility level JAVA_21"). Forge, lui, n'est valide qu'avec le Java de Mojang.
  // Quilt pareil : il charge les memes mods Fabric.
  if ((loaderKind === "fabric" || loaderKind === "quilt") && javaMajor === 17) javaMajor = 21;
  const gameJava = (resolveJava && javaMajor ? await resolveJava(javaMajor, (text) => onProgress({ text })) : null) || javaPath;

  const previousState = await readInstalledState(instanceDir);
  const previousFiles = previousState?.files ?? [];
  // Chargeur installe AVANT d'extraire les fichiers du pack (audit 14/10, L2) : les overrides
  // ne doivent jamais pouvoir fournir eux-memes le JSON de version que le chargeur va lire.
  const loaderVersionId = await installLoader({
    loaderId: pack.loaderId,
    minecraftVersion: pack.minecraftVersion,
    gameRoot,
    javaPath: gameJava,
    onProgress,
  });

  let overrides = 0;
  const overrideJars = [];
  const overrideKept = [];
  const previousHashes = previousState?.overrideHashes ?? {};
  const overrideHashes = {};
  for (const dirName of pack.overrideDirs) {
    const extracted = await extractOverrides(zip, dirName, instanceDir, previousHashes, overrideHashes);
    overrides += extracted.count;
    overrideJars.push(...extracted.jars);
    overrideKept.push(...extracted.kept);
  }
  onProgress({ text: `Configuration du modpack copiée (${overrides} fichiers).` });
  if (overrideKept.length) {
    onProgress({ text: `${overrideKept.length} fichier(s) modifié(s) par toi conservé(s) : ${overrideKept.slice(0, 5).join(", ")}` });
  }

  const entries = await pack.resolveFiles({ config, onProgress, instanceDir, manualSearchDirs });
  const unhashed = entries.filter((entry) => !entry.sha1 && !entry.sha512);
  if (unhashed.length) {
    onWarning(`${unhashed.length} fichier(s) du modpack sans empreinte, non vérifiés : ${unhashed.slice(0, 5).map((entry) => entry.path).join(", ")}`);
  }
  const installedFiles = await installFiles({ entries, instanceDir, previousFiles, keepPaths: overrideJars, onProgress, signal, waitIfPaused });
  await fsp.writeFile(
    path.join(instanceDir, STATE_FILE),
    JSON.stringify(
      {
        source,
        modpackFileId: file.id,
        minecraftVersion: pack.minecraftVersion,
        loaderId: pack.loaderId,
        // Nom affichable (2026-10-12) : seul moyen de montrer un nom plutot que le
        // slug brut dans la liste "disponible hors ligne" (listInstalledInstances),
        // qui n'a pas accès au site pour le redemander. N'existait pas avant cette
        // date — une instance installée plus tôt retombe sur le slug, voir
        // listInstalledInstances.
        modpackName: info.modpack.name,
        files: [...installedFiles, ...overrideJars],
        overrideHashes,
      },
      null,
      2,
    ),
  );

  const { customVersion, jvmArgs } = await prepareLaunchVersion({
    gameRoot,
    loaderVersionId,
    minecraftVersion: pack.minecraftVersion,
  });

  return {
    instanceDir,
    minecraftVersion: pack.minecraftVersion,
    customVersion,
    jvmArgs,
    modpackName: info.modpack.name,
    javaPath: gameJava,
    javaMajor,
  };
}

module.exports = {
  installModpack,
  installLoader,
  prepareLaunchVersion,
  ensureVanillaVersion,
  hasVanillaFilesInstalled,
  ruleAllows,
  findOnModrinth,
  isInstalled,
  readInstalledState,
  listInstalledInstances,
  ModpackError,
};
