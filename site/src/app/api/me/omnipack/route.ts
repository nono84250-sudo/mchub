import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { featureVisibleOnSite } from "@/lib/features";
import { cancelSubmission, findSubmission, finishSubmission, startSubmission } from "@/lib/omniPacks";

// « Proposer un pack » (Pack Omniscient, 27/10), appelé par la page du tableau de bord :
//   start  → crée l'envoi (taille et empreinte SHA-256 calculées par le navigateur) ;
//   (les morceaux de 4 Mio passent par /api/me/omnipack/part) ;
//   finish → le site vérifie les morceaux et lit omnipack.json dans l'archive : « En attente » ;
//   cancel → le joueur retire son pack (tant qu'il n'est pas importé).
// Compte connecté seulement, même origine, interrupteur « Pack Omniscient » du Laboratoire.
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export const POST = withD1Busy(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return err("Origine refusée.", 403);
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return err("Connexion requise.", 401);
  if (!(await featureVisibleOnSite("omniPack"))) return err("Fonctionnalité indisponible.", 404);
  const limited = rateLimitResponse(request, "site-omnipack", 30);
  if (limited) return limited;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;

  if (action === "start") {
    const r = await startSubmission(userId, { name: String(body?.name ?? ""), sizeBytes: Number(body?.sizeBytes), sha256: String(body?.sha256 ?? "") });
    return "error" in r ? err(r.error) : NextResponse.json(r);
  }
  const s = await findSubmission(String(body?.id ?? ""), userId);
  if (!s) return err("Envoi introuvable.", 404);
  if (action === "finish") {
    if (s.status !== "uploading") return NextResponse.json({ ok: true });
    const problem = await finishSubmission(s);
    return problem ? err(problem) : NextResponse.json({ ok: true });
  }
  if (action === "cancel") return (await cancelSubmission(s)) ? NextResponse.json({ ok: true }) : err("Ce pack est déjà dans les packs officiels.");
  return err("Action inconnue.");
});
