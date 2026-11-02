import { NextResponse } from "next/server";
import { withD1Busy } from "@/lib/d1Busy";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { requireLauncherFeature } from "@/lib/features";
import { BUG_EVENTS, recordBugEvent, type BugEvent } from "@/lib/bugCatalog";

// Catalogue de bugs : +1 sur un compteur du jour (fiche reconnue, réparée, réparation refusée).
// Aucune donnée de joueur : seulement la fiche et le jour.
async function handlePOST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const limited = rateLimitResponse(request, "launcher-bugs-stat", 30);
  if (limited) return limited;
  const off = await requireLauncherFeature(request, "bugCatalog");
  if (off) return off;
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.slice(0, 80) : "";
  if (!slug || !BUG_EVENTS.includes(body?.event)) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  return NextResponse.json({ ok: await recordBugEvent(slug, body.event as BugEvent) });
}

export const POST = withD1Busy(handlePOST);
