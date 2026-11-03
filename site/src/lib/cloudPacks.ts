import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { execSql } from "@/lib/db";
import { featureState } from "@/lib/features";
import type { PackFile, PlayOffer } from "@/lib/playWorlds";
import { usedBytes as worldsUsedBytes } from "@/lib/playWorlds";
import { readCentralDirectory, readZipTail } from "@/lib/omniArchiveCheck";
import { PACKS_BUCKET, WORLDS_PREFIX, deleteObjects, presignDownload, putWorldObject } from "@/lib/worldStorage";

// Mon cloud (03/11, preview « Mon cloud » v2 validée par Rushi). Un propriétaire de serveur garde
// ses modpacks dans son cloud : une liste de mods Modrinth (des liens cdn.modrinth.com avec leurs
// empreintes, jamais un .jar chez nous) et, s'il veut, une archive .zip de fichiers de configuration.
// Il en relie un à son serveur : « Obligatoire pour rejoindre » (le launcher l'installe avant de se
// connecter) ou « Conseillé » (le joueur peut jouer sans, le bouton reste proposé).
// Jamais de mod CurseForge, de .jar ni de monde dans un modpack du cloud.
// Table créée par d1/migrations/2026-11-03-mon-cloud.sql.

const API = "https://api.modrinth.com/v2";
const HEADERS = { "User-Agent": "omniscient-launcher/0.1 (https://omniscientlauncher.com)", Accept: "application/json" };
export const CLOUD_LOADERS = ["fabric", "quilt", "neoforge", "forge"] as const;
export type CloudLoader = (typeof CLOUD_LOADERS)[number];
export type LinkMode = "required" | "suggested";
export const MAX_PACKS = 20;
export const MAX_MODS = 150;
// Configs : une seule requête (limite de 4,5 Mo par requête sur Vercel).
export const CONFIG_MAX_BYTES = 4 * 1000 * 1000;
const CONFIG_MAX_UNPACKED = 60 * 1000 * 1000;
const CONFIG_MAX_ENTRIES = 5000;
// Fichiers de configuration seulement (texte). Ni .jar, ni monde (.dat, .mca), ni script.
const CONFIG_EXT = /\.(json|json5|jsonc|toml|cfg|conf|config|properties|txt|ya?ml|snbt|ini|csv|md|xml|lang)$/i;
const MC_ID = /^\d+\.\d+(\.\d+)?$/;
const SLUG = /^[\w.-]{2,64}$/;
// Même règle que omniPacks.ts : un nom de fichier simple, jamais de dossier.
const SAFE_JAR = /^[\w.+() [\]!'&,-]+\.jar$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const now = () => new Date().toISOString();
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max) : "");
const parse = <T,>(text: unknown, fallback: T): T => {
  try {
    return typeof text === "string" ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
};

export type CloudPack = {
  id: string;
  name: string;
  minecraftVersion: string;
  loader: CloudLoader;
  loaderVersion: string;
  projects: { slug: string; title: string }[];
  files: PackFile[];
  missing: { projectId: string; title: string }[];
  configBytes: number;
  configCount: number;
  sizeBytes: number;
  serverId: string | null;
  serverName: string | null;
  serverSlug: string | null;
  linkMode: LinkMode | null;
  installCount: number;
  updatedAt: string;
};

// Place prise par un modpack : ses configs, plus la liste des liens (quelques Ko).
const packSize = (r: Row) => (Number(r.configBytes) || 0) + Buffer.byteLength(String(r.files ?? "")) + Buffer.byteLength(String(r.projects ?? ""));

function toPack(r: Row): CloudPack {
  return {
    id: r.id,
    name: r.name,
    minecraftVersion: r.minecraftVersion,
    loader: r.loader,
    loaderVersion: r.loaderVersion,
    projects: parse(r.projects, []),
    files: parse(r.files, []),
    missing: parse(r.missing, []),
    configBytes: Number(r.configBytes) || 0,
    configCount: Number(r.configCount) || 0,
    sizeBytes: packSize(r),
    serverId: r.serverId ?? null,
    serverName: r.serverName ?? null,
    serverSlug: r.serverSlug ?? null,
    linkMode: r.serverId ? (r.linkMode === "required" ? "required" : "suggested") : null,
    installCount: Number(r.installCount) || 0,
    updatedAt: r.updatedAt,
  };
}

export async function listCloudPacks(userId: string): Promise<CloudPack[]> {
  const rows = await execSql(
    'SELECT p.*, s."name" AS "serverName", s."slug" AS "serverSlug" FROM "cloudPack" p LEFT JOIN "server" s ON s."id" = p."serverId" WHERE p."userId" = ? ORDER BY p."updatedAt" DESC',
    [userId],
  );
  return rows.map(toPack);
}

async function findPack(userId: string, id: string): Promise<Row | null> {
  const [row] = await execSql('SELECT * FROM "cloudPack" WHERE "id" = ? AND "userId" = ?', [String(id), userId]);
  return row ?? null;
}

// --- Place utilisée ----------------------------------------------------------------------------
// Gratuit : 500 Mo pour les modpacks seulement. Supporter et Créateur : la place de l'offre est
// partagée entre les modpacks et les mondes.
export type CloudUsage = { packs: number; worlds: number; total: number; quota: number };
export async function cloudUsage(userId: string, offer: PlayOffer): Promise<CloudUsage> {
  const rows = await execSql('SELECT "configBytes", "files", "projects" FROM "cloudPack" WHERE "userId" = ?', [userId]);
  const packs = rows.reduce((a: number, r: Row) => a + packSize(r), 0);
  const worlds = offer.cloud ? await worldsUsedBytes(userId) : 0;
  return { packs, worlds, total: packs + worlds, quota: offer.cloud ? offer.quotaBytes : offer.packQuotaBytes };
}

// --- Modrinth ----------------------------------------------------------------------------------
type MrVersion = {
  id: string;
  project_id: string;
  game_versions: string[];
  loaders: string[];
  version_type: "release" | "beta" | "alpha";
  date_published: string;
  files: { url: string; filename: string; size: number; primary: boolean; hashes: { sha1?: string } }[];
  dependencies: { project_id: string | null; dependency_type: string }[];
};
type MrProject = { id: string; slug: string; title: string; project_type: string };

async function mr<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { headers: HEADERS, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Modrinth a répondu ${res.status}`);
  return (await res.json()) as T;
}

// Quilt charge aussi les mods Fabric.
const loaderSet = (loader: CloudLoader) => (loader === "quilt" ? ["quilt", "fabric"] : [loader]);

export type ModHit = { slug: string; title: string; author: string; description: string; icon: string | null; downloads: number };
export async function searchCloudMods(query: string, mc: string, loader: CloudLoader): Promise<ModHit[]> {
  const facets: string[][] = [["project_type:mod"], loaderSet(loader).map((l) => `categories:${l}`)];
  if (MC_ID.test(mc)) facets.push([`versions:${mc}`]);
  const params = new URLSearchParams({ query: query.trim().slice(0, 80), facets: JSON.stringify(facets), limit: "20", index: query.trim() ? "relevance" : "downloads" });
  const { hits } = await mr<{ hits: { slug: string; title: string; author: string; description: string; icon_url: string | null; downloads: number }[] }>(`/search?${params}`);
  return hits.map((h) => ({ slug: h.slug.toLowerCase(), title: h.title, author: h.author, description: h.description, icon: h.icon_url, downloads: h.downloads }));
}

function pickFile(versions: MrVersion[], mc: string, loader: CloudLoader) {
  const loaders = loaderSet(loader);
  const ok = versions
    .filter((v) => v.game_versions.includes(mc) && v.loaders.some((l) => loaders.includes(l)))
    .sort(
      (a, b) =>
        // Quilt : une version Quilt d'abord, sinon celle de Fabric.
        Number(!a.loaders.includes(loader)) - Number(!b.loaders.includes(loader)) ||
        Number(a.version_type !== "release") - Number(b.version_type !== "release") ||
        b.date_published.localeCompare(a.date_published),
    );
  for (const v of ok) {
    const file = v.files.find((f) => f.primary && f.filename.endsWith(".jar")) ?? v.files.find((f) => f.filename.endsWith(".jar"));
    if (file && new URL(file.url).hostname === "cdn.modrinth.com" && file.hashes.sha1) return { version: v, file };
  }
  return null;
}

// Dernière version du chargeur pour cette version de Minecraft (sites officiels des chargeurs).
async function latestLoaderVersion(loader: CloudLoader, mc: string): Promise<string> {
  const get = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) throw new Error(`Le site du chargeur a répondu ${res.status}`);
    return (await res.json()) as T;
  };
  if (loader === "fabric") {
    const list = await get<{ loader: { version: string; stable: boolean } }[]>(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mc)}`);
    const pick = list.find((l) => l.loader.stable) ?? list[0];
    if (pick) return pick.loader.version;
  } else if (loader === "quilt") {
    const list = await get<{ loader: { version: string } }[]>(`https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(mc)}`);
    const pick = list.find((l) => !/beta|pre|rc/i.test(l.loader.version)) ?? list[0];
    if (pick) return pick.loader.version;
  } else if (loader === "forge") {
    const { promos } = await get<{ promos: Record<string, string> }>("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json");
    const v = promos[`${mc}-recommended`] ?? promos[`${mc}-latest`];
    if (v) return v;
  } else {
    // NeoForge : 1.21.1 → 21.1.x, 1.21 → 21.0.x.
    const [, minor, patch = "0"] = mc.split(".");
    const prefix = `${minor}.${patch}.`;
    const { versions } = await get<{ versions: string[] }>("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge");
    const ok = versions.filter((v) => v.startsWith(prefix)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const stable = ok.filter((v) => !/beta|alpha/i.test(v));
    const pick = (stable.length ? stable : ok).at(-1);
    if (pick) return pick;
  }
  throw new Error(`${loader === "neoforge" ? "NeoForge" : loader[0].toUpperCase() + loader.slice(1)} n'existe pas pour Minecraft ${mc}.`);
}

