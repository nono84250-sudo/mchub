"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { hashPassword } from "@/lib/password";
import { createPasswordResetCode, createPasswordResetLinkToken, consumeAuthToken } from "@/lib/authTokens";
import { sendEmail } from "@/lib/email";

// VERCEL_PROJECT_PRODUCTION_URL/VERCEL_URL sont injectees automatiquement
// par Vercel (aucune config manuelle) — la premiere est le domaine de
// production stable, la seconde change a chaque deploiement (preview) mais
// reste correcte pour ce contexte-la. Repli local uniquement en dev.
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

// "Mot de passe oublié" (page /forgot-password, non connecté) : un code à 6
// caractères, saisi sur la même page — jamais de lien ici, contrairement à
// requestPasswordResetLink() ci-dessous (bouton dans /account, connecté).
// Toujours un succès générique, que l'email existe ou non, pour ne pas
// révéler si une adresse a un compte.
export async function requestPasswordResetCode(_prevState: unknown, formData: FormData): Promise<{ sent: true }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const user = await db.orm.public.User.where({ email }).first();
  if (user) {
    const code = await createPasswordResetCode(user.id);
    await sendEmail({
      to: user.email,
      subject: "Réinitialise ton mot de passe Omniscient",
      html: `<p>Bonjour ${user.name},</p><p>Ton code de réinitialisation est :</p><p style="font-size:24px;font-weight:600;letter-spacing:.3em;">${code}</p><p>Ce code expire dans 10 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`,
    });
  }

  return { sent: true };
}

export type SubmitResetCodeState = { error: string } | undefined;

export async function submitPasswordResetCode(
  email: string,
  _prevState: SubmitResetCodeState,
  formData: FormData,
): Promise<SubmitResetCodeState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!code || !newPassword) return { error: "Merci de remplir tous les champs." };
  if (newPassword.length < 8) return { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." };
  if (newPassword !== confirmPassword) return { error: "Les deux mots de passe ne correspondent pas." };

  const result = await consumeAuthToken(code, "password_reset");
  if (!result) return { error: "Code invalide ou expiré." };

  // L'email n'est utilise que pour re-verifier que le code appartient bien
  // au compte attendu (defense en profondeur, le code seul suffit deja a
  // identifier le compte cote serveur).
  const user = await db.orm.public.User.where({ id: result.userId }).first();
  if (!user || user.email !== email) return { error: "Code invalide ou expiré." };

  const passwordHash = await hashPassword(newPassword);
  await db.orm.public.User.where({ id: user.id }).update({ passwordHash });

  redirect("/login");
}

// Bouton "Réinitialiser son mot de passe" de /account (connecté) : envoie un
// LIEN (jamais un code à saisir) — le joueur clique dessus depuis sa boîte
// mail, potentiellement sur un autre appareil, d'où /reset-password en page
// publique plutôt qu'une étape dans /account.
export async function requestPasswordResetLink(): Promise<{ sent: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.orm.public.User.where({ id: session.user.id }).first();
  if (!user) redirect("/login");

  try {
    const token = await createPasswordResetLinkToken(user.id);
    const link = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: user.email,
      subject: "Réinitialise ton mot de passe Omniscient",
      html: `<p>Bonjour ${user.name},</p><p>Clique sur le lien ci-dessous pour choisir un nouveau mot de passe :</p><p><a href="${link}">${link}</a></p><p>Ce lien expire dans 30 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`,
    });
    return { sent: true };
  } catch {
    return { error: "Impossible d'envoyer l'email — réessaie dans un instant." };
  }
}

export type ResetWithTokenState = { error: string } | undefined;

export async function resetPasswordWithToken(
  token: string,
  _prevState: ResetWithTokenState,
  formData: FormData,
): Promise<ResetWithTokenState> {
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!newPassword) return { error: "Merci de remplir tous les champs." };
  if (newPassword.length < 8) return { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." };
  if (newPassword !== confirmPassword) return { error: "Les deux mots de passe ne correspondent pas." };

  const result = await consumeAuthToken(token, "password_reset");
  if (!result) return { error: "Ce lien est invalide ou a expiré — redemande une réinitialisation." };

  const passwordHash = await hashPassword(newPassword);
  await db.orm.public.User.where({ id: result.userId }).update({ passwordHash });

  redirect("/login");
}
