import "server-only";
import { unstable_cache } from "next/cache";
import { execSql } from "@/lib/db";
import { PAGE_LIMITS, parsePageConfig, type PageTag } from "@/lib/serverPage";
import { EMPTY_TAG_CATALOG, isKnownTag, normalizeTagWord, tagName, type CustomTag, type TagCatalog } from "@/lib/tagCatalog";

// Demandes d'etiquettes (voir lib/tagCatalog.ts et d1/migrations/2026-10-16-demandes-etiquettes.sql).

// Etiquettes ajoutees + alias, lus en une seule requete au plus une fois par minute (le compte
// Cloudflare est limite a ~1200 appels / 5 min, voir lib/db.ts) et tout de suite apres une
// decision de l'equipe (updateTag/revalidateTag sur TAG_CATALOG_CACHE_TAG). Aucun appel en plus
// par affichage de page. Table absente (migration pas encore lancee sur cette base) : liste vide,
// jamais une page cassee.
export const TAG_CATALOG_CACHE_TAG = "tag-catalog";

type CatalogRow = { kind: string; a: string; b: string; c: string | null; d?: string | null };

// Colonne "removedAt" (migration 2026-10-23-etiquettes-retirees.sql) : si elle manque encore sur
// cette base, on relit sans elle plutot que de perdre toutes les etiquettes ajoutees.
async function readCatalogRows(): Promise<CatalogRow[]> {
  try {
    return (await execSql(
      `SELECT 'tag' AS "kind", "id" AS "a", "nameFr" AS "b", "nameEn" AS "c", "removedAt" AS "d" FROM "customTag"
       UNION ALL SELECT 'alias', "normalized", "tagId", NULL, NULL FROM "tagAlias"`,
    )) as CatalogRow[];
  } catch (err) {
    if (!String(err).includes("removedAt")) throw err;
    return (await execSql(
      `SELECT 'tag' AS "kind", "id" AS "a", "nameFr" AS "b", "nameEn" AS "c" FROM "customTag"
       UNION ALL SELECT 'alias', "normalized", "tagId", NULL FROM "tagAlias"`,
    )) as CatalogRow[];
  }
}

export const getTagCatalog = unstable_cache(
  async (): Promise<TagCatalog> => {
    try {
      const rows = await readCatalogRows();
      const custom: CustomTag[] = [];
      const aliases: Record<string, string> = {};
      for (const r of rows) {
        if (r.kind === "tag") custom.push({ id: r.a, nameFr: r.b, nameEn: r.c ?? r.b, ...(r.d ? { removed: true } : {}) });
        else aliases[r.a] = r.b;
      }
      custom.sort((x, y) => x.nameFr.localeCompare(y.nameFr, "fr"));
      return { custom, aliases };
    } catch (err) {
      console.error("[tagCatalog] lecture impossible :", err);
      return EMPTY_TAG_CATALOG;
    }
  },
  ["tag-catalog-v2"],
  { revalidate: 60, tags: [TAG_CATALOG_CACHE_TAG] },
);

export type TagRequestStatus = "pending" | "accepted" | "merged" | "refused";
// "replaced" (23/10, « Remplacer une etiquette ») : le mot a remplace le nom d'une etiquette
// existante. En base et cote equipe seulement : le proprietaire le voit comme « acceptee »
// (getOwnerTagPanel).
type DecidedStatus = Exclude<TagRequestStatus, "pending"> | "replaced";

export type OwnerTagRequest = {
  id: string;
  word: string;
  status: TagRequestStatus;
  resultTagId: string | null;
  refuseReason: number | null;
  createdAt: string;
};

export type OwnerTagPanel = { requests: OwnerTagRequest[]; pending: number; month: number };

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

