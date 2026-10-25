import "server-only";
import { revalidateTag } from "next/cache";
import { execSql } from "@/lib/db";
import { PLAY_TAG, type PackFile } from "@/lib/playWorlds";

// Admin « Packs officiels » (mode Jouer, bêta, 24/10). Un pack = une liste de projets Modrinth.
// À l'enregistrement, on prépare tout seul une version du pack pour chaque version de Minecraft
// où les mods existent (Fabric), avec un statut :
//   to_test    : tous les mods existent, à tester dans le launcher puis marquer « Testée » ;
//   review     : il en manque un peu (pack créé sans eux), à revoir ;
//   not_enough : il en manque trop, pas de pack pour cette version.
// Rien n'est hébergé chez nous : on garde les liens cdn.modrinth.com et leurs empreintes.
const API = "https://api.modrinth.com/v2";
const HEADERS = { "User-Agent": "omniscient-launcher/0.1 (https://omniscientlauncher.com)", Accept: "application/json" };
const isRelease = (v: string) => /^\d+\.\d+(\.\d+)?$/.test(v);
// Au moins 75 % des mods pour garder une version (« À revoir »), sinon « Pas assez de mods ».
const REVIEW_RATIO = 0.75;
const MAX_PROJECTS = 60;

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
type MrProject = { id: string; slug: string; title: string; game_versions: string[]; loaders: string[] };

async function mr<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { headers: HEADERS, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Modrinth a répondu ${res.status}`);
  return (await res.json()) as T;
}

// Dernière version stable de Fabric Loader.
async function latestFabricLoader(): Promise<string> {
  const res = await fetch("https://meta.fabricmc.net/v2/versions/loader", { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Fabric a répondu ${res.status}`);
  const list = (await res.json()) as { version: string; stable: boolean }[];
  const stable = list.find((l) => l.stable) ?? list[0];
  if (!stable) throw new Error("Aucune version de Fabric trouvée");
  return stable.version;
}

// "sodium, lithium\nhttps://modrinth.com/mod/iris" → ["sodium", "lithium", "iris"]
export function parseProjectList(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const m = raw.trim().match(/(?:modrinth\.com\/(?:mod|plugin|datapack|shader|resourcepack)\/)?([\w.-]{2,64})\/?$/i);
    if (m && !out.includes(m[1].toLowerCase())) out.push(m[1].toLowerCase());
  }
  return out.slice(0, MAX_PROJECTS);
}

// Fichier .jar à prendre pour un projet et une version de Minecraft : release d'abord, la plus récente.
function pickFile(versions: MrVersion[], mc: string): { version: MrVersion; file: MrVersion["files"][number] } | null {
  const ok = versions
    .filter((v) => v.loaders.includes("fabric") && v.game_versions.includes(mc))
    .sort((a, b) => Number(a.version_type !== "release") - Number(b.version_type !== "release") || b.date_published.localeCompare(a.date_published));
  for (const v of ok) {
    const file = v.files.find((f) => f.primary && f.filename.endsWith(".jar")) ?? v.files.find((f) => f.filename.endsWith(".jar"));
    if (file && new URL(file.url).hostname === "cdn.modrinth.com") return { version: v, file };
  }
  return null;
}

export type PreparedVersion = { minecraftVersion: string; files: PackFile[]; missing: { projectId: string; title: string }[]; status: "to_test" | "review" | "not_enough" };

