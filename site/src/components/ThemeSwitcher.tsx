"use client";

import { useEffect, useState } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

type ThemePreference = "system" | "dark" | "light";
const STORAGE_KEY = "theme";

// "system" ne s'ecrit jamais sur <html> (voir aussi le script inline dans
// layout.tsx qui fait la meme resolution avant hydration, et theme.js cote
// launcher qui suit exactement le meme principe pour rester coherent entre
// les deux apps) — seul le resultat ("light"/"dark") y est pose.
function resolveThemeMode(pref: ThemePreference): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(pref: ThemePreference) {
  document.documentElement.dataset.theme = resolveThemeMode(pref);
}

export function ThemeSwitcher() {
  const { t } = useI18n();
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") setPref(stored);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (pref === "system") applyTheme("system");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [pref]);

  function choose(next: ThemePreference) {
    setPref(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  const OPTIONS: { value: ThemePreference; icon: typeof Desktop; label: string }[] = [
    { value: "system", icon: Desktop, label: t("theme.system") },
    { value: "dark", icon: Moon, label: t("theme.dark") },
    { value: "light", icon: Sun, label: t("theme.light") },
  ];

  return (
    <div className="flex items-center gap-1" aria-label={t("theme.label")}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => choose(option.value)}
          aria-label={option.label}
          aria-pressed={pref === option.value}
          title={option.label}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
            pref === option.value ? "text-foreground bg-surface-raised" : "text-muted hover:text-foreground"
          }`}
        >
          <option.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
