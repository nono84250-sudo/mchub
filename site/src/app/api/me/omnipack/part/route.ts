import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { featureVisibleOnSite } from "@/lib/features";
import { expectedPartSize, findSubmission } from "@/lib/omniPacks";
import { PACKS_BUCKET, omnipackPartKey, omnipackPrefix, putWorldObject } from "@/lib/worldStorage";

// Un morceau (4 Mio au plus, sous la limite de 4,5 Mo de Vercel) d'un .omnipack proposé :
// POST /api/me/omnipack/part?id=<envoi>&n=<numéro>, corps = les octets. Rangé dans R2 tel quel.
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export const POST = withD1Busy(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return err("Origine refusée.", 403);
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return err("Connexion requise.", 401);
  if (!(await featureVisibleOnSite("omniPack"))) return err("Fonctionnalité indisponible.", 404);
  const limited = rateLimitResponse(request, "site-omnipack-part", 120);
  if (limited) return limited;
  const url = new URL(request.url);
  const s = await findSubmission(url.searchParams.get("id") ?? "", userId);
  const n = Number(url.searchParams.get("n"));
  if (!s || s.status !== "uploading") return err("Envoi introuvable.", 404);
  if (!Number.isInteger(n) || n < 0 || n >= Number(s.parts)) return err("Morceau invalide.");
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength !== expectedPartSize(s, n)) return err("Morceau de mauvaise taille.");
  await putWorldObject(omnipackPartKey(omnipackPrefix(s.userId, s.id), n), body, PACKS_BUCKET);
  return NextResponse.json({ ok: true });
});
