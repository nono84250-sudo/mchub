"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/i18n/locales";

// Preference de langue memorisee dans un cookie (pas de prefixe d'URL /fr,
// /en — plus simple pour un site qui n'a pas besoin d'URLs distinctes par
// langue pour le SEO a ce stade). revalidatePath("/", "layout") force tous
// les Server Components (qui lisent le cookie via getT()) a se re-rendre
// dans la nouvelle langue immediatement, sans rechargement complet.
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
