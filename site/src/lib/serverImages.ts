import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { db, or } from "@/lib/db";
import { r2, IMAGES_BUCKET } from "@/lib/r2";
import { parsePageConfig } from "@/lib/serverPage";

// Supprime une image deposee sur R2 (/api/upload) quand elle est remplacee ou retiree —
// sans ca, l'ancien objet reste sur R2 indefiniment (voir /api/images/[key]/route.ts pour
// le format de cle attendu). N'agit que sur nos propres URLs ; une valeur legacy (ancien
// CDN externe, ex-Vercel Blob) est ignoree, pas supprimable ici de toute facon.
// excludeServerId : duplicateServer (lib/actions/servers.ts) copie bannerUrl/iconUrl/
// backgroundUrl tels quels (meme objet R2, pas un nouvel upload) — avant de supprimer, on
// verifie qu'aucune AUTRE fiche ne pointe encore vers la meme image, pour ne pas casser une
// copie en modifiant ou en supprimant l'originale.
export async function deleteR2ImageIfOwned(url: string | null, excludeServerId: string): Promise<void> {
  if (!url) return;
  const match = /^\/api\/images\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/.exec(new URL(url).pathname);
  if (!match) return;

  const stillUsed = await db.orm.public.Server.select("id")
    .where((s) => or(s.bannerUrl.eq(url), s.iconUrl.eq(url), s.backgroundUrl.eq(url)))
    .all();
  if (stillUsed.some((row) => row.id !== excludeServerId)) return;

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: IMAGES_BUCKET, Key: match[1] }));
  } catch (error) {
    // Pas bloquant : la fiche est deja a jour, un objet orphelin n'est pas grave en soi.
    console.error("[serverImages] Échec de la suppression de l'ancienne image R2", error);
  }
}

// Les trois champs image d'une fiche, plus les captures de sa galerie (pageConfig, voir
// lib/serverPage.ts) quand l'appelant les a lues, pour les appelants qui doivent toutes les
// nettoyer (suppression complete d'une fiche).
export async function deleteAllR2Images(
  server: { bannerUrl: string | null; iconUrl: string | null; backgroundUrl: string | null; pageConfig?: string | null },
  excludeServerId: string,
): Promise<void> {
  await deleteR2ImageIfOwned(server.bannerUrl, excludeServerId);
  await deleteR2ImageIfOwned(server.iconUrl, excludeServerId);
  await deleteR2ImageIfOwned(server.backgroundUrl, excludeServerId);
  for (const item of parsePageConfig(server.pageConfig).gallery) await deleteR2ImageIfOwned(item.url, excludeServerId);
}
