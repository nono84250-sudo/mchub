"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { CaretDown, Desktop, Moon, Sun } from "@phosphor-icons/react";
import { logout } from "@/lib/actions/auth";
import { setLocale } from "@/lib/actions/locale";
import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/locales";

type ThemePreference = "system" | "dark" | "light";
const THEME_STORAGE_KEY = "theme";

// Meme logique de resolution que ThemeSwitcher.tsx (et theme.js cote
// launcher, pour rester coherent entre les deux apps) — dupliquee ici plutot
// que reutilisee en composant : ce menu a besoin de piloter l'etat "replie/
// deplie" de la section Apparence, que ThemeSwitcher n'expose pas.
function resolveThemeMode(pref: ThemePreference): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function applyTheme(pref: ThemePreference) {
  document.documentElement.dataset.theme = resolveThemeMode(pref);
}

// Regroupe "Mon espace" (profil, dashboard) ET les reglages rapides (langue,
// apparence) dans un seul menu deroulant plutot que des icones eparpillees
// dans la barre — meme pattern que ManageAvatarMenu (console de gestion),
// pour rester coherent entre le site et la console. Langue et Apparence ne
// sont proposees ici QUE connecte (voir Nav.tsx, qui garde les selecteurs
// autonomes hors connexion, puisqu'il n'y a alors aucun "Mon espace").
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [themePref, setThemePref] = useState<ThemePreference>("system");
  const rootRef = useRef<HTMLDivElement>(null);
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") setThemePref(stored);
  }, []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  function switchLocale(next: Locale) {
    if (next === locale || pending) return;
    startTransition(() => setLocale(next));
  }

  function chooseTheme(next: ThemePreference) {
    setThemePref(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  }

  const THEME_OPTIONS: { value: ThemePreference; icon: typeof Desktop; label: string }[] = [
    { value: "system", icon: Desktop, label: t("theme.system") },
    { value: "dark", icon: Moon, label: t("theme.dark") },
    { value: "light", icon: Sun, label: t("theme.light") },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-muted hover:text-foreground transition-colors"
      >
        {t("nav.mySpace")}
        <CaretDown className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-lg">
          <Link
            href="/account"
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
            onClick={() => setOpen(false)}
          >
            {t("nav.profile")}
          </Link>
          <Link
            href="/dashboard"
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
            onClick={() => setOpen(false)}
          >
            {t("nav.dashboard")}
          </Link>

          <div className="my-1.5 border-t border-border" />

          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-foreground">{t("language.label")}</span>
            <div className="flex items-center gap-1 text-sm text-muted">
              <button
                type="button"
                onClick={() => switchLocale("fr")}
                disabled={pending}
                className={locale === "fr" ? "text-foreground font-medium" : "hover:text-foreground transition-colors"}
              >
                FR
              </button>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => switchLocale("en")}
                disabled={pending}
                className={locale === "en" ? "text-foreground font-medium" : "hover:text-foreground transition-colors"}
              >
                EN
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAppearanceOpen((v) => !v)}
            aria-expanded={appearanceOpen}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
          >
            {t("theme.appearanceLabel")}
            <CaretDown className={`h-3.5 w-3.5 text-muted transition-transform ${appearanceOpen ? "rotate-180" : ""}`} />
          </button>
          {appearanceOpen ? (
            <div className="flex items-center gap-1.5 px-3 pb-2 pt-1">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => chooseTheme(option.value)}
                  aria-label={option.label}
                  aria-pressed={themePref === option.value}
                  title={option.label}
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    themePref === option.value ? "text-foreground bg-surface-raised" : "text-muted hover:text-foreground"
                  }`}
                >
                  <option.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="my-1.5 border-t border-border" />

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
