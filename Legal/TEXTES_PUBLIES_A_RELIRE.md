# Textes publiés d'Omniscient, à relire par l'avocat

Version du 14 octobre 2026. Ce fichier reprend **mot pour mot** la politique de confidentialité et les conditions d'utilisation que le site affichera (`/confidentialite` et `/cgu`, en français). Il est généré à partir de `site/src/lib/legal.tsx`, la seule source des pages : si le texte change dans le code, il faut regénérer ce fichier. Il remplace, pour l'avocat, le brouillon `DOCUMENTS_LEGAUX_OMNISCIENT.md`, qui n'est plus à jour (droit français, CNIL, SIRET, abonnement).

Éditeur : Rushifa, personne physique. Droit applicable annoncé : droit belge, tribunaux belges, Autorité de protection des données belge.

## Questions pour l'avocat

Les textes publiés par le code (site/src/lib/legal.tsx, FR et EN) décrivent maintenant ce que fait le code. Ces points restent ouverts, aucun n'a été tranché :

1. Âge minimum : le texte dit 13 ans, accord parental avant 15 ans (règle française) dans des CGU sous droit belge. Aucun contrôle d'âge dans le code.
2. Mentions légales : pas de page dédiée, éditeur identifié par le pseudo « Rushifa » et un e-mail. Qu'est-ce qui est obligatoire en Belgique pour un projet personnel ?
3. Google (Gmail) et GitHub (Microsoft) ajoutés comme destinataires et comme transferts hors UE : base des transferts (Data Privacy Framework) à valider.
4. Empreinte de compte supprimé (SHA-256 de l'UUID Minecraft + date), gardée jusqu'au retour du joueur : intérêt légitime et durée acceptables ?
5. Présence Discord activée par défaut (interrupteur dans Paramètres, Divers) : faut-il un accord préalable ?
6. Présence en ligne (signal toutes les 60 s, visible des amis acceptés) non désactivable, sauf déconnexion.
7. Le brouillon Legal/DOCUMENTS_LEGAUX_OMNISCIENT.md parle encore de droit français, CNIL, SIRET et « Abonnement Pro » : à remplacer par les pages publiées avant de l'envoyer (audit T6).
8. Aucune acceptation des CGU à la création du compte ni à la publication d'un serveur (audit T8).
9. Case de consentement du formulaire de contact alors que la base légale annoncée est l'intérêt légitime : garder, retirer ou reformuler ?

---

# Politique de confidentialité (RGPD)

*Dernière mise à jour : 14 octobre 2026*

Omniscient est un **projet personnel et gratuit**, édité par Rushifa. Il n'existe pas encore de société. Ce texte est une **version provisoire** : il décrit honnêtement ce que font aujourd'hui le site et le launcher, et il sera complété et mis à jour (création d'une structure, nouvelles fonctions). Une question : [omniscient.launchermc@gmail.com](mailto:omniscient.launchermc@gmail.com).

## 1. Qui est responsable de vos données ?

Rushifa, éditeur d'Omniscient (personne physique, sans société à ce jour). Contact pour vos données : [omniscient.launchermc@gmail.com](mailto:omniscient.launchermc@gmail.com). Cette politique couvre le site omniscientlauncher.com, l'application Omniscient Launcher et leur API.

## 2. En bref

- Vous vous connectez **uniquement avec Microsoft**. Nous ne recevons ni votre e-mail, ni votre mot de passe, ni votre profil Microsoft : seulement votre **pseudo et votre identifiant Minecraft (UUID)**.
- Aucun outil de mesure d'audience fourni par un tiers, aucune publicité, aucun traceur. Nous comptons nous-mêmes, **sans cookie et sans savoir qui vous êtes**, les vues des fiches et les lancements de serveurs (voir 3).
- Nous ne vendons ni ne louons vos données.
- Si vous **publiez un serveur**, votre identifiant Minecraft (UUID) est public.
- Se connecter au **launcher** avec Microsoft crée automatiquement un compte Omniscient (pseudo et UUID), même sans passer par le site. Le launcher indique alors à vos amis si vous êtes en ligne (voir 3).

## 3. Les données que nous traitons

- **Compte** : pseudo et UUID Minecraft, identifiant interne, date de création ; cookie de session pour rester connecté. Il est créé à votre première connexion sur le site, ou automatiquement quand vous vous connectez au launcher avec Microsoft. But : faire fonctionner votre compte. Le pseudo est mis à jour à chaque connexion, à partir de votre profil Minecraft vérifié auprès de Mojang.
- **Présence en ligne** : tant que le launcher est ouvert et connecté, il nous envoie un signal toutes les 60 secondes avec votre identifiant Minecraft. Nous gardons seulement la date et l'heure du dernier signal. But : montrer à vos amis acceptés si vous êtes en ligne (dernier signal il y a moins de 2 minutes). Ce signal ne peut pas être coupé pour l'instant, sauf en vous déconnectant du launcher.
- **Amis** : les demandes d'ami (qui l'a envoyée, à qui, date, en attente ou acceptée). Une demande se fait par pseudo, depuis le site ou le launcher. La personne à qui vous envoyez une demande voit votre pseudo ; vos amis acceptés voient aussi votre identifiant Minecraft et si vous êtes en ligne. But : la liste d'amis. Vous pouvez refuser une demande ou retirer un ami à tout moment.
- **Serveurs suivis** : quand vous suivez un serveur dans le launcher, nous enregistrons votre identifiant Minecraft, le serveur, si vous voulez être prévenu de son retour en ligne et son dernier état connu (en ligne ou non). But : vous envoyer cette notification.
- **Fiches de serveurs (propriétaires)** : nom, description, adresse du serveur, version, modpack, liens, images envoyées depuis le formulaire. Les fiches publiques sont visibles de tous et l'UUID du propriétaire est fourni par l'API publique ; comme il permet de retrouver le pseudo, considérez que votre identité de joueur est publique si vous publiez un serveur.
- **Statistiques des fiches** : à chaque ouverture d'une fiche publique sur le site et à chaque lancement d'un serveur depuis le launcher, nous enregistrons le serveur concerné, le type d'événement (vue ou lancement), la date et l'heure, ainsi que les totaux. Ni adresse IP, ni identité, ni cookie. But : montrer ces chiffres au propriétaire (page « Activité »).
- **Nombre de joueurs en ligne** : le site interroge le serveur de jeu ; seule la dernière mesure est gardée.
- **Signalements** : pseudo et UUID de la personne qui signale, catégorie, message, lien de preuve éventuel, versions du jeu et du launcher, réponse du propriétaire. Un problème technique est transmis au propriétaire du serveur, qui voit votre pseudo, votre message et les versions. Un signalement de comportement ou de contenu n'est **jamais** transmis au propriétaire : seule l'équipe de modération d'Omniscient le voit.
- **Notifications** (cloche du launcher) : UUID du destinataire, nom du serveur, type, message.
- **Modération** : avertissements, blocage éventuel d'un compte (date, motif, auteur), historique des recours sur une fiche, notes internes de l'équipe (communiquées au joueur seulement s'il demande l'accès à ses données, après relecture pour protéger les autres personnes citées). But : appliquer les règles et traiter les recours.
- **Formulaire de contact et e-mails** : nom, adresse e-mail, sujet et message, pour vous répondre. Votre adresse IP sert seulement, en mémoire, à limiter l'envoi à 5 messages par heure.
- **Compte supprimé** : une empreinte (hachage SHA-256) de votre identifiant Minecraft et la date de suppression, rien d'autre. But : que le launcher ne recrée pas votre compte tout seul (voir 9).
- **Données techniques** : l'hébergeur du site (Vercel) enregistre automatiquement des données techniques, dont votre adresse IP, pour le fonctionnement et la sécurité. Nous utilisons aussi votre adresse IP, en mémoire et pendant quelques minutes seulement, pour limiter les envois abusifs.

## 4. Le launcher, sur votre ordinateur

- La **connexion Microsoft / Xbox / Minecraft** se fait directement entre votre ordinateur et Microsoft. Si vous choisissez « se souvenir de moi », un jeton de reconnexion est gardé sur votre ordinateur, chiffré par Windows.
- Pour prouver votre identité, le launcher transmet votre **jeton d'accès Minecraft** à nos serveurs, qui le présentent à Mojang puis le gardent **en mémoire au plus 5 minutes**, sans l'enregistrer.
- Vos paramètres, favoris, derniers serveurs joués et journaux **restent sur votre ordinateur** et ne nous sont pas transmis. Les journaux (un fichier par jour) y restent jusqu'à ce que vous les effaciez.
- **Discord** : si Discord est ouvert sur votre ordinateur, le launcher y affiche « Joue à Omniscient Launcher », avec en dessous « Parcourt les serveurs », ou le nom du serveur que vous avez rejoint et celui de son modpack. Pour un serveur privé, il affiche seulement « Joue sur un serveur privé », sans nom ni modpack. Cela passe par votre application Discord et devient visible sur votre profil Discord, selon vos réglages Discord (« Partager mon activité »). Rien n'est transmis à Omniscient. Vous pouvez tout couper dans le launcher : Paramètres, Divers, « Afficher mon activité sur Discord » (activé par défaut).
- Le launcher contacte directement des services tiers, qui voient votre adresse IP : Mojang, les dépôts des chargeurs de mods, CurseForge et Modrinth (modpacks), Eclipse Adoptium (Java), GitHub (vérification de mise à jour à chaque démarrage), les services dont il affiche l'état et Cloudflare si vous lancez le test de débit.
- Quand vous rejoignez un serveur de jeu, celui-ci voit votre pseudo et votre adresse IP.

## 5. Pourquoi nous avons le droit de les traiter

- **Exécution du service** que vous utilisez (conditions d'utilisation) : compte, fiches, signalements, notifications, connexion du launcher, amis, présence en ligne, serveurs suivis.
- **Intérêt légitime** : statistiques anonymes des fiches, sécurité et lutte contre les abus, modération, données techniques d'hébergement, réponse à vos messages, respect de votre demande de suppression (empreinte du compte supprimé).
- **Obligation légale** : réponse aux demandes des autorités.

## 6. Combien de temps

- Compte, modération, notifications, amis et présence en ligne : tant que le compte existe ; effacés quand vous le supprimez (voir 9). Un ami retiré ou une demande refusée est effacé tout de suite.
- Serveurs suivis : jusqu'à ce que vous arrêtiez de suivre le serveur, que sa fiche soit supprimée ou que vous supprimiez votre compte.
- Empreinte d'un compte supprimé : jusqu'à ce que vous reveniez sur Omniscient (voir 9).
- Fiche, ses statistiques et ses signalements : tant que la fiche existe ; supprimés avec elle ou avec le compte. Vous pouvez supprimer vous-même vos notifications dans le launcher.
- Cookie de session : jusqu'à 30 jours.
- Messages de contact : jusqu'à leur suppression par nous ou à votre demande.
- Données techniques de l'hébergeur : selon sa propre politique.

## 7. Qui reçoit vos données

- **Vercel Inc.** : hébergement du site et de l'API (fonctions exécutées à Paris).
- **Cloudflare, Inc.** : base de données, stockage des images et tâches planifiées.
- **Microsoft** (Xbox Live, Minecraft) : connexion, en tant que responsable distinct de votre compte Microsoft.
- **Google** (Gmail) : réception et envoi des e-mails échangés avec nous, dont les réponses au formulaire de contact.
- **GitHub** (Microsoft) : hébergement des versions du launcher ; voit votre adresse IP quand le launcher vérifie ou télécharge une mise à jour.
- Les propriétaires de serveurs, pour les signalements techniques qui les concernent.
- Vos amis acceptés, pour votre identifiant Minecraft et votre présence en ligne.
- L'équipe de modération d'Omniscient.
- Les autorités, sur demande légale.

## 8. Transferts hors de l'Union européenne

Vercel, Cloudflare, Google et GitHub sont des sociétés américaines : l'accès de leurs équipes ou l'acheminement du trafic peut impliquer les États-Unis. Ces transferts sont encadrés par les garanties de ces prestataires (Data Privacy Framework UE–États-Unis et clauses contractuelles types).

## 9. Vos droits

Vous pouvez demander l'accès à vos données, leur rectification, leur effacement (dont la suppression de votre compte), la limitation du traitement, vous opposer à un traitement fondé sur l'intérêt légitime, demander la portabilité de vos données et donner des directives pour après votre décès.

Écrivez à [omniscient.launchermc@gmail.com](mailto:omniscient.launchermc@gmail.com) (objet « Données personnelles ») ou utilisez le [formulaire de contact](https://omniscientlauncher.com/contact). Nous pouvons vous demander de prouver que le compte est bien le vôtre. Réponse sous un mois. Pour une demande d'accès, nous vous envoyons par e-mail un résumé lisible et un fichier complet (JSON) : votre compte, vos fiches, les signalements envoyés et reçus (sans l'identité de leurs auteurs), vos notifications, avertissements, amis, dernière présence en ligne et serveurs suivis, et, après relecture, les notes de l'équipe vous concernant. Vos messages envoyés par le formulaire de contact sont ajoutés seulement si la demande vient de la même adresse e-mail. N'y figurent jamais : les jetons de connexion, les codes d'invitation des serveurs privés, l'identité des personnes qui ont signalé vos serveurs, ni les noms de connexion de l'équipe. Vous pouvez aussi saisir l'Autorité de protection des données belge (www.autoriteprotectiondonnees.be), ou l'autorité de protection des données de votre pays (en France, la CNIL).

**Supprimer votre compte vous-même** : connectez-vous sur le site, puis Tableau de bord, Paramètres, « Supprimer mon compte » (il faut retaper « supprimer » pour confirmer). C'est immédiat et définitif : votre compte, vos fiches de serveurs (avec leurs images, statistiques et signalements reçus), vos notifications, vos amis, votre présence en ligne, les serveurs que vous suiviez, vos avertissements et notes de modération sont effacés. Restent seulement, liés à votre identifiant Minecraft, les signalements que vous avez déposés sur les fiches d'autres propriétaires, jusqu'à la suppression de ces fiches : pour les faire effacer aussi, écrivez-nous. Vous pouvez aussi demander la suppression par e-mail à [omniscient.launchermc@gmail.com](mailto:omniscient.launchermc@gmail.com). Si le launcher était connecté, il vous déconnecte dans la minute et ne recrée pas votre compte tout seul : pour cela, nous gardons seulement une empreinte (hachage SHA-256) de votre identifiant Minecraft et la date de suppression. Un nouveau compte n'est créé que si vous vous reconnectez avec Microsoft, sur le site ou dans le launcher, ou si vous envoyez une demande d'ami depuis le launcher ; l'empreinte est alors effacée.

## 10. Mineurs

Omniscient est ouvert à partir de 13 ans ; avant 15 ans, l'accord d'un parent est nécessaire. Si vous pensez qu'un enfant de moins de 13 ans nous a transmis des données, écrivez-nous : nous les supprimerons.

## 11. Sécurité

Connexion chiffrée (HTTPS), aucun mot de passe stocké, jetons du launcher chiffrés sur votre ordinateur, accès aux données limité. Aucun système n'est infaillible : en cas de fuite présentant un risque, nous préviendrons l'Autorité de protection des données et, si nécessaire, les personnes concernées.

## 12. Cookies et stockage local

Le site n'utilise que des éléments nécessaires à son fonctionnement ; aucun consentement n'est donc demandé.

- Cookie de session (connexion) : jusqu'à 30 jours.
- Cookies techniques de connexion Microsoft (sécurité de la connexion) : quelques minutes.
- « NEXT_LOCALE » (langue choisie) : 1 an.
- « theme » (thème clair ou sombre, stockage local du navigateur) : jusqu'à ce que vous l'effaciez.

Le comptage des vues des fiches n'utilise aucun cookie ni aucun stockage sur votre appareil.

## 13. Modifications

Cette politique sera mise à jour, notamment à l'ajout de nouvelles fonctions. La date figure en haut de la page. Voir aussi les [conditions d'utilisation](https://omniscientlauncher.com/cgu).

# Conditions générales d'utilisation (CGU)

*Dernière mise à jour : 14 octobre 2026*

Omniscient est un **projet personnel et gratuit**, édité par Rushifa. Il n'existe pas encore de société. Ce texte est une **version provisoire** : il décrit honnêtement ce que font aujourd'hui le site et le launcher, et il sera complété et mis à jour (création d'une structure, nouvelles fonctions). Une question : [omniscient.launchermc@gmail.com](mailto:omniscient.launchermc@gmail.com).

## 1. Objet

Omniscient est un annuaire de serveurs Minecraft (le site omniscientlauncher.com) et une application pour les rejoindre (Omniscient Launcher). En utilisant le site ou le launcher, vous acceptez ces conditions.

## 2. Un service gratuit

Omniscient est **gratuit** pour le moment ; aucune offre payante n'existe. Si des offres payantes apparaissent un jour, elles auront leurs propres conditions, que vous devrez accepter séparément.

## 3. Qui édite Omniscient

Omniscient est un projet personnel de Rushifa, sans société à ce jour. Contact : [omniscient.launchermc@gmail.com](mailto:omniscient.launchermc@gmail.com). Le site est hébergé par Vercel Inc. (440 N Barranca Avenue \#4133, Covina, CA 91723, États-Unis) et ses données par Cloudflare, Inc. (101 Townsend Street, San Francisco, CA 94107, États-Unis).

## 4. Pas un produit officiel Minecraft

Omniscient n'est pas un produit officiel Minecraft. Il n'est ni approuvé par Mojang ou Microsoft, ni associé à eux. « Minecraft » est une marque de Mojang AB. Pour jouer, vous devez posséder un compte Minecraft légitime et respecter les conditions de Mojang et Microsoft.

## 5. Omniscient n'exploite pas les serveurs listés

Les serveurs de jeu appartiennent à leurs propriétaires, qui sont seuls responsables de leur serveur, de ses règles, de son contenu et des sanctions en jeu. Omniscient se contente de les présenter et de vous aider à les rejoindre.

## 6. Votre compte

La connexion se fait avec votre compte Microsoft. Omniscient est ouvert à partir de 13 ans ; avant 15 ans, l'accord d'un parent est nécessaire. Vous êtes responsable de ce qui est fait avec votre compte.

## 7. Ce qui est interdit

- publier un contenu illégal, haineux, violent, sexuel impliquant des mineurs, ou qui harcèle quelqu'un ;
- arnaquer, hameçonner, diffuser un logiciel malveillant ou tromper les joueurs (fiche mensongère) ;
- usurper l'identité d'une personne ou d'un serveur ;
- utiliser des textes ou images sans en avoir le droit ;
- envoyer des demandes d'amis en masse ou à quelqu'un qui les refuse ;
- abuser des signalements, contourner la sécurité ou surcharger le service ou son API.

## 8. Fiches de serveurs

Si vous publiez un serveur, vous garantissez que les informations sont exactes et que vous avez le droit d'utiliser les textes et images envoyés. Vous gardez vos droits sur ce contenu et autorisez Omniscient à l'afficher gratuitement sur le site et dans le launcher tant que la fiche existe.

## 9. Modération

En cas de non-respect de ces règles, Omniscient peut retirer ou masquer une fiche, envoyer un avertissement, geler un serveur ou bloquer un compte. Le propriétaire concerné est informé du motif et peut faire un recours. Vous pouvez signaler un problème depuis le launcher, ou un contenu illicite par e-mail à [omniscient.launchermc@gmail.com](mailto:omniscient.launchermc@gmail.com) ou via le [formulaire de contact](https://omniscientlauncher.com/contact).

## 10. Le launcher

Le launcher installe le jeu, Java et, si besoin, les mods et modpacks téléchargés depuis des services tiers (Mojang, CurseForge, Modrinth…). Il est fourni tel quel, sans garantie de compatibilité avec chaque configuration.

Se connecter au launcher crée votre compte Omniscient s'il n'existe pas. Le launcher propose des amis : une demande doit être acceptée par l'autre joueur, et seuls vos amis acceptés voient si vous êtes en ligne. Vous pouvez refuser une demande ou retirer un ami à tout moment. Il peut aussi afficher votre activité sur Discord, ce que vous pouvez couper dans Paramètres, Divers.

## 11. Responsabilité

Omniscient est fourni gratuitement, tel quel, sans garantie de disponibilité continue. Dans les limites permises par la loi, Omniscient n'est pas responsable des serveurs de jeu, de leur contenu, ni des services tiers.

## 12. Arrêt et suppression du compte

Vous pouvez arrêter d'utiliser Omniscient à tout moment. Omniscient peut fermer un compte qui ne respecte pas ces conditions.

**Supprimer votre compte vous-même** : connectez-vous sur le site, puis Tableau de bord, Paramètres, « Supprimer mon compte » (il faut retaper « supprimer » pour confirmer). C'est immédiat et définitif : votre compte, vos fiches de serveurs (avec leurs images, statistiques et signalements reçus), vos notifications, vos amis, votre présence en ligne, les serveurs que vous suiviez, vos avertissements et notes de modération sont effacés. Restent seulement, liés à votre identifiant Minecraft, les signalements que vous avez déposés sur les fiches d'autres propriétaires, jusqu'à la suppression de ces fiches : pour les faire effacer aussi, écrivez-nous. Vous pouvez aussi demander la suppression par e-mail à [omniscient.launchermc@gmail.com](mailto:omniscient.launchermc@gmail.com). Si le launcher était connecté, il vous déconnecte dans la minute et ne recrée pas votre compte tout seul : pour cela, nous gardons seulement une empreinte (hachage SHA-256) de votre identifiant Minecraft et la date de suppression. Un nouveau compte n'est créé que si vous vous reconnectez avec Microsoft, sur le site ou dans le launcher, ou si vous envoyez une demande d'ami depuis le launcher ; l'empreinte est alors effacée.

## 13. Données personnelles

Voir la [politique de confidentialité (RGPD)](https://omniscientlauncher.com/confidentialite).

## 14. Modifications et droit applicable

Ces conditions seront mises à jour ; la date figure en haut de la page. Elles sont soumises au droit belge. En cas de désaccord, écrivez-nous d'abord : nous chercherons une solution amiable. À défaut, les tribunaux belges sont compétents. Si vous êtes un consommateur, vous gardez les droits protecteurs de la loi de votre pays et pouvez saisir les tribunaux de chez vous.
