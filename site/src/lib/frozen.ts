import type { CSSProperties } from "react";

// Couleur du gel (bleu), la même que sur le panel admin. Token --frozen (globals.css) plutot
// que l'hex fige d'origine, pour que ca bascule avec le theme clair.
export const FROZEN_CHIP_STYLE: CSSProperties = {
  background: "color-mix(in srgb, var(--frozen) 16%, transparent)",
  color: "var(--frozen)",
  borderColor: "transparent",
};

// Couleur dediee pour le chip "En attente de verification" (2026-10-10 : partagee entre
// manage/[id]/page.tsx et ManageActions.tsx — meme priorite d'affichage frozen > pending >
// rejected > published > paused dans les deux), sans toucher a la palette d'accent globale.
// Token --pending (globals.css) plutot que l'hex fige d'origine.
export const PENDING_CHIP_STYLE: CSSProperties = { color: "var(--pending)" };
