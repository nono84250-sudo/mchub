import { notFound, permanentRedirect } from "next/navigation";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import { ServerCard } from "@/components/ServerCard";
import { TeamAvatar } from "@/components/TeamAvatar";
import { listTeamServers } from "@/lib/public-servers";
import { findTeamBySlug } from "@/lib/teams";

// Page de team (teams, 19/10) : icone, nom, description et serveurs publics de la team. Un appel
// D1 en cache 5 minutes (findTeamBySlug) ; les serveurs viennent de la liste deja en cache de
// l'annuaire, dans le meme ordre que lui (aucun avantage pour une team). Un ancien nom encore
// bloque (30 jours apres un changement) redirige vers le nouveau lien.
export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/team/[slug]">) {
  const { slug } = await params;
  const found = await findTeamBySlug(slug);
  if (!found || !("team" in found)) return { title: "Team introuvable — Omniscient", robots: { index: false, follow: false } };
  return {
    title: `${found.team.name} — Omniscient`,
    description: found.team.description ?? undefined,
    alternates: { canonical: `/team/${found.team.slug}` },
  };
}

export default async function TeamPage({ params }: PageProps<"/team/[slug]">) {
  const { slug } = await params;
  const found = await findTeamBySlug(slug);
  if (!found) notFound();
  if ("redirectTo" in found) permanentRedirect(`/team/${found.redirectTo}`);
  const { team } = found;
  const [{ dict }, servers] = await Promise.all([getT(), listTeamServers(team.slug)]);
  const countLabel =
    servers.length === 0 ? dict.team.pageServersNone : servers.length === 1 ? dict.team.pageServersOne : t(dict, "team.pageServers", { count: servers.length });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex items-start gap-4">
        <TeamAvatar team={team} size={64} className="text-2xl" />
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground [text-wrap:balance]">{team.name}</h1>
          <p className="mt-1 text-sm text-muted">{countLabel}</p>
          {team.description || team.official ? (
            <p className="mt-3 max-w-2xl text-foreground">{team.description || dict.team.officialFallback}</p>
          ) : null}
        </div>
      </div>
      {servers.length ? (
        <div className="mt-8 grid grid-cols-1 gap-3 min-[1500px]:grid-cols-2">
          {servers.map((server) => (
            <ServerCard key={server.slug} {...server} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
