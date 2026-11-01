import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherProfile } from "@/lib/launcherAuth";
import { proofFromRequest, visibleServerIdBySlug } from "@/lib/public-servers";
import { createInstallProblem, recentDuplicate, INSTALL_PROBLEM_KINDS, type InstallProblemKind } from "@/lib/installProblems";
import { rateLimitResponse } from "@/lib/rateLimit";

// « Prévenir le serveur » (design du launcher, 17/10, point 6) : le joueur envoie, apres avoir vu
// ce qui part, un rapport d'echec au proprietaire. Meme secret partage et meme preuve d'acces
// (serveur prive) que le signalement classique. Jamais d'e-mail ni de compte Microsoft : seulement
// l'UUID Minecraft verifie (pour compter les joueurs touches), le type d'erreur, une phrase, les
// versions et la fin du journal.
const clip = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.replace(/\u0000/g, "").trim() : "";
  return s ? s.slice(0, max) : null;
};

export async function POST(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/install-problem">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "install-problem", 5);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const serverId = await visibleServerIdBySlug(slug, proofFromRequest(request));
  if (!serverId) return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const reporterMinecraftUuid = String(body.reporterMinecraftUuid ?? "").trim().slice(0, 100);
  const kind: InstallProblemKind = INSTALL_PROBLEM_KINDS.includes(body.kind) ? body.kind : "other";
  const summary = clip(body.summary, 200);
  if (!reporterMinecraftUuid || !summary) {
    return NextResponse.json({ error: "Champs manquants ou invalides" }, { status: 400 });
  }
  const { check: identity } = await verifyLauncherProfile(request, reporterMinecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  if (!(await recentDuplicate(serverId, reporterMinecraftUuid, summary))) {
    await createInstallProblem({
      serverId,
      reporterMinecraftUuid,
      kind,
      summary,
      detail: clip(body.detail, 1000),
      launcherVersion: clip(body.launcherVersion, 50),
      minecraftVersion: clip(body.minecraftVersion, 50),
      logTail: clip(body.logTail, 20_000),
    });
  }
  return NextResponse.json({ ok: true });
}
