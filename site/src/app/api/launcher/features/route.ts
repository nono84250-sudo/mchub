import { NextResponse } from "next/server";
import { withD1Busy } from "@/lib/d1Busy";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { featuresFor, launcherViewer } from "@/lib/features";

// Laboratoire (25/10) : ce que CE launcher peut montrer. Le site calcule tout (testeur d'après la
// session signée du launcher, canal bêta d'après X-Launcher-Version) ; le launcher se contente de
// cacher ce qui n'est pas visible. Les routes de chaque fonctionnalité refusent de toute façon.
// Réponse : { features: { <id>: { visible, beta } } }. Jamais mise en cache partagée.
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const limited = rateLimitResponse(request, "launcher-features", 30);
  if (limited) return limited;
  const viewer = await launcherViewer(request);
  const all = await featuresFor(viewer);
  const features = Object.fromEntries(Object.entries(all).map(([id, a]) => [id, { visible: a.visible, beta: a.beta }]));
  return NextResponse.json({ features, tester: viewer.tester }, { headers: { "Cache-Control": "private, no-store" } });
}

export const GET = withD1Busy(handleGET);
