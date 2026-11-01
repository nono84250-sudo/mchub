import { execSqlBatch } from "@/lib/db";
import { ANALYTICS_FLUSH_SECONDS, ANALYTICS_SITE_WINDOW_SECONDS, ONLINE_WINDOW_SECONDS } from "@/lib/refreshSettings";

// Panel Analytique (31/10, preview validée par Rushi). Qui est là en ce moment :
// - Launcher : "userPresence", déjà tenue par le launcher (rien de plus côté launcher). « En jeu » =
//   playingSlug renseigné, donc une partie sur un serveur PUBLIC de l'annuaire : le launcher
//   n'envoie rien pour une partie solo ou un serveur privé, ces joueurs comptent « dans le menu ».
// - Site : "analyticsSiteVisitor", un identifiant au hasard par navigateur, effacé après 2 min.
// - Pics : "analyticsDaily", des totaux par heure (Bruxelles), aucune trace individuelle. Mis à jour
//   par les signaux du site et les lectures de la page : sans visiteur ni page ouverte, pas de pic.
//
// Quota Cloudflare (~1 200 appels / 5 min pour tout le site) : un appel par signal coûterait 500
// appels / 5 min à 100 visiteurs. Les signaux attendent donc en mémoire et partent ensemble en UN
// appel, au plus toutes les 15 s par instance. Si une instance s'arrête, son attente est perdue :
// sans gravité, le visiteur renvoie un signal à la minute suivante.
const FLUSH_MS = ANALYTICS_FLUSH_SECONDS * 1000;
const ROLLUP_MS = 60_000;
const MAX_PENDING = 5000;
const ROWS_PER_STATEMENT = 30; // 3 paramètres par ligne : reste sous la limite de D1 (100).

type PendingVisit = { userId: string | null; at: string };
const pending = new Map<string, PendingVisit>();
let lastFlushAt = 0;
let lastRollupAt = 0;

const cutoff = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

