import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { findOrCreateUserByMinecraft } from "@/lib/users";
import { addFriendByUsername, listFriends } from "@/lib/friends";

// Liste d'amis + statut en ligne/hors ligne (panneau "Amis" du launcher, nouvelle icône de la
// barre latérale) — même contrôle d'identité que /api/launcher/servers/mine : n'importe quel
// joueur identifié peut lire SA PROPRE liste, jamais celle d'un autre (minecraftUuid vérifié
// par verifyLauncherIdentity, pas juste cru sur parole).
export async function GET(request: Request) {
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
  const user = await db.orm.public.User.select("id").where({ minecraftUuid }).first();
  const friends = user ? await listFriends(user.id) : [];
  return NextResponse.json({ friends });
}

// Ajout d'un ami par pseudo Minecraft — ajout direct et réciproque (pas de demande à
// accepter/refuser, scope phase 1 validé par l'utilisateur). Réponse TOUJOURS identique que le
// pseudo existe déjà en ami, existe mais pas en ami, ou n'existe pas du tout : anti-énumération
// (voir addFriendByUsername dans lib/friends.ts), aucun moyen de déduire si un compte existe en
// testant des pseudos depuis le launcher.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Écrit en base, rarement utilisé : même palier que launcher-watch-write.
  const limited = rateLimitResponse(request, "launcher-friends-write", 10);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const minecraftUuid = typeof body.minecraftUuid === "string" ? body.minecraftUuid : null;
  const minecraftUsername = typeof body.minecraftUsername === "string" ? body.minecraftUsername : null;
  const targetUsername = typeof body.targetUsername === "string" ? body.targetUsername.trim() : "";
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyLauncherIdentity(request, minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  // Un pseudo vide est une erreur de saisie, pas une tentative d'énumération (ne révèle rien
  // sur l'existence d'un compte) : seul cas où la réponse peut légitimement différer.
  if (!targetUsername) {
    return NextResponse.json({ error: "Pseudo manquant" }, { status: 400 });
  }

  const user = await findOrCreateUserByMinecraft(minecraftUuid, minecraftUsername);
  await addFriendByUsername(user.id, targetUsername);

  return NextResponse.json({ ok: true });
}
