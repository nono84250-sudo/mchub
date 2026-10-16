# Brainstorm écosystème Omniscient — 10-11 octobre 2026

> **Reconstruit le 2026-10-16** à partir du transcript brut de la session Claude Code `97be0507-a298-4799-a8c6-84c6e56d0ea6` (messages vocaux dictés, parfois déformés par la reconnaissance vocale — interprétés selon le contexte : "Modrine"/"mode line" = Modrinth, "mot de passe"/"mode pack" = modpack, "cure forge"/"curforge" = CurseForge).
>
> Cette discussion n'avait jamais été écrite nulle part — ni dans `SUIVI_PROJET.md`, ni dans une mémoire dédiée. Ce document est une **reconstruction factuelle d'un brainstorm/débat**, pas un compte-rendu de décisions produit. **Rien ici n'est implémenté**, sauf les points explicitement marqués **« DÉCIDÉ le 2026-10-11 »** dans la partie B, qui correspondent à des changements réellement appliqués dans le launcher ce soir-là (confirmés par les messages de test qui suivent dans le transcript).

---

## A. Brainstorm "égaler/dépasser Modrinth et CurseForge" (10-11 octobre, soir → matin)

### A.1 — Les 4 axes proposés (brainstorm initial, rédigé par une autre IA et collé par l'utilisateur, 2026-10-10 23:33)

L'utilisateur a soumis un texte préparé en dehors de la session, présenté comme pure réflexion ("tu dois rien coder"), proposant 4 axes pour une appli qui corrigerait les faiblesses de Modrinth et dépasserait CurseForge :

**1. Interopérabilité et recherche multi-source**
- Problème identifié : le launcher officiel Modrinth ne cherche/installe que son propre contenu ; l'utilisateur doit repasser sur CurseForge dès qu'un mod manque.
- Piste : philosophie multi-source façon Prism Launcher — chercher/installer depuis Modrinth, CurseForge, GitHub ou des archives locales dans un même profil, avec résolution automatique des dépendances inter-plateformes (si un mod Modrinth dépend d'une lib uniquement sur CurseForge, la télécharger automatiquement sans bloquer l'utilisateur).

**2. Outils d'instance et diagnostic avancés**
- Détecteur de conflits + analyseur de crash-log en direct, surlignant le mod fautif avec résolution en un clic (désactiver/mettre à jour/rétrograder).
- Gestion granulaire de Java et des arguments JVM par profil (RAM, flags GC).
- Changer de loader/version Minecraft à la volée sans recréer l'instance.

**3. Multijoueur "plug & play"**
- Tunnel P2P/UPnP natif façon mod Essential, pour inviter des amis sur un monde solo sans louer de serveur ni passer par un mod payant tiers.
- Sync automatique du modpack côté client quand l'administrateur d'un serveur change la liste des mods, pour éviter les erreurs "Mod mismatch".

**4. Découverte et rémunération pour les créateurs**
- Moteur de recherche par fonctionnalité réelle (ex. "Adds Performance", "No Client-Side Dependency") plutôt que par catégorie générique.
- Distribution de revenus transparente et vérifiable (piste Web3/Open-Collective évoquée) — créateurs touchant 100 % des dons/revenus publicitaires.

