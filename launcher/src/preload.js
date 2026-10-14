const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mchub", {
  getSiteUrl: () => ipcRenderer.invoke("app:getSiteUrl"),
  restartApp: () => ipcRenderer.invoke("app:restart"),
  // Parametres > Divers > A propos : "terms" ou "privacy" seulement (liste fixe cote main.js).
  openLegalPage: (page) => ipcRenderer.invoke("app:openLegal", page),
  checkMaintenance: () => ipcRenderer.invoke("maintenance:check"),
  verifyMaintenanceCode: (code) => ipcRenderer.invoke("maintenance:verifyCode", code),
  listServers: () => ipcRenderer.invoke("servers:list"),
  clearServerCache: () => ipcRenderer.invoke("servers:clearCache"),
  getServer: (slug) => ipcRenderer.invoke("servers:get", slug),
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
  openManageServer: (serverId) => ipcRenderer.invoke("servers:openManage", serverId),
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
    list: () => ipcRenderer.invoke("friends:list"),
    add: (minecraftUsername) => ipcRenderer.invoke("friends:add", minecraftUsername),
    accept: (friendUserId) => ipcRenderer.invoke("friends:accept", friendUserId),
    remove: (friendUserId) => ipcRenderer.invoke("friends:remove", friendUserId),
  },
  // Heartbeat de presence, greffe sur le meme cycle de 60s que silentRefreshList
  // (REFRESH_INTERVAL_MS/scheduleRefresh en bas de renderer.js) — jamais un intervalle a part.
  sendPresenceHeartbeat: () => ipcRenderer.invoke("presence:heartbeat"),
  submitReport: (report) => ipcRenderer.invoke("reports:submit", report),
  listNotifications: () => ipcRenderer.invoke("notifications:list"),
  markNotificationsRead: () => ipcRenderer.invoke("notifications:markRead"),
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
  onSelfTestProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("selftest:progress", listener);
    return () => ipcRenderer.removeListener("selftest:progress", listener);
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
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
  onGameState: (callback) => ipcRenderer.on("game:state", (_event, running) => callback(running)),
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
