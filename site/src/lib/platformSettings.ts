import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { db, execSql } from "@/lib/db";

// Charge (audit 25/10) : ces reglages etaient relus en base a chaque page du site (banniere,
// dans le layout commun) et a chaque appel modpack/maintenance du launcher. Ils changent
// rarement, et seulement depuis le panel admin : lus au plus une fois par minute, et le cache
// est vide des qu'un admin en change un (PLATFORM_SETTINGS_TAG dans chaque fonction d'ecriture).
const PLATFORM_SETTINGS_TAG = "platform-settings";
const readSettingValue = unstable_cache(
  async (key: string): Promise<string | null> => {
    const row = await db.orm.public.PlatformSetting.select("value").where({ key }).first();
    return row ? String(row.value) : null;
  },
  ["platform-setting"],
  { revalidate: 60, tags: [PLATFORM_SETTINGS_TAG] },
);
function settingsChanged(): void {
  revalidateTag(PLATFORM_SETTINGS_TAG, { expire: 0 });
}

// Réglages globaux de la plateforme (table platformSetting), modifiables depuis
// le panel admin. Pour l'instant : l'interrupteur de chaque source de modpacks.
// Une valeur absente vaut le défaut ci-dessous. CurseForge est désactivé par
// défaut tant que la clé API n'est pas validée ; Modrinth fonctionne sans clé.

export const SOURCES = ["curseforge", "modrinth"] as const;
export type Source = (typeof SOURCES)[number];

const DEFAULT_ENABLED: Record<Source, boolean> = { curseforge: false, modrinth: true };
const keyOf = (source: Source) => `source.${source}`;

export async function isSourceEnabled(source: Source): Promise<boolean> {
  const value = await readSettingValue(keyOf(source));
  if (value === null) return DEFAULT_ENABLED[source];
  return value === "on";
}

export async function setSourceEnabled(source: Source, enabled: boolean): Promise<void> {
  const value = enabled ? "on" : "off";
  await execSql(
    'INSERT INTO "platformSetting" ("key", "value", "updatedAt") VALUES (?, ?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updatedAt" = excluded."updatedAt"',
    [keyOf(source), value, new Date().toISOString()],
  );
  settingsChanged();
}

export async function allSourceStates(): Promise<Record<Source, boolean>> {
  const entries = await Promise.all(SOURCES.map(async (source) => [source, await isSourceEnabled(source)] as const));
  return Object.fromEntries(entries) as Record<Source, boolean>;
}

// Bannière du site (panel admin, voir /admin/notifications) : un seul message actif a la fois,
// affiche en haut de toutes les pages publiques jusqu'a ce qu'un admin la retire. Pas de table a
// part : reutilise platformSetting, comme les interrupteurs de sources ci-dessus.
const BANNER_KEY = "site.banner";
export type SiteBanner = { type: "announcement" | "maintenance" | "alert" | "promotion"; text: string } | null;

export async function getSiteBanner(): Promise<SiteBanner> {
  const value = await readSettingValue(BANNER_KEY);
  if (value === null) return null;
  try {
    return JSON.parse(value) as SiteBanner;
  } catch {
    return null;
  }
}

export async function setSiteBanner(banner: SiteBanner): Promise<void> {
  if (banner === null) {
    await db.orm.public.PlatformSetting.where({ key: BANNER_KEY }).delete();
    settingsChanged();
    return;
  }
  await execSql(
    'INSERT INTO "platformSetting" ("key", "value", "updatedAt") VALUES (?, ?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updatedAt" = excluded."updatedAt"',
    [BANNER_KEY, JSON.stringify(banner), new Date().toISOString()],
  );
  settingsChanged();
}

// Mode maintenance du launcher (panel admin, voir /admin/notifications) : bloque l'ecran
// d'accueil du launcher pour tout le monde, sauf qui tape le code genere ici. Le code n'est
// JAMAIS renvoye par une route cote launcher (voir /api/launcher/maintenance) — seul /admin
// peut le lire, pour que l'admin le communique lui-meme (vocalement, message prive...).
const MAINTENANCE_KEY = "launcher.maintenance";
export type LauncherMaintenance = { active: boolean; code: string; message: string } | null;

export async function getLauncherMaintenance(): Promise<LauncherMaintenance> {
  const value = await readSettingValue(MAINTENANCE_KEY);
  if (value === null) return null;
  try {
    return JSON.parse(value) as LauncherMaintenance;
  } catch {
    return null;
  }
}

// Genere un nouveau code a chaque activation : un ancien code communique par erreur ne doit
// plus marcher la fois suivante.
export async function activateLauncherMaintenance(message: string): Promise<string> {
  // Tirage cryptographique (audit 25/10) : Math.random n'est pas fait pour un code d'acces.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  await execSql(
    'INSERT INTO "platformSetting" ("key", "value", "updatedAt") VALUES (?, ?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updatedAt" = excluded."updatedAt"',
    [MAINTENANCE_KEY, JSON.stringify({ active: true, code, message }), new Date().toISOString()],
  );
  settingsChanged();
  return code;
}

export async function clearLauncherMaintenance(): Promise<void> {
  await db.orm.public.PlatformSetting.where({ key: MAINTENANCE_KEY }).delete();
  settingsChanged();
}

// Libellés affichés pour les deux rôles staff (admin/modérateur) — le nom change, pas les
// permissions (toujours juste les deux rôles existants, voir adminAuth.ts). Reutilise
// platformSetting comme la bannière ci-dessus : pas de table a part pour deux chaines.
const ROLE_LABELS_KEY = "staff.roleLabels";
export type StaffRoleLabels = { admin: string; moderator: string };
const DEFAULT_ROLE_LABELS: StaffRoleLabels = { admin: "Administrateur", moderator: "Modérateur" };

export async function getStaffRoleLabels(): Promise<StaffRoleLabels> {
  const value = await readSettingValue(ROLE_LABELS_KEY);
  if (value === null) return DEFAULT_ROLE_LABELS;
  try {
    return { ...DEFAULT_ROLE_LABELS, ...JSON.parse(value) };
  } catch {
    return DEFAULT_ROLE_LABELS;
  }
}

export async function setStaffRoleLabels(labels: StaffRoleLabels): Promise<void> {
  await execSql(
    'INSERT INTO "platformSetting" ("key", "value", "updatedAt") VALUES (?, ?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updatedAt" = excluded."updatedAt"',
    [ROLE_LABELS_KEY, JSON.stringify(labels), new Date().toISOString()],
  );
  settingsChanged();
}

// Réponse à renvoyer si la source est coupée, sinon null. Le launcher affiche le message.
export async function sourceDisabledResponse(source: Source): Promise<NextResponse | null> {
  if (await isSourceEnabled(source)) return null;
  return NextResponse.json(
    { error: "Cette source de modpacks est temporairement indisponible." },
    { status: 503 },
  );
}
