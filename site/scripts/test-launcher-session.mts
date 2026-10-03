// Tests unitaires des jetons de session du launcher (src/lib/launcherSession.ts).
// Sans reseau ni base. Lancer : node scripts/test-launcher-session.mts (depuis site/).
// Le secret est genere en memoire pour le test, jamais lu depuis .env.
import { createHmac, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import {
  createLauncherSession,
  isSessionRevoked,
  LAUNCHER_SESSION_TTL_MS,
  readLauncherSession,
} from "../src/lib/launcherSession.ts";

const UUID = "0123456789abcdef0123456789abcdef";
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
const MIN = 60_000;
let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

process.env.LAUNCHER_SESSION_SECRET = randomBytes(48).toString("base64url");

const session = createLauncherSession(UUID, NOW)!;
const [payloadB64, sig] = session.token.split(".");

check("jeton valide -> uuid et date d'emission", () => {
  assert.deepEqual(readLauncherSession(session.token, NOW), { uuid: UUID, issuedAt: NOW });
});
check("uuid avec tirets normalise a la creation", () => {
  const s = createLauncherSession("01234567-89ab-cdef-0123-456789abcdef", NOW)!;
  assert.equal(readLauncherSession(s.token, NOW)?.uuid, UUID);
});
check("duree de vie = 15 minutes", () => {
  assert.equal(LAUNCHER_SESSION_TTL_MS, 15 * MIN);
  assert.equal(session.expiresAt, NOW + 15 * MIN);
});
check("expiration a 15 min : encore valide 1 ms avant", () => {
  assert.equal(readLauncherSession(session.token, NOW + 15 * MIN - 1)?.uuid, UUID);
});
check("expiration a 15 min : refuse a exactement 15 min (borne exclue)", () => {
  assert.equal(readLauncherSession(session.token, NOW + 15 * MIN), null);
});
check("expire depuis longtemps (24 h apres) -> null", () => {
  assert.equal(readLauncherSession(session.token, NOW + 24 * 60 * MIN), null);
});
check("jeton fabrique deja expire -> null", () => {
  const old = createLauncherSession(UUID, NOW - 16 * MIN)!;
  assert.equal(readLauncherSession(old.token, NOW), null);
});
check("payload modifie (autre uuid) -> null", () => {
  const forged = Buffer.from(JSON.stringify({ u: "ffffffffffffffffffffffffffffffff", iat: NOW, exp: NOW + 15 * MIN })).toString("base64url");
  assert.equal(readLauncherSession(`${forged}.${sig}`, NOW), null);
});
check("payload modifie (exp prolongee) -> null", () => {
  const forged = Buffer.from(JSON.stringify({ u: UUID, iat: NOW, exp: NOW + 10 * 24 * 60 * MIN })).toString("base64url");
  assert.equal(readLauncherSession(`${forged}.${sig}`, NOW + 20 * MIN), null);
});
check("signature modifiee (1 caractere) -> null", () => {
  const flipped = sig.slice(0, -1) + (sig.at(-1) === "A" ? "B" : "A");
  assert.equal(readLauncherSession(`${payloadB64}.${flipped}`, NOW), null);
});
check("signature tronquee -> null", () => assert.equal(readLauncherSession(`${payloadB64}.${sig.slice(0, 10)}`, NOW), null));
check("signe avec un autre secret -> null", () => {
  const saved = process.env.LAUNCHER_SESSION_SECRET;
  process.env.LAUNCHER_SESSION_SECRET = randomBytes(48).toString("base64url");
  try {
    assert.equal(readLauncherSession(session.token, NOW), null);
  } finally {
    process.env.LAUNCHER_SESSION_SECRET = saved;
  }
});
check("formats invalides -> null", () => {
  for (const bad of ["", "abc", "a.b.c", ".", `${payloadB64}.`, `.${sig}`, "not-base64.@@@"]) {
    assert.equal(readLauncherSession(bad, NOW), null, `attendu null pour ${JSON.stringify(bad)}`);
  }
});
check("payload signe mais non conforme -> null (controle positif inclus)", () => {
  // Signature VALIDE (HMAC avec le secret courant) : seul le contenu est en cause.
  const secret = process.env.LAUNCHER_SESSION_SECRET!;
  const signed = (raw: string) => {
    const p = Buffer.from(raw).toString("base64url");
    return `${p}.${createHmac("sha256", secret).update(p).digest("base64url")}`;
  };
  for (const raw of [
    JSON.stringify({ u: 42, iat: NOW, exp: NOW + MIN }),
    JSON.stringify({ u: "XYZ", iat: NOW, exp: NOW + MIN }),
    JSON.stringify({ u: UUID, exp: NOW + MIN }),
    JSON.stringify({ u: UUID, iat: NOW }),
    JSON.stringify({ u: UUID, iat: NOW, exp: "demain" }),
    JSON.stringify({ u: UUID, iat: NOW + 5 * MIN, exp: NOW + MIN }),
    // Ancien format (24 h, sans iat) : refuse, il n'a jamais ete distribue.
    JSON.stringify({ u: UUID, exp: Math.floor(NOW / 1000) + 86400 }),
    "null",
    "[1,2]",
    "pas du json",
  ]) {
    assert.equal(readLauncherSession(signed(raw), NOW), null, `attendu null pour ${raw}`);
  }
  assert.equal(readLauncherSession(signed(JSON.stringify({ u: UUID, iat: NOW, exp: NOW + MIN })), NOW)?.uuid, UUID);
});
check("sans secret -> creation et lecture refusees", () => {
  const saved = process.env.LAUNCHER_SESSION_SECRET;
  delete process.env.LAUNCHER_SESSION_SECRET;
  try {
    assert.equal(createLauncherSession(UUID, NOW), null);
    assert.equal(readLauncherSession(session.token, NOW), null);
  } finally {
    process.env.LAUNCHER_SESSION_SECRET = saved;
  }
});
check("secret trop court (< 32) -> refuse", () => {
  const saved = process.env.LAUNCHER_SESSION_SECRET;
  process.env.LAUNCHER_SESSION_SECRET = "court";
  try {
    assert.equal(createLauncherSession(UUID, NOW), null);
  } finally {
    process.env.LAUNCHER_SESSION_SECRET = saved;
  }
});

// Revocation (User.sessionsValidAfter) : decision pure, la lecture en base est dans launcherAuth.ts.
check("jamais revoque (sessionsValidAfter null) -> pas revoque", () => {
  assert.equal(isSessionRevoked(NOW, null), false);
  assert.equal(isSessionRevoked(NOW, undefined), false);
});
check("jeton emis AVANT sessionsValidAfter -> revoque (refuse)", () => {
  const revokedAt = new Date(NOW + 1000).toISOString();
  assert.equal(isSessionRevoked(NOW, revokedAt), true);
  assert.equal(readLauncherSession(session.token, NOW) !== null && isSessionRevoked(NOW, revokedAt), true);
});
check("jeton emis APRES sessionsValidAfter (reconnexion) -> accepte", () => {
  const revokedAt = new Date(NOW - 1000).toISOString();
  assert.equal(isSessionRevoked(NOW, revokedAt), false);
});
check("jeton emis a la milliseconde de la revocation -> accepte", () => {
  assert.equal(isSessionRevoked(NOW, new Date(NOW).toISOString()), false);
});
check("sessionsValidAfter illisible -> ignore (pas de revocation silencieuse)", () => {
  assert.equal(isSessionRevoked(NOW, "pas une date"), false);
});

console.log(`\n${passed} tests passes`);
