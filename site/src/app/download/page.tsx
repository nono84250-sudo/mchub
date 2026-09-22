import Link from "next/link";
import { headers } from "next/headers";
import { WindowsLogo, AppleLogo, LinuxLogo, ShieldCheck, ArrowRight } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Télécharger — Omniscient" };

// Releases publiques du launcher (repo séparé, public, sans le code source —
// voir project_launcher_installer). Le nom de l'installeur (nsisWeb.artifactName
// dans launcher/package.json) est volontairement sans espace ET sans numéro de
// version : sans espace parce que GitHub (points) et le latest.yml
// d'electron-builder (tirets) le sanitisaient chacun différemment, cassant
// silencieusement la mise à jour automatique (électron-updater cherchait un
// fichier qui n'existait pas) ; sans version pour que ce lien direct reste
// valable à chaque nouvelle publication.
const LAUNCHER_ASSET_NAME = "OmniscientLauncherSetup.exe";
const LAUNCHER_DOWNLOAD_URL = `https://github.com/nono84250-sudo/omniscient-launcher/releases/latest/download/${LAUNCHER_ASSET_NAME}`;
const LAUNCHER_RELEASES_LIST_URL = "https://github.com/nono84250-sudo/omniscient-launcher/releases";

type PlatformId = "windows" | "macos" | "linux";

async function detectPlatform(): Promise<PlatformId> {
  const store = await headers();
  const ua = store.get("user-agent") ?? "";
  if (/mac os x|macintosh/i.test(ua)) return "macos";
  if (/linux/i.test(ua) && !/android/i.test(ua)) return "linux";
  return "windows";
}

// Version/taille lues depuis la release GitHub reelle (jamais figees en dur
// ici — sinon ce texte se decale du binaire reellement servi a chaque nouvelle
// publication). Echoue silencieusement (API GitHub indisponible, pas encore
// de release) : la ligne "detecte : {os}" s'affiche seule dans ce cas.
// Le LIEN de telechargement (LAUNCHER_DOWNLOAD_URL) n'est lui jamais mis en
// cache : il se resout en direct cote GitHub a chaque clic, donc reste
// toujours exact meme si ce texte-ci est momentanement en retard. Revalidate
// court (5 min, pas l'heure par defaut) pour que ce retard ne dure jamais
// longtemps apres une nouvelle publication — le tag permet en plus de forcer
// un rafraichissement immediat juste apres une publication (invalidate_by_tags
// cote Vercel) sans attendre ces 5 minutes.
async function getLatestRelease(): Promise<{ version: string; sizeMB: number } | null> {
  try {
    const res = await fetch("https://api.github.com/repos/nono84250-sudo/omniscient-launcher/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300, tags: ["launcher-latest-release"] },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const asset = data.assets?.find((a: { name: string }) => a.name === LAUNCHER_ASSET_NAME);
    const version = typeof data.tag_name === "string" ? data.tag_name.replace(/^v/, "") : null;
    if (!asset || !version) return null;
    return { version, sizeMB: Math.round(asset.size / (1024 * 1024)) };
  } catch {
    return null;
  }
}

export default async function DownloadPage() {
  const { dict } = await getT();
  const detected = await detectPlatform();
  const release = await getLatestRelease();

  // Seul Windows a un build reel pour l'instant (voir project_launcher_installer) —
  // macOS/Linux restent affiches mais desactives ("Bientot disponible").
  const PLATFORMS = [
    {
      id: "windows" as const,
      icon: WindowsLogo,
      label: dict.download.osWindows,
      requirement: dict.download.windowsRequirement,
      downloadLabel: dict.download.downloadExe,
      href: LAUNCHER_DOWNLOAD_URL,
    },
    {
      id: "macos" as const,
      icon: AppleLogo,
      label: dict.download.osMac,
      requirement: dict.download.macRequirement,
      downloadLabel: dict.download.downloadDmg,
      href: null,
    },
    {
      id: "linux" as const,
      icon: LinuxLogo,
      label: dict.download.osLinux,
      requirement: dict.download.linuxRequirement,
      downloadLabel: dict.download.downloadAppImage,
      href: null,
    },
  ];

  const primary = PLATFORMS.find((p) => p.id === detected) ?? PLATFORMS[0];
  const windows = PLATFORMS[0];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-20 sm:py-28">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground text-balance">
          {dict.download.title} <span className="gradient-text">{dict.download.titleAccent}</span>
        </h1>
        <p className="mt-5 text-lg text-muted text-balance">{dict.download.subtitle}</p>

        <div className="mt-9 flex flex-col items-center gap-3">
          {primary.href ? (
            <Link href={primary.href} className="btn-primary text-base px-6 py-3">
              <primary.icon className="h-5 w-5" />
              {dict.download.ctaDownloadFor.replace("{os}", primary.label)}
            </Link>
          ) : (
            <span className="btn-primary text-base px-6 py-3 opacity-45 cursor-not-allowed" aria-disabled="true">
              <primary.icon className="h-5 w-5" />
              {dict.download.ctaComingSoonFor.replace("{os}", primary.label)}
            </span>
          )}

          {primary.href ? (
            <p className="text-xs text-muted">
              {release
                ? dict.download.versionSizeDetected
                    .replace("{version}", release.version)
                    .replace("{size}", String(release.sizeMB))
                    .replace("{os}", primary.label)
                : dict.download.detected.replace("{os}", primary.label)}
            </p>
          ) : (
            <Link
              href={windows.href!}
              className="text-xs text-muted hover:text-foreground transition-colors underline underline-offset-2"
            >
              {dict.download.ctaDownloadWindowsInstead}
            </Link>
          )}
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.id}
            className={`panel glow-card p-6 flex flex-col items-center text-center gap-3 ${!platform.href ? "opacity-60" : ""}`}
            style={platform.id === detected ? { borderColor: "var(--accent)" } : undefined}
          >
            <div className="server-icon h-12 w-12">
              <platform.icon className="h-6 w-6" />
            </div>
            <h3 className="font-heading font-semibold text-foreground">{platform.label}</h3>
            <p className="text-sm text-muted">{platform.requirement}</p>
            {platform.href ? (
              <Link href={platform.href} className="btn-secondary mt-2 w-full justify-center">
                {platform.downloadLabel}
              </Link>
            ) : (
              <span className="tag-chip mt-2">{dict.download.comingSoon}</span>
            )}
          </div>
        ))}
      </div>

      <div className="panel mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
        <ShieldCheck className="h-6 w-6 text-muted shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-foreground text-sm">{dict.download.checksumsTitle}</p>
          <p className="text-sm text-muted mt-0.5">{dict.download.checksumsBody}</p>
        </div>
        <Link
          href={LAUNCHER_RELEASES_LIST_URL}
          className="text-sm text-accent hover:underline shrink-0 inline-flex items-center gap-1"
        >
          {dict.download.releaseNotes}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
