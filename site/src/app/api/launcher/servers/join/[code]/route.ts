import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { getSlugByInviteCode } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";

// Resout un code d'invitation vers son slug pour le launcher (voir
// launcher/src/main.js, joinServerByCode) — meme logique que la page
// /join/[code] du site, mais sans identite Minecraft requise : resoudre un
// code est volontairement anonyme (le launcher n'a pas forcement de session
// ouverte quand on clique un lien d'invitation). isAuthorizedLauncherRequest
// suffit (secret partage), comme les autres routes /api/launcher/* qui ne
// lisent pas de donnees propres a un joueur precis.
export async function GET(request: Request, ctx: RouteContext<"/api/launcher/servers/join/[code]">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Meme limite que la page /join/[code] du site (voir audit de securite du
  // 2026-09-28) : cette route resout le meme secret, elle merite le meme frein.
  const limited = rateLimitResponse(request, "launcher-join-code", 20);
  if (limited) return limited;

  const { code } = await ctx.params;
  const slug = await getSlugByInviteCode(code.toUpperCase());
  if (!slug) {
    return NextResponse.json({ error: "Code invalide" }, { status: 404 });
  }

  return NextResponse.json({ slug });
}
