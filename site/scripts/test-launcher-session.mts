// Tests unitaires des jetons de session du launcher (src/lib/launcherSession.ts).
// Sans reseau ni base. Lancer : node scripts/test-launcher-session.mts (depuis site/).
// Le secret est genere en memoire pour le test, jamais lu depuis .env.
import { createHmac, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createLauncherSession, readLauncherSession } from "../src/lib/launcherSession.ts";

const UUID = "0123456789abcdef0123456789abcdef";
const NOW = Math.floor(Date.now() / 1000);
let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

process.env.LAUNCHER_SESSION_SECRET = randomBytes(48).toString("base64url");

const session = createLauncherSession(UUID, NOW)!;
const [payloadB64, sig] = session.token.split(".");

check("jeton valide -> uuid", () => assert.equal(readLauncherSession(session.token, NOW), UUID));
check("uuid avec tirets normalise a la creation", () => {
  const s = createLauncherSession("01234567-89ab-cdef-0123-456789abcdef", NOW)!;
  assert.equal(readLauncherSession(s.token, NOW), UUID);
});
check("expiresAt = creation + 24 h (en ms)", () => assert.equal(session.expiresAt, (NOW + 86400) * 1000));
check("valide juste avant l'expiration", () => assert.equal(readLauncherSession(session.token, NOW + 86399), UUID));
check("expire a exp (borne exclue) -> null", () => assert.equal(readLauncherSession(session.token, NOW + 86400), null));
check("expire depuis longtemps -> null", () => assert.equal(readLauncherSession(session.token, NOW + 90000), null));
check("jeton fabrique deja expire -> null", () => {
  const old = createLauncherSession(UUID, NOW - 90000)!;
  assert.equal(readLauncherSession(old.token, NOW), null);
});

check("payload modifie (autre uuid) -> null", () => {
  const forged = Buffer.from(JSON.stringify({ u: "ffffffffffffffffffffffffffffffff", exp: NOW + 86400 })).toString("base64url");
  assert.equal(readLauncherSession(`${forged}.${sig}`, NOW), null);
});
check("payload modifie (exp prolongee) -> null", () => {
  const forged = Buffer.from(JSON.stringify({ u: UUID, exp: NOW + 10 * 86400 })).toString("base64url");
  assert.equal(readLauncherSession(`${forged}.${sig}`, NOW), null);
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
check("payload signe mais non conforme (u/exp invalides, JSON non objet) -> null", () => {
  // Signature VALIDE (HMAC avec le secret courant) : seul le contenu est en cause.
  const secret = process.env.LAUNCHER_SESSION_SECRET!;
  const signed = (raw: string) => {
    const p = Buffer.from(raw).toString("base64url");
    return `${p}.${createHmac("sha256", secret).update(p).digest("base64url")}`;
  };
  for (const raw of [
    JSON.stringify({ u: 42, exp: NOW + 100 }),
    JSON.stringify({ u: "XYZ", exp: NOW + 100 }),
    JSON.stringify({ u: UUID }),
    JSON.stringify({ u: UUID, exp: "demain" }),
    "null",
    "[1,2]",
    "pas du json",
  ]) {
    assert.equal(readLauncherSession(signed(raw), NOW), null, `attendu null pour ${raw}`);
  }
  // Controle positif : meme fabrication avec un contenu correct -> accepte.
  assert.equal(readLauncherSession(signed(JSON.stringify({ u: UUID, exp: NOW + 100 })), NOW), UUID);
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

console.log(`\n${passed} tests passes`);
