import { PAGE_LANGUAGES, isPageTag, type PageLanguage, type PageTag } from "@/lib/serverPage";

// Filtres et tris de l'annuaire (option C validee le 2026-10-16, preview
// https://claude.ai/artifact/DGSAjFDstaKgMRLwudGMYd). Fonctions pures, sans acces base : tout
// se calcule sur la liste deja en cache (voir loadPublishedServers dans public-servers.ts),
// donc aucun appel D1 de plus quel que soit le filtre. Le launcher a sa propre copie de ces
// regles (launcher/src/renderer.js, section « Filtres de la liste ») : garder les deux alignees.

export const SERVER_SORTS = ["recent", "trend", "players", "played", "az"] as const;
export type ServerListSort = (typeof SERVER_SORTS)[number];

export type ServerTypeFilter = "all" | "vanilla" | "modded";
export type ServerLangFilter = "all" | PageLanguage;

export type ServerListFilters = {
  q: string;
  type: ServerTypeFilter;
  online: boolean;
  lang: ServerLangFilter;
  tags: PageTag[];
  version: string; // "all", une branche ("1.21") ou "other"
  // Team (19/10, meme menu que le launcher) : slug de la team, "" = toutes.
  team: string;
  sort: ServerListSort;
};

export const DEFAULT_FILTERS: ServerListFilters = { q: "", type: "all", online: false, lang: "all", tags: [], version: "all", team: "", sort: "recent" };

// Ce dont le filtre a besoin pour un serveur (sous-ensemble de PublicServerSummary).
export type FilterableServer = {
  name: string;
  description: string;
  type: "vanilla" | "modded";
  minecraftVersion: string;
  modpackName: string | null;
  tags: PageTag[];
  languages: PageLanguage[];
  playerCount: number | null;
  playerCapacity: number | null;
  pinged: boolean;
  createdAt: string;
  launchCount: number;
  selfTestPassedAt: string | null;
  // Facultatif : une liste sans teams (ancien appelant) ne peut simplement pas filtrer par team.
  team?: { slug: string; name: string; iconUrl: string | null } | null;
};

// Branche d'une version : "1.20.1" -> "1.20", "1.21" -> "1.21". Snapshots, -pre, texte libre -> "other".
export function versionBranch(version: string): string {
  const m = /^1\.(\d{1,2})(?:\.\d{1,2})?$/.exec(version.trim());
  return m ? `1.${m[1]}` : "other";
}

function branchRank(branch: string): number {
  return branch === "other" ? -1 : Number(branch.slice(2));
}

export const isServerOnline = (s: Pick<FilterableServer, "pinged" | "playerCount">) => s.pinged && s.playerCount != null;

const NEW_DAYS = 7; // 19/10 : 7 jours au lieu de 14 (Rushi)
const DAY_MS = 24 * 60 * 60 * 1000;

export function isNewServer(createdAt: string, now = Date.now()): boolean {
  const age = now - new Date(createdAt).getTime();
  return age >= 0 && age < NEW_DAYS * DAY_MS;
}

// Score « Tendance » : en ligne (poids fort), remplissage (ratio, pas le nombre brut, pour ne
// pas ecraser les petits serveurs), lancements depuis le launcher (plafonnes), test de
// publication recent, et un bonus decroissant pendant 7 jours pour les nouveaux. Les vues de
// la fiche n'y entrent pas : trop faciles a gonfler. Expliquer en une phrase (servers.trendNote).
export function trendScore(s: FilterableServer, now = Date.now()): number {
  const online = isServerOnline(s);
  const fill = online && s.playerCapacity ? Math.min((s.playerCount ?? 0) / s.playerCapacity, 1) : 0;
  const launches = Math.min(s.launchCount, 1000) / 1000;
  const tested = s.selfTestPassedAt && now - new Date(s.selfTestPassedAt).getTime() < 30 * DAY_MS ? 1 : 0;
  const age = (now - new Date(s.createdAt).getTime()) / DAY_MS;
  const fresh = age >= 0 && age < NEW_DAYS ? (NEW_DAYS - age) / NEW_DAYS : 0;
  return (online ? 3 : 0) + fill * 2 + launches * 2 + tested + fresh * 1.5;
}

type Facet = "type" | "online" | "lang" | "tags" | "version" | "team";

