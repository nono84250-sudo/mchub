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
export async function recordPresenceHeartbeat(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await execSql(
    'INSERT INTO "userPresence" ("userId", "lastSeenAt") VALUES (?, ?) ' +
      'ON CONFLICT ("userId") DO UPDATE SET "lastSeenAt" = excluded."lastSeenAt", "updatedAt" = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')',
    [userId, now],
  );
}

// Statut en ligne/hors ligne de plusieurs joueurs en une seule requete (liste d'amis) —
// l'ORM maison (lib/db.ts) ne gere pas de clause IN, d'ou le SQL ecrit a la main via
// execSql, comme attachIncludes() le fait deja en interne pour include().
export async function getOnlineStatuses(userIds: string[]): Promise<Map<string, boolean>> {
  const statuses = new Map<string, boolean>();
  if (userIds.length === 0) return statuses;
  const placeholders = userIds.map(() => "?").join(", ");
  const rows = (await execSql(
    `SELECT "userId", "lastSeenAt" FROM "userPresence" WHERE "userId" IN (${placeholders})`,
    userIds,
  )) as { userId: string; lastSeenAt: string }[];
  for (const row of rows) statuses.set(row.userId, isOnline(row.lastSeenAt));
  return statuses;
}
