import Link from "next/link";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import type { PageLanguage, PageTag } from "@/lib/serverPage";
import { getTagCatalog } from "@/lib/tagRequests";
import { tagName } from "@/lib/tagCatalog";
import { fallbackBanner } from "@/lib/fallbackBanner";
import { STATE_COLOR, bandColor, gaugePercent, serverState } from "@/lib/playerGauge";
import { ServerStatePill } from "@/components/ServerStatePill";
import { ManualModsBadge } from "@/components/ManualModsBadge";
import { TeamAvatar } from "@/components/TeamAvatar";
import type { TeamBadge } from "@/lib/teamRules";

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
  // Contacte au moins une fois : sans reponse, le serveur est « ferme » (sinon « inconnu »).
  pinged?: boolean;
  // Lot 5 (18/10) : mods a ajouter a la main (badge bleu).
  manualModsCount?: number;
  // Teams (19/10) : « par [icone] X » / « proposé par Omniscient » a cote du nom. Pas de lien :
  // toute la carte en est deja un (la page de team est sur la fiche).
  team?: TeamBadge | null;
};

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// Carte horizontale (image a gauche, contenu a droite) — plus lisible en
// liste qu'une grille de cartes verticales.
// Taille imposee (16/10, demande de Rushi) : toutes les cartes font 144 px de haut des 640 px
// (bannière 192 x 144), recadree en object-cover quelle que soit sa taille.
// Design 2026-10-17, point 4 : les joueurs en ligne passent dans une colonne a
// droite, en gros, avec une jauge comparee a la capacite DU serveur (5 sur 20
// = un quart : un petit serveur ne parait pas vide). Statut inconnu : un tiret
// et un mot, jamais juste une couleur. Version, Moddé, modpack et memoire en
// pastilles. Sur telephone, les joueurs passent sur une ligne sous la description.
export async function ServerCard({
  slug,
  name,
  description,
  bannerUrl,
  iconUrl,
  type,
  playerCount,
  playerCapacity,
  tags: rawTags = [],
  languages = [],
  minecraftVersion,
  modpackName,
  recommendedRamGB,
  isNew = false,
  pinged = true,
  manualModsCount = 0,
  team = null,
}: ServerCardProps) {
  const [{ dict, locale }, { custom }] = await Promise.all([getT(), getTagCatalog()]);
  // Etiquettes ajoutees par l'equipe comprises (liste en cache) ; une etiquette inconnue n'est pas montree.
  const tags = rawTags.map((tag) => ({ tag, name: tagName(tag, locale, custom) })).filter((x) => x.name);
  const modded = type === "modded";
  const online = playerCount !== null;
  // Etat (variante C, 17/10) : bande de couleur en haut, pastille pres du nom, jauge.
  const state = serverState(playerCount, playerCapacity, pinged);
  const color = STATE_COLOR[state];
  const pct = gaugePercent(playerCount, playerCapacity);
  const stateWord = state === "warn" || state === "full" ? dict.servers.state[state] : null;

  const players = (compact: boolean) =>
    online ? (
      <>
        <b className={`font-bold leading-none tracking-tight tabular-nums text-foreground ${compact ? "text-xl" : "text-[30px] min-[1500px]:text-2xl"}`}>{playerCount}</b>
        <small className="whitespace-nowrap text-xs text-muted tabular-nums">
          {playerCapacity !== null ? t(dict, "servers.ofCapacity", { count: playerCapacity }) : dict.servers.playersOnlineShort}
        </small>
        {pct !== null ? (
          <span aria-hidden="true" className={`block h-[5px] overflow-hidden rounded-full bg-foreground/10 ${compact ? "w-[60px] self-center" : "mt-[3px] w-[78px] max-w-full min-[1500px]:w-[72px]"}`}>
            <span className="block h-full max-w-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </span>
        ) : null}
        {stateWord ? (
          <small className="whitespace-nowrap text-[11px] font-semibold" style={{ color }}>
            {stateWord}
          </small>
        ) : null}
      </>
    ) : (
      <>
        <b className={`font-bold leading-none text-muted ${compact ? "text-xl" : "text-[30px]"}`}>—</b>
        <small className="whitespace-nowrap text-xs font-semibold" style={{ color }}>
          {state === "off" ? dict.servers.state.off : dict.servers.unknownStatus}
        </small>
      </>
    );

  return (
    <Link
      href={`/servers/${slug}`}
      className="panel card-calm group relative flex min-h-32 sm:h-36 min-[1500px]:h-[124px]"
    >
      {bandColor(state) ? (
        <span aria-hidden="true" className="absolute inset-x-0 top-0 z-[2] h-1 rounded-t-[0.875rem]" style={{ background: bandColor(state)! }} />
      ) : null}
      <div
        className="relative w-[104px] flex-shrink-0 overflow-hidden rounded-l-[0.875rem] sm:w-48 min-[1500px]:w-[130px]"
        style={bannerUrl ? undefined : { background: fallbackBanner(name) }}
      >
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center px-3 text-center text-[22px] font-extrabold leading-tight tracking-wide text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.35)]"
          >
            <span className="sm:hidden">{initials(name)}</span>
            <span className="hidden line-clamp-2 break-words sm:[display:-webkit-box]">{name.toUpperCase()}</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 min-w-0 flex-col gap-1.5 px-3 py-2.5 sm:px-4 sm:py-3.5 min-[1500px]:py-2.5">
        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
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
          {team ? (
            <span className="inline-flex min-w-0 shrink-[4] items-center gap-1 overflow-hidden text-xs text-muted">
              <span className="truncate">{team.official ? dict.team.proposedBy.toLowerCase() : dict.servers.byTeam}</span>
              <TeamAvatar team={team} size={14} />
              <span className="truncate font-medium text-foreground">{team.name}</span>
            </span>
          ) : null}
          <ServerStatePill state={state} count={playerCount} capacity={playerCapacity} />
          <ManualModsBadge count={manualModsCount} />
          {isNew ? <span className="tag-chip tag-chip-accent flex-shrink-0 text-[11px]">{dict.servers.newBadge}</span> : null}
          {tags.length || languages.length ? (
            <span className="hidden min-w-0 shrink-[10] items-center gap-1.5 overflow-hidden sm:flex">
              {tags.slice(0, 2).map(({ tag, name }) => (
                <span key={tag} className="tag-chip shrink-0 text-[11px]">
                  {name}
                </span>
              ))}
              {tags.length > 2 ? <span className="tag-chip shrink-0 text-[11px]">+{tags.length - 2}</span> : null}
              {languages.map((lang) => (
                <span key={lang} className="tag-chip tag-chip-outline shrink-0 font-mono text-[11px] uppercase">
                  {lang}
                </span>
              ))}
            </span>
          ) : null}
        </div>

        <div className="flex max-h-[22px] flex-wrap gap-1.5 overflow-hidden max-sm:max-h-none sm:group-hover:hidden sm:group-focus-visible:hidden">
          {minecraftVersion ? <span className="tag-chip font-mono text-[11px]">{minecraftVersion}</span> : null}
          {modded ? (
            <>
              <span className="tag-chip tag-chip-accent text-[11px]">{dict.servers.modded}</span>
              {modpackName ? <span className="tag-chip text-[11px]">{modpackName}</span> : null}
              {recommendedRamGB ? (
                <span className="tag-chip text-[11px]">{t(dict, "servers.ramShort", { count: recommendedRamGB })}</span>
              ) : null}
            </>
          ) : (
            <span className="tag-chip text-[11px]">{dict.servers.vanilla}</span>
          )}
        </div>

        <p className="text-sm text-muted truncate max-sm:whitespace-normal max-sm:line-clamp-2 max-sm:text-[13px] sm:group-hover:whitespace-normal sm:group-hover:line-clamp-2 sm:group-focus-visible:whitespace-normal sm:group-focus-visible:line-clamp-2">
          {description}
        </p>
        {/* Survol ou clavier (design 2026-10-17, point 5) : liseré bleu, description sur 2 lignes
            et bouton Voir, sans mouvement. Pas de survol sur telephone. */}
        <span aria-hidden="true" className="btn-primary hidden self-start px-3 py-1 text-[13px] sm:group-hover:inline-flex sm:group-focus-visible:inline-flex">
          {dict.servers.viewPage} →
        </span>

        <div className="flex items-baseline gap-1.5 sm:hidden">{players(true)}</div>
      </div>

      <div className="hidden w-[116px] flex-shrink-0 flex-col items-end justify-center gap-[3px] overflow-hidden border-l border-border px-4 sm:flex min-[1500px]:w-24 min-[1500px]:px-3">
        {players(false)}
      </div>
    </Link>
  );
}
