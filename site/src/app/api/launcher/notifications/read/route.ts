import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyMinecraftIdentity } from "@/lib/launcherAuth";
import { markNotificationsRead } from "@/lib/notifications";
import { rateLimitResponse } from "@/lib/rateLimit";

// Appelee quand le joueur ouvre le panneau de notifications dans le launcher :
// marque tout comme lu pour ce compte, pour que le badge disparaisse.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-notif-read", 60);
  if (limited) return limited;

  const body = await request.json();
  const minecraftUuid = String(body.minecraftUuid ?? "").trim();
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyMinecraftIdentity(request.headers.get("x-minecraft-token"), minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  await markNotificationsRead(minecraftUuid);
  return NextResponse.json({ ok: true });
}
