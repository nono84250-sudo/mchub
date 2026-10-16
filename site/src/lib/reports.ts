import { db, execSql } from "@/lib/db";
import { normalizeMinecraftUuid } from "@/lib/launcherSession";

// Signalements envoyes par les joueurs depuis le launcher (voir "03b Report a server" dans
// Design/Omniscient Launcher UI Mockups.dc.html) — deux categories distinctes : "Probleme
// technique" (va au proprietaire, fonctions listReportsForServer/getReportDetail/createReport
// ci-dessous) et "Comportement/contenu" (va aux moderateurs Omniscient, jamais au proprietaire
// — fonctions listBehaviorReports/createBehaviorReport/etc. plus bas).

export type ReportIssue = "cant_connect" | "wrong_version" | "modpack_download" | "crash" | "other";
export type BehaviorIssue = "stolen_server" | "stolen_content" | "impersonating" | "inappropriate_content" | "scam_phishing" | "other";
export type ReportStatus = "new" | "replied" | "resolved";

export type ReportSummary = {
  id: string;
  issue: ReportIssue;
  reporterMinecraftUsername: string;
  message: string;
  status: ReportStatus;
  createdAt: string;
};

// Un seul appel pour la liste ET le badge de compte de la sidebar (voir
// ManageSidebar) : le nombre de signalements par serveur reste minuscule,
// filtrer "ouvert vs resolu" en JS plutot que dans la requete evite
// d'apprendre la syntaxe "not equal" du lane ORM Prisma 8 pour un gain de
// performance qui ne se verrait pas ici (meme raisonnement que
// listPublicServers).
// category: "technical" uniquement — jamais un signalement de comportement/contenu, qui ne
// doit jamais atteindre le proprietaire.
export async function listReportsForServer(serverId: string): Promise<ReportSummary[]> {
  return db.orm.public.Report.select("id", "issue", "reporterMinecraftUsername", "message", "status", "createdAt")
    .where({ serverId, category: "technical" })
    .orderBy((r) => r.createdAt.desc())
    .all();
}

export async function getReportDetail(reportId: string, serverId: string) {
  return db.orm.public.Report.where({ id: reportId, serverId, category: "technical" }).first();
}

// Appelee par la route launcher (jamais par une session utilisateur — pas de
// verification de propriete ici, le serverId vient deja d'une resolution par
// slug dans la route appelante).
export async function createReport(input: {
  serverId: string;
  reporterMinecraftUuid: string;
  reporterMinecraftUsername: string;
  issue: ReportIssue;
  message: string;
  clientVersion: string | null;
  launcherVersion: string | null;
}) {
  return db.orm.public.Report.create({
    ...input,
    reporterMinecraftUuid: normalizeMinecraftUuid(input.reporterMinecraftUuid),
    status: "new",
    category: "technical",
  });
}

// --- Comportement / contenu (moderation Omniscient) ---

export type BehaviorReportSummary = {
  id: string;
  behaviorIssue: BehaviorIssue;
  reporterMinecraftUsername: string;
  message: string;
  proofUrl: string | null;
  status: ReportStatus;
  createdAt: string;
  serverId: string;
  serverName: string;
};

export async function listBehaviorReports(status: "open" | "resolved"): Promise<BehaviorReportSummary[]> {
  const rows = (await execSql(
    `SELECT "id", "behaviorIssue", "reporterMinecraftUsername", "message", "proofUrl", "status", "createdAt", "serverId" FROM "report" WHERE "category" = 'behavior' AND "status" ${status === "open" ? "!=" : "="} 'resolved' ORDER BY "createdAt" DESC`,
  )) as BehaviorReportSummary[];
  if (rows.length === 0) return [];
  const serverIds = [...new Set(rows.map((r) => r.serverId))];
  const servers = await db.orm.public.Server.select("id", "name").all();
  const nameById = new Map(servers.filter((s) => serverIds.includes(s.id)).map((s) => [s.id, s.name]));
  return rows.map((r) => ({ ...r, serverName: nameById.get(r.serverId) ?? "—" }));
}

// Compte seul (sans les lignes), pour le badge "Reports" du menu lateral (voir
// markNavBadges dans design/bind.ts) — affiche sur CHAQUE page admin, donc pas question de
// retomber sur listBehaviorReports() qui fait aussi le JOIN des noms de serveur.
export async function countOpenBehaviorReports(): Promise<number> {
  const rows = (await execSql(
    `SELECT COUNT(*) as count FROM "report" WHERE "category" = 'behavior' AND "status" != 'resolved'`,
  )) as { count: number }[];
  return rows[0]?.count ?? 0;
}

// Historique de moderation d'UN serveur (fiche serveur, panel admin) — serverName omis,
// redondant sur une page deja scopee a ce serveur (contrairement a listBehaviorReports,
// qui liste tous les serveurs confondus et en a besoin).
export async function listBehaviorReportsForServer(serverId: string): Promise<Omit<BehaviorReportSummary, "serverName">[]> {
  return db.orm.public.Report.select("id", "behaviorIssue", "reporterMinecraftUsername", "message", "proofUrl", "status", "createdAt", "serverId")
    .where({ serverId, category: "behavior" })
    .orderBy((r) => r.createdAt.desc())
    .all();
}

export async function getBehaviorReportDetail(reportId: string) {
  const report = await db.orm.public.Report.where({ id: reportId, category: "behavior" }).first();
  if (!report) return null;
  const server = await db.orm.public.Server.select("id", "slug", "name", "ownerId")
    .include("owner", (o) => o.select("name", "minecraftUuid"))
    .where({ id: report.serverId })
    .first();
  return { report, server };
}

export async function createBehaviorReport(input: {
  serverId: string;
  reporterMinecraftUuid: string;
  reporterMinecraftUsername: string;
  behaviorIssue: BehaviorIssue;
  message: string;
  proofUrl: string | null;
}) {
  return db.orm.public.Report.create({
    serverId: input.serverId,
    reporterMinecraftUuid: normalizeMinecraftUuid(input.reporterMinecraftUuid),
    reporterMinecraftUsername: input.reporterMinecraftUsername,
    issue: "other",
    behaviorIssue: input.behaviorIssue,
    message: input.message,
    proofUrl: input.proofUrl,
    status: "new",
    category: "behavior",
  });
}

export async function dismissBehaviorReport(reportId: string): Promise<void> {
  await execSql('UPDATE "report" SET "status" = ?, "updatedAt" = ? WHERE "id" = ? AND "category" = ?', [
    "resolved",
    new Date().toISOString(),
    reportId,
    "behavior",
  ]);
}

export async function resolveBehaviorReport(reportId: string): Promise<void> {
  await dismissBehaviorReport(reportId);
}
