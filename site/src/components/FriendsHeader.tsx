"use client";

import { useEffect, useRef, useState } from "react";
import { Gear, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { FriendPrivacyCard } from "@/components/FriendPrivacyCard";

type Policy = "all" | "code" | "none";

// Titre de la page Amis + engrenage (valide par Rushi le 18/10) : le reglage « Qui peut m'ajouter
// en ami ? » ne prend plus le milieu de la page, il s'ouvre dans un petit panneau. Meme reglage
// que Parametres > Confidentialite. Croix, Echap ou clic a cote pour fermer.
export function FriendsHeader({ title, policy, code }: { title: string; policy: Policy; code: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const gear = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        gear.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <div className="flex items-center gap-2.5">
        <h1 className="flex-1 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <button
          ref={gear}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={t("friends.gearLabel")}
          title={t("friends.gearLabel")}
          className={`grid h-[34px] w-[34px] place-items-center rounded-lg border transition-colors ${
            open ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"
          }`}
        >
          <Gear className="h-[18px] w-[18px]" />
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label={t("friends.gearLabel")}
          className="absolute right-0 top-11 z-30 flex w-[min(360px,100%)] flex-col gap-2 rounded-xl border border-border bg-surface p-3.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.55)]"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("confirm.cancel")}
            className="absolute right-3 top-3 text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <FriendPrivacyCard initialPolicy={policy} initialCode={code} />
          <p className="text-xs text-muted">
            {t("friends.alsoIn")}{" "}
            <Link href="/dashboard/parametres" className="text-accent hover:underline">
              {t("friends.alsoInLink")}
            </Link>
          </p>
        </div>
      ) : null}

      {policy === "none" ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12.5px] text-muted">
          {t("friends.noneBannerShort")}
          <button type="button" onClick={() => setOpen(true)} className="font-semibold text-accent">
            {t("friends.change")}
          </button>
        </p>
      ) : null}
    </div>
  );
}