// Bloc « Il te manque une etiquette ? » : demandes de CE serveur, et compteurs (en attente sur
// ce serveur, envoyees ce mois-ci par le compte). Deux lectures, sur la page proprietaire seulement.
export async function getOwnerTagPanel(serverId: string, ownerUserId: string): Promise<OwnerTagPanel> {
  try {
    const requests = (await execSql(
      `SELECT "id", "word", CASE "status" WHEN 'replaced' THEN 'accepted' ELSE "status" END AS "status", "resultTagId", "refuseReason", "createdAt"
       FROM "tagRequest"
       WHERE "serverId" = ? ORDER BY "createdAt" DESC LIMIT 20`,
      [serverId],
    )) as OwnerTagRequest[];
    const [count] = (await execSql(`SELECT COUNT(*) AS "n" FROM "tagRequest" WHERE "ownerUserId" = ? AND "createdAt" >= ?`, [
      ownerUserId,
      monthStart(),
    ])) as { n: number }[];
    return { requests, pending: requests.filter((r) => r.status === "pending").length, month: Number(count?.n ?? 0) };
  } catch (err) {
    console.error("[tagRequests] lecture impossible :", err);
    return { requests: [], pending: 0, month: 0 };
  }
}

export async function insertTagRequest(data: { serverId: string; ownerUserId: string; word: string; normalized: string }) {
  await execSql(`INSERT INTO "tagRequest" ("id", "serverId", "ownerUserId", "word", "normalized") VALUES (?, ?, ?, ?, ?)`, [
    crypto.randomUUID(),
    data.serverId,
    data.ownerUserId,
    data.word,
    data.normalized,
  ]);
}

// ---- Panel admin ----

