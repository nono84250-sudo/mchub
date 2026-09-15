const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mchub", {
  listServers: () => ipcRenderer.invoke("servers:list"),
  getServer: (slug) => ipcRenderer.invoke("servers:get", slug),
  signIn: () => ipcRenderer.invoke("auth:signIn"),
  playServer: (slug) => ipcRenderer.invoke("game:launch", slug),
  onGameProgress: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("game:progress", listener);
    return () => ipcRenderer.removeListener("game:progress", listener);
  },
});
