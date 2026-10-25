import "server-only";
import { unstable_cache } from "next/cache";
import { execSql } from "@/lib/db";

// Pastille des non-lus (lot 6, 18/10) : la table "notification" a deja un champ "read", pas
// besoin de nouvelle colonne. Le nombre s'affiche sur chaque page (barre du haut) : il est mis
// en cache une minute par compte pour ne pas ajouter un appel a la base a chaque affichage
// (limite Cloudflare), et vide tout de suite quand le joueur lit ses notifications (tag).
export const unreadTag = (userId: string) => `notif-unread:${userId}`;

export function countUnreadNotifications(userId: string): Promise<number> {
  return unstable_cache(
    async () => {
      const [row] = (await execSql(
        'SELECT COUNT(*) AS "n" FROM "notification" n JOIN "user" u ON n."recipientMinecraftUuid" = u."minecraftUuid" WHERE u."id" = ? AND n."read" = 0',
        [userId],
      )) as { n: number }[];
      return Number(row?.n ?? 0);
    },
    ["notif-unread", userId],
    { revalidate: 60, tags: [unreadTag(userId)] },
  )();
}

// « 9+ » au-dela de 9.
export function unreadLabel(n: number): string {
  return n > 9 ? "9+" : String(n);
}