// Prépare le pack pour toutes les versions de Minecraft (release) où au moins un mod existe.
// Les dépendances obligatoires (souvent Fabric API) sont ajoutées toutes seules.
export async function preparePackVersions(projectRefs: string[]): Promise<{ projects: MrProject[]; versions: PreparedVersion[]; loaderVersion: string }> {
  if (!projectRefs.length) throw new Error("Ajoute au moins un mod Modrinth.");
  const projects = await mr<MrProject[]>(`/projects?ids=${encodeURIComponent(JSON.stringify(projectRefs))}`);
  const found = new Set(projects.flatMap((p) => [p.id, p.slug.toLowerCase()]));
  const unknown = projectRefs.filter((r) => !found.has(r) && !found.has(r.toLowerCase()));
  if (unknown.length) throw new Error(`Introuvable sur Modrinth : ${unknown.join(", ")}`);

  const versionsByProject = new Map<string, MrVersion[]>();
  const loadVersions = async (ids: string[]) => {
    const lists = await Promise.all(ids.map((id) => mr<MrVersion[]>(`/project/${encodeURIComponent(id)}/version?loaders=${encodeURIComponent('["fabric"]')}`)));
    ids.forEach((id, i) => versionsByProject.set(id, lists[i]));
  };
  await loadVersions(projects.map((p) => p.id));

  // Dépendances obligatoires citées par les versions de ces mods (un seul niveau suffit en pratique).
  const deps = new Set<string>();
  for (const list of versionsByProject.values()) for (const v of list) for (const d of v.dependencies) if (d.dependency_type === "required" && d.project_id && !versionsByProject.has(d.project_id)) deps.add(d.project_id);
  const depIds = [...deps].slice(0, 20);
  const depProjects = depIds.length ? await mr<MrProject[]>(`/projects?ids=${encodeURIComponent(JSON.stringify(depIds))}`) : [];
  await loadVersions(depProjects.map((p) => p.id));

  const all = [...projects, ...depProjects];
  const titleOf = new Map(all.map((p) => [p.id, p.title]));
  const mcVersions = [...new Set(projects.flatMap((p) => p.game_versions).filter(isRelease))].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  );
  const loaderVersion = await latestFabricLoader();

  const versions: PreparedVersion[] = mcVersions.map((mc): PreparedVersion => {
    const files: PackFile[] = [];
    const missing: { projectId: string; title: string }[] = [];
    for (const p of projects) {
      const pick = pickFile(versionsByProject.get(p.id) ?? [], mc);
      if (!pick) {
        missing.push({ projectId: p.id, title: p.title });
        continue;
      }
      files.push({ projectId: p.id, title: p.title, url: pick.file.url, filename: pick.file.filename, sha1: pick.file.hashes.sha1, size: pick.file.size });
      for (const d of pick.version.dependencies) {
        if (d.dependency_type !== "required" || !d.project_id || files.some((f) => f.projectId === d.project_id) || projects.some((x) => x.id === d.project_id)) continue;
        const dep = pickFile(versionsByProject.get(d.project_id) ?? [], mc);
        if (dep) files.push({ projectId: d.project_id, title: titleOf.get(d.project_id) ?? d.project_id, url: dep.file.url, filename: dep.file.filename, sha1: dep.file.hashes.sha1, size: dep.file.size });
        else missing.push({ projectId: d.project_id, title: titleOf.get(d.project_id) ?? d.project_id });
      }
    }
    const ratio = (projects.length - missing.filter((m) => projects.some((p) => p.id === m.projectId)).length) / projects.length;
    const depMissing = missing.some((m) => !projects.some((p) => p.id === m.projectId));
    const status = depMissing || ratio < REVIEW_RATIO ? "not_enough" : missing.length ? "review" : "to_test";
    return { minecraftVersion: mc, files, missing, status };
  }).filter((v) => v.files.some((f) => projects.some((p) => p.id === f.projectId)));
  return { projects, versions, loaderVersion };
}

// --- Recherche de mods pour le formulaire (25/10, preview validée par Rushi) -----------------
// Le formulaire « Nouveau pack » cherche les mods Fabric de Modrinth au lieu d'une liste tapée à
// la main. Seuls les noms courts (slug) partent ensuite dans `projects`, comme avant.
export type ModChoice = { slug: string; title: string; author: string; description: string; icon: string | null; downloads: number; versions: string[] };

const releaseVersions = (list: string[]) => list.filter(isRelease).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

export async function searchFabricMods(query: string, sort: "downloads" | "relevance" = "downloads"): Promise<ModChoice[]> {
  const params = new URLSearchParams({
    query: query.trim().slice(0, 80),
    facets: JSON.stringify([["project_type:mod"], ["categories:fabric"]]),
    limit: "20",
    index: sort,
  });
  const { hits } = await mr<{ hits: { slug: string; title: string; author: string; description: string; icon_url: string | null; downloads: number; versions: string[] }[] }>(`/search?${params}`);
  return hits.map((h) => ({ slug: h.slug.toLowerCase(), title: h.title, author: h.author, description: h.description, icon: h.icon_url, downloads: h.downloads, versions: releaseVersions(h.versions ?? []) }));
}

// Mods déjà dans un pack (formulaire de modification) : nom, icône et versions depuis leur slug.
export async function describeMods(slugs: string[]): Promise<ModChoice[]> {
  const refs = slugs.slice(0, MAX_PROJECTS);
  if (!refs.length) return [];
  const projects = await mr<(MrProject & { description: string; icon_url: string | null; downloads: number })[]>(`/projects?ids=${encodeURIComponent(JSON.stringify(refs))}`);
  return projects.map((p) => ({ slug: p.slug.toLowerCase(), title: p.title, author: "", description: p.description, icon: p.icon_url, downloads: p.downloads, versions: releaseVersions(p.game_versions) }));
}

// Dépendances obligatoires de la dernière version Fabric d'un mod (affichage seulement : la
// préparation des versions les recalcule de toute façon pour chaque version de Minecraft).
export async function requiredDeps(slug: string): Promise<{ slug: string; title: string }[]> {
  const versions = await mr<MrVersion[]>(`/project/${encodeURIComponent(slug)}/version?loaders=${encodeURIComponent('["fabric"]')}`);
  const latest = [...versions].sort((a, b) => b.date_published.localeCompare(a.date_published))[0];
  const ids = [...new Set((latest?.dependencies ?? []).filter((d) => d.dependency_type === "required" && d.project_id).map((d) => d.project_id as string))].slice(0, 10);
  if (!ids.length) return [];
  const projects = await mr<MrProject[]>(`/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`);
  return projects.map((p) => ({ slug: p.slug.toLowerCase(), title: p.title }));
}

type Row = Record<string, any>;
const now = () => new Date().toISOString();

