import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { createNotification } from "@/lib/notifications";

// Gel : le serveur sort de l'annuaire et le launcher refuse de le lancer. Seul un admin
// peut le dégeler, et le motif est enregistré avec le compte qui a gelé.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/servers/[id]/freeze">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  if (reason.length < 3) return NextResponse.json({ error: "Indiquez un motif (3 caractères minimum)." }, { status: 400 });
  const server = await db.orm.public.Server.select("id", "slug", "name")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ id })
    .first();
  if (!server) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });
  await db.orm.public.Server.where({ id }).update({
    frozenAt: new Date().toISOString(),
    frozenReason: reason,
    frozenBy: admin.username,
    published: false,
  });
  // Notification bleue pour le propriétaire (cloche du launcher), avec le motif.
  if (server.owner?.minecraftUuid) {
    await createNotification({ recipientMinecraftUuid: server.owner.minecraftUuid, type: "server_frozen", serverName: server.name, message: reason });
  }
  refreshServersCache();
  return backToServers(request, `/admin/servers/${server.slug}`);
}
