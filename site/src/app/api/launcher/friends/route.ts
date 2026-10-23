import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, normalizeMinecraftUuid, verifyLauncherIdentity, verifyLauncherProfile } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db, withD1Busy } from "@/lib/db";
import { findOrCreateUserByMinecraft } from "@/lib/users";
import { listFriendsOverview, sendFriendRequest } from "@/lib/friends";
import { checkRateLimit } from "@/lib/rateLimit";

// Liste d'amis + statut en ligne/hors ligne, plus les demandes reçues et envoyées (page "Amis"
// du launcher). Le statut en ligne n'est renvoyé que pour les amis acceptés (voir
// lib/friends.ts) — même contrôle d'identité que /api/launcher/servers/mine : n'importe quel
// joueur identifié peut lire SA PROPRE liste, jamais celle d'un autre (minecraftUuid vérifié
// par verifyLauncherIdentity, pas juste cru sur parole).
export const GET = withD1Busy(async (request: Request) => {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-friends", 60);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const minecraftUuid = searchParams.get("minecraftUuid");
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyLauncherIdentity(request, minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  // Pas de findOrCreateUserByMinecraft ici (lecture seule) : un joueur qui n'a encore jamais de
  // ligne "user" n'a par construction aucun ami à lister.
  const user = await db.orm.public.User.select("id").where({ minecraftUuid: normalizeMinecraftUuid(minecraftUuid) }).first();
  // "friends" garde sa forme d'avant (amis acceptés uniquement) : un ancien launcher qui ne lit
  // que ce champ continue de marcher, il ne voit simplement pas les demandes.
  const overview = user ? await listFriendsOverview(user.id) : { friends: [], incoming: [], outgoing: [] };
  return NextResponse.json(overview);
});

// Demande d'ami par pseudo Minecraft — l'autre joueur doit l'accepter (voir
// /api/launcher/friends/[friendUserId], POST). Réponse TOUJOURS identique que le pseudo existe
// déjà en ami, existe mais pas en ami, ou n'existe pas du tout : anti-énumération (voir
// sendFriendRequest dans lib/friends.ts).
export const POST = withD1Busy(async (request: Request) => {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Écrit en base, rarement utilisé : même palier que launcher-watch-write.
  const limited = rateLimitResponse(request, "launcher-friends-write", 10);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const minecraftUuid = typeof body.minecraftUuid === "string" ? body.minecraftUuid : null;
  // `query` (18/10) : pseudo OU code d'ami ; `targetUsername` garde pour l'ancien launcher.
  const targetUsername =
    typeof body.query === "string" ? body.query.trim() : typeof body.targetUsername === "string" ? body.targetUsername.trim() : "";
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  // Pseudo pris dans le profil verifie, jamais dans le corps (body.minecraftUsername ignore).
  const { check: identity, name } = await verifyLauncherProfile(request, minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  // Un pseudo vide est une erreur de saisie, pas une tentative d'énumération (ne révèle rien
  // sur l'existence d'un compte) : seul cas où la réponse peut légitimement différer.
  if (!targetUsername) {
    return NextResponse.json({ error: "Pseudo manquant" }, { status: 400 });
  }

  // Action volontaire du joueur : recree son compte s'il l'avait supprime.
  const user = await findOrCreateUserByMinecraft(minecraftUuid, name, { explicit: true });
  // 20 demandes par heure et par compte (meme palier que le site) : au-dela, meme reponse, rien n'est envoye.
  if (user && !checkRateLimit(`friends-write-hour:${user.id}`, 20, 60 * 60_000).limited) await sendFriendRequest(user.id, targetUsername);

  return NextResponse.json({ ok: true });
});