// Les mods choisis (et leurs dépendances obligatoires) pour une version de Minecraft et un chargeur.
async function resolvePack(slugs: string[], mc: string, loader: CloudLoader) {
  const projects = (await mr<MrProject[]>(`/projects?ids=${encodeURIComponent(JSON.stringify(slugs))}`)).filter((p) => p.project_type === "mod");
  const found = new Set(projects.flatMap((p) => [p.id, p.slug.toLowerCase()]));
  const unknown = slugs.filter((s) => !found.has(s));
  if (unknown.length) throw new Error(`Introuvable sur Modrinth (ou pas un mod) : ${unknown.slice(0, 5).join(", ")}`);
  const loadersParam = encodeURIComponent(JSON.stringify(loaderSet(loader)));
  const mcParam = encodeURIComponent(JSON.stringify([mc]));
  const versionsOf = async (id: string) => mr<MrVersion[]>(`/project/${encodeURIComponent(id)}/version?loaders=${loadersParam}&game_versions=${mcParam}`);
  const files: PackFile[] = [];
  const missing: { projectId: string; title: string }[] = [];
  const picks = await Promise.all(projects.map(async (p) => ({ p, pick: pickFile(await versionsOf(p.id), mc, loader) })));
  const deps = new Set<string>();
  for (const { p, pick } of picks) {
    if (!pick) {
      missing.push({ projectId: p.id, title: p.title });
      continue;
    }
    files.push({ projectId: p.id, title: p.title, url: pick.file.url, filename: pick.file.filename, sha1: pick.file.hashes.sha1, size: pick.file.size });
    for (const d of pick.version.dependencies) if (d.dependency_type === "required" && d.project_id && !found.has(d.project_id)) deps.add(d.project_id);
  }
  const depIds = [...deps].slice(0, 30);
  if (depIds.length) {
    const depProjects = await mr<MrProject[]>(`/projects?ids=${encodeURIComponent(JSON.stringify(depIds))}`);
    const depPicks = await Promise.all(depProjects.map(async (p) => ({ p, pick: pickFile(await versionsOf(p.id), mc, loader) })));
    for (const { p, pick } of depPicks) {
      if (!pick) missing.push({ projectId: p.id, title: `${p.title} (dépendance)` });
      else if (!files.some((f) => f.projectId === p.id)) files.push({ projectId: p.id, title: p.title, url: pick.file.url, filename: pick.file.filename, sha1: pick.file.hashes.sha1, size: pick.file.size });
    }
  }
  return { projects: projects.map((p) => ({ slug: p.slug.toLowerCase(), title: p.title })), files, missing };
}

