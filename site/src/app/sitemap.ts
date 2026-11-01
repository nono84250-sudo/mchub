import type { MetadataRoute } from "next";
import { listPublicServers } from "@/lib/public-servers";
import { HELP_ARTICLES } from "@/lib/help/articles";

const SITE_URL = "https://omniscientlauncher.com";

// Page d'accueil + annuaire + toutes les fiches serveur PUBLIQUES, en
// reutilisant listPublicServers() (deja filtre published/public/approuve —
// voir loadPublishedServers dans public-servers.ts) plutot que de dupliquer
// la logique de visibilite ici.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const servers = await listPublicServers();

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/servers`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.4 },
    // Centre d'aide : seulement les pages publiques (ni équipe, ni fonction du Laboratoire).
    { url: `${SITE_URL}/aide`, changeFrequency: "weekly", priority: 0.5 },
    ...HELP_ARTICLES.filter((a) => !a.adminOnly && !a.feature).map((a) => ({
      url: `${SITE_URL}/aide/${a.slug}`,
      lastModified: a.updated,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    { url: `${SITE_URL}/cgu`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/confidentialite`, changeFrequency: "monthly", priority: 0.2 },
    ...servers.map((server) => ({
      url: `${SITE_URL}/servers/${server.slug}`,
      lastModified: server.createdAt,
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
  ];
}
