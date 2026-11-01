import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withD1Busy } from "@/lib/d1Busy";
import { findCloudVersion, findCloudWorld } from "@/lib/playWorlds";
import { rateLimitResponse } from "@/lib/rateLimit";
import { presignDownload } from "@/lib/worldStorage";
import { featureVisibleOnSite } from "@/lib/features";

// « Télécharger (.zip) » de la page Mes mondes : renvoie vers un lien signé R2 valable 1 h, pour
// le joueur connecté sur le site et seulement pour SES versions. Le fichier ne passe pas par le
// site (limite de 4,5 Mo par réponse sur Vercel).
export const GET = withD1Busy(async (request: Request) => {
  const limited = rateLimitResponse(request, "me-worlds-download", 30);
  if (limited) return limited;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", request.url), 303);
  if (!(await featureVisibleOnSite("worlds"))) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const versionId = new URL(request.url).searchParams.get("v") ?? "";
  const version = await findCloudVersion(session.user.id, versionId);
  if (!version) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const world = await findCloudWorld(session.user.id, { id: version.worldId });
  const day = String(version.createdAt).slice(0, 16).replace(/[T:]/g, "-");
  return NextResponse.redirect(presignDownload(version.objectKey, `${world?.name ?? "monde"} ${day}.zip`), 303);
});
