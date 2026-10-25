import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, normalizeMinecraftUuid, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { FRIEND_PRIVACY_READY, getFriendSettings, isFriendPolicy, setFriendPolicy, setNewFriendCode } from "@/lib/friendPrivacy";
import { withLauncherFeature } from "@/lib/features";

// « Qui peut m'ajouter en ami » pour le launcher (variante C, 18/10) : meme reglage que la page
// Amis et Parametres du site. Meme controle d'identite que /api/launcher/friends : un joueur ne
// lit et ne change QUE son propre reglage (minecraftUuid verifie, jamais cru sur parole).
async function currentUserId(request: Request, minecraftUuid: string | null) {
  if (!minecraftUuid) return { error: NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 }) };
  const identity = await verifyLauncherIdentity(request, minecraftUuid);
  if (identity !== "verified") return { error: identityErrorResponse(identity) };
  const user = await db.orm.public.User.select("id").where({ minecraftUuid: normalizeMinecraftUuid(minecraftUuid) }).first();
  if (!user) return { error: NextResponse.json({ error: "Compte introuvable" }, { status: 404 }) };
  return { userId: user.id as string };
}

// Reponse : { friendPolicy, friendCode } (code affiche « K7Q-9XM » par le launcher).
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!FRIEND_PRIVACY_READY) return NextResponse.json({ error: "Pas encore disponible" }, { status: 503 });
  const limited = rateLimitResponse(request, "launcher-friends", 60);
  if (limited) return limited;

  const me = await currentUserId(request, new URL(request.url).searchParams.get("minecraftUuid"));
  if ("error" in me) return me.error as Response;
  return NextResponse.json(await getFriendSettings(me.userId));
}

// Corps : { minecraftUuid, friendPolicy } ou { minecraftUuid, regenerateCode: true }.
async function handlePATCH(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!FRIEND_PRIVACY_READY) return NextResponse.json({ error: "Pas encore disponible" }, { status: 503 });
  const limited = rateLimitResponse(request, "launcher-friends-write", 10);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const me = await currentUserId(request, typeof body.minecraftUuid === "string" ? body.minecraftUuid : null);
  if ("error" in me) return me.error as Response;

  if (body.regenerateCode === true) {
    await setNewFriendCode(me.userId);
  } else if (isFriendPolicy(body.friendPolicy)) {
    await setFriendPolicy(me.userId, body.friendPolicy);
  } else {
    return NextResponse.json({ error: "friendPolicy ou regenerateCode attendu" }, { status: 400 });
  }
  return NextResponse.json(await getFriendSettings(me.userId));
}

export const GET = withLauncherFeature("friends", handleGET);
export const PATCH = withLauncherFeature("friends", handlePATCH);
