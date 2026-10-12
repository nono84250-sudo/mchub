import { NextResponse } from "next/server";
import { adminForAction, backToServers } from "@/lib/adminServers";
import { getBehaviorReportDetail, resolveBehaviorReport } from "@/lib/reports";
import { createNotification } from "@/lib/notifications";

// "Avertir le propriétaire" depuis un signalement de comportement/contenu (voir 03c dans
// Design/Omniscient Launcher UI Mockups.dc.html) : envoie l'avertissement puis ferme le
// signalement (meme chemin que dismiss, reutilise pour ne pas dupliquer le update status).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/reports/[id]/warn">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  if (text.length < 3) return NextResponse.json({ error: "Écrivez un message (3 caractères minimum)." }, { status: 400 });

  const found = await getBehaviorReportDetail(id);
  if (!found) return NextResponse.json({ error: "Signalement introuvable." }, { status: 404 });
  if (found.server?.owner?.minecraftUuid) {
    await createNotification({ recipientMinecraftUuid: found.server.owner.minecraftUuid, type: "admin_warning", serverName: found.server.name, message: text });
  }
  await resolveBehaviorReport(id);
  return backToServers(request, "/admin/reports");
}
