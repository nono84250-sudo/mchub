import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react/ssr";
import { ServerHowToPlay } from "@/components/ServerHowToPlay";
import { ReadMoreText } from "@/components/ReadMoreText";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ViewTracker } from "@/components/ViewTracker";
import { ServerPageSections, type ServerPageLabels } from "@/components/ServerPageSections";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import type { Dictionary } from "@/i18n/getDictionary";
import { getFreshness } from "@/lib/freshness";
import { fallbackBanner } from "@/lib/fallbackBanner";
import { STATE_COLOR, bandColor, gaugePercent, serverState } from "@/lib/playerGauge";
import { ServerStatePill } from "@/components/ServerStatePill";
import { FitHeightIconRow } from "@/components/FitHeightIconRow";
import { ManualModsBadge } from "@/components/ManualModsBadge";
import { pageAccent, visibleSections, type ServerPageConfig } from "@/lib/serverPage";
import { listTeamServers, type PublicServerDetail } from "@/lib/public-servers";
import { TeamByline } from "@/components/TeamByline";
import { TeamAvatar } from "@/components/TeamAvatar";
import { getTagCatalog } from "@/lib/tagRequests";
import { tagName } from "@/lib/tagCatalog";

// Libelles des sections, lus une fois dans le dictionnaire (partages avec l'editeur).
export function serverPageLabels(dict: Dictionary): ServerPageLabels {
  return {
    sections: dict.serverPage.sections,
    video: dict.serverPage.video,
    social: dict.serverPage.social,
  };
}

// Couleur choisie par le proprietaire (proposee ou libre) : remplace l'accent et ses teintes
// derivees sur la fiche seulement, voir pageAccentVars.
export function accentProps(page: ServerPageConfig): { className: string; style: CSSProperties } {
  const accent = pageAccent(page.accent);
  return { className: accent?.className ?? "", style: (accent?.style ?? {}) as CSSProperties };
}

