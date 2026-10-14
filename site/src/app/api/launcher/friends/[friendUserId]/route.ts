import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { acceptFriendRequest, removeFriend } from "@/lib/friends";

// Lit et vérifie l'identité du joueur (même contrôle que /api/launcher/servers/mine) puis
// renvoie l'id de sa ligne "user", ou une réponse d'erreur à renvoyer telle quelle. Pas de
// findOrCreateUserByMinecraft : sans ligne "user" existante, il ne peut exister aucune amitié
// ni demande à accepter ou retirer.
async function currentUserId(request: Request): Promise<{ userId: string | null } | NextResponse> {
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

  const user = await db.orm.public.User.select("id").where({ minecraftUuid }).first();
  return { userId: user?.id ?? null };
}

// Accepter une demande d'ami reçue (bouton "Accepter" de la page "Amis" du launcher). Seul le
// destinataire peut accepter, voir acceptFriendRequest. Idempotent.
export async function POST(request: Request, ctx: RouteContext<"/api/launcher/friends/[friendUserId]">) {
  const current = await currentUserId(request);
  if (current instanceof NextResponse) return current;
  const { friendUserId } = await ctx.params;
  if (current.userId) await acceptFriendRequest(current.userId, friendUserId);
  return NextResponse.json({ ok: true });
}

// Retirer un ami, refuser une demande reçue ou annuler une demande envoyée : la ligne de la
// paire disparaît des deux côtés (voir removeFriend). Idempotent : retirer un ami déjà absent
// ne renvoie pas d'erreur.
export async function DELETE(request: Request, ctx: RouteContext<"/api/launcher/friends/[friendUserId]">) {
  const current = await currentUserId(request);
  if (current instanceof NextResponse) return current;
  const { friendUserId } = await ctx.params;
  if (current.userId) await removeFriend(current.userId, friendUserId);
  return NextResponse.json({ ok: true });
}
