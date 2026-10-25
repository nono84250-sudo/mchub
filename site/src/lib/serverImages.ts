import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { execSql } from "@/lib/db";
import { r2, IMAGES_BUCKET } from "@/lib/r2";
import { parsePageConfig } from "@/lib/serverPage";
import { TEAMS_READY } from "@/lib/teamRules";

// Cle R2 (<uuid>.<ext>) d'une de nos propres URLs d'image (/api/upload), ou null pour une
// valeur legacy (ancien CDN externe, ex-Vercel Blob) ou une adresse invalide.
export function imageKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const match = /^\/api\/images\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/.exec(new URL(url).pathname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Y a-t-il une fiche (filtree par `where`) qui utilise l'une de ces images : banniere, icone,
// fond ET galerie (pageConfig) ? Audit du 19/10 (S-I1) : seuls les trois premiers champs
// etaient regardes. Un proprietaire pouvait donc coller dans sa galerie l'URL publique d'une
// capture d'une autre fiche, l'enlever, et le site effacait le fichier de R2 : la galerie de
// l'autre fiche etait cassee. On compare sur la cle <uuid>.<ext> (un uuid ne se retrouve pas
// par hasard), ce qui couvre aussi la meme image servie sous un autre hote (avec ou sans www).
// Une seule requete, quel que soit le nombre d'images.
async function anyServerUses(keys: string[], where: { sql: string; param: string } | null): Promise<boolean> {
  if (!keys.length) return false;
  const columns = ["bannerUrl", "iconUrl", "backgroundUrl", "pageConfig"];
  const conds = keys.flatMap(() => columns.map((c) => `instr(coalesce("${c}", ''), ?) > 0`));
  const params = keys.flatMap((k) => columns.map(() => k));
  const rows = await execSql(`SELECT "id" FROM "server" WHERE ${where ? `${where.sql} AND ` : ""}(${conds.join(" OR ")}) LIMIT 1`, [
    ...(where ? [where.param] : []),
    ...params,
  ]);
  return rows.length > 0;
}

// A l'enregistrement : refuse une image deja utilisee par la fiche d'un AUTRE compte (on ne
// peut plus reprendre la capture d'un autre serveur, ni s'en servir pour la faire effacer).
// Les fiches d'un meme compte peuvent partager leurs images (fiche dupliquee).
export async function imagesUsedByAnotherOwner(urls: (string | null)[], ownerId: string): Promise<boolean> {
  const keys = [...new Set(urls.map(imageKeyFromUrl).filter((k): k is string => !!k))];
  return anyServerUses(keys, { sql: `"ownerId" != ?`, param: ownerId });
}

// Vrai si une AUTRE fiche que serverId (null : fiche en creation) utilise deja cette image
// (correctif de l'audit du 25/10, garde avec imagesUsedByAnotherOwner ci-dessus).
export async function isImageUsedByAnotherServer(url: string | null, serverId: string | null): Promise<boolean> {
  const key = imageKeyFromUrl(url);
  if (!key) return false;
  return anyServerUses([key], serverId ? { sql: `"id" != ?`, param: serverId } : null);
}

// Supprime une image deposee sur R2 (/api/upload) quand elle est remplacee ou retiree —
// sans ca, l'ancien objet reste sur R2 indefiniment (voir /api/images/[key]/route.ts pour
// le format de cle attendu). N'agit que sur nos propres URLs.
// Le fichier n'est efface que si AUCUNE fiche ne s'en sert encore (copie faite par
// duplicateServer, ou fiche d'un autre compte) ; sinon seul le lien est retire et le fichier
// reste. excludeServerId : la fiche en cours de suppression (encore en base a ce moment-la),
// ou null quand la fiche a deja ete mise a jour en base et doit compter elle aussi.
export async function deleteR2ImageIfOwned(url: string | null, excludeServerId: string | null): Promise<void> {
  const key = imageKeyFromUrl(url);
  if (!key) return;
  if (await anyServerUses([key], excludeServerId ? { sql: `"id" != ?`, param: excludeServerId } : null)) return;
  // Icone d'une team, ou image de preuve d'une demande de team (lib/teams.ts) : jamais effacee
  // tant qu'une team ou une demande s'en sert.
  if (
    TEAMS_READY &&
    (
      await execSql(
        `SELECT 1 AS "x" FROM "team" WHERE instr(coalesce("iconUrl", ''), ?) > 0
         UNION ALL SELECT 1 FROM "teamRequest" WHERE instr(coalesce("proofImageUrl", ''), ?) > 0 LIMIT 1`,
        [key, key],
      )
    ).length
  )
    return;

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
