import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/locales";
import fr from "@/i18n/dictionaries/fr.json";
import en from "@/i18n/dictionaries/en.json";

export type Dictionary = typeof fr;

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

// Memoise par requete (React.cache) : getLocale()/getT() sont appeles depuis de nombreux
// Server Components independants sur une meme page (Nav, Footer, la page elle-meme, etc.) —
// sans ca, chacun relisait le cookie separement. cache() garantit qu'un seul appel reel est
// execute par requete, peu importe combien de composants l'appellent ; meme resultat, juste
// sans le travail repete.
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

// Pratique pour les Server Components : une seule ligne pour lire la langue
// courante (cookie) et charger son dictionnaire.
export const getT = cache(async (): Promise<{ locale: Locale; dict: Dictionary }> => {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
});
