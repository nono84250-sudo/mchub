import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { execSql } from "@/lib/db";
import { featureState } from "@/lib/features";
import type { PackFile, PlayOffer } from "@/lib/playWorlds";
import { usedBytes as worldsUsedBytes } from "@/lib/playWorlds";
import { readCentralDirectory, readZipTail } from "@/lib/omniArchiveCheck";
import { PACKS_BUCKET, WORLDS_PREFIX, deleteObjects, deletePrefix, objectSize, presignDownload, presignPut, putWorldObject, readWorldObject } from "@/lib/worldStorage";
import { JAR_MAX_BYTES, curseforgeFingerprint, scanJar, zipEntries, zipRead, type Entry as ZipEntry } from "@/lib/jarScan";
import { matchCurseforgeFingerprints } from "@/lib/curseforge";

// Mon cloud (03/11, preview « Mon cloud » v2 validée par Rushi). Un propriétaire de serveur garde
// ses modpacks dans son cloud : une liste de mods Modrinth (des liens cdn.modrinth.com avec leurs
// empreintes) et ses fichiers de configuration. Depuis le 03/11 (accord de Rushi) il se crée dans le
// launcher et peut aussi contenir des mods CurseForge (en RÉFÉRENCE, jamais le fichier) et des mods
// perso contrôlés par jarScan.ts, donnés seulement aux joueurs de son serveur.
// Il en relie un à son serveur : « Obligatoire pour rejoindre » (le launcher l'installe avant de se
// connecter) ou « Conseillé » (le joueur peut jouer sans, le bouton reste proposé).
// Jamais de monde, ni le fichier d'un mod CurseForge, dans un modpack du cloud.
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
// Fichiers d'un modpack envoyé par le launcher : mods (.jar Modrinth), packs de ressources et
// shaders (.zip), un nom de fichier simple dans son dossier.
const FILE_PATH = /^(mods\/[^/\\]+\.jar|(resourcepacks|shaderpacks)\/[^/\\]+\.zip)$/i;
// Jamais dans l'archive d'un modpack du cloud (programmes, scripts système).
const FORBIDDEN_EXT = /\.(jar|exe|dll|bat|cmd|com|scr|msi|msp|ps1|psm1|vbs|vbe|wsf|wsh|hta|lnk|sh|so|dylib|class|pif|reg|cpl|jse|url)$/i;

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

// Fichier d'un modpack : `path` (03/11, envoi depuis le launcher) = où il va dans l'instance
// (mods/…, resourcepacks/…, shaderpacks/…). Absent = un mod (mods/<filename>).
// `source` (03/11, accord de Rushi) : absent = Modrinth (lien cdn.modrinth.com) ;
//   "cf" = mod CurseForge en RÉFÉRENCE (projet + fichier) : chaque joueur le télécharge depuis
//          CurseForge, Omniscient ne garde jamais le fichier. Permis parce que le modpack est privé,
//          relié au serveur de son propriétaire (à bloquer le jour où des modpacks seront publiés) ;
//   "custom" = mod perso du propriétaire, rangé dans son cloud (`key`), contrôlé par jarScan.ts ;
//          `pending` tant que le contrôle n'est pas fait (jamais donné aux joueurs).
type CloudFile = PackFile & { path?: string; source?: "cf" | "custom"; cf?: { projectId: number; fileId: number }; key?: string; pending?: boolean };

export type CloudPack = {
  id: string;
  name: string;
  minecraftVersion: string;
  loader: CloudLoader;
  loaderVersion: string;
  projects: { slug: string; title: string }[];
  files: CloudFile[];
  missing: { projectId: string; title: string }[];
  configBytes: number;
  configCount: number;
  sizeBytes: number;
  serverId: string | null;
  serverName: string | null;
  serverSlug: string | null;
  linkMode: LinkMode | null;
  linkNote: string | null;
  installCount: number;
  updatedAt: string;
};

// Place prise par un modpack : ses configs, ses mods perso, plus la liste des liens (quelques Ko).
const customBytes = (files: unknown) => parse<CloudFile[]>(files, []).reduce((a, f) => a + (f.source === "custom" ? Number(f.size) || 0 : 0), 0);
const packSize = (r: Row) => (Number(r.configBytes) || 0) + customBytes(r.files) + Buffer.byteLength(String(r.files ?? "")) + Buffer.byteLength(String(r.projects ?? ""));

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
    linkNote: r.serverId && typeof r.linkNote === "string" && r.linkNote.trim() ? r.linkNote : null,
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
  await deletePrefix(packPrefix(userId, pack.id), PACKS_BUCKET).catch(() => undefined);
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

