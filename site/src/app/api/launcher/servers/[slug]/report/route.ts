import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { proofFromRequest, visibleServerIdBySlug } from "@/lib/public-servers";
import { createReport, createBehaviorReport, type ReportIssue, type BehaviorIssue } from "@/lib/reports";
import { rateLimitResponse } from "@/lib/rateLimit";

const VALID_ISSUES: ReportIssue[] = ["cant_connect", "wrong_version", "modpack_download", "crash", "other"];
const VALID_BEHAVIOR_ISSUES: BehaviorIssue[] = ["stolen_server", "stolen_content", "impersonating", "inappropriate_content", "scam_phishing", "other"];

// proofUrl finit en href cliquable dans /admin/reports (voir admin/design/bind.ts) : sans ce
// controle de schema, un joueur pouvait soumettre "javascript:..." et executer du code dans le
// contexte authentifie du panel des qu'un moderateur clique sur le lien (XSS stocke critique,
// trouve par l'audit du 2026-10-10 — escapeHtml() n'echappe pas le schema d'une URL).
function safeProofUrl(raw: unknown): string | null {
  const url = typeof raw === "string" ? raw.trim().slice(0, 300) : "";
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// Recoit le signalement du dialogue de report cote launcher (voir renderer.js) — meme secret
// partage que les autres routes launcher. Deux categories (voir "03b/03c Report a server" dans
// Design/Omniscient Launcher UI Mockups.dc.html) : "technical" part chez le proprietaire,
// "behavior" part aux moderateurs Omniscient (jamais vu par le proprietaire, voir lib/reports.ts).
export async function POST(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/report">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Un signalement écrit en base : au plus 10 par minute et par adresse.
  const limited = rateLimitResponse(request, "report", 10);
  if (limited) return limited;

  const { slug } = await ctx.params;
  // Serveur prive : meme preuve que la fiche (code d'invitation ou jeton du proprietaire).
  const serverId = await visibleServerIdBySlug(slug, proofFromRequest(request));
  if (!serverId) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const reporterMinecraftUuid = String(body.reporterMinecraftUuid ?? "").trim().slice(0, 100);
  const reporterMinecraftUsername = String(body.reporterMinecraftUsername ?? "").trim().slice(0, 100);
  const message = String(body.message ?? "").trim().slice(0, 2000);
  const category = body.category === "behavior" ? "behavior" : "technical";

  if (!reporterMinecraftUuid || !reporterMinecraftUsername || !message) {
    return NextResponse.json({ error: "Champs manquants ou invalides" }, { status: 400 });
  }
  const identity = await verifyLauncherIdentity(request, reporterMinecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  if (category === "behavior") {
    const behaviorIssue = VALID_BEHAVIOR_ISSUES.includes(body.behaviorIssue) ? (body.behaviorIssue as BehaviorIssue) : null;
    if (!behaviorIssue) return NextResponse.json({ error: "Champs manquants ou invalides" }, { status: 400 });
    await createBehaviorReport({
      serverId,
      reporterMinecraftUuid,
      reporterMinecraftUsername,
      behaviorIssue,
      message,
      proofUrl: safeProofUrl(body.proofUrl),
    });
    return NextResponse.json({ ok: true });
  }

  const issue = VALID_ISSUES.includes(body.issue) ? (body.issue as ReportIssue) : null;
  if (!issue) return NextResponse.json({ error: "Champs manquants ou invalides" }, { status: 400 });

  await createReport({
    serverId,
    reporterMinecraftUuid,
    reporterMinecraftUsername,
    issue,
    message,
    clientVersion: body.clientVersion ? String(body.clientVersion).slice(0, 100) : null,
    launcherVersion: body.launcherVersion ? String(body.launcherVersion).slice(0, 100) : null,
  });

  return NextResponse.json({ ok: true });
}