// Heure de Bruxelles, le serveur tournant en UTC.
function brusselsNow(): { day: string; hour: number; minute: number; second: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

function dayMinus(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

// Comptes en ligne, sans lire ligne par ligne côté site. Un compte connecté depuis deux navigateurs
// ne compte qu'une fois (DISTINCT) ; « both » = connecté sur le site ET présent dans le launcher.
const COUNTS_CTE =
  'WITH lau AS (SELECT "userId", "playingSlug" FROM "userPresence" WHERE "lastSeenAt" > ?), ' +
  'sit AS (SELECT "userId" FROM "analyticsSiteVisitor" WHERE "lastSeenAt" > ?), ' +
  "c AS (SELECT (SELECT COUNT(*) FROM lau) AS launcher, " +
  '(SELECT COUNT(*) FROM lau WHERE "playingSlug" IS NOT NULL) AS inGame, ' +
  '(SELECT COUNT(DISTINCT "userId") FROM sit) AS siteLogged, ' +
  '(SELECT COUNT(*) FROM sit WHERE "userId" IS NULL) AS siteAnon, ' +
  '(SELECT COUNT(DISTINCT s."userId") FROM sit s JOIN lau l ON l."userId" = s."userId") AS both) ';

function countParams(): string[] {
  return [cutoff(ONLINE_WINDOW_SECONDS), cutoff(ANALYTICS_SITE_WINDOW_SECONDS)];
}

function takePendingStatements() {
  const rows = [...pending.entries()];
  pending.clear();
  const statements: { sql: string; params: unknown[] }[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(i, i + ROWS_PER_STATEMENT);
    statements.push({
      sql:
        `INSERT INTO "analyticsSiteVisitor" ("visitorId", "userId", "lastSeenAt") VALUES ${chunk.map(() => "(?, ?, ?)").join(", ")} ` +
        'ON CONFLICT ("visitorId") DO UPDATE SET "userId" = excluded."userId", "lastSeenAt" = excluded."lastSeenAt"',
      params: chunk.flatMap(([id, visit]) => [id, visit.userId, visit.at]),
    });
  }
  return { rows, statements };
}

function restorePending(rows: [string, PendingVisit][]) {
  for (const [id, visit] of rows) if (!pending.has(id) && pending.size < MAX_PENDING) pending.set(id, visit);
}

const purgeStatement = () => ({ sql: 'DELETE FROM "analyticsSiteVisitor" WHERE "lastSeenAt" <= ?', params: [cutoff(ANALYTICS_SITE_WINDOW_SECONDS)] });

// Le pic de l'heure ne fait que monter (max de l'ancienne et de la nouvelle valeur). « WHERE true »
// : syntaxe demandée par SQLite pour un INSERT ... SELECT suivi de ON CONFLICT.
function rollupStatement() {
  const { day, hour } = brusselsNow();
  lastRollupAt = Date.now();
  return {
    sql:
      COUNTS_CTE +
      'INSERT INTO "analyticsDaily" ("day", "hour", "launcherPeak", "sitePeak", "totalPeak") ' +
      "SELECT ?, ?, launcher, siteLogged + siteAnon, launcher + siteLogged + siteAnon - both FROM c WHERE true " +
      'ON CONFLICT ("day", "hour") DO UPDATE SET ' +
      '"launcherPeak" = MAX("launcherPeak", excluded."launcherPeak"), "sitePeak" = MAX("sitePeak", excluded."sitePeak"), "totalPeak" = MAX("totalPeak", excluded."totalPeak")',
    params: [...countParams(), day, hour],
  };
}

export async function recordSitePing(visitorId: string, userId: string | null): Promise<void> {
  if (pending.size < MAX_PENDING || pending.has(visitorId)) pending.set(visitorId, { userId, at: new Date().toISOString() });
  if (Date.now() - lastFlushAt < FLUSH_MS) return;
  lastFlushAt = Date.now();
  const { rows, statements } = takePendingStatements();
  try {
    await execSqlBatch([...statements, purgeStatement(), ...(Date.now() - lastRollupAt >= ROLLUP_MS ? [rollupStatement()] : [])]);
  } catch (error) {
    restorePending(rows);
    throw error;
  }
}

export type AnalyticsSnapshot = {
  launcher: number;
  inGame: number;
  siteLogged: number;
  siteAnon: number;
  both: number;
  accounts: number;
  activeToday: number;
  active7: number;
  active30: number;
  neverLauncher: number;
  peak: { value: number; hour: number } | null;
  today: { hour: number; launcher: number; site: number }[];
  days: { day: string; launcher: number; site: number }[];
  currentHour: number;
  todayKey: string;
  launcherWindowMinutes: number;
};

const num = (value: unknown) => Number(value) || 0;

// Tout en UN appel à la base, pour une page qui se rafraîchit toutes les 30 s.
export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const { day, hour, minute, second } = brusselsNow();
  const midnight = new Date(Date.now() - (hour * 3600 + minute * 60 + second) * 1000).toISOString();
  const first = dayMinus(day, 13);
  const { rows, statements } = takePendingStatements();
  const queries = [
    ...statements,
    purgeStatement(),
    rollupStatement(),
    { sql: `${COUNTS_CTE}SELECT * FROM c`, params: countParams() },
    {
      sql:
        'SELECT (SELECT COUNT(*) FROM "user") AS accounts, ' +
        '(SELECT COUNT(*) FROM "userPresence" WHERE "lastSeenAt" >= ?) AS activeToday, ' +
        '(SELECT COUNT(*) FROM "userPresence" WHERE "lastSeenAt" >= ?) AS active7, ' +
        '(SELECT COUNT(*) FROM "userPresence" WHERE "lastSeenAt" >= ?) AS active30, ' +
        '(SELECT COUNT(*) FROM "user" u WHERE NOT EXISTS (SELECT 1 FROM "userPresence" p WHERE p."userId" = u."id")) AS neverLauncher',
      params: [midnight, cutoff(7 * 86_400), cutoff(30 * 86_400)],
    },
    { sql: 'SELECT "hour", "launcherPeak", "sitePeak", "totalPeak" FROM "analyticsDaily" WHERE "day" = ? ORDER BY "hour"', params: [day] },
    { sql: 'SELECT "day", MAX("launcherPeak") AS launcher, MAX("sitePeak") AS site FROM "analyticsDaily" WHERE "day" >= ? GROUP BY "day" ORDER BY "day"', params: [first] },
  ];
  let results: Awaited<ReturnType<typeof execSqlBatch>>;
  try {
    results = await execSqlBatch(queries);
  } catch (error) {
    restorePending(rows);
    throw error;
  }
  lastFlushAt = Date.now();
  const [counts, base, todayRows, dayRows] = results.slice(statements.length + 2);
  const c = counts[0] ?? {};
  const b = base[0] ?? {};
  let peak: AnalyticsSnapshot["peak"] = null;
  for (const row of todayRows) {
    if (num(row.totalPeak) > (peak?.value ?? 0)) peak = { value: num(row.totalPeak), hour: num(row.hour) };
  }
  return {
    launcher: num(c.launcher),
    inGame: num(c.inGame),
    siteLogged: num(c.siteLogged),
    siteAnon: num(c.siteAnon),
    both: num(c.both),
    accounts: num(b.accounts),
    activeToday: num(b.activeToday),
    active7: num(b.active7),
    active30: num(b.active30),
    neverLauncher: num(b.neverLauncher),
    peak,
    today: todayRows.map((r) => ({ hour: num(r.hour), launcher: num(r.launcherPeak), site: num(r.sitePeak) })),
    days: dayRows.map((r) => ({ day: String(r.day), launcher: num(r.launcher), site: num(r.site) })),
    currentHour: hour,
    todayKey: day,
    launcherWindowMinutes: Math.round(ONLINE_WINDOW_SECONDS / 60),
  };
}
