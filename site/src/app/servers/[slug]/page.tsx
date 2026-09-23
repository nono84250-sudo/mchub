import { notFound } from "next/navigation";
import { getPublicServerBySlug } from "@/lib/public-servers";
import { ServerStatus } from "@/components/ServerStatus";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ViewTracker } from "@/components/ViewTracker";
import { getT } from "@/i18n/getDictionary";

export async function generateMetadata({ params }: PageProps<"/servers/[slug]">) {
  const { slug } = await params;
  const server = await getPublicServerBySlug(slug);
  return { title: server ? `${server.name} — Omniscient` : "Serveur introuvable — Omniscient" };
}

// Régénère la page au plus toutes les 60s : aligné sur la fraîcheur du
// ping (voir SERVER_STATUS_TTL_MS) plutôt que de rester figé en cache.
export const revalidate = 60;

export default async function ServerDetailPage({ params }: PageProps<"/servers/[slug]">) {
  const { slug } = await params;

  const server = await getPublicServerBySlug(slug);
  if (!server) notFound();
  const { dict } = await getT();

  return (
    <div className="relative">
      {server.backgroundUrl ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={server.backgroundUrl} alt="" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      ) : null}

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <AutoRefresh intervalMs={30_000} />
        <ViewTracker slug={slug} />
        <div className="relative h-48 w-full mb-9">
        <div className="absolute inset-0 overflow-hidden rounded-xl banner-placeholder">
          {server.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={server.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <span className="server-icon absolute -bottom-6 left-5 h-14 w-14 overflow-hidden border-4 border-background text-2xl">
          {server.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={server.iconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            server.name.trim().charAt(0).toUpperCase() || "?"
          )}
        </span>
      </div>

      <div className="pl-[72px] min-h-[34px]">
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">{server.name}</h1>
        <div className="mt-1">
          <ServerStatus playerCount={server.playerCount} playerCapacity={server.playerCapacity} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="stat-tile">
          <div className="stat-label">{dict.serverDetail.version}</div>
          <div className="stat-value">Minecraft {server.minecraftVersion}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">{dict.serverDetail.type}</div>
          <div className="stat-value">{server.type === "modded" ? dict.servers.modded : dict.servers.vanilla}</div>
        </div>
        {server.recommendedRamGB ? (
          <div className="stat-tile">
            <div className="stat-label">{dict.serverDetail.recommendedRam}</div>
            <div className="stat-value">
              {server.recommendedRamGB} {dict.serverDetail.ramUnit}
            </div>
          </div>
        ) : null}
      </div>

      {server.type === "modded" && server.curseforgeModpackName ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="tag-chip">
            {server.curseforgeModpackName}
            {server.curseforgeModpackVersion ? ` — ${server.curseforgeModpackVersion}` : ""}
          </span>
        </div>
      ) : null}

      <p className="mt-6 text-foreground whitespace-pre-wrap">{server.description}</p>

      <div className="mt-8 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
        {dict.serverDetail.joinNote}
      </div>
      </div>
    </div>
  );
}
