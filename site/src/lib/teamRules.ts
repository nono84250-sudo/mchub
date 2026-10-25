// Regles des teams (fil « Team Omniscient et serveurs pilotes », 19/10) sans dependance serveur :
// elles servent aussi a la verification en direct dans l'editeur « Ma team ». Les ecritures
// passent par lib/teams.ts, qui revérifie tout.
import { isBannedTagWord, normalizeTagWord } from "@/lib/tagCatalog";
import { slugify } from "@/lib/slug";

// Tables team, teamNameHold, teamRequest et colonne server.teamId : migration
// d1/migrations/2026-10-19-teams.sql. Lancee sur DEV le 19/10. Avant la production : la lancer sur la base de prod (avec l'accord de
// Rushi), sinon remettre ce drapeau a false (plus aucune lecture des tables de teams, onglet cache).
export const TEAMS_READY = true;

export const TEAM_NAME_MIN = 3;
export const TEAM_NAME_MAX = 24;
export const TEAM_DESCRIPTION_MAX = 160;
// Un changement de nom tous les 30 jours ; l'ancien nom reste bloque 30 jours.
export const TEAM_RENAME_DAYS = 30;
export const TEAM_HOLD_DAYS = 30;
// Jusqu'a 3 teams par compte sans demande (choix de Rushi du 20/10 : « 3 teams libres ») ; au-dela
// seulement sur demande avec une preuve, acceptee par un admin (« quelqu'un qui gère plusieurs
// organisations, je veux une preuve », 19/10).
export const TEAM_FREE_COUNT = 3;
export const TEAM_REQUEST_REASON_MAX = 300;
export const TEAM_REQUEST_PROOF_MAX = 300;

// La team de l'equipe du site : « Proposé par Omniscient » au lieu de « Par la team X ».
export const OFFICIAL_TEAM_SLUG = "omniscient";

// Noms que seul un administrateur peut poser (compares sur la forme normalisee) : « contient »
// pour les marques et le nom du site, egalite stricte pour les mots courts (sinon « admin »
// bloquerait « Badminton »).
const RESERVED_CONTAINS = ["Omniscient", "Rushifa", "Ruchifa", "Mojang", "Minecraft", "Microsoft", "Hypixel", "CurseForge", "Modrinth", "Feed The Beast"];
const RESERVED_EXACT = [
  "admin", "admins", "administrateur", "administrator", "staff", "modo", "modos", "moderateur", "moderator",
  "moderation", "support", "equipe", "team", "officiel", "official", "xbox", "ftb",
];

export type TeamBadge = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  description: string | null;
  // Team Omniscient : affichage « Proposé par » + « C'est ton serveur ? ».
  official: boolean;
};

export type TeamNameError = "nameLength" | "nameChars" | "nameBanned" | "nameReserved";
export type TeamDescriptionError = "descriptionLength" | "descriptionLink" | "descriptionBanned";

// Forme comparable d'un nom (unicite) : meme normalisation que les etiquettes, chiffres gardes.
export function teamKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function teamSlug(name: string): string {
  return slugify(name);
}

