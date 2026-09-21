"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { logout } from "@/lib/actions/auth";

// Repli mobile de la nav globale (voir Nav.tsx) — sous ~640px, "Serveurs /
// Mon espace / Se déconnecter" n'ont plus la place de tenir sur une ligne à
// côté du logo et débordaient hors de l'écran. Un seul bouton ouvre les
// mêmes liens en liste verticale.
export function MobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-border bg-surface px-4 py-3 shadow-lg">
          <Link
            href="/servers"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
          >
            Serveurs
          </Link>

          {loggedIn ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
              >
                Mon espace
              </Link>
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
              >
                Profil
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-surface-raised hover:text-foreground"
                >
                  Se déconnecter
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
              >
                Connexion
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)} className="btn-primary text-sm">
                Créer un compte
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
