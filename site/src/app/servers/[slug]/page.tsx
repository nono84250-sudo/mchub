import { notFound } from "next/navigation";
import { getPublicServerBySlug } from "@/lib/public-servers";
import { ServerStatus } from "@/components/ServerStatus";
import { AutoRefresh } from "@/components/AutoRefresh";

export async function generateMetadata({ params }: PageProps<"/servers/[slug]">) {
  const { slug } = await params;
  const server = await getPublicServerBySlug(slug);
  return { title: server ? `${server.name} — MCHub` : "Serveur introuvable — MCHub" };
}

// Régénère la page au plus toutes les 60s : aligné sur la fraîcheur du
// ping (voir SERVER_STATUS_TTL_MS) plutôt que de rester figé en cache.
export const revalidate = 60;

export default async function ServerDetailPage({ params }: PageProps<"/servers/[slug]">) {
  const { slug } = await params;

  const server = await getPublicServerBySlug(slug);
  if (!server) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <AutoRefresh intervalMs={30_000} />
      <div className="relative h-48 w-full overflow-hidden rounded-xl banner-placeholder">
        {server.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={server.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-semibold text-foreground/70">
            {server.name}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{server.name}</h1>
          <p className="mt-1 text-muted">Minecraft {server.minecraftVersion}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            server.type === "modded" ? "bg-accent text-accent-foreground" : "border border-border text-muted"
          }`}
        >
          {server.type === "modded" ? "Moddé" : "Vanilla"}
        </span>
      </div>

      <p className="mt-6 text-foreground whitespace-pre-wrap">{server.description}</p>

      {server.type === "modded" && server.curseforgeModpackName ? (
        <div className="panel mt-6 p-4">
          <p className="text-sm text-muted">Modpack CurseForge</p>
          <p className="mt-1 font-medium text-foreground">
            {server.curseforgeModpackName}
            {server.curseforgeModpackVersion ? ` — ${server.curseforgeModpackVersion}` : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        <ServerStatus playerCount={server.playerCount} playerCapacity={server.playerCapacity} />
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
        Pour rejoindre ce serveur, ouvre-le depuis le launcher MCHub — l&apos;adresse de connexion
        n&apos;est pas affichée ici.
      </div>
    </div>
  );
}
