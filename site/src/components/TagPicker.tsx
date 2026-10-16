"use client";

import { useState } from "react";
import { MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { PAGE_TAGS, type PageTag } from "@/lib/serverPage";

// Choix d'etiquettes de la fiche (version B validee par Rushi le 16/10) : rien n'est propose au
// depart, seules les etiquettes choisies sont visibles (avec une croix), et « + Ajouter » ouvre
// la liste fermee PAGE_TAGS avec une recherche. Sert aux principales et aux supplementaires.
export function TagPicker({
  selected,
  max,
  exclude = [],
  onChange,
  strong = false,
}: {
  selected: PageTag[];
  max: number;
  exclude?: PageTag[];
  onChange: (tags: PageTag[]) => void;
  strong?: boolean; // principales : pastille pleine ; supplementaires : plus discretes
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const full = selected.length >= max;
  const q = query.trim().toLowerCase();
  const rest = PAGE_TAGS.filter(
    (tag) => !selected.includes(tag) && !exclude.includes(tag) && t(`serverPage.tags.${tag}`).toLowerCase().includes(q),
  );
  const chipOn = strong
    ? "border-transparent bg-accent text-accent-foreground"
    : "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-foreground";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((tag) => {
          const name = t(`serverPage.tags.${tag}`);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(selected.filter((x) => x !== tag))}
              aria-label={t("serverPage.editor.tagRemove", { tag: name })}
              title={t("serverPage.editor.tagRemove", { tag: name })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium ${chipOn}`}
            >
              {name}
              <X className="h-3 w-3 opacity-75" weight="bold" />
            </button>
          );
        })}
        {!full ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-[13px] text-foreground hover:border-accent"
          >
            <Plus className="h-3 w-3" weight="bold" />
            {t("serverPage.editor.tagsAdd")}
          </button>
        ) : null}
      </div>

      {open && !full ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface-raised p-3">
          <label className="relative block">
            <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("serverPage.editor.tagsSearch")}
              aria-label={t("serverPage.editor.tagsSearch")}
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground"
              autoFocus
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {rest.length ? (
              rest.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const next = [...selected, tag];
                    onChange(next);
                    if (next.length >= max) setOpen(false);
                  }}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-[13px] text-foreground hover:border-accent"
                >
                  {t(`serverPage.tags.${tag}`)}
                </button>
              ))
            ) : (
              <span className="text-xs text-muted">{t("serverPage.editor.tagsNone")}</span>
            )}
          </div>
        </div>
      ) : null}
      <p className="text-xs text-muted">{t("serverPage.editor.tagsCount", { count: selected.length, max })}</p>
    </div>
  );
}
