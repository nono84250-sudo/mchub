const path = require("node:path");
const { app } = require("electron");
const { Client } = require("minecraft-launcher-core");

// Repertoire de jeu local : Java, Minecraft (vanilla) et ses assets sont
// telecharges ici au premier lancement, puis reutilises. Le launcher ne gere
// que le vanilla pour l'instant — CurseForge/Forge/Fabric viendront plus
// tard (voir cahier des charges, "launcher complet autonome").
const GAME_ROOT = path.join(app.getPath("userData"), "minecraft");

/**
 * Lance Minecraft (vanilla). `onProgress(status)` reçoit des mises à jour
 * lisibles pendant le téléchargement ; la promesse se résout dès que le
 * processus du jeu démarre (pas quand le joueur quitte le jeu).
 */
function launchMinecraft({ authorization, version, serverIp, onProgress }) {
  const launcher = new Client();

  // "debug"/"data" incluent la ligne de commande Java complète, qui contient
  // le jeton d'accès Minecraft en clair (--accessToken ...) — on les garde
  // seulement dans la console du processus principal (jamais transmis au
  // renderer via onProgress/IPC, qui les afficherait en clair à l'écran).
  launcher.on("debug", (e) => console.debug("[mcLaunch]", String(e)));
  launcher.on("data", (e) => console.debug("[mcLaunch]", String(e)));
  launcher.on("progress", (e) => {
    if (e && e.type && typeof e.task === "number" && typeof e.total === "number") {
      onProgress?.(`${e.type} : ${e.task}/${e.total}`);
    }
  });

  const opts = {
    authorization,
    root: GAME_ROOT,
    version: { number: version, type: "release" },
    memory: { max: "4G", min: "1G" },
  };

  if (serverIp) {
    const [host, port] = serverIp.split(":");
    opts.quickPlay = {
      type: "multiplayer",
      identifier: port ? `${host}:${port}` : host,
    };
  }

  return new Promise((resolve, reject) => {
    let started = false;
    launcher.on("close", (code) => {
      if (!started) reject(new Error(`Le jeu s'est fermé avant de démarrer (code ${code}).`));
    });
    onProgress?.("Lancement du jeu…");
    launcher
      .launch(opts)
      .then((proc) => {
        started = true;
        resolve(proc);
      })
      .catch(reject);
  });
}

module.exports = { launchMinecraft };
