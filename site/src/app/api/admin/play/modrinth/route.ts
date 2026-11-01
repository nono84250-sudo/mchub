import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { describeMods, requiredDeps, searchFabricMods } from "@/lib/playPacks";
import { rateLimitResponse } from "@/lib/rateLimit";

// Recherche de mods Modrinth pour « Nouveau pack » (/admin/packs-officiels, 25/10). Le navigateur
// passe par ici plutôt que d'appeler Modrinth lui-même (même User-Agent, pas de CSP à ouvrir).
// Corps JSON : { search, sort? } | { describe: [slug…] } | { deps: slug }.
const SLUG = /^[\w.-]{2,64}$/;

export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const limited = rateLimitResponse(request, "admin-modrinth", 90);
  if (limited) return limited;
  const body = await request.json().catch(() => null);
  try {
    if (typeof body?.search === "string") {
      return NextResponse.json({ mods: await searchFabricMods(body.search, body.sort === "relevance" ? "relevance" : "downloads") });
    }
    if (Array.isArray(body?.describe)) {
      const slugs = body.describe.filter((s: unknown): s is string => typeof s === "string" && SLUG.test(s));
      return NextResponse.json({ mods: await describeMods(slugs) });
    }
    if (typeof body?.deps === "string" && SLUG.test(body.deps)) {
      return NextResponse.json({ deps: await requiredDeps(body.deps) });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modrinth ne répond pas." }, { status: 502 });
  }
  return NextResponse.json({ error: "Requête inconnue." }, { status: 400 });
}
