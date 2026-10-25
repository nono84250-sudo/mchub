// Archives .zip des mondes (mode Jouer, 24/10) : adm-zip garde toute l'archive en memoire, ce
// qui ne va pas pour un monde de plusieurs Go. Ici, chaque fichier est lu et compresse en flux
// (deflate), avec ZIP64 au-dela de 4 Go. Le lecteur ne sert qu'a nos propres archives (sauvegardes
// locales et copies du cloud) : il lit le repertoire central et decompresse fichier par fichier.
//
// Node pur (aucune dependance a Electron), comme modpack.js.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const { pipeline } = require("node:stream/promises");

const MAX32 = 0xffffffff;

function dosDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// Ecrit dans un flux en comptant les octets (decalages du repertoire central).
class CountingWriter {
  constructor(file) {
    this.stream = fs.createWriteStream(file);
    this.offset = 0;
  }
  write(buffer) {
    this.offset += buffer.length;
    if (this.stream.write(buffer)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const onDrain = () => {
        this.stream.off("error", onError);
        resolve();
      };
      const onError = (error) => {
        this.stream.off("drain", onDrain);
        reject(error);
      };
      this.stream.once("drain", onDrain);
      this.stream.once("error", onError);
    });
  }
  end() {
    return new Promise((resolve, reject) => {
      this.stream.once("error", reject);
      this.stream.end(resolve);
    });
  }
}

/**
 * Cree `zipFile` a partir de `files` ([{ abs, rel, mtimeMs }]), `rel` avec des "/".
 * `onBytes(n)` : octets source lus (progression). `signal` : annulation (fichier partiel supprime).
 */
async function writeZip(zipFile, files, { onBytes, signal } = {}) {
  await fsp.mkdir(path.dirname(zipFile), { recursive: true });
  const partFile = `${zipFile}.part`;
  const out = new CountingWriter(partFile);
  const central = [];
  try {
    for (const file of files) {
      if (signal?.aborted) throw new DOMException("Sauvegarde annulée.", "AbortError");
      const name = Buffer.from(file.rel.split(path.sep).join("/"), "utf8");
      const { time, date } = dosDateTime(file.mtimeMs || Date.now());
      const localOffset = out.offset;
      // En-tete local : bit 3 (tailles dans le descripteur qui suit les donnees), bit 11 (UTF-8).
      // Extra ZIP64 vide reserve : les tailles reelles sont dans le descripteur 64 bits.
      const extra = Buffer.alloc(20);
      extra.writeUInt16LE(0x0001, 0);
      extra.writeUInt16LE(16, 2);
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(45, 4);
      header.writeUInt16LE(0x0808, 6);
      header.writeUInt16LE(8, 8);
      header.writeUInt16LE(time, 10);
      header.writeUInt16LE(date, 12);
      header.writeUInt32LE(0, 14);
      header.writeUInt32LE(MAX32, 18);
      header.writeUInt32LE(MAX32, 22);
      header.writeUInt16LE(name.length, 26);
      header.writeUInt16LE(extra.length, 28);
      await out.write(Buffer.concat([header, name, extra]));

      let crc = 0;
      let size = 0;
      let compressed = 0;
      const source = fs.createReadStream(file.abs);
      source.on("data", (chunk) => {
        crc = zlib.crc32(chunk, crc);
        size += chunk.length;
        onBytes?.(chunk.length);
      });
      await pipeline(
        source,
        zlib.createDeflateRaw({ level: 6 }),
        async (deflated) => {
          for await (const chunk of deflated) {
            compressed += chunk.length;
            await out.write(chunk);
          }
        },
        { signal },
      );

      const descriptor = Buffer.alloc(24);
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(crc >>> 0, 4);
      descriptor.writeBigUInt64LE(BigInt(compressed), 8);
      descriptor.writeBigUInt64LE(BigInt(size), 16);
      await out.write(descriptor);
      central.push({ name, time, date, crc: crc >>> 0, size, compressed, localOffset });
    }

    const centralOffset = out.offset;
    for (const entry of central) {
      const extra = Buffer.alloc(28);
      extra.writeUInt16LE(0x0001, 0);
      extra.writeUInt16LE(24, 2);
      extra.writeBigUInt64LE(BigInt(entry.size), 4);
      extra.writeBigUInt64LE(BigInt(entry.compressed), 12);
      extra.writeBigUInt64LE(BigInt(entry.localOffset), 20);
      const record = Buffer.alloc(46);
      record.writeUInt32LE(0x02014b50, 0);
      record.writeUInt16LE(45, 4);
      record.writeUInt16LE(45, 6);
      record.writeUInt16LE(0x0808, 8);
      record.writeUInt16LE(8, 10);
      record.writeUInt16LE(entry.time, 12);
      record.writeUInt16LE(entry.date, 14);
      record.writeUInt32LE(entry.crc, 16);
      record.writeUInt32LE(MAX32, 20);
      record.writeUInt32LE(MAX32, 24);
      record.writeUInt16LE(entry.name.length, 28);
      record.writeUInt16LE(extra.length, 30);
      record.writeUInt32LE(MAX32, 42);
      await out.write(Buffer.concat([record, entry.name, extra]));
    }
    const centralSize = out.offset - centralOffset;
    const zip64EndOffset = out.offset;

    const end64 = Buffer.alloc(56);
    end64.writeUInt32LE(0x06064b50, 0);
    end64.writeBigUInt64LE(44n, 4);
    end64.writeUInt16LE(45, 12);
    end64.writeUInt16LE(45, 14);
    end64.writeBigUInt64LE(BigInt(central.length), 24);
    end64.writeBigUInt64LE(BigInt(central.length), 32);
    end64.writeBigUInt64LE(BigInt(centralSize), 40);
    end64.writeBigUInt64LE(BigInt(centralOffset), 48);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    locator.writeBigUInt64LE(BigInt(zip64EndOffset), 8);
    locator.writeUInt32LE(1, 16);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Math.min(central.length, 0xffff), 8);
    end.writeUInt16LE(Math.min(central.length, 0xffff), 10);
    end.writeUInt32LE(Math.min(centralSize, MAX32), 12);
    end.writeUInt32LE(MAX32, 16);
    await out.write(Buffer.concat([end64, locator, end]));
    await out.end();
    await fsp.rename(partFile, zipFile);
  } catch (error) {
    out.stream.destroy();
    await fsp.rm(partFile, { force: true });
    throw error;
  }
}

