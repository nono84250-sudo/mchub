// Dossier des jeux deplacable (serie 2, idee 9, version validee par Rushi le 17/10) : un seul
// dossier pour tout ce qui grossit (instances, mondes, mods, Java telecharge, cache), qu'on peut
// deplacer en entier sur un autre disque. Le compte, les reglages et les journaux restent dans
// userData (quelques Ko), avec l'adresse du dossier des jeux.
//
// Deplacement sans risque, dans cet ordre : copier -> verifier -> basculer -> effacer l'ancien.
// Tant que la bascule n'est pas faite, le launcher continue d'utiliser l'ancien dossier ; un
// journal (games-move.json) permet de reprendre ou d'annuler apres une coupure.
//
// Doit etre charge APRES app.setPath("userData") et AVANT mcLaunch/javaManager (ils calculent
// leurs chemins au chargement du module).
const path = require("node:path");
const fs = require("node:fs");
const fsp = fs.promises;
const { app } = require("electron");

const USER_DATA = app.getPath("userData");
const POINTER_FILE = path.join(USER_DATA, "games-location.json");
// Copie en texte brut pour le desinstalleur (NSIS lit mal le JSON) : build/installer.nsh.
const POINTER_TXT = path.join(USER_DATA, "games-location.txt");
const JOURNAL_FILE = path.join(USER_DATA, "games-move.json");
// Ce qui part avec le dossier des jeux. Le reste de userData (settings.json, accounts.bin,
// logs, window-state.json) ne bouge pas.
const MOVED_DIRS = ["minecraft", "runtime"];
// Marqueur pose dans un dossier des jeux deplace : prouve que le dossier est a nous (on ne
// supprime jamais rien dans un dossier sans ce marqueur, hors userData).
const MARKER = ".omniscient-games";
const FOLDER_NAME = app.isPackaged ? "Omniscient" : "Omniscient-dev";

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const isInside = (child, parent) => {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
};
const driveOf = (p) => (path.parse(path.resolve(p)).root || "").replace(/\\$/, "").toUpperCase();

// Dossier des jeux en cours : celui du pointeur s'il existe et porte notre marqueur, sinon
// userData. Si le pointeur designe un dossier introuvable (disque debranche), on retombe sur
// userData et on le signale (missingRoot) pour l'afficher dans Parametres.
function resolveBase() {
  const pointer = readJson(POINTER_FILE);
  if (pointer && typeof pointer.root === "string" && path.isAbsolute(pointer.root)) {
    if (fs.existsSync(path.join(pointer.root, MARKER))) return { base: pointer.root, missingRoot: null };
    return { base: USER_DATA, missingRoot: pointer.root };
  }
  return { base: USER_DATA, missingRoot: null };
}

const resolved = resolveBase();
const GAMES_BASE = resolved.base;

function setPointer(root) {
  if (samePath(root, USER_DATA)) {
    fs.rmSync(POINTER_FILE, { force: true });
    fs.rmSync(POINTER_TXT, { force: true });
    return;
  }
  writeJsonAtomic(POINTER_FILE, { root, movedAt: new Date().toISOString() });
  fs.writeFileSync(POINTER_TXT, root);
}

function readJournal() {
  const journal = readJson(JOURNAL_FILE);
  if (!journal || typeof journal.from !== "string" || typeof journal.to !== "string") return null;
  return journal;
}

function writeJournal(journal) {
  writeJsonAtomic(JOURNAL_FILE, journal);
}

function clearJournal() {
  fs.rmSync(JOURNAL_FILE, { force: true });
}

// Ou vont les jeux pour un disque donne : le dossier par defaut si c'est le disque de userData
// (retour « a la maison »), sinon X:\Omniscient.
function targetForDrive(drive) {
  const letter = String(drive || "").replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase();
  if (!letter) return null;
  if (driveOf(USER_DATA) === `${letter}:`) return USER_DATA;
  return `${letter}:\\${FOLDER_NAME}`;
}

// Liste des fichiers a deplacer (chemins relatifs a la base), avec taille et date.
async function listFiles(base) {
  const files = [];
  let bytes = 0;
  async function walk(abs, rel) {
    let entries;
    try {
      entries = await fsp.readdir(abs, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const childAbs = path.join(abs, entry.name);
      const childRel = path.join(rel, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(childAbs, childRel);
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".omni-part")) continue;
        const stat = await fsp.stat(childAbs);
        files.push({ rel: childRel, size: stat.size, mtimeMs: stat.mtimeMs, atimeMs: stat.atimeMs });
        bytes += stat.size;
      }
    }
  }
  for (const dir of MOVED_DIRS) await walk(path.join(base, dir), dir);
  return { files, bytes };
}