export function cleanTeamName(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function cleanTeamDescription(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

// Mot par mot (le texte entier colle ferait des faux positifs : « Chat Telecom » -> « chatte »).
function hasBannedWord(text: string): boolean {
  return text.split(/[\s.,;:!?'"()\-_/]+/).some((w) => w && isBannedTagWord(normalizeTagWord(w)));
}

// Forme « pliee » d'un nom, pour reperer les imitations (page admin Teams, 20/10) : en plus de
// teamKey, les caracteres qui se ressemblent deviennent la meme lettre (0 -> o, 1 et l -> i,
// lettres cyrilliques ou grecques -> latines) et seules les lettres restent. « 0mn1sc1ent »,
// « Omni Scient » et « Оmniscient » (O cyrillique) donnent tous « omniscient ».
const LOOKALIKE: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", l: "i",
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "к": "k", "м": "m", "т": "t", "н": "h", "в": "b",
  "ο": "o", "ν": "v", "ι": "i", "α": "a", "ε": "e", "κ": "k", "ρ": "p", "τ": "t",
};

export function foldTeamName(name: string): string {
  return Array.from(name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    .map((c) => LOOKALIKE[c] ?? c)
    .join("")
    .replace(/[^a-z]/g, "");
}

// Distance d'edition (lettres a ajouter, enlever ou changer) entre deux noms plies.
export function foldedDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

// Plus petite distance entre `pattern` et un morceau de `text` (« Les Omnisciant FR » contient
// presque « omniscient »).
function nearlyContains(text: string, pattern: string): number {
  let prev = new Array(text.length + 1).fill(0);
  for (let i = 1; i <= pattern.length; i++) {
    const row = [i];
    for (let j = 1; j <= text.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (pattern[i - 1] === text[j - 1] ? 0 : 1));
    prev = row;
  }
  return Math.min(...prev);
}

// Nom reserve imite par `name` (« Omniscient », « Admin »...), ou null. Une faute de frappe est
// toleree (« Omnisciant », « Omnisient »), deux pour les noms de 10 lettres (« Omnicient »).
export function reservedNameImitated(name: string): string | null {
  const folded = foldTeamName(name);
  for (const r of RESERVED_CONTAINS) {
    const f = foldTeamName(r);
    if (folded.includes(f) || nearlyContains(folded, f) <= (f.length >= 10 ? 2 : 1)) return r;
  }
  const exact = RESERVED_EXACT.find((r) => foldTeamName(r) === folded);
  return exact ?? null;
}

export function isReservedTeamName(name: string): boolean {
  return reservedNameImitated(name) !== null;
}

// Deux noms de teams trop proches : meme forme pliee (« Lucioles » / « Luci0les »), ou une seule
// lettre d'ecart pour les noms de 5 lettres pliees ou plus (« Lucioles » / « Lucioies »).
export function teamNamesClash(a: string, b: string): "same" | "close" | null {
  const fa = foldTeamName(a);
  const fb = foldTeamName(b);
  if (!fa || !fb) return null;
  if (fa === fb) return "same";
  if (Math.min(fa.length, fb.length) >= 5 && Math.abs(fa.length - fb.length) <= 1 && foldedDistance(fa, fb) <= 1) return "close";
  return null;
}

// Erreur du nom, ou null. Lettres (accents compris), chiffres, espaces et . _ - ' seulement.
export function teamNameError(name: string, isAdmin = false): TeamNameError | null {
  if (name.length < TEAM_NAME_MIN || name.length > TEAM_NAME_MAX || teamKey(name).length < 2) return "nameLength";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(name)) return "nameChars";
  if (hasBannedWord(name)) return "nameBanned";
  if (!isAdmin && isReservedTeamName(name)) return "nameReserved";
  return null;
}

const LINK = /(https?:\/\/|www\.|discord\.gg|\b[a-z0-9-]+\.(com|net|org|fr|be|gg|io|me|tv|xyz|eu|co)\b)/i;

export function teamDescriptionError(description: string): TeamDescriptionError | null {
  if (description.length > TEAM_DESCRIPTION_MAX) return "descriptionLength";
  if (LINK.test(description)) return "descriptionLink";
  if (description && hasBannedWord(description)) return "descriptionBanned";
  return null;
}

export type TeamRequestError = TeamNameError | "reasonLength" | "proofMissing" | "proofLength";

// Demande d'une team de plus (formulaire de « Ma team ») : nom (memes regles qu'une team, sans
// nom reserve), pourquoi (obligatoire) et preuve (un lien ou une image, au moins l'un des deux).
export function teamRequestError(input: { name: string; reason: string; proof: string; proofImageUrl: string | null }): TeamRequestError | null {
  const nameError = teamNameError(input.name);
  if (nameError) return nameError;
  if (!input.reason || input.reason.length > TEAM_REQUEST_REASON_MAX) return "reasonLength";
  if (!input.proof && !input.proofImageUrl) return "proofMissing";
  if (input.proof.length > TEAM_REQUEST_PROOF_MAX) return "proofLength";
  return null;
}

// Initiales affichees quand la team n'a pas d'icone (« Les Lucioles » -> « LL »).
export function teamInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}
