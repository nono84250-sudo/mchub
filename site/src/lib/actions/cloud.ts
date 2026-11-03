"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { featureVisibleOnSite } from "@/lib/features";
import { getUserOffer } from "@/lib/playWorlds";
import {
  CLOUD_LOADERS,
  deleteCloudPack,
  linkCloudPack,
  removeConfigs,
  saveCloudPack,
  searchCloudMods,
  unlinkCloudPack,
  type CloudLoader,
  type LinkResult,
  type ModHit,
  type SaveInput,
  type SaveResult,
} from "@/lib/cloudPacks";

// Actions de la page « Mon cloud » (03/11). Toujours sur le compte connecté : chaque fonction de
// lib/cloudPacks.ts filtre par userId (un id envoyé par le navigateur n'ouvre jamais le modpack
// d'un autre compte).
const PAGE = "/dashboard/cloud";

async function sessionUser(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !(await featureVisibleOnSite("cloudPacks"))) return null;
  return session.user.id;
}
const limited = (userId: string, max = 60) => checkRateLimit(`cloud-write:${userId}`, max, 60 * 60_000).limited;

export async function searchCloudModsAction(query: string, mc: string, loader: string): Promise<ModHit[] | null> {
  const userId = await sessionUser();
  if (!userId || checkRateLimit(`cloud-search:${userId}`, 120, 10 * 60_000).limited) return null;
  const l = (CLOUD_LOADERS as readonly string[]).includes(loader) ? (loader as CloudLoader) : "fabric";
  return searchCloudMods(String(query ?? ""), String(mc ?? ""), l).catch(() => null);
}

export async function saveCloudPackAction(input: SaveInput): Promise<SaveResult> {
  const userId = await sessionUser();
  if (!userId) return { ok: false, error: "Connexion requise." };
  if (limited(userId)) return { ok: false, error: "Trop de modifications : réessaie dans un moment." };
  const r = await saveCloudPack(userId, await getUserOffer(userId), input);
  revalidatePath(PAGE);
  return r;
}

export async function deleteCloudPackAction(id: string): Promise<boolean> {
  const userId = await sessionUser();
  if (!userId || limited(userId)) return false;
  const done = await deleteCloudPack(userId, String(id));
  revalidatePath(PAGE);
  return done;
}

export async function linkCloudPackAction(packId: string, serverId: string, mode: string): Promise<LinkResult> {
  const userId = await sessionUser();
  if (!userId || limited(userId)) return { ok: false, error: "notFound" };
  const r = await linkCloudPack(userId, await getUserOffer(userId), String(packId), String(serverId), mode === "required" ? "required" : "suggested");
  revalidatePath(PAGE);
  return r;
}

export async function unlinkCloudPackAction(packId: string): Promise<boolean> {
  const userId = await sessionUser();
  if (!userId || limited(userId)) return false;
  const done = await unlinkCloudPack(userId, String(packId));
  revalidatePath(PAGE);
  return done;
}

export async function removeConfigsAction(packId: string): Promise<boolean> {
  const userId = await sessionUser();
  if (!userId || limited(userId)) return false;
  const done = await removeConfigs(userId, String(packId));
  revalidatePath(PAGE);
  return done;
}
