"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/prisma/db";
import { hashPassword } from "@/lib/password";
import { createEmailVerifyCode, consumeAuthToken } from "@/lib/authTokens";
import { sendEmail } from "@/lib/email";

export type AuthActionState = { error: string } | undefined;

async function sendVerifyCodeEmail(email: string, name: string, userId: string): Promise<void> {
  const code = await createEmailVerifyCode(userId);
  await sendEmail({
    to: email,
    subject: "Confirme ton compte Omniscient",
    html: `<p>Bonjour ${name},</p><p>Ton code de confirmation est :</p><p style="font-size:24px;font-weight:600;letter-spacing:.3em;">${code}</p><p>Ce code expire dans 10 minutes.</p>`,
  });
}

// Signup en deux temps : le compte est cree avec emailVerified=false et
// AUCUNE session n'est ouverte tant que verifySignupCode() n'a pas valide le
// code recu par email — voir SignupForm.tsx pour l'etape suivante affichee
// cote client.
export type SignupState = AuthActionState | { verifyEmail: string };

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return { error: "Merci de remplir tous les champs." };
  }
  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const existing = await db.orm.public.User.where({ email }).first();
  if (existing) {
    return { error: "Un compte existe déjà avec cet email." };
  }

  const passwordHash = await hashPassword(password);
  const user = await db.orm.public.User.create({ email, passwordHash, name, emailVerified: false });

  try {
    await sendVerifyCodeEmail(email, name, user.id);
  } catch {
    return { error: "Le compte a été créé mais l'email de confirmation n'a pas pu être envoyé. Réessaie depuis la page de connexion." };
  }

  return { verifyEmail: email };
}

export type VerifySignupState = { error: string } | undefined;

// email/password passes via .bind() cote client (SignupForm.tsx) — jamais
// stockes cote serveur entre les deux etapes, uniquement le temps de cette
// invocation pour pouvoir ouvrir la session juste apres validation du code.
export async function verifySignupCode(
  email: string,
  password: string,
  _prevState: VerifySignupState,
  formData: FormData,
): Promise<VerifySignupState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) return { error: "Merci de saisir le code reçu par email." };

  const result = await consumeAuthToken(code, "email_verify");
  if (!result) return { error: "Code invalide ou expiré." };

  await db.orm.public.User.where({ id: result.userId }).update({ emailVerified: true });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Compte confirmé, mais la connexion automatique a échoué. Connecte-toi manuellement." };
    }
    throw error;
  }
}

export async function resendSignupCode(email: string): Promise<void> {
  const user = await db.orm.public.User.where({ email }).first();
  if (!user || user.emailVerified) return;
  await sendVerifyCodeEmail(user.email, user.name, user.id);
}

export async function login(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Merci de remplir tous les champs." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou mot de passe incorrect." };
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
