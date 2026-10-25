import Link from "next/link";
import { WindowsLogo, AppleLogo, LinuxLogo, ShieldCheck, ArrowRight } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { SmartScreenDemo } from "@/components/SmartScreenDemo";
import { TrustBlock } from "@/components/TrustBlock";
import { DownloadRevealProvider, DownloadLink, AfterDownloadClick } from "@/components/DownloadReveal";
import { LAUNCHER_DOWNLOAD_URL, LAUNCHER_RELEASES_LIST_URL, detectPlatform, getLatestRelease } from "@/lib/launcherRelease";

export const metadata = { title: "Télécharger — Omniscient" };

// Design 2026-10-17, point 3 : page rassurante. Le bouton, puis « Apres le
// clic » en 3 etapes (dont l'ecran bleu SmartScreen dessine et explique AVANT
// qu'il apparaisse, sans jamais dire de couper l'antivirus), puis les 4
// questions (desormais dans /faq). Mac et Linux passent en petites pastilles « bientot ».
// Seul Windows a un build reel pour l'instant (voir project_launcher_installer).
export default async function DownloadPage() {
  const { dict } = await getT();
  const [platform, release] = await Promise.all([detectPlatform(), getLatestRelease()]);
  const d = dict.download;

  const version = release ? (
    <>
      <span className="opacity-50">·</span>
      <span>v{release.version}</span>
    </>
  ) : null;

  let cta;
  if (platform === "phone") {
    cta = (
      <>
        <CopyLinkButton path="/download" className="btn-big" />
        <p className="max-w-[40ch] text-sm text-muted text-balance">{d.phoneNote}</p>
      </>
    );
  } else if (platform === "windows") {
    cta = (
      <>
        <DownloadLink href={LAUNCHER_DOWNLOAD_URL} className="btn-fill btn-big">
          <WindowsLogo className="h-[18px] w-[18px]" weight="fill" />
          {dict.home.ctaDownloadWindows}
        </DownloadLink>
        <p className="flex flex-wrap items-center justify-center gap-x-2.5 text-[0.8rem] text-muted">
          <span>{d.free}</span>
          {version}
          <span className="opacity-50">·</span>
          <span>{d.winReq}</span>
        </p>
      </>
    );
  } else {
    cta = (
      <>
        <p className="max-w-[40ch] text-sm text-muted text-balance">{d.otherOsNote}</p>
        <DownloadLink href={LAUNCHER_DOWNLOAD_URL} className="btn-primary btn-big">
          <WindowsLogo className="h-[18px] w-[18px]" weight="fill" />
          {d.winAnyway}
        </DownloadLink>
        <p className="flex flex-wrap items-center justify-center gap-x-2.5 text-[0.8rem] text-muted">
          <span>{d.free}</span>
          {version}
        </p>
      </>
    );
  }

  return (
    <DownloadRevealProvider>
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20 flex flex-col gap-10">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <h1 className="max-w-[20ch] text-3xl sm:text-[2.6rem] font-bold tracking-tight text-foreground text-balance">{d.newTitle}</h1>
        <p className="max-w-[46ch] text-lg text-muted text-balance">{d.newSubtitle}</p>
        <div className="mt-2 flex flex-col items-center gap-3">{cta}</div>
      </div>

      {/* Inutile sur telephone (pas de .exe) : on garde seulement les questions. */}
      {/* Variante choisie le 17/10 : « Apres le clic » n'apparait qu'une fois le bouton clique. */}
      {platform !== "phone" ? (
        <AfterDownloadClick href={LAUNCHER_DOWNLOAD_URL}>
          <h2 className="text-xl font-semibold text-foreground">{d.afterTitle}</h2>
          <ol className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <AfterStep n={1} title={d.after1Title}>
              <p className="text-sm text-muted">{d.after1Body}</p>
            </AfterStep>
            <AfterStep n={2} title={d.after2Title}>
              <SmartScreenDemo />
              <p className="text-sm text-muted">{d.after2Body}</p>
              <p className="border-t border-border pt-2 text-[0.8rem] text-muted">{d.after2Why}</p>
            </AfterStep>
            <AfterStep n={3} title={d.after3Title}>
              <p className="text-sm text-muted">{d.after3Body}</p>
            </AfterStep>
          </ol>
        </AfterDownloadClick>
      ) : null}

      <TrustBlock />

      {/* Les questions sont dans la page FAQ (validee le 17/10) : une seule ligne ici. */}
      <p className="flex flex-wrap items-center gap-2.5 border-t border-border pt-3.5 text-sm text-muted">
        {d.moreQuestions}
        <Link href="/faq" className="font-medium text-accent hover:underline">
          {d.faqLink}
        </Link>
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap justify-center gap-2.5 text-[0.8rem] text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent px-3 py-1 text-foreground">
            <WindowsLogo className="h-3.5 w-3.5" weight="fill" />
            Windows 10 · 11
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
            <AppleLogo className="h-3.5 w-3.5" weight="fill" />
            macOS · {d.soonPill}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
            <LinuxLogo className="h-3.5 w-3.5" />
            Linux · {d.soonPill}
          </span>
        </div>

        {platform !== "phone" ? (
          <div className="panel flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3.5">
            <ShieldCheck className="h-6 w-6 text-muted shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-foreground text-sm">{d.checksumsTitle}</p>
              <p className="text-sm text-muted mt-0.5">{d.checksumsBody}</p>
            </div>
            <Link
              href={LAUNCHER_RELEASES_LIST_URL}
              className="text-sm text-accent hover:underline shrink-0 inline-flex items-center gap-1"
            >
              {d.releaseNotes}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </div>
    </DownloadRevealProvider>
  );
}

function AfterStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="panel flex min-w-0 flex-col gap-2.5 p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-full border-[1.5px] border-accent text-sm font-bold text-accent">
          {n}
        </span>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </li>
  );
}
