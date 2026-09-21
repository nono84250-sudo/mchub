"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { hashPassword } from "@/lib/password";

export type AccountActionState = { error: string } | { success: true } | undefined;

// Met a jour le nom, l'email et — optionnellement — le mot de passe du
// compte connecte. Le mot de passe n'est change que si le champ est
// rempli (sinon on garde le hash existant) ; note : la session en cours
// garde le nom/email precedents jusqu'a la prochaine connexion (JWT non
// rafraichi ici), seule cette page et les prochaines connexions verront la
// mise a jour.
export async function updateProfile(_prevState: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!name || !email) {
    return { error: "Le nom et l'email sont obligatoires." };
  }
  if (newPassword && newPassword.length < 8) {
    return { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." };
  }

  const existing = await db.orm.public.User.where({ email }).first();
  if (existing && existing.id !== session.user.id) {
    return { error: "Un autre compte utilise déjà cet email." };
  }

  const update: { name: string; email: string; passwordHash?: string } = { name, email };
  if (newPassword) {
    update.passwordHash = await hashPassword(newPassword);
  }

  await db.orm.public.User.where({ id: session.user.id }).update(update);

  revalidatePath("/account");
  return { success: true };
}
