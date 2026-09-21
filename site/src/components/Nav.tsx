import Link from "next/link";
import { auth } from "@/auth";
import { CubeLogo } from "@/components/CubeLogo";
import { MobileNav } from "@/components/MobileNav";
import { AccountMenu } from "@/components/AccountMenu";

export async function Nav() {
  const session = await auth();

  return (
    <header className="relative border-b border-border bg-surface/95 backdrop-blur-md sticky top-0 z-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-heading flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
          <CubeLogo className="h-6 w-6" />
          Omniscient
        </Link>

        <MobileNav loggedIn={!!session?.user} />

        <nav className="hidden sm:flex items-center gap-4 text-sm">
          <Link href="/servers" className="text-muted hover:text-foreground transition-colors">
            Serveurs
          </Link>

          {session?.user ? (
            <AccountMenu />
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-foreground transition-colors">
                Connexion
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground hover:bg-accent-hover transition-colors"
              >
                Créer un compte
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
