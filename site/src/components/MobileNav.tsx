"use client";

import { useState } from "react";
import Link from "next/link";
import { List, X } from "@phosphor-icons/react";
import { logout } from "@/lib/actions/auth";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Repli mobile de la nav globale (voir Nav.tsx) — sous ~640px, "Serveurs /
// Mon espace / Se déconnecter" n'ont plus la place de tenir sur une ligne à
// côté du logo et débordaient hors de l'écran. Un seul bouton ouvre les
// mêmes liens en liste verticale.
export function MobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground"
      >
        {open ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-border bg-surface px-4 py-3 shadow-lg">
          <Link
            href="/servers"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
          >
            {t("nav.servers")}
          </Link>
          <Link
            href="/download"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
          >
            {t("nav.download")}
          </Link>

          {loggedIn ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
              >
                {t("nav.mySpace")}
              </Link>
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
              >
                {t("nav.profile")}
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-surface-raised hover:text-foreground"
                >
                  {t("nav.logout")}
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="btn-primary text-sm">
              {t("nav.login")}
            </Link>
          )}

          <div className="border-t border-border mt-2 pt-2 px-3">
            <LanguageSwitcher />
          </div>
        </div>
      ) : null}
    </div>
  );
}
