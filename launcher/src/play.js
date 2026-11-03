// Onglet « Jouer » (bêta, preview C validée par Rushi le 24/10) : à gauche « Mes versions »
// (n'importe quelle version de Minecraft, vanilla ou avec un pack officiel, comme les
// installations du launcher officiel), à droite « Mes mondes » (sauvegardés tout seuls, import
// par copie depuis .minecraft, synchro cloud pour les Supporters). Plus la tuile « Continuer mon
// monde » de l'accueil.
//
// Chargé après renderer.js : showModal, attemptSignIn, signedIn, escapeHtml, renderActivity et
// TASK_PAUSE_SVG en viennent (portée globale des scripts classiques). Tout le reste est ici,
// dans une fonction, pour ne rien ajouter à la portée globale.
(function () {
  const api = window.mchub.play;
  if (!api) return;
  const L = () => (window.i18n.getLocale() === "en" ? "en" : "fr");
  const S = {
    fr: {
      nav: "Jouer", beta: "Bêta",
      sub: "N'importe quelle version, en vanilla ou avec un pack officiel. En solo, ou en multi avec l'adresse IP d'un serveur. Tes mondes sont sauvegardés tout seuls.",
      welcomeT: "Joue à Minecraft, à ta façon",
      welcomeD: "N'importe quelle version, en vanilla ou avec un pack préparé par l'équipe. En solo, ou en multi avec l'adresse IP d'un serveur. Tes mondes sont sauvegardés tout seuls.",
      step1T: "Choisis une version", step1D: "1.21, 1.8.9… toutes les versions existent.",
      step2T: "Crée ton monde", step2D: "Dans le jeu, comme d'habitude.",
      step3T: "Il est sauvegardé", step3D: "Il apparaît ici, avec ses sauvegardes.",
      mine: "Mes installations", newV: "Nouvelle installation", worldsT: "Mes mondes",
      noVersions: "Aucune installation pour l'instant. Clique « + Nouvelle installation ».",
      noWorlds: "Lance une de tes installations et crée ton monde dans le jeu : il apparaîtra ici, sauvegardé tout seul.",
      play: "Jouer", remove: "Retirer", rename: "Renommer", playing: "En cours", lastPlayed: "Jouée {t}", never: "Jamais jouée",
      official: "Officiel", mods: "mods", noMods: "Aucun mod",
      import: "Importer mes mondes Minecraft", importAll: "Importer…",
      saved: "Sauvegardé {t}", notSaved: "Pas encore sauvegardé", off: "Sauvegarde coupée",
      backups: "{n} sauvegardes sur ce PC", backups1: "1 sauvegarde sur ce PC", backups0: "Aucune sauvegarde", backupsKept: "{n} sauvegardes gardées sur ce PC", worldSize: "monde : {s}", cloudVer: "{n} version dans le cloud", cloudVers: "{n} versions dans le cloud", zipped: "{s} compressé",
      bkp: "Sauvegarde", bkpOnTip: "Couper la sauvegarde de ce monde", bkpOffTip: "Réactiver la sauvegarde",
      lastWith: "Ouvert la dernière fois avec {v}", inVersion: "Créé en {v}",
      offT: "Couper la sauvegarde de « {w} » ?", offD: "Le launcher ne fera plus de nouvelles sauvegardes de ce monde. Les {n} sauvegardes déjà faites sont gardées, sauf si tu coches la case.",
      offD0: "Le launcher ne fera plus de sauvegardes de ce monde.",
      offBox: "Supprimer aussi les {n} sauvegardes déjà faites (sauf la Version d'origine)", offOk: "Couper la sauvegarde", cancel: "Annuler", yesRemove: "Oui, retirer", no: "Non",
      toastOffKeep: "Sauvegarde coupée. Les {n} sauvegardes de « {w} » sont gardées.", toastOffDel: "Sauvegarde coupée. Les sauvegardes de « {w} » sont supprimées.", toastOn: "Sauvegarde réactivée pour « {w} ».",
      removeT: "Retirer « {v} » ?", removeD: "La version et ses mods sont retirés de ce PC. Tes mondes ne sont pas touchés : ils restent dans Mes mondes, avec leurs sauvegardes. Tu pourras la réinstaller avec « + Nouvelle installation ».",
      removed: "Version retirée. Tes mondes ne sont pas touchés.",
      removeDW: "La version et ses mods sont retirés de ce PC. Ses mondes ({l}) restent dans Mes mondes, sauf si tu coches la case : ils partent alors dans la Corbeille de Windows avec leurs sauvegardes, et plus rien ne reste dans le launcher.",
      removeW: "Retirer aussi ses {n} monde(s)", removedW: "Version retirée, et {n} monde(s) mis à la Corbeille avec leurs sauvegardes.",
      newVD: "Comme « Nouvelle installation » dans le launcher Minecraft. Elle s'ajoute à Mes installations ; tu la lances quand tu veux, en solo ou en multi.",
      nameL: "Nom (facultatif)", nameP: "Ex. : Survie 1.21 avec Léo", verL: "Version de Minecraft", search: "Écris une version : 1.20.1, 1.8.9, 24w45a…",
      fRel: "Versions finales", fSnap: "Snapshots", fOld: "Anciennes (bêta, alpha…)", none: "Aucune version ne correspond.", count: "{n} versions",
      packL: "Pack préconfiguré (testé par l'équipe)", vanillaD: "Minecraft tel quel, aucun mod.",
      create: "Créer", createPlay: "Créer et jouer", created: "« {n} » ajoutée à Mes installations.",
      snapW: "Snapshot : version de test de Mojang, peut abîmer un monde. Fais une copie avant.",
      oldW: "Très ancienne version : pas de multijoueur moderne, ni de sauvegarde garantie.",
      loadingVersions: "Chargement de la liste des versions…", versionsError: "Liste des versions injoignable : vérifie ta connexion.",
      launching: "Lancement de Minecraft {v}…", signin: "Connecte-toi avec ton compte Microsoft pour jouer.",
      impT: "Importer mes mondes Minecraft", impFrom: "Trouvés dans ce dossier :", impNone: "Aucun monde trouvé dans ce dossier.",
      impSafe: "On fait une copie. Tes mondes d'origine ne bougent pas et marchent toujours dans le launcher officiel.",
      impOther: "Autre dossier…", impCopy: "Copier {n} monde(s)", impCopying: "Copie en cours…", impDone: "{n} monde(s) copié(s). La sauvegarde est activée sur les copies.",
      impScanning: "Recherche des mondes…",
      modTag: "Modé", modTagTip: "Monde créé avec des mods ({l}). Le mode Jouer ne charge pas encore ces mods.", modCopyTag: "Copie d'essai",
      modCopyTip: "Copie faite avant d'ouvrir un monde modé sans ses mods. Le monde d'origine n'est pas touché.",
      impModT: "Mondes modés : en phase de test",
      impModD: "Tu peux les copier et les sauvegarder. Pour les jouer avec les bons mods, le plus sûr est d'importer le pack avec le monde (bouton « Importer… » › un pack Modrinth ou CurseForge) : la liste des mods est alors exacte. Sans le pack, le launcher devine les mods à partir du monde : c'est en test, vérifie la liste avant de jouer, sinon Minecraft peut supprimer des blocs modés.",
      impModRow: "Modé · {l}",
      modWarnT: "« {w} » est un monde modé",
      modWarnD: "Il a été créé avec {l}. Le mode Jouer ne charge pas encore ces mods : sans eux, Minecraft supprime les blocs, objets et créatures modés, et le monde peut être abîmé.",
      modWarnSafe: "Si tu l'ouvres quand même, le launcher fait d'abord une copie « {c} » et c'est la copie qui s'ouvre. Ton monde et sa Version d'origine ne sont pas touchés.",
      modWarnOk: "Ouvrir une copie quand même", modWarnNo: "Ne pas l'ouvrir", modCopying: "Copie du monde…",
      cfImpZip: "Importer un pack (Modrinth ou CurseForge)…", cfImpZipCf: "Importer un export CurseForge (.zip)…", mrImpOnly: "Importer un pack Modrinth (.mrpack)…",
      pkChT: "Importer un pack", pkChD: "D'où vient ton pack ?", imT: "Importer", imD: "Qu'est-ce que tu veux importer ?", imW: "Des mondes", imP: "Un pack (avec ses mods)", imWT: "Mes mondes Minecraft", imWF: ".minecraft ou un autre dossier", imWD: "Tes mondes solo, depuis Minecraft ou une instance (CurseForge, Prism…). Ils sont copiés, les originaux ne bougent pas.", imPT: "Un pack", imPF: "Modrinth ou CurseForge", imPD: "Un modpack avec ses mods, ses réglages et parfois ses mondes. Tu choisis ensuite d'où il vient.",
      pkChMr: "Modrinth", pkChMrF: "fichier .mrpack", pkChMrD: "Sur la page du pack Modrinth : « Télécharger ». Tous les mods se téléchargent tout seuls.",
      pkChCf: "CurseForge", pkChCfF: "fichier .zip", pkChCfD: "Dans l'appli CurseForge : ⋯ › « Exporter le profil ». Certains mods se téléchargent à la main.", pkChOm: "Pack Omniscient", pkChOmF: "fichier .omnipack", pkChOmD: "Un pack fait dans Omniscient (⚙ › Exporter › Pour Omniscient). Tous les mods se téléchargent tout seuls.",
      pkChNote: "Pas sûr ? Choisis n'importe lequel : le launcher reconnaît le fichier tout seul.",
      mrT: "Importer un pack Modrinth", mrSrc: "Pack Modrinth (.mrpack)", omImpT: "Importer un Pack Omniscient", omImpSrc: "Pack Omniscient (.omnipack) · {n} version(s)",
      cfFromInst: "Ces mondes viennent du pack CurseForge « {p} ». Pour les jouer avec les bons mods, importe aussi le pack : dans l'appli CurseForge, ouvre le profil, puis ⋯ › « Exporter le profil » (coche « saves » pour garder le monde).",
      cfFromInstBtn: "Importer avec son pack (.zip)",
      cfWhatT: "Ce que tu veux importer", cfPMods: "Mods ({n})", cfPModsD: "{a} se téléchargent tout seuls · {m} à télécharger à la main", cfPModsAll: "Tous se téléchargent tout seuls",
      cfPCfg: "Réglages du pack", cfPCfgD: "config, scripts, quêtes · {n} fichiers", cfPRp: "Packs de ressources ({n})", cfPSh: "Shaders ({n})",
      cfNoModsW: "Sans les mods, ces mondes modés ne pourront pas s'ouvrir correctement.",
      cfStepRp: "Packs de ressources copiés", cfStepSh: "Shaders copiés",
      cfT: "Importer un pack CurseForge",
      cfReading: "Lecture de la liste des mods…",
      cfSrcInst: "Instance CurseForge", cfSrcZip: "Export CurseForge",
      cfMeta: "Minecraft {v} · {l} · {n} mods",
      cfAuto: "{n} mods se téléchargent tout seuls, comme pour les packs des serveurs.",
      cfManual: "{n} mods sont à télécharger à la main : leurs auteurs ne permettent pas aux autres launchers de les télécharger. Le launcher t'ouvrira la bonne page.",
      cfConfigs: "Réglages du pack (config, scripts, quêtes) : {n} fichiers repris tels quels.",
      cfWorldsT: "Mondes trouvés avec ce pack", mrNoWorld: "Aucun monde dans ce pack.", cfNoWorld: "Aucun monde dans cet export. Pour l'avoir, coche « saves » quand tu exportes depuis CurseForge.",
      cfSafe: "On fait une copie. Le pack et les mondes d'origine ne bougent pas, et la Version d'origine de chaque monde est gardée.",
      cfPrivate: "Le pack reste privé, sur ce PC. Rien n'est publié.",
      cfGo: "Importer le pack", cfGoW: "Importer le pack et {n} monde(s)",
      cfStepList: "Liste des mods lue", cfStepDl: "Téléchargement des mods", cfStepPacked: "Mods inclus dans le pack copiés", cfStepOm: "Versions du pack installées", impStepW: "Mondes copiés",
      ipAll: "Import : {p} %", ipAllDone: "Import terminé", ipIn: "en {t}", ipLeft: "environ {t} restante(s)", ipCalc: "calcul…", ipFiles: "{n} / {of} fichiers", ipOf: "{a} sur {b}",
      cfStepCfg: "Réglages du pack copiés", cfStepWorld: "Monde copié", cfStepManual: "Mods à télécharger à la main",
      cfManualD: "Ouvre la page, clique sur « Download » SOUS le nom du fichier (pas le gros bouton du haut), et laisse le fichier dans Téléchargements. Le launcher le trouve, le vérifie et le range tout seul.",
      cfOpenPage: "Ouvrir la page", cfWaiting: "En attente du fichier", cfFound: "✓ Trouvé et installé",
      cfLater: "Finir plus tard", cfDoneB: "Terminé", cfPlay: "Jouer", cfPlayW: "Ouvrir « {w} »",
      cfReady: "Pack « {p} » prêt. {w} s'ouvre maintenant avec ses mods.", cfReadyNoW: "Pack « {p} » prêt.",
      cfLaterToast: "Le pack attend encore {n} mod(s). Tu pourras finir depuis Mes installations.",
      modWarnCf: "Recréer son pack",
      modWarnCfD: "Le mieux : recréer le pack du monde. Le launcher lit sa liste de mods (pack Modrinth .mrpack, instance CurseForge ou export .zip) et installe exactement les mêmes.",
      modCopyDone: "Copie « {c} » créée : c'est elle qui s'ouvre.",
      originLabel: "Version d'origine",
      originTip: "Le monde tel qu'il était à l'import. Jamais supprimée par le ménage automatique et jamais ouverte par le jeu. Restaurer reste possible. Seule « Suppression définitive » l'efface.",
      forever: "Suppression définitive", foreverT: "Supprimer « {w} » pour de bon ?",
      foreverWhat: "Tu vas effacer tout ce que le launcher garde de ce monde :",
      foreverWorld: "le monde sur ce PC", foreverBk: "ses {n} sauvegardes, y compris la Version d'origine 🔒", foreverBk1: "sa sauvegarde, la Version d'origine 🔒", foreverCloud: "ses versions dans le cloud",
      foreverNoBack: "Attention : aucun retour en arrière possible. Ni le launcher ni l'équipe Omniscient ne pourront récupérer ce monde.",
      foreverNote: "Note bien : le monde que tu avais importé (dans .minecraft ou ton launcher de mods) n'est pas touché, s'il y est encore.",
      foreverType: "Tape « {x} » pour confirmer", foreverWord: "supprimer", foreverOk: "Supprimer définitivement", foreverDone: "« {w} » est supprimé définitivement.",
      cdT: "Suppression de « {w} »", cdD: "Suppression dans {s} s. Tu peux encore annuler : rien n'est effacé avant la fin.", foreverCancelled: "Suppression annulée. Rien n'a été effacé.",
      restoreGoneD: "Le monde revient dans Mes mondes tel qu'il était le {d}.", foreverCloudFail: "Supprimé de ce PC, mais pas du cloud ({e}). Retire-le depuis Mes mondes sur le site.",
      mpT: "Mon pack", mpD: "Un pack à toi, sur ce PC : tu choisis tes mods sur Modrinth. Rien n'est publié ni partagé.",
      mpPick: "Mon pack", mpPickD: "Tes propres mods, choisis sur Modrinth. Privé, sur ce PC.", mpPickOld: "Pas pour cette version : les mods demandent une version officielle, à partir de 1.7.10 (Forge) ou 1.14 (Fabric).",omT: "Pack Omniscient", omD: "Pour le partager. Vanilla (map, packs de ressources, data packs) ou Mon pack (mods Modrinth seulement, pas de CurseForge ni de .jar à la main). Tu pourras le générer pour d'autres versions et l'envoyer pour qu'il soit publié dans Omniscient.", omOnly: "Pack Omniscient : Vanilla ou Mon pack seulement.", typeL: "Type", omCreate: "Créer un Pack Omniscient", omList: "Pack Omniscient", omListD: "Packs créés par la communauté, testés puis publiés par l'équipe.", omNone: "Aucun Pack Omniscient pour cette installation pour l'instant.", omJoin: "Tout le monde peut en proposer un : coche « Créer un Pack Omniscient » en haut, puis ⚙ › Exporter › Pour Omniscient.", omBy: "par {a}", mpLoader: "Chargeur",
      mpFor: "Pour ton monde « {w} »", mpFound: "{n} de ses mods sont sur Modrinth", mpAddAll: "Tout ajouter ({n})", mpMissing: "{n} ne sont pas sur Modrinth : ils sont dans l'onglet CurseForge, à télécharger à la main.",
      mpFabricWorld: "Fabric ne note pas la liste de ses mods dans le monde : ajoute ceux que tu utilisais (ex. Litematica, WorldEdit).",
      mpTabMr: "Modrinth", mpTabCf: "CurseForge, à la main", mpSearch: "Chercher un mod sur Modrinth (WorldEdit, Litematica, Create…)", mpSearchCf: "Chercher un mod sur CurseForge",
      mpAdd: "+ Ajouter", mpAdded: "✓ Ajouté", mpNotFor: "Pas pour {l} {v}", mpNone: "Aucun mod trouvé sur Modrinth. Essaie l'onglet « CurseForge, à la main ».", mpNoneMr: "Aucun mod trouvé sur Modrinth. Essaie un autre nom.", omMpD: "Un pack pour Omniscient : tu choisis tes mods sur Modrinth, sur ce PC. Ensuite tu pourras le générer pour d'autres versions et l'exporter pour qu'il soit publié.",
      mpCfInfo: "Le launcher ne télécharge rien depuis CurseForge. Pour chaque mod : « Ouvrir la page », télécharge le fichier indiqué et laisse-le dans Téléchargements. Le launcher le trouve, vérifie que c'est le bon et le range dans ton pack.",
      mpCfOpen: "Ouvrir la page", mpCfWait: "En attente du fichier", mpCfOk: "✓ Trouvé et installé", mpCfAdd: "+ À ma liste", mpCfNone: "Aucun mod trouvé sur CurseForge pour cette version. Essaie un autre nom.", mpCfErr: "La recherche CurseForge n'a pas marché : {e}",
      mpIn: "Dans mon pack ({n})", mpInEmpty: "Aucun mod pour l'instant : cherche-les au-dessus.", mpDeps: "Les mods nécessaires (ex. Fabric API) s'ajoutent tout seuls, dans la version demandée.", mpLatest: "récente", mpAuto: "nécessaire pour {m}", mpVerL: "Version de {m}",
      mpCreate: "Créer mon pack", mpCreatePlay: "Créer et jouer", mpCreateWorld: "Créer et ouvrir mon monde",
      mpWorldMissing: "{n} mods du monde manquent encore : sans eux, leurs blocs disparaîtraient. Le monde s'ouvrira en copie tant qu'il en manque.",
      mpCreated: "« {n} » ajouté à Mes installations.", modWarnPack: "Créer un pack pour ce monde",
      mpAdded2: "Mods ajoutés au pack.", mpAddT: "Ajouter des mods à « {n} »", mpAddGo: "Ajouter au pack", mpErr: "Impossible : {e}",
      mpCrashA: "Conseil : ajoute « Crash Assistant » (sur Modrinth). Quand le jeu plante, il explique pourquoi en clair.", mpCrashAdd: "+ L'ajouter",
      chT: "Le jeu s'est fermé sur un problème", chDeps: "Il manque un mod, ou un mod est trop vieux :",
      chDep: "{a} demande {b}{min}{have}.", chMin: " {v} ou plus", chHave: " (tu as {v})", chMissing: " (absent)",
      chJava: "Un mod demande une version de Java plus récente que celle utilisée.", chMem: "Minecraft a manqué de mémoire. Donne-lui plus de mémoire dans Réglages › Jeu.",
      chCrash: "Minecraft a planté.", chWhy: "Raison donnée par le jeu : {d}", chSuspect: "Mod suspect : {m}",
      chFix: "Corriger le pack", chCopy: "Copier les logs", chCopied: "Logs copiés : colle-les là où tu demandes de l'aide.", chFolder: "Voir le fichier",
      chHelp: "Besoin d'aide ? Copie les logs et colle-les dans ta demande d'aide (le nom de ton compte Windows est masqué).",
      chOfficial: "Ce pack est géré par l'équipe : préviens-nous avec les logs.", close: "Fermer",
      pkProbT: "Le pack a encore {n} problème(s)", pkProbD: "Le launcher a trouvé des problèmes dans « {n} ». Minecraft risque de planter. Ouvre la page du pack pour les corriger.",
      pkProbOpen: "Voir le pack", pkForce: "Jouer quand même",
      goneT: "Supprimés dans Minecraft", goneMeta: "Supprimé dans Minecraft · {n} sauv. gardées", goneBk: "Sauvegardes",
      goneTip: "Ce monde a été supprimé dans le jeu. Ses sauvegardes sont toujours là : Restaurer le remet dans Mes mondes.",
      contT: "Continuer mon monde", allWorlds: "Tous mes mondes", homeWhen: "{p} · {v}",
      histT: "Sauvegardes de « {w} »", histD: "Restaurer remplace le monde par cette sauvegarde ; la version actuelle est d'abord sauvegardée, rien n'est perdu.",
      histEmpty: "Aucune sauvegarde pour l'instant. Elles se font toutes seules pendant la partie et quand tu quittes le monde.",
      inGameT: "Pendant la partie", inGameD: "F6 : sauvegarder maintenant. Maj+F6 : sauvegarder avec un nom (ex. « Elytra obtenu »). Automatique toutes les 30 min et quand tu quittes le monde.",
      inGameToast: "Petite notification dans le jeu après une sauvegarde automatique",
      restore: "Restaurer", restoreT: "Restaurer « {w} » ?", restoreD: "Le monde revient à la sauvegarde du {d}. La version actuelle est sauvegardée juste avant (« Avant restauration »).",
      restored: "« {w} » est revenu à la sauvegarde choisie.", backupNow: "Sauvegarder maintenant", backupDone: "Sauvegarde faite.", openFolder: "Ouvrir le dossier",
      reason: { auto: "Fin de partie", manual: "À la main", import: "Import", "before-restore": "Avant restauration", ingame: "F6 en jeu", named: "Avec un nom", interval: "Automatique", "world-exit": "Sortie du monde", upgrade: "Avant changement de version", restore: "Avant restauration", guard: "Avant une version plus récente" },
      close: "Fermer", gameRunning: "Ferme Minecraft d'abord : on ne touche pas à un monde ouvert.",
      inCloud: "Dans le cloud", notInCloud: "Pas dans le cloud", sending: "Envoi en cours (voir en haut à droite)", cloudOnly: "Dans le cloud, pas sur ce PC", download: "Télécharger sur ce PC", restorePending: "Restauration demandée sur le site : faite au prochain lancement",
      sync: "Synchroniser",
      mvAll: "Mes mondes", mvRecent: "Récents", mvPinned: "Épinglés", mvOthers: "Tous mes mondes", mvHidden: "Mondes masqués", mvCloudOnly: "Seulement dans le cloud",
      mvSearch: "Rechercher un monde…", mvSort: "Trier", mvSortRecent: "Dernier joué", mvSortName: "Nom", mvSortSize: "Taille",
      mvFAll: "Tous", mvFNotCloud: "Pas dans le cloud", mvFOff: "Sauvegarde coupée", mvAllVersions: "Toutes les versions",
      mvMore: "Afficher les {n} autres", mvNone: "Aucun monde ne correspond.", mvPlayTip: "Jouer à « {w} »", mvBusy: "Ferme Minecraft d'abord : un seul jeu à la fois.",
      mvRunning: "En cours", mvDlTip: "Télécharger « {w} » sur ce PC", mvMenu: "Plus d'actions", mvBk: "{n} sauv.", mvBk1: "1 sauv.", mvBk0: "aucune sauv.",
      mvMBackups: "Sauvegardes ({n})", mvMAuto: "Sauvegarde automatique", mvMPin: "Épingler en haut", mvMUnpin: "Désépingler", mvMHide: "Masquer de la liste", mvMUnhide: "Remettre dans la liste",
      mvMUncloud: "Retirer du cloud", mvMSplit: "Choisir quelle version continuer", mvSplit: "2 versions",
      mvPinOk: "« {w} » est épinglé en haut.", mvHideOk: "« {w} » est masqué. Il reste sauvegardé, retrouve-le en bas de la liste.", mvMask: "Monde",
    },
    en: {
      nav: "Play", beta: "Beta",
      sub: "Any version, vanilla or with an official pack. Singleplayer, or multiplayer with a server's IP address. Your worlds are backed up on their own.",
      welcomeT: "Play Minecraft your way",
      welcomeD: "Any version, vanilla or with a pack prepared by the team. Singleplayer, or multiplayer with a server's IP address. Your worlds are backed up on their own.",
      step1T: "Pick a version", step1D: "1.21, 1.8.9… every version is there.",
      step2T: "Create your world", step2D: "In the game, as usual.",
      step3T: "It is backed up", step3D: "It shows up here, with its backups.",
      mine: "My installations", newV: "New installation", worldsT: "My worlds",
      noVersions: "No installation yet. Click “+ New installation”.",
      noWorlds: "Start one of your installations and create your world in the game: it will show up here, backed up on its own.",
      play: "Play", remove: "Remove", rename: "Rename", playing: "Running", lastPlayed: "Played {t}", never: "Never played",
      official: "Official", mods: "mods", noMods: "No mods",
      import: "Import my Minecraft worlds", importAll: "Import…",
      saved: "Saved {t}", notSaved: "Not backed up yet", off: "Backup off",
      backups: "{n} backups on this PC", backups1: "1 backup on this PC", backups0: "No backup", backupsKept: "{n} backups kept on this PC", worldSize: "world: {s}", cloudVer: "{n} version in the cloud", cloudVers: "{n} versions in the cloud", zipped: "{s} compressed",
      bkp: "Backup", bkpOnTip: "Turn off backup for this world", bkpOffTip: "Turn backup back on",
      lastWith: "Last opened with {v}", inVersion: "Made in {v}",
      offT: "Turn off backup for “{w}”?", offD: "The launcher will stop making new backups of this world. The {n} backups already made are kept, unless you tick the box.",
      offD0: "The launcher will stop backing up this world.",
      offBox: "Also delete the {n} backups already made (except the Original version)", offOk: "Turn off backup", cancel: "Cancel", yesRemove: "Yes, remove", no: "No",
      toastOffKeep: "Backup off. The {n} backups of “{w}” are kept.", toastOffDel: "Backup off. The backups of “{w}” are deleted.", toastOn: "Backup turned back on for “{w}”.",
      removeT: "Remove “{v}”?", removeD: "The version and its mods are removed from this PC. Your worlds are not touched: they stay in My worlds, with their backups. You can install it again with “+ New installation”.",
      removed: "Version removed. Your worlds are not touched.",
      removeDW: "The version and its mods are removed from this PC. Its worlds ({l}) stay in My worlds, unless you tick the box: they then go to the Windows Recycle Bin with their backups, and nothing stays in the launcher.",
      removeW: "Also remove its {n} world(s)", removedW: "Version removed, and {n} world(s) moved to the Recycle Bin with their backups.",
      newVD: "Like “New installation” in the Minecraft launcher. It is added to My installations; start it whenever you want, singleplayer or multiplayer.",
      nameL: "Name (optional)", nameP: "E.g. Survival 1.21 with Leo", verL: "Minecraft version", search: "Type a version: 1.20.1, 1.8.9, 24w45a…",
      fRel: "Releases", fSnap: "Snapshots", fOld: "Old (beta, alpha…)", none: "No version matches.", count: "{n} versions",
      packL: "Preconfigured pack (tested by the team)", vanillaD: "Minecraft as is, no mods.",
      create: "Create", createPlay: "Create and play", created: "“{n}” added to My installations.",
      snapW: "Snapshot: a Mojang test version, it can damage a world. Make a copy first.",
      oldW: "Very old version: no modern multiplayer and no guaranteed backup.",
      loadingVersions: "Loading the version list…", versionsError: "Version list unreachable: check your connection.",
      launching: "Starting Minecraft {v}…", signin: "Sign in with your Microsoft account to play.",
      impT: "Import my Minecraft worlds", impFrom: "Found in this folder:", impNone: "No world found in this folder.",
      impSafe: "We make a copy. Your original worlds don't move and still work in the official launcher.",
      impOther: "Other folder…", impCopy: "Copy {n} world(s)", impCopying: "Copying…", impDone: "{n} world(s) copied. Backup is on for the copies.",
      impScanning: "Looking for worlds…",
      modTag: "Modded", modTagTip: "World made with mods ({l}). Play mode does not load these mods yet.", modCopyTag: "Test copy",
      modCopyTip: "Copy made before opening a modded world without its mods. The original world is not touched.",
      impModT: "Modded worlds: in testing",
      impModD: "You can copy and back them up. To play them with the right mods, the safest way is to import the pack with the world (“Import…” button › a Modrinth or CurseForge pack): the mod list is then exact. Without the pack, the launcher guesses the mods from the world: this is in testing, check the list before playing, or Minecraft can delete modded blocks.",
      impModRow: "Modded · {l}",
      modWarnT: "“{w}” is a modded world",
      modWarnD: "It was made with {l}. Play mode does not load these mods yet: without them, Minecraft deletes modded blocks, items and mobs, and the world can be damaged.",
      modWarnSafe: "If you open it anyway, the launcher first makes a copy “{c}” and opens the copy. Your world and its Original version are not touched.",
      modWarnOk: "Open a copy anyway", modWarnNo: "Don't open it", modCopying: "Copying the world…",
      cfImpZip: "Import a pack (Modrinth or CurseForge)…", cfImpZipCf: "Import a CurseForge export (.zip)…", mrImpOnly: "Import a Modrinth pack (.mrpack)…",
      pkChT: "Import a pack", pkChD: "Where does your pack come from?", imT: "Import", imD: "What do you want to import?", imW: "Worlds", imP: "A pack (with its mods)", imWT: "My Minecraft worlds", imWF: ".minecraft or another folder", imWD: "Your single-player worlds, from Minecraft or an instance (CurseForge, Prism…). They are copied, the originals don't move.", imPT: "A pack", imPF: "Modrinth or CurseForge", imPD: "A modpack with its mods, settings and sometimes its worlds. You then pick where it comes from.",
      pkChMr: "Modrinth", pkChMrF: ".mrpack file", pkChMrD: "On the Modrinth pack page: “Download”. All mods download by themselves.",
      pkChCf: "CurseForge", pkChCfF: ".zip file", pkChCfD: "In the CurseForge app: ⋯ › “Export profile”. Some mods are downloaded by hand.", pkChOm: "Omniscient pack", pkChOmF: ".omnipack file", pkChOmD: "A pack made in Omniscient (⚙ › Export › For Omniscient). All mods download by themselves.",
      pkChNote: "Not sure? Pick either one: the launcher recognizes the file by itself.",
      mrT: "Import a Modrinth pack", mrSrc: "Modrinth pack (.mrpack)", omImpT: "Import an Omniscient pack", omImpSrc: "Omniscient pack (.omnipack) · {n} version(s)",
      cfFromInst: "These worlds come from the CurseForge pack “{p}”. To play them with the right mods, import the pack too: in the CurseForge app, open the profile, then ⋯ › “Export profile” (tick “saves” to keep the world).",
      cfFromInstBtn: "Import with its pack (.zip)",
      cfWhatT: "What you want to import", cfPMods: "Mods ({n})", cfPModsD: "{a} download by themselves · {m} to download by hand", cfPModsAll: "They all download by themselves",
      cfPCfg: "Pack settings", cfPCfgD: "config, scripts, quests · {n} files", cfPRp: "Resource packs ({n})", cfPSh: "Shaders ({n})",
      cfNoModsW: "Without the mods, these modded worlds won't open correctly.",
      cfStepRp: "Resource packs copied", cfStepSh: "Shaders copied",
      cfT: "Import a CurseForge pack",
      cfReading: "Reading the mod list…",
      cfSrcInst: "CurseForge instance", cfSrcZip: "CurseForge export",
      cfMeta: "Minecraft {v} · {l} · {n} mods",
      cfAuto: "{n} mods download by themselves, like server packs.",
      cfManual: "{n} mods must be downloaded by hand: their authors don't allow other launchers to download them. The launcher will open the right page.",
      cfConfigs: "Pack settings (config, scripts, quests): {n} files copied as they are.",
      cfWorldsT: "Worlds found with this pack", mrNoWorld: "No world in this pack.", cfNoWorld: "No world in this export. To include it, tick “saves” when you export from CurseForge.",
      cfSafe: "We make a copy. The original pack and worlds don't move, and each world's Original version is kept.",
      cfPrivate: "The pack stays private, on this PC. Nothing is published.",
      cfGo: "Import the pack", cfGoW: "Import the pack and {n} world(s)",
      cfStepList: "Mod list read", cfStepDl: "Downloading mods", cfStepPacked: "Mods included in the pack copied", cfStepOm: "Pack versions installed", impStepW: "Worlds copied",
      ipAll: "Import: {p} %", ipAllDone: "Import finished", ipIn: "in {t}", ipLeft: "about {t} left", ipCalc: "estimating…", ipFiles: "{n} / {of} files", ipOf: "{a} of {b}",
      cfStepCfg: "Pack settings copied", cfStepWorld: "World copied", cfStepManual: "Mods to download by hand",
      cfManualD: "Open the page, click “Download” UNDER the file name (not the big button at the top), and leave the file in Downloads. The launcher finds it, checks it and puts it in place.",
      cfOpenPage: "Open the page", cfWaiting: "Waiting for the file", cfFound: "✓ Found and installed",
      cfLater: "Finish later", cfDoneB: "Done", cfPlay: "Play", cfPlayW: "Open “{w}”",
      cfReady: "Pack “{p}” ready. {w} now opens with its mods.", cfReadyNoW: "Pack “{p}” ready.",
      cfLaterToast: "The pack still needs {n} mod(s). You can finish from My installations.",
      modWarnCf: "Rebuild its pack",
      modWarnCfD: "Best option: rebuild the world's pack. The launcher reads its mod list (Modrinth .mrpack, CurseForge instance or .zip export) and installs exactly the same mods.",
      modCopyDone: "Copy “{c}” made: that is the one that opens.",
      originLabel: "Original version",
      originTip: "The world as it was when imported. Never deleted by the automatic clean-up and never opened by the game. You can still restore it. Only “Delete for good” erases it.",
      forever: "Delete for good", foreverT: "Delete “{w}” for good?",
      foreverWhat: "You are about to erase everything the launcher keeps for this world:",
      foreverWorld: "the world on this PC", foreverBk: "its {n} backups, including the Original version 🔒", foreverBk1: "its backup, the Original version 🔒", foreverCloud: "its versions in the cloud",
      foreverNoBack: "Warning: there is no way back. Neither the launcher nor the Omniscient team will be able to recover this world.",
      foreverNote: "Please note: the world you imported (in .minecraft or your mod launcher) is not touched, if it is still there.",
      foreverType: "Type “{x}” to confirm", foreverWord: "delete", foreverOk: "Delete for good", foreverDone: "“{w}” is deleted for good.",
      cdT: "Deleting “{w}”", cdD: "Deleting in {s} s. You can still cancel: nothing is erased before the end.", foreverCancelled: "Deletion cancelled. Nothing was erased.",
      restoreGoneD: "The world comes back to My worlds as it was on {d}.", foreverCloudFail: "Deleted from this PC, but not from the cloud ({e}). Remove it from My worlds on the website.",
      mpT: "My pack", mpD: "A pack of your own, on this PC: you pick your mods on Modrinth. Nothing is published or shared.",
      mpPick: "My pack", mpPickD: "Your own mods, picked on Modrinth. Private, on this PC.", mpPickOld: "Not for this version: mods need an official release, from 1.7.10 (Forge) or 1.14 (Fabric).",omT: "Omniscient pack", omD: "To share it. Vanilla (map, resource packs, data packs) or My pack (Modrinth mods only, no CurseForge, no hand-added .jar). You can generate it for other versions and send it to be published in Omniscient.", omOnly: "Omniscient pack: Vanilla or My pack only.", typeL: "Type", omCreate: "Create an Omniscient pack", omList: "Omniscient pack", omListD: "Packs made by the community, tested then published by the team.", omNone: "No Omniscient pack for this installation yet.", omJoin: "Anyone can submit one: tick “Create an Omniscient pack” at the top, then ⚙ › Export › For Omniscient.", omBy: "by {a}", mpLoader: "Loader",
      mpFor: "For your world “{w}”", mpFound: "{n} of its mods are on Modrinth", mpAddAll: "Add all ({n})", mpMissing: "{n} are not on Modrinth: they are in the CurseForge tab, to download by hand.",
      mpFabricWorld: "Fabric does not write its mod list into the world: add the ones you used (e.g. Litematica, WorldEdit).",
      mpTabMr: "Modrinth", mpTabCf: "CurseForge, by hand", mpSearch: "Search a mod on Modrinth (WorldEdit, Litematica, Create…)", mpSearchCf: "Search a mod on CurseForge",
      mpAdd: "+ Add", mpAdded: "✓ Added", mpNotFor: "Not for {l} {v}", mpNone: "No mod found on Modrinth. Try the “CurseForge, by hand” tab.", mpNoneMr: "No mod found on Modrinth. Try another name.", omMpD: "A pack for Omniscient: you pick your mods on Modrinth, on this PC. Then you can generate it for other versions and export it to be published.",
      mpCfInfo: "The launcher downloads nothing from CurseForge. For each mod: “Open the page”, download the file shown and leave it in Downloads. The launcher finds it, checks it is the right one and puts it in your pack.",
      mpCfOpen: "Open the page", mpCfWait: "Waiting for the file", mpCfOk: "✓ Found and installed", mpCfAdd: "+ To my list", mpCfNone: "No mod found on CurseForge for this version. Try another name.", mpCfErr: "The CurseForge search failed: {e}",
      mpIn: "In my pack ({n})", mpInEmpty: "No mod yet: search for them above.", mpDeps: "Required mods (e.g. Fabric API) are added on their own, in the requested version.", mpLatest: "latest", mpAuto: "required by {m}", mpVerL: "Version of {m}",
      mpCreate: "Create my pack", mpCreatePlay: "Create and play", mpCreateWorld: "Create and open my world",
      mpWorldMissing: "{n} of the world's mods are still missing: without them, their blocks would disappear. The world opens as a copy while any are missing.",
      mpCreated: "“{n}” added to My installations.", modWarnPack: "Make a pack for this world",
      mpAdded2: "Mods added to the pack.", mpAddT: "Add mods to “{n}”", mpAddGo: "Add to the pack", mpErr: "Could not do it: {e}",
      mpCrashA: "Tip: add “Crash Assistant” (on Modrinth). When the game crashes, it explains why in plain words.", mpCrashAdd: "+ Add it",
      chT: "The game closed on a problem", chDeps: "A mod is missing, or a mod is too old:",
      chDep: "{a} needs {b}{min}{have}.", chMin: " {v} or newer", chHave: " (you have {v})", chMissing: " (missing)",
      chJava: "A mod needs a newer Java than the one used.", chMem: "Minecraft ran out of memory. Give it more in Settings › Game.",
      chCrash: "Minecraft crashed.", chWhy: "Reason given by the game: {d}", chSuspect: "Suspected mod: {m}",
      chFix: "Fix the pack", chCopy: "Copy the logs", chCopied: "Logs copied: paste them where you ask for help.", chFolder: "Show the file",
      chHelp: "Need help? Copy the logs and paste them in your help request (your Windows account name is hidden).",
      chOfficial: "This pack is managed by the team: tell us with the logs.", close: "Close",
      pkProbT: "The pack still has {n} problem(s)", pkProbD: "The launcher found problems in “{n}”. Minecraft may crash. Open the pack page to fix them.",
      pkProbOpen: "See the pack", pkForce: "Play anyway",
      goneT: "Deleted in Minecraft", goneMeta: "Deleted in Minecraft · {n} backups kept", goneBk: "Backups",
      goneTip: "This world was deleted in the game. Its backups are still here: Restore puts it back in My worlds.",
      contT: "Continue my world", allWorlds: "All my worlds", homeWhen: "{p} · {v}",
      histT: "Backups of “{w}”", histD: "Restore replaces the world with this backup; the current version is backed up first, nothing is lost.",
      histEmpty: "No backup yet. They happen on their own while you play and when you leave the world.",
      inGameT: "While playing", inGameD: "F6: save now. Shift+F6: save with a name (e.g. “Got the elytra”). Automatic every 30 min and when you leave the world.",
      inGameToast: "Small in-game notification after an automatic backup",
      restore: "Restore", restoreT: "Restore “{w}”?", restoreD: "The world goes back to the backup from {d}. The current version is backed up right before (“Before restore”).",
      restored: "“{w}” is back to the chosen backup.", backupNow: "Back up now", backupDone: "Backup done.", openFolder: "Open folder",
      reason: { auto: "End of game", manual: "By hand", import: "Import", "before-restore": "Before restore", ingame: "F6 in game", named: "Named", interval: "Automatic", "world-exit": "Left the world", upgrade: "Before version change", restore: "Before restore", guard: "Before a newer version" },
      close: "Close", gameRunning: "Close Minecraft first: we don't touch an open world.",
      inCloud: "In the cloud", notInCloud: "Not in the cloud", sending: "Sending (see top right)", cloudOnly: "In the cloud, not on this PC", download: "Download to this PC", restorePending: "Restore requested on the website: done next time you start it",
      sync: "Sync",
      mvAll: "My worlds", mvRecent: "Recent", mvPinned: "Pinned", mvOthers: "All my worlds", mvHidden: "Hidden worlds", mvCloudOnly: "Only in the cloud",
      mvSearch: "Search a world…", mvSort: "Sort", mvSortRecent: "Last played", mvSortName: "Name", mvSortSize: "Size",
      mvFAll: "All", mvFNotCloud: "Not in the cloud", mvFOff: "Backup off", mvAllVersions: "All versions",
      mvMore: "Show {n} more", mvNone: "No world matches.", mvPlayTip: "Play “{w}”", mvBusy: "Close Minecraft first: one game at a time.",
      mvRunning: "Playing", mvDlTip: "Download “{w}” to this PC", mvMenu: "More actions", mvBk: "{n} backups", mvBk1: "1 backup", mvBk0: "no backup",
      mvMBackups: "Backups ({n})", mvMAuto: "Automatic backup", mvMPin: "Pin to top", mvMUnpin: "Unpin", mvMHide: "Hide from the list", mvMUnhide: "Put back in the list",
      mvMUncloud: "Remove from cloud", mvMSplit: "Choose which version to continue", mvSplit: "2 versions",
      mvPinOk: "“{w}” is pinned to the top.", mvHideOk: "“{w}” is hidden. It stays backed up; find it at the bottom of the list.", mvMask: "World",
    },
  };
  const T = (k, o) => {
    let s = S[L()][k] ?? S.fr[k] ?? k;
    if (o) s = s.replace(/\{(\w+)\}/g, (_, x) => (o[x] ?? ""));
    return s;
  };
  const esc = (v) => escapeHtml(v == null ? "" : String(v));
  const packName = (p) => (p ? (typeof p.name === "string" ? p.name || (p.kind === "cf" ? "CurseForge" : p.kind === "mr" ? "Modrinth" : T("mpT")) : p.name?.[L()] || p.name?.fr || p.slug) : "Vanilla");

  // Durée relative courte (« il y a 3 min », « hier »).
  function ago(when) {
    const ms = Date.now() - (typeof when === "number" ? when : Date.parse(when));
    if (!Number.isFinite(ms)) return "";
    const fr = L() === "fr";
    const min = Math.round(ms / 60000);
    if (min < 1) return fr ? "à l'instant" : "just now";
    if (min < 60) return fr ? `il y a ${min} min` : `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 24) return fr ? `il y a ${h} h` : `${h} h ago`;
    const d = Math.round(h / 24);
    if (d === 1) return fr ? "hier" : "yesterday";
    return fr ? `il y a ${d} jours` : `${d} days ago`;
  }
  function sizeFmt(bytes) {
    const fr = L() === "fr";
    const mo = (bytes || 0) / 1e6;
    if (mo <= 0) return `0 ${fr ? "Mo" : "MB"}`;
    if (mo >= 1000) return `${(mo / 1000).toFixed(1).replace(".", fr ? "," : ".")} ${fr ? "Go" : "GB"}`;
    return `${Math.max(1, Math.round(mo))} ${fr ? "Mo" : "MB"}`;
  }
  function dateFmt(iso) {
    try {
      return new Date(iso).toLocaleString(L() === "fr" ? "fr-BE" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  // Petite vignette « bloc d'herbe » quand le monde n'a pas encore d'image (icon.png du jeu).
  const thumbCache = {};
  function grassThumb(seedText) {
    let seed = 0;
    for (const c of String(seedText)) seed = (seed * 31 + c.charCodeAt(0)) % 9973;
    if (thumbCache[seed]) return thumbCache[seed];
    const c = document.createElement("canvas");
    c.width = 44;
    c.height = 44;
    const x = c.getContext("2d");
    let s = seed * 9301 + 49297;
    const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 44; i += 4) {
      const g = Math.round((18 + Math.sin(i / 7 + seed) * 6) / 4) * 4;
      for (let j = 0; j < 44; j += 4) {
        x.fillStyle = j < g ? "#8fc6ef" : j < g + 4 ? (r() < 0.2 ? "#6a9a3e" : "#5f9a3a") : j < g + 12 ? (r() < 0.2 ? "#7a5634" : "#86603b") : r() < 0.12 ? "#a0a0a0" : "#7f7f86";
        x.fillRect(i, j, 4, 4);
      }
    }
    return (thumbCache[seed] = c.toDataURL());
  }
  const worldThumb = (w) => w.icon || grassThumb(w.key || w.name);
  // Monde modé détecté à l'import (level.dat : chargeur, liste de mods quand le jeu l'écrit).
  const LOADERS = { forge: "Forge", neoforge: "NeoForge", fabric: "Fabric", quilt: "Quilt" };
  const modLabel = (m) => [LOADERS[m?.loader] || m?.loader || "mods", m?.count ? `${m.count} mods` : ""].filter(Boolean).join(" · ");

  const CUBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/></svg>';

  const css = document.createElement("style");
  css.textContent = `
  .play-switch { display: inline-flex; align-items: center; gap: 8px; border: 0; background: none; color: var(--muted); font: inherit; font-size: 12.5px; cursor: pointer; padding: 4px; border-radius: var(--radius-m); }
  .play-switch i { position: relative; width: 32px; height: 18px; border-radius: 9px; background: color-mix(in srgb, var(--foreground) 22%, transparent); transition: background .15s; }
  .play-switch i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.35); }
  .play-switch[aria-checked="true"] i { background: var(--success); }
  .play-switch[aria-checked="true"] i::after { transform: translateX(14px); }
  .instance-card-icon.play-thumb { padding: 0; overflow: hidden; }
  .instance-card-icon.play-thumb img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; display: block; }
  .instance-badge.play-saved { background: color-mix(in srgb, var(--success) 16%, transparent); color: var(--success); }
  .instance-badge.play-off { background: color-mix(in srgb, var(--muted) 20%, transparent); color: var(--muted); }
  .play-list { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; max-height: 46vh; overflow: auto; }
  .play-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-m); border: 1px solid var(--border); background: var(--surface-raised); cursor: pointer; font-size: 13px; }
  .play-row img { width: 32px; height: 32px; border-radius: 6px; image-rendering: pixelated; object-fit: cover; }
  .play-row .t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .play-row small { color: var(--muted); font-size: 11.5px; }
  .play-row .w { color: var(--warn); font-size: 11.5px; }
  .play-row .sz { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12px; white-space: nowrap; }
  .play-path { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: var(--muted); overflow-wrap: anywhere; }
  .play-safe { font-size: 12.5px; padding: 8px 10px; border-radius: var(--radius-m); background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--foreground); margin: 0; }
  .home-resume.play-resume .home-resume-icon { padding: 0; overflow: hidden; background: none; }
  .home-resume.play-resume .home-resume-icon img { width: 100%; height: 100%; image-rendering: pixelated; display: block; object-fit: cover; }
  .sidebar-beta { margin-left: auto; font-size: 9.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--accent-2); }
  #sidebar:not(.expanded) .sidebar-beta { display: none; }
  .play-beta-tag { display: inline-block; vertical-align: middle; margin-left: 8px; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent-2); }
  #play-panel.detail { max-width: 1280px; margin-inline: auto; }
  .play-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; align-items: start; }
  @media (max-width: 900px) { .play-cols { grid-template-columns: 1fr; } }
  .play-in { width: 100%; box-sizing: border-box; font: inherit; font-size: 13.5px; padding: 8px 10px; border-radius: var(--radius-m); border: 1px solid var(--border); background: var(--surface-raised); color: var(--foreground); margin-top: 6px; }
  .play-in:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .play-chips { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 8px 0 6px; font-size: 12.5px; color: var(--muted); }
  .play-chips label { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
  .play-vlist { max-height: 168px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-m); padding: 4px; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 4px; background: var(--surface-raised); }
  .play-vlist button { font: inherit; font-size: 13px; text-align: left; padding: 6px 8px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: var(--foreground); cursor: pointer; font-variant-numeric: tabular-nums; }
  .play-vlist button:hover { background: var(--surface); }
  .play-vlist button[aria-selected="true"] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .play-vlist small { color: var(--muted); font-size: 10.5px; }
  .play-warn { margin: 8px 0 0; font-size: 12.5px; color: var(--warn); }
  #play-panel .home-section-header { align-items: center; min-height: 36px; }
  .play-welcome { display: grid; justify-items: center; text-align: center; gap: 10px; padding: 40px 24px; border: 1px dashed var(--border); border-radius: var(--radius-l); background: var(--surface); }
  .play-welcome h3 { margin: 4px 0 0; font-size: 18px; color: var(--foreground); }
  .play-welcome > p { margin: 0; max-width: 56ch; color: var(--muted); font-size: 13.5px; }
  .play-steps { list-style: none; margin: 12px 0 6px; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 200px)); gap: 12px; }
  .play-steps li { display: grid; gap: 6px; justify-items: center; padding: 14px 12px; border-radius: var(--radius-m); background: var(--surface-raised); font-size: 12.5px; color: var(--muted); }
  .play-steps b { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent-2); font-size: 13px; }
  .play-steps strong { color: var(--foreground); font-weight: 600; font-size: 13px; }
  .play-welcome .acts { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }
  @media (max-width: 760px) { .play-steps { grid-template-columns: 1fr; } }
  .play-col-empty { display: grid; justify-items: center; text-align: center; gap: 8px; padding: 28px 16px; border: 1px dashed var(--border); border-radius: var(--radius-l); color: var(--muted); font-size: 13px; }
  .play-col-empty p { margin: 0; max-width: 40ch; }
  .play-modal { position: fixed; inset: 36px 0 0 0; z-index: 250; background: rgba(4, 7, 14, 0.66); display: grid; place-items: center; padding: 16px; }
  .play-modal .modal-box { max-height: calc(100vh - 80px); overflow: auto; }
  .bk-hint { font-size:12px; opacity:.75; margin:6px 0 0; }
  /* Fenêtre Sauvegardes (design A « Curseur », choisi le 25/10). */
  .nb-box { max-width: 600px; text-align: left; }
  .nb-box h3 { margin: 0 0 2px; }
  .nb-sub { font-size: 12.5px; color: var(--muted); margin: 0 0 14px; }
  .nl-del { color: var(--danger) !important; }
  .nl-danger { background: var(--danger) !important; border-color: var(--danger) !important; }
  .nl-danger:disabled { opacity: .45; }
  .nb-all { display: inline-block; font-size: 11px; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); padding: 1px 8px; border-radius: 999px; margin-right: 4px; }
  .nb-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .nb-tiles.one { grid-template-columns: 1fr; }
  .nb-tile { padding: 10px 12px; border-radius: var(--radius-m); background: var(--surface-raised); border: 1px solid var(--border); font-size: 12.5px; display: flex; flex-direction: column; gap: 3px; }
  .nb-tile > span { color: var(--muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
  .nb-tile b { font-size: 14px; font-weight: 650; }
  .nb-tile small { color: var(--muted); font-size: 11.5px; }
  .nb-bar { height: 6px; border-radius: 99px; background: color-mix(in srgb, var(--foreground) 10%, transparent); overflow: hidden; margin-top: 4px; }
  .nb-bar i { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
  .nb-q { margin: 18px 0 8px; font-size: 13px; font-weight: 600; display: flex; align-items: baseline; gap: 8px; }
  .nb-q .tag { font-size: 11px; font-weight: 600; color: var(--accent); }
  .nb-res { font-size: 12.5px; margin: 10px 0 0; padding: 8px 10px; border-radius: var(--radius-m); line-height: 1.45; }
  .nb-res.ok { background: color-mix(in srgb, var(--success) 12%, transparent); }
  .nb-res.warn { background: color-mix(in srgb, var(--warn) 14%, transparent); }
  .nb-cloud { display: flex; gap: 8px; font-size: 12.5px; line-height: 1.45; margin-top: 10px; padding: 9px 11px; border-radius: var(--radius-m); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); background: color-mix(in srgb, var(--accent) 7%, transparent); }
  .nb-cloud > span:first-child { color: var(--accent); }
  .nb-check { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; margin-top: 12px; cursor: pointer; }
  .nb-check input { margin-top: 3px; }
  .nb-check small { display: block; font-size: 12px; color: var(--muted); }
  .nb-adv { margin-top: 12px; font-size: 12.5px; }
  .nb-adv > button { font-size: 12.5px; }
  .nb-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .nb-pills button { font: inherit; font-size: 13px; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--foreground); cursor: pointer; position: relative; }
  .nb-pills button:hover { border-color: color-mix(in srgb, var(--accent) 50%, var(--border)); }
  .nb-pills button[aria-checked=true] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); font-weight: 650; }
  .nb-ingame { margin-top: 14px; padding: 10px 12px; border-radius: var(--radius-m); background: var(--surface-raised); border: 1px solid var(--border); font-size: 12.5px; line-height: 1.5; }
  .nb-ingame kbd { font: inherit; font-size: 11.5px; font-weight: 600; padding: 1px 6px; border-radius: 5px; border: 1px solid var(--border); background: var(--surface); }
  .nb-ingame label { display: flex; gap: 8px; align-items: center; margin-top: 6px; cursor: pointer; }
  .nb-list { margin-top: 8px; max-height: 230px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-m); }
  .nb-row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 7px 10px; font-size: 12.5px; border-bottom: 1px solid var(--border); }
  .nb-row:last-child { border-bottom: 0; }
  .nb-row .s { color: var(--muted); font-variant-numeric: tabular-nums; }
  .nb-row b { font-weight: 600; }
  .nb-row.gone { opacity: .5; }
  .nb-row.gone .d { text-decoration: line-through; }
  .nb-row small { display: inline-block; margin-left: 6px; color: var(--warn); font-size: 11px; }
  .nb-empty { margin-top: 10px; padding: 14px; border: 1px dashed var(--border); border-radius: var(--radius-m); font-size: 12.5px; color: var(--muted); text-align: center; }
  .nb-acts { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-top: 18px; }
  /* A : curseur */
  .nb-big { display: flex; align-items: baseline; gap: 8px; }
  .nb-big b { font-size: 34px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .nb-big span { font-size: 13.5px; color: var(--muted); }
  .nb-range { width: 100%; margin: 12px 0 2px; accent-color: var(--accent); height: 22px; cursor: pointer; }
  .nb-ticks { display: grid; font-size: 11px; color: var(--muted); text-align: center; margin: 0 -2px; }
  .nb-ticks span { cursor: pointer; }
  .nb-ticks span.on { color: var(--foreground); font-weight: 700; }
  .nb-ticks span:first-child { text-align: left; } .nb-ticks span:last-child { text-align: right; }
  @media (max-width: 640px) { .nb-tiles { grid-template-columns: 1fr; } }
  /* Une confirmation (showModal) ouverte depuis une fenêtre de l'onglet Jouer passe toujours au-dessus
     (retour de test du 25/10 : « Retirer du cloud » restait cachée derrière Synchroniser). */
  body:has(.play-modal) .modal-overlay { z-index: 300; }
  .cloud-box { width: min(520px, 100%); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-l); padding: 22px; display: grid; gap: 12px; box-shadow: 0 20px 60px -20px rgba(0,0,0,.7); max-height: calc(100vh - 80px); overflow: auto; }
  .cloud-box h3 { margin: 0; font-size: 17px; display: flex; align-items: center; gap: 8px; }
  .cloud-box > p { margin: 0; font-size: 13.5px; color: var(--muted); line-height: 1.5; }
  .cloud-bar { height: 8px; border-radius: 4px; background: var(--surface-raised); overflow: hidden; }
  .cloud-bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .25s linear; }
  .cloud-meta { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .cloud-list { display: grid; gap: 6px; }
  .cloud-row { display: grid; grid-template-columns: 32px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: var(--radius-m); background: var(--surface-raised); font-size: 13px; }
  .cloud-row img { width: 32px; height: 32px; border-radius: 6px; image-rendering: pixelated; object-fit: cover; }
  .cloud-row small { display: block; color: var(--muted); font-size: 11.5px; }
  .cloud-row .st { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cloud-warn { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: var(--radius-m); background: color-mix(in srgb, var(--warn) 14%, transparent); color: var(--warn); font-size: 13px; }
  .cloud-acts { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
  .play-cloud-line { font-size: 12px; }
  /* Plusieurs PC (preview validée du 24/10) : bandeau « Nouveau PC », conflit d'appareils. */
  .play-remote { display:flex; gap:14px; align-items:center; padding:12px 14px; margin:0 0 10px; border-radius:var(--radius-l); border:1px solid color-mix(in srgb, var(--accent) 45%, var(--border)); background:color-mix(in srgb, var(--accent) 10%, var(--surface)); }
  .play-remote > div { flex:1; } .play-remote strong { font-size:13.5px; } .play-remote p { margin:4px 0 0; font-size:12.5px; opacity:.8; }
  .play-remote .join-btn { white-space:nowrap; }
  .cf-devs { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
  .cf-dev { padding:10px 12px; border-radius:var(--radius-m); border:1px solid var(--border); background:var(--surface-raised); font-size:12.5px; display:flex; flex-direction:column; gap:3px; }
  .cf-dev.new { border-color:color-mix(in srgb, var(--accent) 55%, var(--border)); }
  .cf-dev b { font-size:13px; }
  .cf-dev span { opacity:.75; }
  .play-split-line { color:var(--warn); font-size:12px; }
  /* Liste « Mes mondes » (variante B choisie le 25/10) : lignes fines, ▶ toujours visible, le reste
     dans « … », recherche et tri dès 8 mondes, filtres dès 16, sections repliables. */
  .play-cols.mv-wide { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
  @media (max-width: 900px) { .play-cols.mv-wide { grid-template-columns: 1fr; } }
  .mv-tools { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:0 0 10px; }
  .mv-search { flex:1 1 180px; min-width:0; display:flex; align-items:center; gap:6px; padding:0 10px; height:34px; border-radius:var(--radius-m); border:1px solid var(--border); background:var(--surface-raised); color:var(--muted); }
  .mv-search:focus-within { outline:2px solid var(--accent); outline-offset:1px; }
  .mv-search input { flex:1; min-width:0; border:0; background:none; color:var(--foreground); font:inherit; font-size:13px; outline:none; }
  .mv-select { height:34px; border-radius:var(--radius-m); border:1px solid var(--border); background:var(--surface-raised); color:var(--foreground); font:inherit; font-size:12.5px; padding:0 8px; }
  .mv-chips { display:flex; flex-wrap:wrap; gap:6px; margin:-2px 0 10px; }
  .mv-chip { font:inherit; font-size:12px; padding:4px 10px; border-radius:999px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; display:inline-flex; gap:5px; align-items:center; }
  .mv-chip[aria-pressed=true] { border-color:var(--accent); color:var(--foreground); background:color-mix(in srgb, var(--accent) 14%, transparent); }
  .mv-chip b { font-weight:600; font-variant-numeric:tabular-nums; }
  .mv-sec { margin:4px 0 12px; }
  .mv-sec-h { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); margin:0 0 6px; padding:0 2px; border:0; background:none; font-family:inherit; cursor:pointer; }
  .mv-sec-h svg { transition:transform .15s; }
  .mv-sec-h[aria-expanded=true] svg { transform:rotate(90deg); }
  .mv-sec-h .n { font-weight:600; opacity:.8; }
  .mv-list { display:flex; flex-direction:column; gap:4px; }
  .mv-row { display:grid; grid-template-columns:34px minmax(0,1fr) auto auto auto; align-items:center; gap:10px; min-height:52px; padding:6px 8px 6px 9px; border-radius:var(--radius-m); border:1px solid transparent; background:var(--surface); transition:background .12s, border-color .12s; }
  .mv-row:hover, .mv-row:focus-within { background:var(--surface-raised); border-color:var(--border); }
  .mv-row[data-world] { cursor:pointer; }
  .mv-row[data-world]:hover .mv-bk { color:var(--accent); text-decoration:underline; text-underline-offset:2px; }
  .pj-picking .mv-row[data-world]:hover .mv-bk { color:inherit; text-decoration:none; }
  .mv-row img { width:34px; height:34px; border-radius:7px; image-rendering:pixelated; object-fit:cover; display:block; }
  .mv-row.recent { min-height:58px; grid-template-columns:40px minmax(0,1fr) auto auto auto; }
  .mv-row.recent img { width:40px; height:40px; }
  .mv-row.cloud-only img { opacity:.6; }
  .mv-list.dim .mv-row { opacity:.75; }
  .mv-txt { min-width:0; display:flex; flex-direction:column; gap:1px; }
  /* Carte d'une version (27/10, Rushi) : le nom seul sur la 1re ligne, pack et problèmes sur la 2e. */
  .mv-chips { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:3px 0 2px; }
  .mv-name { font-size:13.5px; font-weight:600; color:var(--foreground); white-space:nowrap; overflow:hidden; display:flex; align-items:center; gap:6px; }
  .mv-name > span { overflow:hidden; text-overflow:ellipsis; }
  .mv-name .pin { color:var(--state-busy, #e3a73b); flex-shrink:0; display:inline-flex; }
  .mv-meta { font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; }
  .mv-st { display:flex; gap:6px; align-items:center; }
  .mv-ic { display:inline-flex; align-items:center; gap:4px; color:var(--success); }
  .mv-tag { display:inline-flex; align-items:center; gap:4px; font:inherit; font-size:11px; font-weight:600; padding:2px 7px; border:0; border-radius:999px; white-space:nowrap; }
  .mv-tag.warn { color:var(--warn); background:color-mix(in srgb, var(--warn) 13%, transparent); }
  button.mv-tag { cursor:pointer; }
  .mv-tag.mod { color:var(--warn); background:color-mix(in srgb, var(--warn) 13%, transparent); margin-right:6px; }
  .mv-tag.copy { color:var(--muted); background:color-mix(in srgb, var(--muted) 18%, transparent); margin-right:6px; }
  .play-modwarn { font-size:12.5px; line-height:1.45; padding:9px 11px; border-radius:var(--radius-m); background:color-mix(in srgb, var(--warn) 12%, transparent); border:1px solid color-mix(in srgb, var(--warn) 35%, transparent); margin:8px 0 6px; }
  .play-modwarn b { display:block; color:var(--warn); margin-bottom:2px; }
  .play-row .modl { color:var(--warn); font-weight:600; }
  .cf-box { font-size:12.5px; line-height:1.45; padding:9px 11px; border-radius:var(--radius-m); background:color-mix(in srgb, var(--success) 11%, transparent); border:1px solid color-mix(in srgb, var(--success) 35%, transparent); margin:8px 0 6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .cf-box > span { flex:1 1 260px; }
  .cf-box .join-btn { margin:0; padding:6px 12px; font-size:12.5px; }
  .cf-head { display:flex; gap:12px; align-items:center; margin:4px 0 10px; }
  .cf-head img { width:48px; height:48px; border-radius:10px; flex-shrink:0; }
  .cf-head b { display:block; font-size:15px; }
  .cf-head small { color:var(--muted); font-size:12px; }
  .cf-src { display:inline-flex; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; color:var(--muted); background:color-mix(in srgb, var(--muted) 16%, transparent); margin-right:6px; }
  .cf-lines { display:grid; gap:6px; margin:0 0 10px; padding:0; list-style:none; font-size:13px; line-height:1.45; }
  .cf-lines li { display:flex; gap:8px; }
  .cf-lines li > i { font-style:normal; flex-shrink:0; width:18px; text-align:center; }
  .cf-lines .hand { color:var(--warn); }
  .cf-sub { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:12px 0 4px; }
  .cf-steps { display:grid; gap:8px; margin:6px 0 10px; }
  .cf-step { display:grid; grid-template-columns:20px 1fr auto; gap:8px; align-items:center; font-size:13px; }
  .cf-step .ic { text-align:center; color:var(--muted); }
  .cf-step.done .ic { color:var(--success); }
  .cf-step.run .ic { color:var(--accent); }
  .cf-step .n { color:var(--muted); font-variant-numeric:tabular-nums; font-size:12px; }
  .cf-bar { grid-column:2 / -1; height:6px; border-radius:99px; background:color-mix(in srgb, var(--muted) 20%, transparent); overflow:hidden; }
  .cf-bar i { display:block; height:100%; background:var(--accent); transition:width .2s; }
  /* Progression des imports (27/10) : rond, barre sans fin (taille inconnue), détail, barre générale. */
  .cf-bar.ind { position:relative; }
  .cf-bar.ind i { position:absolute; top:0; bottom:0; width:35%; transition:none; animation:ip-ind 1.3s ease-in-out infinite; }
  @keyframes ip-ind { from { left:-35%; } to { left:100%; } }
  .ip-spin { width:13px; height:13px; border-radius:50%; border:2px solid color-mix(in srgb, var(--accent) 25%, transparent); border-top-color:var(--accent); display:inline-block; vertical-align:middle; animation:ip-spin .8s linear infinite; }
  @keyframes ip-spin { to { transform:rotate(360deg); } }
  .sk { display:block; border-radius:6px; background:linear-gradient(90deg, color-mix(in srgb, var(--muted) 14%, transparent) 25%, color-mix(in srgb, var(--muted) 26%, transparent) 50%, color-mix(in srgb, var(--muted) 14%, transparent) 75%); background-size:200% 100%; animation:sk-move 1.3s ease-in-out infinite; }
  @keyframes sk-move { from { background-position:100% 0; } to { background-position:-100% 0; } }
  @media (prefers-reduced-motion: reduce) { .sk { animation:none; } }
  .sk-page .pk-row { grid-template-columns:32px minmax(0,1fr) 128px; }
  .sk-page .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
  .ip-sub { grid-column:2 / -1; font-size:11.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-variant-numeric:tabular-nums; margin-top:-3px; }
  .ip-all { margin:4px 0 12px; display:grid; gap:5px; }
  .ip-all .ip-row { display:flex; justify-content:space-between; gap:10px; font-size:12.5px; font-variant-numeric:tabular-nums; }
  .ip-all .ip-row span:last-child { color:var(--muted); }
  .ip-all .track { height:8px; border-radius:99px; background:color-mix(in srgb, var(--muted) 20%, transparent); overflow:hidden; }
  .ip-all .track i { display:block; height:100%; background:var(--accent); transition:width .25s; }
  .cf-man { border:1px solid var(--border); border-radius:var(--radius-m); max-height:190px; overflow:auto; margin:6px 0 8px; }
  .cf-man-row { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:10px; align-items:center; padding:7px 10px; border-top:1px solid var(--border); font-size:13px; }
  .cf-man-row:first-child { border-top:0; }
  .cf-man-row .fn { display:block; font-size:11.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cf-man-row .st { font-size:12px; color:var(--muted); white-space:nowrap; }
  .cf-man-row.ok .st { color:var(--success); font-weight:600; }
  .cf-man-row .link-btn { margin:0; font-size:12px; white-space:nowrap; }
  .cf-man-note { font-size:12.5px; line-height:1.45; color:var(--muted); margin:0; }
  .wz-list { display:grid; gap:8px; margin:10px 0; }
  .wz-row { display:grid; grid-template-columns:22px minmax(0,1fr) auto; gap:10px; align-items:start; padding:10px 12px; border:1px solid var(--border); border-radius:var(--radius-m); }
  .wz-row .ic { font-size:14px; line-height:20px; text-align:center; color:var(--warn); }
  .wz-row.done .ic { color:var(--success); }
  .wz-row b { font-weight:600; font-size:13px; display:block; }
  .wz-row small { display:block; font-size:12px; color:var(--muted); margin-top:2px; line-height:1.4; }
  .wz-row .how { font-size:12px; margin-top:4px; }
  .wz-row .how.mr { color:var(--success); }
  .wz-row .how.cf { color:var(--warn); }
  .wz-row .wz-file { color:var(--foreground); }
  .wz-row .wz-file code, .wz-wrong code { font-family:ui-monospace,"Cascadia Mono",Consolas,monospace; font-size:11.5px; overflow-wrap:anywhere; }
  .wz-row .wz-file code { font-weight:600; }
  .wz-vers { display:flex; flex-direction:column; gap:4px; }
  .wz-ver { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; align-items:center; padding:4px 0; }
  .wz-ver code { font-family:ui-monospace,"Cascadia Mono",Consolas,monospace; font-size:11.5px; overflow-wrap:anywhere; }
  .wz-ver .cur { font-size:10.5px; font-weight:700; color:var(--muted); }
  .wz-wrong { display:block; margin-top:6px; padding:6px 8px; border-radius:8px; font-size:11.5px; line-height:1.4; color:var(--danger); background:color-mix(in srgb, var(--danger) 12%, transparent); }
  .wz-tag { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; white-space:nowrap; }
  .wz-tag.auto { color:var(--success); background:color-mix(in srgb, var(--success) 13%, transparent); }
  .wz-tag.hand { color:var(--warn); background:color-mix(in srgb, var(--warn) 13%, transparent); }
  .wz-st { font-size:12px; font-weight:600; white-space:nowrap; text-align:right; display:flex; flex-direction:column; gap:6px; align-items:flex-end; }
  .wz-st.ok { color:var(--success); }
  .om-tag { background:var(--accent); color:#fff; }
  .tp-tag { background:var(--state-busy); color:#fff; margin-left:6px; }
  .wz-acts { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; align-items:center; }
  .wz-acts .btn-secondary, .wz-panel .btn-secondary, .wz-panel .join-btn, .wz-hit button { margin:0; padding:5px 10px; font-size:12px; }
  .wz-acts .wz-off { margin:0 0 0 4px; padding:0; font-size:12px; color:var(--warn); }
  .wz-panel { display:flex; flex-direction:column; gap:8px; margin-top:8px; padding:10px; border-radius:10px; background:color-mix(in srgb, var(--foreground) 4%, transparent); border:1px solid var(--border); }
  .wz-panel > span:first-child { font-size:12.5px; }
  .wz-panel small { color:var(--muted); font-size:11.5px; }
  .wz-panel-b { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
  .wz-sr { display:flex; gap:8px; align-items:center; }
  .wz-sr input { flex:1; min-width:0; padding:6px 10px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:inherit; font:inherit; font-size:12.5px; }
  .wz-src { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; color:#fff; }
  .wz-src.mr { background:#1bd96a; color:#0b2a17; } .wz-src.cf { background:#f16436; }
  .wz-res { display:flex; flex-direction:column; gap:6px; }
  .wz-hit { display:grid; grid-template-columns:28px minmax(0,1fr) auto; gap:10px; align-items:center; }
  .wz-hit img, .wz-ph { width:28px; height:28px; border-radius:6px; object-fit:cover; }
  .wz-ph { display:flex; align-items:center; justify-content:center; background:var(--border); font-weight:700; font-size:12px; }
  .wz-hit .t { display:flex; flex-direction:column; min-width:0; } .wz-hit .t b { font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wz-hit .bad { font-size:11px; color:var(--muted); }
  .pk-card { cursor:pointer; transition:border-color .15s, background .15s; }
  .pk-card:hover { border-color:color-mix(in srgb, var(--accent) 45%, var(--border)); }
  .pk-page { display:flex; flex-direction:column; gap:14px; min-width:0; }
  .pk-back { align-self:flex-start; margin:0; padding:0; font-size:12.5px; }
  .pk-top { display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
  .pk-ic { width:56px; height:56px; border-radius:14px; display:grid; place-items:center; background:color-mix(in srgb, var(--accent) 16%, var(--surface)); color:var(--accent); flex-shrink:0; }
  .pk-title { flex:1 1 280px; min-width:0; }
  .pk-title h2 { margin:0; font-size:20px; display:flex; align-items:center; gap:8px; }
  .pk-title p { margin:2px 0 0; color:var(--muted); font-size:12.5px; font-variant-numeric:tabular-nums; }
  .pk-acts { display:flex; gap:8px; align-items:center; }
  .pk-acts .join-btn, .pk-acts .btn-secondary { margin:0; }
  .pk-check { display:flex; gap:10px; align-items:center; flex-wrap:wrap; font-size:13px; padding:9px 12px; border-radius:var(--radius-m); }
  .pk-check.ok { color:var(--success); background:color-mix(in srgb, var(--success) 11%, transparent); border:1px solid color-mix(in srgb, var(--success) 30%, transparent); }
  .pk-check.bad { background:color-mix(in srgb, var(--warn) 12%, transparent); border:1px solid color-mix(in srgb, var(--warn) 38%, transparent); }
  .pk-check.bad b { color:var(--warn); }
  .pk-check > span { flex:1 1 300px; }
  .pk-check .join-btn { margin:0; padding:5px 12px; font-size:12.5px; }
  .pk-tabs { display:flex; gap:2px; border-bottom:1px solid var(--border); overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; }
  .pk-tab { font:inherit; font-size:13px; padding:8px 12px; border:0; background:none; color:var(--muted); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; white-space:nowrap; }
  .pk-tab[aria-selected="true"] { color:var(--foreground); border-bottom-color:var(--accent); font-weight:600; }
  .pk-tab small { font-size:11px; color:var(--muted); margin-left:4px; font-weight:500; }
  .pk-tools { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .pk-tools .play-in { height:30px; flex:1 1 180px; max-width:260px; }
  .pk-chip { font:inherit; font-size:12px; padding:4px 10px; border-radius:999px; border:1px solid var(--border); background:transparent; color:var(--foreground); cursor:pointer; }
  .pk-chip[aria-pressed="true"] { background:var(--foreground); color:var(--background, var(--surface)); border-color:var(--foreground); }
  .pk-tools .sp { flex:1; }
  .pk-tools .join-btn, .pk-tools .btn-secondary { margin:0; padding:5px 12px; font-size:12.5px; }
  .pk-sec { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin:6px 0 -6px; display:flex; gap:8px; align-items:baseline; }
  .pk-sec span { text-transform:none; letter-spacing:0; font-weight:500; }
  .pk-list { border:1px solid var(--border); border-radius:var(--radius-m); background:var(--surface); }
  /* Colonnes de largeur fixe : la source et la version restent alignées d'une ligne à l'autre. */
  .pk-row { display:grid; grid-template-columns:32px minmax(0,1fr) 128px 290px 64px; gap:10px; align-items:center; padding:8px 12px; border-top:1px solid var(--border); }
  .pk-row:first-child { border-top:0; }
  .pk-row.off { opacity:.55; }
  .pk-row.bad { background:color-mix(in srgb, var(--warn) 8%, transparent); }
  .pk-av { width:32px; height:32px; border-radius:8px; display:grid; place-items:center; font-weight:700; font-size:13px; color:#fff; }
  .pk-nm { min-width:0; }
  .pk-nm b { font-weight:600; font-size:13.5px; }
  .pk-nm small { display:block; color:var(--muted); font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pk-nm .need { color:var(--warn); }
  .pk-src { font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:999px; white-space:nowrap; }
  .pk-src.mr { color:var(--success); background:color-mix(in srgb, var(--success) 13%, transparent); }
  .pk-src.cf { color:var(--warn); background:color-mix(in srgb, var(--warn) 13%, transparent); }
  .pk-ver { display:flex; align-items:center; gap:6px; justify-content:flex-end; min-width:0; }
  .pk-row > .pk-src { justify-self:start; }
  .pk-row > .pk-end { justify-self:end; }
  .pk-ver select { height:30px; padding:0 26px 0 8px; line-height:normal; font-size:12px; width:170px; max-width:170px; }
  .pk-up { font-size:10.5px; font-weight:700; color:var(--accent); white-space:nowrap; }
  /* 02/11 (Rushi, version A) : la pastille suit le nom de mod le plus long (--pk-nmw, plafonné) et la
     version prend le reste ; un nom de fichier trop long finit par « … » au lieu de recouvrir la pastille. */
  .pk-mods .pk-row { grid-template-columns:32px var(--pk-nmw,220px) var(--pk-srcw,96px) minmax(0,1fr) 64px; }
  .pk-mods .pk-nm b { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pk-mods .pk-up { overflow:hidden; text-overflow:ellipsis; min-width:0; }
  .pk-mods .pk-ver select, .pk-mods .pk-ver .btn-secondary { flex:none; }
  .pk-empty { padding:18px 12px; text-align:center; font-size:12.5px; color:var(--muted); }
  .pk-sw { width:34px; height:20px; border-radius:99px; border:0; background:color-mix(in srgb, var(--muted) 35%, transparent); position:relative; cursor:pointer; padding:0; }
  .pk-sw::after { content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:left .15s; }
  .pk-sw[aria-checked="true"] { background:var(--accent); }
  .pk-sw[aria-checked="true"]::after { left:16px; }
  .pk-sw:disabled { cursor:not-allowed; opacity:.6; }
  /* Ronds de choix bien visibles : cercle plus grand, rempli de la couleur d'accent quand il est choisi,
     et la ligne choisie surlignée. */
  .pk-row input[type=radio], .play-row input[type=radio] { appearance:none; -webkit-appearance:none; width:18px; height:18px; margin:0; flex:none; border:2px solid color-mix(in srgb, var(--muted) 70%, transparent); border-radius:50%; background:transparent; cursor:pointer; display:inline-grid; place-content:center; transition:border-color .15s; }
  .pk-row input[type=radio]::before, .play-row input[type=radio]::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--accent); transform:scale(0); transition:transform .12s; }
  .pk-row input[type=radio]:checked, .play-row input[type=radio]:checked { border-color:var(--accent); }
  .pk-row input[type=radio]:checked::before, .play-row input[type=radio]:checked::before { transform:scale(1); }
  .pk-row input[type=radio]:focus-visible, .play-row input[type=radio]:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  label.pk-row:has(input[type=radio]:checked) { background:color-mix(in srgb, var(--accent) 10%, transparent); box-shadow:inset 3px 0 0 var(--accent); }
  .pk-end { display:inline-flex; align-items:center; gap:8px; justify-content:flex-end; }
  /* Poubelle : taille fixe (icône dessinée, pas un emoji) pour que les ronds et interrupteurs restent alignés. */
  .pk-del { border:0; background:none; cursor:pointer; padding:0; width:28px; height:28px; flex:none; display:inline-grid; place-items:center; border-radius:6px; color:var(--muted); }
  .pk-del-sp { width:28px; height:28px; flex:none; display:inline-block; }
  .pk-del:hover { background:color-mix(in srgb, var(--danger, #e5484d) 14%, transparent); color:var(--danger, #e5484d); }
  .pk-lock { font-size:12px; color:var(--muted); width:34px; text-align:center; cursor:help; }
  .pk-note { font-size:12.5px; color:var(--muted); line-height:1.45; margin:0; }
  .pk-files .pk-row { grid-template-columns:32px minmax(0,1fr) 90px auto; }
  .fx-tools { flex-wrap:wrap; gap:8px; }
  .fx-tools .fx-sc, .fx-tools [data-fx-win] { margin:0; padding:6px 12px; font-size:12.5px; }
  .fx-bar { display:flex; align-items:center; gap:8px; margin:0 0 10px; flex-wrap:wrap; }
  .fx-up { width:30px; height:30px; border-radius:8px; border:1px solid var(--border); background:var(--surface-raised); color:var(--foreground); cursor:pointer; font-size:15px; }
  .fx-up:disabled { opacity:.4; cursor:default; }
  .fx-crumbs { flex:1; min-width:160px; display:flex; align-items:center; flex-wrap:wrap; gap:2px; padding:5px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface-raised); font-size:13px; }
  .fx-crumb { border:0; background:none; color:var(--foreground); cursor:pointer; padding:1px 4px; border-radius:5px; font:inherit; }
  .fx-crumb:hover { background:color-mix(in srgb, var(--accent) 15%, transparent); }
  .fx-crumb:last-child { font-weight:600; }
  .fx-sep { color:var(--muted); }
  .fx-name { border:0; background:none; padding:0; text-align:left; cursor:pointer; color:inherit; font:inherit; min-width:0; display:flex; flex-direction:column; }
  .fx-name b { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .fx-name small { color:var(--muted); font-size:12px; }
  /* Survol (27/10, demande de Rushi) : cadre bleu léger sur la ligne, dans tous les onglets de la page. */
  .pk-list .pk-row { position:relative; border-radius:8px; transition:background .12s, box-shadow .12s; }
  .pk-list .pk-row:hover, .pk-list .pk-row:focus-within { background:color-mix(in srgb, var(--accent) 9%, transparent); box-shadow:inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 70%, transparent); }
  .pk-list .pk-row:hover + .pk-row, .pk-list .pk-row:focus-within + .pk-row { border-top-color:transparent; }
  /* Pack Omniscient : menu ⚙, génération, barre des versions. */
  .om-exp{position:relative;display:inline-flex}
  .om-gear{font-size:18px;line-height:1;padding:8px 12px;min-width:42px}
  .om-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:60;min-width:300px;padding:6px;border-radius:12px;border:1px solid var(--border);background:var(--card,var(--background));box-shadow:0 12px 32px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:2px}
  .om-menu[hidden]{display:none}
  .om-menu button{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:2px;padding:9px 11px;border-radius:8px;font-size:13px}
  .om-menu button:hover{background:color-mix(in srgb,var(--accent) 12%,transparent)}
  .om-mh{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:6px 11px 2px}
  .om-wl{display:flex;flex-direction:column;gap:2px;max-height:200px;overflow:auto}
  .om-menu small{color:var(--muted);font-size:11.5px}
  .om-menu hr{border:0;border-top:1px solid var(--border);margin:4px 2px}
  .om-rmopt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;margin-top:8px;border:1px solid var(--border);border-radius:10px;cursor:pointer}
  .om-rmopt.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent)}
  .om-rmopt span{display:flex;flex-direction:column;gap:2px}.om-rmopt small{color:var(--muted);font-size:12px}
  .om-rmlist{margin-top:8px;max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:6px}
  .om-rmv{display:flex;gap:10px;align-items:center;padding:5px 6px;border-radius:7px;cursor:pointer;font-size:13px}.om-rmv:hover{background:color-mix(in srgb,var(--accent) 8%,transparent)}
  .om-rmv small{color:var(--muted);margin-left:auto;font-size:12px}
  .om-rmw{display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px;cursor:pointer}
  .om-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .om-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 6px 6px 11px;border-radius:999px;border:1px solid var(--border);font-size:12.5px;font-weight:600}
  .om-chip button{all:unset;cursor:pointer;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px}
  .om-chip button:hover{background:color-mix(in srgb,var(--danger,#e5484d) 18%,transparent);color:var(--foreground)}
  .om-chip.base{border-color:var(--accent);color:var(--accent);padding-right:11px;background:color-mix(in srgb,var(--accent) 8%,transparent)}
  .om-plus{all:unset;cursor:pointer;width:32px;height:30px;border-radius:999px;border:1px dashed var(--accent);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700}
  .om-plus:hover{background:color-mix(in srgb,var(--accent) 12%,transparent)}
  .om-pop{margin-top:8px;padding:10px;border-radius:12px;border:1px solid var(--border);background:color-mix(in srgb,var(--foreground) 3%,transparent)}
  .om-plist{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;max-height:140px;overflow:auto}
  .om-plist button{all:unset;cursor:pointer;padding:5px 10px;border-radius:8px;border:1px solid var(--border);font-size:12.5px}
  .om-plist button:hover{border-color:var(--accent);color:var(--accent)}
  .om-sw{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:-4px 0 14px;padding:10px 12px;border-radius:12px;border:1px solid var(--border)}
  .om-swl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
  .om-swl small{text-transform:none;letter-spacing:0;font-weight:500;margin-left:6px}
  .om-swr{display:flex;flex-wrap:wrap;gap:6px;flex:1}
  .om-sv{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid var(--border);font-size:12.5px;font-weight:600}
  .om-sv small{font-size:10.5px;font-weight:500;color:var(--warn)}
  .om-sv small.ok{color:var(--success)}
  .om-sv i{font-style:normal;color:var(--warn);font-size:11px}
  .om-sv.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
  .om-swn{flex-basis:100%;font-size:11.5px;color:var(--muted)}
  .om-job{margin:0 0 14px;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:color-mix(in srgb,var(--accent) 5%,transparent)}
  .om-jtop{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:13px}
  .om-jsum{color:var(--muted);font-size:12px;flex:1;min-width:180px}
  .om-jacts{display:flex;gap:10px;align-items:center}
  .om-bar{height:5px;border-radius:99px;background:color-mix(in srgb,var(--foreground) 10%,transparent);margin-top:8px;overflow:hidden}
  .om-bar span{display:block;height:100%;background:var(--accent);transition:width .4s}
  .om-jlist{margin-top:10px;max-height:220px;overflow:auto}
  .om-modal h3{margin:0 0 4px}.om-modal .sub{color:var(--muted);font-size:13px;margin:0 0 14px;line-height:1.45}
  .om-sec{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:14px 0 8px}
  .om-vers{display:flex;flex-wrap:wrap;gap:6px}
  .om-vers label{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;border:1px solid var(--border);font-size:12.5px;cursor:pointer}
  .om-vers label.base{border-color:var(--accent);color:var(--accent);cursor:default}
  .om-mods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
  .om-mods label{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:1px solid var(--border);font-size:12.5px;cursor:pointer;user-select:none}
  .om-sec-row{display:flex;align-items:baseline;gap:10px;margin:14px 0 8px}.om-sec-row .om-sec{margin:0}
  .om-mods label.keep{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent)}
  .om-mods small{margin-left:auto;color:var(--muted);font-size:11px}
  .om-note{font-size:12px;color:var(--muted);line-height:1.5;margin:8px 0 0}
  .om-rep{display:flex;flex-direction:column;gap:6px}
  .om-row{display:grid;grid-template-columns:22px 64px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 12px;border-radius:10px;border:1px solid var(--border);font-size:12.5px}
  .om-row .v{font-weight:700}.om-row .d{color:var(--muted);font-size:12px;line-height:1.4}
  .om-row.ok .i{color:var(--success)}.om-row.part .i{color:var(--warn)}.om-row.no{opacity:.65}.om-row.no .i{color:var(--danger,#e5484d)}
  .om-row.run .i{color:var(--muted)}
  .om-row.same{opacity:.7}.om-row.same .i{color:var(--muted)}.om-row.upd .i{color:var(--accent)}
  .om-sum{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;margin:0 0 10px}.om-sum b{font-size:15px}
  .om-file{display:flex;gap:12px;align-items:center;padding:12px;border-radius:12px;border:1px solid var(--border);margin:6px 0}
  .om-file .ic{width:40px;height:40px;border-radius:10px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
  .om-file small{display:block;color:var(--muted);font-size:12px}
  .om-steps{margin:8px 0 0;padding-left:18px;font-size:12.5px;line-height:1.6}

  .fx-name:focus-visible { outline:none; }
  .fx-row .pk-end { display:flex; align-items:center; gap:10px; }
  .fx-warn { border-left:3px solid #e3a008; padding:6px 10px; background:color-mix(in srgb, #e3a008 10%, transparent); border-radius:6px; margin:0 0 10px; }
  .fx-ed { width:100%; height:min(60vh,520px); box-sizing:border-box; resize:vertical; font:12.5px/1.5 ui-monospace, Consolas, "Cascadia Mono", monospace; background:var(--surface-sunken, var(--surface-raised)); color:var(--foreground); border:1px solid var(--border); border-radius:8px; padding:10px 12px; white-space:pre; overflow:auto; tab-size:2; }
  .fx-msg { margin:6px 0 0; min-height:1em; font-size:12.5px; color:#e3a008; }
  .fx-img { display:grid; place-items:center; background:#000; border-radius:8px; overflow:hidden; max-height:65vh; }
  .fx-img img { max-width:100%; max-height:65vh; display:block; }
  .pk-files .pk-av { background:color-mix(in srgb, var(--muted) 18%, transparent); color:var(--muted); font-size:15px; }
  @media (max-width: 760px) { .pk-row, .pk-mods .pk-row { grid-template-columns:32px minmax(0,1fr) auto; } .pk-row .pk-src, .pk-row .pk-ver { display:none; } }
  .nb-origin { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; color:var(--success); background:color-mix(in srgb, var(--success) 14%, transparent); white-space:nowrap; cursor:help; }
  .nl-links { display:flex; justify-content:space-between; align-items:center; margin-top:10px; }
  .nl-links .link-btn { margin:0; padding-left:0; padding-right:0; }
  .nl-forever { color:var(--danger, #e5484d) !important; font-weight:600; }
  /* Changement de version (27/10) */
  .nb-ver { font-size:11px; font-weight:600; padding:2px 7px; border-radius:6px; color:var(--muted); background:color-mix(in srgb, var(--muted) 16%, transparent); font-variant-numeric:tabular-nums; white-space:nowrap; }
  .nb-ver.cur { color:var(--accent-2, var(--accent)); background:color-mix(in srgb, var(--accent) 16%, transparent); }
  .nb-sep { padding:5px 10px; font-size:11.5px; font-weight:600; color:var(--warn); background:color-mix(in srgb, var(--warn) 9%, transparent); border-bottom:1px solid var(--border); }
  .nb-guard { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; color:var(--accent-2, var(--accent)); background:color-mix(in srgb, var(--accent) 14%, transparent); white-space:nowrap; cursor:help; margin-left:4px; }
  .mv-tag.up { color:var(--accent-2, var(--accent)); background:color-mix(in srgb, var(--accent) 14%, transparent); margin-right:6px; }
  .vu-box { text-align:left; max-width:540px; }
  .vu-upbtn { font:inherit; font-size:12px; font-weight:600; padding:5px 10px; border-radius:8px; border:1px solid color-mix(in srgb, var(--accent) 45%, transparent); color:var(--accent-2, var(--accent)); background:color-mix(in srgb, var(--accent) 10%, transparent); cursor:pointer; white-space:nowrap; }
  .vu-upbtn:hover { background:color-mix(in srgb, var(--accent) 18%, transparent); }
  .vu-wl { border:1px solid var(--border); border-radius:10px; overflow:hidden; margin-bottom:8px; }
  .vu-wl > div { display:grid; grid-template-columns:auto 1fr auto auto; gap:10px; align-items:center; padding:7px 11px; font-size:13px; border-bottom:1px solid var(--border); }
  .vu-wl > div:last-child { border-bottom:0; }
  .vu-wl .s { color:var(--muted); font-size:12px; font-variant-numeric:tabular-nums; }
  .vu-wl .g { color:var(--success); font-size:12px; font-weight:600; }
  .vu-mods { padding:9px 11px; border:1px solid color-mix(in srgb, var(--warn) 40%, transparent); background:color-mix(in srgb, var(--warn) 8%, transparent); border-radius:10px; font-size:13px; line-height:1.45; margin-bottom:8px; }
  .vu-mods label { display:flex; gap:8px; align-items:flex-start; margin-top:6px; cursor:pointer; }
  .vu-mods input { margin-top:3px; accent-color:var(--accent); }
  .vu-now { font-size:13px; color:var(--muted); margin:2px 0 14px; }
  .vu-lbl { font-size:12.5px; font-weight:600; display:block; margin:0 0 6px; }
  .vu-sel { width:100%; height:36px; border-radius:9px; border:1px solid var(--border); background:var(--surface-2, var(--surface)); color:var(--foreground); font:inherit; font-size:13.5px; padding:0 10px; }
  .vu-warn { margin:14px 0 12px; padding:11px 13px; border-radius:10px; font-size:13px; line-height:1.5; color:var(--foreground); background:color-mix(in srgb, var(--danger, #e5484d) 11%, transparent); border:1px solid color-mix(in srgb, var(--danger, #e5484d) 35%, transparent); }
  .vu-warn b { color:var(--danger, #e5484d); }
  .vu-do { font-size:12.5px; font-weight:600; margin:0 0 6px; color:var(--muted); }
  .vu-chk { display:flex; gap:9px; align-items:flex-start; padding:9px 11px; border:1px solid var(--border); border-radius:10px; margin-bottom:7px; font-size:13px; line-height:1.45; cursor:pointer; }
  .vu-chk input { margin-top:3px; accent-color:var(--accent); }
  .vu-chk.locked { cursor:default; background:color-mix(in srgb, var(--accent) 7%, transparent); }
  .vu-chk small { display:block; color:var(--muted); font-size:12px; }
  .vu-steps { list-style:none; margin:10px 0 4px; padding:0; }
  .vu-steps li { display:flex; align-items:center; gap:10px; padding:7px 0; font-size:13.5px; color:var(--muted); }
  .vu-steps li.on { color:var(--foreground); font-weight:600; }
  .vu-steps li.done { color:var(--foreground); }
  .vu-steps i { width:20px; height:20px; border-radius:50%; display:inline-grid; place-items:center; font-style:normal; font-size:11px; border:2px solid var(--border); flex:none; }
  .vu-steps li.done i { background:var(--success); border-color:var(--success); color:#fff; }
  .vu-steps li.done i::after { content:"✓"; font-weight:700; }
  .vu-steps li.fail { color:var(--danger, #e5484d); }
  .vu-steps li.fail i { border-color:var(--danger, #e5484d); }
  .vu-steps li.fail i::after { content:"✕"; color:var(--danger, #e5484d); font-weight:700; }
  .vu-steps li.on i { border-color:var(--accent); border-top-color:transparent; animation:vu-spin .8s linear infinite; }
  @keyframes vu-spin { to { transform:rotate(360deg); } }
  .vu-bar { height:6px; border-radius:99px; background:color-mix(in srgb, var(--muted) 20%, transparent); overflow:hidden; margin:2px 0 0 30px; }
  .vu-bar > span { display:block; height:100%; background:var(--accent); width:0; transition:width .15s; }
  .vu-ok { padding:11px 13px; border-radius:10px; font-size:13px; line-height:1.5; background:color-mix(in srgb, var(--success) 12%, transparent); border:1px solid color-mix(in srgb, var(--success) 35%, transparent); margin-top:8px; }
  .fv-box ul { margin:6px 0 10px 18px; padding:0; font-size:13px; line-height:1.55; }
  .fv-stop { font-size:13px; font-weight:700; line-height:1.45; padding:9px 11px; border-radius:var(--radius-m); color:var(--danger, #e5484d); background:color-mix(in srgb, var(--danger, #e5484d) 12%, transparent); border:1px solid color-mix(in srgb, var(--danger, #e5484d) 40%, transparent); margin:0 0 10px; }
  .cd-bar { height:8px; border-radius:999px; background:color-mix(in srgb, var(--danger, #e5484d) 15%, transparent); overflow:hidden; }
  .cd-bar i { display:block; height:100%; width:0; background:var(--danger, #e5484d); transition:width .1s linear; }
  .mv-row.gone img { filter:grayscale(1); opacity:.6; }
  .mv-row.gone .mv-meta { color:var(--warn); }
  .mp-box { max-width: 660px !important; text-align: left; max-height: calc(100vh - 48px); overflow: auto; }
  .mp-top { display:grid; grid-template-columns: minmax(0,1.3fr) minmax(0,.8fr); gap: 10px 12px; align-items:end; }
  .mp-top .field-label { margin: 0 0 4px; }
  .mp-loaders { display:flex; gap:6px; flex-wrap:wrap; grid-column: 1 / -1; align-items:center; }
  .mp-loaders > span { font-size:12px; color:var(--muted); margin-right:4px; }
  .mp-chip { font:inherit; font-size:12.5px; padding:5px 11px; border-radius:999px; border:1px solid var(--border); background:transparent; color:var(--foreground); cursor:pointer; }
  .mp-chip[aria-pressed="true"] { background:var(--accent); border-color:var(--accent); color:#fff; }
  .mp-world { margin:12px 0 0; padding:10px 12px; border-radius:var(--radius-m); background:color-mix(in srgb, var(--accent) 10%, transparent); border:1px solid color-mix(in srgb, var(--accent) 30%, transparent); font-size:12.5px; line-height:1.5; display:grid; gap:4px; }
  .mp-world b { font-size:13px; }
  .mp-world .mp-wrow { display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:space-between; }
  .mp-world .miss { color: var(--warn); }
  .mp-tabs { display:flex; gap:4px; margin:14px 0 8px; border-bottom:1px solid var(--border); }
  .mp-tab { font:inherit; font-size:13px; font-weight:600; padding:7px 12px; border:0; border-bottom:2px solid transparent; background:transparent; color:var(--muted); cursor:pointer; margin-bottom:-1px; }
  .mp-tab[aria-selected="true"] { color:var(--foreground); border-bottom-color:var(--accent); }
  .mp-tab .n { font-weight:500; color:var(--warn); }
  .mp-res { max-height: 176px; overflow:auto; border:1px solid var(--border); border-radius:var(--radius-m); margin-top:8px; }
  .mp-r { display:grid; grid-template-columns: 28px minmax(0,1fr) auto; gap:10px; align-items:center; padding:7px 10px; border-top:1px solid var(--border); font-size:13px; }
  .mp-r:first-child { border-top:0; }
  .mp-ic { width:28px; height:28px; border-radius:7px; display:grid; place-items:center; font-weight:700; font-size:12px; color:#fff; }
  .mp-r small { display:block; color:var(--muted); font-size:11.5px; }
  .mp-r .act { font:inherit; font-size:12px; font-weight:600; padding:5px 10px; border-radius:7px; border:1px solid var(--border); background:transparent; color:var(--accent-2, var(--accent)); cursor:pointer; white-space:nowrap; }
  .mp-r .act.on { color: var(--success); border-color: color-mix(in srgb, var(--success) 40%, transparent); }
  .mp-r .act:disabled { color: var(--muted); cursor: default; }
  .mp-r .st { font-size:12px; font-weight:600; white-space:nowrap; color: var(--warn); }
  .mp-r .st.ok { color: var(--success); }
  .mp-r .acts { display:flex; gap:8px; align-items:center; }
  .mp-r .mp-v { height:28px; font-size:12px; padding:0 24px 0 8px; line-height:normal; max-width:190px; }
  .mp-pill .v { color:var(--muted); font-variant-numeric:tabular-nums; }
  .mp-pill.auto { background:color-mix(in srgb, var(--accent) 12%, transparent); }
  .mp-cfinfo { font-size:12.5px; line-height:1.45; padding:9px 11px; border-radius:var(--radius-m); background:color-mix(in srgb, var(--warn) 11%, transparent); border:1px solid color-mix(in srgb, var(--warn) 32%, transparent); }
  .mp-in { margin-top:12px; }
  .mp-in h4 { margin:0 0 6px; font-size:13px; }
  .mp-pills { display:flex; flex-wrap:wrap; gap:6px; }
  .mp-pill { display:inline-flex; align-items:center; gap:6px; font-size:12px; padding:3px 4px 3px 10px; border-radius:999px; background:color-mix(in srgb, var(--muted) 16%, transparent); }
  .mp-pill.cf { background:color-mix(in srgb, var(--warn) 15%, transparent); }
  .mp-pill button { font:inherit; border:0; background:transparent; color:var(--muted); cursor:pointer; padding:0 5px; border-radius:99px; }
  .mp-note { font-size:12px; color:var(--muted); margin:8px 0 0; }
  .mp-warn { font-size:12.5px; color:var(--warn); margin:10px 0 0; }
  @media (max-width: 560px) { .mp-top { grid-template-columns: 1fr; } }
  .mv-tag.off { color:var(--muted); background:color-mix(in srgb, var(--muted) 18%, transparent); }
  .mv-tag.busy { color:var(--accent-2); background:color-mix(in srgb, var(--accent) 14%, transparent); }
  .mv-play { height:36px; min-width:36px; padding:0 10px; border-radius:999px; border:1px solid var(--accent); background:color-mix(in srgb, var(--accent) 16%, transparent); color:var(--accent-2, var(--accent)); display:inline-flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; font:inherit; font-size:13px; font-weight:600; white-space:nowrap; transition:background .12s, color .12s; }
  .mv-play .lbl { display:none; }
  .mv-row:hover .mv-play:not(:disabled) .lbl, .mv-row:focus-within .mv-play:not(:disabled) .lbl, .mv-play.big .lbl { display:inline; }
  .mv-row:hover .mv-play:not(:disabled), .mv-play:focus-visible, .mv-play.big:not(:disabled) { background:var(--accent); color:var(--accent-foreground, #fff); }
  .mv-play:disabled { opacity:.45; cursor:not-allowed; border-color:var(--border); background:transparent; color:var(--muted); }
  .mv-play.dl { border-color:var(--border); background:transparent; color:var(--foreground); }
  .mv-run { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 12px; border-radius:999px; font-size:12.5px; font-weight:600; color:var(--success); background:color-mix(in srgb, var(--success) 14%, transparent); }
  .mv-run i { width:8px; height:8px; border-radius:50%; background:var(--success); animation:mvp 1.2s infinite; }
  @keyframes mvp { 50% { opacity:.3; } }
  .mv-dots { width:32px; height:32px; border-radius:var(--radius-m); border:0; background:none; color:var(--muted); cursor:pointer; display:grid; place-items:center; margin-left:4px; }
  .mv-dots:hover, .mv-dots[aria-expanded=true] { background:color-mix(in srgb, var(--foreground) 10%, transparent); color:var(--foreground); }
  .mv-more { width:100%; margin-top:6px; font:inherit; font-size:12.5px; padding:8px; border-radius:var(--radius-m); border:1px dashed var(--border); background:none; color:var(--muted); cursor:pointer; }
  .mv-more:hover { color:var(--foreground); border-color:var(--accent); }
  .mv-empty { text-align:center; padding:24px 10px; font-size:13px; color:var(--muted); border:1px dashed var(--border); border-radius:var(--radius-l); }
  .mv-menu { position:fixed; z-index:250; min-width:230px; padding:6px; border-radius:var(--radius-l); border:1px solid var(--border); background:var(--surface); box-shadow:0 18px 48px -14px rgba(0,0,0,.6); display:grid; gap:1px; }
  .mv-menu button { font:inherit; font-size:13px; text-align:left; padding:8px 10px; border-radius:var(--radius-m); border:0; background:none; color:var(--foreground); cursor:pointer; display:flex; align-items:center; gap:8px; }
  .mv-menu button:hover, .mv-menu button:focus-visible { background:var(--surface-raised); outline:none; }
  .mv-menu .danger { color:var(--warn); }
  .mv-menu hr { border:0; border-top:1px solid var(--border); margin:4px 2px; }
  .mv-menu .sw { margin-left:auto; width:30px; height:17px; border-radius:9px; background:color-mix(in srgb, var(--foreground) 22%, transparent); position:relative; flex-shrink:0; }
  .mv-menu .sw::after { content:""; position:absolute; top:2px; left:2px; width:13px; height:13px; border-radius:50%; background:#fff; transition:transform .15s; }
  .mv-menu .sw.on { background:var(--success); }
  .mv-menu .sw.on::after { transform:translateX(13px); }
  `;
  document.head.appendChild(css);

  // --- Bouton du menu de gauche, sous « Serveurs » (Rushi 28/10 : Accueil, Serveurs, Jouer, Ma bibliothèque…) --
  const sidebar = document.getElementById("sidebar");
  const nav = document.createElement("button");
  nav.id = "nav-play";
  nav.type = "button";
  nav.className = "sidebar-btn";
  document.getElementById("nav-servers").after(nav);
  // Laboratoire (25/10) : l'onglet n'existe que si le site dit « visible » pour ce joueur ;
  // le badge « Bêta » suit l'état du mode Jouer (tout sauf « Pour tous »). Voir features.js.
  let playVisible = false;
  let worldsOn = false; // « Mondes en ligne » : sinon aucun appel au cloud, aucune fenêtre
  let betaBadge = true;
  nav.hidden = true;
  let feat = {};
  const on = (id) => playVisible && feat?.[id]?.visible === true;
  function applyFeatures(state) {
    feat = state || {};
    const f = state?.play || {};
    const wasVisible = playVisible;
    const wasWorlds = worldsOn;
    playVisible = f.visible === true;
    worldsOn = playVisible && state?.worlds?.visible === true;
    if (!worldsOn) {
      data.cloud = null;
      data.job = null;
      data.djob = null;
      try {
        renderActivity();
      } catch {
        /* pilule pas encore prête */
      }
    } else if (!wasWorlds) {
      api.cloud.downloadJob().then((j) => setDjob(j)).catch(() => {});
    }
    betaBadge = f.beta !== false;
    nav.hidden = !playVisible;
    drawNav();
    if (!playVisible) {
      if (!panel.hidden) {
        panel.hidden = true;
        nav.classList.remove("active");
        document.getElementById("nav-home")?.click();
      }
      homePanel?.querySelector(".play-home-section")?.remove();
    } else if (!wasVisible) {
      refresh().catch(() => {});
    }
  }
  function drawNav() {
    nav.title = betaBadge ? `${T("nav")} (${T("beta")})` : T("nav");
    nav.innerHTML = `${CUBE}<span class="sidebar-label">${esc(T("nav"))}</span>${betaBadge ? `<span class="sidebar-beta">${esc(T("beta"))}</span>` : ""}`;
  }
  drawNav();
  window.__pvMyPack = (o) => openMyPack(o);
  window.__playLaunchVersion = (id) => launch({ versionId: id }, null); // « Relancer le jeu » du catalogue de bugs

  const main = document.querySelector("main");
  const panel = document.createElement("div");
  panel.id = "play-panel";
  panel.className = "detail";
  panel.hidden = true;
  main.appendChild(panel);

  const OTHER_PANELS = ["home-panel", "status", "list", "list-toolbar", "list-title", "detail", "settings-panel", "account-panel", "favorites-panel", "recent-panel", "my-instances-panel", "friends-panel", "help-panel"];
  function showPlay() {
    for (const id of OTHER_PANELS) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
    try {
      updateGuestBanner(false);
    } catch {
      /* bandeau visiteur absent */
    }
    sidebar.querySelectorAll(".sidebar-btn").forEach((b) => b.classList.remove("active"));
    nav.classList.add("active");
    panel.hidden = false;
    refresh().then(maybeOfferCloud);
  }
  // Clic sur « Jouer » dans le menu (28/10, Rushi) : toujours la page principale de Jouer, même si
  // on avait laissé la page d'un pack ou « Tous mes mondes » ouverte.
  nav.addEventListener("click", () => {
    packPage = null;
    PJ.allView = false;
    panel.scrollTop = 0;
    showPlay();
  });
  // Une autre vue s'affiche (menu, lien, notification…) : l'onglet Jouer se cache.
  const hideObserver = new MutationObserver(() => {
    if (panel.hidden) return;
    if (OTHER_PANELS.some((id) => document.getElementById(id)?.hidden === false)) {
      panel.hidden = true;
      nav.classList.remove("active");
    }
  });
  for (const id of OTHER_PANELS) {
    const el = document.getElementById(id);
    if (el) hideObserver.observe(el, { attributes: true, attributeFilter: ["hidden"] });
  }
  sidebar.addEventListener("click", (e) => {
    const btn = e.target.closest(".sidebar-btn");
    if (btn && btn !== nav && btn.id !== "sidebar-toggle") nav.classList.remove("active");
  }, true);

  function toast(text) {
    document.querySelectorAll(".undo-toast.play").forEach((e) => e.remove());
    const el = document.createElement("div");
    el.className = "undo-toast play";
    el.setAttribute("role", "status");
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }
  function overlay(html, { className = "play-modal" } = {}) {
    const ov = document.createElement("div");
    ov.className = className;
    ov.innerHTML = html;
    document.body.appendChild(ov);
    const onKey = (e) => {
      if (e.key === "Escape" && !ov.dataset.locked) close();
    };
    const close = () => {
      ov.remove();
      document.removeEventListener("keydown", onKey, true);
    };
    document.addEventListener("keydown", onKey, true);
    ov.addEventListener("mousedown", (e) => {
      if (e.target === ov && !ov.dataset.locked) close();
    });
    return { ov, close, $: (sel) => ov.querySelector(sel) };
  }

  // --- Données ------------------------------------------------------------------------------
  const data = { versions: [], worlds: [], gone: [], packs: [], mcVersions: null, running: null, cloud: null, job: null, djob: null };
  async function loadPacks(force = false) {
    const r = await api.packs({ force }).catch(() => null);
    if (r) {
      data.packs = Array.isArray(r.packs) ? r.packs : [];
    }
  }
  let refreshSeq = 0;
  async function refresh() {
    if (!playVisible) return;
    // Deux lectures en même temps : seule la dernière compte, sinon une réponse lue avant un retrait
    // arrive après lui et fait réapparaître la tuile un instant (01/11, Rushi : « ça clignote »).
    const seq = ++refreshSeq;
    const [v, w] = await Promise.all([api.listVersions(), api.listWorlds()]);
    if (seq !== refreshSeq) return;
    data.versions = v?.versions || [];
    // Le launcher prévient dès que le dossier est retiré, avant la fin de l'effet : la tuile en cours de
    // retrait reste à sa place jusque-là (sinon les autres sautaient et le fantôme partait en 1re place).
    if (PJ.rm?.v && !data.versions.some((x) => x.id === PJ.rm.id)) data.versions.splice(Math.max(PJ.rm.at, 0), 0, PJ.rm.v);
    data.worlds = w?.worlds || [];
    // Première installation automatique : seulement après une vraie lecture de la liste.
    data.loaded = !!v?.versions;
    data.gone = w?.gone || [];
    // main.js ne connaît que la version lancée : on garde le monde lancé depuis sa ligne.
    const prevKey = data.running?.versionId === w?.running?.versionId ? data.running?.worldKey : null;
    data.running = w?.running ? { ...w.running, worldKey: prevKey || null } : null;
    if (!panel.hidden) render();
    injectHome();
    loadPacks().then(() => !panel.hidden && render());
    if (on("versionGuard") && !data.mcVersions) api.mcVersions().then((r) => { data.mcVersions = r?.versions || []; if (!panel.hidden) render(); });
    loadCloud().then(() => !panel.hidden && render());
  }
  api.onWorldsChanged(() => refresh());
  api.onCrashHelp?.((info) => playVisible && openCrashHelp(info));
  // Data packs en attente posés dans le premier monde de leur installation (28/10).
  api.onDpApplied?.((list) => (list || []).forEach((d) => toast(L() === "fr" ? `Data pack « ${d.name} » ajouté à « ${d.world} » (sauvegarde faite avant). Il marche dès la prochaine ouverture du monde.` : `Data pack “${d.name}” added to “${d.world}” (backup made first). It works the next time you open the world.`)));
  window.mchub.onGameState?.((running) => {
    if (!running) data.running = null;
    if (!panel.hidden) render();
  });

  // --- Rendu de l'onglet --------------------------------------------------------------------
  function header() {
    return `<div class="instances-header"><div><h2>${esc(T("nav"))}${betaBadge ? `<span class="play-beta-tag">${esc(T("beta"))}</span>` : ""}</h2><p class="join-note">${esc(T("sub"))}</p></div></div>`;
  }
  // Page d'une version : Mon pack et packs (Laboratoire « myPack »), vanilla (« vanillaPage »),
  // Pack Omniscient (« omniPack »), pack Omniscient publié (toujours, mods en lecture seule).
  const pageOn = (v) => !!v && (v.pack ? on("myPack") || v.pack.kind === "omnipub" : on("vanillaPage") || (!!v.omni && on("omniPack")));
  // « Test Omnipack » (31/10) : pack proposé installé par « Tester dans le launcher ».
  const testTag = (v) => (v?.testPack ? `<span class="play-beta-tag tp-tag">${esc(L() === "fr" ? "Test Omnipack" : "Omnipack test")}</span>` : "");
  function versionRow(v) {
    const label = v.name || v.minecraftVersion;
    const badge = (v.pack ? `<span class="instance-badge offline-available">${esc(packName(v.pack))}</span>` : `<span class="instance-badge paused">Vanilla</span>`)
      + testTag(v) + (v.problems ? `<span class="mv-tag warn">${esc(pkT("cardBad", { n: v.problems }))}</span>` : "");
    const isRunning = data.running?.versionId === v.id;
    return `<div class="instance-card${pageOn(v) ? " pk-card" : ""}" style="padding:10px 12px;" ${pageOn(v) ? `data-pack-card="${esc(v.id)}" title="${esc(PK().open)}"` : ""}>
      <span class="instance-card-icon">${CUBE.replace("<svg", '<svg width="20" height="20"')}</span>
      <div class="instance-card-body"><div class="instance-card-title"><h3>${esc(label)}</h3></div>
        <div class="mv-chips">${badge}</div>
        <p class="instance-card-meta">${v.name ? `${esc(v.minecraftVersion)} · ` : ""}${v.pack ? `${v.modCount} ${esc(T("mods"))} · ` : ""}${esc(v.lastPlayedAt ? T("lastPlayed", { t: ago(v.lastPlayedAt) }) : T("never"))}</p></div>
      <div class="instance-card-actions" style="display:flex;gap:6px;align-items:center;">
        <button type="button" class="link-btn" data-del-version="${esc(v.id)}" style="font-size:12px;">${esc(T("remove"))}</button>
        ${newerFor(v) && !v.keptCopyOf ? `<button type="button" class="vu-upbtn" data-up-version="${esc(v.id)}" title="${esc(L() === "fr" ? `Minecraft ${newerFor(v)} est sortie : mettre à jour cette installation (ses mondes sont sauvegardés avant)` : `Minecraft ${newerFor(v)} is out: update this installation (its worlds are backed up first)`)}">⬆ ${esc(L() === "fr" ? "Mettre à jour" : "Update")}</button>` : ""}
        <button type="button" class="join-btn" data-play-version="${esc(v.id)}" ${isRunning ? "disabled" : ""}>${esc(isRunning ? T("playing") : T("play"))}</button>
      </div>
    </div>`;
  }
  // Monde du cloud pas encore sur ce PC (autre PC du même compte, Supporter) : « Pas sur ce PC ».
  const downloading = (cw) => data.djob && !data.djob.done && data.djob.items.some((i) => i.worldId === cw.id && !i.done && !i.error);
  // Bandeau « Nouveau PC » : la taille exacte à télécharger ; la place libre est vérifiée avant.
  function remoteBannerHtml(cloudOnly) {
    const rem = cloudOnly.filter((cw) => !downloading(cw));
    if (!rem.length || (data.djob && !data.djob.done)) return "";
    const fr = L() === "fr";
    const n = rem.length;
    // Toutes les versions de chaque monde viennent sur ce PC : taille exacte de leurs .zip.
    const tot = rem.reduce((a, cw) => a + (cw.totalBytes || cw.sizeBytes || 0), 0);
    return `<div class="play-remote">
      <div><strong>${fr ? `${data.worlds.length ? "" : "Nouveau PC : "}${n} monde${n > 1 ? "s" : ""} t'attend${n > 1 ? "ent" : ""} dans le cloud` : `${data.worlds.length ? "" : "New PC: "}${n} world${n > 1 ? "s" : ""} waiting in the cloud`}</strong>
      <p>${fr ? `${sizeFmt(tot)} à télécharger, avec toutes leurs versions (les mêmes que sur le site) : il faut au moins cette place de libre sur ce PC. On vérifie la place avant de commencer. La version et le pack de chaque monde s'installent avec lui.` : `${sizeFmt(tot)} to download, with all their versions (the same as on the website): you need at least that much free space on this PC. We check the space before starting. Each world's version and pack install with it.`}</p></div>
      <button type="button" class="join-btn" data-cloud-download-all>↓ ${fr ? "Télécharger mes mondes" : "Download my worlds"}</button></div>`;
  }

  // --- Liste « Mes mondes » (variante B, choisie par Rushi le 25/10) ---------------------------
  // Lignes fines avec ▶ toujours visible ; sauvegardes, interrupteur, épingler, masquer, dossier et
  // cloud dans le menu « … ». Recherche et tri dès 8 mondes, filtres dès 16. Sections Récents (3),
  // Épinglés et Tous mes mondes qu'on ouvre et ferme ; mondes masqués et mondes seulement dans le
  // cloud repliés en bas. Épinglés, masqués, tri et sections ouvertes restent sur ce PC.
  const MV_ICON = {
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    dots: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z"/><path d="m9.5 13.5 2 2 3.5-3.5"/></svg>',
    cloudWarn: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z"/><path d="M12 11v3M12 16.3v.01"/></svg>',
    shieldOff: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 1.6-.8 3-1.9 4.1-3.2M19 13.5V6l-7-3"/><path d="m3 3 18 18"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2L3 9.4l6.2-.9z"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  };
  const MV_KEY = "omni-play-worlds";
  const mv = { q: "", filter: "all", ver: "", showAll: false, sort: "recent", pins: new Set(), hidden: new Set(), open: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(MV_KEY) || "{}");
    if (["recent", "name", "size"].includes(saved.sort)) mv.sort = saved.sort;
    if (Array.isArray(saved.pins)) mv.pins = new Set(saved.pins);
    if (Array.isArray(saved.hidden)) mv.hidden = new Set(saved.hidden);
    if (saved.open && typeof saved.open === "object") mv.open = saved.open;
  } catch {}
  function mvSave() {
    try {
      localStorage.setItem(MV_KEY, JSON.stringify({ sort: mv.sort, pins: [...mv.pins], hidden: [...mv.hidden], open: mv.open }));
    } catch {}
  }
  // Sections ouvertes par défaut, sauf les mondes masqués et ceux seulement dans le cloud (sauf
  // s'il n'y a aucun monde sur ce PC : on les montre).
  const mvOpen = (k, def = true) => (typeof mv.open[k] === "boolean" ? mv.open[k] : def);
  const mvCloudOf = (key) => data.cloud?.worlds?.find((x) => x.worldKey === key) || null;
  function mvSorted(list) {
    const a = [...list];
    if (mv.sort === "name") a.sort((x, y) => String(x.name).localeCompare(String(y.name), L()));
    else if (mv.sort === "size") a.sort((x, y) => (y.sizeBytes || 0) - (x.sizeBytes || 0));
    else a.sort((x, y) => (y.lastPlayed || 0) - (x.lastPlayed || 0));
    return a;
  }
  const mvVersion = (w) => w.lastVersionLabel?.minecraftVersion || w.minecraftVersion || "";
  const mvPack = (w) => (w.lastVersionLabel ? (w.lastVersionLabel.pack ? packName({ name: w.lastVersionLabel.pack }) : "Vanilla") : "");
  const mvNotCloud = (w) => !!data.cloud?.offer?.cloud && w.backup && !mvCloudOf(w.key);
  function mvFiltered() {
    const q = mv.q.trim().toLowerCase();
    return data.worlds.filter((w) => {
      if (q && !`${w.name} ${mvVersion(w)} ${mvPack(w)} ${w.lastVersionLabel?.name || ""}`.toLowerCase().includes(q)) return false;
      if (mv.filter === "notcloud" && !mvNotCloud(w)) return false;
      if (mv.filter === "off" && w.backup) return false;
      if (mv.ver && mvVersion(w) !== mv.ver) return false;
      return true;
    });
  }
  const mvSearching = () => !!(mv.q.trim() || mv.filter !== "all" || mv.ver);
  function mvMeta(w) {
    const lv = w.lastVersionLabel;
    const ver = lv ? lv.name || `${lv.minecraftVersion} · ${mvPack(w)}` : w.minecraftVersion || "";
    const bk = w.backups === 0 ? T("mvBk0") : w.backups === 1 ? T("mvBk1") : T("mvBk", { n: w.backups });
    return [ver, w.lastPlayed ? ago(w.lastPlayed) : "", bk, sizeFmt(w.sizeBytes)].filter(Boolean).map((s) => (s === bk ? `<span class="mv-bk">${esc(s)}</span>` : esc(s))).join(" · ");
  }
  function mvStatus(w) {
    const fr = L() === "fr";
    if (!w.backup) return `<span class="mv-tag off" title="${esc(T("bkpOffTip"))}">${MV_ICON.shieldOff}${esc(T("off"))}</span>`;
    const c = data.cloud;
    if (!c?.offer?.cloud) return "";
    if (data.job && !data.job.done && data.job.items.some((i) => i.key === w.key && !i.done)) return `<span class="mv-tag busy">☁ ${esc(T("sending"))}</span>`;
    const cw = mvCloudOf(w.key);
    if (cw?.split) return `<button type="button" class="mv-tag warn" data-split="${esc(w.key)}" title="${fr ? "Choisir laquelle continuer" : "Choose which to continue"}">⚠ ${esc(T("mvSplit"))}</button>`;
    if (cw?.restorePending) return `<span class="mv-tag warn" title="${esc(T("restorePending"))}">☁ …</span>`;
    if (!cw) return `<span class="mv-tag warn" title="${esc(T("notInCloud"))}">${MV_ICON.cloudWarn}${esc(T("notInCloud"))}</span>`;
    const n = cw.versionCount || 1;
    const tip = `${T("inCloud")} · ${T(n > 1 ? "cloudVers" : "cloudVer", { n })} · ${T("zipped", { s: sizeFmt(cw.sizeBytes) })}${w.lastBackupAt ? ` · ${T("saved", { t: ago(w.lastBackupAt) })}` : ""}`;
    return `<span class="mv-ic" title="${esc(tip)}" aria-label="${esc(T("inCloud"))}">${MV_ICON.cloud}</span>`;
  }
  function mvPlayBtn(w, big) {
    if (data.running?.worldKey === w.key) return `<span class="mv-run" aria-live="polite"><i></i>${esc(T("mvRunning"))}</span>`;
    const tip = esc(T("mvPlayTip", { w: w.name }));
    return `<button type="button" class="mv-play${big ? " big" : ""}" data-play-world="${esc(w.key)}" aria-label="${tip}" ${data.running ? `disabled title="${esc(T("mvBusy"))}"` : `title="${tip}"`}>${MV_ICON.play}<span class="lbl">${esc(T("play"))}</span></button>`;
  }
  function mvRow(w, cls = "") {
    const pin = mv.pins.has(w.key) ? `<span class="pin" title="${esc(T("mvPinned"))}">${MV_ICON.pin}</span>` : "";
    return `<div class="mv-row ${cls}" data-world="${esc(w.key)}">
      <img src="${worldThumb(w)}" alt="">
      <div class="mv-txt"><div class="mv-name">${pin}<span class="sensitive" data-mask="${esc(T("mvMask"))}" title="${esc(w.name)}">${esc(w.name)}</span></div><div class="mv-meta">${mvMeta(w)}</div></div>
      <div class="mv-st">${on("playTiles") && PJ.allView ? pjLinkTag(w) : ""}${pjCopyTag(w)}${w.pendingTo ? `<span class="mv-tag up" title="${esc(L() === "fr" ? `Son installation est passée en ${w.pendingTo}. Minecraft convertira ce monde à sa prochaine ouverture. Sauvegarde 🛡 « Avant ${w.pendingTo} » faite.` : `Its installation moved to ${w.pendingTo}. Minecraft converts this world next time it opens. 🛡 “Before ${w.pendingTo}” backup made.`)}">⬆ ${esc(w.minecraftVersion)} → ${esc(w.pendingTo)}</span>` : ""}${w.upgraded ? `<span class="mv-tag up" title="${esc(L() === "fr" ? `Sauvegarde 🛡 « Avant ${w.upgraded.to} » gardée dans ses sauvegardes. Pour revenir en ${w.upgraded.from} : … › Sauvegardes › Restaurer.` : `Backup 🛡 “Before ${w.upgraded.to}” kept in its backups. To go back to ${w.upgraded.from}: … › Backups › Restore.`)}">⬆ ${esc(w.upgraded.from)} → ${esc(w.upgraded.to)}</span>` : ""}${w.modCopyOf ? `<span class="mv-tag copy" title="${esc(T("modCopyTip"))}">${esc(T("modCopyTag"))}</span>` : ""}${w.modded && !w.lastVersionLabel?.pack ? `<span class="mv-tag mod" title="${esc(T("modTagTip", { l: modLabel(w.modded) }))}">⚠ ${esc(T("modTag"))}</span>` : ""}${on("playTiles") ? pjSw(w) : ""}${on("playTiles") && !w.backup ? "" : mvStatus(w)}</div>
      ${mvPlayBtn(w, cls.includes("recent"))}
      <button type="button" class="mv-dots" data-mv-menu="${esc(w.key)}" aria-label="${esc(T("mvMenu"))} : ${esc(w.name)}" aria-haspopup="menu" aria-expanded="false">${MV_ICON.dots}</button>
    </div>`;
  }
  function mvGoneRow(g) {
    return `<div class="mv-row gone" data-world="${esc(g.key)}" title="${esc(T("goneTip"))}">
      <img src="${worldThumb(g)}" alt="">
      <div class="mv-txt"><div class="mv-name"><span>${esc(g.name)}</span></div><div class="mv-meta">${esc(T("goneMeta", { n: g.backups }))}</div></div>
      <div class="mv-st"></div>
      <button type="button" class="btn-secondary" data-gone-bk="${esc(g.key)}" style="margin:0;font-size:12.5px;padding:6px 12px;">${esc(T("goneBk"))}</button>
    </div>`;
  }
  function mvCloudRow(cw) {
    const busy = downloading(cw);
    const meta = `${cw.minecraftVersion ? `Minecraft ${cw.minecraftVersion}` : "Minecraft"} · ${cw.packName || "Vanilla"}${cw.headDeviceName ? ` · ${cw.headDeviceName}` : ""} · ${sizeFmt(cw.totalBytes || cw.sizeBytes)}`;
    const tip = esc(T("mvDlTip", { w: cw.name }));
    return `<div class="mv-row cloud-only" data-cloud-world="${esc(cw.id)}">
      <img src="${grassThumb(cw.worldKey)}" alt="">
      <div class="mv-txt"><div class="mv-name"><span class="sensitive" data-mask="${esc(T("mvMask"))}" title="${esc(cw.name)}">${esc(cw.name)}</span></div><div class="mv-meta">${busy ? `↓ ${L() === "fr" ? "Téléchargement en cours (voir en haut à droite)" : "Downloading (see top right)"}` : esc(meta)}</div></div>
      <div class="mv-st"><span class="mv-ic" style="color:var(--accent-2)" title="${esc(T("cloudOnly"))}">${MV_ICON.cloud}</span></div>
      <button type="button" class="mv-play dl" data-cloud-download="${esc(cw.id)}" aria-label="${tip}" title="${tip}" ${busy || (data.djob && !data.djob.done) ? "disabled" : ""}>${MV_ICON.down}<span class="lbl">${esc(T("download").split(" ")[0])}</span></button>
      <span></span>
    </div>`;
  }
  function mvSection(key, title, n, body, def = true) {
    const open = mvOpen(key, def);
    return `<div class="mv-sec"><button type="button" class="mv-sec-h" data-mv-toggle="${esc(key)}" aria-expanded="${open}">${MV_ICON.chev}${esc(title)} <span class="n">(${n})</span></button>${open ? body : ""}</div>`;
  }
  function mvLimited(list, mk) {
    const max = 30;
    if (mv.showAll || list.length <= max) return list.map(mk).join("");
    return list.slice(0, max).map(mk).join("") + `<button type="button" class="mv-more" data-mv-more>${esc(T("mvMore", { n: list.length - max }))}</button>`;
  }
  function mvTools() {
    const N = data.worlds.length;
    if (N < 8) return "";
    const vers = [...new Set(data.worlds.map(mvVersion).filter(Boolean))].sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
    const nNot = data.worlds.filter(mvNotCloud).length;
    const nOff = data.worlds.filter((w) => !w.backup).length;
    const chip = (f, label, n) => `<button type="button" class="mv-chip" data-mv-filter="${f}" aria-pressed="${mv.filter === f}">${label} <b>${n}</b></button>`;
    const chips = N >= 16
      ? `<div class="mv-chips" role="group">${chip("all", esc(T("mvFAll")), N)}${data.cloud?.offer?.cloud ? chip("notcloud", `${MV_ICON.cloudWarn}${esc(T("mvFNotCloud"))}`, nNot) : ""}${chip("off", `${MV_ICON.shieldOff}${esc(T("mvFOff"))}`, nOff)}${vers.length > 1 ? `<select class="mv-select" data-mv-ver style="height:26px;border-radius:999px;font-size:12px;" aria-label="${esc(T("mvAllVersions"))}"><option value="">${esc(T("mvAllVersions"))}</option>${vers.map((v) => `<option value="${esc(v)}" ${mv.ver === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>` : ""}</div>`
      : "";
    const sorts = { recent: "mvSortRecent", name: "mvSortName", size: "mvSortSize" };
    return `<div class="mv-tools">
        <label class="mv-search">${MV_ICON.search}<input type="search" data-mv-q value="${esc(mv.q)}" placeholder="${esc(T("mvSearch"))}" aria-label="${esc(T("mvSearch"))}"></label>
        <select class="mv-select" data-mv-sort aria-label="${esc(T("mvSort"))}">${Object.entries(sorts).map(([k, l]) => `<option value="${k}" ${mv.sort === k ? "selected" : ""}>${esc(T("mvSort"))} : ${esc(T(l))}</option>`).join("")}</select>
      </div>${chips}`;
  }
  // Le corps de la liste (sans la recherche) : redessiné seul pendant la frappe, pour garder le
  // curseur dans le champ.
  function mvBody(cloudOnly) {
    if (mvSearching()) {
      const list = mvSorted(mvFiltered());
      return list.length ? `<div class="mv-list">${mvLimited(list, (w) => mvRow(w))}</div>` : `<div class="mv-empty">${esc(T("mvNone"))}</div>`;
    }
    const N = data.worlds.length;
    const visible = data.worlds.filter((w) => !mv.hidden.has(w.key));
    const hid = mvSorted(data.worlds.filter((w) => mv.hidden.has(w.key)));
    let h = "";
    if (on("playTiles") && PJ.allView) {
      // Demande de Rushi (27/10) : catégories repliables Liés / Non liés / Supprimés dans Minecraft.
      const fr = L() === "fr";
      const linked = (w) => !!(w.lastVersionId && data.versions.some((x) => x.id === w.lastVersionId));
      const pinned = mvSorted(visible.filter((w) => mv.pins.has(w.key)));
      const rest = visible.filter((w) => !mv.pins.has(w.key));
      const lk = mvSorted(rest.filter(linked));
      const nl = mvSorted(rest.filter((w) => !linked(w)));
      if (pinned.length) h += mvSection("pinned", T("mvPinned"), pinned.length, `<div class="mv-list">${pinned.map((w) => mvRow(w)).join("")}</div>`);
      if (lk.length) h += mvSection("linked", fr ? "Liés à une installation" : "Linked to an installation", lk.length, `<div class="mv-list">${mvLimited(lk, (w) => mvRow(w))}</div>`);
      if (nl.length) h += mvSection("unlinked", fr ? "Non liés" : "Not linked", nl.length, `<div class="mv-list">${mvLimited(nl, (w) => mvRow(w))}</div>`);
    } else if (N < 8) {
      // Peu de mondes : une seule liste, les épinglés d'abord.
      const list = [...mvSorted(visible.filter((w) => mv.pins.has(w.key))), ...mvSorted(visible.filter((w) => !mv.pins.has(w.key)))];
      if (list.length) h += `<div class="mv-list" style="margin-bottom:12px;">${list.map((w) => mvRow(w)).join("")}</div>`;
    } else {
      const pinned = mvSorted(visible.filter((w) => mv.pins.has(w.key)));
      const rest = visible.filter((w) => !mv.pins.has(w.key));
      const recent = [...rest].sort((x, y) => (y.lastPlayed || 0) - (x.lastPlayed || 0)).slice(0, 3);
      const recentKeys = new Set(recent.map((w) => w.key));
      const others = mvSorted(rest.filter((w) => !recentKeys.has(w.key)));
      if (recent.length) h += mvSection("recent", T("mvRecent"), recent.length, `<div class="mv-list">${recent.map((w) => mvRow(w, "recent")).join("")}</div>`);
      if (pinned.length) h += mvSection("pinned", T("mvPinned"), pinned.length, `<div class="mv-list">${pinned.map((w) => mvRow(w)).join("")}</div>`);
      if (others.length) h += mvSection("others", T("mvOthers"), others.length, `<div class="mv-list">${mvLimited(others, (w) => mvRow(w))}</div>`);
    }
    if (hid.length) h += mvSection("hidden", T("mvHidden"), hid.length, `<div class="mv-list dim">${hid.map((w) => mvRow(w)).join("")}</div>`, false);
    if (cloudOnly.length) h += mvSection("cloud", T("mvCloudOnly"), cloudOnly.length, `<div class="mv-list">${cloudOnly.map(mvCloudRow).join("")}</div>`, !data.worlds.length);
    if (data.gone.length) h += mvSection("gone", T("goneT"), data.gone.length, `<div class="mv-list">${data.gone.map(mvGoneRow).join("")}</div>`);
    return h;
  }
  const mvCloudOnly = () => {
    const localKeys = new Set(data.worlds.map((w) => w.key));
    return (data.cloud?.offer?.cloud ? data.cloud.worlds || [] : []).filter((cw) => !localKeys.has(cw.worldKey));
  };
  function mvRedrawBody() {
    const el = panel.querySelector(".mv-body");
    if (el) el.innerHTML = mvBody(mvCloudOnly());
    if (on("playTiles")) pjSyncPick();
  }

  // Menu « … » d'un monde.
  let mvMenuEl = null;
  function mvCloseMenu() {
    if (!mvMenuEl) return;
    mvMenuEl.remove();
    mvMenuEl = null;
    document.removeEventListener("keydown", mvMenuKey, true);
    panel.querySelectorAll('.mv-dots[aria-expanded="true"]').forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  function mvMenuKey(e) {
    if (!mvMenuEl) return;
    const items = [...mvMenuEl.querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.stopPropagation();
      const key = mvMenuEl.dataset.key;
      mvCloseMenu();
      panel.querySelector(`.mv-dots[data-mv-menu="${CSS.escape(key)}"]`)?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  }
  function mvOpenMenu(btn, key) {
    mvCloseMenu();
    const w = data.worlds.find((x) => x.key === key);
    if (!w) return;
    const cw = data.cloud?.offer?.cloud ? mvCloudOf(key) : null;
    btn.setAttribute("aria-expanded", "true");
    const it = (act, label, extra = "") => `<button type="button" role="menuitem" data-act="${act}" ${extra}>${label}</button>`;
    mvMenuEl = document.createElement("div");
    mvMenuEl.className = "mv-menu";
    mvMenuEl.setAttribute("role", "menu");
    mvMenuEl.dataset.key = key;
    mvMenuEl.innerHTML = it("backups", esc(T("mvMBackups", { n: w.backups })))

      + it("auto", `${esc(T("mvMAuto"))}<span class="sw ${w.backup ? "on" : ""}"></span>`, `role="menuitemcheckbox" aria-checked="${w.backup}"`)
      + "<hr>"
      + it("pin", `${MV_ICON.pin} ${esc(T(mv.pins.has(key) ? "mvMUnpin" : "mvMPin"))}`)
      + it("hide", esc(T(mv.hidden.has(key) ? "mvMUnhide" : "mvMHide")))
      + it("folder", esc(T("openFolder")))
      + (cw?.split ? it("split", esc(T("mvMSplit"))) : "")
      + (cw ? `<hr>${it("uncloud", esc(T("mvMUncloud")), 'class="danger"')}` : "");
    document.body.appendChild(mvMenuEl);
    const r = btn.getBoundingClientRect();
    const mh = mvMenuEl.offsetHeight;
    const mw = mvMenuEl.offsetWidth;
    mvMenuEl.style.left = `${Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8))}px`;
    mvMenuEl.style.top = `${r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4}px`;
    mvMenuEl.querySelector("button")?.focus();
    document.addEventListener("keydown", mvMenuKey, true);
    mvMenuEl.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const a = b.dataset.act;
      mvCloseMenu();
      if (a === "backups") return openBackupsList(key);
      if (a === "auto") return toggleBackup(key);
      if (a === "folder") return api.openWorldFolder(key);
      if (a === "split") return openSplit(key);
      if (a === "uncloud") return mvUncloud(w);
      if (a === "pin") {
        if (mv.pins.has(key)) mv.pins.delete(key);
        else {
          mv.pins.add(key);
          mv.hidden.delete(key);
          toast(T("mvPinOk", { w: w.name }));
        }
      } else if (a === "hide") {
        if (mv.hidden.has(key)) mv.hidden.delete(key);
        else {
          mv.hidden.add(key);
          mv.pins.delete(key);
          toast(T("mvHideOk", { w: w.name }));
        }
      }
      mvSave();
      render();
    });
  }
  document.addEventListener("mousedown", (e) => {
    if (mvMenuEl && !mvMenuEl.contains(e.target) && !e.target.closest(".mv-dots")) mvCloseMenu();
  });
  window.addEventListener("resize", () => mvCloseMenu());
  panel.addEventListener("scroll", () => mvCloseMenu(), true);
  // Même confirmation que dans « Synchroniser mes mondes ».
  async function mvUncloud(w) {
    const fr = L() === "fr";
    const r = await showModal({
      title: fr ? `Retirer « ${w.name} » du cloud ?` : `Remove “${w.name}” from the cloud?`,
      body: fr ? "Ses sauvegardes en ligne sont supprimées pour de bon. Le monde reste sur ton PC, avec ses sauvegardes locales." : "Its online backups are deleted for good. The world stays on your PC, with its local backups.",
      confirmLabel: fr ? "Oui, retirer" : "Yes, remove",
      cancelLabel: fr ? "Non" : "No",
      tone: "warn",
    });
    if (!r?.confirmed) return;
    const out = await api.cloud.remove(w.key);
    if (!out?.ok) return toast(out?.error || "");
    await loadCloud(true);
    render();
    toast(fr ? `« ${w.name} » retiré du cloud. Il est toujours sur ton PC.` : `“${w.name}” removed from the cloud. It is still on your PC.`);
  }
  panel.addEventListener("input", (e) => {
    if (!e.target.matches?.("[data-mv-q]")) return;
    mv.q = e.target.value;
    mv.showAll = false;
    mvRedrawBody();
  });
  panel.addEventListener("change", (e) => {
    if (e.target.matches?.("[data-mv-sort]")) {
      mv.sort = e.target.value;
      mvSave();
      mvRedrawBody();
    } else if (e.target.matches?.("[data-mv-ver]")) {
      mv.ver = e.target.value;
      mvRedrawBody();
    }
  });
  // Flèches haut et bas : passer d'un monde à l'autre au clavier.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rowEl = document.activeElement?.closest?.(".mv-row");
    if (!rowEl || !panel.contains(rowEl)) return;
    const rows = [...panel.querySelectorAll(".mv-row")];
    const next = rows[rows.indexOf(rowEl) + (e.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    (next.querySelector(".mv-play:not(:disabled), .mv-dots") || next).focus();
  });

  // --- Page Jouer en tuiles « C1 · Tiroir » (27/10, preview validée par Rushi, Laboratoire « playTiles ») ---
  // Avec 20 installations, l'ancienne page (colonne « Mes versions » + tous les mondes à droite) devenait
  // une liste interminable. Ici : une grille de tuiles (jaquette, dernier monde joué, ▶ et « … »
  // toujours visibles). Un clic sur la tuile ouvre la page de l'installation ; le bouton « Mondes (N) »
  // ouvre ses mondes dans un tiroir juste sous la rangée. « Voir tous mes mondes » garde la liste
  // d'avant (avec un retour). Bande « Continuer » : le dernier monde joué.
  const PJ = { pick: null, wpick: null, sel: null, allView: false, drawerAll: false, tilesAll: false, menu: null, rmQ: [], ghosts: [], ghostSeq: 0 };
  const PJT = () => (L() === "fr" ? {
    inst: "Mes installations", allLink: (n) => `Voir tous mes mondes (${n})`, all: "Tous mes mondes", back: "← Retour aux installations",
    lastW: "Dernier :", noW: "pas encore de monde", noWorlds: "Aucun monde ici pour l'instant. Clique « Jouer » et crée ton monde dans Minecraft : il apparaîtra ici.",
    newI: "Nouvelle installation", moreW: (n) => `Voir les ${n} mondes`, lessW: "Moins", showAll: (n) => `Afficher les ${n} installations`, showLess: "Réduire",
    cont: "Continuer", resume: "Reprendre", running: "En cours", worldsB: (n) => `Mondes (${n})`, wTip: "Voir ses mondes ici sans quitter la page", tileTip: "Ouvrir la page de l'installation",
    keptCopy: (x) => `Copie gardée en ${x}`, updated: (x) => `Mise à jour : ${x}`, keptTip: (x) => `Copie de l'installation gardée en ${x} pendant une mise à jour, avec une copie de ses mondes. L'originale est passée dans la nouvelle version.`,
    up: "Mettre à jour", upTip: (x) => `Minecraft ${x} est sortie : mettre à jour cette installation (ses mondes sont sauvegardés avant)`,
    openPage: "Ouvrir la page", folder: "Ouvrir le dossier", remove: "Retirer…", menu: "Plus d'actions", playI: "Jouer sans choisir de monde", mods: "mods",
    nW: (n) => (n === 0 ? "aucun monde" : n === 1 ? "1 monde" : `${n} mondes`), never: "jamais lancée", settings: "Réglages",
    orphans: (n) => `${n} monde${n > 1 ? "s" : ""} sans installation`, orphansGo: "Les voir", nV: (n) => `${n} versions`,
  } : {
    inst: "My installations", allLink: (n) => `See all my worlds (${n})`, all: "All my worlds", back: "← Back to installations",
    lastW: "Last:", noW: "no world yet", noWorlds: "No world here yet. Click “Play” and create your world in Minecraft: it will show up here.",
    newI: "New installation", moreW: (n) => `Show the ${n} worlds`, lessW: "Less", showAll: (n) => `Show all ${n} installations`, showLess: "Show less",
    cont: "Continue", resume: "Resume", running: "Running", worldsB: (n) => `Worlds (${n})`, wTip: "Show its worlds here without leaving the page", tileTip: "Open the installation page",
    keptCopy: (x) => `Copy kept on ${x}`, updated: (x) => `Updated: ${x}`, keptTip: (x) => `Copy of the installation kept on ${x} during an update, with a copy of its worlds. The original moved to the new version.`,
    up: "Update", upTip: (x) => `Minecraft ${x} is out: update this installation (its worlds are backed up first)`,
    openPage: "Open page", folder: "Open folder", remove: "Remove…", menu: "More actions", playI: "Play without picking a world", mods: "mods",
    nW: (n) => (n === 0 ? "no world" : n === 1 ? "1 world" : `${n} worlds`), never: "never launched", settings: "Settings",
    orphans: (n) => `${n} world${n > 1 ? "s" : ""} without an installation`, orphansGo: "See them", nV: (n) => `${n} versions`,
  });
  const pjName = (v) => v.name || `Minecraft ${v.minecraftVersion}`;
  // Nom du pack, seulement s'il n'est pas déjà le nom de l'installation.
  const pjPack = (v) => (v.pack && packName(v.pack) !== pjName(v) ? packName(v.pack) : "");
  // Une copie gardée exprès dans l'ancienne version ne propose pas « Mettre à jour » sur sa tuile
  // (toujours possible depuis son menu « … »).
  const pjCanUp = (v) => !v.keptCopyOf && !!newerFor(v);
  const pjTime = (x) => (typeof x === "number" ? x : Date.parse(x || "") || 0);
  const pjFresh = (at) => !!at && Date.now() - pjTime(at) < 3 * 86400_000;
  // Pack Omniscient (28/10, Rushi : « faut pas les créer dans le menu Jouer, ça surcharge ») : une seule
  // tuile par pack, celle du pack de référence. Ses autres versions s'ouvrent depuis la barre « Versions
  // du pack » de sa page ; la tuile compte les mondes de toutes ses versions.
  const pjGroup = (v) => (v.omni?.group ? data.versions.filter((x) => x.omni?.group === v.omni.group) : [v]);
  const pjWorlds = (v) => {
    const ids = new Set(pjGroup(v).map((x) => x.id));
    return data.worlds.filter((w) => ids.has(w.lastVersionId));
  };
  const pjLast = (v) => Math.max(...pjGroup(v).map((x) => pjTime(x.lastPlayedAt)), ...pjWorlds(v).map((w) => w.lastPlayed || 0));
  function pjSorted() {
    const seen = new Set();
    const list = [];
    for (const v of data.versions) {
      const g = v.omni?.group;
      if (!g) list.push(v);
      else if (!seen.has(g)) {
        seen.add(g);
        const vs = pjGroup(v);
        list.push(vs.find((x) => x.omni.base) || vs[0]);
      }
    }
    return list.sort((a, b) => pjLast(b) - pjLast(a));
  }
  const pjLastWorld = (v) => [...pjWorlds(v)].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0];
  const pjDots = (v) => `<button type="button" class="mv-dots" data-pj-menu="${esc(v.id)}" aria-label="${esc(PJT().menu)} : ${esc(pjName(v))}" aria-haspopup="menu" aria-expanded="false">${MV_ICON.dots}</button>`;
  const pjUpBtn = (v) => (pjCanUp(v) ? `<button type="button" class="vu-upbtn" data-up-version="${esc(v.id)}" title="${esc(PJT().upTip(newerFor(v)))}">⬆ ${esc(PJT().up)}</button>` : "");
  // Jaquette : bloc d'herbe + numéro pour vanilla ; pour un pack, un dégradé et ses initiales (le
  // launcher ne garde pas encore l'icône du pack à l'installation).
  const PJ_COL = [["#1d4ed8", "#60a5fa"], ["#7e22ce", "#c084fc"], ["#b91c1c", "#f87171"], ["#92400e", "#f59e0b"], ["#166534", "#4ade80"], ["#9d174d", "#f472b6"], ["#0f766e", "#14b8a6"], ["#9a3412", "#fb923c"], ["#3730a3", "#818cf8"], ["#365314", "#a3e635"]];
  const pjCol = (v) => {
    let x = 0;
    for (const c of String(v.pack?.slug || v.pack?.name || v.id)) x = (x * 31 + c.charCodeAt(0)) % 997;
    return PJ_COL[x % PJ_COL.length];
  };
  // « Voir tous mes mondes » (demande de Rushi, 27/10) : à quelle installation chaque monde est lié,
  // dans la couleur de sa tuile (vert pour vanilla), ou « Non lié ».
  function pjLinkTag(w) {
    const fr = L() === "fr";
    const v = w.lastVersionId && data.versions.find((x) => x.id === w.lastVersionId);
    if (!v) return `<span class="mv-tag pj-link none" title="${esc(fr ? "Ce monde n'est lié à aucune installation : ▶ te proposera d'en choisir une." : "This world is not linked to any installation: ▶ will ask you to pick one.")}">${esc(fr ? "Non lié" : "Not linked")}</span>`;
    const col = v.pack ? pjCol(v)[1] : "#4ade80";
    return `<span class="mv-tag pj-link" style="--c:${col};" title="${esc(fr ? `Lié à l'installation « ${pjName(v)} »` : `Linked to the “${pjName(v)}” installation`)}">${esc(fr ? "Lié à" : "Linked to")} <b>${esc(pjName(v))}</b></span>`;
  }
  function pjCover(v, h = 74) {
    if (!v.pack) return `<div class="pj2-cover van" style="height:${h}px;background-image:url(${grassThumb("v" + v.minecraftVersion)});"><span class="pj2-ver">${esc(v.minecraftVersion)}</span></div>`;
    const [a, b] = pjCol(v);
    // Vrai logo du pack (retrouvé sur Modrinth à l'import, 27/10) sur un fond flou de lui-même.
    if (/^data:image\/(png|jpeg|webp|gif);base64,/.test(v.icon || "")) return `<div class="pj2-cover pj2-ico" style="height:${h}px;--ic:url(${v.icon});background:${a};"><img src="${v.icon}" alt="" style="height:${Math.round(h * 0.72)}px;"></div>`;
    const ini = pjName(v).replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "P";
    return `<div class="pj2-cover" style="height:${h}px;background:radial-gradient(circle at 30% 20%, ${b}, ${a} 75%);"><span class="pj2-logo" style="font-size:${Math.round(h * 0.38)}px;">${esc(ini)}</span></div>`;
  }
  function pjTile(v) {
    const lw = pjLastWorld(v);
    const sel = PJ.sel === v.id;
    const run = !!data.running && pjGroup(v).some((x) => x.id === data.running.versionId);
    const kept = v.keptCopyOf && pjFresh(v.keptCopyOf.at);
    const upd = !kept && v.updatedFrom && pjFresh(v.updatedFrom.at);
    const n = pjWorlds(v).length;
    return `<div class="pj2-tile${sel ? " sel" : ""}${run ? " run" : ""}${kept || upd || FL.newId === v.id ? " fresh" : ""}${PJ.rm?.id === v.id || PJ.rmQ.some((j) => j.id === v.id) ? " rm-busy" : ""}" data-pj-tile="${esc(v.id)}" tabindex="0" role="button" title="${esc(PJT().tileTip)}">
      ${pjRmLayer(v)}${pjCover(v)}
      ${pjCanUp(v) ? `<span class="pj2-badge up" title="${esc(PJT().upTip(newerFor(v)))}">⬆ ${esc(newerFor(v))}</span>` : ""}${v.problems ? `<span class="pj2-badge warn" title="${esc(pkT("cardBad", { n: v.problems }))}">⚠ ${v.problems}</span>` : ""}${run ? `<span class="pj2-badge run"><i></i>${esc(PJT().running)}</span>` : kept ? `<span class="pj2-badge fresh" title="${esc(PJT().keptTip(v.minecraftVersion))}">${esc(PJT().keptCopy(v.minecraftVersion))}</span>` : upd ? `<span class="pj2-badge fresh">${esc(PJT().updated(v.minecraftVersion))}</span>` : FL.newId === v.id ? `<span class="pj2-badge fresh">${esc(FLT().badge)}</span>` : ""}
      <div class="pj2-body"><b title="${esc(pjName(v))}">${esc(pjName(v))}</b>${testTag(v)}
        <small>${esc([v.pack ? [pjPack(v), v.minecraftVersion, `${v.modCount} ${PJT().mods}`].filter(Boolean).join(" · ") : "Vanilla", pjGroup(v).length > 1 ? PJT().nV(pjGroup(v).length) : ""].filter(Boolean).join(" · "))}</small>
        <small class="lw">${lw ? `${esc(PJT().lastW)} <span class="sensitive" data-mask="${esc(T("mvMask"))}">${esc(lw.name)}</span> · ${esc(ago(lw.lastPlayed))}` : esc(PJT().noW)}</small>
        <div class="pj2-foot"><button type="button" class="pj2-wbtn" data-pj-w="${esc(v.id)}" aria-expanded="${sel}" title="${esc(PJT().wTip)}">${MV_ICON.chev}<span class="lbl">${esc(PJT().worldsB(n))}</span></button>
        <span class="pj2-acts"><button type="button" class="pj-mini" data-play-version="${esc(v.id)}" title="${esc(PJT().playI)}" aria-label="${esc(PJT().playI)} : ${esc(pjName(v))}" ${data.running ? "disabled" : ""}>${MV_ICON.play}</button>${pjDots(v)}</span></div></div>
    </div>`;
  }
  const pjNewTile = () => `<button type="button" class="pj2-tile pj2-new" data-new-version><span class="plus">+</span><b>${esc(PJT().newI)}</b></button>`;
  // Bande « Continuer » fine (72 px) : seulement le dernier monde joué.
  function pjCont() {
    const w = [...data.worlds].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0];
    if (!w) return "";
    const v = data.versions.find((x) => x.id === w.lastVersionId);
    const run = data.running?.worldKey === w.key;
    return `<div class="pj2-cont"><img src="${worldThumb(w)}" alt=""><div class="mv-txt"><small>${esc(PJT().cont)}</small><div class="mv-name"><span class="sensitive" data-mask="${esc(T("mvMask"))}">${esc(w.name)}</span></div><div class="mv-meta">${esc(v ? pjName(v) : w.minecraftVersion ? `Minecraft ${w.minecraftVersion}` : "")} · ${esc(ago(w.lastPlayed))}</div></div>
      ${run ? `<span class="mv-run" aria-live="polite"><i></i>${esc(T("mvRunning"))}</span>` : `<button type="button" class="join-btn pj2-go" data-play-world="${esc(w.key)}" ${data.running ? "disabled" : ""}>${MV_ICON.play} ${esc(PJT().resume)}</button>`}</div>`;
  }
  // Tiroir : en-tête de l'installation (⬆ Mettre à jour, ⚙ Ouvrir la page, Jouer, …) + ses mondes (4, puis « Voir les N mondes »).
  function pjDetail(v) {
    const ws = [...pjWorlds(v)].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    const show = !PJ.drawerAll && ws.length > 4 ? ws.slice(0, 4) : ws;
    const run = data.running?.versionId === v.id;
    const meta = [v.pack ? pjPack(v) : "Vanilla", v.name ? v.minecraftVersion : "", v.pack ? `${v.modCount} ${PJT().mods}` : "", PJT().nW(ws.length), v.lastPlayedAt ? ago(v.lastPlayedAt) : PJT().never].filter(Boolean).map(esc).join(" · ");
    return `<div class="pj2-dhead"><div class="mv-txt"><div class="mv-name" style="font-size:15px;"><span>${esc(pjName(v))}</span></div><div class="mv-meta">${meta}</div></div>
        <span class="pj2-dacts">${pjUpBtn(v)}${pageOn(v) ? `<button type="button" class="btn-secondary" data-pj-page="${esc(v.id)}" style="margin:0;">⚙ ${esc(PJT().openPage)}</button>` : ""}<button type="button" class="join-btn" data-play-version="${esc(v.id)}" ${data.running ? "disabled" : ""}>${esc(run ? T("playing") : T("play"))}</button>${pjDots(v)}</span></div>
      ${ws.length ? `<div class="mv-list">${show.map((w) => mvRow(w)).join("")}</div>${ws.length > 4 ? `<button type="button" class="mv-more" data-pj-more>${esc(PJ.drawerAll ? PJT().lessW : PJT().moreW(ws.length))}</button>` : ""}` : `<div class="mv-empty">${esc(PJT().noWorlds)}</div>`}`;
  }
  // Boutons d'en-tête : les mêmes qu'avant (Réglages des sauvegardes, cloud, Importer…, + Nouvelle version).
  function pjSideBtns() {
    const fr = L() === "fr";
    const sup = data.cloud?.offer?.cloud;
    const missing = sup && data.worlds.some((w) => w.backup && !data.cloud.worlds?.some((x) => x.worldKey === w.key));
    return `${data.worlds.length ? `<button type="button" class="link-btn" data-bk-settings title="${fr ? "Réglages des sauvegardes" : "Backup settings"}" style="font-size:12.5px;">⚙ ${esc(PJT().settings)}</button>` : ""}${sup && data.worlds.length ? `<button type="button" class="link-btn" data-sync ${data.job && !data.job.done ? "disabled" : ""} style="font-size:12.5px;">☁ ${esc(T("sync"))}${missing ? ' <span style="color:var(--warn);">•</span>' : ""}</button>` : ""}`;
  }
  // Vue « Tous mes mondes » : la liste d'avant (recherche, tri, filtres, mondes du cloud et supprimés).
  function pjAllView(cloudOnly) {
    return `<button type="button" class="link-btn" data-pj-back style="font-size:13px;margin:0 0 10px;">${esc(PJT().back)}</button>
      <div class="home-section-header"><h3>${esc(PJT().all)} <span style="font-weight:500;color:var(--muted);font-size:.85em;">(${data.worlds.length})</span></h3>
      <span style="margin-left:auto;display:flex;gap:12px;align-items:center;">${data.worlds.length + data.gone.length > 1 && !PJ.wpick ? `<button type="button" class="link-btn" data-pj-wpick style="font-size:12.5px;">☑ ${esc(SELT().pick)}</button>` : ""}${pjSideBtns()}${pbOn() ? "" : `<button type="button" class="link-btn" data-import style="font-size:12.5px;">${esc(T(packImportOn() ? "importAll" : "import"))}</button>`}</span></div>
      ${data.worlds.length || cloudOnly.length || data.gone.length ? `${mvTools()}<div class="mv-body${PJ.wpick ? " pj-picking" : ""}">${mvBody(cloudOnly)}</div>` : `<div class="mv-empty">${esc(T("noWorlds"))}</div>`}${PJ.wpick ? pjSelBar("w") : ""}`;
  }
  function pjRender(cloudOnly) {
    if (PJ.allView) return pjAllView(cloudOnly);
    const list = pjSorted().filter((v) => v.id !== PJ.hide);
    if (PJ.sel && !list.some((v) => v.id === PJ.sel)) PJ.sel = null;
    // 28/10 (Rushi) : la tuile « + Nouvelle installation » remplace le bouton bleu de l'en-tête ; elle
    // vient juste après les tuiles montrées, avant « Afficher les N », pour être toujours visible.
    const max = pbOn() ? 10 : 11;
    const shown = PJ.tilesAll || list.length <= max ? list : list.slice(0, max);
    if (PJ.sel && !shown.some((v) => v.id === PJ.sel)) shown.push(list.find((v) => v.id === PJ.sel));
    const v = PJ.sel && list.find((x) => x.id === PJ.sel);
    const ids = new Set(data.versions.map((x) => x.id));
    const orphans = data.worlds.filter((w) => !ids.has(w.lastVersionId)).length;
    const extra = orphans || cloudOnly.length || data.gone.length;
    return `${pjCont()}
      <div class="home-section-header" style="flex-wrap:wrap;gap:8px 12px;"><h3>${esc(PJT().inst)} <span style="font-weight:500;color:var(--muted);font-size:.85em;">(${list.length})</span></h3>
        <span style="margin-left:auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">${pbOn() ? "" : list.length > 1 && !PJ.pick ? `<button type="button" class="link-btn" data-pj-pick style="font-size:12.5px;">☑ ${esc(SELT().pick)}</button>` : ""}${data.worlds.length || extra ? `<button type="button" class="link-btn" data-pj-all style="font-size:12.5px;">${esc(PJT().allLink(data.worlds.length))}</button>` : ""}${pbOn() ? pbMoreBtn() : `${pjSideBtns()}<button type="button" class="btn-secondary" data-import style="margin:0;padding:7px 14px;">${esc(T(packImportOn() ? "importAll" : "import"))}</button><button type="button" class="join-btn" data-new-version>+ ${esc(T("newV"))}</button>`}</span></div>
      <div class="pj2-grid${PJ.pick ? " pj-picking" : ""}" data-pj-grid>${pjWithGhost(shown.map((x) => pjTile(x))).join("")}${pbOn() && !PJ.pick ? pjNewTile() : ""}${list.length > max ? `<button type="button" class="pj2-tile pj2-new" data-pj-tiles><span class="plus" style="font-size:18px;">${PJ.tilesAll ? "−" : "…"}</span><b>${esc(PJ.tilesAll ? PJT().showLess : PJT().showAll(list.length))}</b></button>` : ""}${PJ.pick || pbOn() ? "" : pjNewTile()}
      ${v ? `<div class="pj2-drawer" data-pj-drawer><span class="pj2-arrow"></span>${pjDetail(v)}</div>` : ""}</div>
      ${orphans ? `<p class="pj2-orph">${esc(PJT().orphans(orphans))} · <button type="button" class="link-btn" data-pj-all style="font-size:12.5px;">${esc(PJT().orphansGo)}</button></p>` : ""}${PJ.pick ? pjSelBar("i") : ""}`;
  }
  // Sélection multiple (Rushi, 27/10 : « je devais supprimer 10 mondes… ») : installations
  // (« Retirer » en une fois, file d'attente habituelle) et mondes (« Suppression définitive »
  // en une fois : le mot à taper puis les 10 secondes, une seule fois pour tout le lot).
  const SELT = () => (L() === "fr" ? {
    tip: "Astuce : garde le clic enfoncé et passe sur plusieurs éléments pour les cocher d'un coup.",
    pick: "Sélectionner", all: "Tout sélectionner", none: "Tout désélectionner", cancel: "Annuler",
    nI: (n) => (n ? `${n} installation${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""}` : "Clique (ou glisse) sur les installations à retirer"),
    nW: (n) => (n ? `${n} monde${n > 1 ? "s" : ""} sélectionné${n > 1 ? "s" : ""}` : "Clique (ou glisse) sur les mondes à supprimer"),
    rm: (n) => `Retirer${n ? ` (${n})` : ""}…`, del: (n) => `🗑 Supprimer définitivement${n ? ` (${n})` : ""}…`,
    rmT: (n) => `Retirer ${n} installation${n > 1 ? "s" : ""} ?`,
    packNote: (n) => `⚠ ${n === 1 ? "Le Pack Omniscient coché est retiré en entier" : "Les Packs Omniscient cochés sont retirés en entier"}, avec toutes ses versions. Pour n'en retirer que certaines : ouvre le pack, ⚙ › Retirer…`,
    rmD: (l) => `${l}. Les installations et leurs mods sont retirés de ce PC. Leurs mondes restent dans Mes mondes, sauf si tu coches la case : ils partent alors dans la Corbeille de Windows avec leurs sauvegardes, et plus rien ne reste dans le launcher.`,
    rmW: (n) => `Retirer aussi leurs ${n} monde${n > 1 ? "s" : ""}`,
    running: "Ferme le jeu d'abord : une de ces installations est en train de tourner.",
    delT: (n) => `Supprimer ${n} monde${n > 1 ? "s" : ""} pour de bon ?`,
    delWhat: "Tu vas effacer tout ce que le launcher garde de ces mondes :",
    delWorlds: (n) => `${n > 1 ? "les mondes" : "le monde"} sur ce PC`,
    delBk: "toutes leurs sauvegardes, y compris les Versions d'origine 🔒",
    delCloud: (n) => `${n > 1 ? `les versions dans le cloud de ${n} d'entre eux` : "ses versions dans le cloud"}`,
    more: (n) => `… et ${n} autre${n > 1 ? "s" : ""}`,
    cdT: (n) => `Suppression de ${n} monde${n > 1 ? "s" : ""}`,
    busy: (i, n) => `Suppression… ${i} / ${n}`,
    done: (n) => `${n} monde${n > 1 ? "s" : ""} supprimé${n > 1 ? "s" : ""} définitivement.`,
    fail: (n) => `${n} monde${n > 1 ? "s n'ont" : " n'a"} pas pu être supprimé${n > 1 ? "s" : ""} :`,
    gameOn: "Ferme le jeu d'abord : on ne supprime pas de monde pendant une partie.",
  } : {
    tip: "Tip: hold the click and move over several items to tick them in one go.",
    pick: "Select", all: "Select all", none: "Deselect all", cancel: "Cancel",
    nI: (n) => (n ? `${n} installation${n > 1 ? "s" : ""} selected` : "Click (or drag over) the installations to remove"),
    nW: (n) => (n ? `${n} world${n > 1 ? "s" : ""} selected` : "Click (or drag over) the worlds to delete"),
    rm: (n) => `Remove${n ? ` (${n})` : ""}…`, del: (n) => `🗑 Delete for good${n ? ` (${n})` : ""}…`,
    rmT: (n) => `Remove ${n} installation${n > 1 ? "s" : ""}?`,
    packNote: (n) => `⚠ ${n === 1 ? "The ticked Omniscient Pack is removed entirely" : "The ticked Omniscient Packs are removed entirely"}, with all their versions. To remove only some: open the pack, ⚙ › Remove…`,
    rmD: (l) => `${l}. The installations and their mods are removed from this PC. Their worlds stay in My worlds, unless you tick the box: they then go to the Windows Recycle Bin with their backups, and nothing stays in the launcher.`,
    rmW: (n) => `Also remove their ${n} world${n > 1 ? "s" : ""}`,
    running: "Close the game first: one of these installations is running.",
    delT: (n) => `Delete ${n} world${n > 1 ? "s" : ""} for good?`,
    delWhat: "You are about to erase everything the launcher keeps for these worlds:",
    delWorlds: (n) => `the world${n > 1 ? "s" : ""} on this PC`,
    delBk: "all their backups, including the Original versions 🔒",
    delCloud: (n) => (n > 1 ? `the cloud versions of ${n} of them` : "its versions in the cloud"),
    more: (n) => `… and ${n} more`,
    cdT: (n) => `Deleting ${n} world${n > 1 ? "s" : ""}`,
    busy: (i, n) => `Deleting… ${i} / ${n}`,
    done: (n) => `${n} world${n > 1 ? "s" : ""} deleted for good.`,
    fail: (n) => `${n} world${n > 1 ? "s" : ""} could not be deleted:`,
    gameOn: "Close the game first: worlds are not deleted during a game.",
  });
  function pjSelBar(kind) {
    const set = kind === "i" ? PJ.pick : PJ.wpick;
    const n = set.size;
    return `<div class="pj-selbar" role="toolbar" data-pj-selbar="${kind}"><b data-pj-seln title="${esc(SELT().tip)}">${esc(kind === "i" ? SELT().nI(n) : SELT().nW(n))}</b>
      <button type="button" class="link-btn" data-pj-sel-all="${kind}">${esc(SELT().all)}</button>
      <span class="sp"></span><button type="button" class="btn-secondary" data-pj-sel-x="${kind}" style="margin:0;">${esc(SELT().cancel)}</button>
      <button type="button" class="join-btn nl-danger" data-pj-sel-go="${kind}" ${n ? "" : "disabled"}>${esc(kind === "i" ? SELT().rm(n) : SELT().del(n))}</button></div>`;
  }
  // Met à jour coches et barre sans tout redessiner (la recherche des mondes redessine la liste).
  function pjSyncPick() {
    if (PJ.pick) panel.querySelectorAll("[data-pj-grid] > [data-pj-tile]").forEach((t) => t.classList.toggle("picked", PJ.pick.has(t.dataset.pjTile)));
    if (PJ.wpick) panel.querySelectorAll(".mv-body .mv-row[data-world]").forEach((r) => r.classList.toggle("picked", PJ.wpick.has(r.dataset.world)));
    const bar = panel.querySelector("[data-pj-selbar]");
    if (!bar) return;
    const kind = bar.dataset.pjSelbar;
    const n = (kind === "i" ? PJ.pick : PJ.wpick)?.size || 0;
    bar.querySelector("[data-pj-seln]").textContent = kind === "i" ? SELT().nI(n) : SELT().nW(n);
    const go = bar.querySelector("[data-pj-sel-go]");
    go.textContent = kind === "i" ? SELT().rm(n) : SELT().del(n);
    go.disabled = !n;
    const allOn = kind === "i" ? n && n === pjSorted().filter((v) => v.id !== PJ.hide).length : n && [...panel.querySelectorAll(".mv-body .mv-row[data-world]")].every((r) => PJ.wpick.has(r.dataset.world));
    bar.querySelector("[data-pj-sel-all]").textContent = allOn ? SELT().none : SELT().all;
  }
  // Cocher en glissant (Rushi, 28/10) : clic maintenu, tout ce que la souris survole prend le même
  // état que le premier élément (coché, ou décoché si on part d'un élément déjà coché).
  function pjPickTarget(el) {
    if (PJ.pick) {
      const t = el.closest?.("[data-pj-grid] > [data-pj-tile]");
      if (t) return { set: PJ.pick, key: t.dataset.pjTile };
    }
    if (PJ.wpick && !el.closest?.(".mv-sec-h")) {
      const r = el.closest?.(".mv-body .mv-row[data-world]");
      if (r) return { set: PJ.wpick, key: r.dataset.world };
    }
    return null;
  }
  function pjPaint(t, on) {
    if (on === t.set.has(t.key)) return;
    on ? t.set.add(t.key) : t.set.delete(t.key);
    pjSyncPick();
  }
  panel.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || !on("playTiles") || packPage) return;
    const t = pjPickTarget(e.target);
    if (!t) return;
    e.preventDefault();
    PJ.drag = { on: !t.set.has(t.key) };
    pjPaint(t, PJ.drag.on);
  });
  panel.addEventListener("mouseover", (e) => {
    if (!PJ.drag) return;
    const t = pjPickTarget(e.target);
    if (t) pjPaint(t, PJ.drag.on);
  });
  // Près du haut ou du bas de la page, elle défile toute seule pendant le glissé.
  panel.addEventListener("mousemove", (e) => {
    if (!PJ.drag) return;
    const sc = panel.closest("main") || panel;
    const r = sc.getBoundingClientRect();
    if (e.clientY > r.bottom - 50) sc.scrollBy(0, 14);
    else if (e.clientY < r.top + 50) sc.scrollBy(0, -14);
  });
  document.addEventListener("mouseup", () => (PJ.drag = null));
  async function pjRmMany(ids) {
    // Dans l'ordre de l'écran, pas celui du glisser : « En attente » se lit 1, 2, 3… (01/11, Rushi).
    const screen = [...panel.querySelectorAll("[data-pj-grid] > [data-pj-tile]")].map((t) => t.dataset.pjTile);
    const place = (id) => (screen.includes(id) ? screen.indexOf(id) : screen.length);
    const tiles = [...ids].sort((a, b) => place(a) - place(b)).map((id) => data.versions.find((x) => x.id === id)).filter(Boolean);
    if (!tiles.length) return;
    // Une tuile de Pack Omniscient = tout le pack : ses autres versions partent avec elle (29/10).
    const vs = [...new Set(tiles.flatMap((v) => pjGroup(v)))];
    const extra = vs.filter((v) => !tiles.includes(v));
    if (vs.some((v) => data.running?.versionId === v.id)) return showModal({ title: SELT().rmT(vs.length), body: SELT().running, confirmLabel: "OK", tone: "warn" });
    // Un monde n'appartient qu'à une installation (la première qui le revendique).
    const taken = new Set();
    const own = new Map(vs.map((v) => [v.id, data.worlds.filter((w) => (w.home === v.id || w.lastVersionId === v.id) && !taken.has(w.key) && taken.add(w.key))]));
    const names = tiles.slice(0, 8).map((v) => `« ${pjName(v)} »${pjGroup(v).length > 1 ? ` (${PJT().nV(pjGroup(v).length)})` : ""}`).join(", ") + (tiles.length > 8 ? ` ${SELT().more(tiles.length - 8)}` : "");
    const res = await showModal({ title: SELT().rmT(tiles.length), body: SELT().rmD(names) + (tiles.some((v) => pjGroup(v).length > 1) ? ` ${SELT().packNote(tiles.filter((v) => pjGroup(v).length > 1).length)}` : ""), checkboxLabel: taken.size ? SELT().rmW(taken.size) : undefined, confirmLabel: T("yesRemove"), cancelLabel: T("no"), tone: "warn" });
    if (!res?.confirmed) return;
    const withWorlds = !!(taken.size && res.checked);
    PJ.pick = null;
    PJ.tilesAll = true;
    render();
    // Versions sans tuile (dans un Pack Omniscient) : retirées directement, sans animation.
    if (extra.length) {
      (async () => {
        for (const v of extra) await api.removeVersion(v.id, withWorlds ? own.get(v.id).map((w) => w.key) : []).catch(() => null);
        refresh();
      })();
    }
    for (const v of tiles) {
      const ws = own.get(v.id);
      pjRmQueue({ id: v.id, keys: withWorlds ? ws.map((w) => w.key) : [], label: pjName(v), cov: pjCover(v, 46), own: ws.length, withWorlds: withWorlds && ws.length > 0 });
    }
  }
  async function pjDelMany(keys) {
    const items = keys.map((k) => data.worlds.find((w) => w.key === k) || data.gone.find((g) => g.key === k)).filter(Boolean);
    if (!items.length) return;
    if (data.running) return showModal({ title: SELT().delT(items.length), body: SELT().gameOn, confirmLabel: "OK", tone: "warn" });
    const nCloud = items.filter((w) => data.cloud?.worlds?.some((x) => x.worldKey === w.key)).length;
    const here = items.filter((w) => data.worlds.some((x) => x.key === w.key)).length;
    if (!(await pjConfirmMany(items, here, nCloud))) return;
    if (!(await pjCountdownMany(items.length))) return toast(T("foreverCancelled"));
    const prog = overlay(`<div class="modal-box pop-in nb-box" role="status" style="max-width:380px;text-align:center;"><span class="pj-spin"></span><p data-busy style="margin:10px 0 0;font-size:13.5px;"></p></div>`);
    prog.ov.dataset.locked = "1";
    const fails = [];
    let cloudFails = 0;
    for (const [i, w] of items.entries()) {
      prog.$("[data-busy]").textContent = SELT().busy(i + 1, items.length);
      const out = await api.deleteWorldForever(w.key, { sameBatch: i > 0 }).catch((e) => ({ ok: false, error: String(e?.message || e) }));
      if (!out?.ok) fails.push(`${w.name} (${out?.error || "?"})`);
      else if (out.cloudError) cloudFails++;
    }
    prog.close();
    PJ.wpick = null;
    await refresh();
    const ok = items.length - fails.length;
    if (ok) toast(SELT().done(ok));
    if (fails.length) showModal({ title: SELT().delT(items.length), body: `${SELT().fail(fails.length)} ${fails.join(" ; ")}`, confirmLabel: "OK", tone: "warn" });
    else if (cloudFails) showModal({ title: SELT().delT(items.length), body: T("foreverCloudFail", { e: `${cloudFails}` }), confirmLabel: "OK", tone: "warn" });
  }
  function pjConfirmMany(items, here, nCloud) {
    const word = T("foreverWord");
    const what = [here ? SELT().delWorlds(here) : "", SELT().delBk, nCloud ? SELT().delCloud(nCloud) : ""].filter(Boolean);
    const names = items.slice(0, 8).map((w) => `<li><span class="sensitive" data-mask="${esc(T("mvMask"))}">${esc(w.name)}</span></li>`).join("") + (items.length > 8 ? `<li style="list-style:none;color:var(--muted);">${esc(SELT().more(items.length - 8))}</li>` : "");
    return new Promise((resolve) => {
      const c = overlay(`<div class="modal-box pop-in nb-box fv-box tone-danger" role="alertdialog" aria-modal="true" aria-labelledby="fvm-t" style="max-width:480px;text-align:left;">
        <h3 id="fvm-t">⚠ ${esc(SELT().delT(items.length))}</h3>
        <ul class="pj-dnames">${names}</ul>
        <p style="font-size:13px;margin:8px 0 0;">${esc(SELT().delWhat)}</p>
        <ul>${what.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <p class="fv-stop">${esc(T("foreverNoBack"))}</p>
        <p style="font-size:12.5px;color:var(--muted);margin:0 0 12px;line-height:1.45;">${esc(T("foreverNote"))}</p>
        <label style="font-size:12.5px;color:var(--muted);">${esc(T("foreverType", { x: word }))}</label>
        <input type="text" id="fvm-in" class="play-in" autocomplete="off" spellcheck="false" style="width:100%;margin-top:6px;">
        <div class="nb-acts"><button type="button" class="join-btn" id="fvm-no">${esc(T("cancel"))}</button><button type="button" class="btn-secondary nl-danger" id="fvm-ok" style="margin:0;" disabled>${esc(T("foreverOk"))}</button></div></div>`);
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        obs.disconnect();
        c.close();
        resolve(v);
      };
      const obs = new MutationObserver(() => !document.body.contains(c.ov) && finish(false));
      obs.observe(document.body, { childList: true });
      const input = c.$("#fvm-in");
      input.focus();
      input.addEventListener("input", () => (c.$("#fvm-ok").disabled = input.value.trim().toLowerCase() !== word));
      input.addEventListener("keydown", (e) => e.key === "Enter" && !c.$("#fvm-ok").disabled && finish(true));
      c.$("#fvm-no").addEventListener("click", () => finish(false));
      c.$("#fvm-ok").addEventListener("click", () => finish(true));
    });
  }
  // Les 10 secondes (comme pour un seul monde) : un seul bouton « Annuler », rien n'est effacé avant la fin.
  function pjCountdownMany(n) {
    const SEC = 10;
    return new Promise((resolve) => {
      const c = overlay(`<div class="modal-box pop-in nb-box tone-danger" role="alertdialog" aria-modal="true" aria-labelledby="cdm-t" style="max-width:440px;text-align:left;">
        <h3 id="cdm-t">🗑 ${esc(SELT().cdT(n))}</h3>
        <p style="font-size:13px;margin:8px 0 12px;line-height:1.45;" aria-live="polite" id="cdm-txt"></p>
        <div class="cd-bar"><i id="cdm-fill"></i></div>
        <div class="nb-acts"><button type="button" class="join-btn" id="cdm-no" style="margin-left:auto;">${esc(T("cancel"))}</button></div></div>`);
      c.ov.dataset.locked = "1";
      const t0 = Date.now();
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        clearInterval(timer);
        c.close();
        resolve(v);
      };
      const tick = () => {
        const left = Math.max(0, SEC - (Date.now() - t0) / 1000);
        c.$("#cdm-txt").textContent = T("cdD", { s: Math.ceil(left) });
        c.$("#cdm-fill").style.width = `${(1 - left / SEC) * 100}%`;
        if (left <= 0) finish(true);
      };
      const timer = setInterval(tick, 100);
      tick();
      c.$("#cdm-no").addEventListener("click", () => finish(false));
      c.$("#cdm-no").focus();
    });
  }
  const pjWithGhost = (tiles) => {
    const out = [...tiles];
    // Chaque fantôme reste à la place de sa tuile : idx = tuiles avant lui, ord = sa place à l'écran.
    [...PJ.ghosts].sort((a, b) => a.ord - b.ord).forEach((g, i) => out.splice(Math.min(Math.max(g.idx, 0) + i, out.length), 0, pjGhost(g)));
    return out;
  };
  // Retrait terminé : recalcule la place de tous les fantômes d'après l'écran. Sinon, retirer une
  // tuile placée avant un fantôme le décale et les tuiles changent d'ordre (01/11, Rushi : « au pif »).
  function pjGhostSlots(id, ghost) {
    let tiles = 0, ord = 0;
    panel.querySelectorAll("[data-pj-grid] > .pj2-tile").forEach((t) => {
      if (t.dataset.pjTile === id) {
        ghost.idx = tiles;
        ghost.ord = ord++;
      } else if (t.dataset.pjTile) tiles++;
      else if (t.dataset.pjGhost) {
        const g = PJ.ghosts.find((x) => x.key === +t.dataset.pjGhost);
        if (g) {
          g.idx = tiles;
          g.ord = ord++;
        }
      }
    });
  }
  // Met à jour un élément sans tout recréer : ce qui n'a pas changé garde ses nœuds, donc ses animations
  // (rond, barre, fondu) ne repartent pas de zéro et ses images ne clignotent pas (01/11, Rushi :
  // « à chaque actualisation toutes les animations redémarrent »). Les tuiles sont suivies par leur id.
  const pjNodeKey = (n) => {
    if (n.nodeType !== 1) return null;
    if (n.dataset.pjTile) return `t:${n.dataset.pjTile}`;
    if (n.dataset.pjGhost) return `g:${n.dataset.pjGhost}`;
    if (n.hasAttribute("data-pj-drawer")) return "drawer";
    if (n.hasAttribute("data-pj-tiles")) return "more";
    return null;
  };
  const pjSameKind = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && (a.nodeType !== 1 || a.classList[0] === b.classList[0]);
  function pjMorph(a, b) {
    if (a.isEqualNode(b)) return;
    if (a.nodeType !== 1) {
      a.nodeValue = b.nodeValue;
      return;
    }
    for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
    for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
    if (a.nodeName === "INPUT") {
      if (a.type === "checkbox" || a.type === "radio") a.checked = b.hasAttribute("checked");
      else if (document.activeElement !== a) a.value = b.getAttribute("value") ?? "";
    }
    pjMorphKids(a, b);
  }
  function pjMorphKids(parent, next) {
    const keyed = new Map();
    for (const n of [...parent.childNodes]) if (pjNodeKey(n)) keyed.set(pjNodeKey(n), n);
    const wanted = new Set([...next.childNodes].map(pjNodeKey).filter(Boolean));
    for (const [k, n] of keyed) if (!wanted.has(k)) {
      n.remove();
      keyed.delete(k);
    }
    const kept = new Set();
    let cur = parent.firstChild;
    for (const nk of [...next.childNodes]) {
      // Le tiroir est rangé à part (pjPlaceDrawer le remet sous la bonne rangée) : il ne bloque pas le parcours.
      while (cur && pjNodeKey(cur) === "drawer") cur = cur.nextSibling;
      const key = pjNodeKey(nk);
      if (key === "drawer" && keyed.has(key)) {
        const dr = keyed.get(key);
        kept.add(dr);
        pjMorph(dr, nk);
        continue;
      }
      const target = key ? keyed.get(key) : cur && !pjNodeKey(cur) && pjSameKind(cur, nk) ? cur : null;
      if (!target) {
        parent.insertBefore(nk, cur);
        kept.add(nk);
        continue;
      }
      if (target === cur) cur = cur.nextSibling;
      else parent.insertBefore(target, cur);
      kept.add(target);
      pjMorph(target, nk);
    }
    for (const n of [...parent.childNodes]) if (!kept.has(n)) n.remove();
  }
  function pjPatch(el, html) {
    // En sortant de la page d'un pack, rien à garder : ses boutons ont leurs propres écouteurs.
    if (el.querySelector(":scope > .pk-page")) {
      el.innerHTML = html;
      return;
    }
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    pjMorphKids(el, tpl.content);
  }
  // Le tiroir se place après la dernière tuile de la rangée de la tuile choisie, flèche sous elle.
  function pjPlaceDrawer() {
    const grid = panel.querySelector("[data-pj-grid]");
    const dr = grid?.querySelector("[data-pj-drawer]");
    const sel = grid?.querySelector(".pj2-tile.sel");
    if (!dr || !sel) return;
    let last = sel;
    for (const t of grid.querySelectorAll(".pj2-tile")) if (Math.abs(t.offsetTop - sel.offsetTop) < 4) last = t;
    if (last.nextElementSibling !== dr) last.after(dr);
    const a = dr.querySelector(".pj2-arrow");
    if (a) a.style.left = `${sel.offsetLeft - grid.offsetLeft + sel.offsetWidth / 2 - 9}px`;
  }
  addEventListener("resize", () => {
    if (on("playTiles") && !packPage && !panel.hidden) pjPlaceDrawer();
  });

  // Menu « … » d'une installation (Retirer n'est plus à côté de Jouer).
  function pjCloseMenu() {
    if (PJ.menu) {
      PJ.menu.remove();
      PJ.menu = null;
    }
    panel.querySelectorAll('[data-pj-menu][aria-expanded="true"]').forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  function pjOpenMenu(btn, id) {
    pjCloseMenu();
    mvCloseMenu();
    const v = data.versions.find((x) => x.id === id);
    if (!v) return;
    const m = document.createElement("div");
    m.className = "mv-menu";
    m.setAttribute("role", "menu");
    const it = (act, label, danger) => `<button type="button" role="menuitem" data-pj-act="${act}" data-id="${esc(id)}"${danger ? ' style="color:var(--danger,#e5484d);"' : ""}>${label}</button>`;
    m.innerHTML = [
      newerFor(v) ? it("up", `⬆ ${esc(PJT().up)} → ${esc(newerFor(v))}`) : "",
      it("rename", `✎ ${esc(T("rename"))}`),
      pageOn(v) ? it("folder", esc(PJT().folder)) : "",
      '<hr style="border:0;border-top:1px solid var(--border);margin:4px 2px;">',
      it("remove", esc(PJT().remove), true),
    ].join("");
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    m.style.top = `${Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8))}px`;
    m.style.left = `${Math.max(8, r.right - m.offsetWidth)}px`;
    btn.setAttribute("aria-expanded", "true");
    PJ.menu = m;
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pj-act]");
      if (!b) return;
      pjCloseMenu();
      const act = b.dataset.pjAct;
      if (act === "up") return openUpdateVersion(id);
      if (act === "folder") return api.myPack.openFolder(id, "");
      // Pack Omniscient (29/10, Rushi) : même fenêtre que ⚙ › Retirer (tout le pack ou versions choisies).
      if (act === "remove") return pjGroup(v).length > 1 ? omRemovePack(id) : removeVersion(id);
      if (act === "rename") return pjRename(id);
    });
  }
  function pjRename(id) {
    const v = data.versions.find((x) => x.id === id);
    if (!v) return;
    const fr = L() === "fr";
    const def = v.pack ? packName(v.pack) : `Minecraft ${v.minecraftVersion}`;
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" style="max-width:420px;text-align:left;">
      <h3>${esc(fr ? "Renommer l'installation" : "Rename the installation")}</h3>
      <p style="margin:2px 0 8px;font-size:13px;color:var(--muted);">${esc(fr ? "Le nom change seulement dans ton launcher. Laisse vide pour reprendre le nom d'origine." : "The name only changes in your launcher. Leave it empty to go back to the original name.")}</p>
      <input class="play-in" data-n maxlength="60" value="${esc(pjName(v))}" placeholder="${esc(def)}" style="width:100%;margin:6px 0 0;">
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;"><button type="button" class="btn-secondary" data-x>${esc(T("cancel"))}</button><button type="button" class="join-btn" data-ok>${esc(T("rename"))}</button></div></div>`);
    const inp = m.$("[data-n]");
    inp.focus();
    inp.select();
    const go = async () => {
      const n = inp.value.trim().slice(0, 60);
      // Pack Omniscient : le nom vaut pour toutes ses versions.
      let r = null;
      for (const x of pjGroup(v)) r = (await api.renameVersion(x.id, n || (x.pack ? def : "")).catch(() => null)) || r;
      m.close();
      if (!r?.ok) return toast(fr ? "Le nom n'a pas pu être changé." : "The name could not be changed.");
      await refresh();
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    m.ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      if (e.target.closest("[data-ok]")) return go();
    });
  }
  document.addEventListener("mousedown", (e) => {
    if (PJ.menu && !PJ.menu.contains(e.target) && !e.target.closest("[data-pj-menu]")) pjCloseMenu();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && PJ.menu) pjCloseMenu();
    else if (e.key === "Escape" && (PJ.pick || PJ.wpick) && !document.querySelector(".play-modal, .modal-overlay") && !panel.hidden) {
      PJ.pick = null;
      PJ.wpick = null;
      render();
    }
  });
  // Clics propres aux tuiles (phase de capture : avant le gestionnaire général de la page).
  panel.addEventListener("click", (e) => {
    if (!on("playTiles") || packPage) return;
    const b = e.target.closest("button");
    const take = (fn) => {
      e.stopImmediatePropagation();
      fn();
    };
    if (b?.dataset.pjMenu) return take(() => (b.getAttribute("aria-expanded") === "true" ? pjCloseMenu() : pjOpenMenu(b, b.dataset.pjMenu)));
    if (b?.dataset.pjPage) return take(() => openPackPage(b.dataset.pjPage));
    if (b?.hasAttribute("data-pj-pick")) return take(() => { PJ.pick = new Set(); PJ.sel = null; render(); });
    if (b?.hasAttribute("data-pj-wpick")) return take(() => { PJ.wpick = new Set(); render(); });
    if (b?.dataset.pjSelX) return take(() => { PJ.pick = null; PJ.wpick = null; render(); });
    if (b?.dataset.pjSelAll === "i") return take(() => {
      const all = pjSorted().filter((v) => v.id !== PJ.hide).map((v) => v.id);
      PJ.pick = new Set(PJ.pick.size === all.length ? [] : all);
      if (PJ.pick.size && !PJ.tilesAll) { PJ.tilesAll = true; render(); } else pjSyncPick();
    });
    if (b?.dataset.pjSelAll === "w") return take(() => {
      const keys = [...panel.querySelectorAll(".mv-body .mv-row[data-world]")].map((r) => r.dataset.world);
      const allOn = keys.length && keys.every((k) => PJ.wpick.has(k));
      keys.forEach((k) => (allOn ? PJ.wpick.delete(k) : PJ.wpick.add(k)));
      pjSyncPick();
    });
    if (b?.dataset.pjSelGo === "i") return take(() => pjRmMany([...PJ.pick]));
    if (b?.dataset.pjSelGo === "w") return take(() => pjDelMany([...PJ.wpick]));
    const pickEl = pjPickTarget(e.target);
    if (pickEl) return take(() => e.detail === 0 && pjPaint(pickEl, !pickEl.set.has(pickEl.key)));
    if (b?.hasAttribute("data-pj-all")) return take(() => { PJ.allView = true; PJ.pick = null; render(); panel.scrollTop = 0; });
    if (b?.hasAttribute("data-pj-back")) return take(() => { PJ.allView = false; PJ.wpick = null; render(); });
    if (b?.hasAttribute("data-pj-more")) return take(() => { PJ.drawerAll = !PJ.drawerAll; render(); });
    if (b?.hasAttribute("data-pj-tiles")) return take(() => { PJ.tilesAll = !PJ.tilesAll; render(); });
    const tile = e.target.closest("[data-pj-tile]");
    const id = b?.dataset.pjW || (tile && !b && !pageOn(data.versions.find((x) => x.id === tile.dataset.pjTile)) ? tile.dataset.pjTile : null);
    // 27/10 (Rushi) : un clic sur la tuile ouvre la page de l'installation ; « Mondes (N) » ouvre le tiroir.
    if (tile && !b && !id) return take(() => openPackPage(tile.dataset.pjTile));
    if (!id) return;
    e.stopImmediatePropagation();
    PJ.sel = PJ.sel === id ? null : id;
    PJ.drawerAll = false;
    render();
    panel.querySelector("[data-pj-drawer]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, true);
  panel.addEventListener("keydown", (e) => {
    const t = e.target.closest?.("[data-pj-tile]");
    if (t && e.target === t && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      t.click();
    }
  });
  // Effet visuel quand on retire une installation (27/10, demande de Rushi : sans effet, la tuile
  // disparaît d'un coup et le joueur croit à un bug). Pendant le retrait, la tuile montre ce qui se
  // passe ; ensuite elle s'efface, les autres glissent à sa place et une tuile « fantôme » dit pendant
  // 6 s ce qui s'est passé (variante C de la preview, 27/10).
  const pjSleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const RMT = () => (L() === "fr" ? {
    busy: "Retrait…", busyD: "Mods et fichiers de l'installation", wait: "En attente", waitD: (n) => (n ? `Retrait après ${n} autre${n > 1 ? "s" : ""}` : "Retrait juste après"), cancel: "Annuler",
    ghost: (l) => `« ${l} » retirée`, gone: "Installation retirée", kept: (n) => (n ? `${n} monde${n > 1 ? "s" : ""} gardé${n > 1 ? "s" : ""} dans Mes mondes.` : "Tu pourras la réinstaller avec « + Nouvelle installation »."),
    trashed: (n) => `${n} monde${n > 1 ? "s" : ""} mis à la Corbeille avec ${n > 1 ? "leurs" : "ses"} sauvegardes.`, seeW: "Voir mes mondes", ok: "OK",
  } : {
    busy: "Removing…", busyD: "Installation mods and files", wait: "Waiting", waitD: (n) => (n ? `Removed after ${n} other${n > 1 ? "s" : ""}` : "Removed right after"), cancel: "Cancel",
    ghost: (l) => `“${l}” removed`, gone: "Installation removed", kept: (n) => (n ? `${n} world${n > 1 ? "s" : ""} kept in My worlds.` : "You can install it again with “+ New installation”."),
    trashed: (n) => `${n} world${n > 1 ? "s" : ""} moved to the Recycle Bin with ${n > 1 ? "their" : "its"} backups.`, seeW: "See my worlds", ok: "OK",
  });
  // Calque posé sur la tuile pendant le retrait, ou « En attente » (n°) si d'autres passent avant elle
  // (file d'attente, demande de Rushi 27/10 : on peut en retirer plusieurs d'affilée).
  function pjRmLayer(v) {
    const q = PJ.rmQ.findIndex((j) => j.id === v.id);
    if (q >= 0) return `<div class="pj2-rmov wait"><span class="pj2-qn">${q + 1}</span><b>${esc(RMT().wait)}</b><small>${esc(RMT().waitD(q + (PJ.rm ? 1 : 0)))}</small><button type="button" class="link-btn" data-pj-rm-cancel="${esc(v.id)}" style="font-size:12px;">${esc(RMT().cancel)}</button></div>`;
    if (PJ.rm?.id !== v.id) return "";
    return `<div class="pj2-rmov"><span class="spin"></span><b>${esc(RMT().busy)}</b><small>${esc(RMT().busyD)}</small></div>`;
  }
  // Tuile « fantôme » : reste 6 s à la place de la tuile retirée pour dire ce qui s'est passé.
  function pjGhost(g) {
    // Jaquette du pack en gris (choix de Rushi, 27/10) : on reconnaît ce qui vient de partir, sans vert « succès ».
    const head = `<span class="gcov">${g.cov || ""}</span><em>${esc(RMT().gone)}</em>`;
    return `<div class="pj2-tile pj2-ghost" data-pj-ghost="${g.key}" role="status" aria-label="${esc(RMT().ghost(g.label))}">${head}<b title="${esc(g.label)}">${esc(g.label)}</b>
      <small>${esc(g.withWorlds ? RMT().trashed(g.n) : RMT().kept(g.n))}</small>
      <span class="pj2-gacts">${!g.withWorlds && g.n ? `<button type="button" class="link-btn" data-pj-all>${esc(RMT().seeW)}</button>` : ""}<button type="button" class="pj2-gok" data-pj-ghost-x="${g.key}">${esc(RMT().ok)}</button></span><i class="pj2-gtime"></i></div>`;
  }
  const pjKey = (t) => t.dataset.pjTile || (t.dataset.pjGhost ? `ghost:${t.dataset.pjGhost}` : t.hasAttribute("data-new-version") ? "new" : "more");
  function pjRects() {
    const m = new Map();
    panel.querySelectorAll("[data-pj-grid] > .pj2-tile").forEach((t) => m.set(pjKey(t), t.getBoundingClientRect()));
    return m;
  }
  // Les autres tuiles glissent de leur ancienne place vers la nouvelle (au lieu de sauter).
  function pjFlip(before) {
    panel.querySelectorAll("[data-pj-grid] > .pj2-tile").forEach((t) => {
      const r0 = before.get(pjKey(t));
      if (!r0) return;
      const r1 = t.getBoundingClientRect();
      const dx = r0.left - r1.left;
      const dy = r0.top - r1.top;
      if (dx || dy) t.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 340, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
  }
  const pjTileEl = (id) => [...panel.querySelectorAll("[data-pj-tile]")].find((t) => t.dataset.pjTile === id) || null;
  // File d'attente des retraits : false si la tuile n'est pas à l'écran (page d'un pack, « Tous mes
  // mondes ») → comportement d'avant. Les retraits passent un par un, dans l'ordre des clics.
  function pjRmQueue(job) {
    if (!on("playTiles") || packPage || PJ.allView || !pjTileEl(job.id)) return false;
    if (PJ.rm?.id === job.id || PJ.rmQ.some((j) => j.id === job.id)) return true;
    PJ.rmQ.push(job);
    render();
    pjRmRun();
    return true;
  }
  async function pjRmRun() {
    if (PJ.rmRunning) return;
    PJ.rmRunning = true;
    try {
      while (PJ.rmQ.length) {
        const job = PJ.rmQ.shift();
        PJ.rm = { id: job.id, t0: Date.now(), v: data.versions.find((x) => x.id === job.id), at: data.versions.findIndex((x) => x.id === job.id) };
        render();
        const r = await api.removeVersion(job.id, job.keys).catch((e) => ({ ok: false, error: String(e?.message || e) }));
        if (!r?.ok) {
          PJ.rm = null;
          render();
          showModal({ title: job.label, body: r?.error || "?", confirmLabel: "OK", tone: "warn" });
          continue;
        }
        await pjRmEnd(job.id, { label: job.label, cov: job.cov, n: job.withWorlds ? r.worlds ?? job.keys.length : job.own, withWorlds: job.withWorlds });
      }
    } finally {
      PJ.rmRunning = false;
    }
  }
  // Fin du retrait : la tuile s'efface, la tuile fantôme prend sa place, les autres glissent.
  async function pjRmEnd(id, info) {
    // Au moins 0,6 s de « Retrait… » : sinon l'œil ne voit rien (un retrait rapide passe pour un bug).
    const left = 600 - (Date.now() - (PJ.rm?.t0 || 0));
    if (left > 0) await pjSleep(left);
    const tile = pjTileEl(id);
    if (tile) await tile.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.82)" }], { duration: 260, easing: "ease-in", fill: "forwards" }).finished.catch(() => {});
    const idx = pjSorted().filter((x) => x.id !== PJ.hide).findIndex((x) => x.id === id);
    const before = pjRects();
    PJ.rm = null;
    PJ.hide = id;
    if (PJ.sel === id) PJ.sel = null;
    const key = ++PJ.ghostSeq;
    const ghost = { key, idx, ord: 1e9 + key, label: info.label, cov: info.cov, n: info.n, withWorlds: info.withWorlds, timer: setTimeout(() => pjGhostDue(key), 6000) };
    pjGhostSlots(id, ghost);
    PJ.ghosts.push(ghost);
    PJ.flip = before;
    render();
    await refresh();
    PJ.hide = null;
  }
  // Tant que la file tourne, les fantômes restent : les tuiles ne bougent pas, elles glissent une fois à la fin.
  function pjGhostDue(key) {
    const g = PJ.ghosts.find((x) => x.key === key);
    if (!g) return;
    if (PJ.rm || PJ.rmQ.length) g.timer = setTimeout(() => pjGhostDue(key), 500);
    else pjGhostOut(key);
  }
  async function pjGhostOut(key) {
    const g = PJ.ghosts.find((x) => x.key === key);
    if (!g) return;
    clearTimeout(g.timer);
    const el = panel.querySelector(`[data-pj-ghost="${key}"]`);
    if (el) await el.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.9)" }], { duration: 220, easing: "ease-in", fill: "forwards" }).finished.catch(() => {});
    PJ.flip = pjRects();
    PJ.ghosts = PJ.ghosts.filter((x) => x !== g);
    render();
  }
  panel.addEventListener("click", (e) => {
    const x = e.target.closest("[data-pj-ghost-x]");
    if (x) {
      e.stopImmediatePropagation();
      return pjGhostOut(+x.dataset.pjGhostX);
    }
    const c = e.target.closest("[data-pj-rm-cancel]");
    if (c) {
      e.stopImmediatePropagation();
      PJ.rmQ = PJ.rmQ.filter((j) => j.id !== c.dataset.pjRmCancel);
      render();
    }
  }, true);
  const PJRM_CSS = document.createElement("style");
  PJRM_CSS.textContent = `
  .pj2-tile.rm-busy { pointer-events:none; }
  .pj2-tile.rm-busy > :not(.pj2-rmov) { filter:grayscale(.8); opacity:.35; transition:opacity .2s, filter .2s; }
  .pj2-rmov { position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:12px; text-align:center; border-radius:12px; background:color-mix(in srgb, var(--surface) 86%, transparent); animation:pjfade .18s ease-out; }
  .pj2-rmov b { font-size:13.5px; }
  .pj2-rmov small { font-size:11.5px; color:var(--muted); }
  .pj2-rmov.wait { pointer-events:auto; background:color-mix(in srgb, var(--surface) 80%, transparent); }
  .pj2-qn { width:26px; height:26px; border-radius:50%; display:grid; place-items:center; font-weight:800; font-size:13px; border:2px dashed color-mix(in srgb, var(--foreground) 35%, transparent); color:var(--muted); }
  .pj2-rmov .spin { width:22px; height:22px; border-radius:50%; border:3px solid color-mix(in srgb, var(--foreground) 18%, transparent); border-top-color:var(--accent); animation:pjspin .8s linear infinite; display:inline-block; }
  .pj2-tile.pj2-ghost { align-items:center; justify-content:center; gap:4px; padding:16px 14px 18px; text-align:center; border:1px dashed color-mix(in srgb, var(--foreground) 22%, transparent); background:color-mix(in srgb, var(--foreground) 3%, var(--surface)); cursor:default; min-height:150px; overflow:hidden; animation:pjfade .25s ease-out; }
  .pj2-ghost > em { margin-bottom:2px; font-style:normal; font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--success); }
  .pj2-ghost > b { max-width:100%; font-size:13px; font-weight:700; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
  .pj2-ghost > small { max-width:100%; font-size:11.5px; color:var(--muted); line-height:1.4; }
  .pj2-gacts { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px 12px; margin-top:8px; }
  .pj2-gacts .link-btn { font-size:12px; }
  .pj2-gok { font:inherit; font-size:12px; font-weight:600; padding:4px 16px; border-radius:999px; border:1px solid color-mix(in srgb, var(--success) 50%, var(--border)); background:color-mix(in srgb, var(--success) 14%, transparent); color:var(--foreground); cursor:pointer; }
  .pj2-gok:hover { background:color-mix(in srgb, var(--success) 24%, transparent); }
  .pj2-tile.pj2-ghost:hover { border-color:color-mix(in srgb, var(--foreground) 22%, transparent); }
  .pj2-ghost > em { color:var(--muted); }
  .pj2-ghost .pj2-gtime { background:color-mix(in srgb, var(--foreground) 30%, transparent); }
  .pj2-ghost .pj2-gok { border-color:var(--border); background:color-mix(in srgb, var(--foreground) 6%, transparent); }
  .pj2-ghost .pj2-gok:hover { background:color-mix(in srgb, var(--foreground) 12%, transparent); }
  .pj2-ghost .gcov { width:46px; height:46px; margin-bottom:6px; border-radius:10px; overflow:hidden; filter:grayscale(1); opacity:.5; animation:pjshrink .5s ease-out; }
  .pj2-ghost .gcov .pj2-cover { border-radius:10px; display:grid; place-items:center; }
  .pj2-ghost .gcov .pj2-ver { font-size:10px; }
  @keyframes pjshrink { from { transform:scale(1.6); opacity:1; filter:none; } }
  .pj2-gtime { position:absolute; left:0; bottom:0; height:3px; background:var(--success); animation:pjtime 6s linear forwards; }
  @keyframes pjspin { to { transform:rotate(360deg); } }
  @keyframes pjfade { from { opacity:0; } }
  @keyframes pjpop { from { transform:scale(.3); opacity:0; } }
  @keyframes pjtime { from { width:100%; } to { width:0; } }
  @media (prefers-reduced-motion: reduce) { .pj2-rmov, .pj2-ghost, .pj2-ghost .gcov { animation:none; } }
  `;
  document.head.appendChild(PJRM_CSS);

  // Interrupteur « Sauvegarde » sur la ligne du monde, à gauche de ▶ (commentaire de Rushi, 27/10).
  function pjSw(w) {
    const fr = L() === "fr";
    const tip = w.backup ? (fr ? `Sauvegarde auto activée pour « ${w.name} » : clique pour la couper` : `Auto backup on for “${w.name}”: click to turn it off`) : fr ? `Sauvegarde auto coupée pour « ${w.name} » : clique pour la remettre` : `Auto backup off for “${w.name}”: click to turn it on`;
    return `<button type="button" class="play-switch mv-sw${w.backup ? "" : " off"}" role="switch" aria-checked="${!!w.backup}" data-switch="${esc(w.key)}" title="${esc(tip)}" aria-label="${esc(tip)}"><span class="lbl">${esc(fr ? (w.backup ? "Sauvegarde" : "Coupée") : w.backup ? "Backup" : "Off")}</span><i></i></button>`;
  }
  // Monde copié pendant une mise à jour avec « garder aussi l'installation ancienne » (27/10).
  const pjCopyTag = (w) => (w.versionCopy ? `<span class="mv-tag copy" title="${esc(L() === "fr" ? `Copie gardée en ${w.minecraftVersion || "?"}, faite avant une mise à jour. L'original est passé dans la nouvelle version.` : `Copy kept on ${w.minecraftVersion || "?"}, made before an update. The original moved to the new version.`)}">${esc(L() === "fr" ? `Copie ${w.minecraftVersion || ""}` : `Copy ${w.minecraftVersion || ""}`)}</span>` : "");
  const PJ_CSS = document.createElement("style");
  PJ_CSS.textContent = `
  .pj2-grid.pj-picking, .mv-body.pj-picking { user-select:none; }
  #pnv-packs .play-row > .sz { align-self:center; white-space:nowrap; }
  .pj2-grid.pj-picking [data-pj-tile] { cursor:pointer; }
  .pj2-grid.pj-picking [data-pj-tile] button, .pj2-grid.pj-picking [data-pj-tile] .pj2-badge { pointer-events:none; }
  .pj2-grid.pj-picking [data-pj-tile] .pj2-foot { opacity:.45; }
  .pj2-grid.pj-picking [data-pj-tile]::after { content:""; position:absolute; top:8px; left:8px; z-index:3; width:22px; height:22px; border-radius:7px; border:2px solid rgba(255,255,255,.85); background:rgba(0,0,0,.35); box-shadow:0 1px 4px rgba(0,0,0,.4); }
  .pj2-grid.pj-picking [data-pj-tile].picked { border-color:var(--danger,#e5484d); box-shadow:0 0 0 2px var(--danger,#e5484d); }
  .pj2-grid.pj-picking [data-pj-tile].picked::after { content:"✓"; display:grid; place-items:center; color:#fff; font-weight:800; font-size:14px; background:var(--danger,#e5484d); border-color:var(--danger,#e5484d); }
  .mv-body.pj-picking .mv-row[data-world] { cursor:pointer; padding-left:44px; position:relative; }
  .mv-body.pj-picking .mv-row[data-world] button, .mv-body.pj-picking .mv-row[data-world] [role="switch"] { pointer-events:none; opacity:.4; }
  .mv-body.pj-picking .mv-row[data-world]::before { content:""; position:absolute; left:12px; top:50%; transform:translateY(-50%); width:20px; height:20px; border-radius:6px; border:2px solid color-mix(in srgb, var(--foreground) 40%, transparent); }
  .mv-body.pj-picking .mv-row[data-world].picked { background:color-mix(in srgb, var(--danger,#e5484d) 12%, var(--surface)); border-color:color-mix(in srgb, var(--danger,#e5484d) 50%, var(--border)); }
  .mv-body.pj-picking .mv-row[data-world].picked::before { content:"✓"; display:grid; place-items:center; color:#fff; font-weight:800; font-size:13px; background:var(--danger,#e5484d); border-color:var(--danger,#e5484d); }
  .pj-selbar { position:sticky; bottom:12px; z-index:20; display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px; margin-top:16px; padding:10px 14px; border-radius:12px; background:var(--surface); border:1px solid var(--border); box-shadow:0 14px 40px -12px rgba(0,0,0,.55); font-size:13px; animation:pjfade .2s ease-out; }
  .pj-selbar .sp { flex:1; }
  .pj-selbar .join-btn { margin:0; }
  .pj-selbar .join-btn:disabled { opacity:.45; cursor:default; }
  .pj-dnames { max-height:150px; overflow:auto; margin:8px 0 4px; padding-left:18px; font-size:13px; font-weight:600; }
  .pj-btn-spin { display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid color-mix(in srgb, currentColor 25%, transparent); border-top-color:currentColor; animation:pjspin .8s linear infinite; vertical-align:middle; }
  .pj-spin { display:inline-block; width:24px; height:24px; border-radius:50%; border:3px solid color-mix(in srgb, var(--foreground) 18%, transparent); border-top-color:var(--accent); animation:pjspin .8s linear infinite; }
  .pj2-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(188px, 1fr)); gap:12px; }
  .pj2-cover { position:relative; border-radius:11px 11px 0 0; display:grid; place-items:center; overflow:hidden; background-size:44px 44px; image-rendering:pixelated; }
  .pj2-cover.van::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg, transparent 40%, rgba(0,0,0,.35)); }
  .pj2-ver { position:relative; z-index:1; font-weight:800; font-size:20px; color:#fff; text-shadow:0 2px 6px rgba(0,0,0,.6); }
  .pj2-cover.pj2-ico { image-rendering:auto; }
  .pj2-cover.pj2-ico::before { content:""; position:absolute; inset:-20px; background:var(--ic) center/cover; filter:blur(18px) brightness(.7) saturate(1.2); }
  .pj2-cover.pj2-ico img { position:relative; aspect-ratio:1; object-fit:cover; border-radius:18%; box-shadow:0 6px 18px rgba(0,0,0,.35); }
  .pj2-ghost .gcov .pj2-ico img { height:100% !important; border-radius:0; box-shadow:none; }
  .pj2-logo { color:#fff; font-weight:800; letter-spacing:.02em; text-shadow:0 3px 10px rgba(0,0,0,.35); line-height:1; }
  .pj2-tile { position:relative; display:flex; flex-direction:column; border-radius:12px; border:1px solid var(--border); background:var(--surface); cursor:pointer; transition:transform .12s, border-color .12s, box-shadow .12s; min-width:0; text-align:left; font:inherit; color:inherit; padding:0; }
  .pj2-tile:hover { transform:translateY(-2px); box-shadow:0 10px 24px -14px rgba(0,0,0,.5); }
  .pj2-tile:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .pj2-tile.sel { border-color:var(--accent); box-shadow:0 0 0 2px var(--accent); }
  .pj2-tile.run { border-color:var(--success); }
  .pj2-tile.fresh:not(.sel) { border-color:var(--success); box-shadow:0 0 0 2px color-mix(in srgb, var(--success) 50%, transparent); }
  .pj2-body { display:flex; flex-direction:column; gap:2px; padding:8px 10px 10px; min-width:0; }
  .pj2-body b { font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pj2-body small { font-size:11.5px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pj2-foot { display:flex; align-items:center; gap:6px; margin-top:4px; padding-top:6px; border-top:1px solid var(--border); min-width:0; }
  .pj2-wbtn { flex:1; min-width:0; display:inline-flex; align-items:center; gap:4px; font:inherit; font-size:12px; font-weight:600; padding:5px 8px; border-radius:8px; border:1px solid var(--border); background:transparent; color:var(--foreground); cursor:pointer; white-space:nowrap; overflow:hidden; }
  .pj2-wbtn svg { transition:transform .15s; flex-shrink:0; }
  .pj2-wbtn .lbl { min-width:0; overflow:hidden; text-overflow:ellipsis; }
  .pj2-wbtn:hover { border-color:var(--accent); }
  .pj2-wbtn[aria-expanded=true] { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 16%, transparent); color:var(--accent-2, var(--accent)); }
  .pj2-wbtn[aria-expanded=true] svg { transform:rotate(90deg); }
  .pj2-acts { display:flex; align-items:center; flex-shrink:0; margin-right:-4px; }
  .pj2-acts .mv-dots { width:28px; height:28px; margin:0; }
  .pj-mini { width:30px; height:30px; border-radius:999px; border:1px solid var(--accent); background:transparent; color:var(--accent-2, var(--accent)); display:grid; place-items:center; cursor:pointer; flex-shrink:0; padding:0; }
  .pj-mini:hover:not(:disabled) { background:var(--accent); color:#fff; }
  .pj-mini:disabled { opacity:.4; cursor:default; }
  .pj-mini svg { width:13px; height:13px; }
  .pj2-badge { position:absolute; top:7px; right:7px; font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:999px; background:rgba(0,0,0,.55); color:#fff; display:inline-flex; gap:5px; align-items:center; max-width:calc(100% - 14px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pj2-badge.up { background:var(--accent); }
  .pj2-badge.warn { left:7px; right:auto; background:var(--warn); color:#000; }
  .pj2-badge.fresh, .pj2-badge.run { left:7px; right:auto; top:48px; background:var(--success); }
  .pj2-badge.run i { width:7px; height:7px; border-radius:50%; background:#fff; animation:mvp 1.2s infinite; }
  .pj2-new { align-items:center; justify-content:center; gap:6px; border-style:dashed; background:none; color:var(--muted); min-height:150px; }
  .pj2-new .plus { font-size:30px; line-height:1; color:var(--accent-2, var(--accent)); }
  .pj2-new b { font-size:12.5px; }
  .pj2-new:hover { color:var(--foreground); border-color:var(--accent); }
  .sw-row { display:flex; flex-direction:column; gap:3px; width:100%; text-align:left; font:inherit; margin:8px 0 0; padding:10px 12px; border-radius:10px; border:1px dashed var(--accent); background:color-mix(in srgb, var(--accent) 8%, transparent); color:var(--foreground); cursor:pointer; }
  .sw-row small { color:var(--muted); font-size:12px; } .sw-row:hover { background:color-mix(in srgb, var(--accent) 16%, transparent); }
  .fl-cards { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; width:100%; max-width:640px; margin:14px auto 0; }
  .fl-card { display:flex; flex-direction:column; gap:4px; text-align:left; font:inherit; padding:14px 16px; border-radius:var(--radius-m, 12px); border:1px solid var(--border); background:var(--surface); color:var(--foreground); cursor:pointer; }
  .fl-card small { color:var(--muted); font-size:12px; }
  .fl-card:hover { border-color:var(--accent); }
  .fl-card.main { grid-column:1 / -1; background:var(--accent); border-color:var(--accent); color:#fff; }
  .fl-card.main b { font-size:15px; } .fl-card.main small { color:rgba(255,255,255,.85); }
  .pj2-drawer { grid-column:1 / -1; position:relative; border:1px solid var(--accent); border-radius:14px; background:color-mix(in srgb, var(--accent) 6%, var(--surface)); padding:12px; margin:2px 0 6px; animation:pjdr .16s ease-out; }
  @keyframes pjdr { from { opacity:0; transform:translateY(-6px); } }
  .pj2-arrow { position:absolute; top:-10px; width:18px; height:18px; border-left:1px solid var(--accent); border-top:1px solid var(--accent); transform:rotate(45deg); background:color-mix(in srgb, var(--accent) 6%, var(--surface)); }
  .pj2-dhead { display:flex; align-items:center; gap:12px; margin:0 0 10px; flex-wrap:wrap; }
  .pj2-dhead .mv-txt { flex:1; min-width:180px; }
  .pj2-dacts { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .pj2-cont { display:flex; align-items:center; gap:12px; padding:10px 12px; min-height:72px; box-sizing:border-box; border-radius:var(--radius-l); border:1px solid color-mix(in srgb, var(--accent) 40%, var(--border)); background:linear-gradient(110deg, color-mix(in srgb, var(--accent) 16%, var(--surface)), var(--surface) 70%); margin:0 0 18px; }
  .pj2-cont img { width:48px; height:48px; border-radius:8px; image-rendering:pixelated; }
  .pj2-cont .mv-txt { flex:1; min-width:0; }
  .pj2-cont small { font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
  .pj2-cont .mv-name { font-size:15px; }
  .pj2-go { display:inline-flex; align-items:center; gap:8px; padding:10px 18px; }
  .mv-tag.pj-link { max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); border:1px solid color-mix(in srgb, var(--c) 45%, transparent); background:color-mix(in srgb, var(--c) 12%, transparent); }
  .mv-tag.pj-link b { color:var(--c); font-weight:700; }
  .mv-tag.pj-link.none { border-style:dashed; border-color:var(--border); background:none; }
  .pj2-orph { margin:12px 2px 0; font-size:12.5px; color:var(--muted); }
  .mv-sw { padding:4px 6px; gap:7px; font-size:11.5px; white-space:nowrap; }
  .mv-sw .lbl { color:var(--muted); }
  .mv-sw.off .lbl { color:var(--warn); font-weight:600; }
  .mv-sw:hover { background:color-mix(in srgb, var(--foreground) 8%, transparent); }
  .mv-sw:focus-visible { outline:2px solid var(--accent); }
  @media (max-width: 1100px) { .mv-sw .lbl { display:none; } }
  `;
  document.head.appendChild(PJ_CSS);


  // Premier lancement (28/10, Rushi : « quand les gens démarrent, ça crée un pack vanilla de la
  // dernière version », variante A de la preview, Laboratoire « firstInstall ») : le launcher crée
  // tout seul « Minecraft <dernière> » (rien n'est téléchargé avant « Jouer »). Une seule fois par
  // PC : si le joueur retire ensuite toutes ses installations, ou sans Internet, la carte
  // « Commence ici » (la dernière version en un clic, un pack existant, mes mondes).
  const FL_KEY = "omniscient.firstInstall.v1";
  const FL = { newId: null, busy: false,
    done: () => { try { return localStorage.getItem(FL_KEY) === "1"; } catch { return true; } },
    mark: () => { try { localStorage.setItem(FL_KEY, "1"); } catch {} } };
  const FLT = () => (L() === "fr" ? {
    prep: "On prépare ta première installation…", prepD: "Minecraft {v}, la dernière version. Rien n'est téléchargé tant que tu ne cliques pas sur « Jouer ».",
    made: "Ta première installation est prête : Minecraft {v}. Clique « Jouer » pour la télécharger et lancer le jeu.", badge: "Nouveau",
    startT: "Commence ici", startD: "Choisis comment jouer. Tu pourras en ajouter d'autres quand tu veux.",
    latest: "▶ Jouer à Minecraft {v}", latestD: "La dernière version, sans mods. Un clic suffit.", pack: "Installer un pack existant", packD: "Modrinth, CurseForge, FTB.",
    other: "Une autre version ou mon propre pack", import: "J'ai déjà des mondes", importD: "Minecraft, un autre launcher…",
    offline: "Pas d'Internet : impossible de connaître la dernière version. Clique « + Nouvelle installation » quand tu es connecté.",
  } : {
    prep: "Getting your first installation ready…", prepD: "Minecraft {v}, the latest version. Nothing is downloaded until you click “Play”.",
    made: "Your first installation is ready: Minecraft {v}. Click “Play” to download it and start the game.", badge: "New",
    startT: "Start here", startD: "Pick how you want to play. You can add more whenever you like.",
    latest: "▶ Play Minecraft {v}", latestD: "The latest version, no mods. One click.", pack: "Install an existing pack", packD: "Modrinth, CurseForge, FTB.",
    other: "Another version or my own pack", import: "I already have worlds", importD: "Minecraft, another launcher…",
    offline: "No Internet: we can't tell which version is the latest. Click “+ New installation” once you're online.",
  });
  const flFmt = (t, v) => t.replace("{v}", v || "");
  async function flLatest() {
    if (!data.mcVersions) { const r = await api.mcVersions().catch(() => null); if (r?.versions?.length) data.mcVersions = r.versions; }
    return (data.mcVersions || []).find((x) => x.type === "release")?.id || null;
  }
  async function flCreate(mc) {
    const out = await api.createVersion({ minecraftVersion: mc, packId: null, name: "" });
    if (!out?.ok) return showModal({ title: L() === "fr" ? "Création impossible" : "Could not create", body: out?.error || "", confirmLabel: "OK", tone: "warn" });
    FL.mark(); FL.newId = out.version?.id || null;
    await refresh();
    toast(flFmt(FLT().made, mc));
  }
  // A : création automatique, une fois par PC.
  async function flAuto() {
    if (FL.busy) return;
    FL.busy = true;
    const mc = await flLatest();
    if (!mc) { FL.busy = false; FL.offline = true; return render(); }
    panel.querySelector("[data-fl-v]")?.replaceChildren(document.createTextNode(flFmt(FLT().prepD, mc)));
    await flCreate(mc);
    FL.busy = false;
  }
  function flEmpty() {
    const t = FLT();
    const latest = (data.mcVersions || []).find((x) => x.type === "release")?.id;
    if (!FL.done() && !FL.offline) {
      if (data.loaded) setTimeout(flAuto, 0);
      return `<div class="play-welcome" aria-busy="true"><span class="empty-state-icon">${CUBE}</span><h3>${esc(t.prep)}</h3><p data-fl-v>${esc(flFmt(t.prepD, latest || "…"))}</p><span class="spinner" style="margin:10px auto 0;"></span></div>`;
    }
    // Déjà fait une fois, ou sans Internet : « Commence ici ».
    if (!latest) flLatest().then((v) => v && !panel.hidden && render());
    const card = (attr, title, sub, main) => `<button type="button" class="fl-card${main ? " main" : ""}" ${attr}><b>${esc(title)}</b><small>${esc(sub)}</small></button>`;
    return `<div class="play-welcome fl-start"><span class="empty-state-icon">${CUBE}</span><h3>${esc(t.startT)}</h3><p>${esc(FL.offline ? t.offline : t.startD)}</p>
      <div class="fl-cards">${latest ? card("data-fl-latest", flFmt(t.latest, latest), t.latestD, true) : ""}${card("data-fl-pack", t.pack, t.packD)}${card("data-fl-import", t.import, t.importD)}</div>
      <button type="button" class="link-btn" data-new-version style="margin-top:12px;font-size:13px;">${esc(t.other)}</button></div>`;
  }
  function render() {
    // Page d'un pack encore en lecture (squelette affiché) : rien à redessiner.
    if (packPage) return packPage.p ? drawPackPage() : undefined;
    mvCloseMenu();
    const fr = L() === "fr";
    const localKeys = new Set(data.worlds.map((w) => w.key));
    const cloudOnly = (data.cloud?.offer?.cloud ? data.cloud.worlds || [] : []).filter((cw) => !localKeys.has(cw.worldKey));
    // 28/10 (Rushi) : un joueur qui a déjà eu des installations puis les retire toutes ne doit pas
    // voir « Minecraft <dernière> » se recréer tout seul : la création automatique est seulement
    // pour un tout premier lancement, sinon la page « Commence ici ».
    if (data.loaded && (data.versions.length || data.worlds.length)) FL.mark();
    if (!data.versions.length && !data.worlds.length && !cloudOnly.length) {
      if (on("playTiles") && on("firstInstall")) {
        panel.innerHTML = `${header()}${flEmpty()}`;
        return;
      }
      panel.innerHTML = `${header()}
        <div class="play-welcome">
          <span class="empty-state-icon">${CUBE}</span>
          <h3>${esc(T("welcomeT"))}</h3><p>${esc(T("welcomeD"))}</p>
          <ol class="play-steps">
            <li><b>1</b><strong>${esc(T("step1T"))}</strong>${esc(T("step1D"))}</li>
            <li><b>2</b><strong>${esc(T("step2T"))}</strong>${esc(T("step2D"))}</li>
            <li><b>3</b><strong>${esc(T("step3T"))}</strong>${esc(T("step3D"))}</li>
          </ol>
          <div class="acts"><button type="button" class="join-btn" data-new-version>+ ${esc(T("newV"))}</button><button type="button" class="btn-secondary" data-import style="margin:0;">${esc(T(packImportOn() ? "importAll" : "import"))}</button></div>
        </div>`;
      return;
    }
    pjCloseMenu();
    if (on("playTiles")) {
      pjPatch(panel, `${header()}${cloudBannerHtml()}${remoteBannerHtml(cloudOnly)}${pjRender(cloudOnly)}`);
      pjPlaceDrawer();
      pjSyncPick();
      if (PJ.flip) {
        pjFlip(PJ.flip);
        PJ.flip = null;
      }
      return;
    }
    const versions = data.versions.length
      ? `<div class="instance-grid">${data.versions.map(versionRow).join("")}</div>`
      : `<div class="play-col-empty"><p>${esc(T("noVersions"))}</p></div>`;
    const worlds = data.worlds.length || cloudOnly.length || data.gone.length
      ? `${mvTools()}<div class="mv-body">${mvBody(cloudOnly)}</div>`
      : `<div class="play-col-empty"><span class="empty-state-icon">${CUBE}</span><p>${esc(T("noWorlds"))}</p><button type="button" class="btn-secondary" data-import style="margin:4px 0 0;">${esc(T(packImportOn() ? "importAll" : "import"))}</button></div>`;
    const sup = data.cloud?.offer?.cloud;
    const missing = sup && data.worlds.some((w) => w.backup && !data.cloud.worlds?.some((x) => x.worldKey === w.key));
    const syncBtn = sup && data.worlds.length
      ? `<button type="button" class="btn-secondary" data-sync ${data.job && !data.job.done ? "disabled" : ""} style="margin:0;padding:5px 12px;font-size:12.5px;">☁ ${esc(T("sync"))}${missing ? ' <span style="color:var(--warn);">•</span>' : ""}</button>`
      : "";
    panel.innerHTML = `${header()}
      ${cloudBannerHtml()}
      ${remoteBannerHtml(cloudOnly)}
      <div class="play-cols${data.worlds.length >= 8 ? " mv-wide" : ""}">
        <div><div class="home-section" style="margin:0;">
          <div class="home-section-header"><h3>${esc(T("mine"))}</h3><button type="button" class="join-btn" data-new-version style="margin-left:auto;">+ ${esc(T("newV"))}</button></div>
          ${versions}
        </div></div>
        <div><div class="home-section" style="margin:0;">
          <div class="home-section-header"><h3>${esc(T("mvAll"))}${data.worlds.length ? ` <span style="font-weight:500;color:var(--muted);font-size:.85em;">(${data.worlds.length})</span>` : ""}</h3><span style="margin-left:auto;display:flex;gap:12px;align-items:center;">${data.worlds.length ? `<button type="button" class="link-btn" data-bk-settings title="${fr ? "Réglages des sauvegardes" : "Backup settings"}" style="font-size:12.5px;">⚙ ${fr ? "Réglages" : "Settings"}</button>` : ""}${syncBtn}${pbOn() ? "" : `<button type="button" class="link-btn" data-import style="font-size:12.5px;">${esc(T(packImportOn() ? "importAll" : "import"))}</button>`}</span></div>
          ${worlds}
        </div></div>
      </div>`;
    void fr;
  }

  panel.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    const card = e.target.closest("[data-pack-card]");
    if (card && !b) return pageOn(data.versions.find((x) => x.id === card.dataset.packCard)) ? openPackPage(card.dataset.packCard) : undefined;
    // Clic sur la ligne d'un monde, hors de ses boutons : sa liste de sauvegardes (30/10, demande de Rushi).
    const wrow = !b && !PJ.wpick && e.target.closest(".mv-row[data-world]");
    if (wrow) return openBackupsList(wrow.dataset.world);
    if (!b) return;
    if (b.hasAttribute("data-new-version")) return pbOn() ? pbChooser() : openNewVersion();
    if (b.hasAttribute("data-fl-latest")) { b.disabled = true; const mc = await flLatest(); return mc ? flCreate(mc) : render(); }
    if (b.hasAttribute("data-fl-pack")) return pbOn() ? (on("addMenus") ? openAddWin({ mode: "browse" }) : pbBrowser()) : openNewVersion();
    if (b.hasAttribute("data-fl-import")) return packImportOn() ? openPackChooser({}, { worlds: true }) : openImport();
    if (b.hasAttribute("data-pb-more")) return b.getAttribute("aria-expanded") === "true" ? pbCloseMenu() : pbOpenMenu(b);
    if (b.hasAttribute("data-import")) return packImportOn() ? openPackChooser({}, { worlds: true }) : openImport();
    if (b.hasAttribute("data-sync")) return openCloudSync({ resync: true });
    if (b.dataset.playVersion) return launch({ versionId: b.dataset.playVersion }, b);
    if (b.dataset.playWorld) return launch({ worldKey: b.dataset.playWorld }, b);
    if (b.dataset.goneBk) return openBackupsList(b.dataset.goneBk);
    if (b.dataset.delVersion) return removeVersion(b.dataset.delVersion);
    if (b.dataset.upVersion) return openUpdateVersion(b.dataset.upVersion);
    if (b.dataset.switch) return toggleBackup(b.dataset.switch);
    if (b.dataset.mvMenu) return b.getAttribute("aria-expanded") === "true" ? mvCloseMenu() : mvOpenMenu(b, b.dataset.mvMenu);
    if (b.dataset.mvToggle) {
      mv.open[b.dataset.mvToggle] = b.getAttribute("aria-expanded") !== "true";
      mvSave();
      return mvRedrawBody();
    }
    if (b.dataset.mvFilter) {
      mv.filter = b.dataset.mvFilter;
      mv.showAll = false;
      panel.querySelectorAll("[data-mv-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      return mvRedrawBody();
    }
    if (b.hasAttribute("data-mv-more")) {
      mv.showAll = true;
      return mvRedrawBody();
    }
    if (b.dataset.history) return openBackupsList(b.dataset.history);
    if (b.hasAttribute("data-bk-settings")) return openHistory(null);
    if (b.dataset.cloudDownload) return downloadFromCloud([b.dataset.cloudDownload]);
    if (b.hasAttribute("data-cloud-download-all")) {
      const localKeys = new Set(data.worlds.map((w) => w.key));
      return downloadFromCloud((data.cloud?.worlds || []).filter((cw) => !localKeys.has(cw.worldKey)).map((cw) => cw.id));
    }
    if (b.dataset.split) return openSplit(b.dataset.split);
    if (b.dataset.cloudBanner) return openCloudSync({ resync: false });
  });

  // --- Lancer ------------------------------------------------------------------------------
  // Même affichage que le lancement d'un serveur (renderer.js, launchOfflineInstance) : la pilule
  // passe tout de suite à « Lancement… » avec les étapes (Java, fichiers, mods, démarrage) et le
  // panneau s'ouvre, pour ne jamais laisser le joueur devant un écran sans rien (retour de test du
  // 24/10 : 1 min 30 sans signe de vie au premier lancement, le temps des téléchargements).
  let lastLaunch = null; // { versionId, label } : nom lisible dans la pilule pendant la partie
  window.playRunningLabel = (slug) => {
    const id = String(slug || "").replace(/^play:/, "");
    if (lastLaunch?.versionId === id) return lastLaunch.label;
    const v = data.versions.find((x) => x.id === id);
    return v ? versionLabel(v) : "Minecraft";
  };
  function versionLabel(v) {
    return v.name || `Minecraft ${v.minecraftVersion}${v.pack ? ` · ${packName(v.pack)}` : ""}`;
  }

  async function launch(opts, btn) {
    if (!signedIn) {
      const ok = await attemptSignIn(true);
      if (!ok) return;
    }
    if (launchInProgress) return;
    const mw = opts.worldKey && !opts.modOk ? data.worlds.find((x) => x.key === opts.worldKey) : null;
    if (mw?.modded && !mw.modCopyOf && !mw.lastVersionLabel?.pack) {
      const copyKey = await askModdedWorld(mw);
      if (!copyKey) return;
      return launch({ ...opts, worldKey: copyKey, modOk: true }, null);
    }
    // Plusieurs PC : monde du cloud ouvert ou joué sur un autre appareil ? (un appel au site, et
    // seulement pour un monde déjà dans le cloud)
    if (opts.worldKey) {
      if (btn) btn.disabled = true;
      const go = await checkDevices(opts.worldKey).catch(() => true);
      if (btn) btn.disabled = false;
      if (!go) return;
    }
    // RAM par pack (Laboratoire « packRam ») : trop basse pour le pack, ou plus que la RAM libre ?
    if (on("packRam") && !opts.ramChecked) {
      const rw = opts.worldKey ? data.worlds.find((x) => x.key === opts.worldKey) : null;
      const rid = opts.versionId || rw?.lastVersionId || null;
      if (rid && data.versions.some((x) => x.id === rid)) {
        const g = await rmBeforeLaunch(rid);
        if (!g) return;
        opts = { ...opts, ramChecked: true, ...(g.ramGB ? { ramGB: g.ramGB } : {}) };
      }
    }
    const v = opts.versionId ? data.versions.find((x) => x.id === opts.versionId) : null;
    const w = opts.worldKey ? data.worlds.find((x) => x.key === opts.worldKey) : null;
    const wv = (opts.versionId && data.versions.find((x) => x.id === opts.versionId)) || (w?.lastVersionId ? data.versions.find((x) => x.id === w.lastVersionId) : null);
    const label = w ? `${w.name} · ${wv ? versionLabel(wv) : `Minecraft ${w.minecraftVersion || ""}`.trim()}` : v ? versionLabel(v) : "Minecraft";
    const oldHtml = btn?.innerHTML;
    // Petit bouton rond (▶ d'une tuile ou d'un monde, 28/10 Rushi : « Préparation… » débordait) :
    // seulement un rond qui tourne, le texte va dans l'infobulle.
    const round = !!btn && btn.offsetWidth > 0 && btn.offsetWidth < 70;
    const busyText = (t) => {
      if (!btn) return;
      if (round) {
        btn.title = t;
        btn.setAttribute("aria-label", t);
        if (!btn.querySelector(".pj-btn-spin")) btn.innerHTML = `<span class="pj-btn-spin" aria-hidden="true"></span>`;
      } else btn.textContent = t;
    };
    const oldTitle = btn?.getAttribute("title");
    const oldAria = btn?.getAttribute("aria-label");
    if (btn) {
      btn.disabled = true;
      busyText(L() === "fr" ? "Préparation…" : "Preparing…");
    }
    launchInProgress = true;
    activity.current = { slug: opts.versionId ? `play:${opts.versionId}` : "play:pending", name: label };
    activity.failure = null;
    activity.launch = { percent: null, text: L() === "fr" ? "Préparation de Minecraft…" : "Preparing Minecraft…" };
    renderActivity();
    openActivityPanel();
    const stopListening = window.mchub.onGameProgress((status) => {
      if (!status || typeof status !== "object") return;
      const next = { ...(activity.launch || {}) };
      if (status.text) next.text = status.text;
      if (status.guard && btn) busyText(status.guard);
      if (typeof status.task === "number" && typeof status.total === "number" && status.total > 0) {
        next.percent = Math.min(100, Math.round((status.task / status.total) * 100));
      }
      activity.launch = next;
      renderActivity();
    });
    let r;
    try {
      r = await api.launch(opts);
    } catch (error) {
      r = { ok: false, error: error?.message || String(error) };
    } finally {
      stopListening();
      launchInProgress = false;
      activity.launch = null;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
        if (round) {
          if (oldTitle == null) btn.removeAttribute("title");
          else btn.setAttribute("title", oldTitle);
          if (oldAria == null) btn.removeAttribute("aria-label");
          else btn.setAttribute("aria-label", oldAria);
        }
      }
    }
    if (r?.ok) {
      lastLaunch = { versionId: r.versionId, label };
      activity.current = { slug: `play:${r.versionId}`, name: label };
      data.running = { versionId: r.versionId, worldKey: opts.worldKey || null };
      // Mêmes réglages que pour un serveur : console (Débogage), et launcher réduit pendant la partie
      // (Divers > Pendant la partie) ; il revient à la fin du jeu, sauf en mode discret (main.js).
      window.mchub.settings.get().then((st) => {
        if (st?.openConsoleOnLaunch) window.mchub.logs.openConsole();
        if (st && st.minimizeWhilePlaying !== false) window.mchub.windowControls.minimize();
      }).catch(() => {});
      // Le jeu met encore quelques secondes à ouvrir sa fenêtre : « Minecraft va s'ouvrir… ».
      if (!gamePlaying) {
        launchStarting = true;
        setTimeout(() => {
          launchStarting = false;
          renderActivity();
        }, 60_000);
      }
      renderActivity();
      await refresh();
      return;
    }
    renderActivity();
    if (r?.cancelled) return;
    // Version du monde absente de Mes versions (ou illisible) : rien n'a été lancé, on demande.
    if (r?.code === "needVersion") return askCreateVersion(opts.worldKey, r, btn);
    if (r?.code === "chooseVersion") return askChooseVersion(opts.worldKey, r, btn);
    if (r?.code === "packProblems") {
      const pv = data.versions.find((x) => x.id === r.versionId);
      const choice = await new Promise((resolve) => {
        const pm = overlay(`<div class="modal-box pop-in tone-warn" role="dialog" aria-modal="true" aria-labelledby="pp-t" style="max-width:480px;text-align:left;">
          <h3 id="pp-t">⚠ ${esc(T("pkProbT", { n: r.count }))}</h3><p style="font-size:13.5px;line-height:1.5;margin:8px 0;">${esc(T("pkProbD", { n: pv ? versionLabel(pv) : "" }))}</p>
          <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px;">
            <button type="button" class="link-btn" id="pp-force" style="margin-right:auto;">${esc(T("pkForce"))}</button>
            <button type="button" class="btn-secondary" id="pp-no" style="margin:0;">${esc(T("cancel"))}</button>
            <button type="button" class="join-btn" id="pp-open">${esc(T("pkProbOpen"))}</button></div></div>`);
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          obs.disconnect();
          pm.close();
          resolve(v);
        };
        const obs = new MutationObserver(() => !document.body.contains(pm.ov) && finish(null));
        obs.observe(document.body, { childList: true });
        pm.$("#pp-force").addEventListener("click", () => finish("force"));
        pm.$("#pp-no").addEventListener("click", () => finish(null));
        pm.$("#pp-open").addEventListener("click", () => finish("open"));
        pm.$("#pp-open").focus();
      });
      if (choice === "open") {
        showPlay();
        return openPackPage(r.versionId);
      }
      if (choice === "force") return launch({ ...opts, versionId: r.versionId, force: true, modOk: true }, btn);
      return;
    }
    if (r?.code === "signin") {
      await attemptSignIn(true);
      return;
    }
    activity.failure = { slug: activity.current.slug, name: label, error: r?.error || "" };
    renderActivity();
    await showModal({ title: L() === "fr" ? "Lancement impossible" : "Could not start", body: r?.error || "", confirmLabel: "OK", tone: "warn" });
  }

  // Monde modé (détecté à l'import) : le mode Jouer ne charge pas ses mods. On prévient ; s'il
  // insiste, on copie le monde et on lance la COPIE (le monde et sa Version d'origine restent
  // intacts). Renvoie la clé de la copie, ou null.
  function askModdedWorld(w) {
    const copyName = `${w.name} (${L() === "fr" ? "copie" : "copy"})`;
    return new Promise((resolve) => {
      const m = overlay(`<div class="modal-box pop-in tone-warn" role="dialog" aria-modal="true" aria-labelledby="mw-t" style="max-width:500px;text-align:left;">
        <h3 id="mw-t">⚠ ${esc(T("modWarnT", { w: w.name }))}</h3>
        <p style="font-size:13.5px;line-height:1.5;margin:8px 0;">${esc(T("modWarnD", { l: modLabel(w.modded) }))}</p>
        ${on("cfImport") || on("mrImport") ? `<div class="cf-box"><span>${esc(T("modWarnCfD"))}</span><button type="button" class="join-btn" id="mw-cf">${esc(T("modWarnCf"))}</button></div>` : ""}
        <p class="play-safe">✓ ${esc(T("modWarnSafe", { c: copyName }))}</p>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px;">
          ${on("myPack") ? `<button type="button" class="link-btn" id="mw-pack" style="margin-right:auto;">${esc(T("modWarnPack"))}</button>` : `<span style="margin-right:auto;"></span>`}
          <button type="button" class="btn-secondary" id="mw-copy" style="margin:0;">${esc(T("modWarnOk"))}</button>
          <button type="button" class="join-btn" id="mw-no">${esc(T("modWarnNo"))}</button>
        </div></div>`);
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        obs.disconnect();
        m.close();
        resolve(v);
      };
      const obs = new MutationObserver(() => !document.body.contains(m.ov) && finish(null));
      obs.observe(document.body, { childList: true });
      m.$("#mw-no").addEventListener("click", () => finish(null));
      m.$("#mw-cf")?.addEventListener("click", () => {
        finish(null);
        openPackChooser({ worldKey: w.key });
      });
      m.$("#mw-pack")?.addEventListener("click", () => {
        finish(null);
        openMyPack({ minecraftVersion: w.minecraftVersion, loader: w.modded?.loader, world: w });
      });
      m.$("#mw-copy").addEventListener("click", async (e) => {
        e.target.disabled = true;
        e.target.textContent = T("modCopying");
        m.ov.dataset.locked = "1";
        const out = await api.copyWorld(w.key, { name: copyName, reason: "modded" });
        if (!out?.ok) {
          finish(null);
          return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
        }
        toast(T("modCopyDone", { c: out.name || copyName }));
        await refresh();
        finish(out.key);
      });
      m.$("#mw-no").focus();
    });
  }

  // Aide au crash v1 (26/10, Laboratoire « crashHelp ») : à la fermeture du jeu, le launcher a lu
  // logs/latest.log et le rapport de crash de la partie. On dit le problème en clair ; « Corriger le
  // pack » ouvre la page du pack (qui relit les .jar) ; « Copier les logs » pour demander de l'aide.
  function openCrashHelp(info) {
    if (!info || document.querySelector(".play-modal [data-crash-help]")) return;
    const v = data.versions.find((x) => x.id === info.versionId);
    const editable = ["mine", "cf", "mr"].includes(info.packKind);
    let body = "";
    if (info.kind === "deps") {
      body = `<p style="margin:8px 0 4px;">${esc(T("chDeps"))}</p><ul style="margin:0 0 8px 18px;padding:0;font-size:13.5px;line-height:1.5;">${info.deps.map((d) => `<li>${esc(T("chDep", { a: d.mod || d.modId || "?", b: d.needs, min: d.min ? T("chMin", { v: d.min }) : "", have: d.have ? T("chHave", { v: d.have }) : T("chMissing") }))}</li>`).join("")}</ul>`;
    } else if (info.kind === "java") body = `<p style="margin:8px 0;">${esc(T("chJava"))}</p>${info.description ? `<p class="pk-note">${esc(info.description)}</p>` : ""}`;
    else if (info.kind === "memory") body = `<p style="margin:8px 0;">${esc(T("chMem"))}</p>${on("packRam") && v ? `<button type="button" class="btn-secondary" id="ch-ram" style="margin:2px 0 6px;">🧠 ${esc(rmTr("Régler la RAM de ce pack", "Set this pack's RAM"))}</button>` : ""}`;
    else body = `<p style="margin:8px 0;">${esc(T("chCrash"))}</p>${info.description ? `<p class="pk-note">${esc(T("chWhy", { d: info.description }))}</p>` : ""}${(info.lines || []).map((l) => `<p class="pk-note">${esc(T("chSuspect", { m: l }))}</p>`).join("")}`;
    // Aide Discord (02/11, Laboratoire « bugDiscord ») : le bloc à 3 boutons remplace « Copier les logs ».
    const help = on("bugDiscord") ? window.__bugHelp : null;
    const noFiles = help && !info.hasCrash && !info.hasLog ? `<p class="pk-note">${esc(help.empty())}</p>` : "";
    const m = overlay(`<div class="modal-box pop-in tone-warn" role="dialog" aria-modal="true" aria-labelledby="ch-t" data-crash-help style="max-width:520px;text-align:left;">
      <h3 id="ch-t">⚠ ${esc(T("chT"))}</h3>${v ? `<p class="join-note" style="margin:0;">${esc(versionLabel(v))}</p>` : ""}
      ${help
        ? `<div class="bh-scroll"><div>${body}${noFiles}</div>${info.packKind === "official" ? `<p class="play-safe">${esc(T("chOfficial"))}</p>` : ""}${help.html()}<p class="play-safe">${esc(help.safe())}</p></div>`
        : `${body}<p class="play-safe">${esc(info.packKind === "official" ? T("chOfficial") : T("chHelp"))}</p>`}
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;">
        ${info.hasCrash ? `<button type="button" class="link-btn" id="ch-folder" style="margin-right:auto;">${esc(T("chFolder"))}</button>` : `<span style="margin-right:auto;"></span>`}
        ${help ? "" : `<button type="button" class="btn-secondary" id="ch-copy" style="margin:0;">${esc(T("chCopy"))}</button>`}
        ${editable && v ? `<button type="button" class="join-btn" id="ch-fix">${esc(T("chFix"))}</button>` : `<button type="button" class="join-btn" id="ch-close">${esc(T("close"))}</button>`}
      </div></div>`);
    m.$("#ch-close")?.addEventListener("click", m.close);
    m.$("#ch-ram")?.addEventListener("click", () => {
      m.close();
      rmOpenDialog(info.versionId);
    });
    m.$("#ch-folder")?.addEventListener("click", () => api.openCrashFolder());
    m.$("#ch-fix")?.addEventListener("click", () => {
      m.close();
      showPlay();
      openPackPage(info.versionId);
    });
    if (help) help.bind(m.ov, toast);
    m.$("#ch-copy")?.addEventListener("click", async (e) => {
      const r = await api.crashLogs();
      if (!r?.ok) return;
      try {
        await navigator.clipboard.writeText(r.text);
        toast(T("chCopied"));
        e.target.textContent = "✓ " + T("chCopy");
      } catch {
        /* presse-papiers refusé : rien à faire */
      }
    });
  }

  // « Mon pack » : choisir version + chargeur, chercher ses mods sur Modrinth ; ce qui n'y est pas
  // va dans la liste CurseForge, à télécharger à la main (le launcher ne télécharge rien de
  // CurseForge : il trouve le fichier dans Téléchargements, le vérifie et le range).
  const LOADER_IDS = ["neoforge", "forge", "fabric", "quilt"];
  const icColor = (s) => `hsl(${[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 45% 42%)`;
  async function openMyPack(pre = {}) {
    if (on("addMenus") && !pre.addTo && !pre.world && !pre.classic) return openCreateChooser(pre);
    const world = pre.world || null;
    const st = {
      name: pre.name || (world ? `${world.name} · pack` : ""),
      mc: pre.minecraftVersion || "1.21.1",
      loader: LOADER_IDS.includes(pre.loader) ? pre.loader : "fabric",
      tab: "mr", q: "", qcf: "",
      pick: new Map(), // slug -> version choisie avant l'ajout
      found: new Map(), // slug -> résultat de recherche (versions et dépendances)
      mods: new Map(), // slug -> { name, source: "mr" | "cf", status }
    };
    const addTo = pre.addTo || null; // page d'un pack : « + Ajouter des mods »
    const cfOn = on("myPackCf") && !pre.omni;
    const scan = world ? await api.myPack.scanWorld(world.key) : null;
    if (scan?.cf && cfOn) for (const c of scan.cf) st.mods.set(c.slug, { name: c.name, source: "cf", status: "wait", search: c.search });
    const m = overlay(`<div class="modal-box pop-in mp-box" role="dialog" aria-modal="true" aria-labelledby="mp-t"><div id="mp-root"></div></div>`);
    const root = m.$("#mp-root");
    if (!data.mcVersions) {
      const vr = await api.mcVersions();
      if (vr?.ok) data.mcVersions = vr.versions;
    }
    // Liste de Mojang (à jour toute seule), gardée seulement là où le chargeur existe et où le
    // launcher sait le lancer : Forge à partir de 1.7.10 (avant 1.13 : ancien format, voir
    // installLegacyForge dans modpack.js, 28/10), NeoForge à partir de 1.20.2 (sa 1.20.1 est un Forge
    // renommé), Fabric et Quilt à partir de 1.14.
    const MIN_MC = { forge: "1.7.10", neoforge: "1.20.2", fabric: "1.14", quilt: "1.14" };
    const mcCmp = (a, b) => a.localeCompare(b, "en", { numeric: true });
    const versFor = (loader) => (data.mcVersions || []).filter((v) => v.type === "release" && mcCmp(v.id, MIN_MC[loader] || "1.14") >= 0).map((v) => v.id);
    // Version déjà choisie (ex. 1.12.2, trop vieille pour Fabric) : on change de chargeur, pas de version.
    if (!versFor(st.loader).includes(st.mc)) st.loader = LOADER_IDS.find((l) => versFor(l).includes(st.mc)) || st.loader;
    if (!versFor(st.loader).includes(st.mc)) st.mc = versFor(st.loader)[0] || st.mc;
    const draw = async (skel = false) => {
      const lName = LOADERS[st.loader];
      if (!cfOn) st.tab = "mr";
      const res = skel ? null : st.tab === "mr" ? await api.myPack.searchModrinth(st.q, { mc: st.mc, loader: st.loader }) : await api.myPack.searchCurseForge(st.qcf, { mc: st.mc, loader: st.loader });
      if (st.tab === "cf") for (const x of res?.mods || []) st.found.set(x.slug, x);
      const list = res?.mods || [];
      const cfCount = [...st.mods.values()].filter((x) => x.source === "cf").length;
      const mrFound = scan?.mr?.length || 0;
      const mrAdded = scan ? scan.mr.filter((x) => st.mods.has(x.slug)).length : 0;
      const missing = [...st.mods.values()].filter((x) => x.source === "cf" && x.status !== "ok").length;
      root.innerHTML = `
        <h3 id="mp-t">${esc(addTo ? T("mpAddT", { n: pre.name || "" }) : T("mpT"))}${pre.omni ? ` <span class="play-beta-tag" style="margin-left:6px;vertical-align:middle;">${esc(T("omT"))}</span>` : ""}</h3><p style="margin:2px 0 12px;font-size:13px;color:var(--muted);">${esc(T(pre.omni && !addTo ? "omMpD" : "mpD"))}</p>
        <div class="mp-top" ${addTo ? "hidden" : ""}>
          <div><div class="field-label">${esc(T("nameL"))}</div><input type="text" class="play-in" id="mp-name" maxlength="60" value="${esc(st.name)}" placeholder="${esc(T("nameP"))}" style="width:100%;"></div>
          <div><div class="field-label">${esc(T("verL"))}</div><select class="play-in" id="mp-mc" style="width:100%;">${versFor(st.loader).map((v) => `<option ${v === st.mc ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
          <div class="mp-loaders" role="group" aria-label="${esc(T("mpLoader"))}"><span>${esc(T("mpLoader"))}</span>${LOADER_IDS.map((l) => `<button type="button" class="mp-chip" data-loader="${l}" aria-pressed="${l === st.loader}">${esc(LOADERS[l])}</button>`).join("")}</div>
        </div>
        ${world ? `<div class="mp-world"><b>${esc(T("mpFor", { w: world.name }))} · ${esc(modLabel(world.modded))}</b>
          ${scan?.total ? `<div class="mp-wrow"><span>✓ ${esc(T("mpFound", { n: mrFound }))}</span>${mrAdded < mrFound ? `<button type="button" class="link-btn" id="mp-all" style="margin:0;font-size:12.5px;">${esc(T("mpAddAll", { n: mrFound }))}</button>` : ""}</div>
          <div class="miss">⚠ ${esc(T("mpMissing", { n: scan.cf.length }))}</div>` : `<div>${esc(T("mpFabricWorld"))}</div>`}</div>` : ""}
        <div class="mp-tabs" role="tablist">
          <button type="button" class="mp-tab" role="tab" data-tab="mr" aria-selected="${st.tab === "mr"}">${esc(T("mpTabMr"))}</button>
          ${cfOn ? `<button type="button" class="mp-tab" role="tab" data-tab="cf" aria-selected="${st.tab === "cf"}">${esc(T("mpTabCf"))}${cfCount ? ` <span class="n">(${cfCount})</span>` : ""}</button>` : ""}
        </div>
        ${st.tab === "mr"
          ? `<input type="search" class="play-in" id="mp-q" value="${esc(st.q)}" placeholder="${esc(T("mpSearch"))}" autocomplete="off" style="width:100%;">
             <div class="mp-res">${skel ? skRows("mp-r", 28) : list.length ? list.map((x) => {
               st.found.set(x.slug, x);
               const ok = x.compatible;
               const added = st.mods.has(x.slug);
               return `<div class="mp-r"><span class="mp-ic" style="background:${icColor(x.slug)}">${esc(x.name[0])}</span><span>${esc(x.name)}<small>${esc(x.author)} · ${esc(x.downloads)}</small></span>
                 ${ok ? `<span class="acts"><select class="play-in mp-v" data-mrv="${esc(x.slug)}" aria-label="${esc(T("mpVerL", { m: x.name }))}">${(x.versions || []).map((v, i) => `<option value="${esc(v.v)}" ${v.v === (st.mods.get(x.slug)?.version || st.pick.get(x.slug)) ? "selected" : ""}>${esc(v.v)}${i === 0 ? ` · ${esc(T("mpLatest"))}` : ""}</option>`).join("")}</select>
                   <button type="button" class="act ${added ? "on" : ""}" data-mr="${esc(x.slug)}" data-name="${esc(x.name)}">${esc(added ? T("mpAdded") : T("mpAdd"))}</button></span>` : `<button type="button" class="act" disabled>${esc(T("mpNotFor", { l: lName, v: st.mc }))}</button>`}</div>`;
             }).join("") : `<div class="mp-r" style="grid-template-columns:1fr;color:var(--muted);">${esc(T(cfOn ? "mpNone" : "mpNoneMr"))}</div>`}</div>`
          : `<p class="mp-cfinfo">${esc(T("mpCfInfo"))}</p>
             <input type="search" class="play-in" id="mp-qcf" value="${esc(st.qcf)}" placeholder="${esc(T("mpSearchCf"))}" autocomplete="off" style="width:100%;margin-top:8px;">
             <div class="mp-res">${skel ? skRows("mp-r", 28) : [
               ...[...st.mods.entries()].filter(([, x]) => x.source === "cf").map(([slug, x]) => `<div class="mp-r"><span class="mp-ic" style="background:${icColor(slug)}">${esc(x.name[0])}</span><span>${esc(x.name)}<small>CurseForge</small></span>
                 <span class="acts">${x.status === "ok" ? `<span class="st ok">${esc(T("mpCfOk"))}</span>` : `<span class="st">${esc(T("mpCfWait"))}</span><button type="button" class="act" data-cfopen="${esc(slug)}">${esc(T("mpCfOpen"))}</button>`}</span></div>`),
               ...list.filter((x) => !st.mods.has(x.slug)).map((x) => `<div class="mp-r"><span class="mp-ic" style="background:${icColor(x.slug)}">${esc(x.name[0])}</span><span>${esc(x.name)}<small>CurseForge · ${esc(x.author)}</small></span><button type="button" class="act" data-cfadd="${esc(x.slug)}" data-name="${esc(x.name)}">${esc(T("mpCfAdd"))}</button></div>`),
               // 29/10 : une erreur (site, clé, quota) ou aucun résultat laissait la liste vide, sans un mot.
               ...(list.length ? [] : [`<div class="mp-r" style="grid-template-columns:1fr;color:var(--muted);">${esc(res && res.ok === false ? T("mpCfErr", { e: res.error || res.code || "?" }) : T("mpCfNone"))}</div>`]),
             ].join("")}</div>`}
        <div class="mp-in"><h4>${esc(T("mpIn", { n: st.mods.size }))}</h4>
          ${st.mods.size ? `<div class="mp-pills">${[...st.mods.entries()].slice(0, 40).map(([slug, x]) => `<span class="mp-pill ${x.source === "cf" ? "cf" : ""} ${x.auto ? "auto" : ""}" ${x.auto ? `title="${esc(T("mpAuto", { m: [...x.by].map((s) => st.mods.get(s)?.name || s).join(", ") }))}"` : ""}>${x.source === "cf" ? (x.status === "ok" ? "✓ " : "⏳ ") : x.auto ? "⚙ " : ""}${esc(x.name)}${x.version ? ` <span class="v">${esc(x.version)}</span>` : ""}${x.auto ? "" : `<button type="button" data-rm="${esc(slug)}" aria-label="✕ ${esc(x.name)}">✕</button>`}</span>`).join("")}${st.mods.size > 40 ? `<span class="mp-pill">+${st.mods.size - 40}</span>` : ""}</div>` : `<p class="mp-note" style="margin:0;">${esc(T("mpInEmpty"))}</p>`}
          <p class="mp-note">${esc(T("mpDeps"))}</p>
          ${addTo || st.mods.has("crash-assistant") ? "" : `<p class="mp-note">💡 ${esc(T("mpCrashA"))} <button type="button" class="link-btn" id="mp-crasha" style="margin:0;font-size:12.5px;">${esc(T("mpCrashAdd"))}</button></p>`}
          ${world && missing ? `<p class="mp-warn">⚠ ${esc(T("mpWorldMissing", { n: missing }))}</p>` : ""}
        </div>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px;">
          <button type="button" class="btn-secondary" id="mp-cancel" style="margin:0;">${esc(T("cancel"))}</button>
          ${world || addTo ? "" : `<button type="button" class="btn-secondary" id="mp-create" style="margin:0;">${esc(T("mpCreate"))}</button>`}
          <button type="button" class="join-btn" id="mp-go" ${st.mods.size ? "" : "disabled"}>${esc(addTo ? T("mpAddGo") : world ? T("mpCreateWorld") : T("mpCreatePlay"))}</button>
        </div>`;
      const focusId = drawFocus;
      drawFocus = null;
      if (focusId) {
        const el = root.querySelector(focusId);
        el?.focus();
        if (el?.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
      }
    };
    let drawFocus = null;
    let typing = null;
    root.addEventListener("input", (e) => {
      if (e.target.id === "mp-name") return void (st.name = e.target.value);
      if (e.target.id !== "mp-q" && e.target.id !== "mp-qcf") return;
      st[e.target.id === "mp-q" ? "q" : "qcf"] = e.target.value;
      clearTimeout(typing);
      typing = setTimeout(() => ((drawFocus = `#${e.target.id}`), draw()), 250);
    });
    // Mods nécessaires : ceux que demande la version choisie de chaque mod ajouté à la main. Un mod
    // nécessaire part quand plus aucun mod ne le demande.
    function syncDeps() {
      for (const [slug, x] of st.mods) {
        if (x.auto) continue;
        const ver = st.found.get(slug)?.versions?.find((v) => v.v === x.version);
        if (ver) x.deps = ver.deps || [];
      }
      const need = new Map();
      for (const [slug, x] of st.mods) if (!x.auto) for (const d of x.deps || []) {
        if (st.mods.has(d.slug) && !st.mods.get(d.slug).auto) continue;
        if (!need.has(d.slug)) need.set(d.slug, { name: d.name, version: d.version, by: new Set() });
        need.get(d.slug).by.add(slug);
      }
      for (const [slug, x] of [...st.mods]) if (x.auto && !need.has(slug)) st.mods.delete(slug);
      for (const [slug, n] of need) {
        const cur = st.mods.get(slug);
        st.mods.set(slug, { name: n.name, source: "mr", auto: true, by: n.by, version: cur?.version || n.version || "" });
      }
    }
    root.addEventListener("change", (e) => {
      if (e.target.dataset.mrv) {
        const slug = e.target.dataset.mrv;
        st.pick.set(slug, e.target.value);
        if (st.mods.has(slug)) {
          st.mods.get(slug).version = e.target.value;
          syncDeps();
          draw();
        }
        return;
      }
      if (e.target.id === "mp-mc") {
        st.mc = e.target.value;
        draw();
      }
    });
    root.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.loader) {
        st.loader = b.dataset.loader;
        if (!versFor(st.loader).includes(st.mc)) st.mc = versFor(st.loader)[0] || st.mc;
      }
      else if (b.dataset.tab) {
        st.tab = b.dataset.tab;
        draw(true);
      }
      else if (b.dataset.mr) {
        if (st.mods.has(b.dataset.mr) && !st.mods.get(b.dataset.mr).auto) st.mods.delete(b.dataset.mr);
        else {
          const x = st.found.get(b.dataset.mr);
          st.mods.set(b.dataset.mr, { name: b.dataset.name, source: "mr", version: st.pick.get(b.dataset.mr) || x?.versions?.[0]?.v, deps: [] });
        }
        syncDeps();
      }
      else if (b.dataset.cfadd) {
        const x = st.found.get(b.dataset.cfadd) || {};
        st.mods.set(b.dataset.cfadd, { name: b.dataset.name, source: "cf", status: "wait", projectId: x.projectId, fileId: x.fileId, fileName: x.fileName, pageUrl: x.pageUrl });
      }
      else if (b.id === "mp-crasha") {
        st.mods.set("crash-assistant", { name: "Crash Assistant", source: "mr", deps: [] });
        syncDeps();
      }
      else if (b.dataset.rm) {
        st.mods.delete(b.dataset.rm);
        syncDeps();
      }
      else if (b.dataset.cfopen) {
        const x = st.mods.get(b.dataset.cfopen);
        if (!x) return;
        b.disabled = true;
        b.textContent = T("mpCfWait");
        const r = await api.myPack.openCurseForge({ slug: b.dataset.cfopen, name: x.name, projectId: x.projectId, fileId: x.fileId, fileName: x.fileName, pageUrl: x.pageUrl, depId: x.search || null });
        if (r?.found) {
          x.status = "ok";
          x.token = r.token;
        }
      } else if (b.id === "mp-all") {
        for (const x of scan.mr) if (!st.mods.has(x.slug)) st.mods.set(x.slug, { name: x.name, source: "mr", deps: [] });
      }
      else if (b.id === "mp-cancel") return m.close();
      else if (b.id === "mp-create" || b.id === "mp-go") {
        b.disabled = true;
        b.textContent = "…";
        m.ov.dataset.locked = "1";
        // Les mods nécessaires (⚙) sont recalculés par le launcher à partir des versions choisies.
        const mods = [...st.mods.entries()].filter(([, x]) => !x.auto).map(([slug, x]) => ({ slug, source: x.source, version: x.version || null, name: x.name, projectId: x.projectId || null, fileId: x.fileId || null, fileName: x.fileName || null, pageUrl: x.pageUrl || null, search: x.search || null, token: x.token || null }));
        const r = addTo ? await api.myPack.add(addTo, mods) : await api.myPack.create({ name: st.name, minecraftVersion: st.mc, loader: st.loader, mods, worldKey: world?.key || null, omni: !!pre.omni });
        delete m.ov.dataset.locked;
        if (!r?.ok) {
          b.disabled = false;
          toast(T("mpErr", { e: r?.error || "?" }));
          return draw();
        }
        m.close();
        toast(addTo ? T("mpAdded2") : T("mpCreated", { n: r?.name || st.name || "Mon pack" }));
        await refresh();
        if (addTo && packPage?.id === addTo) return reloadPack();
        if (b.id === "mp-go" && !world && r.version?.id) return launch({ versionId: r.version.id }, null);
        if (world && r.version?.id) return launch({ worldKey: world.key, versionId: r.version.id, modOk: true }, null);
        return;
      } else return;
      draw();
    });
    draw(true);
    draw();
  }


  // --- Nouveaux menus d'ajout (31/10, preview validée par Rushi, Laboratoire « addMenus ») -----------
  // Une seule fenêtre « Ajouter » (mods, packs de ressources, shaders, data packs, mondes) : par défaut,
  // seulement ce qui marche avec la version ET le chargeur du pack ; le reste est compté à part. Chaque
  // élément a sa fiche : grille versions × chargeurs, version minimale, mods nécessaires, images et
  // liens donnés par l'auteur (pas la page Modrinth/CurseForge recopiée). Un élément qui n'existe pas
  // pour le pack propose « Créer une copie en … » : le pack n'est JAMAIS changé en place.
  // Aussi « Créer un pack » (mods d'abord ou version d'abord) et « Un pack existant » (grille).
  const AD_CSS = document.createElement("style");
  AD_CSS.textContent = `
  .ad-support:not(:has(button)) { display:none; }
  .ad-ovl { z-index: 240; }
  .ad-win { position: relative; width: min(1060px, calc(100vw - 40px)); height: min(680px, calc(100vh - 80px)); background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.5); display: flex; flex-direction: column; overflow: hidden; color: var(--foreground); font-size: 13px; text-align: left; }
  .ad-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px 10px; }
  .ad-head h3 { margin: 0; font-size: 16px; }
  .ad-pill { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); white-space: nowrap; }
  .ad-x { margin-left: auto; background: none; border: 0; color: var(--muted); font-size: 20px; cursor: pointer; line-height: 1; padding: 4px 8px; border-radius: 8px; }
  .ad-x:hover { background: var(--row-band, rgba(127,127,127,.12)); color: var(--foreground); }
  .ad-tabs { display: flex; gap: 2px; padding: 0 18px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .ad-tab { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--muted); padding: 8px 12px; font: inherit; font-weight: 600; cursor: pointer; }
  .ad-tab.on { color: var(--foreground); border-bottom-color: var(--accent); }
  .ad-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 18px; }
  .ad-q { flex: 1; min-width: 200px; padding: 8px 12px; border-radius: 9px; border: 1px solid var(--border); background: var(--background); color: var(--foreground); font: inherit; }
  .ad-seg { display: inline-flex; border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
  .ad-seg button { background: none; border: 0; padding: 7px 11px; font: inherit; font-size: 12.5px; color: var(--muted); cursor: pointer; }
  .ad-seg button.on { background: var(--accent); color: #fff; }
  .ad-sel { padding: 7px 10px; border-radius: 9px; border: 1px solid var(--border); background: var(--background); color: var(--foreground); font: inherit; font-size: 12.5px; }
  .ad-sw { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 12.5px; background: none; border: 0; color: inherit; font: inherit; padding: 0; }
  .ad-sw i { width: 32px; height: 18px; border-radius: 999px; background: var(--border); position: relative; transition: background .15s; flex-shrink: 0; }
  .ad-sw i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: left .15s; }
  .ad-sw.on i { background: var(--accent); }
  .ad-sw.on i::after { left: 16px; }
  .ad-body { flex: 1; display: grid; grid-template-columns: 1fr 380px; min-height: 0; border-top: 1px solid var(--border); }
  .ad-list { overflow-y: auto; padding: 10px 12px 14px 18px; display: flex; flex-direction: column; gap: 6px; }
  .ad-side { overflow-y: auto; border-left: 1px solid var(--border); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
  .ad-count { font-size: 12.5px; color: var(--muted); padding: 2px 2px 4px; }
  .ad-link { background: none; border: 0; color: var(--accent); font: inherit; font-size: 12.5px; cursor: pointer; padding: 0; text-decoration: underline; }
  .ad-row { display: grid; grid-template-columns: 40px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 9px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--background); cursor: pointer; }
  .ad-row:hover, .ad-row.sel { border-color: var(--accent); }
  .ad-row.no { opacity: .78; }
  .ad-ic { width: 40px; height: 40px; border-radius: 9px; display: grid; place-items: center; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
  .ad-ic img { width: 100%; height: 100%; object-fit: cover; }
  .ad-ic.big { width: 56px; height: 56px; border-radius: 12px; font-size: 20px; }
  .ad-main { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .ad-name { font-weight: 700; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .ad-name small { font-weight: 400; color: var(--muted); }
  .ad-desc { color: var(--muted); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ad-src { font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 6px; }
  .ad-src.mr { color: #1bd96a; background: color-mix(in srgb, #1bd96a 14%, transparent); }
  .ad-src.cf { color: #f16436; background: color-mix(in srgb, #f16436 14%, transparent); }
  .ad-src.ftb { color: #d23f3f; background: color-mix(in srgb, #d23f3f 14%, transparent); }
  .ad-src.hand { color: var(--warn); background: color-mix(in srgb, var(--warn) 14%, transparent); }
  .ad-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .ad-chip { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
  .ad-chip.cur { border-color: var(--accent); color: var(--foreground); }
  .ad-ok { font-size: 11.5px; color: var(--success); font-weight: 700; }
  .ad-bad { font-size: 11.5px; color: var(--warn); font-weight: 700; }
  .ad-act { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .ad-btn { font: inherit; font-size: 12.5px; font-weight: 700; padding: 7px 12px; border-radius: 9px; border: 1px solid var(--accent); background: var(--accent); color: #fff; cursor: pointer; white-space: nowrap; }
  .ad-btn.sec { background: transparent; color: var(--foreground); border-color: var(--border); }
  .ad-btn.done { background: color-mix(in srgb, var(--success) 18%, transparent); color: var(--success); border-color: color-mix(in srgb, var(--success) 45%, transparent); }
  .ad-btn:disabled { opacity: .5; cursor: default; }
  .ad-hint { display: flex; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--warn) 45%, var(--border)); background: color-mix(in srgb, var(--warn) 8%, transparent); }
  .ad-hint > span { color: var(--warn); font-weight: 800; }
  .ad-hint > div { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .ad-hrow { display: flex; gap: 6px; flex-wrap: wrap; }
  .ad-empty { color: var(--muted); padding: 22px 6px; text-align: center; display: flex; flex-direction: column; gap: 6px; line-height: 1.5; }
  .ad-empty b { color: var(--foreground); font-size: 14px; }
  .ad-info { font-size: 12.5px; color: var(--muted); line-height: 1.5; padding: 8px 10px; border-radius: 9px; background: var(--row-band, rgba(127,127,127,.08)); }
  .ad-fh { display: flex; gap: 12px; align-items: center; }
  .ad-fh .t { font-size: 16px; font-weight: 800; }
  .ad-fh .a { color: var(--muted); font-size: 12.5px; }
  .ad-gridbox { overflow-x: auto; padding-bottom: 4px; }
  .ad-grid { border-collapse: separate; border-spacing: 2px; font-size: 11px; }
  .ad-grid th { font-weight: 600; color: var(--muted); text-align: left; padding: 0 4px 0 0; white-space: nowrap; position: sticky; left: 0; background: var(--surface); }
  .ad-grid thead th { writing-mode: vertical-rl; transform: rotate(180deg); text-align: left; padding: 0 0 4px; height: 44px; font-weight: 500; position: static; }
  .ad-grid thead th.cur { color: var(--accent); font-weight: 800; }
  .ad-grid td { min-width: 16px; height: 20px; border-radius: 4px; background: var(--row-band, rgba(127,127,127,.1)); text-align: center; cursor: default; }
  .ad-grid td.y { background: color-mix(in srgb, var(--success) 55%, transparent); cursor: pointer; }
  .ad-grid td.y:hover { outline: 2px solid var(--foreground); }
  .ad-grid td.cur { outline: 2px solid var(--accent); outline-offset: -1px; }
  .ad-legend { display: flex; gap: 12px; font-size: 11.5px; color: var(--muted); margin-top: 6px; flex-wrap: wrap; }
  .ad-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; }
  .ad-min { display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; }
  .ad-min span { color: var(--muted); }
  .ad-fact { display: flex; gap: 6px; flex-wrap: wrap; }
  .ad-dep { display: flex; gap: 8px; align-items: center; font-size: 12.5px; margin-bottom: 4px; }
  .ad-dep .ad-ic { width: 24px; height: 24px; font-size: 11px; border-radius: 6px; }
  .ad-file { font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; padding: 6px 8px; border-radius: 7px; background: var(--background); border: 1px solid var(--border); word-break: break-all; }
  .ad-foot { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--border); flex-wrap: wrap; }
  .ad-foot .sp { flex: 1; }
  .ad-foot .n { color: var(--muted); font-size: 12.5px; }
  .ad-vers { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; flex: 1; min-width: 0; }
  .ad-vchip { font: inherit; font-size: 12px; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--foreground); cursor: pointer; }
  .ad-vchip.all { border-color: color-mix(in srgb, var(--success) 60%, var(--border)); }
  .ad-vchip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .ad-vchip small { opacity: .75; margin-left: 3px; }
  .ad-dlg { position: absolute; inset: 0; background: rgba(4,7,14,.55); display: flex; align-items: center; justify-content: center; z-index: 2; }
  .ad-dlg > div { width: min(470px, calc(100% - 40px)); background: var(--surface); border: 1px solid var(--border); border-top: 4px solid var(--accent); border-radius: 14px; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.5); max-height: calc(100% - 40px); overflow-y: auto; }
  .ad-dlg h3 { margin: 0 0 8px; font-size: 16px; }
  .ad-dlg p { margin: 0 0 10px; color: var(--muted); line-height: 1.5; }
  .ad-chk { display: flex; flex-direction: column; gap: 4px; margin: 8px 0 4px; }
  .ad-chk div { display: flex; gap: 8px; align-items: center; }
  .ad-chk .y { color: var(--success); font-weight: 800; width: 14px; }
  .ad-chk .n { color: var(--warn); font-weight: 800; width: 14px; }
  .ad-chk .u { color: var(--muted); font-weight: 800; width: 14px; }
  .ad-dlg .acts { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
  .ad-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px; }
  .ad-card { text-align: left; border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: var(--background); color: var(--foreground); font: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 6px; }
  .ad-card:hover { border-color: var(--accent); }
  .ad-card b { font-size: 14px; }
  .ad-card span { color: var(--muted); font-size: 12.5px; line-height: 1.45; }
  .ad-card em { font-style: normal; font-size: 11px; font-weight: 700; color: var(--accent); }
  .ad-verdict { font-weight: 700; font-size: 13.5px; }
  .ad-verdict.ok { color: var(--success); } .ad-verdict.no { color: var(--warn); }
  .ad-gal { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; }
  .ad-gal img { width: 200px; height: 112px; object-fit: cover; border-radius: 10px; flex-shrink: 0; background: var(--background); }
  .ad-hero { width: 100%; height: 150px; object-fit: cover; border-radius: 10px; background: var(--background); }
  .ad-fold { border-top: 1px solid var(--border); padding-top: 10px; }
  .ad-fold > summary { cursor: pointer; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 700; margin-bottom: 8px; }
  .ad-fold > summary small { text-transform: none; letter-spacing: 0; font-weight: 400; }
  .ad-support { border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .ad-loading { color: var(--muted); padding: 30px 6px; text-align: center; }
  .ad-nm { padding: 7px 10px; border-radius: 9px; border: 1px solid var(--border); background: var(--background); color: var(--foreground); font: inherit; font-size: 12.5px; width: 200px; }
  .ad-fmt { border: 1px solid var(--border); border-radius: 8px; background: transparent; color: inherit; cursor: pointer; font: inherit; font-size: 12.5px; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 7px 12px; text-align: left; }
  .ad-fmt.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  .ad-fmt small { opacity: .75; }
  .ad-x2 { display: flex; flex-direction: column; gap: 6px; }
  .ad-x2 .ad-row { cursor: default; grid-template-columns: 40px minmax(0,1fr); }
  .ad-h4 { margin: 14px 0 6px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  @media (max-width: 860px) { .ad-body { grid-template-columns: 1fr; } .ad-side { border-left: 0; border-top: 1px solid var(--border); } }
  `;
  document.head.appendChild(AD_CSS);
  const adTr = (f, e) => (L() === "fr" ? f : e);
  const AD_KIND = () => ({ mods: "Mods", rp: adTr("Packs de ressources", "Resource packs"), sh: "Shaders", dp: "Data packs", w: adTr("Mondes", "Worlds"), mp: "Modpacks" });
  const AD_LOADERS = ["neoforge", "forge", "fabric", "quilt"];
  const adCmp = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });
  const adLname = (l) => LOADERS[l] || "Minecraft";
  const adTarget = (l, mc) => (l ? `${adLname(l)} ${mc}` : `Minecraft ${mc}`);
  const adFmtDl = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".", L() === "fr" ? "," : ".")} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : `${n || 0}`);
  const adKey = (x) => `${x.src}:${x.id}`;
  const adIc = (x, big) => `<div class="ad-ic${big ? " big" : ""}" style="background:${pkColor(String(x.id || x.name))}">${x.icon ? `<img src="${esc(x.icon)}" alt="" loading="lazy">` : esc(String(x.name || "?")[0])}</div>`;
  const AD_SRC_N = { mr: "Modrinth", cf: "CurseForge", ftb: "FTB" };
  const adAgo = (iso) => {
    const t = Date.parse(iso || "");
    if (!t) return "";
    const d = Math.max(0, Math.round((Date.now() - t) / 86400000));
    if (d < 1) return adTr("aujourd'hui", "today");
    if (d < 60) return adTr(`il y a ${d} jour${d > 1 ? "s" : ""}`, `${d} day${d > 1 ? "s" : ""} ago`);
    const mo = Math.round(d / 30);
    if (mo < 24) return adTr(`il y a ${mo} mois`, `${mo} month${mo > 1 ? "s" : ""} ago`);
    return adTr(`il y a ${Math.round(mo / 12)} ans`, `${Math.round(mo / 12)} years ago`);
  };
  // Pour quelles versions (et chargeurs) un élément existe : la fiche (exacte) si on l'a lue, sinon
  // ce que dit la recherche (CurseForge : exact ; Modrinth : le projet entier).
  function adAv(x) {
    if (x.sheet?.av && Object.keys(x.sheet.av).length) return x.sheet.av;
    if (x.av && Object.keys(x.av).length) return x.av;
    if (x.mcs?.length) {
      if (x.loaders?.length) return Object.fromEntries(x.loaders.map((l) => [l, x.mcs]));
      return { mc: x.mcs };
    }
    return {};
  }
  function adOk(x, l, mc) {
    if (typeof x.okV === "boolean" && !x.sheet) return x.okV;
    const a = adAv(x);
    if (a.mc) return a.mc.includes(mc);
    return (l === "quilt" ? ["quilt", "fabric"] : [l]).some((k) => a[k]?.includes(mc));
  }
  const adRange = (vs) => {
    const s = [...vs].sort(adCmp);
    return s.length === 1 ? s[0] : `${s[0]} → ${s[s.length - 1]}`;
  };
  const adChips = (x, cur) => Object.entries(adAv(x)).map(([l, vs]) => `<span class="ad-chip${cur && (l === cur || l === "mc") ? " cur" : ""}">${esc(l === "mc" ? "Minecraft" : adLname(l))} ${esc(adRange(vs))}</span>`).join("");
  // Version la plus proche où l'élément existe : même chargeur d'abord, la plus récente à distance égale.
  function adNearest(x, l, mc) {
    const a = adAv(x);
    const mine = a.mc || a[l] || (l === "quilt" ? a.fabric : null) || [];
    if (mine.length) {
      const all = [...new Set([...mine, mc])].sort(adCmp);
      const i = all.indexOf(mc);
      let best = null;
      for (const v of mine) {
        const d = Math.abs(all.indexOf(v) - i);
        if (!best || d < best.d || (d === best.d && adCmp(v, best.v) > 0)) best = { v, d };
      }
      return { l, mc: best.v };
    }
    const other = Object.entries(a).find(([, vs]) => vs.includes(mc));
    if (other) return { l: other[0], mc };
    const first = Object.entries(a).sort((p, q) => adCmp(q[1][q[1].length - 1], p[1][p[1].length - 1]))[0];
    return first ? { l: first[0] === "mc" ? l : first[0], mc: first[1][first[1].length - 1] } : null;
  }
  // Fichier CurseForge d'une case (chargeur, version) : Quilt prend aussi les fichiers Fabric.
  const adCfFile = (x, l, mc) => x.files?.[`${l}|${mc}`] || (l === "quilt" ? x.files?.[`fabric|${mc}`] : null) || x.files?.[`mc|${mc}`] || null;

  let adW = null; // fenêtre ouverte
  function adClose() {
    adW?.m.close();
    adW = null;
  }
  // mode : "add" (page d'un pack), "ver" (nouveau pack, version d'abord), "free" (mods d'abord), "browse" (modpacks).
  async function openAddWin(o) {
    adClose();
    if (on("packRam")) await rmLoadSys();
    const p = packPage?.p;
    const S = {
      mode: o.mode,
      kind: o.kind || (o.mode === "browse" ? "mp" : "mods"),
      q: "",
      src: "all",
      only: true,
      sel: null,
      items: [],
      okTotal: 0,
      allTotal: 0,
      loading: true,
      err: null,
      added: new Map(), // clé → { modId, name, cf } (session de la fenêtre)
      last: null,
      free: new Map(), // modes « ver » et « free » : clé → élément choisi
      freeL: "all",
      pick: null,
      pickUser: false,
      bl: "",
      bv: "",
      sw: null,
      name: o.name || "",
      omni: !!o.omni,
      seq: 0,
    };
    if (o.mode === "add") S.ctx = { l: p.vanilla ? null : p.loader, mc: p.minecraftVersion, id: packPage.id, name: data.versions.find((x) => x.id === packPage.id)?.name || p.name };
    else if (o.mode === "ver") S.ctx = { l: o.loader, mc: o.mc, id: null, name: S.name };
    else S.ctx = null;
    const cfMods = on("myPackCf") && !S.omni && !p?.omni;
    const cfContent = on("contentCf") && !S.omni && !p?.omni;
    const kinds = o.mode === "browse" ? ["mp"] : o.mode !== "add" ? ["mods"] : p.vanilla ? ["rp", ...(on("vanillaModded") ? ["sh"] : []), ...(on("dataPacks") ? ["dp"] : []), "w"] : ["mods", "rp", "sh", ...(on("dataPacks") ? ["dp"] : []), "w"];
    if (!kinds.includes(S.kind)) S.kind = kinds[0];
    const cfFor = (k) => (k === "mods" ? cfMods : k === "mp" ? true : cfContent);
    let mpSrcs = ["mr", "cf", "ftb"]; // modpacks : sources ouvertes (lues plus bas)
    const srcsFor = (k) => (k === "w" ? (cfFor(k) ? ["cf"] : []) : k === "mp" ? mpSrcs : cfFor(k) ? ["mr", "cf"] : ["mr"]);
    const m = overlay(`<div class="ad-win" role="dialog" aria-modal="true" aria-labelledby="ad-t"></div>`, { className: "play-modal ad-ovl" });
    adW = { m, S };
    const win = m.$(".ad-win");
    const packHas = (x) => {
      if (S.added.has(adKey(x))) return true;
      if (S.mode !== "add" || S.kind !== "mods") return false;
      return (p.mods || []).some((y) => y.id === x.slug || y.id === `cf-${x.id}`);
    };

    // --- Recherche -------------------------------------------------------------------------------
    async function load() {
      const my = ++S.seq;
      S.loading = true;
      S.err = null;
      draw();
      const c = S.ctx;
      const srcs = srcsFor(S.kind).filter((k) => S.src === "all" || k === S.src);
      let items = [];
      let okTotal = 0;
      let allTotal = 0;
      const errs = [];
      if (S.mode === "browse") {
        const out = await Promise.all(srcs.map((k) => api.packBrowse.search(k, S.q, { mc: S.bv, loader: S.bl }).then((r) => ({ k, r })).catch((e) => ({ k, r: { ok: false, error: String(e?.message || e) } }))));
        const lists = out.map((x) => {
          if (x.r?.ok === false && x.r.code !== "feature_off") errs.push(`${AD_SRC_N[x.k]} : ${x.r.error || "?"}`);
          return (x.r?.packs || []).map((y) => ({ ...y, src: x.k, okV: true }));
        });
        for (let i = 0; lists.some((l) => l[i]); i++) for (const l of lists) if (l[i]) items.push(l[i]);
        okTotal = allTotal = items.length;
      } else {
        const loader = S.mode === "free" ? (S.freeL === "all" ? null : S.freeL) : c?.l || null;
        const mc = c?.mc || null;
        const out = await Promise.all(srcs.map((k) => api.addMenu.search({ kind: S.kind, src: k, q: S.q, mc, loader: S.kind === "mods" ? loader : null }).then((r) => ({ k, r })).catch((e) => ({ k, r: { ok: false, error: String(e?.message || e) } }))));
        const lists = [];
        for (const { k, r } of out) {
          if (r?.ok === false) {
            if (r.code !== "feature_off") errs.push(`${AD_SRC_N[k]} : ${r.error || "?"}`);
            continue;
          }
          if (k === "mr") {
            const ok = (r.items || []).map((x) => ({ ...x, okV: c ? true : undefined }));
            const others = (r.others || []).map((x) => ({ ...x, okV: c ? false : undefined }));
            lists.push([...ok, ...others]);
            okTotal += r.okTotal || ok.length;
            allTotal += r.allTotal || ok.length + others.length;
          } else {
            let list = r.items || [];
            if (S.mode === "free" && loader) list = list.filter((x) => adAv(x)[loader] || adAv(x).mc);
            lists.push(list);
            const okN = c ? list.filter((x) => adOk(x, c.l, c.mc)).length : list.length;
            okTotal += okN;
            allTotal += list.length;
          }
        }
        for (let i = 0; lists.some((l) => l[i]); i++) for (const l of lists) if (l[i]) items.push(l[i]);
      }
      if (my !== S.seq || !document.body.contains(m.ov)) return;
      S.items = items;
      S.okTotal = okTotal;
      S.allTotal = allTotal;
      S.err = errs.join(" · ") || null;
      S.loading = false;
      draw();
    }
    const find = (key) => S.items.find((x) => adKey(x) === key) || S.free.get(key) || null;
    // Fiche exacte (Modrinth : versions de l'élément ; FTB/Modrinth modpacks : leurs versions).
    async function loadSheet(x) {
      if (x.sheet || x.sheetLoading) return;
      x.sheetLoading = true;
      const c = S.ctx;
      if (S.mode === "browse" && x.src !== "cf") {
        const r = await api.packBrowse.versions(x.src, x.id).catch(() => null);
        const vs = r?.versions || [];
        const av = {};
        for (const v of vs) if (v.mc && v.loader) (av[v.loader] ||= []).includes(v.mc) || av[v.loader].push(v.mc);
        x.sheet = { av, versions: vs };
      } else if (x.src === "mr") {
        const r = await api.addMenu.sheet({ kind: S.kind, id: x.id, mc: c?.mc, loader: c?.l }).catch(() => null);
        x.sheet = r?.ok ? r.sheet : { av: {}, err: r?.error || "?" };
      } else {
        x.sheet = { av: x.av || {}, images: x.images || [], links: { page: x.page, ...(x.links || {}) } };
      }
      x.sheetLoading = false;
      if (document.body.contains(m.ov)) draw();
    }

    // --- Rendu -----------------------------------------------------------------------------------
    function draw() {
      if (!document.body.contains(m.ov)) return;
      const c = S.ctx;
      const focusQ = document.activeElement?.matches?.("[data-ad-q]");
      const caret = focusQ ? document.activeElement.selectionStart : null;
      const listScroll = win.querySelector(".ad-list")?.scrollTop || 0;
      const sideScroll = win.querySelector(".ad-side")?.scrollTop || 0;
      const title = S.mode === "browse" ? adTr("Parcourir les modpacks", "Browse modpacks")
        : S.mode === "free" ? adTr("Nouveau pack : choisis tes mods", "New pack: pick your mods")
        : S.mode === "ver" ? adTr("Nouveau pack : ajoute tes mods", "New pack: add your mods")
        : adTr(`Ajouter à « ${c.name} »`, `Add to “${c.name}”`);
      const pill = c ? `<span class="ad-pill">${esc(adTarget(c.l, c.mc))}</span>` : S.mode === "free" ? `<span class="ad-pill">${esc(adTr("Version choisie à la fin", "Version picked at the end"))}</span>` : "";
      const srcs = srcsFor(S.kind);
      const label = AD_KIND()[S.kind];
      let tools = `<input class="ad-q" type="search" data-ad-q autocomplete="off" placeholder="${esc(adTr(`Chercher ${S.kind === "mods" ? "un mod" : S.kind === "w" ? "une map" : S.kind === "mp" ? "un modpack" : label.toLowerCase()}…`, `Search ${label.toLowerCase()}…`))}" value="${esc(S.q)}">`;
      if (srcs.length > 1) tools += `<div class="ad-seg">${[["all", adTr("Tout", "All")], ...srcs.map((k) => [k, AD_SRC_N[k]])].map(([k, l]) => `<button type="button" data-ad-src="${k}" class="${S.src === k ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`;
      if (c && S.kind !== "w") tools += `<button type="button" class="ad-sw${S.only ? " on" : ""}" data-ad-only role="switch" aria-checked="${S.only}"><i></i>${esc(adTr(`Seulement ce qui marche en ${adTarget(c.l, c.mc)}`, `Only what works on ${adTarget(c.l, c.mc)}`))}</button>`;
      if (S.mode === "free") tools += `<select class="ad-sel" data-ad-freel>${[["all", adTr("Tous les chargeurs", "All loaders")], ...AD_LOADERS.map((k) => [k, adLname(k)])].map(([k, l]) => `<option value="${k}"${S.freeL === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
      if (S.mode === "browse") {
        tools += `<select class="ad-sel" data-ad-bl><option value="">${esc(adTr("Tous les chargeurs", "All loaders"))}</option>${AD_LOADERS.map((k) => `<option value="${k}"${S.bl === k ? " selected" : ""}>${esc(adLname(k))}</option>`).join("")}</select>
          <select class="ad-sel" data-ad-bv><option value="">${esc(adTr("Toutes les versions", "All versions"))}</option>${adMcList().map((v) => `<option${S.bv === v ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
      }
      let list = "";
      if (S.err) list += `<div class="ad-hint"><span>⚠</span><div>${esc(S.err)}</div></div>`;
      if (S.kind === "sh" && S.mode === "add" && !p.iris && !p.vanilla) {
        list += `<div class="ad-hint"><span>⚠</span><div><b>${esc(adTr(`Les shaders ont besoin d'un mod (${p.loader === "forge" ? "Oculus" : "Iris"}) : il n'est pas encore dans le pack.`, `Shaders need a mod (${p.loader === "forge" ? "Oculus" : "Iris"}): it is not in the pack yet.`))}</b><div class="ad-hrow"><button type="button" class="ad-btn sec" data-ad-shld>${esc(adTr("Ajouter le mod de shaders", "Add the shader mod"))}</button></div></div></div>`;
      }
      if (S.kind === "w" && !srcs.length) list += `<div class="ad-info">${esc(adTr("Modrinth n'a pas de maps. Importe une map téléchargée (fichier .zip) avec le bouton en bas.", "Modrinth has no maps. Import a downloaded map (.zip file) with the button below."))}</div>`;
      let shown = S.items;
      if (S.loading) list += `<div class="ad-loading">${esc(adTr("Recherche…", "Searching…"))}</div>`;
      else {
        const hidden = c ? S.items.filter((x) => !adOk(x, c.l, c.mc)) : [];
        const okL = c ? S.items.filter((x) => adOk(x, c.l, c.mc)) : S.items;
        shown = c && S.only && S.kind !== "w" ? okL : S.items;
        if (c && S.kind !== "w") {
          const hid = Math.max(hidden.length, S.allTotal - S.okTotal);
          list += `<div class="ad-count">${esc(adTr(`${S.okTotal} pour ${adTarget(c.l, c.mc)}`, `${S.okTotal} for ${adTarget(c.l, c.mc)}`))}${hid > 0 ? ` · ${esc(adTr(`${hid} pas pour cette version`, `${hid} not for this version`))}`: ""}</div>`;
          // « Create existe, mais pas en Forge 1.16.4 » : les éléments cherchés par leur nom.
          if (S.only && S.q.trim()) {
            const needle = S.q.trim().toLowerCase();
            const named = hidden.filter((x) => x.name.toLowerCase().includes(needle)).sort((a, b) => Number(b.name.toLowerCase() === needle) - Number(a.name.toLowerCase() === needle)).slice(0, 2);
            for (const x of named) {
              const nb = adNearest(x, c.l, c.mc);
              list += `<div class="ad-hint"><span>ℹ</span><div><b>${esc(adTr(`« ${x.name} » existe, mais pas en ${adTarget(c.l, c.mc)}.`, `“${x.name}” exists, but not on ${adTarget(c.l, c.mc)}.`))}</b>
                <div class="ad-chips">${adChips(x, c.l)}</div>
                <div class="ad-hrow"><button type="button" class="ad-btn sec" data-ad-sel="${esc(adKey(x))}">${esc(adTr("Voir sa fiche", "See its sheet"))}</button>${nb && c.l && S.mode === "add" ? `<button type="button" class="ad-btn sec" data-ad-switch="${esc(`${nb.l}|${nb.mc}|${adKey(x)}`)}">${esc(adTr(`Créer une copie en ${adTarget(nb.l, nb.mc)}`, `Make a copy on ${adTarget(nb.l, nb.mc)}`))}</button>` : ""}</div></div></div>`;
            }
          }
        }
        if (!shown.length && !S.err) {
          list += S.q.trim()
            ? `<div class="ad-empty"><b>${esc(adTr(`Rien trouvé pour « ${S.q.trim()} »`, `Nothing found for “${S.q.trim()}”`))}</b>${esc(adTr("Essaie un autre mot, ou l'autre source (Modrinth / CurseForge).", "Try another word, or the other source (Modrinth / CurseForge)."))}</div>`
            : `<div class="ad-empty"><b>${esc(adTr("Rien à montrer ici", "Nothing to show here"))}</b>${esc(c ? adTr(`Aucun élément de cette liste n'existe pour ${adTarget(c.l, c.mc)}.`, `Nothing in this list exists for ${adTarget(c.l, c.mc)}.`) : adTr("Change les filtres.", "Change the filters."))}</div>`;
        }
        for (const x of shown) {
          const key = adKey(x);
          const good = c ? adOk(x, c.l, c.mc) : true;
          const has = S.mode === "free" || S.mode === "ver" ? S.free.has(key) : packHas(x);
          const btn = S.mode === "browse"
            ? `<button type="button" class="ad-btn sec" data-ad-sel="${esc(key)}">${esc(adTr("Choisir la version", "Pick the version"))}</button>`
            : has ? `<button type="button" class="ad-btn done" data-ad-rm="${esc(key)}">✓ ${esc(adTr("Ajouté", "Added"))}</button>`
            : good ? `<button type="button" class="ad-btn" data-ad-add="${esc(key)}">+ ${esc(adTr("Ajouter", "Add"))}</button>`
            : `<button type="button" class="ad-btn sec" data-ad-sel="${esc(key)}">${esc(adTr("Voir les versions", "See versions"))}</button>`;
          const hand = x.src === "cf" && ((S.kind === "mods" && S.mode !== "browse") || x.blocked);
          list += `<div class="ad-row${good ? "" : " no"}${S.sel === key ? " sel" : ""}" data-ad-sel="${esc(key)}">${adIc(x)}
            <div class="ad-main"><div class="ad-name">${esc(x.name)} ${x.author ? `<small>${esc(adTr("par", "by"))} ${esc(x.author)}</small>` : ""} <span class="ad-src ${x.src}">${AD_SRC_N[x.src]}</span>${hand ? `<span class="ad-src hand">${esc(adTr("À télécharger sur sa page", "Download on its page"))}</span>` : ""}${x.wg ? `<span class="ad-src hand">${esc(adTr("Génération du monde", "World generation"))}</span>` : ""}</div>
            <div class="ad-desc">${esc(x.desc || "")}</div>
            <div class="ad-chips">${c && S.kind !== "w" ? (good ? `<span class="ad-ok">✓ ${esc(adTr("Marche sur ton pack", "Works with your pack"))}</span>` : `<span class="ad-bad">✗ ${esc(adTr("Pas pour ton pack", "Not for your pack"))}</span> ${adChips(x, c.l)}`) : S.mode === "browse" ? `${x.mc ? `<span class="ad-chip">${esc([adLname(x.loader), x.mc].filter((y) => y && y !== "Minecraft").join(" "))}</span>` : ""}` : adChips(x)}</div></div>
            <div class="ad-act">${btn}${x.dl ? `<small style="color:var(--muted)">⬇ ${adFmtDl(x.dl)}</small>` : ""}</div></div>`;
        }
      }
      const foot = S.mode === "free" || S.mode === "ver" ? footNew()
        : S.mode === "browse" ? `<span class="n">${esc(adTr("Clique un modpack, puis une case verte de sa fiche pour l'installer dans cette version.", "Click a modpack, then a green cell of its sheet to install it on that version."))}</span><span class="sp"></span><button type="button" class="ad-btn sec" data-ad-x>${esc(adTr("Fermer", "Close"))}</button>`
        : `${S.kind === "mods" ? `<button type="button" class="ad-btn sec" data-ad-jar>${esc(adTr("📁 J'ai le fichier (.jar)", "📁 I have the file (.jar)"))}</button>` : `<button type="button" class="ad-btn sec" data-ad-file>${esc(adTr("📁 Importer un fichier .zip", "📁 Import a .zip file"))}</button>`}
           <span class="n">${S.added.size ? esc(adTr(`+${S.added.size} dans « ${c.name} »`, `+${S.added.size} in “${c.name}”`)) : S.kind === "mods" ? esc(adTr("Les mods nécessaires sont ajoutés tout seuls.", "Required mods are added automatically.")) : ""}</span>${S.last ? `<button type="button" class="ad-link" data-ad-undo>${esc(adTr(`Annuler l'ajout de ${S.last.name}`, `Undo adding ${S.last.name}`))}</button>` : ""}<span class="sp"></span><button type="button" class="ad-btn" data-ad-x>${esc(adTr("Terminé", "Done"))}</button>`;
      win.innerHTML = `<div class="ad-head"><h3 id="ad-t">${esc(title)}</h3>${pill}<button type="button" class="ad-x" data-ad-x aria-label="${esc(adTr("Fermer", "Close"))}">×</button></div>
        ${kinds.length > 1 ? `<div class="ad-tabs" role="tablist">${kinds.map((k) => `<button type="button" role="tab" class="ad-tab${S.kind === k ? " on" : ""}" aria-selected="${S.kind === k}" data-ad-kind="${k}">${esc(AD_KIND()[k])}</button>`).join("")}</div>` : ""}
        <div class="ad-tools">${tools}</div>
        <div class="ad-body"><div class="ad-list">${list}</div><div class="ad-side">${side()}</div></div>
        <div class="ad-foot">${foot}</div>${S.sw ? dlgSwitch() : ""}`;
      win.querySelector(".ad-list").scrollTop = listScroll;
      win.querySelector(".ad-side").scrollTop = sideScroll;
      if (focusQ) {
        const q = win.querySelector("[data-ad-q]");
        q.focus();
        if (caret != null) q.setSelectionRange(caret, caret);
      }
      const cur = win.querySelector(".ad-grid th.cur");
      if (cur) cur.closest(".ad-gridbox").scrollLeft = Math.max(0, cur.offsetLeft - 120);
      else win.querySelectorAll(".ad-gridbox").forEach((b) => (b.scrollLeft = b.scrollWidth));
    }
    function adMcList() {
      return (data.mcVersions || []).filter((v) => v.type === "release").map((v) => v.id).slice(0, 80);
    }

    // Fiche d'un élément (à droite).
    function side() {
      const c = S.ctx;
      const x = S.sel && find(S.sel);
      if (!x) {
        return `<div class="ad-empty" style="padding:30px 6px;"><b>${esc(adTr("La fiche", "The sheet"))}</b>${esc(adTr("Clique sur un élément de la liste : tu vois pour quelles versions de Minecraft et quels chargeurs il existe, ce dont il a besoin, et le fichier exact qui sera pris.", "Click an item in the list: you see which Minecraft versions and loaders it exists for, what it needs, and the exact file that will be used."))}</div>`;
      }
      loadSheet(x);
      const sh = x.sheet;
      const a = adAv(x);
      const rows = Object.keys(a).sort((p1, p2) => AD_LOADERS.indexOf(p1) - AD_LOADERS.indexOf(p2));
      const cols = [...new Set([...rows.flatMap((l) => a[l]), ...(c ? [c.mc] : [])])].sort(adCmp);
      const curL = c?.l;
      const curMc = c?.mc;
      const grid = !rows.length ? `<div class="ad-info">${esc(x.sheetLoading ? adTr("Lecture des versions…", "Reading versions…") : adTr("Versions inconnues.", "Unknown versions."))}</div>`
        : `<div class="ad-gridbox"><table class="ad-grid"><thead><tr><th></th>${cols.map((v) => `<th class="${v === curMc ? "cur" : ""}">${esc(v)}</th>`).join("")}</tr></thead><tbody>
          ${rows.map((l) => `<tr><th>${esc(l === "mc" ? "Minecraft" : adLname(l))}</th>${cols.map((v) => {
            const y = a[l].includes(v);
            const cur = v === curMc && (l === curL || l === "mc" || (curL === "quilt" && l === "fabric"));
            return `<td class="${y ? "y" : ""}${cur ? " cur" : ""}"${y ? ` data-ad-cell="${esc(`${l === "mc" ? curL || "" : l}|${v}`)}" title="${esc(adTarget(l === "mc" ? null : l, v))}"` : ""}></td>`;
          }).join("")}</tr>`).join("")}</tbody></table></div>
          <div class="ad-legend"><span><i style="background:color-mix(in srgb, var(--success) 55%, transparent)"></i>${esc(adTr("existe", "exists"))}</span>${c ? `<span><i style="outline:2px solid var(--accent);outline-offset:-1px;background:transparent"></i>${esc(adTr("ton pack", "your pack"))}</span>` : ""}<span>${esc(S.mode === "browse" ? adTr("Clique une case verte pour l'installer.", "Click a green cell to install it.") : adTr("Clique une case verte pour la choisir.", "Click a green cell to pick it."))}</span></div>`;
      const mins = rows.map((l) => {
        const s = [...a[l]].sort(adCmp);
        return `<div>${esc(l === "mc" ? "Minecraft" : adLname(l))} : <b>${esc(s[0])}</b> <span>${esc(adTr("au minimum", "minimum"))} · ${esc(adTr("jusqu'à", "up to"))} ${esc(s[s.length - 1])}</span></div>`;
      }).join("");
      const good = c ? adOk(x, c.l, c.mc) : null;
      const key = adKey(x);
      let acts = "";
      if (S.mode === "browse") {
        acts = x.src === "cf"
          ? `<div class="ad-info">${esc(adTr(`Depuis CurseForge, le launcher installe la dernière version${x.mc ? ` (${[adLname(x.loader), x.mc].filter((y) => y !== "Minecraft").join(" ")})` : ""}.`, `From CurseForge, the launcher installs the latest version${x.mc ? ` (${[adLname(x.loader), x.mc].filter((y) => y !== "Minecraft").join(" ")})` : ""}.`))}</div><button type="button" class="ad-btn" data-ad-pbgo="${esc(key)}">${esc(adTr("Installer la dernière version", "Install the latest version"))}</button>`
          : `<div class="ad-info">${esc(adTr("Choisis une case verte ci-dessous : le modpack est installé dans cette version, dans un dossier à part.", "Pick a green cell below: the modpack is installed on that version, in its own folder."))}</div>`;
      } else if (S.mode === "free" || S.mode === "ver") {
        const has = S.free.has(key);
        acts = good === false ? "" : `<button type="button" class="ad-btn${has ? " done" : ""}" data-ad-${has ? "rm" : "add"}="${esc(key)}">${has ? `✓ ${esc(adTr("Dans ton pack", "In your pack"))}` : `+ ${esc(adTr("Ajouter à mon pack", "Add to my pack"))}`}</button>`;
      } else if (good || S.kind === "w") {
        const has = packHas(x);
        const after = S.added.get(key);
        acts = `<button type="button" class="ad-btn${has ? " done" : ""}" data-ad-${has ? "rm" : "add"}="${esc(key)}">${has ? `✓ ${esc(adTr("Ajouté", "Added"))}` : `+ ${esc(S.kind === "w" ? adTr("Ajouter à cette installation", "Add to this installation") : adTr(`Ajouter en ${adTarget(c.l, c.mc)}`, `Add on ${adTarget(c.l, c.mc)}`))}`}</button>${after?.cfWait ? `<button type="button" class="ad-btn sec" data-ad-cfopen="${esc(key)}">${esc(adTr("Ouvrir la page ↗", "Open the page ↗"))}</button>` : ""}${after?.worldKey ? `<button type="button" class="ad-btn" data-ad-play="${esc(after.worldKey)}">▶ ${esc(adTr("Jouer", "Play"))}</button>` : ""}`;
      } else {
        const nb = adNearest(x, c.l, c.mc);
        if (S.kind === "mods" && nb && c.l) {
          acts = `<button type="button" class="ad-btn" data-ad-switch="${esc(`${nb.l}|${nb.mc}|${key}`)}">${esc(adTr(`Créer une copie en ${adTarget(nb.l, nb.mc)}`, `Make a copy on ${adTarget(nb.l, nb.mc)}`))}</button>
            <button type="button" class="ad-btn sec" data-ad-newinst="${esc(`${nb.l}|${nb.mc}|${key}`)}">${esc(adTr(`Nouvelle installation avec seulement ${x.name}`, `New installation with only ${x.name}`))}</button>`;
        } else if (S.kind === "rp" || S.kind === "sh") {
          acts = `<button type="button" class="ad-btn sec" data-ad-add="${esc(key)}">+ ${esc(adTr("Ajouter quand même", "Add anyway"))}</button>`;
        }
      }
      const verdict = !c || S.kind === "w" ? "" : good
        ? `<div class="ad-verdict ok">✓ ${esc(adTr(`Marche sur ton pack (${adTarget(c.l, c.mc)})`, `Works with your pack (${adTarget(c.l, c.mc)})`))}</div>`
        : (() => {
          const nb = adNearest(x, c.l, c.mc);
          return `<div class="ad-verdict no">✗ ${esc(nb ? adTr(`Pas pour ton pack. Le plus proche : ${adTarget(nb.l, nb.mc)}`, `Not for your pack. Closest: ${adTarget(nb.l, nb.mc)}`) : adTr("Pas pour ton pack.", "Not for your pack."))}</div>`;
        })();
      const images = (sh?.images || x.images || []).slice(0, 3);
      const deps = sh?.deps || [];
      const file = c && good ? (x.src === "mr" ? sh?.file?.name : adCfFile(x, c.l, c.mc)?.fileName || x.fileName) : null;
      const kindInfo = S.kind === "sh" && S.mode === "add"
        ? `<div class="ad-info">${esc(p.iris ? adTr("Le mod de shaders est déjà dans le pack ✓", "The shader mod is already in the pack ✓") : p.vanilla ? adTr("En vanilla, le launcher te proposera de passer l'installation en version modée avec Iris (rien n'est supprimé).", "In vanilla, the launcher will offer to switch the installation to modded with Iris (nothing is deleted).") : adTr(`Il faut ${p.loader === "forge" ? "Oculus" : "Iris"} pour les shaders : le launcher te le propose.`, `Shaders need ${p.loader === "forge" ? "Oculus" : "Iris"}: the launcher offers it.`))}</div>`
        : x.wg ? `<div class="ad-info">🌍 ${esc(adTr("Change la génération du monde : à mettre quand tu crées un monde. Sur un monde déjà exploré, seuls les nouveaux endroits changent.", "Changes world generation: add it when you create a world. On an explored world, only new areas change."))}</div>`
        : S.kind === "w" && c ? `<div class="ad-info">🗺 ${esc(good === false ? adTr(`Faite pour Minecraft ${adRange(a.mc || [])}. Ton installation est en ${c.mc} : elle peut ne pas s'ouvrir correctement.`, `Made for Minecraft ${adRange(a.mc || [])}. Your installation is on ${c.mc}: it may not open correctly.`) : adTr("Elle arrive dans les mondes de cette installation (une sauvegarde est faite).", "It goes into this installation's worlds (a backup is made)."))}</div>`
        : S.kind === "rp" && c && !good ? `<div class="ad-info">${esc(adTr("Un pack de ressources fait pour une version voisine marche souvent quand même : Minecraft peut afficher « incompatible ».", "A resource pack made for a nearby version often still works: Minecraft may show “incompatible”."))}</div>` : "";
      const hand = x.src === "cf" && ((S.kind === "mods" && S.mode !== "browse") || x.blocked);
      const L2 = sh?.links || { page: x.page, ...(x.links || {}) };
      const sideTxt = sh?.side ? ({ required: adTr("obligatoire", "required"), optional: adTr("au choix", "optional"), unsupported: adTr("pas utile", "not needed") }) : null;
      return `<div class="ad-fh">${adIc(x, true)}<div><div class="t">${esc(x.name)}</div>${x.author ? `<div class="a">${esc(adTr("par", "by"))} <b>${esc(x.author)}</b></div>` : ""}<div class="ad-fact" style="margin-top:4px"><span class="ad-src ${x.src}">${AD_SRC_N[x.src]}</span>${hand ? `<span class="ad-src hand">${esc(adTr("À télécharger sur sa page", "Download on its page"))}</span>` : ""}</div></div></div>
        ${verdict}
        ${acts ? `<div class="ad-fact">${acts}</div>` : ""}
        ${x.desc ? `<div style="color:var(--muted);line-height:1.5">${esc(x.desc)}</div>` : ""}
        ${images[0] ? `<img class="ad-hero" src="${esc(images[0])}" alt="" loading="lazy">` : ""}
        ${kindInfo}
        ${hand && S.kind === "mods" ? `<div class="ad-info">⚠ ${esc(adTr("Le launcher ne télécharge pas les mods CurseForge : tu le télécharges sur sa page, le launcher le trouve dans Téléchargements et le range tout seul.", "The launcher does not download CurseForge mods: you download it from its page, the launcher finds it in Downloads and puts it in place."))}</div>` : hand ? `<div class="ad-info">⚠ ${esc(adTr("Son auteur réserve le fichier à l'appli CurseForge : tu le télécharges sur sa page, le launcher le trouve dans Téléchargements et le range tout seul.", "Its author keeps the file for the CurseForge app: you download it from its page, the launcher finds it in Downloads and puts it in place."))}</div>` : ""}
        <details class="ad-fold" open><summary>${esc(adTr("Versions", "Versions"))}</summary>${grid}${mins ? `<div class="ad-min" style="margin-top:8px">${mins}</div>` : ""}</details>
        ${deps.length ? `<details class="ad-fold" open><summary>${esc(adTr("Mods nécessaires", "Required mods"))} <small>${esc(adTr("ajoutés tout seuls", "added automatically"))}</small></summary>${deps.map((y) => `<div class="ad-dep">${adIc(y)}<span>${esc(y.name)}</span>${S.mode === "add" && (p.mods || []).some((z) => z.id === y.slug) ? `<small style="color:var(--success)">✓ ${esc(adTr("déjà là", "already there"))}</small>` : `<small style="color:var(--muted)">${esc(adTr("sera ajouté", "will be added"))}</small>`}</div>`).join("")}</details>` : ""}
        <details class="ad-fold"><summary>${esc(adTr("Infos", "Info"))}</summary><div class="ad-min">
          ${sh?.side ? `<div>${esc(adTr("Sur ton PC", "On your PC"))} : ${esc(sideTxt[sh.side.client] || "?")} · ${esc(adTr("sur un serveur", "on a server"))} : ${esc(sideTxt[sh.side.server] || "?")}</div>` : ""}
          ${sh?.updated || x.updated ? `<div>${esc(adTr("Mis à jour", "Updated"))} ${esc(adAgo(sh?.updated || x.updated))}</div>` : ""}
          ${x.dl ? `<div>⬇ ${adFmtDl(sh?.dl || x.dl)} ${esc(x.src === "mr" ? adTr("sur Modrinth", "on Modrinth") : x.src === "cf" ? adTr("sur CurseForge", "on CurseForge") : "")}</div>` : ""}
          ${sh?.license ? `<div>${esc(adTr("Licence", "License"))} : ${esc(sh.license.name || sh.license.id)} <span>(${esc(adTr("telle que donnée par l'auteur", "as given by the author"))})</span></div>` : ""}
          ${file ? `<div>${esc(adTr("Fichier qui sera pris", "File that will be used"))} :</div><div class="ad-file">${esc(file)}</div>` : ""}</div></details>
        ${images.length > 1 ? `<details class="ad-fold"><summary>${esc(adTr("Images", "Images"))} <small>${images.length}</small></summary><div class="ad-gal">${images.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div>${x.author ? `<div style="font-size:11.5px;color:var(--muted)">${esc(adTr(`Images de ${x.author}`, `Images by ${x.author}`))}</div>` : ""}</details>` : ""}
        <div class="ad-support"><b>${esc(adTr("Soutenir l'auteur", "Support the author"))}</b><div class="ad-fact">
          ${(L2.donate || []).map((d) => `<button type="button" class="ad-btn sec" data-ad-link="${esc(d.url)}">♥ ${esc(d.platform || adTr("Faire un don", "Donate"))}</button>`).join("")}
          ${L2.page || x.page ? `<button type="button" class="ad-btn sec" data-ad-link="${esc(L2.page || x.page)}">${esc(adTr(`Page ${AD_SRC_N[x.src]} ↗`, `${AD_SRC_N[x.src]} page ↗`))}</button>` : ""}
          ${L2.source ? `<button type="button" class="ad-btn sec" data-ad-link="${esc(L2.source)}">${esc(adTr("Code source ↗", "Source ↗"))}</button>` : ""}
          ${L2.wiki ? `<button type="button" class="ad-btn sec" data-ad-link="${esc(L2.wiki)}">${esc(adTr("Wiki ↗", "Wiki ↗"))}</button>` : ""}
          ${L2.discord ? `<button type="button" class="ad-btn sec" data-ad-link="${esc(L2.discord)}">Discord ↗</button>` : ""}</div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:4px">${esc(adTr("Liens donnés par l'auteur. Les téléchargements comptent chez lui, pas chez nous.", "Links given by the author. Downloads count for them, not for us."))}</div></div>`;
    }

    // Modes « nouveau pack » : versions où tous les mods choisis existent (mods d'abord), ou le nom.
    function freeVersions() {
      const mods = [...S.free.values()];
      const cells = new Map();
      for (const x of mods) {
        const a = adAv(x);
        for (const l of AD_LOADERS) {
          if (S.freeL !== "all" && l !== S.freeL) continue;
          const vs = new Set([...(a[l] || []), ...(l === "quilt" ? a.fabric || [] : [])]);
          for (const v of vs) cells.set(`${l}|${v}`, (cells.get(`${l}|${v}`) || 0) + 1);
        }
      }
      return [...cells.entries()].map(([k, n]) => ({ l: k.split("|")[0], v: k.split("|")[1], n })).sort((p1, p2) => p2.n - p1.n || adCmp(p2.v, p1.v) || AD_LOADERS.indexOf(p1.l) - AD_LOADERS.indexOf(p2.l)).slice(0, 6);
    }
    // RAM du futur pack (Laboratoire « packRam ») : une pastille à côté du nom, un clic pour régler.
    function adRamCtx() {
      const mc = S.mode === "ver" ? S.ctx?.mc : (S.pick || "|").split("|")[1];
      const mods = [...S.free.values()];
      return { mods: mods.length, mc: mc || "", shaders: mods.some((x) => /\b(iris|oculus)\b/i.test(`${x.name || ""} ${x.slug || x.id || ""}`)), packGB: null };
    }
    function adRamPill() {
      if (!on("packRam")) return "";
      S.ram = S.ram || { mode: "auto", gb: 0 };
      const c = adRamCtx();
      const v = rmValue(S.ram, c);
      const tone = rmVerdict(v, c)[0];
      return `<button type="button" class="ad-btn sec rm-pill ${tone === "warn" || tone === "bad" ? tone : ""}" data-ad-ram title="${esc(rmTr("Mémoire (RAM) de ce pack : cliquer pour régler", "Memory (RAM) for this pack: click to set"))}">🧠 ${esc(`${rmGo(v)} · ${rmModeName(S.ram.mode)}`)}${tone === "warn" || tone === "bad" ? " ⚠" : ""}</button>`;
    }
    function adRamDialog() {
      const st = { ...S.ram };
      const d = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="rm-at" style="max-width:520px;text-align:left;max-height:calc(100vh - 48px);overflow:auto;">
        <h3 id="rm-at">🧠 ${esc(rmTr("Mémoire (RAM) du nouveau pack", "Memory (RAM) for the new pack"))}</h3><div data-rm-slot></div>
        <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;"><button type="button" class="btn-secondary" data-x>${esc(T("cancel"))}</button><button type="button" class="join-btn" data-ok>OK</button></div></div>`);
      rmMount(d.$("[data-rm-slot]"), st, adRamCtx);
      d.$("[data-x]").addEventListener("click", d.close);
      d.$("[data-ok]").addEventListener("click", () => {
        S.ram = { mode: st.mode, gb: st.gb };
        d.close();
        draw();
      });
      d.$("[data-ok]").focus();
    }
    function footNew() {
      const nameIn = `${adRamPill()}<input class="ad-nm" data-ad-name maxlength="60" placeholder="${esc(adTr("Nom du pack", "Pack name"))}" value="${esc(S.name)}">`;
      if (S.mode === "ver") {
        return `<span class="n">${esc(S.free.size ? adTr(`${S.free.size} mod(s) choisi(s). Les mods nécessaires sont ajoutés tout seuls.`, `${S.free.size} mod(s) picked. Required mods are added automatically.`) : adTr("Ajoute tes mods : seuls ceux qui marchent avec cette version sont montrés.", "Add your mods: only the ones that work with this version are shown."))}</span><span class="sp"></span>${nameIn}<button type="button" class="ad-btn sec" data-ad-x>${esc(adTr("Annuler", "Cancel"))}</button><button type="button" class="ad-btn" data-ad-create="${esc(`${S.ctx.l}|${S.ctx.mc}`)}">${esc(adTr(`Créer en ${adTarget(S.ctx.l, S.ctx.mc)}`, `Create on ${adTarget(S.ctx.l, S.ctx.mc)}`))}</button>`;
      }
      if (!S.free.size) return `<span class="n">${esc(adTr("Ajoute tes mods : le launcher te dit ensuite dans quelles versions ils marchent tous ensemble.", "Add your mods: the launcher then tells you which versions they all work on together."))}</span><span class="sp"></span><button type="button" class="ad-btn" disabled>${esc(adTr("Créer le pack", "Create the pack"))}</button>`;
      const pending = [...S.free.values()].some((x) => x.src === "mr" && !x.sheet);
      const vs = freeVersions();
      const tot = S.free.size;
      if (!S.pickUser || !S.pick || !vs.some((x) => `${x.l}|${x.v}` === S.pick)) S.pick = vs[0] ? `${vs[0].l}|${vs[0].v}` : null;
      const [pl, pv] = (S.pick || "|").split("|");
      return `<div class="ad-vers"><span class="n">${esc(pending ? adTr("Lecture des versions…", "Reading versions…") : adTr(`Tes ${tot} mods marchent en :`, `Your ${tot} mods work on:`))}</span>${vs.map((x) => `<button type="button" class="ad-vchip${x.n === tot ? " all" : ""}${S.pick === `${x.l}|${x.v}` ? " on" : ""}" data-ad-pick="${esc(`${x.l}|${x.v}`)}">${esc(adTarget(x.l, x.v))}<small>${x.n}/${tot}</small></button>`).join("")}</div>
        ${nameIn}<button type="button" class="ad-btn" data-ad-create="${esc(S.pick || "")}" ${S.pick ? "" : "disabled"}>${esc(S.pick ? adTr(`Créer en ${adTarget(pl, pv)}`, `Create on ${adTarget(pl, pv)}`) : adTr("Créer le pack", "Create the pack"))}</button>`;
    }

    // « Créer une copie en … » : vérification des mods du pack (Modrinth) avant de créer la copie.
    function dlgSwitch() {
      const [l, mc, key] = S.sw.target;
      const x = key ? find(key) : null;
      const t = adTarget(l, mc);
      const c = S.ctx;
      const mods = S.sw.mods;
      const lost = (mods || []).filter((y) => y.ok === false);
      const far = l !== c.l || Math.abs(adCmp(mc, c.mc)) > 0 && mc.split(".").slice(0, 2).join(".") !== c.mc.split(".").slice(0, 2).join(".");
      const row = (y) => `<div>${y.ok === true ? `<span class="y">✓</span>` : y.ok === false ? `<span class="n">✗</span>` : `<span class="u">?</span>`}<span>${esc(y.name)}</span>${y.ok === false ? `<small style="color:var(--warn)">${esc(adTr("n'existe pas pour cette version : pas copié", "doesn't exist for that version: not copied"))}</small>` : y.ok == null ? `<small style="color:var(--muted)">${esc(y.source === "cf" ? adTr("CurseForge : à re-télécharger pour cette version", "CurseForge: download again for that version") : adTr("mod perso : pas copié", "custom mod: not copied"))}</small>` : ""}</div>`;
      return `<div class="ad-dlg"><div role="dialog" aria-modal="true">
        <h3>${esc(adTr(`Créer une copie de « ${c.name} » en ${t} ?`, `Make a copy of “${c.name}” on ${t}?`))}</h3>
        <p>${esc(adTr(`Ton pack en ${adTarget(c.l, c.mc)} et ses mondes ne bougent pas. Une nouvelle installation « ${c.name} (${mc}) » est créée à côté.`, `Your pack on ${adTarget(c.l, c.mc)} and its worlds stay as they are. A new installation “${c.name} (${mc})” is created next to it.`))}</p>
        ${!mods ? `<p>${esc(adTr("Vérification de tes mods…", "Checking your mods…"))}</p>` : mods.length ? `<p>${esc(adTr("Tes mods dans cette version :", "Your mods on that version:"))}</p><div class="ad-chk">${mods.map(row).join("")}</div>` : `<p>${esc(adTr("Ton pack n'a pas encore de mods : rien à vérifier.", "Your pack has no mods yet: nothing to check."))}</p>`}
        ${S.sw.err ? `<p style="color:var(--warn)">${esc(S.sw.err)}</p>` : ""}
        ${x ? `<p>${esc(adTr(`« ${x.name} » est ajouté dans la copie.`, `“${x.name}” is added to the copy.`))}</p>` : ""}
        ${far ? `<div class="ad-hint" style="margin-bottom:8px"><span>⚠</span><div>${esc(adTr("Version éloignée : tes mondes moddés risquent de ne pas suivre. Garde-les dans l'ancienne installation.", "Distant version: your modded worlds may not follow. Keep them in the old installation."))}</div></div>` : ""}
        <div class="acts"><button type="button" class="ad-btn sec" data-ad-swno>${esc(adTr("Annuler", "Cancel"))}</button>
          <button type="button" class="ad-btn" data-ad-swok ${mods ? "" : "disabled"}>${esc(lost.length ? adTr(`Créer la copie (${lost.length} mod${lost.length > 1 ? "s" : ""} en moins)`, `Make the copy (${lost.length} mod${lost.length > 1 ? "s" : ""} fewer)`) : adTr("Créer la copie", "Make the copy"))}</button></div>
      </div></div>`;
    }
    // Un élément choisi → l'entrée de « myPack.create / add » (Modrinth : la version est choisie par le launcher).
    const modEntry = (x, l, mc) => {
      if (x.src === "mr") return { slug: x.slug || x.id, source: "mr", version: null, name: x.name };
      const f = adCfFile(x, l, mc);
      return { source: "cf", slug: `cf-${x.id}`, projectId: Number(x.id), fileId: f?.fileId || null, fileName: f?.fileName || null, pageUrl: f?.fileId && x.page ? `${x.page.replace(/\/+$/, "")}/files/${f.fileId}` : x.filePage || x.page || null, name: x.name };
    };
    async function createPack(l, mc, extra = [], { name, copyOf = null } = {}) {
      const mods = [...extra];
      const r = await api.myPack.create({ name: name || S.name || adTr("Mon pack", "My pack"), minecraftVersion: mc, loader: l, mods, omni: S.omni && on("omniPack") });
      if (!r?.ok) {
        toast(T("mpErr", { e: r?.error || "?" }));
        return null;
      }
      toast(copyOf ? adTr(`Copie « ${r.name} » créée. Ton pack d'origine n'a pas bougé.`, `Copy “${r.name}” created. Your original pack did not change.`) : T("mpCreated", { n: r.name || name }));
      // RAM : la copie garde le réglage du pack d'origine ; un nouveau pack prend celui de la pastille.
      const ram = copyOf ? rmStOf(copyOf) : S.ram;
      if (r.version?.id && ram && ram.mode !== "auto") await rmSave(r.version.id, ram);
      await refresh();
      adClose();
      if (r.version?.id) openPackPage(r.version.id);
      return r;
    }

    // --- Ajouter un élément (page d'un pack) -------------------------------------------------------
    async function addItem(x, btn) {
      const c = S.ctx;
      const key = adKey(x);
      if (btn) btn.disabled = true;
      let r;
      const cfFile = x.src === "cf" ? adCfFile(x, c.l, c.mc) : null;
      const cfSlug = cfFile ? `cf-${x.id}-${cfFile.fileId}` : x.fileId ? `cf-${x.id}-${x.fileId}` : null;
      if (S.kind === "mods") {
        const entry = modEntry(x, c.l, c.mc);
        r = await api.myPack.add(c.id, [entry]);
        if (r?.ok) {
          S.added.set(key, { modId: x.src === "mr" ? x.slug : `cf-${x.id}`, name: x.name, cfWait: x.src === "cf" });
          S.last = { key, modId: S.added.get(key).modId, name: x.name };
          toast(x.src === "cf" ? adTr(`« ${x.name} » ajouté : télécharge-le sur sa page (bouton « Ouvrir la page »).`, `“${x.name}” added: download it from its page (“Open the page” button).`) : adTr(`« ${x.name} » ajouté (et ce dont il a besoin).`, `“${x.name}” added (and what it needs).`));
          if (x.src === "cf") S.sel = key;
        }
      } else if (x.src === "cf" && (x.blocked || !cfSlug)) {
        // Réservé à l'appli CurseForge : sa page, puis le launcher le trouve dans Téléchargements.
        if (!cfSlug) {
          api.addMenu.openLink(x.page);
          if (btn) btn.disabled = false;
          return;
        }
        toast(adTr("Sur la page CurseForge, clique « Download » sous le nom du fichier : le launcher l'installe dès qu'il arrive dans Téléchargements.", "On the CurseForge page, click “Download” under the file name: the launcher installs it as soon as it lands in Downloads."));
        r = await api.myPack.watchCfContent(c.id, { kind: S.kind, slug: cfSlug, url: x.filePage || x.page });
        if (r?.ok && !r.found) {
          toast(adTr("Fichier pas trouvé dans Téléchargements. Réessaie, ou « Importer un fichier .zip ».", "File not found in Downloads. Try again, or “Import a .zip file”."));
          if (btn) btn.disabled = false;
          return;
        }
      } else {
        const how = x.src === "cf" ? { from: "cf", slug: cfSlug } : { from: "mr", slug: x.slug || x.id };
        r = S.kind === "w" ? await api.myPack.addMap(c.id, how) : S.kind === "dp" ? await api.myPack.addDatapack(c.id, how) : await api.myPack.addContent(c.id, { kind: S.kind, ...how });
      }
      if (!r?.ok) {
        if (btn) btn.disabled = false;
        packErr(r);
        return;
      }
      if (S.kind !== "mods") {
        S.added.set(key, { name: x.name, worldKey: S.kind === "w" ? r.key : null });
        S.last = null;
        toast(S.kind === "w" ? adTr(`Monde « ${r.name || x.name} » ajouté (une sauvegarde est faite).`, `World “${r.name || x.name}” added (a backup is made).`) : pkT("dpAdded", { n: r.name || x.name }));
      }
      draw();
      await refresh();
      if (packPage?.id === c.id) reloadPack();
      // Après un data pack : « Où l'appliquer ? » ; un shader en vanilla : passer en version modée.
      if (S.kind === "dp" && r.file) {
        adClose();
        return openDpWorlds(r.file, true);
      }
      if (S.kind === "sh" && p.vanilla && on("vanillaModded")) {
        adClose();
        return openSwitchModded("sh", r.name, r.file);
      }
    }

    // --- Événements --------------------------------------------------------------------------------
    let typing = null;
    win.addEventListener("input", (e) => {
      if (e.target.matches("[data-ad-name]")) return void (S.name = e.target.value);
      if (!e.target.matches("[data-ad-q]")) return;
      S.q = e.target.value;
      clearTimeout(typing);
      typing = setTimeout(load, 350);
    });
    win.addEventListener("change", (e) => {
      if (e.target.matches("[data-ad-freel]")) S.freeL = e.target.value;
      else if (e.target.matches("[data-ad-bl]")) S.bl = e.target.value;
      else if (e.target.matches("[data-ad-bv]")) S.bv = e.target.value;
      else return;
      S.pickUser = false;
      load();
    });
    win.addEventListener("click", async (e) => {
      const t = e.target.closest("button, [data-ad-sel], td[data-ad-cell]");
      if (!t || !win.contains(t)) return;
      const g = (k) => t.getAttribute(k);
      if (t.hasAttribute("data-ad-x")) return adClose();
      if (t.hasAttribute("data-ad-ram")) return adRamDialog();
      if (t.hasAttribute("data-ad-swno")) {
        S.sw = null;
        return draw();
      }
      if (t.hasAttribute("data-ad-swok")) {
        const [l, mc, key] = S.sw.target;
        const x = key ? find(key) : null;
        t.disabled = true;
        const keep = (S.sw.mods || []).filter((y) => y.ok === true).map((y) => ({ slug: y.projectId || y.id, source: "mr", version: null, name: y.name }));
        const cf = (S.sw.mods || []).filter((y) => y.source === "cf" && y.cf?.projectId).map((y) => ({ source: "cf", slug: `cf-${y.cf.projectId}`, projectId: y.cf.projectId, fileId: null, fileName: null, pageUrl: null, name: y.name }));
        const r = await createPack(l, mc, [...keep, ...cf, ...(x ? [modEntry(x, l, mc)] : [])], { name: `${S.ctx.name} (${mc})`, copyOf: S.ctx.id });
        if (!r && document.body.contains(m.ov)) {
          S.sw = null;
          draw();
        }
        return;
      }
      if (g("data-ad-kind")) {
        S.kind = g("data-ad-kind");
        S.sel = null;
        S.src = "all";
        S.items = [];
        return load();
      }
      if (g("data-ad-src")) {
        S.src = g("data-ad-src");
        return load();
      }
      if (t.hasAttribute("data-ad-only")) {
        S.only = !S.only;
        return draw();
      }
      if (t.hasAttribute("data-ad-shld")) {
        adClose();
        return openShaderLoader();
      }
      if (g("data-ad-link")) return api.addMenu.openLink(g("data-ad-link"));
      if (g("data-ad-play")) {
        adClose();
        return launch({ versionId: S.ctx.id, worldKey: g("data-ad-play") }, null);
      }
      if (g("data-ad-cfopen")) {
        const a = S.added.get(g("data-ad-cfopen"));
        if (!a) return;
        t.disabled = true;
        t.textContent = adTr("⏳ En attente du fichier…", "⏳ Waiting for the file…");
        const r = await api.myPack.openCurseForge({ packId: S.ctx.id, modId: a.modId });
        if (r?.ok && r.found) {
          a.cfWait = false;
          toast(pkT("cfFoundToast", { m: r.name || a.name }));
          if (packPage?.id === S.ctx.id) reloadPack();
        } else if (r?.ok === false) packErr(r);
        else toast(adTr("Fichier pas trouvé dans Téléchargements. Réessaie « Ouvrir la page ».", "File not found in Downloads. Try “Open the page” again."));
        return draw();
      }
      if (t.hasAttribute("data-ad-undo")) {
        const last = S.last;
        if (!last) return;
        t.disabled = true;
        const r = await api.myPack.remove(S.ctx.id, { kind: "mod", key: last.modId });
        if (!r?.ok) return packErr(r);
        S.added.delete(last.key);
        S.last = null;
        toast(adTr(`Ajout de « ${last.name} » annulé.`, `Adding “${last.name}” undone.`));
        if (packPage?.id === S.ctx.id) reloadPack();
        return draw();
      }
      if (t.hasAttribute("data-ad-jar")) {
        const r = await api.myPack.addJar(S.ctx.id, {});
        if (r?.cancelled) return;
        if (!r?.ok) return packErr(r);
        toast(pkT("wzJarDone"));
        if (packPage?.id === S.ctx.id) reloadPack();
        return;
      }
      if (t.hasAttribute("data-ad-file")) {
        const c = S.ctx;
        const r = S.kind === "w" ? await api.myPack.importMap(c.id) : S.kind === "dp" ? await api.myPack.addDatapack(c.id, { from: "file" }) : await api.myPack.addContent(c.id, { kind: S.kind, from: "file" });
        if (r?.cancelled) return;
        if (!r?.ok) return packErr(r);
        toast(S.kind === "w" ? adTr(`Monde « ${r.name} » ajouté (une sauvegarde est faite).`, `World “${r.name}” added (a backup is made).`) : pkT("dpAdded", { n: r.name }));
        await refresh();
        if (packPage?.id === c.id) reloadPack();
        if (S.kind === "dp" && r.file) {
          adClose();
          return openDpWorlds(r.file, true);
        }
        if (S.kind === "sh" && p.vanilla && on("vanillaModded")) {
          adClose();
          return openSwitchModded("sh", r.name, r.file);
        }
        return;
      }
      if (g("data-ad-pick")) {
        S.pick = g("data-ad-pick");
        S.pickUser = true;
        return draw();
      }
      if (g("data-ad-create") != null) {
        const [l, mc] = g("data-ad-create").split("|");
        if (!l || !mc) return;
        t.disabled = true;
        const mods = [...S.free.values()].filter((x) => S.mode === "ver" || adOk(x, l, mc)).map((x) => modEntry(x, l, mc));
        const r = await createPack(l, mc, mods, { name: S.name });
        if (!r && document.body.contains(m.ov)) t.disabled = false;
        return;
      }
      if (g("data-ad-switch")) {
        const target = g("data-ad-switch").split("|");
        const [l, mc] = target;
        S.sw = { target: [l, mc, target.slice(2).join("|")], mods: null };
        draw();
        const r = await api.addMenu.copyCheck(S.ctx.id, { mc, loader: l });
        if (!S.sw) return;
        if (!r?.ok) S.sw.err = r?.error || "?";
        S.sw.mods = r?.mods || [];
        return draw();
      }
      if (g("data-ad-newinst")) {
        const [l, mc, ...rest] = g("data-ad-newinst").split("|");
        const x = find(rest.join("|"));
        if (!x) return;
        t.disabled = true;
        const r = await createPack(l, mc, [modEntry(x, l, mc)], { name: x.name });
        if (!r && document.body.contains(m.ov)) t.disabled = false;
        return;
      }
      if (g("data-ad-pbgo")) {
        const x = find(g("data-ad-pbgo"));
        if (!x) return;
        adClose();
        return pbInstall(x, "", null);
      }
      if (t.matches("td[data-ad-cell]")) {
        const x = S.sel && find(S.sel);
        if (!x) return;
        const [l, mc] = g("data-ad-cell").split("|");
        if (S.mode === "browse") {
          if (x.src === "cf") return toast(adTr("Depuis CurseForge, seule la dernière version s'installe : « Installer la dernière version ».", "From CurseForge, only the latest version installs: “Install the latest version”."));
          const v = (x.sheet?.versions || []).find((y) => y.mc === mc && y.loader === l);
          if (!v) return;
          adClose();
          return pbInstall(x, v.id, null);
        }
        if (S.mode === "free") {
          if (!l) return;
          S.pick = `${l}|${mc}`;
          S.pickUser = true;
          if (!S.free.has(S.sel)) S.free.set(S.sel, x);
          return draw();
        }
        if (S.mode === "add" && S.kind === "mods" && l && (l !== S.ctx.l || mc !== S.ctx.mc)) {
          S.sw = { target: [l, mc, S.sel], mods: null };
          draw();
          const r = await api.addMenu.copyCheck(S.ctx.id, { mc, loader: l });
          if (!S.sw) return;
          if (!r?.ok) S.sw.err = r?.error || "?";
          S.sw.mods = r?.mods || [];
          return draw();
        }
        return;
      }
      if (g("data-ad-add")) {
        const x = find(g("data-ad-add"));
        if (!x) return;
        if (S.mode === "free" || S.mode === "ver") {
          S.free.set(adKey(x), x);
          if (S.mode === "free") loadSheet(x);
          return draw();
        }
        return addItem(x, t);
      }
      if (g("data-ad-rm")) {
        const key = g("data-ad-rm");
        if (S.mode === "free" || S.mode === "ver") {
          S.free.delete(key);
          return draw();
        }
        return toast(S.kind === "mods" ? adTr("Il est dans ton pack : retire-le depuis l'onglet Mods.", "It is in your pack: remove it from the Mods tab.") : adTr("Il est dans ton installation : retire-le depuis son onglet.", "It is in your installation: remove it from its tab."));
      }
      if (g("data-ad-sel")) {
        S.sel = g("data-ad-sel");
        return draw();
      }
    });
    m.ov.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && S.sw) {
        e.stopPropagation();
        S.sw = null;
        draw();
      }
    }, true);
    if (S.mode === "browse") {
      const so = await api.packBrowse.sources().catch(() => null);
      mpSrcs = mpSrcs.filter((k) => so?.[k]);
      if (!mpSrcs.length) {
        m.close();
        return showModal({ title: adTr("Parcourir les modpacks", "Browse modpacks"), body: adTr("Les packs existants sont coupés pour le moment.", "Existing packs are turned off for now."), confirmLabel: "OK", tone: "warn" });
      }
      if (!data.mcVersions) {
        const vr = await api.mcVersions().catch(() => null);
        if (vr?.ok) data.mcVersions = vr.versions;
      }
    }
    draw();
    load();
    win.querySelector("[data-ad-q]")?.focus();
  }
  // « Créer » avec « Mon pack » : par quoi tu commences (mods d'abord, ou version d'abord).
  async function openCreateChooser(pre = {}) {
    if (!data.mcVersions) {
      const vr = await api.mcVersions().catch(() => null);
      if (vr?.ok) data.mcVersions = vr.versions;
    }
    const MIN = { forge: "1.7.10", neoforge: "1.20.2", fabric: "1.14", quilt: "1.14" };
    const versFor = (l) => (data.mcVersions || []).filter((v) => v.type === "release" && adCmp(v.id, MIN[l]) >= 0).map((v) => v.id);
    let l = AD_LOADERS.includes(pre.loader) ? pre.loader : "fabric";
    // Version déjà choisie (ex. 1.12.2, trop vieille pour Fabric) : on change de chargeur, pas de version.
    if (pre.minecraftVersion && !versFor(l).includes(pre.minecraftVersion)) l = AD_LOADERS.find((k) => versFor(k).includes(pre.minecraftVersion)) || l;
    let mc = pre.minecraftVersion && versFor(l).includes(pre.minecraftVersion) ? pre.minecraftVersion : versFor(l)[0] || "1.21.1";
    const m = overlay(`<div class="ad-win" role="dialog" aria-modal="true" aria-labelledby="adc-t" style="height:auto;width:min(640px,calc(100vw - 40px))"></div>`, { className: "play-modal ad-ovl" });
    const win = m.$(".ad-win");
    const draw = () => {
      win.innerHTML = `<div class="ad-head"><h3 id="adc-t">${esc(adTr("Créer un pack", "Create a pack"))}</h3><button type="button" class="ad-x" data-x aria-label="${esc(adTr("Fermer", "Close"))}">×</button></div>
        <div style="padding:0 18px 18px"><p style="margin:0 0 6px;color:var(--muted)">${esc(adTr("Par quoi tu commences ?", "Where do you start?"))}</p>
        <div class="ad-cards">
          <button type="button" class="ad-card" data-start="free"><em>${esc(adTr("CONSEILLÉ SI TU SAIS QUELS MODS TU VEUX", "BEST IF YOU KNOW WHICH MODS YOU WANT"))}</em><b>${esc(adTr("Je choisis mes mods d'abord", "I pick my mods first"))}</b><span>${esc(adTr("Tu cherches dans tous les mods, toutes versions. Le launcher te dit ensuite la version où ils marchent tous.", "You search every mod, every version. The launcher then tells you the version where they all work."))}</span></button>
          <div class="ad-card" style="cursor:default"><em>${esc(adTr("COMME AVANT", "AS BEFORE"))}</em><b>${esc(adTr("Je choisis la version d'abord", "I pick the version first"))}</b><span>${esc(adTr("Tu choisis Minecraft et le chargeur, puis tu ne vois que les mods qui marchent avec.", "You pick Minecraft and the loader, then you only see mods that work with it."))}</span>
            <span style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap"><select class="ad-sel" data-cl>${AD_LOADERS.map((k) => `<option value="${k}"${k === l ? " selected" : ""}>${esc(adLname(k))}</option>`).join("")}</select><select class="ad-sel" data-cv>${versFor(l).map((v) => `<option${v === mc ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></span>
            <button type="button" class="ad-btn" data-start="ver" style="align-self:flex-start;margin-top:6px">${esc(adTr("Continuer", "Continue"))}</button></div>
        </div></div>`;
    };
    draw();
    win.addEventListener("change", (e) => {
      if (e.target.matches("[data-cl]")) {
        l = e.target.value;
        if (!versFor(l).includes(mc)) mc = versFor(l)[0] || mc;
        draw();
      } else if (e.target.matches("[data-cv]")) mc = e.target.value;
    });
    win.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      const b = e.target.closest("[data-start]");
      if (!b) return;
      m.close();
      if (b.dataset.start === "free") return openAddWin({ mode: "free", name: pre.name, omni: pre.omni });
      return openAddWin({ mode: "ver", loader: l, mc, name: pre.name, omni: pre.omni });
    });
  }

  // --- RAM par pack (01/11, preview validée par Rushi, Laboratoire « packRam ») -----------------
  // Chaque installation a sa RAM : automatique (calculée), comme dans Paramètres, ou choisie. Même
  // formule que packRam.js (main) : mods ≤40 → 4 Go, ≤120 → 6, ≤220 → 8, sinon 10 ; +1 avec
  // shaders ; au moins la RAM conseillée par le fichier du pack ; jamais plus que le maximum sûr
  // du PC (4 Go laissés à Windows, 3/4 du PC au plus). Le bloc est replié par défaut (Rushi 01/11).
  const rmTr = (f, e) => (L() === "fr" ? f : e);
  const rmCmp = (a, b) => String(a || "").localeCompare(String(b || ""), "en", { numeric: true });
  let rmSys = { totalGB: 8, settingsGB: 4 };
  const rmLoadSys = () =>
    window.mchub.settings
      .get()
      .then((s) => {
        if (s) rmSys = { totalGB: Number(s.totalGB) || rmSys.totalGB, settingsGB: Number(s.memoryMaxGB) || rmSys.settingsGB };
        return rmSys;
      })
      .catch(() => rmSys);
  rmLoadSys();
  function rmNeed(c) {
    let n = !c.mods ? (rmCmp(c.mc, "1.18") >= 0 ? 3 : 2) : c.mods <= 40 ? 4 : c.mods <= 120 ? 6 : c.mods <= 220 ? 8 : 10;
    if (c.shaders) n += 1;
    if (c.packGB) n = Math.max(n, Math.min(32, c.packGB));
    return n;
  }
  const rmSafe = () => Math.max(2, Math.min(rmSys.totalGB - 4, Math.floor(rmSys.totalGB * 0.75)));
  const rmAuto = (c) => Math.max(1, Math.min(rmNeed(c), rmSafe()));
  const rmValue = (st, c) => (st.mode === "global" ? rmSys.settingsGB : st.mode === "custom" ? st.gb : rmAuto(c));
  const rmGo = (n) => `${n} ${rmTr("Go", "GB")}`;
  const rmModeName = (m) => (m === "global" ? rmTr("comme Paramètres", "same as Settings") : m === "custom" ? rmTr("choisie", "custom") : rmTr("automatique", "automatic"));
  function rmVerdict(v, c) {
    const n = rmNeed(c), pc = rmSys.totalGB;
    if (v > pc - 3) return ["bad", rmTr(`Trop haut : il ne resterait que ${Math.max(0, pc - v)} Go pour Windows et tes autres programmes. Le PC risque de ramer, ou Windows de fermer le jeu.`, `Too high: only ${Math.max(0, pc - v)} GB would be left for Windows and your other programs. The PC may lag, or Windows may close the game.`)];
    if (v < n) return [v <= n - 2 ? "bad" : "warn", rmTr(`Trop bas pour ce pack (il lui faut environ ${n} Go) : le jeu risque de geler au chargement ou de planter avec « Out of memory ».`, `Too low for this pack (it needs about ${n} GB): the game may freeze while loading or crash with “Out of memory”.`)];
    if (v >= n + 6 && v >= 12) return ["info", rmTr(`Plus n'est pas mieux : au-delà d'environ ${n} Go, ce pack n'en profite pas et Java fait des pauses plus longues (petites saccades).`, `More is not better: above about ${n} GB this pack gains nothing and Java makes longer pauses (small stutters).`)];
    return ["ok", rmTr("Bonne valeur pour ce pack.", "Good value for this pack.")];
  }
  // Contexte d'une installation déjà créée (liste des versions + page du pack si ouverte).
  function rmCtxOf(id) {
    const v = data.versions.find((x) => x.id === id) || {};
    const p = packPage?.id === id ? packPage.p : null;
    const mods = p ? (p.vanilla ? 0 : p.mods.filter((m) => m.on !== false).length) : v.pack ? v.modCount || 0 : 0;
    const shaders = !!(p && (p.iris || p.mods.some((m) => m.on !== false && /\b(iris|oculus)\b/i.test(`${m.name} ${m.id}`))));
    return { mods, mc: v.minecraftVersion || p?.minecraftVersion || "", shaders, packGB: v.ram?.packGB || null };
  }
  const rmStOf = (id) => {
    const r = data.versions.find((x) => x.id === id)?.ram;
    return { mode: ["auto", "global", "custom"].includes(r?.mode) ? r.mode : "auto", gb: Number(r?.gb) || 0 };
  };
  const RM_CSS = `<style>.rm-box{margin-top:12px;padding:12px;border-radius:var(--radius-m);border:1px solid var(--border);background:var(--surface-raised);text-align:left}
    .rm-box.fold{padding:9px 12px}.rm-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}.rm-head b{font-size:14px}.rm-head .rm-pc{margin-left:auto;font-size:11.5px;color:var(--muted)}
    .rm-tog{width:100%;margin:0;padding:2px 0;border:0;background:transparent;color:var(--foreground);font:inherit;text-align:left;cursor:pointer}.rm-tog .rm-sum{margin-left:auto;font-size:12.5px;font-weight:600}
    .rm-sum.warn{color:var(--warn)}.rm-sum.bad{color:var(--danger)}.rm-chev{color:var(--muted);font-size:12px;width:14px;text-align:center}
    .rm-why{margin:0 0 8px;font-size:12px;color:var(--muted);line-height:1.45}.rm-opts{display:flex;flex-direction:column;gap:6px}.rm-opts .play-row{align-items:flex-start}.rm-opts .play-row input{margin-top:3px}
    .rm-opts .play-row .t b{font-weight:600}.rm-opts .play-row .sz{white-space:nowrap;font-weight:700;color:var(--foreground)}
    .rm-tag{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:6px;font-size:10.5px;font-weight:700;background:color-mix(in srgb,var(--success) 18%,transparent);color:var(--success);vertical-align:1px}
    .rm-slide{display:flex;align-items:center;gap:10px;margin:10px 2px 2px}.rm-slide input{flex:1;accent-color:var(--accent)}.rm-slide output{min-width:58px;text-align:right;font-weight:700;font-size:15px}
    .rm-step{width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--foreground);font:inherit;font-size:16px;cursor:pointer}
    .rm-gauge{height:8px;border-radius:99px;margin:12px 2px 4px;display:flex;overflow:hidden}.rm-gauge i{display:block;height:100%}
    .rm-gauge .lo{background:color-mix(in srgb,var(--warn) 55%,transparent)}.rm-gauge .ok{background:color-mix(in srgb,var(--success) 60%,transparent)}.rm-gauge .hi{background:color-mix(in srgb,var(--danger) 60%,transparent)}
    .rm-mark{position:relative;height:0;margin:0 2px}.rm-mark span{position:absolute;top:-15px;width:4px;height:14px;border-radius:2px;background:var(--foreground);transform:translateX(-2px);box-shadow:0 0 0 2px var(--surface-raised)}
    .rm-scale{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin:6px 2px 0}
    .rm-msg{margin:10px 0 0;padding:8px 10px;border-radius:8px;font-size:12.5px;line-height:1.45;display:flex;gap:8px}
    .rm-msg.ok{background:color-mix(in srgb,var(--success) 12%,transparent)}.rm-msg.info{background:color-mix(in srgb,var(--accent) 12%,transparent)}.rm-msg.warn{background:color-mix(in srgb,var(--warn) 16%,transparent)}.rm-msg.bad{background:color-mix(in srgb,var(--danger) 16%,transparent)}
    .rm-note{margin:8px 0 0;font-size:11.5px;color:var(--muted);line-height:1.45}.rm-pill.warn{border-color:var(--warn)!important}.rm-pill.bad{border-color:var(--danger)!important}</style>`;
  if (!document.getElementById("rm-css")) {
    const el = document.createElement("div");
    el.id = "rm-css";
    el.hidden = true;
    el.innerHTML = RM_CSS;
    document.head.appendChild(el.firstElementChild);
  }
  const RM_ICON = { ok: "✓", info: "ℹ", warn: "⚠", bad: "⛔" };
  function rmBlockHtml(st, c, { note = true } = {}) {
    const n = rmNeed(c), a = rmAuto(c), v = rmValue(st, c), pc = rmSys.totalGB;
    const [tone, msg] = rmVerdict(v, c);
    if (st.fold && !st.open) {
      return `<button type="button" class="rm-head rm-tog" data-rm-tog aria-expanded="false"><b>🧠 ${esc(rmTr("Mémoire (RAM)", "Memory (RAM)"))}</b><span class="rm-sum ${tone}">${esc(`${rmGo(v)} · ${rmModeName(st.mode)}`)}${tone === "warn" || tone === "bad" ? esc(` · ⚠ ${tone === "bad" ? rmTr("à vérifier", "check it") : rmTr("un peu juste", "a bit low")}`) : ""}</span><span class="rm-chev">▾</span></button>`;
    }
    const why = [c.mods ? `${c.mods} mods` : rmTr("sans mods", "no mods"), c.mc && `Minecraft ${c.mc}`, c.shaders && "shaders", c.packGB && rmTr(`le pack conseille ${c.packGB} Go`, `the pack suggests ${c.packGB} GB`), rmTr(`ton PC a ${pc} Go`, `your PC has ${pc} GB`)].filter(Boolean).join(" · ");
    const small = n > rmSafe() ? rmTr(`Ton PC a ${pc} Go : ce pack en demande ${n}. On met ${a} Go, le maximum sûr. Ferme Chrome et Discord avant de jouer ; le pack peut rester lent.`, `Your PC has ${pc} GB: this pack needs ${n}. We use ${a} GB, the safe maximum. Close Chrome and Discord before playing; the pack may stay slow.`) : null;
    const lo = Math.min(n, pc), hi = Math.max(lo, pc - 3), noGreen = n > pc - 3;
    const pct = (x) => `${(Math.max(0, Math.min(x, pc)) / pc) * 100}%`;
    const row = (mode, title, sub, val, tag) => `<label class="play-row"><input type="radio" name="rm-${st.id}" value="${mode}" ${st.mode === mode ? "checked" : ""}><span class="t"><b>${esc(title)}${tag ? `<span class="rm-tag">${esc(tag)}</span>` : ""}</b><small>${esc(sub)}</small></span><span class="sz">${esc(val)}</span></label>`;
    const head = st.fold
      ? `<button type="button" class="rm-head rm-tog" data-rm-tog aria-expanded="true"><b>🧠 ${esc(rmTr("Mémoire (RAM)", "Memory (RAM)"))}</b><span class="rm-sum ${tone}">${esc(`${rmGo(v)} · ${rmModeName(st.mode)}`)}</span><span class="rm-chev">▴</span></button>`
      : `<div class="rm-head"><b>🧠 ${esc(rmTr("Mémoire (RAM) de ce pack", "Memory (RAM) for this pack"))}</b><span class="rm-pc">${esc(rmTr(`PC : ${pc} Go`, `PC: ${pc} GB`))}</span></div>`;
    return `${head}<p class="rm-why">${esc(rmTr("Calculée pour : ", "Worked out from: "))}${esc(why)}</p>
      <div class="rm-opts">
        ${row("auto", rmTr("Automatique", "Automatic"), rmTr("Le launcher la recalcule si tu ajoutes ou retires des mods.", "The launcher works it out again when you add or remove mods."), rmGo(a), rmTr("conseillé", "recommended"))}
        ${row("global", rmTr("Comme dans Paramètres", "Same as Settings"), rmTr("La valeur de Paramètres › Mémoire, pour tous les jeux.", "The value in Settings › Memory, for every game."), rmGo(rmSys.settingsGB))}
        ${row("custom", rmTr("Je choisis", "I choose"), rmTr("Une valeur fixe rien que pour ce pack.", "A fixed value just for this pack."), st.mode === "custom" ? rmGo(st.gb) : "…")}
      </div>
      ${st.mode === "custom" ? `<div class="rm-slide"><button type="button" class="rm-step" data-rm-step="-1" aria-label="${esc(rmTr("Moins", "Less"))}">−</button><input type="range" min="1" max="${pc}" step="1" value="${st.gb}" data-rm-range aria-label="${esc(rmTr("RAM en Go", "RAM in GB"))}"><button type="button" class="rm-step" data-rm-step="1" aria-label="${esc(rmTr("Plus", "More"))}">+</button><output>${esc(rmGo(st.gb))}</output></div>` : ""}
      <div class="rm-gauge" aria-hidden="true"><i class="lo" style="width:${pct(lo)}"></i><i class="ok" style="width:${noGreen ? "0%" : pct(hi - lo)}"></i><i class="hi" style="width:${pct(pc - (noGreen ? lo : hi))}"></i></div>
      <div class="rm-mark" aria-hidden="true"><span style="left:${pct(v)}"></span></div>
      <div class="rm-scale"><span>1 ${rmTr("Go", "GB")}</span><span>${esc(noGreen ? rmTr("pas de zone verte : PC trop juste pour ce pack", "no green range: PC too small for this pack") : rmTr(`vert = bonne zone (${lo} à ${hi} Go)`, `green = good range (${lo} to ${hi} GB)`))}</span><span>${esc(rmGo(pc))}</span></div>
      ${small ? `<p class="rm-msg warn"><span>⚠</span><span>${esc(small)}</span></p>` : ""}
      ${small && st.mode === "auto" ? "" : `<p class="rm-msg ${tone}"><span>${RM_ICON[tone]}</span><span>${esc(`${rmGo(v)} : ${msg}`)}</span></p>`}
      ${note ? `<p class="rm-note">${esc(rmTr("Ce réglage passe avant celui de Paramètres › Mémoire, pour ce pack seulement. Tu pourras le changer plus tard dans ⚙ › Mémoire (RAM). Les copies gardent ce réglage. Avant chaque lancement, le launcher revérifie la RAM libre du PC.", "This setting wins over Settings › Memory, for this pack only. You can change it later in ⚙ › Memory (RAM). Copies keep this setting. Before every launch, the launcher checks the PC's free RAM again."))}</p>` : ""}`;
  }
  let rmSeq = 0;
  // Monte le bloc dans `el` ; getCtx() relit le pack à chaque dessin.
  function rmMount(el, st, getCtx, opts = {}) {
    st.id = st.id || ++rmSeq;
    el.classList.add("rm-box");
    const draw = () => {
      el.classList.toggle("fold", !!st.fold && !st.open);
      el.innerHTML = rmBlockHtml(st, getCtx(), opts);
      opts.onChange?.();
    };
    el.addEventListener("change", (e) => {
      if (e.target.name !== `rm-${st.id}`) return;
      st.mode = e.target.value;
      if (st.mode === "custom" && !st.gb) st.gb = rmAuto(getCtx());
      draw();
    });
    el.addEventListener("input", (e) => {
      if (!e.target.matches("[data-rm-range]")) return;
      st.gb = Number(e.target.value);
      draw();
      el.querySelector("[data-rm-range]")?.focus();
    });
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-rm-tog]")) {
        st.open = !st.open;
        return draw();
      }
      const b = e.target.closest("[data-rm-step]");
      if (b) {
        st.gb = Math.max(1, Math.min(rmSys.totalGB, (st.gb || 1) + Number(b.dataset.rmStep)));
        draw();
      }
    });
    draw();
    return draw;
  }
  const rmSave = (id, st) => (on("packRam") && id ? api.ram.set(id, { mode: st.mode, gb: st.gb }).catch(() => null) : null);
  // Fenêtre « Mémoire (RAM) » (⚙ d'une installation, Paramètres › Mémoire, aide au crash).
  async function rmOpenDialog(id, { after } = {}) {
    await rmLoadSys();
    const st = rmStOf(id);
    const v = data.versions.find((x) => x.id === id);
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="rm-dt" style="max-width:520px;text-align:left;max-height:calc(100vh - 48px);overflow:auto;">
      <h3 id="rm-dt">🧠 ${esc(rmTr("Mémoire (RAM)", "Memory (RAM)"))}</h3><p class="join-note" style="margin:0;">${esc(v ? versionLabel(v) : "")}</p><div data-rm-slot></div>
      <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;"><button type="button" class="btn-secondary" data-x>${esc(T("cancel"))}</button><button type="button" class="join-btn" data-ok>${esc(rmTr("Enregistrer", "Save"))}</button></div></div>`);
    rmMount(m.$("[data-rm-slot]"), st, () => rmCtxOf(id));
    m.$("[data-x]").addEventListener("click", m.close);
    m.$("[data-ok]").addEventListener("click", async () => {
      const r = await rmSave(id, st);
      if (!r?.ok) return toast(r?.error || "?");
      m.close();
      toast(rmTr(`RAM réglée sur ${rmGo(rmValue(st, rmCtxOf(id)))} (${rmModeName(st.mode)}).`, `RAM set to ${rmGo(rmValue(st, rmCtxOf(id)))} (${rmModeName(st.mode)}).`));
      await refresh();
      if (packPage?.id === id) drawPackPage();
      after?.();
    });
    m.$("[data-ok]").focus();
  }
  // Avant de lancer : RAM trop basse pour le pack, ou plus haute que la RAM libre du PC.
  // Renvoie null (annulé), ou { ramGB } (null = la RAM réglée de l'installation).
  async function rmBeforeLaunch(id) {
    if (!on("packRam") || !id) return { ramGB: null };
    const info = await api.ram.info(id).catch(() => null);
    if (!info?.ok) return { ramGB: null };
    rmSys = { totalGB: info.totalGB || rmSys.totalGB, settingsGB: info.settingsGB || rmSys.settingsGB };
    const v = info.gb, n = info.needGB, free = info.freeGB;
    const low = v < n && info.ram?.mode !== "auto";
    // Windows libère sa mémoire cache au besoin : on ne prévient qu'au-delà de 1 Go de plus que le libre.
    const tooMuch = v > free + 1;
    let quiet = false;
    try {
      quiet = localStorage.getItem(`omniscient.ramQuiet.${id}`) === String(v);
    } catch {
      /* stockage local indisponible */
    }
    if ((!low && !tooMuch) || (quiet && !low)) return { ramGB: null };
    const fixV = tooMuch ? Math.max(1, Math.min(free, v)) : Math.min(info.autoGB, Math.max(free, info.autoGB));
    const body = tooMuch
      ? rmTr(`Ce pack est réglé sur ${v} Go, mais il ne reste que ${free} Go de libre en ce moment (navigateur, Discord et Windows utilisent le reste). Si tu lances quand même, le PC peut ramer ou Windows fermer le jeu.`, `This pack is set to ${v} GB, but only ${free} GB are free right now (browser, Discord and Windows use the rest). If you launch anyway, the PC may lag or Windows may close the game.`)
      : rmTr(`Ce pack a ${info.mods} mods et seulement ${v} Go de RAM. Il lui en faut environ ${n} : il risque de geler au chargement ou de planter avec « Out of memory ».`, `This pack has ${info.mods} mods and only ${v} GB of RAM. It needs about ${n}: it may freeze while loading or crash with “Out of memory”.`);
    return new Promise((resolve) => {
      const m = overlay(`<div class="modal-box pop-in tone-warn" role="dialog" aria-modal="true" aria-labelledby="rm-lt" style="max-width:520px;text-align:left;">
        <h3 id="rm-lt">⚠ ${esc(tooMuch ? rmTr("Pas assez de RAM libre", "Not enough free RAM") : rmTr("RAM trop basse pour ce pack", "RAM too low for this pack"))}</h3><p style="margin:8px 0;font-size:13.5px;line-height:1.5;">${esc(body)}</p>
        ${tooMuch ? `<label class="play-row" style="margin-top:6px;"><input type="checkbox" data-quiet><span class="t">${esc(rmTr("Ne plus prévenir pour ce pack", "Don't warn again for this pack"))}<small>${esc(rmTr(`Tant que sa RAM reste à ${v} Go.`, `As long as its RAM stays at ${v} GB.`))}</small></span></label>` : `<label class="play-row" style="margin-top:6px;"><input type="checkbox" data-keep checked><span class="t">${esc(rmTr("Garder cette valeur pour ce pack", "Keep this value for this pack"))}<small>${esc(rmTr("Sinon, seulement pour cette partie.", "Otherwise, just for this game."))}</small></span></label>`}
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;"><button type="button" class="btn-secondary" data-x>${esc(T("cancel"))}</button><button type="button" class="btn-secondary" data-any>${esc(rmTr(`Lancer avec ${v} Go quand même`, `Launch with ${v} GB anyway`))}</button><button type="button" class="join-btn" data-fix>${esc(tooMuch ? rmTr(`Lancer avec ${fixV} Go cette fois`, `Launch with ${fixV} GB this time`) : rmTr(`Passer à ${fixV} Go et lancer`, `Switch to ${fixV} GB and launch`))}</button></div></div>`);
      let done = false;
      const end = (x) => {
        if (done) return;
        done = true;
        m.close();
        resolve(x);
      };
      new MutationObserver((_, ob) => {
        if (!document.body.contains(m.ov)) {
          ob.disconnect();
          end(null);
        }
      }).observe(document.body, { childList: true });
      m.$("[data-x]").addEventListener("click", () => end(null));
      m.$("[data-any]").addEventListener("click", () => {
        if (m.$("[data-quiet]")?.checked) {
          try {
            localStorage.setItem(`omniscient.ramQuiet.${id}`, String(v));
          } catch {
            /* stockage local indisponible */
          }
        }
        end({ ramGB: null });
      });
      m.$("[data-fix]").addEventListener("click", async () => {
        if (!tooMuch && m.$("[data-keep]")?.checked) {
          await rmSave(id, fixV === info.autoGB ? { mode: "auto" } : { mode: "custom", gb: fixV });
          refresh().catch(() => {});
          return end({ ramGB: null });
        }
        end({ ramGB: fixV });
      });
      m.$("[data-fix]").focus();
    });
  }
  // Paramètres › Mémoire (renderer.js appelle ce crochet) : la RAM de chaque pack, repliée.
  let rmSetOpen = false;
  window.__omRamSettings = async (contentEl) => {
    if (!on("packRam") || !contentEl) return;
    const r = await api.ram.list().catch(() => null);
    if (!r?.ok) return;
    rmSys = { totalGB: r.totalGB || rmSys.totalGB, settingsGB: r.settingsGB || rmSys.settingsGB };
    contentEl.querySelector(".rm-set")?.remove();
    const save = contentEl.querySelector("#settings-save-memory");
    if (!save) return;
    const list = r.versions.filter((x) => x.modded || x.ram.mode !== "auto");
    const toneOf = (x) => rmVerdict(x.gb, { mods: x.mods, mc: x.minecraftVersion, packGB: x.ram.packGB || null })[0];
    const nBad = list.filter((x) => ["warn", "bad"].includes(toneOf(x))).length;
    const sec = document.createElement("section");
    sec.className = "settings-section rm-set";
    const draw = () => {
      sec.innerHTML = `<button type="button" class="rm-tog rm-head" data-rm-settog aria-expanded="${rmSetOpen}"><b class="settings-row-label">🧠 ${esc(rmTr("RAM de chaque pack", "RAM for each pack"))}</b><span class="rm-sum ${nBad ? "warn" : ""}">${esc(`${list.length} pack(s)`)}${nBad ? esc(rmTr(` · ⚠ ${nBad} à vérifier`, ` · ⚠ ${nBad} to check`)) : ""}</span><span class="rm-chev">${rmSetOpen ? "▴" : "▾"}</span></button>
        ${rmSetOpen ? `<p class="settings-row-desc">${esc(rmTr("Par défaut, chaque pack calcule sa RAM tout seul. La valeur du haut sert aux packs réglés sur « Comme dans Paramètres » et aux serveurs.", "By default, each pack works out its own RAM. The value above is used by packs set to “Same as Settings” and by servers."))}</p>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">${list.length ? list.map((x) => { const tn = toneOf(x); return `<div class="play-row" style="cursor:default;"><span class="t"><b style="font-weight:600;">${esc(x.name)}</b><small>${esc(`${x.mods} mods · ${rmModeName(x.ram.mode)}`)}</small></span><span class="sz" style="color:${tn === "bad" ? "var(--danger)" : tn === "warn" ? "var(--warn)" : "inherit"}">${esc(rmGo(x.gb))}${tn === "warn" || tn === "bad" ? " ⚠" : ""}</span><button type="button" class="btn-secondary" data-rm-edit="${esc(x.id)}" style="margin:0;padding:3px 10px;font-size:12px;">${esc(rmTr("Modifier", "Change"))}</button></div>`; }).join("") : `<p class="join-note">${esc(rmTr("Aucun pack installé.", "No pack installed."))}</p>`}</div>
        ${list.some((x) => x.ram.mode !== "auto") ? `<button type="button" class="btn-secondary" data-rm-allauto style="margin-top:8px;align-self:flex-start;">${esc(rmTr("Tout remettre en automatique", "Set all back to automatic"))}</button>` : ""}` : ""}`;
    };
    draw();
    save.before(sec);
    sec.addEventListener("click", async (e) => {
      if (e.target.closest("[data-rm-settog]")) {
        rmSetOpen = !rmSetOpen;
        return draw();
      }
      const ed = e.target.closest("[data-rm-edit]");
      if (ed) return rmOpenDialog(ed.dataset.rmEdit, { after: () => window.__omRamSettings(contentEl) });
      if (e.target.closest("[data-rm-allauto]")) {
        for (const x of list) if (x.ram.mode !== "auto") await api.ram.set(x.id, { mode: "auto" }).catch(() => null);
        toast(rmTr("Tous les packs sont en RAM automatique.", "Every pack is on automatic RAM."));
        await refresh();
        return window.__omRamSettings(contentEl);
      }
    });
  };

  // --- Page d'un pack (Mon pack ou pack officiel) -------------------------------------------------
  // Onglets Mods / Packs de ressources / Shaders / Mondes / Fichiers. Les mods ajoutés par le joueur
  // sont séparés de ceux que le launcher a ajoutés parce qu'un autre mod en a besoin. Chaque mod
  // garde la version choisie ; la vérification relit les dépendances (données de Modrinth) à chaque
  // changement et avant de jouer.
  let packPage = null;
  const PK = () => (L() === "fr" ? {
    back: "← Jouer", open: "Voir le pack", play: "Jouer", folder: "Ouvrir le dossier",
    meta: "Minecraft {v} · {l} · {n} mods · {s}", mine: "Mon pack", omni: "Pack Omniscient",
    okAll: "✓ Tout est compatible : chaque mod a ce dont il a besoin.",
    bad: "⚠ {n} problème(s) avant de jouer", fix: "Corriger", fixAll: "Tout corriger",
    needV: "{a} {av} demande {b} {min} ou plus (tu as {bv}).",
    tMods: "Mods", tRp: "Packs de ressources", tSh: "Shaders", tW: "Mondes", tDp: "Data packs", tF: "Fichiers", vanilla: "Vanilla", metaV: "Minecraft {v} · Vanilla, sans mods · {s}", dpNote: "Un data pack change les règles d'un monde (recettes, objets, fonctions, génération). Il marche monde par monde : choisis dans quels mondes l'activer. Une sauvegarde du monde est faite avant chaque changement.", dpMr: "🔍 Chercher sur Modrinth", dpFile: "📁 J'ai le fichier (.zip)", dpNone: "Aucun data pack pour l'instant.", dpIn: "Dans : {w}", dpInNone: "Dans aucun monde", dpAuto: "dans tous les mondes, même les nouveaux", dpPick: "Choisir les mondes", dpW: "Data packs", dpPT: "« {n} » : dans quels mondes ?", dpPD: "Coche les mondes où ce data pack doit marcher. Le monde est sauvegardé avant.", dpNew: "Aussi dans les nouveaux mondes de cette installation", dpNoW: "Pas encore de monde dans cette installation. Pas de souci : le data pack reste en attente. Dès que tu auras créé ton premier monde et quitté le jeu, le launcher l'y ajoute tout seul (avec une sauvegarde avant) ; il marche à la prochaine ouverture du monde. Un data pack qui change la génération du monde (ex. Terralith) doit, lui, être là à la création : crée le monde dans le jeu en l'ajoutant à l'écran « Data packs ».", dpWait: "⏳ En attente du premier monde", dpWT: "Data packs de « {n} »", dpWD: "Coche ceux qui doivent marcher dans ce monde. Le monde est sauvegardé avant chaque changement.", dpWNone: "Aucun data pack dans cette installation. Ajoute-en un :", dpSave: "Enregistrer", dpCancel: "Annuler", dpMrT: "Data packs sur Modrinth", dpFreshT: "« {n} » ajouté. Où l'appliquer ?", shLdT: "Ce shader a besoin d'un mod pour s'afficher", shLdD: "Minecraft ne lit pas les shaders tout seul. Choisis le mod qui les lance (il est ajouté au pack depuis Modrinth) :", shLdIris: "Iris + Sodium", shLdIrisD: "Le plus utilisé, rapide. Recommandé.", shLdOc: "Oculus + Embeddium", shLdOcD: "Pour Forge (Iris n'existe pas sur Forge).", shLdRec: "Recommandé", shLdNo: "Aucun mod de shaders : le shader sera ajouté mais ne s'affichera pas.", shLdGo: "Ajouter et choisir le shader", shLdOpt: "OptiFine n'est pas proposé : il n'est ni sur Modrinth ni sur CurseForge, et il marche mal avec les autres mods.", shMissing: "Aucun mod de shaders dans le pack : « + Ajouter un shader » te proposera Iris.", dpLdT: "Il faut un chargeur de data packs", dpLdD: "Pour qu'un data pack marche dans tous les mondes (même ceux créés plus tard), il faut un petit mod qui les charge partout. Choisis-en un (ajouté depuis Modrinth) :", dpLdPaxi: "Paxi", dpLdPaxiD: "Simple, charge aussi les packs de ressources. Recommandé.", dpLdGp: "Global Packs", dpLdGpD: "Alternative, mêmes fonctions.", dpVanNew: "En vanilla, un data pack ne peut pas s'ajouter tout seul aux nouveaux mondes. Crée le monde, puis ajoute-le ici. Pour un data pack qui change la génération (ex. Terralith), ajoute-le dans Minecraft : Créer un monde › Data packs.", dpAll: "Dans tous les mondes, même les nouveaux (avec {l})", wQ: "Chercher un monde…", fOpenAll: "Ouvrir le dossier de l'installation", wCf: "🌍 Trouver une map sur CurseForge ↗", wZip: "📁 Importer une map (.zip)", wCfNote: "Modrinth n'a pas de maps. Sur CurseForge, tu télécharges la map toi-même, puis « Importer une map » l'ajoute ici (une sauvegarde est faite).", wZipOk: "Map « {n} » importée dans cette installation.", dpQ: "Chercher un data pack…", acRpT: "Ajouter un pack de ressources", acShT: "Ajouter un shader", acRpQ: "Chercher un pack de ressources sur Modrinth…", acShQ: "Chercher un shader sur Modrinth…", acFile: "📁 J'ai le fichier (.zip)", acCf: "CurseForge ↗", acCfNote: "Sur CurseForge, tu télécharges toi-même, puis « J'ai le fichier ».", dpMrAdd: "+ Ajouter", dpMrDone: "✓ Ajouté", dpOk: "Data packs mis à jour (sauvegarde faite).", dpAdded: "« {n} » ajouté.",
    search: "Chercher dans le pack…", fAll: "Tous", fMine: "Ajoutés par toi", fDeps: "Nécessaires", fUp: "Mises à jour",
    add: "+ Ajouter des mods", upAll: "Tout mettre à jour", secMine: "Ajoutés par toi", secDeps: "Nécessaires à d'autres mods",
    secDepsD: "Modrinth : ajoutés tout seuls · CurseForge : c'est toi qui les télécharges",
    cfMissing: "{a} a besoin de {b} (CurseForge) : à télécharger à la main.", cfOwn: "{b} : mod du pack à télécharger à la main sur CurseForge.", cfOpen: "Ouvrir la page", cfWait: "En attente du fichier",
    cfHave: "Téléchargé par toi", cfFoundToast: "{m} trouvé dans Téléchargements et installé.",
    rpMissing: "Le pack de ressources {a} a besoin du mod {b}, absent du pack.", cardBad: "⚠ {n} problème(s)",
    needMissing: "{a} a besoin de {b}, absent du pack.", loaderBad: "{a} est un mod {l}, mais ce pack utilise {p} : retire-le ou remplace-le.",
    wzNone: "Pas trouvé tout seul. Choisis une solution :", wzNoneV: "Pas de version qui va. Choisis une solution :", wzSrMr: "Chercher sur Modrinth", wzSrCf: "Chercher sur CurseForge", wzJar: "J'ai le fichier (.jar)", wzOff: "Retirer {a}", wzVer: "Changer la version de {a}", wzSrPh: "Nom du mod…", wzSrNone: "Aucun résultat. Essaie un autre nom.", delL: "Retirer", delOk: "Oui, retirer", delNo: "Annuler", delDone: "« {n} » retiré", delModT: "Retirer « {n} » ?", delModD: "Le mod est supprimé de cette installation. Tu pourras le remettre avec « + Ajouter un mod ».", delModNeed: "Attention : {d} en {s} besoin. Il{x} ne marcher{y} plus sans lui.", delModAuto: "Les mods ajoutés seulement pour lui ({d}) sont retirés aussi.", delRpT: "Retirer le pack de ressources « {n} » ?", delRpD: "Il est supprimé de cette installation. Tes mondes ne sont pas touchés.", delShT: "Retirer le shader « {n} » ?", delShD: "Il est supprimé de cette installation. Si c'était le shader actif, le jeu repasse sans shader.", delDpT: "Retirer le data pack « {n} » ?", delDpD: "Il est retiré de {w}. Chaque monde est sauvegardé juste avant, tu peux revenir en arrière depuis ses sauvegardes.", delDpNoW: "Il n'est dans aucun monde : il est juste supprimé de la liste.", delDpAuto: "Il était dans « tous les mondes » : il est retiré de tous ces mondes.", delWT: "Retirer le monde « {n} » ?", delWD: "Le monde est retiré de ce PC. Une sauvegarde est faite juste avant : tu le retrouves dans Mes mondes › Supprimés dans Minecraft, et tu peux le restaurer.", wzSrAdd: "Ajouter", wzSrBad: "Pas pour {v}", wzSrTip: "Le jeu demande « {d} ». Si le nom ne donne rien, essaie un mot du nom.", wzOffQ: "{a} sera coupé, pas supprimé : tu pourras le rallumer dans l'onglet Mods.", wzOffGo: "Couper {a}", wzOffDone: "✓ {a} coupé", wzJarDone: "✓ Fichier ajouté", wzAdded: "✓ Ajouté", wzBack: "Fermer", wzJarOther: "Ajouté, mais {f} ne semble pas être « {d} » : vérifie avec « Corriger le pack ».", wzEnable: "Rallumer {b}, coupé dans le pack",
    wzFail: "Échec : {e}", file: "Fichier", cfApi: "CurseForge ✓", force: "Jouer quand même", readonly: "Pack de l'équipe : sa liste de mods ne se modifie pas.",
    wzT: "Corriger le pack", wzD: "Le launcher cherche d'abord sur Modrinth et corrige tout seul. Ce qui n'existe que sur CurseForge, c'est toi qui le télécharges : il le trouve ensuite dans Téléchargements.",
    wzMrVer: "Modrinth : passer {b} en {v}", wzMrAdd: "Trouvé sur Modrinth : ajouter {b} {v}", wzAlso: " (+ {d}, dont il a besoin)",
    wzCf: "Pas sur Modrinth : à télécharger à la main sur CurseForge", wzAuto: "Automatique", wzHand: "À la main",
    wzGo: "Corriger le pack", wzWorking: "Correction…", wzDoneRow: "✓ Corrigé", wzWait: "En attente du fichier", wzFound: "✓ Trouvé et vérifié",
    wzManD: "Ouvre la page, clique sur « Download » SOUS le nom du fichier, laisse-le dans Téléchargements.",
    wzVerT: "Versions de {a} pour Minecraft {v} ({l}), la plus récente en haut :", wzVerCur: "installée", wzVerNone: "Aucune autre version de {a} sur CurseForge pour cette version de Minecraft.", wzVerTip: "Une version plus ancienne de {a} peut marcher avec {b} {h}. Télécharge celle que tu veux : le launcher remplace l'ancienne.", wzVerDone: "✓ {a} changé ({f})",
    wzCfFile: "Fichier à prendre :", wzCfLook: "Recherche du bon fichier…", wzCfNoV: "Aucune version de {b} sur CurseForge ne va avec Minecraft {v} ({l}). Choisis une solution :",
    wzCfWrong: "Mauvaise version : {w}. Le launcher ne le prend pas (il reste dans Téléchargements). Sur la page, clique « Download » sous {f}.",
    wzValidate: "Valider", wzLater: "Finir plus tard", wzOk: "Pack corrigé : plus aucun problème.",
    emptyMine: "Aucun mod ajouté pour l'instant.", emptyDeps: "Aucun mod nécessaire.", noMatch: "Aucun mod ne correspond à ta recherche.",
    needs: "Nécessite : {d}", neededBy: "Nécessaire pour {d}", latest: "récente", upTo: "↑ {v}",
    lock: "Désactiver ce mod casserait : {d}", cfHand: "CurseForge ✋", mr: "Modrinth",
    rpAdd: "+ Ajouter un pack de ressources", rpNote: "Le premier de la liste passe devant les autres, comme dans Minecraft.",
    rpNeed: "Demande le mod {d}, absent du pack", shAdd: "+ Ajouter un shader", shNote: "Un seul shader actif à la fois. Ils marchent grâce à Iris, présent dans le pack ✓",
    shNone: "Aucun (désactivés)", wNote: "Les mondes qui s'ouvrent avec cette installation.", wNone: "Aucun monde n'utilise encore ce pack.",
    fNote: "Tes réglages sont gardés quand tu mets à jour un mod. Ce qui part à la Corbeille se récupère depuis la Corbeille de Windows.",
    file1: "1 fichier", fxEmptyDir: "Vide", fxLoading: "Chargement…", fxRoot: "Dossier de l'installation", fxPath: "Chemin", fxUp: "Dossier parent", fxQ: "Filtrer ce dossier…", fxMk: "Dossier", fxMkT: "Nouveau dossier", fxMkOk: "Créer", fxEmpty: "Ce dossier est vide.", fxNoMatch: "Aucun fichier ne correspond.", fxEnter: "Ouvrir", fxEdit: "Modifier", fxRead: "Lire", fxOpen: "Ouvrir", fxRen: "Renommer", fxRenT: "Renommer « {n} »", fxDel: "Mettre à la Corbeille", fxDelT: "Mettre « {n} » à la Corbeille ?", fxDelD: "Il part dans la Corbeille de Windows : tu peux le récupérer tant que tu ne la vides pas.", fxDelOk: "Mettre à la Corbeille", fxDelDone: "« {n} » est dans la Corbeille.", fxShots: "Captures d'écran", fxLog: "Dernier journal", fxCrash: "Rapports de crash", fxWin: "Ouvrir dans l'Explorateur", fxKind_text: "Texte, modifiable ici", fxKind_img: "Image", fxKind_other: "S'ouvre avec Windows", fxKind_dir: "Dossier", fxManaged: "Ce dossier se gère plus simplement dans l'onglet « {t} » (il vérifie les versions et ce dont chaque élément a besoin).", fxNoT: "Ce fichier ne s'ouvre pas dans le launcher", fxNoD: "Ouvre-le toi-même avec Windows (le programme choisi par Windows pour ce type de fichier), ou affiche-le dans l'Explorateur.", fxWhyJar: "C'est un mod (.jar) : du code Java, pas du texte. Pour l'activer, le retirer ou changer sa version, utilise l'onglet Mods.", fxWhyZip: "C'est une archive compressée. Windows sait l'ouvrir pour voir ce qu'il y a dedans.", fxWhyDat: "C'est un fichier de données Minecraft en format binaire (NBT : monde, liste de serveurs…). Le modifier à la main peut l'abîmer : utilise un éditeur comme NBTExplorer, après une sauvegarde.", fxWhyAny: "Le launcher ne sait pas afficher ce type de fichier.", fxWhyBig: "Ce fichier est trop gros pour l'éditeur du launcher (plus de 2 Mo).", fxExt: "Ouvrir avec Windows", fxShow: "Afficher dans l'Explorateur", fxClose: "Fermer", fxRo: "Lecture seule : ce fichier est écrit par le jeu.", fxBak: "Une copie de l'ancienne version (.bak) est gardée quand tu enregistres. Ctrl+S pour enregistrer.", fxCopy: "Copier tout", fxCopied: "Copié.", fxSaved: "« {n} » enregistré (ancienne version gardée en .bak).", fxDirty: "Tu as des changements non enregistrés. Clique encore sur Annuler pour les perdre.", fxNEmpty: "Donne un nom.", fxNBad: "Un nom ne peut pas contenir \\ / : * ? \" < > |", fxNTaken: "Ce nom existe déjà dans ce dossier.", fxNExt: "Tu changes l'extension : le fichier risque de ne plus être reconnu. Clique encore pour confirmer.",
    files: "{n} fichiers", fixedToast: "Corrigé : {m} passe en {v}.",
    verToast: "{m} passe en {v}.", opening: "Ouverture du pack…", fixWait: "Recherche des solutions…", checkBefore: "Avant de jouer, le launcher vérifie tout ça. S'il reste un problème, il te le dit au lieu de laisser Minecraft planter.",
  } : {
    back: "← Play", open: "See the pack", play: "Play", folder: "Open folder",
    meta: "Minecraft {v} · {l} · {n} mods · {s}", mine: "My pack", omni: "Omniscient pack",
    okAll: "✓ Everything is compatible: every mod has what it needs.",
    bad: "⚠ {n} problem(s) before playing", fix: "Fix", fixAll: "Fix all",
    needV: "{a} {av} needs {b} {min} or newer (you have {bv}).",
    tMods: "Mods", tRp: "Resource packs", tSh: "Shaders", tW: "Worlds", tDp: "Data packs", tF: "Files", vanilla: "Vanilla", metaV: "Minecraft {v} · Vanilla, no mods · {s}", dpNote: "A data pack changes a world's rules (recipes, items, functions, generation). It works world by world: choose which worlds use it. The world is backed up before every change.", dpMr: "🔍 Search Modrinth", dpFile: "📁 I have the file (.zip)", dpNone: "No data pack yet.", dpIn: "In: {w}", dpInNone: "In no world", dpAuto: "in every world, even new ones", dpPick: "Choose worlds", dpW: "Data packs", dpPT: "“{n}”: which worlds?", dpPD: "Tick the worlds where this data pack should work. The world is backed up first.", dpNew: "New worlds of this installation too", dpNoW: "No world in this installation yet. No problem: the data pack waits. As soon as you have created your first world and closed the game, the launcher adds it there (with a backup first); it works the next time you open the world. A data pack that changes world generation (e.g. Terralith) must be there at creation: add it on the game's “Data Packs” screen when creating the world.", dpWait: "⏳ Waiting for the first world", dpWT: "Data packs of “{n}”", dpWD: "Tick the ones that should work in this world. The world is backed up before every change.", dpWNone: "No data pack in this installation. Add one:", dpSave: "Save", dpCancel: "Cancel", dpMrT: "Data packs on Modrinth", dpFreshT: "“{n}” added. Where to apply it?", shLdT: "This shader needs a mod to show", shLdD: "Minecraft does not read shaders by itself. Choose the mod that runs them (added to the pack from Modrinth):", shLdIris: "Iris + Sodium", shLdIrisD: "Most used, fast. Recommended.", shLdOc: "Oculus + Embeddium", shLdOcD: "For Forge (Iris does not exist on Forge).", shLdRec: "Recommended", shLdNo: "No shader mod: the shader is added but will not show.", shLdGo: "Add and choose the shader", shLdOpt: "OptiFine is not offered: it is on neither Modrinth nor CurseForge, and works badly with other mods.", shMissing: "No shader mod in the pack: “+ Add a shader” will offer Iris.", dpLdT: "A data pack loader is needed", dpLdD: "For a data pack to work in every world (even ones made later), a small mod must load it everywhere. Pick one (added from Modrinth):", dpLdPaxi: "Paxi", dpLdPaxiD: "Simple, also loads resource packs. Recommended.", dpLdGp: "Global Packs", dpLdGpD: "Alternative, same features.", dpVanNew: "In vanilla, a data pack cannot add itself to new worlds. Create the world, then add it here. For a data pack that changes generation (e.g. Terralith), add it in Minecraft: Create world › Data packs.", dpAll: "In every world, even new ones (with {l})", wQ: "Search a world…", fOpenAll: "Open the installation folder", wCf: "🌍 Find a map on CurseForge ↗", wZip: "📁 Import a map (.zip)", wCfNote: "Modrinth has no maps. On CurseForge you download the map yourself, then “Import a map” adds it here (a backup is made).", wZipOk: "Map “{n}” imported into this installation.", dpQ: "Search a data pack…", acRpT: "Add a resource pack", acShT: "Add a shader", acRpQ: "Search a resource pack on Modrinth…", acShQ: "Search a shader on Modrinth…", acFile: "📁 I have the file (.zip)", acCf: "CurseForge ↗", acCfNote: "On CurseForge you download it yourself, then “I have the file”.", dpMrAdd: "+ Add", dpMrDone: "✓ Added", dpOk: "Data packs updated (backup made).", dpAdded: "“{n}” added.",
    search: "Search in the pack…", fAll: "All", fMine: "Added by you", fDeps: "Required", fUp: "Updates",
    add: "+ Add mods", upAll: "Update all", secMine: "Added by you", secDeps: "Required by other mods",
    secDepsD: "Modrinth: added automatically · CurseForge: you download them",
    cfMissing: "{a} needs {b} (CurseForge): download it by hand.", cfOwn: "{b}: a pack mod to download by hand from CurseForge.", cfOpen: "Open the page", cfWait: "Waiting for the file",
    cfHave: "Downloaded by you", cfFoundToast: "{m} found in Downloads and installed.",
    rpMissing: "Resource pack {a} needs the mod {b}, not in the pack.", cardBad: "⚠ {n} problem(s)",
    needMissing: "{a} needs {b}, not in the pack.", loaderBad: "{a} is a {l} mod, but this pack uses {p}: remove or replace it.",
    wzNone: "Not found by itself. Pick a fix:", wzNoneV: "No working version. Pick a fix:", wzSrMr: "Search Modrinth", wzSrCf: "Search CurseForge", wzJar: "I have the file (.jar)", wzOff: "Remove {a}", wzVer: "Change {a}'s version", wzSrPh: "Mod name…", wzSrNone: "No result. Try another name.", delL: "Remove", delOk: "Yes, remove", delNo: "Cancel", delDone: "“{n}” removed", delModT: "Remove “{n}”?", delModD: "The mod is deleted from this installation. You can add it back with “+ Add a mod”.", delModNeed: "Careful: {d} need{s} it. {x} will stop working without it.", delModAuto: "Mods added only for it ({d}) are removed too.", delRpT: "Remove the resource pack “{n}”?", delRpD: "It is deleted from this installation. Your worlds are not touched.", delShT: "Remove the shader “{n}”?", delShD: "It is deleted from this installation. If it was the active shader, the game goes back to no shader.", delDpT: "Remove the data pack “{n}”?", delDpD: "It is removed from {w}. Each world is backed up just before, so you can go back from its backups.", delDpNoW: "It is in no world: it is just deleted from the list.", delDpAuto: "It was in “all worlds”: it is removed from all of them.", delWT: "Remove the world “{n}”?", delWD: "The world is removed from this PC. A backup is made just before: you will find it in My worlds › Deleted in Minecraft, and you can restore it.", wzSrAdd: "Add", wzSrBad: "Not for {v}", wzSrTip: "The game asks for “{d}”. If the name finds nothing, try one word of it.", wzOffQ: "{a} will be turned off, not deleted: you can turn it back on in the Mods tab.", wzOffGo: "Turn off {a}", wzOffDone: "✓ {a} turned off", wzJarDone: "✓ File added", wzAdded: "✓ Added", wzBack: "Close", wzJarOther: "Added, but {f} does not look like “{d}”: check with “Fix the pack”.", wzEnable: "Turn {b} back on (off in the pack)",
    wzFail: "Failed: {e}", file: "File", cfApi: "CurseForge ✓", force: "Play anyway", readonly: "Team pack: its mod list can't be changed.",
    wzT: "Fix the pack", wzD: "The launcher looks on Modrinth first and fixes it by itself. What only exists on CurseForge, you download it: then it finds it in Downloads.",
    wzMrVer: "Modrinth: switch {b} to {v}", wzMrAdd: "Found on Modrinth: add {b} {v}", wzAlso: " (+ {d}, which it needs)",
    wzCf: "Not on Modrinth: download it by hand on CurseForge", wzAuto: "Automatic", wzHand: "By hand",
    wzGo: "Fix the pack", wzWorking: "Fixing…", wzDoneRow: "✓ Fixed", wzWait: "Waiting for the file", wzFound: "✓ Found and checked",
    wzManD: "Open the page, click “Download” UNDER the file name, leave it in Downloads.",
    wzVerT: "Versions of {a} for Minecraft {v} ({l}), newest first:", wzVerCur: "installed", wzVerNone: "No other version of {a} on CurseForge for this Minecraft version.", wzVerTip: "An older version of {a} may work with {b} {h}. Download the one you want: the launcher replaces the old one.", wzVerDone: "✓ {a} changed ({f})",
    wzCfFile: "File to get:", wzCfLook: "Looking for the right file…", wzCfNoV: "No version of {b} on CurseForge works with Minecraft {v} ({l}). Pick a fix:",
    wzCfWrong: "Wrong version: {w}. The launcher does not take it (it stays in Downloads). On the page, click “Download” under {f}.",
    wzValidate: "Done", wzLater: "Finish later", wzOk: "Pack fixed: no problem left.",
    emptyMine: "No mods added yet.", emptyDeps: "No required mods.", noMatch: "No mod matches your search.",
    needs: "Needs: {d}", neededBy: "Required by {d}", latest: "latest", upTo: "↑ {v}",
    lock: "Turning this mod off would break: {d}", cfHand: "CurseForge ✋", mr: "Modrinth",
    rpAdd: "+ Add a resource pack", rpNote: "The first one in the list wins over the others, like in Minecraft.",
    rpNeed: "Needs the mod {d}, not in the pack", shAdd: "+ Add a shader", shNote: "One shader at a time. They work thanks to Iris, in the pack ✓",
    shNone: "None (off)", wNote: "Worlds that open with this installation.", wNone: "No world uses this pack yet.",
    fNote: "Your settings are kept when you update a mod. Anything sent to the Recycle Bin can be restored from the Windows Recycle Bin.",
    file1: "1 file", fxEmptyDir: "Empty", fxLoading: "Loading…", fxRoot: "Version folder", fxPath: "Path", fxUp: "Parent folder", fxQ: "Filter this folder…", fxMk: "Folder", fxMkT: "New folder", fxMkOk: "Create", fxEmpty: "This folder is empty.", fxNoMatch: "No file matches.", fxEnter: "Open", fxEdit: "Edit", fxRead: "Read", fxOpen: "Open", fxRen: "Rename", fxRenT: "Rename “{n}”", fxDel: "Move to Recycle Bin", fxDelT: "Move “{n}” to the Recycle Bin?", fxDelD: "It goes to the Windows Recycle Bin: you can restore it until you empty it.", fxDelOk: "Move to Recycle Bin", fxDelDone: "“{n}” is in the Recycle Bin.", fxShots: "Screenshots", fxLog: "Latest log", fxCrash: "Crash reports", fxWin: "Open in Explorer", fxKind_text: "Text, editable here", fxKind_img: "Image", fxKind_other: "Opens with Windows", fxKind_dir: "Folder", fxManaged: "This folder is easier to manage in the “{t}” tab (it checks versions and what each item needs).", fxNoT: "This file does not open in the launcher", fxNoD: "Open it yourself with Windows (the program Windows uses for this file type), or show it in Explorer.", fxWhyJar: "This is a mod (.jar): Java code, not text. To turn it on or off, remove it or change its version, use the Mods tab.", fxWhyZip: "This is a compressed archive. Windows can open it to see what is inside.", fxWhyDat: "This is a binary Minecraft data file (NBT: world, server list…). Editing it by hand can damage it: use an editor like NBTExplorer, after a backup.", fxWhyAny: "The launcher cannot show this file type.", fxWhyBig: "This file is too big for the launcher's editor (over 2 MB).", fxExt: "Open with Windows", fxShow: "Show in Explorer", fxClose: "Close", fxRo: "Read only: this file is written by the game.", fxBak: "A copy of the old version (.bak) is kept when you save. Ctrl+S to save.", fxCopy: "Copy all", fxCopied: "Copied.", fxSaved: "“{n}” saved (old version kept as .bak).", fxDirty: "You have unsaved changes. Click Cancel again to lose them.", fxNEmpty: "Enter a name.", fxNBad: "A name cannot contain \\ / : * ? \" < > |", fxNTaken: "This name already exists in this folder.", fxNExt: "You are changing the extension: the file may no longer be recognised. Click again to confirm.",
    files: "{n} files", fixedToast: "Fixed: {m} is now {v}.",
    verToast: "{m} is now {v}.", opening: "Opening the pack…", fixWait: "Looking for fixes…", checkBefore: "Before playing, the launcher checks all this. If a problem is left, it tells you instead of letting Minecraft crash.",
  });
  const pkT = (k, vars = {}) => String(PK()[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => vars[x] ?? "");
  const pkCmp = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });
  const PK_COLORS = ["#2f8f5b", "#3b6fd8", "#b5562b", "#7a52c7", "#c0912a", "#2a8fa3", "#c2456b", "#5d7a2e"];
  const pkColor = (s) => PK_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PK_COLORS.length];

  // La page s'ouvre tout de suite (27/10) : d'abord l'en-tête, puis ce qui se lit sur le PC (mods,
  // problèmes), puis ce qui vient d'Internet (versions Modrinth, solutions) et les tailles.
  async function openPackPage(id) {
    const v = data.versions.find((x) => x.id === id) || {};
    const st = { id, p: null, tab: null, filter: "all", q: "" };
    packPage = st;
    // Squelette : la forme de la page en blocs gris animés, le temps de lire le pack.
    const w = [62, 48, 70, 55, 40, 66, 52, 58];
    panel.innerHTML = `<div class="pk-page sk-page" aria-busy="true"><button type="button" class="link-btn pk-back" data-pk-back>${esc(pkT("back"))}</button>
      <div class="pk-top"><span class="pk-ic">${CUBE.replace("<svg", '<svg width="28" height="28"')}</span>
        <div class="pk-title" style="flex:1;"><h2>${esc(v.name || "")}</h2><p class="sr-only">${esc(pkT("opening"))}</p><span class="sk" style="width:min(320px,70%);height:12px;margin-top:6px;"></span></div>
        <div class="pk-acts"><span class="sk" style="width:96px;height:36px;border-radius:var(--radius-m);"></span></div></div>
      <span class="sk" style="height:38px;border-radius:var(--radius-m);margin:12px 0;"></span>
      <div class="pk-tabs" style="gap:14px;padding:0 0 10px;">${[64, 110, 60, 56, 70].map((x) => `<span class="sk" style="width:${x}px;height:14px;"></span>`).join("")}</div>
      <div class="pk-tools" style="margin-top:12px;"><span class="sk" style="width:240px;height:32px;"></span><span class="sk" style="width:60px;height:26px;border-radius:99px;"></span><span class="sk" style="width:90px;height:26px;border-radius:99px;"></span></div>
      <div class="pk-list" style="margin-top:10px;">${w.map((x) => `<div class="pk-row"><span class="sk" style="width:32px;height:32px;border-radius:8px;"></span>
        <span style="display:grid;gap:6px;"><span class="sk" style="width:${x}%;height:12px;"></span><span class="sk" style="width:${x - 18}%;height:10px;"></span></span><span class="sk" style="width:80px;height:20px;border-radius:99px;"></span></div>`).join("")}</div></div>`;
    panel.scrollTop = 0;
    await loadPack(st, { first: true });
  }
  async function loadPack(st, { first = false } = {}) {
    const seq = (st.seq = (st.seq || 0) + 1);
    for (const quick of [true, false]) {
      const r = await api.myPack.get(st.id, { quick });
      if (packPage !== st || st.seq !== seq) return;
      if (!r?.ok) {
        if (!quick && st.p) return; // la page rapide reste affichée
        if (first) { packPage = null; render(); }
        return showModal({ title: T("nav"), body: r?.error || "", confirmLabel: "OK", tone: "warn" });
      }
      // Les tailles et versions de la lecture complète restent pendant une relecture rapide.
      if (quick && st.p && !st.p.partial) r.pack = { ...r.pack, sizeBytes: st.p.sizeBytes, files: st.p.files, mods: r.pack.mods.map((m) => ({ ...m, versions: st.p.mods.find((x) => x.id === m.id)?.versions || m.versions })), partial: true };
      st.p = r.pack;
      if (!st.tab) st.tab = r.pack.vanilla ? "rp" : "mods";
      const v = data.versions.find((x) => x.id === st.id);
      if (v) v.problems = (r.pack.problems || []).length;
      redrawPack();
      if (r.pack.readonly && quick && !r.pack.partial) return;
    }
  }
  // Redessine sans perdre la recherche en cours (curseur gardé).
  function redrawPack() {
    const a = document.activeElement;
    const key = a && panel.contains(a) ? ["data-pk-q", "data-pk-wq", "data-fx-q"].find((k) => a.hasAttribute(k)) : null;
    const pos = key ? a.selectionStart : 0;
    drawPackPage();
    const q = key && panel.querySelector(`[${key}]`);
    if (q) { q.focus(); q.setSelectionRange(pos, pos); }
  }
  // Relit le pack (après chaque changement : versions, mods ajoutés, corrections).
  // Retirer un élément de la version (mod, pack de ressources, shader, data pack, monde).
  // Toujours une confirmation ; un monde ou un data pack est sauvegardé juste avant.
  const TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>`;
  // Explorateur de fichiers de la version : naviguer, ouvrir (texte et images dans le launcher),
  // renommer, mettre à la Corbeille. Les fichiers que le launcher ne sait pas ouvrir passent à Windows.
  const FX_TEXT = ["txt", "json", "json5", "toml", "properties", "cfg", "conf", "yml", "yaml", "ini", "log", "mcmeta", "snbt", "md", "csv", "lang"];
  const FX_IMG = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
  const fxExt = (n) => (n.includes(".") ? n.split(".").pop().toLowerCase() : "");
  const fxKind = (e) => (e.dir ? "dir" : FX_TEXT.includes(fxExt(e.name)) ? "text" : FX_IMG.includes(fxExt(e.name)) ? "img" : "other");
  const fxIcon = (e) => {
    if (e.dir) return { saves: "🌍", mods: "🧩", resourcepacks: "🎨", shaderpacks: "✨", screenshots: "📸", logs: "📜", "crash-reports": "💥", config: "⚙" }[e.name] || "📁";
    const x = fxExt(e.name);
    return FX_IMG.includes(x) ? "🖼" : x === "jar" ? "🧩" : x === "zip" || x === "gz" ? "🗜" : x === "log" ? "📜" : FX_TEXT.includes(x) ? "📝" : "📄";
  };
  const fxSize = (b) => { const fr = L() === "fr"; return b < 1024 ? `${b} ${fr ? "o" : "B"}` : b < 1048576 ? `${Math.round(b / 1024)} ${fr ? "Ko" : "KB"}` : sizeFmt(b); };
  const fxJoin = (dir, name) => (dir ? `${dir}/${name}` : name);
  // Dossiers gérés par un onglet : on prévient avant d'y toucher à la main.
  const fxManaged = (path) => ({ mods: "tMods", resourcepacks: "tRp", shaderpacks: "tSh", saves: "tW" })[path.split("/")[0]];
  async function fxLoad(st, path) {
    st.fx = { path, entries: null, q: "" };
    const r = await api.myPack.files.list(st.id, path);
    if (packPage !== st || st.fx.path !== path) return;
    if (!r?.ok) { st.fx.err = r?.error || "?"; st.fx.entries = []; }
    else st.fx.entries = r.entries.slice().sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
    drawPackPage();
  }
  function fxBody(st) {
    const fx = st.fx;
    if (!fx) { fxLoad(st, ""); return `<p class="pk-note">${esc(pkT("fxLoading"))}</p>`; }
    const parts = fx.path ? fx.path.split("/") : [];
    const crumbs = [`<button type="button" class="fx-crumb" data-fx-go="">${esc(pkT("fxRoot"))}</button>`]
      .concat(parts.map((n, i) => `<span class="fx-sep">›</span><button type="button" class="fx-crumb" data-fx-go="${esc(parts.slice(0, i + 1).join("/"))}">${esc(n)}</button>`)).join("");
    const sc = (path, label, open) => `<button type="button" class="btn-secondary fx-sc" ${open ? `data-fx-open="${esc(path)}"` : `data-fx-go="${esc(path)}"`}>${label}</button>`;
    const man = fxManaged(fx.path);
    const list = fx.entries == null ? `<p class="pk-note">${esc(pkT("fxLoading"))}</p>`
      : (() => {
        const q = (fx.q || "").toLowerCase();
        const es = fx.entries.filter((e) => !q || e.name.toLowerCase().includes(q));
        if (!es.length) return `<p class="pk-note">${esc(pkT(q ? "fxNoMatch" : "fxEmpty"))}</p>`;
        return `<div class="pk-list pk-files">${es.map((e) => {
          const k = fxKind(e), p = fxJoin(fx.path, e.name);
          const openL = e.dir ? pkT("fxEnter") : k === "text" ? (fxExt(e.name) === "log" ? pkT("fxRead") : pkT("fxEdit")) : pkT("fxOpen");
          return `<div class="pk-row fx-row">
            <span class="pk-av">${fxIcon(e)}</span>
            <button type="button" class="fx-name" ${e.dir ? `data-fx-go="${esc(p)}"` : `data-fx-open="${esc(p)}"`}><b>${esc(e.name)}</b><small>${esc(e.dir ? (e.n === 0 ? pkT("fxEmptyDir") : e.n === 1 ? pkT("file1") : pkT("files", { n: e.n })) : pkT("fxKind_" + k))}${e.mtime ? " · " + esc(ago(e.mtime)) : ""}</small></button>
            <span class="pk-nm" style="text-align:right;"><small>${esc(fxSize(e.bytes))}</small></span>
            <span class="pk-end"><button type="button" class="link-btn" ${e.dir ? `data-fx-go="${esc(p)}"` : `data-fx-open="${esc(p)}"`} style="margin:0;font-size:12px;">${esc(openL)}</button>
            <button type="button" class="link-btn" data-fx-ren="${esc(p)}" style="margin:0;font-size:12px;">${esc(pkT("fxRen"))}</button>
            <button type="button" class="pk-del" data-fx-del="${esc(p)}" title="${esc(pkT("fxDel"))}" aria-label="${esc(pkT("fxDel"))} ${esc(e.name)}">${TRASH}</button></span></div>`;
        }).join("")}</div>`;
      })();
    return `<div class="pk-tools fx-tools">${sc("screenshots", "📸 " + esc(pkT("fxShots")))}${sc("logs/latest.log", "📜 " + esc(pkT("fxLog")), true)}${sc("crash-reports", "💥 " + esc(pkT("fxCrash")))}<span style="flex:1"></span><button type="button" class="btn-secondary" data-fx-win>📁 ${esc(pkT("fxWin"))}</button></div>
      <div class="fx-bar"><button type="button" class="fx-up" data-fx-up ${fx.path ? "" : "disabled"} title="${esc(pkT("fxUp"))}" aria-label="${esc(pkT("fxUp"))}">↑</button><nav class="fx-crumbs" aria-label="${esc(pkT("fxPath"))}">${crumbs}</nav>
        <input class="play-in" type="search" data-fx-q placeholder="${esc(pkT("fxQ"))}" value="${esc(fx.q || "")}" style="max-width:180px;margin:0;"><button type="button" class="btn-secondary" data-fx-mk style="margin:0;">+ ${esc(pkT("fxMk"))}</button></div>
      ${man ? `<p class="pk-note fx-warn">${esc(pkT("fxManaged", { t: pkT(man) }))}</p>` : fx.path ? "" : `<p class="pk-note" style="margin:0 0 10px;">${esc(pkT("fNote"))}</p>`}
      ${fx.err ? `<p class="pk-note fx-warn">${esc(fx.err)}</p>` : ""}${list}`;
  }
  // « Ouvrir avec Windows » : le launcher peut refuser (.bat, .exe… : audit du 01/11). Le refus
  // s'affiche maintenant (02/11, test au6 : le bouton ne disait rien).
  async function fxOpenExt(st, path) {
    const r = await api.myPack.files.openExternal(st.id, path);
    if (r && r.ok === false && r.error) toast(r.error);
    return r;
  }
  // Fenêtre « ce fichier ne s'ouvre pas ici » : on explique et on passe la main à Windows.
  function fxElsewhere(st, path, why) {
    const name = path.split("/").pop();
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" style="max-width:540px;text-align:left;">
      <h3>${esc(pkT("fxNoT"))}</h3><p style="margin:4px 0 6px;font-size:13.5px;"><b>${esc(name)}</b></p>
      <p style="margin:0 0 6px;font-size:13px;color:var(--muted);">${esc(why)}</p><p style="margin:0 0 4px;font-size:13px;color:var(--muted);">${esc(pkT("fxNoD"))}</p>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;">
        <button type="button" class="btn-secondary" data-x>${esc(pkT("fxClose"))}</button><button type="button" class="btn-secondary" data-show>${esc(pkT("fxShow"))}</button><button type="button" class="join-btn" data-ext>${esc(pkT("fxExt"))}</button></div></div>`);
    m.ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      if (e.target.closest("[data-show]")) { api.myPack.files.showInExplorer(st.id, path); return m.close(); }
      if (e.target.closest("[data-ext]")) { fxOpenExt(st, path); return m.close(); }
    });
  }
  async function fxOpen(st, path) {
    const name = path.split("/").pop(), x = fxExt(name), k = fxKind({ name });
    if (k === "other") {
      const why = x === "jar" ? pkT("fxWhyJar") : x === "zip" || x === "gz" ? pkT("fxWhyZip") : ["dat", "mca", "nbt", "dat_old"].includes(x) ? pkT("fxWhyDat") : pkT("fxWhyAny");
      return fxElsewhere(st, path, why);
    }
    const r = await api.myPack.files.read(st.id, path);
    if (!r?.ok) return packErr(r);
    if (k === "text" && r.tooBig) return fxElsewhere(st, path, pkT("fxWhyBig"));
    if (k === "img") {
      const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" style="max-width:820px;width:92vw;text-align:left;">
        <h3 style="margin-bottom:8px;">${esc(name)}</h3><div class="fx-img"><img src="${esc(r.dataUrl)}" alt="${esc(name)}"></div>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;">
          <button type="button" class="btn-secondary" data-show>${esc(pkT("fxShow"))}</button><button type="button" class="btn-secondary" data-ext>${esc(pkT("fxExt"))}</button><button type="button" class="join-btn" data-x>${esc(pkT("fxClose"))}</button></div></div>`);
      m.ov.addEventListener("click", (e) => {
        if (e.target.closest("[data-x]")) return m.close();
        if (e.target.closest("[data-show]")) return api.myPack.files.showInExplorer(st.id, path);
        if (e.target.closest("[data-ext]")) return fxOpenExt(st, path);
      });
      return;
    }
    const ro = x === "log" || /(^|\/)crash-reports\//.test(path);
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" style="max-width:900px;width:94vw;text-align:left;">
      <h3 style="margin-bottom:2px;">${esc(name)}</h3><p style="margin:0 0 8px;font-size:12.5px;color:var(--muted);">${esc(ro ? pkT("fxRo") : pkT("fxBak"))}</p>
      <textarea class="fx-ed" spellcheck="false" ${ro ? "readonly" : ""} aria-label="${esc(name)}"></textarea>
      <p class="fx-msg" data-msg></p>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;flex-wrap:wrap;align-items:center;">
        <button type="button" class="btn-secondary" data-ext style="margin-right:auto;">${esc(pkT("fxExt"))}</button>
        ${ro ? `<button type="button" class="btn-secondary" data-copy>${esc(pkT("fxCopy"))}</button>` : ""}
        <button type="button" class="btn-secondary" data-x>${esc(pkT(ro ? "fxClose" : "dpCancel"))}</button>${ro ? "" : `<button type="button" class="join-btn" data-save>${esc(pkT("dpSave"))}</button>`}</div></div>`);
    const ta = m.$(".fx-ed"), msg = m.$("[data-msg]");
    ta.value = r.text;
    let warned = false;
    const save = async () => {
      const w = await api.myPack.files.write(st.id, path, ta.value);
      if (!w?.ok) { msg.textContent = w?.error || "?"; return; }
      r.text = ta.value; toast(pkT("fxSaved", { n: name })); m.close(); fxLoad(st, st.fx.path);
    };
    ta.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !ro) { e.preventDefault(); save(); } });
    m.ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-ext]")) return fxOpenExt(st, path);
      if (e.target.closest("[data-copy]")) { navigator.clipboard?.writeText(ta.value).catch(() => {}); return toast(pkT("fxCopied")); }
      if (e.target.closest("[data-save]")) return save();
      if (e.target.closest("[data-x]")) {
        if (!ro && ta.value !== r.text && !warned) { warned = true; msg.textContent = pkT("fxDirty"); return; }
        return m.close();
      }
    });
    ta.focus();
  }
  const FX_BAD = /[\\/:*?"<>|]/;
  function fxName(st, { title, value = "", okLabel, onOk, hint = "" }) {
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" style="max-width:420px;text-align:left;">
      <h3>${esc(title)}</h3>${hint ? `<p style="margin:2px 0 8px;font-size:13px;color:var(--muted);">${esc(hint)}</p>` : ""}
      <input class="play-in" data-n value="${esc(value)}" style="width:100%;margin:6px 0 0;"><p class="fx-msg" data-msg></p>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;"><button type="button" class="btn-secondary" data-x>${esc(pkT("dpCancel"))}</button><button type="button" class="join-btn" data-ok>${esc(okLabel)}</button></div></div>`);
    const inp = m.$("[data-n]"), msg = m.$("[data-msg]");
    const dot = value.lastIndexOf(".");
    inp.focus(); inp.setSelectionRange(0, dot > 0 ? dot : value.length);
    const go = async () => {
      const n = inp.value.trim();
      if (!n) return (msg.textContent = pkT("fxNEmpty"));
      if (FX_BAD.test(n)) return (msg.textContent = pkT("fxNBad"));
      if (n !== value && (st.fx.entries || []).some((e) => e.name.toLowerCase() === n.toLowerCase())) return (msg.textContent = pkT("fxNTaken"));
      if (value && n !== value && fxExt(n) !== fxExt(value) && !msg.dataset.ext && !(st.fx.entries || []).find((e) => e.name === value)?.dir) { msg.dataset.ext = 1; return (msg.textContent = pkT("fxNExt")); }
      const r = await onOk(n);
      if (!r?.ok) return (msg.textContent = r?.error || "?");
      m.close(); fxLoad(st, st.fx.path);
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    m.ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      if (e.target.closest("[data-ok]")) return go();
    });
  }
  async function fxClick(st, b) {
    if (b.hasAttribute("data-fx-go")) { fxLoad(st, b.dataset.fxGo); return true; }
    if (b.hasAttribute("data-fx-up")) { fxLoad(st, st.fx.path.split("/").slice(0, -1).join("/")); return true; }
    if (b.hasAttribute("data-fx-open")) { fxOpen(st, b.dataset.fxOpen); return true; }
    if (b.hasAttribute("data-fx-win")) { api.myPack.files.showInExplorer(st.id, st.fx?.path || ""); return true; }
    if (b.hasAttribute("data-fx-mk")) {
      fxName(st, { title: pkT("fxMkT"), okLabel: pkT("fxMkOk"), onOk: (n) => api.myPack.files.mkdir(st.id, fxJoin(st.fx.path, n)) });
      return true;
    }
    if (b.hasAttribute("data-fx-ren")) {
      const p = b.dataset.fxRen, n = p.split("/").pop(), man = fxManaged(p);
      fxName(st, { title: pkT("fxRenT", { n }), value: n, okLabel: pkT("fxRen"), hint: man ? pkT("fxManaged", { t: pkT(man) }) : "", onOk: (nn) => api.myPack.files.rename(st.id, p, nn) });
      return true;
    }
    if (b.hasAttribute("data-fx-del")) {
      const p = b.dataset.fxDel, n = p.split("/").pop(), man = fxManaged(p);
      const res = await showModal({ title: pkT("fxDelT", { n }), body: pkT("fxDelD") + (man ? " " + pkT("fxManaged", { t: pkT(man) }) : ""), confirmLabel: pkT("fxDelOk"), cancelLabel: pkT("delNo"), tone: "warn" });
      if (!res?.confirmed) return true;
      const r = await api.myPack.files.trash(st.id, p);
      if (!r?.ok) { packErr(r); return true; }
      toast(pkT("fxDelDone", { n }));
      fxLoad(st, st.fx.path);
      reloadPack();
      return true;
    }
    return false;
  }
  async function pkDel(st, kind, key) {
    const p = st.p;
    const en = pkT("delL") === "Remove";
    let name = key, body = "", title = "";
    if (kind === "mod") {
      const m = p.mods.find((x) => x.id === key); name = m.name;
      const users = p.mods.filter((x) => x.on && (x.deps || []).some((d) => d.id === key)).map((x) => x.name);
      const orphans = p.mods.filter((x) => x.auto && (x.by || []).length === 1 && x.by[0] === key).map((x) => x.name);
      const many = users.length > 1;
      title = pkT("delModT", { n: name });
      body = pkT("delModD")
        + (users.length ? " " + pkT("delModNeed", { d: users.join(", "), s: en ? (many ? "" : "s") : (many ? "ont" : "a"), x: en ? (many ? "They" : "It") : (many ? "s" : ""), y: en ? "" : (many ? "ont" : "a") }) : "")
        + (orphans.length ? " " + pkT("delModAuto", { d: orphans.join(", ") }) : "");
    } else if (kind === "rp") { name = p.resourcepacks.find((x) => x.file === key)?.name || key; title = pkT("delRpT", { n: name }); body = pkT("delRpD"); }
    else if (kind === "sh") { name = p.shaders.find((x) => x.file === key)?.name || key; title = pkT("delShT", { n: name }); body = pkT("delShD"); }
    else if (kind === "dp") {
      const d = (p.datapacks || []).find((x) => x.file === key); name = d?.name || key;
      const ws = (d?.worlds || []).map((k) => pkWorlds().find((w) => w.key === k)?.name).filter(Boolean);
      title = pkT("delDpT", { n: name });
      body = ws.length ? pkT("delDpD", { w: ws.map((x) => (en ? `“${x}”` : `« ${x} »`)).join(", ") }) : pkT("delDpNoW");
      if (d?.auto) body += " " + pkT("delDpAuto");
    } else if (kind === "w") { name = pkWorlds().find((w) => w.key === key)?.name || key; title = pkT("delWT", { n: name }); body = pkT("delWD"); }
    const res = await showModal({ title, body, confirmLabel: pkT("delOk"), cancelLabel: pkT("delNo"), tone: "warn" });
    if (!res?.confirmed) return;
    const r = await api.myPack.remove(st.id, { kind, key });
    if (!r?.ok) return packErr(r);
    toast(pkT("delDone", { n: name }));
    if (kind === "w") await refresh();
    return reloadPack();
  }
  async function reloadPack() {
    const st = packPage;
    if (!st?.p) return;
    return loadPack(st);
  }
  // Data packs : ils marchent monde par monde (dossier datapacks du monde). Le launcher garde la
  // liste de la version et sauvegarde le monde avant d'en ajouter ou d'en retirer un.
  const pkWorlds = () => data.worlds.filter((w) => w.lastVersionId === packPage?.id);
  function dpModal(title, sub, inner, onSave) {
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" style="max-width:480px;text-align:left;">
      <h3>${esc(title)}</h3><p style="margin:2px 0 12px;font-size:13px;color:var(--muted);">${esc(sub)}</p>
      <div class="play-list" style="max-height:320px;">${inner}</div>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;">
        <button type="button" class="btn-secondary" data-dp-x>${esc(pkT("dpCancel"))}</button>${onSave ? `<button type="button" class="join-btn" data-dp-ok>${esc(pkT("dpSave"))}</button>` : ""}</div></div>`);
    m.ov.addEventListener("click", async (e) => {
      if (e.target.closest("[data-dp-x]")) return m.close();
      if (e.target.closest("[data-dp-ok]")) {
        e.target.closest("[data-dp-ok]").disabled = true;
        const r = await onSave(m);
        packErr(r);
        m.close();
        if (r?.ok) toast(pkT("dpOk"));
        reloadPack();
      }
    });
    return m;
  }
  const dpRow = (attr, checked, name, sub) => `<label class="play-row" style="align-items:flex-start;"><input type="checkbox" ${attr} ${checked ? "checked" : ""} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span></label>`;
  function openDpWorlds(file, fresh = false) {
    const st = packPage;
    const d = (st.p.datapacks || []).find((x) => x.file === file);
    if (!d) return;
    const ws = pkWorlds();
    dpModal(fresh ? pkT("dpFreshT", { n: d.name }) : pkT("dpPT", { n: d.name }), pkT("dpPD"),
      (ws.length ? ws.map((w) => dpRow(`data-w="${esc(w.key)}"`, (d.worlds || []).includes(w.key), w.name, w.lastPlayed ? ago(w.lastPlayed) : "")).join("") : `<p class="join-note" style="margin:8px;">${esc(pkT("dpNoW"))}</p>`)
        + (st.p.vanilla && !on("vanillaModded") ? `<p class="join-note" style="margin:8px;">${esc(pkT("dpVanNew"))}</p>` : st.p.vanilla ? `<button type="button" class="sw-row" data-sw-dp><b>${esc(SWT().dpAll)}</b><small>${esc(SWT().dpAllD)}</small></button><p class="join-note" style="margin:8px;">${esc(SWT().dpGen)}</p>` : dpRow("data-auto", d.auto, pkT("dpAll", { l: st.p.dpLoader || "Paxi" }), ""))
        + `<div data-dp-ld hidden style="margin:6px 4px 4px;"><b style="font-size:13px;">${esc(pkT("dpLdT"))}</b><p class="join-note" style="margin:4px 0 8px;">${esc(pkT("dpLdD"))}</p>
          <label class="play-row" style="align-items:flex-start;"><input type="radio" name="dp-ld" value="paxi" checked style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(pkT("dpLdPaxi"))} <span class="play-beta-tag" style="margin-left:4px;">${esc(pkT("shLdRec"))}</span></b><small>${esc(pkT("dpLdPaxiD"))}</small></span></label>
          <label class="play-row" style="align-items:flex-start;"><input type="radio" name="dp-ld" value="global-packs" style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(pkT("dpLdGp"))}</b><small>${esc(pkT("dpLdGpD"))}</small></span></label></div>`,
      (m) => api.myPack.setDatapack(st.id, file, { worlds: [...m.ov.querySelectorAll("[data-w]:checked")].map((x) => x.dataset.w), auto: !!m.$("[data-auto]")?.checked, loader: m.$("[data-auto]")?.checked && !st.p.dpLoader ? m.$("input[name=dp-ld]:checked")?.value : undefined }));
    // Cocher « tous les mondes » sans chargeur dans le pack : on montre le choix du chargeur.
    const dm = [...document.querySelectorAll(".play-modal")].pop();
    dm?.querySelector("[data-sw-dp]")?.addEventListener("click", () => { const ws = [...dm.querySelectorAll("[data-w]:checked")].map((x) => x.dataset.w); dm.querySelector("[data-dp-x]")?.click(); openSwitchModded("dp", d.name, file, ws); });
    dm?.querySelector("[data-auto]")?.addEventListener("change", (e) => { const ld = dm.querySelector("[data-dp-ld]"); if (ld) ld.hidden = !e.target.checked || !!st.p.dpLoader; });
  }
  function openWorldDp(key) {
    const st = packPage;
    const w = data.worlds.find((x) => x.key === key);
    const dps = st.p.datapacks || [];
    const m = dpModal(pkT("dpWT", { n: w?.name || "" }), pkT("dpWD"),
      dps.length ? dps.map((d) => dpRow(`data-d="${esc(d.file)}"`, (d.worlds || []).includes(key), d.name, d.src === "mr" ? "Modrinth" : d.file)).join("")
        : `<p class="join-note" style="margin:8px;">${esc(pkT("dpWNone"))}</p>`,
      dps.length ? async (m) => {
        const on = new Set([...m.ov.querySelectorAll("[data-d]:checked")].map((x) => x.dataset.d));
        let r = { ok: true };
        for (const d of dps) {
          const has = (d.worlds || []).includes(key);
          if (has === on.has(d.file)) continue;
          r = await api.myPack.setDatapack(st.id, d.file, { worlds: on.has(d.file) ? [...(d.worlds || []), key] : d.worlds.filter((x) => x !== key), auto: d.auto });
          if (!r?.ok) break;
        }
        return r;
      } : null);
    // Ajouter directement dans ce monde.
    m.$(".play-list").insertAdjacentHTML("afterend", `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button type="button" class="btn-secondary" data-dpw-add="mr">${esc(pkT("dpMr"))}</button><button type="button" class="btn-secondary" data-dpw-add="file">${esc(pkT("dpFile"))}</button></div>`);
    m.ov.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-dpw-add]");
      if (!b) return;
      m.close();
      if (b.dataset.dpwAdd === "mr") return openDpModrinth(key);
      const r = await api.myPack.addDatapack(st.id, { from: "file", worldKey: key });
      packErr(r);
      if (r?.ok) toast(pkT("dpAdded", { n: r.name }));
      reloadPack();
    });
  }
  // Basculer une installation vanilla en version modée (28/10, Rushi) : pour lancer des shaders (Iris,
  // Oculus) ou charger un data pack dans tous les mondes (Paxi, Global Packs). Le launcher regarde sur
  // Modrinth quels mods existent pour CETTE version de Minecraft et ne propose que ceux-là ; s'il n'y en a
  // aucun, il le dit. Rien n'est supprimé : mondes (sauvegardés avant), packs de ressources, shaders,
  // data packs, réglages. Seul le chargeur (Fabric, NeoForge, Forge) et le mod choisi sont ajoutés.
  const SWT = () => (L() === "fr" ? {
    shVan: "En vanilla, Minecraft ne lit pas les shaders tout seul. Ajoute ton shader : le launcher te proposera ensuite de basculer en version modée (avec Iris), sans rien supprimer.",
    shWait: "En attente : il faut basculer l'installation en version modée", go: "Basculer en version modée",
    dpAll: "Ajouter automatiquement à tous les mondes (même les nouveaux)", dpAllD: "Il faut un petit mod qui charge les data packs : le launcher te propose de basculer en version modée.",
    dpGen: "Un data pack qui change la génération du monde (ex. Terralith) doit être là à la création : ajoute-le dans Minecraft, Créer un monde › Data packs.",
    tSh: "Lancer « {n} » : basculer en version modée ?", tDp: "« {n} » dans tous les mondes : basculer en version modée ?", tAny: "Basculer en version modée ?",
    dSh: "Minecraft vanilla ne lit pas les shaders. Il faut un mod qui les lance. On a regardé sur Modrinth ce qui existe pour Minecraft {v} :",
    dDp: "Pour qu'un data pack marche dans tous les mondes, même ceux créés plus tard, il faut un mod qui les charge. On a regardé sur Modrinth ce qui existe pour Minecraft {v} :",
    check: "Recherche sur Modrinth pour Minecraft {v}…", rec: "recommandé",
    keep: "Rien n'est supprimé : tes mondes (sauvegardés juste avant), packs de ressources, shaders, data packs et réglages restent. Le launcher ajoute seulement {l} et le mod choisi.",
    none: "Aucun mod {m} n'existe encore pour Minecraft {v}. Impossible de basculer pour l'instant : le launcher revérifiera la prochaine fois. En attendant, le shader reste rangé ici.",
    noneDp: "Aucun chargeur de data packs n'existe encore pour Minecraft {v}. Ajoute le data pack à la main dans chaque monde (coche-les).",
    cancel: "Annuler", later: "Plus tard", ok: "Basculer", done: "« {n} » est maintenant en {l} avec {m}. Rien n'a été supprimé.", busy: "Bascule en cours…",
  } : {
    shVan: "In vanilla, Minecraft does not read shaders by itself. Add your shader: the launcher will then offer to switch to a modded version (with Iris), without deleting anything.",
    shWait: "Waiting: the installation must switch to a modded version", go: "Switch to modded",
    dpAll: "Add automatically to every world (even new ones)", dpAllD: "A small mod that loads data packs is needed: the launcher offers to switch to a modded version.",
    dpGen: "A data pack that changes world generation (e.g. Terralith) must be there at creation: add it in Minecraft, Create world › Data Packs.",
    tSh: "Run “{n}”: switch to a modded version?", tDp: "“{n}” in every world: switch to a modded version?", tAny: "Switch to a modded version?",
    dSh: "Vanilla Minecraft does not read shaders. A mod that runs them is needed. We checked Modrinth for Minecraft {v}:",
    dDp: "For a data pack to work in every world, even ones made later, a mod that loads them is needed. We checked Modrinth for Minecraft {v}:",
    check: "Checking Modrinth for Minecraft {v}…", rec: "recommended",
    keep: "Nothing is deleted: your worlds (backed up right before), resource packs, shaders, data packs and settings stay. The launcher only adds {l} and the chosen mod.",
    none: "No {m} mod exists yet for Minecraft {v}. Switching is not possible for now: the launcher will check again next time. Meanwhile the shader stays here.",
    noneDp: "No data pack loader exists yet for Minecraft {v}. Add the data pack by hand to each world (tick them).",
    cancel: "Cancel", later: "Later", ok: "Switch", done: "“{n}” now runs {l} with {m}. Nothing was deleted.", busy: "Switching…",
  });
  const swF = (t, o) => t.replace(/\{(\w)\}/g, (_, k) => o[k] ?? "");
  async function openSwitchModded(need, name, dpFile, dpWorlds) {
    const st = packPage, t = SWT(), v = st.p.minecraftVersion;
    const nm = data.versions.find((x) => x.id === st.id)?.name || st.p.name;
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="sw-t" style="max-width:500px;text-align:left;">
      <h3 id="sw-t">${esc(name ? swF(need === "sh" ? t.tSh : t.tDp, { n: name }) : t.tAny)}</h3><p style="margin:2px 0 12px;font-size:13px;color:var(--muted);">${esc(swF(need === "sh" ? t.dSh : t.dDp, { v }))}</p>
      <div class="play-list" data-sw-list><p class="join-note" style="margin:8px;">${esc(swF(t.check, { v }))}</p></div><p class="join-note" data-sw-keep style="margin:10px 2px 0;"></p>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;"><button type="button" class="btn-secondary" data-sw-x>${esc(t.later)}</button><button type="button" class="join-btn" data-sw-go disabled>${esc(t.ok)}</button></div></div>`);
    const r = await api.myPack.loaderOptions(st.id, need).catch(() => null);
    const opts = r?.options || [];
    const list = m.$("[data-sw-list]");
    if (!opts.length) {
      list.innerHTML = `<p class="pk-note" style="margin:8px;">${esc(swF(need === "sh" ? t.none : t.noneDp, { v, m: "Iris / Oculus" }))}</p>`;
      m.$("[data-sw-go]").remove();
    } else {
      list.innerHTML = opts.map((o, i) => `<label class="play-row" style="align-items:flex-start;"><input type="radio" name="sw-o" value="${i}" ${o.rec ? "checked" : ""} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(o.mod)} · ${esc(LOADERS[o.loader] || o.loader)}${o.rec ? ` <span class="play-beta-tag" style="margin-left:4px;">${esc(t.rec)}</span>` : ""}</b><small>${esc(o.info || "")}</small></span></label>`).join("");
      if (!m.$("input[name=sw-o]:checked")) m.$("input[name=sw-o]").checked = true;
      const keep = () => { const o = opts[+m.$("input[name=sw-o]:checked").value]; m.$("[data-sw-keep]").textContent = swF(t.keep, { l: LOADERS[o.loader] || o.loader }); };
      keep();
      list.addEventListener("change", keep);
      m.$("[data-sw-go]").disabled = false;
    }
    m.ov.addEventListener("click", async (e) => {
      if (e.target.closest("[data-sw-x]")) return m.close();
      const b = e.target.closest("[data-sw-go]");
      if (!b) return;
      const o = opts[+m.$("input[name=sw-o]:checked").value];
      b.disabled = true; b.textContent = t.busy;
      const out = await api.myPack.switchToModded(st.id, { loader: o.loader, mod: o.slug, need });
      packErr(out);
      if (!out?.ok) { b.disabled = false; b.textContent = t.ok; return; }
      if (need === "dp" && dpFile) {
        await api.myPack.setDatapack(st.id, dpFile, { worlds: dpWorlds || [], auto: true });
      }
      // Le shader qui a demandé la bascule devient le shader actif (29/10 : il restait sur « Aucun »).
      if (need === "sh" && dpFile) packErr(await api.myPack.setShader(st.id, dpFile));
      m.close();
      toast(swF(t.done, { n: nm, l: LOADERS[o.loader] || o.loader, m: o.mod }));
      await refresh();
      await reloadPack();
    });
  }
  function openShaderLoader() {
    const st = packPage;
    const forge = st.p.loader === "forge";
    const opt = (v, name, d, rec) => `<label class="play-row" style="align-items:flex-start;"><input type="radio" name="sh-ld" value="${v}" ${rec ? "checked" : ""} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(name)}${rec ? ` <span class="play-beta-tag" style="margin-left:4px;">${esc(pkT("shLdRec"))}</span>` : ""}</b><small>${esc(d)}</small></span></label>`;
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" style="max-width:480px;text-align:left;">
      <h3>${esc(pkT("shLdT"))}</h3><p style="margin:2px 0 12px;font-size:13px;color:var(--muted);">${esc(pkT("shLdD"))}</p>
      <div class="play-list">${forge ? opt("oculus", pkT("shLdOc"), pkT("shLdOcD"), true) : opt("iris", pkT("shLdIris"), pkT("shLdIrisD"), true)}${opt("none", L() === "fr" ? "Aucun pour l'instant" : "None for now", pkT("shLdNo"), false)}</div>
      <p class="join-note" style="margin:10px 2px 0;">${esc(pkT("shLdOpt"))}</p>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;"><button type="button" class="btn-secondary" data-dp-x>${esc(pkT("dpCancel"))}</button><button type="button" class="join-btn" data-sh-go>${esc(pkT("shLdGo"))}</button></div></div>`);
    m.ov.addEventListener("click", async (e) => {
      if (e.target.closest("[data-dp-x]")) return m.close();
      const b = e.target.closest("[data-sh-go]");
      if (!b) return;
      b.disabled = true;
      const v = m.$("input[name=sh-ld]:checked")?.value;
      const r = v === "none" ? { ok: true } : await api.myPack.addShaderLoader(st.id, v);
      packErr(r);
      m.close();
      await reloadPack();
      if (r?.ok) openContentAdd("sh");
    });
  }
  // Ajouter un pack de ressources, un shader, un monde ou un data pack (28/10, Rushi : « la même fenêtre
  // pour les quatre ») : Modrinth et CurseForge cherchés dans le launcher, ou un fichier .zip déjà
  // téléchargé. Modrinth n'a pas de maps : les mondes viennent de CurseForge ou d'un fichier. Un fichier
  // CurseForge que son auteur réserve à l'appli CurseForge : « Page ↗ », le joueur le télécharge, et le
  // launcher le trouve tout seul dans Téléchargements puis l'installe (comme les mods, 28/10 Rushi).
  // Les mods gardent leur fenêtre à eux.
  const ACT = () => (L() === "fr" ? {
    t: { rp: "Ajouter un pack de ressources", sh: "Ajouter un shader", w: "Ajouter un monde", dp: "Ajouter un data pack" },
    q: { rp: "Chercher un pack de ressources…", sh: "Chercher un shader…", w: "Chercher une map…", dp: "Chercher un data pack…" },
    file: "📁 Importer un fichier .zip", add: "+ Ajouter", done: "✓ Ajouté", page: "Page ↗", wait: "Recherche…",
    none: "Aucun résultat. Essaie un autre mot.", noMr: "Modrinth n'a pas de maps : cherche sur CurseForge, ou importe un fichier .zip.", wFile: "Importe la map téléchargée (fichier .zip) : elle arrive dans les mondes de cette installation.",
    blocked: "Son auteur le réserve à l'appli CurseForge : ouvre sa page et télécharge-le, le launcher l'installe tout seul.",
    watch: "⏳ En attente du téléchargement…", found: "✓ Trouvé et installé", lost: "Fichier pas trouvé dans Téléchargements. Réessaie « Page ↗ », ou « Importer un fichier .zip ».",
    hint: "Sur la page CurseForge, clique « Download » sous le nom du fichier. Dès qu'il arrive dans Téléchargements, le launcher l'installe et le retire de Téléchargements.",
    foundT: "« {n} » trouvé dans Téléchargements et installé.",
    wOk: "Monde « {n} » ajouté (une sauvegarde est faite).",
  } : {
    t: { rp: "Add a resource pack", sh: "Add a shader", w: "Add a world", dp: "Add a data pack" },
    q: { rp: "Search a resource pack…", sh: "Search a shader…", w: "Search a map…", dp: "Search a data pack…" },
    file: "📁 Import a .zip file", add: "+ Add", done: "✓ Added", page: "Page ↗", wait: "Searching…",
    none: "No result. Try another word.", noMr: "Modrinth has no maps: search CurseForge, or import a .zip file.", wFile: "Import the downloaded map (.zip file): it goes into this installation's worlds.",
    blocked: "Its author keeps it for the CurseForge app: open its page and download it, the launcher installs it by itself.",
    watch: "⏳ Waiting for the download…", found: "✓ Found and installed", lost: "File not found in Downloads. Try “Page ↗” again, or “Import a .zip file”.",
    hint: "On the CurseForge page, click “Download” under the file name. As soon as it lands in Downloads, the launcher installs it and removes it from Downloads.",
    foundT: "“{n}” found in Downloads and installed.",
    wOk: "World “{n}” added (a backup is made).",
  });
  // Squelette de chargement (28/10, Rushi) : la fenêtre s'ouvre tout de suite avec 5 lignes grises
  // animées à la place de la liste, pour qu'on voie que ça charge.
  const SK_W = [62, 48, 70, 54, 40];
  const skRows = (cls, icon = 36) => SK_W.map((w) => `<div class="${cls}" aria-hidden="true" style="cursor:default;align-items:center;gap:10px;"><span class="sk" style="width:${icon}px;height:${icon}px;border-radius:8px;flex:none;"></span><span style="display:grid;gap:6px;flex:1;min-width:0;"><span class="sk" style="width:${w}%;height:12px;"></span><span class="sk" style="width:${w - 20}%;height:10px;"></span></span><span class="sk" style="width:72px;height:26px;border-radius:8px;flex:none;"></span></div>`).join("");
  function openContentAdd(kind) {
    if (on("addMenus") && packPage) return openAddWin({ mode: "add", kind });
    const st = packPage;
    const A = ACT();
    // Pack Omniscient : Modrinth seulement (ses packs sont publiés, jamais avec des fichiers CurseForge).
    const cf = on("contentCf") && !st.p.omni;
    const srcs = kind === "w" ? (cf ? ["cf"] : []) : cf ? ["mr", "cf"] : ["mr"];
    let src = srcs[0] || null;
    let q = "";
    let seq = 0;
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="ac-t" style="max-width:560px;text-align:left;">
      <h3 id="ac-t">${esc(A.t[kind])}</h3><p style="margin:2px 0 12px;font-size:13px;color:var(--muted);">Minecraft ${esc(st.p.minecraftVersion)}</p>
      ${srcs.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">${srcs.length > 1 ? srcs.map((k) => `<button type="button" class="pb-chip" data-ac-src="${k}" style="--c:${PB_SRC[k].c}" aria-pressed="${k === src}"><i></i>${PB_SRC[k].n}</button>`).join("") : `<span class="pb-src" style="--c:${PB_SRC[srcs[0]].c}">${PB_SRC[srcs[0]].n}</span>`}
        <input type="search" class="play-in" data-ac-q placeholder="${esc(A.q[kind])}" style="flex:1;min-width:180px;margin:0;" autocomplete="off"></div>` : ""}
      ${kind === "w" ? `<p class="join-note" style="margin:0 0 8px;">${esc(cf ? A.noMr : A.wFile)}</p>` : ""}
      <p class="join-note" data-ac-hint hidden style="margin:0 0 8px;">${esc(A.hint)}</p>
      <div class="play-list" data-ac-res style="max-height:340px;"></div>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:space-between;margin-top:14px;flex-wrap:wrap;"><button type="button" class="btn-secondary" data-ac-file style="margin:0;">${esc(A.file)}</button><button type="button" class="btn-secondary" data-ac-x style="margin:0;">${esc(pkT("wzBack"))}</button></div></div>`);
    const res = m.$("[data-ac-res]");
    const sync = () => m.ov.querySelectorAll("[data-ac-src]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.acSrc === src));
      b.classList.toggle("on", b.dataset.acSrc === src);
    });
    const show = async () => {
      if (!src) return;
      const my = ++seq;
      res.innerHTML = `<span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">${esc(A.wait)}</span>${skRows("play-row")}`;
      const r = kind === "dp" && src === "mr"
        ? await api.myPack.searchDatapacks(st.id, q).then((x) => ({ ok: x?.ok !== false, items: (x?.packs || []).map((y) => ({ ...y, src: "mr" })), error: x?.error }))
        : await api.myPack.searchContent(st.id, kind, q, { src });
      if (my !== seq || !document.body.contains(m.ov)) return;
      const list = r?.items || [];
      res.innerHTML = list.length ? list.map((x) => `<div class="play-row" style="align-items:center;gap:10px;">
          <span class="pb-ic" style="--c:${PB_SRC[x.src || src].c};width:36px;height:36px;border-radius:8px;font-size:13px;">${x.icon ? `<img src="${esc(x.icon)}" alt="" loading="lazy">` : esc(pbIni(x.name))}</span>
          <span class="t"><b style="font-weight:600;">${esc(x.name)}</b><small>${esc([x.author, x.downloads].filter(Boolean).join(" · "))}${x.blocked ? ` · ${esc(A.blocked)}` : ""}</small></span>
          ${x.blocked ? `<button type="button" class="btn-secondary" data-ac-page="${esc(x.page || "")}" data-ac-slug="${esc(x.slug || "")}" style="margin:0;padding:4px 10px;font-size:12px;">${esc(A.page)}</button>` : `<button type="button" class="btn-secondary" data-ac-add="${esc(x.slug)}" style="margin:0;padding:4px 10px;font-size:12px;">${esc(A.add)}</button>`}</div>`).join("")
        : `<p class="join-note" style="margin:8px;">${esc(r?.ok === false && r.error ? r.error : A.none)}</p>`;
    };
    let t = null;
    m.$("[data-ac-q]")?.addEventListener("input", (e) => {
      q = e.target.value.trim();
      clearTimeout(t);
      t = setTimeout(show, 350);
    });
    const afterAdd = async (r, fromFile) => {
      // Fenêtre fermée pendant l'attente d'un fichier CurseForge : il est quand même installé.
      if (!document.body.contains(m.ov)) {
        toast(A.foundT.replace("{n}", r.name || ""));
        await refresh();
        if (packPage === st) await reloadPack();
        return;
      }
      if (kind === "w") {
        toast(A.wOk.replace("{n}", r.name || ""));
        await refresh();
        await reloadPack();
        return m.close();
      }
      if (kind === "dp") {
        m.close();
        await reloadPack();
        return openDpWorlds(r.file, true);
      }
      toast(pkT("dpAdded", { n: r.name }));
      await reloadPack();
      if (kind === "sh" && st.p.vanilla && on("vanillaModded")) {
        m.close();
        return openSwitchModded("sh", r.name, r.file);
      }
      if (fromFile) m.close();
    };
    m.ov.addEventListener("click", async (e) => {
      if (e.target.closest("[data-ac-x]")) return m.close();
      const sb = e.target.closest("[data-ac-src]");
      if (sb) {
        src = sb.dataset.acSrc;
        sync();
        return show();
      }
      const pg = e.target.closest("[data-ac-page]");
      if (pg && !/^cf-\d+-[1-9]\d*$/.test(pg.dataset.acSlug || "")) return api.myPack.openCurseForgePage({ kind, url: pg.dataset.acPage, minecraftVersion: st.p.minecraftVersion });
      if (pg) {
        pg.disabled = true;
        pg.textContent = A.watch;
        m.$("[data-ac-hint]").hidden = false;
        const r = await api.myPack.watchCfContent(st.id, { kind, slug: pg.dataset.acSlug, url: pg.dataset.acPage });
        if (r?.ok && r.found) {
          pg.textContent = A.found;
          return afterAdd(r, false);
        }
        pg.disabled = false;
        pg.textContent = A.page;
        if (r?.ok === false) return packErr(r);
        return toast(A.lost);
      }
      const f = e.target.closest("[data-ac-file]");
      const b = e.target.closest("[data-ac-add]");
      if (!f && !b) return;
      (f || b).disabled = true;
      const how = f ? { from: "file" } : { from: src, slug: b.dataset.acAdd };
      const r = kind === "w" ? (f ? await api.myPack.importMap(st.id) : await api.myPack.addMap(st.id, how))
        : kind === "dp" ? await api.myPack.addDatapack(st.id, how)
        : await api.myPack.addContent(st.id, { kind, ...how });
      packErr(r);
      if (!r?.ok) return ((f || b).disabled = false);
      if (b) b.textContent = A.done;
      await afterAdd(r, !!f);
    });
    sync();
    if (src) show();
    m.$("[data-ac-q]")?.focus();
  }
  async function openDpModrinth(worldKey = null) {
    const st = packPage;
    const m = dpModal(pkT("dpMrT"), "Minecraft " + st.p.minecraftVersion, `<input type="search" class="play-in" data-dp-q placeholder="${esc(pkT("dpQ"))}" style="margin:8px;width:calc(100% - 16px);"><div data-dp-res></div>`, null);
    const show = async (q) => {
      const r = await api.myPack.searchDatapacks(st.id, q);
      m.$("[data-dp-res]").innerHTML = (r?.packs || []).map((x) => `<div class="play-row" style="align-items:center;"><span class="t"><b style="font-weight:600;">${esc(x.name)}</b><small>${esc(x.author)} · ${esc(x.downloads)}</small></span><button type="button" class="btn-secondary" data-dp-add="${esc(x.slug)}" style="margin:0;padding:4px 10px;font-size:12px;">${esc(pkT("dpMrAdd"))}</button></div>`).join("");
    };
    m.$("[data-dp-q]").addEventListener("input", (e) => show(e.target.value.trim()));
    m.ov.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-dp-add]");
      if (!b) return;
      b.disabled = true;
      const r = await api.myPack.addDatapack(st.id, { from: "mr", slug: b.dataset.dpAdd, worldKey });
      packErr(r);
      if (!r?.ok) return;
      if (worldKey) return (b.textContent = pkT("dpMrDone")), reloadPack();
      m.close();
      await reloadPack();
      openDpWorlds(r.file, true);
    });
    show("");
  }
  const packErr = (r) => r && r.ok === false && r.error && toast(pkT("wzFail", { e: r.error }));
  // Problèmes trouvés par le launcher (lecture des .jar : dépendances, versions minimales, chargeur,
  // mods CurseForge pas encore téléchargés, packs de ressources qui demandent un mod).
  // Data packs : Minecraft 1.13 et plus (29/10 : l'onglet s'affichait en 1.12.2). Les versions
  // datées (26.x), les snapshots et les noms inconnus gardent l'onglet.
  function dpSupported(mc) {
    const m = /^1\.(\d+)/.exec(String(mc || ""));
    return !m || Number(m[1]) >= 13;
  }
  function pkProblems(p) {
    return p.problems || [];
  }
  function pkProbText(x) {
    const a = x.a?.name || "?";
    const b = x.b?.name || "?";
    if (x.type === "rp") return pkT("rpMissing", { a: x.rp?.name, b });
    // Mod du pack lui-même pas encore téléchargé (29/10 : « Kanrommon a besoin de Kanrommon »).
    if (x.type === "cf") return pkT(a === b || !x.a ? "cfOwn" : "cfMissing", { a, b });
    if (x.type === "loader") return pkT("loaderBad", { a, l: LOADERS[x.loader] || x.loader, p: LOADERS[x.pack] || x.pack || "?" });
    if (x.type === "missing") return pkT("needMissing", { a, b });
    return pkT("needV", { a, av: x.a?.version || "", b, min: x.min || "", bv: x.have || x.b?.version || "" });
  }
  // Assistant « Corriger le pack » : une ligne par problème, avec la solution trouvée.
  // Modrinth (version ou mod manquant) : automatique. CurseForge : le joueur télécharge, le launcher
  // trouve le fichier dans Téléchargements et le vérifie. Rien n'est téléchargé depuis CurseForge.
  function openFixWizard() {
    const st = packPage;
    const p = st.p;
    const items = pkProblems(p).map((x) => {
      const f = x.fix;
      const title = pkProbText(x);
      if (f?.action === "cf") return { x, kind: !p.omni && (on("myPackCf") || p.kind === "cf") ? "cf" : "none", title, how: !p.omni && (on("myPackCf") || p.kind === "cf") ? pkT("wzCf") : pkT("wzNone"), state: "todo" };
      if (f?.action === "version") return { x, kind: "mr", title, how: pkT("wzMrVer", { b: x.b?.name, v: f.to }), state: "todo" };
      if (f?.action === "add") return { x, kind: "mr", title, how: pkT("wzMrAdd", { b: f.name, v: f.version }), state: "todo" };
      if (f?.action === "enable") return { x, kind: "mr", title, how: pkT("wzEnable", { b: x.b?.name }), state: "todo" };
      return { x, kind: "none", title, how: pkT(x.type === "version" ? "wzNoneV" : "wzNone"), state: "todo" };
    });
    // « Pas de solution automatique » (27/10) : le joueur cherche lui-même (Modrinth, CurseForge),
    // donne un .jar, ou coupe le mod qui demande. Rien n'est supprimé.
    const wzActions = (i, k) => {
      const x = i.x;
      const a = x.a?.name;
      const btn = (act, label, cls = "btn-secondary") => `<button type="button" class="${cls} wz-act" data-wz-act="${act}" data-k="${k}">${esc(label)}</button>`;
      let h = `<span class="wz-acts">`;
      if (x.type === "missing" || x.type === "rp") {
        h += btn("mr", "🔍 " + pkT("wzSrMr"));
        if (!packPage.p.omni && (on("myPackCf") || packPage.p.kind === "cf")) h += btn("cf", "🔍 " + pkT("wzSrCf"));
        if (!packPage.p.omni) h += btn("jar", "📁 " + pkT("wzJar"));
      }
      if (x.type === "version" && a) h += btn("ver", pkT("wzVer", { a }));
      if (a && x.type !== "rp") h += btn("off", pkT("wzOff", { a }), "link-btn wz-off");
      h += `</span>`;
      if (i.panel === "off") h += `<span class="wz-panel"><span>${esc(pkT("wzOffQ", { a }))}</span><span class="wz-panel-b">${btn("offGo", pkT("wzOffGo", { a }), "join-btn")}${btn("close", T("cancel"))}</span></span>`;
      if (i.panel === "ver") {
        const r = i.vers;
        const pp = packPage.p;
        h += `<span class="wz-panel"><span>${esc(pkT("wzVerT", { a, v: pp.minecraftVersion, l: LOADERS[pp.loader] || pp.loader || "?" }))}</span>
          ${r == null ? `<small>${esc(pkT("wzWorking"))}</small>` : r.length < 2 ? `<small>${esc(pkT("wzVerNone", { a }))}</small>` : `<span class="wz-vers">${r.slice(0, 8).map((f, j) => `<span class="wz-ver"><code>${esc(f.fileName)}</code>${f.current ? `<span class="cur">${esc(pkT("wzVerCur"))}</span>` : i.verWait === j ? `<span class="cur">${esc(pkT("wzWait"))}</span>` : `<button type="button" class="btn-secondary" data-wz-vf="${k}:${j}">${esc(pkT("cfOpen"))} ↗</button>`}</span>`).join("")}</span>`}
          ${i.wrong && i.verWait != null ? `<span class="wz-wrong" role="alert">✗ ${codeIn(pkT("wzCfWrong", { w: "\u0001w\u0001", f: "\u0001f\u0001" }), { w: i.wrong, f: r?.[i.verWait]?.fileName || "" })}</span>` : ""}
          <small>${esc(pkT("wzVerTip", { a, b: x.b?.name || "?", h: x.have || x.b?.version || "" }))}</small>
          <span class="wz-panel-b">${btn("close", pkT("wzBack"))}</span></span>`;
      }
      if (i.panel === "mr" || i.panel === "cf") {
        const r = i.res;
        h += `<span class="wz-panel"><span class="wz-sr"><input type="search" data-wz-q="${k}" value="${esc(i.q)}" placeholder="${esc(pkT("wzSrPh"))}"><span class="wz-src ${i.panel}">${i.panel === "mr" ? "Modrinth" : "CurseForge"}</span></span>
          ${x.depId ? `<small>${esc(pkT("wzSrTip", { d: x.depId }))}</small>` : ""}
          ${r == null ? `<small>${esc(pkT("wzWorking"))}</small>` : !r.length ? `<small>${esc(pkT("wzSrNone"))}</small>` : `<span class="wz-res">${r.slice(0, 5).map((m, j) => `<span class="wz-hit">
            ${m.icon ? `<img src="${esc(m.icon)}" alt="">` : `<span class="wz-ph">${esc((m.name || "?")[0])}</span>`}
            <span class="t"><b>${esc(m.name)}</b><small>${esc([m.author, m.downloads].filter(Boolean).join(" · "))}</small></span>
            ${i.panel === "cf" ? `<button type="button" class="btn-secondary" data-wz-hit="${k}:${j}">${esc(pkT("cfOpen"))} ↗</button>`
              : m.compatible === false ? `<span class="bad">${esc(pkT("wzSrBad", { v: packPage.p.minecraftVersion }))}</span>`
              : `<button type="button" class="join-btn" data-wz-hit="${k}:${j}">${esc(pkT("wzSrAdd"))}</button>`}</span>`).join("")}</span>`}
          <span class="wz-panel-b">${btn("close", pkT("wzBack"))}</span></span>`;
      }
      return h;
    };
    const wzSearch = async (i) => {
      i.res = null;
      draw();
      const p = packPage.p;
      const r = i.panel === "mr" ? await api.myPack.searchModrinth(i.q, { mc: p.minecraftVersion, loader: p.loader }) : await api.myPack.searchCurseForge(i.q, { mc: p.minecraftVersion, loader: p.loader });
      i.res = Array.isArray(r) ? r : r?.mods || [];
      draw();
      root.querySelector(`[data-wz-q="${items.indexOf(i)}"]`)?.focus();
    };
    // Fichier CurseForge à prendre (30/10, Rushi : « il ouvre la page normale, pas celle de la bonne
    // version ») : le launcher cherche le fichier exact pour cette version de Minecraft et ce chargeur.
    // S'il n'y en a aucun, la ligne propose les autres solutions au lieu d'envoyer sur CurseForge.
    for (const i of items.filter((x) => x.kind === "cf" && x.x.fix?.modId)) {
      i.look = true;
      api.myPack.cfTarget(st.id, i.x).then((r) => {
        i.look = false;
        if (r?.none) {
          i.kind = "none";
          i.how = pkT("wzCfNoV", { b: i.x.b?.name || "?", v: packPage.p.minecraftVersion, l: LOADERS[packPage.p.loader] || packPage.p.loader || "?" });
        } else if (r?.fileName) i.file = r.fileName;
        draw();
      }, () => ((i.look = false), draw()));
    }
    const offWrong = api.myPack.onCfWrong?.((w) => {
      const i = items.find((x) => x.state !== "done" && ((x.kind === "cf" && x.x.fix?.modId === w.modId) || (x.verWait != null && x.x.a?.id === w.modId)));
      if (!i) return;
      i.wrong = w.fileName;
      draw();
    });
    const codeIn = (t, vals) => esc(t).replace(/\u0001(\w)\u0001/g, (_, k) => `<code>${esc(vals[k] || "")}</code>`);
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="wz-t" style="max-width:600px;text-align:left;max-height:calc(100vh - 48px);overflow:auto;"><div id="wz-root"></div></div>`);
    const root = m.$("#wz-root");
    let started = false;
    const draw = () => {
      const allDone = items.every((i) => i.state === "done" || i.kind === "none");
      root.innerHTML = `<h3 id="wz-t">🔧 ${esc(pkT("wzT"))}</h3>
        <p class="pk-note">${esc(pkT("wzD"))}</p>
        <div class="wz-list">${items.map((i, k) => `<div class="wz-row ${i.state === "done" ? "done" : ""}">
          <span class="ic">${i.state === "done" ? "✓" : "⚠"}</span>
          <span><b>${esc(i.title)}</b><span class="how ${i.kind}">→ ${esc(i.how)}</span>${i.kind === "cf" && i.state !== "done" && (i.file || i.look) ? `<small class="wz-file">${i.file ? `${esc(pkT("wzCfFile"))} <code>${esc(i.file)}</code>` : esc(pkT("wzCfLook"))}</small>` : ""}${i.kind === "cf" && started && i.state !== "done" ? `<small>${esc(pkT("wzManD"))}</small>` : ""}${i.kind === "cf" && i.wrong && i.state !== "done" ? `<span class="wz-wrong" role="alert">✗ ${codeIn(pkT("wzCfWrong", { w: "\u0001w\u0001", f: "\u0001f\u0001" }), { w: i.wrong, f: i.file || i.x.b?.name || "" })}</span>` : ""}${i.kind === "none" && i.state !== "done" ? wzActions(i, k) : ""}</span>
          <span class="wz-st ${i.state === "done" ? "ok" : ""}">${i.state === "done" ? esc(i.doneText || (i.kind === "cf" ? pkT("wzFound") : pkT("wzDoneRow")))
            : i.state === "run" ? esc(pkT("wzWorking"))
            : i.state === "wait" ? `<span style="color:var(--muted);font-weight:500;">${esc(pkT("wzWait"))}</span>`
            : i.kind === "cf" && started ? `<span style="color:var(--muted);font-weight:500;">${esc(pkT("wzWait"))}</span><button type="button" class="btn-secondary" data-wz-cf="${k}" style="margin:0;padding:4px 10px;font-size:12px;">${esc(pkT("cfOpen"))} ↗</button>`
            : i.state === "fail" ? `<span style="color:var(--warn);">${esc(i.err || "")}</span>`
            : i.kind === "none" ? `<span class="wz-tag hand">${esc(pkT("wzHand"))}</span>`
            : `<span class="wz-tag ${i.kind === "cf" ? "hand" : "auto"}">${esc(i.kind === "cf" ? pkT("wzHand") : pkT("wzAuto"))}</span>`}</span></div>`).join("")}</div>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;">
          ${allDone ? "" : `<button type="button" class="btn-secondary" id="wz-later">${esc(started ? pkT("wzLater") : T("cancel"))}</button>`}
          ${started ? `<button type="button" class="join-btn" id="wz-ok" ${allDone ? "" : "disabled"}>${esc(pkT("wzValidate"))}</button>` : `<button type="button" class="join-btn" id="wz-go">${esc(pkT("wzGo"))}</button>`}
        </div>`;
    };
    const close = () => {
      offWrong?.();
      m.close();
      reloadPack();
    };
    root.addEventListener("keydown", (e) => {
      const inp = e.target.closest("[data-wz-q]");
      if (!inp || e.key !== "Enter") return;
      const i = items[Number(inp.dataset.wzQ)];
      i.q = inp.value.trim();
      wzSearch(i);
    });
    root.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.id === "wz-later") return close();
      if (b.id === "wz-ok") {
        toast(pkT("wzOk"));
        return close();
      }
      if (b.id === "wz-go") {
        started = true;
        for (const i of items) if (i.kind === "mr") i.state = "run";
        draw();
        for (const i of items.filter((x) => x.kind === "mr")) {
          const r = await api.myPack.fix(st.id, i.x);
          if (r?.ok === false) {
            i.state = "fail";
            i.err = pkT("wzFail", { e: r.error || "?" });
          } else i.state = "done";
          draw();
        }
        return;
      }
      if (b.dataset.wzAct != null) {
        const i = items[Number(b.dataset.k)];
        const act = b.dataset.wzAct;
        if (act === "close") i.panel = null;
        else if (act === "off") i.panel = "off";
        else if (act === "offGo") {
          i.state = "run";
          draw();
          const r = await api.myPack.setMod(st.id, i.x.a.id, { on: false });
          if (r?.ok === false) (i.state = "fail"), (i.err = pkT("wzFail", { e: r.error || "?" }));
          else (i.state = "done"), (i.doneText = pkT("wzOffDone", { a: i.x.a.name }));
        } else if (act === "jar") {
          const r = await api.myPack.addJar(st.id, { depId: i.x.depId || null });
          if (r?.ok) {
            i.state = "done";
            i.doneText = pkT("wzJarDone");
            if (r.matches === false) toast(pkT("wzJarOther", { f: r.name, d: i.x.depId }));
          } else if (r && !r.cancelled) packErr(r);
        } else if (act === "ver" && i.x.a?.source === "cf") {
          i.panel = "ver";
          i.vers = null;
          draw();
          const r = await api.myPack.cfFiles(st.id, i.x.a.id);
          i.vers = r?.files || [];
        } else if (act === "ver") {
          m.close();
          return openPackPage(st.id);
        } else if (act === "mr" || act === "cf") {
          i.panel = act;
          i.q = i.q || i.x.b?.name || i.x.depId || "";
          return wzSearch(i);
        }
        return draw();
      }
      if (b.dataset.wzHit != null) {
        const [k, j] = b.dataset.wzHit.split(":").map(Number);
        const i = items[k];
        const hit = i.res[j];
        b.disabled = true;
        if (i.panel === "mr") {
          i.state = "run";
          draw();
          const r = await api.myPack.add(st.id, [{ slug: hit.slug, version: hit.versions?.[0]?.v || null }]);
          if (r?.ok === false) (i.state = "fail"), (i.err = pkT("wzFail", { e: r.error || "?" }));
          else (i.state = "done"), (i.doneText = pkT("wzAdded") + " " + hit.name);
        } else {
          i.state = "wait";
          draw();
          const r = await api.myPack.openCurseForge({ packId: st.id, modId: hit.projectId ? `cf-${hit.projectId}` : undefined, slug: hit.slug, projectId: hit.projectId, fileId: hit.fileId, fileName: hit.fileName, pageUrl: hit.pageUrl, name: hit.name, depId: i.x.depId || null });
          i.state = r?.found ? "done" : "todo";
          if (r?.found) i.doneText = pkT("wzFound");
        }
        return draw();
      }
      if (b.dataset.wzVf != null) {
        const [k, j] = b.dataset.wzVf.split(":").map(Number);
        const i = items[k];
        const f = i.vers[j];
        i.verWait = j;
        i.wrong = null;
        draw();
        const r = await api.myPack.openCurseForge({ packId: st.id, modId: i.x.a.id, fileId: f.fileId, fileName: f.fileName, pageUrl: f.pageUrl });
        i.verWait = null;
        if (r?.found) (i.state = "done"), (i.panel = null), (i.doneText = pkT("wzVerDone", { a: i.x.a.name, f: f.fileName }));
        return draw();
      }
      if (b.dataset.wzCf != null) {
        const i = items[Number(b.dataset.wzCf)];
        b.disabled = true;
        const f = i.x.fix || {};
        const r = await api.myPack.openCurseForge(f.modId ? { packId: st.id, modId: f.modId } : { packId: st.id, depId: i.x.depId || f.search, name: i.x.b?.name });
        if (r?.found) i.state = "done";
        draw();
      }
    });
    draw();
  }

  // --- Pack Omniscient (27/10, preview v22) : menu ⚙, générer, exporter, barre des versions -------------
  const OMT = () => (L() === "en" ? {
    gear: "Pack settings", exp: "Export", friend: "👥 For a friend", friendD: "A .mrpack file: they import it in Omniscient, Modrinth App or Prism",
    omni: "⬆ For Omniscient", omniD: ".omnipack file, every version, to be published", gen: "⚙ Generate for other versions", genD: "Do it before exporting for Omniscient",
    genT: "⚙ Generate for other versions", genSubM: "“{n}” works in {v}. The launcher looks for the same mods on Modrinth for other Minecraft versions and makes one pack per version.",
    genSubV: "“{n}” is in {v}. The launcher makes the same vanilla version for other Minecraft versions, with your resource packs and data packs.",
    vers: "Versions", yours: "your pack", addV: "Add an installation", findV: "Search a version (e.g. 1.19)", none: "No version.", allIn: "Every version is already added.",
    addAll: "Add all ({n})", close: "Close", plusNote: "“+” shows every version where {l} exists.", keepT: "Mods to keep no matter what", must: "required",
    keepNote: "If a ticked mod does not exist for a version, that version is not created. Other missing mods are simply removed (with the mods that need them), so the pack still starts.",
    vanNote: "Worlds (your map) are not copied: a map is made for one version and could get damaged. If a resource pack or data pack is made for another version, Minecraft may show “incompatible”.",
    cancel: "Cancel", go: "Generate {n} version(s)", started: "Generation started. You can keep using the launcher.",
    jRun: "⚙ Generating: {d} / {n} versions", jDone: "✓ Generation finished", jStop: "Generation stopped", jSlow: "One version at a time, without overloading Modrinth",
    det: "Show details ▾", detHide: "Hide details ▴", stop: "Stop", openV: "Open", wait: "Waiting", run: "Searching mods on Modrinth…",
    kSame: "Already up to date: nothing to redo", kUpd: "Updated: added {m} (the rest is kept)", kOk: "Complete", kPart: "Created without {m}", kNo: "Not created: {m} {x} not exist in {v}", kNoL: "Not created: no {l} for {v}", kErr: "Not created: {e}",
    sSame: "up to date", sUpd: "updated", sOk: "complete", sPart: "without some mods", sNo: "not created", jNote: "The new versions are in the “Pack versions” bar above (a single tile in Play). Play each one once to test it.",
    staleN: "{n} version(s) already in the pack no longer follow it (a required mod does not exist for them): {l}.", staleB: "Remove them from the pack",
    staleT: "Remove {n} version(s) from the pack?", staleD: "These versions no longer have the pack's required mods: {l}. They are removed from the pack and from Play.", staleW: "Also remove their {n} world(s) (otherwise they stay in “See all my worlds”)",
    staleOk: "{n} version(s) removed from the pack.",
    inst: "Installation", renD: "The new name applies to every version of the pack", rmB: "Remove…", rmD: "The whole pack, or the versions you pick",
    rmT: "Remove “{n}”?", rmAll: "The whole pack ({n} versions)", rmAllD: "Recommended: the tile leaves Play.", rmPick: "Pick the versions to remove", rmPickD: "The others stay in the pack.",
    rmSel: "{n} / {t} selected", rmEvery: "Select all", rmNone: "Select none",
    rmBase: "Version {v} (your pack) is removed but not the others: the pack tile will show another version.",
    rmW: "Also remove their {n} world(s)", rmWNo: "Worlds are kept: you find them in “See all my worlds”.", rmWYes: "Checked worlds go to the Windows Recycle Bin, with their backups.",
    rmGoAll: "Remove the whole pack", rmGo: "Remove {n} version(s)", rmOk: "{n} version(s) removed.",
    barT: "Pack versions", barN: "{t} / {n} tested", tested: "✓ tested", toTest: "to test", partT: "Created without some mods",
    barHint: "Play each version once (“Play”): when the game closes without crashing, it becomes “tested”. Not required, but advised before exporting for Omniscient.", barAll: "Every version has been tested. You can export for Omniscient.",
    exT: "⬆ Export for Omniscient", exSubM: "One file with every version of the pack. It only holds the Modrinth mod list and the settings (no .jar), so it is light.", exSubV: "One file with every version of the pack. For a map, the world is included.",
    inc: "What is included", mods: "Mods (Modrinth)", modsD: "{n} mods, the exact version for each Minecraft version", cfg: "Pack settings", cfgD: "config, options.txt",
    rp: "Resource packs and shaders", rpV: "Resource packs", rpD: "Modrinth link when it exists, otherwise the file", dp: "Data packs", dpD: "with, for each, the worlds where it is on",
    w: "Worlds", wD: "tick the ones to include; the others stay on your PC", noW: "No world in this pack.", next: "Next", s1: "You send the file to Omniscient (on the site: “Submit a pack”).", s2: "Rushi imports it in the site admin, tests it, then publishes it.", s3: "It appears in the launcher's official packs.",
    save: "Save the file", saved: "“{n}” saved ({s}).", untested: "{n} version(s) not tested yet. You can still export.",
    frT: "👥 Export for a friend", frSub: "A .mrpack file (Modrinth's format). Your friend opens it with “Import… › A pack” in Omniscient, or in Modrinth App / Prism.",
    frMods: "Modrinth mods", frModsD: "always included: your friend downloads them from Modrinth", frW: "Worlds", frWD: "tick only if you want to give a copy of your world", frCf: "CurseForge mods are never put in the file: a text file lists them with their page.",
    frManual: "{n} mod(s) not on Modrinth are listed in “omniscient-a-telecharger.txt”.", light: "light", vanilla: "Vanilla",
  } : {
    gear: "Paramètres du pack", exp: "Exporter", friend: "👥 Pour un ami", friendD: "Fichier .mrpack : il l'importe dans Omniscient, Modrinth App ou Prism",
    omni: "⬆ Pour Omniscient", omniD: "Fichier .omnipack, toutes les versions, pour être publié", gen: "⚙ Générer pour d'autres versions", genD: "À faire avant d'exporter pour Omniscient",
    genT: "⚙ Générer pour d'autres versions", genSubM: "Le pack « {n} » marche en {v}. Le launcher cherche les mêmes mods sur Modrinth pour d'autres versions de Minecraft et crée un pack par version.",
    genSubV: "« {n} » est en {v}. Le launcher crée la même version vanilla pour d'autres versions de Minecraft, avec tes packs de ressources et tes data packs.",
    vers: "Versions", yours: "ton pack", addV: "Ajouter une installation", findV: "Chercher une version (ex. 1.19)", none: "Aucune version.", allIn: "Toutes les versions sont déjà ajoutées.",
    addAll: "Ajouter toutes ({n})", close: "Fermer", plusNote: "« + » montre toutes les versions où {l} existe.", keepT: "Mods à garder à tout prix", must: "obligatoire",
    keepNote: "Si un mod coché n'existe pas pour une version, cette version n'est pas créée. Les autres mods qui manquent sont simplement retirés (avec les mods qui en ont besoin), pour que le pack démarre quand même.",
    vanNote: "Les mondes (ta map) ne sont pas copiés : une map est faite pour une version précise et pourrait s'abîmer. Si un pack de ressources ou un data pack est fait pour une autre version, Minecraft peut afficher « incompatible ».",
    cancel: "Annuler", go: "Générer {n} version(s)", started: "Génération lancée. Tu peux continuer à utiliser le launcher.",
    jRun: "⚙ Génération : {d} / {n} versions", jDone: "✓ Génération terminée", jStop: "Génération arrêtée", jSlow: "Une version à la fois, sans surcharger Modrinth",
    det: "Voir le détail ▾", detHide: "Masquer le détail ▴", stop: "Arrêter", openV: "Ouvrir", wait: "En attente", run: "Recherche des mods sur Modrinth…",
    kSame: "Déjà à jour : rien à refaire", kUpd: "Mise à jour : ajout de {m} (le reste est gardé)", kOk: "Complet", kPart: "Créé sans {m}", kNo: "Pas créé : {m} {x} pas en {v}", kNoL: "Pas créé : pas de {l} pour {v}", kErr: "Pas créé : {e}",
    sSame: "déjà à jour", sUpd: "mises à jour", sOk: "complètes", sPart: "sans quelques mods", sNo: "pas créées", jNote: "Les nouvelles versions sont dans la barre « Versions du pack » ci-dessus (une seule tuile dans Jouer). Lance chacune une fois pour la tester.",
    staleN: "{n} version(s) déjà dans le pack ne le suivent plus (un mod obligatoire n'existe pas pour elles) : {l}.", staleB: "Les retirer du pack",
    staleT: "Retirer {n} version(s) du pack ?", staleD: "Ces versions n'ont plus les mods obligatoires du pack : {l}. Elles sont retirées du pack et de Jouer.", staleW: "Retirer aussi leurs {n} monde(s) (sinon ils restent dans « Voir tous mes mondes »)",
    staleOk: "{n} version(s) retirée(s) du pack.",
    inst: "Installation", renD: "Le nouveau nom vaut pour toutes les versions du pack", rmB: "Retirer…", rmD: "Tout le pack, ou les versions de ton choix",
    rmT: "Retirer « {n} » ?", rmAll: "Tout le pack ({n} versions)", rmAllD: "Conseillé : la tuile disparaît de Jouer.", rmPick: "Choisir les versions à retirer", rmPickD: "Les autres restent dans le pack.",
    rmSel: "{n} / {t} sélectionnée(s)", rmEvery: "Tout sélectionner", rmNone: "Tout désélectionner",
    rmBase: "La version {v} (ton pack) est retirée mais pas les autres : la tuile du pack affichera une autre version.",
    rmW: "Retirer aussi leurs {n} monde(s)", rmWNo: "Les mondes sont gardés : tu les retrouves dans « Voir tous mes mondes ».", rmWYes: "Les mondes cochés partent à la Corbeille de Windows, avec leurs sauvegardes.",
    rmGoAll: "Retirer tout le pack", rmGo: "Retirer {n} version(s)", rmOk: "{n} version(s) retirée(s).",
    barT: "Versions du pack", barN: "{t} / {n} testées", tested: "✓ testée", toTest: "à tester", partT: "Créée sans quelques mods",
    barHint: "Lance chaque version une fois (« Jouer ») : quand le jeu se ferme sans planter, elle passe en « testée ». Pas obligatoire, mais conseillé avant d'exporter pour Omniscient.", barAll: "Toutes les versions ont été testées. Tu peux exporter pour Omniscient.",
    exT: "⬆ Exporter pour Omniscient", exSubM: "Un seul fichier avec toutes les versions du pack. Il ne contient que la liste des mods Modrinth et les réglages (pas de .jar), donc il est léger.", exSubV: "Un seul fichier avec toutes les versions du pack. Pour une map, le monde est inclus.",
    inc: "Ce qui est inclus", mods: "Mods (Modrinth)", modsD: "{n} mods, version exacte pour chaque version de Minecraft", cfg: "Réglages du pack", cfgD: "config, options.txt",
    rp: "Packs de ressources et shaders", rpV: "Packs de ressources", rpD: "lien Modrinth quand il existe, sinon le fichier", dp: "Data packs", dpD: "avec, pour chacun, les mondes où il est activé",
    w: "Mondes", wD: "coche ceux à mettre dans le fichier ; les autres restent chez toi", noW: "Aucun monde dans ce pack.", next: "Ensuite", s1: "Tu envoies le fichier à Omniscient (sur le site : « Proposer un pack »).", s2: "Rushi l'importe dans le panneau admin du site, le teste, puis le publie.", s3: "Il apparaît dans les packs officiels du launcher.",
    save: "Enregistrer le fichier", saved: "« {n} » enregistré ({s}).", untested: "{n} version(s) pas encore testée(s). Tu peux quand même exporter.",
    frT: "👥 Exporter pour un ami", frSub: "Un fichier .mrpack (le format de Modrinth). Ton ami l'ouvre avec « Importer… › Un pack » dans Omniscient, ou dans Modrinth App / Prism.",
    frMods: "Mods Modrinth", frModsD: "toujours inclus : ton ami les télécharge depuis Modrinth", frW: "Mondes", frWD: "coche seulement si tu veux lui donner une copie de ton monde", frCf: "Les mods CurseForge ne sont jamais mis dans le fichier : un petit fichier texte les liste avec leur page.",
    frManual: "{n} mod(s) hors Modrinth sont listés dans « omniscient-a-telecharger.txt ».", light: "léger", vanilla: "Vanilla",
  });
  const omT = (k, vars = {}) => String(OMT()[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => vars[x] ?? "");
  let omJob = null;
  let omJobOpen = false;
  api.omniPack?.job?.().then((r) => r?.ok && (omJob = r.job)).catch(() => {});
  api.omniPack?.onJob?.((job) => {
    const wasDone = omJob?.done;
    omJob = job;
    if (!packPage) return;
    const el = panel.querySelector(".om-job");
    if (el) el.outerHTML = omJobHtml();
    else drawPackPage();
    if (job?.done && !wasDone) refresh().then(reloadPack);
  });
  // Menu ⚙ de l'en-tête : exporter pour un ami (packExport), pour Omniscient et générer (omniPack).
  function omGearHtml(p) {
    const friend = on("packExport");
    const omni = !!p.omni && on("omniPack") && p.kind !== "omnipub";
    // 29/10 (Rushi) : « Renommer » et « Retirer » aussi ici, pour toute installation.
    return `<span class="om-exp"><button type="button" class="btn-secondary om-gear" data-om="menu" aria-haspopup="true" aria-label="${esc(omT("gear"))}" title="${esc(omT("gear"))}">⚙</button>
      <div class="om-menu" hidden>${friend || omni ? `<div class="om-mh">${esc(omT("exp"))}</div>` : ""}
        ${friend ? `<button type="button" data-om="friend"><b>${esc(omT("friend"))}</b><small>${esc(omT("friendD"))}</small></button>` : ""}
        ${omni ? `<button type="button" data-om="export"><b>${esc(omT("omni"))}</b><small>${esc(omT("omniD"))}</small></button><hr><button type="button" data-om="gen"><b>${esc(omT("gen"))}</b><small>${esc(omT("genD"))}</small></button>` : ""}
        ${on("cloudPacks") && !p.vanilla ? `${friend || omni ? "<hr>" : ""}<div class="om-mh">${esc(rmTr("Mon cloud", "My cloud"))}</div><button type="button" data-om="cloud"><b>☁ ${esc(rmTr("Envoyer dans le cloud", "Send to the cloud"))}</b><small>${esc(rmTr("Pour le relier à ton serveur sur le site", "To link it to your server on the website"))}</small></button>` : ""}
        ${friend || omni || (on("cloudPacks") && !p.vanilla) ? "<hr>" : ""}<div class="om-mh">${esc(omT("inst"))}</div>
        ${on("packRam") && packPage ? (() => { const c = rmCtxOf(packPage.id), st = rmStOf(packPage.id), v = rmValue(st, c), tn = rmVerdict(v, c)[0]; return `<button type="button" data-om="ram"><b>🧠 ${esc(rmTr("Mémoire (RAM)", "Memory (RAM)"))}${tn === "warn" || tn === "bad" ? " ⚠" : ""}</b><small>${esc(`${rmGo(v)} · ${rmModeName(st.mode)}`)}</small></button>`; })() : ""}
        <button type="button" data-om="rename"><b>✎ ${esc(T("rename"))}</b>${p.omni ? `<small>${esc(omT("renD"))}</small>` : ""}</button>
        <button type="button" data-om="remove" style="color:var(--danger,#e5484d);"><b>🗑 ${esc(omT("rmB"))}</b>${(p.omni?.versions || []).length > 1 ? `<small>${esc(omT("rmD"))}</small>` : ""}</button></div></span>`;
  }
  function omBarHtml(p) {
    const vs = p.omni?.versions || [];
    if (vs.length < 2 || !on("omniPack")) return "";
    const t = vs.filter((x) => x.tested).length;
    return `<div class="om-sw"><span class="om-swl">${esc(omT("barT"))} <small>${esc(omT("barN", { t, n: vs.length }))}</small></span>
      <span class="om-swr">${vs.map((x) => `<button type="button" data-om-sw="${esc(x.id)}" class="om-sv${x.id === packPage.id ? " on" : ""}">${esc(x.mc)}<small class="${x.tested ? "ok" : ""}">${esc(x.tested ? omT("tested") : omT("toTest"))}</small>${(x.missing || []).length ? `<i title="${esc(omT("partT"))}">⚠</i>` : ""}</button>`).join("")}</span>
      <span class="om-swn"${t === vs.length ? ' style="color:var(--success)"' : ""}>${esc(t < vs.length ? omT("barHint") : omT("barAll"))}</span></div>`;
  }
  function omRow(r) {
    const d = r.kind === "same" ? omT("kSame") : r.kind === "upd" ? omT("kUpd", { m: (r.added || []).join(", ") }) : r.kind === "ok" ? omT("kOk") : r.kind === "part" ? omT("kPart", { m: (r.miss || []).join(", ") })
      : r.error ? omT("kErr", { e: r.error }) : r.noLoader ? omT("kNoL", { l: LOADERS[packPage?.p?.loader] || "", v: r.mc }) : omT("kNo", { m: (r.keepMiss || []).join(L() === "en" ? " and " : " et "), x: L() === "en" ? ((r.keepMiss || []).length > 1 ? "do" : "does") : ((r.keepMiss || []).length > 1 ? "n'existent" : "n'existe"), v: r.mc });
    const i = { same: "=", upd: "↻", ok: "✓", part: "⚠", no: "✕" }[r.kind] || "✕";
    return `<div class="om-row ${r.kind}"><span class="i">${i}</span><span class="v">${esc(r.mc)}</span><span class="d">${esc(d)}</span>${r.id && r.kind !== "no" ? `<button type="button" class="btn-secondary" data-om-open="${esc(r.id)}" style="margin:0;padding:3px 9px;font-size:11.5px;">${esc(omT("openV"))}</button>` : "<span></span>"}</div>`;
  }
  function omJobHtml() {
    const J = omJob;
    if (!J || !packPage || !packPage.p.omni || (J.baseId !== packPage.id && !(packPage.p.omni.versions || []).some((x) => x.id === J.baseId))) return "";
    const d = J.results.length;
    const n = (k) => J.results.filter((r) => r.kind === k).length;
    const fin = J.done;
    const pct = Math.round((d / Math.max(1, J.list.length)) * 100);
    const rows = [...J.results.map(omRow), ...J.list.slice(d).map((mc, i) => `<div class="om-row run"><span class="i">${i === 0 && J.running ? "…" : "·"}</span><span class="v">${esc(mc)}</span><span class="d">${esc(i === 0 && J.running ? omT("run") : omT("wait"))}</span><span></span></div>`)];
    return `<div class="om-job"><div class="om-jtop"><b>${esc(fin ? (J.stopped ? omT("jStop") : omT("jDone")) : omT("jRun", { d, n: J.list.length }))}</b>
        <span class="om-jsum">${fin ? [[n("same"), "sSame", ""], [n("upd"), "sUpd", "var(--accent)"], [n("ok"), "sOk", "var(--success)"], [n("part"), "sPart", "var(--warn)"], [n("no"), "sNo", ""]].filter((x) => x[0]).map((x) => `<span style="color:${x[2] || "inherit"}">${x[0]} ${esc(omT(x[1]))}</span>`).join(" · ") : esc(omT("jSlow"))}</span>
        <span class="om-jacts"><button type="button" class="link-btn" data-om="det" style="margin:0;font-size:12px;">${esc(omJobOpen ? omT("detHide") : omT("det"))}</button>${fin ? `<button type="button" class="btn-secondary" data-om="jx" style="margin:0;padding:3px 10px;font-size:12px;">${esc(omT("close"))}</button>` : `<button type="button" class="btn-secondary" data-om="jstop" style="margin:0;padding:3px 10px;font-size:12px;">${esc(omT("stop"))}</button>`}</span></div>
      ${fin ? "" : `<div class="om-bar"><span style="width:${pct}%"></span></div>`}
      ${omJobOpen ? `<div class="om-rep om-jlist">${rows.join("")}</div>${fin ? `<p class="om-note">${esc(omT("jNote"))}</p>` : ""}` : ""}
      ${fin && omStale(J).length ? `<p class="om-note om-stale" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--warn);">${esc(omT("staleN", { n: omStale(J).length, l: omStale(J).map((x) => x.minecraftVersion).join(", ") }))}<button type="button" class="btn-secondary" data-om="stale" style="margin:0;padding:3px 10px;font-size:12px;">${esc(omT("staleB"))}</button></p>` : ""}</div>`;
  }
  // 28/10 (Rushi) : après une régénération avec des mods obligatoires, les versions déjà générées où
  // ces mods n'existent pas restaient dans le pack. On les propose au retrait (jamais retirées seules).
  // Retirer depuis le menu ⚙ (29/10, Rushi : « ça supprime la version sélectionnée, pas tout le pack »).
  // Pack Omniscient avec plusieurs versions : tout le pack (conseillé) ou les versions choisies. Leurs
  // mondes restent (case pour les retirer aussi). Installation simple : la fenêtre habituelle.
  async function omRemovePack(id) {
    const v = data.versions.find((x) => x.id === id);
    if (!v) return;
    const vs = [...pjGroup(v)].sort((a, b) => (b.omni?.base ? 1 : 0) - (a.omni?.base ? 1 : 0) || pkCmp(b.minecraftVersion, a.minecraftVersion));
    if (vs.length < 2) {
      await removeVersion(id);
      if (!data.versions.some((x) => x.id === id)) { packPage = null; render(); }
      return;
    }
    const wOf = (x) => data.worlds.filter((w) => w.home === x.id || w.lastVersionId === x.id);
    const st = { all: true, pick: new Set(vs.map((x) => x.id)), worlds: false };
    const m = overlay(`<div class="modal-box pop-in om-rm" role="dialog" aria-modal="true" style="max-width:520px;text-align:left;"></div>`);
    const box = m.$(".om-rm");
    const draw = () => {
      const chosen = st.all ? vs : vs.filter((x) => st.pick.has(x.id));
      const nW = chosen.reduce((n, x) => n + wOf(x).length, 0);
      const base = vs.find((x) => x.omni?.base);
      const keepBase = !st.all && base && st.pick.has(base.id) && chosen.length < vs.length;
      box.innerHTML = `<h3>${esc(omT("rmT", { n: pjName(v) }))}</h3>
        <label class="om-rmopt${st.all ? " on" : ""}"><input type="radio" name="om-rm" data-all="1" ${st.all ? "checked" : ""}><span><b>${esc(omT("rmAll", { n: vs.length }))}</b><small>${esc(omT("rmAllD"))}</small></span></label>
        <label class="om-rmopt${st.all ? "" : " on"}"><input type="radio" name="om-rm" data-all="0" ${st.all ? "" : "checked"}><span><b>${esc(omT("rmPick"))}</b><small>${esc(omT("rmPickD"))}</small></span></label>
        ${st.all ? "" : `<div class="om-rmlist"><div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px 6px;"><small style="color:var(--muted)">${esc(omT("rmSel", { n: chosen.length, t: vs.length }))}</small><button type="button" class="link-btn" data-tog style="margin:0;font-size:12px;">${esc(chosen.length === vs.length ? omT("rmNone") : omT("rmEvery"))}</button></div>
          ${vs.map((x) => `<label class="om-rmv"><input type="checkbox" data-v="${esc(x.id)}" ${st.pick.has(x.id) ? "checked" : ""}><b>${esc(x.minecraftVersion)}</b><small>${esc([x.omni?.base ? omT("yours") : x.omni?.tested ? omT("tested") : omT("toTest"), PJT().nW(wOf(x).length)].join(" · "))}</small></label>`).join("")}</div>`}
        ${keepBase ? `<p class="om-note" style="color:var(--warn)">${esc(omT("rmBase", { v: base.minecraftVersion }))}</p>` : ""}
        ${nW ? `<label class="om-rmw"><input type="checkbox" data-w ${st.worlds ? "checked" : ""}> ${esc(omT("rmW", { n: nW }))}</label>` : ""}
        <p class="om-note">${esc(nW && st.worlds ? omT("rmWYes") : omT("rmWNo"))}</p>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;"><button type="button" class="btn-secondary" data-x>${esc(T("cancel"))}</button>
          <button type="button" class="join-btn" data-go style="background:var(--danger,#e5484d);border-color:var(--danger,#e5484d);" ${chosen.length ? "" : "disabled"}>${esc(st.all ? omT("rmGoAll") : omT("rmGo", { n: chosen.length }))}</button></div>`;
    };
    draw();
    box.addEventListener("change", (e) => {
      const t = e.target;
      if (t.dataset.all) st.all = t.dataset.all === "1";
      else if (t.dataset.v) t.checked ? st.pick.add(t.dataset.v) : st.pick.delete(t.dataset.v);
      else if ("w" in t.dataset) st.worlds = t.checked;
      draw();
    });
    box.addEventListener("click", async (e) => {
      if (e.target.closest("[data-tog]")) {
        if (st.pick.size === vs.length) st.pick.clear();
        else vs.forEach((x) => st.pick.add(x.id));
        return draw();
      }
      if (e.target.closest("[data-x]")) return m.close();
      const go = e.target.closest("[data-go]");
      if (!go) return;
      go.disabled = true;
      const chosen = st.all ? vs : vs.filter((x) => st.pick.has(x.id));
      let n = 0;
      for (const x of chosen) {
        const keys = st.worlds ? wOf(x).map((w) => w.key) : [];
        const r = await api.removeVersion(x.id, keys).catch(() => null);
        if (r?.ok) n++;
      }
      m.close();
      toast(omT("rmOk", { n }));
      const gone = packPage && chosen.some((x) => x.id === packPage.id);
      if (gone) packPage = null;
      await refresh();
      const left = vs.filter((x) => data.versions.some((y) => y.id === x.id));
      if (gone && left.length) openPackPage((left.find((x) => x.omni?.base) || left[0]).id);
    });
  }
  const omStale = (J) => J.results.filter((r) => r.kind === "no" && r.stale).map((r) => data.versions.find((v) => v.id === r.stale)).filter(Boolean);
  async function omRemoveStale() {
    const vs = omStale(omJob);
    if (!vs.length) return;
    const ids = new Set(vs.map((v) => v.id));
    const own = data.worlds.filter((w) => ids.has(w.home) || ids.has(w.lastVersionId));
    const res = await showModal({
      title: omT("staleT", { n: vs.length }),
      body: omT("staleD", { l: vs.map((v) => v.minecraftVersion).join(", ") }),
      checkboxLabel: own.length ? omT("staleW", { n: own.length }) : undefined,
      confirmLabel: T("yesRemove"),
      cancelLabel: T("no"),
      tone: "warn",
    });
    if (!res?.confirmed) return;
    let n = 0;
    for (const v of vs) {
      const keys = own.length && res.checked ? own.filter((w) => w.home === v.id || w.lastVersionId === v.id).map((w) => w.key) : [];
      const r = await api.removeVersion(v.id, keys).catch(() => null);
      if (r?.ok) n++;
    }
    toast(omT("staleOk", { n }));
    await refresh();
    const back = packPage && data.versions.some((v) => v.id === packPage.id) ? packPage.id : omJob?.baseId;
    if (packPage && back && data.versions.some((v) => v.id === back)) openPackPage(back);
  }
  // Choix des versions : ton pack en premier (fixe), puis celles ajoutées avec « + ».
  function omChips(g, base, all) {
    const sorted = [...g.pick].sort((a, b) => all.indexOf(a) - all.indexOf(b));
    const left = all.filter((v) => v !== base && !g.pick.has(v) && (!g.q || v.includes(g.q)));
    return `<div class="om-chips"><span class="om-chip base">✓ ${esc(base)} · ${esc(omT("yours"))}</span>${sorted.map((v) => `<span class="om-chip">${esc(v)}<button type="button" data-rmv="${esc(v)}" aria-label="×">×</button></span>`).join("")}<button type="button" class="om-plus" data-g="plus" aria-label="${esc(omT("addV"))}">+</button></div>
      ${g.open ? `<div class="om-pop"><input type="search" class="play-in" data-gq placeholder="${esc(omT("findV"))}" value="${esc(g.q || "")}"><div class="om-plist" data-glist>${left.map((v) => `<button type="button" data-addv="${esc(v)}">${esc(v)}</button>`).join("") || `<span class="om-note">${esc(omT("allIn"))}</span>`}</div>
        <div style="display:flex;gap:8px;justify-content:space-between;margin-top:8px;"><button type="button" class="link-btn" data-g="addall" style="margin:0;font-size:12px;">${esc(omT("addAll", { n: all.filter((v) => v !== base).length }))}</button><button type="button" class="btn-secondary" data-g="plus" style="margin:0;padding:4px 12px;font-size:12px;">${esc(omT("close"))}</button></div></div>` : ""}`;
  }
  async function omOpenGen(st) {
    const p = st.p;
    const r = await api.omniPack.targets(st.id);
    if (!r?.ok) return packErr(r);
    const all = r.versions;
    const base = p.minecraftVersion;
    const name = data.versions.find((x) => x.id === st.id)?.name || p.name;
    const have = new Set((p.omni?.versions || []).map((x) => x.mc));
    const g = { open: false, q: "", pick: new Set([...have].filter((v) => v !== base)), keep: new Set() };
    const mineMods = p.mods.filter((m) => !m.auto && m.source === "mr");
    const m = overlay(`<div class="modal-box pop-in om-modal" role="dialog" aria-modal="true" style="max-width:620px;width:100%;text-align:left;max-height:calc(100vh - 48px);overflow:auto;"><div data-g-root></div></div>`);
    const root = m.$("[data-g-root]");
    const keepAllOn = () => mineMods.length > 0 && mineMods.every((x) => g.keep.has(x.id));
    // Met à jour les coches sans tout redessiner (sinon le glissé perd l'élément sous la souris).
    const syncKeep = () => {
      root.querySelectorAll("[data-kl]").forEach((l) => {
        const on = g.keep.has(l.dataset.kl);
        l.classList.toggle("keep", on);
        l.querySelector("input").checked = on;
        const sm = l.querySelector("small");
        if (on && !sm) l.insertAdjacentHTML("beforeend", `<small>${esc(omT("must"))}</small>`);
        else if (!on && sm) sm.remove();
      });
      const all = root.querySelector('[data-g="keepall"]');
      if (all) all.textContent = keepAllOn() ? SELT().none : SELT().all;
    };
    const draw = () => {
      root.innerHTML = `<h3>${esc(omT("genT"))}</h3>
        <p class="sub">${esc(p.vanilla ? omT("genSubV", { n: name, v: base }) : omT("genSubM", { n: name, v: base }))}</p>
        <div class="om-sec">${esc(omT("vers"))}</div>${omChips(g, base, all)}
        ${p.vanilla ? `<p class="om-note">${esc(omT("vanNote"))}</p>` : `<p class="om-note" style="margin-top:6px;">${esc(omT("plusNote", { l: LOADERS[p.loader] || p.loader }))}</p>
        <div class="om-sec-row"><div class="om-sec">${esc(omT("keepT"))}</div>${mineMods.length > 1 ? `<button type="button" class="link-btn" data-g="keepall" style="margin:0 0 0 auto;font-size:12px;">${esc(keepAllOn() ? SELT().none : SELT().all)}</button>` : ""}</div>
        <div class="om-mods" title="${esc(SELT().tip)}">${mineMods.map((x) => `<label class="${g.keep.has(x.id) ? "keep" : ""}" data-kl="${esc(x.id)}"><input type="checkbox" data-k="${esc(x.id)}" ${g.keep.has(x.id) ? "checked" : ""}>${esc(x.name)}${g.keep.has(x.id) ? `<small>${esc(omT("must"))}</small>` : ""}</label>`).join("")}</div>
        <p class="om-note" style="margin:6px 0 0;">${esc(SELT().tip)}</p>
        <p class="om-note">${esc(omT("keepNote"))}</p>`}
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;"><button type="button" class="btn-secondary" data-g="no">${esc(omT("cancel"))}</button><button type="button" class="join-btn" data-g="go" ${g.pick.size ? "" : "disabled"}>${esc(omT("go", { n: g.pick.size }))}</button></div>`;
    };
    root.addEventListener("input", (e) => {
      if (!e.target.hasAttribute("data-gq")) return;
      g.q = e.target.value.trim();
      const left = all.filter((v) => v !== base && !g.pick.has(v) && (!g.q || v.includes(g.q)));
      root.querySelector("[data-glist]").innerHTML = left.map((v) => `<button type="button" data-addv="${esc(v)}">${esc(v)}</button>`).join("") || `<span class="om-note">${esc(omT("none"))}</span>`;
    });
    root.addEventListener("change", (e) => {
      const t = e.target;
      if (!t.dataset.k) return;
      t.checked ? g.keep.add(t.dataset.k) : g.keep.delete(t.dataset.k);
      syncKeep();
    });
    // Cocher en glissant (Rushi, 29/10, comme les autres sélections) : clic maintenu, chaque mod
    // survolé prend l'état du premier (coché, ou décoché si on part d'un mod déjà coché).
    let kDrag = null;
    const kPaint = (id, on) => {
      if (on === g.keep.has(id)) return;
      on ? g.keep.add(id) : g.keep.delete(id);
      syncKeep();
    };
    root.addEventListener("mousedown", (e) => {
      const l = e.button === 0 && e.target.closest?.("[data-kl]");
      if (!l) return;
      e.preventDefault();
      kDrag = { on: !g.keep.has(l.dataset.kl) };
      document.addEventListener("mouseup", () => (kDrag = null), { once: true });
      kPaint(l.dataset.kl, kDrag.on);
    });
    root.addEventListener("mouseover", (e) => {
      const l = kDrag && e.target.closest?.("[data-kl]");
      if (l) kPaint(l.dataset.kl, kDrag.on);
    });
    // Le clic (déjà traité au mousedown) ne doit pas recocher la case une 2e fois.
    root.addEventListener("click", (e) => {
      if (e.detail && e.target.closest?.("[data-kl]")) e.preventDefault();
    });
    root.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.rmv) return g.pick.delete(b.dataset.rmv), draw();
      if (b.dataset.addv) return g.pick.add(b.dataset.addv), draw();
      if (b.dataset.g === "plus") return (g.open = !g.open), (g.q = ""), draw();
      if (b.dataset.g === "addall") return all.forEach((v) => v !== base && g.pick.add(v)), (g.open = false), draw();
      if (b.dataset.g === "keepall") {
        const on = !keepAllOn();
        mineMods.forEach((x) => (on ? g.keep.add(x.id) : g.keep.delete(x.id)));
        return syncKeep();
      }
      if (b.dataset.g === "no") return m.close();
      if (b.dataset.g === "go") {
        b.disabled = true;
        const res = await api.omniPack.generate(st.id, { targets: [...g.pick], keep: [...g.keep] });
        if (!res?.ok) { b.disabled = false; return packErr(res); }
        m.close();
        toast(omT("started"));
      }
    });
    draw();
  }
  const omCheck = (key, label, sub, checked = true, disabled = false) => `<label class="play-row" style="padding:8px 10px;"><input type="checkbox" data-part="${key}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}><span class="t">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</span></label>`;
  const omWorlds = (ws, checked) => ws.length ? `<div class="om-wl">${ws.map((w) => `<label class="play-row" style="padding:6px 10px;"><input type="checkbox" data-w="${esc(w.key)}" ${checked ? "checked" : ""}><span class="t">${esc(w.name)}<small>${esc(w.mc || "")} · ${esc(sizeFmt(w.sizeBytes || 0))}</small></span></label>`).join("")}</div>` : `<p class="om-note">${esc(omT("noW"))}</p>`;
  // RAM dans l'export (Laboratoire « packRam ») : la RAM conseillée part avec le pack.
  const omRamGB = (id) => rmValue(rmStOf(id), rmCtxOf(id));
  const omRamCheck = (id, sub) => (on("packRam") ? omCheck("ram", rmTr(`🧠 RAM conseillée : ${rmGo(omRamGB(id))}`, `🧠 Recommended RAM: ${rmGo(omRamGB(id))}`), sub) : "");
  const omRamOut = (m, id) => (on("packRam") && m.$('[data-part="ram"]')?.checked ? omRamGB(id) : null);
  async function omOpenExport(st) {
    const r = await api.omniPack.exportPreview(st.id);
    if (!r?.ok) return packErr(r);
    const untested = r.versions.filter((x) => !x.tested).length;
    const m = overlay(`<div class="modal-box pop-in om-modal" role="dialog" aria-modal="true" style="max-width:560px;width:100%;text-align:left;max-height:calc(100vh - 48px);overflow:auto;">
      <h3>${esc(omT("exT"))}</h3><p class="sub">${esc(r.vanilla ? omT("exSubV") : omT("exSubM"))}</p>
      <div class="om-file"><span class="ic">O</span><span><b>${esc(r.name)}.omnipack</b><small>${esc(r.versions.length)} version(s) · ${esc(r.versions.map((x) => x.mc).join(", "))}</small></span></div>
      ${untested ? `<p class="om-note" style="color:var(--warn)">⚠ ${esc(omT("untested", { n: untested }))}</p>` : ""}
      <div class="om-sec">${esc(omT("inc"))}</div>
      ${r.vanilla ? "" : omCheck("mods", omT("mods"), omT("modsD", { n: r.mods }), true, true)}
      ${omCheck("cfg", omT("cfg"), omT("cfgD"))}${omCheck("rp", r.vanilla ? omT("rpV") : omT("rp"), omT("rpD"))}${on("dataPacks") ? omCheck("dp", omT("dp"), omT("dpD")) : ""}
      ${omRamCheck(st.id, rmTr("Chaque version part avec la RAM qu'il lui faut : celui qui importe n'a rien à régler.", "Each version comes with the RAM it needs: whoever imports it has nothing to set."))}
      <div class="om-sec">${esc(omT("w"))}</div><p class="om-note" style="margin:0 0 6px;">${esc(omT("wD"))}</p>${omWorlds(r.worlds, r.vanilla)}
      <div class="om-sec">${esc(omT("next"))}</div><ol class="om-steps"><li>${esc(omT("s1"))}</li><li>${esc(omT("s2"))}</li><li>${esc(omT("s3"))}</li></ol>
      <p class="fx-msg" data-msg></p>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;"><button type="button" class="btn-secondary" data-x>${esc(omT("cancel"))}</button><button type="button" class="join-btn" data-save>${esc(omT("save"))}</button></div></div>`);
    m.ov.addEventListener("click", async (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      const b = e.target.closest("[data-save]");
      if (!b) return;
      const part = (k) => m.$(`[data-part="${k}"]`)?.checked !== false;
      const worlds = [...m.ov.querySelectorAll("[data-w]:checked")].map((x) => x.dataset.w);
      b.disabled = true;
      const out = await api.omniPack.exportOmni(st.id, { parts: { cfg: part("cfg"), rp: part("rp"), sh: part("rp"), dp: on("dataPacks") ? part("dp") : false, w: worlds.length > 0, ram: omRamOut(m, st.id) != null }, worlds });
      b.disabled = false;
      if (out?.cancelled) return;
      if (!out?.ok) return (m.$("[data-msg]").textContent = out?.error || "?");
      m.close();
      toast(omT("saved", { n: out.name, s: sizeFmt(out.size) }));
    });
  }
  // Mon cloud (03/11, Rushi) : le modpack se crée ici, puis se relie au serveur sur le site.
  // Tout part : mods Modrinth et CurseForge (en liens), configs, packs de ressources et shaders,
  // mods perso (contrôlés un par un par le site). Jamais le fichier d'un mod CurseForge.
  function omOpenCloud(st) {
    const name = data.versions.find((x) => x.id === st.id)?.name || st.p.name;
    const li = (t) => `<li style="margin:3px 0;">${t}</li>`;
    const m = overlay(`<div class="modal-box pop-in om-modal" role="dialog" aria-modal="true" style="max-width:540px;width:100%;text-align:left;max-height:calc(100vh - 48px);overflow:auto;">
      <h3>☁ ${esc(rmTr("Envoyer dans le cloud", "Send to the cloud"))}</h3><p class="sub">${esc(rmTr(`« ${name} » va dans ton cloud Omniscient. Ensuite, sur le site (Cloud), relie-le à ton serveur : les joueurs l'auront en un clic.`, `“${name}” goes to your Omniscient cloud. Then, on the website (Cloud), link it to your server: players get it in one click.`))}</p>
      <div class="om-sec">${esc(rmTr("Ce qui part", "What is sent"))}</div>
      <ul style="margin:0 0 8px 18px;padding:0;font-size:13px;">${li(esc(rmTr("Les mods Modrinth (en liens, ils ne prennent presque pas de place)", "Modrinth mods (as links, they take almost no space)")))}${li(esc(rmTr("Les réglages (config, defaultconfigs, kubejs, options.txt)", "Settings (config, defaultconfigs, kubejs, options.txt)")))}${li(esc(rmTr("Les packs de ressources et les shaders de l'installation", "The installation's resource packs and shaders")))}${li(esc(rmTr("Les mods CurseForge (en liens)", "CurseForge mods (as links)")))}${li(esc(rmTr("Tes mods perso (.jar ni Modrinth ni CurseForge) : le site les contrôle un par un", "Your own mods (.jar not on Modrinth or CurseForge): the website checks each one")))}</ul>
      <p class="om-note">${esc(rmTr("Les mods CurseForge restent des liens : chaque joueur les télécharge depuis CurseForge (Omniscient ne garde jamais leur fichier). Pas de monde. Ton modpack reste privé : seuls les joueurs de ton serveur l'ont. Même nom qu'un modpack déjà envoyé = il est mis à jour.", "CurseForge mods stay links: each player downloads them from CurseForge (Omniscient never keeps their file). No worlds. Your pack stays private: only your server's players get it. Same name as a pack already sent = it gets updated."))}</p>
      <p class="fx-msg" data-msg aria-live="polite"></p><div data-res></div>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;"><button type="button" class="btn-secondary" data-x>${esc(omT("cancel"))}</button><button type="button" class="join-btn" data-go>☁ ${esc(rmTr("Envoyer", "Send"))}</button></div></div>`);
    m.ov.addEventListener("click", async (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      const b = e.target.closest("[data-go]");
      if (!b) return;
      b.disabled = true;
      const msg = m.$("[data-msg]");
      msg.style.color = "";
      msg.textContent = rmTr("Envoi en cours… (les mods perso peuvent prendre une minute)", "Sending… (own mods can take a minute)");
      const r = await api.cloudUpload(st.id).catch((err) => ({ ok: false, error: String(err?.message || err) }));
      b.disabled = false;
      if (!r?.ok) {
        msg.style.color = "var(--danger,#e5484d)";
        msg.textContent = r?.error || "?";
        return;
      }
      msg.textContent = "";
      b.hidden = true;
      m.$("[data-x]").textContent = rmTr("Fermer", "Close");
      const lines = [
        `✓ ${esc(rmTr(`${r.updated ? "Mis à jour" : "Envoyé"} : « ${r.name} »`, `${r.updated ? "Updated" : "Sent"}: “${r.name}”`))}`,
        esc(rmTr(`${r.mods} fichiers Modrinth · ${r.curseforge ? `${r.curseforge} mods CurseForge (liens) · ` : ""}${r.custom ? `${r.custom} mod(s) perso · ` : ""}${r.configs} fichiers de réglages`, `${r.mods} Modrinth files · ${r.curseforge ? `${r.curseforge} CurseForge mods (links) · ` : ""}${r.custom ? `${r.custom} own mod(s) · ` : ""}${r.configs} settings files`)),
        ...(r.modrinth || []).map((f) => esc(rmTr(`${f} existe sur Modrinth : gardé en lien`, `${f} is on Modrinth: kept as a link`))),
        ...(r.refused || []).map((f) => `<span style="color:var(--danger,#e5484d);">✕ ${esc(rmTr(`${f.file} refusé : ${f.reason}`, `${f.file} refused: ${f.reason}`))}</span>`),
        ...(r.missing?.length ? [`<span style="color:var(--warn);">${esc(rmTr(`Pas trouvés dans le dossier mods (pas envoyés) : ${r.missing.slice(0, 6).join(", ")}`, `Not found in the mods folder (not sent): ${r.missing.slice(0, 6).join(", ")}`))}</span>`] : []),
        ...(r.usage ? [esc(rmTr(`Ton cloud : ${sizeFmt(r.usage.total)} utilisés sur ${sizeFmt(r.usage.quota)}`, `Your cloud: ${sizeFmt(r.usage.total)} used of ${sizeFmt(r.usage.quota)}`))] : []),
        esc(rmTr("Dernière étape : sur le site, menu Cloud, « Relier à un serveur ».", "Last step: on the website, Cloud menu, “Link to a server”.")),
      ];
      m.$("[data-res]").innerHTML = `<div class="pk-check" role="status" style="display:block;line-height:1.6;">${lines.join("<br>")}</div>`;
    });
  }
  async function omOpenFriend(st) {
    if (on("addMenus") && !st.p.vanilla) return omOpenFriend2(st);
    const p = st.p;
    const r = await api.omniPack.exportPreview(st.id);
    if (!r?.ok) return packErr(r);
    const name = data.versions.find((x) => x.id === st.id)?.name || p.name;
    const ws = r.worlds.filter((w) => pkWorlds().some((x) => x.key === w.key));
    const m = overlay(`<div class="modal-box pop-in om-modal" role="dialog" aria-modal="true" style="max-width:540px;width:100%;text-align:left;max-height:calc(100vh - 48px);overflow:auto;">
      <h3>${esc(omT("frT"))}</h3><p class="sub">${esc(omT("frSub"))}</p>
      <div class="om-file"><span class="ic">⬆</span><span><b>${esc(name)}.mrpack</b><small>${esc(p.vanilla ? omT("vanilla") : `${p.mods.length} mods`)} · ${esc(omT("light"))}</small></span></div>
      <div class="om-sec">${esc(omT("inc"))}</div>
      ${p.vanilla ? "" : omCheck("mods", omT("frMods"), omT("frModsD"), true, true)}
      ${omCheck("cfg", omT("cfg"), omT("cfgD"))}${omCheck("rp", p.vanilla ? omT("rpV") : omT("rp"), "")}${!p.vanilla && on("dataPacks") ? omCheck("dp", omT("dp"), "") : ""}${p.vanilla ? "" : omRamCheck(st.id, rmTr("Ton ami aura la bonne RAM en important le pack dans Omniscient (et avec le .zip, aussi dans l'appli CurseForge).", "Your friend gets the right RAM when importing the pack in Omniscient (and with the .zip, in the CurseForge app too)."))}
      <div class="om-sec">${esc(omT("frW"))}</div><p class="om-note" style="margin:0 0 6px;">${esc(omT("frWD"))}</p>${omWorlds(ws, false)}
      ${p.vanilla ? "" : `<p class="om-note">${esc(omT("frCf"))}</p>`}<p class="fx-msg" data-msg></p>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;"><button type="button" class="btn-secondary" data-x>${esc(omT("cancel"))}</button><button type="button" class="join-btn" data-save>${esc(omT("save"))}</button></div></div>`);
    m.ov.addEventListener("click", async (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      const b = e.target.closest("[data-save]");
      if (!b) return;
      const part = (k) => m.$(`[data-part="${k}"]`)?.checked !== false;
      const worlds = [...m.ov.querySelectorAll("[data-w]:checked")].map((x) => x.dataset.w);
      b.disabled = true;
      const out = await api.omniPack.exportFriend(st.id, { parts: { cfg: part("cfg"), rp: part("rp"), dp: part("dp"), w: worlds.length > 0 }, worlds, ramGB: omRamOut(m, st.id) });
      b.disabled = false;
      if (out?.cancelled) return;
      if (!out?.ok) return (m.$("[data-msg]").textContent = out?.error || "?");
      m.close();
      toast(omT("saved", { n: out.name, s: sizeFmt(out.size) }) + (out.manual?.length ? " " + omT("frManual", { n: out.manual.length }) : ""));
    });
  }
  // Export « Pour un ami » (31/10, Laboratoire « addMenus ») : choix .mrpack (Modrinth) ou .zip
  // (CurseForge). La liste dit, mod par mod, s'il part en lien ou en .jar dans le fichier.
  // .mrpack : liens Modrinth seulement, le reste en .jar (jamais de lien CurseForge : Modrinth
  // refuserait le fichier). .zip : liens CurseForge pour ce qui existe sur CurseForge, .jar pour
  // le reste (Modrinth seul, mods perso). À partager entre amis, pas à publier en ligne.
  async function omOpenFriend2(st) {
    const p = st.p;
    const name = data.versions.find((x) => x.id === st.id)?.name || p.name;
    let fmt = "mrpack";
    const SRC = { mr: "Modrinth", cf: "CurseForge", local: adTr("Fichier perso", "Own file") };
    // Rushi 31/10 : la fenêtre s'ouvre tout de suite (squelette) pendant que le launcher lit les mods.
    const m = overlay(`<div class="modal-box pop-in om-modal" role="dialog" aria-modal="true" style="max-width:580px;width:100%;text-align:left;max-height:calc(100vh - 48px);overflow:auto;"><div data-fr></div></div>`);
    const box = m.$("[data-fr]");
    const skl = (w, h = 12) => `<span class="sk" style="display:block;width:${w};height:${h}px;border-radius:6px;margin:6px 0;"></span>`;
    box.innerHTML = `<h3>${esc(omT("frT"))}</h3><p class="sub">${esc(adTr("À partager entre amis, pas à publier en ligne.", "To share with friends, not to publish online."))}</p>
      <div class="om-sec">${esc(adTr("Format", "Format"))}</div><div style="display:flex;gap:8px;">${skl("50%", 46)}${skl("50%", 46)}</div>
      ${skl("100%", 58)}<div class="om-sec">${esc(adTr("Lecture des mods du pack…", "Reading the pack's mods…"))}</div>${[70, 55, 62, 48, 66].map((w) => skl(`${w}%`, 30)).join("")}
      <div class="modal-actions" style="display:flex;justify-content:flex-end;margin-top:16px;"><button type="button" class="btn-secondary" data-x>${esc(omT("cancel"))}</button></div>`;
    box.setAttribute("aria-busy", "true");
    let loaded = false;
    m.ov.addEventListener("click", (e) => { if (!loaded && e.target.closest("[data-x]")) m.close(); });
    const [r, plan0] = await Promise.all([api.omniPack.exportPreview(st.id), api.omniPack.friendPlan(st.id)]);
    if (!document.body.contains(m.ov)) return;
    if (!r?.ok || !plan0?.ok) {
      m.close();
      return packErr(!r?.ok ? r : plan0);
    }
    const plan = plan0;
    loaded = true;
    box.removeAttribute("aria-busy");
    const ws = r.worlds.filter((w) => pkWorlds().some((x) => x.key === w.key));
    const keep = { parts: {}, worlds: new Set() };
    const draw = () => {
      // Garde les cases cochées quand on change de format.
      box.querySelectorAll("[data-part]").forEach((c) => (keep.parts[c.dataset.part] = c.checked));
      box.querySelectorAll("[data-w]").forEach((c) => (c.checked ? keep.worlds.add(c.dataset.w) : keep.worlds.delete(c.dataset.w)));
      const by = (k) => plan.mods.filter((x) => x[fmt] === k);
      const links = by("link"), jars = by("jar"), miss = by("missing");
      const row = (x, how) => `<div class="play-row" style="padding:5px 10px;cursor:default;"><span class="t">${esc(x.name)}<small>${esc(SRC[x.source] || x.source)}${x.file ? ` · ${esc(x.file)}` : ""}</small></span><span style="font-size:11px;color:var(--muted);white-space:nowrap;">${esc(how)}</span></div>`;
      const sec = (title, list, how) => list.length ? `<div class="om-sec">${esc(title)} (${list.length})</div><div class="om-wl">${list.map((x) => row(x, how)).join("")}</div>` : "";
      const chip = (k, b, s) => `<button type="button" class="pb-chip" data-fmt="${k}" aria-pressed="${fmt === k}" style="flex:1;min-width:200px;text-align:left;display:grid;gap:2px;padding:8px 12px;${fmt === k ? "border:2px solid var(--accent);background:color-mix(in srgb, var(--accent) 12%, transparent);" : ""}"><b>${esc(b)}</b><small style="color:var(--muted);">${esc(s)}</small></button>`;
      const pc = (k) => (keep.parts[k] === undefined ? true : keep.parts[k]);
      box.innerHTML = `<h3>${esc(omT("frT"))}</h3><p class="sub">${esc(adTr("À partager entre amis, pas à publier en ligne.", "To share with friends, not to publish online."))}</p>
        <div class="om-sec">${esc(adTr("Format", "Format"))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">${chip("mrpack", ".mrpack · Modrinth", adTr("Liens Modrinth, le reste en .jar dans le fichier", "Modrinth links, the rest as .jar inside the file"))}${plan.zipOk ? chip("zip", ".zip · CurseForge", adTr("Liens CurseForge, le reste en .jar dans le fichier", "CurseForge links, the rest as .jar inside the file")) : ""}</div>
        <div class="om-file" style="margin-top:10px;"><span class="ic">⬆</span><span><b>${esc(name)}.${fmt}</b><small>${esc(`${plan.mods.length} mods`)} · ${esc(adTr(`${links.length} en lien, ${jars.length} en .jar`, `${links.length} as links, ${jars.length} as .jar`))}</small></span></div>
        ${sec(fmt === "zip" ? adTr("Liens CurseForge", "CurseForge links") : adTr("Liens Modrinth", "Modrinth links"), links, adTr("téléchargé par ton ami", "downloaded by your friend"))}
        ${sec(adTr("Fichiers .jar dans l'export", ".jar files in the export"), jars, adTr("copié dans le fichier", "copied into the file"))}
        ${sec(adTr("Pas dans l'export", "Not in the export"), miss, adTr("fichier introuvable", "file not found"))}
        ${fmt === "zip" && !plan.cfChecked ? `<p class="om-note" style="color:var(--warn)">⚠ ${esc(adTr("Connecte-toi pour que le launcher reconnaisse les mods CurseForge : sinon ils partent en .jar.", "Sign in so the launcher can recognise CurseForge mods: otherwise they go as .jar."))}</p>` : ""}
        <div class="om-sec">${esc(omT("inc"))}</div>
        ${omCheck("cfg", omT("cfg"), omT("cfgD"), pc("cfg"))}${omCheck("rp", omT("rp"), "", pc("rp"))}${on("dataPacks") ? omCheck("dp", omT("dp"), "", pc("dp")) : ""}${on("packRam") ? omCheck("ram", rmTr(`🧠 RAM conseillée : ${rmGo(omRamGB(st.id))}`, `🧠 Recommended RAM: ${rmGo(omRamGB(st.id))}`), fmt === "zip" ? rmTr("Écrite dans le champ officiel du .zip : l'appli CurseForge et Omniscient la lisent.", "Written in the .zip's official field: the CurseForge app and Omniscient read it.") : rmTr("Petit fichier lu par Omniscient à l'import (les autres launchers l'ignorent, sans souci).", "Small file read by Omniscient on import (other launchers just ignore it)."), pc("ram")) : ""}
        <div class="om-sec">${esc(omT("frW"))}</div><p class="om-note" style="margin:0 0 6px;">${esc(omT("frWD"))}</p>${omWorlds(ws, false)}
        <p class="fx-msg" data-msg></p>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;"><button type="button" class="btn-secondary" data-x>${esc(omT("cancel"))}</button><button type="button" class="join-btn" data-save>${esc(omT("save"))}</button></div>`;
      box.querySelectorAll("[data-w]").forEach((c) => (c.checked = keep.worlds.has(c.dataset.w)));
    };
    draw();
    m.ov.addEventListener("click", async (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      const f = e.target.closest("[data-fmt]");
      if (f) {
        fmt = f.dataset.fmt;
        return draw();
      }
      const b = e.target.closest("[data-save]");
      if (!b) return;
      const part = (k) => m.$(`[data-part="${k}"]`)?.checked !== false;
      const worlds = [...m.ov.querySelectorAll("[data-w]:checked")].map((x) => x.dataset.w);
      b.disabled = true;
      const out = await api.omniPack.exportFriend(st.id, { format: fmt, parts: { cfg: part("cfg"), rp: part("rp"), dp: on("dataPacks") ? part("dp") : false, w: worlds.length > 0 }, worlds, ramGB: omRamOut(m, st.id) });
      b.disabled = false;
      if (out?.cancelled) return;
      if (!out?.ok) return (m.$("[data-msg]").textContent = out?.error || "?");
      m.close();
      toast(omT("saved", { n: out.name, s: sizeFmt(out.size) }) + (out.manual?.length ? " " + omT("frManual", { n: out.manual.length }) : ""));
    });
  }
  function omClick(st, b) {
    const a = b.dataset.om;
    const menu = b.closest(".om-exp")?.querySelector(".om-menu");
    if (a === "menu") { if (menu) menu.hidden = !menu.hidden; return; }
    if (menu) menu.hidden = true;
    if (a === "friend") return omOpenFriend(st);
    if (a === "cloud") return omOpenCloud(st);
    if (a === "export") return omOpenExport(st);
    if (a === "gen") return omOpenGen(st);
    if (a === "det") { omJobOpen = !omJobOpen; return drawPackPage(); }
    if (a === "jstop") return api.omniPack.stop();
    if (a === "jx") { omJob = null; api.omniPack.clearJob(); return drawPackPage(); }
    if (a === "stale") return omRemoveStale();
    if (a === "rename") return pjRename(st.id);
    if (a === "remove") return omRemovePack(st.id);
    if (a === "ram") return rmOpenDialog(st.id);
  }
  // Bandeau de la page d'un pack quand sa RAM est trop basse (Laboratoire « packRam »).
  function rmBannerHtml(id) {
    if (!on("packRam")) return "";
    const c = rmCtxOf(id), st = rmStOf(id), v = rmValue(st, c), n = rmNeed(c);
    if (v >= n || st.mode === "auto") return "";
    return `<div class="pk-check bad" role="status" style="border-color:var(--warn);"><span><b>🧠 ${esc(rmTr(`RAM un peu juste : ${v} Go pour ${c.mods} mods`, `RAM a bit low: ${v} GB for ${c.mods} mods`))}</b><br>${esc(rmTr(`Ce pack demande environ ${n} Go. Avec moins, il risque de geler ou de planter.`, `This pack needs about ${n} GB. With less, it may freeze or crash.`))}</span><button type="button" class="join-btn" data-om="ram">${esc(rmTr("Régler", "Set"))}</button></div>`;
  }
  document.addEventListener("click", (e) => { if (!e.target.closest(".om-exp")) document.querySelectorAll(".om-menu").forEach((x) => (x.hidden = true)); });
  // Largeur d'un texte en pixels (colonnes de la liste des mods, version A du 02/11).
  let pkMeasureCtx = null;
  function pkTextW(txt, font) {
    pkMeasureCtx = pkMeasureCtx || document.createElement("canvas").getContext("2d");
    pkMeasureCtx.font = font;
    return pkMeasureCtx.measureText(String(txt || "")).width;
  }
  function drawPackPage() {
    const st = packPage;
    const p = st.p;
    const v = data.versions.find((x) => x.id === st.id) || {};
    const probs = pkProblems(p);
    const mine = p.mods.filter((m) => !m.auto);
    const deps = p.mods.filter((m) => m.auto);
    const ups = p.readonly ? [] : p.mods.filter((m) => m.versions[0] && m.versions[0] !== m.version && m.source === "mr");
    const neededBy = (m) => {
      const names = p.mods.filter((x) => x.on && (x.deps || []).some((d) => d.id === m.id)).map((x) => x.name);
      return names.length ? names : (m.by || []).map((id) => p.mods.find((x) => x.id === id)?.name).filter(Boolean);
    };
    const worlds = data.worlds.filter((w) => w.lastVersionId === st.id);
    const tab = (k, label, n) => `<button type="button" class="pk-tab" role="tab" data-pk-tab="${k}" aria-selected="${st.tab === k}">${esc(label)}${n != null ? `<small>${n}</small>` : ""}</button>`;
    const row = (m) => {
      const nb = neededBy(m);
      const bad = probs.some((x) => x.b?.id === m.id || (x.type === "loader" && x.a?.id === m.id));
      const sub = m.auto ? pkT("neededBy", { d: nb.join(", ") || "—" }) : m.deps?.length ? pkT("needs", { d: m.deps.map((d) => p.mods.find((x) => x.id === d.id)?.name || d.id).join(", ") }) : m.author;
      const sw = p.readonly ? ""
        : m.auto && nb.length
        ? `<span class="pk-lock" title="${esc(pkT("lock", { d: nb.join(", ") }))}">🔒</span>`
        : `<button type="button" class="pk-sw" role="switch" aria-checked="${m.on}" data-pk-on="${esc(m.id)}" aria-label="${esc(m.name)}"></button>`;
      return `<div class="pk-row${m.on ? "" : " off"}${bad ? " bad" : ""}">
        <span class="pk-av" style="background:${pkColor(m.name)}">${esc(m.name[0])}</span>
        <span class="pk-nm"><b title="${esc(m.name)}">${esc(m.name)}</b><small class="${bad ? "need" : ""}">${esc(sub)}</small></span>
        <span class="pk-src ${m.source}">${esc(m.source === "cf" ? (m.got === "api" ? pkT("cfApi") : pkT("cfHand")) : m.source === "file" ? pkT("file") : pkT("mr"))}</span>
        ${p.readonly ? `<span class="pk-ver"></span>` : m.source === "cf" && m.got === "api" ? `<span class="pk-ver"><span class="pk-nm"><small>${esc(m.version)}</small></span></span>` : m.source === "file" ? `<span class="pk-ver"><span class="pk-nm"><small>${esc(m.version)}</small></span></span>` : m.source === "cf" ? `<span class="pk-ver">${m.have ? `<span class="pk-up" style="color:var(--success);">✓ ${esc(pkT("cfHave"))}</span><span class="pk-nm"><small>${esc(m.version)}</small></span>` : `<span class="pk-nm"><small class="need">${esc(pkT("cfWait"))}</small></span><button type="button" class="btn-secondary" data-pk-cf="${esc(m.id)}" style="margin:0;padding:4px 10px;font-size:12px;">${esc(pkT("cfOpen"))} ↗</button>`}</span>` : `<span class="pk-ver">${m.source === "mr" && m.versions[0] !== m.version ? `<span class="pk-up" title="${esc(m.versions[0])}">${esc(pkT("upTo", { v: m.versions[0] }))}</span>` : ""}
          <select class="play-in" data-pk-ver="${esc(m.id)}" aria-label="${esc(m.name)}">${m.versions.map((x, i) => `<option value="${esc(x)}" ${x === m.version ? "selected" : ""}>${esc(x)}${i === 0 ? ` · ${esc(pkT("latest"))}` : ""}</option>`).join("")}</select></span>`}
        <span class="pk-end">${sw}${p.readonly || (m.auto && nb.length) ? "" : `<button type="button" class="pk-del" data-pk-del="mod" data-k="${esc(m.id)}" title="${esc(pkT("delL"))}" aria-label="${esc(pkT("delL"))} ${esc(m.name)}">${TRASH}</button>`}</span></div>`;
    };
    const match = (m) => !st.q || m.name.toLowerCase().includes(st.q.toLowerCase());
    let body = "";
    if (st.tab === "mods") {
      const showMine = st.filter === "all" || st.filter === "mine";
      const showDeps = st.filter === "all" || st.filter === "deps";
      const list = st.filter === "up" ? ups.filter(match) : null;
      // Version A (02/11) : largeur commune des colonnes nom et pastille, mesurée sur tous les mods du pack.
      const nmW = Math.min(300, Math.ceil(Math.max(120, ...p.mods.map((m) => pkTextW(m.name, "600 13.5px Inter, system-ui, sans-serif")))) + 2);
      const srcW = Math.ceil(Math.max(...["mr", "cfApi", "cfHand", "file"].map((k) => pkTextW(pkT(k), "700 10.5px Inter, system-ui, sans-serif")))) + 16;
      const modList = (all, shown, emptyKey) => `<div class="pk-list pk-mods" style="--pk-nmw:${nmW}px;--pk-srcw:${srcW}px;">${shown.length ? shown.map(row).join("") : emptyKey ? `<div class="pk-empty">${esc(pkT(all.length ? "noMatch" : emptyKey))}</div>` : ""}</div>`;
      const chip = (k, label, n) => `<button type="button" class="pk-chip" data-pk-f="${k}" aria-pressed="${st.filter === k}">${esc(label)}${n != null ? ` · ${n}` : ""}</button>`;
      body = `<div class="pk-tools"><input class="play-in" type="search" data-pk-q placeholder="${esc(pkT("search"))}" value="${esc(st.q)}">
          ${chip("all", pkT("fAll"))}${chip("mine", pkT("fMine"), mine.length)}${chip("deps", pkT("fDeps"), deps.length)}${ups.length ? chip("up", pkT("fUp"), ups.length) : ""}
          <span class="sp"></span>${p.readonly ? "" : `${ups.length ? `<button type="button" class="btn-secondary" data-pk-upall>${esc(pkT("upAll"))}</button>` : ""}<button type="button" class="join-btn" data-pk-add>${esc(pkT("add"))}</button>`}</div>
        ${p.readonly ? `<p class="pk-note">${esc(pkT("readonly"))}</p>` : ""}
        ${list ? modList(list, list, "") : `
        ${showMine ? `<div class="pk-sec">${esc(pkT("secMine"))} · ${mine.length}</div>${modList(mine, mine.filter(match), "emptyMine")}` : ""}
        ${showDeps ? `<div class="pk-sec">${esc(pkT("secDeps"))} · ${deps.length} <span>${esc(pkT("secDepsD"))}</span></div>${modList(deps, deps.filter(match), "emptyDeps")}` : ""}`}
        <p class="pk-note">${esc(pkT("checkBefore"))}</p>`;
    } else if (st.tab === "rp") {
      body = `<div class="pk-tools"><p class="pk-note" style="flex:1;">${esc(pkT("rpNote"))}</p><button type="button" class="join-btn" data-pk-add>${esc(pkT("rpAdd"))}</button></div>
        <div class="pk-list">${p.resourcepacks.map((r, i) => `<div class="pk-row${r.on ? "" : " off"}" style="grid-template-columns:32px minmax(0,1fr) auto auto;">
          <span class="pk-av" style="background:${pkColor(r.name)}">${i + 1}</span>
          ${(() => { const need = probs.find((x) => x.type === "rp" && x.rp?.name === r.name); return `<span class="pk-nm"><b>${esc(r.name)}</b><small class="${need ? "need" : ""}">${esc(need ? pkT("rpNeed", { d: need.b.name }) : typeof r.info === "number" ? sizeFmt(r.info) : r.info || "")}</small></span>`; })()}
          <span></span>
          <span class="pk-end"><button type="button" class="pk-sw" role="switch" aria-checked="${r.on}" data-pk-rp="${i}" aria-label="${esc(r.name)}"></button><button type="button" class="pk-del" data-pk-del="rp" data-k="${esc(r.file)}" title="${esc(pkT("delL"))}" aria-label="${esc(pkT("delL"))} ${esc(r.name)}">${TRASH}</button></span></div>`).join("")}</div>`;
    } else if (st.tab === "sh" && p.vanilla) {
      // 28/10 (Rushi) : les shaders aussi en vanilla. Ils attendent un mod (Iris) : « Basculer en version modée ».
      body = `<div class="pk-tools"><p class="pk-note" style="flex:1;min-width:220px;">${esc(SWT().shVan)}</p>${p.shaders.length ? `<button type="button" class="btn-secondary" data-sw="sh" style="margin:0;">${esc(SWT().go)}</button>` : ""}<button type="button" class="join-btn" data-pk-add>${esc(pkT("shAdd"))}</button></div>
        ${p.shaders.length ? `<div class="pk-list">${p.shaders.map((x) => `<div class="pk-row" style="grid-template-columns:32px minmax(0,1fr) auto;">
          <span class="pk-av" style="background:${pkColor(x.name)}">☀</span><span class="pk-nm"><b>${esc(x.name)}</b><small>${esc(SWT().shWait)}</small></span>
          <span class="pk-end"><button type="button" class="pk-del" data-pk-del="sh" data-k="${esc(x.file)}" title="${esc(pkT("delL"))}" aria-label="${esc(pkT("delL"))} ${esc(x.name)}">${TRASH}</button></span></div>`).join("")}</div>` : ""}`;
    } else if (st.tab === "sh") {
      body = `<div class="pk-tools"><p class="pk-note" style="flex:1;">${esc(p.iris ? pkT("shNote") : pkT("shNote").split(".")[0] + ". " + pkT("shMissing"))}</p><button type="button" class="join-btn" data-pk-add>${esc(pkT("shAdd"))}</button></div>
        <div class="pk-list">${[{ name: pkT("shNone"), info: "" }, ...p.shaders].map((s, i) => `<label class="pk-row" style="grid-template-columns:32px minmax(0,1fr) auto;cursor:pointer;">
          <span class="pk-av" style="background:${i ? pkColor(s.name) : "color-mix(in srgb, var(--muted) 30%, transparent)"}">${i ? "☀" : "–"}</span>
          <span class="pk-nm"><b>${esc(s.name)}</b><small>${esc(s.info)}</small></span>
          <span class="pk-end"><input type="radio" name="pk-sh" data-pk-sh="${i - 1}" ${p.shaderOn === i - 1 ? "checked" : ""}>${i ? `<button type="button" class="pk-del" data-pk-del="sh" data-k="${esc(s.file)}" title="${esc(pkT("delL"))}" aria-label="${esc(pkT("delL"))} ${esc(s.name)}">${TRASH}</button>` : `<span class="pk-del-sp"></span>`}</span></label>`).join("")}</div>`;
    } else if (st.tab === "dp") {
      const wn = (k) => worlds.find((w) => w.key === k)?.name;
      body = `<div class="pk-tools"><p class="pk-note" style="flex:1;min-width:220px;">${esc(pkT("dpNote"))}</p><button type="button" class="join-btn" data-pk-add>+ ${esc(ACT().t.dp)}</button></div>
        ${(p.datapacks || []).length ? `<div class="pk-list">${p.datapacks.map((r) => { const ws = (r.worlds || []).map(wn).filter(Boolean); return `<div class="pk-row" style="grid-template-columns:32px minmax(0,1fr) auto auto;">
          <span class="pk-av" style="background:${pkColor(r.name)}">{}</span>
          <span class="pk-nm"><b>${esc(r.name)}</b><small>${esc(ws.length ? pkT("dpIn", { w: ws.join(", ") }) : worlds.length ? pkT("dpInNone") : pkT("dpWait"))}${r.auto ? ` · ${esc(pkT("dpAuto"))}` : ""}${r.src === "mr" ? " · Modrinth" : ""}</small></span>
          <button type="button" class="btn-secondary" data-pk-dpw="${esc(r.file)}" style="margin:0;padding:4px 10px;font-size:12px;">${esc(pkT("dpPick"))}</button><button type="button" class="pk-del" data-pk-del="dp" data-k="${esc(r.file)}" title="${esc(pkT("delL"))}" aria-label="${esc(pkT("delL"))} ${esc(r.name)}">${TRASH}</button></div>`; }).join("")}</div>` : `<p class="pk-note">${esc(pkT("dpNone"))}</p>`}`;
    } else if (st.tab === "w") {
      const wf = worlds;
      body = `<div class="pk-tools"><p class="pk-note" style="flex:1;min-width:200px;margin:0;">${esc(pkT("wNote"))}</p><button type="button" class="join-btn" data-pk-add>+ ${esc(ACT().t.w)}</button></div>${worlds.length ? `<div class="pk-list">${wf.map((w) => `<div class="pk-row" style="grid-template-columns:32px minmax(0,1fr) auto auto auto;">
          <img src="${worldThumb(w)}" alt="" style="width:32px;height:32px;border-radius:6px;"><span class="pk-nm"><b>${esc(w.name)}</b><small>${esc(w.lastPlayed ? ago(w.lastPlayed) : "")} · ${esc(sizeFmt(w.sizeBytes))}</small></span>
          <button type="button" class="btn-secondary" data-pk-wdp="${esc(w.key)}" style="margin:0;padding:4px 10px;font-size:12px;">{} ${esc(pkT("dpW"))} · ${(p.datapacks || []).filter((d) => (d.worlds || []).includes(w.key)).length}</button>
          <button type="button" class="join-btn" data-play-world="${esc(w.key)}" style="margin:0;padding:5px 12px;font-size:12.5px;">${esc(pkT("play"))}</button><button type="button" class="pk-del" data-pk-del="w" data-k="${esc(w.key)}" title="${esc(pkT("delL"))}" aria-label="${esc(pkT("delL"))} ${esc(w.name)}">${TRASH}</button></div>`).join("")}</div>` : `<p class="pk-note">${esc(pkT("wNone"))}</p>`}`;
    } else if (on("packFiles")) {
      body = fxBody(st);
    } else {
      // Sans l'explorateur (Laboratoire « packFiles » coupé) : l'ancienne liste simple.
      body = `<p class="pk-note">${esc(pkT("fNote"))}</p><div class="pk-list pk-files">${p.files.map((f) => `<div class="pk-row">
          <span class="pk-av">${f.dir ? "📁" : "📄"}</span><span class="pk-nm"><b>${esc(f.name)}</b><small>${esc(f.info)}</small></span>
          <span class="pk-nm" style="text-align:right;"><small>${esc(f.dir ? `${pkT("files", { n: f.n })} · ` : "")}${esc(sizeFmt(f.bytes))}</small></span>
          <button type="button" class="link-btn" data-pk-openf="${esc(f.name)}" style="margin:0;font-size:12px;">${esc(pkT("folder"))}</button></div>`).join("")}</div>`;
    }
    panel.innerHTML = `<div class="pk-page">
      <button type="button" class="link-btn pk-back" data-pk-back>${esc(pkT("back"))}</button>
      <div class="pk-top"><span class="pk-ic">${CUBE.replace("<svg", '<svg width="28" height="28"')}</span>
        <div class="pk-title"><h2>${esc(v.name || p.name)}${testTag(v)}${p.omni ? `<span class="play-beta-tag om-tag">${esc(pkT("omni"))}</span>` : p.mine ? `<span class="play-beta-tag">${esc(pkT("mine"))}</span>` : ""}</h2>
          <p>${esc(p.vanilla ? pkT("metaV", { v: p.minecraftVersion, s: p.sizeBytes == null ? "…" : sizeFmt(p.sizeBytes) }) : pkT("meta", { v: p.minecraftVersion, l: `${LOADERS[p.loader] || p.loader} ${p.loaderVersion}`, n: p.mods.length, s: p.sizeBytes == null ? "…" : sizeFmt(p.sizeBytes) }))}</p></div>
        <div class="pk-acts">${omGearHtml(p)}
          ${probs.length ? `<button type="button" class="join-btn" data-pk-force>${esc(pkT("force"))}</button>` : `<button type="button" class="join-btn" data-pk-play>${esc(pkT("play"))}</button>`}</div></div>
      ${omBarHtml(p)}
      ${probs.length
        ? `<div class="pk-check bad" role="status"><span><b>${esc(pkT("bad", { n: probs.length }))}</b><br>${probs.map((x) => esc(pkProbText(x))).join("<br>")}</span>
          ${p.readonly ? "" : p.partial ? `<button type="button" class="join-btn" disabled><span class="ip-spin" aria-hidden="true"></span> ${esc(pkT("fixWait"))}</button>` : `<button type="button" class="join-btn" data-pk-fix>${esc(probs.length > 1 ? pkT("fixAll") : pkT("fix"))}</button>`}</div>`
        : p.vanilla ? "" : `<div class="pk-check ok" role="status">${esc(pkT("okAll"))}</div>`}
      ${rmBannerHtml(st.id)}
      ${omJobHtml()}
      <div class="pk-tabs" role="tablist">${p.vanilla ? "" : tab("mods", pkT("tMods"), p.mods.length)}${tab("rp", pkT("tRp"), p.resourcepacks.length)}${p.vanilla && !on("vanillaModded") ? "" : tab("sh", pkT("tSh"), p.shaders.length)}${tab("w", pkT("tW"), worlds.length)}${on("dataPacks") && dpSupported(p.minecraftVersion) ? tab("dp", pkT("tDp"), (p.datapacks || []).length) : ""}${tab("f", pkT("tF"))}</div>
      ${body}</div>`;
  }
  panel.addEventListener("click", (e) => {
    if (!packPage) return;
    const b = e.target.closest("button");
    if (!b) return;
    const st = packPage;
    const p = st.p;
    if (b.hasAttribute("data-pk-back")) { packPage = null; return render(); }
    if (b.dataset.om) return omClick(st, b);
    if (b.dataset.omSw) return b.dataset.omSw === st.id ? undefined : openPackPage(b.dataset.omSw);
    if (b.dataset.omOpen) return openPackPage(b.dataset.omOpen);
    if (b.dataset.pkDel) return pkDel(st, b.dataset.pkDel, b.dataset.k);
    if ([...b.attributes].some((a) => a.name.startsWith("data-fx-"))) return fxClick(st, b);
    if (b.dataset.pkTab) st.tab = b.dataset.pkTab;
    else if (b.dataset.pkF) st.filter = b.dataset.pkF;
    else if (b.dataset.pkOn) {
      const m = p.mods.find((x) => x.id === b.dataset.pkOn);
      b.disabled = true;
      return api.myPack.setMod(st.id, m.id, { on: !m.on }).then((r) => (packErr(r), reloadPack()));
    } else if (b.dataset.pkRp != null) {
      const r = p.resourcepacks[Number(b.dataset.pkRp)];
      return api.myPack.setResourcePack(st.id, r.file, !r.on).then((x) => (packErr(x), reloadPack()));
    }
    else if (b.dataset.pkCf) {
      const m = p.mods.find((x) => x.id === b.dataset.pkCf);
      b.disabled = true;
      // Ouvre la page du fichier exact ; le launcher surveille Téléchargements, vérifie et range.
      b.textContent = pkT("cfWait");
      return api.myPack.openCurseForge({ packId: st.id, modId: m.id }).then((r) => {
        if (r?.found) toast(pkT("cfFoundToast", { m: r.name || m.name }));
        else packErr(r);
        reloadPack();
      });
    } else if (b.hasAttribute("data-pk-wcf")) {
      return api.myPack.openMapsPage(p.minecraftVersion);
    } else if (b.hasAttribute("data-pk-wzip")) {
      return api.myPack.importMap(st.id).then((r) => (packErr(r), r?.ok && toast(pkT("wZipOk", { n: r.name })), r?.ok && refresh().then(reloadPack)));
    } else if (b.hasAttribute("data-pk-dpw")) {
      return openDpWorlds(b.getAttribute("data-pk-dpw"));
    } else if (b.hasAttribute("data-pk-wdp")) {
      return openWorldDp(b.getAttribute("data-pk-wdp"));
    } else if (b.hasAttribute("data-pk-dpmr")) {
      return openDpModrinth();
    } else if (b.hasAttribute("data-pk-dpfile")) {
      return api.myPack.addDatapack(st.id, { from: "file" }).then(async (r) => { packErr(r); if (!r?.ok) return; await reloadPack(); openDpWorlds(r.file, true); });
    } else if (b.hasAttribute("data-pk-fix")) {
      return openFixWizard();
    } else if (b.hasAttribute("data-pk-upall")) {
      b.disabled = true;
      return (async () => {
        for (const m of p.mods) if (m.source === "mr" && !m.auto && m.versions[0] && m.versions[0] !== m.version) packErr(await api.myPack.setMod(st.id, m.id, { version: m.versions[0] }));
        reloadPack();
      })();
    } else if (b.hasAttribute("data-sw")) {
      return openSwitchModded(b.dataset.sw);
    } else if (b.hasAttribute("data-pk-add")) {
      // Menus d'ajout (31/10, Laboratoire « addMenus ») : une seule fenêtre pour tout.
      if (on("addMenus") && !(st.tab === "sh" && !p.iris && !(p.vanilla && on("vanillaModded")))) return openAddWin({ mode: "add", kind: { rp: "rp", sh: "sh", w: "w", dp: "dp" }[st.tab] || "mods" });
      if (st.tab === "rp" || st.tab === "w" || st.tab === "dp") return openContentAdd(st.tab);
      if (st.tab === "sh") return p.iris || (p.vanilla && on("vanillaModded")) ? openContentAdd("sh") : openShaderLoader();
      return openMyPack({ minecraftVersion: p.minecraftVersion, loader: p.loader, name: data.versions.find((x) => x.id === st.id)?.name || p.name, addTo: st.id, omni: !!p.omni });
    } else if (b.hasAttribute("data-pk-play")) {
      return launch({ versionId: st.id }, b);
    } else if (b.hasAttribute("data-pk-force")) {
      return launch({ versionId: st.id, force: true }, b);
    } else if (b.hasAttribute("data-pk-openf")) {
      return api.myPack.openFolder(st.id, b.dataset.pkOpenf || "");
    } else return;
    drawPackPage();
  });
  panel.addEventListener("change", (e) => {
    if (!packPage) return;
    const p = packPage.p;
    if (e.target.dataset.pkVer) {
      const m = p.mods.find((x) => x.id === e.target.dataset.pkVer);
      const v = e.target.value;
      e.target.disabled = true;
      return api.myPack.setMod(packPage.id, m.id, { version: v }).then((r) => {
        if (r?.ok !== false) toast(pkT("verToast", { m: m.name, v }));
        packErr(r);
        reloadPack();
      });
    } else if (e.target.dataset.pkSh != null) {
      const i = Number(e.target.dataset.pkSh);
      return api.myPack.setShader(packPage.id, i >= 0 ? p.shaders[i].file : null).then((r) => (packErr(r), reloadPack()));
    }
  });
  panel.addEventListener("input", (e) => {
    if (packPage?.fx && e.target.hasAttribute("data-fx-q")) {
      packPage.fx.q = e.target.value;
      const pos = e.target.selectionStart;
      drawPackPage();
      const q = panel.querySelector("[data-fx-q]");
      q.focus();
      q.setSelectionRange(pos, pos);
      return;
    }
    const wq = e.target.hasAttribute("data-pk-wq");
    if (!packPage || (!wq && !e.target.hasAttribute("data-pk-q"))) return;
    packPage[wq ? "wq" : "q"] = e.target.value;
    const pos = e.target.selectionStart;
    drawPackPage();
    const q = panel.querySelector(wq ? "[data-pk-wq]" : "[data-pk-q]");
    q.focus();
    q.setSelectionRange(pos, pos);
  });

  // Un monde ne s'ouvre JAMAIS avec une autre version que la sienne (une autre version peut
  // l'abîmer) : « Version non détectée… Veux-tu la créer ? », puis lancement avec elle.
  async function askCreateVersion(worldKey, r, btn) {
    const fr = L() === "fr";
    const mc = r.minecraftVersion;
    const name = r.worldName || data.worlds.find((x) => x.key === worldKey)?.name || "";
    const res = await showModal({
      title: fr ? "Version non détectée" : "Version not found",
      body: fr
        ? `« ${name} » a été créé avec Minecraft ${mc}, qui n'est pas dans Mes installations. Veux-tu créer cette installation ? Elle sera téléchargée, puis le monde s'ouvrira avec elle. On n'ouvre jamais un monde avec une autre version : ça pourrait l'abîmer.`
        : `“${name}” was made with Minecraft ${mc}, which is not in My installations. Create this installation? It will be downloaded, then the world opens with it. We never open a world with another version: it could damage it.`,
      confirmLabel: fr ? `Oui, créer Minecraft ${mc}` : `Yes, create Minecraft ${mc}`,
      cancelLabel: fr ? "Non" : "No",
      tone: "ok",
    });
    if (!res?.confirmed) return;
    const out = await api.createVersion({ minecraftVersion: mc, packId: null, name: "" });
    if (!out?.ok) return showModal({ title: fr ? "Création impossible" : "Could not create", body: out?.error || "", confirmLabel: "OK", tone: "warn" });
    await refresh();
    return launch({ worldKey, versionId: out.version.id }, btn);
  }
  // Très vieux monde dont la version ne se lit pas : le joueur choisit dans Mes versions.
  function askChooseVersion(worldKey, r, btn) {
    const fr = L() === "fr";
    const name = r.worldName || data.worlds.find((x) => x.key === worldKey)?.name || "";
    if (!data.versions.length) {
      return showModal({ title: fr ? "Version inconnue" : "Unknown version", body: fr ? `On n'a pas pu lire la version de Minecraft de « ${name} ». Crée d'abord la bonne version avec « + Nouvelle installation », puis relance le monde.` : `We could not read the Minecraft version of “${name}”. First create the right version with “+ New installation”, then start the world again.`, confirmLabel: "OK", tone: "warn" });
    }
    const rows = data.versions.map((v, i) => `<label class="play-row"><input type="radio" name="cv" value="${esc(v.id)}" ${i === 0 ? "checked" : ""}><span class="t">${esc(versionLabel(v))}<small>Minecraft ${esc(v.minecraftVersion)}</small></span></label>`).join("");
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cv-t" style="max-width:480px;text-align:left;">
      <h3 id="cv-t">${fr ? "Avec quelle version ouvrir ce monde ?" : "Which version should open this world?"}</h3>
      <p style="margin:0 0 6px;">${fr ? `On n'a pas pu lire la version de Minecraft de « ${esc(name)} ». Choisis celle avec laquelle il a été créé : une autre version pourrait l'abîmer.` : `We could not read the Minecraft version of “${esc(name)}”. Pick the one it was made with: another version could damage it.`}</p>
      <div class="play-list">${rows}</div>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" class="btn-secondary" data-cv="cancel">${fr ? "Annuler" : "Cancel"}</button>
        <button type="button" class="join-btn" data-cv="ok">${fr ? "Ouvrir avec celle-ci" : "Open with this one"}</button></div></div>`);
    m.ov.addEventListener("click", (ev) => {
      const q = ev.target.closest("[data-cv]");
      if (!q) return;
      const pick = m.ov.querySelector("input[name=cv]:checked")?.value;
      m.close();
      if (q.dataset.cv === "ok" && pick) launch({ worldKey, versionId: pick }, btn);
    });
  }

  // --- Plusieurs PC : conflit d'appareils (preview validée du 24/10) ----------------------------
  // Rien n'est jamais écrasé : si les deux copies avancent, le site garde les deux versions et le
  // joueur choisit laquelle continuer ; l'autre reste dans les sauvegardes.
  async function checkDevices(key, force = false) {
    if (!worldsOn) return true;
    const r = await api.cloud.beforePlay(key, { force });
    if (!r?.ok || !r.conflict) return true;
    return openConflict(key, r);
  }
  function openConflict(key, r) {
    const fr = L() === "fr";
    const w = data.worlds.find((x) => x.key === key);
    const name = w?.name || r.name || "";
    const c = r.conflict;
    const there = c.deviceName || (fr ? "un autre PC" : "another PC");
    const here = r.here || "PC";
    const kind = c.kind; // open | played | missing
    const title = kind === "open"
      ? (fr ? `« ${esc(name)} » est ouvert sur un autre appareil` : `“${esc(name)}” is open on another device`)
      : kind === "played"
        ? (fr ? `« ${esc(name)} » a été joué sur un autre appareil` : `“${esc(name)}” was played on another device`)
        : (fr ? `La dernière partie sur « ${esc(there)} » n'est pas arrivée` : `The last game on “${esc(there)}” has not arrived`);
    const thereLine = kind === "open"
      ? (fr ? `Ouvert ${c.since ? ago(c.since) : "en ce moment"} · ou sauvegarde en cours d'envoi` : `Open ${c.since ? ago(c.since) : "right now"} · or its backup is being sent`)
      : kind === "played"
        ? (fr ? `Joué ${ago(c.at)} · dans le cloud` : `Played ${ago(c.at)} · in the cloud`)
        : (fr ? `Dernier signe ${c.at ? ago(c.at) : "inconnu"} · pas encore dans le cloud` : `Last seen ${c.at ? ago(c.at) : "unknown"} · not in the cloud yet`);
    const hereLine = w?.lastPlayed ? (fr ? `Joué ${ago(w.lastPlayed)}` : `Played ${ago(w.lastPlayed)}`) : "";
    const body = kind === "played"
      ? (fr ? `La copie de ce PC est plus ancienne que celle de « ${esc(there)} ». Récupère d'abord la dernière version pour continuer là où tu t'étais arrêté.` : `This PC's copy is older than the one on “${esc(there)}”. Get the latest version first to continue where you left off.`)
      : kind === "open"
        ? (fr ? `Si tu joues ici en même temps, les deux parties avancent chacune de leur côté. Ferme d'abord le jeu sur « ${esc(there)} ». S'il a planté ou s'est éteint sans fermer le jeu, tu peux jouer quand même.` : `If you play here at the same time, both games move on separately. Close the game on “${esc(there)}” first. If it crashed or shut down without closing the game, you can play anyway.`)
        : (fr ? `« ${esc(there)} » s'est sans doute éteint avant d'avoir envoyé sa sauvegarde. Rallume-le avec le launcher pour qu'elle parte, ou joue avec la copie de ce PC.` : `“${esc(there)}” probably shut down before sending its backup. Turn it on with the launcher so it goes out, or play with this PC's copy.`);
    const acts = kind === "played"
      ? `<button type="button" class="btn-secondary" data-c="cancel">${fr ? "Annuler" : "Cancel"}</button>
         <button type="button" class="btn-secondary" data-c="anyway">${fr ? "Jouer avec la copie de ce PC" : "Play with this PC's copy"}</button>
         <button type="button" class="join-btn" data-c="fetch">↓ ${fr ? "Récupérer la dernière version et jouer" : "Get the latest version and play"}</button>`
      : `<button type="button" class="btn-secondary" data-c="cancel">${fr ? "Annuler" : "Cancel"}</button>
         <button type="button" class="btn-secondary" data-c="anyway">${kind === "open" ? (fr ? "Jouer quand même" : "Play anyway") : (fr ? "Jouer avec la copie de ce PC" : "Play with this PC's copy")}</button>
         <button type="button" class="join-btn" data-c="wait">${kind === "open" ? (fr ? "Me prévenir quand il est fermé" : "Tell me when it's closed") : (fr ? "Me prévenir quand elle arrive" : "Tell me when it arrives")}</button>`;
    return new Promise((resolve) => {
      const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cf-t" style="max-width:520px;text-align:left;">
        <h3 id="cf-t">⚠ ${title}</h3>
        <div class="cf-devs">
          <div class="cf-dev new"><b class="sensitive">${esc(there)}</b><span>${thereLine}</span></div>
          <div class="cf-dev"><b>${fr ? "Ce PC" : "This PC"} (<span class="sensitive">${esc(here)}</span>)</b><span>${hereLine}</span></div>
        </div>
        <p style="margin:12px 0 0;">${body}</p>
        <p class="bk-hint" style="margin-top:8px;">${fr ? "Rien n'est perdu : si les deux versions avancent, on garde les deux et tu choisis laquelle continuer. L'autre reste dans les sauvegardes." : "Nothing is lost: if both versions move on, we keep both and you choose which to continue. The other stays in the backups."}</p>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">${acts}</div></div>`);
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        m.close();
        resolve(v);
      };
      // Échap ou clic à côté : Annuler.
      new MutationObserver((_, obs) => {
        if (!document.body.contains(m.ov)) {
          obs.disconnect();
          finish(false);
        }
      }).observe(document.body, { childList: true });
      m.ov.addEventListener("click", async (ev) => {
        const q = ev.target.closest("[data-c]");
        if (!q) return;
        const choice = q.dataset.c;
        if (choice === "cancel") return finish(false);
        if (choice === "wait") {
          finish(false);
          await api.cloud.waitClosed(key);
          toast(kind === "open"
            ? (fr ? `On te prévient dès que « ${name} » est fermé sur « ${there} » et que sa sauvegarde est arrivée.` : `We'll tell you as soon as “${name}” is closed on “${there}” and its backup has arrived.`)
            : (fr ? `On te prévient dès que la sauvegarde de « ${there} » est arrivée.` : `We'll tell you as soon as the backup from “${there}” has arrived.`));
          return;
        }
        if (choice === "fetch") {
          m.ov.querySelectorAll("button").forEach((x) => (x.disabled = true));
          q.textContent = fr ? "Récupération…" : "Fetching…";
          const out = await api.cloud.fetchLatest(key);
          if (!out?.ok) {
            finish(false);
            showModal({ title: fr ? "Récupération impossible" : "Could not fetch", body: out?.error || "", confirmLabel: "OK", tone: "warn" });
            return;
          }
          toast(fr ? `Dernière version de « ${name} » récupérée depuis « ${there} ». Lancement…` : `Latest version of “${name}” fetched from “${there}”. Starting…`);
          await refresh();
          finish(await checkDevices(key, true));
          return;
        }
        // Jouer quand même / avec la copie de ce PC : on prend le verrou malgré tout.
        const out = await api.cloud.beforePlay(key, { force: true }).catch(() => null);
        if (kind !== "open") toast(fr ? `Partie lancée avec la copie de ce PC. La version de « ${there} » est gardée : tu choisiras laquelle continuer.` : `Game started with this PC's copy. The “${there}” version is kept: you'll choose which to continue.`);
        finish(out?.ok !== false);
      });
    });
  }
  api.cloud.onWaitDone((r) => {
    const fr = L() === "fr";
    const w = data.worlds.find((x) => x.key === r.key);
    const name = w?.name || "";
    let msg;
    if (r.timeout) msg = fr ? `« ${name} » est toujours ouvert sur l'autre PC : on a arrêté d'attendre.` : `“${name}” is still open on the other PC: we stopped waiting.`;
    else if (r.error) msg = fr ? `« ${name} » est fermé sur l'autre PC, mais la récupération a échoué : ${r.error}` : `“${name}” is closed on the other PC, but fetching failed: ${r.error}`;
    else msg = fr ? `✓ « ${name} » est fermé sur ${r.deviceName ? `« ${r.deviceName} »` : "l'autre PC"}.${r.fetched ? " La dernière version est arrivée :" : ""} tu peux jouer.` : `✓ “${name}” is closed on ${r.deviceName ? `“${r.deviceName}”` : "the other PC"}.${r.fetched ? " The latest version arrived:" : ""} you can play.`;
    toast(msg);
    if (typeof notifyIfAway === "function") notifyIfAway(fr ? "Monde prêt" : "World ready", msg);
    refresh();
  });

  // « 2 versions de ce monde · Choisir laquelle continuer ».
  function openSplit(key) {
    const fr = L() === "fr";
    const w = data.worlds.find((x) => x.key === key);
    const cw = data.cloud?.worlds?.find((x) => x.worldKey === key);
    if (!w || !cw?.split) return;
    const here = data.cloud?.device || "PC";
    const opt = (id, dev, at) => {
      const mine = id === cw.localBase;
      const label = mine ? (fr ? `Version de ce PC (${esc(here)})` : `This PC's version (${esc(here)})`) : (fr ? `Version de « ${esc(dev || "un autre PC")} »` : `“${esc(dev || "another PC")}” version`);
      return `<label class="play-row"><input type="radio" name="sp" value="${esc(id)}" ${mine ? "checked" : ""}><span class="t">${label}<small>${fr ? `Envoyée ${ago(at)}` : `Sent ${ago(at)}`}</small></span></label>`;
    };
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="sp-t" style="max-width:500px;text-align:left;">
      <h3 id="sp-t">${fr ? `Quelle version de « ${esc(w.name)} » continuer ?` : `Which version of “${esc(w.name)}” to continue?`}</h3>
      <p style="margin:0 0 10px;">${fr ? "Les deux ont avancé de leur côté. Celle que tu ne choisis pas reste dans les sauvegardes : tu pourras y revenir." : "Both moved on separately. The one you don't pick stays in the backups: you can go back to it."}</p>
      <div class="play-list">${opt(cw.latestVersionId, cw.headDeviceName, cw.updatedAt)}${opt(cw.split.versionId, cw.split.deviceName, cw.split.createdAt)}</div>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button type="button" class="btn-secondary" data-s="cancel">${fr ? "Plus tard" : "Later"}</button>
        <button type="button" class="join-btn" data-s="ok">${fr ? "Continuer celle-ci" : "Continue this one"}</button></div></div>`);
    if (!m.ov.querySelector("input[name=sp]:checked")) m.ov.querySelector("input[name=sp]").checked = true;
    m.ov.addEventListener("click", async (ev) => {
      const q = ev.target.closest("[data-s]");
      if (!q) return;
      if (q.dataset.s === "cancel") return m.close();
      const pick = m.ov.querySelector("input[name=sp]:checked").value;
      m.ov.querySelectorAll("button").forEach((x) => (x.disabled = true));
      q.textContent = fr ? "Un instant…" : "One moment…";
      const out = await api.cloud.resolveSplit(key, pick);
      m.close();
      if (!out?.ok) return showModal({ title: fr ? "Choix impossible" : "Could not choose", body: out?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(fr ? `C'est noté. L'autre version est gardée dans les sauvegardes de « ${w.name} ».` : `Done. The other version is kept in the backups of “${w.name}”.`);
      await loadCloud(true);
      refresh();
    });
  }

  async function removeVersion(id) {
    const v = data.versions.find((x) => x.id === id);
    if (!v) return;
    const label = v.name || `${v.minecraftVersion} · ${packName(v.pack)}`;
    // 27/10 (Rushi) : case pour retirer aussi les mondes de la version, sinon ils s'accumulent.
    const own = data.worlds.filter((w) => w.home === id || w.lastVersionId === id);
    const names = own.slice(0, 4).map((w) => w.name).join(", ") + (own.length > 4 ? "…" : "");
    const res = await showModal({
      title: T("removeT", { v: label }),
      body: own.length ? T("removeDW", { l: names }) : T("removeD"),
      checkboxLabel: own.length ? T("removeW", { n: own.length }) : undefined,
      confirmLabel: T("yesRemove"),
      cancelLabel: T("no"),
      tone: "warn",
    });
    if (!res?.confirmed) return;
    const withWorlds = own.length && res.checked;
    const keys = withWorlds ? own.map((w) => w.key) : [];
    if (pjRmQueue({ id, keys, label: pjName(v), cov: pjCover(v, 46), own: own.length, withWorlds: !!withWorlds })) return;
    const r = await api.removeVersion(id, keys);
    if (!r?.ok && r?.error) return showModal({ title: label, body: r.error, confirmLabel: "OK", tone: "warn" });
    toast(withWorlds ? T("removedW", { n: r.worlds ?? own.length }) : T("removed"));
    refresh();
  }

  // --- Nouvelle version ------------------------------------------------------------------------
  async function openNewVersion() {
    let selV = null;
    let selP = "vanilla";
    let omni = false;
    let q = "";
    const types = new Set(["release"]);
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="pnv-t" style="max-width:560px;text-align:left;">
      <h3 id="pnv-t">${esc(T("newV"))}</h3><p style="margin:0 0 12px;">${esc(T("newVD"))}</p>
      <div class="field-label">${esc(T("nameL"))}</div><input type="text" class="play-in" id="pnv-name" maxlength="60" placeholder="${esc(T("nameP"))}">
      ${on("omniPack") ? `<label class="play-row om-pick" style="align-items:flex-start;margin-top:8px;"><input type="checkbox" id="pnv-omni" style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(T("omCreate"))} <span class="play-beta-tag" style="margin-left:4px;">Labo</span></b><small>${esc(T("omD"))}</small></span></label>` : ""}
      <div class="field-label" style="margin-top:12px;">${esc(T("verL"))}</div>
      <input type="search" class="play-in" id="pnv-q" placeholder="${esc(T("search"))}" autocomplete="off">
      <div class="play-chips">${[["release", "fRel"], ["snapshot", "fSnap"], ["old", "fOld"]].map(([t, k]) => `<label><input type="checkbox" data-t="${t}" ${types.has(t) ? "checked" : ""}> ${esc(T(k))}</label>`).join("")}<span class="join-note" id="pnv-count" style="margin:0 0 0 auto;"></span></div>
      <div class="play-vlist" id="pnv-list" role="listbox" aria-label="${esc(T("verL"))}"><p class="join-note" style="margin:8px;">${esc(T("loadingVersions"))}</p></div>
      <p class="play-warn" id="pnv-warn" hidden></p>
      <div class="field-label" id="pnv-plabel" style="margin-top:12px;">${esc(T(on("omniPack") ? "typeL" : "packL"))}</div>
      <div class="play-list" id="pnv-packs" style="margin-top:6px;max-height:none;"></div>
      ${on("packRam") ? `<div id="pnv-ram"></div>` : ""}
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button type="button" class="btn-secondary" id="pnv-cancel">${esc(T("cancel"))}</button>
        <button type="button" class="btn-secondary" id="pnv-create" disabled>${esc(T("create"))}</button>
        <button type="button" class="join-btn" id="pnv-play" disabled>${esc(T("createPlay"))}</button>
      </div></div>`);
    const { $ } = m;
    m.$("#pnv-cancel").addEventListener("click", m.close);
    const [vr] = await Promise.all([data.mcVersions ? { ok: true, versions: data.mcVersions } : api.mcVersions(), loadPacks()]);
    if (!vr?.ok) {
      $("#pnv-list").innerHTML = `<p class="join-note" style="margin:8px;">${esc(T("versionsError"))}</p>`;
      return;
    }
    data.mcVersions = vr.versions;
    const all = vr.versions;
    selV = all.find((x) => x.type === "release")?.id || all[0]?.id;
    const packsFor = (ver) => data.packs.filter((p) => (p.versions || []).some((x) => x.minecraftVersion === ver));
    // RAM de la future installation (Laboratoire « packRam »), repliée sur une ligne.
    const ramSt = { mode: "auto", gb: 0, fold: true };
    let ramDraw = null;
    const ramCtx = () => {
      const pk = data.packs.find((p) => p.id === selP);
      const pv = pk?.versions?.find((x) => x.minecraftVersion === selV);
      return { mods: pv ? pv.files.length : 0, mc: selV || "", shaders: false, packGB: null };
    };
    if ($("#pnv-ram")) {
      await rmLoadSys();
      ramDraw = rmMount($("#pnv-ram"), ramSt, ramCtx);
    }
    const draw = () => {
      const f = all.filter((x) => types.has(x.type) && x.id.toLowerCase().includes(q.toLowerCase()));
      $("#pnv-count").textContent = T("count", { n: f.length });
      $("#pnv-list").innerHTML = f.length
        ? f.map((x) => `<button type="button" role="option" aria-selected="${x.id === selV}" data-v="${esc(x.id)}">${esc(x.id)}${x.type === "snapshot" ? " <small>snapshot</small>" : x.type === "old" ? ` <small>${L() === "fr" ? "ancienne" : "old"}</small>` : ""}</button>`).join("")
        : `<p class="join-note" style="margin:8px;">${esc(T("none"))}</p>`;
      const t = all.find((x) => x.id === selV)?.type;
      $("#pnv-warn").hidden = !selV || t === "release";
      $("#pnv-warn").textContent = t === "snapshot" ? T("snapW") : t === "old" ? T("oldW") : "";
      // Seuls les packs vraiment prêts (publiés) pour cette version : rien n'est promis ailleurs.
      // Pack Omniscient : seulement Vanilla ou Mon pack (pas les packs officiels).
      const avail = omni ? [] : packsFor(selV);
      const grp = on("omniPack");
      // Mon pack : seulement là où un chargeur de mods existe (mêmes limites que openMyPack). Sinon, la
      // fenêtre suivante passait en silence à une autre version (01/11, Rushi : test Fabric trop vieux).
      const mineOk = t === "release" && adCmp(selV, "1.7.10") >= 0;
      if (selP === "mine" && !mineOk) selP = "vanilla";
      if (selP !== "vanilla" && selP !== "mine" && !(grp && selP === "__omni") && !avail.some((p) => p.id === selP)) selP = "vanilla";
      if (grp && selP === "__omni" && avail.length) selP = avail[0].id;
      const omSel = grp && (selP === "__omni" || avail.some((p) => p.id === selP));
      $("#pnv-plabel").hidden = $("#pnv-packs").hidden = false;
      $("#pnv-packs").innerHTML = [
        `<label class="play-row" style="align-items:flex-start;"><input type="radio" name="pnv-pack" value="vanilla" ${selP === "vanilla" ? "checked" : ""} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">Vanilla</b><small>${esc(T("vanillaD"))}</small></span><span class="sz">${esc(T("noMods"))}</span></label>`,
        ...(grp ? [] : avail).map((p) => {
          const pv = p.versions.find((x) => x.minecraftVersion === selV);
          return `<label class="play-row" style="align-items:flex-start;"><input type="radio" name="pnv-pack" value="${esc(p.id)}" ${p.id === selP ? "checked" : ""} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(packName(p))} <span class="play-beta-tag" style="margin-left:4px;">${esc(T("official"))}</span></b><small>${esc(p.description?.[L()] || p.description?.fr || "")}</small></span><span class="sz">${pv.files.length} ${esc(T("mods"))}</span></label>`;
        }),
        on("myPack") && `<label class="play-row" style="align-items:flex-start;${mineOk ? "" : "opacity:.6;cursor:not-allowed;"}"><input type="radio" name="pnv-pack" value="mine" ${selP === "mine" ? "checked" : ""} ${mineOk ? "" : "disabled"} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(T("mpPick"))}</b><small>${esc(T(mineOk ? "mpPickD" : "mpPickOld"))}</small></span><span class="sz">Modrinth</span></label>`,
        grp && !omni && `<label class="play-row" style="align-items:flex-start;"><input type="radio" name="pnv-pack" value="__omni" ${omSel ? "checked" : ""} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(T("omList"))}</b><small>${esc(T("omListD"))}</small></span><span class="sz">${esc(avail.length ? `${avail.length} pack${avail.length > 1 ? "s" : ""}` : L() === "fr" ? "Bientôt" : "Soon")}</span></label>`,
        grp && !omni && omSel && (avail.length
          ? avail.map((p) => { const pv = p.versions.find((x) => x.minecraftVersion === selV); return `<label class="play-row" style="align-items:flex-start;margin-left:26px;"><input type="radio" name="pnv-omp" value="${esc(p.id)}" ${p.id === selP ? "checked" : ""} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(packName(p))}</b><small>${esc(p.author ? T("omBy", { a: p.author }) + " · " : "")}${esc(p.description?.[L()] || p.description?.fr || "")}</small></span><span class="sz">${pv.files.length} ${esc(T("mods"))}</span></label>`; }).join("")
          : `<div style="margin:2px 0 4px 26px;padding:10px 12px;border-radius:10px;border:1px dashed var(--border);"><b style="font-size:13px;">${esc(T("omNone"))}</b><p class="join-note" style="margin:4px 0 0;">${esc(T("omJoin"))}</p></div>`),
        omni && `<p class="join-note" style="margin:4px 2px 0;">${esc(T("omOnly"))}</p>`,
      ].filter(Boolean).join("");
      $("#pnv-create").disabled = !selV || selP === "__omni";
      $("#pnv-play").disabled = !selV || selP === "mine" || selP === "__omni";
      if (ramDraw) {
        $("#pnv-ram").hidden = selP === "mine" || selP === "__omni";
        ramDraw();
      }
    };
    draw();
    $("#pnv-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]");
      if (!b) return;
      selV = b.dataset.v;
      draw();
    });
    $("#pnv-packs").addEventListener("change", (e) => {
      if (e.target.name === "pnv-pack") {
        selP = e.target.value;
        // Pack Omniscient : on choisit le premier pack de la liste, s'il y en a.
        if (selP === "__omni") selP = packsFor(selV)[0]?.id || "__omni";
        return draw();
      }
      if (e.target.name === "pnv-omp") {
        selP = e.target.value;
        return draw();
      }
      $("#pnv-play").disabled = !selV || selP === "mine";
    });
    $("#pnv-omni")?.addEventListener("change", (e) => {
      omni = e.target.checked;
      draw();
    });
    $("#pnv-q").addEventListener("input", (e) => {
      q = e.target.value.trim();
      draw();
    });
    m.ov.querySelectorAll("[data-t]").forEach((c) => c.addEventListener("change", () => {
      c.checked ? types.add(c.dataset.t) : types.delete(c.dataset.t);
      draw();
    }));
    const make = async (andPlay) => {
      if (selP === "mine") {
        m.close();
        return openMyPack({ minecraftVersion: selV, name: $("#pnv-name").value.trim(), omni: omni && on("omniPack") });
      }
      $("#pnv-create").disabled = $("#pnv-play").disabled = true;
      const name = $("#pnv-name").value.trim();
      const om = omni && on("omniPack") && selP === "vanilla";
      const r = await api.createVersion({ minecraftVersion: selV, packId: selP === "vanilla" ? null : selP, name, omni: om || undefined });
      if (!r?.ok) {
        $("#pnv-create").disabled = $("#pnv-play").disabled = false;
        $("#pnv-warn").hidden = false;
        $("#pnv-warn").textContent = r?.error || "";
        return;
      }
      if (ramDraw && ramSt.mode !== "auto") await rmSave(r.version.id, ramSt);
      m.close();
      await refresh();
      if (andPlay) launch({ versionId: r.version.id });
      else if (selP === "vanilla" && (on("vanillaPage") || om)) openPackPage(r.version.id);
      else toast(T("created", { n: r.version.name || `${selV} · ${packName(r.version.pack)}` }));
    };
    $("#pnv-create").addEventListener("click", () => make(false));
    $("#pnv-play").addEventListener("click", () => make(true));
    $("#pnv-q").focus();
  }

  // --- Sauvegarde par monde -----------------------------------------------------------------
  async function toggleBackup(key) {
    const w = data.worlds.find((x) => x.key === key);
    if (!w) return;
    if (!w.backup) {
      await api.setWorldBackup(key, true);
      toast(T("toastOn", { w: w.name }));
      return refresh();
    }
    // Case décochée par défaut : les sauvegardes restent si le joueur ne fait rien.
    const res = await showModal({
      title: T("offT", { w: w.name }),
      body: w.backups ? T("offD", { n: w.backups }) : T("offD0"),
      confirmLabel: T("offOk"),
      cancelLabel: T("cancel"),
      checkboxLabel: w.backups ? T("offBox", { n: w.backups }) : undefined,
      tone: "warn",
    });
    if (!res?.confirmed) return;
    await api.setWorldBackup(key, false, { deleteExisting: !!res.checked });
    toast(res.checked ? T("toastOffDel", { w: w.name }) : T("toastOffKeep", { n: w.backups, w: w.name }));
    refresh();
  }

  // Ce que la limite garde et supprime vraiment (même calcul que planBackups dans playMode.js) :
  // la plus récente et la dernière « avant restauration » sont toujours gardées ; les sauvegardes
  // avec un nom aussi si la case est cochée (elles comptent quand même dans la place utilisée).
  function planBackups(list, cfg) {
    const keep = [];
    const drop = [];
    const lastRestore = list.find((b) => b.reason === "before-restore");
    let n = 0;
    let used = 0;
    list.forEach((b, i) => {
      const size = Number(b.sizeBytes) || 0;
      if ((cfg.named && b.label) || b === lastRestore || b.reason === "import" || b.reason === "upgrade" || b.guardKeep) {
        keep.push(b);
        n++; // compte dans le nombre (une limite de 10 = 10 au total), jamais supprimée
        used += size;
        return;
      }
      const fits = cfg.mode === "size" ? used + size <= cfg.sizeMb * 1e6 : cfg.count === 0 || n < cfg.count;
      if (i === 0 || fits) {
        keep.push(b);
        n++;
        used += size;
      } else drop.push(b);
    });
    return { keep, drop };
  }

  // Fenêtre « Sauvegardes » (design A « Curseur » choisi par Rushi le 25/10) : la fréquence de la
  // sauvegarde automatique, combien en garder (un curseur, ou une taille max par monde en option
  // avancée) et l'envoi automatique dans le cloud (Supporter). Réglages LES MÊMES POUR TOUS LES
  // MONDES (retour de Rushi, 25/10). Ouverte depuis un monde : on y voit aussi ses sauvegardes ;
  // depuis « Réglages des sauvegardes » (en-tête de Mes mondes) : seulement les réglages.
  // Aucun chiffre estimé : seulement les tailles réelles et ce que le réglage supprimerait vraiment.
  const BK_STOPS = [1, 2, 3, 5, 10, 15, 20, 30, 50, 0]; // 0 = tout garder
  const BK_EVERY = [5, 10, 15, 30, 60];
  const BK_SIZES = [250, 500, 1000, 2000, 5000];
  async function openHistory(key = null) {
    const w = key ? data.worlds.find((x) => x.key === key) : null;
    if (key && !w) return;
    const fr = L() === "fr";
    const tr = (a, b) => (fr ? a : b);
    // Les sauvegardes de chaque monde : le réglage s'applique à tous, on montre ce qu'il fait partout.
    const lists = await Promise.all(data.worlds.map((x) => api.listBackups(x.key).then((res) => ({ key: x.key, name: x.name, list: res?.backups || [], keep: res?.keep })).catch(() => ({ key: x.key, name: x.name, list: [] }))));
    const r = lists.find((x) => x.keep) || (await api.listBackups(null));
    const list = (key && lists.find((x) => x.key === key)?.list) || [];
    const all = lists.flatMap((x) => x.list);
    const saved = r?.keep || { mode: "count", count: 10, sizeMb: 1000, named: true, every: 30, send: "all", online: 3 };
    const cfg = { every: 30, send: "all", online: 3, ...saved };
    const savedOnline = cfg.online;
    const savedSend = cfg.send;
    if (!BK_EVERY.includes(cfg.every)) cfg.every = 30;
    // Un nombre réglé avant le curseur (ex. 12) devient un cran de plus.
    const stops = [...BK_STOPS];
    if (!stops.includes(cfg.count)) stops.splice(stops.findIndex((s) => s === 0 || s > cfg.count), 0, cfg.count);
    const reasons = S[L()].reason;
    const c = data.cloud;
    const sup = !!c?.offer?.cloud;
    const sum = (arr) => arr.reduce((a, b) => a + (Number(b.sizeBytes) || 0), 0);
    const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
    const lab = (v) => (v === 60 ? "1 h" : `${v} min`);
    let showList = false;
    // Ce que le réglage garderait et supprimerait, monde par monde.
    const planAll = () => {
      const keep = [];
      const drop = [];
      let worlds = 0;
      for (const x of lists) {
        const pl = planBackups(x.list, cfg);
        keep.push(...pl.keep);
        drop.push(...pl.drop);
        if (pl.drop.length) worlds++;
      }
      return { keep, drop, worlds };
    };
    const m = overlay(`<div class="modal-box pop-in nb-box" role="dialog" aria-modal="true" aria-labelledby="nb-t">
      <h3 id="nb-t">${esc(w ? T("histT", { w: w.name }) : tr("Réglages des sauvegardes", "Backup settings"))}</h3>
      <p class="nb-sub"><span class="nb-all">${tr("Pour tous tes mondes", "For all your worlds")}</span> ${tr("Tes sauvegardes se font toutes seules pendant la partie et quand tu quittes le monde.", "Your backups are made automatically while you play and when you leave the world.")}</p>
      <div class="nb-tiles${sup ? "" : " one"}" id="nb-tiles"></div>
      <div id="nb-freq"></div>
      <div id="nb-ctrl"></div>
      <div class="nb-adv" id="nb-adv"></div>
      <p class="nb-res" id="nb-res"></p>
      <div id="nb-cloud"></div>
      <label class="nb-check"><input type="checkbox" id="nb-named" ${cfg.named ? "checked" : ""}> <span>${tr("Garder pour toujours les sauvegardes avec un nom", "Keep backups with a name forever")}<small>${tr("Celles faites avec Maj+F6 en jeu (ex. « Elytra obtenu »). Elles comptent dans le nombre.", "Made with Shift+F6 in game (e.g. “Got the elytra”). They count in the number.")}</small></span></label>
      ${!w ? "" : list.length ? `<button type="button" class="link-btn" id="nb-tog" style="font-size:12.5px;margin-top:12px;"></button><div class="nb-list" id="nb-list" hidden></div>` : `<div class="nb-empty">${esc(T("histEmpty"))}</div>`}
      <div class="nb-ingame"><strong>${tr("Pendant la partie", "While playing")}</strong> · <kbd>F6</kbd> ${tr("sauvegarder maintenant", "save now")} · <kbd>${tr("Maj", "Shift")}+F6</kbd> ${tr("sauvegarder avec un nom", "save with a name")}
        <label><input type="checkbox" id="nb-toast" checked> ${esc(T("inGameToast"))}</label></div>
      <div class="nb-acts">
        ${w ? `<button type="button" class="link-btn" id="nb-folder" style="margin-right:auto;">${esc(T("openFolder"))}</button>
        <button type="button" class="btn-secondary" id="nb-now" style="margin:0;" ${data.running || !w.backup ? "disabled" : ""}>${esc(T("backupNow"))}</button>` : `<span style="margin-right:auto;"></span>`}
        <button type="button" class="btn-secondary" id="nb-close" style="margin:0;">${esc(T("cancel"))}</button>
        <button type="button" class="join-btn" id="nb-save">${tr("Enregistrer", "Save")}</button>
      </div></div>`);
    const $ = m.$;

    function tiles(pl) {
      const nw = lists.length;
      const pc = `<div class="nb-tile"><span>${tr("Sur ce PC", "On this PC")} · ${esc(plural(nw, tr("monde", "world"), tr("mondes", "worlds")))}</span><b>${plural(all.length, tr("sauvegarde", "backup"), tr("sauvegardes", "backups"))} · ${esc(sizeFmt(sum(all)))}</b>
        <small>${all.length ? (pl.drop.length ? esc(tr(`Après réglage : ${pl.keep.length} · ${sizeFmt(sum(pl.keep))}`, `After this setting: ${pl.keep.length} · ${sizeFmt(sum(pl.keep))}`)) : tr("Rien ne change avec ce réglage", "Nothing changes with this setting")) : tr("La première arrive pendant ta prochaine partie", "The first one comes during your next game")}</small></div>`;
      if (!sup) return pc;
      const quota = c.offer.quotaBytes || 0;
      const inCloud = all.filter((b) => b.cloud?.versionId);
      // Ce que la limite retirerait aussi en ligne : jamais les sauvegardes avec un nom.
      const usedAfter = Math.max(0, (c.usedBytes || 0) - sum(pl.drop.filter((b) => b.cloud?.versionId && !b.label)));
      const pct = quota ? Math.min(100, (usedAfter / quota) * 100) : 0;
      return pc + `<div class="nb-tile"><span>☁ ${tr("Dans le cloud", "In the cloud")}</span><b>${inCloud.length ? `${plural(inCloud.length, "version", "versions")} · ${esc(sizeFmt(sum(inCloud)))}` : tr("Rien pour l'instant", "Nothing yet")}</b>
        <div class="nb-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <small>${esc(tr(`Ton espace : ${sizeFmt(usedAfter)} sur ${sizeFmt(quota)} · il reste ${sizeFmt(Math.max(0, quota - usedAfter))}`, `Your space: ${sizeFmt(usedAfter)} of ${sizeFmt(quota)} · ${sizeFmt(Math.max(0, quota - usedAfter))} left`))}</small></div>`;
    }
    function freqHtml() {
      let back = "";
      if (cfg.mode === "count") {
        if (cfg.count === 0) back = tr("Tu peux revenir aussi loin que tu veux.", "You can go back as far as you want.");
        else {
          const mins = cfg.count * cfg.every;
          const d = mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60}` : ""}` : `${mins} min`;
          back = tr(`Avec ${cfg.count} sauvegarde${cfg.count > 1 ? "s" : ""} toutes les ${lab(cfg.every)}, tu peux revenir jusqu'à ${d} de jeu en arrière.`, `With ${cfg.count} backup${cfg.count > 1 ? "s" : ""} every ${lab(cfg.every)}, you can go back up to ${d} of play.`);
        }
      }
      return `<div class="nb-q">${tr("Sauvegarde automatique pendant la partie", "Automatic backup while playing")}</div>
        <div class="nb-big"><span>${tr("toutes les", "every")}</span><b style="font-size:26px;">${lab(cfg.every)}</b></div>
        <input type="range" class="nb-range" id="nb-every" min="0" max="${BK_EVERY.length - 1}" step="1" value="${BK_EVERY.indexOf(cfg.every)}" aria-label="${tr("Fréquence", "Frequency")}">
        <div class="nb-ticks" style="grid-template-columns:repeat(${BK_EVERY.length},1fr);">${BK_EVERY.map((v, i) => `<span data-ei="${i}" class="${v === cfg.every ? "on" : ""}">${lab(v)}</span>`).join("")}</div>
        <p class="nb-sub" style="margin:8px 0 0;">${esc(back)}${back ? " " : ""}${tr("Le compte repart à chaque sauvegarde (F6 compris).", "The count restarts at each backup (F6 included).")}</p>`;
    }
    function ctrlHtml() {
      if (cfg.mode === "size") {
        return `<div class="nb-q">${tr("Place maximale par monde sur ce PC", "Maximum space per world on this PC")}<span class="tag">${tr("option avancée", "advanced")}</span></div>
          <div class="nb-pills" role="radiogroup">${BK_SIZES.map((v) => `<button type="button" role="radio" data-size="${v}" aria-checked="${cfg.sizeMb === v}">${esc(sizeFmt(v * 1e6))}</button>`).join("")}</div>`;
      }
      const idx = stops.indexOf(cfg.count);
      return `<div class="nb-q">${tr("Combien de sauvegardes garder ?", "How many backups to keep?")}</div>
        <div class="nb-big"><b>${cfg.count === 0 ? "∞" : cfg.count}</b><span>${cfg.count === 0 ? tr("on garde tout", "keep everything") : cfg.count === 1 ? tr("seulement la dernière, par monde", "only the latest, per world") : tr("dernières sauvegardes par monde", "latest backups per world")}</span></div>
        <input type="range" class="nb-range" id="nb-range" min="0" max="${stops.length - 1}" step="1" value="${idx < 0 ? 4 : idx}" aria-label="${tr("Nombre de sauvegardes", "Number of backups")}">
        <div class="nb-ticks" style="grid-template-columns:repeat(${stops.length},1fr);">${stops.map((s, i) => `<span data-i="${i}" class="${s === cfg.count ? "on" : ""}">${s === 0 ? "∞" : s}</span>`).join("")}</div>`;
    }
    function cloudHtml() {
      if (!sup) return `<p class="nb-sub" style="margin:10px 0 0;">${tr("Tes sauvegardes restent seulement sur ce PC.", "Your backups stay only on this PC.")}</p>`;
      const sends = [
        ["all", tr("Toutes", "All"), tr("Chaque sauvegarde part dans le cloud, après la partie (rien n'est envoyé pendant que tu joues). Sur ton autre PC, tu retrouves exactement les mêmes.", "Every backup goes to the cloud, after the game (nothing is sent while you play). On your other PC you get exactly the same ones.")],
        // « Partiel » : ancien « Une par partie », renommé par Rushi le 25/10 (on choisit combien en ligne).
        ["game", tr("Partiel", "Partial"), tr("Seulement la dernière de chaque partie, plus celles avec un nom, et tu choisis combien en garder en ligne. Les autres restent sur ce PC.", "Only the last one of each game, plus named ones, and you choose how many stay online. The others stay on this PC.")],
        ["manual", tr("À la main", "Manually"), tr("Rien ne part tout seul. Tu envoies quand tu veux avec « ☁ Synchroniser » dans Mes mondes.", "Nothing is sent automatically. You send when you want with “☁ Sync” in My worlds.")],
      ];
      const cur = sends.find((x) => x[0] === cfg.send) || sends[0];
      // Versions en ligne par monde (25/10) : plafonné par l'offre (table des offres du site).
      const cap = Number(c.offer?.cloudVersions) > 0 ? Number(c.offer.cloudVersions) : 10;
      const onl = [1, 2, 3, 5, 10].filter((v) => v <= cap);
      if (!onl.includes(cap)) onl.push(cap);
      if (cfg.online > cap) cfg.online = cap;
      const n = cfg.online;
      return `<div class="nb-q">☁ ${tr("Envoi automatique dans le cloud", "Automatic cloud upload")}</div>
        <div class="nb-pills" role="radiogroup">${sends.map(([v, l]) => `<button type="button" role="radio" data-send="${v}" aria-checked="${cfg.send === v}">${esc(l)}</button>`).join("")}</div>
        <p class="nb-sub" style="margin:8px 0 0;">${esc(cur[2])}</p>
        ${cfg.send !== "game" ? "" : `<div class="nb-q" style="margin-top:14px;">☁ ${tr("Versions gardées en ligne, par monde", "Versions kept online, per world")}</div>
        <div class="nb-pills" role="radiogroup">${onl.map((v) => `<button type="button" role="radio" data-online="${v}" aria-checked="${cfg.online === v}">${v}</button>`).join("")}</div>
        <div class="nb-cloud"><span>☁</span><span>${fr
          ? `<b>En ligne : ${n === 1 ? "la dernière" : `les ${n} dernières`} de chaque monde</b>, plus celles avec un nom (★) et celles que tu envoies toi-même (☁ Envoyer, dans la liste d'un monde). Les plus anciennes sortent du cloud et restent sur ce PC.`
          : `<b>Online: the latest ${n === 1 ? "one" : n} of each world</b>, plus named ones (★) and the ones you send yourself (☁ Send, in a world's list). Older ones leave the cloud and stay on this PC.`}</span></div>`}`;
    }
    // Pendant qu'on fait glisser un curseur, on garde l'élément <input type=range> (sinon le
    // glissement s'arrête) et on remplace seulement ce qu'il y a autour.
    function fill(el, html) {
      const range = el.querySelector("input[type=range]");
      if (!range || document.activeElement !== range || range.parentNode !== el) {
        el.innerHTML = html;
        return;
      }
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const fresh = tmp.querySelector(":scope > input[type=range]");
      if (!fresh) {
        el.innerHTML = html;
        return;
      }
      [...el.childNodes].forEach((n) => n !== range && n.remove());
      const kids = [...tmp.childNodes];
      const at = kids.indexOf(fresh);
      kids.slice(0, at).forEach((n) => el.insertBefore(n, range));
      kids.slice(at + 1).forEach((n) => el.appendChild(n));
    }
    function draw() {
      const pl = planAll();
      const plW = planBackups(list, cfg);
      $("#nb-tiles").innerHTML = tiles(pl);
      fill($("#nb-freq"), freqHtml());
      fill($("#nb-ctrl"), ctrlHtml());
      $("#nb-adv").innerHTML = cfg.mode === "size"
        ? `<button type="button" class="link-btn" data-mode="count">← ${tr("Revenir au nombre de sauvegardes (conseillé)", "Back to a number of backups (advised)")}</button>`
        : `<button type="button" class="link-btn" data-mode="size">${tr("Option avancée : limiter plutôt par place sur le disque", "Advanced: limit by disk space instead")}</button>`;
      const res = $("#nb-res");
      const n = pl.drop.length;
      if (!all.length) {
        res.className = "nb-res ok";
        res.textContent = tr("Aucune sauvegarde pour l'instant : ce réglage s'appliquera dès les premières.", "No backups yet: this setting will apply from the first ones.");
      } else if (n) {
        res.className = "nb-res warn";
        const inW = pl.worlds > 1 ? tr(` dans ${pl.worlds} mondes`, ` in ${pl.worlds} worlds`) : "";
        res.textContent = tr(
          `En enregistrant, ${n} ancienne${n > 1 ? "s" : ""} sauvegarde${n > 1 ? "s" : ""}${inW} (${sizeFmt(sum(pl.drop))}) ser${n > 1 ? "ont" : "a"} supprimée${n > 1 ? "s" : ""}${sup ? " de ce PC et du cloud" : " de ce PC"}. On te le redemande avant.`,
          `When you save, ${n} old backup${n > 1 ? "s" : ""}${inW} (${sizeFmt(sum(pl.drop))}) will be deleted${sup ? " from this PC and the cloud" : " from this PC"}. We ask again first.`);
      } else {
        res.className = "nb-res ok";
        res.textContent = cfg.mode === "count" && cfg.count === 0
          ? tr("Rien n'est jamais supprimé tout seul. Attention, ça prend de plus en plus de place.", "Nothing is ever deleted automatically. Careful, it takes more and more space.")
          : tr("Tes sauvegardes actuelles rentrent : rien n'est supprimé maintenant.", "Your current backups fit: nothing is deleted now.");
      }
      if (cfg.mode === "size" && cfg.named && lists.some((x) => sum(x.list.filter((b) => b.label)) > cfg.sizeMb * 1e6)) res.textContent += tr(" Les sauvegardes nommées sont gardées même si elles dépassent la limite.", " Named backups are kept even if they go over the limit.");
      else if (cfg.mode === "size" && lists.some((x) => x.list[0] && x.list[0].sizeBytes > cfg.sizeMb * 1e6)) res.textContent += tr(" La plus récente de chaque monde est toujours gardée, même si elle est plus grosse que la limite.", " Each world's newest is always kept, even if it is bigger than the limit.");
      $("#nb-cloud").innerHTML = cloudHtml();
      const tog = $("#nb-tog");
      if (!tog) return;
      tog.textContent = showList ? tr("Cacher la liste", "Hide the list") : tr(`Voir les ${list.length} sauvegardes`, `See the ${list.length} backups`);
      $("#nb-list").hidden = !showList;
      if (!showList) return;
      const drop = new Set(plW.drop);
      $("#nb-list").innerHTML = list.map((b) => `<div class="nb-row${drop.has(b) ? " gone" : ""}">
          <span class="d">${esc(dateFmt(b.createdAt))}${b.label ? ` · <b>★ « ${esc(b.label)} »</b>` : ` · ${esc(reasons[b.reason] || b.reason)}`}${b.cloud?.versionId ? " · ☁" : ""}${drop.has(b) ? `<small>${tr("sera supprimée", "will be deleted")}</small>` : ""}</span>
          <span class="s">${esc(sizeFmt(b.sizeBytes))}</span>
          <button type="button" class="link-btn" data-restore="${esc(b.id)}" style="font-size:12px;" ${data.running ? "disabled" : ""}>${esc(T("restore"))}</button></div>`).join("");
    }
    draw();

    m.ov.addEventListener("click", async (e) => {
      const b = e.target.closest("button,[data-i],[data-ei]");
      if (!b || !m.ov.contains(b)) return;
      if (b.dataset.restore) return restore(b.dataset.restore);
      if (b.dataset.mode) { cfg.mode = b.dataset.mode; return draw(); }
      if (b.dataset.size) { cfg.sizeMb = Number(b.dataset.size); return draw(); }
      if (b.dataset.send) { cfg.send = b.dataset.send; return draw(); }
      if (b.dataset.online) { cfg.online = Number(b.dataset.online); return draw(); }
      if (b.dataset.ei != null) { cfg.every = BK_EVERY[Number(b.dataset.ei)]; return draw(); }
      if (b.dataset.i != null) { cfg.count = stops[Number(b.dataset.i)]; return draw(); }
      if (b.id === "nb-tog") { showList = !showList; return draw(); }
    });
    m.ov.addEventListener("input", (e) => {
      if (e.target.id === "nb-every") { cfg.every = BK_EVERY[Number(e.target.value)]; draw(); }
      if (e.target.id === "nb-range") { cfg.count = stops[Number(e.target.value)]; draw(); }
    });
    $("#nb-named").addEventListener("change", (e) => { cfg.named = e.target.checked; draw(); });
    $("#nb-close").addEventListener("click", m.close);
    window.mchub.settings.get().then((st) => { if (st && st.playSaveToast === false) $("#nb-toast").checked = false; }).catch(() => {});
    $("#nb-toast").addEventListener("change", (e) => window.mchub.settings.set({ playSaveToast: e.target.checked }));
    $("#nb-folder")?.addEventListener("click", () => api.openWorldFolder(key));
    $("#nb-now")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      const res = await api.backupNow(key);
      m.close();
      if (!res?.ok) return showModal({ title: w.name, body: res?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(T("backupDone"));
      refresh();
    });
    $("#nb-save").addEventListener("click", async () => {
      const pl = planAll();
      const n = pl.drop.length;
      if (n) {
        const ok = await showModal({
          title: tr(`Supprimer ${n} ancienne${n > 1 ? "s" : ""} sauvegarde${n > 1 ? "s" : ""} ?`, `Delete ${n} old backup${n > 1 ? "s" : ""}?`),
          body: (() => {
            const per = lists.map((x) => [x.name, planBackups(x.list, cfg).drop.length]).filter(([, k]) => k).map(([nm, k]) => `« ${nm} » : ${k}`).join(" · ");
            return fr
              ? `${per} (${sizeFmt(sum(pl.drop))}). ${n > 1 ? "Elles seront supprimées" : "Elle sera supprimée"} de ce PC pour de bon${sup ? ", et du cloud" : ""}. Tes mondes ne sont pas touchés. Les sauvegardes avec un nom sont gardées en ligne.`
              : `${per} (${sizeFmt(sum(pl.drop))}). ${n > 1 ? "They will be deleted" : "It will be deleted"} from this PC for good${sup ? ", and from the cloud" : ""}. Your worlds are not touched. Named backups are kept online.`;
          })(),
          confirmLabel: tr("Oui, supprimer", "Yes, delete"),
          cancelLabel: tr("Non", "No"),
          tone: "warn",
        });
        if (!ok?.confirmed) return;
      }
      // Passer à « Partiel », ou y baisser le nombre : des versions en ligne peuvent sortir du cloud.
      if (sup && cfg.send === "game" && (savedSend !== "game" || cfg.online < savedOnline)) {
        const ok = await showModal({
          title: tr(`Garder ${cfg.online} version${cfg.online > 1 ? "s" : ""} en ligne par monde ?`, `Keep ${cfg.online} version${cfg.online > 1 ? "s" : ""} online per world?`),
          body: tr("Les versions en ligne en trop (les plus anciennes, sans nom) sortent du cloud. Elles restent sur ce PC. Celles avec un nom et celles envoyées à la main restent en ligne.", "Extra online versions (the oldest, unnamed) leave the cloud. They stay on this PC. Named ones and the ones you sent by hand stay online."),
          confirmLabel: tr("Oui", "Yes"),
          cancelLabel: tr("Non", "No"),
          tone: "warn",
        });
        if (!ok?.confirmed) return;
      }
      const out = await api.setBackupLimit(null, cfg);
      m.close();
      if (!out?.ok) return showModal({ title: tr("Réglages des sauvegardes", "Backup settings"), body: out?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(out.deleted
        ? tr(`${out.deleted} ancienne${out.deleted > 1 ? "s" : ""} sauvegarde${out.deleted > 1 ? "s" : ""} supprimée${out.deleted > 1 ? "s" : ""}. Réglages enregistrés pour tous tes mondes.`, `${out.deleted} old backup${out.deleted > 1 ? "s" : ""} deleted. Settings saved for all your worlds.`)
        : tr("Réglages enregistrés pour tous tes mondes.", "Settings saved for all your worlds."));
      refresh();
    });
    async function restore(id) {
      const backup = list.find((x) => x.id === id);
      if (!backup) return;
      m.close();
      const vdiff = on("versionGuard") && backup.minecraftVersion && w.minecraftVersion && backup.minecraftVersion !== w.minecraftVersion;
      const tr = (a, b) => (L() === "fr" ? a : b);
      const res = await showModal({ title: T("restoreT", { w: w.name }), body: T("restoreD", { d: dateFmt(backup.createdAt) }) + (vdiff ? "\n\n" + tr(`⚠ Cette sauvegarde est en Minecraft ${backup.minecraftVersion}, ton monde est en ${w.minecraftVersion}. Après la restauration, le monde redevient ${backup.minecraftVersion} et s'ouvrira avec Minecraft ${backup.minecraftVersion}.`, `⚠ This backup is on Minecraft ${backup.minecraftVersion}, your world is on ${w.minecraftVersion}. After restoring, the world is back on ${backup.minecraftVersion} and opens with Minecraft ${backup.minecraftVersion}.`) : ""), confirmLabel: vdiff ? tr(`Restaurer en ${backup.minecraftVersion}`, `Restore on ${backup.minecraftVersion}`) : T("restore"), cancelLabel: T("cancel"), tone: "warn" });
      if (!res?.confirmed) return;
      const out = await api.restoreBackup(key, backup.id);
      if (!out?.ok) return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(T("restored", { w: w.name }));
      refresh();
    }
  }

  // --- Changement de version (27/10, preview validée par Rushi, Laboratoire « versionGuard ») ------
  const cmpMcVer = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });
  // Dernière version de Minecraft plus récente que celle de l'installation (sorties officielles).
  function newerFor(v) {
    if (!on("versionGuard") || !v || !data.mcVersions?.length || (v.pack && v.pack.kind !== "mine")) return null;
    const top = data.mcVersions.filter((x) => x.type === "release").map((x) => x.id).sort((a, b) => cmpMcVer(b, a))[0];
    return top && cmpMcVer(top, v.minecraftVersion) > 0 ? top : null;
  }
  // Mettre à jour une installation (retour de Rushi, 27/10 15h57) : c'est l'installation qui change
  // de version, Minecraft convertit ses mondes à leur prochaine ouverture. Avant : une sauvegarde
  // 🛡 « Avant X » de CHACUN de ses mondes, vérifiée, jamais effacée automatiquement.
  async function openUpdateVersion(id) {
    const v = data.versions.find((x) => x.id === id);
    if (!v) return;
    const fr = L() === "fr";
    const tr = (a, b) => (fr ? a : b);
    const worlds = data.worlds.filter((w) => w.home === v.id || (!w.home && w.lastVersionId === v.id));
    const targets = (data.mcVersions || []).filter((x) => x.type === "release" && cmpMcVer(x.id, v.minecraftVersion) > 0).map((x) => x.id).sort((a, b) => cmpMcVer(b, a));
    if (!targets.length) return;
    const total = worlds.reduce((a, w) => a + (w.sizeBytes || 0), 0);
    const label = v.name || `Minecraft ${v.minecraftVersion}`;
    const m = overlay(`<div class="modal-box pop-in vu-box" role="dialog" aria-modal="true" aria-labelledby="vu-t">
      <h3 id="vu-t">${esc(tr(`Mettre à jour « ${label} »`, `Update “${label}”`))}</h3>
      <p class="vu-now" style="margin:2px 0 14px;">${esc(tr(`Aujourd'hui : Minecraft ${v.minecraftVersion}${v.pack ? ` · ${packName(v.pack)} · ${v.modCount} mods` : " · Vanilla"}`, `Today: Minecraft ${v.minecraftVersion}${v.pack ? ` · ${packName(v.pack)} · ${v.modCount} mods` : " · Vanilla"}`))}</p>
      <div id="vu-body">
        <label class="vu-lbl" for="vu-sel">${esc(tr("Nouvelle version", "New version"))}</label>
        <select class="vu-sel" id="vu-sel">${targets.map((t, i) => `<option value="${esc(t)}">Minecraft ${esc(t)}${i === 0 ? esc(tr(" · la plus récente", " · the latest")) : ""}</option>`).join("")}</select>
        <div class="vu-warn"><b>⚠ ${esc(tr("Risque de corruption", "Risk of corruption"))}</b><br>${esc(tr(`Quand Minecraft convertit un monde vers une nouvelle version, ça peut mal se passer, surtout sur les gros mondes ou avec des mods. Une fois converti, le monde ne s'ouvre plus en ${v.minecraftVersion}. C'est pour ça que le launcher le sauvegarde d'abord : en cas de souci, tu le restaures tel qu'il était.`, `When Minecraft converts a world to a new version, things can go wrong, especially with big worlds or mods. Once converted, the world no longer opens on ${v.minecraftVersion}. That's why the launcher backs it up first: if anything goes wrong, you restore it as it was.`))}</div>
        ${v.pack ? `<div class="vu-mods" id="vu-mods">${esc(tr("Mods : ", "Mods: "))}<b id="vu-mods-n"></b>
          <label><input type="radio" name="vu-m" value="wait" checked><span>${esc(tr("Attendre qu'ils sortent (rien n'est changé, le bouton reste là)", "Wait for them (nothing changes, the button stays)"))}</span></label>
          <label><input type="radio" name="vu-m" value="off"><span>${esc(tr("Mettre à jour quand même : ces mods sont retirés du pack, tu les rajoutes quand ils sortent", "Update anyway: these mods are removed from the pack, add them back when they're out"))}</span></label></div>` : ""}
        <p class="vu-do">${worlds.length ? esc(tr(`Avant la mise à jour, ces ${worlds.length} mondes sont sauvegardés :`, `Before the update, these ${worlds.length} worlds are backed up:`)).replace(/ces 1 mondes sont sauvegardés/, "ce monde est sauvegardé").replace(/these 1 worlds are/, "this world is") : esc(tr("Cette installation n'a pas encore de monde : rien à sauvegarder.", "This installation has no world yet: nothing to back up."))}</p>
        ${worlds.length ? `<div class="vu-wl">${worlds.map((w) => `<div><input type="checkbox" checked disabled aria-label="${esc(w.name)}"><span>${esc(w.name)}</span><span class="s">${esc(sizeFmt(w.sizeBytes))}</span><span class="g">🛡 ${esc(tr("sauvegarde", "backup"))}</span></div>`).join("")}</div>
        <p style="font-size:12px;color:var(--muted);margin:0 0 4px;line-height:1.45;" id="vu-note"></p>` : ""}
        ${worlds.length ? `<p class="vu-do" style="margin-top:12px;">${esc(tr("Copie (facultatif)", "Copy (optional)"))}</p><label class="vu-chk"><input type="checkbox" id="vu-copy"><span>${esc(v.pack ? tr(`Faire une copie du pack « ${label} » et de ses mondes, gardée en ${v.minecraftVersion}`, `Make a copy of the “${label}” pack and its worlds, kept on ${v.minecraftVersion}`) : tr(`Faire une copie de l'installation et de ses mondes, gardée en ${v.minecraftVersion}`, `Make a copy of the installation and its worlds, kept on ${v.minecraftVersion}`))}<small>${esc(tr(`La copie est faite après les sauvegardes, puis l'original passe en nouvelle version. Pour continuer en ${v.minecraftVersion} si la nouvelle version te déçoit. +${sizeFmt(total)} sur le disque.`, `The copy is made after the backups, then the original moves to the new version. To keep playing on ${v.minecraftVersion} if the new version lets you down. +${sizeFmt(total)} on disk.`))}</small></span></label>` : ""}
      </div>
      <div class="nb-acts" id="vu-acts" style="margin-top:14px;">
        <button type="button" class="btn-secondary" id="vu-no" style="margin:0;">${esc(T("cancel"))}</button>
        <button type="button" class="join-btn" id="vu-go"></button>
      </div></div>`);
    const $ = m.$;
    // Mon pack : quels mods existent pour la version choisie (Modrinth), relu à chaque choix.
    let check = null;
    let checking = 0;
    async function loadMods() {
      if (!v.pack) return;
      const t = $("#vu-sel").value;
      const n = ++checking;
      check = null;
      $("#vu-mods-n").textContent = tr("vérification sur Modrinth…", "checking on Modrinth…");
      sync();
      const r = await api.updateCheck(v.id, t);
      if (n !== checking || !document.body.contains(m.ov)) return;
      check = r?.ok ? r.mods : { error: r?.error || "?" };
      sync();
    }
    const sync = () => {
      const t = $("#vu-sel").value;
      if ($("#vu-note")) $("#vu-note").textContent = tr(`Chaque sauvegarde 🛡 « Avant ${t} » est relue pour la vérifier et n'est jamais effacée automatiquement. Total : ${sizeFmt(total * 0.85)} (place libre vérifiée avant).`, `Each 🛡 “Before ${t}” backup is read back to check it and is never deleted automatically. Total: ${sizeFmt(total * 0.85)} (free space checked first).`);
      const miss = check?.missing || [];
      if (v.pack && check) {
        $("#vu-mods-n").textContent = check.error
          ? tr(`impossible de vérifier (${check.error}).`, `could not check (${check.error}).`)
          : check.noLoader
            ? tr(`${check.loader} n'existe pas encore pour Minecraft ${t}.`, `${check.loader} does not exist yet for Minecraft ${t}.`)
            : miss.length
              ? tr(`${check.total - miss.length} sur ${check.total} ont une version ${t}. Pas encore : ${miss.join(", ")}.`, `${check.total - miss.length} of ${check.total} have a ${t} version. Not yet: ${miss.join(", ")}.`)
              : tr(`les ${check.total} ont une version ${t}.`, `all ${check.total} have a ${t} version.`);
        m.ov.querySelectorAll('input[name="vu-m"]').forEach((x) => (x.closest("label").hidden = !miss.length));
      }
      const wait = v.pack && (!check || check.error || check.noLoader || (miss.length && m.ov.querySelector('input[name="vu-m"]:checked')?.value === "wait"));
      $("#vu-go").disabled = !!wait;
      $("#vu-go").textContent = worlds.length ? tr(`Sauvegarder ${worlds.length > 1 ? `les ${worlds.length} mondes` : "le monde"} et passer en ${t}`, `Back up ${worlds.length > 1 ? `the ${worlds.length} worlds` : "the world"} and move to ${t}`) : tr(`Passer en ${t}`, `Move to ${t}`);
    };
    sync();
    loadMods();
    m.ov.addEventListener("change", (e) => (e.target.id === "vu-sel" ? loadMods() : sync()));
    $("#vu-no").addEventListener("click", m.close);
    $("#vu-go").addEventListener("click", async () => {
      const t = $("#vu-sel").value;
      const keepCopy = !!$("#vu-copy")?.checked;
      const modsOff = v.pack && m.ov.querySelector('input[name="vu-m"]:checked')?.value === "off";
      const offTxt = modsOff ? (check?.missing || []).join(", ") : "";
      m.ov.dataset.locked = "1";
      const steps = [
        ...worlds.map((w) => [`bk:${w.key}`, tr(`Sauvegarde 🛡 de « ${w.name} »`, `🛡 Backup of “${w.name}”`)]),
        ...(worlds.length ? [["verify", tr("Vérification des sauvegardes (relues en entier)", "Checking the backups (read back in full)")]] : []),
        ...(keepCopy ? [["copy", tr(`Copie ${v.pack ? "du pack" : "de l'installation"} et des mondes, gardée en ${v.minecraftVersion}`, `Copy of the ${v.pack ? "pack" : "installation"} and worlds, kept on ${v.minecraftVersion}`)]] : []),
        ["dl", tr(`Téléchargement de Minecraft ${t}${v.pack ? " et des mods" : ""}`, `Downloading Minecraft ${t}${v.pack ? " and the mods" : ""}`)],
      ];
      $("#vu-body").innerHTML = `<ul class="vu-steps">${steps.map(([k, l]) => `<li data-s="${esc(k)}"><i></i><span>${esc(l)}</span></li>`).join("")}</ul><div class="vu-bar" id="vu-bar" hidden><span></span></div><div id="vu-end"></div>`;
      $("#vu-acts").innerHTML = "";
      const mark = (k, pct) => {
        let seen = false;
        for (const li of m.ov.querySelectorAll(".vu-steps li")) {
          if (li.dataset.s === k) { li.className = "on"; seen = true; }
          else li.className = seen ? "" : "done";
        }
        if (k === "done") m.ov.querySelectorAll(".vu-steps li").forEach((li) => (li.className = "done"));
        const bar = $("#vu-bar");
        const li = m.ov.querySelector(`.vu-steps li[data-s="${CSS.escape(k)}"]`);
        if (li && pct != null) { li.after(bar); bar.hidden = false; bar.firstElementChild.style.width = `${pct}%`; } else bar.hidden = true;
      };
      const stop = api.onUpdateStep((st) => mark(st.step, st.pct ?? null));
      let r;
      try {
        r = await api.updateVersion(v.id, { minecraftVersion: t, keepCopy, modsOff });
      } finally {
        stop();
      }
      delete m.ov.dataset.locked;
      if (!r?.ok) {
        m.ov.querySelectorAll(".vu-steps li.on").forEach((li) => (li.className = "fail"));
        $("#vu-bar").hidden = true;
        $("#vu-end").innerHTML = `<div class="vu-warn" style="margin-top:8px;">${esc(tr(`Mise à jour arrêtée : ${r?.error || "?"} Rien n'a changé dans l'installation ; les sauvegardes déjà faites sont gardées.`, `Update stopped: ${r?.error || "?"} Nothing changed in the installation; backups already made are kept.`))}</div>`;
        $("#vu-acts").innerHTML = `<button type="button" class="join-btn" id="vu-close">${esc(T("close"))}</button>`;
        $("#vu-close").addEventListener("click", m.close);
        return refresh();
      }
      mark("done");
      $("#vu-end").innerHTML = `<div class="vu-ok">✓ ${esc(tr(`${v.name ? `« ${v.name} »` : "L'installation"} est maintenant en ${t}. ${worlds.length ? `Ses mondes seront convertis par Minecraft à leur prochaine ouverture ; chacun a sa sauvegarde 🛡 « Avant ${t} » (… › Sauvegardes › Restaurer pour revenir).` : ""}${keepCopy ? ` L'installation ${v.minecraftVersion} reste dans Mes installations avec la copie des mondes.` : ""}${offTxt ? ` Retirés en attendant leur version ${t} : ${offTxt} (à rajouter depuis la page du pack quand ils sortent).` : ""}`, `${v.name ? `“${v.name}”` : "The installation"} is now on ${t}. ${worlds.length ? `Minecraft converts its worlds next time they open; each has its 🛡 “Before ${t}” backup (… › Backups › Restore to go back).` : ""}${keepCopy ? ` The ${v.minecraftVersion} installation stays in My installations with the world copies.` : ""}${offTxt ? ` Removed until their ${t} version is out: ${offTxt} (add them back from the pack page when they're out).` : ""}`))}</div>`;
      $("#vu-acts").innerHTML = `<button type="button" class="join-btn" id="vu-close">${esc(T("close"))}</button>`;
      $("#vu-close").addEventListener("click", m.close);
      await refresh();
    });
  }
  // Liste des sauvegardes d'un monde (clic sur « N sauvegardes sur ce PC », retour de Rushi du
  // 25/10) : juste la liste, chacune avec Restaurer et Supprimer (confirmation en tapant
  // « supprimer »). Les réglages sont dans « ⚙ Réglages des sauvegardes ». Depuis le 27/10 : la
  // version de Minecraft de chaque sauvegarde et une ligne au changement de version.
  async function openBackupsList(key) {
    const gone = data.gone.find((x) => x.key === key) || null;
    const w = data.worlds.find((x) => x.key === key) || gone;
    if (!w) return;
    const fr = L() === "fr";
    const tr = (a, b) => (fr ? a : b);
    const r = await api.listBackups(key);
    let list = r?.backups || [];
    const reasons = S[L()].reason;
    const sup = !!data.cloud?.offer?.cloud;
    const sum = (arr) => arr.reduce((a, b) => a + (Number(b.sizeBytes) || 0), 0);
    const m = overlay(`<div class="modal-box pop-in nb-box" role="dialog" aria-modal="true" aria-labelledby="nl-t">
      <h3 id="nl-t">${esc(T("histT", { w: w.name }))}</h3>
      <p class="nb-sub" id="nl-sub"></p>
      <div id="nl-body"></div>
      <div class="nl-links">
        <button type="button" class="link-btn" id="nl-folder">${esc(T("openFolder"))}</button>
        <button type="button" class="link-btn nl-forever" id="nl-forever">🗑 ${esc(T("forever"))}</button>
      </div>
      <div class="nb-acts" style="margin-top:12px;">
        <button type="button" class="btn-secondary" id="nl-now" style="margin:0;" ${data.running || !w.backup || gone ? "disabled" : ""}>${esc(T("backupNow"))}</button>
        <button type="button" class="join-btn" id="nl-close">${esc(T("close"))}</button>
      </div></div>`);
    const $ = m.$;
    const vg = on("versionGuard");
    // Changement de version entre deux sauvegardes (la plus récente en haut).
    function verSep(b, newer) {
      if (!newer || !b.minecraftVersion || !newer.minecraftVersion || b.minecraftVersion === newer.minecraftVersion) return "";
      const up = cmpMcVer(newer.minecraftVersion, b.minecraftVersion) > 0;
      return `<div class="nb-sep">${up ? "⬆" : "⬇"} ${esc(tr(`Passé de ${b.minecraftVersion} à ${newer.minecraftVersion} ici`, `Moved from ${b.minecraftVersion} to ${newer.minecraftVersion} here`))}</div>`;
    }
    function draw() {
      $("#nl-sub").textContent = list.length
        ? `${list.length} ${tr(list.length > 1 ? "sauvegardes" : "sauvegarde", list.length > 1 ? "backups" : "backup")} · ${sizeFmt(sum(list))}${vg && w.minecraftVersion ? ` · ${tr("monde en", "world on")} ${w.minecraftVersion}` : ""}${sup ? tr(" · ☁ = aussi dans le cloud", " · ☁ = also in the cloud") : ""}`
        : "";
      $("#nl-body").innerHTML = list.length
        ? `<div class="nb-list" style="max-height:min(420px, calc(100vh - 260px));">${list.map((b, i) => `${vg ? verSep(b, list[i - 1]) : ""}<div class="nb-row" style="grid-template-columns:1fr ${vg ? "auto " : ""}auto ${sup ? "auto " : ""}auto auto;">
            <span class="d">${esc(dateFmt(b.createdAt))}${b.reason === "upgrade" ? ` · <b>🛡 « ${esc(b.label || "")} »</b><span class="nb-guard" title="${esc(tr("Faite juste avant le changement de version. Jamais effacée automatiquement : seulement si tu la supprimes toi-même.", "Made right before the version change. Never deleted automatically: only if you delete it yourself."))}">${tr("protégée", "protected")}</span>` : b.label ? ` · <b>★ « ${esc(b.label)} »</b>` : ` · ${esc(reasons[b.reason] || b.reason)}`}${b.cloud?.versionId ? ` · <span title="${esc(b.cloudKeep ? tr("Envoyée à la main : gardée en ligne en plus", "Sent by hand: kept online as an extra") : tr("Dans le cloud", "In the cloud"))}">☁${b.cloudKeep ? "+" : ""}</span>` : ""}</span>
            ${vg ? `<span class="nb-ver${b.minecraftVersion && b.minecraftVersion === w.minecraftVersion ? " cur" : ""}" title="${esc(tr("Version de Minecraft de cette sauvegarde", "Minecraft version of this backup"))}">${esc(b.minecraftVersion || "?")}</span>` : ""}
            <span class="s">${esc(sizeFmt(b.sizeBytes))}</span>
            ${sup ? (b.cloud?.versionId
              ? `<button type="button" class="link-btn nl-uncloud" data-uncloud="${esc(b.id)}" title="${esc(tr("Retirer du cloud (elle reste sur ce PC)", "Remove from the cloud (it stays on this PC)"))}" aria-label="${esc(tr("Retirer du cloud", "Remove from the cloud"))}" style="font-size:12px;">✕ ☁</button>`
              : `<button type="button" class="link-btn" data-send-one="${esc(b.id)}" title="${esc(tr("L'envoyer dans le cloud, en plus des versions automatiques", "Send it to the cloud, on top of the automatic versions"))}" style="font-size:12px;">☁ ${tr("Envoyer", "Send")}</button>`) : ""}
            <button type="button" class="link-btn" data-restore="${esc(b.id)}" style="font-size:12px;" ${data.running ? "disabled" : ""}>${esc(T("restore"))}</button>
            ${b.reason === "import" ? `<span class="nb-origin" title="${esc(T("originTip"))}">🔒 ${esc(T("originLabel"))}</span>` : `<button type="button" class="link-btn nl-del" data-del="${esc(b.id)}" style="font-size:12px;">${tr("Supprimer", "Delete")}</button>`}</div>`).join("")}</div>`
        : `<div class="nb-empty">${esc(T("histEmpty"))}</div>`;
    }
    draw();
    m.ov.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b || !m.ov.contains(b)) return;
      if (b.dataset.restore) {
        const backup = list.find((x) => x.id === b.dataset.restore);
        if (!backup) return;
        m.close();
        const vdiff = vg && !gone && backup.minecraftVersion && w.minecraftVersion && backup.minecraftVersion !== w.minecraftVersion;
        const res = await showModal({ title: T("restoreT", { w: w.name }), body: (gone ? T("restoreGoneD", { d: dateFmt(backup.createdAt) }) : T("restoreD", { d: dateFmt(backup.createdAt) })) + (vdiff ? "\n\n" + tr(`⚠ Cette sauvegarde est en Minecraft ${backup.minecraftVersion}, ton monde est en ${w.minecraftVersion}. Après la restauration, le monde redevient ${backup.minecraftVersion} et s'ouvrira avec Minecraft ${backup.minecraftVersion}.`, `⚠ This backup is on Minecraft ${backup.minecraftVersion}, your world is on ${w.minecraftVersion}. After restoring, the world is back on ${backup.minecraftVersion} and opens with Minecraft ${backup.minecraftVersion}.`) : ""), confirmLabel: vdiff ? tr(`Restaurer en ${backup.minecraftVersion}`, `Restore on ${backup.minecraftVersion}`) : T("restore"), cancelLabel: T("cancel"), tone: "warn" });
        if (!res?.confirmed) return;
        const out = await api.restoreBackup(key, backup.id);
        if (!out?.ok) return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
        toast(T("restored", { w: w.name }));
        return refresh();
      }
      if (b.dataset.sendOne || b.dataset.uncloud) {
        const id = b.dataset.sendOne || b.dataset.uncloud;
        b.disabled = true;
        const out = b.dataset.sendOne ? await api.cloud.sendBackup(key, id) : await api.cloud.uncloudBackup(key, id);
        if (!out?.ok) {
          b.disabled = false;
          return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
        }
        toast(b.dataset.sendOne
          ? tr("Envoi en cours (voir en haut à droite). Elle restera en ligne en plus des versions automatiques.", "Sending (see top right). It will stay online on top of the automatic versions.")
          : tr("Retirée du cloud. Elle est toujours sur ce PC.", "Removed from the cloud. It is still on this PC."));
        list = (await api.listBackups(key))?.backups || list;
        draw();
        loadCloud(true).then(() => !panel.hidden && render());
        return;
      }
      if (b.dataset.del) {
        const backup = list.find((x) => x.id === b.dataset.del);
        if (!backup || !(await confirmDelete(backup))) return;
        const out = await api.deleteBackup(key, backup.id);
        if (!out?.ok) return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
        list = list.filter((x) => x !== backup);
        draw();
        toast(tr("Sauvegarde supprimée.", "Backup deleted."));
        refresh();
      }
    });
    // Confirmation en tapant le mot (comme sur la page Mes mondes du site).
    function confirmDelete(backup) {
      const word = tr("supprimer", "delete");
      // La version à continuer (la plus récente du cloud) est gardée en ligne par le site.
      const head = data.cloud?.worlds?.find((x) => x.worldKey === key)?.latestVersionId;
      const cloudToo = !!backup.cloud?.versionId && backup.cloud.versionId !== head;
      return new Promise((resolve) => {
        const c = overlay(`<div class="modal-box pop-in nb-box" role="dialog" aria-modal="true" aria-labelledby="nd-t" style="max-width:440px;">
          <h3 id="nd-t">${tr("Supprimer cette sauvegarde ?", "Delete this backup?")}</h3>
          <p class="nb-sub" style="margin:6px 0 10px;">${esc(dateFmt(backup.createdAt))}${backup.label ? ` · « ${esc(backup.label)} »` : ""} · ${esc(sizeFmt(backup.sizeBytes))}</p>
          <p style="font-size:13px;margin:0 0 10px;line-height:1.45;">${esc(tr(`Elle sera supprimée de ce PC pour de bon${cloudToo ? ", et du cloud" : ""}. Ton monde n'est pas touché.`, `It will be deleted from this PC for good${cloudToo ? ", and from the cloud" : ""}. Your world is not touched.`))}${backup.cloud?.versionId && !cloudToo ? ` ${esc(tr("C'est la dernière version du cloud : elle y reste, pour tes autres PC.", "It is the latest version in the cloud: it stays there, for your other PCs."))}` : ""}</p>
          <label style="font-size:12.5px;color:var(--muted);">${tr(`Tape « ${word} » pour confirmer`, `Type “${word}” to confirm`)}</label>
          <input type="text" id="nd-in" class="play-in" autocomplete="off" spellcheck="false" style="width:100%;margin-top:6px;">
          <div class="nb-acts"><button type="button" class="btn-secondary" id="nd-no" style="margin:0;">${esc(T("cancel"))}</button><button type="button" class="join-btn nl-danger" id="nd-ok" disabled>${tr("Supprimer", "Delete")}</button></div></div>`);
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          obs.disconnect();
          c.close();
          resolve(v);
        };
        // Échap ou clic à côté ferment la fenêtre : on répond « non ».
        const obs = new MutationObserver(() => !document.body.contains(c.ov) && finish(false));
        obs.observe(document.body, { childList: true });
        const input = c.$("#nd-in");
        input.focus();
        input.addEventListener("input", () => (c.$("#nd-ok").disabled = input.value.trim().toLowerCase() !== word));
        input.addEventListener("keydown", (e) => e.key === "Enter" && !c.$("#nd-ok").disabled && finish(true));
        c.$("#nd-no").addEventListener("click", () => finish(false));
        c.$("#nd-ok").addEventListener("click", () => finish(true));
      });
    }
    $("#nl-close").addEventListener("click", m.close);
    $("#nl-folder").addEventListener("click", () => api.openWorldFolder(key));
    $("#nl-forever").addEventListener("click", async () => {
      m.close();
      if (!(await confirmForever())) return;
      if (!(await countdown())) return toast(T("foreverCancelled"));
      const out = await api.deleteWorldForever(key);
      if (!out?.ok) return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(T("foreverDone", { w: w.name }));
      refresh();
      if (out.cloudError) showModal({ title: w.name, body: T("foreverCloudFail", { e: out.cloudError }), confirmLabel: "OK", tone: "warn" });
    });
    // Dernière chance (Rushi, 26/10) : 10 secondes avec une barre, un seul bouton « Annuler ».
    // Rien n'est effacé avant la fin du compte à rebours.
    function countdown() {
      const SEC = 10;
      return new Promise((resolve) => {
        const c = overlay(`<div class="modal-box pop-in nb-box tone-danger" role="alertdialog" aria-modal="true" aria-labelledby="cd-t" style="max-width:440px;text-align:left;">
          <h3 id="cd-t">🗑 ${esc(T("cdT", { w: w.name }))}</h3>
          <p style="font-size:13px;margin:8px 0 12px;line-height:1.45;" aria-live="polite" id="cd-txt"></p>
          <div class="cd-bar"><i id="cd-fill"></i></div>
          <div class="nb-acts"><button type="button" class="join-btn" id="cd-no" style="margin-left:auto;">${esc(T("cancel"))}</button></div></div>`);
        c.ov.dataset.locked = "1"; // ni Échap ni clic à côté : seul « Annuler » arrête
        const txt = c.$("#cd-txt");
        const fill = c.$("#cd-fill");
        const t0 = Date.now();
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          clearInterval(timer);
          c.close();
          resolve(v);
        };
        const tick = () => {
          const left = Math.max(0, SEC - (Date.now() - t0) / 1000);
          txt.textContent = T("cdD", { s: Math.ceil(left) });
          fill.style.width = `${(1 - left / SEC) * 100}%`;
          if (left <= 0) finish(true);
        };
        const timer = setInterval(tick, 100);
        tick();
        c.$("#cd-no").addEventListener("click", () => finish(false));
        c.$("#cd-no").focus();
      });
    }
    // Suppression définitive : tout ce que le launcher garde de ce monde, Version d'origine
    // comprise. Gros avertissement, puis le mot à taper.
    function confirmForever() {
      const word = T("foreverWord");
      const n = list.length;
      const inCloud = !!data.cloud?.worlds?.some((x) => x.worldKey === key);
      const items = [gone ? "" : T("foreverWorld"), n ? T(n > 1 ? "foreverBk" : "foreverBk1", { n }) : "", inCloud ? T("foreverCloud") : ""].filter(Boolean);
      return new Promise((resolve) => {
        const c = overlay(`<div class="modal-box pop-in nb-box fv-box tone-danger" role="alertdialog" aria-modal="true" aria-labelledby="fv-t" style="max-width:470px;text-align:left;">
          <h3 id="fv-t">⚠ ${esc(T("foreverT", { w: w.name }))}</h3>
          <p style="font-size:13px;margin:8px 0 0;">${esc(T("foreverWhat"))}</p>
          <ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          <p class="fv-stop">${esc(T("foreverNoBack"))}</p>
          <p style="font-size:12.5px;color:var(--muted);margin:0 0 12px;line-height:1.45;">${esc(T("foreverNote"))}</p>
          <label style="font-size:12.5px;color:var(--muted);">${esc(T("foreverType", { x: word }))}</label>
          <input type="text" id="fv-in" class="play-in" autocomplete="off" spellcheck="false" style="width:100%;margin-top:6px;">
          <div class="nb-acts"><button type="button" class="join-btn" id="fv-no">${esc(T("cancel"))}</button><button type="button" class="btn-secondary nl-danger" id="fv-ok" style="margin:0;" disabled>${esc(T("foreverOk"))}</button></div></div>`);
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          obs.disconnect();
          c.close();
          resolve(v);
        };
        const obs = new MutationObserver(() => !document.body.contains(c.ov) && finish(false));
        obs.observe(document.body, { childList: true });
        const input = c.$("#fv-in");
        input.focus();
        input.addEventListener("input", () => (c.$("#fv-ok").disabled = input.value.trim().toLowerCase() !== word));
        input.addEventListener("keydown", (e) => e.key === "Enter" && !c.$("#fv-ok").disabled && finish(true));
        c.$("#fv-no").addEventListener("click", () => finish(false));
        c.$("#fv-ok").addEventListener("click", () => finish(true));
      });
    }
    $("#nl-now").addEventListener("click", async (e) => {
      e.target.disabled = true;
      const res = await api.backupNow(key);
      if (!res?.ok) {
        m.close();
        return showModal({ title: w.name, body: res?.error || "", confirmLabel: "OK", tone: "warn" });
      }
      toast(T("backupDone"));
      list = (await api.listBackups(key))?.backups || list;
      e.target.disabled = false;
      draw();
      refresh();
    });
  }

  // --- Import depuis .minecraft (copie) -------------------------------------------------------
  async function openImport(dir = null) {
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="pi-t" style="max-width:540px;text-align:left;">
      <h3 id="pi-t">${esc(T("impT"))}</h3><p class="join-note" id="pi-body">${esc(T("impScanning"))}</p></div>`);
    const r = await api.scanImport(dir);
    if (!document.body.contains(m.ov)) return;
    const found = r?.worlds || [];
    const picked = new Set(found.filter((f) => !f.modded).slice(0, 3).map((f) => f.folder));
    const anyModded = found.some((f) => f.modded);
    const box = m.ov.querySelector(".modal-box");
    box.innerHTML = `<h3 id="pi-t">${esc(T("impT"))}</h3>
      <p style="margin:0 0 4px;">${esc(found.length ? T("impFrom") : T("impNone"))}</p>
      <span class="play-path">${esc(r?.dir || "")}</span>
      ${anyModded && !(r?.cfInstance && on("cfImport")) ? `<div class="play-modwarn" role="note"><b>⚠ ${esc(T("impModT"))}</b>${esc(T("impModD"))}</div>` : ""}
      ${r?.cfInstance && on("cfImport") ? `<div class="cf-box"><span>${esc(T("cfFromInst", { p: r.cfInstance.name }))}</span><button type="button" class="join-btn" id="pi-cf">${esc(T("cfFromInstBtn"))}</button></div>` : ""}
      <div class="play-list">${found.map((f) => `<label class="play-row"><input type="checkbox" data-f="${esc(f.folder)}" ${picked.has(f.folder) ? "checked" : ""}>
        <img src="${f.icon || grassThumb(f.folder)}" alt=""><span class="t">${esc(f.name)}<small>Minecraft ${esc(f.minecraftVersion || "?")}${f.modded ? ` · <span class="modl">⚠ ${esc(T("impModRow", { l: modLabel(f.modded) }))}</span>` : ""}${f.lastPlayed ? ` · ${esc(ago(f.lastPlayed))}` : ""}</small></span>
        <span class="sz">${esc(sizeFmt(f.sizeBytes))}</span></label>`).join("")}</div>
      <p class="play-safe">✓ ${esc(T("impSafe"))}</p>
      <div class="modal-actions" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;">
        <span style="margin-right:auto;display:flex;flex-direction:column;align-items:flex-start;gap:2px;"><button type="button" class="link-btn" id="pi-other" style="margin:0;padding-left:0;">${esc(T("impOther"))}</button></span>
        <button type="button" class="btn-secondary" id="pi-cancel">${esc(T("cancel"))}</button>
        <button type="button" class="join-btn" id="pi-copy" ${picked.size ? "" : "disabled"}>${esc(T("impCopy", { n: picked.size }))}</button>
      </div>`;
    const copy = m.$("#pi-copy");
    m.$("#pi-cancel").addEventListener("click", m.close);
    m.$("#pi-zip")?.addEventListener("click", () => {
      m.close();
      openPackChooser();
    });
    m.$("#pi-cf")?.addEventListener("click", async () => {
      const z = await api.cfPack.pickZip();
      if (!z?.ok) return;
      m.close();
      openCfPack({ zip: z.path });
    });
    m.$("#pi-other").addEventListener("click", async () => {
      const p = await api.pickImportDir();
      if (!p?.ok) return;
      m.close();
      openImport(p.dir);
    });
    m.ov.querySelectorAll("input[data-f]").forEach((c) => c.addEventListener("change", () => {
      c.checked ? picked.add(c.dataset.f) : picked.delete(c.dataset.f);
      copy.textContent = T("impCopy", { n: picked.size });
      copy.disabled = picked.size === 0;
    }));
    copy.addEventListener("click", async () => {
      copy.disabled = true;
      copy.textContent = T("impCopying");
      m.ov.dataset.locked = "1";
      // Progression de la copie (27/10) : même fenêtre que les imports de packs.
      const steps = [{ id: "world", label: T("impStepW"), state: "run", n: 0, of: picked.size }];
      const run = { t0: Date.now(), end: 0, overall: null };
      const total = found.filter((f) => picked.has(f.folder)).reduce((a, f) => a + (f.sizeBytes || 0), 0);
      box.innerHTML = ""; // l'écran du choix part : ses boutons gardent leurs écouteurs, ne pas les réutiliser
      const draw = () => {
        // Redessinée chaque seconde : pjPatch, sinon le rond et la barre repartent de zéro à chaque fois.
        pjPatch(box, `<h3 id="pi-t">${esc(T("impT"))}</h3>
          <p style="margin:0 0 10px;color:var(--muted);font-size:12.5px;">${esc(T("impCopy", { n: picked.size }))} · ${esc(sizeFmt(total))}</p>
          ${ipOverall(run, steps)}
          <div class="cf-steps">${steps.map((s) => `<div class="cf-step ${s.state}"><span class="ic">${ipIcon(s)}</span><span>${esc(s.label)}</span><span class="n">${s.n}/${s.of}</span>
            ${s.state === "run" ? ipStepExtra(s) : ""}</div>`).join("")}</div>
          <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px;">
            <button type="button" class="join-btn" id="pi-ok" ${run.end ? "" : "disabled"}>${esc(T("cfDoneB"))}</button></div>`);
        m.$("#pi-ok")?.addEventListener("click", m.close);
      };
      draw();
      const tick = setInterval(() => (document.body.contains(m.ov) ? draw() : clearInterval(tick)), 1000);
      const out = await api.importWorlds(r.dir, [...picked], (ev) => {
        ipApply(steps, run, { step: "world", n: ev.i, files: ev.files, filesOf: ev.filesOf, bytes: ev.bytes, total: ev.total, file: ev.file, what: ev.name, overall: ev.overall });
        draw();
      });
      clearInterval(tick);
      if (!out?.ok) {
        m.close();
        return showModal({ title: T("impT"), body: out?.error || "", confirmLabel: "OK", tone: "warn" });
      }
      steps[0].state = "done";
      steps[0].n = out.imported.length;
      run.end = Date.now();
      delete m.ov.dataset.locked;
      draw();
      m.$("#pi-ok")?.focus();
      toast(T("impDone", { n: out.imported.length }));
      refresh();
    });
    copy.focus();
  }

  // --- Importer un pack CurseForge (instance ou export .zip) avec ses mondes -------------------
  // Le launcher lit la liste exacte des mods (manifest.json d'un export, minecraftinstance.json
  // d'une instance) et installe le pack comme ceux des serveurs : les mods autorisés se téléchargent,
  // les autres passent par « Ouvrir la page » (rien n'est téléchargé depuis CurseForge pour eux).
  // « Importer un pack » : on choisit d'abord d'où il vient (Modrinth ou CurseForge).
  // 27/10 (Rushi) : une carte par type de fichier (Pack Omniscient, Modrinth, CurseForge), et la
  // fenêtre de Windows ne montre que le type de la carte cliquée.
  const packKinds = () => [on("omniPack") && "omni", on("mrImport") && "mr", on("cfImport") && "cf"].filter(Boolean);
  function packImportOn() {
    return packKinds().length > 0;
  }
  async function openPackChooser(pre = {}, { worlds = false } = {}) {
    if (!worlds && packKinds().length < 2) {
      const kind = packKinds()[0] || "cf";
      const z = await api.cfPack.pickZip(kind);
      if (z?.ok) openCfPack({ zip: z.path, kind: z.kind || kind, worldKey: pre.worldKey });
      return;
    }
    const card = (k, ic, t, f, d) => `<button type="button" class="pkch-card" data-pkch="${k}"><span class="pkch-ic ${k}">${ic}</span>
      <span class="pkch-t"><b>${esc(t)}</b><small>${esc(f)}</small><span>${esc(d)}</span></span><span class="pkch-go">›</span></button>`;
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="pkch-t" style="max-width:520px;text-align:left;">
      <style>.pkch-list{display:flex;flex-direction:column;gap:10px;margin:14px 0 6px}
      .pkch-card{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:14px;align-items:center;text-align:left;padding:14px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2,transparent);color:inherit;font:inherit;cursor:pointer;transition:border-color .15s,transform .15s}
      .pkch-card:hover,.pkch-card:focus-visible{border-color:var(--accent);transform:translateY(-1px);outline:none}
      .pkch-ic{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#fff}
      .pkch-ic.mr{background:#1bd96a;color:#0b2a17}.pkch-ic.cf{background:#f16436}.pkch-ic.om{background:var(--accent)}.pkch-ic.w,.pkch-ic.p{background:color-mix(in srgb,var(--accent) 16%,transparent);font-size:22px}
      .pkch-sec{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:6px 0 -2px}
      .pkch-t{display:flex;flex-direction:column;gap:2px;min-width:0}.pkch-t b{font-size:15px}.pkch-t small{color:var(--muted);font-size:12px}.pkch-t span{font-size:13px;line-height:1.4;margin-top:3px}
      .pkch-go{font-size:22px;color:var(--muted)}</style>
      <h3 id="pkch-t">${esc(T(worlds ? "imT" : "pkChT"))}</h3><p class="join-note" style="margin:2px 0 0;">${esc(T(worlds ? "imD" : "pkChD"))}</p>
      <div class="pkch-list">${worlds ? card("w", "🌍", T("imWT"), T("imWF"), T("imWD")) + card("p", "📦", T("imPT"), T("imPF"), T("imPD"))
        : (on("omniPack") ? card("om", "O", T("pkChOm"), T("pkChOmF"), T("pkChOmD")) : "") + (on("mrImport") ? card("mr", "M", T("pkChMr"), T("pkChMrF"), T("pkChMrD")) : "") + (on("cfImport") ? card("cf", "C", T("pkChCf"), T("pkChCfF"), T("pkChCfD")) : "")}</div>
      <div class="modal-actions" style="display:flex;justify-content:flex-end;margin-top:10px;"><button type="button" class="btn-secondary" id="pkch-no">${esc(T("cancel"))}</button></div></div>`);
    m.$("#pkch-no").addEventListener("click", m.close);
    m.ov.querySelectorAll("[data-pkch]").forEach((b) => b.addEventListener("click", async () => {
      if (b.dataset.pkch === "w" || b.dataset.pkch === "p") {
        m.close();
        return b.dataset.pkch === "w" ? openImport() : openPackChooser(pre);
      }
      const k = b.dataset.pkch === "om" ? "omni" : b.dataset.pkch;
      const z = await api.cfPack.pickZip(k);
      if (!z?.ok) return;
      m.close();
      openCfPack({ zip: z.path, kind: z.kind || k, worldKey: pre.worldKey });
    }));
    m.ov.querySelector("[data-pkch]").focus();
  }

  // --- « Un pack existant » (28/10, preview B validée par Rushi, Laboratoire « packBrowse ») ---------
  // « + Nouvelle installation » propose 3 cartes : Créer (la fenêtre d'avant), Un pack existant (chercher un
  // modpack public Modrinth, CurseForge ou FTB) et Importer (mes mondes ou un fichier de pack). Le pack
  // choisi est téléchargé puis passe par la même fenêtre que l'import d'un fichier (openCfPack).
  const PBT = () => (L() === "fr" ? {
    newT: "Nouvelle installation", newD: "Que veux-tu ajouter ?",
    cNew: "Créer", cNewD: "Vanilla, ou Mon pack avec tes propres mods (et Pack Omniscient).",
    cBrowse: "Un pack existant", cBrowseD: "Cherche parmi les packs de Modrinth, CurseForge et FTB, puis installe-le.",
    cFile: "Importer", cFileD: "Tes mondes de .minecraft, ou un fichier de pack (.mrpack, .zip, .omnipack).",
    brT: "Un pack existant", brD: "Packs publics de Modrinth, CurseForge et FTB. Clique sur un pack pour voir ses détails et l'installer.",
    q: "Chercher un pack (ex. Cobblemon, ATM, StoneBlock…)", allL: "Tous les chargeurs", allV: "Toutes les versions",
    close: "Fermer", back: "Retour", install: "Installer", page: "Voir la page ↗", by: "par", latest: "Dernière version", ver: "Version du pack",
    loading: "Recherche…", none: "Aucun pack ne correspond. Essaie un autre mot ou enlève un filtre.", srcErr: (n, e) => `${n} : ${e}`,
    noteCf: "Certains mods de CurseForge ne se téléchargent qu'à la main (choix de leurs auteurs) : le launcher te dira lesquels et t'ouvrira leurs pages.",
    noteFtb: "Pack FTB : les fichiers viennent des serveurs de FTB, et ses mods CurseForge passent par CurseForge comme pour un pack CurseForge.",
    prepT: (n) => `Préparation de « ${n} »`, prepDl: "Téléchargement du pack", prepFtb: "Téléchargement des fichiers du pack", prepZip: "Rangement du pack",
    noDlT: "Téléchargement direct impossible", noDl: "L'auteur de ce pack ne permet pas de le télécharger depuis un autre launcher. Télécharge-le sur sa page CurseForge (bouton « Download »), puis choisis le fichier .zip ici.",
    openCf: "Ouvrir sur CurseForge ↗", haveZip: "J'ai le fichier .zip…", beta: "bêta", alpha: "alpha",
    more: "Plus d'options", mPick: "☑ Sélectionner", mSet: "⚙ Réglages des sauvegardes", mSync: "☁ Synchroniser",
  } : {
    newT: "New installation", newD: "What do you want to add?",
    cNew: "Create", cNewD: "Vanilla, or My pack with your own mods (and Omniscient pack).",
    cBrowse: "An existing pack", cBrowseD: "Search Modrinth, CurseForge and FTB packs, then install one.",
    cFile: "Import", cFileD: "Your worlds from .minecraft, or a pack file (.mrpack, .zip, .omnipack).",
    brT: "An existing pack", brD: "Public packs from Modrinth, CurseForge and FTB. Click a pack to see its details and install it.",
    q: "Search a pack (e.g. Cobblemon, ATM, StoneBlock…)", allL: "All loaders", allV: "All versions",
    close: "Close", back: "Back", install: "Install", page: "Open the page ↗", by: "by", latest: "Latest version", ver: "Pack version",
    loading: "Searching…", none: "No pack matches. Try another word or remove a filter.", srcErr: (n, e) => `${n}: ${e}`,
    noteCf: "Some CurseForge mods can only be downloaded by hand (their authors' choice): the launcher will tell you which ones and open their pages.",
    noteFtb: "FTB pack: files come from FTB's servers, and its CurseForge mods go through CurseForge like a CurseForge pack.",
    prepT: (n) => `Preparing “${n}”`, prepDl: "Downloading the pack", prepFtb: "Downloading the pack files", prepZip: "Packing",
    noDlT: "Direct download not possible", noDl: "This pack's author doesn't allow downloads from other launchers. Download it from its CurseForge page (“Download” button), then pick the .zip file here.",
    openCf: "Open on CurseForge ↗", haveZip: "I have the .zip file…", beta: "beta", alpha: "alpha",
    more: "More options", mPick: "☑ Select", mSet: "⚙ Backup settings", mSync: "☁ Sync",
  });
  const PB_SRC = { mr: { n: "Modrinth", c: "#1bd96a" }, cf: { n: "CurseForge", c: "#f16436" }, ftb: { n: "FTB", c: "#d23f3f" } };
  const PB_LOADERS = { neoforge: "NeoForge", forge: "Forge", fabric: "Fabric", quilt: "Quilt" };
  const PB_MC = ["1.21.1", "1.20.1", "1.19.2", "1.18.2", "1.16.5", "1.12.2", "1.7.10"];
  const pbFmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".0", "")} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : `${n}`);
  const pbIni = (n) => String(n).replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";
  const pbOn = () => on("packBrowse");
  (function pbStyle() {
    const css = document.createElement("style");
    css.textContent = `
    .pb-chooser{max-width:680px;width:calc(100vw - 80px);text-align:left}
    .pb-choice{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px}
    .pb-big{display:flex;flex-direction:column;gap:6px;align-items:flex-start;padding:16px;border-radius:14px;border:1px solid var(--border);background:var(--surface);cursor:pointer;font:inherit;color:inherit;text-align:left;transition:border-color .12s,transform .12s}
    .pb-big:hover,.pb-big:focus-visible{border-color:var(--accent);transform:translateY(-1px);outline:none}
    .pb-big .e{font-size:26px}.pb-big b{font-size:14.5px}.pb-big small{font-size:12px;color:var(--muted);line-height:1.4}
    .pb-modal{max-width:880px;width:calc(100vw - 80px);max-height:calc(100vh - 64px);overflow:auto;text-align:left}
    .pb-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
    .pb-top input[type=search]{flex:1 1 220px;min-width:0;margin:0}
    .pb-chip{font:inherit;font-size:12.5px;padding:5px 11px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--foreground);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
    .pb-chip.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent)}
    .pb-chip i{width:8px;height:8px;border-radius:50%;background:var(--c)}
    .pb-sel{font:inherit;font-size:12.5px;padding:5px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--foreground)}
    .pb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
    .pb-card{display:flex;gap:12px;padding:12px;border-radius:12px;border:1px solid var(--border);background:var(--surface);cursor:pointer;text-align:left;font:inherit;color:inherit;transition:border-color .12s,transform .12s;min-width:0}
    .pb-card:hover,.pb-card:focus-visible{border-color:color-mix(in srgb,var(--accent) 60%,var(--border));transform:translateY(-1px);outline:none}
    .pb-ic{flex-shrink:0;width:52px;height:52px;border-radius:12px;overflow:hidden;display:grid;place-items:center;font-weight:800;color:#fff;font-size:18px;background:linear-gradient(135deg,var(--c),#312e81)}
    .pb-ic img{width:100%;height:100%;object-fit:cover}
    .pb-txt{min-width:0;display:flex;flex-direction:column;gap:3px}
    .pb-txt b{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pb-txt small{font-size:11.5px;color:var(--muted)}
    .pb-txt p{margin:0;font-size:12px;color:var(--muted);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .pb-src{font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:5px;color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent)}
    .pb-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .pb-empty{padding:30px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:12px}
    .pb-err{font-size:12px;color:var(--warn,#f59e0b);margin:0 0 8px}
    .pb-det{display:flex;gap:16px}.pb-det .pb-ic{width:84px;height:84px;font-size:28px;border-radius:18px}
    .pb-note{font-size:12.5px;line-height:1.45;padding:9px 11px;border-radius:10px;background:color-mix(in srgb,var(--accent) 10%,transparent);border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);margin:12px 0 0}
    .pb-bar{height:6px;border-radius:6px;background:color-mix(in srgb,var(--foreground) 12%,transparent);overflow:hidden;margin-top:12px}
    .pb-bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .2s}
    .pb-more{font:inherit;font-size:16px;line-height:1;width:36px;height:36px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--foreground);cursor:pointer}
    .pb-more:hover,.pb-more[aria-expanded="true"]{background:color-mix(in srgb,var(--foreground) 8%,transparent)}
    @media (max-width:760px){.pb-choice{grid-template-columns:1fr}}`;
    document.head.appendChild(css);
  })();
  // Bouton « ⋯ » de l'en-tête (Rushi, 28/10) : Sélectionner, Réglages des sauvegardes et Synchroniser
  // y sont rangés pour que l'en-tête ne garde que « Voir tous mes mondes » et « + Nouvelle installation ».
  function pbMoreItems() {
    const list = pjSorted().filter((v) => v.id !== PJ.hide);
    const sup = data.cloud?.offer?.cloud;
    return [list.length > 1 && !PJ.pick && "pick", data.worlds.length && "set", sup && data.worlds.length && !(data.job && !data.job.done) && "sync"].filter(Boolean);
  }
  const pbMoreBtn = () => (pbMoreItems().length ? `<button type="button" class="pb-more" data-pb-more title="${esc(PBT().more)}" aria-label="${esc(PBT().more)}" aria-haspopup="menu" aria-expanded="false">⋯</button>` : "");
  let pbMenu = null;
  const pbCloseMenu = () => {
    pbMenu?.remove();
    pbMenu = null;
    panel.querySelectorAll('[data-pb-more][aria-expanded="true"]').forEach((b) => b.setAttribute("aria-expanded", "false"));
  };
  function pbOpenMenu(btn) {
    pbCloseMenu();
    pjCloseMenu();
    const P = PBT();
    const m = document.createElement("div");
    m.className = "mv-menu";
    m.setAttribute("role", "menu");
    m.innerHTML = pbMoreItems().map((k) => `<button type="button" role="menuitem" data-pb-item="${k}">${esc(k === "pick" ? P.mPick : k === "set" ? P.mSet : P.mSync)}</button>`).join("");
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    m.style.top = `${Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8))}px`;
    m.style.left = `${Math.max(8, r.right - m.offsetWidth)}px`;
    btn.setAttribute("aria-expanded", "true");
    pbMenu = m;
    m.querySelector("button")?.focus();
    m.addEventListener("click", (e) => {
      const k = e.target.closest("[data-pb-item]")?.dataset.pbItem;
      if (!k) return;
      pbCloseMenu();
      if (k === "pick") {
        PJ.pick = new Set();
        PJ.sel = null;
        return render();
      }
      if (k === "set") return openHistory(null);
      if (k === "sync") return openCloudSync({ resync: true });
    });
  }
  document.addEventListener("mousedown", (e) => {
    if (pbMenu && !pbMenu.contains(e.target) && !e.target.closest("[data-pb-more]")) pbCloseMenu();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pbMenu) {
      e.stopPropagation();
      pbCloseMenu();
    }
  }, true);

  function pbChooser() {
    const P = PBT();
    const m = overlay(`<div class="modal-box pop-in pb-chooser" role="dialog" aria-modal="true" aria-labelledby="pb-ch-t" style="max-width:680px;width:calc(100vw - 80px);text-align:left;">
      <h3 id="pb-ch-t" style="margin:0;">${esc(P.newT)}</h3><p style="margin:6px 0 0;font-size:13px;color:var(--muted);">${esc(P.newD)}</p>
      <div class="pb-choice"><button type="button" class="pb-big" data-c="new"><span class="e">🧱</span><b>${esc(P.cNew)}</b><small>${esc(P.cNewD)}</small></button>
      <button type="button" class="pb-big" data-c="browse"><span class="e">🔍</span><b>${esc(P.cBrowse)}</b><small>${esc(P.cBrowseD)}</small></button>
      <button type="button" class="pb-big" data-c="file"><span class="e">📄</span><b>${esc(P.cFile)}</b><small>${esc(P.cFileD)}</small></button></div>
      <div class="modal-actions" style="display:flex;justify-content:flex-end;margin-top:14px;"><button type="button" class="btn-secondary" data-x>${esc(T("cancel"))}</button></div></div>`);
    m.ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      const c = e.target.closest("[data-c]")?.dataset.c;
      if (!c) return;
      m.close();
      if (c === "new") return openNewVersion();
      if (c === "file") return packImportOn() ? openPackChooser({}, { worlds: true }) : openImport();
      if (on("addMenus")) return openAddWin({ mode: "browse" });
      return pbBrowser();
    });
    m.ov.querySelector("[data-c]").focus();
  }

  const pbState = { q: "", src: null, loader: "", mc: "" };
  async function pbBrowser() {
    const P = PBT();
    const srcs = await api.packBrowse.sources().catch(() => null);
    const avail = ["mr", "cf", "ftb"].filter((k) => srcs?.[k]);
    if (!avail.length) return showModal({ title: P.brT, body: L() === "fr" ? "Les packs existants sont coupés pour le moment." : "Existing packs are turned off for now.", confirmLabel: "OK", tone: "warn" });
    if (!pbState.src || ![...pbState.src].every((k) => avail.includes(k))) pbState.src = new Set(avail);
    const m = overlay(`<div class="modal-box pop-in pb-modal" role="dialog" aria-modal="true" aria-labelledby="pb-br-t">
      <div style="display:flex;align-items:center;gap:10px;"><h3 id="pb-br-t" style="margin:0;">${esc(P.brT)}</h3><button type="button" class="btn-secondary" data-x style="margin:0 0 0 auto;">${esc(P.close)}</button></div>
      <p style="margin:6px 0 12px;font-size:13px;color:var(--muted);">${esc(P.brD)}</p>
      <div class="pb-top"><input type="search" class="play-in" data-pb-q placeholder="${esc(P.q)}" value="${esc(pbState.q)}" autocomplete="off"></div>
      <div class="pb-top" data-pb-filters></div><div data-pb-res></div></div>`);
    const res = m.$("[data-pb-res]");
    const filters = m.$("[data-pb-filters]");
    const drawFilters = () => {
      filters.innerHTML = `${avail.map((k) => `<button type="button" class="pb-chip${pbState.src.has(k) ? " on" : ""}" data-pb-src="${k}" style="--c:${PB_SRC[k].c}" aria-pressed="${pbState.src.has(k)}"><i></i>${PB_SRC[k].n}</button>`).join("")}<span style="flex:1"></span>
        <select class="pb-sel" data-pb-loader><option value="">${esc(P.allL)}</option>${Object.entries(PB_LOADERS).map(([k, n]) => `<option value="${k}" ${pbState.loader === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select class="pb-sel" data-pb-mc><option value="">${esc(P.allV)}</option>${PB_MC.map((v) => `<option ${pbState.mc === v ? "selected" : ""}>${v}</option>`).join("")}</select>`;
    };
    let packs = [];
    let seq = 0;
    const icon = (p) => `<span class="pb-ic" style="--c:${PB_SRC[p.src].c}">${p.icon ? `<img src="${esc(p.icon)}" alt="" loading="lazy">` : esc(pbIni(p.name))}</span>`;
    const load = async () => {
      const my = ++seq;
      res.innerHTML = `<span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">${esc(P.loading)}</span><div class="pb-grid" aria-hidden="true">${[...SK_W, 58].map((w) => `<div class="pb-card" style="cursor:default;"><span class="sk" style="width:52px;height:52px;border-radius:12px;flex:none;"></span><span class="pb-txt" style="flex:1;gap:7px;"><span class="sk" style="width:${w}%;height:13px;"></span><span class="sk" style="width:${w - 22}%;height:10px;"></span><span class="sk" style="width:90%;height:10px;"></span></span></div>`).join("")}</div>`;
      const opts = { mc: pbState.mc, loader: pbState.loader };
      const out = await Promise.all([...pbState.src].map((k) => api.packBrowse.search(k, pbState.q, opts).then((r) => ({ k, r })).catch((error) => ({ k, r: { ok: false, error: String(error?.message || error), packs: [] } }))));
      if (my !== seq || !document.body.contains(m.ov)) return;
      const errs = out.filter((x) => !x.r?.ok).map((x) => P.srcErr(PB_SRC[x.k].n, x.r?.error || "?"));
      // Une seule liste : la plus jouée d'abord, en alternant les sources pour qu'aucune n'écrase les autres.
      const lists = out.map((x) => (x.r?.packs || []).slice().sort((a, b) => b.dl - a.dl));
      packs = [];
      for (let i = 0; lists.some((l) => l[i]); i++) for (const l of lists) if (l[i]) packs.push(l[i]);
      res.innerHTML = `${errs.map((e) => `<p class="pb-err">⚠ ${esc(e)}</p>`).join("")}${packs.length ? `<div class="pb-grid">${packs.map((p, i) => `<button type="button" class="pb-card" data-pb-i="${i}">${icon(p)}<span class="pb-txt"><b title="${esc(p.name)}">${esc(p.name)}</b>
        <span class="pb-meta"><span class="pb-src" style="--c:${PB_SRC[p.src].c}">${PB_SRC[p.src].n}</span><small>${esc([PB_LOADERS[p.loader], p.mc, `⬇ ${pbFmt(p.dl)}`].filter(Boolean).join(" · "))}</small></span><p>${esc(p.desc)}</p></span></button>`).join("")}</div>` : `<div class="pb-empty">${esc(P.none)}</div>`}`;
    };
    drawFilters();
    load();
    let t = null;
    m.$("[data-pb-q]").addEventListener("input", (e) => {
      pbState.q = e.target.value;
      clearTimeout(t);
      t = setTimeout(load, 400);
    });
    m.ov.addEventListener("change", (e) => {
      if (e.target.matches("[data-pb-loader]")) pbState.loader = e.target.value;
      else if (e.target.matches("[data-pb-mc]")) pbState.mc = e.target.value;
      else return;
      load();
    });
    m.ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) return m.close();
      const c = e.target.closest("[data-pb-src]");
      if (c) {
        const k = c.dataset.pbSrc;
        if (pbState.src.has(k) && pbState.src.size > 1) pbState.src.delete(k);
        else pbState.src.add(k);
        drawFilters();
        return load();
      }
      const card = e.target.closest("[data-pb-i]");
      if (card) pbDetail(packs[Number(card.dataset.pbI)], m);
    });
    m.$("[data-pb-q]").focus();
  }

  async function pbDetail(p, browser) {
    if (!p) return;
    const P = PBT();
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="pb-d-t" style="max-width:560px;text-align:left;">
      <div class="pb-det"><span class="pb-ic" style="--c:${PB_SRC[p.src].c}">${p.icon ? `<img src="${esc(p.icon)}" alt="">` : esc(pbIni(p.name))}</span><div style="min-width:0;"><h3 id="pb-d-t" style="margin:0 0 4px;">${esc(p.name)}</h3>
        <div class="pb-meta"><span class="pb-src" style="--c:${PB_SRC[p.src].c}">${PB_SRC[p.src].n}</span><small style="color:var(--muted);font-size:12px;">${esc([p.author && `${P.by} ${p.author}`, PB_LOADERS[p.loader], `⬇ ${pbFmt(p.dl)}`].filter(Boolean).join(" · "))}</small></div>
        <p style="margin:8px 0 0;font-size:13px;line-height:1.45;">${esc(p.desc)}</p>${p.page ? `<button type="button" class="link-btn" data-page style="font-size:12.5px;margin-top:6px;">${esc(P.page)}</button>` : ""}</div></div>
      <div class="field-label" style="margin-top:14px;">${esc(P.ver)}</div>
      <select class="pb-sel" data-ver style="width:100%;" ${p.src === "cf" ? "disabled" : ""}><option value="">${esc(p.src === "cf" ? `${P.latest}${p.mc ? ` · Minecraft ${p.mc}` : ""}` : P.loading)}</option></select>
      ${p.src === "cf" ? `<p class="pb-note">${esc(P.noteCf)}</p>` : p.src === "ftb" ? `<p class="pb-note">${esc(P.noteFtb)}</p>` : ""}
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;"><button type="button" class="btn-secondary" data-x>${esc(P.back)}</button><button type="button" class="join-btn" data-go ${p.src === "cf" ? "" : "disabled"}>${esc(P.install)}</button></div></div>`);
    m.$("[data-x]").addEventListener("click", m.close);
    m.$("[data-page]")?.addEventListener("click", () => api.packBrowse.openPage(p.page));
    const sel = m.$("[data-ver]");
    if (p.src !== "cf") {
      const r = await api.packBrowse.versions(p.src, p.id).catch(() => null);
      if (!document.body.contains(m.ov)) return;
      const vs = r?.versions || [];
      const okV = vs.filter((v) => (!pbState.mc || v.mc === pbState.mc) && (!pbState.loader || v.loader === pbState.loader));
      const list = okV.length ? okV : vs;
      sel.innerHTML = list.length
        ? list.map((v, i) => `<option value="${esc(v.id)}">${esc([v.name, v.mc && `Minecraft ${v.mc}`, PB_LOADERS[v.loader], v.type !== "release" && P[v.type]].filter(Boolean).join(" · "))}${i === 0 ? ` (${esc(P.latest.toLowerCase())})` : ""}</option>`).join("")
        : `<option value="">${esc(r?.error || P.none)}</option>`;
      m.$("[data-go]").disabled = !list.length;
    }
    m.$("[data-go]").addEventListener("click", () => {
      const versionId = sel.value;
      m.close();
      pbInstall(p, versionId, browser);
    });
  }

  async function pbInstall(p, versionId, browser) {
    const P = PBT();
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" style="max-width:480px;text-align:left;">
      <h3 style="margin:0;">${esc(P.prepT(p.name))}</h3><p class="join-note" data-st style="margin:8px 0 0;">${esc(p.src === "ftb" ? P.prepFtb : P.prepDl)}…</p><div class="pb-bar"><i></i></div></div>`);
    m.ov.dataset.locked = "1";
    const st = m.$("[data-st]");
    const bar = m.$(".pb-bar i");
    const mb = (n) => `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} Mo`;
    const r = await api.packBrowse.prepare(p.src, p.id, versionId, { name: p.name, icon: p.icon }, (s) => {
      if (s.step === "zip") {
        st.textContent = `${P.prepZip}…`;
        bar.style.width = "100%";
        return;
      }
      if (s.total > 0) bar.style.width = `${Math.min(100, (s.bytes / s.total) * 100)}%`;
      st.textContent = `${s.step === "ftb" ? P.prepFtb : P.prepDl}${s.filesOf ? ` · ${s.files}/${s.filesOf}` : ""}${s.total ? ` · ${mb(s.bytes || 0)} / ${mb(s.total)}` : ""}`;
    }).catch((error) => ({ ok: false, error: String(error?.message || error) }));
    m.close();
    if (r?.ok) {
      browser?.close();
      return openCfPack({ zip: r.path, kind: r.kind });
    }
    if (p.src === "cf" && r?.code === "no_download") return pbNoDownload(p, browser);
    showModal({ title: P.prepT(p.name), body: r?.error || "", confirmLabel: "OK", tone: "warn" });
  }
  // Pack CurseForge que son auteur réserve à l'appli CurseForge : sa page, puis le .zip téléchargé.
  function pbNoDownload(p, browser) {
    const P = PBT();
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" style="max-width:480px;text-align:left;">
      <h3 style="margin:0;">${esc(P.noDlT)}</h3><p style="margin:8px 0 0;font-size:13px;line-height:1.45;">${esc(P.noDl)}</p>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px;"><button type="button" class="btn-secondary" data-x>${esc(T("cancel"))}</button>${p.page ? `<button type="button" class="btn-secondary" data-page>${esc(P.openCf)}</button>` : ""}<button type="button" class="join-btn" data-zip>${esc(P.haveZip)}</button></div></div>`);
    m.$("[data-x]").addEventListener("click", m.close);
    m.$("[data-page]")?.addEventListener("click", () => api.packBrowse.openPage(p.page));
    m.$("[data-zip]").addEventListener("click", async () => {
      const z = await api.cfPack.pickZip("cf");
      if (!z?.ok) return;
      m.close();
      browser?.close();
      openCfPack({ zip: z.path, kind: z.kind || "cf" });
    });
  }

  async function openCfPack(src) {
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cf-t" style="max-width:560px;text-align:left;max-height:calc(100vh - 48px);overflow:auto;">
      <h3 id="cf-t">${esc(src.kind === "omni" ? T("omImpT") : src.kind === "mr" ? T("mrT") : T("cfT"))}</h3><p class="join-note">${esc(T("cfReading"))}</p></div>`);
    const p = await api.cfPack.read(src);
    if (!document.body.contains(m.ov)) return;
    const box = m.ov.querySelector(".modal-box");
    if (!p?.ok) {
      m.close();
      return showModal({ title: T("cfT"), body: p?.error || "", confirmLabel: "OK", tone: "warn" });
    }
    const worlds = p.worlds || [];
    const picked = new Set(worlds.filter((w) => !src.worldKey || w.key === src.worldKey).map((w) => w.folder));
    const parts = new Set(["mods", "cfg", "rp", "sh"]);
    const goLabel = () => (picked.size ? T("cfGoW", { n: picked.size }) : T("cfGo"));
    box.innerHTML = `<h3 id="cf-t">${esc(p.from === "omnipack" ? T("omImpT") : p.from === "mrpack" ? T("mrT") : T("cfT"))}</h3>
      <div class="cf-head"><img src="${p.icon || grassThumb(p.name)}" alt=""><div><b>${esc(p.name)}</b>
        <small><span class="cf-src">${esc(p.from === "omnipack" ? T("omImpSrc", { n: (p.versions || []).length }) : p.from === "mrpack" ? T("mrSrc") : p.from === "zip" ? T("cfSrcZip") : T("cfSrcInst"))}</span>${esc(T("cfMeta", { v: p.from === "omnipack" ? (p.versions || []).join(", ") : p.minecraftVersion, l: p.loader ? modLabel({ loader: p.loader }) + (p.loaderVersion ? " " + p.loaderVersion : "") : "Vanilla", n: p.modCount }))}</small></div></div>
      <span class="play-path">${esc(p.path)}</span>
      <div class="cf-sub">${esc(T("cfWhatT"))}</div>
      <div class="play-list">
        <label class="play-row"><input type="checkbox" data-cfp="mods" checked><span class="t">${esc(T("cfPMods", { n: p.modCount }))}<small>${esc(p.manual.length ? T("cfPModsD", { a: p.modCount - p.manual.length, m: p.manual.length }) : T("cfPModsAll"))}</small></span><span class="sz">${esc(modLabel({ loader: p.loader }))}</span></label>
        <label class="play-row"><input type="checkbox" data-cfp="cfg" checked><span class="t">${esc(T("cfPCfg"))}<small>${esc(T("cfPCfgD", { n: p.configFiles }))}</small></span></label>
        ${p.resourcepacks?.length ? `<label class="play-row"><input type="checkbox" data-cfp="rp" checked><span class="t">${esc(T("cfPRp", { n: p.resourcepacks.length }))}<small>${esc(p.resourcepacks.join(", "))}</small></span></label>` : ""}
        ${p.shaders?.length ? `<label class="play-row"><input type="checkbox" data-cfp="sh" checked><span class="t">${esc(T("cfPSh", { n: p.shaders.length }))}<small>${esc(p.shaders.join(", "))}</small></span></label>` : ""}
      </div>
      <p class="cf-man-note" id="cf-nomods" style="color:var(--warn);" hidden>⚠ ${esc(T("cfNoModsW"))}</p>
      <div class="cf-sub">${esc(T("cfWorldsT"))}</div>
      ${worlds.length ? `<div class="play-list">${worlds.map((w) => `<label class="play-row"><input type="checkbox" data-cfw="${esc(w.folder)}" ${picked.has(w.folder) ? "checked" : ""}>
        <img src="${w.icon || grassThumb(w.folder)}" alt=""><span class="t">${esc(w.name)}<small>Minecraft ${esc(p.minecraftVersion)}${w.lastPlayed ? ` · ${esc(ago(w.lastPlayed))}` : ""}</small></span>
        <span class="sz">${esc(sizeFmt(w.sizeBytes))}</span></label>`).join("")}</div>` : `<p class="cf-man-note">${esc(T(p.from === "mrpack" ? "mrNoWorld" : "cfNoWorld"))}</p>`}
      ${on("packRam") ? `<div id="cf-ram"></div>` : ""}
      <p class="play-safe">✓ ${esc(T("cfSafe"))}</p>
      <p class="play-safe">✓ ${esc(T("cfPrivate"))}</p>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;">
        <button type="button" class="btn-secondary" id="cf-cancel">${esc(T("cancel"))}</button>
        <button type="button" class="join-btn" id="cf-go">${esc(goLabel())}</button>
      </div>`;
    const go = m.$("#cf-go");
    m.$("#cf-cancel").addEventListener("click", m.close);
    // RAM du pack importé (Laboratoire « packRam »), repliée : RAM conseillée par le fichier du pack.
    const ramSt = { mode: "auto", gb: 0, fold: true };
    let ramDraw = null;
    if (m.$("#cf-ram")) {
      await rmLoadSys();
      ramDraw = rmMount(m.$("#cf-ram"), ramSt, () => ({ mods: parts.has("mods") ? p.modCount || 0 : 0, mc: p.minecraftVersion || (p.versions || [])[0] || "", shaders: parts.has("sh") && !!p.shaders?.length, packGB: Number(p.recommendedRamGB) || null }));
    }
    const check = () => {
      ramDraw?.();
      go.textContent = goLabel();
      m.$("#cf-nomods").hidden = parts.has("mods") || !picked.size;
      go.disabled = !parts.size && !picked.size;
    };
    m.ov.querySelectorAll("input[data-cfw]").forEach((c) => c.addEventListener("change", () => {
      c.checked ? picked.add(c.dataset.cfw) : picked.delete(c.dataset.cfw);
      check();
    }));
    m.ov.querySelectorAll("input[data-cfp]").forEach((c) => c.addEventListener("change", () => {
      c.checked ? parts.add(c.dataset.cfp) : parts.delete(c.dataset.cfp);
      check();
    }));
    go.addEventListener("click", () => installCfPack(m, box, p, [...picked], parts, ramDraw ? { mode: ramSt.mode, ...(ramSt.mode === "custom" ? { gb: ramSt.gb } : {}) } : null));
    go.focus();
  }

  // Progression des imports (27/10, preview « Progression des imports » C + B validée par Rushi) :
  // rond qui tourne, barre de l'étape, détail (fichiers, Mo, fichier en cours) et barre de tout
  // l'import avec le temps restant. Les étapes reçoivent ce que main.js envoie (importMeter).
  const ipSpin = '<span class="ip-spin" aria-hidden="true"></span>';
  const ipNum = (n) => Number(n || 0).toLocaleString(L() === "fr" ? "fr-BE" : "en-GB");
  const ipDur = (sec) => (sec < 60 ? `${Math.max(1, Math.round(sec))} s` : `${Math.ceil(sec / 60)} min`);
  function ipStepExtra(s) {
    const frac = s.total > 0 ? s.bytes / s.total : s.filesOf > 0 ? s.files / s.filesOf : s.of > 0 ? s.n / s.of : null;
    const bar = `<div class="cf-bar${frac == null ? " ind" : ""}"><i style="width:${frac == null ? 35 : Math.round(Math.min(1, frac) * 100)}%"></i></div>`;
    const bits = [];
    if (s.what) bits.push(s.what);
    if (s.filesOf) bits.push(T("ipFiles", { n: ipNum(s.files), of: ipNum(s.filesOf) }));
    if (s.total) bits.push(T("ipOf", { a: sizeFmt(s.bytes), b: sizeFmt(s.total) }));
    if (s.file) bits.push(s.file);
    return bar + (bits.length ? `<div class="ip-sub">${esc(bits.join(" · "))}</div>` : "");
  }
  // `run` : { t0, end, overall } ; overall = part faite (0 à 1) envoyée par le launcher, sinon les étapes.
  function ipOverall(run, steps) {
    const work = steps.filter((s) => s.id !== "list" && s.id !== "manual");
    const bySteps = work.reduce((a, s) => a + (s.state === "done" ? 1 : 0), 0) / Math.max(1, work.length);
    const frac = run.end ? 1 : run.overall != null ? run.overall : bySteps;
    const el = ((run.end || Date.now()) - run.t0) / 1000;
    const left = !run.end && frac > 0.03 && el > 2 ? el / frac - el : null;
    return `<div class="ip-all"><div class="ip-row"><span>${esc(run.end ? T("ipAllDone") : T("ipAll", { p: Math.floor(frac * 100) }))}</span>
      <span>${esc(run.end ? T("ipIn", { t: ipDur(el) }) : left != null ? T("ipLeft", { t: ipDur(left) }) : T("ipCalc"))}</span></div>
      <div class="track"><i style="width:${Math.round(frac * 100)}%"></i></div></div>`;
  }
  // Un pas de progression reçu : l'étape tourne (les autres en cours repassent en attente), ou finit.
  function ipApply(steps, run, ev) {
    if (ev.overall != null) run.overall = ev.overall;
    const s = steps.find((x) => x.id === ev.step);
    if (!s) return;
    if (ev.n != null) s.n = ev.n;
    for (const k of ["bytes", "total", "files", "filesOf", "file", "what"]) if (ev[k] !== undefined) s[k] = ev[k];
    if (ev.idle) {
      if (s.state !== "done") s.state = "wait";
      return;
    }
    if (ev.done) {
      s.state = "done";
      const i = steps.indexOf(s);
      if (steps[i + 1] && steps[i + 1].state === "wait") steps[i + 1].state = "run";
      return;
    }
    for (const x of steps) if (x !== s && x.state === "run" && x.id !== "manual") x.state = "wait";
    s.state = "run";
  }
  const ipIcon = (s) => (s.state === "done" ? "✓" : s.state === "run" ? (s.id === "manual" ? "●" : ipSpin) : "○");

  async function installCfPack(m, box, p, folders, parts, ram = null) {
    m.ov.dataset.locked = "1";
    // Compteur du téléchargement : sans les mods déjà dans le fichier du pack (copiés, pas
    // téléchargés) ni ceux à télécharger à la main. Avant : ATM10 restait à « 413/416 » (27/10).
    const auto = p.modCount - p.manual.length - (p.packedJars || 0);
    const omni = p.from === "omnipack";
    const steps = omni ? [
      { id: "list", label: T("cfStepList"), state: "done" },
      { id: "omcopy", label: T("cfStepOm"), state: "run", n: 0, of: (p.versions || []).length || 1 },
    ] : [
      { id: "list", label: T("cfStepList"), state: "done" },
      ...(parts.has("mods") ? [{ id: "dl", label: T("cfStepDl"), state: "run", n: 0, of: auto }] : []),
      // Mods rangés dans le fichier du pack : ligne à part, sinon on croit qu'il en manque (27/10).
      ...(parts.has("mods") && p.packedJars ? [{ id: "packed", label: T("cfStepPacked"), state: "wait", n: 0, of: p.packedJars }] : []),
      ...(parts.has("cfg") ? [{ id: "cfg", label: T("cfStepCfg"), state: "wait" }] : []),
      ...(parts.has("rp") && p.resourcepacks?.length ? [{ id: "rp", label: T("cfStepRp"), state: "wait" }] : []),
      ...(parts.has("sh") && p.shaders?.length ? [{ id: "sh", label: T("cfStepSh"), state: "wait" }] : []),
      ...(folders.length ? [{ id: "world", label: T("cfStepWorld"), state: "wait" }] : []),
      ...(parts.has("mods") && p.manual.length ? [{ id: "manual", label: T("cfStepManual"), state: "wait", n: 0, of: p.manual.length }] : []),
    ];
    if (steps[1] && steps[1].state === "wait") steps[1].state = "run";
    const found = new Set();
    const run = { t0: Date.now(), end: 0, overall: null };
    // Trois blocs : la progression (redessinée à chaque pas), la liste des mods à la main et les
    // boutons (redessinés seulement quand ils changent). Avant (29/10) : tout était refait à chaque
    // pas, le bouton survolé était recréé et son survol clignotait.
    box.innerHTML = `<div id="cf-live"></div><div id="cf-manbox"></div><div class="modal-actions" id="cf-acts" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;"></div>`;
    const part = { live: box.querySelector("#cf-live"), man: box.querySelector("#cf-manbox"), acts: box.querySelector("#cf-acts") };
    const drawn = { man: null, acts: null };
    const draw = () => {
      const allDone = steps.every((s) => s.state === "done");
      const man = steps.find((s) => s.id === "manual");
      pjPatch(part.live, `<h3 id="cf-t">${esc(p.from === "mrpack" ? T("mrT") : T("cfT"))}</h3>
        <div class="cf-head"><img src="${p.icon || grassThumb(p.name)}" alt=""><div><b>${esc(p.name)}</b><small>${esc(T("cfMeta", { v: p.minecraftVersion, l: modLabel({ loader: p.loader }), n: p.modCount }))}</small></div></div>
        ${ipOverall(run, steps)}
        <div class="cf-steps">${steps.map((s) => `<div class="cf-step ${s.state}"><span class="ic">${ipIcon(s)}</span><span>${esc(s.label)}</span><span class="n">${s.of ? `${s.n}/${s.of}` : ""}</span>
          ${s.state === "run" && s.id !== "manual" ? ipStepExtra(s) : ""}</div>`).join("")}</div>`);
      const manHtml = man && man.state !== "wait" ? `<p class="cf-man-note">${esc(T("cfManualD"))}</p>
          <div class="cf-man">${p.manual.map((x, i) => `<div class="cf-man-row ${found.has(i) ? "ok" : ""}"><span style="min-width:0;">${esc(x.name)}<span class="fn">${esc(x.fileName)}</span></span>
            <span class="st">${esc(found.has(i) ? T("cfFound") : T("cfWaiting"))}</span>
            ${found.has(i) ? "<span></span>" : `<button type="button" class="link-btn" data-cf-open="${i}">${esc(T("cfOpenPage"))} ↗</button>`}</div>`).join("")}</div>` : "";
      const actsHtml = `${man && !allDone ? `<button type="button" class="btn-secondary" id="cf-later">${esc(T("cfLater"))}</button>` : ""}
          ${allDone ? `<button type="button" class="btn-secondary" id="cf-done">${esc(T("cfDoneB"))}</button>` : ""}
          <button type="button" class="join-btn" id="cf-play" ${allDone ? "" : "disabled"}>${esc(T("cfPlay"))}</button>`;
      const newMan = manHtml !== drawn.man, newActs = actsHtml !== drawn.acts;
      if (newMan) part.man.innerHTML = drawn.man = manHtml;
      if (newActs) part.acts.innerHTML = drawn.acts = actsHtml;
      if (newActs) m.$("#cf-later")?.addEventListener("click", () => {
        m.close();
        toast(T("cfLaterToast", { n: p.manual.length - found.size }));
        refresh();
      });
      if (newMan) part.man.querySelectorAll("[data-cf-open]").forEach((b) => b.addEventListener("click", async () => {
        const i = Number(b.dataset.cfOpen);
        b.disabled = true;
        const r = await api.cfPack.openManual(p.manual[i]);
        if (r?.found) {
          found.add(i);
          man.n = found.size;
          if (found.size === p.manual.length) man.state = "done";
          draw();
        } else b.disabled = false;
      }));
      // « Terminé » : le pack est importé, on ne lance pas le jeu.
      if (newActs) m.$("#cf-done")?.addEventListener("click", async () => {
        m.close();
        toast(folders.length ? T("cfReady", { p: p.name, w: p.worlds.find((w) => w.folder === folders[0])?.name || "" }) : T("cfReadyNoW", { p: p.name }));
        await refresh();
      });
      if (newActs) m.$("#cf-play")?.addEventListener("click", async () => {
        m.close();
        toast(folders.length ? T("cfReady", { p: p.name, w: p.worlds.find((w) => w.folder === folders[0])?.name || "" }) : T("cfReadyNoW", { p: p.name }));
        await refresh();
        // Pack sans monde importé : on lance quand même l'installation qu'on vient de créer (28/10,
        // le bouton ne faisait rien). Si les étapes finissent avant la réponse, on attend celle-ci.
        const r = job || await jobP;
        if (r?.worldKey) launch({ worldKey: r.worldKey, versionId: r.versionId || undefined }, null);
        else if (r?.versionId) launch({ versionId: r.versionId }, null);
      });
    };
    let job = null, jobP = null;
    draw();
    // Le temps restant bouge même entre deux pas (gros fichier) : un dessin par seconde.
    const tick = setInterval(() => (document.body.contains(m.ov) ? draw() : clearInterval(tick)), 1000);
    job = await (jobP = api.cfPack.install(p.id, { worlds: folders, parts: [...parts], ...(ram ? { ram } : {}) }, (ev) => {
      if (ev.step === "omcopy" && !ev.done) ev = { ...ev, what: ev.mc ? `Minecraft ${ev.mc}` : undefined };
      ipApply(steps, run, ev);
      draw();
    }));
    clearInterval(tick);
    if (!job?.ok) {
      m.close();
      return showModal({ title: T("cfT"), body: job?.error || "", confirmLabel: "OK", tone: "warn" });
    }
    for (const s of steps) if (s.id !== "manual" && s.state !== "done") s.state = "done";
    run.end = Date.now();
    draw();
  }

  // --- Accueil : carte « Continuer mon monde » --------------------------------------------------
  // Design A (25/10) : la carte du dernier monde se place a cote de celle du dernier serveur, dans
  // #home-halves (voir paintHomeView). Sans cet emplacement, ancienne place : sous la carte serveur.
  const homePanel = document.getElementById("home-panel");
  function injectHome() {
    if (!homePanel) return;
    homePanel.querySelector(".play-home-section")?.remove();
    if (!playVisible) return;
    const w = data.worlds[0];
    if (!w) return;
    const halves = homePanel.querySelector("#home-halves");
    const anchor = halves ? null : homePanel.querySelector(".home-resume")?.closest(".home-section") || homePanel.querySelector(".home-main > *");
    if (!halves && !anchor) return;
    const lv = w.lastVersionLabel;
    const card = `<div class="home-resume play-resume" role="button" tabindex="0">
        <span class="home-resume-icon"><img src="${worldThumb(w)}" alt=""></span>
        <div class="home-resume-txt">
          <span class="home-resume-when">${esc(T("homeWhen", { p: lv?.pack ? packName({ name: lv.pack }) : "Vanilla", v: lv?.minecraftVersion || w.minecraftVersion || "" }))}</span>
          <h2>${esc(w.name)}</h2>
          <p><span class="status-dot ${w.backup ? "online" : "offline"}"></span>${esc(w.backup ? (w.lastBackupAt ? T("saved", { t: ago(w.lastBackupAt) }) : T("notSaved")) : T("off"))}</p>
        </div>
        <button type="button" class="home-resume-play join-btn" data-play-home ${data.running ? "disabled" : ""}>${esc(T("play"))}</button>
      </div>`;
    let sec;
    if (halves) {
      halves.insertAdjacentHTML("beforeend", card);
      sec = halves.lastElementChild;
      sec.classList.add("play-home-section");
      sec.title = T("allWorlds");
    } else {
      sec = document.createElement("div");
      sec.className = "home-section play-home-section";
      sec.innerHTML = `<div class="home-section-header"><h3>${esc(T("contT"))}</h3><button type="button" class="home-see-all" data-play-all>${esc(T("allWorlds"))}</button></div>${card}`;
      anchor.after(sec);
      sec.querySelector("[data-play-all]").addEventListener("click", showPlay);
    }
    const resume = sec.classList.contains("play-resume") ? sec : sec.querySelector(".play-resume");
    resume.addEventListener("click", (e) => {
      if (!e.target.closest("[data-play-home]")) showPlay();
    });
    sec.querySelector("[data-play-home]").addEventListener("click", (e) => launch({ worldKey: w.key }, e.target));
  }
  // L'accueil se redessine souvent (renderHomeView) : on remet la tuile après chaque rendu.
  if (homePanel) {
    let pending = false;
    new MutationObserver(() => {
      if (pending || homePanel.querySelector(".play-home-section")) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        injectHome();
      });
    }).observe(homePanel, { childList: true, subtree: true });
  }

  // --- Cloud (Supporters) ---------------------------------------------------------------------
  // force : après une action du joueur. Sinon la réponse gardée par le launcher suffit (30 min sans
  // offre cloud, 2 min avec), pour ne pas appeler le site à chaque rafraîchissement de l'onglet.
  async function loadCloud(force = false) {
    if (!worldsOn) {
      data.cloud = null;
      return;
    }
    const r = await api.cloud.status({ force }).catch(() => null);
    if (!worldsOn) return; // coupé pendant la demande (audit du 25/10)
    data.cloud = r?.ok ? r : null;
    if (r?.job) setJob(r.job);
    if (r?.djob && !data.djob) setDjob(r.djob);
  }
  let cloudLater = false;
  function cloudBannerHtml() {
    const c = data.cloud;
    if (!c?.offer?.cloud || c.setupDone || !cloudLater || (data.job && !data.job.done)) return "";
    const fr = L() === "fr";
    return `<div class="guest-banner" style="display:flex;align-items:center;gap:12px;padding:12px 14px;margin:0 0 16px;border-radius:var(--radius-l);border:1px solid color-mix(in srgb, var(--warn) 40%, transparent);background:color-mix(in srgb, var(--warn) 10%, transparent);font-size:13px;">
      <span style="flex:1;">★ ${fr ? "Tu es Supporter : tes mondes ne sont pas encore dans le cloud." : "You are a Supporter: your worlds are not in the cloud yet."}</span>
      <button type="button" class="join-btn" data-cloud-banner="1">${fr ? "Activer la sauvegarde en ligne" : "Turn on online backup"}</button></div>`;
  }
  // Supporter qui n'a encore rien envoyé depuis ce PC : la fenêtre s'ouvre une fois à l'arrivée.
  let offered = false;
  function maybeOfferCloud() {
    const c = data.cloud;
    if (offered || !c?.offer?.cloud || c.setupDone || cloudLater || !data.worlds.some((w) => w.backup)) return;
    if (data.job && !data.job.done) return;
    offered = true;
    openCloudSync({ resync: false });
  }

  const moFmt = (bytes) => sizeFmt(bytes);
  const etaFmt = (sec) => {
    const fr = L() === "fr";
    if (!Number.isFinite(sec)) return "";
    if (sec < 60) return `${Math.max(1, Math.round(sec))} s`;
    if (sec < 5400) return `${Math.round(sec / 60)} min`;
    return `${(sec / 3600).toFixed(1).replace(".", fr ? "," : ".")} h`;
  };

  // Fenêtre « Synchroniser » : test de connexion (petit envoi), puis choix des mondes dans la
  // limite du quota de l'offre (jamais une valeur écrite en dur ici), puis envoi en arrière-plan.
  async function openCloudSync({ resync }) {
    const fr = L() === "fr";
    const m = overlay(`<div class="cloud-box" role="dialog" aria-modal="true" aria-labelledby="cl-t" aria-busy="true">
      <h3 id="cl-t">${fr ? "Test de ta connexion en cours…" : "Testing your connection…"}</h3>
      <p>${fr ? "On envoie un petit fichier test pour savoir combien de temps prendra l'envoi de tes mondes." : "We send a small test file to know how long sending your worlds will take."}</p>
      <div class="cloud-bar"><i id="cl-test-bar" style="width:0%;transition:width 3s cubic-bezier(.2,.6,.3,1);"></i></div></div>`, { className: "play-modal" });
    m.ov.dataset.locked = "1";
    // Retour de test du 24/10 : la barre ne bougeait pas. Elle avance maintenant en 3 s jusqu'à 90 %
    // pendant que le vrai test tourne, puis finit à 100 % quand il est fini (jamais avant 3 s).
    const bar = m.$("#cl-test-bar");
    requestAnimationFrame(() => requestAnimationFrame(() => bar && (bar.style.width = "90%")));
    const [test] = await Promise.all([api.cloud.testConnection(), loadCloud(true), new Promise((r) => setTimeout(r, 3000))]);
    if (bar) {
      bar.style.transition = "width .3s ease-out";
      bar.style.width = "100%";
      await new Promise((r) => setTimeout(r, 320));
    }
    delete m.ov.dataset.locked;
    if (!document.body.contains(m.ov)) return;
    const c = data.cloud;
    if (!c?.offer?.cloud) {
      m.close();
      return;
    }
    const mbps = test?.ok && test.mbps > 0 ? test.mbps : null;
    const upBps = mbps ? (mbps * 1e6) / 8 : null;
    const offer = c.offer;
    const quota = offer.quotaBytes;
    const used = c.usedBytes || 0;
    const inCloud = new Map((c.worlds || []).map((x) => [x.worldKey, x]));
    const all = data.worlds.filter((w) => w.backup);
    const skipped = data.worlds.filter((w) => !w.backup);
    // Taille réelle de ce qui part : toutes les sauvegardes .zip du monde pas encore en ligne
    // (versions miroir, 25/10). Un monde sans sauvegarde en reçoit une au lancement : sa taille
    // n'est connue qu'après, on montre alors la taille du monde.
    const sizeOf = (w) => (w.notInCloud ? w.notInCloudBytes || 0 : w.sizeBytes || 0);
    const pendingTracked = data.worlds.filter((w) => w.backup && inCloud.has(w.key)).reduce((a, w) => a + (w.notInCloudBytes || 0), 0);
    const notIn = all.filter((w) => !inCloud.has(w.key));
    const pick = new Set();
    // Par défaut : les mondes pas encore en ligne, du plus petit au plus gros, tant que ça rentre.
    let acc = used + pendingTracked;
    for (const w of notIn.slice().sort((a, b) => sizeOf(a) - sizeOf(b))) {
      if (acc + sizeOf(w) <= quota) {
        pick.add(w.key);
        acc += sizeOf(w);
      }
    }
    const allTotal = notIn.reduce((a, w) => a + sizeOf(w), 0) + used + pendingTracked;
    const over = allTotal > quota;
    const offerName = offer.name?.[L()] || offer.name?.fr || "";
    const qTxt = fr ? `ton quota de ${moFmt(quota)} (offre ${esc(offerName)})` : `your ${moFmt(quota)} quota (${esc(offerName)} plan)`;
    const draw = () => {
      const sel = notIn.filter((w) => pick.has(w.key));
      const addBytes = sel.reduce((a, w) => a + sizeOf(w), 0);
      const tot = used + pendingTracked + addBytes;
      const pct = quota ? Math.min(100, (tot / quota) * 100) : 100;
      const bad = tot > quota;
      const near = !bad && tot > quota * 0.8;
      const rows = all.map((w) => inCloud.has(w.key)
        ? `<div class="cloud-row" style="grid-template-columns:18px 32px minmax(0,1fr) auto auto;"><span style="color:var(--success);">✓</span><img src="${worldThumb(w)}" alt=""><span>${esc(w.name)}<small>${w.notInCloud ? (fr ? `Dans le cloud · encore ${w.notInCloud} sauvegarde${w.notInCloud > 1 ? "s" : ""} à envoyer (${moFmt(w.notInCloudBytes)})` : `In the cloud · ${w.notInCloud} more backup${w.notInCloud > 1 ? "s" : ""} to send (${moFmt(w.notInCloudBytes)})`) : fr ? "Déjà dans le cloud" : "Already in the cloud"}</small></span><span class="st">${moFmt(inCloud.get(w.key).totalBytes || inCloud.get(w.key).sizeBytes || 0)}</span><button type="button" class="link-btn" data-rm="${esc(w.key)}" style="font-size:12px;">${fr ? "Retirer du cloud" : "Remove from cloud"}</button></div>`
        : `<label class="cloud-row" style="cursor:pointer;grid-template-columns:18px 32px minmax(0,1fr) auto;"><input type="checkbox" data-w="${esc(w.key)}" ${pick.has(w.key) ? "checked" : ""}><img src="${worldThumb(w)}" alt=""><span>${esc(w.name)}<small>${esc(w.minecraftVersion || "")}${w.backups ? ` · ${fr ? `${w.backups} sauvegarde${w.backups > 1 ? "s" : ""}` : `${w.backups} backup${w.backups > 1 ? "s" : ""}`}` : ""}</small></span><span class="st">${moFmt(sizeOf(w))}</span></label>`).join("")
        + skipped.map((w) => `<div class="cloud-row" style="opacity:.6;grid-template-columns:18px 32px minmax(0,1fr) auto;"><span></span><img src="${worldThumb(w)}" alt=""><span>${esc(w.name)}<small>${fr ? "Sauvegarde coupée pour ce monde : pas envoyé" : "Backup is off for this world: not sent"}</small></span><span class="st">–</span></div>`).join("");
      const eta = upBps ? etaFmt((addBytes + pendingTracked) / upBps) : null;
      const n = sel.length;
      m.ov.innerHTML = `<div class="cloud-box" role="dialog" aria-modal="true" aria-labelledby="cl-t">
        <h3 id="cl-t">${resync || c.setupDone ? (fr ? "Synchroniser mes mondes" : "Sync my worlds") : `★ ${fr ? "Merci, tu es Supporter !" : "Thanks, you are a Supporter!"}`}</h3>
        <p>${resync || c.setupDone
          ? (fr ? `Coche les mondes à ajouter au cloud. Pour faire de la place dans ${qTxt}, tu peux retirer un monde du cloud : il reste sur ton PC.` : `Tick the worlds to add to the cloud. To make room in ${qTxt}, you can remove a world from the cloud: it stays on your PC.`)
          : over
            ? (fr ? `Tes mondes font ${moFmt(allTotal)} au total : c'est plus que ${qTxt}. Choisis ceux à mettre dans le cloud. Les autres restent sauvegardés sur ton PC, comme avant.` : `Your worlds are ${moFmt(allTotal)} in total: more than ${qTxt}. Pick the ones to put in the cloud. The others stay backed up on your PC, as before.`)
            : (fr ? "On va envoyer tes mondes dans le cloud. Ensuite, ils seront sauvegardés en ligne tout seuls et tu les retrouveras sur n'importe quel PC, et sur le site." : "We will send your worlds to the cloud. After that, they are backed up online on their own and you get them on any PC, and on the website.")}</p>
        <div class="cloud-bar"><i style="width:${pct}%;${bad ? "background:var(--danger)" : near ? "background:var(--warn)" : ""}"></i></div>
        <div class="cloud-meta"><span>${moFmt(tot)} ${fr ? "sur" : "of"} ${moFmt(quota)}</span><span style="${bad ? "color:var(--danger)" : near ? "color:var(--warn)" : ""}">${bad ? (fr ? `${moFmt(tot - quota)} de trop` : `${moFmt(tot - quota)} too much`) : fr ? `il restera ${moFmt(quota - tot)}` : `${moFmt(quota - tot)} will be left`}</span></div>
        ${near ? `<div class="cloud-warn">${fr ? "Ton espace en ligne sera presque plein. Quand il sera plein, rien n'est supprimé : les nouvelles sauvegardes restent sur ton PC et on te le dit." : "Your online space will be almost full. When it is full, nothing is deleted: new backups stay on your PC and we tell you."}</div>` : ""}
        <div class="cloud-list">${rows}</div>
        ${over || bad ? `<p style="font-size:12.5px;">${fr ? "Besoin de plus de place ?" : "Need more space?"} <button type="button" class="link-btn" id="cl-more" style="font-size:12.5px;">${fr ? "Voir les offres avec plus d'espace" : "See plans with more space"}</button></p>` : ""}
        <p style="font-size:12.5px;">${fr ? "Ça se fait en arrière-plan : tu peux continuer à utiliser le launcher, et l'envoi se met en pause pendant que tu joues." : "It runs in the background: you can keep using the launcher, and sending pauses while you play."} ${eta ? (fr ? `Avec ta connexion (${Math.round(mbps)} Mb/s en envoi), environ <b>${eta}</b>.` : `With your connection (${Math.round(mbps)} Mb/s upload), about <b>${eta}</b>.`) : !mbps && n ? (fr ? "On n'a pas pu mesurer ta connexion : on ne peut pas dire combien de temps ça prendra, mais tu peux lancer quand même." : "We could not measure your connection: we can't tell how long it will take, but you can start anyway.") : ""}</p>
        <div class="cloud-acts"><button type="button" class="btn-secondary" id="cl-later" style="margin:0;">${resync || c.setupDone ? (fr ? "Annuler" : "Cancel") : fr ? "Plus tard" : "Later"}</button><button type="button" class="join-btn" id="cl-go" ${bad || (!n && !pendingTracked) ? "disabled" : ""}>${n ? (fr ? `Lancer la synchronisation (${n} monde${n > 1 ? "s" : ""})` : `Start syncing (${n} world${n > 1 ? "s" : ""})`) : fr ? "Envoyer les sauvegardes manquantes" : "Send the missing backups"}</button></div></div>`;
      m.ov.querySelectorAll("[data-w]").forEach((cb) => cb.addEventListener("change", () => {
        cb.checked ? pick.add(cb.dataset.w) : pick.delete(cb.dataset.w);
        draw();
      }));
      m.ov.querySelector("#cl-more")?.addEventListener("click", () => toast(fr ? "Pour l'instant, seule l'offre Supporter existe. Une offre avec plus d'espace viendra plus tard." : "For now only the Supporter plan exists. A plan with more space will come later."));
      m.ov.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", async () => {
        const w = all.find((x) => x.key === b.dataset.rm);
        const r = await showModal({
          title: fr ? `Retirer « ${w.name} » du cloud ?` : `Remove “${w.name}” from the cloud?`,
          body: fr ? "Ses sauvegardes en ligne sont supprimées pour de bon. Le monde reste sur ton PC, avec ses sauvegardes locales." : "Its online backups are deleted for good. The world stays on your PC, with its local backups.",
          confirmLabel: fr ? "Oui, retirer" : "Yes, remove",
          cancelLabel: fr ? "Non" : "No",
          tone: "warn",
        });
        if (!r?.confirmed) return;
        const out = await api.cloud.remove(w.key);
        if (!out?.ok) return toast(out?.error || "");
        inCloud.delete(w.key);
        notIn.push(w);
        await loadCloud(true);
        draw();
        render();
        toast(fr ? `« ${w.name} » retiré du cloud. Il est toujours sur ton PC.` : `“${w.name}” removed from the cloud. It is still on your PC.`);
      }));
      m.ov.querySelector("#cl-later").addEventListener("click", () => {
        m.close();
        if (!resync && !c.setupDone) {
          cloudLater = true;
          render();
        }
      });
      m.ov.querySelector("#cl-go").addEventListener("click", async () => {
        const keys = [...pick].filter((k) => !inCloud.has(k));
        m.close();
        const out = await api.cloud.sync(keys);
        if (!out?.ok) return showModal({ title: fr ? "Synchronisation" : "Sync", body: out?.error || "", confirmLabel: "OK", tone: "warn" });
        cloudLater = false;
        toast(fr ? "Synchronisation lancée. Suis-la en haut à droite : tu peux continuer à utiliser le launcher." : "Sync started. Follow it at the top right: you can keep using the launcher.");
        await loadCloud(true);
        render();
      });
    };
    draw();
  }

  // Téléchargement en arrière-plan (un ou plusieurs mondes), suivi dans la pilule en haut à droite.
  async function downloadFromCloud(ids) {
    if (!ids.length) return;
    const fr = L() === "fr";
    const r = await api.cloud.downloadMany(ids);
    if (!r?.ok) return showModal({ title: fr ? "Téléchargement impossible" : "Download failed", body: r?.error || "", confirmLabel: "OK", tone: "warn" });
    toast(fr ? "Téléchargement lancé. Suis-le en haut à droite : tu peux continuer à utiliser le launcher." : "Download started. Follow it at the top right: you can keep using the launcher.");
  }
  function setDjob(djob) {
    if (djob && !Array.isArray(djob.items)) djob = null; // réponse « feature_off » ou vide
    if (djob && !worldsOn) return;
    const was = data.djob && !data.djob.done;
    data.djob = djob;
    try {
      renderActivity();
    } catch {
      /* pilule pas encore prête */
    }
    if (was && djob?.done) {
      const fr = L() === "fr";
      const ok = djob.items.filter((i) => i.done).length;
      const bad = djob.items.filter((i) => i.error);
      if (ok) {
        const msg = fr ? `✓ ${ok} monde${ok > 1 ? "s" : ""} téléchargé${ok > 1 ? "s" : ""} : prêt${ok > 1 ? "s" : ""} à jouer.` : `✓ ${ok} world${ok > 1 ? "s" : ""} downloaded: ready to play.`;
        toast(msg);
        if (typeof notifyIfAway === "function") notifyIfAway(fr ? "Mondes téléchargés" : "Worlds downloaded", msg);
      }
      if (bad.length) showModal({ title: fr ? "Téléchargement incomplet" : "Download incomplete", body: bad.map((i) => `${i.name} : ${i.error}`).join("\n"), confirmLabel: "OK", tone: "warn" });
      refresh();
    } else if (!panel.hidden && (!was || djob?.done)) render();
  }
  api.cloud.onDownloadUpdate(setDjob);

  // Envoi en arrière-plan : affiché dans la pilule en haut à droite (renderActivity de renderer.js
  // appelle window.playCloudActivity) quand rien d'autre ne tourne.
  function setJob(job) {
    if (job && !Array.isArray(job.items)) job = null;
    if (job && !worldsOn) return;
    const wasActive = data.job && !data.job.done;
    data.job = job;
    try {
      renderActivity();
    } catch {
      /* pilule pas encore prête */
    }
    // « Fermer quand c'est fini » : la synchro est terminée (ou arrêtée), le launcher se ferme.
    if (data.closeWhenDone && (!job || job.done)) {
      data.closeWhenDone = false;
      if (!job?.error) return window.mchub.windowControls.close();
    }
    if (wasActive && job?.done) {
      const n = job.items.filter((i) => i.done).length;
      if (n) toast(L() === "fr" ? `✓ Synchronisation terminée : ${n} monde${n > 1 ? "s" : ""} dans le cloud.` : `✓ Sync complete: ${n} world${n > 1 ? "s" : ""} in the cloud.`);
      loadCloud(true).then(() => !panel.hidden && render());
    } else if (!panel.hidden && (!wasActive || job?.done)) render();
  }
  api.cloud.onUpdate(setJob);

  window.playCloudActivity = () => {
    const list = [saveActivity(), downloadActivity(), uploadActivity()].filter(Boolean);
    if (!list.length) return null;
    // Une sauvegarde passe devant tout (même la partie en cours) : elle ne dure que quelques secondes.
    return { parts: list[0].parts, panelHtml: list.map((a) => a.panelHtml).join(""), over: !!list[0].over };
  };

  // Sauvegarde d'un monde dans la pilule (retour de Rushi du 25/10 : « on dirait qu'il ne se passe
  // rien »). Même très rapide, elle reste au moins 2 s, puis « Sauvegarde terminée ✓ » pendant 3 s.
  const SAVE_MIN_MS = 2000;
  const SAVE_DONE_MS = 3000;
  let saveTimer = null;
  const pillRefresh = () => {
    try {
      renderActivity();
    } catch {
      /* pilule pas encore prête */
    }
  };
  api.onSaveActivity?.((a) => {
    clearTimeout(saveTimer);
    const name = a.name || data.worlds.find((w) => w.key === a.key)?.name || "";
    if (a.phase === "start" || a.phase === "wait") {
      const since = data.save && (data.save.phase === "start" || data.save.phase === "wait") ? data.save.since : Date.now();
      data.save = { name, label: a.label, phase: a.phase, since };
      return pillRefresh();
    }
    const finish = () => {
      data.save = { name, label: a.label, phase: a.phase };
      pillRefresh();
      saveTimer = setTimeout(() => {
        data.save = null;
        pillRefresh();
      }, SAVE_DONE_MS);
    };
    const left = SAVE_MIN_MS - (Date.now() - (data.save?.since || 0));
    if (left > 0) saveTimer = setTimeout(finish, left);
    else finish();
  });
  function saveActivity() {
    const s = data.save;
    if (!s) return null;
    const fr = L() === "fr";
    const what = s.label ? `★ « ${s.label} »` : s.name ? `« ${s.name} »` : "";
    const [long, short, icon] = {
      start: [fr ? `Sauvegarde ${what ? `de ${what} ` : ""}en cours…` : `Backing up ${what}…`, fr ? "Sauvegarde…" : "Saving…", '<span class="activity-ring"></span>'],
      wait: [fr ? "Sauvegarde : appuie sur Échap dans le jeu" : "Backup: press Esc in the game", fr ? "Sauvegarde…" : "Saving…", '<span class="status-dot" style="background:var(--warn)"></span>'],
      done: [fr ? "Sauvegarde terminée ✓" : "Backup done ✓", "✓", '<span class="status-dot" style="background:var(--success)"></span>'],
      skip: [fr ? "Déjà sauvegardé, rien n'a changé ✓" : "Already backed up, nothing changed ✓", "✓", '<span class="status-dot" style="background:var(--success)"></span>'],
      fail: [fr ? "Sauvegarde pas faite" : "Backup not done", "!", '<span class="status-dot" style="background:var(--danger)"></span>'],
    }[s.phase] || [];
    if (!long) return null;
    const panelHtml = `<div class="play-cloud-task" style="padding:10px 10px 4px;border-bottom:1px solid var(--border);">
      <p class="tasks-section-label" style="margin:0 2px 6px 6px;">${fr ? "Sauvegarde" : "Backup"}${what ? ` · ${esc(what)}` : ""}</p>
      <p class="muted" style="margin:0 6px 8px;font-size:11.5px;">${esc(long)}</p></div>`;
    return { parts: { cls: "hl", icon, long, short }, panelHtml, over: true };
  }
  // Téléchargement de mondes depuis le cloud (autre PC) : même présentation que la synchro.
  function downloadActivity() {
    const dj = data.djob;
    if (!dj || dj.done) return null;
    const fr = L() === "fr";
    const pct = dj.total ? Math.round((dj.got / dj.total) * 100) : 0;
    const installing = dj.items.find((i) => i.phase === "install");
    const lab = fr ? "Téléchargement des mondes" : "Downloading worlds";
    const long = installing ? `${lab} · ${fr ? `installation de la version de « ${installing.name} »` : `installing the version of “${installing.name}”`}` : `${lab} ${pct} %`;
    const rows = dj.items.map((i) => {
      const p = i.size ? Math.round((i.got / i.size) * 100) : 0;
      const meta = i.done ? (i.missed ? (fr ? `✓ Sur ce PC · ${i.missed} version${i.missed > 1 ? "s" : ""} pas venue${i.missed > 1 ? "s" : ""} (voir le journal)` : `✓ On this PC · ${i.missed} version${i.missed > 1 ? "s" : ""} missing (see the log)`) : fr ? `✓ Sur ce PC · ${i.versions} version${i.versions > 1 ? "s" : ""}` : `✓ On this PC · ${i.versions} version${i.versions > 1 ? "s" : ""}`)
        : i.error ? esc(i.error)
        : i.phase === "install" ? (fr ? "Installation de sa version et de son pack…" : "Installing its version and pack…")
        : i.got > 0 ? `${moFmt(i.got)} / ${moFmt(i.size)}` : fr ? `En attente · ${moFmt(i.size)}` : `Waiting · ${moFmt(i.size)}`;
      return `<div class="task-item"><div class="task-item-row"><div class="task-item-body"><div class="task-item-name">${esc(i.name)}</div><div class="task-item-meta">${meta}</div></div></div>
        ${i.done || i.error || i.phase === "install" ? "" : `<div class="task-progress-track"><div class="task-progress-fill" style="width:${p}%;"></div></div>`}</div>`;
    }).join("");
    const panelHtml = `<div class="play-cloud-task" style="padding:10px 10px 4px;border-bottom:1px solid var(--border);">
      <p class="tasks-section-label" style="margin:0 2px 6px 6px;">${lab} · ${pct} %</p>
      <div class="task-progress-track" style="margin:0 6px 6px;"><div class="task-progress-fill" style="width:${pct}%;"></div></div>
      <p class="muted" style="margin:0 6px 6px;font-size:11.5px;">${moFmt(dj.got)} / ${moFmt(dj.total)}</p>
      ${rows}</div>`;
    return { parts: { cls: "hl", icon: '<span class="activity-ring"></span>', long, short: `↓ ${pct} %` }, panelHtml };
  }
  function uploadActivity() {
    const job = data.job;
    if (!job || (job.done && !job.error)) return null;
    const fr = L() === "fr";
    const pct = job.total ? Math.round((job.sent / job.total) * 100) : 0;
    const left = job.bps > 0 ? (job.total - job.sent) / job.bps : NaN;
    const why = job.error
      ? (fr ? "erreur, nouvel essai bientôt" : "error, retrying soon")
      : job.paused === "game" ? (fr ? "en pause, jeu lancé" : "paused, game running") : job.paused ? (fr ? "en pause" : "paused") : "";
    const long = why ? (fr ? `Synchro cloud ${pct} % · ${why}` : `Cloud sync ${pct}% · ${why}`) : `${fr ? "Synchro cloud" : "Cloud sync"} ${pct} %${Number.isFinite(left) ? ` · ${etaFmt(left)}` : ""}`;
    const rows = job.items.map((i) => {
      const p = i.size ? Math.round((i.sent / i.size) * 100) : 0;
      const nm = `${i.name}${i.label ? ` · « ${i.label} »` : i.when ? ` · ${dateFmt(i.when)}` : ""}`;
      return `<div class="task-item"><div class="task-item-row"><div class="task-item-body"><div class="task-item-name">${esc(nm)}</div><div class="task-item-meta">${i.done ? (fr ? "✓ Dans le cloud" : "✓ In the cloud") : i.error ? esc(i.error) : i.sent > 0 ? `${moFmt(i.sent)} / ${moFmt(i.size)}` : fr ? `En attente · ${moFmt(i.size)}` : `Waiting · ${moFmt(i.size)}`}</div></div></div>
        ${i.done ? "" : `<div class="task-progress-track"><div class="task-progress-fill" style="width:${p}%;"></div></div>`}</div>`;
    }).join("");
    const panelHtml = `<div class="play-cloud-task" style="padding:10px 10px 4px;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:6px;margin:0 2px 6px 6px;"><p class="tasks-section-label" style="margin:0;flex:1;">${fr ? "Synchronisation avec le cloud" : "Cloud sync"} · ${pct} %</p>
        <button type="button" class="task-item-action" data-cloud-toggle title="${job.paused ? (fr ? "Reprendre" : "Resume") : "Pause"}">${job.paused ? TASK_RESUME_SVG : TASK_PAUSE_SVG}</button>
        <button type="button" class="link-btn" data-cloud-stop style="font-size:12px;color:var(--warn);">${fr ? "Arrêter" : "Stop"}</button></div>
      <div class="task-progress-track" style="margin:0 6px 6px;"><div class="task-progress-fill" style="width:${pct}%;${job.paused ? "background:var(--warn);" : ""}"></div></div>
      <p class="muted" style="margin:0 6px 6px;font-size:11.5px;">${moFmt(job.sent)} / ${moFmt(job.total)}${why ? ` · ${why}` : Number.isFinite(left) ? ` · ${fr ? `encore ~${etaFmt(left)}` : `~${etaFmt(left)} left`}` : ""}</p>
      ${data.closeWhenDone ? `<p class="muted" style="margin:0 6px 8px;font-size:11.5px;">${fr ? "Le launcher se fermera tout seul à la fin de l'envoi." : "The launcher will close on its own when sending is done."} <button type="button" class="link-btn" data-cloud-keepopen style="font-size:11.5px;">${fr ? "Garder ouvert" : "Keep open"}</button></p>` : ""}
      ${job.paused === "game" ? `<p class="muted" style="margin:0 6px 8px;font-size:11.5px;">${fr ? "L'envoi s'est mis en pause tout seul pendant la partie. Il reprend quand tu quittes le jeu." : "Sending paused on its own during the game. It resumes when you quit the game."}</p>` : ""}
      ${rows}</div>`;
    return {
      parts: { cls: "hl", icon: job.paused || job.error ? '<span class="status-dot" style="background:var(--warn)"></span>' : '<span class="activity-ring"></span>', long, short: `☁ ${pct} %` },
      panelHtml,
    };
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cloud-toggle]");
    if (!b) return;
    e.stopPropagation();
    if (data.job?.paused) api.cloud.resume();
    else api.cloud.pause();
  }, true);
  // « Arrêter » la synchro (retour de Rushi du 25/10) : ce qui est déjà parti reste en ligne.
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cloud-stop]");
    if (!b) return;
    e.stopPropagation();
    const fr = L() === "fr";
    const left = (data.job?.items || []).filter((i) => !i.done).length;
    const res = await showModal({
      title: fr ? "Arrêter la synchronisation ?" : "Stop syncing?",
      body: fr
        ? `L'envoi s'arrête tout de suite. Ce qui est déjà dans le cloud y reste, et rien n'est supprimé sur ton PC. ${left > 1 ? `Les ${left} sauvegardes pas encore envoyées repartiront` : "La sauvegarde pas encore envoyée repartira"} quand tu cliqueras sur Synchroniser.`
        : `Sending stops right away. What is already in the cloud stays there, and nothing is deleted on your PC. ${left > 1 ? `The ${left} backups not sent yet will go` : "The backup not sent yet will go"} when you click Sync.`,
      confirmLabel: fr ? "Arrêter" : "Stop",
      cancelLabel: fr ? "Continuer l'envoi" : "Keep sending",
      tone: "warn",
    });
    if (!res?.confirmed) return;
    data.closeWhenDone = false; // arrêter n'est pas « fini » : le launcher reste ouvert
    await api.cloud.stop();
    toast(fr ? "Synchronisation arrêtée. Ce qui est déjà en ligne y reste." : "Sync stopped. What is already online stays there.");
    loadCloud(true).then(() => !panel.hidden && render());
  }, true);

  // Fermer la fenêtre pendant un envoi : « Réduire » (continue en arrière-plan), « Fermer quand
  // même » (s'arrête, reprend au prochain démarrage depuis le dernier morceau envoyé) ou Annuler.
  document.addEventListener("click", (e) => {
    const downOn = data.djob && !data.djob.done;
    if (!e.target.closest("#win-close") || ((!data.job || data.job.done) && !downOn)) return;
    e.stopPropagation();
    e.preventDefault();
    const fr = L() === "fr";
    if (downOn) {
      // Téléchargement de mondes : « Réduire » (il continue), « Fermer quand même » (le monde en
      // cours est abandonné, ceux déjà arrivés restent ; rien n'est abîmé) ou Annuler.
      const pct = data.djob.total ? Math.round((data.djob.got / data.djob.total) * 100) : 0;
      const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cq-t" style="max-width:440px;text-align:left;">
        <h3 id="cq-t">${fr ? "Téléchargement en cours" : "Download in progress"} · ${pct} %</h3>
        <p style="margin:0 0 12px;">${fr ? "Tes mondes arrivent sur ce PC. Si tu réduis le launcher, le téléchargement continue en arrière-plan. Si tu le fermes, il s'arrête : les mondes déjà arrivés restent, les autres seront à télécharger à nouveau." : "Your worlds are coming to this PC. If you minimize the launcher, the download continues in the background. If you close it, it stops: worlds already here stay, the others will need downloading again."}</p>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          <button type="button" class="btn-secondary" data-q="cancel">${fr ? "Annuler" : "Cancel"}</button>
          <button type="button" class="btn-secondary" data-q="close">${fr ? "Fermer quand même" : "Close anyway"}</button>
          <button type="button" class="join-btn" data-q="min">${fr ? "Réduire" : "Minimize"}</button></div></div>`);
      m.$('[data-q="min"]').focus();
      m.ov.addEventListener("click", (ev) => {
        const q = ev.target.closest("[data-q]");
        if (!q) return;
        m.close();
        if (q.dataset.q === "min") window.mchub.windowControls.minimize();
        else if (q.dataset.q === "close") {
          data.djob = null;
          data.job = null;
          window.mchub.windowControls.close();
        }
      });
      return;
    }
    // Synchro : trois choix l'un sous l'autre, chacun avec ce qu'il fait (retour de Rushi du 25/10 :
    // pouvoir « fermer quand la synchro est finie »), plus Annuler en lien discret.
    const job = data.job;
    const pct = job.total ? Math.round((job.sent / job.total) * 100) : 0;
    const left = job.bps > 0 && !job.paused ? (job.total - job.sent) / job.bps : NaN;
    const eta = Number.isFinite(left) ? etaFmt(left) : "";
    const choice = (q, cls, label, sub) => `<button type="button" class="${cls}" data-q="${q}" style="display:block;width:100%;margin:0;text-align:left;padding:10px 14px;">
        <span style="display:block;font-weight:650;">${label}</span><span style="display:block;font-size:12px;opacity:.8;font-weight:400;margin-top:2px;">${sub}</span></button>`;
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cq-t" style="max-width:440px;text-align:left;">
      <h3 id="cq-t">${fr ? "Synchronisation en cours" : "Sync in progress"} · ${pct} %</h3>
      <p style="margin:0 0 14px;">${fr ? `Tes mondes sont en train de partir dans le cloud${eta ? ` (encore ~${eta})` : ""}.` : `Your worlds are being sent to the cloud${eta ? ` (~${eta} left)` : ""}.`}</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${choice("min", "join-btn", fr ? "Réduire" : "Minimize", fr ? "L'envoi continue, le launcher reste ouvert en arrière-plan." : "Sending continues, the launcher stays open in the background.")}
        ${choice("later", "btn-secondary", `${fr ? "Fermer quand c'est fini" : "Close when done"}${eta ? ` · ~${eta}` : ""}`, fr ? "Le launcher se réduit, puis se ferme tout seul à la fin de l'envoi." : "The launcher minimizes, then closes on its own when sending is done.")}
        ${choice("close", "btn-secondary", fr ? "Fermer maintenant" : "Close now", fr ? "L'envoi s'arrête. Il reprendra où il en était au prochain lancement." : "Sending stops. It will resume where it left off next time.")}
      </div>
      <div style="text-align:center;margin-top:10px;"><button type="button" class="link-btn" data-q="cancel" style="font-size:12.5px;">${fr ? "Annuler" : "Cancel"}</button></div></div>`);
    m.$('[data-q="min"]').focus();
    m.ov.addEventListener("click", (ev) => {
      const q = ev.target.closest("[data-q]");
      if (!q) return;
      m.close();
      if (q.dataset.q === "min") window.mchub.windowControls.minimize();
      else if (q.dataset.q === "later") {
        data.closeWhenDone = true;
        renderActivity();
        window.mchub.windowControls.minimize();
      } else if (q.dataset.q === "close") {
        data.job = null;
        window.mchub.windowControls.close();
      }
    });
  }, true);
  // « Garder ouvert » : annule la fermeture prévue à la fin de la synchro.
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-cloud-keepopen]")) return;
    data.closeWhenDone = false;
    renderActivity();
  }, true);

  // Premier chargement : le Laboratoire décide si l'onglet existe, puis tuile d'accueil et
  // reprise d'un envoi interrompu.
  // Droits lus pendant l'écran de chargement (renderer.js, boot) : appliqués avant que le menu
  // n'apparaisse ; ensuite, mises à jour seulement si l'état change.
  window.mchub.onFeaturesChanged?.((state) => applyFeatures(state));
  window.addEventListener("omniscient:features", (e) => applyFeatures(e.detail || {}));
  // Double-clic sur un .omnipack : même fenêtre que Importer › Un pack. Tant que le Laboratoire n'est
  // pas lu, le fichier attend ; fonction coupée pour ce joueur = rien ne s'ouvre.
  const openPackFile = (file) => {
    if (file && on("omniPack")) openCfPack({ zip: file, kind: "omni" });
  };
  api.packFile?.onOpen(openPackFile);
  window.addEventListener("omniscient:features", () => api.packFile?.take().then(openPackFile), { once: true });
  Promise.resolve(window.mchub.getFeatures?.())
    .then((state) => applyFeatures(state || {}))
    .catch(() => {});
})();
