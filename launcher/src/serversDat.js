// Liste "Multijoueur" de Minecraft : servers.dat, dans le dossier du jeu (NBT non
// compresse, gros-boutiste). Le launcher y ajoute le serveur qu'il lance : sans ca,
// le joueur qui se deconnecte n'a plus l'adresse dans la liste et doit tout
// refermer pour revenir (le lancement rapide n'ajoute rien a la liste).
//
// On n'ecrit que ce qu'il faut : les octets existants sont recopies tels quels, la
// nouvelle entree est inseree en tete de la liste "servers" (les serveurs propres du
// joueur, leurs icones et leurs reglages ne sont jamais reecrits). Au moindre doute
// (fichier compresse, format inattendu) on ne touche a rien.
//
// Node pur, sans dependance a Electron (testable en ligne de commande).
const fs = require("node:fs");
const path = require("node:path");

const TAG_END = 0;
const TAG_BYTE = 1;
const TAG_STRING = 8;
const TAG_LIST = 9;
const TAG_COMPOUND = 10;
const FIXED_SIZE = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 4, 6: 8 }; // byte, short, int, long, float, double

// NBT encode les chaines en "UTF-8 modifie" (Java) : U+0000 sur deux octets et les
// caracteres hors plan de base (emojis) en paires de substituts sur 3 octets chacun.
function encodeMutf8(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit !== 0 && unit < 0x80) bytes.push(unit);
    else if (unit < 0x800) bytes.push(0xc0 | (unit >> 6), 0x80 | (unit & 0x3f));
    else bytes.push(0xe0 | (unit >> 12), 0x80 | ((unit >> 6) & 0x3f), 0x80 | (unit & 0x3f));
  }
  return Buffer.from(bytes);
}

function decodeMutf8(buf) {
  let out = "";
  for (let i = 0; i < buf.length; ) {
    const b = buf[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i += 1;
    } else if ((b & 0xe0) === 0xc0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (buf[i + 1] & 0x3f));
      i += 2;
    } else {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((buf[i + 1] & 0x3f) << 6) | (buf[i + 2] & 0x3f));
      i += 3;
    }
  }
  return out;
}

function need(buf, pos, length) {
  if (pos + length > buf.length) throw new Error("servers.dat tronque ou illisible");
}

// Position juste apres le contenu (sans nom ni type) d'un tag de type `type` commencant a `pos`.
function skipPayload(buf, pos, type) {
  if (FIXED_SIZE[type]) {
    need(buf, pos, FIXED_SIZE[type]);
    return pos + FIXED_SIZE[type];
  }
  if (type === 7 || type === 11 || type === 12) {
    need(buf, pos, 4);
    const length = buf.readInt32BE(pos);
    if (length < 0) throw new Error("servers.dat : taille de tableau invalide");
    const end = pos + 4 + length * (type === 7 ? 1 : type === 11 ? 4 : 8);
    need(buf, end, 0);
    return end;
  }
  if (type === TAG_STRING) {
    need(buf, pos, 2);
    const end = pos + 2 + buf.readUInt16BE(pos);
    need(buf, end, 0);
    return end;
  }
  if (type === TAG_LIST) {
    need(buf, pos, 5);
    const elementType = buf[pos];
    let cursor = pos + 5;
    for (let n = buf.readInt32BE(pos + 1); n > 0; n--) cursor = skipPayload(buf, cursor, elementType);
    return cursor;
  }
  if (type === TAG_COMPOUND) {
    let cursor = pos;
    for (;;) {
      need(buf, cursor, 1);
      if (buf[cursor] === TAG_END) return cursor + 1;
      cursor = skipPayload(buf, readTagHeader(buf, cursor).payloadPos, buf[cursor]);
    }
  }
  throw new Error(`servers.dat : type de tag inconnu (${type})`);
}

// Tag nomme a `pos` : { name, payloadPos }.
function readTagHeader(buf, pos) {
  need(buf, pos, 3);
  const nameLength = buf.readUInt16BE(pos + 1);
  need(buf, pos + 3, nameLength);
  return { name: decodeMutf8(buf.subarray(pos + 3, pos + 3 + nameLength)), payloadPos: pos + 3 + nameLength };
}

function stringTag(name, value) {
  const nameBytes = encodeMutf8(name);
  const valueBytes = encodeMutf8(value);
  const head = Buffer.alloc(3);
  head[0] = TAG_STRING;
  head.writeUInt16BE(nameBytes.length, 1);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(valueBytes.length);
  return Buffer.concat([head, nameBytes, length, valueBytes]);
}

// Une entree de la liste : compound { ip, name } (sans en-tete, elle est dans une liste).
function entryBytes({ name, ip }) {
  return Buffer.concat([stringTag("ip", ip), stringTag("name", name), Buffer.from([TAG_END])]);
}

const int32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n);
  return b;
};

// "Play.Example.com:25565" et "play.example.com" designent la meme entree.
const normalizeIp = (ip) => ip.trim().toLowerCase().replace(/:25565$/, "");

