import { db } from "@/prisma/db";

// Signalements techniques envoyes par les joueurs depuis le launcher (voir
// /api/launcher/servers/[slug]/report) — uniquement la categorie "Probleme
// technique" de la maquette (voir le commentaire sur le modele Report dans
// contract.prisma pour pourquoi la categorie "moderateurs" n'existe pas ici).

export type ReportIssue = "cant_connect" | "wrong_version" | "modpack_download" | "crash" | "other";
export type ReportStatus = "new" | "replied" | "resolved";

export type ReportSummary = {
  id: string;
  issue: ReportIssue;
  reporterMinecraftUsername: string;
  status: ReportStatus;
  createdAt: string;
};

// Un seul appel pour la liste ET le badge de compte de la sidebar (voir
// ManageSidebar) : le nombre de signalements par serveur reste minuscule,
// filtrer "ouvert vs resolu" en JS plutot que dans la requete evite
// d'apprendre la syntaxe "not equal" du lane ORM Prisma 8 pour un gain de
// performance qui ne se verrait pas ici (meme raisonnement que
// listPublicServers).
export async function listReportsForServer(serverId: string): Promise<ReportSummary[]> {
  return db.orm.public.Report.select("id", "issue", "reporterMinecraftUsername", "status", "createdAt")
    .where({ serverId })
    .orderBy((r) => r.createdAt.desc())
    .all();
}

export async function getReportDetail(reportId: string, serverId: string) {
  return db.orm.public.Report.where({ id: reportId, serverId }).first();
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
  return db.orm.public.Report.create({ ...input, status: "new" });
}
