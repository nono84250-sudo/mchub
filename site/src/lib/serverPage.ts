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

export const PAGE_TAGS = [
  "survival", "creative", "pvp", "coop", "roleplay", "minigames",
  "tech", "magic", "adventure", "economy", "french", "english",
] as const;
export type PageTag = (typeof PAGE_TAGS)[number];

export const PAGE_SECTIONS = ["about", "gallery", "video", "rules", "social"] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];

export const PAGE_LIMITS = { about: 2000, rules: 8, ruleLength: 120, caption: 40, tags: 3, gallery: 3, url: 200 } as const;

export type GalleryItem = { url: string; caption: string };

export type ServerPageConfig = {
  accent: PageAccent | null; // null : couleur du site
  wallpaper: boolean; // fond (backgroundUrl) etendu a toute la page
  tags: PageTag[];
  order: PageSection[];
  hidden: PageSection[];
  about: string;
  gallery: GalleryItem[];
  videoId: string | null;
  rules: string[];
  youtubeUrl: string | null;
  tiktokUrl: string | null;
};

export const DEFAULT_PAGE_CONFIG: ServerPageConfig = {
  accent: null,
  wallpaper: true,
  tags: [],
  order: [...PAGE_SECTIONS],
  hidden: [],
  about: "",
  gallery: [],
  videoId: null,
  rules: [],
  youtubeUrl: null,
  tiktokUrl: null,
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
  const accent = typeof input.accent === "string" && input.accent in PAGE_ACCENTS ? (input.accent as PageAccent) : null;
  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.filter((t): t is PageTag => (PAGE_TAGS as readonly string[]).includes(t as string)))].slice(0, PAGE_LIMITS.tags)
    : [];
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
    order: pickOrder(input.order),
    hidden,
    about: cleanText(input.about, PAGE_LIMITS.about, true),
    gallery,
    videoId,
    rules,
    youtubeUrl: link("youtube", input.youtubeUrl),
    tiktokUrl: link("tiktok", input.tiktokUrl),
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
