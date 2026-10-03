import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest, LAUNCHER_SESSION_HEADER, revokeLauncherSessions, sessionIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";

// Deconnexion du launcher : tous les jetons de session emis avant maintenant
// pour ce joueur sont refuses (User.sessionsValidAfter). Authentifiee par un
// jeton de session VALIDE (pas par le jeton Mojang) : seul le launcher qui
// detient la session peut la revoquer.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-session-revoke", 30);
  if (limited) return limited;

  const uuid = await sessionIdentity(request.headers.get(LAUNCHER_SESSION_HEADER) ?? "");
  if (!uuid) {
    return NextResponse.json({ error: "Identité non vérifiée" }, { status: 401 });
  }
  await revokeLauncherSessions(uuid);
  return NextResponse.json({ ok: true });
}
