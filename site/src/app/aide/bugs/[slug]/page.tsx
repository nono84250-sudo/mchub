import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/getDictionary";
import { BADGE_STYLE } from "@/lib/bugBadge";
import { HelpContactBox } from "@/components/help/HelpContactBox";
import { bugsVisible } from "@/lib/help/visibility";
import { getPublicBug } from "@/lib/bugCatalog";
import { helpDate } from "@/lib/help/ui";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await getT();
  const entry = (await bugsVisible()) ? await getPublicBug(slug).catch(() => null) : null;
  if (!entry) return { title: "Omniscient", robots: { index: false } };
  return { title: `${entry.title[locale]} — Omniscient`, description: entry.symptom[locale].slice(0, 160), alternates: { canonical: `/aide/bugs/${slug}` } };
}

// Une fiche du catalogue de bugs : ce que le joueur voit, pourquoi, la solution. Introuvable si la
// fonction est cachée, si la fiche est un brouillon, pour l'équipe, ou encore en analyse.
export default async function KnownBugPage({ params }: Props) {
  if (!(await bugsVisible())) notFound();
  const { slug } = await params;
  const entry = await getPublicBug(slug).catch(() => null);
  if (!entry) notFound();
  const { locale, dict } = await getT();
  const d = dict.bugs;
  const status = entry.status as keyof typeof BADGE_STYLE;
  const steps = entry.steps[locale].filter((s) => s.trim());
  const stepList = steps.length ? (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="grid grid-cols-[30px_1fr] gap-3 text-[15px] leading-relaxed text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-[13px] font-bold">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  ) : null;
  const concerns = [entry.match.mc && `Minecraft ${entry.match.mc}`, entry.match.loader && entry.match.loader[0].toUpperCase() + entry.match.loader.slice(1)].filter(Boolean).join(" · ") || d.allVersions;

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5 px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-[13px] text-muted">
        <Link href="/aide" className="hover:text-foreground">
          {d.help}
        </Link>{" "}
        ›{" "}
        <Link href="/aide/bugs" className="hover:text-foreground">
          {d.crumb}
        </Link>
      </div>
      <article className="flex max-w-[760px] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-muted">
          <span className="rounded-full px-2.5 py-0.5 font-semibold" style={BADGE_STYLE[status]}>
            {status === "auto" ? "✓ " : ""}
            {d.status[status]}
          </span>
          <span>{d.category[entry.category]}</span>
          <span>{concerns}</span>
          <span>{d.updated.replace("{date}", helpDate(entry.updatedAt.slice(0, 10), locale))}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[30px]">{entry.title[locale]}</h1>

        <h2 className="mt-4 text-[17px] font-semibold text-foreground">{d.whatYouSee}</h2>
        <p className="text-[15px] leading-relaxed text-foreground">{entry.symptom[locale]}</p>
        {entry.logSample ? <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface px-3.5 py-3 font-mono text-[12.5px] leading-normal text-foreground">{entry.logSample}</pre> : null}

        <h2 className="mt-4 text-[17px] font-semibold text-foreground">{d.why}</h2>
        <p className="text-[15px] leading-relaxed text-foreground">{entry.cause[locale]}</p>

        <h2 className="mt-4 text-[17px] font-semibold text-foreground">{d.fix}</h2>
        {status === "auto" ? (
          <div className="rounded-xl border px-4 py-3.5 text-[15px] leading-relaxed text-foreground" style={{ borderColor: "color-mix(in srgb, var(--success) 45%, var(--border))", background: "color-mix(in srgb, var(--success) 8%, transparent)" }}>
            ✓ <b>{d.nothing}</b> {entry.fixedIn ? d.autoSince.replace("{v}", entry.fixedIn) : d.auto} {entry.fixText[locale]}
          </div>
        ) : status === "consent" ? (
          <>
            <div className="rounded-xl border px-4 py-3.5 text-[15px] leading-relaxed text-foreground" style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))", background: "color-mix(in srgb, var(--accent) 7%, transparent)" }}>
              <b>{d.oneClick}</b> {d.oneClickD} {entry.fixText[locale]}
            </div>
            {stepList ? (
              <>
                <h2 className="mt-4 text-[17px] font-semibold text-foreground">{d.yourself}</h2>
                {stepList}
              </>
            ) : null}
          </>
        ) : (
          stepList
        )}

        {slug === "mods-curseforge-a-la-main" ? (
          <figure className="mt-3 rounded-xl border border-border bg-surface p-4">
            {/* Couleurs fixes : c'est une image de la page de CurseForge, pareille en thème clair et sombre. */}
            <div className="flex flex-col gap-2.5 rounded-lg p-3.5 text-[13px]" style={{ background: "#1c1c1c", color: "#eee" }}>
              <div className="flex items-center gap-2.5">
                <b>Ice and Fire: Dragons</b>
                <span className="ml-auto rounded-md px-3 py-1.5 text-[12.5px] font-semibold" style={{ background: "#f16436", color: "#fff", opacity: 0.45 }}>
                  Download
                </span>
              </div>
              <small style={{ color: "#aaa" }}>{d.cfTop}</small>
              <div className="flex items-center gap-2.5 pt-2.5" style={{ borderTop: "1px solid #333" }}>
                <span>
                  iceandfire-1.7.1-1.12.2.jar
                  <br />
                  <small style={{ color: "#aaa" }}>1.12.2 · Forge · 4.8 MB</small>
                </span>
                <span className="ml-auto rounded-md px-3 py-1.5 text-[12.5px] font-semibold" style={{ background: "#f16436", color: "#fff", outline: "3px solid #5fd3a0", outlineOffset: 3 }}>
                  Download
                </span>
              </div>
            </div>
            <figcaption className="mt-2.5 text-[12.5px] text-muted">{d.cfCaption}</figcaption>
          </figure>
        ) : null}

        <div className="mt-6">
          <Link href="/aide/bugs" className="text-[14px] text-accent hover:underline">
            ← {d.back}
          </Link>
        </div>
      </article>
      <HelpContactBox locale={locale} />
    </div>
  );
}
