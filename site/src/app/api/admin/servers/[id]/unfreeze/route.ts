import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { createNotification } from "@/lib/notifications";

// Dégel : le serveur revient dans l'annuaire et le launcher peut à nouveau le lancer.
// Si la case « envoyer un message au propriétaire » est cochée, il est prévenu (message bleu-violet
// de l'équipe dans la cloche du launcher).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/servers/[id]/unfreeze">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const server = await db.orm.public.Server.select("id", "slug", "name")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ id })
    .first();
  if (!server) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });
  await db.orm.public.Server.where({ id }).update({ frozenAt: null, frozenReason: null, frozenBy: null, published: true });
  if (form.get("notify") === "on" && server.owner?.minecraftUuid) {
    await createNotification({
      recipientMinecraftUuid: server.owner.minecraftUuid,
      type: "admin_info",
      serverName: server.name,
      message: "Votre serveur a été dégelé par l'équipe Omniscient.",
    });
  }
  refreshServersCache();
  return backToServers(request, `/admin/servers/${server.slug}`);
}