Le brainstorm original incluait aussi un tableau comparatif CurseForge / Modrinth App / "App idéale" sur 4 critères (multi-source, analyseur de crash, partage P2P, légèreté — avec une mention optimisation "C++/Rust/Tauri" pour l'app idéale).

### A.2 — Affinage : modpacks multi-source sur le système d'Omniscient (23:37–10:46, nuit du 10 au 11 + matinée du 11)

Plusieurs échanges ont précisé l'idée au-delà du brainstorm générique :

- **Idée centrale** : permettre de créer un modpack directement sur le système d'Omniscient en piochant des mods à la fois sur Modrinth et sur CurseForge (plus des fichiers uploadés par l'utilisateur), au lieu de se limiter à une seule source comme c'est le cas aujourd'hui (actuellement : serveur Vanilla, serveur lié à un modpack CurseForge qui "ne fonctionne pas pour le moment", ou serveur lié à un modpack Modrinth qui fonctionne).
- **Argument de légalité avancé par l'utilisateur** : de nombreux sites proposent déjà des "créateurs de launcher" permettant d'y mettre ses propres mods téléchargés, avec une simple clause "je ne suis pas responsable de ce que vous faites" — pratique qui existerait "depuis des années" selon lui (exemple cité : un site de type luxcraft.fr/.com, "système de créateur de launcher personnalisé" qui stocke les mods sur son propre site, supprimés si l'abonnement du propriétaire s'arrête).
- **Observation technique** : CurseForge et Modrinth hébergent déjà, dans les faits, des fichiers croisés quand un modpack mélange les deux sources (l'utilisateur affirme l'avoir constaté lui-même : un mod absent de Modrinth, ajouté via CurseForge dans un modpack Modrinth, finit stocké sur les serveurs Modrinth une fois le pack partagé).
- **Confirmation API** : l'accès en lecture à Modrinth ne nécessite pas de clé API ("on peut tout accéder sans API"), y compris modpacks, resource packs ; question ouverte sur les data packs (pas de réponse tranchée trouvée dans le transcript).
- **Référence Essential/P2P** : l'utilisateur relie le tunneling P2P (axe 3) au mod Essential, et avance que "ceux qui ont fait le mode Essentiel, ils ont racheté le mode RIN" — **affirmation non vérifiée dans le transcript**, à prendre comme une spéculation orale de l'utilisateur plutôt qu'un fait établi (le texte dicté est ambigu, probablement une déformation vocale ; aucune source n'a été cherchée côté assistant à ce moment-là).
- **Référence directe au launcher CurseForge/Modrinth mixte** : l'utilisateur note qu'un launcher tiers existant permettrait déjà la création de modpacks personnalisés mélangeant CurseForge et Modrinth.
- **Important — nuance apportée bien plus tard dans la session (vers 14:19, voir partie B)** : il s'avère que Modrinth a réellement tenté une forme proche de cette idée (son format de modpack pouvait référencer des fichiers hébergés sur le CDN CurseForge pour éviter de tout ré-uploader) — Overwolf/CurseForge a envoyé un courrier exigeant la suppression de ces références, et Modrinth a obtempéré. C'est un précédent légal direct et concret contre l'idée "modpack mélangé Modrinth+CurseForge hébergé chez soi" de la partie A — **ce risque n'a pas été retranché, juste documenté** (voir §B.5).

### A.3 — Comparatif détaillé de l'appli Modrinth (vers 10:17–10:46, puis via enregistrement vidéo analysé "frame par frame")

L'utilisateur a d'abord décrit de mémoire l'interface Modrinth, puis — jugeant cette description insuffisante — a enregistré une vidéo de l'appli Modrinth pour que l'assistant l'analyse frame par frame (traité séparément via le skill `watch-media`, hors périmètre de ce document).

**Ce qu'il a aimé / remarqué chez Modrinth (app + site) :**
- La page serveur publique Modrinth (exemple cité : `modrinth.com/server/donutsmp`) jugée "vachement plus jolie" que les pages serveur d'Omniscient — idées à reprendre : afficher la langue du serveur, des liens réseaux sociaux, des tags (idée déjà eue par ailleurs).
- Sidebar gauche de l'app : Home, raccourci "Jump in" vers les parties récentes/installées en un clic, création de groupes, création d'instance (soit depuis un mod/modpack choisi, soit "custom setup" en partant d'un fichier `.mrpack` ou en import direct depuis une instance Prism/CurseForge existante en récupérant le chemin des fichiers).
- Section "Discover Content" : modpacks, mods, resource packs, data packs, shaders, serveurs — jugée bien plus soignée visuellement que l'équivalent Omniscient ("c'est beau, mais c'est pas ça, quoi").
- Sélecteur de skin en 3D avec skins pré-enregistrés (dont des skins MineCon 2017, "Builder Biome"), choix de cape, bouton "save skin".
- Écran "Screenshots" — jugé par l'utilisateur lui-même "un peu nul" / "ça sert à rien".
- "Modrinth Hosting" : achat d'un serveur directement depuis l'app, avec panel de gestion intégré dans l'appli elle-même.
- Paramètres : thèmes de couleur avec mini-aperçus, système de langue avec barres de pourcentage de traduction par langue (jugé "pas mal, marrant"), gestion de compte, "advanced system".
- **Installation Java jugée mauvaise** : "le système d'installation de Modrinth, il est pourri... il bug une fois sur deux."
- Stockage du contenu ("Content storage") — mentionné sans avis tranché.

**Verdict de l'utilisateur à ce stade** : "Elle est jolie, la nôtre, mais je sais pas comment expliquer. On dirait que [Modrinth] ça ressort mieux." → décision de filmer l'app Modrinth pour que l'assistant en fasse une analyse frame par frame afin d'en déduire la recette visuelle (palette, hiérarchie, contrastes) à appliquer à Omniscient. Cette analyse a ensuite nourri, plus tard dans la session, une série d'agents de critique design comparant littéralement les deux interfaces (contraste des boutons d'action, graisse typographique unique, cartes sans élévation, etc. — travail de design, pas du brainstorm, donc hors périmètre détaillé de ce document, mais il découle directement de cette décision).

