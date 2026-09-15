import { ServerCard } from "@/components/ServerCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { listPublicServers } from "@/lib/public-servers";

export const metadata = { title: "Serveurs — MCHub" };

// Régénère la page au plus toutes les 60s : aligné sur la fraîcheur du
// ping (voir SERVER_STATUS_TTL_MS) plutôt que de rester figé en cache.
export const revalidate = 60;

export default async function ServersPage() {
  const servers = await listPublicServers();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <AutoRefresh intervalMs={30_000} />
      <h1 className="text-2xl font-bold text-foreground">Annuaire des serveurs</h1>
      <p className="mt-1 text-muted">
        {servers.length} serveur{servers.length === 1 ? "" : "s"} référencé{servers.length === 1 ? "" : "s"}.
      </p>

      {servers.length === 0 ? (
        <p className="mt-8 text-muted">Aucun serveur pour le moment — sois le premier à en publier un.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((server) => (
            <ServerCard key={server.slug} {...server} />
          ))}
        </div>
      )}
    </div>
  );
}
