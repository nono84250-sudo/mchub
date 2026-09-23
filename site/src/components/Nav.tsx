import Link from "next/link";
import { auth } from "@/auth";
import { LogoMark } from "@/components/LogoMark";
import { MobileNav } from "@/components/MobileNav";
import { AccountMenu } from "@/components/AccountMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { getT } from "@/i18n/getDictionary";

export async function Nav() {
  const session = await auth();
  const { dict } = await getT();

  return (
    <header className="relative border-b border-border bg-surface/95 backdrop-blur-md sticky top-0 z-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-heading flex items-center gap-2.5 font-semibold text-lg tracking-tight text-foreground">
            <LogoMark className="h-4 w-4" />
            Omniscient
          </Link>

          {/* Liens de nav principaux, colles au logo — les prochains viendront
              s'ajouter ici, de gauche a droite. */}
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/servers" className="text-muted hover:text-foreground transition-colors">
              {dict.nav.servers}
            </Link>
            <Link href="/download" className="text-muted hover:text-foreground transition-colors">
              {dict.nav.download}
            </Link>
          </nav>
        </div>

        <MobileNav loggedIn={!!session?.user} />

        {/* Elements utilitaires, toujours a droite. */}
        <div className="hidden sm:flex items-center gap-4 text-sm">
          <ThemeSwitcher />
          <LanguageSwitcher />

          {session?.user ? (
            <AccountMenu />
          ) : (
            <Link href="/login" className="btn-primary text-sm">
              {dict.nav.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