// qTags : etiquettes qui correspondent au texte cherche (nom FR/EN ou alias, voir
// tagsMatchingQuery dans tagCatalog.ts), calculees une fois par l'appelant : un serveur qui porte
// l'une d'elles est trouve meme si le mot n'est ni dans son nom ni dans sa description.
function matches(s: FilterableServer, f: ServerListFilters, skip?: Facet, qTags: readonly string[] = []): boolean {
  const needle = f.q.trim().toLowerCase();
  if (
    needle &&
    !(
      s.name.toLowerCase().includes(needle) ||
      s.description.toLowerCase().includes(needle) ||
      (s.modpackName ?? "").toLowerCase().includes(needle) ||
      s.tags.some((t) => qTags.includes(t))
    )
  )
    return false;
  if (skip !== "type" && f.type !== "all" && s.type !== f.type) return false;
  if (skip !== "online" && f.online && !isServerOnline(s)) return false;
  if (skip !== "lang" && f.lang !== "all" && !s.languages.includes(f.lang)) return false;
  // Plusieurs styles coches : au moins un (sinon « 0 serveur » quasi permanent avec 3 etiquettes max).
  if (skip !== "tags" && f.tags.length && !s.tags.some((t) => f.tags.includes(t))) return false;
  if (skip !== "version" && f.version !== "all" && versionBranch(s.minecraftVersion) !== f.version) return false;
  if (skip !== "team" && f.team && s.team?.slug !== f.team) return false;
  return true;
}

export function filterServers<T extends FilterableServer>(rows: T[], f: ServerListFilters, qTags: readonly string[] = []): T[] {
  return rows.filter((s) => matches(s, f, undefined, qTags));
}

export function sortServers<T extends FilterableServer>(rows: T[], sort: ServerListSort, now = Date.now()): T[] {
  // Tri stable : a egalite, le plus recent puis le nom, pour que la pagination ne saute ni ne repete.
  const tie = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name);
  const score = sort === "trend" ? new Map(rows.map((r) => [r, trendScore(r, now)])) : null;
  return [...rows].sort((a, b) => {
    if (sort === "trend") return score!.get(b)! - score!.get(a)! || tie(a, b);
    if (sort === "players") return (isServerOnline(b) ? b.playerCount ?? 0 : -1) - (isServerOnline(a) ? a.playerCount ?? 0 : -1) || tie(a, b);
    if (sort === "played") return b.launchCount - a.launchCount || tie(a, b);
    if (sort === "az") return a.name.localeCompare(b.name);
    return tie(a, b);
  });
}

export type ServerFacets = {
  type: Record<ServerTypeFilter, number>;
  online: number;
  lang: Record<ServerLangFilter, number>;
  tags: Record<string, number>; // toutes les etiquettes presentes (en dur ou ajoutees) et celles cochees
  versions: { value: string; count: number }[]; // branches presentes, de la plus recente a la plus ancienne, "other" en dernier
  // Teams presentes (avec les autres filtres), la plus fournie d'abord ; celle choisie toujours dedans.
  teams: { slug: string; name: string; iconUrl: string | null; count: number }[];
};

