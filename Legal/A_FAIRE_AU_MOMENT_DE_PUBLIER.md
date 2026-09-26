# À FAIRE AU MOMENT DE PUBLIER — Omniscient

**Créé le 26 septembre 2026.** Ce fichier garde tout ce qu'il reste à faire pour publier les documents légaux. **Rien de cela n'est fait à ce jour : le site n'a pas été touché** (décision : on relit d'abord, on publie plus tard).

**Pour reprendre :** dis à Claude « reprends `Legal/A_FAIRE_AU_MOMENT_DE_PUBLIER.md` ».

---

## 0. État actuel

| Élément | Où | État |
|---|---|---|
| Les 5 textes (mentions, contact, CGV, CGU + règlement, confidentialité) | `Legal/DOCUMENTS_LEGAUX_OMNISCIENT.md` (source modifiable) et `.pdf` (23 pages, lecture) | Brouillon rédigé, **à relire** |
| Champs à remplir | Surlignés en jaune dans le PDF, écrits `[À COMPLÉTER : …]` dans le `.md` | **Vides** |
| Pages du site, liens de pied de page, formulaire de contact | — | **Pas faits** |
| Relecture par un avocat | — | **Pas faite** |
| Commit Git | — | **Rien de commité** (le dossier `Legal/` est non suivi) |

Régénérer le PDF après une modification du `.md` : le script est `legal_to_pdf.py` dans le dossier de travail de la session ; sinon, demander à Claude de le refaire.

---

## 1. Ce que tu dois me donner (à remplir dans le `.md`)

