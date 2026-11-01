import { execSql } from "@/lib/db";
import { broadcastNotification, resolveAudienceRecipients } from "@/lib/notifications";

// 25/10 : case « Prévenir les joueurs dans le launcher à la publication » de l'editeur d'articles
// (onglet Actualités de /admin/notifications). Une annonce dans la boite du launcher de tout le
// monde, seulement au premier passage en « Publié ».
// serverName = « news:<id> » : le centre de notifications du launcher range le message dans
// l'onglet Actualités et ouvre l'article en entier (voir /api/launcher/news/[id]). Pas de
// nouveau type de notification, donc pas de migration.
export async function notifyNewsPublished(id: string, title: string): Promise<void> {
  // Republier (Dépublier puis Publier) ne doit pas laisser deux messages pour le meme article.
  await removeNewsNotifications(id);
  const recipients = await resolveAudienceRecipients("everyone");
  if (recipients.length === 0) return;
  await broadcastNotification({
    recipientMinecraftUuids: recipients,
    type: "broadcast_announcement",
    serverName: `news:${id}`,
    message: `Nouvel article : ${title} (à lire dans Actualités sur le site)`,
  });
}

// Article depublie ou supprime : son message disparait des cloches (il ne s'ouvrirait plus).
export async function removeNewsNotifications(id: string): Promise<void> {
  await execSql('DELETE FROM "notification" WHERE "serverName" = ?', [`news:${id}`]);
}
