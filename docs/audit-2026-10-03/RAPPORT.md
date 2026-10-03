# Rapport d'audit et de corrections — 3 octobre 2026

Ce document résume l'audit de la page « Mes instances » (launcher + site), les failles de sécurité trouvées, et les corrections appliquées à la base `0652b17`. Il sert de spécification pour réappliquer ces changements à partir de `44e6d12` (version du 30 septembre).

## 1. Contexte

- Symptôme signalé par l'utilisateur : la page « Mes instances » affiche « Connecte-toi avec ton compte Minecraft… » alors que le compte est connecté et possède 17 serveurs.
- Première apparition : après la sauvegarde du 2 oct. à 22:32 (`a7dfe63`), pendant un test du lien profond.
- Le chemin de données (`servers:mine`, route site `servers/mine`, `launcherAuth.ts`, `public-servers.ts`) est identique entre `44e6d12` et `a7dfe63`. Le code ne peut donc pas expliquer seul l'apparition du bug.
- Les logs du site dev montrent des **500** sur `servers/mine` causés par des timeouts de connexion Prisma (`CONTRACT.MARKER_READ_FAILED`). L'ancien code affichait « Connecte-toi » pour **toute** erreur.
- Une base de dev saine + le code actuel = la page affiche la liste. Une base instable = erreur « Impossible de charger » (après correction).

## 2. Constats de l'audit (par domaine)

### 2.1 Bugs « Mes instances »
| # | Gravité | Constat | Fichier(s) |
|---|---|---|---|
| B1 | Haute | Toute erreur (500, réseau, Mojang) affichait « Connecte-toi » | `renderer.js` (renderMyInstancesList) |
| B2 | Haute | Erreur Mojang (429, 5xx, timeout) renvoyée comme 401 « Identité non vérifiée » | `launcherAuth.ts`, routes launcher |
| B3 | Haute (supposé) | Jeton Mojang jamais rafraîchi pendant une longue session | `main.js` (currentSession) |
| B4 | Moyenne | Délai de 8 s trop court pour une réponse lente du site | `main.js` (fetchJson) |
| B5 | Moyenne | Pas d'état de chargement ; ancien contenu conservé pendant la requête | `renderer.js` |
| B6 | Moyenne | Données d'un ancien compte non effacées au changement de compte | `renderer.js` |
| B7 | Moyenne | Serveurs rejoints supprimés localement sur n'importe quelle erreur | `main.js` (listJoined) |
| B8 | Moyenne | Saisie du code d'invitation perdue à chaque action (innerHTML complet) | `renderer.js` |
| B9 | Basse | Textes et messages d'erreur en français en dur ou techniques (« HTTP 500 ») | `main.js`, `i18n.js` |
| B10 | Basse | Sous-titre « Tous les serveurs que tu as créés » affiché aussi sur l'onglet Rejoint | `renderer.js`, `i18n.js` |
| B11 | Basse | `window.confirm` natif pour « Quitter » au lieu d'une modale du launcher | `renderer.js` |
| B12 | Basse | Accessibilité : bouton copier sans aria-label, erreurs sans `role="alert"` | `renderer.js`, `index.html` |

