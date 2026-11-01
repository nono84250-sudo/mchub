import type { MetadataRoute } from "next";
import { listPublicServers } from "@/lib/public-servers";
import { listPublicBugs } from "@/lib/bugCatalog";
import { featureState } from "@/lib/features";

const SITE_URL = "https://omniscientlauncher.com";

// Page d'accueil + annuaire + toutes les fiches serveur PUBLIQUES, en
// reutilisant listPublicServers() (deja filtre published/public/approuve —
// voir loadPublishedServers dans public-servers.ts) plutot que de dupliquer
// la logique de visibilite ici.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const servers = await listPublicServers();
  // Catalogue de bugs : seulement une fois ouvert à tout le monde (Laboratoire « bugCatalog »).
  const bugsState = await featureState("bugCatalog").catch(() => "hidden");
  const bugsOpen = bugsState === "beta" || bugsState === "all";
  const bugs = bugsOpen ? await listPublicBugs().catch(() => []) : [];

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/servers`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/cgu`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/confidentialite`, changeFrequency: "monthly", priority: 0.2 },
    ...(bugsOpen ? [{ url: `${SITE_URL}/aide/bugs`, changeFrequency: "weekly" as const, priority: 0.4 }] : []),
    ...bugs.map((bug) => ({ url: `${SITE_URL}/aide/bugs/${bug.slug}`, lastModified: bug.updatedAt, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...servers.map((server) => ({
      url: `${SITE_URL}/servers/${server.slug}`,
      lastModified: server.createdAt,
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
  ];
}
