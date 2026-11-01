// Centre d'aide (/aide), codé le 31/10 à la demande de Rushi (structure C du brainstorming
// du 28/10 : recherche + parcours « Je joue » / « J'ai un serveur » + pages courtes).
// Les textes sont ici (articles.ts) et pas dans fr.json/en.json : un seul fichier à mettre à
// jour quand une fonction change, et pas de conflit avec les autres chantiers du site.

export type L = { fr: string; en: string };

// Un bloc de texte d'une page. Dans le texte : **gras** et [lien](/aide/slug) sont reconnus.
export type HelpBlock =
  | { p: L }
  | { h: L }
  | { steps: L[] }
  | { list: L[] }
  | { note: L }
  | { warn: L };

export type HelpCategoryId = "start" | "play" | "own" | "fix" | "account" | "team";

export type HelpArticle = {
  slug: string;
  cat: HelpCategoryId;
  title: L;
  summary: L;
  // Mots cherchés en plus du texte (fautes courantes, mots anglais, synonymes).
  keywords?: string;
  // Interrupteur du Laboratoire : la page n'existe que pour ceux qui voient la fonction
  // (testeurs pendant le test, tout le monde quand elle passe en « Tous »). Badge « Bêta »
  // tant qu'elle n'est pas en « Tous ».
  feature?: string;
  // Pages de l'équipe : visibles seulement par un administrateur connecté à /admin.
  adminOnly?: boolean;
  // Affiché dans « Nouveautés » sur l'accueil de l'aide.
  isNew?: boolean;
  updated: string; // AAAA-MM-JJ
  body: HelpBlock[];
  related?: string[];
};

export type HelpCategory = { id: HelpCategoryId; title: L; intro: L };