- [ ] Nom et prénom (entrepreneur individuel — mention « EI »)
- [ ] Adresse (domicile, ou domiciliation commerciale si tu ne veux pas afficher ton domicile)
- [ ] Numéro de téléphone (exigé par la loi pour l'éditeur)
- [ ] Adresse e-mail de contact **dédiée** (pas l'adresse personnelle de connexion à tes outils)
- [ ] SIREN / SIRET
- [ ] TVA : numéro intracommunautaire, ou « TVA non applicable, article 293 B du CGI »
- [ ] Mention d'immatriculation (RCS/RM ou « dispensé » selon ton cas)
- [ ] Nom de domaine définitif (aujourd'hui `omniscient-theta.vercel.app`)
- [ ] Médiateur de la consommation (nom, adresse postale, site) — adhésion **obligatoire** dès que tu vends à des particuliers, généralement payante ; choisir dans la liste officielle de la CECMC (economie.gouv.fr)
- [ ] Prestataire de paiement (ex. Stripe), son pays et ses garanties
- [ ] Prix : Pro mensuel, Pro annuel, boost « Mise en avant » (et sa durée)
- [ ] Ville du tribunal (clients professionnels)
- [ ] Horaires du service client et délai de réponse
- [ ] Délais laissés à `[À COMPLÉTER]` : jours avant suspension après échec de paiement (7 proposé), conservation des serveurs en pause après fin d'abonnement (90 proposé), indisponibilité ouvrant remboursement (5 jours proposé)
- [ ] Date d'entrée en vigueur (le jour de la publication)

## 2. À vérifier avant de publier

- [ ] **Numéro de téléphone de Vercel** (+1 559 288 7060) : il vient de sites tiers, pas d'une page de Vercel.
- [ ] **Adresse postale de Prisma Data, Inc.** si tu veux la faire figurer.
- [ ] **Région des fonctions Vercel** (probablement Washington D.C. par défaut) et **région du stockage d'images (Vercel Blob)**, dans ton tableau de bord Vercel. Adapter la section 5 de la politique (« Transferts hors de l'Union européenne »).
- [ ] **Durée de conservation des journaux techniques de Vercel** (section 3.5 de la politique).
- [ ] **Règles commerciales actuelles de Mojang** (Commercial Usage Guidelines) : relire avant publication, elles sont reprises comme obligation des propriétaires.
- [ ] **TVA** : franchise en base ou non, et TVA des ventes à des clients d'autres pays de l'UE (services numériques) — à valider avec un expert-comptable.
- [ ] **Faire relire les CGV et la politique de confidentialité par un avocat**, avant d'ouvrir les paiements.
- [ ] Relire les références de loi citées (LCEN art. 1-1, Code de la consommation L215-1-1, L221-18 et s., L221-25, L221-28, L224-25-1 et s.) : elles ont été contrôlées le 26/09/2026 mais la loi bouge.

## 3. Travail côté site (ce qui a été volontairement laissé)

**Constat au 26/09/2026 :** le pied de page (`site/src/components/Footer.tsx`) ne contient **aucun lien légal** (seulement « Serveurs », thème, langue).

- [ ] **Pages** (proposition, à valider) : `/mentions-legales`, `/contact`, `/cgv`, `/cgu`, `/confidentialite`. Pages statiques, en français seulement (la version française fait foi), avec le même habillage que le reste du site.
- [ ] **Source unique des informations d'identité** : un fichier `site/src/lib/legal.ts` (nom, adresse, téléphone, e-mail, SIREN, TVA, médiateur…) dont les pages lisent les valeurs, pour ne jamais les recopier à la main à plusieurs endroits.
- [ ] **Liens dans le pied de page** (5 liens) + nouvelles clés dans `src/i18n/dictionaries/{fr,en}.json` (bloc `footer`).
- [ ] **Page Contact avec formulaire** : champs et texte d'information RGPD déjà rédigés (Document 2). Prévoir l'envoi (e-mail) et un anti-spam. Le formulaire sert aussi de **signalement de contenu illicite** (l'adresse du contenu, les raisons, l'identité, la déclaration de bonne foi).
- [ ] **Acceptation des CGU à la connexion** (site `/login` **et** Launcher) : phrase « En vous connectant, vous acceptez les CGU et la Politique de confidentialité » avec liens. Recommandé : enregistrer la version et la date d'acceptation (nouvelle colonne sur `User`, donc **migration de base**), pour pouvoir prouver l'acceptation.
- [ ] **Avertir les utilisateurs 30 jours avant un changement** des CGU (promesse écrite dans les CGU) : prévoir un nouveau type de notification.
- [ ] **Mention de non-affiliation Mojang/Microsoft** : déjà dans les textes ; ajouter une version courte visible dans le pied de page ou la page de téléchargement.

## 4. Prérequis techniques pour que les textes soient **vrais**

Bloquant = à faire **avant** de publier la politique. Utile = à faire vite.

| # | Sujet | Niveau | Détail |
|---|---|---|---|
| 1 | **Sécurité de l'API du launcher** | Bloquant | Secret partagé unique embarqué dans chaque copie (extractible), et le launcher **déclare** son `minecraftUuid` sans preuve : quelqu'un qui extrait le secret peut lire les notifications de n'importe quel joueur ou signaler à sa place. Correctif : le launcher envoie son jeton Minecraft, le site le vérifie. |
| 2 | **Durées de conservation annoncées** | Bloquant | Comptes inactifs 3 ans, signalements 12 mois, notifications 90 jours après lecture, messages de contact 12 mois : **aucune purge automatique n'existe**. Les construire, ou allonger les durées dans la politique. |
| 3 | **Suppression de compte** | Utile | N'existe pas : traitée à la main sur demande (c'est ce que dit la politique). À construire en libre-service à terme. |
| 4 | **UUID du propriétaire dans l'API publique** | Utile | `ownerMinecraftUuid` est renvoyé publiquement. Le retirer si le launcher n'en a pas besoin (puis supprimer la phrase correspondante, section 3.2 de la politique). |
| 5 | **Colonnes héritées (e-mail, mot de passe)** | Fait | `email`, `passwordHash`, `emailVerified`, les tables `AuthToken` et `MinecraftLinkCode` datent de l'ancienne connexion par e-mail (aujourd'hui Microsoft seul), plus utilisées par le code. **Vérifié le 26/09/2026 : elles ne sont PAS vides.** Production : 3 comptes de test (dont le tien) avec e-mail et mot de passe haché, 1 jeton. Dev : 5 comptes avec e-mail, 1 jeton, 1 code de liaison. La politique de confidentialité dit « aucun mot de passe stocké, e-mail non collecté » : **c'est faux tant que ces données existent.** **Fait le 26/09/2026 : colonnes et tables supprimées en dev ET en production** (migration `drop_legacy_email_auth`, appliquée en production après le déploiement du code qui ne les lit plus) ; les 3 comptes de test sont conservés sans e-mail ni mot de passe. La politique est redevenue exacte sur ce point. |
| 6 | **Région Vercel** | Fait | Fonctions fixées à Paris (`cdg1`) le 26/09/2026 (`site/vercel.json`), vérifié en production. Reste à vérifier la région du stockage d'images (Vercel Blob). |
| 7 | **Vercel « Hobby » interdit l'usage commercial** | Bloquant avant le 1er paiement | Passer en forfait **Pro**. Source : règles officielles de Vercel (« Fair use guidelines »). |

