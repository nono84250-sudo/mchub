import "server-only";
import type { ModpackInstallFile, ModpackSearchResult } from "@/lib/modpack-types";

// API publique de Modrinth (https://docs.modrinth.com) : aucune cle ni compte
// n'est necessaire pour lire et telecharger — seul un User-Agent qui identifie
// l'application est exige. Les fichiers viennent de cdn.modrinth.com.
const API_BASE = "https://api.modrinth.com/v2";
const HEADERS = {
  "User-Agent": "omniscient-launcher/0.1 (https://omniscient-theta.vercel.app)",
  Accept: "application/json",
};

type ModrinthVersion = {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  date_published: string;
  version_type: "release" | "beta" | "alpha";
  files: { url: string; filename: string; size: number; primary: boolean; hashes: { sha1?: string } }[];
};

async function modrinthRequest<T>(pathAndQuery: string): Promise<T> {
  const res = await fetch(API_BASE + pathAndQuery, { headers: HEADERS });
  if (!res.ok) throw new Error(`Réponse ${res.status} de l'API Modrinth`);
  return (await res.json()) as T;
}

const LOADER_NAMES: Record<string, string> = { neoforge: "NeoForge", forge: "Forge", fabric: "Fabric", quilt: "Quilt" };

function describeLoader(loaders: string[]): string | null {
  const known = Object.keys(LOADER_NAMES).find((l) => loaders.includes(l));
  return known ? LOADER_NAMES[known] : null;
}

// Versions "1.21.1" / "1.20" — pas les snapshots ("24w14a") ni les pre-versions.
const isReleaseGameVersion = (v: string) => /^\d+\.\d+(\.\d+)?$/.test(v);

/**
 * Recherche de modpacks, tries par nombre de telechargements. Trois appels au
 * total (recherche, projets, versions) plutot qu'un par resultat : la
 * recherche ne donne pas la derniere version d'un modpack, il faut aller la
 * chercher pour afficher sa version de Minecraft et son chargeur.
 */
export async function searchModrinthModpacks(query: string): Promise<ModpackSearchResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    query: query.trim(),
    facets: JSON.stringify([["project_type:modpack"]]),
    limit: "8",
    index: "downloads",
  });
  const { hits } = await modrinthRequest<{
    hits: { project_id: string; title: string; description: string; icon_url: string | null }[];
  }>(`/search?${params}`);
  if (!hits.length) return [];

  // Le tableau `versions` d'un projet est chronologique : la derniere entree est la plus recente.
  const projects = await modrinthRequest<{ id: string; versions: string[] }[]>(
    `/projects?ids=${encodeURIComponent(JSON.stringify(hits.map((h) => h.project_id)))}`,
  );
  const latestIds = projects.map((p) => p.versions[p.versions.length - 1]).filter(Boolean);
  const versions = latestIds.length
    ? await modrinthRequest<ModrinthVersion[]>(`/versions?ids=${encodeURIComponent(JSON.stringify(latestIds))}`)
    : [];
  const latestByProject = new Map(versions.map((v) => [v.project_id, v]));

  return hits.map((hit) => {
    const latest = latestByProject.get(hit.project_id);
    return {
      id: hit.project_id,
      name: hit.title,
      summary: hit.description,
      iconUrl: hit.icon_url,
      latestVersion: latest?.version_number ?? null,
      minecraftVersion: latest?.game_versions.find(isReleaseGameVersion) ?? null,
      loader: latest ? describeLoader(latest.loaders) : null,
    };
  });
}

/**
 * Fichier .mrpack a installer pour un serveur : la version enregistree sur sa
 * fiche (numero ou nom de version) si elle existe toujours, sinon la plus
 * recente compatible avec sa version de Minecraft, sinon la plus recente.
 * Les versions stables passent avant les beta/alpha.
 */
export async function getModrinthModpackInstallFile(
  projectIdOrSlug: string,
  hints: { version?: string | null; minecraftVersion?: string | null },
): Promise<{ modpack: { id: string; name: string }; file: ModpackInstallFile }> {
  const id = encodeURIComponent(projectIdOrSlug);
  const [project, versions] = await Promise.all([
    modrinthRequest<{ id: string; title: string }>(`/project/${id}`),
    modrinthRequest<ModrinthVersion[]>(`/project/${id}/version`),
  ]);

  const byNewest = [...versions].sort((a, b) => b.date_published.localeCompare(a.date_published));
  const pinned = hints.version
    ? byNewest.find((v) => v.version_number === hints.version || v.name === hints.version)
    : undefined;
  const compatible = hints.minecraftVersion ? byNewest.filter((v) => v.game_versions.includes(hints.minecraftVersion!)) : byNewest;
  const pool = compatible.length ? compatible : byNewest;
  const chosen = pinned ?? pool.find((v) => v.version_type === "release") ?? pool[0];
  if (!chosen) throw new Error("Ce modpack Modrinth n'a aucune version publiée.");

  const file = chosen.files.find((f) => f.primary) ?? chosen.files[0];
  if (!file || !file.filename.toLowerCase().endsWith(".mrpack")) {
    throw new Error("Cette version n'a pas de fichier .mrpack : ce n'est pas un modpack installable.");
  }

  return {
    modpack: { id: project.id, name: project.title },
    file: {
      id: chosen.id,
      displayName: chosen.version_number,
      fileName: file.filename,
      downloadUrl: file.url,
      fileLength: file.size,
      sha1: file.hashes.sha1 ?? null,
    },
  };
}
