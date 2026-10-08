import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { getLauncherMaintenance } from "@/lib/platformSettings";

// Statut de la maintenance, lu par le launcher (au demarrage et depuis le pop-up d'une
// notification "maintenance"). Ne renvoie jamais le code : voir POST ci-dessous pour ca.
export async function GET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const maintenance = await getLauncherMaintenance();
  return NextResponse.json({
    active: maintenance?.active ?? false,
    message: maintenance?.message ?? null,
  });
}

// Verification du code tape dans l'ecran de maintenance. Comparaison simple (pas de
// timingSafeEqual) : un code a 6 caracteres communique par l'admin lui-meme n'est pas un
// secret de la meme sensibilite qu'un jeton d'API, et il change a chaque activation.
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = String(body?.code ?? "").trim().toUpperCase();
  const maintenance = await getLauncherMaintenance();
  const ok = !!maintenance?.active && code.length > 0 && code === maintenance.code;
  return NextResponse.json({ ok });
}
