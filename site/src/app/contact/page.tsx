import { ContactForm } from "@/components/ContactForm";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Contact — Omniscient" };

// Formulaire de contact public, meme esprit que le systeme de Reports (voir
// lib/actions/contact.ts) : enregistre juste le message en base, aucun email envoye, lu
// depuis le panel admin (/admin/contact).
export default async function ContactPage() {
  const { dict } = await getT();

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{dict.contact.title}</h1>
      <p className="mt-1 text-muted">{dict.contact.subtitle}</p>

      <div className="panel mt-8 p-6">
        <ContactForm />
      </div>
    </div>
  );
}
