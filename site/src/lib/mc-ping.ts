import { Socket } from "node:net";
import { lookup } from "node:dns/promises";
import { isPrivateOrReservedAddress } from "@/lib/ssrfGuard";

// Implémentation directe du protocole "Server List Ping" de Minecraft
// (handshake -> status request -> status response en JSON). Ne dépend
// d'aucun paquet tiers : le protocole est stable et documenté par la
// communauté (wiki.vg / minecraft.wiki), et l'unique lib npm existante
// pour ça est explicitement abandonnée par son propre auteur.

export type MinecraftServerStatus = {
  online: number;
  max: number;
};

const PING_TIMEOUT_MS = 3000;
const DEFAULT_PORT = 25565;
// Numéro de version protocole envoyé dans le handshake : n'a pas besoin
// de correspondre exactement à la version du serveur pour une requête de
// statut, le serveur répond quel que soit ce nombre.
const HANDSHAKE_PROTOCOL_VERSION = 767;

function parseServerAddress(address: string): { host: string; port: number } {
  const trimmed = address.trim();
  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon === -1) {
    return { host: trimmed, port: DEFAULT_PORT };
  }
  const host = trimmed.slice(0, lastColon);
  const port = Number(trimmed.slice(lastColon + 1));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { host: trimmed, port: DEFAULT_PORT };
  }
  return { host, port };
}

function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value;
  do {
    let temp = v & 0b0111_1111;
    v >>>= 7;
    if (v !== 0) temp |= 0b1000_0000;
    bytes.push(temp);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function writeString(value: string): Buffer {
  const strBuf = Buffer.from(value, "utf8");
  return Buffer.concat([writeVarInt(strBuf.length), strBuf]);
}

function readVarInt(buf: Buffer, offset: number): { value: number; bytesRead: number } | null {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (true) {
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

function buildHandshakePacket(host: string, port: number): Buffer {
  const body = Buffer.concat([
    writeVarInt(0x00),
    writeVarInt(HANDSHAKE_PROTOCOL_VERSION),
    writeString(host),
    (() => {
      const b = Buffer.alloc(2);
      b.writeUInt16BE(port, 0);
      return b;
    })(),
    writeVarInt(1), // next state: status
  ]);
  return Buffer.concat([writeVarInt(body.length), body]);
}

function buildStatusRequestPacket(): Buffer {
  const body = writeVarInt(0x00);
  return Buffer.concat([writeVarInt(body.length), body]);
}

function tryParseStatusResponse(buffer: Buffer): MinecraftServerStatus | null {
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
  const data = JSON.parse(jsonStr) as { players?: { online?: number; max?: number } };

  return {
    online: typeof data.players?.online === "number" ? data.players.online : 0,
    max: typeof data.players?.max === "number" ? data.players.max : 0,
  };
}

/**
 * Interroge un serveur Minecraft (Java) via le protocole Server List Ping.
 * Ne lève jamais : retourne `null` si le serveur est hors ligne, injoignable,
 * ou ne répond pas dans le délai imparti.
 */
export async function pingMinecraftServer(address: string): Promise<MinecraftServerStatus | null> {
  const { host, port } = parseServerAddress(address);

  // Resout et verifie l'adresse REELLE avant toute connexion — jamais le nom
  // d'hote tel quel, pour attraper aussi bien une IP privee saisie
  // directement qu'un nom de domaine qui y pointe (voir ssrfGuard.ts).
  // Refait a chaque appel (donc a chaque ping periodique), pas seulement a
  // l'enregistrement du serveur, pour resister au DNS rebinding.
  let resolvedAddress: string;
  try {
    resolvedAddress = (await lookup(host)).address;
  } catch {
    return null;
  }
  if (isPrivateOrReservedAddress(resolvedAddress)) return null;

  return new Promise((resolve) => {
    const socket = new Socket();
    let received = Buffer.alloc(0);
    let settled = false;

    const finish = (result: MinecraftServerStatus | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(PING_TIMEOUT_MS);

    socket.on("timeout", () => finish(null));
    socket.on("error", () => finish(null));

    socket.connect(port, resolvedAddress, () => {
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
