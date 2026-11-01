import "server-only";
import { inflateRawSync } from "node:zlib";
import { revalidateTag } from "next/cache";
import { execSql } from "@/lib/db";
import { PLAY_TAG, type PackFile } from "@/lib/playWorlds";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PACKS_BUCKET, deletePrefix, listWorldObjects, omnipackPartKey, omnipackPrefix, presignDownload, readWorldObject } from "@/lib/worldStorage";

// Pack Omniscient (27/10, preview v22 validée par Rushi). Un joueur fait son pack dans le launcher,
// l'exporte « Pour Omniscient » (.omnipack) et le propose depuis le site (Tableau de bord ›
// Proposer un pack). L'admin le voit dans « Packs officiels », l'importe (un pack 'omni', une
// version par version de Minecraft du fichier, toutes « À tester »), le teste dans le launcher,
// puis publie les versions une par une. Les mods restent des liens Modrinth (jamais de mod
// CurseForge : le launcher refuse un tel pack à l'export comme à l'import).
// L'archive est rangée par morceaux de 4 Mio dans R2 (worldStorage) ; le launcher les télécharge
// tous, vérifie l'empreinte SHA-256 complète, puis installe la version choisie.

export const OMNI_PART_SIZE = 4 * 1024 * 1024;
export const OMNI_MAX_BYTES = 300 * 1000 * 1000;
// Envois en cours ou en attente de l'admin, par compte.
export const OMNI_MAX_OPEN = 3;
// Un envoi commencé mais jamais fini est effacé au bout d'un jour.
const STALE_MS = 24 * 3600 * 1000;

const SHA_RE = /^[0-9a-f]{64}$/;
const MC_ID = /^[\w.+-]{1,32}$/;
const LOADERS = ["fabric", "quilt", "forge", "neoforge"];
const SAFE_JAR = /^[\w.+() [\]!'&,-]+\.jar$/i;
const SAFE_ZIP = /^[\w.+() [\]!'&,-]+\.zip$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const now = () => new Date().toISOString();
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max) : "");
const isMrUrl = (u: unknown) => {
  try {
    const x = new URL(String(u));
    return x.protocol === "https:" && x.hostname === "cdn.modrinth.com";
  } catch {
    return false;
  }
};

// --- Ce qu'on garde de omnipack.json (lu par le site lui-même dans l'archive) -----------------
export type OmniVersion = {
  minecraftVersion: string;
  loader: string | null;
  loaderVersion: string | null;
  tested: boolean;
  missing: string[];
  mods: PackFile[];
  resourcepacks: number;
  shaders: number;
  datapacks: number;
  worlds: string[];
  // Fichiers rangés dans l'archive faute de lien Modrinth (packs de ressources, shaders, data
  // packs faits main) : à regarder avant de publier.
  own: string[];
};
export type OmniManifest = { name: string; vanilla: boolean; loader: string | null; base: string; versions: OmniVersion[] };

