// Remet à zéro la double authentification d'UN compte du staff, quand plus personne ne peut le
// faire depuis /admin (seul admin qui a perdu téléphone et codes de secours, ou
// ADMIN_SESSION_SECRET changé, ce qui rend les secrets 2FA illisibles). Le compte refera la
// configuration (QR code) à sa prochaine connexion ; ses sessions ouvertes sont coupées.
//
// Usage (depuis le dossier site/) :
//   node scripts/reset-2fa.mjs <identifiant-de-la-base-D1> <nom-d-utilisateur>
// Le script affiche la base visée et demande de retaper son nom pour confirmer.
//
// Lit seulement CF_ACCOUNT_ID et CF_D1_API_TOKEN dans site/.env (jamais affichés).
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [databaseId, username] = process.argv.slice(2);
if (!databaseId || !/^[0-9a-f-]{36}$/i.test(databaseId) || !username) {
  fail("Usage : node scripts/reset-2fa.mjs <identifiant-de-la-base-D1> <nom-d-utilisateur>");
}
const accountId = process.env.CF_ACCOUNT_ID;
const token = process.env.CF_D1_API_TOKEN;
if (!accountId || !token) fail("CF_ACCOUNT_ID ou CF_D1_API_TOKEN manquant dans site/.env.");

const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function cloudflare(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    fail(`Cloudflare a refusé la requête (HTTP ${res.status}) : ${json?.errors?.map((e) => e.message).join(", ") || "réponse illisible"}`);
  }
  return json.result;
}

async function query(sql, params = []) {
  const result = await cloudflare("/query", { method: "POST", body: JSON.stringify({ sql, params }) });
  return result?.[0]?.results ?? [];
}

const database = await cloudflare("");
const name = database?.name;
if (!name) fail("Base introuvable : vérifie l'identifiant.");

const [account] = await query('SELECT "id", "username" FROM "adminAccount" WHERE "username" = ?', [username]);
if (!account) fail(`Aucun compte « ${username} » dans ${name}.`);

console.log(`Base visée : ${name} (${databaseId})`);
console.log(`Compte : ${account.username}`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question(`Pour réinitialiser sa double authentification, retape le nom de la base (${name}) : `)).trim();
rl.close();
if (answer !== name) fail("Nom différent : rien n'a été fait.");

await query(
  `UPDATE "adminAccount" SET "totpSecret" = NULL, "totpEnabledAt" = NULL, "totpLastStep" = NULL, "totpFailedCount" = 0,
     "totpLockedUntil" = NULL, "totpRecoveryCodes" = NULL, "passwordChangedAt" = ? WHERE "id" = ?`,
  [new Date().toISOString(), account.id],
);
console.log(`Double authentification de ${account.username} réinitialisée dans ${name}.`);
console.log("Il la reconfigurera (QR code) à sa prochaine connexion sur /admin.");
