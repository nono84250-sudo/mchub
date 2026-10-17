import Link from "next/link";
import { ServerStatus } from "@/components/ServerStatus";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import type { PageLanguage, PageTag } from "@/lib/serverPage";

type ServerCardProps = {
  slug: string;
  name: string;
  description: string;
  bannerUrl: string | null;
  iconUrl: string | null;
  type: "vanilla" | "modded";
  playerCount: number | null;
  playerCapacity: number | null;
  // Filtres de l'annuaire (2026-10-16) : affiches sur la carte pour qu'un filtre se comprenne.
  tags?: PageTag[];
  languages?: PageLanguage[];
  minecraftVersion?: string;
  modpackName?: string | null;
  recommendedRamGB?: number | null;
  isNew?: boolean;
};

// Carte horizontale (image a gauche, contenu a droite) — plus lisible en
// liste qu'une grille de cartes verticales, et laisse assez de place au
// texte pour ne pas tronquer la description trop tot.
// Taille imposee (16/10, demande de Rushi) : toutes les cartes font 144 px de haut, bannière
// 128 x 144 (192 x 144 des 640 px), recadree en object-cover quelle que soit sa taille. Les
// etiquettes restent sur la ligne du titre (coupees si trop longues) : aucune ligne en plus.
export async function ServerCard({
  slug,
  name,
  description,
  bannerUrl,
  iconUrl,
  type,
  playerCount,
  playerCapacity,
  tags = [],
  languages = [],
  minecraftVersion,
  modpackName,
  recommendedRamGB,
  isNew = false,
}: ServerCardProps) {
  const { dict } = await getT();

  return (
    <Link
      href={`/servers/${slug}`}
      className="panel glow-card group flex h-36 overflow-hidden"
    >
      <div className="relative h-full w-32 flex-shrink-0 overflow-hidden banner-placeholder sm:w-48">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span
          className={`absolute top-2 right-2 z-[1] rounded-md px-2 py-0.5 text-xs font-medium backdrop-blur ${
            type === "modded" ? "tag-chip-accent" : "tag-chip-outline"
          }`}
        >
          {type === "modded" ? dict.servers.modded : dict.servers.vanilla}
        </span>
      </div>
      <div className="flex flex-1 min-w-0 flex-col gap-1.5 overflow-hidden p-4">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
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
          {isNew ? <span className="tag-chip tag-chip-accent flex-shrink-0 text-[11px]">{dict.servers.newBadge}</span> : null}
          {tags.length || languages.length ? (
            <span className="hidden min-w-0 shrink-[10] items-center gap-1.5 overflow-hidden sm:flex">
              {tags.slice(0, 2).map((tag) => (
                <span key={tag} className="tag-chip shrink-0 text-[11px]">
                  {dict.serverPage.tags[tag]}
                </span>
              ))}
              {tags.length > 2 ? <span className="tag-chip shrink-0 text-[11px] hidden sm:inline-flex">+{tags.length - 2}</span> : null}
              {languages.map((lang) => (
                <span key={lang} className="tag-chip tag-chip-outline shrink-0 font-mono text-[11px] uppercase">
                  {lang}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        {minecraftVersion ? (
          <p className="truncate text-xs text-muted">
            {[type === "modded" ? modpackName : null, minecraftVersion, type === "modded" && recommendedRamGB ? t(dict, "servers.ramAdvised", { count: recommendedRamGB }) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <p className="truncate text-sm text-muted">{description}</p>
        <div className="mt-auto">
          <ServerStatus playerCount={playerCount} playerCapacity={playerCapacity} />
        </div>
      </div>
    </Link>
  );
}
