const path = require("node:path");
const { spawn } = require("node:child_process");
const { app } = require("electron");
const { Client } = require("minecraft-launcher-core");
const logStore = require("./logStore");
const discordPresence = require("./discordPresence");

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

  // "debug"/"data" peuvent inclure la ligne de commande Java complète, qui
  // contient le jeton d'accès Minecraft en clair (--accessToken ...) — jamais
  // transmis tel quel : logStore.pushLog() les passe par redact() avant de
  // les rendre visibles dans la console de debug (voir logStore.js). "debug"
  // couvre la préparation du lancement (téléchargements, vérifications) côté
  // launcher ; "data" est la sortie réelle du processus Minecraft une fois
  // démarré — d'où le tag "game" plutôt que "launcher" pour les deux, ce que
  // l'utilisateur voit dans la console correspond à "les logs de Minecraft".
  launcher.on("debug", (e) => logStore.pushLog({ level: "debug", source: "game", message: String(e) }));
  launcher.on("data", (e) => logStore.pushLog({ level: "info", source: "game", message: String(e) }));
  // Objet structure (pas juste un texte) pour que le renderer puisse calculer
  // un vrai pourcentage (barre de progression stylee dans la barre de
  // lancement rapide) plutot que d'afficher uniquement du texte.
  launcher.on("progress", (e) => {
    if (e && e.type && typeof e.task === "number" && typeof e.total === "number") {
      onProgress?.({ text: `${e.type} : ${e.task}/${e.total}`, type: e.type, task: e.task, total: e.total });
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
      logStore.pushLog({ source: "game", message: `Processus du jeu fermé (code ${code}).` });
      // "started" distingue une vraie fin de partie (retour a "parcourt les
      // serveurs" cote Discord) d'un lancement qui n'a jamais reellement
      // demarre — jamais eu de presence "en jeu" a annuler dans ce cas.
      if (started) discordPresence.setBrowsingActivity();
      if (!started) reject(new Error(`Le jeu s'est fermé avant de démarrer (code ${code}).`));
    });
    onProgress?.({ text: "Lancement du jeu…" });
    logStore.pushLog({ source: "game", message: `Lancement de Minecraft ${version}${serverIp ? ` → ${serverIp}` : ""}…` });
    launcher
      .launch(opts)
      .then((proc) => {
        if (!proc) {
          // minecraft-launcher-core avale certaines erreurs internes
          // (echec reseau pendant le telechargement, manifeste corrompu...)
          // et resout avec `null` au lieu de rejeter — sans ce controle on
          // annoncerait un lancement reussi alors que rien n'a demarre.
          logStore.pushLog({ level: "error", source: "game", message: "Le lancement du jeu a échoué (proc null)." });
          reject(new Error("Le lancement du jeu a échoué (voir les journaux pour le détail)."));
          return;
        }
        started = true;
        logStore.pushLog({ source: "game", message: `Jeu démarré (PID ${proc.pid}).` });
        resolve(proc);
      })
      .catch((error) => {
        logStore.pushLog({ level: "error", source: "game", message: `Échec du lancement : ${error?.message || error}` });
        reject(error);
      });
  });
}

module.exports = { launchMinecraft, GAME_ROOT };
