import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/locales";
import fr from "@/i18n/dictionaries/fr.json";
import en from "@/i18n/dictionaries/en.json";

export type Dictionary = typeof fr;

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

// Pratique pour les Server Components : une seule ligne pour lire la langue
// courante (cookie) et charger son dictionnaire.
export async function getT(): Promise<{ locale: Locale; dict: Dictionary }> {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
