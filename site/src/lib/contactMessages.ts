import { db } from "@/lib/db";

// Messages du formulaire de contact public (/contact) : aucun email n'est envoye (voir
// lib/db.ts et lib/actions/contact.ts) -- juste enregistres ici et lus depuis le panel admin
// (/admin/contact). Pas de lien avec un serveur ni un compte, contrairement a "report".

export type ContactMessageStatus = "new" | "read";

export type ContactMessageSummary = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: ContactMessageStatus;
  createdAt: string;
};

// Plus recents en premier, pas de pagination : volume attendu minuscule pour l'instant
// (meme raisonnement que listBehaviorReports).
export async function listContactMessages(): Promise<ContactMessageSummary[]> {
  return db.orm.public.ContactMessage.select("id", "name", "email", "message", "status", "createdAt")
    .orderBy((c) => c.createdAt.desc())
    .all();
}

export async function markContactMessageRead(id: string): Promise<void> {
  await db.orm.public.ContactMessage.where({ id }).update({ status: "read" });
}

// Suppression definitive depuis /admin/contact : la politique de confidentialite promet
// l'effacement d'un message sur demande (second audit du 14/10).
export async function deleteContactMessage(id: string): Promise<boolean> {
  const found = await db.orm.public.ContactMessage.select("id").where({ id }).first();
  if (!found) return false;
  await db.orm.public.ContactMessage.where({ id }).delete();
  return true;
}
