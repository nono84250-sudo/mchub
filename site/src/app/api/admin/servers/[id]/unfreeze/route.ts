import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { createNotification } from "@/lib/notifications";
import { resolveServerAppeal } from "@/lib/appeals";

// Dégel : le serveur revient dans l'annuaire et le launcher peut à nouveau le lancer.
// Si la case « envoyer un message au propriétaire » est cochée, il est prévenu (message bleu-violet
// de l'équipe dans la cloche du launcher).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/servers/[id]/unfreeze">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const server = await db.orm.public.Server.select("id", "slug", "name", "appealStatus")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ id })
    .first();
  if (!server) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });
  await db.orm.public.Server.where({ id }).update({ frozenAt: null, frozenReason: null, frozenBy: null, published: true });
  // "Annuler le gel" (fiche serveur admin) appelle cette même route : clôt le recours en cours
  // avec son propre texte d'historique, plutôt que de laisser appealStatus bloqué sur "pending"
  // pour un serveur qui n'est même plus gelé (voir lib/appeals.ts).
  if (server.appealStatus === "pending") {
    await resolveServerAppeal(id, "cancelled", admin.username);
  }
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
