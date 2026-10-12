import { db, execSql } from "@/lib/db";
import { resolveAudienceRecipients, broadcastNotification, type NotificationType } from "@/lib/notifications";
import { setSiteBanner, activateLauncherMaintenance } from "@/lib/platformSettings";

export type ScheduledBroadcast = {
  id: string;
  type: "announcement" | "maintenance" | "alert" | "promotion";
  audience: "everyone" | "owners";
  system: string | null;
  text: string;
  banner: boolean;
  blockLauncher: boolean;
  scheduledAt: string;
  sentAt: string | null;
};

const BROADCAST_TYPE: Record<ScheduledBroadcast["type"], NotificationType> = {
  announcement: "broadcast_announcement",
  maintenance: "broadcast_maintenance",
  alert: "broadcast_alert",
  promotion: "broadcast_promotion",
};

export async function createScheduledBroadcast(input: {
  type: ScheduledBroadcast["type"];
  audience: ScheduledBroadcast["audience"];
  system: string | null;
  text: string;
  banner: boolean;
  blockLauncher: boolean;
  scheduledAt: Date;
}): Promise<void> {
  await db.orm.public.ScheduledBroadcast.create({
    type: input.type,
    audience: input.audience,
    system: input.system,
    text: input.text,
    banner: input.banner,
    blockLauncher: input.blockLauncher,
    scheduledAt: input.scheduledAt.toISOString(),
  });
}

// A venir (pas encore envoyees), les plus proches d'abord — pour la liste affichee sur
// /admin/notifications avec un bouton "Annuler".
export async function listPendingScheduledBroadcasts(): Promise<ScheduledBroadcast[]> {
  return db.orm.public.ScheduledBroadcast.select("id", "type", "audience", "system", "text", "banner", "blockLauncher", "scheduledAt", "sentAt")
    .where((s) => s.sentAt.isNull())
    .orderBy((s) => s.scheduledAt.desc())
    .all();
}

// Retire une diffusion programmee pas encore envoyee. Ne fait rien si elle est deja partie
// (sentAt non nul) : pas d'annulation a retardement d'un envoi deja effectue.
export async function cancelScheduledBroadcast(id: string): Promise<void> {
  await execSql('DELETE FROM "scheduledBroadcast" WHERE "id" = ? AND "sentAt" IS NULL', [id]);
}

// Appelee par /api/cron/process-scheduled (voir ce fichier pour qui la declenche — un Worker
// Cloudflare externe, Vercel Hobby ne permettant qu'une tache planifiee par jour).
export async function processDueScheduledBroadcasts(): Promise<number> {
  const due = await db.orm.public.ScheduledBroadcast.select("id", "type", "audience", "system", "text", "banner", "blockLauncher", "scheduledAt")
    .where((s) => s.sentAt.isNull())
    .where((s) => s.scheduledAt.lt(new Date().toISOString()))
    .all();

  for (const item of due) {
    // Marque l'item comme envoye AVANT de lancer les notifications/bannieres, pas apres :
    // avec la boucle de broadcastNotification, un echec a mi-parcours (ou un crash du cron)
    // laissait sentAt a NULL, donc l'item restait "due" et etait rejoue EN ENTIER au prochain
    // tick — y compris les destinataires deja notifies. Pour une diffusion, un envoi manque
    // (sentAt pose mais notifications pas toutes parties) est prefere a un envoi en double :
    // on retire l'item de la file tout de suite, au prix, dans le pire des cas, de quelques
    // destinataires non notifies plutot que notifies deux fois.
    await execSql('UPDATE "scheduledBroadcast" SET "sentAt" = ? WHERE "id" = ?', [new Date().toISOString(), item.id]);

    const recipients = await resolveAudienceRecipients(item.audience);
    const message = item.type === "maintenance" && item.system ? `[${item.system}] ${item.text}` : item.text;
    if (recipients.length > 0) {
      await broadcastNotification({
        recipientMinecraftUuids: recipients,
        type: BROADCAST_TYPE[item.type as ScheduledBroadcast["type"]],
        serverName: "—",
        message,
        eventAt: item.scheduledAt,
      });
    }
    if (item.banner) await setSiteBanner({ type: item.type, text: message });
    if (item.type === "maintenance" && item.blockLauncher) await activateLauncherMaintenance(message);
  }
  return due.length;
}
