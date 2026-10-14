// Sujets du formulaire de contact (/contact), d'apres le Document 2 des textes legaux.
// adminLabel est le libelle (francais) place en tete du message enregistre, lu dans
// /admin/contact ; labelKey est le libelle traduit affiche au visiteur.
export const CONTACT_SUBJECTS = [
  { id: "help", labelKey: "contact.subjectHelp", adminLabel: "Aide Launcher/Site" },
  { id: "server", labelKey: "contact.subjectServer", adminLabel: "Serveur de jeu" },
  { id: "data", labelKey: "contact.subjectData", adminLabel: "Données personnelles" },
  { id: "illicit", labelKey: "contact.subjectIllicit", adminLabel: "Contenu illicite" },
  { id: "other", labelKey: "contact.subjectOther", adminLabel: "Autre" },
] as const;
