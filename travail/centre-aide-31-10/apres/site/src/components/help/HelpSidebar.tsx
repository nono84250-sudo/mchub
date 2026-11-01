import Link from "next/link";
import type { Locale } from "@/i18n/locales";
import type { HelpCategory } from "@/lib/help/types";
import type { VisibleArticle } from "@/lib/help/visibility";
import { HELP_UI } from "@/lib/help/ui";

// Liste de toutes les pages, rangée par catégorie (colonne de gauche sur ordinateur, menu
// dépliable sur téléphone). La page « Bugs connus » (/aide/bugs) est codée par le chantier du
// catalogue de bugs : ici on met seulement le lien, dans « Un problème ? ».
export function HelpSidebar({
  articles,
  categories,
  locale,
  current,
}: {
  articles: VisibleArticle[];
  categories: HelpCategory[];
  locale: Locale;
  current?: string;
}) {
  const list = (
    <nav aria-label={HELP_UI.allPages[locale]} className="flex flex-col gap-4 text-[13.5px]">
      <Link href="/aide" className={`font-semibold ${current ? "text-foreground hover:text-accent" : "text-accent"}`}>
        ← {HELP_UI.title[locale]}
      </Link>
      {categories.map((c) => (
        <div key={c.id} className="flex flex-col gap-0.5">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{c.title[locale]}</h2>
          {articles
            .filter((a) => a.cat === c.id)
            .map((a) => (
              <Link
                key={a.slug}
                href={`/aide/${a.slug}`}
                aria-current={a.slug === current ? "page" : undefined}
                className={`rounded-md px-2 py-1 leading-snug ${
                  a.slug === current ? "font-semibold text-accent" : "text-foreground/85 hover:text-accent"
                }`}
                style={a.slug === current ? { background: "color-mix(in srgb, var(--accent) 12%, transparent)" } : undefined}
              >
                {a.title[locale]}
              </Link>
            ))}
          {c.id === "fix" ? (
            <Link href="/aide/bugs" className="rounded-md px-2 py-1 leading-snug text-foreground/85 hover:text-accent">
              {HELP_UI.knownBugs[locale]}
            </Link>
          ) : null}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <details className="rounded-xl border border-border bg-surface p-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">{HELP_UI.allPages[locale]}</summary>
        <div className="mt-3">{list}</div>
      </details>
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">{list}</div>
      </aside>
    </>
  );
}