async function readAt(handle, position, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
}

// Liste des fichiers d'une archive (repertoire central, ZIP64 compris).
async function listZip(zipFile) {
  const handle = await fsp.open(zipFile, "r");
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, 22 + 0xffff + 20);
    const tail = await readAt(handle, size - tailLength, tailLength);
    let endAt = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        endAt = i;
        break;
      }
    }
    if (endAt < 0) throw new Error("Archive illisible (fin introuvable).");
    let count = tail.readUInt16LE(endAt + 10);
    let centralSize = tail.readUInt32LE(endAt + 12);
    let centralOffset = tail.readUInt32LE(endAt + 16);
    if (centralOffset === MAX32 && endAt >= 20 && tail.readUInt32LE(endAt - 20) === 0x07064b50) {
      const end64Offset = Number(tail.readBigUInt64LE(endAt - 20 + 8));
      const end64 = await readAt(handle, end64Offset, 56);
      if (end64.readUInt32LE(0) !== 0x06064b50) throw new Error("Archive illisible (ZIP64).");
      count = Number(end64.readBigUInt64LE(32));
      centralSize = Number(end64.readBigUInt64LE(40));
      centralOffset = Number(end64.readBigUInt64LE(48));
    }
    const dir = await readAt(handle, centralOffset, centralSize);
    const entries = [];
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (dir.readUInt32LE(p) !== 0x02014b50) throw new Error("Archive illisible (repertoire).");
      const method = dir.readUInt16LE(p + 10);
      const crc = dir.readUInt32LE(p + 16);
      let compressed = dir.readUInt32LE(p + 20);
      let size = dir.readUInt32LE(p + 24);
      const nameLength = dir.readUInt16LE(p + 28);
      const extraLength = dir.readUInt16LE(p + 30);
      const commentLength = dir.readUInt16LE(p + 32);
      let localOffset = dir.readUInt32LE(p + 42);
      const name = dir.subarray(p + 46, p + 46 + nameLength).toString("utf8");
      const extra = dir.subarray(p + 46 + nameLength, p + 46 + nameLength + extraLength);
      for (let e = 0; e + 4 <= extra.length; ) {
        const id = extra.readUInt16LE(e);
        const len = extra.readUInt16LE(e + 2);
        if (id === 0x0001) {
          let q = e + 4;
          if (size === MAX32) (size = Number(extra.readBigUInt64LE(q))), (q += 8);
          if (compressed === MAX32) (compressed = Number(extra.readBigUInt64LE(q))), (q += 8);
          if (localOffset === MAX32) localOffset = Number(extra.readBigUInt64LE(q));
        }
        e += 4 + len;
      }
      entries.push({ name, method, crc, compressed, size, localOffset });
      p += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  } finally {
    await handle.close();
  }
}

// Chemin a l'interieur de `base` uniquement (pas de "../" : meme garde que safeJoin de modpack.js).
function insideJoin(base, relative) {
  const root = path.resolve(base);
  const target = path.resolve(root, relative);
  if (target === root || !target.startsWith(root + path.sep)) throw new Error(`Entrée d'archive refusée : ${relative}`);
  return target;
}

/** Extrait toute l'archive dans `destDir` (qui doit etre vide ou absent). CRC verifie par fichier. */
async function extractZip(zipFile, destDir, { onBytes, signal } = {}) {
  const entries = await listZip(zipFile);
  const handle = await fsp.open(zipFile, "r");
  try {
    for (const entry of entries) {
      if (signal?.aborted) throw new DOMException("Restauration annulée.", "AbortError");
      if (entry.name.endsWith("/")) {
        await fsp.mkdir(insideJoin(destDir, entry.name), { recursive: true });
        continue;
      }
      const target = insideJoin(destDir, entry.name);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      const local = await readAt(handle, entry.localOffset, 30);
      if (local.readUInt32LE(0) !== 0x04034b50) throw new Error("Archive illisible (en-tête local).");
      const dataStart = entry.localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const raw = fs.createReadStream(null, { fd: handle.fd, start: dataStart, end: dataStart + entry.compressed - 1, autoClose: false });
      let crc = 0;
      const check = new (require("node:stream").Transform)({
        transform(chunk, _enc, cb) {
          crc = zlib.crc32(chunk, crc);
          onBytes?.(chunk.length);
          cb(null, chunk);
        },
      });
      const stages = entry.method === 8 ? [raw, zlib.createInflateRaw(), check] : [raw, check];
      if (entry.compressed === 0) {
        await fsp.writeFile(target, Buffer.alloc(0));
      } else {
        await pipeline(...stages, fs.createWriteStream(target), { signal });
      }
      if (entry.compressed && (crc >>> 0) !== entry.crc) throw new Error(`Fichier abîmé dans l'archive : ${entry.name}`);
    }
  } finally {
    await handle.close();
  }
}

module.exports = { writeZip, listZip, extractZip };
