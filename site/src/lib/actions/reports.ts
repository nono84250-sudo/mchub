"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { createNotification } from "@/lib/notifications";

export type ReportActionState = { error: string } | undefined;

// Meme garde-fou que getOwnedServer dans lib/actions/servers.ts : verifie que
// le signalement appartient bien a un serveur possede par l'utilisateur
// connecte avant toute mutation, en une seule requete. Renvoie aussi le
// serveur (son nom sert a la notification envoyee au joueur).
async function getOwnedReport(reportId: string, userId: string) {
  const report = await db.orm.public.Report.where({ id: reportId }).first();
  if (!report) return null;
  const server = await db.orm.public.Server.where({ id: report.serverId, ownerId: userId }).first();
  return server ? { report, server } : null;
}

export async function replyToReport(
  reportId: string,
  _prevState: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié." };

  const owned = await getOwnedReport(reportId, session.user.id);
  if (!owned) return { error: "Ce signalement n'existe pas ou ne t'appartient pas." };

  const reply = String(formData.get("reply") ?? "").trim();
  if (!reply) return { error: "La réponse ne peut pas être vide." };

  // Renvoyer un message sur un signalement deja resolu ne doit pas le
  // rouvrir : le formulaire de reponse reste utilisable apres resolution
  // (ex. un mot de remerciement), mais seul le bouton "Marquer resolu" doit
  // pouvoir faire varier le status une fois qu'il est a "resolved".
  const nextStatus = owned.report.status === "resolved" ? "resolved" : "replied";
  await db.orm.public.Report.where({ id: reportId }).update({ reply, status: nextStatus });
  await createNotification({
    recipientMinecraftUuid: owned.report.reporterMinecraftUuid,
    type: "report_replied",
    serverName: owned.server.name,
    message: reply,
  });

  revalidatePath(`/manage/${owned.report.serverId}/reports`);
  return undefined;
}

export async function markReportResolved(reportId: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  const owned = await getOwnedReport(reportId, session.user.id);
  if (!owned) return;

  await db.orm.public.Report.where({ id: reportId }).update({ status: "resolved" });
  await createNotification({
    recipientMinecraftUuid: owned.report.reporterMinecraftUuid,
    type: "report_resolved",
    serverName: owned.server.name,
  });

  revalidatePath(`/manage/${owned.report.serverId}/reports`);
}
