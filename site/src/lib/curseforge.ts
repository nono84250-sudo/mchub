import "server-only";
import type { ModpackSearchResult } from "@/lib/modpack-types";

// Recherche de modpacks via l'API officielle CurseForge (console.curseforge.com) —
// necessite une cle API (CURSEFORGE_API_KEY dans .env, jamais exposee au
// client). gameId 432 = Minecraft, classId 4471 = categorie "Modpacks" :
// https://docs.curseforge.com/rest-api/
const SEARCH_URL = "https://api.curseforge.com/v1/mods/search";
const MINECRAFT_GAME_ID = 432;
const MODPACK_CLASS_ID = 4471;


type CurseforgeSearchResponse = {
  data: {
    id: number;
    name: string;
    summary: string;
    logo: { thumbnailUrl: string } | null;
    latestFiles: { displayName: string; fileName: string; gameVersions?: string[] }[];
    latestFilesIndexes?: { gameVersion: string; modLoader?: number }[];
  }[];
};

// L'API melange versions de Minecraft et chargeurs dans un meme tableau
// (ex. ["1.20.1", "Forge"]) et n'indique pas toujours le chargeur ; dans ce
// cas on le retrouve via latestFilesIndexes (modLoader : 1 Forge, 4 Fabric,
// 5 Quilt, 6 NeoForge). Verifie sur de vraies reponses le 2026-09-25.
const KNOWN_LOADERS = ["NeoForge", "Forge", "Fabric", "Quilt"];
const LOADER_BY_ID: Record<number, string> = { 1: "Forge", 4: "Fabric", 5: "Quilt", 6: "NeoForge" };

function describeLatestFile(mod: CurseforgeSearchResponse["data"][number]) {
  const gameVersions = mod.latestFiles[0]?.gameVersions ?? [];
  const minecraftVersion = gameVersions.find((v) => /^\d+\.\d+(\.\d+)?$/.test(v)) ?? null;

  let loader = KNOWN_LOADERS.find((known) => gameVersions.some((v) => v.toLowerCase() === known.toLowerCase())) ?? null;
  if (!loader && minecraftVersion) {
    const index = mod.latestFilesIndexes?.find((i) => i.gameVersion === minecraftVersion && i.modLoader && LOADER_BY_ID[i.modLoader]);
    if (index?.modLoader) loader = LOADER_BY_ID[index.modLoader];
  }
  return { minecraftVersion, loader };
}

export class CurseforgeNotConfiguredError extends Error {
  constructor() {
    super("CURSEFORGE_API_KEY n'est pas configurée.");
    this.name = "CurseforgeNotConfiguredError";
  }
}

// Pas de cache ici (contrairement a getMinecraftVersions) : une recherche
// par texte libre a trop peu de chances de rehit pour que ça vaille le
// budget mémoire du cache Next.js.
export async function searchCurseforgeModpacks(query: string): Promise<ModpackSearchResult[]> {
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
    ...describeLatestFile(mod),
  }));
}

// ---------------------------------------------------------------------------
// Installation d'un modpack par le launcher (voir launcher/src/modpack.js).
// Le launcher ne parle jamais a CurseForge directement : la cle reste ici, il
// passe par les routes /api/launcher/servers/[slug]/modpack et
// /api/launcher/curseforge/files, qui s'appuient sur ces fonctions.
// ---------------------------------------------------------------------------

const API_BASE = "https://api.curseforge.com";

// Deux cas de 403 tres differents : AVEC le texte "API Key missing or invalid"
// la cle est invalide ou revoquee ; SANS corps, la cle est reconnue mais n'a pas
// le droit d'appeler ce point d'acces (cle limitee a la recherche, par exemple).
export class CurseforgeForbiddenError extends Error {
  endpoint: string;
  invalidKey: boolean;
  constructor(endpoint: string, invalidKey: boolean) {
    super(
      invalidKey
        ? "La clé API CurseForge est invalide ou a été révoquée."
        : "CurseForge a refusé cet appel : la clé API n'a pas accès à ce point d'accès.",
    );
    this.name = "CurseforgeForbiddenError";
    this.endpoint = endpoint;
    this.invalidKey = invalidKey;
  }
}

