import "server-only";
import type { ModpackChannel, ModpackSearchResult } from "@/lib/modpack-types";

// Recherche de modpacks via l'API officielle CurseForge (console.curseforge.com) —
// necessite une cle API (CURSEFORGE_API_KEY dans .env, jamais exposee au
// client). gameId 432 = Minecraft, classId 4471 = categorie "Modpacks" :
// https://docs.curseforge.com/rest-api/
const SEARCH_URL = "https://api.curseforge.com/v1/mods/search";
const MINECRAFT_GAME_ID = 432;
const MODPACK_CLASS_ID = 4471;


// releaseType de l'API CurseForge (confirme en testant la vraie reponse de /v1/mods/{id}/files
// le 2026-10-12) : 1 = Release, 2 = Beta, 3 = Alpha. Jamais d'alpha propose automatiquement,
// ni en recherche ni a l'installation (voir CHANNEL_RELEASE_TYPES ci-dessous).
type CurseforgeReleaseType = 1 | 2 | 3;

type CurseforgeSearchFile = { displayName: string; fileName: string; gameVersions?: string[]; releaseType?: CurseforgeReleaseType; fileDate?: string };

type CurseforgeSearchResponse = {
  data: {
    id: number;
    name: string;
    summary: string;
    logo: { thumbnailUrl: string } | null;
    latestFiles: CurseforgeSearchFile[];
    latestFilesIndexes?: { gameVersion: string; modLoader?: number }[];
  }[];
};

// L'API melange versions de Minecraft et chargeurs dans un meme tableau
// (ex. ["1.20.1", "Forge"]) et n'indique pas toujours le chargeur ; dans ce
// cas on le retrouve via latestFilesIndexes (modLoader : 1 Forge, 4 Fabric,
// 5 Quilt, 6 NeoForge). Verifie sur de vraies reponses le 2026-09-25.
const KNOWN_LOADERS = ["NeoForge", "Forge", "Fabric", "Quilt"];
const LOADER_BY_ID: Record<number, string> = { 1: "Forge", 4: "Fabric", 5: "Quilt", 6: "NeoForge" };