export function checkManifest(json: unknown): OmniManifest {
  const j = (json ?? {}) as Row;
  if (j.format !== 1 || j.kind !== "omnipack" || !Array.isArray(j.versions) || !j.versions.length) throw new Error("Ce fichier n'est pas un Pack Omniscient (ou il vient d'un launcher plus récent).");
  if (j.versions.length > 80) throw new Error("Trop de versions de Minecraft dans ce pack.");
  const versions: OmniVersion[] = [];
  for (const v of j.versions as Row[]) {
    const mc = str(v.minecraftVersion, 32);
    if (!MC_ID.test(mc)) throw new Error("Version de Minecraft invalide dans le pack.");
    const loader = v.loader ? str(v.loader, 20) : null;
    if (loader && !LOADERS.includes(loader)) throw new Error("Chargeur de mods inconnu dans le pack.");
    const mods: PackFile[] = [];
    for (const m of (Array.isArray(v.mods) ? v.mods : []) as Row[]) {
      const f = (m.file ?? {}) as Row;
      if (!isMrUrl(f.url) || !SAFE_JAR.test(String(f.filename ?? "")) || !/^[0-9a-f]{40}$/.test(String(f.sha1 ?? ""))) {
        throw new Error(`Mod refusé (${str(m.name, 60) || "?"}) : un Pack Omniscient ne contient que des mods Modrinth.`);
      }
      mods.push({ projectId: str(m.projectId, 40), title: str(m.name, 80) || String(f.filename), url: String(f.url), filename: String(f.filename), sha1: String(f.sha1), size: Number(f.size) || undefined });
    }
    const own: string[] = [];
    const count = (list: unknown) => {
      const arr = (Array.isArray(list) ? list : []) as Row[];
      for (const x of arr) {
        if (!SAFE_ZIP.test(String(x.file ?? "")) || (x.mr && !isMrUrl(x.mr.url))) throw new Error(`Fichier refusé dans le pack : ${str(x.file, 80) || "?"}`);
        if (!x.mr) own.push(String(x.file));
      }
      return arr.length;
    };
    // 31/10 (Rushi) : un pack proposé = mods Modrinth + fichiers de configuration, rien d'autre.
    // Ni fichier hors Modrinth, ni monde (un monde ne sert à rien dans un pack).
    if (own.length) throw new Error(`Un pack proposé ne peut contenir que des mods Modrinth et des fichiers de configuration. À retirer : ${own.slice(0, 3).join(", ")}${own.length > 3 ? "…" : ""}`);
    if (Array.isArray(v.worlds) && v.worlds.length) throw new Error("Un pack proposé ne peut pas contenir de monde : exporte-le sans les mondes.");
    versions.push({
      minecraftVersion: mc,
      loader,
      loaderVersion: v.loaderVersion ? str(v.loaderVersion, 40) : null,
      tested: !!v.tested,
      missing: (Array.isArray(v.missing) ? v.missing : []).map((x: unknown) => str(x, 80)).filter(Boolean).slice(0, 60),
      mods,
      resourcepacks: count(v.resourcepacks),
      shaders: count(v.shaders),
      datapacks: count(v.datapacks),
      worlds: (Array.isArray(v.worlds) ? v.worlds : []).map((w: Row) => str(w?.name || w?.folder, 60)).filter(Boolean).slice(0, 20),
      own: own.slice(0, 40),
    });
  }
  return { name: str(j.name, 60) || "Pack Omniscient", vanilla: !!j.vanilla, loader: j.loader ? str(j.loader, 20) : null, base: str(j.base, 32), versions };
}

// omnipack.json est toujours le premier fichier de l'archive (écrit en premier par le launcher) :
// on lit le début du premier morceau, l'en-tête local, puis on décompresse (deflate).
export function manifestFromArchiveStart(buf: Uint8Array): unknown {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 30 || b.readUInt32LE(0) !== 0x04034b50) throw new Error("Ce fichier n'est pas une archive .omnipack.");
  const method = b.readUInt16LE(8);
  const nameLen = b.readUInt16LE(26);
  const extraLen = b.readUInt16LE(28);
  const name = b.subarray(30, 30 + nameLen).toString("utf8");
  if (name !== "omnipack.json") throw new Error("Ce fichier n'est pas un Pack Omniscient (omnipack.json introuvable).");
  const data = b.subarray(30 + nameLen + extraLen);
  const raw = method === 8 ? inflateRawSync(data, { maxOutputLength: 8 * 1024 * 1024 }) : method === 0 ? data.subarray(0, b.readUInt32LE(18)) : null;
  if (!raw) throw new Error("Archive .omnipack illisible.");
  return JSON.parse(raw.toString("utf8"));
}

// --- Envoi par le joueur ------------------------------------------------------------------------
export type Submission = Row & { id: string; userId: string; name: string; sizeBytes: number; parts: number; status: string };

async function dropSubmissionFiles(s: { userId: string; id: string }) {
  await deletePrefix(omnipackPrefix(s.userId, s.id), PACKS_BUCKET).catch(() => 0);
}

