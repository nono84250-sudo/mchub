"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { startMinecraftLink, unlinkMinecraftAccount as unlinkMinecraftAccountRow } from "@/lib/minecraftLink";

export type AccountActionState = { error: string } | { success: true } | undefined;

// Met a jour le nom et l'email du compte connecte. Le mot de passe se change
// uniquement via le bouton "Reinitialiser" (voir PasswordResetButton dans
// AccountForm.tsx et lib/actions/passwordReset.ts) — plus de champ inline
// ici. Note : la session en cours garde le nom/email precedents jusqu'a la
// prochaine connexion (JWT non rafraichi ici), seule cette page et les
// prochaines connexions verront la mise a jour.
export async function updateProfile(_prevState: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name || !email) {
    return { error: "Le nom et l'email sont obligatoires." };
  }

  const existing = await db.orm.public.User.where({ email }).first();
  if (existing && existing.id !== session.user.id) {
    return { error: "Un autre compte utilise déjà cet email." };
  }

  await db.orm.public.User.where({ id: session.user.id }).update({ name, email });

  revalidatePath("/account");
  return { success: true };
}

export type StartMinecraftLinkState = { code: string; expiresAt: string } | { error: string } | undefined;

export async function startMinecraftLinkAction(
  _prevState: StartMinecraftLinkState,
  _formData: FormData,
): Promise<StartMinecraftLinkState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  try {
    return await startMinecraftLink(session.user.id);
  } catch {
    return { error: "Impossible de générer le code, réessaie dans un instant." };
  }
}

export async function unlinkMinecraftAccount(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await unlinkMinecraftAccountRow(session.user.id);
  revalidatePath("/account");
}
