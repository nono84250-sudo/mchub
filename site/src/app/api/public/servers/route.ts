import { NextResponse } from "next/server";
import { listPublicServers } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";

// API publique en lecture, consommée par le launcher (application Electron,
// Phase 3) : le site reste l'unique source de vérité, l'app ne fait
// qu'afficher ce que renvoie cette route. Ne contient jamais l'IP des
// serveurs (voir lib/public-servers.ts). CORS ouvert : ces données sont
// délibérément publiques, aucune donnée sensible n'y est exposée.
export const revalidate = 60;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

// Seule route "liste" du périmètre public/launcher sans frein (audit §1.10) : alignée sur
// public-server/[slug] (120/min).
export async function GET(request: Request) {
  const limited = rateLimitResponse(request, "public-servers-list", 120, { headers: CORS_HEADERS });
  if (limited) return limited;
  const servers = await listPublicServers();
  return NextResponse.json({ servers }, { headers: CORS_HEADERS });
}
