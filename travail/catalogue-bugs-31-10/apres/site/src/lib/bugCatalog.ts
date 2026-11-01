import { createHash, randomUUID } from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";
import { execSql } from "@/lib/db";

// Catalogue de bugs (31/10, preview validée par Rushi, Laboratoire « bugCatalog ») : chaque bug
// réglé devient une fiche, reconnue par le launcher chez le joueur et publiée sur /aide/bugs.
// Tables créées par d1/migrations/2026-10-31-catalogue-bugs.sql. Les statistiques ne sont que des
// compteurs par fiche et par jour : aucune donnée de joueur.

export const BUG_STATUSES = ["auto", "consent", "manual", "analyse"] as const;
export const BUG_CATEGORIES = ["mods", "curseforge", "crash", "launcher", "dev"] as const;
export const BUG_FIXES = ["none", "ignore", "loader", "remove", "replace", "update", "redownload", "cache"] as const;
export const BUG_WHERE = ["log", "crash", "launcher"] as const;
export const BUG_LOADERS = ["", "fabric", "forge", "neoforge", "quilt"] as const;
export const BUG_EVENTS = ["seen", "repaired", "refused"] as const;

export type BugStatus = (typeof BUG_STATUSES)[number];
export type BugCategory = (typeof BUG_CATEGORIES)[number];
export type BugFix = (typeof BUG_FIXES)[number];
export type BugWhere = (typeof BUG_WHERE)[number];
export type BugEvent = (typeof BUG_EVENTS)[number];
type Lang = { fr: string; en: string };

export type BugEntry = {
  id: string;
  slug: string;
  status: BugStatus;
  visibility: "player" | "internal";
  hasGuide: boolean;
  notify: boolean;
  published: boolean;
  category: BugCategory;
  title: Lang;
  symptom: Lang;
  cause: Lang;
  fixAction: BugFix;
  fixArg: string;
  fixText: Lang;
  steps: { fr: string[]; en: string[] };
  match: { where: BugWhere; text: string; mc: string; loader: string };
  fixedIn: string;
  logSample: string;
  createdAt: string;
  updatedAt: string;
};
export type BugStats = { seen: number; repaired: number; refused: number };
export type AdminBugEntry = BugEntry & { stats: BugStats };

const TAG = "bug-catalog";

