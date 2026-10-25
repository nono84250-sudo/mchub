// Extrait de lib/actions/servers.ts (16/10) pour etre partage avec lib/actions/serverPage.ts
// (images de la galerie d'une fiche) : meme regle, une seule copie.
// Ces URLs finissent dans des attributs HTML et des url(...) CSS cote launcher. Depuis le
// passage a R2 (ImageDropzone -> /api/upload), le formulaire n'envoie plus que l'URL renvoyee
// par /api/upload : <origine du site>/api/images/<uuid>.<ext>. 2026-10-14 : la validation
// acceptait encore n'importe quelle adresse http(s) — un formulaire forge a la main pouvait
// donc poser une image hebergee ailleurs (contenu modifiable apres coup, IP des joueurs vue
// par ce site tiers, http non chiffre). Desormais seule notre propre URL d'image est acceptee :
// meme hote que la requete en cours, chemin /api/images/<uuid>.<ext> exact, https (http
// seulement sur localhost, pour le dev local). Exception : une valeur DEJA enregistree sur la
// fiche (anciennes URLs ex-Vercel Blob) reste acceptee telle quelle a la modification, pour ne
// pas bloquer l'enregistrement d'une fiche existante — elle ne peut pas etre remplacee par une
// autre URL externe.
const OWN_IMAGE_PATH = /^\/api\/images\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export function isOwnImageUrl(url: string | null, host: string | null, previous?: string | null): boolean {
  if (url === null) return true;
  if (previous && url === previous) return true;
  if (!host || !/^https?:\/\/[^\s"'<>`\\]+$/.test(url)) return false;
  try {
    const parsed = new URL(url);
    const secure = parsed.protocol === "https:" || (parsed.protocol === "http:" && LOCAL_HOSTNAMES.has(parsed.hostname));
    return secure && parsed.host === host && OWN_IMAGE_PATH.test(parsed.pathname) && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}