export async function listAdminPacks(): Promise<(Row & { versions: Row[] })[]> {
  const [packs, versions] = await Promise.all([
    execSql('SELECT * FROM "playPack" ORDER BY "createdAt" DESC'),
    execSql('SELECT "id", "packId", "minecraftVersion", "loaderVersion", "files", "missing", "status", "published", "updatedAt" FROM "playPackVersion"'),
  ]);
  return packs.map((p: Row) => ({
    ...p,
    versions: versions
      .filter((v: Row) => v.packId === p.id)
      .sort((a: Row, b: Row) => b.minecraftVersion.localeCompare(a.minecraftVersion, undefined, { numeric: true })),
  }));
}

// Enregistre un pack (nouveau ou modifié) puis prépare ses versions. Une version déjà marquée
// « Testée » dont la liste de fichiers n'a pas changé garde son statut et sa publication ; sinon
// elle repasse « À tester » et est retirée du launcher.
export async function savePack(input: { id?: string; slug: string; nameFr: string; nameEn: string; descriptionFr: string; descriptionEn: string; projects: string[] }): Promise<{ id: string; counts: Record<string, number> }> {
  const prepared = await preparePackVersions(input.projects);
  const id = input.id ?? crypto.randomUUID();
  if (input.id) {
    await execSql('UPDATE "playPack" SET "slug" = ?, "nameFr" = ?, "nameEn" = ?, "descriptionFr" = ?, "descriptionEn" = ?, "modrinthProjects" = ?, "updatedAt" = ? WHERE "id" = ?', [
      input.slug, input.nameFr, input.nameEn, input.descriptionFr, input.descriptionEn, JSON.stringify(input.projects), now(), id,
    ]);
  } else {
    await execSql('INSERT INTO "playPack" ("id", "slug", "nameFr", "nameEn", "descriptionFr", "descriptionEn", "modrinthProjects") VALUES (?, ?, ?, ?, ?, ?, ?)', [
      id, input.slug, input.nameFr, input.nameEn, input.descriptionFr, input.descriptionEn, JSON.stringify(input.projects),
    ]);
  }
  const existing = new Map((await execSql('SELECT * FROM "playPackVersion" WHERE "packId" = ?', [id])).map((r: Row) => [r.minecraftVersion, r]));
  const counts: Record<string, number> = { tested: 0, to_test: 0, review: 0, not_enough: 0 };
  for (const v of prepared.versions) {
    const files = JSON.stringify(v.files);
    const old = existing.get(v.minecraftVersion);
    existing.delete(v.minecraftVersion);
    const sameFiles = old && old.files === files;
    const status = sameFiles && old.status === "tested" ? "tested" : v.status;
    const published = sameFiles && v.status !== "not_enough" ? Number(old.published) : 0;
    counts[status] = (counts[status] ?? 0) + 1;
    if (old) {
      await execSql('UPDATE "playPackVersion" SET "loaderVersion" = ?, "files" = ?, "missing" = ?, "status" = ?, "published" = ?, "updatedAt" = ? WHERE "id" = ?', [
        sameFiles ? old.loaderVersion : prepared.loaderVersion, files, JSON.stringify(v.missing), status, published, now(), old.id,
      ]);
    } else {
      await execSql('INSERT INTO "playPackVersion" ("id", "packId", "minecraftVersion", "loaderVersion", "files", "missing", "status", "published") VALUES (?, ?, ?, ?, ?, ?, ?, 0)', [
        crypto.randomUUID(), id, v.minecraftVersion, prepared.loaderVersion, files, JSON.stringify(v.missing), status,
      ]);
    }
  }
  // Versions de Minecraft qui n'ont plus aucun mod : retirées.
  for (const old of existing.values()) await execSql('DELETE FROM "playPackVersion" WHERE "id" = ?', [old.id]);
  revalidateTag(PLAY_TAG, { expire: 0 });
  return { id, counts };
}

export async function setPackVersionState(versionId: string, change: { status?: "tested" | "to_test"; published?: boolean }): Promise<string | null> {
  const [v] = await execSql('SELECT "status" FROM "playPackVersion" WHERE "id" = ?', [versionId]);
  if (!v) return "Version introuvable.";
  if (change.published && v.status === "not_enough") return "Pas assez de mods pour cette version : impossible de la publier.";
  if (change.status) await execSql('UPDATE "playPackVersion" SET "status" = ?, "updatedAt" = ? WHERE "id" = ?', [change.status, now(), versionId]);
  if (change.published !== undefined) await execSql('UPDATE "playPackVersion" SET "published" = ?, "updatedAt" = ? WHERE "id" = ?', [change.published ? 1 : 0, now(), versionId]);
  revalidateTag(PLAY_TAG, { expire: 0 });
  return null;
}

export async function deletePack(id: string): Promise<void> {
  await execSql('DELETE FROM "playPackVersion" WHERE "packId" = ?', [id]);
  await execSql('DELETE FROM "playPack" WHERE "id" = ?', [id]);
  revalidateTag(PLAY_TAG, { expire: 0 });
}
