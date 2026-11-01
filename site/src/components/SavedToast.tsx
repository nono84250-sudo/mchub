"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

// Bulle apres un enregistrement reussi (design 2026-10-17, point 7) :
// « ✓ Fiche enregistree a 16:42 · Voir la fiche ↗ ». `savedAt` change a chaque
// enregistrement (horodatage) ; la bulle disparait seule apres quelques secondes.
export function SavedToast({ savedAt, href }: { savedAt: number | null | undefined; href?: string }) {
  const { t, locale } = useI18n();
  const [shownAt, setShownAt] = useState<number | null>(null);

  useEffect(() => {
    if (!savedAt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reagit a un nouvel enregistrement
    setShownAt(savedAt);
    const id = setTimeout(() => setShownAt(null), 6000);
    return () => clearTimeout(id);
  }, [savedAt]);

  if (!shownAt) return null;
  const time = new Date(shownAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-[13.5px] text-foreground shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]"
      style={{
        background: "color-mix(in srgb, var(--success) 14%, var(--surface))",
        borderColor: "color-mix(in srgb, var(--success) 45%, transparent)",
      }}
    >
      <span>{t("manage.savedToast").replace("{time}", time)}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
          {t("manage.seePage")}
        </a>
      ) : null}
    </div>
  );
}
