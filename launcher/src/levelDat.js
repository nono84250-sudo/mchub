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

// Monde modé ? (26/10, un monde CurseForge ouvert en vanilla dans Jouer a été abîmé) Le jeu note
// le chargeur dans Data.ServerBrands (« forge », « neoforge », « fabric », « quilt ») et WasModded ;
// Forge et NeoForge listent aussi leurs mods dans Data.DataPacks.Enabled (« mod:<id> »). Fabric
// ne note pas la liste de ses mods : on connaît seulement le chargeur.
const LOADERS = ["neoforge", "forge", "quilt", "fabric"];
const NOT_MODS = new Set(["minecraft", "forge", "neoforge", "fabric", "quilt"]);
function detectMods(root, data) {
  const brands = (Array.isArray(data.ServerBrands) ? data.ServerBrands : []).filter((b) => typeof b === "string").map((b) => b.toLowerCase());
  const packs = (Array.isArray(data.DataPacks?.Enabled) ? data.DataPacks.Enabled : []).filter((p) => typeof p === "string");
  const ids = [...new Set(packs.filter((p) => p.startsWith("mod:")).map((p) => p.slice(4)).filter((id) => id && !NOT_MODS.has(id)))];
  let loader = LOADERS.find((l) => brands.includes(l)) || null;
  if (!loader && ids.length) loader = packs.includes("mod:neoforge") ? "neoforge" : "forge";
  if (!loader && packs.includes("fabric")) loader = "fabric";
  if (!loader && (root.fml || root.FML)) loader = "forge";
  if (!loader && data.WasModded !== 1) return null;
  return { loader: loader || null, count: ids.length, ids: ids.slice(0, 1000) };
}

/** Renvoie { name, version, lastPlayed, gameType, hardcore, mods } ou null si illisible.
 *  `mods` : null pour un monde vanilla, sinon { loader, count, ids } (voir detectMods). */
async function readLevelDat(file) {
  try {
    return levelFromBuffer(await fsp.readFile(file));
  } catch {
    return null;
  }
}
// Même lecture depuis le contenu du fichier (monde dans un export CurseForge .zip, 26/10).
async function readLevelBuffer(raw) {
  try {
    return levelFromBuffer(raw);
  } catch {
    return null;
  }
}
function levelFromBuffer(raw) {
  const root = parseNbt(raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw) || {};
  const data = root.Data || {};
  return {
    name: typeof data.LevelName === "string" ? data.LevelName : null,
    version: typeof data.Version?.Name === "string" ? data.Version.Name : null,
    lastPlayed: typeof data.LastPlayed === "number" ? data.LastPlayed : null,
    gameType: typeof data.GameType === "number" ? data.GameType : null,
    hardcore: data.hardcore === 1,
    mods: detectMods(root, data),
  };
}

module.exports = { readLevelDat, readLevelBuffer, parseNbt };
