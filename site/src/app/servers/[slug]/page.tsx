import { notFound } from "next/navigation";
import { getPublicServerBySlug } from "@/lib/public-servers";
import { DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";
import { ServerDetailView } from "@/components/ServerDetailView";

export async function generateMetadata({ params }: PageProps<"/servers/[slug]">) {
  const { slug } = await params;
  const server = await getPublicServerBySlug(slug);

  if (!server) {
    // Fiche introuvable (prive, non publie/valide, ou slug inconnu) : jamais
    // indexee, meme logique de non-fuite que isVisibleRow (public-servers.ts).
    return { title: "Serveur introuvable — Omniscient", robots: { index: false, follow: false } };
  }

  const title = `${server.name} — Omniscient`;
  // Vraie description du serveur (saisie par son proprietaire) plutot que la
  // description generique du site — but de cette tache, voir constat SEO.
  const description = server.description || `Rejoignez ${server.name}, un serveur Minecraft ${server.type === "modded" ? "moddé" : "vanilla"} sur Omniscient.`;
  // Banniere/icone propres au serveur quand il en a une, sinon l'image de
  // marque par defaut — un openGraph defini ici remplace entierement celui
  // du layout racine (voir @/lib/seo.ts), elle doit donc etre redonnee a la main.
  const ogImage = server.bannerUrl || server.iconUrl || DEFAULT_OG_IMAGE;
  const twitterImage = server.bannerUrl || server.iconUrl || DEFAULT_TWITTER_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: `/servers/${slug}` },
    openGraph: {
      type: "website",
      url: `/servers/${slug}`,
      // Voir meme remarque que servers/page.tsx : openGraph du layout racine
      // est remplace, pas fusionne, donc siteName/locale sont repetes ici.
      siteName: "Omniscient",
      locale: "fr_FR",
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterImage],
    },
  };
}

// Régénère la page au plus toutes les 60s : aligné sur la fraîcheur du
// ping (voir SERVER_STATUS_TTL_MS) plutôt que de rester figé en cache.
export const revalidate = 60;

// Sans preuve : un serveur prive n'a pas de fiche ici (404).
export default async function ServerDetailPage({ params }: PageProps<"/servers/[slug]">) {
  const { slug } = await params;

  const server = await getPublicServerBySlug(slug);
  if (!server) notFound();

  return <ServerDetailView slug={slug} server={server} />;
}
