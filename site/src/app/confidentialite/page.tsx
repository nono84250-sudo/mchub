import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { getLocale } from "@/i18n/getDictionary";
import { privacyPolicy } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const page = privacyPolicy(await getLocale());
  return { title: `${page.title} — Omniscient`, alternates: { canonical: "/confidentialite" } };
}

export default async function PrivacyPage() {
  return <LegalDocument {...privacyPolicy(await getLocale())} />;
}
