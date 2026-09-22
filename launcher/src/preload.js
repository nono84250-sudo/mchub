const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mchub", {
  listServers: () => ipcRenderer.invoke("servers:list"),
  getServer: (slug) => ipcRenderer.invoke("servers:get", slug),
  signIn: (remember) => ipcRenderer.invoke("auth:signIn", remember),
  tryRestoreSession: () => ipcRenderer.invoke("auth:tryRestore"),
  signOut: () => ipcRenderer.invoke("auth:signOut"),
  playServer: (slug, memoryOverride) => ipcRenderer.invoke("game:launch", slug, memoryOverride),
  onGameProgress: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("game:progress", listener);
    return () => ipcRenderer.removeListener("game:progress", listener);
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
    openGameFolder: () => ipcRenderer.invoke("settings:openGameFolder"),
  },
  getMinecraftStatus: () => ipcRenderer.invoke("status:getMinecraftStatus"),
  account: {
    list: () => ipcRenderer.invoke("account:list"),
    switch: (id) => ipcRenderer.invoke("account:switch", id),
    remove: (id) => ipcRenderer.invoke("account:remove", id),
    changeSkin: (variant, fileBuffer) => ipcRenderer.invoke("account:changeSkin", { variant, fileBuffer }),
    resetSkin: () => ipcRenderer.invoke("account:resetSkin"),
  },
  java: {
    detect: () => ipcRenderer.invoke("java:detect"),
    install: () => ipcRenderer.invoke("java:install"),
  },
  onJavaInstallProgress: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("java:installProgress", listener);
    return () => ipcRenderer.removeListener("java:installProgress", listener);
  },
});
