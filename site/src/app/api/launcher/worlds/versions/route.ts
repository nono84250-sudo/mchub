import { NextResponse } from "next/server";
import { withD1Busy } from "@/lib/d1Busy";
import { playLauncherUser } from "@/lib/playLauncher";
import { findCloudWorld, listCloudWorlds } from "@/lib/playWorlds";

// Versions miroir (25/10) : toutes les versions d'un monde du cloud, pour qu'un autre PC
// retrouve exactement la même liste de sauvegardes que sur le site après « Télécharger ».
// Appelé seulement au téléchargement d'un monde.
export const GET = withD1Busy(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const auth = await playLauncherUser(request, params.get("minecraftUuid"), { bucket: "launcher-worlds", limit: 30 });
  if ("response" in auth) return auth.response;
  const world = await findCloudWorld(auth.userId, { id: params.get("worldId") ?? "" });
  if (!world) return NextResponse.json({ error: "Monde introuvable" }, { status: 404 });
  const full = (await listCloudWorlds(auth.userId)).find((w) => w.id === world.id);
  return NextResponse.json({ worldKey: world.worldKey, name: world.name, headVersionId: full?.headVersionId ?? null, versions: full?.versions ?? [] });
});
