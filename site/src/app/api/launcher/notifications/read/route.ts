import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { markNotificationsRead } from "@/lib/notifications";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";

// Appelee quand le joueur ouvre le panneau de notifications dans le launcher :
// marque tout comme lu pour ce compte, pour que le badge disparaisse.
async function handlePOST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-notif-read", 60);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) ?? {};
  const minecraftUuid = String(body.minecraftUuid ?? "").trim();
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyLauncherIdentity(request, minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  await markNotificationsRead(minecraftUuid);
  return NextResponse.json({ ok: true });
}

export const POST = withD1Busy(handlePOST);
