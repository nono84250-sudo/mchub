const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mchub", {
  // Aide Discord dans les bugs (02/11) : rapport nettoyé, zip dans Téléchargements, lien du Discord.
  bugHelp: {
    text: (lang) => ipcRenderer.invoke("bugHelp:text", lang),
    zip: (lang) => ipcRenderer.invoke("bugHelp:zip", lang),
    discord: () => ipcRenderer.invoke("bugHelp:discord"),
  },
  // Catalogue de bugs (31/10) : fiche reconnue, réparation proposée, compteurs.
  bugs: {
    onFound: (callback) => {
      const listener = (_event, found) => callback(found);
      ipcRenderer.on("bugs:found", listener);
      return () => ipcRenderer.removeListener("bugs:found", listener);
    },
    signal: (code) => ipcRenderer.invoke("bugs:signal", code),
    refused: (slug) => ipcRenderer.invoke("bugs:refused", slug),
    openPage: (slug) => ipcRenderer.invoke("bugs:openPage", slug),
    repair: async (slug, versionId, onStep) => {
      const listener = (_event, step) => onStep?.(step);
      ipcRenderer.on("bugs:repairStep", listener);
      try {
        return await ipcRenderer.invoke("bugs:repair", slug, versionId);
      } finally {
        ipcRenderer.removeListener("bugs:repairStep", listener);
      }
    },
  },
  getSiteUrl: () => ipcRenderer.invoke("app:getSiteUrl"),
  // Laboratoire (25/10) : { <id>: { visible, beta } } d'après le site, voir features.js.
  getFeatures: () => ipcRenderer.invoke("features:get"),
  featuresReady: () => ipcRenderer.invoke("features:ready"),
  onFeaturesChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("features:changed", listener);
    return () => ipcRenderer.removeListener("features:changed", listener);
  },
  // Idee 3 du lancement (19/10) : erreur de l'interface vers Sentry (voir errorReports.js).
  reportError: (info) => ipcRenderer.invoke("app:reportError", info).catch(() => {}),
  restartApp: () => ipcRenderer.invoke("app:restart"),
  // Parametres > Divers > A propos : "terms" ou "privacy" seulement (liste fixe cote main.js).
  openLegalPage: (page) => ipcRenderer.invoke("app:openLegal", page),
  // `opts.background` (listes, notifications, maintenance, amis) : appel de fond, mis en pause
  // par main.js quand le site est sature (voir siteBusyUntil).
  checkMaintenance: (opts) => ipcRenderer.invoke("maintenance:check", opts),
  verifyMaintenanceCode: (code) => ipcRenderer.invoke("maintenance:verifyCode", code),
  listServers: (opts) => ipcRenderer.invoke("servers:list", opts),
  clearServerCache: () => ipcRenderer.invoke("servers:clearCache"),
  getServer: (slug) => ipcRenderer.invoke("servers:get", slug),
  getFeaturedServer: () => ipcRenderer.invoke("servers:featured"),
  // Fiche personnalisable (16/10) : reseaux et video, re-verifies cote main.js avant ouverture.
  openServerPageLink: (kind, value) => ipcRenderer.invoke("servers:openPageLink", kind, value),
  // Teams (19/10) : page de team ou « C'est mon serveur » (Contact) sur le site.
  openTeamLink: (kind, slug) => ipcRenderer.invoke("site:openTeamLink", kind, slug),
  // Liens omniscient:// du site (bouton « Ouvrir dans le launcher ») : celui recu avant que la
  // page soit prete, puis les suivants au fil de l'eau. Voir parseServerLink cote main.js.
  takeServerLink: () => ipcRenderer.invoke("app:takeServerLink"),
  onServerLink: (callback) => ipcRenderer.on("app:serverLink", (_event, link) => callback(link)),
  // Bouton "Installer" d'une fiche (2026-10-11) : pour savoir s'il faut encore
  // l'afficher pour CE serveur precis — voir servers:installStatus.
  getServerInstallStatus: (slug) => ipcRenderer.invoke("servers:installStatus", slug),
  listMyServers: () => ipcRenderer.invoke("servers:mine"),
  // Pas de session Microsoft (2026-10-12, jouer en solo hors ligne) : liste les instances
  // deja installees sur CET ordinateur en lisant juste le disque — voir instances:listInstalled.
  listLocalInstances: () => ipcRenderer.invoke("instances:listInstalled"),
  listJoinedServers: () => ipcRenderer.invoke("servers:listJoined"),
  joinServerByCode: (code) => ipcRenderer.invoke("servers:joinByCode", code),
  leaveJoinedServer: (slug) => ipcRenderer.invoke("servers:leaveJoined", slug),
  openManageServer: (serverId, section) => ipcRenderer.invoke("servers:openManage", serverId, section),
  // Petite fenetre "Reglages" d'une instance (Mes instances, 2026-10-13) : canal du modpack
  // (release/beta), distincte de openManageServer ci-dessus qui continue d'ouvrir le site.
  getServerChannel: (slug) => ipcRenderer.invoke("servers:getChannel", slug),
  setServerChannel: (slug, modpackChannel) => ipcRenderer.invoke("servers:setChannel", { slug, modpackChannel }),
  // Case "Me prevenir du changement de statut de cette instance" (point 9, 2026-10-14) :
  // distincte de getServerChannel/setServerChannel ci-dessus, s'applique a toute instance
  // (possedee ou rejointe), pas seulement les serveurs moddes.
  getServerWatch: (slug) => ipcRenderer.invoke("servers:getWatch", slug),
  setServerWatch: (slug, notifyOnStatusChange) => ipcRenderer.invoke("servers:setWatch", { slug, notifyOnStatusChange }),
  // Systeme d'amis, phase 1 (2026-10-14) : panneau "Amis" de la sidebar (voir nav-friends dans
  // index.html/wireFriends dans renderer.js). Statut en ligne/hors ligne calcule cote site a
  // partir du heartbeat ci-dessous, jamais d'un ping reseau serveur (pas fiable pour ca, voir
  // le rapport).
  friends: {
    list: (opts) => ipcRenderer.invoke("friends:list", opts),
    add: (minecraftUsername) => ipcRenderer.invoke("friends:add", minecraftUsername),
    accept: (friendUserId) => ipcRenderer.invoke("friends:accept", friendUserId),
    remove: (friendUserId) => ipcRenderer.invoke("friends:remove", friendUserId),
    getSettings: () => ipcRenderer.invoke("friends:getSettings"),
    setPolicy: (policy) => ipcRenderer.invoke("friends:setPolicy", policy),
    newCode: () => ipcRenderer.invoke("friends:newCode"),
  },
  // Heartbeat de presence, greffe sur le meme cycle de 60s que silentRefreshList
  // (REFRESH_INTERVAL_MS/scheduleRefresh en bas de renderer.js) — jamais un intervalle a part.
  sendPresenceHeartbeat: (opts) => ipcRenderer.invoke("presence:heartbeat", opts),
  submitReport: (report) => ipcRenderer.invoke("reports:submit", report),
  reportInstallProblem: (payload) => ipcRenderer.invoke("servers:reportInstallProblem", payload),
  listNotifications: (opts) => ipcRenderer.invoke("notifications:list", opts),
  // Sans id : tout marquer comme lu ; avec un id : seulement ce message (centre de notifications).
  markNotificationsRead: (id) => ipcRenderer.invoke("notifications:markRead", id),
  getNews: (id) => ipcRenderer.invoke("news:get", id),
  deleteNotification: (id) => ipcRenderer.invoke("notifications:delete", id),
  clearReadNotifications: () => ipcRenderer.invoke("notifications:clearRead"),
  signIn: (remember) => ipcRenderer.invoke("auth:signIn", remember),
  tryRestoreSession: () => ipcRenderer.invoke("auth:tryRestore"),
  signOut: () => ipcRenderer.invoke("auth:signOut"),
  playServer: (slug, memoryOverride) => ipcRenderer.invoke("game:launch", slug, memoryOverride),
  // Solo hors ligne (2026-10-12) : aucune session Microsoft requise, aucun appel au site ni au
  // serveur distant — voir game:launchOffline cote main.js.
  playOfflineServer: (slug, memoryOverride) => ipcRenderer.invoke("game:launchOffline", slug, memoryOverride),
  onGameProgress: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("game:progress", listener);
    return () => ipcRenderer.removeListener("game:progress", listener);
  },
  // Bouton "Installer" (2026-10-11) : telecharge le modpack/Java sans lancer
  // le jeu, donc sans demander de connexion Microsoft — voir server:install.
  // La progression ne remonte plus par un canal dedie : elle passe par le
  // meme panneau de taches que "Rejoindre" (tasks:*, ci-dessous).
  installServer: (slug, name) => ipcRenderer.invoke("server:install", slug, name),
  // Mon cloud (03/11) : modpack relié au serveur par son propriétaire, et choix du joueur pour un
  // modpack « Conseillé ».
  getCloudPack: (slug) => ipcRenderer.invoke("cloudPack:get", slug),
  setCloudPackOptIn: (slug, on) => ipcRenderer.invoke("cloudPack:setOptIn", slug, on === null ? null : Boolean(on)),
  chooseCloudPack: (slug, withPack, remember) => ipcRenderer.invoke("cloudPack:choose", slug, Boolean(withPack), Boolean(remember)),
  // Mods qu'un modpack CurseForge interdit de telecharger (14/10) : page du mod sur CurseForge
  // (adresse verifiee cote main.js) et dossier Telechargements ou le joueur les depose.
  openModPage: (pageUrl) => ipcRenderer.invoke("modpack:openModPage", pageUrl),
  openDownloadsFolder: () => ipcRenderer.invoke("modpack:openDownloads"),
  // Panneau de taches (2026-10-11, façon Modrinth) : un seul flux d'etat pour
  // tous les telechargements/installations en cours, qu'ils viennent du
  // bouton "Installer" ou de "Rejoindre".
  tasks: {
    list: () => ipcRenderer.invoke("tasks:list"),
    pause: (id) => ipcRenderer.invoke("tasks:pause", id),
    resume: (id) => ipcRenderer.invoke("tasks:resume", id),
    cancel: (id) => ipcRenderer.invoke("tasks:cancel", id),
    moveFirst: (id) => ipcRenderer.invoke("tasks:moveFirst", id),
    clearCompleted: () => ipcRenderer.invoke("tasks:clearCompleted"),
  },
  onTasksUpdate: (callback) => {
    const listener = (_event, tasks) => callback(tasks);
    ipcRenderer.on("tasks:update", listener);
    return () => ipcRenderer.removeListener("tasks:update", listener);
  },
  runSelfTest: (slug) => ipcRenderer.invoke("selftest:run", slug),
  abortSelfTest: () => ipcRenderer.invoke("selftest:abort"),
  reportSelfTest: (payload) => ipcRenderer.invoke("selftest:report", payload),
  // Lot 5 : aide guidee pour le proprietaire pendant le test (mods a ajouter a la main).
  onSelfTestManualMods: (callback) => {
    const listener = (_event, fields) => callback(fields);
    ipcRenderer.on("selftest:manualMods", listener);
    return () => ipcRenderer.removeListener("selftest:manualMods", listener);
  },
  answerSelfTestManualMods: (answer) => ipcRenderer.invoke("selftest:manualModsAnswer", answer),
  onSelfTestProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("selftest:progress", listener);
    return () => ipcRenderer.removeListener("selftest:progress", listener);
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    focus: () => ipcRenderer.invoke("window:focus"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggleMaximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    expandFromBootstrap: () => ipcRenderer.invoke("window:expandFromBootstrap"),
    onMaximizedChange: (callback) => {
      const listener = (_event, isMaximized) => callback(isMaximized);
      ipcRenderer.on("window:maximized-changed", listener);
      return () => ipcRenderer.removeListener("window:maximized-changed", listener);
    },
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (partial) => ipcRenderer.invoke("settings:set", partial),
    reset: () => ipcRenderer.invoke("settings:reset"),
    openGameFolder: () => ipcRenderer.invoke("settings:openGameFolder"),
  },
  getServicesStatus: (force) => ipcRenderer.invoke("status:getServicesStatus", !!force),
  getConnection: (force) => ipcRenderer.invoke("status:getConnection", !!force),
  onConnectionProgress: (callback) => ipcRenderer.on("status:connectionProgress", (_event, progress) => callback(progress)),
  onGameState: (callback) => ipcRenderer.on("game:state", (_event, running, exitCode) => callback(running, exitCode)),
  diskFree: () => ipcRenderer.invoke("system:diskFree"),
  findModsInDownloads: (fileNames) => ipcRenderer.invoke("modpack:findInDownloads", fileNames),
  // Menu « ⋯ » des cartes d'instance + « Arrêter le jeu » (16/10) — voir main.js.
  getGameStatus: () => ipcRenderer.invoke("game:status"),
  stopGame: () => ipcRenderer.invoke("game:stop"),
  // Dossier des jeux sur un autre disque (serie 2, idee 9).
  games: {
    info: () => ipcRenderer.invoke("games:info"),
    size: (options) => ipcRenderer.invoke("games:size", options),
    drives: () => ipcRenderer.invoke("games:drives"),
    move: (options) => ipcRenderer.invoke("games:move", options),
    cancelMove: () => ipcRenderer.invoke("games:cancelMove"),
    abandonInterrupted: () => ipcRenderer.invoke("games:abandonInterrupted"),
    restart: () => ipcRenderer.invoke("games:restart"),
    ackMoved: () => ipcRenderer.invoke("games:ackMoved"),
    openFolder: () => ipcRenderer.invoke("games:openFolder"),
    onProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("games:moveProgress", listener);
      return () => ipcRenderer.removeListener("games:moveProgress", listener);
    },
  },
  instances: {
    openFolder: (slug) => ipcRenderer.invoke("instances:openFolder", slug),
    readLog: (slug) => ipcRenderer.invoke("instances:readLog", slug),
    openLogsFolder: (slug) => ipcRenderer.invoke("instances:openLogsFolder", slug),
    filesInfo: (slug) => ipcRenderer.invoke("instances:filesInfo", slug),
    sizes: (slugs) => ipcRenderer.invoke("instances:sizes", slugs),
    deleteFiles: (slug, options) => ipcRenderer.invoke("instances:deleteFiles", slug, options),
    trashFiles: (slugs, options) => ipcRenderer.invoke("instances:trashFiles", slugs, options),
    undoTrash: (batch) => ipcRenderer.invoke("instances:undoTrash", batch),
    finalizeTrash: (batch) => ipcRenderer.invoke("instances:finalizeTrash", batch),
  },
  updates: {
    check: () => ipcRenderer.invoke("update:check"),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("update:status", listener);
      return () => ipcRenderer.removeListener("update:status", listener);
    },
  },
  account: {
    list: () => ipcRenderer.invoke("account:list"),
    switch: (id) => ipcRenderer.invoke("account:switch", id),
    remove: (id) => ipcRenderer.invoke("account:remove", id),
    changeSkin: (variant, fileBuffer) => ipcRenderer.invoke("account:changeSkin", { variant, fileBuffer }),
    resetSkin: () => ipcRenderer.invoke("account:resetSkin"),
  },
  // Mode « Jouer » (bêta, 24/10) : versions sans serveur, mondes et leurs sauvegardes (playMode.js),
  // synchro des mondes avec le cloud pour les Supporters (worldCloud.js).
  play: {
    packs: (opts) => ipcRenderer.invoke("play:packs", opts),
    // Mon cloud (03/11) : « Envoyer dans le cloud » depuis le menu ⚙ d'une installation.
    cloudUpload: (id, opts) => ipcRenderer.invoke("cloudPack:upload", String(id), opts && typeof opts === "object" ? opts : {}),
    cloudPlan: (id) => ipcRenderer.invoke("cloudPack:plan", String(id)),
    onCloudProgress: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("cloudPack:progress", listener);
      return () => ipcRenderer.removeListener("cloudPack:progress", listener);
    },
    mcVersions: () => ipcRenderer.invoke("play:mcVersions"),
    listVersions: () => ipcRenderer.invoke("play:listVersions"),
    createVersion: (opts) => ipcRenderer.invoke("play:createVersion", opts),
    renameVersion: (id, name) => ipcRenderer.invoke("play:renameVersion", id, name),
    removeVersion: (id, worlds) => ipcRenderer.invoke("play:removeVersion", id, Array.isArray(worlds) ? worlds : []),
    launch: (opts) => ipcRenderer.invoke("play:launch", opts),
    // RAM par pack (01/11, Laboratoire « packRam »).
    ram: {
      info: (id) => ipcRenderer.invoke("play:ram:info", id),
      set: (id, ram) => ipcRenderer.invoke("play:ram:set", id, ram),
      list: () => ipcRenderer.invoke("play:ram:list"),
    },
    listWorlds: () => ipcRenderer.invoke("play:listWorlds"),
    setWorldBackup: (key, on, opts) => ipcRenderer.invoke("play:setWorldBackup", key, on, opts),
    listBackups: (key) => ipcRenderer.invoke("play:listBackups", key),
    setBackupLimit: (key, cfg) => ipcRenderer.invoke("play:setBackupLimit", key, cfg),
    testOverlay: () => ipcRenderer.invoke("play:testOverlay"),
    backupNow: (key, label) => ipcRenderer.invoke("play:backupNow", key, label),
    restoreBackup: (key, backupId) => ipcRenderer.invoke("play:restoreBackup", key, backupId),
    updateCheck: (id, mc) => ipcRenderer.invoke("play:updateCheck", id, mc),
    updateVersion: (id, opts) => ipcRenderer.invoke("play:updateVersion", id, opts),
    onUpdateStep: (cb) => {
      const fn = (_e, st) => cb(st);
      ipcRenderer.on("play:updateStep", fn);
      return () => ipcRenderer.removeListener("play:updateStep", fn);
    },
    deleteBackup: (key, backupId) => ipcRenderer.invoke("play:deleteBackup", key, backupId),
    scanImport: (dir) => ipcRenderer.invoke("play:scanImport", dir),
    pickImportDir: () => ipcRenderer.invoke("play:pickImportDir"),
    importWorlds: async (dir, folders, onStep) => {
      const listener = (_event, step) => onStep?.(step);
      ipcRenderer.on("play:importProgress", listener);
      try {
        return await ipcRenderer.invoke("play:import", dir, folders);
      } finally {
        ipcRenderer.removeListener("play:importProgress", listener);
      }
    },
    openWorldFolder: (key) => ipcRenderer.invoke("play:openWorldFolder", key),
    copyWorld: (key, opts) => ipcRenderer.invoke("play:copyWorld", key, opts),
    deleteWorldForever: (key, opts) => ipcRenderer.invoke("play:deleteWorldForever", key, opts),
    // Aide au crash (26/10) : ce que le launcher a reconnu à la fermeture du jeu.
    crashLogs: () => ipcRenderer.invoke("play:crashLogs"),
    openCrashFolder: () => ipcRenderer.invoke("play:openCrashFolder"),
    // Data packs en attente posés dans le premier monde d'une installation (28/10).
    onDpApplied: (callback) => {
      const listener = (_event, list) => callback(list);
      ipcRenderer.on("play:dpApplied", listener);
      return () => ipcRenderer.removeListener("play:dpApplied", listener);
    },
    onCrashHelp: (callback) => {
      const listener = (_event, info) => callback(info);
      ipcRenderer.on("play:crashHelp", listener);
      return () => ipcRenderer.removeListener("play:crashHelp", listener);
    },
    // Mon pack (26/10) : mods Modrinth + liste CurseForge téléchargée à la main par le joueur.
    myPack: {
      get: (id, opts) => ipcRenderer.invoke("myPack:get", id, opts),
      create: (o) => ipcRenderer.invoke("myPack:create", o),
      loaderOk: (loader, mc) => ipcRenderer.invoke("myPack:loaderOk", loader, mc),
      add: (id, mods) => ipcRenderer.invoke("myPack:add", id, mods),
      setMod: (id, modId, patch) => ipcRenderer.invoke("myPack:setMod", id, modId, patch),
      fix: (id, problem) => ipcRenderer.invoke("myPack:fix", id, problem),
      addJar: (id, opts) => ipcRenderer.invoke("myPack:addJar", id, opts),
      searchModrinth: (q, opts) => ipcRenderer.invoke("myPack:searchModrinth", q, opts),
      searchCurseForge: (q, opts) => ipcRenderer.invoke("myPack:searchCurseForge", q, opts),
      scanWorld: (key) => ipcRenderer.invoke("myPack:scanWorld", key),
      openCurseForge: (arg) => ipcRenderer.invoke("myPack:openCurseForge", arg),
      // « Corriger le pack » (30/10) : bon fichier CurseForge, versions d'un mod, mauvais fichier téléchargé.
      cfTarget: (id, problem) => ipcRenderer.invoke("myPack:cfTarget", id, problem),
      cfFiles: (id, modId) => ipcRenderer.invoke("myPack:cfFiles", id, modId),
      onCfWrong: (callback) => {
        const listener = (_event, w) => callback(w);
        ipcRenderer.on("myPack:cfWrong", listener);
        return () => ipcRenderer.removeListener("myPack:cfWrong", listener);
      },
      setResourcePack: (id, file, on) => ipcRenderer.invoke("myPack:setResourcePack", id, file, on),
      setShader: (id, file) => ipcRenderer.invoke("myPack:setShader", id, file),
      openFolder: (id, sub) => ipcRenderer.invoke("myPack:openFolder", id, sub),
      // Page d'une version (27/10) : retirer, ajouter (Modrinth ou fichier), data packs, maps, fichiers.
      remove: (id, item) => ipcRenderer.invoke("myPack:remove", id, item),
      // 28/10 : `opts.src` = "cf" pour CurseForge (fenêtre « Ajouter » commune).
      searchContent: (id, kind, q, opts) => ipcRenderer.invoke("myPack:searchContent", id, kind, q, opts),
      addContent: (id, o) => ipcRenderer.invoke("myPack:addContent", id, o),
      openCurseForgePage: (o) => ipcRenderer.invoke("myPack:openCurseForgePage", o),
      watchCfContent: (id, o) => ipcRenderer.invoke("myPack:watchCfContent", id, o),
      addShaderLoader: (id, which) => ipcRenderer.invoke("myPack:addShaderLoader", id, which),
      searchDatapacks: (id, q) => ipcRenderer.invoke("myPack:searchDatapacks", id, q),
      addDatapack: (id, o) => ipcRenderer.invoke("myPack:addDatapack", id, o),
      setDatapack: (id, file, o) => ipcRenderer.invoke("myPack:setDatapack", id, file, o),
      openMapsPage: (mc) => ipcRenderer.invoke("myPack:openMapsPage", mc),
      importMap: (id) => ipcRenderer.invoke("myPack:importMap", id),
      addMap: (id, o) => ipcRenderer.invoke("myPack:addMap", id, o),
      // Basculer une installation vanilla en version modée (28/10).
      loaderOptions: (id, need) => ipcRenderer.invoke("myPack:loaderOptions", id, need),
      switchToModded: (id, o) => ipcRenderer.invoke("myPack:switchToModded", id, o),
      files: {
        list: (id, rel) => ipcRenderer.invoke("myPack:filesList", id, rel),
        read: (id, rel) => ipcRenderer.invoke("myPack:filesRead", id, rel),
        write: (id, rel, text) => ipcRenderer.invoke("myPack:filesWrite", id, rel, text),
        rename: (id, rel, name) => ipcRenderer.invoke("myPack:filesRename", id, rel, name),
        mkdir: (id, rel) => ipcRenderer.invoke("myPack:filesMkdir", id, rel),
        trash: (id, rel) => ipcRenderer.invoke("myPack:filesTrash", id, rel),
        openExternal: (id, rel) => ipcRenderer.invoke("myPack:filesOpenExternal", id, rel),
        showInExplorer: (id, rel) => ipcRenderer.invoke("myPack:filesShow", id, rel),
      },
    },
    // Pack Omniscient (27/10) : générer pour d'autres versions, exporter (.omnipack, .mrpack ami).
    // Nouveaux menus d'ajout (31/10, Laboratoire « addMenus »).
    addMenu: {
      search: (o) => ipcRenderer.invoke("addMenu:search", o),
      sheet: (o) => ipcRenderer.invoke("addMenu:sheet", o),
      copyCheck: (id, o) => ipcRenderer.invoke("addMenu:copyCheck", id, o),
      openLink: (u) => ipcRenderer.invoke("addMenu:openLink", u),
    },
    omniPack: {
      targets: (id) => ipcRenderer.invoke("omniPack:targets", id),
      job: () => ipcRenderer.invoke("omniPack:job"),
      generate: (id, o) => ipcRenderer.invoke("omniPack:generate", id, o),
      stop: () => ipcRenderer.invoke("omniPack:stop"),
      clearJob: () => ipcRenderer.invoke("omniPack:clearJob"),
      exportPreview: (id) => ipcRenderer.invoke("omniPack:exportPreview", id),
      exportOmni: (id, o) => ipcRenderer.invoke("omniPack:export", id, o),
      exportFriend: (id, o) => ipcRenderer.invoke("omniPack:exportFriend", id, o),
      friendPlan: (id) => ipcRenderer.invoke("omniPack:friendPlan", id),
      onJob: (callback) => {
        const listener = (_event, job) => callback(job);
        ipcRenderer.on("omniPack:job", listener);
        return () => ipcRenderer.removeListener("omniPack:job", listener);
      },
    },
    // « Un pack existant » (28/10, Laboratoire « packBrowse »).
    packBrowse: {
      sources: () => ipcRenderer.invoke("packBrowse:sources"),
      search: (src, q, opts) => ipcRenderer.invoke("packBrowse:search", src, q, opts),
      versions: (src, id) => ipcRenderer.invoke("packBrowse:versions", src, id),
      prepare: async (src, id, versionId, extra, onProgress) => {
        const listener = (_event, step) => onProgress?.(step);
        ipcRenderer.on("packBrowse:progress", listener);
        try {
          return await ipcRenderer.invoke("packBrowse:prepare", src, id, versionId, extra);
        } finally {
          ipcRenderer.removeListener("packBrowse:progress", listener);
        }
      },
      openPage: (url) => ipcRenderer.invoke("packBrowse:openPage", url),
    },
    // « Reprendre » les fichiers à télécharger à la main d'une installation (04/11).
    handFiles: {
      open: (versionId, fileId) => ipcRenderer.invoke("play:handFiles:open", versionId, fileId),
    },
    // Importer un export CurseForge (.zip) avec ses mondes (26/10).
    cfPack: {
      pickZip: (kind) => ipcRenderer.invoke("cfPack:pickZip", kind === "mr" || kind === "omni" ? kind : "cf"),
      read: (src) => ipcRenderer.invoke("cfPack:read", src),
      install: async (id, opts, onStep) => {
        const listener = (_event, step) => step?.id === id && onStep?.(step);
        ipcRenderer.on("cfPack:progress", listener);
        try {
          return await ipcRenderer.invoke("cfPack:install", id, opts);
        } finally {
          ipcRenderer.removeListener("cfPack:progress", listener);
        }
      },
      openManual: (item) => ipcRenderer.invoke("cfPack:openManual", item),
    },
    onWorldsChanged: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("play:worldsChanged", listener);
      return () => ipcRenderer.removeListener("play:worldsChanged", listener);
    },
    // « Tester dans le launcher » (31/10) : fenêtre d'installation d'un pack proposé (main.js, installTestPack).
    packFile: {
      take: () => ipcRenderer.invoke("app:takePackFile"),
      onOpen: (callback) => {
        const listener = (_event, file) => callback(file);
        ipcRenderer.on("app:packFile", listener);
        return () => ipcRenderer.removeListener("app:packFile", listener);
      },
    },
    testPack: {
      onEvent: (callback) => {
        const listener = (_event, ev) => callback(ev);
        ipcRenderer.on("testPack:event", listener);
        return () => ipcRenderer.removeListener("testPack:event", listener);
      },
      answer: (yes) => ipcRenderer.invoke("testPack:answer", !!yes),
    },
    onSaveActivity: (callback) => {
      const listener = (_event, activity) => callback(activity);
      ipcRenderer.on("play:saveActivity", listener);
      return () => ipcRenderer.removeListener("play:saveActivity", listener);
    },
    cloud: {
      status: (opts) => ipcRenderer.invoke("cloud:status", opts),
      testConnection: () => ipcRenderer.invoke("cloud:testConnection"),
      sync: (keys) => ipcRenderer.invoke("cloud:sync", keys),
      remove: (key) => ipcRenderer.invoke("cloud:remove", key),
      pause: () => ipcRenderer.invoke("cloud:pause"),
      resume: () => ipcRenderer.invoke("cloud:resume"),
      stop: () => ipcRenderer.invoke("cloud:stop"),
      sendBackup: (key, backupId) => ipcRenderer.invoke("cloud:sendBackup", key, backupId),
      uncloudBackup: (key, backupId) => ipcRenderer.invoke("cloud:uncloudBackup", key, backupId),
      download: (worldId) => ipcRenderer.invoke("cloud:download", worldId),
      // Plusieurs PC : avant « Jouer », conflits, choix entre deux versions, téléchargements.
      beforePlay: (key, opts) => ipcRenderer.invoke("cloud:beforePlay", key, opts),
      fetchLatest: (key) => ipcRenderer.invoke("cloud:fetchLatest", key),
      waitClosed: (key) => ipcRenderer.invoke("cloud:waitClosed", key),
      cancelWait: (key) => ipcRenderer.invoke("cloud:cancelWait", key),
      resolveSplit: (key, versionId) => ipcRenderer.invoke("cloud:resolveSplit", key, versionId),
      downloadMany: (ids) => ipcRenderer.invoke("cloud:downloadMany", ids),
      downloadJob: () => ipcRenderer.invoke("cloud:downloadJob"),
      onDownloadUpdate: (callback) => {
        const listener = (_event, djob) => callback(djob);
        ipcRenderer.on("cloud:downloadUpdate", listener);
        return () => ipcRenderer.removeListener("cloud:downloadUpdate", listener);
      },
      onWaitDone: (callback) => {
        const listener = (_event, result) => callback(result);
        ipcRenderer.on("cloud:waitDone", listener);
        return () => ipcRenderer.removeListener("cloud:waitDone", listener);
      },
      onUpdate: (callback) => {
        const listener = (_event, job) => callback(job);
        ipcRenderer.on("cloud:update", listener);
        return () => ipcRenderer.removeListener("cloud:update", listener);
      },
    },
  },
  java: {
    detect: () => ipcRenderer.invoke("java:detect"),
    install: (majors) => ipcRenderer.invoke("java:install", majors),
    repair: () => ipcRenderer.invoke("java:repair"),
  },
  onJavaInstallProgress: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("java:installProgress", listener);
    return () => ipcRenderer.removeListener("java:installProgress", listener);
  },
  logs: {
    getAll: () => ipcRenderer.invoke("logs:getAll"),
    clear: () => ipcRenderer.invoke("logs:clear"),
    openConsole: () => ipcRenderer.invoke("logs:openConsole"),
    openLogsFolder: () => ipcRenderer.invoke("logs:openLogsFolder"),
    copyLatest: () => ipcRenderer.invoke("logs:copyLatest"),
    onEntry: (callback) => {
      const listener = (_event, entry) => callback(entry);
      ipcRenderer.on("logs:entry", listener);
      return () => ipcRenderer.removeListener("logs:entry", listener);
    },
  },
  diagnostics: {
    getSystemInfo: () => ipcRenderer.invoke("diagnostics:getSystemInfo"),
    getCacheSizeBytes: () => ipcRenderer.invoke("diagnostics:getCacheSizeBytes"),
    repair: () => ipcRenderer.invoke("diagnostics:repair"),
    clearCache: () => ipcRenderer.invoke("diagnostics:clearCache"),
    exportReport: () => ipcRenderer.invoke("diagnostics:exportReport"),
  },
});
