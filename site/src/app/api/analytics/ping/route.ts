import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { recordSitePing } from "@/lib/analytics";
import { featureState, featureVisibleOnSite } from "@/lib/features";
import { rateLimitResponse } from "@/lib/rateLimit";

// Signal du site pour le panel Analytique (31/10), voir components/SiteAnalyticsPing.tsx et
// lib/analytics.ts. Rien n'est gardé de la requête en dehors de l'identifiant au hasard et du compte
// connecté : ni IP (la limite de débit la garde seulement en mémoire, comme partout sur le site), ni
// navigateur, ni page. Le compte vient du cookie de session, jamais du corps de la requête.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BODY_CHARS = 200;
const OFF = () => NextResponse.json({ error: "Fonctionnalité indisponible.", code: "feature_off" }, { status: 404 });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });

  // « Test » et « Bêta testeurs » : seulement les comptes testeurs. Les autres n'envoient déjà rien
  // (voir app/layout.tsx), le contrôle ici refuse ce qui arriverait quand même.
  const state = await featureState("analytics");
  if (state === "hidden") return OFF();
  if (state !== "all" && state !== "beta" && !(await featureVisibleOnSite("analytics"))) return OFF();

  const limited = rateLimitResponse(request, "analytics-ping", 60);
  if (limited) return limited;

  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_CHARS) return NextResponse.json({ error: "Requête trop longue." }, { status: 413 });
  let visitorId: unknown;
  try {
    visitorId = JSON.parse(text)?.visitorId;
  } catch {
    visitorId = null;
  }
  if (typeof visitorId !== "string" || !UUID.test(visitorId)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });

  // Lecture du jeton seul, sans auth() : auth() relit le verrou du compte dans la base à chaque appel,
  // soit un appel par visiteur connecté et par minute, pour un simple total.
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie: new URL(request.url).protocol === "https:" }).catch(() => null);
  const userId = typeof token?.id === "string" ? token.id : null;

  // Une mesure en panne ne doit jamais gêner le visiteur.
  await recordSitePing(visitorId, userId).catch((error) => console.error("[analytics] signal non enregistré", error));
  return new NextResponse(null, { status: 204 });
}