// Fond d'ecran pleine page : l'image derriere tout le contenu de la fiche, assombrie par un
// degrade aux couleurs du theme pour que le texte reste lisible en clair comme en sombre.
export function wallpaperStyle(url: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(color-mix(in srgb, var(--background) 62%, transparent), color-mix(in srgb, var(--background) 88%, transparent)), url("${url}")`,
    backgroundSize: "cover",
    backgroundPosition: "center top",
    backgroundAttachment: "fixed",
  };
}

// Fiche d'un serveur, partagee entre /servers/[slug] (serveur public) et
// /join/[code] (serveur prive, affiche grace au code d'invitation : voir
// canSeeServer dans public-servers.ts). Disposition « deux colonnes » (decision du 16/10) :
// a gauche les sections choisies par le proprietaire (voir lib/serverPage.ts), a droite une
// colonne qui reste visible avec la facon de rejoindre et les infos de base.
export async function ServerDetailView({ slug, server, inviteCode }: { slug: string; server: PublicServerDetail; inviteCode?: string }) {
  // Teams (19/10) : autres serveurs publics de la meme team, tires de la liste en cache (0 appel).
  const [{ dict, locale }, { custom }, teamServers] = await Promise.all([
    getT(),
    getTagCatalog(),
    server.team ? listTeamServers(server.team.slug, slug) : Promise.resolve([]),
  ]);
  // Etiquettes en dur ou ajoutees par l'equipe (liste en cache) ; une etiquette inconnue n'est pas montree.
  const tagLabel = (tag: string) => tagName(tag, locale, custom);
  // Badge de fraicheur (voir lib/freshness.ts) : niveau et wording partages avec
  // manage/[id]/page.tsx (console de gestion du proprietaire), calcules une seule fois.
  const freshness = getFreshness(server.selfTestPassedAt);
  const page = server.page;
  const fullWallpaper = !!server.backgroundUrl && page.wallpaper;
  const accent = accentProps(page);
  const hasSections = visibleSections(page, server).length > 0;
  // « Ouvrir dans le launcher » (16/10) : lien omniscient:// que le launcher installe reconnait
  // (voir parseServerLink dans launcher/src/main.js). Serveur prive : le code d'invitation de la
  // page /join/[code], pour que le launcher puisse le rejoindre puis ouvrir sa fiche.
  const launcherHref = inviteCode
    ? `omniscient://join/${encodeURIComponent(inviteCode.toUpperCase())}`
    : `omniscient://server/${encodeURIComponent(slug)}`;

  // Design 2026-10-17, point 6 : bandeau de confiance sous le nom. On dit ce qu'on a fait
  // (le launcher l'a teste), jamais une garantie que le serveur est « sur ».
  const tested = freshness.level !== "never";
  const trustText = !tested
    ? dict.serverDetail.notTested
    : freshness.days === 0
      ? dict.serverDetail.testedToday
      : freshness.days === 1
        ? dict.serverDetail.testedYesterday
        : t(dict, "serverDetail.testedDays", { days: freshness.days });
  const online = server.playerCount !== null;
  const state = serverState(server.playerCount, server.playerCapacity, server.pinged);
  const stateColor = STATE_COLOR[state];
  const pct =
    online && server.playerCapacity ? Math.min(100, Math.max(4, Math.round((server.playerCount! / server.playerCapacity) * 100))) : null;
  const modpackLabel =
    server.type === "modded" && server.curseforgeModpackName
      ? `${server.curseforgeModpackName}${server.curseforgeModpackVersion ? ` ${server.curseforgeModpackVersion}` : ""}`
      : null;

  return (
    <div className={`relative ${accent.className}`} style={{ ...accent.style, ...(fullWallpaper ? wallpaperStyle(server.backgroundUrl!) : {}) }}>
      {server.backgroundUrl && !fullWallpaper ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={server.backgroundUrl} alt="" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      ) : null}

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <AutoRefresh intervalMs={30_000} />
        <ViewTracker slug={slug} />
        <ServerHowToPlay launcherHref={launcherHref} />
        <div
          className="relative mb-5 h-48 w-full overflow-hidden rounded-xl sm:h-56"
          style={server.bannerUrl ? undefined : { background: fallbackBanner(server.name) }}
        >
          {server.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={server.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center px-4 text-center text-[26px] font-extrabold tracking-wider text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.35)] sm:text-[44px]"
            >
              {server.name.toUpperCase()}
            </span>
          )}
        </div>

        {/* Icone a cote du nom (16/10, demande de Rushi), plus en surimpression sur la banniere. */}
        {/* 19/10 (variante A) : l'icone prend la hauteur du bloc de texte (64 a 136 px). */}
        <FitHeightIconRow
          icon={
            server.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={server.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              server.name.trim().charAt(0).toUpperCase() || "?"
            )
          }
        >
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground [text-wrap:balance]">
              {server.name}{" "}
              <ServerStatePill state={state} count={server.playerCount} capacity={server.playerCapacity} className="ml-1 align-middle" />{" "}
              <ManualModsBadge count={server.manualModsCount} />
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-1 text-[12.5px] font-semibold"
                style={
                  tested
                    ? { color: "var(--success)", background: "color-mix(in srgb, var(--success) 16%, transparent)" }
                    : { color: "var(--warn)", background: "color-mix(in srgb, var(--warn) 16%, transparent)" }
                }
              >
                {trustText}
              </span>
              {modpackLabel ? <span className="tag-chip text-[12.5px] text-foreground">{modpackLabel}</span> : null}
              <span className="tag-chip font-mono text-[12.5px] text-foreground">{server.minecraftVersion}</span>
              {server.recommendedRamGB ? (
                <span className="tag-chip text-[12.5px] text-foreground">
                  {server.recommendedRamGB} {dict.serverDetail.ramUnit}
                </span>
              ) : null}
            </div>
            {page.tags.length || page.languages.length ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {page.tags.filter(tagLabel).map((tag) => (
                <span key={tag} className="tag-chip tag-chip-accent">
                  {tagLabel(tag)}
                </span>
              ))}
              {page.languages.map((lang) => (
                <span key={lang} className="tag-chip tag-chip-outline">
                  {dict.serverPage.languages[lang]}
                </span>
              ))}
            </div>
            ) : null}
            {server.team ? <TeamByline team={server.team} serverSlug={slug} className="mt-2" /> : null}
        </FitHeightIconRow>

        <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            {hasSections ? (
              <ServerPageSections config={page} discordUrl={server.discordUrl} websiteUrl={server.websiteUrl} labels={serverPageLabels(dict)} />
            ) : null}
            {/* Presentation vide ou masquee : la description courte reste visible, comme avant. */}
            {!page.about.trim() || page.hidden.includes("about") ? (
              <section className="panel order-first p-4 sm:p-5">
                <ReadMoreText text={server.description} className="text-foreground" />
              </section>
            ) : null}
          </div>

          <aside className="order-first flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:order-none">
            <div className="panel relative flex flex-col gap-2.5 p-4 pt-5">
              {bandColor(state) ? (
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 rounded-t-[0.875rem]" style={{ background: bandColor(state)! }} />
              ) : null}
              {online ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <b className="text-[30px] font-bold leading-none tabular-nums text-foreground">{server.playerCount}</b>
                    <small className="text-[13px] text-muted">
                      {server.playerCapacity
                        ? t(dict, "serverDetail.ofSlots", { count: server.playerCapacity })
                        : dict.serverDetail.playersOnline}
                    </small>
                  </div>
                  {state === "warn" || state === "full" ? (
                    <small className="text-[12.5px] font-semibold" style={{ color: stateColor }}>
                      {dict.servers.state[state]}
                    </small>
                  ) : null}
                  {pct !== null ? (
                    <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-foreground/10">
                      <span className="block h-full max-w-full" style={{ width: `${pct}%`, background: stateColor }} />
                    </span>
                  ) : null}
                </>
              ) : (
                <div className="flex items-baseline gap-2">
                  <b className="text-[30px] font-bold leading-none text-muted">—</b>
                  <small className="text-[13px] font-semibold" style={{ color: stateColor }}>
                    {state === "off" ? dict.servers.state.off : dict.servers.unknownStatus}
                  </small>
                </div>
              )}
              <a href={launcherHref} className="btn-primary w-full !bg-accent py-2.5 font-semibold !text-[var(--accent-on,var(--accent-foreground))] hover:opacity-90">
                <ArrowSquareOut className="h-4 w-4" weight="bold" />
                {dict.serverDetail.openInLauncher}
              </a>
              <p className="text-center text-xs text-muted">
                {dict.serverDetail.noLauncher}{" "}
                <Link href="/download" className="text-accent hover:underline">
                  {dict.serverDetail.downloadLauncher}
                </Link>
              </p>
            </div>
            <section className="panel p-4">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.07em] text-accent">{dict.serverPage.infos}</h2>
              <div className="grid grid-cols-2 gap-2.5">
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
                {server.type === "modded" && server.curseforgeModpackName ? (
                  <div className="stat-tile col-span-2">
                    <div className="stat-label">{dict.serverPage.modpack}</div>
                    <div className="stat-value break-words">
                      {server.curseforgeModpackName}
                      {server.curseforgeModpackVersion ? ` — ${server.curseforgeModpackVersion}` : ""}
                    </div>
                  </div>
                ) : null}
              </div>
              {page.extraTags.some(tagLabel) ? (
                <div className="mt-3">
                  <div className="mb-1.5 text-[11px] uppercase tracking-[0.04em] text-muted">{dict.serverPage.moreTags}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {page.extraTags.filter(tagLabel).map((tag) => (
                      <span key={tag} className="tag-chip">
                        {tagLabel(tag)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
            {server.team && teamServers.length ? (
              <section className="panel p-4">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.07em] text-accent">{dict.team.otherServers}</h2>
                <ul className="flex flex-col gap-1">
                  {teamServers.slice(0, 4).map((other) => (
                    <li key={other.slug}>
                      <Link href={`/servers/${other.slug}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-surface-raised">
                        <span className="server-icon h-7 w-7 shrink-0 overflow-hidden text-xs">
                          {other.iconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={other.iconUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            other.name.trim().charAt(0).toUpperCase() || "?"
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{other.name}</span>
                        {other.playerCount !== null ? <span className="text-xs tabular-nums text-muted">{other.playerCount}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={`/team/${server.team.slug}`} className="mt-2 inline-flex items-center gap-1.5 px-2 text-[13px] font-semibold text-accent hover:underline">
                  <TeamAvatar team={server.team} size={16} />
                  {dict.team.seeTeam} →
                </Link>
              </section>
            ) : null}
          </aside>
        </div>
      </div>

      {/* Telephone (design 2026-10-17, point 6) : barre Rejoindre collee en bas (sticky : elle
          s arrete avant le pied de page), avec les
          joueurs en ligne, pour ne pas devoir remonter jusqu'au bouton. */}
      <div className="sticky bottom-0 z-20 flex items-center gap-2.5 border-t border-border bg-surface/95 px-3 py-2.5 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.5)] backdrop-blur lg:hidden">
        <div className="flex min-w-0 flex-1 flex-col text-[12.5px]">
          <b className="text-sm font-semibold text-foreground">
            {online ? `${server.playerCount}${server.playerCapacity ? ` / ${server.playerCapacity}` : ""}` : "—"}
          </b>
          <small className="font-semibold" style={{ color: stateColor }}>{dict.servers.state[state]}</small>
        </div>
        <a href={launcherHref} className="btn-fill">
          <ArrowSquareOut className="h-4 w-4" weight="bold" />
          {dict.serverDetail.openInLauncher}
        </a>
      </div>
    </div>
  );
}
