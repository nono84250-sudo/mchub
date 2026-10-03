import { createHmac, timingSafeEqual } from "node:crypto";

// Jeton de session du launcher (point 3 de la securite). Module sans dependance
// Next pour pouvoir etre teste seul (voir launcherAuth.ts pour la verification
// Mojang et la resolution d'identite des requetes).
//
// Le launcher echange son jeton Mojang contre un jeton de session signe
// (POST /api/launcher/session), valable 24 h, qu'il envoie ensuite dans
// X-Launcher-Session. Format : base64url(JSON {u: uuid, exp: secondes}) + "." +
// base64url(HMAC-SHA256(LAUNCHER_SESSION_SECRET, partie gauche)).
//
// Ce que ca change : le jeton Mojang n'est plus envoye a chaque requete (une
// seule fois par jour au moment de l'echange), et Mojang n'est plus interroge
// a chaque fois. Ce que ca ne change PAS : le jeton de session est un porteur,
// utilisable tel quel pendant 24 h ; il n'est pas revocable (pas de liste en
// base, voir le rapport) ; et tant que X-Minecraft-Token reste accepte, qui
// detient le jeton Mojang peut toujours appeler les memes routes.

export const LAUNCHER_SESSION_HEADER = "x-launcher-session";
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const MIN_SESSION_SECRET_LENGTH = 32;

export function normalizeMinecraftUuid(uuid: string): string {
  return uuid.toLowerCase().replaceAll("-", "");
}

function sessionSecret(): string | null {
  const secret = process.env.LAUNCHER_SESSION_SECRET;
  return secret && secret.length >= MIN_SESSION_SECRET_LENGTH ? secret : null;
}

function signPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

// Cree un jeton pour un UUID deja verifie aupres de Mojang. `nowSec` ne sert
// qu'aux tests (fabriquer un jeton expire). Renvoie null si le secret manque.
export function createLauncherSession(
  uuid: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): { token: string; expiresAt: number } | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const exp = nowSec + SESSION_TTL_SECONDS;
  const payloadB64 = Buffer.from(JSON.stringify({ u: normalizeMinecraftUuid(uuid), exp })).toString("base64url");
  return { token: `${payloadB64}.${signPayload(payloadB64, secret)}`, expiresAt: exp * 1000 };
}

// Renvoie l'UUID (normalise) si le jeton est authentique et non expire, sinon null.
export function readLauncherSession(token: string, nowSec: number = Math.floor(Date.now() / 1000)): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expected = Buffer.from(signPayload(payloadB64, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload: unknown = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return null;
    const { u, exp } = payload as { u?: unknown; exp?: unknown };
    if (typeof u !== "string" || !/^[0-9a-f]{32}$/.test(u)) return null;
    if (typeof exp !== "number" || exp <= nowSec) return null;
    return u;
  } catch {
    return null;
  }
}