// --- Créer / modifier / supprimer --------------------------------------------------------------
export type SaveInput = { id?: string; name: string; minecraftVersion: string; loader: string; mods: string[] };
export type SaveResult = { ok: true; id: string; missing: string[] } | { ok: false; error: string };

export async function saveCloudPack(userId: string, offer: PlayOffer, input: SaveInput): Promise<SaveResult> {
  const name = clean(input.name, 60);
  const mc = clean(input.minecraftVersion, 16);
  const loader = CLOUD_LOADERS.find((l) => l === input.loader);
  const mods = [...new Set((Array.isArray(input.mods) ? input.mods : []).map((m) => String(m).toLowerCase().trim()).filter((m) => SLUG.test(m)))].slice(0, MAX_MODS);
  if (!name) return { ok: false, error: "Donne un nom à ton modpack." };
  if (!MC_ID.test(mc)) return { ok: false, error: "Choisis une version de Minecraft." };
  if (!loader) return { ok: false, error: "Choisis un chargeur (Fabric, Quilt, NeoForge ou Forge)." };
  if (!mods.length) return { ok: false, error: "Ajoute au moins un mod." };
  const existing = input.id ? await findPack(userId, input.id) : null;
  if (input.id && !existing) return { ok: false, error: "Modpack introuvable." };
  if (!existing) {
    const [{ n }] = await execSql('SELECT COUNT(*) AS "n" FROM "cloudPack" WHERE "userId" = ?', [userId]);
    if (Number(n) >= MAX_PACKS) return { ok: false, error: `${MAX_PACKS} modpacks au maximum.` };
  }
  let resolved: Awaited<ReturnType<typeof resolvePack>>;
  let loaderVersion: string;
  try {
    [resolved, loaderVersion] = await Promise.all([resolvePack(mods, mc, loader), latestLoaderVersion(loader, mc)]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Modrinth n'a pas répondu. Réessaie dans un instant." };
  }
  if (!resolved.files.length) return { ok: false, error: `Aucun de ces mods n'existe pour Minecraft ${mc} (${loader}).` };
  const files = JSON.stringify(resolved.files);
  const projects = JSON.stringify(resolved.projects);
  // Place : la liste ne pèse presque rien, mais le quota reste vérifié.
  const usage = await cloudUsage(userId, offer);
  const before = existing ? packSize(existing) : 0;
  const after = (Number(existing?.configBytes) || 0) + Buffer.byteLength(files) + Buffer.byteLength(projects);
  if (usage.total - before + after > usage.quota) return { ok: false, error: "Ton cloud est plein : supprime quelque chose d'abord." };
  const id = existing?.id ?? randomUUID();
  if (existing) {
    await execSql('UPDATE "cloudPack" SET "name" = ?, "minecraftVersion" = ?, "loader" = ?, "loaderVersion" = ?, "projects" = ?, "files" = ?, "missing" = ?, "updatedAt" = ? WHERE "id" = ? AND "userId" = ?', [
      name, mc, loader, loaderVersion, projects, files, JSON.stringify(resolved.missing), now(), id, userId,
    ]);
  } else {
    await execSql('INSERT INTO "cloudPack" ("id", "userId", "name", "minecraftVersion", "loader", "loaderVersion", "projects", "files", "missing", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      id, userId, name, mc, loader, loaderVersion, projects, files, JSON.stringify(resolved.missing), now(), now(),
    ]);
  }
  return { ok: true, id, missing: resolved.missing.map((m) => m.title) };
}

