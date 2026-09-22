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
const RUNTIME_DIR = path.join(app.getPath("userData"), "runtime", "java");
const ADOPTIUM_API_URL =
  "https://api.adoptium.net/v3/assets/latest/21/hotspot?image_type=jre&os=windows&architecture=x64&vendor=eclipse";

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

function detectJava(javaPath) {
  return new Promise((resolve) => {
    const proc = spawn(javaPath || "java", ["-version"]);
    let output = "";
    proc.stderr.on("data", (d) => (output += d.toString()));
    proc.stdout.on("data", (d) => (output += d.toString()));
    proc.on("error", () => resolve({ found: false }));
    proc.on("exit", () => {
      if (!output) return resolve({ found: false });
      const versionMatch = output.match(/version "([\d._]+)"/);
      const version = versionMatch ? versionMatch[1] : null;
      const majorVersion = parseJavaMajorVersion(version);
      resolve({
        found: true,
        version,
        majorVersion,
        is64Bit: /64-Bit/i.test(output),
        meetsMinimum: majorVersion !== null && majorVersion >= MIN_JAVA_MAJOR,
      });
    });
  });
}

async function fetchLatestJreInfo() {
  const res = await fetch(ADOPTIUM_API_URL);
  if (!res.ok) throw new Error(`L'API Adoptium a répondu ${res.status}.`);
  const data = await res.json();
  const asset = data[0];
  if (!asset) throw new Error("Aucune version de Java disponible pour Windows x64.");
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
    // une dependance npm de decompression juste pour cet usage ponctuel.
    const proc = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Expand-Archive -LiteralPath '${escapePowerShellSingleQuoted(zipPath)}' -DestinationPath '${escapePowerShellSingleQuoted(destDir)}' -Force`,
    ]);
    proc.on("error", reject);
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Extraction échouée (code ${code}).`))));
  });
}

// L'archive Adoptium contient un sous-dossier versionne (ex.
// "jdk-21.0.12.1+1-jre/") — on le retrouve plutot que de deviner son nom
// exact, qui change a chaque version.
function findExtractedJavaExe(destDir) {
  if (!fs.existsSync(destDir)) return null;
  const entries = fs.readdirSync(destDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const entry of entries) {
    const candidate = path.join(destDir, entry.name, "bin", "java.exe");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function downloadAndInstallJava(onProgress) {
  const info = await fetchLatestJreInfo();
  onProgress?.(`Téléchargement de Java ${info.version}…`);

  // path.basename() par prudence : info.name vient de la reponse JSON de
  // l'API Adoptium, jamais interpolee dans un chemin sans passer par ce
  // garde-fou (defense en profondeur si ce nom contenait un jour des
  // sequences "../").
  const tmpZip = path.join(app.getPath("temp"), path.basename(info.name));
  const res = await fetch(info.url);
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
  fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
  try {
    await extractZip(tmpZip, RUNTIME_DIR);
  } finally {
    // Nettoye le zip temporaire meme si l'extraction echoue (auparavant
    // seul le chemin "checksum invalide" le supprimait).
    fs.rmSync(tmpZip, { force: true });
  }

  const javaPath = findExtractedJavaExe(RUNTIME_DIR);
  if (!javaPath) throw new Error("Java a été téléchargé mais est introuvable après extraction.");

  onProgress?.("Java installé.");
  return { javaPath, version: info.version };
}

module.exports = { detectJava, downloadAndInstallJava, RUNTIME_DIR };
