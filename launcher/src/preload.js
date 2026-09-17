const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mchub", {
  listServers: () => ipcRenderer.invoke("servers:list"),
  getServer: (slug) => ipcRenderer.invoke("servers:get", slug),
  signIn: (remember) => ipcRenderer.invoke("auth:signIn", remember),
  tryRestoreSession: () => ipcRenderer.invoke("auth:tryRestore"),
  signOut: () => ipcRenderer.invoke("auth:signOut"),
  playServer: (slug) => ipcRenderer.invoke("game:launch", slug),
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
});
