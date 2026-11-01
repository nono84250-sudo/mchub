import { db, execSql } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { normalizeMinecraftUuid } from "@/lib/launcherSession";

// 26/10 (test de Rushi) : un signalement « Problème technique » n'arrivait jamais au
// proprietaire du serveur, faute de notification. Il en recoit une maintenant, dans la cloche
// du site et du launcher (onglet Mes serveurs) ; un clic ouvre /manage/<serverId>/reports.
// Jamais pour un signalement de comportement/contenu (moderateurs seulement, voir
// lib/reports.ts), et jamais le pseudo du joueur dans le message.
//
// Meme astuce que les actualites (lib/newsNotify.ts) : pas de nouveau type, donc pas de
// migration de la table notification (son CHECK sur "type" ne bouge pas).
//   type       = « admin_info »
//   serverName = « report:<serverId> » (le lien vers la page Signalements)
//   message    = « <nombre>|<nom du serveur> »
// Plusieurs signalements d'affilee sur le meme serveur : tant que la notification n'est pas
// lue, on augmente son nombre et on la remonte en haut au lieu d'en ajouter une autre.
export const REPORT_NOTIF_PREFIX = "report:";

export async function notifyOwnerOfReport(serverId: string): Promise<void> {
  const server = await db.orm.public.Server.select("name", "ownerId").where({ id: serverId }).first();
  if (!server) return;
  const owner = await db.orm.public.User.select("minecraftUuid").where({ id: server.ownerId }).first();
  if (!owner?.minecraftUuid) return;
  const recipient = normalizeMinecraftUuid(owner.minecraftUuid);
  const key = `${REPORT_NOTIF_PREFIX}${serverId}`;

  const grouped = (await execSql(
    `UPDATE "notification"
        SET "message" = (CAST(substr("message", 1, instr("message", '|') - 1) AS INTEGER) + 1) || '|' || ?,
            "createdAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE "id" = (SELECT "id" FROM "notification" WHERE "recipientMinecraftUuid" = ? AND "serverName" = ? AND "read" = 0 ORDER BY "createdAt" DESC LIMIT 1)
      RETURNING "id"`,
    [server.name, recipient, key],
  )) as unknown[];
  if (grouped.length > 0) return;

  await createNotification({
    recipientMinecraftUuid: recipient,
    type: "admin_info",
    serverName: key,
    message: `1|${server.name}`,
  });
}
