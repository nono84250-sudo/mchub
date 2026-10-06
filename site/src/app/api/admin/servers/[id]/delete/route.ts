import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";

// Suppression définitive. Confirmation : le nom du serveur doit être retapé exactement.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/servers/[id]/delete">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const server = await db.orm.public.Server.select("id", "name").where({ id }).first();
  if (!server) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });
  if (String(form.get("confirm") ?? "") !== server.name) {
    return NextResponse.json({ error: "Le nom ne correspond pas : rien n'a été supprimé." }, { status: 400 });
  }
  await db.orm.public.Server.where({ id }).delete();
  refreshServersCache();
  return backToServers(request);
}
