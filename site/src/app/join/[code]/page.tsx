import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSlugByInviteCode } from "@/lib/public-servers";
import { checkRateLimit, clientIpFromHeadersList } from "@/lib/rateLimit";
import { getT } from "@/i18n/getDictionary";

// Destination du lien/code d'invitation affiche dans les reglages d'un
// serveur prive (voir ServerForm.tsx) — un simple redirect vers la fiche
// publique habituelle : le code ne fait que prouver qu'on a le droit de
// voir une fiche que l'annuaire ne liste jamais (voir listPublicServers).
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
  redirect(`/servers/${slug}`);
}
