import Script from "next/script";
import { SCREENS } from "@/app/admin/design/screens";
import { markAllSections } from "@/app/admin/design/bind";

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

export function DesignScreen({ name, html, markAll }: { name: keyof typeof SCREENS; html?: string; markAll?: boolean | "proposal" }) {
  let content = linkNav(html ?? SCREENS[name]);
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
