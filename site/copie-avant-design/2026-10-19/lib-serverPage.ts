// Fiche publique personnalisable d'un serveur (decision du 16/10, variante « complete » +
// disposition « deux colonnes ») : couleur, fond pleine page, etiquettes, et sections que le
// proprietaire active, masque et ordonne (presentation, galerie, video, regles, reseaux).
// Tout est en choix fermes : aucune balise HTML ni CSS libre n'est jamais acceptee, le texte de
// presentation n'a que 4 marques de mise en forme (voir RichText.tsx) et chaque lien est verifie.
// Stocke en JSON dans la colonne server.pageConfig (une seule colonne : aucun appel base en plus,
// la fiche reste lue dans le meme cache que le reste, voir loadPublishedServerBySlug). Les liens
// Discord et site web reutilisent les colonnes existantes discordUrl/websiteUrl, et le fond
// d'ecran reutilise backgroundUrl (meme envoi d'image, memes limites).
// Fichier sans dependance serveur : il sert aussi a la verification en direct dans l'editeur.

export const PAGE_ACCENTS = {
  blue: "#2f78ad",
  green: "#2f9e6e",
  violet: "#7a5bd0",
  orange: "#d0742f",
  red: "#c0453f",
  gold: "#b08a1a",
} as const;
export type PageAccent = keyof typeof PAGE_ACCENTS;
// Couleur libre (16/10, rond « + » de l'editeur) : un code #rrggbb, rien d'autre.
export type CustomAccent = `#${string}`;
const CUSTOM_ACCENT = /^#[0-9a-f]{6}$/;

export function isCustomAccent(v: unknown): v is CustomAccent {
  return typeof v === "string" && CUSTOM_ACCENT.test(v);
}

// Luminance relative (WCAG) d'un #rrggbb, de 0 (noir) a 1 (blanc).
export function accentLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Au-dela, la couleur ne se lit plus assez comme texte sur le fond du theme : tres claire, elle
// est assombrie en theme clair ; tres sombre, eclaircie en theme sombre (classes page-accent-* de
// globals.css). L'editeur affiche le meme avertissement.
export const ACCENT_PALE = 0.35;
export const ACCENT_DEEP = 0.08;

// Couleur choisie, posee sur la fiche seulement : --accent-raw + une classe. Les teintes
// derivees (survol, pastilles, texte sur les boutons) sont recalculees par .page-accent dans
// globals.css, theme par theme (sur :root elles suivent l'accent du site).
export function pageAccent(accent: PageAccent | CustomAccent | null): { className: string; style: Record<string, string> } | null {
  if (!accent) return null;
  const hex = isCustomAccent(accent) ? accent : PAGE_ACCENTS[accent as PageAccent];
  if (!hex) return null;
  const lum = accentLuminance(hex);
  const tone = lum > ACCENT_PALE ? " page-accent-pale" : lum < ACCENT_DEEP ? " page-accent-deep" : "";
  return { className: `page-accent${tone}`, style: { "--accent-raw": hex } };
}

// Liste fermee (pas de texte libre), elargie le 16/10 avec les etiquettes supplementaires. Elle
// pourra grandir : ajouter une cle ici et ses libelles dans les dictionnaires (site et launcher).
export const PAGE_TAGS = [
  "survival", "creative", "pvp", "pve", "coop", "roleplay", "minigames", "tech", "magic", "adventure",
  "economy", "hardcore", "skyblock", "factions", "bedwars", "prison", "towny", "smp", "anarchy", "events",
  "quests", "dungeons", "building", "redstone", "farming", "exploration", "competitive", "chill", "whitelist", "bedrock",
] as const;
export type BuiltinPageTag = (typeof PAGE_TAGS)[number];
// Etiquettes ajoutees par l'equipe (demandes d'etiquettes, 16/10 : table customTag, voir
// lib/tagCatalog.ts) : identifiant toujours en "c-...", jamais confondu avec une etiquette en dur.
// Ici on ne verifie que la forme ; l'existence est verifiee a l'enregistrement (actions/serverPage.ts)
// et une etiquette inconnue n'est simplement pas affichee.
export type CustomTagId = `c-${string}`;
export type PageTag = BuiltinPageTag | CustomTagId;
const CUSTOM_TAG_ID = /^c-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCustomTagId(v: unknown): v is CustomTagId {
  return typeof v === "string" && v.length <= 40 && CUSTOM_TAG_ID.test(v);
}

export function isPageTag(v: unknown): v is PageTag {
  return (PAGE_TAGS as readonly string[]).includes(v as string) || isCustomTagId(v);
}

export const PAGE_LANGUAGES = ["fr", "en"] as const;
export type PageLanguage = (typeof PAGE_LANGUAGES)[number];
// Anciennes etiquettes de langue (fiches enregistrees avant la separation) : lues comme langues.
const LEGACY_LANGUAGE_TAGS: Record<string, PageLanguage> = { french: "fr", english: "en" };

