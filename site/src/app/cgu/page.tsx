import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { getLocale } from "@/i18n/getDictionary";
import { termsOfUse } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const page = termsOfUse(await getLocale());
  return { title: `${page.title} — Omniscient`, alternates: { canonical: "/cgu" } };
}

export default async function TermsPage() {
  return <LegalDocument {...termsOfUse(await getLocale())} />;
}
