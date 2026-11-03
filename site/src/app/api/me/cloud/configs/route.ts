import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { featureVisibleOnSite } from "@/lib/features";
import { getUserOffer } from "@/lib/playWorlds";
import { CONFIG_MAX_BYTES, storeConfigZip } from "@/lib/cloudPacks";

// Mon cloud (03/11) : fichiers de configuration d'un modpack, en un .zip (4 Mo au plus, une seule
// requête sous la limite de 4,5 Mo de Vercel). POST /api/me/cloud/configs?pack=<id>, corps = le .zip.
// Le site lit le répertoire du zip et n'accepte que des fichiers de configuration (texte).
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export const POST = withD1Busy(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return err("Origine refusée.", 403);
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return err("Connexion requise.", 401);
  if (!(await featureVisibleOnSite("cloudPacks"))) return err("Fonctionnalité indisponible.", 404);
  const limited = rateLimitResponse(request, "site-cloud-configs", 30);
  if (limited) return limited;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > CONFIG_MAX_BYTES) return err("4 Mo au maximum pour les fichiers de configuration.", 413);
  const body = new Uint8Array(await request.arrayBuffer());
  if (!body.byteLength) return err("Fichier vide.");
  const r = await storeConfigZip(userId, await getUserOffer(userId), new URL(request.url).searchParams.get("pack") ?? "", body);
  if (!r.ok) return err(r.error);
  revalidatePath("/dashboard/cloud");
  return NextResponse.json({ ok: true, count: r.count });
});