export const PAGE_SECTIONS = ["about", "gallery", "video", "rules", "social"] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];

// Lecteur YouTube integre et lancement automatique : coupes le 16/10 (YouTube demandait de se
// connecter, « pas un robot »), rallumes le 18/10 : le test de Rushi montre que le lecteur marche. false pour les couper.
export const VIDEO_EMBED_ENABLED = true;

export const PAGE_LIMITS = { about: 2000, rules: 8, ruleLength: 120, caption: 40, tags: 3, extraTags: 8, gallery: 3, url: 200, installMessage: 300 } as const;

export type GalleryItem = { url: string; caption: string };

export type ServerPageConfig = {
  accent: PageAccent | CustomAccent | null; // null : couleur du site ; sinon un nom ou un #rrggbb
  wallpaper: boolean; // fond (backgroundUrl) etendu a toute la page
  tags: PageTag[]; // principales (3 max) : a cote du nom et sur les cartes de l'annuaire
  extraTags: PageTag[]; // supplementaires (8 max) : bloc Infos de la fiche et recherche
  languages: PageLanguage[];
  order: PageSection[];
  hidden: PageSection[];
  about: string;
  gallery: GalleryItem[];
  videoId: string | null;
  videoAutoplay: boolean; // lancement automatique (muet) quand la video est visible ; decoche par defaut
  rules: string[];
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  // Message aux joueurs pendant l'installation (design du launcher 17/10, point 6) : affiche par le
  // launcher avant la 1re installation et pendant le telechargement. Vide = rien n'est affiche.
  installMessage: string;
};

export const DEFAULT_PAGE_CONFIG: ServerPageConfig = {
  accent: null,
  wallpaper: true,
  tags: [],
  extraTags: [],
  languages: [],
  order: [...PAGE_SECTIONS],
  hidden: [],
  about: "",
  gallery: [],
  videoId: null,
  videoAutoplay: false,
  rules: [],
  youtubeUrl: null,
  tiktokUrl: null,
  installMessage: "",
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
// Retire les caracteres de controle (sauf retour a la ligne) et normalise les fins de ligne.
const cleanText = (v: unknown, max: number, multiline = false): string => {
  let s = str(v).replace(/\r\n?/g, "\n");
  s = multiline ? s.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "") : s.replace(/[\u0000-\u001f\u007f]/g, "");
  return (multiline ? s.replace(/\n{3,}/g, "\n\n").trim() : s.trim()).slice(0, max);
};

