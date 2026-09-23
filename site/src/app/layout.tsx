import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SiteChrome } from "@/components/SiteChrome";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getT } from "@/i18n/getDictionary";
import "./globals.css";

// Systeme de design "Nocturne" : une seule famille (Inter) pour les titres
// et le corps de texte, plutot que deux polices distinctes.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Omniscient — Annuaire de serveurs Minecraft",
  description: "Découvrez des serveurs Minecraft et lancez-les en un clic.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dict } = await getT();

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
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
