"use server";

import { signIn, signOut } from "@/auth";

// "Se connecter avec Microsoft" est l'unique moyen de se connecter — voir
// auth.ts pour la recuperation du profil Minecraft/Xbox et la creation/mise
// a jour du compte. Pas de gestion d'erreur ici : signIn() redirige vers le
// fournisseur OAuth, l'echec eventuel (profil Minecraft introuvable, compte
// enfant...) est gere silencieusement cote auth.ts (voir token.error).
export async function signInWithMicrosoft() {
  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
