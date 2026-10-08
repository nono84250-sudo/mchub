import { db, execSql } from "@/lib/db";

// Alertes personnelles pour un joueur (cloche du launcher) — distinctes des
// Actualites (diffusion admin identique pour tout le monde). Voir le
// commentaire sur le modele Notification dans contract.prisma pour pourquoi
// le destinataire est un minecraftUuid brut plutot qu'une relation User.

export type NotificationType =
  | "report_replied"
  | "report_resolved"
  | "server_frozen"
  | "admin_info"
  | "admin_warning"
  | "admin_error"
  | "broadcast_announcement"
  | "broadcast_maintenance"
  | "broadcast_alert"
  | "broadcast_promotion";

export type NotificationSummary = {
  id: string;
  type: NotificationType;
  serverName: string;
  message: string | null;
  read: boolean;
  createdAt: string;
};

export async function createNotification(input: {
  recipientMinecraftUuid: string;
  type: NotificationType;
  serverName: string;
  message?: string | null;
}) {
  return db.orm.public.Notification.create({
    recipientMinecraftUuid: input.recipientMinecraftUuid,
    type: input.type,
    serverName: input.serverName,
    message: input.message ?? null,
  });
}

// Diffusion a plusieurs destinataires (panel admin, voir /admin/notifications) — une ligne par
// destinataire, pas de table a part : c'est la meme Notification que les messages individuels,
// juste creee en boucle. Pas de lot/traçabilite commune entre les destinataires d'un meme envoi.
export async function broadcastNotification(input: {
  recipientMinecraftUuids: string[];
  type: NotificationType;
  serverName: string;
  message?: string | null;
}): Promise<number> {
  for (const uuid of input.recipientMinecraftUuids) {
    await createNotification({ recipientMinecraftUuid: uuid, type: input.type, serverName: input.serverName, message: input.message });
  }
  return input.recipientMinecraftUuids.length;
}

// Les 30 plus recentes suffisent pour un panneau de cloche — pas de
// pagination, meme raisonnement que listReportsForServer.
export async function listNotificationsForRecipient(minecraftUuid: string): Promise<NotificationSummary[]> {
  return db.orm.public.Notification.select("id", "type", "serverName", "message", "read", "createdAt")
    .where({ recipientMinecraftUuid: minecraftUuid })
    .orderBy((n) => n.createdAt.desc())
    .limit(30)
    .all();
}

// Une seule requete SQL (pas une par ligne) : avec l'API REST D1, chaque .update()/.delete()
// de la couche ORM est un aller-retour reseau separe — multiplier par le nombre de
// notifications rendait "Tout marquer comme lu"/"Effacer les lues" visiblement lent.
export async function markNotificationsRead(minecraftUuid: string) {
  await execSql('UPDATE "notification" SET "read" = 1 WHERE "recipientMinecraftUuid" = ? AND "read" = 0', [minecraftUuid]);
}

// Verifie que la notification appartient bien au joueur qui demande sa
// suppression avant de l'effacer — sans ca, connaitre un id de notification
// (visible cote client) suffirait a supprimer celle de n'importe qui.
export async function deleteNotification(id: string, minecraftUuid: string) {
  const notif = await db.orm.public.Notification.where({ id }).first();
  if (!notif || notif.recipientMinecraftUuid !== minecraftUuid) return;
  await db.orm.public.Notification.where({ id }).delete();
}

export async function deleteReadNotifications(minecraftUuid: string) {
  await execSql('DELETE FROM "notification" WHERE "recipientMinecraftUuid" = ? AND "read" = 1', [minecraftUuid]);
}
