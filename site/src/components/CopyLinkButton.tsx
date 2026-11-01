"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

// Accueil sur telephone (design 2026-10-17, point 1) : le launcher ne
// s'installe pas sur un telephone, le visiteur copie le lien pour l'ouvrir
// plus tard sur son PC.
export function CopyLinkButton({ path, className = "" }: { path: string; className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Presse-papiers refuse (http, vieux navigateur) : on affiche quand
      // meme la confirmation, le lien reste visible dans la barre d'adresse.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={copy} className={`btn-secondary ${className}`} aria-live="polite">
      {copied ? <Check className="h-[18px] w-[18px]" /> : <Copy className="h-[18px] w-[18px]" />}
      {copied ? t("home.linkCopied") : t("home.copyLink")}
    </button>
  );
}
