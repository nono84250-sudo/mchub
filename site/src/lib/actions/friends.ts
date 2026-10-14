"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { addFriendByUsername, removeFriend } from "@/lib/friends";

export type AddFriendState = { error?: string; done?: boolean } | undefined;

const FRIENDS_PAGE_PATH = "/dashboard/amis";

// Réponse TOUJOURS identique ({ done: true }, jamais un message qui varie), que le pseudo
// entré existe déjà en ami, existe mais n'était pas ami, ou n'existe pas du tout — voir
// addFriendByUsername dans lib/friends.ts pour le détail de l'anti-énumération. Seule une
// erreur de VALIDATION locale (champ vide, pas de session) renvoie un message différent : ça
// ne dépend jamais de l'existence d'un compte en particulier.
export async function addFriendAction(_prevState: AddFriendState, formData: FormData): Promise<AddFriendState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée, reconnecte-toi." };

  const username = String(formData.get("username") ?? "").trim();
  if (!username) return { error: "Entre un pseudo Minecraft." };

  await addFriendByUsername(session.user.id, username);
  revalidatePath(FRIENDS_PAGE_PATH);
  return { done: true };
}

export async function removeFriendAction(friendUserId: string): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée, reconnecte-toi." };

  await removeFriend(session.user.id, friendUserId);
  revalidatePath(FRIENDS_PAGE_PATH);
}
