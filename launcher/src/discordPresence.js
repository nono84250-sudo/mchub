// Discord Rich Presence ("Joue a Omniscient Launcher" avec le logo, visible
// sur le profil Discord des joueurs). Purement cosmetique : desactive
// proprement si DISCORD_CLIENT_ID n'est pas configure, ou si Discord n'est
// simplement pas lance sur la machine — ne doit jamais bloquer ni faire
// planter le launcher, jamais d'erreur visible pour le joueur.
//
// Prerequis cote Discord (pas quelque chose que ce code peut faire a la
// place de l'utilisateur — voir SUIVI_PROJET.md) :
//  1. Creer une application sur https://discord.com/developers/applications,
//     nommee EXACTEMENT "Omniscient Launcher" (c'est ce nom d'application,
//     pas une valeur d'ici, qui s'affiche en gras dans Discord).
//  2. Onglet "Rich Presence" > "Art Assets" : uploader le logo (le fichier
//     build/icon.png du launcher convient) sous la cle exacte
//     "omniscient_logo" (voir LARGE_IMAGE_KEY ci-dessous).
//  3. Onglet "OAuth2"/general : copier l'Application ID (Client ID) dans
//     DISCORD_CLIENT_ID (.env), voir generate-env.js.
const { Client } = require("@xhayper/discord-rpc");

const LARGE_IMAGE_KEY = "omniscient_logo";
const LARGE_IMAGE_TEXT = "Omniscient Launcher";
const RECONNECT_DELAY_MS = 20_000;

let client = null;
let ready = false;
let reconnectTimer = null;
let appClientId = null;
// Parametres > Divers > Discord. Coupe : aucune connexion a Discord, donc rien n'est envoye.
let enabled = true;
let locale = "fr";
// Derniere activite demandee par main.js, gardee sous forme brute (pas encore traduite) pour
// pouvoir la renvoyer quand le joueur rallume l'interrupteur ou change de langue.
let lastRequest = null;

// Texte envoye a Discord, dans la langue du launcher (ce que les amis du joueur lisent).
const TEXTS = {
  fr: { browsing: "Parcourt les serveurs", inLauncher: "Dans le launcher", privateServer: "Joue sur un serveur privé", modpack: "Modpack : {name}" },
  en: { browsing: "Browsing servers", inLauncher: "In the launcher", privateServer: "Playing on a private server", modpack: "Modpack: {name}" },
};
function text(key) {
  return (TEXTS[locale] || TEXTS.fr)[key];
}
// Derniere activite demandee avant que la connexion Discord ne soit prete —
// rejouee des que possible (evite de perdre l'etat "en train de jouer" si
// Discord se connecte juste apres le lancement du jeu, par exemple).
let pendingActivity = null;

function scheduleReconnect(clientId) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => connect(clientId), RECONNECT_DELAY_MS);
}

function connect(clientId) {
  if (!enabled) return;
  const previousClient = client;
  const thisClient = new Client({ clientId });
  client = thisClient;

  // L'ancien client (s'il y en avait un) ne doit plus pouvoir muter l'etat
  // partage (ready/pendingActivity) : on le detruit explicitement plutot que de
  // le laisser trainer en arriere-plan — sinon une resolution ou un echec tardif
  // de SA connexion pourrait ecraser l'etat de thisClient, pourtant plus recent
  // et peut-etre deja bien connecte (course trouvee par l'audit du 2026-10-10).
  if (previousClient && previousClient !== thisClient) {
    previousClient.removeAllListeners?.();
    previousClient.destroy?.().catch(() => {});
  }

  // Chaque callback capture `thisClient` (l'instance creee ICI) plutot que de
  // relire la variable de module `client` au moment ou il s'execute — et verifie
  // que `client` pointe toujours vers cette meme instance avant de muter l'etat
  // partage, pour qu'un client obsolete ne puisse jamais ecraser l'etat d'un
  // client plus recent.
  thisClient.on("ready", () => {
    if (client !== thisClient) return;
    ready = true;
    if (pendingActivity) {
      thisClient.user?.setActivity(pendingActivity).catch(() => {});
    }
  });

  thisClient.on("disconnected", () => {
    if (client !== thisClient) return;
    ready = false;
    scheduleReconnect(clientId);
  });

  // Discord pas lance, socket IPC absente, etc. — cas normal et frequent,
  // jamais une vraie erreur applicative : on retente plus tard en silence.
  thisClient.login().catch(() => {
    if (client !== thisClient) return;
    ready = false;
    scheduleReconnect(clientId);
  });
}

