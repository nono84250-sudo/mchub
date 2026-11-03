import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { isVisibleRow, limitInviteAttempts, proofFromRequest } from "@/lib/public-servers";
import { requireLauncherFeature } from "@/lib/features";
import { publicPackInfo, serverCloudPackRow } from "@/lib/cloudPacks";
import { withD1Busy } from "@/lib/d1Busy";

// Mon cloud (03/11) : modpack relié à un serveur par son propriétaire, pour la fiche du serveur dans
// le launcher (« Installer le modpack du serveur ») et pour savoir s'il faut l'installer avant de
// rejoindre (« Obligatoire pour rejoindre »). { pack: null } quand il n'y en a pas, ou quand
// l'interrupteur « Mon cloud : modpacks » du Laboratoire est caché pour ce joueur (rien ne change
// alors pour lui : le serveur se lance comme avant).
async function handleGET(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/cloud-pack">) {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const limited = rateLimitResponse(request, "launcher-cloud-pack", 120) ?? limitInviteAttempts(request);
  if (limited) return limited;
  if (await requireLauncherFeature(request, "cloudPacks")) return NextResponse.json({ pack: null });
  const { slug } = await ctx.params;
  const server = await db.orm.public.Server.select("id", "published", "verificationStatus", "isPrivate", "inviteCode")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug })
    .first();
  if (!server || !(await isVisibleRow(server, proofFromRequest(request)))) return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  const row = await serverCloudPackRow(server.id).catch(() => null);
  return NextResponse.json({ pack: row ? publicPackInfo(row) : null });
}

export const GET = withD1Busy(handleGET);
