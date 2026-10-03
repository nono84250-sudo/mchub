import { NextResponse } from "next/server";
import { createLauncherSession, identityErrorResponse, isAuthorizedLauncherRequest, normalizeMinecraftUuid, verifyMinecraftIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";

// Echange le jeton Mojang du joueur (X-Minecraft-Token, verifie aupres de Mojang)
// contre un jeton de session signe de 24 h (X-Launcher-Session sur les autres
// routes). Voir createLauncherSession dans lib/launcherAuth.ts.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-session", 30);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const minecraftUuid = String(body?.minecraftUuid ?? "").trim();
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyMinecraftIdentity(request.headers.get("x-minecraft-token"), minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  const session = createLauncherSession(normalizeMinecraftUuid(minecraftUuid));
  if (!session) {
    return NextResponse.json({ error: "Sessions launcher non configurées sur le serveur" }, { status: 503 });
  }
  return NextResponse.json(session);
}
