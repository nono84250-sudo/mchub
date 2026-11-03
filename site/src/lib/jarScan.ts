import "server-only";
import { inflateRawSync } from "node:zlib";

// Mon cloud (03/11, accord de Rushi) : contrôles d'un .jar perso envoyé par un propriétaire de
// serveur. Personne ne sait prouver qu'un mod est sain : on bloque ce qu'on sait reconnaître.
//   1. Un programme Windows/Mac/Linux ou un script caché dans le .jar (même dans un .jar imbriqué).
//   2. Pas un vrai mod (aucune fiche Fabric, Quilt, Forge ou NeoForge), ou pas pour ce chargeur.
//   3. Des signatures de virus Minecraft connus (fractureiser, 2023 ; voleurs de comptes et de
//      jetons Discord), et du code qui lance un programme sur le PC ou qui télécharge puis exécute
//      du code venu d'internet.
// Le contrôle Modrinth (remplacé par son lien) et CurseForge (refusé) se fait dans cloudPacks.ts.
export const JAR_MAX_BYTES = 30 * 1000 * 1000;
const MAX_UNPACKED = 200 * 1000 * 1000;
const MAX_ENTRIES = 20000;
const MAX_DEPTH = 2;

const FORBIDDEN = /\.(exe|dll|so|dylib|jnilib|bat|cmd|com|scr|msi|msp|ps1|psm1|vbs|vbe|wsf|wsh|hta|lnk|pif|reg|cpl|jse|sh|command|app|apk|dmg|pkg)$/i;
const NESTED_JAR = /\.jar$/i;

// Chaînes qu'on ne trouve que dans des logiciels malveillants connus.
const KNOWN_BAD = [
  "85.217.144.130", // fractureiser (étape 0)
  "107.189.3.101", // fractureiser
  "files-8ie.pages.dev", // fractureiser
  "dev/neko/nekoclient", // fractureiser
  "dev/neko/nekoinjector",
  "skyrage", // fractureiser (nom de la suite)
  "discord.com/api/webhooks", // envoi de données volées vers un salon Discord
  "discordapp.com/api/webhooks",
  "Local Storage/leveldb", // jetons Discord
  "Local Storage\\leveldb",
  "launcher_accounts.json", // comptes Minecraft
  "launcher_accounts_microsoft_store.json",
  "Login Data", // mots de passe des navigateurs
  "\\Google\\Chrome\\User Data",
  "Mozilla\\Firefox\\Profiles",
  "wallet.dat",
];

export type JarScan = { ok: true; loaders: string[]; classes: number } | { ok: false; reason: string };

// Lecture d'un zip en mémoire, ZIP64 compris (le launcher écrit toujours ses archives en ZIP64, avec
// les tailles après les données : on se fie donc au répertoire central, jamais à l'en-tête local).
export type Entry = { name: string; size: number; compSize: number; localOffset: number; method: number };
const MAX32 = 0xffffffff;

export function zipEntries(buf: Buffer, maxEntries = MAX_ENTRIES): Entry[] {
  const from = Math.max(0, buf.length - 22 - 0xffff);
  let end = -1;
  for (let i = buf.length - 22; i >= from; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("fin introuvable");
  let count = buf.readUInt16LE(end + 10);
  let centralSize = buf.readUInt32LE(end + 12);
  let centralOffset = buf.readUInt32LE(end + 16);
  if ((count === 0xffff || centralSize === MAX32 || centralOffset === MAX32) && end >= 20 && buf.readUInt32LE(end - 20) === 0x07064b50) {
    const at = Number(buf.readBigUInt64LE(end - 20 + 8));
    if (at + 56 > buf.length || buf.readUInt32LE(at) !== 0x06064b50) throw new Error("zip64");
    count = Number(buf.readBigUInt64LE(at + 32));
    centralSize = Number(buf.readBigUInt64LE(at + 40));
    centralOffset = Number(buf.readBigUInt64LE(at + 48));
  }
  if (count > maxEntries) throw new Error("trop de fichiers");
  if (centralOffset + centralSize > buf.length) throw new Error("répertoire");
  const out: Entry[] = [];
  let p = centralOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error("répertoire");
    const method = buf.readUInt16LE(p + 10);
    let compSize = buf.readUInt32LE(p + 20);
    let size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    let localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    // Champ ZIP64 (0x0001) : dans l'ordre, seulement les valeurs saturées.
    let x = p + 46 + nameLen;
    const xEnd = x + extraLen;
    while (x + 4 <= xEnd) {
      const id = buf.readUInt16LE(x);
      const len = buf.readUInt16LE(x + 2);
      if (id === 0x0001) {
        let q = x + 4;
        if (size === MAX32 && q + 8 <= x + 4 + len) (size = Number(buf.readBigUInt64LE(q))), (q += 8);
        if (compSize === MAX32 && q + 8 <= x + 4 + len) (compSize = Number(buf.readBigUInt64LE(q))), (q += 8);
        if (localOffset === MAX32 && q + 8 <= x + 4 + len) localOffset = Number(buf.readBigUInt64LE(q));
      }
      x += 4 + len;
    }
    out.push({ name, size, compSize, localOffset, method });
    p = xEnd + commentLen;
  }
  return out;
}

export function zipRead(buf: Buffer, e: Entry, max: number): Buffer {
  const at = e.localOffset;
  if (at + 30 > buf.length || buf.readUInt32LE(at) !== 0x04034b50) throw new Error("illisible");
  const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
  if (start + e.compSize > buf.length) throw new Error("illisible");
  const raw = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return raw;
  if (e.method !== 8) throw new Error("compression inconnue");
  return inflateRawSync(raw, { maxOutputLength: max });
}

