import { NextResponse } from "next/server";
import { withD1Busy } from "@/lib/d1Busy";
import { playLauncherUser } from "@/lib/playLauncher";
import { clearRestore } from "@/lib/playWorlds";

// Le launcher a appliqué la restauration demandée sur le site (bouton « Restaurer » de Mes mondes).
export const POST = withD1Busy(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const auth = await playLauncherUser(request, typeof body.minecraftUuid === "string" ? body.minecraftUuid : null, { bucket: "launcher-worlds-write", limit: 20 });
  if ("response" in auth) return auth.response;
  if (typeof body.worldKey !== "string") return NextResponse.json({ error: "worldKey manquant" }, { status: 400 });
  await clearRestore(auth.userId, body.worldKey);
  return NextResponse.json({ ok: true });
});
