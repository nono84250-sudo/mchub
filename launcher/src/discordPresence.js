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
// Derniere activite demandee avant que la connexion Discord ne soit prete —
// rejouee des que possible (evite de perdre l'etat "en train de jouer" si
// Discord se connecte juste apres le lancement du jeu, par exemple).
let pendingActivity = null;

function scheduleReconnect(clientId) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => connect(clientId), RECONNECT_DELAY_MS);
}

function connect(clientId) {
  client = new Client({ clientId });

  client.on("ready", () => {
    ready = true;
    if (pendingActivity) {
      client.user?.setActivity(pendingActivity).catch(() => {});
    }
  });

  client.on("disconnected", () => {
    ready = false;
    scheduleReconnect(clientId);
  });

  // Discord pas lance, socket IPC absente, etc. — cas normal et frequent,
  // jamais une vraie erreur applicative : on retente plus tard en silence.
  client.login().catch(() => {
    ready = false;
    scheduleReconnect(clientId);
  });
}

function init(clientId) {
  if (!clientId) return; // Rich Presence desactivee, voir commentaire en tete de fichier.
  connect(clientId);
}

function setActivity(activity) {
  pendingActivity = activity;
  if (!ready || !client?.user) return;
  client.user.setActivity(activity).catch(() => {});
}

function setBrowsingActivity() {
  setActivity({
    details: "Parcourt les serveurs",
    largeImageKey: LARGE_IMAGE_KEY,
    largeImageText: LARGE_IMAGE_TEXT,
    startTimestamp: Date.now(),
    instance: false,
  });
}

function setPlayingActivity(serverName) {
  setActivity({
    details: `Joue sur ${serverName}`,
    largeImageKey: LARGE_IMAGE_KEY,
    largeImageText: LARGE_IMAGE_TEXT,
    startTimestamp: Date.now(),
    instance: false,
  });
}

function shutdown() {
  clearTimeout(reconnectTimer);
  if (client && ready) client.user?.clearActivity().catch(() => {});
  client?.destroy().catch(() => {});
}

module.exports = { init, setBrowsingActivity, setPlayingActivity, shutdown };
