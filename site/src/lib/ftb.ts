import "server-only";
import type { ModpackChannel, ModpackInstallFile, ModpackSearchResult } from "@/lib/modpack-types";

// API publique de FTB (Feed The Beast, https://api.feed-the-beast.com) : aucune cle, conditions
// OK pour les launchers tiers, seul un User-Agent qui identifie l'application est exige. Ce sont
// les packs officiels de l'equipe FTB (une centaine) : pas de recherche cote API, on lit la
// liste complete une fois par heure et on filtre par nom ici.
const API_BASE = "https://api.feed-the-beast.com/v1/modpacks/public/modpack";
const HEADERS = {
  "User-Agent": "Omniscient-Launcher (app.omniscient.launcher)",
  Accept: "application/json",
};

type FtbTarget = { name: string; version: string; type: string };
type FtbVersion = {
  id: number;
  name: string;
  // "release", "beta", "alpha" ou "archived" (ancienne version retiree, jamais proposee).
  type: string;
  updated: number;
  private?: boolean;
  targets: FtbTarget[];
};
type FtbPack = {
  id: number;
  name: string;
  synopsis?: string;
  private?: boolean;
  art?: { url: string; type: string }[];
  versions: FtbVersion[];
};

async function ftbRequest<T>(pathname: string): Promise<T> {
  const res = await fetch(API_BASE + pathname, { headers: HEADERS, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`Réponse ${res.status} de l'API FTB`);
  const data = (await res.json()) as T & { status?: string };
  if (data.status && data.status !== "success") throw new Error("L'API FTB a refusé la demande.");
  return data;
}

const LOADER_NAMES: Record<string, string> = { neoforge: "NeoForge", forge: "Forge", fabric: "Fabric", quilt: "Quilt" };

function describeLoader(targets: FtbTarget[]): string | null {
  const known = targets.find((t) => LOADER_NAMES[t.name]);
  return known ? LOADER_NAMES[known.name] : null;
}

const minecraftOf = (version: FtbVersion) => version.targets.find((t) => t.name === "minecraft")?.version ?? null;

// Beaucoup de vieux packs FTB sont en 1.7/1.12 : le launcher ne lance pas encore les versions
// d'avant 1.13 (voir isLegacyMinecraft dans launcher/src/modpack.js), on ne les propose donc pas.
function isLegacyMinecraft(version: string | null): boolean {
  const match = /^1\.(\d+)(?:\.|$)/.exec(version ?? "");
  return Boolean(match) && Number(match![1]) < 13;
}

// Versions proposees selon le canal (meme regle que CurseForge/Modrinth) : "release" seulement,
// ou aussi "beta" — jamais alpha ni archived. Plus recente d'abord.
function allowedVersions(pack: FtbPack, channel: ModpackChannel): FtbVersion[] {
  const types = channel === "beta" ? ["release", "beta"] : ["release"];
  return pack.versions.filter((v) => !v.private && types.includes(v.type)).sort((a, b) => b.updated - a.updated);
}

// Page du pack sur le site de FTB (format verifie le 21/10 : /modpacks/<id> ouvre bien le pack).
export function ftbModpackPageUrl(packId: string | number | null | undefined): string | null {
  const id = String(packId ?? "");
  return /^\d+$/.test(id) ? `https://www.feed-the-beast.com/modpacks/${id}` : null;
}

// Cache memoire d'une heure (par instance du site) : la liste ne bouge que quand FTB sort un
// pack, et la lire coute un appel par pack (~95). Une seule lecture a la fois : deux recherches
// simultanees attendent la meme promesse.
const CATALOG_TTL_MS = 60 * 60 * 1000;
let catalog: { at: number; packs: Promise<FtbPack[]> } | null = null;

async function loadCatalog(): Promise<FtbPack[]> {
  const { packs: ids } = await ftbRequest<{ packs: number[] }>("/all");
  const packs: FtbPack[] = [];
  // 10 appels en parallele : assez rapide (~1 s) sans marteler leur API.
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.all(ids.slice(i, i + 10).map((id) => ftbRequest<FtbPack>(`/${id}`).catch(() => null)));
    for (const pack of batch) if (pack && !pack.private && Array.isArray(pack.versions)) packs.push(pack);
  }
  return packs;
}

function getCatalog(): Promise<FtbPack[]> {
  if (!catalog || Date.now() - catalog.at > CATALOG_TTL_MS) {
    const packs = loadCatalog();
    catalog = { at: Date.now(), packs };
    // Un echec ne reste pas en cache une heure : la recherche suivante reessaie.
    packs.catch(() => {
      if (catalog?.packs === packs) catalog = null;
    });
  }
  return catalog.packs;
}

/**
 * Recherche dans les packs FTB, filtree par nom (tous les mots tapes). En mode "beta", ne montre
 * que les packs qui ont reellement une version beta (meme regle que searchModrinthModpacks).
 */
export async function searchFtbModpacks(query: string, channel: ModpackChannel = "release"): Promise<ModpackSearchResult[]> {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const packs = await getCatalog();

  const results: ModpackSearchResult[] = [];
  for (const pack of packs) {
    const name = pack.name.toLowerCase();
    if (!words.every((w) => name.includes(w))) continue;
    const versions = allowedVersions(pack, channel);
    const latest = channel === "beta" ? versions.find((v) => v.type === "beta") : versions[0];
    if (!latest || isLegacyMinecraft(minecraftOf(latest))) continue;
    results.push({
      id: String(pack.id),
      name: pack.name,
      summary: pack.synopsis ?? "",
      iconUrl: pack.art?.find((a) => a.type === "square")?.url ?? null,
      latestVersion: latest.name,
      minecraftVersion: minecraftOf(latest),
      loader: describeLoader(latest.targets),
    });
  }
  // Packs les plus recents d'abord (StoneBlock 4 avant StoneBlock 2), 8 au plus comme Modrinth.
  return results.sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 8);
}

/**
 * Version FTB a installer : la plus recente du canal compatible avec la version de Minecraft du
 * serveur (sinon la plus recente du canal), jamais figee — meme principe que
 * getModrinthModpackInstallFile. Un pack FTB n'a pas d'archive a telecharger : le launcher lit
 * lui-meme la liste des fichiers de la version (GET /<pack>/<version> de leur API), d'ou
 * downloadUrl null et `ftb` dans la reponse.
 */
export async function getFtbModpackInstallFile(
  packId: string,
  hints: { minecraftVersion?: string | null },
  channel: ModpackChannel = "release",
): Promise<{ modpack: { id: string; name: string }; file: ModpackInstallFile; ftb: { packId: number; versionId: number } }> {
  if (!/^\d+$/.test(packId)) throw new Error("Identifiant de pack FTB invalide.");
  const pack = await ftbRequest<FtbPack>(`/${packId}`);
  const versions = allowedVersions(pack, channel);
  const compatible = hints.minecraftVersion ? versions.filter((v) => minecraftOf(v) === hints.minecraftVersion) : versions;
  const chosen = compatible[0] ?? versions[0];
  if (!chosen) throw new Error("Ce pack FTB n'a aucune version publiée.");

  return {
    modpack: { id: String(pack.id), name: pack.name },
    file: {
      id: chosen.id,
      displayName: chosen.name,
      fileName: `ftb-${pack.id}-${chosen.id}.json`,
      downloadUrl: null,
      fileLength: 0,
      sha1: null,
    },
    ftb: { packId: pack.id, versionId: chosen.id },
  };
}
