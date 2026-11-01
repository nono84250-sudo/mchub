"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info, Warning, WarningOctagon } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

// Une seule fenetre de confirmation pour tout le site (lot 4 de l'audit, 18/10), memes
// regles que le launcher : le titre est une question qui nomme la chose, une phrase dit
// ce qui se passe, le bouton porte le verbe de l'action (jamais « OK »). Annuler a gauche
// avec le focus ; Echap ou un clic sur le fond annulent ; le focus reste dans la fenetre
// puis revient au bouton qui l'a ouverte. 3 tons : ok (rien n'est perdu), warn (ca se
// refait mais ca derange), danger (perdu ou difficile a refaire). Option « ecrire le nom » :
// le bouton reste grise tant que le texte tape n'est pas exactement ce nom.
export type ConfirmTone = "ok" | "warn" | "danger";
export type ConfirmOptions = {
  title: string;
  body: string;
  confirmLabel: string;
  tone?: ConfirmTone;
  // Texte a recopier exactement avant de pouvoir confirmer (ex. le nom du serveur).
  typeToConfirm?: string;
};

const TONE_COLOR: Record<ConfirmTone, string> = {
  ok: "var(--accent)",
  warn: "var(--state-busy)",
  danger: "var(--danger)",
};
const TONE_ICON = { ok: Info, warn: Warning, danger: WarningOctagon } as const;

export function useConfirm(): { confirm: (o: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
    // Retour du focus sur le bouton d'origine.
    setTimeout(() => opener.current?.focus(), 0);
  }, []);

  return { confirm, dialog: opts ? <ConfirmDialog options={opts} onClose={close} /> : null };
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (v: boolean) => void }) {
  const { t } = useI18n();
  const tone = options.tone ?? "ok";
  const color = TONE_COLOR[tone];
  const Icon = TONE_ICON[tone];
  const titleId = useId();
  const bodyId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState("");
  const blocked = options.typeToConfirm !== undefined && typed !== options.typeToConfirm;

  useEffect(() => {
    cancelBtn.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose(false);
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    // Piege du focus : Tab et Maj+Tab restent dans la fenetre.
    const items = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), input")];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-[420px] overflow-hidden rounded-xl border border-border bg-surface shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]"
      >
        <div aria-hidden="true" className="h-1" style={{ background: color }} />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" weight="fill" style={{ color }} />
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-foreground">
                {options.title}
              </h2>
              <p id={bodyId} className="mt-1 text-sm text-muted">
                {options.body}
              </p>
            </div>
          </div>
          {options.typeToConfirm !== undefined ? (
            <label className="flex flex-col gap-1.5 text-xs text-muted">
              <span>
                {t("confirm.typeBefore")} <b className="text-foreground">{options.typeToConfirm}</b> {t("confirm.typeAfter")}
              </span>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="field-input"
              />
            </label>
          ) : null}
          <div className="mt-1 flex justify-end gap-2">
            <button ref={cancelBtn} type="button" onClick={() => onClose(false)} className="btn-secondary text-sm">
              {t("confirm.cancel")}
            </button>
            <button
              type="button"
              disabled={blocked}
              onClick={() => onClose(true)}
              className={`${tone === "ok" ? "btn-fill" : "inline-flex items-center justify-center rounded-lg"} px-4 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-45`}
              style={tone === "ok" ? undefined : { background: color, color: "var(--background)" }}
            >
              {options.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
