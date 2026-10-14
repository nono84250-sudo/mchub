"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { checkRateLimit, clientIpFromHeadersList } from "@/lib/rateLimit";
import { CONTACT_SUBJECTS } from "@/lib/contactSubjects";

export type ContactActionState = { error: string } | { success: true } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Formulaire de contact public (/contact) : pas d'email envoye (aucune infra de ce genre
// dans ce projet) -- juste enregistre en base, lu depuis le panel admin (/admin/contact).
export async function submitContactMessage(
  _prevState: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  // Honeypot anti-spam : champ cache (voir ContactForm.tsx) qu'un visiteur humain ne remplit
  // jamais. Rempli -> on fait comme si tout s'etait bien passe, sans rien ecrire, pour ne pas
  // reveler l'existence du piege a un bot qui regarderait la reponse.
  if (String(formData.get("website") ?? "").trim()) return { success: true };

  const headersList = await headers();
  const { limited } = checkRateLimit(`contact:${clientIpFromHeadersList(headersList)}`, 5, 60 * 60_000);
  if (limited) return { error: "Trop de messages envoyés depuis cette adresse — réessaie dans une heure." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const subject = CONTACT_SUBJECTS.find((s) => s.id === String(formData.get("subject") ?? ""));

  if (!name || !email || !message || !subject) return { error: "Tous les champs sont obligatoires." };
  if (formData.get("consent") !== "yes") return { error: "Coche la case d'accord pour qu'on puisse te répondre." };
  if (!EMAIL_RE.test(email)) return { error: "Adresse email invalide." };
  if (name.length > 200 || email.length > 200 || message.length > 5000) return { error: "Message trop long." };

  // Pas de colonne "sujet" dans contactMessage : le sujet est place en tete du message, lisible
  // tel quel dans /admin/contact, sans migration D1.
  await db.orm.public.ContactMessage.create({ name, email, message: `[${subject.adminLabel}]\n\n${message}`, status: "new" });

  return { success: true };
}
