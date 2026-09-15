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

  launcher.on("debug", (e) => onProgress?.(String(e)));
  launcher.on("data", (e) => onProgress?.(String(e)));
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
