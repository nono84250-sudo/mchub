import { NextResponse } from "next/server";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { getVerificationDetail, rejectServer } from "@/lib/verification";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/verification/[id]/reject">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const reason = String(form.get("reason") ?? "").trim().slice(0, 1000);
  if (reason.length < 3) return NextResponse.json({ error: "Indiquez un motif de refus (3 caractères minimum)." }, { status: 400 });

  const found = await getVerificationDetail(id);
  if (!found) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });

  await rejectServer(id, reason);
  if (found.ownerMinecraftUuid) {
    await createNotification({ recipientMinecraftUuid: found.ownerMinecraftUuid, type: "verification_rejected", serverName: found.name, message: reason });
  }
  // 2026-10-11 : manquait ici (present sur approve/route.ts) — sans ca, le launcher ("Mes
  // instances") et le site continuaient de montrer l'ancien etat ("en attente", public) bien
  // apres un refus, jusqu'a l'expiration naturelle du cache.
  refreshServersCache();
  return backToServers(request, "/admin/verification?status=pending");
}
