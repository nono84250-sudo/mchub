// Range dans R2 les icônes, bannières et fonds des 10 serveurs « proposés par Omniscient »
// (fil « Team Omniscient et serveurs pilotes », 19/10) et les pose sur leurs fiches.
// Base visée : TOUJOURS la base DEV (omniscient-launcher-dev), écrite en dur ci-dessous et
// vérifiée par son nom avant toute écriture. Ce script ne peut pas toucher la prod.
//
// Usage (depuis le dossier site/) :
//   node scripts/seed-images-omniscient.mjs
// Les images sont lues dans ../_seed-omniscient/images/<slug>/ (icon.png, banner.*, background.*).
// Les adresses enregistrées pointent vers le site local (http://localhost:3000), comme une image
// déposée depuis le formulaire en local. Relancer le script ne refait rien pour une image déjà posée.
//
// Lit seulement CF_ACCOUNT_ID, CF_D1_API_TOKEN, R2_ACCESS_KEY_ID et R2_SECRET_ACCESS_KEY dans
// site/.env (jamais affichés).
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const DEV_DATABASE_ID = "d2d66853-4f4f-4b5b-9bae-d6644f2941ed";
const DEV_DATABASE_NAME = "omniscient-launcher-dev";
const SITE_ORIGIN = "http://localhost:3000";
const IMAGES_BUCKET = "omniscient-images";
const IMAGES_DIR = new URL("../../_seed-omniscient/images/", import.meta.url);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const { CF_ACCOUNT_ID: accountId, CF_D1_API_TOKEN: token, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!accountId || !token) fail("CF_ACCOUNT_ID ou CF_D1_API_TOKEN manquant dans site/.env.");
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) fail("R2_ACCESS_KEY_ID ou R2_SECRET_ACCESS_KEY manquant dans site/.env.");

const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${DEV_DATABASE_ID}`;
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
if (database?.name !== DEV_DATABASE_NAME) fail(`Base inattendue (${database?.name ?? "introuvable"}) : rien n'a été fait.`);
console.log(`Base visée : ${database.name}`);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

// Même contrôle que /api/upload : le vrai type vient des premiers octets, pas de l'extension.
function imageType(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { type: "image/webp", ext: "webp" };
  }
  return null;
}

// Mêmes formats et poids que /api/upload pour chaque champ.
const FIELDS = {
  icon: { column: "iconUrl", types: ["image/png", "image/webp"], max: 1 * 1024 * 1024 },
  banner: { column: "bannerUrl", types: ["image/jpeg", "image/png", "image/webp"], max: 5 * 1024 * 1024 },
  background: { column: "backgroundUrl", types: ["image/jpeg", "image/webp"], max: 8 * 1024 * 1024 },
};

const slugs = (await readdir(IMAGES_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
let done = 0;
for (const slug of slugs) {
  const [server] = await query('SELECT "id", "iconUrl", "bannerUrl", "backgroundUrl" FROM "server" WHERE "slug" = ?', [slug]);
  if (!server) {
    console.log(`- ${slug} : fiche introuvable, ignorée`);
    continue;
  }
  const files = await readdir(new URL(`${slug}/`, IMAGES_DIR));
  const updates = {};
  for (const [field, rule] of Object.entries(FIELDS)) {
    const file = files.find((f) => f.split(".")[0] === field);
    if (!file || server[rule.column]) continue;
    const bytes = await readFile(new URL(`${slug}/${file}`, IMAGES_DIR));
    const kind = imageType(bytes);
    if (!kind || !rule.types.includes(kind.type) || bytes.length > rule.max) {
      console.log(`- ${slug} : ${file} refusé (format ou poids)`);
      continue;
    }
    const key = `${randomUUID()}.${kind.ext}`;
    await r2.send(new PutObjectCommand({ Bucket: IMAGES_BUCKET, Key: key, Body: bytes, ContentType: kind.type }));
    updates[rule.column] = `${SITE_ORIGIN}/api/images/${key}`;
  }
  const columns = Object.keys(updates);
  if (!columns.length) {
    console.log(`- ${slug} : rien à faire`);
    continue;
  }
  await query(`UPDATE "server" SET ${columns.map((c) => `"${c}" = ?`).join(", ")} WHERE "id" = ?`, [...Object.values(updates), server.id]);
  console.log(`- ${slug} : ${columns.length} image(s) posée(s)`);
  done += columns.length;
}
console.log(`Terminé : ${done} image(s) posée(s). Relance le site local pour les voir (le cache dure 1 minute).`);