### 2.2 Failles de sécurité
| # | Gravité | Constat | Fichier(s) |
|---|---|---|---|
| S1 | Élevée | Serveurs **privés** exposés par slug : métadonnées, modpack, et **IP** (route launcher) — `getPublicServerBySlug` et `getServerWithIpBySlug` ne filtraient que `published:true` | `public-servers.ts`, routes `public/servers/[slug]`, `launcher/servers/[slug]` |
| S2 | Élevée | Clé `LAUNCHER_API_KEY` publique (embarquée dans l'installeur) : elle ne protège rien à elle seule | structure globale |
| S3 | Élevée | Limitation de débit contournable : lecture de la **première** valeur de `X-Forwarded-For` | `rateLimit.ts` |
| S4 | Élevée | Routes launcher **sans limite** (mine, [slug], modpack, curseforge/files) → quota CurseForge épuisable | routes launcher |
| S5 | Élevée | Injection HTML via `iconUrl` (non validée) et `escapeHtml` qui n'échappe pas les guillemets | `actions/servers.ts`, `renderer.js` |
| S6 | Moyenne | Pas de timeout sur l'appel Mojang ; pas de cache des refus | `launcherAuth.ts` |
| S7 | Moyenne | Invitation : espace de 32^5 codes ; limite par IP contournable via XFF | `join/[code]`, `rateLimit.ts` |
| S8 | Basse | `report/route.ts` : `request.json()` sans try/catch | `report/route.ts` |

## 3. Corrections appliquées (état de `0652b17` + travail d'audit)

Chaque correction a été préparée par deux agents dans des copies isolées ; la meilleure approche a été retenue et appliquée. Les notes données par les agents (sur 10) sont indiquées.

### 3.1 Serveurs privés (S1) — approche A retenue (note 7)
- **Règle** : un serveur privé est traité comme inexistant (404) sans preuve. Deux preuves valent : le **code d'invitation** (en-tête `X-Invite-Code`, comparé en temps constant) ou le **jeton Mojang du propriétaire** (en-tête `X-Minecraft-Token`, vérifié).
- `public-servers.ts` : `canSeeServer`, `proofFromRequest`, `limitInviteAttempts` (30/min/IP, seulement si un code est présenté). `getPublicServerBySlug` et `getServerWithIpBySlug` prennent une preuve.
- Routes `public/servers/[slug]`, `launcher/servers/[slug]` (IP), `launcher/servers/[slug]/modpack` : contrôle d'accès ajouté.
- `join/[code]/page.tsx` : affiche la fiche avec le code comme preuve, au lieu de rediriger vers `/servers/[slug]`.
- `components/ServerDetailView.tsx` (nouveau) : rendu de la fiche extrait de `servers/[slug]/page.tsx`. **JSX déclaré identique à l'original, à vérifier visuellement.**
- `actions/servers.ts` : `resetInviteCode` invalide le cache.
- Launcher : `joinedServers` garde `inviteCode` ; `joinServerByCode`, `listJoined`, `game:launch` et l'appel modpack envoient la preuve (`modpack.js` : `siteJson` accepte des en-têtes).
- **Conséquences** : les serveurs rejoints avant cette version n'ont pas de code enregistré et disparaissent jusqu'à une ressaisie. La fiche web `/servers/[slug]` d'un serveur privé répond 404. Régénérer le code révoque les anciens joueurs (voulu).

### 3.2 Limitation de débit (S3, S4) — approche A retenue (note 7)
- `rateLimit.ts` : IP cliente = `x-vercel-forwarded-for`, puis `x-real-ip`, puis le **dernier** élément de `x-forwarded-for`. Le premier n'est plus lu.
- Limite de 60/min par IP et par route sur : `servers/mine`, `servers/[slug]`, `servers/[slug]/modpack`, `curseforge/files`, `notifications/read`, `notifications/delete`, `notifications/clear-read`.
- Non modifiées : join (20/min), launch, report, notifications GET.
- **Limites connues** : compteur en mémoire par instance ; un attaquant distribué passe ; un LAN entier derrière une seule IP peut recevoir des 429 sur `curseforge/files` et `modpack`.

### 3.3 Injection HTML (S5) — note 8
- `actions/servers.ts` : `isSafeImageUrl()` refuse une bannière, une icône ou un fond qui n'est pas une URL `https://` absolue sans espaces, guillemets, chevrons, backticks ni antislash. Message d'erreur dédié.
- `renderer.js` : `escapeHtml` échappe `& < > " '` (table `HTML_ESCAPES`). `skinUrlFor` refuse une URL de peau qui sortirait de `url('…')`.
- **Cas limite** : un serveur ayant encore une image en `http://` ne peut plus être modifié tant que l'image n'est pas retirée.

### 3.4 Faux « Connecte-toi » (B1, B2, S6) — approche A retenue (note 8)
- `launcherAuth.ts` : `verifyMinecraftIdentity` renvoie `"verified" | "refused" | "unavailable"`. Timeout de 5 s sur l'appel Mojang. `identityErrorResponse()` construit 401 (refusé) ou 503 (indisponible).
- Routes `servers/mine`, `notifications`, `notifications/read|delete|clear-read`, `servers/[slug]/report` : 401 seulement si l'identité est refusée, 503 si Mojang est indisponible.
- Launcher : un 503 tombe sur « Impossible de charger tes serveurs » + Réessayer (déjà présent dans `0652b17`).
- **Compromis** : un Mojang plus lent que 5 s donne un 503 réessayable. Pas de cache négatif dans cette approche.

### 3.5 Session Minecraft (B3) — note 7
- `main.js` : drapeau `sessionRemembered` (posé si « se souvenir de moi »). Sur 401 du site, `withSessionRetry` tente **une** fois de rafraîchir la session via le refresh_token chiffré (`refreshSessionOnce`, `doRefreshSession`), avec déduplication des appels concurrents et cooldown de 5 min. Puis relance l'appel une seule fois.
- Appliqué à `servers:mine` et `notifications:list`.
- **Non couvert** : lancement du jeu (`mcLaunch`, `authorization`) et changements de skin utilisent encore le jeton stocké ; un jeton expiré y échoue toujours. **Trou restant le plus important.**

## 4. Non traité (volontairement)

- **Design / CSS / mise en page** : aucun changement demandé. Les points B9 à B12 ne sont pas corrigés.
- **Clé `LAUNCHER_API_KEY` publique (S2)** : pas de rotation ni de remplacement ; la protection repose désormais sur les preuves par route.
- **Quota CurseForge** : toujours épuisable à grande échelle par quiconque détient la clé publique.
- **`/api/launcher/servers/[slug]/launch`, `/report`, `/view`** : acceptent encore un slug privé (pas d'IP exposée, mais existence observable).
- **Compteur de limitation** : toujours en mémoire par instance (la règle Firewall Vercel reste à configurer).
- **Cache d'identité Mojang** : pas de cache négatif, un jeton révoqué reste accepté jusqu'à 5 min.
- **Lancement du jeu avec jeton expiré** (voir 3.5).

## 5. Points de décision restants

1. Les serveurs privés rejoints avant la mise à jour : accepter une ressaisie du code, ou migrer automatiquement ?
2. Fiche web d'un serveur privé pour le propriétaire : accepter le 404 (il garde `/manage`) ou ajouter une session web ?
3. Limite par IP de 60/min sur `curseforge/files` : suffisante, ou à baisser à 20/min ?

## 6. Vérifications effectuées

- `tsc --noEmit` (site) : propre après `next typegen`.
- `eslint` sur les fichiers touchés : propre.
- `node --check` sur les fichiers launcher touchés : propre.
- **Aucun test en conditions réelles** : pas de Mojang réel, pas de lancement du jeu, pas de test de la fiche privée dans le navigateur, pas de test de la saisie de code.

## 7. Ordre de réapplication conseillé (à partir de `44e6d12`)

1. Rafraîchissement de session (3.5) — launcher seul, `main.js`.
2. Limitation de débit (3.2) — `rateLimit.ts` puis routes.
3. Faux « Connecte-toi » (3.4) — `launcherAuth.ts` puis routes, avec le compromis documenté.
4. Injection HTML (3.3) — `actions/servers.ts` puis `renderer.js`.
5. Serveurs privés (3.1) — en dernier : le plus gros changement, il dépend des précédents.
6. Ensuite seulement : corrections d'interface de la section 2.1 (B5 à B12), hors design.

Le fichier `correctifs.patch` de ce dossier contient le diff exact par rapport à `0652b17`. Il sert de référence ; il ne s'applique pas tel quel sur `44e6d12`.
