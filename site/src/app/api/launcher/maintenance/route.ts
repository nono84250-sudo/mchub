import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { getLauncherMaintenance, getLauncherStatus } from "@/lib/platformSettings";
import { rateLimitResponse } from "@/lib/rateLimit";

// Statut de la maintenance, lu par le launcher (au demarrage et depuis le pop-up d'une
// notification "maintenance"). Ne renvoie jamais le code : voir POST ci-dessous pour ca.
export async function GET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-maintenance-status", 10);
  if (limited) return limited;
  // Lecture en cache (idee 2 du lancement, 19/10) : le launcher non connecte interroge cette
  // route toutes les 2 minutes, le meme etat pour tout le monde.
  const { maintenance } = await getLauncherStatus();
  return NextResponse.json({
    active: maintenance.active,
    message: maintenance.message,
  });
}

// Verification du code tape dans l'ecran de maintenance. Comparaison simple (pas de
// timingSafeEqual) : un code a 6 caracteres communique par l'admin lui-meme n'est pas un
// secret de la meme sensibilite qu'un jeton d'API, et il change a chaque activation. Frein
// resserre (5/min) : c'est une route de verification de code, donc une cible de force brute.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-maintenance-verify", 5);
  if (limited) return limited;
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = String(body?.code ?? "").trim().toUpperCase();
  const maintenance = await getLauncherMaintenance();
  const ok = !!maintenance?.active && code.length > 0 && code === maintenance.code;
  return NextResponse.json({ ok });
}
