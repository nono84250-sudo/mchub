import { createHmac, timingSafeEqual } from "node:crypto";

// Jeton de session du launcher (point 3 de la securite). Module sans dependance
// Next ni base de donnees pour pouvoir etre teste seul (voir launcherAuth.ts
// pour la resolution d'identite et la verification de revocation en base).
//
// Le launcher echange son jeton Mojang contre un jeton de session signe
// (POST /api/launcher/session), valable 15 minutes, qu'il envoie ensuite dans
// X-Launcher-Session. Il le renouvelle lui-meme avant expiration (voir
// launcher/src/main.js). Format : base64url(JSON {u: uuid, n: pseudo, iat, exp}) + "." +
// base64url(HMAC-SHA256(LAUNCHER_SESSION_SECRET, partie gauche)). iat et exp
// sont en millisecondes.
//
// Revocation : la colonne User.sessionsValidAfter (POST /api/launcher/session/revoke,
// appele a la deconnexion) refuse tout jeton emis avant cette date.

export const LAUNCHER_SESSION_HEADER = "x-launcher-session";
export const LAUNCHER_SESSION_TTL_MS = 15 * 60_000;
const MIN_SESSION_SECRET_LENGTH = 32;

export function normalizeMinecraftUuid(uuid: string): string {
  return uuid.toLowerCase().replaceAll("-", "");
}

// Pseudo Minecraft tel que Mojang le renvoie (lettres, chiffres, "_", 16 caracteres max), ou
// null. Le pseudo ne vient JAMAIS du corps d'une requete launcher : seulement du profil Mojang
// verifie, ou d'un jeton de session signe qui le tient lui-meme de Mojang (audit 14/10, B2 :
// avant, un joueur pouvait se renommer « Notch »).
export function sanitizeMinecraftName(name: unknown): string | null {
  return typeof name === "string" && /^[A-Za-z0-9_]{1,16}$/.test(name) ? name : null;
}

function sessionSecret(): string | null {
  const secret = process.env.LAUNCHER_SESSION_SECRET;
  return secret && secret.length >= MIN_SESSION_SECRET_LENGTH ? secret : null;
}

function signPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

// Cree un jeton pour un UUID (et son pseudo) deja verifies aupres de Mojang. `nowMs` ne sert
// qu'aux tests. Renvoie null si le secret manque ou est trop court.
export function createLauncherSession(
  uuid: string,
  name: string | null = null,
  nowMs: number = Date.now(),
): { token: string; expiresAt: number } | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const expiresAt = nowMs + LAUNCHER_SESSION_TTL_MS;
  const n = sanitizeMinecraftName(name);
  const payloadB64 = Buffer.from(JSON.stringify({ u: normalizeMinecraftUuid(uuid), ...(n ? { n } : {}), iat: nowMs, exp: expiresAt })).toString("base64url");
  return { token: `${payloadB64}.${signPayload(payloadB64, secret)}`, expiresAt };
}

// name : null pour un jeton emis avant l'ajout du pseudo (14/10), valable 15 min au plus.
export type LauncherSessionClaims = { uuid: string; issuedAt: number; name: string | null };

// Renvoie l'UUID (normalise), le pseudo et la date d'emission si le jeton est authentique
// et non expire, sinon null. Ne regarde PAS la revocation (voir isSessionRevoked).
export function readLauncherSession(token: string, nowMs: number = Date.now()): LauncherSessionClaims | null {
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
    const { u, n, iat, exp } = payload as { u?: unknown; n?: unknown; iat?: unknown; exp?: unknown };
    if (typeof u !== "string" || !/^[0-9a-f]{32}$/.test(u)) return null;
    if (typeof iat !== "number" || typeof exp !== "number") return null;
    if (exp <= nowMs || iat > exp) return null;
    return { uuid: u, issuedAt: iat, name: sanitizeMinecraftName(n) };
  } catch {
    return null;
  }
}

// Vrai si un jeton emis a `issuedAt` est anterieur a la revocation enregistree
// (User.sessionsValidAfter, chaine ISO, ou null si jamais revoque).
export function isSessionRevoked(issuedAt: number, sessionsValidAfter: string | null | undefined): boolean {
  if (!sessionsValidAfter) return false;
  const revokedAt = Date.parse(sessionsValidAfter);
  return Number.isFinite(revokedAt) && issuedAt < revokedAt;
}
