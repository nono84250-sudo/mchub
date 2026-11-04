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

// « Un pack existant » du launcher (28/10, Laboratoire « packBrowse ») : parcourir les modpacks
// CurseForge. Sans texte : les plus populaires. Le launcher n'installe jamais un mod bloqué par son
// auteur : il lit le pack (manifest.json) et passe par /api/launcher/curseforge/files comme pour un
// export CurseForge.
export type CurseforgePackHit = {
  id: number;
  name: string;
  summary: string;
  author: string;
  downloads: number;
  iconUrl: string | null;
  pageUrl: string | null;
  minecraftVersion: string | null;
  loader: string | null;
  av?: Record<string, string[]>;
  images?: string[];
};
const PACK_LOADER_TYPE: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
export async function browseCurseforgeModpacks(query: string, opts: { mc?: string | null; loader?: string | null }): Promise<CurseforgePackHit[]> {
  const params = new URLSearchParams({ gameId: String(MINECRAFT_GAME_ID), classId: String(MODPACK_CLASS_ID), sortField: "2", sortOrder: "desc", pageSize: "30" });
  const text = query.trim().slice(0, 80);
  if (text) params.set("searchFilter", text);
  const mc = opts.mc && /^[\w.-]{1,20}$/.test(opts.mc) ? opts.mc : null;
  const loaderType = opts.loader ? PACK_LOADER_TYPE[opts.loader] : undefined;
  if (mc) params.set("gameVersion", mc);
  if (loaderType) params.set("modLoaderType", String(loaderType));
  type Hit = CurseforgeSearchResponse["data"][number] & { authors?: { name: string }[]; downloadCount?: number; links?: { websiteUrl?: string | null } };
  const response = await curseforgeRequest<{ data: Hit[] }>(`/v1/mods/search?${params}`);
  return response.data.map((mod) => {
    const file = [...(mod.latestFiles ?? [])].filter((f) => f.releaseType === undefined || f.releaseType === 1).sort((a, b) => (b.fileDate ?? "").localeCompare(a.fileDate ?? ""))[0] ?? mod.latestFiles?.[0];
    const { minecraftVersion, loader } = describeLatestFile(mod, file);
    let pageUrl: string | null = null;
    try {
      const url = new URL(mod.links?.websiteUrl ?? "");
      if (url.protocol === "https:" && url.hostname === "www.curseforge.com") pageUrl = url.href;
    } catch {
      pageUrl = null;
    }
    return {
      id: mod.id,
      name: mod.name,
      summary: mod.summary ?? "",
      author: mod.authors?.[0]?.name ?? "",
      downloads: Math.round(mod.downloadCount ?? 0),
      iconUrl: mod.logo?.thumbnailUrl ?? null,
      pageUrl,
      minecraftVersion,
      loader: loader ? loader.toLowerCase() : null,
      av: curseforgeAvailability((mod as unknown as { latestFilesIndexes?: FileIndex[] }).latestFilesIndexes, true).av,
      images: sheetExtras(mod as unknown as SheetSource).images,
    };
  });
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

// Export « Pour un ami » en .zip CurseForge (31/10, Laboratoire « addMenus ») : retrouver un .jar sur
// CurseForge par son empreinte (MurmurHash2, calculée par le launcher). Renvoie seulement les
// identifiants (projet, fichier) : le .zip exporté contient la liste, jamais le fichier.
export type CurseforgeFingerprintMatch = { fingerprint: number; projectId: number; fileId: number; fileName: string };
export async function matchCurseforgeFingerprints(fingerprints: number[]): Promise<CurseforgeFingerprintMatch[]> {
  const out: CurseforgeFingerprintMatch[] = [];
  for (let i = 0; i < fingerprints.length; i += 200) {
    const response = await curseforgeRequest<{ data: { exactMatches?: { id: number; file?: { id: number; modId?: number; fileName?: string; fileFingerprint?: number } }[] } }>(
      `/v1/fingerprints/${MINECRAFT_GAME_ID}`,
      { method: "POST", body: { fingerprints: fingerprints.slice(i, i + 200) } },
    );
    for (const m of response.data?.exactMatches ?? []) {
      if (!m.file?.id || !m.file.fileFingerprint) continue;
      out.push({ fingerprint: m.file.fileFingerprint, projectId: m.file.modId ?? m.id, fileId: m.file.id, fileName: m.file.fileName ?? "" });
    }
  }
  return out;
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

// ---------------------------------------------------------------------------
// « Mon pack » du launcher (26/10, Laboratoire « myPackCf ») : recherche de mods CurseForge.
// Le launcher ne télécharge JAMAIS ces mods : il ouvre la page du fichier conseillé (pageUrl),
// le joueur télécharge lui-même et le launcher retrouve le fichier dans Téléchargements.
// ---------------------------------------------------------------------------
const MOD_CLASS_ID = 6;
const MOD_LOADER_TYPE: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
// Nouveaux menus d'ajout du launcher (31/10, Laboratoire « addMenus ») : pour chaque élément, les
// versions de Minecraft (et chargeurs) où il existe, lues dans latestFilesIndexes (un fichier par
// version et chargeur), avec le fichier conseillé de chaque case. Rien n'est gardé de notre côté.
const LOADER_OF_TYPE: Record<number, string> = { 1: "forge", 4: "fabric", 5: "quilt", 6: "neoforge" };
type FileIndex = { gameVersion: string; fileId: number; filename?: string; releaseType: number; modLoader?: number | null };
export type CurseforgeAvailability = { av: Record<string, string[]>; files: Record<string, { fileId: number; fileName: string | null }> };
export function curseforgeAvailability(list: FileIndex[] | undefined, withLoader: boolean): CurseforgeAvailability {
  const av: Record<string, string[]> = {};
  const best: Record<string, { fileId: number; fileName: string | null; release: boolean }> = {};
  for (const f of list ?? []) {
    if (!/^\d+\.\d+(\.\d+)?$/.test(f.gameVersion ?? "")) continue;
    // Avant 1.13, beaucoup de fichiers Forge n'indiquent pas leur chargeur.
    const legacy = Number(/^1\.(\d+)/.exec(f.gameVersion)?.[1]) < 13;
    const key = withLoader ? (f.modLoader ? LOADER_OF_TYPE[f.modLoader] : legacy ? "forge" : null) : "mc";
    if (!key) continue;
    if (!(av[key] ??= []).includes(f.gameVersion)) av[key].push(f.gameVersion);
    const cell = `${key}|${f.gameVersion}`;
    const release = f.releaseType === 1;
    if (!best[cell] || (release && !best[cell].release)) best[cell] = { fileId: f.fileId, fileName: f.filename ?? null, release };
  }
  const files: CurseforgeAvailability["files"] = {};
  for (const [k, v] of Object.entries(best)) files[k] = { fileId: v.fileId, fileName: v.fileName };
  return { av, files };
}
// Images et liens donnés par l'auteur (fiche du launcher) : https seulement.
function httpsOrNull(u: string | null | undefined, host?: string): string | null {
  try {
    const url = new URL(u ?? "");
    if (url.protocol !== "https:" || url.username) return null;
    if (host && url.hostname !== host) return null;
    return url.href;
  } catch {
    return null;
  }
}
type SheetSource = {
  summary?: string | null;
  downloadCount?: number;
  logo?: { thumbnailUrl?: string | null } | null;
  screenshots?: { thumbnailUrl?: string | null; url?: string | null }[] | null;
  allowModDistribution?: boolean | null;
  dateModified?: string | null;
  links?: { websiteUrl?: string | null; sourceUrl?: string | null; wikiUrl?: string | null; issuesUrl?: string | null };
};
function sheetExtras(mod: SheetSource) {
  return {
    summary: (mod.summary ?? "").slice(0, 300),
    downloads: Math.round(mod.downloadCount ?? 0),
    iconUrl: httpsOrNull(mod.logo?.thumbnailUrl, "media.forgecdn.net"),
    images: (mod.screenshots ?? []).map((x) => httpsOrNull(x.thumbnailUrl || x.url, "media.forgecdn.net")).filter((x): x is string => !!x).slice(0, 3),
    blocked: mod.allowModDistribution === false,
    updated: mod.dateModified ?? null,
    websiteUrl: httpsOrNull(mod.links?.websiteUrl, "www.curseforge.com"),
    sourceUrl: httpsOrNull(mod.links?.sourceUrl),
    wikiUrl: httpsOrNull(mod.links?.wikiUrl),
    issuesUrl: httpsOrNull(mod.links?.issuesUrl),
  };
}
export type CurseforgeModHit = {
  projectId: number;
  name: string;
  author: string;
  fileId: number | null;
  fileName: string | null;
  pageUrl: string | null;
} & Partial<CurseforgeAvailability & ReturnType<typeof sheetExtras>>;
// `all` (menus d'ajout) : sans filtre de version ni de chargeur, pour montrer aussi ce qui n'existe
// pas pour le pack (compté à part) ; le fichier conseillé reste celui de mc/loader.
export async function searchCurseforgeMods(query: string, opts: { mc?: string | null; loader?: string | null; all?: boolean }): Promise<CurseforgeModHit[]> {
  // Sans texte : les mods les plus populaires pour cette version et ce chargeur (29/10 : l'onglet
  // CurseForge de Mon pack s'ouvrait vide).
  const text = query.trim().slice(0, 80);
  const params = new URLSearchParams({ gameId: String(MINECRAFT_GAME_ID), classId: String(MOD_CLASS_ID), sortField: "2", sortOrder: "desc", pageSize: "20" });
  if (text) params.set("searchFilter", text);
  const mc = opts.mc && /^[\w.-]{1,20}$/.test(opts.mc) ? opts.mc : null;
  const loaderType = opts.loader ? MOD_LOADER_TYPE[opts.loader] : undefined;
  if (mc && !opts.all) params.set("gameVersion", mc);
  if (loaderType && !opts.all) params.set("modLoaderType", String(loaderType));
  type Hit = SheetSource & {
    id: number;
    name: string;
    authors?: { name: string }[];
    links?: { websiteUrl?: string | null };
    latestFilesIndexes?: { gameVersion: string; fileId: number; filename: string; releaseType: number; modLoader?: number | null }[];
  };
  const response = await curseforgeRequest<{ data: Hit[] }>(`/v1/mods/search?${params}`);
  // CurseForge trie par popularité et cherche aussi dans les descriptions : « create » en 26.3 sortait
  // Xaero's Minimap en premier (29/10). Les mods dont le nom contient le texte passent devant.
  const needle = text.toLowerCase();
  const rank = (m: Hit) => {
    const name = m.name.toLowerCase();
    return !needle || name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : 3;
  };
  return [...response.data].sort((x, y) => rank(x) - rank(y)).map((mod) => {
    // Fichier conseillé : le plus récent pour cette version de Minecraft et ce chargeur (stable d'abord).
    const files = (mod.latestFilesIndexes ?? []).filter((f) => (!mc || f.gameVersion === mc) && (!loaderType || f.modLoader === loaderType));
    const file = files.find((f) => f.releaseType === 1) ?? files[0] ?? null;
    return {
      projectId: mod.id,
      name: mod.name,
      author: mod.authors?.[0]?.name ?? "",
      fileId: file?.fileId ?? null,
      fileName: file?.filename ?? null,
      pageUrl: file ? curseforgeFilePage(mod.links?.websiteUrl, file.fileId) : curseforgeFilePage(mod.links?.websiteUrl, 0)?.replace(/\/files\/0$/, "") ?? null,
      ...(opts.all ? { ...curseforgeAvailability(mod.latestFilesIndexes, true), ...sheetExtras(mod) } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Fenêtre « Ajouter » de la page d'une installation (28/10, Laboratoire « contentCf ») : packs de
// ressources, shaders, mondes (maps) et data packs CurseForge. Sans texte : les plus populaires.
// `blocked` : l'auteur interdit le téléchargement hors de l'appli CurseForge (allowModDistribution
// faux) ; le launcher montre alors seulement la page. Le lien de téléchargement passe ensuite par
// /api/launcher/curseforge/files, comme les mods d'un modpack.
// ---------------------------------------------------------------------------
export const CONTENT_CLASS_ID: Record<string, number> = { rp: 12, w: 17, sh: 6552, dp: 6945 };
export type CurseforgeContentHit = {
  projectId: number;
  name: string;
  author: string;
  downloads: number;
  iconUrl: string | null;
  fileId: number | null;
  blocked: boolean;
  pageUrl: string | null;
} & Partial<CurseforgeAvailability & ReturnType<typeof sheetExtras>>;
export async function searchCurseforgeContent(kind: string, query: string, opts: { mc?: string | null; all?: boolean }): Promise<CurseforgeContentHit[]> {
  const classId = CONTENT_CLASS_ID[kind];
  if (!classId) return [];
  const params = new URLSearchParams({ gameId: String(MINECRAFT_GAME_ID), classId: String(classId), sortField: "2", sortOrder: "desc", pageSize: "20" });
  const text = query.trim().slice(0, 80);
  if (text) params.set("searchFilter", text);
  const mc = opts.mc && /^[\w.-]{1,20}$/.test(opts.mc) ? opts.mc : null;
  if (mc && !opts.all) params.set("gameVersion", mc);
  type Hit = SheetSource & {
    id: number;
    name: string;
    authors?: { name: string }[];
    downloadCount?: number;
    logo?: { thumbnailUrl?: string | null } | null;
    allowModDistribution?: boolean | null;
    links?: { websiteUrl?: string | null };
    latestFilesIndexes?: { gameVersion: string; fileId: number; releaseType: number; filename?: string }[];
  };
  const response = await curseforgeRequest<{ data: Hit[] }>(`/v1/mods/search?${params}`);
  return response.data.map((mod) => {
    // Fichier conseillé : le plus récent pour cette version de Minecraft (stable d'abord).
    const files = (mod.latestFilesIndexes ?? []).filter((f) => !mc || f.gameVersion === mc);
    const file = files.find((f) => f.releaseType === 1) ?? files[0] ?? null;
    const page = curseforgeFilePage(mod.links?.websiteUrl, 0)?.replace(/\/files\/0$/, "") ?? null;
    return {
      projectId: mod.id,
      name: mod.name,
      author: mod.authors?.[0]?.name ?? "",
      downloads: Math.round(mod.downloadCount ?? 0),
      iconUrl: mod.logo?.thumbnailUrl ?? null,
      fileId: file?.fileId ?? null,
      blocked: mod.allowModDistribution === false,
      pageUrl: file ? curseforgeFilePage(mod.links?.websiteUrl, file.fileId) : page,
      ...(opts.all ? { ...curseforgeAvailability(mod.latestFilesIndexes, false), ...sheetExtras(mod) } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// « Corriger le pack » du launcher (30/10) : les fichiers d'un mod CurseForge pour une version de
// Minecraft et un chargeur, le plus récent en premier, avec la page exacte de chaque fichier et son
// empreinte. Sert à ouvrir la page du BON fichier (pas la page générale du mod) et à proposer les
// autres versions d'un mod. Le launcher ne télécharge rien : le joueur télécharge depuis la page.
// ---------------------------------------------------------------------------
export type CurseforgeModFile = {
  fileId: number;
  fileName: string;
  displayName: string;
  fileDate: string | null;
  fileLength: number;
  sha1: string | null;
  pageUrl: string | null;
};
export async function listCurseforgeModFiles(projectId: number, opts: { mc?: string | null; loader?: string | null }): Promise<CurseforgeModFile[]> {
  const mc = opts.mc && /^[\w.-]{1,20}$/.test(opts.mc) ? opts.mc : null;
  const params = new URLSearchParams({ pageSize: "50" });
  if (mc) params.set("gameVersion", mc);
  // Avant 1.13, beaucoup de fichiers Forge n'indiquent pas leur chargeur : le filtre les cacherait
  // (et Forge est alors le seul chargeur qui compte).
  const legacy = !!mc && Number(/^1\.(\d+)(?:\.|$)/.exec(mc)?.[1]) < 13;
  const loaderType = opts.loader ? MOD_LOADER_TYPE[opts.loader] : undefined;
  if (loaderType && !legacy) params.set("modLoaderType", String(loaderType));
  type Mod = { id: number; links?: { websiteUrl?: string | null } };
  const [mod, files] = await Promise.all([
    curseforgeRequest<{ data: Mod }>(`/v1/mods/${projectId}`),
    curseforgeRequest<{ data: CurseforgeFileRaw[] }>(`/v1/mods/${projectId}/files?${params}`),
  ]);
  return files.data
    .filter((f) => f.releaseType !== 3 && /\.jar$/i.test(f.fileName))
    .sort((a, b) => (b.fileDate ?? "").localeCompare(a.fileDate ?? ""))
    .map((f) => ({
      fileId: f.id,
      fileName: f.fileName,
      displayName: f.displayName,
      fileDate: f.fileDate ?? null,
      fileLength: f.fileLength,
      sha1: f.hashes?.find((h) => h.algo === 1)?.value ?? null,
      pageUrl: curseforgeFilePage(mod.data.links?.websiteUrl, f.id),
    }));
}
