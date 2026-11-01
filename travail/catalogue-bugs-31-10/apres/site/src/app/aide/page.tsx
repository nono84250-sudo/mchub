import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bug, Lifebuoy, Question, Sparkle } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";
import { HelpSearch, type HelpSearchItem } from "@/components/help/HelpSearch";
import { HelpContactBox } from "@/components/help/HelpContactBox";
import { plainHelpText } from "@/components/help/HelpText";
import { bugsVisible, visibleHelp } from "@/lib/help/visibility";
import { HELP_UI } from "@/lib/help/ui";
import type { HelpBlock } from "@/lib/help/types";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return {
    title: `${HELP_UI.title[locale]} — Omniscient`,
    description: HELP_UI.metaDescription[locale],
    alternates: { canonical: "/aide" },
  };
}

function blocksText(blocks: HelpBlock[], locale: Locale): string {
  return blocks
    .map((b) => {
      if ("p" in b) return b.p[locale];
      if ("h" in b) return b.h[locale];
      if ("note" in b) return b.note[locale];
      if ("warn" in b) return b.warn[locale];
      return ("steps" in b ? b.steps : b.list).map((s) => s[locale]).join(" ");
    })
    .map(plainHelpText)
    .join(" ");
}

// Centre d'aide (31/10, structure C validée dans le brainstorming du 28/10) : une recherche, des
// parcours (« Je joue », « Jouer en solo », « J'ai un serveur »), « Un problème ? » et les
// nouveautés. Les pages des fonctions en test n'apparaissent qu'à ceux qui les voient.
export default async function HelpHome() {
  const { locale } = await getT();
  const { articles, categories, isAdmin } = await visibleHelp();
  const showBugs = await bugsVisible();
  const catTitle = new Map(categories.map((c) => [c.id, c.title[locale]]));

  const items: HelpSearchItem[] = articles.map((a) => ({
    slug: a.slug,
    title: a.title[locale],
    summary: a.summary[locale],
    cat: catTitle.get(a.cat) ?? "",
    text: `${blocksText(a.body, locale)} ${a.keywords ?? ""}`,
    beta: a.beta,
  }));

  const inCat = (id: string) => articles.filter((a) => a.cat === id);
  const paths = categories.filter((c) => c.id === "start" || c.id === "play" || c.id === "own");
  const fix = inCat("fix");
  const account = inCat("account");
  const team = inCat("team");
  const fresh = articles.filter((a) => a.isNew && a.cat !== "team");

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground sm:text-[30px]">
          <Lifebuoy className="h-7 w-7 text-accent" weight="duotone" />
          {HELP_UI.title[locale]}
        </h1>
        <p className="max-w-[62ch] text-[15px] text-muted">{HELP_UI.subtitle[locale]}</p>
      </div>

      <HelpSearch
        items={items}
        labels={{
          placeholder: HELP_UI.search[locale],
          none: HELP_UI.none[locale],
          noneCta: HELP_UI.noneCta[locale],
          results: HELP_UI.results[locale],
          beta: HELP_UI.beta[locale],
        }}
      >
        <div className="flex flex-col gap-10">
          {/* Parcours */}
          <div className="grid gap-3 md:grid-cols-3">
            {paths.map((c) => {
              const list = inCat(c.id);
              return (
                <section key={c.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
                  <div>
                    <h2 className="text-[17px] font-semibold text-foreground">{c.title[locale]}</h2>
                    <p className="text-[13px] text-muted">{c.intro[locale]}</p>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {list.map((a) => (
                      <li key={a.slug}>
                        <Link href={`/aide/${a.slug}`} className="group flex items-start gap-2 rounded-md py-1 text-[14px] leading-snug text-foreground/90 hover:text-accent">
                          <ArrowRight className="mt-[3px] h-3.5 w-3.5 flex-shrink-0 text-muted group-hover:text-accent" />
                          <span className="min-w-0 flex-1">
                            {a.title[locale]}
                            {a.beta ? <span className="ml-1.5 rounded-full border border-accent px-1.5 text-[10.5px] font-semibold text-accent">{HELP_UI.beta[locale]}</span> : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {/* Un problème ? */}
          {fix.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-accent">
                <Question className="h-4 w-4" weight="bold" />
                {categories.find((c) => c.id === "fix")?.title[locale]}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {fix.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/aide/${a.slug}`}
                    className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
                  >
                    <span className="text-[14.5px] font-medium text-foreground">{a.title[locale]}</span>
                    <span className="text-[13px] text-muted">{a.summary[locale]}</span>
                  </Link>
                ))}
                {showBugs ? <Link
                  href="/aide/bugs"
                  className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-accent"
                  style={{ background: "color-mix(in srgb, var(--warn) 8%, var(--surface))" }}
                >
                  <Bug className="h-5 w-5 flex-shrink-0 text-warn" weight="duotone" />
                  <span className="text-[14.5px] font-medium text-foreground">{HELP_UI.knownBugs[locale]}</span>
                </Link> : null}
              </div>
            </section>
          ) : null}

          {/* Nouveautés */}
          {fresh.length ? (
            <section className="flex flex-col gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-accent">
                  <Sparkle className="h-4 w-4" weight="fill" />
                  {HELP_UI.whatsNew[locale]}
                </h2>
                <p className="text-[13px] text-muted">{HELP_UI.whatsNewSub[locale]}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {fresh.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/aide/${a.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground hover:border-accent"
                  >
                    {a.title[locale]}
                    {a.beta ? <span className="rounded-full border border-accent px-1.5 text-[10px] font-semibold text-accent">{HELP_UI.beta[locale]}</span> : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Compte et données + FAQ */}
          <div className="grid gap-3 md:grid-cols-2">
            {account.length ? (
              <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-[15px] font-semibold text-foreground">{categories.find((c) => c.id === "account")?.title[locale]}</h2>
                {account.map((a) => (
                  <Link key={a.slug} href={`/aide/${a.slug}`} className="text-[14px] text-foreground/90 hover:text-accent">
                    {a.title[locale]}
                  </Link>
                ))}
              </section>
            ) : null}
            <Link href="/faq" className="flex flex-col justify-center gap-1 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent">
              <span className="text-[15px] font-semibold text-foreground">{HELP_UI.faq[locale]} →</span>
              <span className="text-[13px] text-muted">{HELP_UI.faqSub[locale]}</span>
            </Link>
          </div>

          {/* Pour l'équipe (admin connecté seulement) */}
          {isAdmin && team.length ? (
            <section className="flex flex-col gap-2 rounded-2xl border border-dashed border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-foreground">{categories.find((c) => c.id === "team")?.title[locale]}</h2>
                <span className="text-[12px] text-muted">{HELP_UI.teamOnly[locale]}</span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {team.map((a) => (
                  <Link key={a.slug} href={`/aide/${a.slug}`} className="text-[14px] text-foreground/90 hover:text-accent">
                    {a.title[locale]}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <HelpContactBox locale={locale} />
        </div>
      </HelpSearch>
    </div>
  );
}
