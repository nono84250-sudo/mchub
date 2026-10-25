"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

// Texte long replie sur 3 lignes avec « Lire la suite » (design 2026-10-17, point 6).
// Sous ~280 caracteres, affiche tel quel sans bouton.
export function ReadMoreText({ text, className = "" }: { text: string; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const long = text.length > 280;

  return (
    <>
      <p className={`whitespace-pre-wrap break-words ${long && !open ? "line-clamp-3" : ""} ${className}`}>{text}</p>
      {long ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 text-sm font-medium text-accent">
          {open ? `${t("serverDetail.readLess")} ▴` : `${t("serverDetail.readMore")} ▾`}
        </button>
      ) : null}
    </>
  );
}
