import Link from "next/link";
import { teamsPublic, withoutTeam } from "@/lib/features";
import { unstable_rethrow } from "next/navigation";
import { ErrorBlock } from "@/components/ErrorBlock";
import { ServerCard } from "@/components/ServerCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ServerDirectoryFilters, ServerFiltersEmpty } from "@/components/ServerDirectoryFilters";
import { DirectoryLoadingProvider, DirectoryResults } from "@/components/DirectoryLoading";
import { ServerStateLegend } from "@/components/ServerStateLegend";
import { listPublicServersPage } from "@/lib/public-servers";
import { getTagCatalog } from "@/lib/tagRequests";
import { filtersToSearch, parseFilters } from "@/lib/serverFilters";
import { DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";

const TITLE = "Serveurs — Omniscient";
const DESCRIPTION = "Parcourez l'annuaire Omniscient : des serveurs Minecraft vanilla et moddés, avec leur nombre de joueurs en direct, à lancer en un clic.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/servers" },
  openGraph: {
    type: "website",
    url: "/servers",
    // siteName/locale repetes ici : un openGraph defini au niveau de la page
    // remplace entierement celui du layout racine (merge "shallow", pas de
    // fusion champ par champ — voir generateMetadata.md "Merging").
    siteName: "Omniscient",
    locale: "fr_FR",
    title: TITLE,
    description: DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export default async function ServersPage({ searchParams }: PageProps<"/servers">) {
  const query = await searchParams;
  const requested = parseFilters(query);
  const { dict } = await getT();
  const pageParam = typeof query.page === "string" ? Number.parseInt(query.page, 10) : 1;

  // Idee 1 du lancement (19/10) : si la base ne repond pas, seule la liste est remplacee par un
  // bloc « Reessayer » ; le titre, la barre du haut et le pied de page restent.
  let data;
  try {
    const [{ custom }, list, showTeams] = await Promise.all([getTagCatalog(), listPublicServersPage({ ...requested, page: pageParam }), teamsPublic()]);
    // Laboratoire : sans « Ma team » ouverte à tous, ni team sur les cartes ni filtre Team.
    data = showTeams
      ? { customTags: custom, ...list }
      : { customTags: custom, ...list, servers: list.servers.map(withoutTeam), facets: { ...list.facets, teams: [] } };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return (
      <div className="mx-auto max-w-6xl min-[1500px]:max-w-[1400px] px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{dict.servers.title}</h1>
        <ErrorBlock title={dict.errorPage.listTitle} body={dict.errorPage.listBody} />
      </div>
    );
  }
  const { customTags, servers, total, directoryTotal, page, pageCount, filters, facets, blocking, countedAt } = data;

  // Lien vers une autre page en gardant la recherche, les filtres et le tri.
  const pageHref = (p: number) => `/servers${filtersToSearch(filters, p)}`;

  return (
    // Design 2026-10-17, point 5 : au-dela de 1500 px, deux colonnes de cartes (un seul
    // affichage a maintenir, pas de bouton liste/grille).
    <div className="mx-auto max-w-6xl min-[1500px]:max-w-[1400px] px-4 sm:px-6 py-12">
      <AutoRefresh intervalMs={30_000} />
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{dict.servers.title}</h1>
      <p className="mt-1 text-muted">
        {t(dict, directoryTotal === 1 ? "servers.count" : "servers.countPlural", { count: directoryTotal })}
      </p>

      {directoryTotal === 0 ? (
        <div className="panel mt-8 flex flex-col items-center gap-3 p-8 text-center text-muted">
          <p className="text-base font-semibold text-foreground">{dict.servers.emptyTitle}</p>
          <p>{dict.servers.emptyBody}</p>
          <Link href="/dashboard/servers/new" className="btn-fill">
            {dict.servers.emptyCta}
          </Link>
        </div>
      ) : (
        <DirectoryLoadingProvider>
          <ServerDirectoryFilters filters={filters} facets={facets} total={total} customTags={customTags} />
          <DirectoryResults>
            {servers.length === 0 ? (
              <ServerFiltersEmpty filters={filters} blocking={blocking} customTags={customTags} teams={facets.teams} />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-x-4">
                  {countedAt ? <CountedAgo at={countedAt} /> : <span />}
                  <ServerStateLegend />
                </div>
                <div className="grid grid-cols-1 gap-3 min-[1500px]:grid-cols-2">
                  {servers.map((server) => (
                    <ServerCard key={server.slug} {...server} />
                  ))}
                </div>
              </>
            )}
          </DirectoryResults>
        </DirectoryLoadingProvider>
      )}

      {pageCount > 1 ? (
        <nav className="mt-8 flex items-center justify-between gap-3" aria-label={t(dict, "servers.pageOf", { page, pageCount })}>
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn-secondary text-sm" rel="prev">
              {dict.servers.pagePrevious}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">{t(dict, "servers.pageOf", { page, pageCount })}</span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className="btn-secondary text-sm" rel="next">
              {dict.servers.pageNext}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

// « Joueurs comptes il y a 2 min » : calcule au moment d'afficher la page, sans
// rafraichissement en direct (la page se recharge deja toutes les 30 s, AutoRefresh).
async function CountedAgo({ at }: { at: string }) {
  const { dict } = await getT();
  // eslint-disable-next-line react-hooks/purity -- rendu serveur, une fois par affichage
  const minutes = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60_000));
  const text =
    minutes < 1
      ? dict.servers.countedNow
      : minutes < 60
        ? t(dict, minutes === 1 ? "servers.countedMinute" : "servers.countedMinutes", { count: minutes })
        : t(dict, "servers.countedHours", { count: Math.round(minutes / 60) });
  return (
    <p className="mb-3 flex items-center gap-1.5 text-[0.8rem] text-muted">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
      {text}
    </p>
  );
}