export async function deleteCloudPack(userId: string, id: string): Promise<boolean> {
  const pack = await findPack(userId, id);
  if (!pack) return false;
  if (pack.configKey) await deleteObjects([pack.configKey], PACKS_BUCKET).catch(() => undefined);
  await execSql('DELETE FROM "cloudPack" WHERE "id" = ? AND "userId" = ?', [pack.id, userId]);
  return true;
}

// --- Relier à un serveur -----------------------------------------------------------------------
export type LinkResult = { ok: true } | { ok: false; error: "notFound" | "server" | "limit"; limit?: number };

// Serveurs du compte (propriétaire), pour la fenêtre « Relier à un serveur ».
export async function ownedServers(userId: string): Promise<{ id: string; name: string; slug: string; minecraftVersion: string; type: string }[]> {
  const rows = await execSql('SELECT "id", "name", "slug", "minecraftVersion", "type" FROM "server" WHERE "ownerId" = ? ORDER BY "name"', [userId]);
  return rows.map((r: Row) => ({ id: r.id, name: r.name, slug: r.slug, minecraftVersion: r.minecraftVersion, type: r.type }));
}

export async function linkCloudPack(userId: string, offer: PlayOffer, packId: string, serverId: string, mode: LinkMode): Promise<LinkResult> {
  const pack = await findPack(userId, packId);
  if (!pack) return { ok: false, error: "notFound" };
  const [server] = await execSql('SELECT "id" FROM "server" WHERE "id" = ? AND "ownerId" = ?', [String(serverId), userId]);
  if (!server) return { ok: false, error: "server" };
  // Serveurs reliés par l'offre (0 = sans limite) : le modpack déjà relié à CE serveur sera
  // remplacé, il ne compte donc pas.
  if (offer.packServers > 0) {
    const [{ n }] = await execSql('SELECT COUNT(*) AS "n" FROM "cloudPack" WHERE "userId" = ? AND "serverId" IS NOT NULL AND "serverId" <> ? AND "id" <> ?', [userId, server.id, pack.id]);
    if (Number(n) >= offer.packServers) return { ok: false, error: "limit", limit: offer.packServers };
  }
  // Un serveur n'a qu'un modpack relié : l'ancien est délié.
  await execSql('UPDATE "cloudPack" SET "serverId" = NULL, "linkMode" = NULL WHERE "serverId" = ? AND "id" <> ?', [server.id, pack.id]);
  await execSql('UPDATE "cloudPack" SET "serverId" = ?, "linkMode" = ?, "updatedAt" = ? WHERE "id" = ?', [server.id, mode === "required" ? "required" : "suggested", now(), pack.id]);
  return { ok: true };
}

