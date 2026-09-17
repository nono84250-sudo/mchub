import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/lib/actions/auth";
import { CubeLogo } from "@/components/CubeLogo";

export async function Nav() {
  const session = await auth();

  return (
    <header className="border-b border-border bg-surface/95 backdrop-blur-md sticky top-0 z-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-heading flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
          <CubeLogo className="h-6 w-6" />
          Omniscient
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/servers" className="text-muted hover:text-foreground transition-colors">
            Serveurs
          </Link>

          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-muted hover:text-foreground transition-colors">
                Mon espace
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-1.5 text-muted hover:text-foreground hover:border-accent transition-colors"
                >
                  Se déconnecter
                </button>
              </form>
            </>
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
