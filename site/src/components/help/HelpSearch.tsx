"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";

export type HelpSearchItem = { slug: string; title: string; summary: string; cat: string; text: string; beta: boolean };
type Labels = { placeholder: string; none: string; noneCta: string; results: string; beta: string };

// Recherche sans accents ni majuscules (« echec » trouve « échec »), comme la FAQ.
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Recherche du centre d'aide, entièrement dans le navigateur (aucun service tiers). Tant que le
// champ est vide, on montre l'accueil (children). Chaque mot tapé doit se trouver dans la page ;
// le titre compte plus que le texte.
export function HelpSearch({ items, labels, children }: { items: HelpSearchItem[]; labels: Labels; children: ReactNode }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === "/" && target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const words = norm(query.trim()).split(/\s+/).filter(Boolean);
  const results = words.length
    ? items
        .map((it) => {
          const title = norm(it.title);
          const all = norm(`${it.title} ${it.summary} ${it.text}`);
          if (!words.every((w) => all.includes(w))) return null;
          const score = words.reduce((n, w) => n + (title.includes(w) ? 3 : 0) + (norm(it.summary).includes(w) ? 1 : 0), 0);
          return { it, score };
        })
        .filter((r): r is { it: HelpSearchItem; score: number } => !!r)
        .sort((a, b) => b.score - a.score)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
        <MagnifyingGlass className="h-[18px] w-[18px] flex-shrink-0 text-muted" />
        <span className="sr-only">{labels.placeholder}</span>
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.placeholder}
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-foreground outline-none"
        />
        <kbd className="hidden rounded border border-border px-1.5 text-[11px] text-muted sm:inline">/</kbd>
      </label>

      {words.length ? (
        <div aria-live="polite" className="flex flex-col gap-2">
          {results.length ? (
            <>
              <p className="text-[12.5px] text-muted">{labels.results.replace("{n}", String(results.length))}</p>
              {results.map(({ it }) => (
                <Link
                  key={it.slug}
                  href={`/aide/${it.slug}`}
                  className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
                >
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-foreground">
                    {it.title}
                    {it.beta ? <span className="rounded-full border border-accent px-1.5 text-[10.5px] font-semibold text-accent">{labels.beta}</span> : null}
                  </span>
                  <span className="text-[13.5px] text-muted">{it.summary}</span>
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-accent">{it.cat}</span>
                </Link>
              ))}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              {labels.none.replace("{query}", query.trim())}
              <br />
              <Link href="/contact" className="text-accent hover:underline">
                {labels.noneCta} →
              </Link>
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
