const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { app } = require("electron");

// Minecraft (>= 1.17) a besoin d'un Java 64 bits pour allouer plus que
// quelques centaines de Mo de memoire — un Java 32 bits presenterait donc
// une limite bien plus basse que ce que le joueur choisit dans les
// parametres. On propose Eclipse Temurin (projet Eclipse Foundation,
// build officiel d'OpenJDK, utilise par d'autres launchers du genre comme
// Prism Launcher) plutot que de demander une installation manuelle.
const RUNTIME_BASE = path.join(app.getPath("userData"), "runtime");
const RUNTIME_DIR = path.join(RUNTIME_BASE, "java");
// Windows (historique) ou Linux (version de test personnelle de Rushi, 14/10) :
// Adoptium sert un .zip pour Windows et un .tar.gz pour Linux, et l'executable
// s'appelle java.exe ou java selon le systeme.
const IS_WINDOWS = process.platform === "win32";
const ADOPTIUM_OS = IS_WINDOWS ? "windows" : process.platform === "darwin" ? "mac" : "linux";
const ADOPTIUM_ARCH = !IS_WINDOWS && process.arch === "arm64" ? "aarch64" : "x64";
const JAVA_EXE = IS_WINDOWS ? "java.exe" : "java";
const adoptiumApiUrl = (major) =>
  `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?image_type=jre&os=${ADOPTIUM_OS}&architecture=${ADOPTIUM_ARCH}&vendor=eclipse`;

// Minecraft 1.20.5+ exige Java 21 — ce launcher standardise sur Java 21
// comme minimum pour toutes les versions vanilla qu'il lance (c'est aussi
// ce que downloadAndInstallJava() telecharge ci-dessous). Un Java plus
// ancien deja present sur la machine (tres courant : beaucoup de PC ont un
// vieux Java 8 installe pour d'autres logiciels) passait jusqu'ici le test
// "found + 64 bits" sans jamais etre verifie sur sa version reelle, donc
// minecraft-launcher-core l'utilisait quand meme et le jeu plantait au
// demarrage (JVM trop ancienne pour lire les .class du jeu, code 1).
const MIN_JAVA_MAJOR = 21;

// "1.8.0_471" (ancien schema, Java <= 8 : le vrai major est le 2e nombre)
// vs "21.0.3" ou "21" (Java 9+, le major est le 1er nombre).
function parseJavaMajorVersion(versionString) {
  if (!versionString) return null;
  const parts = versionString.split(".");
  const major = parts[0] === "1" && parts.length > 1 ? Number(parts[1]) : Number(parts[0]);
  return Number.isFinite(major) ? major : null;
}

// Timeout generique pour les process externes (java -version, powershell) qui peuvent ne
// jamais se terminer (wrapper antivirus/EDR casse, lien symbolique en boucle) — sans ca, un
// seul binaire bloque bloquait tout le pipeline de lancement sans aucun message (audit du
// 2026-10-10).
const PROCESS_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_MS = 20_000;

function detectJava(javaPath) {
  return new Promise((resolve) => {
    const proc = spawn(javaPath || "java", ["-version"]);
    let output = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      proc.kill();
      finish({ found: false });
    }, PROCESS_TIMEOUT_MS);
    proc.stderr.on("data", (d) => (output += d.toString()));
    proc.stdout.on("data", (d) => (output += d.toString()));
    proc.on("error", () => finish({ found: false }));
    proc.on("exit", () => {
      if (!output) return finish({ found: false });
      const versionMatch = output.match(/version "([\d._]+)"/);
      const version = versionMatch ? versionMatch[1] : null;
      const majorVersion = parseJavaMajorVersion(version);
      finish({
        found: true,
        version,
        majorVersion,
        is64Bit: /64-Bit/i.test(output),
        meetsMinimum: majorVersion !== null && majorVersion >= MIN_JAVA_MAJOR,
      });
    });
  });
}