export async function listMySubmissions(userId: string): Promise<Submission[]> {
  const rows = (await execSql('SELECT * FROM "playPackSubmission" WHERE "userId" = ? ORDER BY "createdAt" DESC LIMIT 20', [userId])) as Submission[];
  // Envois commencés il y a plus d'un jour et jamais finis : effacés.
  const stale = rows.filter((r) => r.status === "uploading" && Date.now() - Date.parse(r.createdAt) > STALE_MS);
  for (const s of stale) {
    await dropSubmissionFiles(s);
    await execSql('DELETE FROM "playPackSubmission" WHERE "id" = ?', [s.id]);
  }
  return rows.filter((r) => !stale.includes(r));
}

export async function startSubmission(userId: string, input: { name: string; sizeBytes: number; sha256: string }): Promise<{ id: string; partSize: number; parts: number } | { error: string }> {
  const name = str(input.name, 80).replace(/\.omnipack$/i, "") || "Pack";
  const sha256 = String(input.sha256 ?? "").toLowerCase();
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || !SHA_RE.test(sha256)) return { error: "Fichier invalide." };
  if (input.sizeBytes > OMNI_MAX_BYTES) return { error: "Fichier trop gros (300 Mo au plus). Exporte le pack sans les mondes." };
  const open = (await listMySubmissions(userId)).filter((s) => s.status === "uploading" || s.status === "pending");
  if (open.length >= OMNI_MAX_OPEN) return { error: "Tu as déjà 3 packs en attente. Attends la réponse de l'équipe." };
  const id = crypto.randomUUID();
  const parts = Math.ceil(input.sizeBytes / OMNI_PART_SIZE);
  await execSql('INSERT INTO "playPackSubmission" ("id", "userId", "name", "sizeBytes", "sha256", "parts") VALUES (?, ?, ?, ?, ?, ?)', [id, userId, name, input.sizeBytes, sha256, parts]);
  return { id, partSize: OMNI_PART_SIZE, parts };
}

export async function findSubmission(id: string, userId?: string): Promise<Submission | null> {
  if (!/^[\w-]{8,64}$/.test(id)) return null;
  const [row] = userId
    ? await execSql('SELECT * FROM "playPackSubmission" WHERE "id" = ? AND "userId" = ?', [id, userId])
    : await execSql('SELECT * FROM "playPackSubmission" WHERE "id" = ?', [id]);
  return (row as Submission) ?? null;
}

// Taille attendue du morceau n (le dernier est plus petit).
export function expectedPartSize(s: Pick<Submission, "sizeBytes" | "parts">, n: number): number {
  return n < s.parts - 1 ? OMNI_PART_SIZE : s.sizeBytes - OMNI_PART_SIZE * (s.parts - 1);
}

// Tous les morceaux sont arrivés : le site lit omnipack.json dans l'archive (jamais ce que le
// navigateur en dit), le vérifie, et le pack passe « en attente » de l'admin.
export async function finishSubmission(s: Submission): Promise<string | null> {
  const prefix = omnipackPrefix(s.userId, s.id);
  const objects = await listWorldObjects(prefix, PACKS_BUCKET);
  const total = objects.reduce((n, o) => n + o.size, 0);
  if (objects.length !== Number(s.parts) || total !== Number(s.sizeBytes)) return "Il manque des morceaux du fichier : renvoie-le.";
  let manifest: OmniManifest;
  try {
    const head = await readWorldObject(omnipackPartKey(prefix, 0), OMNI_PART_SIZE, PACKS_BUCKET);
    if (!head) throw new Error("Fichier introuvable.");
    manifest = checkManifest(manifestFromArchiveStart(head));
  } catch (error) {
    await dropSubmissionFiles(s);
    await execSql('DELETE FROM "playPackSubmission" WHERE "id" = ?', [s.id]);
    return error instanceof Error ? error.message.slice(0, 200) : "Fichier illisible.";
  }
  await execSql('UPDATE "playPackSubmission" SET "status" = \'pending\', "manifest" = ?, "name" = ?, "updatedAt" = ? WHERE "id" = ?', [JSON.stringify(manifest), manifest.name, now(), s.id]);
  return null;
}

