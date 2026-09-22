"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/locales";
import { t as translate } from "@/i18n/t";

type I18nContextValue = { locale: Locale; t: (path: string, params?: Record<string, string | number>) => string };

const I18nContext = createContext<I18nContextValue | null>(null);

// Fourni une fois depuis le layout racine (Server Component, qui lit deja le
// cookie de langue) — les Client Components n'ont pas besoin de relire le
// cookie eux-memes, juste de consommer ce contexte via useI18n().
export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: React.ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: (path, params) => translate(dict, path, params) }),
    [locale, dict],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n() must be used within <I18nProvider>");
  return ctx;
}
