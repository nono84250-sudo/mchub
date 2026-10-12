// Ping direct d'un serveur Minecraft (Java) via le protocole "Server List Ping" —
// portage cote launcher de site/src/lib/mc-ping.ts (meme protocole, memes paquets).
// Duplique plutot que partage : le site tourne sur Vercel (jamais de code partage avec
// Electron sans bundler dedie), et le launcher n'a pas besoin du garde-fou SSRF du site
// (isPrivateOrReservedAddress) — ici c'est le joueur lui-meme qui ping SON PROPRE serveur
// depuis SA PROPRE machine, exactement comme le fait deja le jeu quand il s'y connecte.
//
// Sert l'auto-test de publication (voir selftest:run dans main.js) : check #1 "Serveur
// joignable" (un ping simple, avant tout lancement).
const { Socket, isIP } = require("node:net");
const dns = require("node:dns/promises");

const PING_TIMEOUT_MS = 3000;
const SRV_RESOLVE_TIMEOUT_MS = 4000;
const DEFAULT_PORT = 25565;
const HANDSHAKE_PROTOCOL_VERSION = 767;

function parseServerAddress(address) {
  const trimmed = address.trim();
  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon === -1) return { host: trimmed, port: DEFAULT_PORT };
  const host = trimmed.slice(0, lastColon);
  const port = Number(trimmed.slice(lastColon + 1));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return { host: trimmed, port: DEFAULT_PORT };
  return { host, port };
}

// dns.resolveSrv (version promises) n'accepte pas de signal d'annulation dans
// cette version de Node — un Promise.race avec un delai est le seul moyen de ne
// pas rester bloque si la resolution DNS ne repond jamais (PING_TIMEOUT_MS ne
// protege que la connexion TCP qui suit, pas cette etape, trouve par l'audit du
// 2026-10-10).
async function resolveSrvTarget(host) {
  let timer;
  try {
    const records = await Promise.race([
      dns.resolveSrv(`_minecraft._tcp.${host}`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Résolution DNS SRV trop longue")), SRV_RESOLVE_TIMEOUT_MS);
      }),
    ]);
    const [best] = records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
    return best ? { host: best.name.replace(/\.$/, ""), port: best.port } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function writeVarInt(value) {
  const bytes = [];
  let v = value;
  do {
    let temp = v & 0b0111_1111;
    v >>>= 7;
    if (v !== 0) temp |= 0b1000_0000;
    bytes.push(temp);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function writeString(value) {
  const strBuf = Buffer.from(value, "utf8");
  return Buffer.concat([writeVarInt(strBuf.length), strBuf]);
}

function readVarInt(buf, offset) {
  let result = 0;
  let shift = 0;
  let pos = offset;
  for (;;) {
    if (pos >= buf.length) return null;
    const byte = buf[pos];
    result |= (byte & 0b0111_1111) << shift;
    pos++;
    if ((byte & 0b1000_0000) === 0) break;
    shift += 7;
    if (shift > 35) throw new Error("VarInt trop long dans la réponse du serveur");
  }
  return { value: result >>> 0, bytesRead: pos - offset };
}

function buildHandshakePacket(host, port) {
  const body = Buffer.concat([
    writeVarInt(0x00),
    writeVarInt(HANDSHAKE_PROTOCOL_VERSION),
    writeString(host),
    (() => {
      const b = Buffer.alloc(2);
      b.writeUInt16BE(port, 0);
      return b;
    })(),
    writeVarInt(1),
  ]);
  return Buffer.concat([writeVarInt(body.length), body]);
}

function buildStatusRequestPacket() {
  const body = writeVarInt(0x00);
  return Buffer.concat([writeVarInt(body.length), body]);
}

function tryParseStatusResponse(buffer) {
  const packetLength = readVarInt(buffer, 0);
  if (!packetLength) return null;
  const packetStart = packetLength.bytesRead;
  if (buffer.length < packetStart + packetLength.value) return null;

  const packetId = readVarInt(buffer, packetStart);
  if (!packetId) return null;
  const afterPacketId = packetStart + packetId.bytesRead;

  const jsonLength = readVarInt(buffer, afterPacketId);
  if (!jsonLength) return null;
  const jsonStart = afterPacketId + jsonLength.bytesRead;
  const jsonEnd = jsonStart + jsonLength.value;
  if (buffer.length < jsonEnd) return null;

  const jsonStr = buffer.subarray(jsonStart, jsonEnd).toString("utf8");
  const data = JSON.parse(jsonStr);

  return {
    online: typeof data.players?.online === "number" ? data.players.online : 0,
    max: typeof data.players?.max === "number" ? data.players.max : 0,
    versionName: typeof data.version?.name === "string" ? data.version.name : null,
  };
}

/**
 * Interroge un serveur Minecraft (Java) via Server List Ping. Ne lève jamais :
 * renvoie `null` si le serveur est hors ligne, injoignable, ou ne répond pas
 * dans le délai imparti. Renvoie `{ online, max, versionName, pingMs }` sinon
 * (pingMs : temps écoulé entre l'ouverture de la connexion TCP et la réponse
 * complète du serveur — simple Date.now() delta, utilisé par le check #1 de
 * l'auto-test de publication pour afficher une latence concrète).
 */
async function pingMinecraftServer(address) {
  let { host, port } = parseServerAddress(address);
  if (port === DEFAULT_PORT && !isIP(host)) {
    const srv = await resolveSrvTarget(host);
    if (srv) ({ host, port } = srv);
  }

  const startedAt = Date.now();

  return new Promise((resolve) => {
    const socket = new Socket();
    let received = Buffer.alloc(0);
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result && { ...result, pingMs: Date.now() - startedAt });
    };

    socket.setTimeout(PING_TIMEOUT_MS);
    socket.on("timeout", () => finish(null));
    socket.on("error", () => finish(null));

    socket.connect(port, host, () => {
      socket.write(buildHandshakePacket(host, port));
      socket.write(buildStatusRequestPacket());
    });

    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk]);
      try {
        const status = tryParseStatusResponse(received);
        if (status) finish(status);
      } catch {
        finish(null);
      }
    });
  });
}

module.exports = { pingMinecraftServer };
