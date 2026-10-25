// Banniere de repli (design 2026-10-17, points 4 et 6) : degrade calcule a partir du nom
// (meme nom = meme couleur), partage par les cartes de l'annuaire et la fiche serveur, au
// lieu des diagonales grises qui faisaient paraitre le serveur vide.
export function fallbackBanner(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 55% 42%), hsl(${(h + 40) % 360} 60% 18%))`;
}