export const YOUTUBE_ID = /^[\w-]{11}$/;
// Lien de video accepte : youtube.com/watch?v=ID, youtu.be/ID ou youtube.com/shorts/ID.
export function youtubeVideoId(input: string): string | null {
  const s = input.trim();
  const m =
    /^https:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})(?:[&#].*)?$/.exec(s) ??
    /^https:\/\/youtu\.be\/([\w-]{11})(?:[?#].*)?$/.exec(s) ??
    /^https:\/\/(?:www\.)?youtube\.com\/shorts\/([\w-]{11})(?:[?#].*)?$/.exec(s);
  return m ? m[1] : null;
}

export type LinkKind = "discord" | "website" | "youtube" | "tiktok";

// https uniquement, sans identifiants ni port, hote reconnu pour les reseaux.
export function isValidLink(kind: LinkKind, input: string): boolean {
  const s = input.trim();
  if (!s || s.length > PAGE_LIMITS.url || /[\s<>"'`\\]/.test(s)) return false;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  switch (kind) {
    case "discord":
      return (host === "discord.gg" && /^\/[A-Za-z0-9-]{2,32}\/?$/.test(path)) ||
        ((host === "discord.com" || host === "www.discord.com") && /^\/invite\/[A-Za-z0-9-]{2,32}\/?$/.test(path));
    case "youtube":
      return (host === "youtube.com" || host === "www.youtube.com") && /^\/(@[\w.-]{3,30}|channel\/[\w-]{10,40})\/?$/.test(path);
    case "tiktok":
      return (host === "tiktok.com" || host === "www.tiktok.com") && /^\/@[\w.]{2,24}\/?$/.test(path);
    case "website":
      return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && host !== "localhost";
  }
}

function pickOrder(v: unknown): PageSection[] {
  const seen = new Set<PageSection>();
  if (Array.isArray(v)) for (const s of v) if ((PAGE_SECTIONS as readonly string[]).includes(s)) seen.add(s as PageSection);
  for (const s of PAGE_SECTIONS) seen.add(s);
  return [...seen];
}

// Lecture tolerante (valeur en base, ou JSON abime) : tout ce qui n'est pas reconnu est ignore,
// jamais une erreur a l'affichage. Les liens et images invalides sont retires.
export function normalizePageConfig(input: unknown): ServerPageConfig {
  if (!isObj(input)) return { ...DEFAULT_PAGE_CONFIG, order: [...PAGE_SECTIONS] };
  const rawAccent = typeof input.accent === "string" ? input.accent.toLowerCase() : null;
  const accent = rawAccent && Object.hasOwn(PAGE_ACCENTS, rawAccent) ? (rawAccent as PageAccent) : isCustomAccent(rawAccent) ? rawAccent : null;
  const pickTags = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter(isPageTag))] : [];
  const tags = pickTags(input.tags).slice(0, PAGE_LIMITS.tags);
  const extraTags = pickTags(input.extraTags).filter((t) => !tags.includes(t)).slice(0, PAGE_LIMITS.extraTags);
  const languages = [
    ...new Set([
      ...(Array.isArray(input.languages) ? input.languages : []).filter((l): l is PageLanguage => (PAGE_LANGUAGES as readonly string[]).includes(l as string)),
      ...(Array.isArray(input.tags) ? input.tags : []).map((t) => LEGACY_LANGUAGE_TAGS[t as string]).filter((l): l is PageLanguage => !!l),
    ]),
  ];
  const hidden = Array.isArray(input.hidden)
    ? [...new Set(input.hidden.filter((s): s is PageSection => (PAGE_SECTIONS as readonly string[]).includes(s as string)))]
    : [];
  const gallery = Array.isArray(input.gallery)
    ? input.gallery
        .filter(isObj)
        .map((g) => ({ url: str(g.url).trim(), caption: cleanText(g.caption, PAGE_LIMITS.caption) }))
        .filter((g) => /^https?:\/\/[^\s"'<>`\\()]+$/.test(g.url))
        .slice(0, PAGE_LIMITS.gallery)
    : [];
  const rules = Array.isArray(input.rules)
    ? input.rules.map((r) => cleanText(r, PAGE_LIMITS.ruleLength)).filter(Boolean).slice(0, PAGE_LIMITS.rules)
    : [];
  const videoId = typeof input.videoId === "string" && YOUTUBE_ID.test(input.videoId) ? input.videoId : null;
  const link = (kind: LinkKind, v: unknown) => (isValidLink(kind, str(v)) ? str(v).trim() : null);
  return {
    accent,
    wallpaper: input.wallpaper !== false,
    tags,
    extraTags,
    languages,
    order: pickOrder(input.order),
    hidden,
    about: cleanText(input.about, PAGE_LIMITS.about, true),
    gallery,
    videoId,
    videoAutoplay: input.videoAutoplay === true,
    rules,
    youtubeUrl: link("youtube", input.youtubeUrl),
    tiktokUrl: link("tiktok", input.tiktokUrl),
    installMessage: cleanText(input.installMessage, PAGE_LIMITS.installMessage, true),
  };
}

export function parsePageConfig(raw: string | null | undefined): ServerPageConfig {
  if (!raw) return normalizePageConfig(null);
  try {
    return normalizePageConfig(JSON.parse(raw));
  } catch {
    return normalizePageConfig(null);
  }
}

// Ce que l'editeur envoie : la config, plus les champs qui vivent dans leurs propres colonnes,
// et le lien video tel que saisi (on n'en garde que l'identifiant).
export type PageEditorInput = {
  config: ServerPageConfig;
  videoUrl: string;
  discordUrl: string;
  websiteUrl: string;
  backgroundUrl: string;
};

export type PageFieldError = "video" | "discord" | "website" | "youtube" | "tiktok";

// Erreurs de saisie (liens). Partage entre l'editeur (affichage en direct) et l'action serveur.
export function pageInputErrors(input: PageEditorInput): PageFieldError[] {
  const errors: PageFieldError[] = [];
  if (input.videoUrl.trim() && !youtubeVideoId(input.videoUrl)) errors.push("video");
  if (input.discordUrl.trim() && !isValidLink("discord", input.discordUrl)) errors.push("discord");
  if (input.websiteUrl.trim() && !isValidLink("website", input.websiteUrl)) errors.push("website");
  if ((input.config.youtubeUrl ?? "").trim() && !isValidLink("youtube", input.config.youtubeUrl ?? "")) errors.push("youtube");
  if ((input.config.tiktokUrl ?? "").trim() && !isValidLink("tiktok", input.config.tiktokUrl ?? "")) errors.push("tiktok");
  return errors;
}

// Sections reellement affichees (activees ET non vides), dans l'ordre choisi.
export function visibleSections(
  config: ServerPageConfig,
  links: { discordUrl: string | null; websiteUrl: string | null },
): PageSection[] {
  const hasContent: Record<PageSection, boolean> = {
    about: !!config.about.trim(),
    gallery: config.gallery.length > 0,
    video: !!config.videoId,
    rules: config.rules.length > 0,
    social: !!(links.discordUrl || links.websiteUrl || config.youtubeUrl || config.tiktokUrl),
  };
  return config.order.filter((s) => !config.hidden.includes(s) && hasContent[s]);
}
