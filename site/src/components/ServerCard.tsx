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
      <div className="relative h-32 w-full banner-placeholder flex items-end">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="relative z-[1] w-full px-3 pb-2.5 pt-6 text-sm font-semibold text-foreground"
            style={{ backgroundImage: "linear-gradient(to top, rgba(7,12,22,0.85), transparent)" }}
          >
            {name}
          </div>
        )}
        <span
          className={`absolute top-2 right-2 z-[1] rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur ${
            type === "modded"
              ? "bg-[image:var(--gradient-brand)] text-accent-foreground"
              : "bg-surface-raised/80 text-muted border border-border"
          }`}
        >
          {type === "modded" ? "Moddé" : "Vanilla"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span className="server-icon h-6 w-6 text-xs">{name.trim().charAt(0).toUpperCase() || "?"}</span>
          <h3 className="font-heading font-semibold text-foreground group-hover:text-accent transition-colors">
            {name}
          </h3>
        </div>
        <p className="text-sm text-muted line-clamp-2">{description}</p>
        <div className="mt-auto">
          <ServerStatus playerCount={playerCount} playerCapacity={playerCapacity} />
        </div>
      </div>
    </Link>
  );
}
