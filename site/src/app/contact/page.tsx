import { Clock, Flag, Info } from "@phosphor-icons/react/ssr";
import { ContactForm } from "@/components/ContactForm";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Contact — Omniscient" };

// Formulaire de contact public, meme esprit que le systeme de Reports (voir
// lib/actions/contact.ts) : enregistre juste le message en base, aucun email envoye, lu
// depuis le panel admin (/admin/contact). Textes d'aide repris du Document 2
// (Legal/DOCUMENTS_LEGAUX_OMNISCIENT.md).
export default async function ContactPage() {
  const { dict } = await getT();
  const c = dict.contact;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-24">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground text-balance">
          {c.title} — <span className="gradient-text">{c.titleAccent}</span>
        </h1>
        <p className="mt-5 text-lg text-muted text-balance">{c.subtitleLong}</p>
      </div>

      <div className="mt-14 grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
        <div className="panel p-6">
          <ContactForm />
        </div>

        <aside className="flex flex-col gap-6">
          <div className="panel flex items-start gap-4 p-5">
            <Clock className="h-6 w-6 text-muted shrink-0" />
            <div>
              <p className="font-medium text-foreground text-sm">{c.responseTitle}</p>
              <p className="text-sm text-muted mt-1">{c.responseBody}</p>
            </div>
          </div>

          <div className="panel p-5">
            <p className="font-medium text-foreground text-sm flex items-center gap-2">
              <Info className="h-5 w-5 text-muted" />
              {c.topicsTitle}
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-muted list-disc pl-5">
              <li>{c.topicHelp}</li>
              <li>{c.topicServer}</li>
              <li>{c.topicBilling}</li>
            </ul>
          </div>

          <div className="panel p-5">
            <p className="font-medium text-foreground text-sm flex items-center gap-2">
              <Flag className="h-5 w-5 text-muted" />
              {c.illicitTitle}
            </p>
            <p className="mt-3 text-sm text-muted">{c.illicitIntro}</p>
            <ol className="mt-2 space-y-1.5 text-sm text-muted list-decimal pl-5">
              <li>{c.illicitUrl}</li>
              <li>{c.illicitReasons}</li>
              <li>{c.illicitGoodFaith}</li>
            </ol>
            <p className="mt-3 text-sm text-muted">{c.illicitOutro}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
