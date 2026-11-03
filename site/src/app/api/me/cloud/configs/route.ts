import { NextResponse } from "next/server";

// Retiré le 03/11 (retour de Rushi) : un modpack du cloud et ses réglages s'envoient depuis le
// launcher (Jouer › une version › ⚙ › « Envoyer dans le cloud »), plus depuis le site.
// Fichier à supprimer quand le dossier sera nettoyé.
export function POST() {
  return NextResponse.json({ error: "Envoie ton modpack depuis le launcher." }, { status: 410 });
}
