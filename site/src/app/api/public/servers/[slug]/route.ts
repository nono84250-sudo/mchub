import { NextResponse } from "next/server";
import { checkSlugVisibility, getCachedVisibleServerBySlug, getPublicServerBySlug, limitInviteAttempts, proofFromRequest } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { jsonWithEtag } from "@/lib/etag";

export const revalidate = 60;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

// Un serveur prive n'est renvoye qu'avec sa preuve (X-Invite-Code, voir
// canSeeServer) : le launcher l'envoie pour les serveurs qu'il a rejoints.
export const GET = withD1Busy(async (request: Request, ctx: RouteContext<"/api/public/servers/[slug]">) => {
  const limited = rateLimitResponse(request, "public-server", 120, { headers: CORS_HEADERS });
  if (limited) return limited;
  const inviteLimited = limitInviteAttempts(request, CORS_HEADERS);
  if (inviteLimited) return inviteLimited;

  const { slug } = await ctx.params;
  const proof = proofFromRequest(request);
  // Cas courant (fiche publique, validee, pas gelee) : servi depuis le cache, 0 appel D1.
  const cached = await getCachedVisibleServerBySlug(slug, proof);
  if (cached) return respond(request, cached);

  // Visibilite d'ABORD (audit §1.4) : cette route n'exige AUCUNE authentification, donc sans
  // ce garde n'importe qui sur Internet pouvait confirmer qu'un serveur privé existe à un slug
  // donné en regardant s'il répond "gelé" plutôt que "introuvable".
  const visibility = await checkSlugVisibility(slug, proof);
  if (!visibility.visible) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404, headers: CORS_HEADERS });
  }
  if (visibility.frozenAt) {
    // Serveur gelé par l'équipe : le launcher l'affiche comme « gelé », pas comme « introuvable ».
    return NextResponse.json({ error: "Serveur gelé", code: "frozen" }, { status: 404, headers: CORS_HEADERS });
  }

  const server = await getPublicServerBySlug(slug, proof);
  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404, headers: CORS_HEADERS });
  }

  return respond(request, server);
});

// 21/10 : « pas de changement » (ETag/304, voir lib/etag.ts) seulement pour une fiche demandee sans
// preuve d'acces (ni code d'invitation, ni session, ni jeton) : une reponse qui depend d'une preuve
// n'est jamais rejouee. Jamais de cache CDN ici (« private, no-store » pour les reponses avec
// preuve) : une fiche retiree par la moderation disparait tout de suite.
function respond(request: Request, server: unknown) {
  const p = proofFromRequest(request);
  if (p.inviteCode || p.launcherSession || p.minecraftToken) {
    return NextResponse.json({ server }, { headers: { ...CORS_HEADERS, "Cache-Control": "private, no-store" } });
  }
  return jsonWithEtag(request, { server }, CORS_HEADERS);
}
