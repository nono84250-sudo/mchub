import { execSql } from "@/lib/db";

// Heartbeat de presence envoye par le launcher (voir /api/launcher/presence), greffe sur son
// vrai cycle de 60s (REFRESH_INTERVAL_MS dans launcher/src/renderer.js, fonction
// scheduleRefresh/silentRefreshList — verifie dans le vrai code avant d'ecrire ceci). Table
// "userPresence" SEPAREE de "user" (voir schema.sql) : ecrite tres souvent (chaque joueur
// connecte, toutes les 60s), alors que "user" ne l'est qu'a la connexion/changement de pseudo.
//
// Statut binaire uniquement (en ligne/hors ligne, pas de "absent"/"invisible"/"ne pas
// deranger" — scope phase 1 valide par l'utilisateur), calcule a la LECTURE plutot que stocke :
// une ligne dont le dernier heartbeat remonte a moins de ONLINE_WINDOW_MS est "en ligne".
// 2x le cycle de 60s du launcher : laisse la marge d'UN cycle manque (requete lente, reseau
// degrade) avant de basculer un joueur toujours connecte en "hors ligne" a tort.
const ONLINE_WINDOW_MS = 2 * 60_000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

// INSERT ... ON CONFLICT plutôt que select puis create()/update() (comme setInstanceWatch) :
// Query.create() de lib/db.ts injecte TOUJOURS un champ "id" généré (voir sa définition), ce
// qui casserait l'INSERT ici — "userPresence" a "userId" pour clé primaire, PAS de colonne
// "id" du tout (voir schema.sql). Même pattern qu'un réglage de platformSetting
// (lib/platformSettings.ts), l'autre table de ce projet sans clé primaire "id".
//
// playingSlug (filtre « Un ami y joue », 2026-10-16) : serveur PUBLIC sur lequel le joueur est
// en partie, envoye dans ce meme heartbeat (aucun appel en plus). NULL hors partie ou sur un
// serveur prive. Necessite la migration d1/migrations/2026-10-16-presence-serveur.sql.
export async function recordPresenceHeartbeat(userId: string, playingSlug: string | null = null): Promise<void> {
  const now = new Date().toISOString();
  await execSql(
    'INSERT INTO "userPresence" ("userId", "lastSeenAt", "playingSlug") VALUES (?, ?, ?) ' +
      'ON CONFLICT ("userId") DO UPDATE SET "lastSeenAt" = excluded."lastSeenAt", "playingSlug" = excluded."playingSlug", "updatedAt" = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')',
    [userId, now, playingSlug],
  );
}

// Statut en ligne/hors ligne de plusieurs joueurs en une seule requete (liste d'amis) —
// l'ORM maison (lib/db.ts) ne gere pas de clause IN, d'ou le SQL ecrit a la main via
// execSql, comme attachIncludes() le fait deja en interne pour include().
// Meme requete qu'avant, avec en plus le serveur en cours (seulement si le joueur est en ligne).
export type PresenceStatus = { online: boolean; playingSlug: string | null };

export async function getOnlineStatuses(userIds: string[]): Promise<Map<string, PresenceStatus>> {
  const statuses = new Map<string, PresenceStatus>();
  if (userIds.length === 0) return statuses;
  const placeholders = userIds.map(() => "?").join(", ");
  const rows = (await execSql(
    `SELECT "userId", "lastSeenAt", "playingSlug" FROM "userPresence" WHERE "userId" IN (${placeholders})`,
    userIds,
  )) as { userId: string; lastSeenAt: string; playingSlug: string | null }[];
  for (const row of rows) {
    const online = isOnline(row.lastSeenAt);
    statuses.set(row.userId, { online, playingSlug: online ? row.playingSlug ?? null : null });
  }
  return statuses;
}
