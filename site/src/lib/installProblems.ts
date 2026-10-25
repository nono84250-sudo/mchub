import { execSql } from "@/lib/db";
import { normalizeMinecraftUuid } from "@/lib/launcherSession";

// « Prévenir le serveur » (design du launcher, 17/10, point 6) : rapports d'echec d'installation ou
// de lancement envoyes par les joueurs depuis la pilule du launcher. Rien ne part sans un clic du
// joueur, qui voit ce qui est envoye. Audit du 19/10 (L-B1) : plus de journal du launcher (chat du
// jeu, adresses d'autres serveurs, nom Windows) : logTail n'est plus enregistre ni affiche, meme
// si un ancien launcher l'envoie encore. Le proprietaire les lit regroupes par probleme (meme phrase),
// avec le nombre de joueurs touches, dans /manage/[id]/reports.

export type InstallProblemKind = "disk" | "net" | "crash" | "manual_mods" | "other";
export const INSTALL_PROBLEM_KINDS: InstallProblemKind[] = ["disk", "net", "crash", "manual_mods", "other"];

export async function createInstallProblem(input: {
  serverId: string;
  reporterMinecraftUuid: string;
  kind: InstallProblemKind;
  summary: string;
  detail: string | null;
  launcherVersion: string | null;
  minecraftVersion: string | null;
  logTail?: string | null;
}) {
  await execSql(
    `INSERT INTO "installProblem" ("id", "serverId", "reporterMinecraftUuid", "kind", "summary", "detail", "launcherVersion", "minecraftVersion", "logTail") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.serverId,
      normalizeMinecraftUuid(input.reporterMinecraftUuid),
      input.kind,
      input.summary,
      input.detail,
      input.launcherVersion,
      input.minecraftVersion,
      null,
    ],
  );
}

// Le meme joueur qui renvoie le meme probleme dans la journee ne compte qu'une fois.
export async function recentDuplicate(serverId: string, reporterMinecraftUuid: string, summary: string): Promise<boolean> {
  const rows = (await execSql(
    `SELECT "id" FROM "installProblem" WHERE "serverId" = ? AND "reporterMinecraftUuid" = ? AND "summary" = ? AND "createdAt" > ? LIMIT 1`,
    [serverId, normalizeMinecraftUuid(reporterMinecraftUuid), summary, new Date(Date.now() - 24 * 3600_000).toISOString()],
  )) as unknown as { id: string }[];
  return Array.isArray(rows) && rows.length > 0;
}

export type InstallProblemGroup = {
  kind: InstallProblemKind;
  summary: string;
  players: number;
  lastAt: string;
  launcherVersion: string | null;
  minecraftVersion: string | null;
  detail: string | null;
  logTail: string | null;
};

// Problemes des 30 derniers jours, regroupes par phrase : le plus recent d'abord.
export async function listInstallProblemGroups(serverId: string): Promise<InstallProblemGroup[]> {
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const rows = (await execSql(
    `SELECT "kind", "summary", "reporterMinecraftUuid", "createdAt", "launcherVersion", "minecraftVersion", "detail" FROM "installProblem" WHERE "serverId" = ? AND "createdAt" > ? ORDER BY "createdAt" DESC LIMIT 500`,
    [serverId, since],
  )) as unknown as { kind: InstallProblemKind; summary: string; reporterMinecraftUuid: string; createdAt: string; launcherVersion: string | null; minecraftVersion: string | null; detail: string | null }[];
  const groups = new Map<string, InstallProblemGroup & { uuids: Set<string> }>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = `${row.kind}|${row.summary}`;
    let group = groups.get(key);
    if (!group) {
      group = { kind: row.kind, summary: row.summary, players: 0, lastAt: row.createdAt, launcherVersion: row.launcherVersion, minecraftVersion: row.minecraftVersion, detail: row.detail, logTail: null, uuids: new Set() };
      groups.set(key, group);
    }
    group.uuids.add(row.reporterMinecraftUuid);
    group.players = group.uuids.size;
  }
  return [...groups.values()].map((g) => {
    const { uuids, ...group } = g;
    void uuids;
    return group;
  });
}