const entriesOf = (buf: Buffer) => zipEntries(buf);
const readEntry = zipRead;

// Ce qu'une classe Java fait de dangereux, d'après les noms qu'elle utilise (table des constantes).
function classVerdict(text: string): string | null {
  for (const bad of KNOWN_BAD) if (text.includes(bad)) return `signature d'un virus connu (${bad.length > 30 ? bad.slice(0, 30) + "…" : bad})`;
  if (text.includes("java/lang/ProcessBuilder") || text.includes(")Ljava/lang/Process;")) return "il lance un programme sur le PC du joueur";
  // Télécharger puis exécuter du code : un chargeur de classes depuis une adresse internet.
  if (text.includes("java/net/URLClassLoader") && text.includes("java/net/URL")) return "il télécharge et exécute du code venu d'internet";
  if (text.includes("defineClass") && text.includes("java/net/URL") && (text.includes("java/lang/ClassLoader") || text.includes("java/lang/invoke/MethodHandles$Lookup"))) return "il télécharge et exécute du code venu d'internet";
  return null;
}

type Budget = { unpacked: number; classes: number };

function scanArchive(buf: Buffer, depth: number, budget: Budget, path: string): { reason: string } | { loaders: string[] } {
  let entries: Entry[];
  try {
    entries = entriesOf(buf);
  } catch {
    return { reason: `${path} n'est pas une archive .jar lisible` };
  }
  if (entries.length > MAX_ENTRIES) return { reason: "trop de fichiers dans le .jar" };
  const names = new Set(entries.map((e) => e.name));
  const loaders: string[] = [];
  if (names.has("fabric.mod.json")) loaders.push("fabric");
  if (names.has("quilt.mod.json")) loaders.push("quilt");
  if (names.has("META-INF/neoforge.mods.toml")) loaders.push("neoforge");
  if (names.has("META-INF/mods.toml")) loaders.push("forge", "neoforge");
  if (names.has("mcmod.info")) loaders.push("forge");
  for (const e of entries) {
    const name = e.name;
    if (name.endsWith("/")) continue;
    if (FORBIDDEN.test(name)) return { reason: `programme caché dans le .jar : ${name.split("/").pop()}` };
    const isClass = name.endsWith(".class");
    const isJar = NESTED_JAR.test(name);
    if (!isClass && !isJar) continue;
    budget.unpacked += e.size;
    if (budget.unpacked > MAX_UNPACKED) return { reason: "le .jar est trop gros une fois décompressé" };
    let data: Buffer;
    try {
      data = readEntry(buf, e, Math.max(1, e.size + 1024));
    } catch {
      return { reason: `fichier illisible dans le .jar : ${name.split("/").pop()}` };
    }
    if (isClass) {
      budget.classes++;
      const why = classVerdict(data.toString("latin1"));
      if (why) return { reason: `${why} (${name.replace(/\.class$/, "").split("/").slice(-2).join("/")})` };
    } else {
      if (depth >= MAX_DEPTH) return { reason: "trop de .jar imbriqués" };
      const inner = scanArchive(data, depth + 1, budget, name.split("/").pop() ?? name);
      if ("reason" in inner) return inner;
    }
  }
  return { loaders };
}

// `loader` : le chargeur du modpack (le mod doit pouvoir s'y charger).
export function scanJar(data: Uint8Array, loader: string): JarScan {
  if (data.byteLength > JAR_MAX_BYTES) return { ok: false, reason: "30 Mo au maximum par mod" };
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const budget: Budget = { unpacked: 0, classes: 0 };
  const r = scanArchive(buf, 0, budget, "ce fichier");
  if ("reason" in r) return { ok: false, reason: r.reason };
  if (!r.loaders.length) return { ok: false, reason: "ce n'est pas un mod Minecraft (aucune fiche Fabric, Quilt, Forge ou NeoForge)" };
  const fits = loader === "quilt" ? r.loaders.some((l) => l === "quilt" || l === "fabric") : r.loaders.includes(loader);
  if (!fits) return { ok: false, reason: `ce mod est pour ${r.loaders.filter((l, i, a) => a.indexOf(l) === i).join(" / ")}, pas pour ${loader}` };
  return { ok: true, loaders: r.loaders, classes: budget.classes };
}

// Empreinte CurseForge (MurmurHash2, graine 1, sans les espaces, tabulations et retours à la ligne).
export function curseforgeFingerprint(data: Uint8Array): number {
  const bytes = new Uint8Array(data.byteLength);
  let len = 0;
  for (const b of data) if (b !== 9 && b !== 10 && b !== 13 && b !== 32) bytes[len++] = b;
  const m = 0x5bd1e995;
  let h = (1 ^ len) >>> 0;
  let i = 0;
  while (len - i >= 4) {
    let k = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
    k = Math.imul(k, m);
    k ^= k >>> 24;
    k = Math.imul(k, m);
    h = Math.imul(h, m) ^ k;
    i += 4;
  }
  switch (len - i) {
    case 3:
      h ^= bytes[i + 2] << 16;
    // falls through
    case 2:
      h ^= bytes[i + 1] << 8;
    // falls through
    case 1:
      h ^= bytes[i];
      h = Math.imul(h, m);
  }
  h ^= h >>> 13;
  h = Math.imul(h, m);
  h ^= h >>> 15;
  return h >>> 0;
}
