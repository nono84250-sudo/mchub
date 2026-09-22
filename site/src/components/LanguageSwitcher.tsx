"use client";

import { useTransition } from "react";
import { Translate } from "@phosphor-icons/react";
import { setLocale } from "@/lib/actions/locale";
import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/locales";

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale || pending) return;
    startTransition(() => {
      setLocale(next);
    });
  }

  return (
    <div className="flex items-center gap-1 text-sm text-muted" aria-label={t("language.label")}>
      <Translate className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <button
        type="button"
        onClick={() => switchTo("fr")}
        disabled={pending}
        className={locale === "fr" ? "text-foreground font-medium" : "hover:text-foreground transition-colors"}
      >
        FR
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        onClick={() => switchTo("en")}
        disabled={pending}
        className={locale === "en" ? "text-foreground font-medium" : "hover:text-foreground transition-colors"}
      >
        EN
      </button>
    </div>
  );
}