async function freeBytesOf(dir) {
  let probe = path.resolve(dir);
  // statfs veut un chemin qui existe : on remonte jusqu'a la racine du disque si besoin.
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const stats = await fsp.statfs(probe);
  return { free: Number(stats.bavail) * Number(stats.bsize), total: Number(stats.blocks) * Number(stats.bsize) };
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

// Disques de ce PC (Windows) : place libre et totale via statfs ; nom et type (cle USB, reseau,
// lecteur CD) en plus via PowerShell quand il repond — sinon la liste reste utilisable sans.
async function listDrives() {
  if (process.platform !== "win32") {
    const info = await freeBytesOf(GAMES_BASE).catch(() => null);
    return info ? [{ drive: driveOf(GAMES_BASE) || "/", label: "", type: "local", ...info }] : [];
  }
  const meta = new Map();
  try {
    const { execFile } = require("node:child_process");
    const out = await withTimeout(
      new Promise((resolve) => {
        execFile(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,VolumeName | ConvertTo-Json -Compress"],
          { windowsHide: true, timeout: 5000 },
          (error, stdout) => resolve(error ? null : stdout),
        );
      }),
      5500,
    );
    if (out) {
      const parsed = JSON.parse(out);
      for (const disk of Array.isArray(parsed) ? parsed : [parsed]) {
        meta.set(String(disk.DeviceID).toUpperCase(), { type: { 2: "removable", 3: "local", 4: "network", 5: "cd" }[disk.DriveType] || "local", label: disk.VolumeName || "" });
      }
    }
  } catch {
    /* sans PowerShell : lettres seulement */
  }
  const drives = [];
  for (const code of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
    const drive = `${code}:`;
    const info = meta.get(drive);
    if (info?.type === "cd") continue;
    if (meta.size && !info) continue;
    const stats = await withTimeout(fsp.statfs(`${drive}\\`).catch(() => null), 1500);
    if (!stats) continue;
    const total = Number(stats.blocks) * Number(stats.bsize);
    if (!total) continue;
    drives.push({ drive, label: info?.label || "", type: info?.type || "local", free: Number(stats.bavail) * Number(stats.bsize), total });
  }
  return drives;
}

class MoveCancelled extends Error {
  constructor() {
    super("cancelled");
    this.code = "cancelled";
  }
}

// Copie (avec reprise : un fichier deja copie, meme taille et meme date, est saute), puis
// verification de la copie. Ne touche jamais a la source.
async function copyAndVerify({ from, to, files, totalBytes, onProgress, isCancelled }) {
  let doneBytes = 0;
  let lastEmit = 0;
  const emit = (stage, file, force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < 150) return;
    lastEmit = now;
    onProgress?.({ stage, doneBytes, totalBytes, file });
  };
  for (const file of files) {
    if (isCancelled()) throw new MoveCancelled();
    const src = path.join(from, file.rel);
    const dst = path.join(to, file.rel);
    let skip = false;
    try {
      const stat = await fsp.stat(dst);
      skip = stat.size === file.size && Math.abs(stat.mtimeMs - file.mtimeMs) < 2000;
    } catch {
      /* pas encore copie */
    }
    if (!skip) {
      await fsp.mkdir(path.dirname(dst), { recursive: true });
      const part = `${dst}.omni-part`;
      await fsp.copyFile(src, part);
      await fsp.rename(part, dst);
      await fsp.utimes(dst, new Date(file.atimeMs), new Date(file.mtimeMs)).catch(() => {});
    }
    doneBytes += file.size;
    emit("copy", file.rel);
  }
  emit("verify", null, true);
  let checked = 0;
  for (const file of files) {
    if (isCancelled()) throw new MoveCancelled();
    const stat = await fsp.stat(path.join(to, file.rel)).catch(() => null);
    if (!stat || stat.size !== file.size) {
      const error = new Error(`Copie incomplete : ${file.rel}`);
      error.code = "verifyFailed";
      throw error;
    }
    checked++;
    if (checked % 400 === 0) emit("verify", file.rel);
  }
}

// Efface les dossiers deplaces d'une base (jamais autre chose) : minecraft/, runtime/, le
// marqueur, puis la base elle-meme si elle est vide et n'est pas userData. Une base hors
// userData sans notre marqueur n'est jamais touchee.
async function removeGamesFrom(base) {
  const isUserData = samePath(base, USER_DATA);
  if (!isUserData && !fs.existsSync(path.join(base, MARKER))) return false;
  for (const dir of MOVED_DIRS) await fsp.rm(path.join(base, dir), { recursive: true, force: true, maxRetries: 3 });
  if (!isUserData) {
    await fsp.rm(path.join(base, MARKER), { force: true });
    try {
      await fsp.rmdir(base);
    } catch {
      /* pas vide (fichiers du joueur) : on laisse le dossier */
    }
  }
  return true;
}

module.exports = {
  USER_DATA,
  GAMES_BASE,
  MISSING_ROOT: resolved.missingRoot,
  MOVED_DIRS,
  MARKER,
  samePath,
  isInside,
  driveOf,
  targetForDrive,
  listFiles,
  listDrives,
  freeBytesOf,
  copyAndVerify,
  removeGamesFrom,
  setPointer,
  readJournal,
  writeJournal,
  clearJournal,
  MoveCancelled,
};