// « Pourquoi utiliser ce modpack ? » (03/11) : un texte court, sans retour à la ligne.
export const LINK_NOTE_MAX = 200;
export const cleanLinkNote = (v: unknown) => {
  const t = String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, LINK_NOTE_MAX);
  return t || null;
};

export async function linkCloudPack(userId: string, offer: PlayOffer, packId: string, serverId: string, mode: LinkMode, note?: string | null): Promise<LinkResult> {
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
  await execSql('UPDATE "cloudPack" SET "serverId" = NULL, "linkMode" = NULL, "linkNote" = NULL WHERE "serverId" = ? AND "id" <> ?', [server.id, pack.id]);
  await execSql('UPDATE "cloudPack" SET "serverId" = ?, "linkMode" = ?, "linkNote" = ?, "updatedAt" = ? WHERE "id" = ?', [server.id, mode === "required" ? "required" : "suggested", cleanLinkNote(note), now(), pack.id]);
  return { ok: true };
}

export async function unlinkCloudPack(userId: string, packId: string): Promise<boolean> {
  const pack = await findPack(userId, packId);
  if (!pack) return false;
  await execSql('UPDATE "cloudPack" SET "serverId" = NULL, "linkMode" = NULL, "linkNote" = NULL, "updatedAt" = ? WHERE "id" = ?', [now(), pack.id]);
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

const packPrefix = (userId: string, packId: string) => `${WORLDS_PREFIX}${userId}/cloudpack.${packId}/`;
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

// --- Envoi depuis le launcher (03/11, retour de Rushi) ----------------------------------------
// Le modpack se fait dans le launcher (Jouer › une version › ⚙ › Envoyer dans le cloud) : il envoie
// un .mrpack (mods en liens Modrinth, configs, packs de ressources et shaders de l'installation).
// Le site lit modrinth.index.json, vérifie chaque fichier de l'archive, puis range le .mrpack tel
// quel dans le cloud du compte. Même nom qu'un modpack déjà envoyé = mise à jour (reste relié).
// 03/11 (Rushi : « 4 Mo, c'est pas assez ») : le .mrpack part directement du launcher vers le
// stockage (lien signé), jamais par le site ; le site le relit ensuite pour le contrôler.
export const MRPACK_MAX_BYTES = 100 * 1000 * 1000;
const MRPACK_MAX_UNPACKED = 500 * 1000 * 1000;
const uploadPrefix = (userId: string) => `${WORLDS_PREFIX}${userId}/cloudupload/`;

// Lien de dépôt (1 h) d'un .mrpack, rangé à part jusqu'à son contrôle.
export function startLauncherUpload(userId: string): { key: string; url: string } {
  const key = `${uploadPrefix(userId)}${randomUUID()}.mrpack`;
  console.log(`[Mon cloud] lien de dépôt : bucket=${PACKS_BUCKET} clé=${key}`);
  return { key, url: presignPut(key, PACKS_BUCKET) };
}

// Relit le .mrpack déposé (seulement sous le dossier de CE compte), le contrôle et le range.
export async function storeUploadedPack(userId: string, offer: PlayOffer, givenName: string, key: string) {
  if (!key.startsWith(uploadPrefix(userId)) || !/^[\w/.-]+\.mrpack$/.test(key) || key.includes("..")) return { ok: false as const, error: "Envoi introuvable." };
  try {
    const size = await objectSize(key, PACKS_BUCKET).catch(() => null);
    console.log(`[Mon cloud] relecture : bucket=${PACKS_BUCKET} clé=${key} taille=${size ?? "introuvable"}`);
    if (!size) return { ok: false as const, error: "Le modpack n'est pas arrivé dans le stockage : réessaie." };
    if (size > MRPACK_MAX_BYTES) return { ok: false as const, error: "100 Mo au maximum pour un modpack (sans les mods)." };
    const data = await readWorldObject(key, MRPACK_MAX_BYTES + 1, PACKS_BUCKET);
    if (!data) return { ok: false as const, error: "Le modpack n'est pas arrivé dans le stockage : réessaie." };
    return await storeLauncherPack(userId, offer, givenName, data);
  } finally {
    await deleteObjects([key], PACKS_BUCKET).catch(() => undefined);
  }
}

// Ce que l'archive peut contenir. Renvoie la raison du refus, ou null.
function refusedPackEntry(name: string): string | null {
  if (name.includes("\\") || name.includes("\0") || name.startsWith("/") || name.split("/").includes("..")) return "nom";
  if (name.split("/").some((seg) => /[. ]$/.test(seg) || /[<>:"|?*\x00-\x1f]/.test(seg))) return "nom";
  if (FORBIDDEN_EXT.test(name)) return "programme";
  if (name === "modrinth.index.json" || name === "omniscient.json") return null;
  if (name === "overrides/omniscient-a-telecharger.txt") return "hors Modrinth";
  if (name.endsWith("/")) return /^overrides\/((config|defaultconfigs|kubejs|resourcepacks|shaderpacks)\/.*)?$/.test(name) ? null : "dossier";
  if (name === "overrides/options.txt") return null;
  if (/^overrides\/(config|defaultconfigs|kubejs)\/.+/.test(name)) return null;
  if (/^overrides\/(resourcepacks|shaderpacks)\/[^/]+\.zip$/i.test(name)) return null;
  return "dossier";
}

type MrIndex = { formatVersion?: number; game?: string; name?: string; files?: { path?: string; hashes?: { sha1?: string }; downloads?: string[]; fileSize?: number; env?: { client?: string } }[]; dependencies?: Record<string, string> };

export async function storeLauncherPack(userId: string, offer: PlayOffer, givenName: string, data: Uint8Array): Promise<{ ok: true; id: string; name: string; mods: number; configs: number; updated: boolean } | { ok: false; error: string }> {
  if (data.byteLength > MRPACK_MAX_BYTES) return { ok: false, error: "100 Mo au maximum pour un modpack (sans les mods)." };
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  let entries: ZipEntry[];
  try {
    entries = zipEntries(buf, CONFIG_MAX_ENTRIES);
  } catch {
    return { ok: false, error: "Le fichier envoyé par le launcher est illisible." };
  }
  if (entries.length > CONFIG_MAX_ENTRIES) return { ok: false, error: "Trop de fichiers dans ce modpack." };
  let configs = 0;
  let unpacked = 0;
  for (const e of entries) {
    const why = refusedPackEntry(e.name);
    if (why === "hors Modrinth") return { ok: false, error: "Ce modpack a des mods qui ne viennent pas de Modrinth : ils ne peuvent pas aller dans le cloud." };
    if (why) return { ok: false, error: `Fichier refusé dans le modpack : ${e.name.slice(0, 80)}${why === "programme" ? " (jamais de .jar ni de programme)" : ""}` };
    unpacked += e.size;
    if (unpacked > MRPACK_MAX_UNPACKED) return { ok: false, error: "Ce modpack est trop gros une fois décompressé." };
    if (!e.name.endsWith("/") && e.name.startsWith("overrides/") && !/^overrides\/(resourcepacks|shaderpacks)\//.test(e.name) && e.name !== "overrides/options.txt") configs++;
  }
  const head = entries.find((e) => e.name === "modrinth.index.json");
  if (!head) return { ok: false, error: "modrinth.index.json manquant." };
  let index: MrIndex;
  try {
    index = JSON.parse(zipRead(buf, head, 8 * 1024 * 1024).toString("utf8")) as MrIndex;
  } catch {
    return { ok: false, error: "modrinth.index.json illisible." };
  }
  const deps = index.dependencies ?? {};
  const mc = clean(deps.minecraft, 16);
  const loaderKey = (["neoforge", "forge", "fabric-loader", "quilt-loader"] as const).find((k) => deps[k]);
  const loader = loaderKey ? ({ neoforge: "neoforge", forge: "forge", "fabric-loader": "fabric", "quilt-loader": "quilt" } as const)[loaderKey] : null;
  const loaderVersion = loaderKey ? clean(deps[loaderKey], 40) : "";
  if (!MC_ID.test(mc)) return { ok: false, error: "Version de Minecraft invalide." };
  if (!loader || !/^[\w.+-]{1,40}$/.test(loaderVersion)) return { ok: false, error: "Une version vanilla n'a pas de mods à envoyer : choisis une version avec un chargeur (Fabric, NeoForge…)." };
  const files: CloudFile[] = [];
  for (const f of Array.isArray(index.files) ? index.files : []) {
    if (f.env?.client === "unsupported" && String(f.path).startsWith("mods/")) continue;
    const p = String(f.path ?? "");
    const url = (f.downloads ?? []).find((u) => {
      try {
        return new URL(u).hostname === "cdn.modrinth.com" && new URL(u).protocol === "https:";
      } catch {
        return false;
      }
    });
    const sha1 = String(f.hashes?.sha1 ?? "");
    if (!FILE_PATH.test(p) || !url || !/^[0-9a-f]{40}$/.test(sha1)) return { ok: false, error: `Fichier refusé (pas un lien Modrinth) : ${p.slice(0, 80)}` };
    files.push({ projectId: "", title: p.split("/").pop() ?? p, url, filename: p.split("/").pop() ?? p, sha1, size: Number(f.fileSize) || undefined, path: p });
  }
  if (files.length > MAX_MODS * 2) return { ok: false, error: "Trop de fichiers dans ce modpack." };
  // Vrais noms des mods (Modrinth, par empreinte) : affichage seulement, au mieux.
  try {
    const res = await fetch(`${API}/version_files`, { method: "POST", headers: { ...HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ hashes: files.map((f) => f.sha1), algorithm: "sha1" }), signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (res.ok) {
      const byHash = (await res.json()) as Record<string, { project_id: string }>;
      const ids = [...new Set(Object.values(byHash).map((v) => v.project_id))].slice(0, 300);
      const projects = ids.length ? await mr<MrProject[]>(`/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`) : [];
      const title = new Map(projects.map((p) => [p.id, p.title]));
      for (const f of files) {
        const v = byHash[f.sha1 ?? ""];
        if (v) {
          f.projectId = v.project_id;
          f.title = title.get(v.project_id) ?? f.title;
        }
      }
    }
  } catch {
    // Les noms de fichiers restent affichés.
  }
  const name = clean(givenName, 60) || clean(index.name, 60) || `Modpack ${mc}`;
  const [existing] = await execSql('SELECT * FROM "cloudPack" WHERE "userId" = ? AND "name" = ?', [userId, name]);
  if (!existing) {
    const [{ n }] = await execSql('SELECT COUNT(*) AS "n" FROM "cloudPack" WHERE "userId" = ?', [userId]);
    if (Number(n) >= MAX_PACKS) return { ok: false, error: `${MAX_PACKS} modpacks au maximum dans ton cloud.` };
  }
  // Mods CurseForge et perso : envoyés juste après (setPackRefs) ; ceux d'avant restent en attendant.
  if (existing) files.push(...parse<CloudFile[]>(existing.files, []).filter((f) => f.source === "cf" || f.source === "custom"));
  const filesJson = JSON.stringify(files);
  const projectsJson = JSON.stringify(files.filter((f) => f.path?.startsWith("mods/")).map((f) => ({ slug: f.projectId, title: f.title ?? f.filename })));
  const usage = await cloudUsage(userId, offer);
  const before = existing ? packSize(existing) : 0;
  const after = buf.length + Buffer.byteLength(filesJson) + Buffer.byteLength(projectsJson);
  if (usage.total - before + after > usage.quota) return { ok: false, error: "Pas assez de place dans ton cloud." };
  const id = existing?.id ?? randomUUID();
  const key = `${WORLDS_PREFIX}${userId}/cloudpack.${id}/pack.mrpack`;
  await putWorldObject(key, buf, PACKS_BUCKET);
  if (existing?.configKey && existing.configKey !== key) await deleteObjects([existing.configKey], PACKS_BUCKET).catch(() => undefined);
  const sha1 = createHash("sha1").update(buf).digest("hex");
  if (existing) {
    await execSql('UPDATE "cloudPack" SET "minecraftVersion" = ?, "loader" = ?, "loaderVersion" = ?, "projects" = ?, "files" = ?, "missing" = \'[]\', "configKey" = ?, "configBytes" = ?, "configCount" = ?, "configSha1" = ?, "updatedAt" = ? WHERE "id" = ?', [
      mc, loader, loaderVersion, projectsJson, filesJson, key, buf.length, configs, sha1, now(), id,
    ]);
  } else {
    await execSql('INSERT INTO "cloudPack" ("id", "userId", "name", "minecraftVersion", "loader", "loaderVersion", "projects", "files", "configKey", "configBytes", "configCount", "configSha1", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      id, userId, name, mc, loader, loaderVersion, projectsJson, filesJson, key, buf.length, configs, sha1, now(), now(),
    ]);
  }
  return { ok: true, id, name, mods: files.filter((f) => !f.source && f.path?.startsWith("mods/")).length, configs, updated: !!existing };
}

// --- Mods CurseForge (liens) et mods perso (03/11) --------------------------------------------
export const MAX_CUSTOM = 40;
type RefsInput = { curseforge?: unknown; custom?: unknown };
export type RefsResult =
  | { ok: true; uploads: { sha1: string; file: string; url: string }[]; curseforge: number; custom: number; usage: CloudUsage }
  | { ok: false; error: string };

const jarName = (v: unknown) => {
  const n = clean(v, 120);
  return SAFE_JAR.test(n) ? n : null;
};

export async function setPackRefs(userId: string, offer: PlayOffer, packId: string, input: RefsInput): Promise<RefsResult> {
  const pack = await findPack(userId, packId);
  if (!pack) return { ok: false, error: "Modpack introuvable." };
  const cfIn = Array.isArray(input.curseforge) ? input.curseforge.slice(0, MAX_MODS * 2) : [];
  const customIn = Array.isArray(input.custom) ? input.custom : [];
  if (customIn.length > MAX_CUSTOM) return { ok: false, error: `${MAX_CUSTOM} mods perso au maximum dans un modpack.` };
  const old = parse<CloudFile[]>(pack.files, []);
  const kept = old.filter((f) => !f.source);
  const cf: CloudFile[] = [];
  for (const x of cfIn as Row[]) {
    const file = jarName(x?.file);
    const projectId = Number(x?.projectId);
    const fileId = Number(x?.fileId);
    if (!file || !(projectId > 0) || !(fileId > 0)) return { ok: false, error: `Mod CurseForge illisible : ${clean(x?.name, 60) || "?"}` };
    const sha1 = /^[0-9a-f]{40}$/.test(String(x?.sha1 ?? "")) ? String(x.sha1) : undefined;
    cf.push({ projectId: String(projectId), title: clean(x?.name, 80) || file, url: "", filename: file, sha1, size: Number(x?.size) > 0 ? Number(x.size) : undefined, path: `mods/${file}`, source: "cf", cf: { projectId, fileId } });
  }
  const oldCustom = new Map(old.filter((f) => f.source === "custom" && f.key && !f.pending).map((f) => [f.sha1, f]));
  const custom: CloudFile[] = [];
  const uploads: { sha1: string; file: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const x of customIn as Row[]) {
    const file = jarName(x?.file);
    const sha1 = String(x?.sha1 ?? "");
    const size = Number(x?.size);
    if (!file || !/^[0-9a-f]{40}$/.test(sha1) || !(size > 0)) return { ok: false, error: `Mod perso illisible : ${clean(x?.file, 60) || "?"}` };
    if (size > JAR_MAX_BYTES) return { ok: false, error: `${file} : 30 Mo au maximum par mod.` };
    if (seen.has(sha1)) continue;
    seen.add(sha1);
    const before = oldCustom.get(sha1);
    if (before) {
      custom.push({ ...before, filename: file, path: `mods/${file}`, title: clean(x?.name, 80) || file });
      continue;
    }
    const key = `${packPrefix(userId, pack.id)}jars/${sha1}.jar`;
    custom.push({ projectId: "", title: clean(x?.name, 80) || file, url: "", filename: file, sha1, size, path: `mods/${file}`, source: "custom", key, pending: true });
    uploads.push({ sha1, file, url: presignPut(key, PACKS_BUCKET) });
  }
  const files = [...kept, ...cf, ...custom];
  const filesJson = JSON.stringify(files);
  const usage = await cloudUsage(userId, offer);
  const after = { ...pack, files: filesJson };
  if (usage.total - packSize(pack) + packSize(after) > usage.quota) return { ok: false, error: "Pas assez de place dans ton cloud pour ces mods perso." };
  // Mods perso qui ne sont plus dans le modpack : effacés du cloud.
  const gone = [...oldCustom.values()].filter((f) => !seen.has(f.sha1 ?? "")).map((f) => f.key!);
  if (gone.length) await deleteObjects(gone, PACKS_BUCKET).catch(() => undefined);
  await execSql('UPDATE "cloudPack" SET "files" = ?, "updatedAt" = ? WHERE "id" = ?', [filesJson, now(), pack.id]);
  return { ok: true, uploads, curseforge: cf.length, custom: custom.filter((f) => !f.pending).length, usage: await cloudUsage(userId, offer) };
}

// Contrôle des mods perso déposés. Un mod qui existe sur Modrinth devient son lien ; un mod qui
// existe sur CurseForge devient une référence CurseForge (le fichier est effacé de notre stockage) ;
// un mod refusé par jarScan est effacé et retiré du modpack.
export type FinalizeResult =
  | { ok: true; custom: number; modrinth: string[]; curseforge: string[]; refused: { file: string; reason: string }[]; usage: CloudUsage }
  | { ok: false; error: string };

export async function finalizePackJars(userId: string, offer: PlayOffer, packId: string): Promise<FinalizeResult> {
  const pack = await findPack(userId, packId);
  if (!pack) return { ok: false, error: "Modpack introuvable." };
  const files = parse<CloudFile[]>(pack.files, []);
  const pending = files.filter((f) => f.source === "custom" && f.pending && f.key);
  const refused: { file: string; reason: string }[] = [];
  const modrinth: string[] = [];
  const curseforge: string[] = [];
  const drop = new Set<CloudFile>();
  const checked: { f: CloudFile; data: Uint8Array }[] = [];
  for (const f of pending) {
    const size = await objectSize(f.key!, PACKS_BUCKET).catch(() => null);
    const data = size && size <= JAR_MAX_BYTES ? await readWorldObject(f.key!, JAR_MAX_BYTES + 1, PACKS_BUCKET) : null;
    const reason = !data
      ? "fichier pas reçu (réessaie l'envoi)"
      : data.byteLength !== f.size || createHash("sha1").update(data).digest("hex") !== f.sha1
        ? "fichier abîmé pendant l'envoi (réessaie)"
        : null;
    if (reason || !data) {
      refused.push({ file: f.filename, reason: reason ?? "fichier pas reçu" });
      drop.add(f);
      continue;
    }
    const scan = scanJar(data, String(pack.loader));
    if (!scan.ok) {
      refused.push({ file: f.filename, reason: scan.reason });
      drop.add(f);
      continue;
    }
    checked.push({ f, data });
  }
  // Modrinth (par empreinte SHA-1) : le lien plutôt que le fichier.
  if (checked.length) {
    try {
      const res = await fetch(`${API}/version_files`, { method: "POST", headers: { ...HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ hashes: checked.map((c) => c.f.sha1), algorithm: "sha1" }), signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (res.ok) {
        const byHash = (await res.json()) as Record<string, MrVersion>;
        for (const c of checked) {
          const v = byHash[c.f.sha1 ?? ""];
          const file = v?.files.find((x) => x.hashes.sha1 === c.f.sha1);
          if (!v || !file || new URL(file.url).hostname !== "cdn.modrinth.com") continue;
          Object.assign(c.f, { projectId: v.project_id, url: file.url, source: undefined, key: undefined, pending: undefined });
          modrinth.push(c.f.filename);
        }
      }
    } catch {
      // Modrinth injoignable : le mod reste un mod perso.
    }
  }
  // CurseForge (par empreinte) : jamais le fichier chez nous, une référence à la place.
  const left = checked.filter((c) => c.f.source === "custom");
  if (left.length) {
    let matches: Awaited<ReturnType<typeof matchCurseforgeFingerprints>>;
    try {
      matches = await matchCurseforgeFingerprints(left.map((c) => curseforgeFingerprint(c.data)));
    } catch {
      matches = [];
      for (const c of left) {
        refused.push({ file: c.f.filename, reason: "CurseForge n'a pas répondu, impossible de vérifier ce mod : réessaie dans un moment" });
        drop.add(c.f);
      }
    }
    const byFp = new Map(matches.map((m) => [m.fingerprint, m]));
    for (const c of left) {
      if (drop.has(c.f)) continue;
      const m = byFp.get(curseforgeFingerprint(c.data));
      if (m) {
        Object.assign(c.f, { projectId: String(m.projectId), source: "cf", cf: { projectId: m.projectId, fileId: m.fileId }, key: undefined, pending: undefined });
        curseforge.push(c.f.filename);
      } else c.f.pending = undefined;
    }
  }
  // Fichiers à effacer du stockage : refusés, devenus des liens Modrinth ou CurseForge.
  const erase = pending.filter((f) => drop.has(f) || f.source !== "custom").map((f) => `${packPrefix(userId, pack.id)}jars/${f.sha1}.jar`);
  if (erase.length) await deleteObjects(erase, PACKS_BUCKET).catch(() => undefined);
  const next = files.filter((f) => !drop.has(f)).map((f) => JSON.parse(JSON.stringify(f)) as CloudFile);
  await execSql('UPDATE "cloudPack" SET "files" = ?, "updatedAt" = ? WHERE "id" = ?', [JSON.stringify(next), now(), pack.id]);
  return { ok: true, custom: next.filter((f) => f.source === "custom" && !f.pending).length, modrinth, curseforge, refused, usage: await cloudUsage(userId, offer) };
}

// --- Côté joueur (fiche du serveur, launcher) -------------------------------------------------
export type ServerCloudPack = {
  id: string;
  name: string;
  mode: LinkMode;
  note: string | null;
  minecraftVersion: string;
  loader: CloudLoader;
  modCount: number;
  configCount: number;
  mods: string[];
  // 03/11 : mods perso du propriétaire (non vérifiés par Omniscient) et mods CurseForge (liens).
  customCount: number;
  curseforgeCount: number;
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
    note: p.linkNote,
    minecraftVersion: p.minecraftVersion,
    loader: p.loader,
    modCount: p.files.filter((f) => !f.pending && (!f.path || f.path.startsWith("mods/"))).length,
    configCount: p.configCount,
    mods: p.files.filter((f) => !f.pending && (!f.path || f.path.startsWith("mods/"))).map((f) => f.title || f.filename).slice(0, MAX_MODS),
    customCount: p.files.filter((f) => f.source === "custom" && !f.pending).length,
    curseforgeCount: p.files.filter((f) => f.source === "cf").length,
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
      fileName: row.configKey && String(row.configKey).endsWith(".mrpack") ? "pack.mrpack" : "config.zip",
      downloadUrl: row.configKey ? presignDownload(row.configKey, undefined, PACKS_BUCKET) : null,
      fileLength: p.configBytes,
      sha1: row.configSha1 ?? null,
    },
    cloud: {
      mode: p.linkMode ?? "suggested",
      minecraftVersion: p.minecraftVersion,
      loaderId: `${p.loader}-${p.loaderVersion}`,
      files: p.files
        .map((f) => ({ ...f, path: f.path ?? `mods/${f.filename}` }))
        .filter((f) => FILE_PATH.test(f.path) && !f.pending)
        .flatMap((f): { path: string; sha1: string | null; size: number | null; title: string; source: "mr" | "cf" | "custom"; url: string | null; cf?: { projectId: number; fileId: number } }[] => {
          const base = { path: f.path, sha1: f.sha1 ?? null, size: f.size ?? null, title: f.title ?? f.filename };
          if (f.source === "cf") return f.cf && f.path.startsWith("mods/") ? [{ ...base, source: "cf" as const, cf: f.cf, url: null }] : [];
          if (f.source === "custom") return f.key && f.sha1 && f.path.startsWith("mods/") ? [{ ...base, source: "custom" as const, url: presignDownload(f.key, undefined, PACKS_BUCKET) }] : [];
          try {
            return new URL(f.url).hostname === "cdn.modrinth.com" ? [{ ...base, source: "mr" as const, url: f.url }] : [];
          } catch {
            return [];
          }
        }),
    },
  };
}

export async function countInstall(packId: string): Promise<void> {
  await execSql('UPDATE "cloudPack" SET "installCount" = "installCount" + 1 WHERE "id" = ?', [packId]).catch(() => undefined);
}
