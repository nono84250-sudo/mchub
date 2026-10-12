"use server";

import { signIn, signOut } from "@/auth";

// "Se connecter avec Microsoft" est l'unique moyen de se connecter — voir
// auth.ts pour la recuperation du profil Minecraft/Xbox et la creation/mise
// a jour du compte. Pas de gestion d'erreur ici : signIn() redirige vers le
// fournisseur OAuth, l'echec eventuel (profil Minecraft introuvable, compte
// enfant...) est gere silencieusement cote auth.ts (voir token.error).
//
// 2026-10-10 : `from` vient de /login?from=... (pose par proxy.ts quand une page /dashboard
// protegee redirige vers /login) — jamais fait confiance tel quel : doit commencer par "/"
// (chemin interne) sinon on retombe sur /dashboard, pour ne jamais rediriger vers une URL
// externe arbitraire apres une connexion reussie.
export async function signInWithMicrosoft(from?: string) {
  // "//evil.com" commence aussi par "/" mais est une URL protocol-relative vers un autre
  // domaine pour un navigateur : exclue explicitement, pas seulement "/" tout court.
  const redirectTo = from && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
  await signIn("microsoft-entra-id", { redirectTo });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
