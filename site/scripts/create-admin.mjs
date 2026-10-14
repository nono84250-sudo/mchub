// Crée le premier compte admin du panel dans une base Cloudflare D1 (la base cible est
// TOUJOURS donnée en paramètre, jamais lue dans site/.env : on ne crée pas un admin en prod
// par accident). Le mot de passe aléatoire est affiché UNE SEULE FOIS. Le compte doit changer
// son nom d'utilisateur et son mot de passe à la première connexion.
//
// Usage (depuis le dossier site/) :
//   node scripts/create-admin.mjs <identifiant-de-la-base-D1>
// Le script affiche le nom de la base visée et demande de retaper ce nom pour confirmer.
// Il ne fait rien si un compte admin existe déjà dans cette base.
//
// Lit seulement CF_ACCOUNT_ID et CF_D1_API_TOKEN dans site/.env (jamais affichés).
// Avant le 14/10 ce script visait l'ancienne base Postgres (DATABASE_URL, gen_random_uuid())
// et ne marchait plus sur D1 (audit, M1).
import { randomBytes, randomUUID, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const scrypt = promisify(scryptCb);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const databaseId = process.argv[2];
if (!databaseId || !/^[0-9a-f-]{36}$/i.test(databaseId)) {
  fail("Usage : node scripts/create-admin.mjs <identifiant-de-la-base-D1>\n(un identifiant de la forme 38dcbb6b-5899-4e9b-8f0d-74c0b717e7fd)");
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

console.log(`Base visée : ${name} (${databaseId})`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question(`Pour créer le compte admin dans cette base, retape son nom (${name}) : `)).trim();
rl.close();
if (answer !== name) fail("Nom différent : rien n'a été fait.");

const [{ n }] = await query('SELECT count(*) AS "n" FROM "adminAccount"');
if (Number(n) > 0) {
  console.log("Un compte admin existe déjà dans cette base : rien n'a été créé.");
  process.exit(0);
}

const password = randomBytes(18).toString("base64url");
const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;

await query(
  'INSERT INTO "adminAccount" ("id", "username", "passwordHash", "role", "mustChangeCredentials") VALUES (?, ?, ?, ?, 1)',
  [randomUUID(), "admin", passwordHash, "admin"],
);
console.log("Compte créé dans " + name + ".");
console.log("Nom d'utilisateur : admin");
console.log("Mot de passe (affiché une seule fois) : " + password);
console.log("Change le nom d'utilisateur et le mot de passe à la première connexion sur /admin.");
