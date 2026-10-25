import { fallbackBanner } from "@/lib/fallbackBanner";
import { teamInitials, type TeamBadge } from "@/lib/teamRules";

// Icone d'une team (teams, 19/10) : la meme partout (fiche, cartes, page de team, Ma team).
// Sans icone : les initiales sur un carre de couleur calcule a partir du nom.
export function TeamAvatar({ team, size = 18, className = "" }: { team: Pick<TeamBadge, "name" | "iconUrl">; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-[22%] font-bold leading-none text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.42)), background: team.iconUrl ? undefined : fallbackBanner(team.name) }}
    >
      {team.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.iconUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        teamInitials(team.name)
      )}
    </span>
  );
}
