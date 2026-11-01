"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

const STORAGE_KEY = "omniscient.howToPlayClosed";

// Fiche serveur (design 2026-10-17, point 6) : « Comment je joue ? » pour les joueurs
// arrives par un lien Discord sans rien connaitre. Visible tant qu'on ne l'a pas ferme
// (souvenir dans le navigateur), pour ne pas gener les habitues. Cache au premier rendu
// pour ne pas clignoter chez ceux qui l'ont deja ferme.
export function ServerHowToPlay({ launcherHref }: { launcherHref: string }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let closed = false;
    try {
      closed = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Stockage bloque (navigation privee) : on l'affiche, fermable pour la visite.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du navigateur apres le rendu serveur
    if (!closed) setShow(true);
  }, []);

  if (!show) return null;

  function close() {
    setShow(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-3.5 rounded-2xl border px-4 py-3.5"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 55%, var(--border))",
        background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
      }}
    >
      <div className="min-w-[240px] flex-1">
        <p className="mb-1 font-semibold text-foreground">{t("serverDetail.howTitle")}</p>
        <ol className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-foreground">
          {["serverDetail.how1", "serverDetail.how2", "serverDetail.how3"].map((key, i) => (
            <li key={key} className="flex gap-1.5">
              <span className="font-semibold text-accent">{i + 1}.</span>
              {t(key)}
            </li>
          ))}
        </ol>
      </div>
      <a href={launcherHref} className="btn-fill px-3 py-1.5 text-[13px]">
        <ArrowSquareOut className="h-4 w-4" weight="bold" />
        {t("serverDetail.openInLauncher")}
      </a>
      <button type="button" onClick={close} className="text-xs text-muted hover:text-foreground">
        {t("serverDetail.howClose")} ✕
      </button>
    </div>
  );
}
