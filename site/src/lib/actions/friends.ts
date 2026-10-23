"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { acceptFriendRequest, removeFriend, sendFriendRequest } from "@/lib/friends";
import { checkRateLimit } from "@/lib/rateLimit";
import { FRIEND_PRIVACY_READY, isFriendPolicy, setFriendPolicy, setNewFriendCode, type FriendPolicy } from "@/lib/friendPrivacy";

export type AddFriendState = { error?: string; done?: boolean } | undefined;

const FRIENDS_PAGE_PATH = "/dashboard/amis";

// Réponse TOUJOURS identique ({ done: true }, jamais un message qui varie), que le pseudo
// entré existe déjà en ami, existe mais n'était pas ami, ou n'existe pas du tout — voir
// sendFriendRequest dans lib/friends.ts pour le détail de l'anti-énumération. Seule une
// erreur de VALIDATION locale (champ vide, pas de session) renvoie un message différent : ça
// ne dépend jamais de l'existence d'un compte en particulier. Envoie une DEMANDE : l'autre
// joueur doit l'accepter avant de devenir ami.
export async function addFriendAction(_prevState: AddFriendState, formData: FormData): Promise<AddFriendState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée, reconnecte-toi." };

  // Pseudo OU code d'ami (« K7Q-9XM »), reconnu cote serveur (voir lib/friendPrivacy.ts).
  const username = String(formData.get("username") ?? "").trim();
  if (!username) return { error: "Entre un pseudo ou un code d'ami." };

  // L'anti-enumeration compte sur une limite de debit (audit 14/10, S5) : sans elle, essayer des
  // milliers de pseudos depuis le site revelait quels comptes existent (ils apparaissent dans
  // "Demandes envoyees"). Meme palier que le launcher (10/min), plus un plafond horaire. Par
  // compte : la reponse ne depend jamais du pseudo vise.
  const perMinute = checkRateLimit(`friends-write:${session.user.id}`, 10, 60_000);
  // 20 demandes par heure (18/10) : on ne peut pas deviner les codes d'ami. Au-dela, la meme
  // reponse que d'habitude, mais rien n'est envoye.
  const perHour = checkRateLimit(`friends-write-hour:${session.user.id}`, 20, 60 * 60_000);
  if (perMinute.limited || perHour.limited) return { done: true };

  await sendFriendRequest(session.user.id, username);
  revalidatePath(FRIENDS_PAGE_PATH);
  return { done: true };
}

// Sert aussi à refuser une demande reçue et à annuler une demande envoyée (voir removeFriend).
export async function removeFriendAction(friendUserId: string): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée, reconnecte-toi." };

  await removeFriend(session.user.id, friendUserId);
  revalidatePath(FRIENDS_PAGE_PATH);
}

// Accepter une demande reçue. Seul le destinataire peut accepter (voir acceptFriendRequest).
export async function acceptFriendAction(requesterUserId: string): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée, reconnecte-toi." };

  await acceptFriendRequest(session.user.id, requesterUserId);
  revalidatePath(FRIENDS_PAGE_PATH);
}

// « Qui peut m'ajouter en ami » (variante C, 18/10) : meme reglage que la page Amis, Parametres
// et le launcher (/api/launcher/friends/settings).
export async function setFriendPolicyAction(policy: FriendPolicy): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée, reconnecte-toi." };
  if (!FRIEND_PRIVACY_READY || !isFriendPolicy(policy)) return { error: "Réglage invalide." };
  await setFriendPolicy(session.user.id, policy);
  revalidatePath(FRIENDS_PAGE_PATH);
  revalidatePath("/dashboard/parametres");
}

// « Changer de code » : l'ancien code ne marche plus.
export async function newFriendCodeAction(): Promise<{ error: string } | { code: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée, reconnecte-toi." };
  if (!FRIEND_PRIVACY_READY) return { error: "Pas encore disponible." };
  const code = await setNewFriendCode(session.user.id);
  revalidatePath(FRIENDS_PAGE_PATH);
  revalidatePath("/dashboard/parametres");
  return { code };
}
