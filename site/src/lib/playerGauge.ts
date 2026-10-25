// Etat d'un serveur (variante C validee le 17/10) : une seule logique pour tout le site
// (cartes de l'annuaire, fiche serveur, accueil, espace proprietaire), identique au
// launcher. Vert : de la place (moins de 80 %). Orange : presque plein (80 % ou plus).
// Rouge : plein, ou ferme (contacte mais ne repond pas). Gris : pas encore verifie.
// Toujours un mot en plus de la couleur (jamais la couleur seule, pour les daltoniens).
export type ServerState = "ok" | "warn" | "full" | "off" | "unk";

export const GAUGE_BUSY_RATIO = 0.8;

// Un maximum de 0 (beaucoup de gros serveurs cachent leur limite) compte comme « pas de
// maximum » : « 3302 en ligne », sans jauge (19/10). Meme regle dans le launcher.
export function serverState(count: number | null, capacity: number | null, pinged = true): ServerState {
  if (count == null) return pinged ? "off" : "unk";
  if (!capacity) return "ok";
  if (count >= capacity) return "full";
  if (count / capacity >= GAUGE_BUSY_RATIO) return "warn";
  return "ok";
}

// Table commune site + launcher (lot 2 de l'audit, 17/10) : En ligne vert, Presque plein
// orange, Complet rouge, Hors ligne gris, Inconnu gris en pointille.
export const STATE_COLOR: Record<ServerState, string> = {
  ok: "var(--success)",
  warn: "var(--state-busy)",
  full: "var(--danger)",
  off: "var(--state-off)",
  unk: "var(--muted)",
};

// Bande de couleur en haut des cartes : partout (true) ou seulement quand l'etat n'est
// PAS « En ligne » (false). Reglage a trancher par Rushi : un seul interrupteur ici.
// Choix de Rushi (18/10) : seulement en cas de souci, comme le launcher.
export const BAND_WHEN_ONLINE = false;

// Fond de la bande (une couleur, ou des rayures grises pour « Inconnu », comme le launcher).
export function bandColor(state: ServerState): string | null {
  if (state === "ok" && !BAND_WHEN_ONLINE) return null;
  if (state === "unk") return "repeating-linear-gradient(45deg, var(--state-off) 0 4px, transparent 4px 8px)";
  return STATE_COLOR[state];
}

// Remplissage de la jauge (4 % mini pour rester visible, jamais plus de 100 %).
export function gaugePercent(count: number | null, capacity: number | null): number | null {
  if (count == null || !capacity) return null;
  return Math.min(100, Math.max(4, Math.round((count / capacity) * 100)));
}
