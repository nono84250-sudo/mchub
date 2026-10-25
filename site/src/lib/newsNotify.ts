import { broadcastNotification, resolveAudienceRecipients } from "@/lib/notifications";

// 25/10 : case « Prévenir les joueurs dans le launcher à la publication » de l'editeur d'articles
// (onglet Actualités de /admin/notifications). Une annonce dans la boite du launcher de tout le
// monde, seulement au premier passage en « Publié ».
export async function notifyNewsPublished(title: string): Promise<void> {
  const recipients = await resolveAudienceRecipients("everyone");
  if (recipients.length === 0) return;
  await broadcastNotification({
    recipientMinecraftUuids: recipients,
    type: "broadcast_announcement",
    serverName: "—",
    message: `Nouvel article : ${title} (à lire dans Actualités sur le site)`,
  });
}
