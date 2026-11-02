import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/getDictionary";
import { HelpBody } from "@/components/help/HelpBody";
import { HelpSidebar } from "@/components/help/HelpSidebar";
import { HelpContactBox } from "@/components/help/HelpContactBox";
import { bugsVisible, visibleHelp } from "@/lib/help/visibility";
import { HELP_BY_SLUG } from "@/lib/help/articles";
import { HELP_UI, helpDate } from "@/lib/help/ui";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await getT();
  const article = HELP_BY_SLUG.get(slug);
  if (!article || article.adminOnly) return { title: `${HELP_UI.title[locale]} — Omniscient`, robots: { index: false } };
  // Une page d'une fonction en test n'est pas proposée à Google tant qu'elle peut être cachée.
  if (article.feature) return { title: `${article.title[locale]} — Omniscient`, description: article.summary[locale] };
  return {
    title: `${article.title[locale]} — Omniscient`,
    description: article.summary[locale],
    alternates: { canonical: `/aide/${slug}` },
  };
}

// Une page du centre d'aide. Introuvable (404) si elle n'existe pas ou si sa fonction n'est pas
// visible pour ce visiteur (Laboratoire), pour ne jamais documenter une fonction invisible.
export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const { locale } = await getT();
  const { articles, categories } = await visibleHelp();
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();

  const category = categories.find((c) => c.id === article.cat);
  const related = (article.related ?? []).map((s) => articles.find((a) => a.slug === s)).filter((a): a is (typeof articles)[number] => !!a);

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[250px_minmax(0,1fr)]">
      <HelpSidebar articles={articles} categories={categories} locale={locale} current={slug} showBugs={await bugsVisible()} />

      <article className="flex min-w-0 max-w-[68ch] flex-col gap-5">
        <div className="text-[12.5px] text-muted">
          <Link href="/aide" className="text-accent hover:underline">
            {HELP_UI.home[locale]}
          </Link>
          {category ? <> › {category.title[locale]}</> : null}
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">{article.title[locale]}</h1>
          <p className="text-[15px] text-muted">{article.summary[locale]}</p>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
            <span>{HELP_UI.updated[locale].replace("{date}", helpDate(article.updated, locale))}</span>
            {article.beta ? <span className="rounded-full border border-accent px-1.5 font-semibold text-accent">{HELP_UI.beta[locale]}</span> : null}
            {article.isNew ? <span className="rounded-full border border-border px-1.5">{HELP_UI.newBadge[locale]}</span> : null}
          </div>
          {article.hidden ? (
            <p
              className="rounded-lg border border-dashed px-3 py-2 text-[12.5px] text-warn"
              style={{ borderColor: "color-mix(in srgb, var(--warn) 50%, transparent)" }}
            >
              {article.adminOnly ? HELP_UI.teamOnly[locale] : HELP_UI.hiddenPreview[locale]}
            </p>
          ) : null}
        </div>

        <HelpBody blocks={article.body} locale={locale} />

        {related.length ? (
          <section className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{HELP_UI.seeAlso[locale]}</h2>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/aide/${r.slug}`}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground hover:border-accent"
                >
                  {r.title[locale]}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <HelpContactBox locale={locale} />
      </article>
    </div>
  );
}
