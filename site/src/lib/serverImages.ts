import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { execSql } from "@/lib/db";
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
//
// Audit 25/10 (S-I1 du 19/10) : la verification ignorait les galeries (pageConfig) des autres
// fiches. Une fiche pouvait reprendre une capture d'une autre fiche puis la retirer, ce qui
// l'effacait pour de bon. On cherche desormais la cle de l'image (uuid.ext, unique) dans les
// quatre champs de TOUTES les fiches, quelle que soit l'origine ecrite dans l'URL.
const OWN_IMAGE_KEY = /^\/api\/images\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/;

function ownImageKey(url: string): string | null {
  try {
    return OWN_IMAGE_KEY.exec(new URL(url).pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Fiches qui utilisent cette image (banniere, icone, fond ou galerie). La cle ne contient que
// [0-9a-f-.] : aucun caractere special de LIKE.
async function serversUsingImageKey(key: string): Promise<string[]> {
  const pattern = `%${key}%`;
  const rows = (await execSql(
    'SELECT "id" FROM "server" WHERE "bannerUrl" LIKE ? OR "iconUrl" LIKE ? OR "backgroundUrl" LIKE ? OR "pageConfig" LIKE ?',
    [pattern, pattern, pattern, pattern],
  )) as unknown as { id: string }[];
  return (rows ?? []).map((row) => row.id);
}

// Vrai si une AUTRE fiche que serverId (null : fiche en creation) utilise deja cette image.
// Sert a refuser qu'une fiche reprenne l'image d'une autre (seules les images fraichement
// envoyees par /api/upload, ou deja sur la fiche, sont acceptees). Une URL qui n'est pas une
// de nos images n'est pas concernee (isOwnImageUrl la refuse deja).
export async function isImageUsedByAnotherServer(url: string | null, serverId: string | null): Promise<boolean> {
  if (!url) return false;
  const key = ownImageKey(url);
  if (!key) return false;
  return (await serversUsingImageKey(key)).some((id) => id !== serverId);
}

export async function deleteR2ImageIfOwned(url: string | null, excludeServerId: string): Promise<void> {
  if (!url) return;
  const key = ownImageKey(url);
  if (!key) return;

  const stillUsed = await serversUsingImageKey(key);
  if (stillUsed.some((id) => id !== excludeServerId)) return;

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: IMAGES_BUCKET, Key: key }));
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