// Compteurs honnetes : chaque famille est comptee avec les AUTRES filtres actifs, pas le sien.
export function computeFacets(rows: FilterableServer[], f: ServerListFilters, qTags: readonly string[] = []): ServerFacets {
  const pool = (skip: Facet) => rows.filter((s) => matches(s, f, skip, qTags));
  const byType = pool("type");
  const byLang = pool("lang");
  const byTags = pool("tags");
  const byVersion = pool("version");
  const teamCounts = new Map<string, { slug: string; name: string; iconUrl: string | null; count: number }>();
  for (const s of pool("team")) {
    if (!s.team) continue;
    const cur = teamCounts.get(s.team.slug) ?? { slug: s.team.slug, name: s.team.name, iconUrl: s.team.iconUrl, count: 0 };
    cur.count += 1;
    teamCounts.set(s.team.slug, cur);
  }
  if (f.team && !teamCounts.has(f.team)) {
    const known = rows.find((s) => s.team?.slug === f.team)?.team;
    teamCounts.set(f.team, { slug: f.team, name: known?.name ?? f.team, iconUrl: known?.iconUrl ?? null, count: 0 });
  }
  const versionCounts = new Map<string, number>();
  for (const s of byVersion) {
    const b = versionBranch(s.minecraftVersion);
    versionCounts.set(b, (versionCounts.get(b) ?? 0) + 1);
  }
  // Une branche choisie reste proposee meme a 0 (sinon impossible de la retirer depuis le panneau).
  if (f.version !== "all" && !versionCounts.has(f.version)) versionCounts.set(f.version, 0);
  const tagCounts: Record<string, number> = Object.fromEntries(f.tags.map((t) => [t, 0]));
  for (const s of byTags) for (const t of new Set(s.tags)) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  return {
    type: {
      all: byType.length,
      vanilla: byType.filter((s) => s.type === "vanilla").length,
      modded: byType.filter((s) => s.type === "modded").length,
    },
    online: pool("online").filter(isServerOnline).length,
    lang: {
      all: byLang.length,
      ...Object.fromEntries(PAGE_LANGUAGES.map((l) => [l, byLang.filter((s) => s.languages.includes(l)).length])),
    } as Record<ServerLangFilter, number>,
    tags: tagCounts,
    versions: [...versionCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => branchRank(b.value) - branchRank(a.value)),
    teams: [...teamCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

// Le filtre dont le retrait rendrait le plus de serveurs (etat vide : « le filtre qui bloque »).
export type FilterKey = "type" | "online" | "lang" | "version" | "team" | `tag:${PageTag}`;

export function activeFilterKeys(f: ServerListFilters): FilterKey[] {
  const keys: FilterKey[] = [];
  if (f.type !== "all") keys.push("type");
  if (f.online) keys.push("online");
  if (f.lang !== "all") keys.push("lang");
  for (const t of f.tags) keys.push(`tag:${t}`);
  if (f.version !== "all") keys.push("version");
  if (f.team) keys.push("team");
  return keys;
}

export function withoutFilter(f: ServerListFilters, key: FilterKey): ServerListFilters {
  if (key === "type") return { ...f, type: "all" };
  if (key === "online") return { ...f, online: false };
  if (key === "lang") return { ...f, lang: "all" };
  if (key === "version") return { ...f, version: "all" };
  if (key === "team") return { ...f, team: "" };
  const tag = key.slice(4);
  return { ...f, tags: f.tags.filter((t) => t !== tag) };
}

export function blockingFilter(rows: FilterableServer[], f: ServerListFilters, qTags: readonly string[] = []): { key: FilterKey; gain: number } | null {
  let best: { key: FilterKey; gain: number } | null = null;
  for (const key of activeFilterKeys(f)) {
    const gain = filterServers(rows, withoutFilter(f, key), qTags).length;
    if (!best || gain > best.gain) best = { key, gain };
  }
  return best && best.gain > 0 ? best : null;
}

// Lecture des parametres d'URL (?q=&type=&online=1&lang=&tag=a,b&version=&sort=) : valeurs
// inconnues ignorees, jamais d'erreur. « popular » (ancien lien) est lu comme « played ».
type RawParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "");

export function parseFilters(params: RawParams): ServerListFilters {
  const type = one(params.type);
  const lang = one(params.lang);
  const sortRaw = one(params.sort) === "popular" ? "played" : one(params.sort);
  const version = one(params.version);
  const tags = [...new Set(one(params.tag).split(",").filter(isPageTag))];
  return {
    q: one(params.q).slice(0, 100),
    type: type === "vanilla" || type === "modded" ? type : "all",
    online: one(params.online) === "1",
    lang: (PAGE_LANGUAGES as readonly string[]).includes(lang) ? (lang as PageLanguage) : "all",
    tags,
    version: version === "other" || /^1\.\d{1,2}$/.test(version) ? version : "all",
    team: /^[a-z0-9-]{1,60}$/.test(one(params.team)) ? one(params.team) : "",
    sort: (SERVER_SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as ServerListSort) : "recent",
  };
}

export function filtersToSearch(f: ServerListFilters, page = 1): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.type !== "all") p.set("type", f.type);
  if (f.online) p.set("online", "1");
  if (f.lang !== "all") p.set("lang", f.lang);
  if (f.tags.length) p.set("tag", f.tags.join(","));
  if (f.version !== "all") p.set("version", f.version);
  if (f.team) p.set("team", f.team);
  if (f.sort !== "recent") p.set("sort", f.sort);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString().replace(/%2C/g, ",");
  return qs ? `?${qs}` : "";
}
