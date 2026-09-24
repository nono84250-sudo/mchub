import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { markNotificationsRead } from "@/lib/notifications";

// Appelee quand le joueur ouvre le panneau de notifications dans le launcher :
// marque tout comme lu pour ce compte, pour que le badge disparaisse.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const minecraftUuid = String(body.minecraftUuid ?? "").trim();
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }

  await markNotificationsRead(minecraftUuid);
  return NextResponse.json({ ok: true });
}
