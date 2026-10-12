import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { ServerCard } from "@/components/ServerCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { listPublicServersPage, type ServerListSort } from "@/lib/public-servers";
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
  const q = typeof query.q === "string" ? query.q : "";
  const sortParam = typeof query.sort === "string" ? query.sort : "recent";
  const { dict } = await getT();

  const SORTS: { value: ServerListSort; label: string }[] = [
    { value: "recent", label: dict.servers.sortRecent },
    { value: "popular", label: dict.servers.sortPopular },
    { value: "az", label: dict.servers.sortAz },
  ];
  const sort: ServerListSort = SORTS.some((s) => s.value === sortParam) ? (sortParam as ServerListSort) : "recent";

  const pageParam = typeof query.page === "string" ? Number.parseInt(query.page, 10) : 1;
  const { servers, total, page, pageCount } = await listPublicServersPage({ q, sort, page: pageParam });

  // Lien vers une autre page en gardant la recherche et le tri.
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort !== "recent") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/servers?${qs}` : "/servers";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <AutoRefresh intervalMs={30_000} />
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{dict.servers.title}</h1>
      <p className="mt-1 text-muted">
        {t(dict, total === 1 ? "servers.count" : "servers.countPlural", { count: total })}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action="/servers" method="GET" className="flex w-full gap-2 sm:max-w-sm">
          <div className="field-with-icon min-w-0 flex-1">
            <MagnifyingGlass className="h-4 w-4" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={dict.servers.searchPlaceholder}
              className="field-input w-full"
            />
          </div>
          <input type="hidden" name="sort" value={sort} />
          <button type="submit" className="btn-secondary text-sm flex-shrink-0">
            {dict.servers.search}
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={`/servers?sort=${s.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={s.value === sort ? "btn-secondary text-sm" : "btn-secondary text-sm opacity-60"}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="panel mt-8 p-8 text-center text-muted">
          {q ? t(dict, "servers.emptyQuery", { query: q }) : dict.servers.emptyNoQuery}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3">
          {servers.map((server) => (
            <ServerCard key={server.slug} {...server} />
          ))}
        </div>
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