function parseSteps(value: unknown): string[] {
  try {
    const list = JSON.parse(String(value));
    return Array.isArray(list) ? list.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function fromRow(r: Record<string, unknown>): BugEntry {
  const s = (key: string) => String(r[key] ?? "");
  return {
    id: s("id"),
    slug: s("slug"),
    status: s("status") as BugStatus,
    visibility: s("visibility") === "internal" ? "internal" : "player",
    hasGuide: Number(r.hasGuide) === 1,
    notify: Number(r.notify) === 1,
    published: Number(r.published) === 1,
    category: s("category") as BugCategory,
    title: { fr: s("titleFr"), en: s("titleEn") },
    symptom: { fr: s("symptomFr"), en: s("symptomEn") },
    cause: { fr: s("causeFr"), en: s("causeEn") },
    fixAction: s("fixAction") as BugFix,
    fixArg: s("fixArg"),
    fixText: { fr: s("fixTextFr"), en: s("fixTextEn") },
    steps: { fr: parseSteps(r.stepsFr), en: parseSteps(r.stepsEn) },
    match: { where: s("matchWhere") as BugWhere, text: s("matchText"), mc: s("matchMc"), loader: s("matchLoader") },
    fixedIn: s("fixedIn"),
    logSample: s("logSample"),
    createdAt: s("createdAt"),
    updatedAt: s("updatedAt"),
  };
}

// --- Lecture publique (launcher et page /aide/bugs) ---------------------------------------------
// Une seule requête, gardée 5 min et vidée dès qu'une fiche change : le launcher en redemande toutes
// les 10 min, et le quota de la base est partagé avec le reste du site.
const readPublic = unstable_cache(
  async (): Promise<BugEntry[]> => {
    const rows = await execSql(
      `SELECT * FROM "bugCatalogEntry" WHERE "published" = 1 AND "visibility" = 'player' AND "status" <> 'analyse' ORDER BY "updatedAt" DESC`,
    );
    return (rows as Record<string, unknown>[]).map(fromRow);
  },
  ["bug-catalog-public"],
  { revalidate: 300, tags: [TAG] },
);

export async function listPublicBugs(): Promise<BugEntry[]> {
  return readPublic();
}

export async function getPublicBug(slug: string): Promise<BugEntry | null> {
  return (await readPublic()).find((e) => e.slug === slug) ?? null;
}

// Empreinte du contenu : sert d'ETag, le launcher ne retélécharge que si ça change.
export function bugCatalogVersion(entries: BugEntry[]): string {
  return createHash("sha1").update(JSON.stringify(entries)).digest("hex").slice(0, 20);
}

// +1 sur un compteur du jour. Seulement pour une fiche que les joueurs peuvent voir.
export async function recordBugEvent(slug: string, event: BugEvent): Promise<boolean> {
  const entry = await getPublicBug(slug);
  if (!entry || !BUG_EVENTS.includes(event)) return false;
  const day = new Date().toISOString().slice(0, 10);
  await execSql(
    `INSERT INTO "bugCatalogStat" ("entryId", "day", "${event}") VALUES (?, ?, 1) ON CONFLICT ("entryId", "day") DO UPDATE SET "${event}" = "${event}" + 1`,
    [entry.id, day],
  );
  return true;
}

// --- Admin --------------------------------------------------------------------------------------
export async function listBugsForAdmin(): Promise<AdminBugEntry[]> {
  const since = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const [rows, stats] = await Promise.all([
    execSql(`SELECT * FROM "bugCatalogEntry" ORDER BY "createdAt" DESC, "id" ASC`),
    execSql(
      `SELECT "entryId", SUM("seen") AS "seen", SUM("repaired") AS "repaired", SUM("refused") AS "refused" FROM "bugCatalogStat" WHERE "day" >= ? GROUP BY "entryId"`,
      [since],
    ),
  ]);
  const byId = new Map((stats as Record<string, unknown>[]).map((s) => [String(s.entryId), s]));
  return (rows as Record<string, unknown>[]).map((r) => {
    const s = byId.get(String(r.id));
    return { ...fromRow(r), stats: { seen: Number(s?.seen ?? 0), repaired: Number(s?.repaired ?? 0), refused: Number(s?.refused ?? 0) } };
  });
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const oneOf = <T extends string>(value: unknown, list: readonly T[], fallback: T): T => (list.includes(value as T) ? (value as T) : fallback);
const lang = (value: unknown, max: number): Lang => {
  const v = (value ?? {}) as Partial<Lang>;
  return { fr: text(v.fr, max), en: text(v.en, max) };
};
const stepList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((s) => typeof s === "string").slice(0, 30).map((s) => s.slice(0, 500)) : []);

// Tout ce qui vient de l'admin passe ici : champs connus, listes fixes, longueurs bornées.
function cleanEntry(body: unknown): Omit<BugEntry, "id" | "createdAt" | "updatedAt"> | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const slug = text(b.slug, 80);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const match = (b.match ?? {}) as Record<string, unknown>;
  const steps = (b.steps ?? {}) as Record<string, unknown>;
  return {
    slug,
    status: oneOf(b.status, BUG_STATUSES, "analyse"),
    visibility: b.visibility === "internal" ? "internal" : "player",
    hasGuide: b.hasGuide === true,
    notify: b.notify !== false,
    published: b.published === true,
    category: oneOf(b.category, BUG_CATEGORIES, "crash"),
    title: lang(b.title, 200),
    symptom: lang(b.symptom, 4000),
    cause: lang(b.cause, 4000),
    fixAction: oneOf(b.fixAction, BUG_FIXES, "none"),
    fixArg: text(b.fixArg, 200),
    fixText: lang(b.fixText, 1000),
    steps: { fr: stepList(steps.fr), en: stepList(steps.en) },
    match: {
      where: oneOf(match.where, BUG_WHERE, "log"),
      text: text(match.text, 500),
      mc: text(match.mc, 60),
      loader: oneOf(match.loader, BUG_LOADERS, ""),
    },
    fixedIn: text(b.fixedIn, 30),
    logSample: text(b.logSample, 8000),
  };
}

const COLUMNS = (e: NonNullable<ReturnType<typeof cleanEntry>>): [string, unknown][] => [
  ["slug", e.slug],
  ["status", e.status],
  ["visibility", e.visibility],
  ["hasGuide", e.hasGuide ? 1 : 0],
  ["notify", e.notify ? 1 : 0],
  ["published", e.published ? 1 : 0],
  ["category", e.category],
  ["titleFr", e.title.fr],
  ["titleEn", e.title.en],
  ["symptomFr", e.symptom.fr],
  ["symptomEn", e.symptom.en],
  ["causeFr", e.cause.fr],
  ["causeEn", e.cause.en],
  ["fixAction", e.fixAction],
  ["fixArg", e.fixArg],
  ["fixTextFr", e.fixText.fr],
  ["fixTextEn", e.fixText.en],
  ["stepsFr", JSON.stringify(e.steps.fr)],
  ["stepsEn", JSON.stringify(e.steps.en)],
  ["matchWhere", e.match.where],
  ["matchText", e.match.text],
  ["matchMc", e.match.mc],
  ["matchLoader", e.match.loader],
  ["fixedIn", e.fixedIn],
  ["logSample", e.logSample],
];

export type BugSaveResult = { ok: true; id: string } | { ok: false; error: string; status: number };
const slugTaken = (error: unknown) => /UNIQUE/i.test(error instanceof Error ? error.message : String(error));
const BAD_SLUG: BugSaveResult = { ok: false, error: "Adresse de la page invalide : minuscules, chiffres et tirets seulement.", status: 400 };
const TAKEN_SLUG: BugSaveResult = { ok: false, error: "Une autre fiche utilise déjà cette adresse.", status: 409 };

export async function createBug(body: unknown): Promise<BugSaveResult> {
  const entry = cleanEntry(body);
  if (!entry) return BAD_SLUG;
  const id = randomUUID();
  const at = new Date().toISOString();
  const cols = [["id", id], ...COLUMNS(entry), ["createdAt", at], ["updatedAt", at]] as [string, unknown][];
  try {
    await execSql(`INSERT INTO "bugCatalogEntry" (${cols.map(([c]) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map(([, v]) => v));
  } catch (error) {
    if (slugTaken(error)) return TAKEN_SLUG;
    throw error;
  }
  revalidateTag(TAG, { expire: 0 });
  return { ok: true, id };
}

export async function updateBug(id: string, body: unknown): Promise<BugSaveResult> {
  const entry = cleanEntry(body);
  if (!entry) return BAD_SLUG;
  const cols = [...COLUMNS(entry), ["updatedAt", new Date().toISOString()]] as [string, unknown][];
  try {
    await execSql(`UPDATE "bugCatalogEntry" SET ${cols.map(([c]) => `"${c}" = ?`).join(", ")} WHERE "id" = ?`, [...cols.map(([, v]) => v), id]);
  } catch (error) {
    if (slugTaken(error)) return TAKEN_SLUG;
    throw error;
  }
  revalidateTag(TAG, { expire: 0 });
  return { ok: true, id };
}

export async function setBugPublished(id: string, published: boolean): Promise<void> {
  await execSql(`UPDATE "bugCatalogEntry" SET "published" = ?, "updatedAt" = ? WHERE "id" = ?`, [published ? 1 : 0, new Date().toISOString(), id]);
  revalidateTag(TAG, { expire: 0 });
}

export async function deleteBug(id: string): Promise<void> {
  await execSql(`DELETE FROM "bugCatalogStat" WHERE "entryId" = ?`, [id]);
  await execSql(`DELETE FROM "bugCatalogEntry" WHERE "id" = ?`, [id]);
  revalidateTag(TAG, { expire: 0 });
}
