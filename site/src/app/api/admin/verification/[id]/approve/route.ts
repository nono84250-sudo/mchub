import { NextResponse } from "next/server";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { approveServer, getVerificationDetail } from "@/lib/verification";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/verification/[id]/approve">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const found = await getVerificationDetail(id);
  if (!found) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });

  await approveServer(id);
  if (found.ownerMinecraftUuid) {
    await createNotification({ recipientMinecraftUuid: found.ownerMinecraftUuid, type: "verification_approved", serverName: found.name });
  }
  refreshServersCache(); // visible tout de suite dans l'annuaire et l'API launcher
  return backToServers(request, "/admin/verification?status=pending");
}
