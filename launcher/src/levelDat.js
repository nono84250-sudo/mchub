// Lecture du level.dat d'un monde Minecraft (mode Jouer, 24/10) : nom affiche dans le jeu,
// version qui l'a ouvert en dernier, date de derniere partie, mode de jeu. Format NBT compresse
// en gzip (big-endian). Lecture seule : on n'ecrit jamais dans un level.dat.
const fsp = require("node:fs/promises");
const zlib = require("node:zlib");

function parseNbt(buffer) {
  let p = 0;
  const u8 = () => buffer.readUInt8(p++);
  const i16 = () => ((p += 2), buffer.readInt16BE(p - 2));
  const u16 = () => ((p += 2), buffer.readUInt16BE(p - 2));
  const i32 = () => ((p += 4), buffer.readInt32BE(p - 4));
  const i64 = () => ((p += 8), buffer.readBigInt64BE(p - 8));
  const str = () => {
    const len = u16();
    p += len;
    return buffer.toString("utf8", p - len, p);
  };
  const payload = (type, depth) => {
    if (depth > 64) throw new Error("NBT trop profond");
    switch (type) {
      case 1: return buffer.readInt8(p++);
      case 2: return i16();
      case 3: return i32();
      case 4: return Number(i64());
      case 5: return (p += 4), buffer.readFloatBE(p - 4);
      case 6: return (p += 8), buffer.readDoubleBE(p - 8);
      case 7: { const n = i32(); p += n; return null; }
      case 8: return str();
      case 9: {
        const itemType = u8();
        const n = i32();
        const list = [];
        for (let i = 0; i < n; i++) list.push(payload(itemType, depth + 1));
        return list;
      }
      case 10: {
        const obj = {};
        for (;;) {
          const t = u8();
          if (t === 0) return obj;
          const name = str();
          obj[name] = payload(t, depth + 1);
        }
      }
      case 11: { const n = i32(); p += n * 4; return null; }
      case 12: { const n = i32(); p += n * 8; return null; }
      default: throw new Error(`Type NBT inconnu : ${type}`);
    }
  };
  const rootType = u8();
  if (rootType !== 10) throw new Error("NBT : racine inattendue");
  str();
  return payload(10, 0);
}

/** Renvoie { name, version, lastPlayed, gameType, hardcore } ou null si illisible. */
async function readLevelDat(file) {
  try {
    const raw = await fsp.readFile(file);
    const data = parseNbt(raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw)?.Data || {};
    return {
      name: typeof data.LevelName === "string" ? data.LevelName : null,
      version: typeof data.Version?.Name === "string" ? data.Version.Name : null,
      lastPlayed: typeof data.LastPlayed === "number" ? data.LastPlayed : null,
      gameType: typeof data.GameType === "number" ? data.GameType : null,
      hardcore: data.hardcore === 1,
    };
  } catch {
    return null;
  }
}

module.exports = { readLevelDat, parseNbt };
