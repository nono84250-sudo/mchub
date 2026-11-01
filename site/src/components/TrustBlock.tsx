import { Check } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";

// Bloc confiance « En 10 secondes » pour les parents (lot 8, 18/10), sur /download et /contact.
// Choix de Rushi : seulement les garanties, aucun nom d'editeur (ni pseudo, ni pays, ni adresse).
export async function TrustBlock() {
  const { dict } = await getT();
  const lines = [dict.trust.free, dict.trust.noAds, dict.trust.notAffiliated, dict.trust.microsoft];
  return (
    <section aria-label={dict.trust.title} className="flex flex-col gap-2">
      <h2 className="text-xs font-bold uppercase tracking-[0.07em] text-accent">{dict.trust.title}</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {lines.map((line) => (
          <li key={line} className="panel flex items-start gap-2 px-3 py-2.5 text-[13px] text-foreground">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" weight="bold" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
