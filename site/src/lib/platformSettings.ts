import { NextResponse } from "next/server";
import { db } from "@/prisma/db";

// Réglages globaux de la plateforme (table platformSetting), modifiables depuis
// le panel admin. Pour l'instant : l'interrupteur de chaque source de modpacks.
// Une valeur absente vaut le défaut ci-dessous. CurseForge est désactivé par
// défaut tant que la clé API n'est pas validée ; Modrinth fonctionne sans clé.

export const SOURCES = ["curseforge", "modrinth"] as const;
export type Source = (typeof SOURCES)[number];

const DEFAULT_ENABLED: Record<Source, boolean> = { curseforge: false, modrinth: true };
const keyOf = (source: Source) => `source.${source}`;

export async function isSourceEnabled(source: Source): Promise<boolean> {
  const row = await db.orm.public.PlatformSetting.select("value").where({ key: keyOf(source) }).first();
  if (!row) return DEFAULT_ENABLED[source];
  return row.value === "on";
}

export async function setSourceEnabled(source: Source, enabled: boolean): Promise<void> {
  const value = enabled ? "on" : "off";
  const plan = db.raw.sql`INSERT INTO "platformSetting" ("key", "value", "updatedAt") VALUES (${keyOf(source)}, ${value}, now())
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`
    .affectedCount()
    .build();
  await db.runtime().execute(plan);
}

export async function allSourceStates(): Promise<Record<Source, boolean>> {
  const entries = await Promise.all(SOURCES.map(async (source) => [source, await isSourceEnabled(source)] as const));
  return Object.fromEntries(entries) as Record<Source, boolean>;
}

// Réponse à renvoyer si la source est coupée, sinon null. Le launcher affiche le message.
export async function sourceDisabledResponse(source: Source): Promise<NextResponse | null> {
  if (await isSourceEnabled(source)) return null;
  return NextResponse.json(
    { error: "Cette source de modpacks est temporairement indisponible." },
    { status: 503 },
  );
}
