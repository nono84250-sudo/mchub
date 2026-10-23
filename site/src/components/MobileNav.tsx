"use client";

import { useState } from "react";
import Link from "next/link";
import { List, X } from "@phosphor-icons/react";
import { logout } from "@/lib/actions/auth";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { UnreadBadge } from "@/components/UnreadBadge";
import { TEAMS_READY } from "@/lib/teamRules";

// Repli mobile de la nav globale (voir Nav.tsx) — sous ~640px, "Serveurs /
// Mon espace / Se déconnecter" n'ont plus la place de tenir sur une ligne à
// côté du logo et débordaient hors de l'écran. Un seul bouton ouvre les
// mêmes liens en liste verticale.
export function MobileNav({ loggedIn, unread = 0 }: { loggedIn: boolean; unread?: number }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground"
      >
        {open ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
        {!open && unread ? <UnreadBadge count={unread} className="pointer-events-none absolute -right-1.5 -top-1.5" /> : null}
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
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
          >
            {t("nav.contact")}
          </Link>

          {loggedIn ? (
            <>
              {/* Lot 6 (18/10) : « Mon compte », memes noms que le launcher (plus de Profil). */}
              <p className="mt-2 border-t border-border px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                {t("nav.myAccount")}
              </p>
              {[
                { href: "/dashboard", label: t("nav.mySpace"), badge: 0 },
                { href: "/dashboard/amis", label: t("nav.friends"), badge: 0 },
                ...(TEAMS_READY ? [{ href: "/dashboard/team", label: t("dashboard.navTeam"), badge: 0 }] : []),
                { href: "/dashboard/notifications", label: t("nav.notifications"), badge: unread },
                { href: "/dashboard/parametres", label: t("nav.settings"), badge: 0 },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
                >
                  {l.label}
                  <UnreadBadge count={l.badge} />
                </Link>
              ))}
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

          <div className="border-t border-border mt-2 pt-2 px-3 flex items-center justify-between">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      ) : null}
    </div>
  );
}
