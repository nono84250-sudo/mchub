import fr from "@/i18n/dictionaries/fr.json";
import en from "@/i18n/dictionaries/en.json";
import type { Locale } from "@/i18n/locales";
import { PAGE_TAGS, isCustomTagId, type PageTag } from "@/lib/serverPage";

// Liste complete des etiquettes (demandes d'etiquettes, preview validee le 16/10
// https://claude.ai/artifact/LqxLYcE8EmKzvYQKcK4CXE) : les etiquettes en dur (PAGE_TAGS) restent
// la base, completees par celles que l'equipe accepte (table customTag, id en "c-..."). Fichier
// sans dependance serveur : il sert aussi a l'editeur de fiche et aux filtres de l'annuaire.
// Les alias (table tagAlias) ne sont JAMAIS envoyes au navigateur : ce sont des mots tapes par
// des proprietaires, prives. Ils ne servent que cote serveur (doublons, recherche).

// removed (23/10, « Retirer » dans la liste des etiquettes existantes) : etiquette retiree de la
// liste, en dur ou ajoutee. Plus proposee, plus affichee, plus acceptee a l'enregistrement.
export type CustomTag = { id: string; nameFr: string; nameEn: string; removed?: boolean };
export type TagCatalog = { custom: CustomTag[]; aliases: Record<string, string> };
export const EMPTY_TAG_CATALOG: TagCatalog = { custom: [], aliases: {} };

export const TAG_WORD_MAX = 24;
export const TAG_NAME_MAX = 24;
export const TAG_PENDING_MAX = 2; // demandes en attente par serveur
export const TAG_MONTHLY_MAX = 5; // demandes par mois et par compte proprietaire
export const TAG_REFUSE_REASONS = 4; // motifs : voir tagRequests.reasons dans les dictionnaires

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

// Forme comparable d'un mot : minuscules, sans accents, chiffres-lettres remplaces (n00b -> noob),
// lettres seulement (« P.V.P » -> « pvp », « Mini-jeux » -> « minijeux »).
export function normalizeTagWord(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$]/g, (c) => LEET[c])
    .replace(/[^a-z]/g, "");
}

// Liste noire, comparee sur le mot normalise. « Contient » pour les mots assez longs pour ne
// pas se cacher dans un mot normal ; egalite stricte pour les mots courts (sinon « con » bloque
// « construction », « cul » bloque « culture »).
const BANNED_CONTAINS = [
  // FR
  "connard", "connasse", "salope", "salaud", "encule", "batard", "putain", "pute", "merde", "nique", "couille",
  "pedale", "negre", "bougnoul", "youpin", "tafiole", "gouine", "abruti", "debile", "bordel", "chatte", "branleur",
  "foutre", "grognasse", "idiot", "noob", "petasse", "pouffiasse", "trouduc", "sexe", "porno", "nazi", "hitler",
  // EN
  "fuck", "shit", "bitch", "cunt", "asshole", "nigger", "nigga", "faggot", "whore", "slut", "retard", "bastard",
  "pussy", "wanker", "twat", "dickhead", "motherf", "porn", "penis", "vagina", "boob",
];
const BANNED_EXACT = ["con", "cons", "cul", "pd", "fdp", "ntm", "tg", "bite", "pede", "fag", "dick", "cock", "sex", "rape", "kys"];

export function isBannedTagWord(normalized: string): boolean {
  return BANNED_EXACT.includes(normalized) || BANNED_CONTAINS.some((w) => normalized.includes(w));
}

// Nom affiche d'une etiquette dans une langue ; "" si l'etiquette n'existe pas (ou plus).
// « Remplacer une etiquette » (23/10) : une ligne customTag peut porter l'identifiant d'une
// etiquette en dur (ex. "farming") ; c'est alors son nouveau nom, lu avant celui du dictionnaire.
export function tagName(tag: string, locale: Locale, custom: CustomTag[]): string {
  const c = custom.find((x) => x.id === tag);
  if (c?.removed) return "";
  if (c) return locale === "en" ? c.nameEn : c.nameFr;
  if ((PAGE_TAGS as readonly string[]).includes(tag)) {
    const dict = locale === "en" ? en : fr;
    return (dict.serverPage.tags as Record<string, string>)[tag] ?? "";
  }
  return "";
}

// Toutes les etiquettes proposables : d'abord celles en dur, puis celles ajoutees (par nom).
export function allTags(custom: CustomTag[]): PageTag[] {
  const removed = new Set(custom.filter((c) => c.removed).map((c) => c.id));
  return [...PAGE_TAGS, ...custom.map((c) => c.id).filter(isCustomTagId)].filter((tag) => !removed.has(tag));
}

export function isKnownTag(tag: string, custom: CustomTag[]): boolean {
  const c = custom.find((x) => x.id === tag);
  if (c) return !c.removed;
  return (PAGE_TAGS as readonly string[]).includes(tag);
}

// Formes normalisees de chaque etiquette (identifiant, nom FR, nom EN), sans les alias. Les noms
// passent par tagName : une etiquette en dur renommee est comparee sous son nouveau nom (l'ancien
// devient un alias au remplacement).
function tagForms(custom: CustomTag[]): [string, string[]][] {
  return allTags(custom).map((tag): [string, string[]] => [
    tag,
    [isCustomTagId(tag) ? tag.slice(2) : tag, tagName(tag, "fr", custom), tagName(tag, "en", custom)].map(normalizeTagWord),
  ]);
}

// Etiquette qui correspond deja a ce mot (nom, identifiant ou alias), sinon null. exceptId : une
// etiquette a ne pas compter (celle qu'on renomme, « Remplacer une etiquette »).
export function findExistingTag(word: string, catalog: TagCatalog, exceptId?: string): string | null {
  const n = normalizeTagWord(word);
  if (!n) return null;
  const alias = catalog.aliases[n];
  if (alias && alias !== exceptId && isKnownTag(alias, catalog.custom)) return alias;
  return tagForms(catalog.custom).find(([tag, forms]) => tag !== exceptId && forms.includes(n))?.[0] ?? null;
}

// Recherche de l'annuaire : etiquettes dont un nom (FR ou EN) contient le texte cherche, ou dont
// un alias est exactement ce mot. Trois lettres minimum pour ne pas tout ramener.
export function tagsMatchingQuery(query: string, catalog: TagCatalog): string[] {
  const n = normalizeTagWord(query);
  if (n.length < 3) return [];
  const found = new Set<string>();
  for (const [tag, forms] of tagForms(catalog.custom)) if (forms.some((f) => f.includes(n))) found.add(tag);
  const alias = catalog.aliases[n];
  if (alias && isKnownTag(alias, catalog.custom)) found.add(alias);
  return [...found];
}

// Identifiant d'une nouvelle etiquette, a partir de son nom : "c-" + lettres/chiffres/tirets.
export function customTagIdFrom(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  return `c-${slug || "tag"}`;
}
