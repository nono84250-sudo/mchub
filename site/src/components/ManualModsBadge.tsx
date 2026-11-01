import { PuzzlePiece } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";

// Badge bleu « 2 mods a ajouter » (lot 5, 18/10) : a cote de la pastille d'etat, sur les cartes
// de l'annuaire et la fiche. Toujours la couleur d'accent, jamais rouge : le serveur marche, le
// launcher guide le joueur pas a pas. Bulle au survol, meme style que ServerStatePill.
export async function ManualModsBadge({ count }: { count: number }) {
  if (!count) return null;
  const { dict } = await getT();
  const label = t(dict, count === 1 ? "servers.manualModsBadgeOne" : "servers.manualModsBadge", { count });
  const tip = t(dict, "servers.manualModsTip", { count });

  return (
    <span
      className="group/mods relative inline-flex flex-shrink-0 cursor-help items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-[11.5px] font-semibold"
      style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
      aria-label={`${label}. ${tip}`}
    >
      <PuzzlePiece className="h-3 w-3" weight="bold" aria-hidden="true" />
      {label}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-max max-w-[240px] -translate-x-1/2 whitespace-normal rounded-lg border border-white/15 bg-[#0e0f16] px-2.5 py-2 text-left text-xs font-normal leading-snug text-[#f1f1f4] opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.4)] transition-opacity group-hover/mods:opacity-100"
      >
        {tip}
      </span>
    </span>
  );
}
