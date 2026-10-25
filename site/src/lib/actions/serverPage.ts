"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwnImageUrl } from "@/lib/ownImageUrl";
import { deleteR2ImageIfOwned, isImageUsedByAnotherServer } from "@/lib/serverImages";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";
import {
  normalizePageConfig,
  pageInputErrors,
  parsePageConfig,
  youtubeVideoId,
  type PageEditorInput,
  type PageFieldError,
} from "@/lib/serverPage";

export type ServerPageActionState =
  | { error: PageFieldError | "images" | "generic" | "notFound"; savedAt?: undefined }
  | { savedAt: number; error?: undefined }
  | undefined;

// Enregistre la fiche publique personnalisable (voir lib/serverPage.ts et ServerPageEditor.tsx).
// Le client envoie tout en un seul champ JSON ; rien n'y est cru sur parole : la config est
// renormalisee (choix fermes, longueurs), chaque lien revérifié, et chaque image doit etre une
// image envoyee par /api/upload sur ce site (meme regle que la banniere, voir ownImageUrl.ts).
// Une seule ecriture en base, puis le cache des fiches est invalide pour que le changement
// soit visible tout de suite.
export async function updateServerPage(
  serverId: string,
  _prevState: ServerPageActionState,
  formData: FormData,
): Promise<ServerPageActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const owned = await db.orm.public.Server.select("id", "slug", "pageConfig", "backgroundUrl")
    .where({ id: serverId, ownerId: session.user.id })
    .first();
  if (!owned) return { error: "notFound" };

  let raw: Partial<PageEditorInput>;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "generic" };
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const rawConfig = (raw.config && typeof raw.config === "object" ? raw.config : {}) as Record<string, unknown>;
  const input: PageEditorInput = {
    // Les liens YouTube/TikTok sont verifies tels que saisis (normalizePageConfig les effacerait
    // sinon sans prevenir), puis la config est nettoyee.
    config: { ...normalizePageConfig(rawConfig), youtubeUrl: str(rawConfig.youtubeUrl) || null, tiktokUrl: str(rawConfig.tiktokUrl) || null },
    videoUrl: str(raw.videoUrl),
    discordUrl: str(raw.discordUrl),
    websiteUrl: str(raw.websiteUrl),
    backgroundUrl: str(raw.backgroundUrl),
  };
  const errors = pageInputErrors(input);
  if (errors.length) return { error: errors[0] };

  const previous = parsePageConfig(owned.pageConfig);
  const previousGallery = new Set(previous.gallery.map((g) => g.url));
  const host = (await headers()).get("host");
  const backgroundUrl = input.backgroundUrl || null;
  if (
    !isOwnImageUrl(backgroundUrl, host, owned.backgroundUrl) ||
    input.config.gallery.some((g) => !isOwnImageUrl(g.url, host, previousGallery.has(g.url) ? g.url : null))
  ) {
    return { error: "images" };
  }
  // Une image nouvelle sur cette fiche ne doit appartenir a aucune autre fiche (audit 25/10).
  const newImages = [
    ...(backgroundUrl && backgroundUrl !== owned.backgroundUrl ? [backgroundUrl] : []),
    ...input.config.gallery.map((g) => g.url).filter((url) => !previousGallery.has(url)),
  ];
  for (const url of newImages) {
    if (await isImageUsedByAnotherServer(url, serverId)) return { error: "images" };
  }

  const config = normalizePageConfig({ ...input.config, videoId: input.videoUrl ? youtubeVideoId(input.videoUrl) : null });

  await db.orm.public.Server.where({ id: serverId }).update({
    pageConfig: JSON.stringify(config),
    discordUrl: input.discordUrl || null,
    websiteUrl: input.websiteUrl || null,
    backgroundUrl,
  });

  // Images retirees ou remplacees : supprimees de R2 (sauf si une autre fiche les utilise encore).
  const kept = new Set(config.gallery.map((g) => g.url));
  for (const url of previousGallery) if (!kept.has(url)) await deleteR2ImageIfOwned(url, serverId);
  if (owned.backgroundUrl && owned.backgroundUrl !== backgroundUrl) await deleteR2ImageIfOwned(owned.backgroundUrl, serverId);

  updateTag(SERVERS_CACHE_TAG);
  revalidatePath(`/servers/${owned.slug}`);
  revalidatePath(`/manage/${serverId}/public-page`);
  return { savedAt: Date.now() };
}
