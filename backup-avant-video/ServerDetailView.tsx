import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react/ssr";
import { ServerStatus } from "@/components/ServerStatus";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ViewTracker } from "@/components/ViewTracker";
import { ServerPageSections, type ServerPageLabels } from "@/components/ServerPageSections";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import type { Dictionary } from "@/i18n/getDictionary";
import { getFreshness, freshnessChipStyle } from "@/lib/freshness";
import { pageAccent, visibleSections, type ServerPageConfig } from "@/lib/serverPage";
import type { PublicServerDetail } from "@/lib/public-servers";

// Libelles des sections, lus une fois dans le dictionnaire (partages avec l'editeur).
export function serverPageLabels(dict: Dictionary): ServerPageLabels {
  return {
    sections: dict.serverPage.sections,
    videoCaption: dict.serverPage.videoCaption,
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
  const { dict } = await getT();
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
        <div className="banner-placeholder relative mb-5 h-48 w-full overflow-hidden rounded-xl sm:h-56">
          {server.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={server.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>

        {/* Icone a cote du nom (16/10, demande de Rushi), plus en surimpression sur la banniere. */}
        <div className="flex items-start gap-4">
          <span className="server-icon h-16 w-16 shrink-0 overflow-hidden text-2xl">
            {server.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={server.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              server.name.trim().charAt(0).toUpperCase() || "?"
            )}
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground [text-wrap:balance]">{server.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ServerStatus playerCount={server.playerCount} playerCapacity={server.playerCapacity} />
              <span className="tag-chip" style={freshnessChipStyle(freshness.level)}>
                {t(dict, `freshness.${freshness.level}`, { days: freshness.days })}
              </span>
              {page.tags.map((tag) => (
                <span key={tag} className="tag-chip tag-chip-accent">
                  {dict.serverPage.tags[tag]}
                </span>
              ))}
              {page.languages.map((lang) => (
                <span key={lang} className="tag-chip tag-chip-outline">
                  {dict.serverPage.languages[lang]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            {hasSections ? (
              <ServerPageSections config={page} discordUrl={server.discordUrl} websiteUrl={server.websiteUrl} labels={serverPageLabels(dict)} />
            ) : null}
            {/* Presentation vide ou masquee : la description courte reste visible, comme avant. */}
            {!page.about.trim() || page.hidden.includes("about") ? (
              <section className="panel order-first p-4 sm:p-5">
                <p className="whitespace-pre-wrap break-words text-foreground">{server.description}</p>
              </section>
            ) : null}
          </div>

          <aside className="order-first flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:order-none">
            <div className="panel flex flex-col gap-2.5 p-4">
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
              {page.extraTags.length ? (
                <div className="mt-3">
                  <div className="mb-1.5 text-[11px] uppercase tracking-[0.04em] text-muted">{dict.serverPage.moreTags}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {page.extraTags.map((tag) => (
                      <span key={tag} className="tag-chip">
                        {dict.serverPage.tags[tag]}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
