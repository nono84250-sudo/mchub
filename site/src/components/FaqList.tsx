"use client";

import { useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

export type FaqItem = { cat: string; id: string; q: string; a: string };
const CATS = ["all", "launcher", "account", "mods", "servers", "owners"] as const;

// Recherche sans accents ni majuscules (« echec » trouve « échec »).
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Page « Questions fréquentes » (validee le 17/10) : themes, recherche, et
// accordeon (la reponse s'ouvre au clic, le + devient ×). Les questions viennent
// du dictionnaire (faq.items), en francais et en anglais.
export function FaqList({ items }: { items: FaqItem[] }) {
  const { t } = useI18n();
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ [items[0]?.id ?? ""]: true });

  const nq = norm(query.trim());
  const list = items.filter((it) => (cat === "all" || it.cat === cat) && (!nq || norm(`${it.q} ${it.a}`).includes(nq)));

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
        <MagnifyingGlass className="h-4 w-4 flex-shrink-0 text-muted" />
        <span className="sr-only">{t("faq.search")}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("faq.search")}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none"
        />
      </label>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("faq.title")}>
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] ${
              cat === c ? "btn-fill border-transparent px-3 py-1.5 font-semibold" : "border-border bg-surface text-foreground hover:border-accent"
            }`}
          >
            {t(`faq.categories.${c}`)}
          </button>
        ))}
      </div>

      <div>
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            {t("faq.none", { query: query.trim() })}
            <br />
            <Link href="/contact" className="text-accent hover:underline">
              {t("faq.noneCta")} →
            </Link>
          </div>
        ) : (
          CATS.slice(1).map((c) => {
            const group = list.filter((it) => it.cat === c);
            if (!group.length) return null;
            return (
              <div key={c} className="mb-2">
                {cat === "all" ? (
                  <h2 className="mb-1.5 mt-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-accent">{t(`faq.categories.${c}`)}</h2>
                ) : null}
                {group.map((it) => {
                  const isOpen = !!open[it.id];
                  return (
                    <div key={it.id} className="mb-1.5 overflow-hidden rounded-xl border border-border bg-surface">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`faq-${it.id}`}
                        onClick={() => setOpen((o) => ({ ...o, [it.id]: !o[it.id] }))}
                        className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-[14.5px] font-medium text-foreground focus-visible:rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                      >
                        <span className="min-w-0 flex-1">{it.q}</span>
                        <span
                          aria-hidden="true"
                          className={`grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-md border text-sm transition-transform ${
                            isOpen ? "rotate-45 border-accent text-accent" : "border-border text-muted"
                          }`}
                        >
                          +
                        </span>
                      </button>
                      {isOpen ? (
                        <p id={`faq-${it.id}`} className="px-3.5 pb-3.5 text-sm leading-relaxed text-muted">
                          {it.a}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
