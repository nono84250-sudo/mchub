import { db, execSql } from "@/lib/db";
import { getOnlineStatuses } from "@/lib/presence";

// Systeme d'amis. Phase 1 (2026-10-14) : ajout direct et reciproque, sans accord de l'autre
// joueur — n'importe qui pouvait donc s'ajouter en ami d'un joueur et voir s'il etait en ligne.
// Corrige le meme jour : une amitie est d'abord une DEMANDE ("pending", envoyee par
// requesterId), que l'autre joueur accepte (-> "accepted") ou refuse (ligne supprimee). Le
// statut en ligne n'est calcule et renvoye QUE pour les amities acceptees : une demande en
// attente, recue ou envoyee, ne montre jamais si l'autre est en ligne.

export type FriendSummary = {
  friendshipId: string;
  userId: string;
  minecraftUsername: string | null;
  minecraftUuid: string | null;
  online: boolean;
};

// Pas de champ "online" ni d'UUID ici, volontairement : tant que la demande n'est pas acceptee,
// l'autre joueur n'est connu que par son pseudo.
export type FriendRequest = {
  friendshipId: string;
  userId: string;
  minecraftUsername: string | null;
};

export type FriendsOverview = {
  friends: FriendSummary[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};

// userId1/userId2 rangés dans un ordre stable (le plus petit id en premier) avant toute
// lecture/ecriture : sans ça, A ajoute B (userId1=A, userId2=B) puis B ajoute A créerait une
// seconde ligne (userId1=B, userId2=A) au lieu d'être bloqué par l'index unique
// "friendship_pair_idx" — qui ne dédoublonne qu'une MÊME paire ordonnée, pas les deux sens.
// Qui a demandé est porté par "requesterId", pas par l'ordre des colonnes.
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function listFriendsOverview(userId: string): Promise<FriendsOverview> {
  // La moitie "autre joueur" de la paire change de colonne selon l'ordre (userId peut être
  // userId1 OU userId2) — ce CASE WHEN récupère toujours le bon côté en une seule requête.
  const rows = (await execSql(
    `SELECT f."id" AS "friendshipId", f."status", f."requesterId",
            u."id" AS "userId", u."minecraftUsername", u."minecraftUuid"
     FROM "friendship" f
     JOIN "user" u ON u."id" = (CASE WHEN f."userId1" = ? THEN f."userId2" ELSE f."userId1" END)
     WHERE f."userId1" = ? OR f."userId2" = ?
     ORDER BY u."minecraftUsername" ASC`,
    [userId, userId, userId],
  )) as {
    friendshipId: string;
    status: string;
    requesterId: string | null;
    userId: string;
    minecraftUsername: string | null;
    minecraftUuid: string | null;
  }[];

  const toRequest = (r: (typeof rows)[number]): FriendRequest => ({
    friendshipId: r.friendshipId,
    userId: r.userId,
    minecraftUsername: r.minecraftUsername,
  });

  const accepted = rows.filter((r) => r.status === "accepted");
  const pending = rows.filter((r) => r.status !== "accepted");
  // Presence lue uniquement pour les amis acceptes : les ids des demandes en attente ne sont
  // jamais passes a getOnlineStatuses.
  const statuses = await getOnlineStatuses(accepted.map((r) => r.userId));

  return {
    friends: accepted.map((r) => ({ ...toRequest(r), minecraftUuid: r.minecraftUuid, online: statuses.get(r.userId) ?? false })),
    incoming: pending.filter((r) => r.requesterId !== userId).map(toRequest),
    outgoing: pending.filter((r) => r.requesterId === userId).map(toRequest),
  };
}

// Compatibilite : anciens appelants qui ne lisent que la liste des amis acceptes.
export async function listFriends(userId: string): Promise<FriendSummary[]> {
  return (await listFriendsOverview(userId)).friends;
}

// Anti-enumeration (scope valide par l'utilisateur) : envoyer une demande a un pseudo
// INEXISTANT ne doit donner NI un message NI un délai différent d'une demande vers un pseudo
// qui existe — sans ça, un pseudo essayé au hasard révélerait si un compte existe. D'où une
// fonction qui ne renvoie jamais "pas trouvé"/"déjà ami" : l'appelant (route/action) renvoie
// TOUJOURS la même réponse générique. Limite connue : la demande apparait ensuite dans
// "Demandes envoyées" si le compte existe (comme l'ami apparaissait avant dans la liste) ; le
// palier de rate limit des routes d'ecriture borne ce sondage.
//
// Cas particulier : si l'AUTRE joueur m'a deja envoye une demande, ma demande vaut acceptation
// (les deux ont demande, l'accord est mutuel).
export async function sendFriendRequest(userId: string, targetMinecraftUsername: string): Promise<void> {
  const trimmed = targetMinecraftUsername.trim();
  if (!trimmed) return;

  // Pseudos Minecraft insensibles a la casse (« notch » = « Notch »). Deux lignes peuvent porter
  // le meme pseudo (changement de pseudo pas encore resynchronise chez l'ancien proprietaire) :
  // la plus recemment mise a jour l'emporte, plutot qu'une ligne au hasard (audit 14/10).
  const [target] = (await execSql(
    'SELECT "id" FROM "user" WHERE lower("minecraftUsername") = lower(?) ORDER BY "updatedAt" DESC LIMIT 1',
    [trimmed],
  )) as { id: string }[];
  if (!target || target.id === userId) return;

  const [userId1, userId2] = orderedPair(userId, target.id);
  const existing = await db.orm.public.Friendship.select("id", "status", "requesterId").where({ userId1, userId2 }).first();
  if (existing) {
    if (existing.status === "pending" && existing.requesterId === target.id) {
      await db.orm.public.Friendship.where({ id: existing.id, status: "pending" }).update({ status: "accepted" });
    }
    return;
  }

  // ON CONFLICT DO NOTHING : deux demandes croisees envoyees au meme instant ne doivent pas
  // faire echouer la seconde sur l'index unique de la paire.
  await execSql(
    'INSERT INTO "friendship" ("id", "userId1", "userId2", "requesterId", "status") VALUES (?, ?, ?, ?, \'pending\') ' +
      'ON CONFLICT ("userId1", "userId2") DO NOTHING',
    [crypto.randomUUID(), userId1, userId2, userId],
  );
}

// Seul le DESTINATAIRE d'une demande peut l'accepter (requesterId = l'autre joueur). Idempotent :
// accepter une demande absente, deja acceptee, ou que j'ai moi-meme envoyee ne fait rien.
export async function acceptFriendRequest(userId: string, requesterUserId: string): Promise<void> {
  if (userId === requesterUserId) return;
  const [userId1, userId2] = orderedPair(userId, requesterUserId);
  await db.orm.public.Friendship.where({ userId1, userId2, status: "pending", requesterId: requesterUserId }).update({
    status: "accepted",
  });
}

// Une seule action pour : retirer un ami, refuser une demande recue, annuler une demande
// envoyee — dans les trois cas la ligne de la paire disparait des deux côtés. Idempotent.
export async function removeFriend(userId: string, otherUserId: string): Promise<void> {
  const [userId1, userId2] = orderedPair(userId, otherUserId);
  await db.orm.public.Friendship.where({ userId1, userId2 }).delete();
}
