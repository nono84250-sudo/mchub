import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { isVisibleRow, limitInviteAttempts, proofFromRequest } from "@/lib/public-servers";
import { requireLauncherFeature } from "@/lib/features";
import { countInstall, launcherInstallPayload, publicPackInfo, serverCloudPackRow } from "@/lib/cloudPacks";
import { withD1Busy } from "@/lib/d1Busy";

// Mon cloud (03/11) : modpack relié à un serveur par son propriétaire.
//   GET /api/launcher/cloud-pack?slug=<serveur>            → { pack } (fiche du serveur dans le launcher,
//        et savoir s'il est « Obligatoire pour rejoindre ») ; { pack: null } s'il n'y en a pas, ou si
//        l'interrupteur du Laboratoire est caché pour ce joueur (le serveur se lance alors comme avant).
//   GET /api/launcher/cloud-pack?slug=<serveur>&install=1  → ce que le launcher installe (liens Modrinth
//        + lien signé des configs) ; &first=1 = première installation chez ce joueur (compteur).
// Rangé ici plutôt que sous servers/[slug]/ : un chemin moins profond (copie vers le dossier local).
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const limited = rateLimitResponse(request, "launcher-cloud-pack", 120) ?? limitInviteAttempts(request);
  if (limited) return limited;
  const url = new URL(request.url);
  const install = url.searchParams.get("install") === "1";
  const off = await requireLauncherFeature(request, "cloudPacks");
  if (off) return install ? off : NextResponse.json({ pack: null });
  const slug = url.searchParams.get("slug") ?? "";
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(slug)) return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  const server = await db.orm.public.Server.select("id", "published", "verificationStatus", "isPrivate", "inviteCode")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug })
    .first();
  if (!server || !(await isVisibleRow(server, proofFromRequest(request)))) return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  const row = await serverCloudPackRow(server.id).catch(() => null);
  if (!install) return NextResponse.json({ pack: row ? publicPackInfo(row) : null });
  if (!row) return NextResponse.json({ error: "Ce serveur n'a pas de modpack relié." }, { status: 404 });
  if (url.searchParams.get("first") === "1") await countInstall(row.id);
  return NextResponse.json(launcherInstallPayload(row));
}

export const GET = withD1Busy(handleGET);
