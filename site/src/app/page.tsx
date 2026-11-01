import Link from "next/link";
import { teamsPublic, withoutTeam } from "@/lib/features";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight, WindowsLogo, HardDrives } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { getT } from "@/i18n/getDictionary";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { HomeOnlineServers } from "@/components/HomeOnlineServers";
import { getServerOfTheDay, sampleOnlineServers } from "@/lib/public-servers";
import { HomeServerOfTheDay } from "@/components/HomeServerOfTheDay";
import { LAUNCHER_DOWNLOAD_URL, detectPlatform, getLatestRelease } from "@/lib/launcherRelease";

export default async function Home() {
  const { dict } = await getT();
  const [session, platform, release, onlineRaw, dayPickRaw, showTeams] = await Promise.all([
    auth().catch((error: unknown) => {
      unstable_rethrow(error);
      return null;
    }),
    detectPlatform(),
    getLatestRelease(),
    // Idee 1 du lancement (19/10) : base injoignable -> la section « en ligne » disparait,
    // comme quand aucun serveur n'est en ligne, au lieu de faire tomber l'accueil.
    sampleOnlineServers().catch((error: unknown) => {
      unstable_rethrow(error);
      return { total: 0, servers: [] };
    }),
    // Petit serveur du jour (19/10) : base injoignable ou aucun eligible -> pas de bloc.
    getServerOfTheDay().catch((error: unknown) => {
      unstable_rethrow(error);
      return null;
    }),
    teamsPublic(),
  ]);
  // Laboratoire : pas de team affichée tant que « Ma team » n'est pas ouverte à tous.
  const online = showTeams ? onlineRaw : { ...onlineRaw, servers: onlineRaw.servers.map((s) => withoutTeam(s)) };
  const dayPick = showTeams || !dayPickRaw ? dayPickRaw : { ...dayPickRaw, server: withoutTeam(dayPickRaw.server) };
  const loggedIn = !!session?.user?.id;

  // Design 2026-10-17, point 1 : le bouton fort suit le systeme du visiteur.
  // Windows -> Telecharger ; Mac/Linux -> Parcourir + phrase "bientot" ;
  // telephone -> Parcourir + copier le lien (pas de .exe impossible a installer).
  // Sans version lue (GitHub injoignable), la petite ligne perd juste le numero.
  const version = release ? (
    <>
      <span className="opacity-50">·</span>
      <span>v{release.version}</span>
    </>
  ) : null;

  let cta: ReactNode;
  if (platform === "windows") {
    cta = (
      <>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <a href={LAUNCHER_DOWNLOAD_URL} className="btn-fill btn-big">
            <WindowsLogo className="h-[18px] w-[18px]" weight="fill" />
            {dict.home.ctaDownloadWindows}
          </a>
          <Link href="/servers" className="btn-secondary btn-big">
            {dict.home.ctaBrowse}
          </Link>
        </div>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[0.8rem] text-muted">
          <span>{dict.home.free}</span>
          {version}
          <span className="opacity-50">·</span>
          <span>{dict.home.windowsReq}</span>
        </p>
      </>
    );
  } else if (platform === "phone") {
    cta = (
      <>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <Link href="/servers" className="btn-fill btn-big">
            {dict.home.ctaBrowse}
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
          <CopyLinkButton path="/download" className="btn-big" />
        </div>
        <p className="mt-3 mx-auto max-w-[40ch] text-sm text-muted text-balance">{dict.home.phoneNote}</p>
      </>
    );
  } else {
    cta = (
      <>
        <div className="flex items-center justify-center">
          <Link href="/servers" className="btn-fill btn-big">
            {dict.home.ctaBrowse}
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        </div>
        <p className="mt-3 mx-auto max-w-[40ch] text-sm text-muted text-balance">{dict.home.macNote}</p>
        <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2.5 text-[0.8rem] text-muted">
          <a href={LAUNCHER_DOWNLOAD_URL} className="underline underline-offset-2 hover:text-foreground">
            {dict.home.macDownloadAnyway}
          </a>
          {version}
        </p>
      </>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
        style={{
          backgroundImage:
            "radial-gradient(50% 45% at 30% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%), radial-gradient(45% 40% at 80% 10%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-20 sm:py-28 text-center">
        <span className="fade-in-up inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          {dict.home.heroBadge}
        </span>

        <h1
          className="fade-in-up mt-6 mx-auto max-w-[15ch] text-4xl sm:text-6xl font-bold tracking-tight text-foreground text-balance"
          style={{ animationDelay: "0.1s" }}
        >
          {dict.home.heroTitle} <span className="gradient-text">{dict.home.heroTitleAccent}</span>
        </h1>
        <p
          className="fade-in-up mt-5 text-lg text-muted max-w-[46ch] mx-auto text-balance"
          style={{ animationDelay: "0.2s" }}
        >
          {dict.home.heroSubtitle}
        </p>
        <div className="fade-in-up mt-9" style={{ animationDelay: "0.3s" }}>
          {cta}
        </div>
        {!loggedIn ? (
          <p className="fade-in-up mt-5 text-[0.8rem] text-muted" style={{ animationDelay: "0.35s" }}>
            {/* /signup n'existe pas — l'inscription se fait via /login (compte cree au besoin par Microsoft). */}
            <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
              {dict.home.publishLink}
            </Link>
          </p>
        ) : null}
      </div>

      {/* Design 2026-10-17, point 2 : 3 vraies etapes dans l'ordre d'un nouveau
          joueur (remplacent les 3 cartes techniques), chacune avec un petit
          dessin du vrai bouton qu'on va voir. Sur telephone, sans les dessins. */}
      <section id="comment-ca-marche" className="mx-auto max-w-5xl scroll-mt-20 px-4 sm:px-6 pb-12">
        <h2 className="text-center text-xl sm:text-2xl font-semibold tracking-tight text-foreground">{dict.home.howTitle}</h2>
        <ol className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <li className="panel flex flex-col gap-2.5 p-4">
            <StepHead n={1} title={dict.home.step1Title} />
            <StepScene>
              <span className="btn-fill pointer-events-none">
                <WindowsLogo className="h-4 w-4" weight="fill" />
                {dict.home.ctaDownloadWindows}
              </span>
            </StepScene>
            <p className="text-sm text-muted">{dict.home.step1Body}</p>
          </li>
          <li className="panel flex flex-col gap-2.5 p-4">
            <StepHead n={2} title={dict.home.step2Title} />
            <StepScene>
              <span className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface p-1.5 text-xs">
                <span className="h-8 w-8 flex-shrink-0 rounded-md bg-[linear-gradient(135deg,#2c6e45,#1f4f8a)]" />
                <span className="flex min-w-0 flex-1 flex-col text-left">
                  <b className="truncate font-semibold text-foreground">Cobblemon FR</b>
                  <span className="text-muted">1.20.1 · {dict.home.stepModded}</span>
                </span>
                <span className="text-right text-sm font-bold leading-none text-foreground">
                  34<span className="block text-[10px] font-normal text-muted">/ 100</span>
                </span>
              </span>
            </StepScene>
            <p className="text-sm text-muted">{dict.home.step2Body}</p>
          </li>
          <li className="panel flex flex-col gap-2.5 p-4">
            <StepHead n={3} title={dict.home.step3Title} />
            <StepScene>
              <span className="flex w-full flex-col items-center gap-1.5">
                <span className="btn-fill pointer-events-none text-[0.8rem] py-1 px-3">{dict.home.stepJoin}</span>
                <span className="h-1.5 w-4/5 overflow-hidden rounded-full bg-border">
                  <span className="block h-full w-[62%] bg-accent" />
                </span>
                <span className="text-[11px] text-muted">{dict.home.stepInstalling}</span>
              </span>
            </StepScene>
            <p className="text-sm text-muted">{dict.home.step3Body}</p>
          </li>
        </ol>
      </section>

      {/* Petit serveur du jour (19/10) : avant les 3 serveurs au hasard. */}
      {dayPick ? <HomeServerOfTheDay pick={dayPick} /> : null}

      {/* Vrais serveurs en ligne, 3 au hasard. Aucun en ligne : la section disparait. */}
      {online.servers.length > 0 ? (
        <HomeOnlineServers
          total={online.total}
          servers={online.servers.map((s) => ({
            slug: s.slug,
            name: s.name,
            minecraftVersion: s.minecraftVersion,
            bannerUrl: s.bannerUrl,
            playerCount: s.playerCount,
            playerCapacity: s.playerCapacity,
            team: s.team ? { name: s.team.name, iconUrl: s.team.iconUrl, official: s.team.official } : null,
            languages: s.languages,
          }))}
        />
      ) : null}

      {/* Ce que les anciennes cartes disaient aux proprietaires, dans une bande a part. */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
        <div
          className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-border px-[18px] py-4"
          style={{ background: "color-mix(in srgb, var(--accent) 6%, var(--surface))" }}
        >
          <span className="server-icon h-[38px] w-[38px] flex-shrink-0">
            <HardDrives className="h-[19px] w-[19px]" />
          </span>
          <div className="min-w-[220px] flex-1">
            <p className="font-semibold text-foreground">{loggedIn ? dict.home.ownersInTitle : dict.home.ownersTitle}</p>
            <p className="mt-0.5 text-sm text-muted">{loggedIn ? dict.home.ownersInBody : dict.home.ownersBody}</p>
          </div>
          <Link href={loggedIn ? "/dashboard" : "/login"} className="btn-primary">
            {loggedIn ? dict.home.ownersInCta : dict.home.ownersCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 max-sm:flex-col max-sm:items-start max-sm:gap-1.5">
      <span className="grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-full border-[1.5px] border-accent text-sm font-bold text-accent">
        {n}
      </span>
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
  );
}

// Petit dessin du vrai bouton de l'etape (cache sur telephone pour rester court).
function StepScene({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="hidden sm:grid h-[92px] place-items-center overflow-hidden rounded-[10px] border border-border bg-background p-2.5">
      {children}
    </div>
  );
}
