import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";
import { createNotification } from "@/lib/notifications";
import { forgetAccountAuthState } from "@/lib/launcherAuth";

// Verrouille un compte joueur (boutons "Freeze account" / "Lock account" de la fiche —
// meme mecanisme pour les deux, voir bind.ts : seuls le libelle et le motif par defaut
// changent dans la pop-up). Distinct du gel d'UN serveur (server.frozenAt) : ici c'est
// le compte entier qui ne peut plus s'authentifier dans le launcher, voir le controle
// ajoute dans lib/launcherAuth.ts (sessionIdentity, lookupMojangProfile) et dans la
// route d'echange de session /api/launcher/session.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/players/[id]/lock">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  if (reason.length < 3) return NextResponse.json({ error: "Indiquez un motif (3 caractères minimum)." }, { status: 400 });

  const player = await db.orm.public.User.select("id", "minecraftUuid").where({ id }).first();
  if (!player) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  await db.orm.public.User.where({ id }).update({ lockedAt: new Date().toISOString(), lockedReason: reason, lockedBy: admin.username });
  if (player.minecraftUuid) {
    forgetAccountAuthState(player.minecraftUuid);
    await createNotification({ recipientMinecraftUuid: player.minecraftUuid, type: "admin_error", serverName: "—", message: `Compte verrouillé : ${reason}` });
  }
  return NextResponse.redirect(new URL(`/admin/players/${id}`, request.url), 303);
}
