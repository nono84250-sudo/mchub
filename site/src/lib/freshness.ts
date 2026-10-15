// Badge de fraicheur de l'auto-test de publication (server.selfTestPassedAt, voir
// /api/launcher/servers/[slug]/self-test) — affiche a la fois sur la fiche publique
// (ServerDetailView.tsx) et sur la page de gestion du proprietaire (manage/[id]/page.tsx).
// Seuils et niveaux calcules UNE SEULE fois ici plutot que dupliques des deux cotes.
//
// Wording volontairement neutre au-dela de 7 jours ("Vérifié il y a X jours", voir
// dict.freshness.stale) : un serveur qui va tres bien mais est juste peu retesté ne doit pas
// avoir l'air en panne — un agent precedent a signale qu'un mot comme "périmé" ferait peur a
// tort (voir aussi freshnessChipStyle, qui evite la couleur "danger" pour ce niveau).
export type FreshnessLevel = "fresh" | "check" | "stale" | "never";

export type FreshnessInfo = {
  level: FreshnessLevel;
  // Jours entiers depuis le dernier auto-test reussi (0 si moins d'un jour, 0 aussi si
  // "never" — n'est utilise que par le wording du niveau "stale").
  days: number;
};

const FRESH_MS = 48 * 60 * 60_000; // < 48h : frais
const CHECK_MS = 7 * 24 * 60 * 60_000; // 48h-7j : a verifier ; au-dela : "stale" (wording neutre)

export function getFreshness(selfTestPassedAt: string | null): FreshnessInfo {
  if (!selfTestPassedAt) return { level: "never", days: 0 };

  const ageMs = Date.now() - new Date(selfTestPassedAt).getTime();
  const days = Math.max(0, Math.floor(ageMs / (24 * 60 * 60_000)));
  if (ageMs < FRESH_MS) return { level: "fresh", days };
  if (ageMs < CHECK_MS) return { level: "check", days };
  return { level: "stale", days };
}

// Couleur du badge (memes variables CSS que les autres chips du site, voir lib/frozen.ts) :
// jamais "danger" pour "stale"/"never", meme raisonnement que le wording neutre ci-dessus.
export function freshnessChipStyle(level: FreshnessLevel): { color: string } | undefined {
  if (level === "fresh") return { color: "var(--success)" };
  if (level === "check") return { color: "var(--warn)" };
  return undefined;
}
