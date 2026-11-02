// Contrôle du CONTENU d'un .omnipack (audit du 01/11, bloquant 4) : le site lit le répertoire central
// du zip et n'accepte que omnipack.json et les fichiers de configuration. Même règle côté launcher
// (isAllowedOmniEntry dans omniPack.js) : un zip qui ment au site ne passe pas pour autant à
// l'installation. Sans dépendance, pour pouvoir être testé seul.

// Assez large pour de vrais packs (20 000 fichiers de réglages), mais un zip piégé s'arrête là.
const MAX_ENTRIES = 20_000;
export const OMNI_MAX_CENTRAL_BYTES = 8 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 2 * 1000 * 1000 * 1000;

// Ce qu'un joueur a le droit d'envoyer : config/, defaultconfigs/, kubejs/ et options.txt.
const ALLOWED = /^versions\/[\w.+-]{1,32}\/overrides\/((config|defaultconfigs|kubejs)\/.+|options\.txt)$/;
const FORBIDDEN_EXT = /\.(jar|exe|dll|bat|cmd|com|scr|msi|msp|ps1|psm1|vbs|vbe|wsf|wsh|hta|lnk|sh|so|dylib|class|pif|reg|cpl|jse|url)$/i;

export type ZipEntryInfo = { name: string; size: number; localOffset: number };

export type ZipTail = { centralOffset: number; centralSize: number; count: number };

// Fin de l'archive : la signature doit tomber pile à la fin du fichier (pas de commentaire, le launcher
// n'en écrit jamais). ZIP64 refusé : 300 Mo et 20 000 fichiers au plus n'en ont pas besoin.
export function readZipTail(lastBytes: Uint8Array, totalSize: number): ZipTail {
  const b = Buffer.from(lastBytes.buffer, lastBytes.byteOffset, lastBytes.byteLength);
  const at = b.length - 22;
  if (at < 0 || b.readUInt32LE(at) !== 0x06054b50) throw new Error("Archive .omnipack illisible (fin du fichier).");
  const count = b.readUInt16LE(at + 10);
  const centralSize = b.readUInt32LE(at + 12);
  const centralOffset = b.readUInt32LE(at + 16);
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error("Archive .omnipack refusée (format ZIP64).");
  if (count > MAX_ENTRIES) throw new Error("Trop de fichiers dans ce pack.");
  if (centralSize > OMNI_MAX_CENTRAL_BYTES || centralOffset + centralSize + 22 !== totalSize) throw new Error("Archive .omnipack illisible (répertoire).");
  return { centralOffset, centralSize, count };
}

export function readCentralDirectory(central: Uint8Array, count: number): ZipEntryInfo[] {
  const dir = Buffer.from(central.buffer, central.byteOffset, central.byteLength);
  const entries: ZipEntryInfo[] = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > dir.length || dir.readUInt32LE(p) !== 0x02014b50) throw new Error("Archive .omnipack illisible (répertoire).");
    const nameLength = dir.readUInt16LE(p + 28);
    const extraLength = dir.readUInt16LE(p + 30);
    const commentLength = dir.readUInt16LE(p + 32);
    const size = dir.readUInt32LE(p + 24);
    const localOffset = dir.readUInt32LE(p + 42);
    if (p + 46 + nameLength > dir.length) throw new Error("Archive .omnipack illisible (répertoire).");
    entries.push({ name: dir.subarray(p + 46, p + 46 + nameLength).toString("utf8"), size, localOffset });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// Le premier fichier refusé, ou null si tout est permis.
export function refusedEntry(entries: ZipEntryInfo[]): string | null {
  const seen = new Set<string>();
  let unpacked = 0;
  for (const e of entries) {
    const name = e.name;
    const key = name.toLowerCase();
    if (seen.has(key)) return name;
    seen.add(key);
    unpacked += e.size;
    if (unpacked > MAX_UNPACKED_BYTES) return name;
    if (name.includes("\\") || name.includes("\0") || name.startsWith("/") || name.split("/").includes("..")) return name;
    // 02/11 (test au8) : « evil.jar. » ou « run.bat  » deviennent evil.jar / run.bat sous Windows, et
    // « a.txt:b » y est un flux caché. Un segment qui finit par un point ou une espace, ou qui contient
    // un caractère interdit par Windows, est refusé.
    if (name.split("/").some((seg) => /[. ]$/.test(seg) || /[<>:"|?*\x00-\x1f]/.test(seg))) return name;
    if (FORBIDDEN_EXT.test(name)) return name;
    if (name === "omnipack.json") {
      // Celui que le site a lu : le tout premier de l'archive.
      if (e.localOffset !== 0) return name;
      continue;
    }
    if (name.endsWith("/")) {
      if (!/^versions\/([\w.+-]{1,32}\/(overrides\/((config|defaultconfigs|kubejs)\/.*)?)?)?$/.test(name)) return name;
      continue;
    }
    if (!ALLOWED.test(name)) return name;
    // Les scripts ne sont permis que là où KubeJS les attend.
    if (/\.(js|ts|py|rb|lua)$/i.test(name) && !/\/overrides\/kubejs\//.test(name)) return name;
  }
  return seen.has("omnipack.json") ? null : "omnipack.json";
}
