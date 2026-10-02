import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicServerBySlug, getSlugByInviteCode } from "@/lib/public-servers";
import { checkRateLimit, clientIpFromHeadersList } from "@/lib/rateLimit";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";

// Destination du lien/code d'invitation affiche dans les reglages d'un
// serveur prive (voir ServerForm.tsx) : avant un simple redirect vers la
// fiche publique, desormais une petite page qui propose d'abord d'ouvrir le
// launcher via le protocole omniscient:// (voir launcher/src/main.js,
// app.setAsDefaultProtocolClient) — la fiche publique reste le repli pour
// qui n'a pas encore le launcher, ou n'est pas sur ce poste. Le code ne fait
// toujours que prouver qu'on a le droit de voir une fiche que l'annuaire ne
// liste jamais (voir listPublicServers) ; rien de plus secret n'est ajoute ici.
//
// Limitation de débit (voir audit de sécurité du 2026-09-28), inchangee :
// c'était la seule route publique du projet sans frein contre le devinage —
// l'alphabet du code (32 caractères, 5 positions) est solide en soi, mais
// seulement avec une limite qui empêche un script d'en essayer des milliers
// d'affilée. Pas de vraie réponse 429 possible ici (une page, pas une route
// API) : on affiche un message et on n'essaie pas le code au-delà de la limite.
export default async function JoinByInviteCodePage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;

  const headersList = await headers();
  const { limited } = checkRateLimit(`join:${clientIpFromHeadersList(headersList)}`, 20);
  if (limited) {
    const { dict } = await getT();
    return <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted">{dict.servers.joinTooManyAttempts}</div>;
  }

  const upperCode = code.toUpperCase();
  const slug = await getSlugByInviteCode(upperCode);
  if (!slug) notFound();

  const [server, { dict }] = await Promise.all([getPublicServerBySlug(slug), getT()]);
  if (!server) notFound();

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-20 text-center">
      <span className="server-icon mx-auto h-14 w-14 text-2xl">
        {server.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={server.iconUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          server.name.trim().charAt(0).toUpperCase() || "?"
        )}
      </span>

      <h1 className="mt-4 text-2xl font-heading font-bold tracking-tight text-foreground">
        {t(dict, "servers.joinTitle", { name: server.name })}
      </h1>
      <p className="mt-2 text-muted">{dict.servers.joinSubtitle}</p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <a href={`omniscient://join/${upperCode}`} className="btn-primary text-base px-6 py-3">
          {dict.servers.joinOpenInLauncher}
        </a>
        <p className="text-xs text-muted">
          {dict.servers.joinFallback}{" "}
          <Link href={`/servers/${slug}`} className="text-accent hover:underline underline-offset-2">
            {dict.servers.joinFallbackLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