// Le joueur retire son pack tant qu'il n'est pas importé.
export async function cancelSubmission(s: Submission): Promise<boolean> {
  if (s.status === "imported") return false;
  await dropSubmissionFiles(s);
  await execSql('DELETE FROM "playPackSubmission" WHERE "id" = ?', [s.id]);
  return true;
}

// --- Admin --------------------------------------------------------------------------------------
export async function listPendingSubmissions(): Promise<(Submission & { author: string })[]> {
  const rows = await execSql(
    'SELECT s.*, u."name" AS "author" FROM "playPackSubmission" s LEFT JOIN "user" u ON u."id" = s."userId" WHERE s."status" = \'pending\' ORDER BY s."createdAt"',
  );
  return rows as (Submission & { author: string })[];
}

const slugOf = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "pack";

// Importe un pack proposé : un pack 'omni' (non publié) + une version par version de Minecraft.
export async function importSubmission(id: string, note = ""): Promise<{ packId: string } | { error: string }> {
  const s = await findSubmission(id);
  if (!s || s.status !== "pending") return { error: "Pack proposé introuvable." };
  // Déjà vérifié par finishSubmission (lu dans l'archive elle-même).
  let manifest: OmniManifest;
  try {
    manifest = JSON.parse(s.manifest) as OmniManifest;
    if (!Array.isArray(manifest.versions) || !manifest.versions.length) throw new Error("Pack vide.");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Pack illisible." };
  }
  const [author] = await execSql('SELECT "name" FROM "user" WHERE "id" = ?', [s.userId]);
  const packId = crypto.randomUUID();
  const slug = `${slugOf(manifest.name)}-${packId.slice(0, 6)}`;
  const archive = { prefix: omnipackPrefix(s.userId, s.id), parts: Number(s.parts), size: Number(s.sizeBytes), sha256: s.sha256 };
  await execSql(
    'INSERT INTO "playPack" ("id", "slug", "nameFr", "nameEn", "descriptionFr", "descriptionEn", "modrinthProjects", "kind", "author", "archive", "submissionId") VALUES (?, ?, ?, ?, \'\', \'\', \'[]\', \'omni\', ?, ?, ?)',
    [packId, slug, manifest.name, manifest.name, author?.name ?? null, JSON.stringify(archive), s.id],
  );
  for (const v of manifest.versions) {
    const extras = { resourcepacks: v.resourcepacks, shaders: v.shaders, datapacks: v.datapacks, worlds: v.worlds, own: v.own, tested: v.tested };
    await execSql(
      'INSERT INTO "playPackVersion" ("id", "packId", "minecraftVersion", "loader", "loaderVersion", "files", "missing", "status", "published", "extras") VALUES (?, ?, ?, ?, ?, ?, ?, \'to_test\', 0, ?)',
      [crypto.randomUUID(), packId, v.minecraftVersion, v.loader ?? "vanilla", v.loaderVersion, JSON.stringify(v.mods), JSON.stringify(v.missing.map((title) => ({ projectId: "", title }))), JSON.stringify(extras)],
    );
  }
  await execSql('UPDATE "playPackSubmission" SET "status" = \'imported\', "packId" = ?, "note" = ?, "updatedAt" = ? WHERE "id" = ?', [packId, str(note, 300) || null, now(), s.id]);
  revalidateTag(PLAY_TAG, { expire: 0 });
  return { packId };
}

export async function refuseSubmission(id: string, note: string): Promise<boolean> {
  const s = await findSubmission(id);
  if (!s || s.status !== "pending") return false;
  await dropSubmissionFiles(s);
  await execSql('UPDATE "playPackSubmission" SET "status" = \'refused\', "note" = ?, "updatedAt" = ? WHERE "id" = ?', [str(note, 300) || null, now(), s.id]);
  return true;
}

