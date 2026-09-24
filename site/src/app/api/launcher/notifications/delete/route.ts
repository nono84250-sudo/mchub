import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { deleteNotification } from "@/lib/notifications";

// Supprime une notification individuelle (croix sur une ligne du panneau) —
// scope par minecraftUuid cote lib pour qu'un joueur ne puisse pas supprimer
// la notification de quelqu'un d'autre en devinant un id.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const minecraftUuid = String(body.minecraftUuid ?? "").trim();
  const id = String(body.id ?? "").trim();
  if (!minecraftUuid || !id) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  await deleteNotification(id, minecraftUuid);
  return NextResponse.json({ ok: true });
}
