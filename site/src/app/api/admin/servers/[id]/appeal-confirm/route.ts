import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { resolveServerAppeal } from "@/lib/appeals";
import { createNotification } from "@/lib/notifications";

// "Confirmer le gel" après un recours (voir lib/appeals.ts) : le gel reste en place, seule la
// demande de recours est tranchée — contrairement à "Annuler le gel", qui réutilise la route
// unfreeze existante (voir ce fichier), celle-ci ne touche à aucune des colonnes frozen*.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/servers/[id]/appeal-confirm">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const server = await db.orm.public.Server.select("id", "slug", "name", "appealStatus")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ id })
    .first();
  if (!server) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });
  if (server.appealStatus !== "pending") return NextResponse.json({ error: "Aucun recours en attente pour ce serveur." }, { status: 400 });

  await resolveServerAppeal(id, "confirmed", admin.username);
  if (server.owner?.minecraftUuid) {
    await createNotification({
      recipientMinecraftUuid: server.owner.minecraftUuid,
      type: "admin_info",
      serverName: server.name,
      message: "Le gel de votre serveur a été réexaminé et est maintenu.",
    });
  }
  refreshServersCache();
  return backToServers(request, `/admin/servers/${server.slug}`);
}
