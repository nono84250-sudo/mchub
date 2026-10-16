import type { CSSProperties } from "react";
import { ServerStatus } from "@/components/ServerStatus";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ViewTracker } from "@/components/ViewTracker";
import { ServerPageSections, type ServerPageLabels } from "@/components/ServerPageSections";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import type { Dictionary } from "@/i18n/getDictionary";
import { getFreshness, freshnessChipStyle } from "@/lib/freshness";
import { PAGE_ACCENTS, visibleSections, type ServerPageConfig } from "@/lib/serverPage";
import type { PublicServerDetail } from "@/lib/public-servers";

// Libelles des sections, lus une fois dans le dictionnaire (partages avec l'editeur).
export function serverPageLabels(dict: Dictionary): ServerPageLabels {
  return {
    sections: dict.serverPage.sections,
    videoCaption: dict.serverPage.videoCaption,
    social: dict.serverPage.social,
  };
}

// Couleur choisie par le proprietaire : remplace --accent sur la fiche seulement (les autres
// teintes du theme en derivent par color-mix, voir globals.css).
export function accentStyle(page: ServerPageConfig): CSSProperties | undefined {
  return page.accent ? ({ "--accent": PAGE_ACCENTS[page.accent] } as CSSProperties) : undefined;
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
export async function ServerDetailView({ slug, server }: { slug: string; server: PublicServerDetail }) {
  const { dict } = await getT();
  // Badge de fraicheur (voir lib/freshness.ts) : niveau et wording partages avec
  // manage/[id]/page.tsx (console de gestion du proprietaire), calcules une seule fois.
  const freshness = getFreshness(server.selfTestPassedAt);
  const page = server.page;
  const fullWallpaper = !!server.backgroundUrl && page.wallpaper;
  const hasSections = visibleSections(page, server).length > 0;

  return (
    <div className="relative" style={{ ...accentStyle(page), ...(fullWallpaper ? wallpaperStyle(server.backgroundUrl!) : {}) }}>
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
        <div className="relative mb-9 h-48 w-full sm:h-56">
          <div className="banner-placeholder absolute inset-0 overflow-hidden rounded-xl">
            {server.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={server.bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <span className="server-icon absolute -bottom-6 left-5 h-16 w-16 overflow-hidden border-4 border-background text-2xl">
            {server.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={server.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              server.name.trim().charAt(0).toUpperCase() || "?"
            )}
          </span>
        </div>

        <div className="min-h-[34px] pl-[84px]">
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
            <div className="panel p-4 text-sm text-muted">{dict.serverDetail.joinNote}</div>
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
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
