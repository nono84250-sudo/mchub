// Crée le premier compte admin du panel (dev ou prod, selon DATABASE_URL de site/.env).
// Le mot de passe aléatoire est affiché UNE SEULE FOIS. Le compte doit changer
// son nom d'utilisateur et son mot de passe à la première connexion.
// Usage : node scripts/create-admin.mjs
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import pg from "pg";

const scrypt = promisify(scryptCb);
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].replace(/^["']|["']\r?$/g, "");

const password = randomBytes(18).toString("base64url");
const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const existing = await client.query(`SELECT count(*)::int AS n FROM "adminAccount"`);
if (existing.rows[0].n > 0) {
  console.log("Un compte admin existe déjà : rien n'a été créé.");
} else {
  await client.query(
    `INSERT INTO "adminAccount" ("id", "username", "passwordHash", "role", "mustChangeCredentials") VALUES (gen_random_uuid()::text, 'admin', $1, 'admin', true)`,
    [passwordHash],
  );
  console.log("Compte créé.");
  console.log("Nom d'utilisateur : admin");
  console.log("Mot de passe (affiché une seule fois) : " + password);
}
await client.end();
