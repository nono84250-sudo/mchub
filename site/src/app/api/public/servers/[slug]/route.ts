import { NextResponse } from "next/server";
import { getPublicServerBySlug, limitInviteAttempts, proofFromRequest } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";

export const revalidate = 60;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

// Un serveur prive n'est renvoye qu'avec sa preuve (X-Invite-Code, voir
// canSeeServer) : le launcher l'envoie pour les serveurs qu'il a rejoints.
export async function GET(request: Request, ctx: RouteContext<"/api/public/servers/[slug]">) {
  const limited = rateLimitResponse(request, "public-server", 120, { headers: CORS_HEADERS });
  if (limited) return limited;
  const inviteLimited = limitInviteAttempts(request, CORS_HEADERS);
  if (inviteLimited) return inviteLimited;

  const { slug } = await ctx.params;
  const server = await getPublicServerBySlug(slug, proofFromRequest(request));

  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json({ server }, { headers: CORS_HEADERS });
}
