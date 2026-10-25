import { unstable_rethrow } from "next/navigation";
import { getSiteBanner } from "@/lib/platformSettings";
import { getT } from "@/i18n/getDictionary";

// Repris sur les memes roles que le launcher (voir NOTIF_COLORS dans
// launcher/src/renderer.js), mais via les tokens de theme (var(--accent) etc.)
// plutot qu'en hex fige : les couleurs ne basculaient jamais en theme clair.
// Lot 8 (18/10) : une icone et un mot en plus de la couleur (memes icones que NOTIF_COLORS du
// launcher), pour que la banniere se comprenne sans voir les couleurs.
const ICONS: Record<string, string> = { announcement: "📣", maintenance: "🛠", alert: "⚠", promotion: "★" };
const COLORS: Record<string, string> = {
  announcement: "var(--accent)",
  maintenance: "var(--state-busy)",
  alert: "var(--danger)",
  promotion: "var(--success)",
};

// Bannière du site, posée par un admin depuis /admin/notifications (voir platformSettings.ts).
// Pas de croix pour la fermer : elle doit rester visible tant qu'un admin ne la retire pas
// lui-même (voir le bouton "Retirer" sur cette page). Lue au plus une fois par minute, cache
// vidé dès qu'un admin la change (voir platformSettings.ts).
export async function SiteBanner() {
  // Idee 1 du lancement (19/10) : base injoignable -> pas de banniere, mais la page s'affiche.
  const banner = await getSiteBanner().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!banner) return null;
  const type = banner.type in COLORS ? banner.type : "announcement";
  const color = COLORS[type];
  const { dict } = await getT();
  const word = dict.banner[type as keyof typeof dict.banner];
  return (
    <div style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, borderBottom: `1px solid ${color}` }} className="px-4 py-2.5">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 text-center text-sm" style={{ color }}>
        <span aria-hidden="true" className="text-[15px]">
          {ICONS[type]}
        </span>
        <b className="rounded-[5px] border border-current px-1.5 text-[11.5px] font-bold uppercase tracking-[0.05em]">{word}</b>
        <span>{banner.text}</span>
      </div>
    </div>
  );
}
