const path = require("node:path");
const { spawn } = require("node:child_process");
const { app } = require("electron");
const { Client } = require("minecraft-launcher-core");
const logStore = require("./logStore");
const discordPresence = require("./discordPresence");
const { addServerToList } = require("./serversDat");
const { ensureVanillaVersion } = require("./modpack");

// Options JVM demandees par Mojang pour une version vanilla (arguments.jvm de son
// JSON). Le lancement passe par minecraft-launcher-core, qui ignore ces options :
// sans elles, Minecraft 26.3 (Java 25) plante au moment de la connexion. On ne
// garde que les options independantes du PC (pas de ${...}, pas de -cp) et les
// regles qui autorisent Windows (ou aucune regle).
function mojangJvmArgs(vanilla) {
  const out = [];
  // Deja fournies par minecraft-launcher-core : on ne les repete pas.
  const keep = (value) => !value.includes("${") && value !== "-cp" && !value.startsWith("-XX:HeapDumpPath");
  const allowed = (rules) =>
    !rules || rules.every((r) => (r.action === "allow" && (!r.os || r.os.name === "windows")) || (r.action === "disallow" && r.os?.name && r.os.name !== "windows"));
  for (const arg of vanilla.arguments?.jvm || []) {
    if (typeof arg === "string") {
      if (keep(arg)) out.push(arg);
    } else if (arg && allowed(arg.rules) && !arg.rules?.some((r) => r.features)) {
      const values = Array.isArray(arg.value) ? arg.value : [arg.value];
      for (const value of values) if (typeof value === "string" && keep(value)) out.push(value);
    }
  }
  return out;
}

// Repertoire de jeu local : Java, Minecraft (vanilla) et ses assets sont
// telecharges ici au premier lancement, puis reutilises. Les serveurs moddes
// (modpack CurseForge, NeoForge/Forge) y ont chacun leur instance dans
// instances/<slug> (voir modpack.js) ; Fabric/Quilt ne sont pas encore geres.
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
 * Lance Minecraft. `onProgress(status)` reçoit des mises à jour lisibles
 * pendant le téléchargement ; la promesse se résout dès que le processus du
 * jeu démarre (pas quand le joueur quitte le jeu). Pour un serveur moddé,
 * `gameDirectory` (instance du serveur), `customVersion` (version du
 * chargeur préparée par modpack.js) et `customJvmArgs` (arguments JVM du
 * chargeur) viennent de installModpack().
 */
async function launchMinecraft({
  authorization,
  version,
  serverIp,
  serverName,
  onProgress,
  memory,
  javaPath,
  gameDirectory,
  customVersion,
  customJvmArgs,
  onGameState,
}) {
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

  // Vanilla uniquement (un chargeur de modpack garde ses propres options) :
  // on ajoute les options JVM de Mojang pour cette version, et on les journalise.
  let jvmArgs = customJvmArgs || [];
  if (!customVersion) {
    try {
      const vanilla = await ensureVanillaVersion(path.join(GAME_ROOT, "versions"), version);
      const mojangArgs = mojangJvmArgs(vanilla);
      logStore.pushLog({
        source: "launcher",
        message: `Mojang demande Java ${vanilla.javaVersion?.majorVersion ?? "?"} (runtime ${vanilla.javaVersion?.component ?? "?"}) pour ${version}`,
      });
      logStore.pushLog({ source: "launcher", message: `Options JVM de Mojang ajoutées : ${mojangArgs.join(" ")}` });
      jvmArgs = [...mojangArgs, ...jvmArgs];
    } catch (error) {
      logStore.pushLog({ level: "warn", source: "launcher", message: `Options Mojang non récupérées (${error.message}), lancement sans elles` });
    }
  }

  const opts = {
    authorization,
    root: GAME_ROOT,
    version: { number: version, type: "release", ...(customVersion ? { custom: customVersion } : {}) },
    memory: memory || { max: "4G", min: "1G" },
  };
  if (javaPath) opts.javaPath = javaPath;
  if (gameDirectory) opts.overrides = { gameDirectory };
  if (jvmArgs.length) opts.customArgs = jvmArgs;

  if (serverIp) {
    // Le lancement rapide connecte le joueur mais n'ajoute rien a la liste
    // Multijoueur : sans ca, apres une deconnexion il ne peut plus revenir sans
    // tout relancer. Ne doit jamais empecher le lancement.
    try {
      if (addServerToList(gameDirectory || GAME_ROOT, { name: serverName, ip: serverIp })) {
        logStore.pushLog({ source: "launcher", message: `« ${serverName || serverIp} » ajouté à la liste Multijoueur.` });
      }
    } catch (error) {
      logStore.pushLog({ level: "warn", source: "launcher", message: `Liste Multijoueur non mise à jour : ${error instanceof Error ? error.message : error}` });
    }

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
      if (started) onGameState?.(false);
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
        onGameState?.(true);
        resolve(proc);
      })
      .catch((error) => {
        logStore.pushLog({ level: "error", source: "game", message: `Échec du lancement : ${error?.message || error}` });
        reject(error);
      });
  });
}

module.exports = { launchMinecraft, GAME_ROOT };
