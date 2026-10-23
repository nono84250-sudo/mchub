import Script from "next/script";
import { buildScreenContent, WRAPPER_VARS } from "@/components/admin/DesignScreen";
import { balancedEnd } from "@/app/admin/design/bind";
import { SlotPortal } from "@/components/admin/SlotPortal";

const SLOT_ID = "__admin_react_slot__";

// Pour une page qui a besoin de VRAIS composants React interactifs (formulaires,
// interrupteurs) dans le cadre Nocturne, plutot que du HTML statique genere depuis la
// maquette (DesignScreen, limite a dangerouslySetInnerHTML — aucun composant client ne peut
// vivre dedans). Reutilise EXACTEMENT le meme HTML de sidebar/topbar traite que les autres
// pages (buildScreenContent, le meme pipeline que DesignScreen) plutot que de le recopier a
// la main : un essai precedent (chrome ecrit en JSX a la main) a derive visuellement de
// l'original — couleurs, largeurs, bouton de deconnexion differents — signale par
// l'utilisateur le 2026-10-12. Ici, zone <main> de l'ecran "servers" videe et remplacee par
// un marqueur, dans lequel SlotPortal (cote client) teleporte les enfants React apres montage.
function injectReactSlot(html: string): string {
  const navEnd = html.indexOf("</nav>");
  const mainStart = html.indexOf("<main", navEnd);
  if (mainStart < 0) return html;
  const openTagEnd = html.indexOf(">", mainStart) + 1;
  const mainEnd = balancedEnd(html, mainStart, "main");
  if (openTagEnd <= 0 || mainEnd < 0) return html;
  const openTag = html.slice(mainStart, openTagEnd);
  return html.slice(0, mainStart) + openTag + `<div id="${SLOT_ID}"></div></main>` + html.slice(mainEnd);
}

// Pages du panel qui n'existent pas dans la maquette d'origine et qui ont besoin de VRAIS
// composants React (voir injectReactSlot ci-dessus) : chacune reutilise "servers" comme
// gabarit de sidebar/topbar (meme methode que Parametres, 2026-10-12), juste avec son propre
// icone Phosphor et son propre libelle.
const PAGE_ICON = { parametres: "ph-gear", contact: "ph-envelope", etiquettes: "ph-tag", teams: "ph-users-three" } as const;
const PAGE_LABEL = { parametres: "Paramètres", contact: "Contact", etiquettes: "Étiquettes proposées", teams: "Teams" } as const;
type ChromePage = keyof typeof PAGE_ICON;

// La maquette "servers" marque son propre lien "Servers" comme actif en dur (chaque export
// d'ecran porte sa propre copie figee du menu) — en le reutilisant comme gabarit pour une
// page hors-maquette, Servers restait visuellement "actif" alors qu'on est ailleurs (signale
// par l'utilisateur le 2026-10-12 : « on croit qu'on est dans Serveurs »). Deplace la marque
// active de Servers vers la page demandee apres coup.
function adaptChromeForPage(html: string, page: ChromePage): string {
  const serversActive = 'font-size:14px;background:var(--raised);color:var(--color-text);"><i class="ph ph-hard-drives"';
  const serversInactive = 'font-size:14px;color:var(--muted);"><i class="ph ph-hard-drives"';
  const icon = PAGE_ICON[page];
  const pageInactive = `font-size:14px;color:var(--muted);"><i class="ph ${icon}"`;
  const pageActive = `font-size:14px;background:var(--raised);color:var(--color-text);"><i class="ph ${icon}"`;
  // Le petit libelle du bandeau du haut ("Servers", juste apres </nav>) vient du meme gabarit
  // fige — signale separement par l'utilisateur ("paramètres... mais c'est écrit serveur").
  const topbarLabel = 'font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Servers<';
  const topbarLabelFixed = `font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${PAGE_LABEL[page]}<`;
  return html
    .split(serversActive).join(serversInactive)
    .split(pageInactive).join(pageActive)
    .split(topbarLabel).join(topbarLabelFixed);
}

export async function AdminChrome({ children, active = "parametres" }: { children: React.ReactNode; active?: ChromePage }) {
  // "servers" sert de gabarit : un ecran simple, deja actif, avec la meme sidebar reduite
  // (Serveurs/Verification/Parametres/Contact) que toutes les autres pages du panel.
  const raw = await buildScreenContent({ name: "servers" });
  const content = injectReactSlot(adaptChromeForPage(raw, active));
  return (
    <>
      <link rel="stylesheet" href="/admin/nocturne.css" />
      <link rel="stylesheet" href="/admin/nb.css" />
      <Script src="https://unpkg.com/@phosphor-icons/web@2.1.1" strategy="afterInteractive" />
      <div style={WRAPPER_VARS} dangerouslySetInnerHTML={{ __html: content }} />
      <SlotPortal slotId={SLOT_ID}>{children}</SlotPortal>
    </>
  );
}
