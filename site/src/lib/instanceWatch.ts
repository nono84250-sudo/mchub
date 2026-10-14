import { db } from "@/lib/db";

// Suivi par (joueur, instance) du point 9 (case "Me prévenir du changement de statut de cette
// instance", voir INSTANCE_SETTINGS_FIELDS côté launcher et /api/launcher/servers/[slug]/watch).
// Table dédiée plutôt qu'une colonne sur "server" : s'applique à TOUTE instance de "Mes
// instances" (possédée OU rejointe), donc à plusieurs joueurs différents pour un même serveur —
// voir schema.sql (index unique minecraftUuid+serverId).
export type InstanceWatchRow = {
  id: string;
  minecraftUuid: string;
  serverId: string;
  notifyOnStatusChange: boolean;
  lastKnownOnline: boolean;
  createdAt: string;
};

export async function getInstanceWatch(minecraftUuid: string, serverId: string): Promise<InstanceWatchRow | null> {
  return db.orm.public.InstanceWatch.select("id", "minecraftUuid", "serverId", "notifyOnStatusChange", "lastKnownOnline", "createdAt")
    .where({ minecraftUuid, serverId })
    .first();
}

// Crée ou met à jour le réglage d'un joueur pour une instance — une ligne par (joueur, serveur),
// pas d'UPSERT natif côté lib/db.ts donc select puis create/update ici (même limite que la
// route /watch qui l'appelle).
//
// `currentlyOnline` n'arme lastKnownOnline qu'À LA CRÉATION de la ligne (première activation de
// la case) : elle reflète l'état réel actuel du serveur plutôt qu'un 0 forcé, qui aurait
// déclenché une notification "de retour en ligne" dès le prochain passage du cron si le
// serveur était déjà en ligne au moment où le joueur a cochÉ la case. Une réactivation
// ultérieure (coché -> décoché -> coché) garde volontairement le dernier état connu : la ligne
// n'est jamais supprimée, seul notifyOnStatusChange change de valeur.
export async function setInstanceWatch(
  minecraftUuid: string,
  serverId: string,
  notifyOnStatusChange: boolean,
  currentlyOnline: boolean,
): Promise<void> {
  const existing = await getInstanceWatch(minecraftUuid, serverId);
  if (existing) {
    await db.orm.public.InstanceWatch.where({ id: existing.id }).update({ notifyOnStatusChange });
    return;
  }
  await db.orm.public.InstanceWatch.create({
    minecraftUuid,
    serverId,
    notifyOnStatusChange,
    lastKnownOnline: currentlyOnline,
  });
}
