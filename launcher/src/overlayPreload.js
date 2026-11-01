// Petit menu de sauvegarde par-dessus le jeu (mode Jouer, 24/10, voir saveOverlay.js).
// Deux choses seulement : recevoir ce qu'il faut afficher, renvoyer le nom tapé (ou l'annulation).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("omniOverlay", {
  onState: (callback) => ipcRenderer.on("overlay:state", (_event, state) => callback(state)),
  answer: (value) => ipcRenderer.send("overlay:answer", typeof value === "string" ? value.slice(0, 80) : null),
});
