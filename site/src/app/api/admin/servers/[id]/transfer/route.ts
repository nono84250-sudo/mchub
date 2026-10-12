import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { createNotification } from "@/lib/notifications";

// Transfert de propriété (fiche serveur, panel admin) : change Server.ownerId et notifie
// l'ancien et le nouveau propriétaire (même notification générique "admin_info" que les
// autres messages du panel, voir lib/notifications.ts — pas de type dédié, le cas est rare).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/servers/[id]/transfer">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const targetId = String(form.get("targetId") ?? "").trim();
  if (!targetId) return NextResponse.json({ error: "Choisissez un joueur." }, { status: 400 });

  const server = await db.orm.public.Server.select("id", "slug", "name", "ownerId")
    .include("owner", (o) => o.select("name", "minecraftUuid"))
    .where({ id })
    .first();
  if (!server) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });
  if (targetId === server.ownerId) return NextResponse.json({ error: "Ce joueur est déjà propriétaire." }, { status: 400 });

  const target = await db.orm.public.User.select("id", "name", "minecraftUuid").where({ id: targetId }).first();
  if (!target) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  await db.orm.public.Server.where({ id }).update({ ownerId: target.id });

  if (server.owner?.minecraftUuid) {
    await createNotification({
      recipientMinecraftUuid: server.owner.minecraftUuid,
      type: "admin_info",
      serverName: server.name,
      message: `La propriété de ce serveur a été transférée à ${target.name}.`,
    });
  }
  if (target.minecraftUuid) {
    await createNotification({
      recipientMinecraftUuid: target.minecraftUuid,
      type: "admin_info",
      serverName: server.name,
      message: `Tu es désormais propriétaire de ce serveur.`,
    });
  }

  refreshServersCache();
  return backToServers(request, `/admin/servers/${server.slug}`);
}
