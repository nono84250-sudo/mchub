import type { L } from "@/lib/help/types";

// Petits textes de l'interface du centre d'aide (les pages elles-mêmes sont dans articles.ts).
export const HELP_UI = {
  title: { fr: "Centre d'aide", en: "Help center" },
  subtitle: {
    fr: "Toutes les fonctions du site et du launcher expliquées simplement, et les solutions aux problèmes courants.",
    en: "Every site and launcher feature explained simply, and fixes for common problems.",
  },
  metaDescription: {
    fr: "Centre d'aide d'Omniscient : installer le launcher, rejoindre un serveur, jouer en solo, créer ses packs, publier son serveur et résoudre les problèmes courants.",
    en: "Omniscient help center: install the launcher, join a server, play solo, create your packs, publish your server and fix common problems.",
  },
  search: { fr: "Rechercher dans l'aide… (ex. curseforge, plante, f6)", en: "Search help… (e.g. curseforge, crash, f6)" },
  results: { fr: "{n} page(s) trouvée(s)", en: "{n} page(s) found" },
  none: { fr: "Aucune page ne parle de « {query} ».", en: "No page mentions \"{query}\"." },
  noneCta: { fr: "Pose ta question à l'équipe", en: "Ask the team" },
  pages: { fr: "pages", en: "pages" },
  beta: { fr: "Bêta", en: "Beta" },
  newBadge: { fr: "Nouveau", en: "New" },
  whatsNew: { fr: "Nouveautés", en: "What's new" },
  whatsNewSub: { fr: "Les dernières fonctions arrivées dans Omniscient.", en: "The latest features added to Omniscient." },
  knownBugs: { fr: "Bugs connus et leurs solutions", en: "Known bugs and their fixes" },
  faq: { fr: "Questions fréquentes", en: "Frequently asked questions" },
  faqSub: { fr: "Les réponses courtes aux questions les plus posées.", en: "Short answers to the most asked questions." },
  teamOnly: { fr: "Visible seulement par l'équipe", en: "Only visible to the team" },
  hiddenPreview: { fr: "Caché au public : tu vois cette page parce que tu es admin", en: "Hidden from the public: you see this page because you are an admin" },
  updated: { fr: "Mis à jour le {date}", en: "Updated {date}" },
  seeAlso: { fr: "Voir aussi", en: "See also" },
  allPages: { fr: "Toutes les pages de l'aide", en: "All help pages" },
  home: { fr: "Aide", en: "Help" },
  stuck: { fr: "Toujours bloqué ?", en: "Still stuck?" },
  stuckSub: { fr: "Écris-nous, on répond en général sous 3 jours ouvrés.", en: "Write to us, we usually answer within 3 working days." },
  contact: { fr: "Nous contacter", en: "Contact us" },
} satisfies Record<string, L>;

export function helpDate(iso: string, locale: "fr" | "en"): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
