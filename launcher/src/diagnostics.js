// Sections "Infos systeme" et "Reset & reparation" des Parametres > Debogage
// (maquette V3, "04e"). Vanilla uniquement pour l'instant (voir mcLaunch.js) —
// il n'existe pas encore de "cache de modpack" distinct des fichiers du jeu
// eux-memes, donc Reparer/Vider le cache portent sur les memes sous-dossiers
// de GAME_ROOT, a des granularites differentes.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { app } = require("electron");
const { GAME_ROOT } = require("./mcLaunch");
const javaManager = require("./javaManager");

function dirSize(dir) {
  let total = 0;
  let stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let items;
    try {
      items = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const item of items) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) stack.push(full);
      else {
        try {
          total += fs.statSync(full).size;
        } catch {
          // Fichier supprime entre le readdir et le stat — ignore.
        }
      }
    }
  }
  return total;
}

function removeDirContents(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Repertoire deja absent ou verrouille (fichier en cours d'utilisation) —
    // pas bloquant, le prochain lancement re-telechargera ce qui manque.
  }
}

// Sous-dossiers geres entierement par minecraft-launcher-core (re-crees et
// re-remplis automatiquement au prochain lancement) — jamais saves/,
// resourcepacks/, options.txt ni servers.dat, qui sont les donnees du joueur.
const REPAIR_DIRS = ["versions", "libraries"];
const CACHE_DIRS = ["assets", "downloads", "cache"];

function getCacheSizeBytes() {
  return CACHE_DIRS.reduce((sum, name) => sum + dirSize(path.join(GAME_ROOT, name)), 0);
}

function repairGameFiles() {
  for (const name of REPAIR_DIRS) removeDirContents(path.join(GAME_ROOT, name));
}

function clearCache() {
  for (const name of CACHE_DIRS) removeDirContents(path.join(GAME_ROOT, name));
}

function formatOs() {
  return `${os.type()} ${os.release()} · ${os.arch()}`;
}

// app.getGPUInfo peut etre lent ou indisponible sur certaines machines
// (pilotes, mode logiciel) — jamais bloquant pour le reste de la page.
async function getGpuLabel() {
  try {
    const info = await app.getGPUInfo("basic");
    const device = info?.gpuDevice?.[0];
    if (!device) return null;
    return device.deviceString || `${device.vendorId ?? ""} ${device.deviceId ?? ""}`.trim() || null;
  } catch {
    return null;
  }
}

async function getSystemInfo(settings) {
  const java = await javaManager.detectJava(settings.javaPath || undefined);
  const totalGB = Math.round(os.totalmem() / 1024 ** 3);
  return {
    launcherVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    os: formatOs(),
    java: java.found ? java.version || "?" : null,
    memory: `${totalGB} Go · ${settings.memoryMaxGB} Go alloués`,
    gpu: await getGpuLabel(),
  };
}

module.exports = { getCacheSizeBytes, repairGameFiles, clearCache, getSystemInfo, dirSize };
