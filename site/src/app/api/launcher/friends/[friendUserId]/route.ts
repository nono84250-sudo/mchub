import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { removeFriend } from "@/lib/friends";

// Retrait d'un ami (bouton "Retirer" du panneau "Amis" du launcher) — par L'UN OU L'AUTRE,
// retire l'amitié des deux côtés (pas de statut "qui a supprimé qui", scope phase 1). Idempotent :
// retirer un ami déjà absent ne renvoie pas d'erreur.
export async function DELETE(request: Request, ctx: RouteContext<"/api/launcher/friends/[friendUserId]">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-friends-write", 10);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const minecraftUuid = typeof body.minecraftUuid === "string" ? body.minecraftUuid : null;
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyLauncherIdentity(request, minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  const { friendUserId } = await ctx.params;

  // Pas de findOrCreateUserByMinecraft (juste une suppression) : sans ligne "user" existante,
  // il ne peut de toute façon exister aucune amitié à retirer.
  const user = await db.orm.public.User.select("id").where({ minecraftUuid }).first();
  if (user) await removeFriend(user.id, friendUserId);

  return NextResponse.json({ ok: true });
}
