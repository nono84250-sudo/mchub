import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SiteChrome } from "@/components/SiteChrome";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SiteChrome>
          <Nav />
        </SiteChrome>
        <main className="flex-1">{children}</main>
        <SiteChrome>
          <Footer />
        </SiteChrome>
      </body>
    </html>
  );
}
