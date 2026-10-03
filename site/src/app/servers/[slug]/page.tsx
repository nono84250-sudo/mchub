import { notFound } from "next/navigation";
import { getPublicServerBySlug } from "@/lib/public-servers";
import { ServerDetailView } from "@/components/ServerDetailView";

export async function generateMetadata({ params }: PageProps<"/servers/[slug]">) {
  const { slug } = await params;
  const server = await getPublicServerBySlug(slug);
  return { title: server ? `${server.name} — Omniscient` : "Serveur introuvable — Omniscient" };
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
