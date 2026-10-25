import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherProfile } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { findOrCreateUserByMinecraft } from "@/lib/users";

// Contrôles communs des routes /api/launcher/worlds/* (mode Jouer, 24/10) : clé du launcher,
// limite de débit, puis identité VÉRIFIÉE du joueur (jamais le minecraftUuid cru sur parole,
// comme /api/launcher/friends). Renvoie l'id du compte, ou la réponse d'erreur à renvoyer.
export async function playLauncherUser(
  request: Request,
  minecraftUuid: string | null,
  { bucket, limit }: { bucket: string; limit: number },
): Promise<{ userId: string } | { response: NextResponse }> {
  if (!isAuthorizedLauncherRequest(request)) return { response: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  const limited = rateLimitResponse(request, bucket, limit);
  if (limited) return { response: limited };
  if (!minecraftUuid) return { response: NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 }) };
  const { check, name } = await verifyLauncherProfile(request, minecraftUuid);
  if (check !== "verified") return { response: identityErrorResponse(check) };
  // Action volontaire du joueur (il joue / synchronise) : comme une demande d'ami.
  const user = await findOrCreateUserByMinecraft(minecraftUuid, name, { explicit: true });
  if (!user) return { response: NextResponse.json({ error: "Compte introuvable" }, { status: 404 }) };
  return { userId: user.id };
}
