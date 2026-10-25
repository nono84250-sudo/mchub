"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { deleteCloudVersion, deleteCloudWorld, getUserOffer, requestRestore } from "@/lib/playWorlds";
import { checkRateLimit } from "@/lib/rateLimit";
import { featureVisibleOnSite } from "@/lib/features";

// Actions de la page « Mes mondes » du site (mode Jouer, bêta, 24/10). Toujours sur le compte
// connecté (session du site), jamais sur un id envoyé par le navigateur sans vérifier qu'il lui
// appartient (les fonctions de lib/playWorlds.ts filtrent toutes par userId).
export type WorldActionResult = { ok: true } | { ok: false; error: "session" | "notFound" | "current" | "limit" | "offer" };

// Laboratoire (25/10) : mondes en ligne cachés pour ce visiteur = comme s'il n'était pas connecté.
async function sessionUser(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !(await featureVisibleOnSite("worlds"))) return null;
  return session.user.id;
}

function limited(userId: string) {
  return checkRateLimit(`worlds-write:${userId}`, 30, 60 * 60_000).limited;
}

export async function deleteWorldAction(worldId: string): Promise<WorldActionResult> {
  const userId = await sessionUser();
  if (!userId) return { ok: false, error: "session" };
  if (limited(userId)) return { ok: false, error: "limit" };
  const done = await deleteCloudWorld(userId, String(worldId));
  revalidatePath("/dashboard/mondes");
  return done ? { ok: true } : { ok: false, error: "notFound" };
}

export async function deleteVersionAction(versionId: string): Promise<WorldActionResult> {
  const userId = await sessionUser();
  if (!userId) return { ok: false, error: "session" };
  if (limited(userId)) return { ok: false, error: "limit" };
  const out = await deleteCloudVersion(userId, String(versionId));
  revalidatePath("/dashboard/mondes");
  return out === "ok" ? { ok: true } : { ok: false, error: out };
}

// « Restaurer » : rien n'est écrasé ici. Le launcher applique la version au prochain lancement
// du monde (après avoir fait une sauvegarde « avant restauration » de la version actuelle).
export async function restoreVersionAction(versionId: string): Promise<WorldActionResult> {
  const userId = await sessionUser();
  if (!userId) return { ok: false, error: "session" };
  if (limited(userId)) return { ok: false, error: "limit" };
  if (!(await getUserOffer(userId)).cloud) return { ok: false, error: "offer" };
  const done = await requestRestore(userId, String(versionId));
  revalidatePath("/dashboard/mondes");
  return done ? { ok: true } : { ok: false, error: "notFound" };
}
