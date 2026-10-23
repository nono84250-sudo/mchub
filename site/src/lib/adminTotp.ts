import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Double authentification (TOTP, RFC 6238) du panel admin : codes à 6 chiffres renouvelés
// toutes les 30 secondes, compatibles Google/Microsoft Authenticator, Aegis, 2FAS…
// Aucune dépendance externe pour le calcul (HMAC-SHA1 de Node). Obligatoire pour tout le
// staff, jamais pour les joueurs (leur connexion passe par Microsoft).
//
// Le secret TOTP est chiffré en base (AES-256-GCM) avec une clé dérivée de
// ADMIN_SESSION_SECRET : changer ADMIN_SESSION_SECRET rend tous les secrets illisibles, il
// faut alors remettre la 2FA à zéro avec scripts/reset-2fa.mjs (chaque membre la refait).

const PERIOD_S = 30;
const DIGITS = 6;
// Tolérance d'horloge : le code précédent et le suivant sont aussi acceptés (±30 s).
const DRIFT_STEPS = 1;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
// Codes de secours : sans 0/O ni 1/I/L, pour qu'ils se recopient sans erreur depuis le papier.
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 10;
export const TOTP_MAX_FAILURES = 5;
export const TOTP_LOCK_MS = 15 * 60 * 1000;
export const TOTP_ISSUER = "Omniscient";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error("Secret TOTP invalide.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// 20 octets = 160 bits, la taille recommandée par la RFC 4226 pour HMAC-SHA1.
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function totpStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / PERIOD_S);
}

// Renvoie le pas de temps du code accepté (à mémoriser pour refuser qu'il resserve), ou null.
// lastStep : dernier pas déjà utilisé par ce compte — un code intercepté ne peut pas être
// rejoué dans sa fenêtre de validité.
export function verifyTotp(secretBase32: string, code: string, lastStep: number | null, nowMs: number = Date.now()): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const secret = base32Decode(secretBase32);
  const current = totpStep(nowMs);
  for (let step = current - DRIFT_STEPS; step <= current + DRIFT_STEPS; step++) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(clean))) return step;
  }
  return null;
}

export function otpauthUri(accountName: string, secretBase32: string): string {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${accountName}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(TOTP_ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD_S}`;
}

// Affichage du secret à recopier à la main : groupes de 4 caractères.
export function formatSecret(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}

function derivedKey(purpose: string): Buffer | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return Buffer.from(hkdfSync("sha256", secret, "omniscient-admin-2fa", purpose, 32));
}

// Format stocké : v1.<iv>.<tag>.<chiffré>, en base64url.
export function encryptTotpSecret(secretBase32: string): string {
  const key = derivedKey("totp-secret-encryption");
  if (!key) throw new Error("ADMIN_SESSION_SECRET manquant : impossible de chiffrer le secret 2FA.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(secretBase32, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptTotpSecret(stored: string): string | null {
  const key = derivedKey("totp-secret-encryption");
  const [version, ivB64, tagB64, encB64] = stored.split(".");
  if (!key || version !== "v1" || !ivB64 || !tagB64 || !encB64) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// Codes de secours : XXXX-XXXX (~39 bits chacun), à usage unique. Seule une empreinte HMAC
// est gardée en base (liée au compte), jamais le code lui-même.
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    let raw = "";
    for (let i = 0; i < 8; i++) raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(accountId: string, code: string): string {
  const key = derivedKey("recovery-code-hash");
  if (!key) throw new Error("ADMIN_SESSION_SECRET manquant : impossible de protéger les codes de secours.");
  return createHmac("sha256", key).update(`${accountId}:${normalizeRecoveryCode(code)}`).digest("base64url");
}

// Liste des empreintes restantes après usage de `code`, ou null si le code n'en fait pas partie.
export function consumeRecoveryCode(accountId: string, code: string, storedJson: string | null): string[] | null {
  if (!storedJson || normalizeRecoveryCode(code).length !== 8) return null;
  let hashes: string[];
  try {
    hashes = JSON.parse(storedJson);
  } catch {
    return null;
  }
  if (!Array.isArray(hashes)) return null;
  const target = Buffer.from(hashRecoveryCode(accountId, code));
  let found = -1;
  hashes.forEach((h, i) => {
    const candidate = Buffer.from(String(h));
    if (candidate.length === target.length && timingSafeEqual(candidate, target)) found = i;
  });
  if (found < 0) return null;
  return hashes.filter((_, i) => i !== found);
}
