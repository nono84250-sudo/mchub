// Mods a ajouter a la main (lot 5 de l'audit design, 18/10) : les mods que CurseForge interdit
// de telecharger automatiquement et qui ne sont pas sur Modrinth. Le test de publication du
// launcher en envoie la liste (voir /api/launcher/servers/[slug]/self-test) ; le site garde le
// nombre (badge bleu « 2 mods a ajouter ») et la liste (affichee au proprietaire).
//
// Colonnes manualModsCount / manualModsJson : migration d1/migrations/2026-10-18-mods-a-la-main.sql.
// Tant qu'elle n'est pas lancee sur la base utilisee, laisser ce drapeau a false : sinon les
// requetes qui lisent ces colonnes echouent et l'annuaire ne s'affiche plus.
// Migration lancee sur DEV le 18/10 (accord de Rushi). Avant de mettre en production : la
// lancer sur la base de prod (avec son accord), sinon remettre ce drapeau a false.
export const MANUAL_MODS_READY = true;

// Colonnes a ajouter aux select() quand la migration est faite (vide sinon).
export const MANUAL_MODS_COLUMNS: string[] = MANUAL_MODS_READY ? ["manualModsCount", "manualModsJson"] : [];

export type ManualMod = { modName: string; fileName: string; pageUrl: string | null };

const MAX_MODS = 200;
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Lit et nettoie la liste envoyee par le launcher : 200 mods au plus, textes tronques, lien
// accepte seulement vers https://www.curseforge.com (jamais une adresse quelconque affichee).
export function parseManualMods(input: unknown): ManualMod[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_MODS).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const modName = clip(o.modName, 120);
    const fileName = clip(o.fileName, 200);
    if (!modName && !fileName) return [];
    let pageUrl: string | null = null;
    try {
      const u = new URL(clip(o.pageUrl, 500));
      if (u.protocol === "https:" && u.hostname === "www.curseforge.com") pageUrl = u.toString();
    } catch {
      // lien absent ou invalide : on garde le mod sans lien
    }
    return [{ modName: modName || fileName, fileName, pageUrl }];
  });
}

// Liste enregistree en base (JSON) -> objets, en ignorant tout contenu inattendu.
export function readManualModsJson(raw: string | null | undefined): ManualMod[] {
  if (!raw) return [];
  try {
    return parseManualMods(JSON.parse(raw));
  } catch {
    return [];
  }
}
