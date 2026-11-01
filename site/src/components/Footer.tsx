import Link from "next/link";
import { getT } from "@/i18n/getDictionary";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LogoMark } from "@/components/LogoMark";
import { FooterLink } from "@/components/FooterLink";

// Pied de page en colonnes (valide le 17/10) : Omniscient, Produit, Aide (avec la
// FAQ), Legal, Communaute (« bientot »). Langue/Apparence restent en bas, toutes les
// pages, connecte ou non (voir AccountMenu.tsx pour l'acces rapide une fois connecte).
// Les pages legales demandees pour l'application Discord (2026-10-14) restent la.
export async function Footer() {
  const { dict, locale } = await getT();
  const f = dict.footer;

  type FooterItem = { label: string; href?: string; soon?: boolean; external?: boolean };
  const columns: { title: string; links: FooterItem[] }[] = [
    {
      title: f.product,
      links: [
        { label: f.servers, href: "/servers" },
        { label: f.download, href: "/download" },
        { label: f.howItWorks, href: "/#comment-ca-marche" },
        { label: f.addServer, href: "/dashboard/servers/new" },
      ],
    },
    {
      title: f.help,
      links: [
        // Centre d'aide et bugs connus (01/11, demande de Rushi) : libellés écrits ici pour ne pas toucher aux dictionnaires.
        { label: locale === "en" ? "Help center" : "Centre d'aide", href: "/aide" },
        { label: locale === "en" ? "Known bugs" : "Bugs connus", href: "/aide/bugs" },
        { label: f.faq, href: "/faq" },
        { label: f.contact, href: "/contact" },
      ],
    },
    {
      title: f.legal,
      links: [
        { label: f.termsLong, href: "/cgu" },
        { label: f.privacyShort, href: "/confidentialite" },
      ],
    },
    {
      // Communaute : Discord ouvert le 01/11. YouTube n'existe pas encore : le jour venu,
      // mettre le lien (href) et retirer « soon ».
      title: f.community,
      links: [
        { label: "Discord", href: "https://discord.gg/HGXN34umC2", external: true },
        { label: "YouTube", soon: true },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-5 pt-7 text-[13.5px] sm:px-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] sm:gap-[22px]">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 font-semibold text-foreground">
              <LogoMark className="h-4 w-4" />
              Omniscient
            </Link>
            <p className="mt-2 max-w-[240px] leading-snug text-muted">Omniscient — {f.tagline}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="mb-2.5 text-[12.5px] font-semibold text-foreground">{col.title}</h2>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-muted transition-colors hover:text-foreground">
                        {link.label}
                      </a>
                    ) : link.href ? (
                      <FooterLink href={link.href}>{link.label}</FooterLink>
                    ) : (
                      <span className="text-muted">
                        {link.label}
                        {link.soon ? (
                          <span className="ml-1 rounded-full border border-border px-1.5 text-[10.5px]">{f.soon}</span>
                        ) : null}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5 text-[12.5px] text-muted">
          <span>{f.copyright}</span>
          <span className="flex items-center gap-4">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </span>
        </div>
      </div>
    </footer>
  );
}
