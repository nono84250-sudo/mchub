"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwnImageUrl } from "@/lib/ownImageUrl";
import { deleteR2ImageIfOwned, imagesUsedByAnotherOwner } from "@/lib/serverImages";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";
import { getTagCatalog } from "@/lib/tagRequests";
import { isKnownTag } from "@/lib/tagCatalog";
import {
  normalizePageConfig,
  pageInputErrors,
  parsePageConfig,
  youtubeVideoId,
  type PageEditorInput,
  type PageFieldError,
} from "@/lib/serverPage";

export type ServerPageActionState =
  | { error: PageFieldError | "images" | "generic" | "notFound" | "identity"; savedAt?: undefined }
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

  const owned = await db.orm.public.Server.select("id", "slug", "pageConfig", "backgroundUrl", "bannerUrl", "iconUrl")
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

  // Identite (19/10) : memes regles que Parametres (nom et description obligatoires, images
  // envoyees par ce site uniquement, jamais celles d'un autre compte).
  const rawIdentity = raw.identity && typeof raw.identity === "object" ? (raw.identity as Record<string, unknown>) : null;
  const identity = rawIdentity
    ? {
        name: str(rawIdentity.name),
        description: str(rawIdentity.description),
        bannerUrl: str(rawIdentity.bannerUrl) || null,
        iconUrl: str(rawIdentity.iconUrl) || null,
      }
    : null;
  if (identity && (!identity.name || !identity.description)) return { error: "identity" };

  const previous = parsePageConfig(owned.pageConfig);
  const previousGallery = new Set(previous.gallery.map((g) => g.url));
  const host = (await headers()).get("host");
  const backgroundUrl = input.backgroundUrl || null;
  if (
    !isOwnImageUrl(backgroundUrl, host, owned.backgroundUrl) ||
    (identity && !isOwnImageUrl(identity.bannerUrl, host, owned.bannerUrl)) ||
    (identity && !isOwnImageUrl(identity.iconUrl, host, owned.iconUrl)) ||
    input.config.gallery.some((g) => !isOwnImageUrl(g.url, host, previousGallery.has(g.url) ? g.url : null))
  ) {
    return { error: "images" };
  }
  // Audit du 19/10 (S-I1) : une image nouvelle sur cette fiche ne doit pas appartenir a la fiche
  // d'un autre compte (sinon on pourrait la reprendre, puis la faire effacer en la retirant).
  const addedImages: (string | null)[] = input.config.gallery.map((g) => g.url).filter((url) => !previousGallery.has(url));
  if (backgroundUrl !== owned.backgroundUrl) addedImages.push(backgroundUrl);
  if (identity && identity.bannerUrl !== owned.bannerUrl) addedImages.push(identity.bannerUrl);
  if (identity && identity.iconUrl !== owned.iconUrl) addedImages.push(identity.iconUrl);
  if (await imagesUsedByAnotherOwner(addedImages, session.user.id)) return { error: "images" };

  const config = normalizePageConfig({ ...input.config, videoId: input.videoUrl ? youtubeVideoId(input.videoUrl) : null });
  // Etiquettes ajoutees par l'equipe (c-...) : seulement celles qui existent vraiment.
  const { custom } = await getTagCatalog();
  config.tags = config.tags.filter((tag) => isKnownTag(tag, custom));
  config.extraTags = config.extraTags.filter((tag) => isKnownTag(tag, custom));

  await db.orm.public.Server.where({ id: serverId }).update({
    pageConfig: JSON.stringify(config),
    discordUrl: input.discordUrl || null,
    websiteUrl: input.websiteUrl || null,
    backgroundUrl,
    ...(identity ? { name: identity.name, description: identity.description, bannerUrl: identity.bannerUrl, iconUrl: identity.iconUrl } : {}),
  });

  // Images retirees ou remplacees : supprimees de R2 (sauf si une autre fiche les utilise encore).
  // null : la fiche est deja a jour en base, elle compte donc aussi (une image deplacee de la
  // galerie vers le fond, ou l'inverse, n'est pas effacee).
  const kept = new Set(config.gallery.map((g) => g.url));
  for (const url of previousGallery) if (!kept.has(url)) await deleteR2ImageIfOwned(url, null);
  if (owned.backgroundUrl && owned.backgroundUrl !== backgroundUrl) await deleteR2ImageIfOwned(owned.backgroundUrl, null);
  if (identity && owned.bannerUrl && owned.bannerUrl !== identity.bannerUrl) await deleteR2ImageIfOwned(owned.bannerUrl, null);
  if (identity && owned.iconUrl && owned.iconUrl !== identity.iconUrl) await deleteR2ImageIfOwned(owned.iconUrl, null);

  updateTag(SERVERS_CACHE_TAG);
  revalidatePath(`/servers/${owned.slug}`);
  revalidatePath(`/manage/${serverId}/public-page`);
  revalidatePath(`/manage/${serverId}/settings`);
  revalidatePath(`/manage/${serverId}`, "layout");
  revalidatePath("/dashboard");
  return { savedAt: Date.now() };
}
