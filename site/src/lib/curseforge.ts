import "server-only";

// Recherche de modpacks via l'API officielle CurseForge (console.curseforge.com) —
// necessite une cle API (CURSEFORGE_API_KEY dans .env, jamais exposee au
// client). gameId 432 = Minecraft, classId 4471 = categorie "Modpacks" :
// https://docs.curseforge.com/rest-api/
const SEARCH_URL = "https://api.curseforge.com/v1/mods/search";
const MINECRAFT_GAME_ID = 432;
const MODPACK_CLASS_ID = 4471;

export type CurseforgeModpack = {
  id: string;
  name: string;
  summary: string;
  iconUrl: string | null;
  latestVersion: string | null;
};

type CurseforgeSearchResponse = {
  data: {
    id: number;
    name: string;
    summary: string;
    logo: { thumbnailUrl: string } | null;
    latestFiles: { displayName: string; fileName: string }[];
  }[];
};

export class CurseforgeNotConfiguredError extends Error {
  constructor() {
    super("CURSEFORGE_API_KEY n'est pas configurée.");
    this.name = "CurseforgeNotConfiguredError";
  }
}

// Pas de cache ici (contrairement a getMinecraftVersions) : une recherche
// par texte libre a trop peu de chances de rehit pour que ça vaille le
// budget mémoire du cache Next.js.
export async function searchCurseforgeModpacks(query: string): Promise<CurseforgeModpack[]> {
  const apiKey = process.env.CURSEFORGE_API_KEY;
  if (!apiKey) throw new CurseforgeNotConfiguredError();
  if (!query.trim()) return [];

  const url = new URL(SEARCH_URL);
  url.searchParams.set("gameId", String(MINECRAFT_GAME_ID));
  url.searchParams.set("classId", String(MODPACK_CLASS_ID));
  url.searchParams.set("searchFilter", query.trim());
  url.searchParams.set("sortField", "2"); // popularité
  url.searchParams.set("pageSize", "8");

  const res = await fetch(url, { headers: { "x-api-key": apiKey, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Réponse ${res.status} de l'API CurseForge`);

  const body: CurseforgeSearchResponse = await res.json();
  return body.data.map((mod) => ({
    id: String(mod.id),
    name: mod.name,
    summary: mod.summary,
    iconUrl: mod.logo?.thumbnailUrl ?? null,
    latestVersion: mod.latestFiles[0]?.displayName ?? mod.latestFiles[0]?.fileName ?? null,
  }));
}
