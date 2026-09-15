import { NextResponse } from "next/server";
import { listPublicServers } from "@/lib/public-servers";

// API publique en lecture, consommée par le launcher (application Electron,
// Phase 3) : le site reste l'unique source de vérité, l'app ne fait
// qu'afficher ce que renvoie cette route. Ne contient jamais l'IP des
// serveurs (voir lib/public-servers.ts). CORS ouvert : ces données sont
// délibérément publiques, aucune donnée sensible n'y est exposée.
export const revalidate = 60;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

export async function GET() {
  const servers = await listPublicServers();
  return NextResponse.json({ servers }, { headers: CORS_HEADERS });
}
