import Link from "next/link";
import { ServerCard } from "@/components/ServerCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ServerDirectoryFilters, ServerFiltersEmpty } from "@/components/ServerDirectoryFilters";
import { listPublicServersPage } from "@/lib/public-servers";
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
  const { servers, total, directoryTotal, page, pageCount, filters, facets, blocking } = await listPublicServersPage({ ...requested, page: pageParam });

  // Lien vers une autre page en gardant la recherche, les filtres et le tri.
  const pageHref = (p: number) => `/servers${filtersToSearch(filters, p)}`;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <AutoRefresh intervalMs={30_000} />
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{dict.servers.title}</h1>
      <p className="mt-1 text-muted">
        {t(dict, directoryTotal === 1 ? "servers.count" : "servers.countPlural", { count: directoryTotal })}
      </p>

      {directoryTotal === 0 ? (
        <div className="panel mt-8 p-8 text-center text-muted">{dict.servers.emptyNoQuery}</div>
      ) : (
        <>
          <ServerDirectoryFilters filters={filters} facets={facets} total={total} />
          {servers.length === 0 ? (
            <ServerFiltersEmpty filters={filters} blocking={blocking} />
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3">
              {servers.map((server) => (
                <ServerCard key={server.slug} {...server} />
              ))}
            </div>
          )}
        </>
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
