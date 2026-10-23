"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { STATE_COLOR } from "@/lib/playerGauge";

// Legende « ? » des couleurs d'etat (variante C, 17/10), la meme que dans le launcher.
export function ServerStateLegend() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rows = [
    { color: STATE_COLOR.ok, label: t("servers.state.legendOk") },
    { color: STATE_COLOR.warn, label: t("servers.state.legendWarn") },
    { color: STATE_COLOR.full, label: t("servers.state.legendFull") },
    { color: STATE_COLOR.off, label: t("servers.state.legendOff") },
    { color: STATE_COLOR.unk, label: t("servers.state.legendUnk"), dashed: true },
  ];

  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2.5 text-[13px] text-muted hover:text-foreground"
      >
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-border bg-surface text-xs font-bold text-foreground">?</span>
        {t("servers.state.legendQuestion")}
      </button>
      {open ? (
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[12.5px] text-foreground sm:grid-cols-2">
          {rows.map((r) => (
            <span key={r.label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-[9px] w-[9px] flex-shrink-0 rounded-full"
                style={"dashed" in r ? { border: `1.5px dashed ${r.color}` } : { background: r.color }}
              />
              {r.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
