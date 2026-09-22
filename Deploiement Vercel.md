# Déploiement — Plan (à relire avant de commencer)

Récapitulatif de toutes les décisions prises en discussion avant de lancer le vrai déploiement. À relire intégralement avant de commencer, pour ne pas repartir de zéro.

## Décisions prises

- **`mchub` (GitHub) reste privé, reste le dépôt de développement/tests.** Aucune donnée sensible n'y est exposée publiquement, mais il continue de recevoir tous les commits de dev normalement.
- **Un second dépôt GitHub, public, dédié uniquement aux Releases du launcher** (pas de code source dedans, juste les fichiers construits/`.exe` publiés en tant que Release taguée par version). Nécessaire car les Releases d'un repo privé ne sont pas téléchargeables publiquement.
- **Le projet Vercel s'appelle `omniscient`** (pas `mchub`) — le nom du projet Vercel est indépendant du nom du repo GitHub, aucun renommage de repo nécessaire. Le nom de produit affiché à l'utilisateur (installateur, raccourcis, etc.) sera toujours "Omniscient Launcher", jamais "mchub"/"launcher" (noms internes).
- **Séparation des branches pour la sécurité du déploiement** : la "Production Branch" de Vercel ne doit PAS être `master` directement — utiliser une branche dédiée (ex: `production`) ou promouvoir manuellement un déploiement preview vers la prod, pour qu'un commit de test sur `master` ne casse jamais le site/launcher en ligne.
- **Deux bases de données Prisma Postgres séparées** :
  - `mchub` (existante, région Europe/Paris) → reste la base de dev local **et** des déploiements Preview Vercel. Continue d'accumuler des données de test sans risque.
  - `omniscient-production` (à créer, même région) → base propre, vide, utilisée UNIQUEMENT par l'environnement **Production** de Vercel. Jamais touchée par les tests.
- **Installateur du launcher : approche "web installer" (nsis-web via electron-builder)**, pas un installateur autonome classique. Un seul petit stub `.exe` générique (quelques Mo) qui télécharge le reste au premier lancement, plutôt qu'un gros `.exe` autonome (~100 Mo) à rebuild par client.
  - Raison : permet la préconfiguration par client (voir ci-dessous) sans avoir à rebuild un binaire différent par client.
  - Permet aussi d'ajouter facilement la mise à jour automatique plus tard (`electron-updater`, typiquement via GitHub Releases).
- **Fonctionnalité premium (abonnement payant) — À CONCEVOIR SÉPARÉMENT, pas maintenant** : les clients avec un gros abonnement doivent pouvoir télécharger un `.exe` préconfiguré avec leur serveur/modpack. Idée de mécanisme : lien de téléchargement unique par serveur (ex: `site.com/download?server=xyz`, signé/expirable), le stub va chercher la config au premier lancement plutôt que d'avoir un binaire différent par client. À rattacher au système d'abonnements (déjà noté comme "en attente" sur la page admin serveur) plutôt que de le construire isolément.

## Points encore ouverts (à trancher avant/pendant le déploiement)

- [ ] **Nom de domaine** : le client en a-t-il déjà un, ou faut-il en acheter un via Vercel ?
- [ ] **Clé API CurseForge réelle** : celle actuellement dans `.env` n'est pas valide (testée, retourne 403 Forbidden — ressemble à un hash bcrypt collé par erreur, pas une vraie clé CurseForge). Nécessaire pour que la recherche de modpack fonctionne réellement (voir `site/src/lib/curseforge.ts`). **En cours de résolution.**
- [ ] **`LAUNCHER_API_KEY` partagée** : une fois le launcher distribué publiquement, cette clé sera embarquée dans chaque copie de l'app (extractible techniquement). Acceptable pour l'usage actuel (anti-scraping basique), à surveiller si la sécurité doit monter en exigence plus tard.
- [ ] **Signature de code pour l'installateur Windows** : sans certificat de signature, Windows SmartScreen affichera un avertissement au premier lancement de l'installateur. Pas bloquant pour démarrer, à prévoir si l'image "pro" devient importante.

## Checklist d'exécution (dans l'ordre, une fois prêt à vraiment déployer)

1. Créer la base `omniscient-production` (Prisma Postgres, région Europe/Paris) + appliquer le schéma actuel dessus (vide, pas de données).
2. Créer le projet Vercel lié au repo GitHub `mchub` (`rootDirectory: site`), nommé `omniscient`, avec la Production Branch configurée sur une branche dédiée (pas `master` directement).
3. Configurer les variables d'environnement sur Vercel :
   - Production : `DATABASE_URL` → `omniscient-production`, `AUTH_SECRET`, `LAUNCHER_API_KEY`, `CURSEFORGE_API_KEY` (la vraie, une fois obtenue).
   - Preview/Development : `DATABASE_URL` → `mchub` (base de dev existante), mêmes autres clés.
4. Premier déploiement, vérifier que ça build et que l'auth/DB fonctionnent (NextAuth détecte Vercel automatiquement, pas de config supplémentaire nécessaire côté `auth.ts`).
5. Créer le second dépôt GitHub public (releases uniquement) pour le launcher.
6. Configurer `electron-builder` dans `launcher/` avec la cible `nsis-web`, nom de produit "Omniscient Launcher".
7. Premier build + première Release publiée sur le second repo.
8. Page de téléchargement sur le site, qui pointe vers la dernière Release.
9. (Plus tard, hors de ce plan) : `electron-updater` pour les mises à jour automatiques ; système d'abonnement + préconfiguration par serveur pour les clients premium ; nom de domaine + certificat de signature de code si besoin.
