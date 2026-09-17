import Link from "next/link";
import { ServerStatus } from "@/components/ServerStatus";

type ServerCardProps = {
  slug: string;
  name: string;
  description: string;
  bannerUrl: string | null;
  type: "vanilla" | "modded";
  playerCount: number | null;
  playerCapacity: number | null;
};

export function ServerCard({ slug, name, description, bannerUrl, type, playerCount, playerCapacity }: ServerCardProps) {
  return (
    <Link
      href={`/servers/${slug}`}
      className="glow-card group flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className="relative h-32 w-full banner-placeholder">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-medium text-foreground/70">
            {name}
          </div>
        )}
        <span
          className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur ${
            type === "modded"
              ? "bg-accent/90 text-accent-foreground"
              : "bg-surface-raised/80 text-muted border border-border"
          }`}
        >
          {type === "modded" ? "Moddé" : "Vanilla"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">{name}</h3>
        <p className="text-sm text-muted line-clamp-2">{description}</p>
        <div className="mt-auto">
          <ServerStatus playerCount={playerCount} playerCapacity={playerCapacity} />
        </div>
      </div>
    </Link>
  );
}
