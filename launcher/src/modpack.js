// Installation d'un modpack (CurseForge ou Modrinth) pour un serveur moddé :
// telecharge le modpack, ses mods et ses fichiers de config dans une instance
// propre au serveur, installe le chargeur de mods (NeoForge / Forge) et prepare
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

// Hotes autorises pour les fichiers d'un .mrpack (specification Modrinth) : un
// modpack ne doit pas pouvoir nous faire telecharger depuis n'importe quel serveur.
const MRPACK_ALLOWED_HOSTS = new Set(["cdn.modrinth.com", "github.com", "raw.githubusercontent.com", "gitlab.com"]);

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
    headers: {
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

// Telecharge vers `destPath` (fichier .part puis renommage) en verifiant la
// taille et l'empreinte SHA-1 quand elles sont connues, avec 3 essais.
async function downloadFile(url, destPath, { sha1, size } = {}) {
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  const partPath = `${destPath}.part`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const hash = crypto.createHash("sha1");
      let received = 0;
      const source = Readable.fromWeb(res.body);
      source.on("data", (chunk) => {
        hash.update(chunk);
        received += chunk.length;
      });
      await pipeline(source, fs.createWriteStream(partPath));
      if (size && received !== size) throw new Error(`taille reçue ${received} au lieu de ${size}`);
      if (sha1 && hash.digest("hex") !== sha1.toLowerCase()) throw new Error("empreinte SHA-1 différente de celle attendue");
      await fsp.rename(partPath, destPath);
      return;
    } catch (error) {
      lastError = error;
      await fsp.rm(partPath, { force: true });
      if (attempt < 3) await sleep(600 * attempt);
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

// Chemins (relatifs a l'instance) des fichiers installes par la version
// precedente du modpack.
async function readInstalledFiles(instanceDir) {
  try {
    const state = JSON.parse(await fsp.readFile(path.join(instanceDir, STATE_FILE), "utf8"));
    if (Array.isArray(state.files)) return state.files;
    if (Array.isArray(state.mods)) return state.mods.map((name) => `mods/${name}`); // ancien format
  } catch {
    // premiere installation
  }
  return [];
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
    resolveFiles: ({ config, onProgress }) => resolveCurseforgeFiles({ config, manifest, onProgress }),
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
    entries.push({ path: file.path, url, sha1: file.hashes?.sha1 || null, size: file.fileSize || null });
  }
  return entries;
}

// CurseForge : les liens de telechargement des mods sont demandes au site, qui
// garde la cle. Un mod sans lien (auteur qui interdit le telechargement
// automatique) fait echouer l'installation, avec la liste de ces mods.
async function resolveCurseforgeFiles({ config, manifest, onProgress }) {
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
  const manualMods = [];
  for (const fileId of wantedIds) {
    const info = infos.get(fileId);
    if (!info) manualMods.push({ fileId, fileName: null, reason: "fichier retiré de CurseForge" });
    else if (!info.downloadUrl) manualMods.push({ fileId, modId: info.modId, fileName: info.fileName, reason: "téléchargement automatique interdit par l'auteur" });
    else entries.push({ path: `mods/${path.basename(info.fileName)}`, url: info.downloadUrl, sha1: info.sha1, size: info.fileLength });
  }
  if (manualMods.length) {
    throw new ModpackError(
      `${manualMods.length} mod(s) du modpack ne peuvent pas être installés automatiquement : ${manualMods
        .map((m) => m.fileName || `fichier ${m.fileId}`)
        .join(", ")}.`,
      { code: "manual_mods", manualMods },
    );
  }
  return entries;
}

// Copie un dossier "overrides" du modpack (configs, etc.) dans l'instance.
// options.txt est laisse tel quel s'il existe deja : ce sont les reglages du
// joueur (touches, video), pas ceux du modpack.
// Renvoie { count, jars } : `jars` = les mods (.jar sous mods/) livres dans
// l'archive elle-meme, a suivre comme les mods telecharges — sinon, en
// changeant de modpack ou de version, ils resteraient orphelins dans mods/.
async function extractOverrides(zip, dirName, instanceDir) {
  const prefix = `${dirName}/`;
  let count = 0;
  const jars = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.startsWith(prefix)) continue;
    const relative = entry.entryName.slice(prefix.length);
    if (!relative) continue;
    const target = safeJoin(instanceDir, relative);
    if (relative === "options.txt" && fs.existsSync(target)) continue;
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, entry.getData());
    count++;
    if (/^mods\/.+\.jar$/i.test(relative)) jars.push(relative);
  }
  return { count, jars };
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
async function installFiles({ entries, instanceDir, previousFiles, keepPaths = [], onProgress }) {
  const targets = entries.map((entry) => ({ ...entry, target: safeJoin(instanceDir, entry.path) }));

  const keep = new Set([...targets.map((entry) => entry.target), ...keepPaths.map((p) => safeJoin(instanceDir, p))]);
  for (const old of previousFiles) {
    const oldTarget = safeJoin(instanceDir, old);
    if (!keep.has(oldTarget)) await fsp.rm(oldTarget, { force: true });
  }

  let done = 0;
  let failure = null;
  const queue = [...targets];
  const worker = async () => {
    while (queue.length && !failure) {
      const entry = queue.shift();
      try {
        if (!(await fileMatches(entry.target, { sha1: entry.sha1, size: entry.size }))) {
          await downloadFile(entry.url, entry.target, { sha1: entry.sha1, size: entry.size });
        }
        done++;
        onProgress({ text: `Téléchargement des mods : ${done}/${targets.length}`, type: "mods", task: done, total: targets.length });
      } catch (error) {
        failure = failure || error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MOD_DOWNLOAD_CONCURRENCY, targets.length) }, worker));
  if (failure) throw failure;

  return entries.map((entry) => entry.path);
}