async function fetchLatestJreInfo(major) {
  // Le numero de version finit dans une URL : entier borne, jamais du texte libre.
  if (!Number.isInteger(major) || major < 8 || major > 99) throw new Error(`Version de Java invalide : ${major}.`);
  const res = await fetch(adoptiumApiUrl(major), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`L'API Adoptium a répondu ${res.status}.`);
  const data = await res.json();
  const asset = data[0];
  if (!asset) throw new Error(`Aucune version de Java ${major} disponible pour ${IS_WINDOWS ? "Windows" : "Linux"} ${ADOPTIUM_ARCH}.`);
  return {
    version: asset.version.semver,
    url: asset.binary.package.link,
    checksum: asset.binary.package.checksum,
    name: asset.binary.package.name,
  };
}

// Echappe une apostrophe pour l'inserer dans une chaine PowerShell entre
// guillemets simples (une apostrophe s'y note en la doublant) — sans ça,
// un chemin Windows contenant une apostrophe (dossier utilisateur
// "O'Brien", par ex.) casse la commande.
function escapePowerShellSingleQuoted(value) {
  return value.replace(/'/g, "''");
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    // PowerShell est present sur toute machine Windows — evite d'ajouter
    // une dependance npm de decompression juste pour cet usage ponctuel. Sous
    // Linux, l'archive est un .tar.gz et tar est toujours present (il garde
    // aussi le droit d'execution de bin/java). Arguments passes un par un :
    // aucun shell, donc aucun echappement a faire.
    const proc = IS_WINDOWS
      ? spawn("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Expand-Archive -LiteralPath '${escapePowerShellSingleQuoted(zipPath)}' -DestinationPath '${escapePowerShellSingleQuoted(destDir)}' -Force`,
        ])
      : spawn("tar", ["-xzf", zipPath, "-C", destDir]);
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    // Disque d'une machine virtuelle parfois lent : marge plus large sous Linux.
    const timer = setTimeout(() => {
      proc.kill();
      finish(() => reject(new Error("Extraction de Java : délai dépassé.")));
    }, IS_WINDOWS ? PROCESS_TIMEOUT_MS : 120_000);
    proc.on("error", (error) => finish(() => reject(error)));
    proc.on("exit", (code) => finish(() => (code === 0 ? resolve() : reject(new Error(`Extraction échouée (code ${code}).`)))));
  });
}

