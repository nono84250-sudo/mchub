import { DiscordLogo, Globe, TiktokLogo, YoutubeLogo } from "@phosphor-icons/react/ssr";
import { RichText } from "@/components/RichText";
import { GalleryGrid } from "@/components/GalleryGrid";
import { visibleSections, type PageSection, type ServerPageConfig } from "@/lib/serverPage";

export type ServerPageLabels = {
  sections: Record<PageSection, string>;
  videoCaption: string;
  social: { discord: string; website: string; youtube: string; tiktok: string };
};

// Sections personnalisables d'une fiche (voir lib/serverPage.ts), dans l'ordre choisi par le
// proprietaire. Sans etat : partage par la fiche publique (ServerDetailView, rendu serveur) et
// l'apercu en direct de l'editeur (ServerPageEditor, rendu client). Tous les liens sortants
// portent rel="nofollow ugc noopener" : ils sont saisis par un proprietaire, pas par l'equipe.
export function ServerPageSections({
  config,
  discordUrl,
  websiteUrl,
  labels,
}: {
  config: ServerPageConfig;
  discordUrl: string | null;
  websiteUrl: string | null;
  labels: ServerPageLabels;
}) {
  const sections = visibleSections(config, { discordUrl, websiteUrl });
  const links = [
    { href: discordUrl, label: labels.social.discord, Icon: DiscordLogo },
    { href: websiteUrl, label: labels.social.website, Icon: Globe },
    { href: config.youtubeUrl, label: labels.social.youtube, Icon: YoutubeLogo },
    { href: config.tiktokUrl, label: labels.social.tiktok, Icon: TiktokLogo },
  ].filter((l): l is typeof l & { href: string } => !!l.href);

  const body = (section: PageSection) => {
    switch (section) {
      case "about":
        return <RichText source={config.about} />;
      case "gallery":
        return <GalleryGrid items={config.gallery} />;
      case "video":
        return (
          <a
            href={`https://www.youtube.com/watch?v=${config.videoId}`}
            target="_blank"
            rel="nofollow ugc noopener noreferrer"
            className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-lg border border-border bg-surface-raised"
          >
            {/* Ni lecteur integre ni miniature chargee depuis YouTube (aucune requete vers Google tant que
                le joueur ne clique pas) : la video s'ouvre sur YouTube. */}
            <span className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_45%,#1d3550),#1d3550)]" />
            <span className="relative grid h-11 w-16 place-items-center rounded-xl bg-[#d22]">
              <span className="ml-1 border-y-[10px] border-l-[16px] border-y-transparent border-l-white" />
            </span>
            <span className="absolute bottom-2 left-3 text-xs text-white [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">{labels.videoCaption}</span>
          </a>
        );
      case "rules":
        return (
          <ol className="flex list-decimal flex-col gap-1 break-words pl-5 text-foreground">
            {config.rules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ol>
        );
      case "social":
        return (
          <div className="flex flex-wrap gap-2">
            {links.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="nofollow ugc noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:bg-surface-raised"
              >
                <Icon className="h-4 w-4" weight="fill" />
                {label}
              </a>
            ))}
          </div>
        );
    }
  };

  return (
    <>
      {sections.map((section) => (
        <section key={section} className="panel p-4 sm:p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.07em] text-accent">{labels.sections[section]}</h2>
          {body(section)}
        </section>
      ))}
    </>
  );
}