function init(clientId, options = {}) {
  appClientId = clientId || null;
  enabled = options.enabled !== false;
  locale = options.locale === "en" ? "en" : "fr";
  if (!appClientId || !enabled) return; // Rich Presence desactivee, voir commentaire en tete de fichier.
  connect(appClientId);
}

// Ferme la connexion a Discord (interrupteur coupe) : efface d'abord l'activite affichee, puis
// detruit le client. Les callbacks de l'ancien client ne font plus rien (client !== thisClient).
function disconnect() {
  clearTimeout(reconnectTimer);
  const previousClient = client;
  const wasReady = ready;
  client = null;
  ready = false;
  pendingActivity = null;
  if (!previousClient) return;
  previousClient.removeAllListeners?.();
  const cleared = wasReady && previousClient.user ? previousClient.user.clearActivity().catch(() => {}) : Promise.resolve();
  cleared.finally(() => previousClient.destroy?.().catch(() => {}));
}

function setEnabled(value) {
  const next = value !== false;
  if (next === enabled) return;
  enabled = next;
  if (!enabled) {
    disconnect();
    return;
  }
  if (appClientId && !client) connect(appClientId);
  refresh();
}

function setLocale(value) {
  locale = value === "en" ? "en" : "fr";
  refresh();
}

function buildActivity(request) {
  const activity = {
    largeImageKey: LARGE_IMAGE_KEY,
    largeImageText: LARGE_IMAGE_TEXT,
    startTimestamp: request.startTimestamp,
    instance: false,
  };
  if (request.kind === "browsing") {
    activity.details = text("browsing");
    activity.state = text("inLauncher");
  } else if (request.isPrivate) {
    // Serveur sur invitation : ni son nom ni son modpack (le joueur n'a pas choisi de le rendre public).
    activity.details = text("privateServer");
  } else {
    activity.details = request.serverName;
    if (request.modpackName && request.modpackName !== request.serverName) {
      activity.state = text("modpack").replace("{name}", request.modpackName);
    }
  }
  return activity;
}

function refresh() {
  if (!enabled || !lastRequest) return;
  setActivity(buildActivity(lastRequest));
}

function setActivity(activity) {
  pendingActivity = activity;
  if (!ready || !client?.user) return;
  client.user.setActivity(activity).catch(() => {});
}

function setBrowsingActivity() {
  lastRequest = { kind: "browsing", startTimestamp: Date.now() };
  refresh();
}

// Affichage voulu : le titre en gras « Joue à Omniscient Launcher » vient du NOM de l'application
// Discord (rien à écrire ici), puis `details` = le serveur rejoint, `state` = le modpack s'il y en a un.
// Serveur prive : seulement « Joue sur un serveur privé ».
function setPlayingActivity(serverName, modpackName, { isPrivate = false } = {}) {
  lastRequest = { kind: "playing", serverName, modpackName, isPrivate: isPrivate === true, startTimestamp: Date.now() };
  refresh();
}

function shutdown() {
  clearTimeout(reconnectTimer);
  if (client && ready) client.user?.clearActivity().catch(() => {});
  client?.destroy().catch(() => {});
}

module.exports = { init, setEnabled, setLocale, setBrowsingActivity, setPlayingActivity, shutdown };
