import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { deleteReadNotifications } from "@/lib/notifications";

// Bouton "Effacer les lues" du panneau : supprime toutes les notifications
// deja lues pour ce joueur.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const minecraftUuid = String(body.minecraftUuid ?? "").trim();
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }

  await deleteReadNotifications(minecraftUuid);
  return NextResponse.json({ ok: true });
}
