const path = require("node:path");
const { spawn } = require("node:child_process");
const { app } = require("electron");
const { Client } = require("minecraft-launcher-core");

// Repertoire de jeu local : Java, Minecraft (vanilla) et ses assets sont
// telecharges ici au premier lancement, puis reutilises. Le launcher ne gere
// que le vanilla pour l'instant — CurseForge/Forge/Fabric viendront plus
// tard (voir cahier des charges, "launcher complet autonome").
const GAME_ROOT = path.join(app.getPath("userData"), "minecraft");

// minecraft-launcher-core spawn Java lui-meme sans jamais ecouter l'evenement
// "error" du processus — si "java" est introuvable (ENOENT), Node le relance
// comme exception non interceptee et plante tout le processus principal.
// On verifie donc nous-memes, AVANT d'appeler MCLC, avec notre propre
// ecouteur d'erreur.
function ensureJavaAvailable(javaPath) {
  return new Promise((resolve, reject) => {
    const check = spawn(javaPath || "java", ["-version"]);
    check.on("error", () => {
      reject(new Error("Java est introuvable — installe Java pour pouvoir lancer Minecraft."));
    });
    check.on("exit", () => resolve());
  });
}

/**
 * Lance Minecraft (vanilla). `onProgress(status)` reçoit des mises à jour
 * lisibles pendant le téléchargement ; la promesse se résout dès que le
 * processus du jeu démarre (pas quand le joueur quitte le jeu).
 */
async function launchMinecraft({ authorization, version, serverIp, onProgress, memory, javaPath }) {
  await ensureJavaAvailable(javaPath);

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
    memory: memory || { max: "4G", min: "1G" },
  };
  if (javaPath) opts.javaPath = javaPath;

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
        if (!proc) {
          // minecraft-launcher-core avale certaines erreurs internes
          // (echec reseau pendant le telechargement, manifeste corrompu...)
          // et resout avec `null` au lieu de rejeter — sans ce controle on
          // annoncerait un lancement reussi alors que rien n'a demarre.
          reject(new Error("Le lancement du jeu a échoué (voir les journaux pour le détail)."));
          return;
        }
        started = true;
        resolve(proc);
      })
      .catch(reject);
  });
}

module.exports = { launchMinecraft, GAME_ROOT };
