"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Plus } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { ACCENT_DEEP, ACCENT_PALE, accentLuminance, isCustomAccent, type CustomAccent } from "@/lib/serverPage";

// Couleur libre de la fiche (16/10) : le rond « + » apres les couleurs proposees ouvre une
// palette (nuance a gauche/droite et haut/bas, teinte en dessous) avec le code HEX modifiable et
// le RGB. Seul un #rrggbb sort d'ici ; la lisibilite est geree par pageAccentVars.
type Hsv = { h: number; s: number; v: number };

function hsvToRgb({ h, s, v }: Hsv): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return [f(5), f(3), f(1)];
}
function rgbToHsv(r: number, g: number, b: number): Hsv {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}
const toHex = (rgb: number[]) => `#${rgb.map((x) => x.toString(16).padStart(2, "0")).join("")}` as CustomAccent;
const fromHex = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function AccentPicker({ value, start, onChange }: { value: CustomAccent | null; start: string; onChange: (hex: CustomAccent) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>({ h: 210, s: 0.6, v: 0.7 });
  const [hexText, setHexText] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);

  const rgb = hsvToRgb(hsv);
  const hex = toHex(rgb);
  const lum = accentLuminance(hex);

  const show = () => {
    const from = value ?? (isCustomAccent(start) ? start : "#2f78ad");
    setHsv(rgbToHsv(...fromHex(from)));
    setHexText(from.toUpperCase());
    setOpen(true);
  };
  const update = (next: Hsv) => {
    setHsv(next);
    setHexText(toHex(hsvToRgb(next)).toUpperCase());
  };

  // Fermeture : Echap, ou clic en dehors de la palette.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = svRef.current!.getBoundingClientRect();
    update({ ...hsv, s: clamp((e.clientX - r.left) / r.width), v: 1 - clamp((e.clientY - r.top) / r.height) });
  };
  const onSvKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: clamp(hsv.s - step) },
      ArrowRight: { s: clamp(hsv.s + step) },
      ArrowUp: { v: clamp(hsv.v + step) },
      ArrowDown: { v: clamp(hsv.v - step) },
    };
    if (!moves[e.key]) return;
    e.preventDefault();
    update({ ...hsv, ...moves[e.key] });
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-pressed={!!value}
        aria-expanded={open}
        aria-label={t("serverPage.editor.accentCustom")}
        title={t("serverPage.editor.accentCustom")}
        onClick={() => (open ? setOpen(false) : show())}
        className={`grid h-7 w-7 place-items-center rounded-full border-2 ${
          value ? "border-surface ring-2 ring-foreground" : "border-dashed border-muted text-foreground"
        }`}
        style={value ? { background: value } : undefined}
      >
        {value ? null : <Plus className="h-3.5 w-3.5" weight="bold" />}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t("serverPage.editor.accentCustom")}
          className="absolute right-0 top-9 z-30 sm:left-0 sm:right-auto w-[min(290px,calc(100vw-48px))] rounded-xl border border-border bg-surface p-3 shadow-[0_18px_40px_-14px_rgba(0,0,0,.5)]"
        >
          <div
            ref={svRef}
            role="slider"
            tabIndex={0}
            aria-label={t("serverPage.editor.accentShade")}
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={hex.toUpperCase()}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              pick(e);
            }}
            onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && pick(e)}
            onKeyDown={onSvKey}
            className="relative h-36 cursor-crosshair touch-none rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
          >
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={359}
            value={Math.round(hsv.h)}
            onChange={(e) => update({ ...hsv, h: Number(e.target.value) })}
            aria-label={t("serverPage.editor.accentHue")}
            className="my-3 h-3.5 w-full cursor-pointer appearance-none rounded-full"
            style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
          />
          <div className="grid grid-cols-[40px_1fr] items-center gap-x-2.5 gap-y-1.5 text-xs">
            <span className="row-span-2 h-10 w-10 rounded-lg border border-border" style={{ background: hex }} />
            <label className="flex items-center gap-2 font-semibold text-foreground">
              HEX
              <input
                value={hexText}
                maxLength={7}
                spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setHexText(v);
                  const full = v.startsWith("#") ? v : `#${v}`;
                  if (/^#[0-9a-fA-F]{6}$/.test(full)) setHsv(rgbToHsv(...fromHex(full.toLowerCase())));
                }}
                className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1 font-mono text-[13px] text-foreground"
              />
            </label>
            <span className="font-mono text-muted">RGB {rgb.join(", ")}</span>
          </div>
          <p className={`mt-2.5 text-xs ${lum > ACCENT_PALE || lum < ACCENT_DEEP ? "text-warn" : "text-muted"}`}>
            {lum > ACCENT_PALE
              ? t("serverPage.editor.accentTooLight")
              : lum < ACCENT_DEEP
                ? t("serverPage.editor.accentTooDark")
                : t("serverPage.editor.accentOk")}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3 py-1.5 text-[13px]">
              {t("serverPage.editor.cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(hex);
                setOpen(false);
              }}
              className="btn-primary px-3 py-1.5 text-[13px]"
            >
              {t("serverPage.editor.accentPick")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
