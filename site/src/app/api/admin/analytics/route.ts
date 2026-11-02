import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminSession";
import { getAnalyticsSnapshot } from "@/lib/analytics";
import { withD1Busy } from "@/lib/d1Busy";
import { featureState } from "@/lib/features";

// Panel Analytique (/admin/analytique, 31/10) : les chiffres de la page, relus toutes les 30 s tant
// qu'elle est ouverte et visible. Lecture seule pour l'admin, donc pas de contrôle d'origine (un GET
// n'envoie pas d'en-tête Origin).
export const GET = withD1Busy(async () => {
  const admin = await getCurrentAdmin();
  if (!admin || admin.mustChangeCredentials) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  if ((await featureState("analytics")) === "hidden") return NextResponse.json({ error: "Fonctionnalité indisponible.", code: "feature_off" }, { status: 404 });
  return NextResponse.json(await getAnalyticsSnapshot(), { headers: { "Cache-Control": "no-store" } });
});