// L'archive Adoptium contient un sous-dossier versionne (ex.
// "jdk-21.0.12.1+1-jre/") — on le retrouve plutot que de deviner son nom
// exact, qui change a chaque version.
function findExtractedJavaExe(destDir) {
  if (!fs.existsSync(destDir)) return null;
  const entries = fs.readdirSync(destDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const entry of entries) {
    const candidate = path.join(destDir, entry.name, "bin", JAVA_EXE);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Verrou par destDir : deux appels concurrents pour le meme major (ex. deux "Jouer" sur deux
// serveurs necessitant tous les deux Java 21, avant que le premier ait fini) ecrivaient sinon
// dans le MEME tmpZip et faisaient chacun un rmSync(destDir) sur le dossier de l'autre —
// corruption ou suppression croisee (course trouvee par l'audit du 2026-10-10). Le second
// appelant attend simplement le resultat du premier au lieu de relancer son propre telechargement.
const downloadLocks = new Map();

// `major` / `destDir` : par defaut Java 21 dans RUNTIME_DIR (comportement historique,
// utilise par le bouton "installer Java") ; un autre `major` s'installe dans son
// propre dossier pour ne jamais ecraser le Java 21 deja gere.
function downloadAndInstallJava(onProgress, options = {}) {
  const destDir = options.destDir ?? RUNTIME_DIR;
  const existing = downloadLocks.get(destDir);
  if (existing) return existing;
  const promise = downloadAndInstallJavaLocked(onProgress, options).finally(() => downloadLocks.delete(destDir));
  downloadLocks.set(destDir, promise);
  return promise;
}

async function downloadAndInstallJavaLocked(onProgress, { major = MIN_JAVA_MAJOR, destDir = RUNTIME_DIR } = {}) {
  const info = await fetchLatestJreInfo(major);
  onProgress?.(`Téléchargement de Java ${info.version}…`);

  // path.basename() par prudence : info.name vient de la reponse JSON de
  // l'API Adoptium, jamais interpolee dans un chemin sans passer par ce
  // garde-fou (defense en profondeur si ce nom contenait un jour des
  // sequences "../"). Prefixe aleatoire en plus du verrou ci-dessus : defense en
  // profondeur si jamais deux destDir distincts partageaient le meme nom de fichier Adoptium.
  const tmpZip = path.join(app.getPath("temp"), `${crypto.randomUUID()}-${path.basename(info.name)}`);
  const res = await fetch(info.url, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok || !res.body) throw new Error(`Téléchargement échoué (${res.status}).`);

  const hash = crypto.createHash("sha256");
  const fileStream = fs.createWriteStream(tmpZip);
  let downloadedBytes = 0;
  for await (const chunk of res.body) {
    hash.update(chunk);
    fileStream.write(chunk);
    downloadedBytes += chunk.length;
    onProgress?.(`Téléchargement de Java… ${(downloadedBytes / 1024 / 1024).toFixed(1)} Mo`);
  }
  await new Promise((resolve, reject) => fileStream.end((err) => (err ? reject(err) : resolve())));

  // Verifie l'integrite avant d'executer/extraire quoi que ce soit —
  // n'installe jamais un fichier dont la somme de controle ne correspond
  // pas a celle publiee par Adoptium.
  if (hash.digest("hex") !== info.checksum) {
    fs.unlinkSync(tmpZip);
    throw new Error(
      "La somme de contrôle du fichier téléchargé ne correspond pas — installation annulée par sécurité.",
    );
  }

  onProgress?.("Extraction de Java…");
  fs.rmSync(destDir, { recursive: true, force: true });
  try {
    await extractZip(tmpZip, destDir);
  } finally {
    // Nettoye le zip temporaire meme si l'extraction echoue (auparavant
    // seul le chemin "checksum invalide" le supprimait).
    fs.rmSync(tmpZip, { force: true });
  }

  const javaPath = findExtractedJavaExe(destDir);
  if (!javaPath) throw new Error("Java a été téléchargé mais est introuvable après extraction.");

  onProgress?.("Java installé.");
  return { javaPath, version: info.version };
}

// --- Java d'une version precise (serveurs moddés) ---------------------------
//
// Forge/NeoForge et leurs mods lisent les classes du JDK avec des outils (ASM,
// Mixin) qui ne connaissent pas un Java trop recent : Forge 1.20.1 sur Java 25
// plante des qu'un mod fait chercher a Mixin les metadonnees d'une classe du
// JDK ("Unsupported class file major version 69", vu sur un vrai modpack),
// alors que le meme modpack demarre avec Java 17, celui que Mojang indique pour
// cette version. On lance donc un serveur moddé avec le Java demande, pas avec
// "le premier Java du PATH".

// "jdk-21.0.7.6-hotspot" -> 21, "jre-17.0.9" -> 17, "jdk1.8.0_301" -> 8,
// "zulu17.44.53-ca-jdk17.0.8-win_x64" -> 17 ; sous Linux (/usr/lib/jvm) :
// "java-21-openjdk-amd64" -> 21, "temurin-17-jdk-amd64" -> 17.
function javaMajorFromFolderName(name) {
  const legacy = /^(?:jdk|jre)1\.(\d+)/i.exec(name);
  if (legacy) return Number(legacy[1]);
  const modern = /(?:jdk|jre|zulu|corretto|liberica)[-_]?(\d+)/i.exec(name);
  if (modern) return Number(modern[1]);
  const linux = /^(?:java|temurin|openjdk)-(\d+)/i.exec(name);
  return linux ? Number(linux[1]) : null;
}

function javaInstallRoots(major) {
  const managed = [RUNTIME_DIR, path.join(RUNTIME_BASE, `java-${major}`)];
  if (!IS_WINDOWS) return ["/usr/lib/jvm", "/usr/java", "/opt/java", ...managed];
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  return [
    ...["Java", "Eclipse Adoptium", "Microsoft", "Zulu", "BellSoft", "Amazon Corretto"].map((vendor) => path.join(programFiles, vendor)),
    ...managed,
  ];
}

// Un Java 64 bits de cette version exacte deja installe sur la machine, ou null.
async function findInstalledJava(major) {
  for (const root of javaInstallRoots(major)) {
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
    } catch {
      continue; // dossier absent
    }
    for (const entry of entries) {
      if (javaMajorFromFolderName(entry.name) !== major) continue;
      const exe = path.join(root, entry.name, "bin", JAVA_EXE);
      if (!fs.existsSync(exe)) continue;
      const info = await detectJava(exe);
      if (info.found && info.majorVersion === major && info.is64Bit) return exe;
    }
  }
  return null;
}

// Renvoie le chemin d'un Java `major` : celui des reglages s'il convient, sinon
// un Java deja installe, sinon telecharge (Temurin, somme de controle verifiee).
// null si rien n'est possible : l'appelant garde alors son Java par defaut.
async function ensureJavaForMajor(major, { preferredPath, onProgress } = {}) {
  if (!Number.isInteger(major)) return null;
  // Mojang cite parfois une version sans JRE Temurin (16 pour la 1.17, etc.) : on
  // prend la suivante des quatre gerees, qui fait tourner la meme version du jeu.
  major = SUPPORTED_JAVA_MAJORS.find((m) => m >= major) ?? major;
  if (preferredPath) {
    const info = await detectJava(preferredPath);
    if (info.found && info.majorVersion === major && info.is64Bit) return preferredPath;
  }
  const installed = await findInstalledJava(major);
  if (installed) {
    onProgress?.(`Java ${major} : déjà présent.`);
    return installed;
  }
  onProgress?.(`Java ${major} : téléchargement…`);
  try {
    const { javaPath } = await downloadAndInstallJava(onProgress, { major, destDir: path.join(RUNTIME_BASE, `java-${major}`) });
    return javaPath;
  } catch (error) {
    onProgress?.(`Java ${major} n'a pas pu être installé (${error instanceof Error ? error.message : "erreur inconnue"}) : Java par défaut utilisé.`);
    return null;
  }
}

// Les Java que Minecraft demande selon sa version : 8 (jusqu'a la 1.16), 17 (1.17 a
// 1.20.4), 21 (1.20.5 a 1.21.x), 25 (versions les plus recentes).
const SUPPORTED_JAVA_MAJORS = [8, 17, 21, 25];

// { 8: true, 17: false, ... } : lequel est deja disponible (installe sur le PC ou par le launcher).
async function installedJavaMajors() {
  const status = {};
  for (const major of SUPPORTED_JAVA_MAJORS) status[major] = !!(await findInstalledJava(major));
  return status;
}

// Installe d'un coup ceux qui manquent (un par un, les presents sont sautes) :
// les quatre par defaut, ou seulement `majors`.
// Renvoie { 8: chemin|null, ... } — null = echec, deja signale par onProgress.
async function installAllJava(onProgress, majors = SUPPORTED_JAVA_MAJORS) {
  const paths = {};
  for (const major of majors) paths[major] = await ensureJavaForMajor(major, { onProgress });
  return paths;
}

// Supprime les Java telecharges par le launcher (runtime/) — jamais ceux installes
// sur le PC. Echoue si l'un est en cours d'utilisation (Minecraft ouvert).
function removeManagedJava() {
  fs.rmSync(RUNTIME_BASE, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
}

module.exports = {
  detectJava,
  downloadAndInstallJava,
  ensureJavaForMajor,
  findInstalledJava,
  installedJavaMajors,
  installAllJava,
  removeManagedJava,
  SUPPORTED_JAVA_MAJORS,
  javaMajorFromFolderName,
  RUNTIME_DIR,
};
