import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { updateServerPage } from "@/lib/actions/serverPage";
import { parsePageConfig } from "@/lib/serverPage";
import { ServerPageEditor } from "@/components/ServerPageEditor";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Fiche publique — Omniscient" };

// Editeur de la fiche publique (voir lib/serverPage.ts) : reglages a gauche, apercu en direct a
// droite. Rien n'est en ligne avant « Enregistrer » (action updateServerPage).
export default async function ManageServerPublicPage({ params }: PageProps<"/manage/[id]/public-page">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const server = await db.orm.public.Server.select(
    "id",
    "name",
    "description",
    "bannerUrl",
    "iconUrl",
    "backgroundUrl",
    "type",
    "minecraftVersion",
    "recommendedRamGB",
    "curseforgeModpackName",
    "curseforgeModpackVersion",
    "pageConfig",
    "discordUrl",
    "websiteUrl",
  )
    .where({ id, ownerId: session.user.id })
    .first();
  if (!server) notFound();
  const { dict } = await getT();
  const config = parsePageConfig(server.pageConfig);

  return (
    <ServerPageEditor
      action={updateServerPage.bind(null, server.id)}
      initial={{
        config,
        videoUrl: config.videoId ? `https://www.youtube.com/watch?v=${config.videoId}` : "",
        discordUrl: server.discordUrl ?? "",
        websiteUrl: server.websiteUrl ?? "",
        backgroundUrl: server.backgroundUrl ?? "",
      }}
      server={{
        name: server.name,
        description: server.description,
        bannerUrl: server.bannerUrl,
        iconUrl: server.iconUrl,
        type: server.type,
        minecraftVersion: server.minecraftVersion,
        recommendedRamGB: server.recommendedRamGB,
        modpack: server.curseforgeModpackName
          ? `${server.curseforgeModpackName}${server.curseforgeModpackVersion ? ` — ${server.curseforgeModpackVersion}` : ""}`
          : null,
      }}
      labels={{
        sections: dict.serverPage.sections,
        video: dict.serverPage.video,
        social: dict.serverPage.social,
      }}
    />
  );
}