// Une entree existante de la liste `servers` (compound commencant a `pos`) :
// { ip, hidden, tags: [{ name, start, end }], end }. `hidden` : Minecraft (1.20.2+)
// enregistre les serveurs rejoints par lancement rapide ou connexion directe avec
// hidden=1 — ils sont dans le fichier mais absents de la liste affichee.
function readEntry(buf, pos) {
  const tags = [];
  let ip = null;
  let hidden = false;
  for (;;) {
    need(buf, pos, 1);
    const type = buf[pos];
    if (type === TAG_END) return { ip, hidden, tags, end: pos + 1 };
    const { name, payloadPos } = readTagHeader(buf, pos);
    const end = skipPayload(buf, payloadPos, type);
    if (type === TAG_STRING && name === "ip") ip = decodeMutf8(buf.subarray(payloadPos + 2, end));
    if (type === TAG_BYTE && name === "hidden") hidden = buf[payloadPos] !== 0;
    tags.push({ name, start: pos, end });
    pos = end;
  }
}

/**
 * Renvoie le nouveau contenu de servers.dat avec { name, ip } en tete de liste, ou
 * `null` si l'adresse y est deja. `buf` : contenu actuel (ou null s'il n'existe pas).
 */
function withServer(buf, { name, ip }) {
  const entry = entryBytes({ name, ip });
  const newList = Buffer.concat([Buffer.from([TAG_LIST]), Buffer.from([0, 7]), Buffer.from("servers"), Buffer.from([TAG_COMPOUND]), int32(1), entry]);

  if (!buf) return Buffer.concat([Buffer.from([TAG_COMPOUND, 0, 0]), newList, Buffer.from([TAG_END])]);
  if (buf[0] === 0x1f && buf[1] === 0x8b) throw new Error("servers.dat est compresse (format inattendu)");
  if (buf[0] !== TAG_COMPOUND) throw new Error("servers.dat : format inattendu");

  let pos = readTagHeader(buf, 0).payloadPos;
  for (;;) {
    need(buf, pos, 1);
    const type = buf[pos];
    if (type === TAG_END) {
      // Pas de liste "servers" (fichier vide de Minecraft) : on l'ajoute avant la fin.
      return Buffer.concat([buf.subarray(0, pos), newList, buf.subarray(pos)]);
    }
    const { name: tagName, payloadPos } = readTagHeader(buf, pos);
    if (tagName === "servers" && type === TAG_LIST) {
      need(buf, payloadPos, 5);
      const elementType = buf[payloadPos];
      const count = buf.readInt32BE(payloadPos + 1);
      if (elementType !== TAG_COMPOUND && count > 0) throw new Error("servers.dat : liste des serveurs inattendue");
      let cursor = payloadPos + 5;
      const wanted = normalizeIp(ip);
      let hiddenMatch = null;
      for (let n = 0; n < count; n++) {
        const found = readEntry(buf, cursor);
        if (found.ip !== null && normalizeIp(found.ip) === wanted) {
          if (!found.hidden) return null; // deja visible dans la liste
          hiddenMatch = hiddenMatch || { start: cursor, ...found };
        }
        cursor = found.end;
      }
      if (hiddenMatch) {
        // Serveur present mais cache : on le rend visible, en tete de liste, sous son
        // vrai nom (le nom d'une entree cachee est toujours le nom par defaut) ; son
        // icone et ses autres reglages sont gardes.
        const revealed = Buffer.concat([
          ...hiddenMatch.tags.filter((tag) => tag.name !== "hidden" && tag.name !== "name").map((tag) => buf.subarray(tag.start, tag.end)),
          stringTag("name", name),
          Buffer.from([TAG_END]),
        ]);
        return Buffer.concat([buf.subarray(0, payloadPos + 5), revealed, buf.subarray(payloadPos + 5, hiddenMatch.start), buf.subarray(hiddenMatch.end)]);
      }
      // Liste vide (type "End" chez Minecraft) : devient une liste de compounds.
      return Buffer.concat([buf.subarray(0, payloadPos), Buffer.from([TAG_COMPOUND]), int32(count + 1), entry, buf.subarray(payloadPos + 5)]);
    }
    pos = skipPayload(buf, payloadPos, type);
  }
}

/**
 * Ajoute { name, ip } a la liste Multijoueur de `gameDir` si l'adresse n'y est pas.
 * Renvoie true si le fichier a ete modifie. Ecrit comme Minecraft (fichier
 * temporaire puis remplacement, ancienne version gardee en servers.dat_old).
 * Leve une erreur (sans rien modifier) si le fichier existant est inattendu.
 */
function addServerToList(gameDir, { name, ip }) {
  const address = String(ip || "").trim();
  if (!address || address.length > 255) return false;
  const label = String(name || address).slice(0, 100);

  const file = path.join(gameDir, "servers.dat");
  const current = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const next = withServer(current, { name: label, ip: address });
  if (!next) return false;

  fs.mkdirSync(gameDir, { recursive: true });
  const tmp = `${file}_new`;
  fs.writeFileSync(tmp, next);
  if (current) fs.copyFileSync(file, `${file}_old`);
  fs.renameSync(tmp, file);
  return true;
}

module.exports = { addServerToList, withServer, encodeMutf8, decodeMutf8 };
