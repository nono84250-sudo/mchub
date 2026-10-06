import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Authentification du panel administrateur (/admin), séparée des comptes Microsoft
// des joueurs. Mot de passe : scrypt (intégré à Node, pas de dépendance). Session :
// jeton signé HMAC-SHA256 dans un cookie httpOnly, valable 8 heures.

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const ADMIN_COOKIE = "omni_admin";
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 12;

export type AdminRole = "admin" | "moderator";
export type AdminSession = { sub: string; role: AdminRole; exp: number };

function sessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Règle minimale : longueur et au moins deux types de caractères.
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  if (kinds < 2) return "Le mot de passe doit mélanger au moins deux types de caractères (lettres, chiffres, symboles).";
  return null;
}

export function createAdminSession(sub: string, role: AdminRole, nowMs: number = Date.now()): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ sub, role, exp: nowMs + ADMIN_SESSION_TTL_MS } satisfies AdminSession)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readAdminSession(token: string | undefined, nowMs: number = Date.now()): AdminSession | null {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("base64url"));
  const actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (typeof data.sub !== "string" || (data.role !== "admin" && data.role !== "moderator")) return null;
    if (typeof data.exp !== "number" || data.exp <= nowMs) return null;
    return data;
  } catch {
    return null;
  }
}