// Badge du menu : nombre de mots differents en attente (une decision par mot).
export async function countPendingTagGroups(): Promise<number> {
  try {
    const [row] = (await execSql(`SELECT COUNT(DISTINCT "normalized") AS "n" FROM "tagRequest" WHERE "status" = 'pending'`)) as { n: number }[];
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

export type PendingTagGroup = {
  normalized: string;
  word: string; // premiere orthographe recue
  servers: string[]; // noms des serveurs demandeurs, du plus ancien au plus recent
  createdAt: string; // premiere demande
};

export async function listPendingTagGroups(): Promise<PendingTagGroup[]> {
  const rows = (await execSql(
    `SELECT r."normalized", r."word", r."createdAt", s."name" AS "serverName" FROM "tagRequest" r
     JOIN "server" s ON s."id" = r."serverId"
     WHERE r."status" = 'pending' ORDER BY r."createdAt" ASC`,
  )) as { normalized: string; word: string; createdAt: string; serverName: string }[];
  const groups = new Map<string, PendingTagGroup>();
  for (const r of rows) {
    const g = groups.get(r.normalized);
    if (g) {
      if (!g.servers.includes(r.serverName)) g.servers.push(r.serverName);
    } else groups.set(r.normalized, { normalized: r.normalized, word: r.word, servers: [r.serverName], createdAt: r.createdAt });
  }
  // Les mots demandes par le plus de serveurs d'abord, puis les plus anciens.
  return [...groups.values()].sort((a, b) => b.servers.length - a.servers.length || a.createdAt.localeCompare(b.createdAt));
}

export type HandledTagGroup = {
  normalized: string;
  word: string;
  status: DecidedStatus;
  resultTagId: string | null;
  refuseReason: number | null;
  decidedAt: string;
};

export async function listRecentlyHandledTagGroups(limit = 10): Promise<HandledTagGroup[]> {
  return (await execSql(
    `SELECT "normalized", MIN("word") AS "word", "status", MAX("resultTagId") AS "resultTagId", MAX("refuseReason") AS "refuseReason",
            MAX("decidedAt") AS "decidedAt"
     FROM "tagRequest" WHERE "status" != 'pending' AND "decidedAt" IS NOT NULL
     GROUP BY "normalized", "status", "decidedAt" ORDER BY "decidedAt" DESC LIMIT ?`,
    [limit],
  )) as HandledTagGroup[];
}

// Applique une decision a toutes les demandes en attente d'un mot. Renvoie les serveurs concernes.
async function decideGroup(
  normalized: string,
  status: DecidedStatus,
  resultTagId: string | null,
  refuseReason: number | null,
): Promise<string[]> {
  const rows = (await execSql(
    `UPDATE "tagRequest" SET "status" = ?, "resultTagId" = ?, "refuseReason" = ?, "decidedAt" = ?
     WHERE "normalized" = ? AND "status" = 'pending' RETURNING "serverId"`,
    [status, resultTagId, refuseReason, new Date().toISOString(), normalized],
  )) as { serverId: string }[];
  return [...new Set(rows.map((r) => r.serverId))];
}

// Ajoute l'etiquette a la fiche de chaque serveur demandeur, si sa limite le permet : dans les
// principales s'il reste une place (3), sinon dans les supplementaires (8), sinon rien.
async function addTagToServers(serverIds: string[], tag: PageTag): Promise<void> {
  for (const id of serverIds) {
    const [row] = (await execSql(`SELECT "pageConfig" FROM "server" WHERE "id" = ?`, [id])) as { pageConfig: string | null }[];
    if (!row) continue;
    const config = parsePageConfig(row.pageConfig);
    if (config.tags.includes(tag) || config.extraTags.includes(tag)) continue;
    if (config.tags.length < PAGE_LIMITS.tags) config.tags.push(tag);
    else if (config.extraTags.length < PAGE_LIMITS.extraTags) config.extraTags.push(tag);
    else continue;
    await execSql(`UPDATE "server" SET "pageConfig" = ?, "updatedAt" = ? WHERE "id" = ?`, [JSON.stringify(config), new Date().toISOString(), id]);
  }
}

async function upsertAlias(normalized: string, tagId: string) {
  if (!normalized) return;
  await execSql(`INSERT INTO "tagAlias" ("normalized", "tagId") VALUES (?, ?) ON CONFLICT("normalized") DO UPDATE SET "tagId" = excluded."tagId"`, [
    normalized,
    tagId,
  ]);
}

export async function acceptTagGroup(normalized: string, tag: CustomTag): Promise<void> {
  await execSql(`INSERT INTO "customTag" ("id", "nameFr", "nameEn") VALUES (?, ?, ?)`, [tag.id, tag.nameFr, tag.nameEn]);
  await upsertAlias(normalized, tag.id);
  const servers = await decideGroup(normalized, "accepted", tag.id, null);
  await addTagToServers(servers, tag.id as PageTag);
}

export async function mergeTagGroup(normalized: string, tagId: string, catalog: TagCatalog): Promise<boolean> {
  if (!isKnownTag(tagId, catalog.custom)) return false;
  await upsertAlias(normalized, tagId);
  const servers = await decideGroup(normalized, "merged", tagId, null);
  await addTagToServers(servers, tagId as PageTag);
  return true;
}

// Renomme une etiquette (« Remplacer une etiquette » des demandes, « Modifier » de la liste des
// etiquettes existantes, 23/10) : elle garde son identifiant, donc sa place sur toutes les fiches
// (aucune fiche a reecrire) ; seul son nom FR/EN change. Une etiquette en dur recoit une ligne
// customTag a son identifiant (lue avant le dictionnaire, voir tagName). Les anciens noms (et les
// mots donnes en plus) deviennent des alias : la recherche les trouve encore.
export async function renameTag(tag: CustomTag, catalog: TagCatalog, extraAliases: string[] = []): Promise<boolean> {
  if (!isKnownTag(tag.id, catalog.custom)) return false;
  const aliases = [
    ...new Set([normalizeTagWord(tagName(tag.id, "fr", catalog.custom)), normalizeTagWord(tagName(tag.id, "en", catalog.custom)), ...extraAliases]),
  ].filter(Boolean);
  await execSql(
    `INSERT INTO "customTag" ("id", "nameFr", "nameEn") VALUES (?, ?, ?)
     ON CONFLICT("id") DO UPDATE SET "nameFr" = excluded."nameFr", "nameEn" = excluded."nameEn"`,
    [tag.id, tag.nameFr, tag.nameEn],
  );
  if (aliases.length) {
    await execSql(
      `INSERT INTO "tagAlias" ("normalized", "tagId") VALUES ${aliases.map(() => "(?, ?)").join(", ")}
       ON CONFLICT("normalized") DO UPDATE SET "tagId" = excluded."tagId"`,
      aliases.flatMap((a) => [a, tag.id]),
    );
  }
  return true;
}

// Le mot propose remplace le nom de l'etiquette choisie ; les serveurs demandeurs la recoivent
// s'il leur reste une place.
export async function replaceTagWithGroup(normalized: string, tag: CustomTag, catalog: TagCatalog): Promise<boolean> {
  if (!(await renameTag(tag, catalog, [normalized]))) return false;
  const servers = await decideGroup(normalized, "replaced", tag.id, null);
  await addTagToServers(servers, tag.id as PageTag);
  return true;
}

// « Retirer » (liste des etiquettes existantes, preview validee le 23/10) : l'etiquette est marquee
// retiree (customTag.removedAt, aussi pour une etiquette en dur) et enlevee de toutes les fiches,
// privees comprises. Avec swapTo, chaque fiche recoit l'autre etiquette a la meme place (si elle ne
// l'a pas deja), et les anciens noms et alias menent a l'autre etiquette dans la recherche. Une
// ecriture par fiche concernee seulement. Renvoie le nombre de fiches modifiees, ou null.
export async function removeTag(tagId: string, swapTo: string | null, catalog: TagCatalog): Promise<number | null> {
  if (!isKnownTag(tagId, catalog.custom) || (swapTo && (swapTo === tagId || !isKnownTag(swapTo, catalog.custom)))) return null;
  const now = new Date().toISOString();
  await execSql(
    `INSERT INTO "customTag" ("id", "nameFr", "nameEn", "removedAt") VALUES (?, ?, ?, ?)
     ON CONFLICT("id") DO UPDATE SET "removedAt" = excluded."removedAt"`,
    [tagId, tagName(tagId, "fr", catalog.custom) || tagId, tagName(tagId, "en", catalog.custom) || tagId, now],
  );
  if (swapTo) {
    const names = [normalizeTagWord(tagName(tagId, "fr", catalog.custom)), normalizeTagWord(tagName(tagId, "en", catalog.custom))].filter(Boolean);
    await execSql(`UPDATE "tagAlias" SET "tagId" = ? WHERE "tagId" = ?`, [swapTo, tagId]);
    if (names.length) {
      await execSql(
        `INSERT INTO "tagAlias" ("normalized", "tagId") VALUES ${names.map(() => "(?, ?)").join(", ")}
         ON CONFLICT("normalized") DO UPDATE SET "tagId" = excluded."tagId"`,
        names.flatMap((n) => [n, swapTo]),
      );
    }
  }
  // L'identifiant entre guillemets dans le JSON de la fiche : on ne relit que les fiches concernees.
  const rows = (await execSql(`SELECT "id", "pageConfig" FROM "server" WHERE "pageConfig" LIKE ?`, [`%"${tagId}"%`])) as {
    id: string;
    pageConfig: string | null;
  }[];
  let changed = 0;
  for (const row of rows) {
    const config = parsePageConfig(row.pageConfig);
    const swap = (list: PageTag[]) => {
      const i = list.indexOf(tagId as PageTag);
      if (i < 0) return list;
      const has = swapTo && (config.tags.includes(swapTo as PageTag) || config.extraTags.includes(swapTo as PageTag));
      return swapTo && !has ? list.map((t, j) => (j === i ? (swapTo as PageTag) : t)) : list.filter((_, j) => j !== i);
    };
    const tags = swap(config.tags);
    const extraTags = swap(config.extraTags);
    if (tags === config.tags && extraTags === config.extraTags) continue;
    await execSql(`UPDATE "server" SET "pageConfig" = ?, "updatedAt" = ? WHERE "id" = ?`, [JSON.stringify({ ...config, tags, extraTags }), now, row.id]);
    changed++;
  }
  return changed;
}

export async function refuseTagGroup(normalized: string, reason: number): Promise<void> {
  await decideGroup(normalized, "refused", null, reason);
}

export async function customTagIdTaken(id: string): Promise<boolean> {
  const rows = (await execSql(`SELECT 1 AS "x" FROM "customTag" WHERE "id" = ?`, [id])) as unknown[];
  return rows.length > 0;
}