---

## B. L'audit à 18 agents (11 octobre, ~14:16–14:46 puis suites)

### B.0 — Contexte et déclencheur

Après une série de corrections de code et une première comparaison visuelle Omniscient/Modrinth (via 3 agents de critique design sur des personas joueur/power-user/designer UI), l'utilisateur a demandé une critique objective plus poussée : *"Utilise des agents, explique-leur le projet et demande-leur de juger de manière objective l'application et s'ils ont des idées pour améliorer le projet."* Un premier lot de 3 agents (persona joueur potentiel, persona propriétaire de serveur potentiel, analyste produit/marché) a d'abord travaillé sur un document de pitch complet (`omniscient_pitch.html`, généré pour l'occasion, décrivant le produit tel que construit + les fonctionnalités prévues comme le "pack curé"/"pack ami").

Jugeant les premiers retours "pas assez" détaillés, l'utilisateur a explicitement demandé d'aller plus loin : *"tu peux utiliser une vingtaine d'agents... j'aimerais bien vraiment plus d'infos."* Un deuxième lot de **15 agents supplémentaires** a suivi, pour un total de **18 agents** (3 + 15), chacun avec un angle imposé et consigne de ne pas édulcorer.

### B.1 — Les 18 agents et leurs angles

**Premier lot (critique "objective", personas) :**
1. **Joueur potentiel** — accrocherait sur un launcher qui installe automatiquement le bon modpack/version/RAM en un clic (sa vraie galère actuelle), mais pas pour un petit serveur vanilla entre amis où Discord suffit déjà. Point convaincant : connexion par vrai compte Microsoft (anti-usurpation). Point risqué : projet mono-développeur, si Omniscient meurt dans 8 mois le joueur perd l'accès à ses serveurs.
2. **Propriétaire de serveur potentiel** — irait jusqu'au bout du parcours (déclaration + test de connexion + vérification humaine) mais "pas de gaieté de cœur" ; attendre une décision humaine d'une équipe inconnue sans délai annoncé est le point de friction. Meilleur argument : installation automatique du modpack (la moitié des joueurs abandonnent aujourd'hui avant d'avoir correctement installé CurseForge). Plus gros risque : un annuaire sans trafic organique ne vaut rien, peu importe ses fonctionnalités.
3. **Analyste produit/marché** — vraie différenciation face à CurseForge/Modrinth (qui n'ont ni annuaire communautaire, ni couche de confiance, ni outillage de modération — pas leur métier). Mais le test de connexion avant/après ne garantit la fiabilité qu'à l'instant T, pas en continu ; un propriétaire malhonnête peut rester honnête le temps de passer la vérification puis changer de comportement après. Risque n°1 signalé : problème de l'œuf et la poule, aggravé par la friction d'installation d'un launcher tiers.

**Deuxième lot (critiques approfondies, 15 agents) :**
4. **Moat concurrentiel** — "bonne idée mais fragile". CurseForge/Modrinth pourraient neutraliser Omniscient en ajoutant un simple onglet "serveurs" à leur app existante (déjà des millions d'installations actives) ; ce qui les retient aujourd'hui n'est pas une barrière technique mais une absence d'incitation business. Un bot Discord pourrait déjà copier 80 % de la valeur "annuaire + statut" (commodité déjà gratuite) ; ce qu'il ne peut pas copier, c'est l'automatisation côté client (install modpack/Java) et le test de connexion réel.
5. **Scepticisme monétisation** *(cf. détail complet en §B.2)*.
6. **Réalité de taille de marché** — le segment réellement adressable est "une niche dans une niche" (quelques milliers de serveurs dans le monde, pas des dizaines de milliers) ; les 100M+ joueurs Minecraft ne se traduisent pas en demande pour ce produit précis.
7. **Problème de démarrage à froid** *(cf. détail complet en §B.3)*.
8. **Risque légal et dépendance API** — l'auto-installation (l'argument n°1 du pitch) dépend de deux API tierces (CurseForge/Overwolf, Modrinth) non contractuelles, avec un historique de tensions (clés révoquées, usages commerciaux restreints sans préavis — une clé "trouvée" avait déjà été révoquée une fois sur ce projet). Pire encore côté Microsoft/Mojang : c'est l'identité elle-même du système de confiance qui en dépend.
9. **Red-team du système de confiance** — le test anti-fraude est cassable à plusieurs niveaux : un ami qui se connecte 10 secondes au bon moment, un second compte Microsoft du propriétaire, des alts premium low-cost scriptés, ou pire, une falsification directe de la réponse de statut du serveur (le propriétaire contrôle entièrement son serveur/plugin/proxy).
10. **Refonte de la confiance continue** — un badge "vérifié" qui ne vaut que pour l'instant T est "une faille de confiance à corriger avant tout lancement, pas un détail à reporter". Proposition concrète : re-ping passif automatique toutes les 24-48h, re-test actif hebdomadaire ou déclenché par événement, badge "vérifié il y a Xj" dégradé progressivement (vert <7j, orange 7-30j, grisé >30j), jamais de coupure immédiate.
11. **Réalité du scope solo-dev** — le produit déjà livré montre du "scope creep" : panel admin à 7 sous-sections, deux circuits de signalement séparés, file de vérification humaine, cloche de notifications temps-réel, canal bêta, présence Discord, écran de maintenance — niveau de polish d'un produit qui a déjà une communauté à modérer, alors que le problème n°1 (zéro serveur, zéro joueur) n'est pas encore résolu.
12. **Devil's advocate priorisation de fonctionnalités** *(cf. détail en §B.4, arbitrage installeur vs amis)*.
13. **Rétention et churn** — une fois le modpack installé et le serveur rejoint, rien ne donne de raison concrète de rouvrir le launcher plutôt que Minecraft directement ; risque d'usage jetable. Le système d'amis est identifié comme le bon levier de rétention (contrairement à l'annuaire/fiche qui n'a de valeur qu'à la découverte).
14. **Friction d'onboarding, parcours pas-à-pas** *(cf. détail en §B.5, Java/RAM trop tôt)*.
15. **Meilleur argument pour (bull case)** — le projet vaut la peine de continuer : l'exécution déjà livrée (annuaire filtrable, statut en direct, auth Microsoft/Xbox donc zéro faux compte possible par construction, verrouillage immédiat site+launcher, deux circuits de signalement séparés, panel admin à 7 briques, gestion Java auto, canal bêta) est une profondeur de produit que Modrinth/CurseForge n'ont aucune raison de construire — leur métier est la distribution de contenu, pas la fiabilité d'un serveur précis. Angle mort structurel durable, pas une fenêtre qui se refermera.
16. **Précédents de marché analogues** — FTB/Technic ont prouvé que "launcher dédié + modpacks curés" fonctionne, avant d'être absorbés/marginalisés par la consolidation CurseForge (rachat Twitch puis Overwolf). Modrinth est le seul "succès modeste" du lot, né d'un événement de confiance précis (voir §B.6) et non construit depuis zéro par pure volonté produit. Les annuaires de serveurs classiques (minecraftservers.org, minecraft-mp.com) survivent commercialement depuis 15 ans sans jamais résoudre le vote-manipulation — preuve que ce n'est pas la confiance qui fait vivre un annuaire, c'est le trafic.
17. **Pire argument contre (bear case)** — "le projet a besoin d'un pivot sérieux" : tout le capital d'ingénierie est parti dans une infrastructure de confiance/modération taillée pour une échelle qui n'existe pas encore, alors que le vrai problème non résolu est de convaincre un premier propriétaire et un premier joueur. Décrit comme le symptôme classique du solo builder qui préfère coder (confortable) plutôt que démarcher des propriétaires de serveurs (inconfortable).
18. **Historique des sites de liste de serveurs** — les sites type topg.org vivent de volume publicitaire, pas de qualité (aucune incitation à purger les fiches mortes, multi-homing qui tue tout effet réseau). Le test Omniscient règle le problème des fiches mortes/usurpées mais pas le vrai fléau du genre : le signal de popularité gonflé — d'autant que le modèle économique à l'étude mentionne déjà une "mise en avant payante", soit le même mécanisme que le pay-to-rank des sites de vote classiques, juste requalifié en feature premium.

### B.2 — Critique du modèle économique (Free/Pro) — **nouvel éclairage, jamais réconcilié avec `SUIVI_PROJET.md` §8**

L'agent "scepticisme monétisation" a examiné les 4 avantages Pro listés dans la proposition d'abonnement existante (voir `SUIVI_PROJET.md` §8 / mémoire `project_subscriptions.md`) :
- **Codes d'invitation personnalisés** : coût technique nul, valeur perçue nulle — paywaller ferait fuir plus qu'il ne convertirait.
- **Statistiques avancées** : nice-to-have classique, personne ne paie un abonnement mensuel pour un graphique consulté une fois par mois.
- **Page personnalisable** : seul candidat sérieux, mais se vendrait mieux en achat ponctuel (template premium) qu'en abonnement récurrent.
- **Serveurs illimités, identifié comme "l'erreur centrale"** : la grande majorité des propriétaires ne gèrent qu'**un seul** serveur. Faire du multi-serveur le déclencheur du tier payant revient à construire la conversion autour d'une minorité (guildes multi-gamemode, réseaux) — le gratuit à 1 serveur couvre déjà 80-90 % des cas réels, donc 80-90 % des propriétaires n'ont *aucune* raison de passer payant.

**Alternative recommandée** : des **boosts/pourboires à la carte, façon Patreon** (mise en avant temporaire, dons directs) plutôt qu'un abonnement Pro construit sur "serveurs illimités" — en cohérence avec ce qui finance déjà réellement les communautés Minecraft existantes.

**Garde-fou ajouté par un autre agent (historique des sites de liste, §B.1-18)** : si ce levier "boosts/mise en avant" devient réel, il faut **séparer strictement le classement par défaut de l'annuaire du modèle payant** — sinon Omniscient réintroduit le pay-to-rank classique des sites de vote, juste requalifié en feature premium.

Dans la synthèse finale de l'assistant (voir §B.7), ces deux points ont été notés 8/10 (boosts plutôt que serveurs illimités) et 9/10 (séparation stricte classement/argent) respectivement, dans un document PDF noté — **mais ceci reste une recommandation issue du brainstorm, pas une décision actée** sur le modèle économique lui-même ; seule la priorisation "amis avant installeur" a été explicitement actée cette session (§B.8).

### B.3 — Le problème de "démarrage à froid" (cold start) et la piste de l'installeur fermé

Deux agents indépendants (cold-start, scope-dev-solo) et deux personas du premier tour pointent le même mécanisme circulaire : un joueur n'installe pas un launcher tiers pour un serveur qu'il ne connaît pas encore ; un propriétaire ne traverse pas la friction de vérification tant qu'elle n'apporte aucun joueur supplémentaire. Un annuaire à 0-5 serveurs ne fait connaître personne, et remplacer le launcher Microsoft officiel est une demande de confiance énorme pour parcourir trois fiches.

**Piste proposée en réponse** : la vraie première valeur du launcher n'est probablement pas l'annuaire public, mais un **installeur pré-configuré pour UNE communauté fermée déjà existante** (via un lien distribué par un propriétaire à ses propres joueurs, déjà sur Discord) — à tester d'abord avec 3 à 5 propriétaires de serveurs connus, avant de compter sur la visibilité de l'annuaire public.

### B.4 — Le point de désaccord réel entre agents : installeur pré-configuré vs système d'amis

Un agent "devil's advocate" s'oppose frontalement à la piste de l'installeur pré-configuré (§B.3) : si chaque propriétaire distribue son propre lien d'installeur, **personne ne passe jamais par l'annuaire**, personne ne découvre un deuxième serveur, et Omniscient devient une infrastructure invisible derrière le branding de chaque serveur — un "Prism Launcher reskin" sans effet réseau. Il propose à la place de prioriser le **système d'amis** (déjà envisagé dans les idées futures, cf. mémoire `project_friends_system`) comme véritable boucle de découverte multi-serveurs.

L'assistant n'a pas tranché seul entre les deux ("les deux arguments sont solides") — c'est l'utilisateur qui a tranché explicitement en faveur du système d'amis (§B.8).

### B.5 — Friction d'onboarding : Java/RAM trop tôt, et connexion Microsoft trop tôt

L'agent "friction d'inscription" (vague 2) a identifié le point de décrochage le plus net de tout le parcours joueur : dans l'assistant de tout premier lancement, **avant même d'avoir vu le jeu tourner une seule fois**, on demande déjà de choisir une plage de RAM (min/max) et le launcher gère Java — "ça sent le logiciel pour initiés, pas pour le public large". Touche 100 % des nouveaux utilisateurs, avant même la connexion Microsoft. Correctif proposé : détection et valeurs par défaut silencieuses, bouton "Jouer" accessible immédiatement, réglages RAM/Java uniquement si le lancement échoue ou dans les Paramètres pour qui veut les ajuster.

L'utilisateur a ensuite fait le lien lui-même avec la connexion Microsoft, également jugée trop précoce/bloquante : *"la connexion Microsoft aussi, c'est un gros blocage... peut-être qu'ils ont envie de circuler sur l'application [d'abord]."* L'assistant a confirmé que toutes les applications comparables (CurseForge, Modrinth, Prism) laissent naviguer/parcourir sans connexion, et ne demandent le compte Microsoft qu'au moment de lancer réellement le jeu.

### B.6 — "Modrinth est né d'un vrai scandale de confiance" — ce que ça recouvre réellement

Un des agents avait résumé la montée de Modrinth comme née "d'un événement de confiance précis". Interrogé sur ce que c'était exactement, l'assistant a précisé (recherche web, sources citées dans le transcript) que ce n'est pas un scandale isolé mais une **accumulation sur 2-3 ans** :
- **2022 — déclencheur le plus documenté** : CurseForge (racheté par Overwolf) a envoyé un courrier à Modrinth exigeant la suppression de toute référence/lien vers le CDN CurseForge dans les modpacks Modrinth (format de modpack qui référençait directement des fichiers CurseForge pour éviter de tout ré-uploader — **techniquement très proche de l'idée de modpack mixte de la partie A**). Modrinth a obtempéré tout en dénonçant publiquement un comportement jugé anticoncurrentiel (source primaire : blog Modrinth).
- **2023** : les créateurs des mods très populaires Iris et Sodium ont quitté CurseForge pour Modrinth, citant une baisse de revenus CurseForge malgré des téléchargements en hausse — signal de défiance des créateurs sur la rémunération.
- **Autres griefs cumulés** : un launcher CurseForge jugé trop chargé en publicités, le blocage de l'accès API à des launchers tiers comme MultiMC, et plus récemment une controverse politique (dons d'Overwolf à l'IDF) ayant relancé des appels au boycott côté communauté modding.

**Nuance apportée séparément sur Prism Launcher** (l'utilisateur avait supposé que CurseForge aurait "cancel" Prism pour avoir mélangé les sources) : il n'y a jamais eu de bannissement formel. En 2022, CurseForge a fermé son ancienne API en zone grise et ouvert une **nouvelle API officielle avec conditions tierces** (certains auteurs de mods peuvent refuser la distribution via apps tierces) ; Prism utilise cette API officielle légalement. Le vrai piège documenté : des clés API "trouvées" sur des forums/gists (plutôt qu'obtenues officiellement) violent les conditions — **exactement ce qui est arrivé une fois sur Omniscient** (clé trouvée, révoquée — déjà mentionné dans l'audit sécurité du 2026-10-10). Leçon retenue : utiliser l'API officielle avec sa propre clé légitime, respecter le refus de certains auteurs, prévoir une maintenance continue si CurseForge resserre encore l'authentification — un coût récurrent, pas un couperet.

### B.7 — Compilation : un PDF a bien été produit, mais seulement dans le scratchpad de session, jamais dans le dépôt

L'utilisateur a demandé : *"tu peux les compiler dans un dossier."* L'assistant a effectivement généré **deux PDF** (confirmés présents sur disque) :
- `Omniscient_audit_18_agents.pdf` (généré ~16:32 heure locale) — résumé exécutif, liste avant lancement en 3 niveaux (bloquant/stratégique/correctifs à faible coût), décision système d'amis, texte intégral des 18 rapports classés par vague.
- `Omniscient_notes_18_agents.pdf` (généré ~16:40) — chaque idée des 18 rapports notée sur 10, organisée par thème avec un top 10, et les arbitrages tranchés (amis 8/10 vs installeur 7/10 ; boosts 8/10 vs serveurs illimités ; séparation classement/argent 9/10 ; "geler et démarcher" 9/10).

**Constat de vérification (2026-10-16)** : ces deux fichiers, ainsi que les deux PDF produits plus tôt dans la même session (`Omniscient_presentation.pdf` et `Omniscient_parcours_utilisateur.pdf`, le document de pitch et le document UX détaillé demandés avant le lancement des agents), existent uniquement dans le dossier scratchpad temporaire de cette session Claude Code (`...\AppData\Local\Temp\claude\...\scratchpad\`). **Aucun n'a été copié dans `D:\Claude Code\MCHub\docs\`.** Dans les faits, la demande "compile-les dans un dossier" a donc été honorée sous forme de PDF livrés à l'utilisateur, mais rien n'a atterri dans un dossier persistant du projet — ce qui confirme l'absence de trace dans le dépôt que ce document corrige partiellement.

### B.8 — DÉCIDÉ le 2026-10-11 (appliqué dans le launcher ce soir-là)

Ces points ont été explicitement validés par l'utilisateur en fin de session et les messages suivants dans le transcript montrent des tentatives de test correspondantes (installation, erreurs, itérations) — donc traités comme réellement mis en œuvre, pas seulement discutés :

1. **Gel des nouvelles idées de fonctionnalités** pour le moment — *"on va geler les fonctionnalités pour le moment, les nouvelles idées."*
2. **Suppression du menu de choix de version Java** — le launcher installe directement une version de Java par défaut sans montrer de menu à l'utilisateur. (Itération ultérieure dans la session : l'utilisateur est allé plus loin que la proposition initiale de l'assistant — pas d'installation de Java du tout au démarrage du launcher ; l'installation ne se déclenche que quand une version précise est réellement nécessaire pour lancer une instance.)
3. **Configuration RAM automatique** — au lieu de suggérer une plage à l'utilisateur, le launcher la détecte/configure lui-même automatiquement.
4. **Connexion Microsoft différée** — la demande de compte Microsoft n'intervient plus dès l'arrivée dans l'app, mais seulement au moment où l'utilisateur clique réellement sur "Jouer"/"Rejoindre". Confirmé techniquement jouable par l'assistant : un drapeau `signedIn` existait déjà séparément, et l'écran de fiche serveur avait déjà un garde-fou à moitié en place pour le mode non-connecté — alignement explicite avec le comportement de CurseForge, Modrinth et Prism (navigation libre, compte demandé seulement au lancement du jeu).
5. **Priorité au système d'amis plutôt qu'à l'installeur pré-configuré** (tranchant l'arbitrage de §B.4) — motif explicite de l'utilisateur : un installeur par serveur ne donnerait aucune visibilité à la plateforme.
6. **Liste des correctifs "avant lancement" lue directement en conversation** plutôt que seulement dans le PDF, à la demande de l'utilisateur (*"liste-moi les correctifs du fichier PDF... je les lis directement dans la conversation, ce sera plus simple"*) — il s'agit du PDF `Omniscient_audit_18_agents.pdf` / `Omniscient_notes_18_agents.pdf` de §B.7. La liste donnée ce jour-là :
   - **Bloquant** : corriger le test de connexion (ne plus faire confiance au statut auto-rapporté du serveur propriétaire — initier soi-même une connexion vérifiable) ; badge de fraîcheur + re-vérification (ping passif 24-48h, dégradation progressive, jamais de coupure immédiate) ; politique de confidentialité/RGPD claire (public majoritairement mineur) ; process de recours écrit et visible pour un gel/transfert de serveur ; retirer l'étape RAM/Java du premier lancement.
   - **Stratégique** : geler les nouvelles fonctionnalités 2-4 semaines et démarcher 10-20 vrais propriétaires de serveurs modés pour valider si au moins 3 publient réellement et ramènent leurs joueurs ; séparer strictement le classement de l'annuaire du modèle payant ; revoir le levier payant principal (boosts/pourboires plutôt que serveurs illimités).
   - **Pas cher, à faire sans attendre** : brancher la cloche de notifications déjà existante sur les changements de statut des serveurs favoris (repasse en ligne, pic de joueurs, mise à jour de modpack).

### Points proposés mais explicitement non tranchés (« proposé, pas tranché »)

- Correction effective du mécanisme anti-fraude du test de connexion (bloquant identifié, mais aucune implémentation discutée dans ce transcript).
- Badge de fraîcheur / re-vérification continue des serveurs (24-48h, dégradation progressive).
- Politique de confidentialité/RGPD dédiée.
- Process de recours écrit pour gel/transfert de serveur.
- Gel de 2-4 semaines + démarchage actif de 10-20 propriétaires réels avant d'aller plus loin (recommandation forte, mais pas de calendrier ni de canal de démarchage décidés).
- Séparation stricte classement annuaire / modèle payant.
- Remplacement du levier "serveurs illimités" par des boosts/pourboires façon Patreon (critique actée comme pertinente, mais le modèle Free/Pro de `SUIVI_PROJET.md` §8 n'a pas été formellement amendé dans cette session).
- Branchement de la cloche de notifications sur les serveurs favoris.

---

## C. Questions ouvertes / suites implicites jamais résolues

- **Modèle économique non réconcilié** : la critique à 18 agents (§B.2) contredit directement la proposition Free/Pro existante (`SUIVI_PROJET.md` §8, mémoire `project_subscriptions.md`, écrite le 2026-09-24) sur son levier principal ("serveurs illimités"). Personne n'a depuis retravaillé formellement cette proposition à la lumière de cette critique — c'est un point à trancher explicitement avant toute implémentation de facturation.
- **Mécanisme anti-fraude du test de connexion** : identifié comme "bloquant" par plusieurs agents indépendants (red-team, confiance continue, historique des sites de liste), mais aucune piste de correction concrète n'a été actée ou implémentée dans ce transcript — seulement la clarification du principe ("initier soi-même une connexion vérifiable").
- **Data packs sur Modrinth** : question posée par l'utilisateur (§A.2) sans réponse tranchée retrouvée dans le transcript — à vérifier si besoin pour la fonctionnalité de création de modpack multi-source.
- **Essential mod ayant "racheté Modrinth"** : affirmation de l'utilisateur non vérifiée ni confirmée par l'assistant à l'époque — à clarifier si cette piste (tunnel P2P façon Essential, axe 3 de la partie A) est reprise un jour.
- **Faisabilité légale réelle du modpack multi-source (axe A.2)** : la nuance apportée en §B.6 (précédent direct où CurseForge a fait reculer Modrinth sur une fonctionnalité très similaire) n'a donné lieu à aucune décision de retrait ou d'adaptation de l'idée — le risque est documenté, pas traité.
- **Démarchage de propriétaires réels** : recommandation forte de plusieurs agents (tester avec 3-5 puis 10-20 propriétaires connus avant de compter sur l'annuaire public), mais aucun canal ni calendrier de démarchage n'a été défini dans cette session.
- **Deux PDF de pitch/UX (`Omniscient_presentation.pdf`, `Omniscient_parcours_utilisateur.pdf`)** destinés à être montrés à un tiers pour avis extérieur (mentionné en B.0) : sort de cette consultation externe non retrouvé dans le périmètre de ce transcript — à vérifier auprès de l'utilisateur si elle a eu lieu.
