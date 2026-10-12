import { NextResponse } from "next/server";
import { createLauncherSession, getAccountLock, identityErrorResponse, isAuthorizedLauncherRequest, normalizeMinecraftUuid, verifyMinecraftIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";

// Echange le jeton Mojang du joueur (X-Minecraft-Token, verifie aupres de Mojang)
// contre un jeton de session signe de 15 min (X-Launcher-Session sur les autres
// routes, voir LAUNCHER_SESSION_TTL_MS). Voir createLauncherSession dans lib/launcherAuth.ts.
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
  if (identity !== "verified") {
    // Mojang a bien confirme le jeton, mais le compte est verrouille (fiche joueur, panel
    // admin) : verifyMinecraftIdentity renvoie "refused" dans ce cas aussi (meme traitement
    // que les autres routes launcher), donc on rejoue le controle ici pour donner un motif
    // clair au joueur plutot que le "Identite non verifiee" generique.
    if (identity === "refused") {
      const lock = await getAccountLock(normalizeMinecraftUuid(minecraftUuid));
      if (lock) {
        return NextResponse.json({ error: `Compte verrouillé${lock.lockedReason ? " : " + lock.lockedReason : "."}` }, { status: 403 });
      }
    }
    return identityErrorResponse(identity);
  }

  const session = createLauncherSession(normalizeMinecraftUuid(minecraftUuid));
  if (!session) {
    return NextResponse.json({ error: "Sessions launcher non configurées sur le serveur" }, { status: 503 });
  }
  return NextResponse.json(session);
}
