import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { ServerCard } from "@/components/ServerCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { listPublicServers, type ServerListSort } from "@/lib/public-servers";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Serveurs — Omniscient" };

// Régénère la page au plus toutes les 60s : aligné sur la fraîcheur du
// ping (voir SERVER_STATUS_TTL_MS) plutôt que de rester figé en cache.
export const revalidate = 60;

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

  const servers = await listPublicServers({ q, sort });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <AutoRefresh intervalMs={30_000} />
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{dict.servers.title}</h1>
      <p className="mt-1 text-muted">
        {(servers.length === 1 ? dict.servers.count : dict.servers.countPlural).replace("{count}", String(servers.length))}
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
          {q ? dict.servers.emptyQuery.replace("{query}", q) : dict.servers.emptyNoQuery}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3">
          {servers.map((server) => (
            <ServerCard key={server.slug} {...server} />
          ))}
        </div>
      )}
    </div>
  );
}