// --- Chargeur de mods (NeoForge / Forge) ------------------------------------

function parseLoader(loaderId, minecraftVersion) {
  const match = /^(neoforge|forge)-(.+)$/.exec(loaderId || "");
  if (!match) {
    throw new ModpackError(
      `Chargeur de mods non pris en charge pour l'instant : ${loaderId || "aucun"} (NeoForge et Forge seulement).`,
      { code: "unsupported_loader" },
    );
  }
  const [, kind, loaderVersion] = match;
  const mavenVersion = kind === "neoforge" ? loaderVersion : `${minecraftVersion}-${loaderVersion}`;
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

// Installe le chargeur (NeoForge/Forge) avec son installateur officiel, en
// mode client, dans le dossier de jeu partage. Ne refait rien s'il est deja la.
async function installLoader({ loaderId, minecraftVersion, gameRoot, javaPath, onProgress }) {
  const { kind, installerUrl } = parseLoader(loaderId, minecraftVersion);
  const installerPath = path.join(gameRoot, "cache", "installers", path.basename(installerUrl));

  if (!fs.existsSync(installerPath)) {
    onProgress({ text: `Téléchargement de ${kind === "neoforge" ? "NeoForge" : "Forge"}…` });
    // Les deux depots Maven publient l'empreinte SHA-1 a cote du fichier.
    const shaRes = await fetch(`${installerUrl}.sha1`);
    if (!shaRes.ok) throw new ModpackError(`Empreinte du chargeur introuvable (HTTP ${shaRes.status}).`, { code: "installer_failed" });
    const sha1 = (await shaRes.text()).trim().split(/\s+/)[0];
    await downloadFile(installerUrl, installerPath, { sha1 });
  }

  const versionId = readInstalledVersionId(installerPath);
  const versionJson = path.join(gameRoot, "versions", versionId, `${versionId}.json`);
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
async function prepareLaunchVersion({ gameRoot, loaderVersionId, minecraftVersion }) {
  const versionsDir = path.join(gameRoot, "versions");
  const readJson = async (id) => JSON.parse(await fsp.readFile(path.join(versionsDir, id, `${id}.json`), "utf8"));

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
async function installModpack({ config, slug, gameRoot, javaPath, resolveJava, onProgress = () => {} }) {
  onProgress({ text: "Recherche du modpack…" });
  const info = await siteJson(config, `/api/launcher/servers/${encodeURIComponent(slug)}/modpack`);
  const source = info.source === "modrinth" ? "modrinth" : "curseforge";
  const { file } = info;
  if (!file?.downloadUrl) throw new ModpackError("Ce modpack n'a pas de lien de téléchargement.", { code: "no_download_url" });

  const instanceDir = path.join(gameRoot, "instances", slug);
  await fsp.mkdir(instanceDir, { recursive: true });

  const cacheName = `${source}-${String(file.id).replace(/[^\w.-]/g, "_")}-${path.basename(file.fileName)}`;
  const zipPath = path.join(gameRoot, "cache", "modpacks", cacheName);
  if (!(await fileMatches(zipPath, { sha1: file.sha1, size: file.fileLength }))) {
    onProgress({ text: `Téléchargement du modpack ${info.modpack.name}…` });
    await downloadFile(file.downloadUrl, zipPath, { sha1: file.sha1, size: file.fileLength });
  }

  const zip = new AdmZip(zipPath);
  const pack = source === "modrinth" ? readModrinthPack(zip) : readCurseforgePack(zip);

  // Chargeur non gere = echec immediat, avant de telecharger quoi que ce soit.
  parseLoader(pack.loaderId, pack.minecraftVersion);

  // Java que Mojang demande pour cette version de Minecraft (17 pour la 1.20.1,
  // 21 pour la 1.21.1…) : le chargeur et le jeu tourneront avec lui.
  const vanilla = await ensureVanillaVersion(path.join(gameRoot, "versions"), pack.minecraftVersion);
  const javaMajor = vanilla.javaVersion?.majorVersion ?? null;
  const gameJava = (resolveJava && javaMajor ? await resolveJava(javaMajor, (text) => onProgress({ text })) : null) || javaPath;

  const previousFiles = await readInstalledFiles(instanceDir);
  let overrides = 0;
  const overrideJars = [];
  for (const dirName of pack.overrideDirs) {
    const extracted = await extractOverrides(zip, dirName, instanceDir);
    overrides += extracted.count;
    overrideJars.push(...extracted.jars);
  }
  onProgress({ text: `Configuration du modpack copiée (${overrides} fichiers).` });

  const loaderVersionId = await installLoader({
    loaderId: pack.loaderId,
    minecraftVersion: pack.minecraftVersion,
    gameRoot,
    javaPath: gameJava,
    onProgress,
  });

  const entries = await pack.resolveFiles({ config, onProgress });
  const installedFiles = await installFiles({ entries, instanceDir, previousFiles, keepPaths: overrideJars, onProgress });
  await fsp.writeFile(
    path.join(instanceDir, STATE_FILE),
    JSON.stringify(
      {
        source,
        modpackFileId: file.id,
        minecraftVersion: pack.minecraftVersion,
        loaderId: pack.loaderId,
        files: [...installedFiles, ...overrideJars],
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

module.exports = { installModpack, installLoader, prepareLaunchVersion, ModpackError };
