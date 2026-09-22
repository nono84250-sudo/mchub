"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { useI18n } from "@/i18n/I18nProvider";

// Regroupe "Mon espace" et "Se déconnecter" dans un seul menu déroulant au
// lieu de deux éléments séparés dans la barre — même pattern que
// ManageAvatarMenu (console de gestion), pour rester cohérent entre le site
// et la console.
export function AccountMenu() {
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-muted hover:text-foreground transition-colors"
      >
        {t("nav.mySpace")}
        <ChevronDown className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border bg-surface p-1.5 shadow-lg">
          <Link
            href="/dashboard"
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
            onClick={() => setOpen(false)}
          >
            {t("nav.dashboard")}
          </Link>
          <Link
            href="/account"
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
            onClick={() => setOpen(false)}
          >
            {t("nav.profile")}
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-surface-raised"
            >
              {t("nav.logout")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
