import Link from "next/link";
import { getT } from "@/i18n/getDictionary";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

// Langue/Apparence vivent ici (pied de page, toutes les pages, connecte ou
// non) plutot que dans la barre de nav — voir AccountMenu.tsx pour l'acces
// rapide propose en plus une fois connecte. "Publier un serveur" retire de
// partout.
export async function Footer() {
  const { dict } = await getT();

  return (
    <footer className="border-t border-border mt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
        <p>
          <span className="text-foreground font-medium">Omniscient</span> — {dict.footer.tagline}
        </p>
        <div className="flex items-center gap-5">
          <Link href="/servers" className="hover:text-foreground transition-colors">
            {dict.footer.servers}
          </Link>
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
