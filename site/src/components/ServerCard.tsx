import Link from "next/link";
import { ServerStatus } from "@/components/ServerStatus";

type ServerCardProps = {
  slug: string;
  name: string;
  description: string;
  bannerUrl: string | null;
  iconUrl: string | null;
  type: "vanilla" | "modded";
  playerCount: number | null;
  playerCapacity: number | null;
};

// Carte horizontale (image a gauche, contenu a droite) — plus lisible en
// liste qu'une grille de cartes verticales, et laisse assez de place au
// texte pour ne pas tronquer la description trop tot.
export function ServerCard({ slug, name, description, bannerUrl, iconUrl, type, playerCount, playerCapacity }: ServerCardProps) {
  return (
    <Link
      href={`/servers/${slug}`}
      className="glow-card group flex overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className="relative h-auto w-32 flex-shrink-0 banner-placeholder sm:w-48">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span
          className={`absolute top-2 right-2 z-[1] rounded-md px-2 py-0.5 text-xs font-medium backdrop-blur ${
            type === "modded" ? "tag-chip-accent" : "tag-chip-outline"
          }`}
        >
          {type === "modded" ? "Moddé" : "Vanilla"}
        </span>
      </div>
      <div className="flex flex-1 min-w-0 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span className="server-icon h-6 w-6 flex-shrink-0 overflow-hidden text-xs">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              name.trim().charAt(0).toUpperCase() || "?"
            )}
          </span>
          <h3 className="min-w-0 truncate font-heading font-semibold text-foreground group-hover:text-accent transition-colors">
            {name}
          </h3>
        </div>
        <p className="text-sm text-muted line-clamp-2 sm:line-clamp-3">{description}</p>
        <div className="mt-auto">
          <ServerStatus playerCount={playerCount} playerCapacity={playerCapacity} />
        </div>
      </div>
    </Link>
  );
}
