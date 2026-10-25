"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

// Lien « Jouer chez nous » (design 2026-10-17, point 7) : l'adresse de la fiche, a
// coller sur Discord. Elle ouvre la fiche avec le bouton « Ouvrir dans le launcher ».
// L'origine n'est connue qu'apres le montage (pas de window cote serveur).
export function PlayLinkField({ path }: { path: string }) {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- origine lue apres le rendu serveur
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore : le lien reste visible et selectionnable
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border bg-surface px-2.5 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">{url}</code>
        <button type="button" onClick={copy} className="btn-secondary px-3 py-1 text-[13px]">
          {copied ? t("manage.copied") : t("manage.copy")}
        </button>
      </div>
      <p className="text-xs text-muted">{t("manage.playLinkHint")}</p>
    </div>
  );
}
