const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mchub", {
  listServers: () => ipcRenderer.invoke("servers:list"),
  getServer: (slug) => ipcRenderer.invoke("servers:get", slug),
});
