# Suivi du projet — Omniscient (MCHub)

Document vivant : décisions prises, ce qui est livré, ce qui reste ouvert, et les idées pour plus tard. À relire/mettre à jour à chaque étape importante plutôt que de repartir de zéro. Anciennement `Deploiement Vercel.md` — renommé car son contenu dépasse largement le déploiement initial.

_Dernière mise à jour : 2026-09-23 (backlog de l'audit terminé, thème clair du site, Discord Rich Presence)._

## 1. État actuel en un coup d'œil

- **Site** : en ligne sur `https://omniscient-theta.vercel.app`, projet Vercel `omniscient`, branche de production dédiée (`production`, jamais `master` directement — voir §2).
- **Launcher** : releases publiques sur `nono84250-sudo/omniscient-launcher` (v0.1.8 au moment de cette mise à jour), installeur web (`nsis-web`), mise à jour automatique silencieuse.
- **Dépôt de dev** : `nono84250-sudo/mchub` (privé) + sauvegarde miroir `nono84250-sudo/mchub-backup-20260921` + zips locaux (`D:\Claude Code\MCHub-backup-*.zip`).

## 2. Décisions de déploiement (prises, toujours valables)

- `mchub` (GitHub) reste privé, reste le dépôt de développement/tests.
- Second dépôt GitHub public `omniscient-launcher`, releases uniquement (pas de code source) — nécessaire car les Releases d'un repo privé ne sont pas téléchargeables publiquement.
- Projet Vercel nommé `omniscient` (indépendant du nom du repo GitHub). Nom produit toujours "Omniscient Launcher" côté utilisateur, jamais "mchub"/"launcher".
- **Séparation des branches** : la Production Branch Vercel est `production`, jamais `master` directement — un commit de test sur `master` ne casse jamais le site en ligne. Promotion = `git push origin master:production`, toujours une action explicite et confirmée, jamais automatique.
- Deux bases Prisma Postgres séparées : `mchub` (dev + Preview Vercel) et `omniscient-production` (Production uniquement, jamais touchée par les tests).
- Installateur du launcher : approche **web installer** (`nsis-web` via electron-builder) — un petit stub qui télécharge le reste au premier lancement, plutôt qu'un gros `.exe` autonome. Permet la mise à jour automatique et, plus tard, la préconfiguration par client sans rebuild.
- Fonctionnalité premium (préconfig par serveur) — toujours **à concevoir séparément**, voir §7.

## 3. Checklist d'exécution du déploiement — ✅ tout fait

1. ✅ Base `omniscient-production` créée + schéma appliqué.
2. ✅ Projet Vercel lié à `mchub` (`rootDirectory: site`), nommé `omniscient`, Production Branch = `production`.
3. ✅ Variables d'environnement configurées (Production → `omniscient-production` ; Preview/Development → `mchub`).
4. ✅ Premier déploiement vérifié (build, auth, DB).
5. ✅ Dépôt public `omniscient-launcher` créé.
6. ✅ `electron-builder` configuré (`nsis-web`, nom produit "Omniscient Launcher", nom d'artefact **sans espace** — voir §6, un bug de mise à jour auto est venu de là).
7. ✅ Premier build + première release publiée (v0.1.0 → v0.1.8 au 2026-09-23).
8. ✅ Page de téléchargement sur le site (`/download`), lien direct stable vers `releases/latest/download/...`, version/taille affichées en direct depuis l'API GitHub (cache court + invalidation à la demande après chaque publication).
9. ✅ `electron-updater` : mise à jour automatique **silencieuse** (voir §6 pour l'historique des bugs corrigés).
   - ⏳ Système d'abonnement + préconfiguration par serveur pour les clients premium — pas commencé, voir §7.
   - ⏳ Nom de domaine + certificat de signature de code — pas commencé, voir §5.

## 4. Fonctionnalités livrées depuis le déploiement initial

- **i18n complet FR/EN** — site (dictionnaires + `t()`/`getT()`) et launcher (`i18n.js`, dictionnaire propre) ; console de gestion, formulaire/assistant serveur, page Download, console de debug.
- **Migration icônes vers Phosphor** (`lucide-react` retiré) sur tout le site.
- **Nav du site restructurée** : logo + liens principaux à gauche (extensible), langue/connexion à droite.
- **Page Download publique** (`/download`) : détection d'OS côté serveur, cartes Windows/macOS/Linux (mac/Linux "Bientôt disponible", pas encore de build), version/taille en direct.
- **Launcher — installeur web** : stub `nsis-web` (~700 Ko) qui télécharge le paquet complet à l'installation ; nom d'artefact figé, sans espace, sans version (`OmniscientLauncherSetup.exe`) pour que le lien du site et la mise à jour auto restent toujours valides.
- **Launcher — mise à jour automatique silencieuse** (`electron-updater`) : plus d'installeur visible pendant une mise à jour, l'appli se relance seule. Deux bugs réels rencontrés et corrigés en cours de route (voir §6, utile si un symptôme similaire réapparaît).
- **Launcher — bootstrap nettoyé** : barre de titre épurée pendant le démarrage (statut Minecraft/notifications/réduire/fermer masqués, titre centré), plus de délai artificiel.
- **Launcher — console de debug** (fenêtre séparée, `Ctrl+Shift+D` ou Paramètres > Débogage) : logs launcher + Minecraft en direct (jeton d'accès toujours masqué), filtres, recherche, pause/copier/effacer, niveau de log, logs persistés sur disque, rapport de diagnostic, infos système, réparation/vidage du cache, réinitialisation des paramètres.
- **Correctif Java** : la détection exige désormais réellement Java 21 minimum (pas juste "présent + 64 bits") — un vieux Java 8 système faisait planter Minecraft 1.21+ au lancement sans que le launcher ne s'en rende compte.
- **Audit complet du 2026-09-23** (sécurité, qualité de code, UI/UX) + corrections — voir §6.
- **Thème clair du site** (harmonisé avec le launcher, sélecteur Système/Sombre/Clair dans la nav, persisté en `localStorage`) + tokens `--muted2`/`--warn` partagés entre les deux apps.
- **Discord Rich Presence** (`launcher/src/discordPresence.js`) : le launcher annonce sur Discord "Parcourt les serveurs" ou "Joue sur {serveur}" avec le logo Omniscient. Code livré et désactivé proprement tant que `DISCORD_CLIENT_ID` n'est pas configuré — **configuration manuelle restante côté Discord, voir §5**.

## 5. Points ouverts (à trancher)

- [ ] **Nom de domaine** : le client en a-t-il déjà un, ou faut-il en acheter un via Vercel ?
- [ ] **Clé API CurseForge réelle** : toujours invalide (testé à nouveau le 2026-09-23, l'API répond encore 403). Bloquant pour que la recherche de modpack fonctionne réellement (`site/src/lib/curseforge.ts`).
- [ ] **`LAUNCHER_API_KEY` partagée** : embarquée dans chaque copie de l'app (extractible techniquement). Acceptable pour l'usage actuel (anti-scraping basique), à surveiller si la sécurité doit monter en exigence.
- [ ] **Signature de code Windows** : sans certificat, SmartScreen avertit au premier lancement de l'installeur. Pas bloquant, à prévoir si l'image "pro" devient importante.
- [ ] **Builds macOS/Linux** : la page Download les affiche déjà ("Bientôt disponible") mais aucun build n'existe — seul Windows (`nsis-web`) est construit aujourd'hui.
- [ ] **Discord Rich Presence — configuration côté Discord** (code déjà livré, voir §4) : je ne peux pas créer l'application Discord ni uploader l'asset à la place de l'utilisateur, ça nécessite son propre compte Discord. Étapes restantes :
  1. Créer une application sur https://discord.com/developers/applications, la nommer **exactement** "Omniscient Launcher" (c'est ce nom-là, pas une valeur de code, qui s'affiche en gras dans Discord).
  2. Onglet "Rich Presence" > "Art Assets" : uploader `launcher/build/icon.png` comme asset, avec la clé exacte `omniscient_logo`.
  3. Copier l'Application ID (Client ID, onglet général) et le donner pour l'ajouter à `DISCORD_CLIENT_ID` dans `launcher/.env` avant le prochain build publié.

## 6. Backlog technique (issu de l'audit du 2026-09-23, pas corrigé volontairement)

Corrections déjà appliquées le jour même : fenêtre de connexion Microsoft sans `sandbox`, SSRF possible via le champ IP d'un serveur, comparaison non constante du secret launcher, nom de fichier externe non assaini, bouton "Effacer" de la console qui ne vidait pas le bon buffer, export mort avec commentaire trompeur ("mode test" disparu), pages Actualités/Notifications en français en dur, barre de titre dupliquée entre les 2 fenêtres du launcher, gestion d'erreur manquante sur les actions de la console de gestion, convention de bouton "plein" incohérente avec le reste du design system, sélecteur de langue inaccessible au clavier, contraste de texte insuffisant (`--muted`/`--muted2`, surtout en thème clair), unités de taille toujours en français, tokens de couleur dérivés désynchronisés entre site et launcher, rayons de bordure incohérents sur les cartes du site, et plusieurs petits exports/imports morts.

Tout le backlog mineur listé précédemment (nettoyage de `Design/`, thème clair du site, tokens `--muted2`/`--warn` partagés, largeur fixe de `ManageAvatarMenu`, libellés système non traduits) a été traité le 2026-09-23. Reste volontairement en suspens :
- [ ] Colonnes `discordUrl`/`websiteUrl` du modèle `Server` existent en base mais ne sont utilisées nulle part — cohérent avec les liens Discord/site en attente sur la page admin serveur (voir §7), à réutiliser plutôt qu'à dupliquer quand ce chantier démarrera.

## 7. Idées pour plus tard (fonctionnalités futures, rien commencé)

- **Système d'abonnement + launcher préconfiguré par serveur** (clients premium) : lien de téléchargement unique par serveur, signé/expirable, le stub va chercher sa config au premier lancement plutôt qu'un binaire différent par client. À rattacher au système d'abonnements ci-dessous plutôt qu'à construire isolément.
- **Panel administrateur plateforme** (site-wide, propriétaire + collaborateurs — distinct de la console "Gérer" par serveur, déjà livrée) : nécessite d'abord un champ `role`/`isAdmin` sur le modèle `User` (n'existe pas encore) avant de construire quoi que ce soit dessus. Couvrirait :
  - Modération/gestion des utilisateurs et serveurs à l'échelle du site.
  - Système de notifications réel (le bouton cloche existe déjà côté launcher et côté site `/dashboard/notifications`, mais rien ne peut encore être écrit dedans).
  - Page Actualités réelle (`/dashboard/news` existe, vide) — la maquette V3 du launcher (écran "Home", non construit) montre déjà à quoi pourrait ressembler la diffusion de ces actus côté joueur (bannière serveur en vedette, liste "populaires", flux d'actus).
- **Système d'amis** (phase 1 déjà scopée dans une session précédente) — nécessite une migration DB, prochaine priorité déclarée à un moment donné.
- **Chat et lobby** (phase 2/3, après le système d'amis) — les deux ont besoin d'une décision d'infra temps-réel partagée.
- **Page publique de serveur personnalisable** ("page builder") — probablement réservée aux abonnements payants.
- **Écran d'accueil du launcher** (maquette V3, "Home") : bannière serveur en vedette, liste de serveurs populaires, flux d'actualités — explicitement mis de côté pour l'instant, à reprendre en même temps que le panel admin puisque ce contenu serait de toute façon écrit par un admin.
