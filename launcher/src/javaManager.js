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
      resolve({
        found: true,
        version: versionMatch ? versionMatch[1] : null,
        is64Bit: /64-Bit/i.test(output),
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

  const tmpZip = path.join(app.getPath("temp"), info.name);
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
  await extractZip(tmpZip, RUNTIME_DIR);
  fs.unlinkSync(tmpZip);

  const javaPath = findExtractedJavaExe(RUNTIME_DIR);
  if (!javaPath) throw new Error("Java a été téléchargé mais est introuvable après extraction.");

  onProgress?.("Java installé.");
  return { javaPath, version: info.version };
}

module.exports = { detectJava, downloadAndInstallJava, RUNTIME_DIR };
