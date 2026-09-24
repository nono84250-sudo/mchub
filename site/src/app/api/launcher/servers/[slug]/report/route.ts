import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { db } from "@/prisma/db";
import { createReport, type ReportIssue } from "@/lib/reports";

const VALID_ISSUES: ReportIssue[] = ["cant_connect", "wrong_version", "modpack_download", "crash", "other"];

// Recoit le signalement "Probleme technique" du dialogue de report cote
// launcher (voir renderer.js) — meme secret partage que les autres routes
// launcher. La categorie "Comportement/contenu" de la maquette n'existe pas
// ici (voir le commentaire sur le modele Report dans contract.prisma).
export async function POST(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/report">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  const server = await db.orm.public.Server.select("id").where({ slug }).first();
  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }

  const body = await request.json();
  const reporterMinecraftUuid = String(body.reporterMinecraftUuid ?? "").trim();
  const reporterMinecraftUsername = String(body.reporterMinecraftUsername ?? "").trim();
  const message = String(body.message ?? "").trim();
  const issue = VALID_ISSUES.includes(body.issue) ? (body.issue as ReportIssue) : null;

  if (!reporterMinecraftUuid || !reporterMinecraftUsername || !message || !issue) {
    return NextResponse.json({ error: "Champs manquants ou invalides" }, { status: 400 });
  }

  await createReport({
    serverId: server.id,
    reporterMinecraftUuid,
    reporterMinecraftUsername,
    issue,
    message,
    clientVersion: body.clientVersion ? String(body.clientVersion) : null,
    launcherVersion: body.launcherVersion ? String(body.launcherVersion) : null,
  });

  return NextResponse.json({ ok: true });
}
