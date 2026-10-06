import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";

// Retire ou remet un serveur dans l'annuaire, sans le supprimer (interrupteur « published »).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/servers/[id]/visibility">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const server = await db.orm.public.Server.select("id", "slug", "published", "frozenAt").where({ id }).first();
  if (!server) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });
  if (server.frozenAt) return NextResponse.json({ error: "Serveur gelé : dégelez-le d'abord." }, { status: 400 });
  await db.orm.public.Server.where({ id }).update({ published: !server.published });
  refreshServersCache();
  return backToServers(request, `/admin/servers/${server.slug}`);
}
