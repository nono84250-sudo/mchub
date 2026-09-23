import { randomBytes, randomInt } from "node:crypto";
import { db } from "@/prisma/db";

// Codes/jetons ephemeres pour verification d'email et reinitialisation de
// mot de passe (voir AuthToken dans contract.prisma) — meme principe que
// minecraftLink.ts, factorise ici puisque signup/mot de passe oublie/lien
// depuis /account partagent tous "generer un token, l'envoyer, le
// consommer une fois".

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

function generateShortCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function generateLongToken(): string {
  return randomBytes(32).toString("base64url");
}

type AuthTokenKind = "email_verify" | "password_reset";

// Un seul token actif a la fois par (compte, type) : en generer un nouveau
// invalide silencieusement le precedent.
async function createAuthToken(userId: string, kind: AuthTokenKind, token: string, ttlMs: number): Promise<string> {
  await db.orm.public.AuthToken.where({ userId, kind }).delete();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await db.orm.public.AuthToken.create({ token, userId, kind, expiresAt });
  return token;
}

export function createEmailVerifyCode(userId: string): Promise<string> {
  return createAuthToken(userId, "email_verify", generateShortCode(), CODE_TTL_MS);
}

export function createPasswordResetCode(userId: string): Promise<string> {
  return createAuthToken(userId, "password_reset", generateShortCode(), CODE_TTL_MS);
}

export function createPasswordResetLinkToken(userId: string): Promise<string> {
  return createAuthToken(userId, "password_reset", generateLongToken(), LINK_TOKEN_TTL_MS);
}

// Verifie un token/code sans le consommer — utilise par email_verify (le
// mot de passe doit encore etre re-verifie via signIn ensuite, voir
// verifySignupCode) et par la page /reset-password (verifie le token du
// lien avant meme d'afficher le formulaire).
export async function peekAuthToken(token: string, kind: AuthTokenKind): Promise<{ userId: string } | null> {
  const row = await db.orm.public.AuthToken.where({ token, kind }).first();
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) return null;
  return { userId: row.userId };
}

export async function consumeAuthToken(token: string, kind: AuthTokenKind): Promise<{ userId: string } | null> {
  const row = await db.orm.public.AuthToken.where({ token, kind }).first();
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) return null;
  await db.orm.public.AuthToken.where({ id: row.id }).delete();
  return { userId: row.userId };
}
