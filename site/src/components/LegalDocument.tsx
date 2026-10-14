import type { ReactNode } from "react";

// Pages légales (/cgu, /confidentialite) : un titre, une date de mise à jour, une note
// d'introduction et une suite de sections. Le contenu vit dans lib/legal.ts (FR et EN).
export type LegalSection = { title: string; body: ReactNode };

export function LegalDocument({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-20">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">{title}</h1>
      <p className="mt-3 text-sm text-muted">{updated}</p>
      <div className="mt-6 panel p-5 text-sm text-muted leading-relaxed">{intro}</div>
      <div className="mt-10 flex flex-col gap-9">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
            <div className="legal-body mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-muted">{section.body}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
