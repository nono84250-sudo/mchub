import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { listServersOwnedByMinecraftUuid } from "@/lib/public-servers";
import { teamsPublic, withoutTeam } from "@/lib/features";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { scheduleStatusRefresh } from "@/lib/server-status";

// Alimente la vue "Mes instances" du launcher : tous les serveurs du joueur
// actuellement connecte (publies ou en pause), retrouves via son UUID Minecraft
// (le compte site est cree par la connexion Microsoft). Le launcher passe son
// propre profil Minecraft/Xbox deja connu — cette route ne fait que le mapper
// au compte site correspondant.
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-mine", 60);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const minecraftUuid = searchParams.get("minecraftUuid");
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyLauncherIdentity(request, minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  const owned = await listServersOwnedByMinecraftUuid(minecraftUuid);
  // 25/10 : « Mes instances » ne re-mesurait jamais les serveurs : un serveur prive restait
  // « Inconnu » dans le launcher. Re-mesure apres la reponse (chiffre visible a l'appel suivant).
  scheduleStatusRefresh(owned);
  const servers = owned.map((server) => {
    const { lastPingedAt, ...rest } = server;
    void lastPingedAt;
    return rest;
  });
  return NextResponse.json({ servers: (await teamsPublic()) ? servers : servers.map(withoutTeam) });
}

export const GET = withD1Busy(handleGET);
