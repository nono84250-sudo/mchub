import Link from "next/link";
import { getT } from "@/i18n/getDictionary";
import { FaqList } from "@/components/FaqList";

export const metadata = {
  title: "Questions fréquentes — Omniscient",
  description: "Les réponses aux questions les plus posées sur le launcher Omniscient, les comptes Microsoft, les mods et les serveurs.",
  alternates: { canonical: "/faq" },
};

// Page FAQ (validee le 17/10) : remplace les 4 questions de /download. On y
// arrive par le pied de page (colonne Aide) et par la ligne « Des questions ? ».
export default async function FaqPage() {
  const { dict } = await getT();

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-12 sm:px-6 sm:py-16 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl sm:text-[30px] font-bold tracking-tight text-foreground">{dict.faq.title}</h1>
        <p className="mt-1 text-sm text-muted">{dict.faq.subtitle}</p>
      </div>

      <FaqList items={dict.faq.items} />

      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3.5"
        style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}
      >
        <div className="min-w-40 flex-1">
          <p className="text-[14.5px] font-semibold text-foreground">{dict.faq.notFound}</p>
          <p className="text-[13px] text-muted">{dict.faq.notFoundSub}</p>
        </div>
        <Link href="/contact" className="btn-primary px-3 py-1.5 text-[13.5px]">
          {dict.faq.contact}
        </Link>
      </div>
    </div>
  );
}