export async function unlinkCloudPack(userId: string, packId: string): Promise<boolean> {
  const pack = await findPack(userId, packId);
  if (!pack) return false;
  await execSql('UPDATE "cloudPack" SET "serverId" = NULL, "linkMode" = NULL, "updatedAt" = ? WHERE "id" = ?', [now(), pack.id]);
  return true;
}

// --- Fichiers de configuration (.zip) ----------------------------------------------------------
// Chemin dans l'instance du joueur : config/… ou defaultconfigs/… tels quels ; un fichier envoyé
// sans ce dossier (le joueur a zippé le CONTENU de config/) est rangé dans config/.
export function configTarget(name: string): string {
  return /^(config|defaultconfigs)\//.test(name) ? name : `config/${name}`;
}

export function checkConfigZip(buf: Uint8Array): { count: number } {
  let entries;
  try {
    const tail = readZipTail(buf.subarray(Math.max(0, buf.byteLength - 22)), buf.byteLength);
    entries = readCentralDirectory(buf.subarray(tail.centralOffset, tail.centralOffset + tail.centralSize), tail.count);
  } catch {
    throw new Error("Ce fichier n'est pas un .zip lisible (refais-le avec « Compresser » de Windows, sans commentaire).");
  }
  if (entries.length > CONFIG_MAX_ENTRIES) throw new Error("Trop de fichiers dans ce .zip.");
  let count = 0;
  let unpacked = 0;
  const seen = new Set<string>();
  for (const e of entries) {
    const name = e.name;
    if (name.includes("\\") || name.includes("\0") || name.startsWith("/") || name.split("/").includes("..")) throw new Error(`Fichier refusé : ${name.slice(0, 80)}`);
    if (name.split("/").some((seg) => /[. ]$/.test(seg) || /[<>:"|?*\x00-\x1f]/.test(seg))) throw new Error(`Nom de fichier refusé : ${name.slice(0, 80)}`);
    if (name.endsWith("/")) continue;
    if (!CONFIG_EXT.test(name)) throw new Error(`Seulement des fichiers de configuration (.json, .toml, .cfg, .properties, .txt…). Refusé : ${name.slice(0, 80)}`);
    const key = configTarget(name).toLowerCase();
    if (seen.has(key)) throw new Error(`Fichier en double : ${name.slice(0, 80)}`);
    seen.add(key);
    unpacked += e.size;
    if (unpacked > CONFIG_MAX_UNPACKED) throw new Error("Ces fichiers sont trop gros une fois décompressés.");
    count++;
  }
  if (!count) throw new Error("Ce .zip ne contient aucun fichier de configuration.");
  return { count };
}

export function configObjectKey(userId: string, packId: string): string {
  return `${WORLDS_PREFIX}${userId}/cloudpack.${packId}/config.zip`;
}

export async function storeConfigZip(userId: string, offer: PlayOffer, packId: string, buf: Uint8Array): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const pack = await findPack(userId, packId);
  if (!pack) return { ok: false, error: "Modpack introuvable." };
  if (buf.byteLength > CONFIG_MAX_BYTES) return { ok: false, error: "4 Mo au maximum pour les fichiers de configuration." };
  let count: number;
  try {
    ({ count } = checkConfigZip(buf));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fichier refusé." };
  }
  const usage = await cloudUsage(userId, offer);
  if (usage.total - (Number(pack.configBytes) || 0) + buf.byteLength > usage.quota) return { ok: false, error: "Pas assez de place dans ton cloud." };
  const key = configObjectKey(userId, pack.id);
  await putWorldObject(key, buf, PACKS_BUCKET);
  const sha1 = createHash("sha1").update(buf).digest("hex");
  await execSql('UPDATE "cloudPack" SET "configKey" = ?, "configBytes" = ?, "configCount" = ?, "configSha1" = ?, "updatedAt" = ? WHERE "id" = ?', [key, buf.byteLength, count, sha1, now(), pack.id]);
  return { ok: true, count };
}

export async function removeConfigs(userId: string, packId: string): Promise<boolean> {
  const pack = await findPack(userId, packId);
  if (!pack) return false;
  if (pack.configKey) await deleteObjects([pack.configKey], PACKS_BUCKET).catch(() => undefined);
  await execSql('UPDATE "cloudPack" SET "configKey" = NULL, "configBytes" = 0, "configCount" = 0, "configSha1" = NULL, "updatedAt" = ? WHERE "id" = ?', [now(), pack.id]);
  return true;
}

// --- Côté joueur (fiche du serveur, launcher) -------------------------------------------------
export type ServerCloudPack = {
  id: string;
  name: string;
  mode: LinkMode;
  minecraftVersion: string;
  loader: CloudLoader;
  modCount: number;
  configCount: number;
  mods: string[];
  updatedAt: string;
};

export async function serverCloudPackRow(serverId: string): Promise<Row | null> {
  const [row] = await execSql('SELECT * FROM "cloudPack" WHERE "serverId" = ?', [serverId]);
  return row ?? null;
}

// Fiche publique du serveur (site) : seulement quand l'interrupteur est ouvert à tous (Bêta publique
// ou Pour tous), car ces pages sont en cache, les mêmes pour tout le monde.
export async function publicCloudPackForSlug(slug: string): Promise<ServerCloudPack | null> {
  const state = await featureState("cloudPacks").catch(() => "hidden");
  if (state !== "beta" && state !== "all") return null;
  const [row] = await execSql('SELECT p.* FROM "cloudPack" p JOIN "server" s ON s."id" = p."serverId" WHERE s."slug" = ?', [slug]).catch(() => []);
  return row ? publicPackInfo(row) : null;
}

export function publicPackInfo(row: Row): ServerCloudPack {
  const p = toPack(row);
  return {
    id: p.id,
    name: p.name,
    mode: p.linkMode ?? "suggested",
    minecraftVersion: p.minecraftVersion,
    loader: p.loader,
    modCount: p.files.length,
    configCount: p.configCount,
    mods: p.files.map((f) => f.title || f.filename).slice(0, MAX_MODS),
    updatedAt: p.updatedAt,
  };
}

// Ce que le launcher installe : liens Modrinth vérifiés et, s'il y en a, un lien signé (1 h) vers
// l'archive des configs. Le chargeur s'écrit comme ailleurs dans le launcher (« fabric-0.16.9 »).
export function launcherInstallPayload(row: Row) {
  const p = toPack(row);
  return {
    source: "cloud" as const,
    modpack: { id: p.id, name: p.name },
    minecraftVersion: p.minecraftVersion,
    file: {
      id: `${p.id}-${Date.parse(p.updatedAt) || 0}`,
      displayName: p.name,
      fileName: "config.zip",
      downloadUrl: row.configKey ? presignDownload(row.configKey, undefined, PACKS_BUCKET) : null,
      fileLength: p.configBytes,
      sha1: row.configSha1 ?? null,
    },
    cloud: {
      mode: p.linkMode ?? "suggested",
      minecraftVersion: p.minecraftVersion,
      loaderId: `${p.loader}-${p.loaderVersion}`,
      files: p.files
        .filter((f) => {
          try {
            return new URL(f.url).hostname === "cdn.modrinth.com" && SAFE_JAR.test(f.filename);
          } catch {
            return false;
          }
        })
        .map((f) => ({ path: `mods/${f.filename}`, url: f.url, sha1: f.sha1 ?? null, size: f.size ?? null, title: f.title ?? f.filename })),
    },
  };
}

export async function countInstall(packId: string): Promise<void> {
  await execSql('UPDATE "cloudPack" SET "installCount" = "installCount" + 1 WHERE "id" = ?', [packId]).catch(() => undefined);
}
