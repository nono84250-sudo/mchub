import type { MetadataRoute } from "next";

const SITE_URL = "https://omniscientlauncher.com";

// Autorise l'indexation du site public ; bloque les espaces prives/de gestion
// (jamais de contenu utile a indexer, et certains revelent une structure
// d'URL interne — meme esprit que isVisibleRow dans public-servers.ts, qui
// evite deja toute fuite au niveau des donnees).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/dashboard", "/account", "/manage", "/join"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
