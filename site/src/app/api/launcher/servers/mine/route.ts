import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { listServersOwnedByMinecraftUuid } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";

// Alimente la vue "Mes instances" du launcher : tous les serveurs du joueur
// actuellement connecte (publies ou en pause), retrouves via son UUID Minecraft
// (le compte site est cree par la connexion Microsoft). Le launcher passe son
// propre profil Minecraft/Xbox deja connu — cette route ne fait que le mapper
// au compte site correspondant.
export async function GET(request: Request) {
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

  const servers = await listServersOwnedByMinecraftUuid(minecraftUuid);
  return NextResponse.json({ servers });
}
