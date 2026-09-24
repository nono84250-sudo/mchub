import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { listNotificationsForRecipient } from "@/lib/notifications";

// Alimente la cloche de notifications du launcher : les alertes personnelles
// (reponse/resolution de signalement) du joueur actuellement connecte, trouve
// par son profil Minecraft/Xbox deja connu du launcher (meme pattern que
// /api/launcher/servers/mine).
export async function GET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const minecraftUuid = searchParams.get("minecraftUuid");
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }

  const notifications = await listNotificationsForRecipient(minecraftUuid);
  return NextResponse.json({ notifications });
}
