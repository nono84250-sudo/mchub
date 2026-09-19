import { db } from "@/prisma/db";

export type ActivityRange = "day" | "week" | "month" | "year";

export type ActivityPoint = {
  label: string;
  views: number;
  launches: number;
};

type Bucket = "hour" | "day" | "month";

// TimestamptzString revient sous la forme "2026-09-15 16:42:44.598134+00"
// (espace au lieu de "T", et surtout un fuseau "+00" SANS les minutes) —
// `new Date(...)` ne reconnait pas ce fuseau et retourne silencieusement
// "Invalid Date" (confirme en isolant le probleme : "+00:00"/"+0000"/"Z"
// fonctionnent, "+00" seul non), d'ou les deux remplacements.
function parseTimestamp(raw: string): Date {
  return new Date(raw.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
}

function bucketKey(date: Date, bucket: Bucket): string {
  if (bucket === "hour") return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  if (bucket === "day") return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function bucketLabel(date: Date, bucket: Bucket): string {
  if (bucket === "hour") return date.toLocaleTimeString("fr-FR", { hour: "2-digit" });
  if (bucket === "day") return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function buildEmptyBuckets(since: Date, bucket: Bucket): Map<string, ActivityPoint & { date: Date }> {
  const buckets = new Map<string, ActivityPoint & { date: Date }>();
  const now = new Date();

  if (bucket === "month") {
    const cursor = new Date(since.getFullYear(), since.getMonth(), 1);
    while (cursor <= now) {
      buckets.set(bucketKey(cursor, bucket), { label: bucketLabel(cursor, bucket), views: 0, launches: 0, date: new Date(cursor) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
  }

  const stepMs = bucket === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  for (let t = since.getTime(); t <= now.getTime(); t += stepMs) {
    const date = new Date(t);
    buckets.set(bucketKey(date, bucket), { label: bucketLabel(date, bucket), views: 0, launches: 0, date });
  }
  return buckets;
}

function rangeConfig(range: ActivityRange): { since: Date; bucket: Bucket } {
  const now = new Date();
  if (range === "day") return { since: new Date(now.getTime() - 24 * 60 * 60 * 1000), bucket: "hour" };
  if (range === "week") return { since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), bucket: "day" };
  if (range === "month") return { since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), bucket: "day" };
  return { since: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()), bucket: "month" };
}

// Buckets construits en JS plutot qu'avec un GROUP BY sur date tronquee
// cote SQL : a l'echelle d'un projet perso (quelques serveurs, quelques
// centaines/milliers d'evenements), c'est largement suffisant et evite de
// s'appuyer sur une projection calculee que l'ORM Prisma 8 n'expose pas
// directement pour ce lane.
export async function getServerActivity(serverId: string, range: ActivityRange): Promise<ActivityPoint[]> {
  const { since, bucket } = rangeConfig(range);

  const events = await db.orm.public.ServerEvent.select("kind", "createdAt")
    .where((e) => e.serverId.eq(serverId))
    .where((e) => e.createdAt.gte(since.toISOString()))
    .all();

  const buckets = buildEmptyBuckets(since, bucket);

  for (const event of events) {
    const createdAt = parseTimestamp(event.createdAt);
    const point = buckets.get(bucketKey(createdAt, bucket));
    if (!point) continue;
    if (event.kind === "view") point.views += 1;
    else point.launches += 1;
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ label, views, launches }) => ({ label, views, launches }));
}
