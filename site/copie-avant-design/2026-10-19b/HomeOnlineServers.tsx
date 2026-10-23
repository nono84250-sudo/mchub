"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Shuffle } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { STATE_COLOR, gaugePercent, serverState } from "@/lib/playerGauge";
import { TeamAvatar } from "@/components/TeamAvatar";

export type HomeOnlineServer = {
  slug: string;
  name: string;
  minecraftVersion: string;
  bannerUrl: string | null;
  playerCount: number | null;
  playerCapacity: number | null;
  // Teams (19/10) : meme ligne « par X » que les cartes de l'annuaire.
  team?: { name: string; iconUrl: string | null; official: boolean } | null;
};

// Accueil (design 2026-10-17, point 2) : 3 serveurs en ligne tires au hasard
// cote serveur (voir sampleOnlineServers). « Melanger » montre les 3 suivants
// du meme tirage, sans requete en plus.
export function HomeOnlineServers({ servers, total }: { servers: HomeOnlineServer[]; total: number }) {
  const { t } = useI18n();
  const [offset, setOffset] = useState(0);

  const shown = Array.from({ length: Math.min(3, servers.length) }, (_, i) => servers[(offset + i) % servers.length]);
  const canShuffle = servers.length > 3;

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t("home.liveTitle")}</h2>
          <p className="text-[0.8rem] text-muted">
            {total === 1 ? t("home.liveSubtitleOne") : t("home.liveSubtitle").replace("{count}", String(total))}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canShuffle ? (
            <button type="button" onClick={() => setOffset((o) => (o + 3) % servers.length)} className="btn-secondary text-sm py-1.5 px-3">
              <Shuffle className="h-4 w-4" />
              {t("home.liveShuffle")}
            </button>
          ) : null}
          <Link href="/servers" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
            {t("home.liveSeeAll")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {shown.map((s) => (
          <Link key={s.slug} href={`/servers/${s.slug}`} className="panel glow-card group overflow-hidden flex flex-col">
            <div className="relative h-16 banner-placeholder overflow-hidden">
              {s.bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground group-hover:text-accent transition-colors">{s.name}</span>
                <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
                  <span className="shrink-0">{s.minecraftVersion}</span>
                  {s.team ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{s.team.official ? t("team.proposedBy").toLowerCase() : t("servers.byTeam")}</span>
                      <TeamAvatar team={s.team} size={13} />
                      <span className="truncate font-medium text-foreground">{s.team.name}</span>
                    </>
                  ) : null}
                </span>
              </span>
              <span className="text-right text-lg font-bold leading-none text-foreground">
                {s.playerCount ?? 0}
                {s.playerCapacity ? <span className="text-xs font-normal text-muted"> / {s.playerCapacity}</span> : null}
                {(() => {
                  const st = serverState(s.playerCount, s.playerCapacity);
                  const pct = gaugePercent(s.playerCount, s.playerCapacity);
                  return (
                    <>
                      {pct !== null ? (
                        <span aria-hidden="true" className="mt-1.5 ml-auto block h-[5px] w-[60px] max-w-full overflow-hidden rounded-full bg-foreground/10">
                          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: STATE_COLOR[st] }} />
                        </span>
                      ) : null}
                      {st === "warn" || st === "full" ? (
                        <span className="mt-1 block text-[11px] font-semibold" style={{ color: STATE_COLOR[st] }}>
                          {t(`servers.state.${st}`)}
                        </span>
                      ) : null}
                    </>
                  );
                })()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
