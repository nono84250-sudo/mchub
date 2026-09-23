import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { listServersOwnedByMinecraftUuid } from "@/lib/public-servers";

// Alimente la vue "Mes instances" du launcher : tous les serveurs du joueur
// actuellement connecte (publies ou en pause), retrouves via son compte
// Minecraft lie (voir /account et POST /api/launcher/minecraft-link). Le
// launcher passe son propre profil Minecraft/Xbox deja connu — cette route
// ne fait que le mapper au compte site correspondant.
export async function GET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const minecraftUuid = searchParams.get("minecraftUuid");
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }

  const servers = await listServersOwnedByMinecraftUuid(minecraftUuid);
  return NextResponse.json({ servers });
}
