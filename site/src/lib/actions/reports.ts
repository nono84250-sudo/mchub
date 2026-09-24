"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/prisma/db";

export type ReportActionState = { error: string } | undefined;

// Meme garde-fou que getOwnedServer dans lib/actions/servers.ts : verifie que
// le signalement appartient bien a un serveur possede par l'utilisateur
// connecte avant toute mutation, en une seule requete.
async function getOwnedReport(reportId: string, userId: string) {
  const report = await db.orm.public.Report.where({ id: reportId }).first();
  if (!report) return null;
  const owned = await db.orm.public.Server.where({ id: report.serverId, ownerId: userId }).first();
  return owned ? report : null;
}

export async function replyToReport(
  reportId: string,
  _prevState: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié." };

  const report = await getOwnedReport(reportId, session.user.id);
  if (!report) return { error: "Ce signalement n'existe pas ou ne t'appartient pas." };

  const reply = String(formData.get("reply") ?? "").trim();
  if (!reply) return { error: "La réponse ne peut pas être vide." };

  await db.orm.public.Report.where({ id: reportId }).update({ reply, status: "replied" });

  revalidatePath(`/manage/${report.serverId}/reports`);
  return undefined;
}

export async function markReportResolved(reportId: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  const report = await getOwnedReport(reportId, session.user.id);
  if (!report) return;

  await db.orm.public.Report.where({ id: reportId }).update({ status: "resolved" });

  revalidatePath(`/manage/${report.serverId}/reports`);
}
