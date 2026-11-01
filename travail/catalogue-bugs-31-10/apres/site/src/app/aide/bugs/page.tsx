import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Bug } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";
import { BugList, type BugCard } from "@/components/BugList";
import { HelpContactBox } from "@/components/help/HelpContactBox";
import { bugsVisible } from "@/lib/help/visibility";
import { listPublicBugs } from "@/lib/bugCatalog";
import { helpDate } from "@/lib/help/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getT();
  return { title: `${dict.bugs.title} — Omniscient`, description: dict.bugs.lead, alternates: { canonical: "/aide/bugs" } };
}

// Page publique « Bugs connus » (31/10, preview validée par Rushi, Laboratoire « bugCatalog ») : les
// fiches publiées pour les joueurs et qui ont une solution. Introuvable tant que la fonction est cachée.
export default async function KnownBugsPage() {
  if (!(await bugsVisible())) notFound();
  const { locale, dict } = await getT();
  const d = dict.bugs;
  const entries = await listPublicBugs().catch(() => []);
  const cards: BugCard[] = entries.map((e) => ({
    slug: e.slug,
    status: e.status as BugCard["status"],
    title: e.title[locale],
    symptom: e.symptom[locale],
    guide: e.hasGuide,
    category: d.category[e.category],
    concerns: [e.match.mc && `Minecraft ${e.match.mc}`, e.match.loader && e.match.loader[0].toUpperCase() + e.match.loader.slice(1)].filter(Boolean).join(" · ") || d.allVersions,
    updated: d.updated.replace("{date}", helpDate(e.updatedAt.slice(0, 10), locale)),
    search: `${e.title[locale]} ${e.symptom[locale]} ${e.logSample} ${e.match.text}`.toLowerCase(),
  }));

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-[13px] text-muted">
        <Link href="/aide" className="hover:text-foreground">
          {d.help}
        </Link>{" "}
        › <span className="text-foreground">{d.crumb}</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[30px]">{d.title}</h1>
        <p className="max-w-[64ch] text-[15px] leading-normal text-muted">{d.lead}</p>
      </div>
      {cards.length ? (
        <BugList cards={cards} labels={{ all: d.all, status: d.status, search: d.search, none: d.none, guide: d.guide }} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-5 py-16 text-center">
          <Bug className="h-8 w-8 text-muted" weight="duotone" />
          <h2 className="text-[17px] font-semibold text-foreground">{d.emptyT}</h2>
          <p className="max-w-[46ch] text-[14px] text-muted">{d.emptyD}</p>
        </div>
      )}
      <HelpContactBox locale={locale} />
    </div>
  );
}
