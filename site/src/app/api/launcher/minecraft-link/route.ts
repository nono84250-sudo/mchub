import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { consumeMinecraftLinkCode } from "@/lib/minecraftLink";

// Appelee par le launcher une fois que le joueur a saisi, dans ses reglages,
// le code affiche sur /account : echange ce code (preuve que CE compte site
// a demande la liaison) contre l'enregistrement du profil Minecraft/Xbox
// deja connu du launcher (sa propre auth MS, jamais le mot de passe du
// site). Protegee par le meme secret partage que le reste des routes
// launcher — l'identite du joueur tient au code, pas a LAUNCHER_API_KEY.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const minecraftUuid = typeof body?.minecraftUuid === "string" ? body.minecraftUuid : "";
  const minecraftUsername = typeof body?.minecraftUsername === "string" ? body.minecraftUsername : "";

  if (!code || !minecraftUuid || !minecraftUsername) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const result = await consumeMinecraftLinkCode(code, minecraftUuid, minecraftUsername);
  if (!result.ok) {
    const status = result.error === "already_linked_elsewhere" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, userName: result.userName });
}
