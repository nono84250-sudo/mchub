import Script from "next/script";
import { SCREENS } from "@/app/admin/design/screens";

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

export function DesignScreen({ name, html }: { name: keyof typeof SCREENS; html?: string }) {
  return (
    <>
      <link rel="stylesheet" href="/admin/nocturne.css" />
      <link rel="stylesheet" href="/admin/nb.css" />
      <Script src="https://unpkg.com/@phosphor-icons/web@2.1.1" strategy="afterInteractive" />
      <div style={WRAPPER_VARS} dangerouslySetInnerHTML={{ __html: html ?? SCREENS[name] }} />
    </>
  );
}