function describeLatestFile(mod: CurseforgeSearchResponse["data"][number], file: CurseforgeSearchFile | undefined) {
  const gameVersions = file?.gameVersions ?? [];
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
// `channel` (2026-10-13, canal beta) : en mode "release" (par defaut), comportement inchange
// (fichier le plus recent de latestFiles, quel que soit son releaseType — aucune regression
// pour les appelants existants). En mode "beta", NE montre que les modpacks qui ont reellement
// une version beta (releaseType 2) — un modpack sans beta disparait de la liste plutot que de
// reafficher sa derniere release (ModpackPicker.tsx affiche alors "Aucune version bêta trouvée").
export async function searchCurseforgeModpacks(query: string, channel: ModpackChannel = "release"): Promise<ModpackSearchResult[]> {
  const apiKey = process.env.CURSEFORGE_API_KEY;
  if (!apiKey) throw new CurseforgeNotConfiguredError();
  if (!query.trim()) return [];

  const url = new URL(SEARCH_URL);
  url.searchParams.set("gameId", String(MINECRAFT_GAME_ID));
  url.searchParams.set("classId", String(MODPACK_CLASS_ID));
  url.searchParams.set("searchFilter", query.trim());
  url.searchParams.set("sortField", "2"); // popularité
  url.searchParams.set("pageSize", "8");

  const res = await fetch(url, { headers: { "x-api-key": apiKey, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Réponse ${res.status} de l'API CurseForge`);

  const body: CurseforgeSearchResponse = await res.json();
  const results: ModpackSearchResult[] = [];
  for (const mod of body.data) {
    let file: CurseforgeSearchFile | undefined;
    if (channel === "beta") {
      const betaFiles = mod.latestFiles.filter((f) => f.releaseType === 2);
      file = [...betaFiles].sort((a, b) => (b.fileDate ?? "").localeCompare(a.fileDate ?? ""))[0];
      if (!file) continue; // aucune beta pour ce modpack : exclu de la liste (jamais sa release a la place)
    } else {
      file = mod.latestFiles[0];
    }
    results.push({
      id: String(mod.id),
      name: mod.name,
      summary: mod.summary,
      iconUrl: mod.logo?.thumbnailUrl ?? null,
      latestVersion: file?.displayName ?? file?.fileName ?? null,
      ...describeLatestFile(mod, file),
    });
  }
  return results;
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
    signal: AbortSignal.timeout(8000),
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
  releaseType?: CurseforgeReleaseType;
};

// Canal -> releaseType autorises (voir le commentaire sur CurseforgeReleaseType plus haut) :
// "release" n'installe jamais que du stable, "beta" accepte aussi le beta pour qu'un serveur
// qui a choisi ce canal continue de suivre les mises a jour meme si l'auteur ne publie plus
// que des beta — jamais d'alpha dans un cas comme dans l'autre.
const CHANNEL_RELEASE_TYPES: Record<ModpackChannel, CurseforgeReleaseType[]> = { release: [1], beta: [1, 2] };

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
  // Seulement pour un fichier sans downloadUrl (14/10) : nom du mod et page CurseForge du
  // fichier, que le launcher montre au joueur pour qu'il le telecharge lui-meme.
  modName?: string | null;
  pageUrl?: string | null;
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
 * Fichier le plus recent du modpack a installer — jamais une version figee :
 * l'auteur du modpack peut la changer a tout moment cote CurseForge, le
 * serveur doit toujours suivre (voir le commentaire sur curseforgeModpackVersion
 * dans contract.prisma). `hints.name` sert de repli pour retrouver le modpack
 * par son nom dans la recherche : avec une cle limitee a la recherche, le
 * detail d'un modpack par identifiant est refuse.
 */
export async function getModpackInstallFile(modpackId: string, hints: { name?: string | null }, channel: ModpackChannel = "release") {
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

  // Filtre par canal AVANT de choisir le plus recent (voir CHANNEL_RELEASE_TYPES) : un fichier
  // sans releaseType connu (ancienne reponse, champ absent) est traite comme une release, pour
  // ne jamais bloquer l'installation d'un modpack dont l'API ne renvoie pas cette info.
  const allowedTypes = CHANNEL_RELEASE_TYPES[channel];
  const candidates = mod.latestFiles.filter((f) => f.downloadUrl && (f.releaseType === undefined || allowedTypes.includes(f.releaseType)));
  const file = [...candidates].sort((a, b) => (b.fileDate ?? "").localeCompare(a.fileDate ?? ""))[0];
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
  await addBlockedModPages(files);
  return files;
}

// Mods dont l'auteur interdit le telechargement par les autres launchers (downloadUrl vide) :
// on ajoute leur nom et la page CurseForge du fichier, pour que le joueur puisse le telecharger
// lui-meme (voir launcher/src/modpack.js). Un appel de plus, seulement s'il y a de tels mods.
// En cas d'echec (cle limitee a la recherche...), le launcher se contente d'une recherche
// CurseForge par nom de fichier : pas de quoi faire echouer la route.
async function addBlockedModPages(files: CurseforgeFileInfo[]) {
  const modIds = [...new Set(files.filter((f) => !f.downloadUrl).map((f) => f.modId))];
  if (!modIds.length) return;
  type Mod = { id: number; name: string; links?: { websiteUrl?: string | null } };
  try {
    const mods = new Map<number, Mod>();
    for (let i = 0; i < modIds.length; i += 100) {
      const response = await curseforgeRequest<{ data: Mod[] }>("/v1/mods", { method: "POST", body: { modIds: modIds.slice(i, i + 100) } });
      for (const mod of response.data) mods.set(mod.id, mod);
    }
    for (const file of files) {
      if (file.downloadUrl) continue;
      const mod = mods.get(file.modId);
      file.modName = mod?.name ?? null;
      file.pageUrl = curseforgeFilePage(mod?.links?.websiteUrl, file.id);
    }
  } catch (error) {
    console.error("Pages des mods bloqués CurseForge indisponibles :", error);
  }
}

function curseforgeFilePage(websiteUrl: string | null | undefined, fileId: number): string | null {
  if (!websiteUrl) return null;
  try {
    const url = new URL(websiteUrl);
    if (url.protocol !== "https:" || url.hostname !== "www.curseforge.com") return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/files/${fileId}`;
  } catch {
    return null;
  }
}