async function curseforgeRequest<T>(pathAndQuery: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const apiKey = process.env.CURSEFORGE_API_KEY;
  if (!apiKey) throw new CurseforgeNotConfiguredError();

  const res = await fetch(API_BASE + pathAndQuery, {
    method: init?.method ?? "GET",
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 403) throw new CurseforgeForbiddenError(pathAndQuery, /api key/i.test(await res.text()));
  if (!res.ok) throw new Error(`Réponse ${res.status} de l'API CurseForge`);
  return (await res.json()) as T;
}

type CurseforgeFileRaw = {
  id: number;
  modId: number;
  displayName: string;
  fileName: string;
  downloadUrl: string | null;
  fileLength: number;
  hashes?: { value: string; algo: number }[];
  fileDate?: string;
};

export type CurseforgeFileInfo = {
  id: number;
  modId: number;
  displayName: string;
  fileName: string;
  // null quand l'auteur interdit la redistribution hors de CurseForge : le
  // fichier ne peut pas etre installe automatiquement.
  downloadUrl: string | null;
  fileLength: number;
  sha1: string | null;
};

function toFileInfo(file: CurseforgeFileRaw): CurseforgeFileInfo {
  return {
    id: file.id,
    modId: file.modId,
    displayName: file.displayName,
    fileName: file.fileName,
    downloadUrl: file.downloadUrl,
    fileLength: file.fileLength,
    sha1: file.hashes?.find((h) => h.algo === 1)?.value ?? null,
  };
}

/**
 * Fichier du modpack a installer : celui dont le nom correspond a la version
 * enregistree sur la fiche du serveur (ce que le proprietaire a choisi), sinon
 * le plus recent. `hints.name` sert de repli : avec une cle limitee a la
 * recherche, le detail d'un modpack par identifiant est refuse, alors on le
 * retrouve par son nom dans les resultats de recherche.
 */
export async function getModpackInstallFile(modpackId: string, hints: { name?: string | null; version?: string | null }) {
  type Mod = { id: number; name: string; latestFiles: CurseforgeFileRaw[] };

  let mod: Mod | undefined;
  try {
    mod = (await curseforgeRequest<{ data: Mod }>(`/v1/mods/${encodeURIComponent(modpackId)}`)).data;
  } catch (error) {
    if (!(error instanceof CurseforgeForbiddenError) || !hints.name) throw error;
    const params = new URLSearchParams({
      gameId: String(MINECRAFT_GAME_ID),
      classId: String(MODPACK_CLASS_ID),
      searchFilter: hints.name,
      pageSize: "20",
    });
    const found = await curseforgeRequest<{ data: Mod[] }>(`/v1/mods/search?${params}`);
    mod = found.data.find((m) => String(m.id) === modpackId);
    if (!mod) throw error;
  }

  const candidates = mod.latestFiles.filter((f) => f.downloadUrl);
  const pinned = hints.version
    ? candidates.find((f) => f.displayName === hints.version || f.fileName === hints.version)
    : undefined;
  const newest = [...candidates].sort((a, b) => (b.fileDate ?? "").localeCompare(a.fileDate ?? ""))[0];
  const file = pinned ?? newest;
  if (!file) {
    throw new Error("Aucun fichier téléchargeable pour ce modpack (son auteur a peut-être interdit la redistribution).");
  }

  return { modpack: { id: modpackId, name: mod.name }, file: toFileInfo(file) };
}

// Liens de telechargement d'une liste de fichiers (les mods d'un modpack) —
// par lots de 100 pour rester sous la limite de l'API.
export async function getFilesInfo(fileIds: number[]): Promise<CurseforgeFileInfo[]> {
  const files: CurseforgeFileInfo[] = [];
  for (let i = 0; i < fileIds.length; i += 100) {
    const response = await curseforgeRequest<{ data: CurseforgeFileRaw[] }>("/v1/mods/files", {
      method: "POST",
      body: { fileIds: fileIds.slice(i, i + 100) },
    });
    files.push(...response.data.map(toFileInfo));
  }
  return files;
}
