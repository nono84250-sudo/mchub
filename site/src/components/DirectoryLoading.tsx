"use client";

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react";
import { useI18n } from "@/i18n/I18nProvider";

// Annuaire (design 2026-10-17, point 5) : un changement de tri ou de filtre se
// VOIT pendant le chargement. Les filtres lancent la navigation dans cette
// transition partagee ; la liste affiche une fine barre en haut et des cartes
// fantomes de la meme taille que les vraies, pour que rien ne saute. Avec
// « Reduire les animations », la barre et les fantomes restent immobiles
// (motion-safe dans les classes ci-dessous).

type Ctx = { pending: boolean; start: TransitionStartFunction };
const DirectoryLoadingContext = createContext<Ctx | null>(null);

export function DirectoryLoadingProvider({ children }: { children: ReactNode }) {
  const [pending, start] = useTransition();
  return <DirectoryLoadingContext.Provider value={{ pending, start }}>{children}</DirectoryLoadingContext.Provider>;
}

// Hors provider (ne devrait pas arriver) : navigation directe, sans etat de chargement.
export function useDirectoryLoading(): Ctx {
  return useContext(DirectoryLoadingContext) ?? { pending: false, start: (fn) => fn() };
}

export function DirectoryResults({ children, ghosts = 4 }: { children: ReactNode; ghosts?: number }) {
  const { pending } = useDirectoryLoading();
  const { t } = useI18n();
  return (
    <div aria-busy={pending} className="relative mt-4">
      {pending ? (
        <>
          <div className="mb-3 h-[3px] overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-label={t("servers.loading")}>
            <span className="block h-full w-2/5 rounded-full bg-accent motion-safe:animate-[directory-slide_1s_ease-in-out_infinite]" />
          </div>
          <div className="grid grid-cols-1 gap-3 min-[1500px]:grid-cols-2">
            {Array.from({ length: ghosts }, (_, i) => (
              <div key={i} aria-hidden="true" className="panel flex h-32 overflow-hidden motion-safe:animate-pulse sm:h-36 min-[1500px]:h-[124px]">
                <span className="w-[104px] flex-shrink-0 bg-foreground/[0.07] sm:w-48 min-[1500px]:w-[130px]" />
                <span className="flex flex-1 flex-col gap-2.5 p-4">
                  <span className="h-2.5 w-2/5 rounded bg-foreground/10" />
                  <span className="h-2.5 w-3/5 rounded bg-foreground/10" />
                  <span className="h-2.5 w-4/5 rounded bg-foreground/10" />
                </span>
                <span className="hidden w-[116px] flex-col items-end justify-center gap-1.5 border-l border-border px-4 sm:flex min-[1500px]:w-24">
                  <span className="h-[22px] w-9 rounded bg-foreground/10" />
                  <span className="h-2 w-12 rounded bg-foreground/10" />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  );
}
