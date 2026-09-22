"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { logout } from "@/lib/actions/auth";
import { useI18n } from "@/i18n/I18nProvider";

// La console de gestion masque la nav du site (voir SiteChrome) — ce menu
// est donc le seul moyen de revenir au site principal ou de se deconnecter
// depuis une page /manage/*.
export function ManageAvatarMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const initial = (name || email).trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-surface-raised"
      >
        <span className="server-icon h-8 w-8 text-sm">{initial}</span>
        <span className="max-w-[140px] truncate">{name || email}</span>
        <CaretDown className="h-4 w-4 text-muted" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-lg">
          <Link
            href="/dashboard"
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
            onClick={() => setOpen(false)}
          >
            {t("manage.backToSite")}
          </Link>
          <Link
            href="/account"
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
            onClick={() => setOpen(false)}
          >
            {t("manage.profile")}
          </Link>
          <form action={logout}>
            <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-surface-raised">
              {t("manage.logout")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
