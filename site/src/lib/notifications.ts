import { db, execSql } from "@/lib/db";
import { normalizeMinecraftUuid } from "@/lib/launcherSession";

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
  | "broadcast_promotion"
  | "verification_approved"
  | "verification_rejected"
  // Point 9 (suivi de statut d'instance, 2026-10-14) : une instance suivie (voir
  // lib/instanceWatch.ts) repasse en ligne apres avoir ete hors ligne. CHECK recree sur
  // "notification" pour l'accepter (voir schema.sql) — donnees existantes preservees.
  | "instance_back_online";

export type NotificationSummary = {
  id: string;
  type: NotificationType;
  serverName: string;
  message: string | null;
  read: boolean;
  createdAt: string;
  eventAt: string | null;
};

export async function createNotification(input: {
  recipientMinecraftUuid: string;
  type: NotificationType;
  serverName: string;
  message?: string | null;
  // Instant UTC de l'evenement annonce (ex. debut d'une maintenance programmee) : affiche
  // cote client dans le fuseau de chaque destinataire (voir notifItemHtml cote launcher).
  eventAt?: string | null;
}) {
  return db.orm.public.Notification.create({
    recipientMinecraftUuid: normalizeMinecraftUuid(input.recipientMinecraftUuid),
    type: input.type,
    serverName: input.serverName,
    message: input.message ?? null,
    eventAt: input.eventAt ?? null,
  });
}

// Qui reçoit une diffusion (panel admin, voir /api/admin/notifications/send et
// /api/cron/process-scheduled) — partage par l'envoi immediat et par les diffusions
// programmees, pour ne pas dupliquer la resolution des destinataires.
export async function resolveAudienceRecipients(audience: "everyone" | "owners"): Promise<string[]> {
  if (audience === "owners") {
    const [users, servers] = await Promise.all([
      db.orm.public.User.select("id", "minecraftUuid").all(),
      db.orm.public.Server.select("ownerId").all(),
    ]);
    const ownerIds = new Set(servers.map((s) => s.ownerId));
    return users.filter((u) => ownerIds.has(u.id) && u.minecraftUuid).map((u) => u.minecraftUuid!);
  }
  const users = await db.orm.public.User.select("minecraftUuid").all();
  return users.map((u) => u.minecraftUuid).filter((u): u is string => !!u);
}

// Diffusion a plusieurs destinataires (panel admin, voir /admin/notifications) — une ligne par
// destinataire, pas de table a part : c'est la meme Notification que les messages individuels,
// juste creee en boucle. Pas de lot/traçabilite commune entre les destinataires d'un meme envoi.
//
// INSERT groupe (plusieurs lignes VALUES par requete) au lieu d'un aller-retour D1 par
// destinataire — meme principe que markNotificationsRead/deleteReadNotifications ci-dessous,
// sauf qu'ici createNotification() ne peut pas etre reutilisee telle quelle (elle ne fait
// qu'une ligne). Decoupe en lots : l'API REST D1 borne le nombre de parametres lies par
// requete, donc un envoi "everyone" avec beaucoup de destinataires reste plusieurs requetes —
// un petit nombre de lots plutot qu'un aller-retour par destinataire.
// 15 lignes * 6 parametres = 90 : D1 refuse plus de 100 parametres par requete (audit 25/10,
// les lots de 50 lignes = 300 parametres echouaient).
const BROADCAST_CHUNK_SIZE = 15;
export async function broadcastNotification(input: {
  recipientMinecraftUuids: string[];
  type: NotificationType;
  serverName: string;
  message?: string | null;
  eventAt?: string | null;
}): Promise<number> {
  const uuids = input.recipientMinecraftUuids;
  if (uuids.length === 0) return 0;
  const message = input.message ?? null;
  const eventAt = input.eventAt ?? null;

  for (let i = 0; i < uuids.length; i += BROADCAST_CHUNK_SIZE) {
    const chunk = uuids.slice(i, i + BROADCAST_CHUNK_SIZE);
    const params: unknown[] = [];
    const rows = chunk.map((uuid) => {
      params.push(crypto.randomUUID(), uuid, input.type, input.serverName, message, eventAt);
      return "(?, ?, ?, ?, ?, ?)";
    });
    await execSql(
      `INSERT INTO "notification" ("id", "recipientMinecraftUuid", "type", "serverName", "message", "eventAt") VALUES ${rows.join(", ")}`,
      params,
    );
  }
  return uuids.length;
}

// Les 30 plus recentes suffisent pour un panneau de cloche — pas de
// pagination, meme raisonnement que listReportsForServer.
export async function listNotificationsForRecipient(minecraftUuid: string): Promise<NotificationSummary[]> {
  return db.orm.public.Notification.select("id", "type", "serverName", "message", "read", "createdAt", "eventAt")
    .where({ recipientMinecraftUuid: normalizeMinecraftUuid(minecraftUuid) })
    .orderBy((n) => n.createdAt.desc())
    .limit(30)
    .all();
}

// Une seule requete SQL (pas une par ligne) : avec l'API REST D1, chaque .update()/.delete()
// de la couche ORM est un aller-retour reseau separe — multiplier par le nombre de
// notifications rendait "Tout marquer comme lu"/"Effacer les lues" visiblement lent.
export async function markNotificationsRead(minecraftUuid: string) {
  await execSql('UPDATE "notification" SET "read" = 1 WHERE "recipientMinecraftUuid" = ? AND "read" = 0', [normalizeMinecraftUuid(minecraftUuid)]);
}

// Verifie que la notification appartient bien au joueur qui demande sa
// suppression avant de l'effacer — sans ca, connaitre un id de notification
// (visible cote client) suffirait a supprimer celle de n'importe qui.
export async function deleteNotification(id: string, minecraftUuid: string) {
  const notif = await db.orm.public.Notification.where({ id }).first();
  if (!notif || notif.recipientMinecraftUuid !== normalizeMinecraftUuid(minecraftUuid)) return;
  await db.orm.public.Notification.where({ id }).delete();
}

export async function deleteReadNotifications(minecraftUuid: string) {
  await execSql('DELETE FROM "notification" WHERE "recipientMinecraftUuid" = ? AND "read" = 1', [normalizeMinecraftUuid(minecraftUuid)]);
}
