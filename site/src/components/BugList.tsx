"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BADGE_STYLE } from "@/lib/bugBadge";

// Liste de la page publique « Bugs connus » (/aide/bugs) : filtres par statut et recherche. La
// recherche regarde aussi l'extrait de journal et la phrase repère : un joueur colle son erreur.
export type BugCard = {
  slug: string;
  status: "auto" | "consent" | "manual";
  title: string;
  symptom: string;
  guide: boolean;
  category: string;
  concerns: string;
  updated: string;
  search: string;
};

export type BugListLabels = {
  all: string;
  status: Record<BugCard["status"], string>;
  search: string;
  none: string;
  guide: string;
};

export function BugList({ cards, labels }: { cards: BugCard[]; labels: BugListLabels }) {
  const [filter, setFilter] = useState<"all" | BugCard["status"]>("all");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cards.filter((c) => (filter === "all" || c.status === filter) && (!term || c.search.includes(term)));
  }, [cards, filter, q]);
  const chips: ["all" | BugCard["status"], string][] = [["all", labels.all], ["auto", labels.status.auto], ["consent", labels.status.consent], ["manual", labels.status.manual]];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1.5 text-[13px] ${filter === k ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"}`}
          >
            {label} <b className="ml-1 font-semibold text-foreground">{cards.filter((c) => k === "all" || c.status === k).length}</b>
          </button>
        ))}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="h-[38px] w-full rounded-lg border border-border bg-surface px-3 text-[14px] text-foreground sm:ml-auto sm:w-[280px]"
        />
      </div>
      {shown.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((c) => (
            <Link key={c.slug} href={`/aide/bugs/${c.slug}`} className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-[18px] py-4 transition-colors hover:border-accent">
              <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={BADGE_STYLE[c.status]}>
                  {c.status === "auto" ? "✓ " : ""}
                  {labels.status[c.status]}
                </span>
                {c.guide ? <span className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-foreground">{labels.guide}</span> : null}
              </span>
              <span className="text-[15px] font-semibold leading-snug text-foreground">{c.title}</span>
              <span className="line-clamp-2 text-[13.5px] leading-normal text-muted">{c.symptom}</span>
              <span className="flex flex-wrap gap-x-2.5 gap-y-1 text-[12px] text-muted">
                <span>{c.category}</span>
                <span>{c.concerns}</span>
                <span>{c.updated}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-muted">{labels.none}</p>
      )}
    </div>
  );
}
