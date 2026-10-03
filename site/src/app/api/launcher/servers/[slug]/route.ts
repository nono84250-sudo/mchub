import { NextResponse } from "next/server";
import { getServerWithIpBySlug, limitInviteAttempts, proofFromRequest } from "@/lib/public-servers";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";

// Route reservee au launcher (jamais au site public) : c'est la SEULE
// route qui renvoie l'IP d'un serveur. Protegee par un secret partage
// (LAUNCHER_API_KEY), connu uniquement du code du launcher — pas par
// l'identite du joueur (le launcher gere sa propre auth Microsoft
// separement). Voir cahier des charges : deterrent, pas garantie absolue
// (un joueur qui a deja rejoint connait ensuite l'IP).
// Serveur prive : l'IP n'est donnee qu'avec une preuve (code d'invitation
// du serveur rejoint, ou jeton Mojang du proprietaire), voir canSeeServer.
export async function GET(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Cette route renvoie l'IP du serveur : frein par adresse, plus un frein renforce
  // quand une preuve (code d'invitation) est presentee.
  const limited = rateLimitResponse(request, "launcher-server-ip", 60) ?? limitInviteAttempts(request);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const server = await getServerWithIpBySlug(slug, proofFromRequest(request));

  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }

  return NextResponse.json({ server });
}
