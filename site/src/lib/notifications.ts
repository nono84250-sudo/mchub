import { db } from "@/prisma/db";

// Alertes personnelles pour un joueur (cloche du launcher) — distinctes des
// Actualites (diffusion admin identique pour tout le monde). Voir le
// commentaire sur le modele Notification dans contract.prisma pour pourquoi
// le destinataire est un minecraftUuid brut plutot qu'une relation User.

export type NotificationType = "report_replied" | "report_resolved";

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

// Les 30 plus recentes suffisent pour un panneau de cloche — pas de
// pagination, meme raisonnement que listReportsForServer.
export async function listNotificationsForRecipient(minecraftUuid: string): Promise<NotificationSummary[]> {
  return db.orm.public.Notification.select("id", "type", "serverName", "message", "read", "createdAt")
    .where({ recipientMinecraftUuid: minecraftUuid })
    .orderBy((n) => n.createdAt.desc())
    .limit(30)
    .all();
}

// Une mise a jour par ligne (pas de update-many) : meme pattern que le reste
// du projet, qui ne filtre jamais un .update()/.delete() que par id.
export async function markNotificationsRead(minecraftUuid: string) {
  const unread = await db.orm.public.Notification.select("id")
    .where({ recipientMinecraftUuid: minecraftUuid, read: false })
    .all();
  await Promise.all(unread.map((n) => db.orm.public.Notification.where({ id: n.id }).update({ read: true })));
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
  const read = await db.orm.public.Notification.select("id")
    .where({ recipientMinecraftUuid: minecraftUuid, read: true })
    .all();
  await Promise.all(read.map((n) => db.orm.public.Notification.where({ id: n.id }).delete()));
}