// Suppression d'un pack 'omni' : son archive est effacée et l'envoi du joueur passe « refusé ».
export async function dropOmniArchive(packId: string): Promise<void> {
  const [p] = await execSql('SELECT "kind", "archive", "submissionId" FROM "playPack" WHERE "id" = ?', [packId]);
  if (!p || p.kind !== "omni") return;
  try {
    const a = JSON.parse(p.archive ?? "{}");
    if (typeof a.prefix === "string") await deletePrefix(a.prefix, PACKS_BUCKET);
  } catch {
    // archive déjà partie
  }
  if (p.submissionId) await execSql('UPDATE "playPackSubmission" SET "status" = \'refused\', "note" = COALESCE("note", \'Retiré des packs officiels.\'), "updatedAt" = ? WHERE "id" = ?', [now(), p.submissionId]);
}

// --- Launcher ------------------------------------------------------------------------------------
// Liens signés (1 h) vers chaque morceau d'un pack 'omni' qui a au moins une version publiée.
export async function omniArchiveLinks(packId: string): Promise<{ parts: string[]; size: number; sha256: string } | null> {
  const [p] = await execSql(
    'SELECT p."archive" FROM "playPack" p WHERE p."id" = ? AND p."kind" = \'omni\' AND EXISTS (SELECT 1 FROM "playPackVersion" v WHERE v."packId" = p."id" AND v."published" = 1)',
    [packId],
  );
  if (!p?.archive) return null;
  const a = JSON.parse(p.archive) as { prefix: string; parts: number; size: number; sha256: string };
  const parts = Array.from({ length: a.parts }, (_, n) => presignDownload(omnipackPartKey(a.prefix, n), undefined, PACKS_BUCKET));
  return { parts, size: a.size, sha256: a.sha256 };
}

// --- Tester dans le launcher (31/10) --------------------------------------------------------------
// L'admin clique « Tester dans le launcher » : le site signe un jeton court (10 min) pour CE pack
// proposé, le launcher l'ouvre par un lien omniscient://test-pack/<jeton>, puis demande les liens
// de téléchargement. Le pack s'installe chez l'admin seulement : rien n'est publié.
const TEST_TTL_MS = 10 * 60 * 1000;
function testSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET manquant.");
  return secret;
}
const testSig = (payload: string) => createHmac("sha256", testSecret()).update(`omnipack-test:${payload}`).digest("base64url").slice(0, 32);

export function makeTestToken(submissionId: string, nowMs = Date.now()): string {
  const payload = `${submissionId}.${Math.floor((nowMs + TEST_TTL_MS) / 1000)}`;
  return `${payload}.${testSig(payload)}`;
}

export function readTestToken(token: string, nowMs = Date.now()): string | null {
  const m = /^([\w-]{8,64})\.(\d{9,11})\.([\w-]{32})$/.exec(token);
  if (!m) return null;
  if (Number(m[2]) * 1000 < nowMs) return null;
  const a = Buffer.from(testSig(`${m[1]}.${m[2]}`));
  const b = Buffer.from(m[3]);
  return a.length === b.length && timingSafeEqual(a, b) ? m[1] : null;
}

// Liens signés vers l'archive d'un pack proposé encore en attente (ou déjà accepté), pour l'admin.
export async function testArchiveLinks(token: string): Promise<{ parts: string[]; size: number; sha256: string; name: string } | null> {
  const id = readTestToken(token);
  const s = id ? await findSubmission(id) : null;
  if (!s || (s.status !== "pending" && s.status !== "imported")) return null;
  const prefix = omnipackPrefix(s.userId, s.id);
  const parts = Array.from({ length: Number(s.parts) }, (_, n) => presignDownload(omnipackPartKey(prefix, n), undefined, PACKS_BUCKET));
  return { parts, size: Number(s.sizeBytes), sha256: s.sha256, name: s.name };
}

// Compte joueur auquel sont rattachés les packs ajoutés par l'admin (« Ajouter un pack »).
// OMNIPACK_OWNER_USER_ID s'il est réglé, sinon le compte joueur « Rushifa » / « Ruchifa ».
export async function adminPackOwnerId(): Promise<string | null> {
  const fixed = process.env.OMNIPACK_OWNER_USER_ID;
  if (fixed) return fixed;
  const [u] = await execSql('SELECT "id" FROM "user" WHERE lower("name") IN (\'rushifa\', \'ruchifa\') ORDER BY "createdAt" LIMIT 1');
  return u?.id ?? null;
}
