// Couleurs du badge de statut d'une fiche du catalogue de bugs (liste et page publiques).
export const BADGE_STYLE = {
  auto: { background: "color-mix(in srgb, var(--success) 16%, transparent)", color: "var(--success)" },
  consent: { background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" },
  manual: { background: "color-mix(in srgb, var(--warn) 18%, transparent)", color: "var(--warn)" },
} as const;
