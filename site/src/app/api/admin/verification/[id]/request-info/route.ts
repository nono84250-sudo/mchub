import { NextResponse } from "next/server";
import { adminForAction, backToServers } from "@/lib/adminServers";
import { getVerificationDetail, requestServerInfo } from "@/lib/verification";
import { createNotification } from "@/lib/notifications";

// "Demander des infos" : notifie le propriétaire mais ne change pas le statut — le serveur
// reste en 'pending' (contrairement à approve/reject), voir lib/verification.ts.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/verification/[id]/request-info">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  if (text.length < 3) return NextResponse.json({ error: "Écrivez un message (3 caractères minimum)." }, { status: 400 });

  const found = await getVerificationDetail(id);
  if (!found) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });

  await requestServerInfo(id, text);
  if (found.ownerMinecraftUuid) {
    await createNotification({ recipientMinecraftUuid: found.ownerMinecraftUuid, type: "admin_info", serverName: found.name, message: text });
  }
  return backToServers(request, "/admin/verification?status=pending");
}
