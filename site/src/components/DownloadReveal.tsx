"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";

// Page Telecharger (variante choisie par Rushi le 17/10) : « Apres le clic » reste
// cache tant qu'on n'a pas clique sur Telecharger, puis s'affiche juste en dessous
// pour que le visiteur sache a quoi s'attendre (dont l'ecran bleu de Windows).
const RevealContext = createContext<{ revealed: boolean; reveal: () => void } | null>(null);

export function DownloadRevealProvider({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return <RevealContext.Provider value={{ revealed, reveal: () => setRevealed(true) }}>{children}</RevealContext.Provider>;
}

// Lien de telechargement normal (le fichier part tout de suite) qui, en plus, montre les etapes.
export function DownloadLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const ctx = useContext(RevealContext);
  return (
    <a href={href} className={className} onClick={() => ctx?.reveal()}>
      {children}
    </a>
  );
}

export function AfterDownloadClick({ href, children }: { href: string; children: ReactNode }) {
  const ctx = useContext(RevealContext);
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const revealed = !!ctx?.revealed;

  useEffect(() => {
    if (!revealed) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  }, [revealed]);

  if (!revealed) return null;
  return (
    <section
      ref={ref}
      className="scroll-mt-20 rounded-2xl border border-accent p-4 flex flex-col gap-3"
      style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}
    >
      <p className="flex items-center gap-2.5 font-semibold text-foreground" role="status">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-success text-[13px] text-[#06261a]">✓</span>
        {t("download.started")}
      </p>
      {children}
      <p className="text-[0.8rem] text-muted">
        <a href={href} className="underline underline-offset-2 hover:text-foreground">
          {t("download.restart")}
        </a>
      </p>
    </section>
  );
}
