import { createHmac, randomBytes, scrypt as scryptCb, scryptSync, timingSafeEqual } from "node:crypto";
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
// iat (emission) permet a adminSession.ts de revoquer une session emise avant le dernier
// changement de mot de passe (adminAccount.passwordChangedAt) — sans ca, un cookie vole restait
// valide jusqu'a 8h meme apres un changement de mot de passe (audit du 2026-10-10).
export type AdminSession = { sub: string; role: AdminRole; exp: number; iat: number };

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

// Hash factice, meme format qu'un vrai (mais sans compte derriere) : a passer a verifyPassword
// quand le nom d'utilisateur n'existe pas, pour que le login prenne le meme temps que si le
// compte existait (sinon un attaquant peut deviner des noms d'utilisateur valides rien qu'en
// mesurant le temps de reponse — scrypt est volontairement lent). Calcule une fois au demarrage
// (scryptSync, pas besoin d'etre secret, juste du meme ordre de grandeur en temps de calcul).
export const DUMMY_PASSWORD_HASH = `scrypt$${Buffer.alloc(16).toString("base64")}$${scryptSync("dummy", Buffer.alloc(16), 64).toString("base64")}`;

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
  const payload = Buffer.from(
    JSON.stringify({ sub, role, exp: nowMs + ADMIN_SESSION_TTL_MS, iat: nowMs } satisfies AdminSession),
  ).toString("base64url");
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
    // Jeton emis avant l'ajout de "iat" (deploiement de ce correctif) : 0 plutot que de le
    // rejeter — force juste une revocation au prochain changement de mot de passe au lieu
    // d'aucune revocation possible, jamais une deconnexion immediate de tout le monde.
    if (typeof data.iat !== "number") data.iat = 0;
    return data;
  } catch {
    return null;
  }
}