## 5. Abonnements : ce que le paiement doit respecter

*(Quand le système d'abonnements sera construit — voir `SUIVI_PROJET.md` §8.)*

- [ ] Bouton **« Commander avec obligation de paiement »** sur la dernière étape.
- [ ] **Case à cocher séparée** : « Je demande l'exécution immédiate du service et je reconnais que je perdrai mon droit de rétractation une fois le service pleinement exécuté. »
- [ ] **E-mail de confirmation** de commande + de cet accord + facture.
- [ ] Fonction **« Résilier votre contrat »** accessible directement depuis l'espace client (loi, article L215-1-1) : accusé de réception et **date de fin** envoyés par écrit.
- [ ] **E-mail de rappel** entre 3 mois et 1 mois avant la reconduction d'un abonnement annuel.
- [ ] **Préavis de 30 jours** avant toute hausse de prix.
- [ ] Gestion de l'échec de paiement : relance, puis retour à la Formule Gratuite ; serveurs au-delà de la limite gratuite **mis en pause, pas supprimés** (90 jours).
- [ ] Archivage des contrats de 120 € ou plus pendant 10 ans.

## 6. Ce qui reste à faire côté documents

- [ ] **Registre des traitements RGPD** (document interne, pas public) : Claude peut le générer à partir de la politique.
- [ ] **Version anglaise** des cinq documents (le site est bilingue). La version française fait foi.
- [ ] **Modèles d'e-mails** : confirmation de commande, rappel de reconduction, accusé de résiliation, avis de sanction motivée.
- [ ] **Règlement d'un serveur de jeu** séparé, **seulement si** tu héberges toi-même un serveur de jeu Omniscient (aujourd'hui le « Règlement » ne couvre que la plateforme).
- [ ] Mettre à jour les textes si l'offre (Gratuit / Pro / boosts) change : article 4 des CGV et grille tarifaire.

## 7. Autres points en attente avant la mise en production (hors légal)

Pour ne rien perdre, voici ce qui reste ouvert ailleurs dans le projet :

- [ ] **Migrations de base à appliquer à la production** (`omniscient-production`), **dans l'ordre et avant** de promouvoir `master`. **Fait le 26/09/2026 : les 6 migrations en retard sont appliquées** (`make_email_password_optional`, `add_server_background_url`, `add_server_visibility`, `add_report`, `add_notification`, `add_modpack_source`) et `production` a été avancée à `84a3300`. Reste : `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` à ajouter chez Vercel puis redéployer, sinon la connexion est cassée en ligne. Sans elles, toute lecture d'un serveur échouera en ligne, et la création d'un compte aussi (`email` et `passwordHash` y sont encore obligatoires).
- [ ] **Clé CurseForge personnelle** (console.curseforge.com) puis `CURSEFORGE_API_KEY` sur Vercel. Les deux clés « trouvées » ont été révoquées.
- [ ] **Launcher : Fabric et Quilt** ne sont pas gérés (message d'erreur clair pour l'instant) ; NeoForge et Forge fonctionnent.
- [ ] **Commit** : environ 28 fichiers modifiés ou nouveaux non commités depuis `d53e1ba` (modpacks, correctifs du launcher, `Legal/`). Rien n'est sur `master` tant que tu ne l'as pas demandé.
- [ ] Erreur ESLint préexistante dans `ServerForm.tsx` (`setOrigin` dans un `useEffect`).

---

*Rappel : les textes de `DOCUMENTS_LEGAUX_OMNISCIENT.md` sont une base de travail, pas un avis juridique.*
