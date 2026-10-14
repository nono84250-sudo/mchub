import { db, execSql } from "@/lib/db";
import { getOnlineStatuses } from "@/lib/presence";

// Systeme d'amis, phase 1 (2026-10-14, scope volontairement reduit, voir le rapport) :
// statut binaire uniquement (en ligne/hors ligne, voir lib/presence.ts), ajout direct et
// reciproque — PAS de demande a accepter/refuser. La table "friendship" (schema.sql) ne porte
// donc aucune colonne de statut : son existence meme vaut amitie confirmee des deux cotes.

export type FriendSummary = {
  friendshipId: string;
  userId: string;
  minecraftUsername: string | null;
  minecraftUuid: string | null;
  online: boolean;
};

// userId1/userId2 rangés dans un ordre stable (le plus petit id en premier) avant toute
// lecture/ecriture : sans ça, A ajoute B (userId1=A, userId2=B) puis B ajoute A créerait une
// seconde ligne (userId1=B, userId2=A) au lieu d'être bloqué par l'index unique
// "friendship_pair_idx" — qui ne dédoublonne qu'une MÊME paire ordonnée, pas les deux sens.
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function listFriends(userId: string): Promise<FriendSummary[]> {
  // La moitie "autre joueur" de la paire change de colonne selon le sens dans lequel l'amitie a
  // ete enregistree (userId peut être userId1 OU userId2) — ce CASE WHEN récupère toujours le
  // bon côté en une seule requête plutôt que deux requêtes (une par sens) à fusionner ensuite.
  const rows = (await execSql(
    `SELECT f."id" AS "friendshipId", u."id" AS "userId", u."minecraftUsername", u."minecraftUuid"
     FROM "friendship" f
     JOIN "user" u ON u."id" = (CASE WHEN f."userId1" = ? THEN f."userId2" ELSE f."userId1" END)
     WHERE f."userId1" = ? OR f."userId2" = ?
     ORDER BY u."minecraftUsername" ASC`,
    [userId, userId, userId],
  )) as { friendshipId: string; userId: string; minecraftUsername: string | null; minecraftUuid: string | null }[];

  const statuses = await getOnlineStatuses(rows.map((r) => r.userId));
  return rows.map((r) => ({
    friendshipId: r.friendshipId,
    userId: r.userId,
    minecraftUsername: r.minecraftUsername,
    minecraftUuid: r.minecraftUuid,
    online: statuses.get(r.userId) ?? false,
  }));
}

// Anti-enumeration (scope valide par l'utilisateur) : ajouter un ami par un pseudo INEXISTANT
// ne doit donner NI un message NI un délai différent d'un ajout vers un pseudo qui existe déjà
// en ami ou en joueur normal — sans ça, un pseudo essayé au hasard révélerait si un compte
// existe. D'où une fonction qui ne renvoie jamais "pas trouvé"/"déjà ami" : elle fait
// simplement de son mieux et revient, l'appelant (route/action) renvoie TOUJOURS la même
// réponse générique quel que soit le cas réel (voir lib/actions/friends.ts et
// /api/launcher/friends/route.ts). Les 2-3 requêtes DB exécutées dans le cas "trouvé" sont
// comparables à l'unique requête du cas "pas trouvé" : pas une garantie cryptographique de
// temps constant, mais suffisant pour ~10 testeurs (pas de minuteur artificiel ajouté, qui
// dégraderait l'UX pour une vraie attaque par chronométrage hors de portée ici).
export async function addFriendByUsername(userId: string, targetMinecraftUsername: string): Promise<void> {
  const trimmed = targetMinecraftUsername.trim();
  if (!trimmed) return;

  const target = await db.orm.public.User.select("id").where({ minecraftUsername: trimmed }).first();
  if (!target || target.id === userId) return;

  const [userId1, userId2] = orderedPair(userId, target.id);
  const existing = await db.orm.public.Friendship.where({ userId1, userId2 }).first();
  if (existing) return;

  await db.orm.public.Friendship.create({ userId1, userId2 });
}

// Suppression par L'UN OU L'AUTRE : une seule ligne à retirer, l'amitié disparaît des deux
// côtés (pas de statut "qui a supprimé qui"). Idempotent — supprimer une amitié déjà absente
// ne fait rien (pas d'erreur), même raisonnement que setInstanceWatch côté réglages.
export async function removeFriend(userId: string, otherUserId: string): Promise<void> {
  const [userId1, userId2] = orderedPair(userId, otherUserId);
  await db.orm.public.Friendship.where({ userId1, userId2 }).delete();
}
