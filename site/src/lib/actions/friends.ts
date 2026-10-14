"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { acceptFriendRequest, removeFriend, sendFriendRequest } from "@/lib/friends";
import { checkRateLimit } from "@/lib/rateLimit";

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

  const username = String(formData.get("username") ?? "").trim();
  if (!username) return { error: "Entre un pseudo Minecraft." };

  // L'anti-enumeration compte sur une limite de debit (audit 14/10, S5) : sans elle, essayer des
  // milliers de pseudos depuis le site revelait quels comptes existent (ils apparaissent dans
  // "Demandes envoyees"). Meme palier que le launcher (10/min), plus un plafond horaire. Par
  // compte : la reponse ne depend jamais du pseudo vise.
  const perMinute = checkRateLimit(`friends-write:${session.user.id}`, 10, 60_000);
  const perHour = checkRateLimit(`friends-write-hour:${session.user.id}`, 60, 60 * 60_000);
  if (perMinute.limited || perHour.limited) return { error: "Trop de demandes envoyées, réessaie dans un moment." };

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
