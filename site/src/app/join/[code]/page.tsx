import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicServerBySlug, getSlugByInviteCode } from "@/lib/public-servers";
import { checkRateLimit, clientIpFromHeadersList } from "@/lib/rateLimit";
import { getT } from "@/i18n/getDictionary";
import { ServerDetailView } from "@/components/ServerDetailView";

// Fiche du serveur prive rejoint par ce code : le code lui-meme est la preuve
// (voir canSeeServer dans public-servers.ts), donc on affiche la fiche ici au
// lieu de rediriger vers /servers/[slug], qui ne montre pas les serveurs prives.
//
// Limitation de débit (voir audit de sécurité du 2026-09-28) : c'était la
// seule route publique du projet sans frein contre le devinage — l'alphabet
// du code (32 caractères, 5 positions) est solide en soi, mais seulement
// avec une limite qui empêche un script d'en essayer des milliers d'affilée.
// Pas de vraie réponse 429 possible ici (une page, pas une route API) : on
// affiche un message et on n'essaie pas le code au-delà de la limite.
export default async function JoinByInviteCodePage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;

  const headersList = await headers();
  const { limited } = checkRateLimit(`join:${clientIpFromHeadersList(headersList)}`, 20);
  if (limited) {
    const { dict } = await getT();
    return <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted">{dict.servers.joinTooManyAttempts}</div>;
  }

  const slug = await getSlugByInviteCode(code.toUpperCase());
  if (!slug) notFound();
  const server = await getPublicServerBySlug(slug, { inviteCode: code });
  if (!server) notFound();
  return <ServerDetailView slug={slug} server={server} />;
}
