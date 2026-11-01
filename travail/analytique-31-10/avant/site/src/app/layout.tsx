import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SiteChrome } from "@/components/SiteChrome";
import { SiteBanner } from "@/components/SiteBanner";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getT } from "@/i18n/getDictionary";
import "./globals.css";

const SITE_URL = "https://omniscientlauncher.com";
const SITE_NAME = "Omniscient";
const SITE_DESCRIPTION = "Découvrez des serveurs Minecraft et lancez-les en un clic.";

export const metadata: Metadata = {
  // Base des URLs absolues (og:url, og:image, canonical...) pour toutes les
  // pages qui n'en definissent pas la leur — voir decision domaine du 2026-10-12.
  metadataBase: new URL(SITE_URL),
  title: "Omniscient — Annuaire de serveurs Minecraft",
  description: SITE_DESCRIPTION,
  // Open Graph / Twitter Card par defaut : herites par toute page qui ne les
  // redefinit pas (voir regles de merge de generateMetadata) — servers/page.tsx
  // et servers/[slug]/page.tsx les precisent avec leur propre titre/description.
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: "Omniscient — Annuaire de serveurs Minecraft",
    description: SITE_DESCRIPTION,
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Omniscient — Annuaire de serveurs Minecraft",
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dict } = await getT();

  return (
    <html lang={locale} className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Systeme de design "Nocturne" : une seule famille (Inter) pour les titres et le
           corps de texte — hebergee sur le site (public/fonts/inter), plus aucune requete
           vers Google Fonts : l'IP des visiteurs ne part plus chez Google. En <link> plutot
           que next/font (bug de resolution Turbopack sur ce poste, voir globals.css). */}
        {/* eslint-disable-next-line @next/next/no-css-tags -- feuille statique de public/, chargee une fois dans le layout racine */}
        <link rel="stylesheet" href="/fonts/inter/inter.css" />
        {/* Bloquant, avant tout paint : evite le flash sombre->clair au
           chargement pour un visiteur ayant choisi "Clair" (voir
           ThemeSwitcher.tsx, meme logique que theme.js cote launcher). Ne
           peut pas passer par un Server Component, la preference vit en
           localStorage cote client, jamais sur le serveur. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem("theme")||"system";var m=p==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;document.documentElement.dataset.theme=m;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} dict={dict}>
          <SiteChrome>
            <SiteBanner />
            <Nav />
          </SiteChrome>
          <main className="flex-1">{children}</main>
          <SiteChrome>
            <Footer />
          </SiteChrome>
        </I18nProvider>
      </body>
    </html>
  );
}
