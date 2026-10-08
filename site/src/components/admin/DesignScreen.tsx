import Script from "next/script";
import { SCREENS } from "@/app/admin/design/screens";
import { markAllSections, balancedEnd } from "@/app/admin/design/bind";

// Affiche un écran de la maquette "Omniscient Admin Dashboard" : même markup, même
// style (feuille Nocturne), mêmes icônes (Phosphor). `html` remplace le modèle
// d'origine quand l'écran est rempli avec les vraies données.
const WRAPPER_VARS = {
  "--muted": "color-mix(in srgb, var(--color-text) 55%, transparent)",
  "--muted2": "color-mix(in srgb, var(--color-text) 40%, transparent)",
  "--raised": "color-mix(in srgb, var(--color-text) 6%, var(--color-surface))",
  "--danger": "#e08a8a",
  "--success": "#5fd3a0",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontFamily: "var(--font-body)",
  minHeight: "100vh",
} as React.CSSProperties;

const NAV_LINKS: Record<string, string> = {
  Overview: "/admin/overview",
  Notifications: "/admin/notifications",
  News: "/admin/news",
  Servers: "/admin/servers",
  "Vérification": "/admin/verification",
  Players: "/admin/players",
  Reports: "/admin/reports",
  "Packs curés": "/admin/packs",
  Administration: "/admin/administration",
};

// Rend le menu cliquable (même style, même libellés) et marque "Amis" comme non branché.
function linkNav(html: string): string {
  return html.replace(/<span style="flex:1">([^<]+)<\/span>/g, (match, label: string) => {
    if (label === "Amis") return `<span class="nb" style="flex:1">${label}</span>`;
    const href = NAV_LINKS[label];
    return href ? `<a href="${href}" style="flex:1;color:inherit;text-decoration:none">${label}</a>` : match;
  });
}

// Remonte l'entree "Players" du menu juste au-dessus de "Servers" — chaque ecran de la
// maquette embarque sa propre copie du menu (meme ordre partout), donc ce reordonnancement
// se fait ici une seule fois plutot que dans chaque ecran de screens.ts.
function reorderNav(html: string): string {
  const playersAt = html.indexOf(">Players<");
  if (playersAt < 0) return html;
  const playersStart = html.lastIndexOf("<div", playersAt);
  const playersEnd = balancedEnd(html, playersStart, "div");
  if (playersStart < 0 || playersEnd < 0) return html;
  const item = html.slice(playersStart, playersEnd);
  const without = html.slice(0, playersStart) + html.slice(playersEnd);

  const serversAt = without.indexOf(">Servers<");
  if (serversAt < 0) return html;
  const serversStart = without.lastIndexOf("<div", serversAt);
  if (serversStart < 0) return html;
  return without.slice(0, serversStart) + item + without.slice(serversStart);
}

// Retire la barre de recherche de l'en-tete : purement visuelle (aucune recherche ne marche
// depuis la, contrairement aux vraies barres de recherche des listes elles-memes). La cloche
// de notification juste a cote reste.
function removeTopbarSearch(html: string): string {
  const marker = 'class="ph ph-magnifying-glass"';
  const at = html.indexOf(marker);
  if (at < 0) return html;
  const start = html.lastIndexOf("<div", at);
  const end = balancedEnd(html, start, "div");
  if (start < 0 || end < 0) return html;
  return html.slice(0, start) + html.slice(end);
}

// Icone de cloche : ne menait nulle part et n'etait pas marquee, alors que la page
// Notifications qu'elle devrait ouvrir est elle-meme entierement maquette (non branchee).
// On la relie a cette page et on la marque en rouge, pour que rien ne paraisse fonctionnel
// sans l'etre.
function markTopbarBell(html: string): string {
  const marker =
    '<span style="width:32px;height:32px;border-radius:var(--radius-md);border:1px solid var(--color-divider);display:flex;align-items:center;justify-content:center;color:var(--muted);"><i class="ph ph-bell" style="font-size:15px;"></i></span>';
  return html.split(marker).join(
    '<a class="nb" href="/admin/notifications" style="width:32px;height:32px;border-radius:var(--radius-md);border:1px solid var(--color-divider);display:flex;align-items:center;justify-content:center;color:var(--muted);text-decoration:none;"><i class="ph ph-bell" style="font-size:15px;"></i></a>',
  );
}

export function DesignScreen({ name, html, markAll }: { name: keyof typeof SCREENS; html?: string; markAll?: boolean | "proposal" }) {
  let content = markTopbarBell(removeTopbarSearch(reorderNav(linkNav(html ?? SCREENS[name]))));
  if (markAll) content = markAllSections(content, markAll === "proposal" ? "pr" : "nb");
  return (
    <>
      <link rel="stylesheet" href="/admin/nocturne.css" />
      <link rel="stylesheet" href="/admin/nb.css" />
      <Script src="https://unpkg.com/@phosphor-icons/web@2.1.1" strategy="afterInteractive" />
      <div style={WRAPPER_VARS} dangerouslySetInnerHTML={{ __html: content }} />
    </>
  );
}
