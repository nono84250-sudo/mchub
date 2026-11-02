import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { withLauncherFeature } from "@/lib/features";
import { omniArchiveLinks, testArchiveLinks } from "@/lib/omniPacks";

// Pack Omniscient publié (27/10) : liens signés (1 h) vers les morceaux de son archive .omnipack.
// Le launcher les télécharge à la suite, vérifie l'empreinte SHA-256, puis installe la version
// choisie. 404 tant que « Pack Omniscient » est caché pour ce joueur (Laboratoire), ou si le pack
// n'a aucune version publiée.
export const GET = withD1Busy(withLauncherFeature("omniPack", async (request: Request) => {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const limited = rateLimitResponse(request, "launcher-omnipack", 20);
  if (limited) return limited;
  // « Tester dans le launcher » (31/10) : jeton signé par le site pour UN pack proposé (10 min).
  const testToken = new URL(request.url).searchParams.get("testToken");
  if (testToken) {
    const test = await testArchiveLinks(testToken);
    if (!test) return NextResponse.json({ error: "Lien de test expiré ou pack introuvable." }, { status: 404 });
    return NextResponse.json(test, { headers: { "Cache-Control": "private, no-store" } });
  }
  const packId = new URL(request.url).searchParams.get("packId") ?? "";
  if (!/^[\w-]{8,64}$/.test(packId)) return NextResponse.json({ error: "packId invalide" }, { status: 400 });
  const links = await omniArchiveLinks(packId);
  if (!links) return NextResponse.json({ error: "Pack introuvable" }, { status: 404 });
  return NextResponse.json(links, { headers: { "Cache-Control": "private, no-store" } });
}));
