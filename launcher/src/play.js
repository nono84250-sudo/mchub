// Onglet « Jouer » (bêta, preview C validée par Rushi le 24/10) : à gauche « Mes versions »
// (n'importe quelle version de Minecraft, vanilla ou avec un pack officiel, comme les
// installations du launcher officiel), à droite « Mes mondes » (sauvegardés tout seuls, import
// par copie depuis .minecraft, synchro cloud pour les Supporters). Plus la tuile « Continuer mon
// monde » de l'accueil.
//
// Chargé après renderer.js : showModal, attemptSignIn, signedIn, escapeHtml, renderActivity et
// TASK_PAUSE_SVG en viennent (portée globale des scripts classiques). Tout le reste est ici,
// dans une fonction, pour ne rien ajouter à la portée globale.
(function () {
  const api = window.mchub.play;
  if (!api) return;
  const L = () => (window.i18n.getLocale() === "en" ? "en" : "fr");
  const S = {
    fr: {
      nav: "Jouer", beta: "Bêta",
      sub: "N'importe quelle version, en vanilla ou avec un pack officiel. En solo, ou en multi avec l'adresse IP d'un serveur. Tes mondes sont sauvegardés tout seuls.",
      welcomeT: "Joue à Minecraft, à ta façon",
      welcomeD: "N'importe quelle version, en vanilla ou avec un pack préparé par l'équipe. En solo, ou en multi avec l'adresse IP d'un serveur. Tes mondes sont sauvegardés tout seuls.",
      step1T: "Choisis une version", step1D: "1.21, 1.8.9… toutes les versions existent.",
      step2T: "Crée ton monde", step2D: "Dans le jeu, comme d'habitude.",
      step3T: "Il est sauvegardé", step3D: "Il apparaît ici, avec ses sauvegardes.",
      mine: "Mes versions", newV: "Nouvelle version", worldsT: "Mes mondes",
      noVersions: "Aucune version pour l'instant. Clique « + Nouvelle version » et choisis n'importe quelle version de Minecraft.",
      noWorlds: "Lance une de tes versions et crée ton monde dans le jeu : il apparaîtra ici, sauvegardé tout seul.",
      play: "Jouer", remove: "Retirer", rename: "Renommer", playing: "En cours", lastPlayed: "Jouée {t}", never: "Jamais jouée",
      official: "Officiel", mods: "mods", noMods: "Aucun mod",
      import: "Importer mes mondes Minecraft",
      saved: "Sauvegardé {t}", notSaved: "Pas encore sauvegardé", off: "Sauvegarde coupée",
      backups: "{n} sauvegardes sur ce PC", backups1: "1 sauvegarde sur ce PC", backups0: "Aucune sauvegarde", backupsKept: "{n} sauvegardes gardées sur ce PC", worldSize: "monde : {s}", cloudVer: "{n} version dans le cloud", cloudVers: "{n} versions dans le cloud", zipped: "{s} compressé",
      bkp: "Sauvegarde", bkpOnTip: "Couper la sauvegarde de ce monde", bkpOffTip: "Réactiver la sauvegarde",
      lastWith: "Ouvert la dernière fois avec {v}", inVersion: "Créé en {v}",
      offT: "Couper la sauvegarde de « {w} » ?", offD: "Le launcher ne fera plus de nouvelles sauvegardes de ce monde. Les {n} sauvegardes déjà faites sont gardées, sauf si tu coches la case.",
      offD0: "Le launcher ne fera plus de sauvegardes de ce monde.",
      offBox: "Supprimer aussi les {n} sauvegardes déjà faites", offOk: "Couper la sauvegarde", cancel: "Annuler", yesRemove: "Oui, retirer", no: "Non",
      toastOffKeep: "Sauvegarde coupée. Les {n} sauvegardes de « {w} » sont gardées.", toastOffDel: "Sauvegarde coupée. Les sauvegardes de « {w} » sont supprimées.", toastOn: "Sauvegarde réactivée pour « {w} ».",
      removeT: "Retirer « {v} » ?", removeD: "La version et ses mods sont retirés de ce PC. Tes mondes ne sont pas touchés : ils restent dans Mes mondes, avec leurs sauvegardes. Tu pourras la réinstaller avec « + Nouvelle version ».",
      removed: "Version retirée. Tes mondes ne sont pas touchés.",
      newVD: "Comme « Nouvelle installation » dans le launcher Minecraft. Elle s'ajoute à Mes versions ; tu la lances quand tu veux, en solo ou en multi.",
      nameL: "Nom (facultatif)", nameP: "Ex. : Survie 1.21 avec Léo", verL: "Version de Minecraft", search: "Écris une version : 1.20.1, 1.8.9, 24w45a…",
      fRel: "Versions finales", fSnap: "Snapshots", fOld: "Anciennes (bêta, alpha…)", none: "Aucune version ne correspond.", count: "{n} versions",
      packL: "Pack préconfiguré (testé par l'équipe)", vanillaD: "Minecraft tel quel, aucun mod.",
      create: "Créer", createPlay: "Créer et jouer", created: "« {n} » ajoutée à Mes versions.",
      snapW: "Snapshot : version de test de Mojang, peut abîmer un monde. Fais une copie avant.",
      oldW: "Très ancienne version : pas de multijoueur moderne, ni de sauvegarde garantie.",
      loadingVersions: "Chargement de la liste des versions…", versionsError: "Liste des versions injoignable : vérifie ta connexion.",
      launching: "Lancement de Minecraft {v}…", signin: "Connecte-toi avec ton compte Microsoft pour jouer.",
      impT: "Importer mes mondes Minecraft", impFrom: "Trouvés dans ce dossier :", impNone: "Aucun monde trouvé dans ce dossier.",
      impSafe: "On fait une copie. Tes mondes d'origine ne bougent pas et marchent toujours dans le launcher officiel.",
      impOther: "Autre dossier…", impCopy: "Copier {n} monde(s)", impCopying: "Copie en cours…", impDone: "{n} monde(s) copié(s). La sauvegarde est activée sur les copies.",
      impScanning: "Recherche des mondes…",
      contT: "Continuer mon monde", allWorlds: "Tous mes mondes", homeWhen: "{p} · {v}",
      histT: "Sauvegardes de « {w} »", histD: "Restaurer remplace le monde par cette sauvegarde ; la version actuelle est d'abord sauvegardée, rien n'est perdu.",
      histEmpty: "Aucune sauvegarde pour l'instant. Elles se font toutes seules pendant la partie et quand tu quittes le monde.",
      inGameT: "Pendant la partie", inGameD: "F6 : sauvegarder maintenant. Maj+F6 : sauvegarder avec un nom (ex. « Elytra obtenu »). Automatique toutes les 30 min et quand tu quittes le monde.",
      inGameToast: "Petite notification dans le jeu après une sauvegarde automatique",
      restore: "Restaurer", restoreT: "Restaurer « {w} » ?", restoreD: "Le monde revient à la sauvegarde du {d}. La version actuelle est sauvegardée juste avant (« Avant restauration »).",
      restored: "« {w} » est revenu à la sauvegarde choisie.", backupNow: "Sauvegarder maintenant", backupDone: "Sauvegarde faite.", openFolder: "Ouvrir le dossier",
      reason: { auto: "Fin de partie", manual: "À la main", import: "Import", "before-restore": "Avant restauration", ingame: "F6 en jeu", named: "Avec un nom", interval: "Automatique", "world-exit": "Sortie du monde" },
      close: "Fermer", gameRunning: "Ferme Minecraft d'abord : on ne touche pas à un monde ouvert.",
      inCloud: "Dans le cloud", notInCloud: "Pas dans le cloud", sending: "Envoi en cours (voir en haut à droite)", cloudOnly: "Dans le cloud, pas sur ce PC", download: "Télécharger sur ce PC", restorePending: "Restauration demandée sur le site : faite au prochain lancement",
      sync: "Synchroniser",
      mvAll: "Mes mondes", mvRecent: "Récents", mvPinned: "Épinglés", mvOthers: "Tous mes mondes", mvHidden: "Mondes masqués", mvCloudOnly: "Seulement dans le cloud",
      mvSearch: "Rechercher un monde…", mvSort: "Trier", mvSortRecent: "Dernier joué", mvSortName: "Nom", mvSortSize: "Taille",
      mvFAll: "Tous", mvFNotCloud: "Pas dans le cloud", mvFOff: "Sauvegarde coupée", mvAllVersions: "Toutes les versions",
      mvMore: "Afficher les {n} autres", mvNone: "Aucun monde ne correspond.", mvPlayTip: "Jouer à « {w} »", mvBusy: "Ferme Minecraft d'abord : un seul jeu à la fois.",
      mvRunning: "En cours", mvDlTip: "Télécharger « {w} » sur ce PC", mvMenu: "Plus d'actions", mvBk: "{n} sauv.", mvBk1: "1 sauv.", mvBk0: "aucune sauv.",
      mvMBackups: "Sauvegardes ({n})", mvMAuto: "Sauvegarde automatique", mvMPin: "Épingler en haut", mvMUnpin: "Désépingler", mvMHide: "Masquer de la liste", mvMUnhide: "Remettre dans la liste",
      mvMUncloud: "Retirer du cloud", mvMSplit: "Choisir quelle version continuer", mvSplit: "2 versions",
      mvPinOk: "« {w} » est épinglé en haut.", mvHideOk: "« {w} » est masqué. Il reste sauvegardé, retrouve-le en bas de la liste.", mvMask: "Monde",
    },
    en: {
      nav: "Play", beta: "Beta",
      sub: "Any version, vanilla or with an official pack. Singleplayer, or multiplayer with a server's IP address. Your worlds are backed up on their own.",
      welcomeT: "Play Minecraft your way",
      welcomeD: "Any version, vanilla or with a pack prepared by the team. Singleplayer, or multiplayer with a server's IP address. Your worlds are backed up on their own.",
      step1T: "Pick a version", step1D: "1.21, 1.8.9… every version is there.",
      step2T: "Create your world", step2D: "In the game, as usual.",
      step3T: "It is backed up", step3D: "It shows up here, with its backups.",
      mine: "My versions", newV: "New version", worldsT: "My worlds",
      noVersions: "No version yet. Click “+ New version” and pick any Minecraft version.",
      noWorlds: "Start one of your versions and create your world in the game: it will show up here, backed up on its own.",
      play: "Play", remove: "Remove", rename: "Rename", playing: "Running", lastPlayed: "Played {t}", never: "Never played",
      official: "Official", mods: "mods", noMods: "No mods",
      import: "Import my Minecraft worlds",
      saved: "Saved {t}", notSaved: "Not backed up yet", off: "Backup off",
      backups: "{n} backups on this PC", backups1: "1 backup on this PC", backups0: "No backup", backupsKept: "{n} backups kept on this PC", worldSize: "world: {s}", cloudVer: "{n} version in the cloud", cloudVers: "{n} versions in the cloud", zipped: "{s} compressed",
      bkp: "Backup", bkpOnTip: "Turn off backup for this world", bkpOffTip: "Turn backup back on",
      lastWith: "Last opened with {v}", inVersion: "Made in {v}",
      offT: "Turn off backup for “{w}”?", offD: "The launcher will stop making new backups of this world. The {n} backups already made are kept, unless you tick the box.",
      offD0: "The launcher will stop backing up this world.",
      offBox: "Also delete the {n} backups already made", offOk: "Turn off backup", cancel: "Cancel", yesRemove: "Yes, remove", no: "No",
      toastOffKeep: "Backup off. The {n} backups of “{w}” are kept.", toastOffDel: "Backup off. The backups of “{w}” are deleted.", toastOn: "Backup turned back on for “{w}”.",
      removeT: "Remove “{v}”?", removeD: "The version and its mods are removed from this PC. Your worlds are not touched: they stay in My worlds, with their backups. You can install it again with “+ New version”.",
      removed: "Version removed. Your worlds are not touched.",
      newVD: "Like “New installation” in the Minecraft launcher. It is added to My versions; start it whenever you want, singleplayer or multiplayer.",
      nameL: "Name (optional)", nameP: "E.g. Survival 1.21 with Leo", verL: "Minecraft version", search: "Type a version: 1.20.1, 1.8.9, 24w45a…",
      fRel: "Releases", fSnap: "Snapshots", fOld: "Old (beta, alpha…)", none: "No version matches.", count: "{n} versions",
      packL: "Preconfigured pack (tested by the team)", vanillaD: "Minecraft as is, no mods.",
      create: "Create", createPlay: "Create and play", created: "“{n}” added to My versions.",
      snapW: "Snapshot: a Mojang test version, it can damage a world. Make a copy first.",
      oldW: "Very old version: no modern multiplayer and no guaranteed backup.",
      loadingVersions: "Loading the version list…", versionsError: "Version list unreachable: check your connection.",
      launching: "Starting Minecraft {v}…", signin: "Sign in with your Microsoft account to play.",
      impT: "Import my Minecraft worlds", impFrom: "Found in this folder:", impNone: "No world found in this folder.",
      impSafe: "We make a copy. Your original worlds don't move and still work in the official launcher.",
      impOther: "Other folder…", impCopy: "Copy {n} world(s)", impCopying: "Copying…", impDone: "{n} world(s) copied. Backup is on for the copies.",
      impScanning: "Looking for worlds…",
      contT: "Continue my world", allWorlds: "All my worlds", homeWhen: "{p} · {v}",
      histT: "Backups of “{w}”", histD: "Restore replaces the world with this backup; the current version is backed up first, nothing is lost.",
      histEmpty: "No backup yet. They happen on their own while you play and when you leave the world.",
      inGameT: "While playing", inGameD: "F6: save now. Shift+F6: save with a name (e.g. “Got the elytra”). Automatic every 30 min and when you leave the world.",
      inGameToast: "Small in-game notification after an automatic backup",
      restore: "Restore", restoreT: "Restore “{w}”?", restoreD: "The world goes back to the backup from {d}. The current version is backed up right before (“Before restore”).",
      restored: "“{w}” is back to the chosen backup.", backupNow: "Back up now", backupDone: "Backup done.", openFolder: "Open folder",
      reason: { auto: "End of game", manual: "By hand", import: "Import", "before-restore": "Before restore", ingame: "F6 in game", named: "Named", interval: "Automatic", "world-exit": "Left the world" },
      close: "Close", gameRunning: "Close Minecraft first: we don't touch an open world.",
      inCloud: "In the cloud", notInCloud: "Not in the cloud", sending: "Sending (see top right)", cloudOnly: "In the cloud, not on this PC", download: "Download to this PC", restorePending: "Restore requested on the website: done next time you start it",
      sync: "Sync",
      mvAll: "My worlds", mvRecent: "Recent", mvPinned: "Pinned", mvOthers: "All my worlds", mvHidden: "Hidden worlds", mvCloudOnly: "Only in the cloud",
      mvSearch: "Search a world…", mvSort: "Sort", mvSortRecent: "Last played", mvSortName: "Name", mvSortSize: "Size",
      mvFAll: "All", mvFNotCloud: "Not in the cloud", mvFOff: "Backup off", mvAllVersions: "All versions",
      mvMore: "Show {n} more", mvNone: "No world matches.", mvPlayTip: "Play “{w}”", mvBusy: "Close Minecraft first: one game at a time.",
      mvRunning: "Playing", mvDlTip: "Download “{w}” to this PC", mvMenu: "More actions", mvBk: "{n} backups", mvBk1: "1 backup", mvBk0: "no backup",
      mvMBackups: "Backups ({n})", mvMAuto: "Automatic backup", mvMPin: "Pin to top", mvMUnpin: "Unpin", mvMHide: "Hide from the list", mvMUnhide: "Put back in the list",
      mvMUncloud: "Remove from cloud", mvMSplit: "Choose which version to continue", mvSplit: "2 versions",
      mvPinOk: "“{w}” is pinned to the top.", mvHideOk: "“{w}” is hidden. It stays backed up; find it at the bottom of the list.", mvMask: "World",
    },
  };
  const T = (k, o) => {
    let s = S[L()][k] ?? S.fr[k] ?? k;
    if (o) s = s.replace(/\{(\w+)\}/g, (_, x) => (o[x] ?? ""));
    return s;
  };
  const esc = (v) => escapeHtml(v == null ? "" : String(v));
  const packName = (p) => (p ? (p.name?.[L()] || p.name?.fr || p.slug) : "Vanilla");

  // Durée relative courte (« il y a 3 min », « hier »).
  function ago(when) {
    const ms = Date.now() - (typeof when === "number" ? when : Date.parse(when));
    if (!Number.isFinite(ms)) return "";
    const fr = L() === "fr";
    const min = Math.round(ms / 60000);
    if (min < 1) return fr ? "à l'instant" : "just now";
    if (min < 60) return fr ? `il y a ${min} min` : `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 24) return fr ? `il y a ${h} h` : `${h} h ago`;
    const d = Math.round(h / 24);
    if (d === 1) return fr ? "hier" : "yesterday";
    return fr ? `il y a ${d} jours` : `${d} days ago`;
  }
  function sizeFmt(bytes) {
    const fr = L() === "fr";
    const mo = (bytes || 0) / 1e6;
    if (mo <= 0) return `0 ${fr ? "Mo" : "MB"}`;
    if (mo >= 1000) return `${(mo / 1000).toFixed(1).replace(".", fr ? "," : ".")} ${fr ? "Go" : "GB"}`;
    return `${Math.max(1, Math.round(mo))} ${fr ? "Mo" : "MB"}`;
  }
  function dateFmt(iso) {
    try {
      return new Date(iso).toLocaleString(L() === "fr" ? "fr-BE" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  // Petite vignette « bloc d'herbe » quand le monde n'a pas encore d'image (icon.png du jeu).
  const thumbCache = {};
  function grassThumb(seedText) {
    let seed = 0;
    for (const c of String(seedText)) seed = (seed * 31 + c.charCodeAt(0)) % 9973;
    if (thumbCache[seed]) return thumbCache[seed];
    const c = document.createElement("canvas");
    c.width = 44;
    c.height = 44;
    const x = c.getContext("2d");
    let s = seed * 9301 + 49297;
    const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 44; i += 4) {
      const g = Math.round((18 + Math.sin(i / 7 + seed) * 6) / 4) * 4;
      for (let j = 0; j < 44; j += 4) {
        x.fillStyle = j < g ? "#8fc6ef" : j < g + 4 ? (r() < 0.2 ? "#6a9a3e" : "#5f9a3a") : j < g + 12 ? (r() < 0.2 ? "#7a5634" : "#86603b") : r() < 0.12 ? "#a0a0a0" : "#7f7f86";
        x.fillRect(i, j, 4, 4);
      }
    }
    return (thumbCache[seed] = c.toDataURL());
  }
  const worldThumb = (w) => w.icon || grassThumb(w.key || w.name);

  const CUBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/></svg>';

  const css = document.createElement("style");
  css.textContent = `
  .play-switch { display: inline-flex; align-items: center; gap: 8px; border: 0; background: none; color: var(--muted); font: inherit; font-size: 12.5px; cursor: pointer; padding: 4px; border-radius: var(--radius-m); }
  .play-switch i { position: relative; width: 32px; height: 18px; border-radius: 9px; background: color-mix(in srgb, var(--foreground) 22%, transparent); transition: background .15s; }
  .play-switch i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.35); }
  .play-switch[aria-checked="true"] i { background: var(--success); }
  .play-switch[aria-checked="true"] i::after { transform: translateX(14px); }
  .instance-card-icon.play-thumb { padding: 0; overflow: hidden; }
  .instance-card-icon.play-thumb img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; display: block; }
  .instance-badge.play-saved { background: color-mix(in srgb, var(--success) 16%, transparent); color: var(--success); }
  .instance-badge.play-off { background: color-mix(in srgb, var(--muted) 20%, transparent); color: var(--muted); }
  .play-list { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; max-height: 46vh; overflow: auto; }
  .play-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-m); border: 1px solid var(--border); background: var(--surface-raised); cursor: pointer; font-size: 13px; }
  .play-row img { width: 32px; height: 32px; border-radius: 6px; image-rendering: pixelated; object-fit: cover; }
  .play-row .t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .play-row small { color: var(--muted); font-size: 11.5px; }
  .play-row .w { color: var(--warn); font-size: 11.5px; }
  .play-row .sz { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12px; white-space: nowrap; }
  .play-path { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: var(--muted); overflow-wrap: anywhere; }
  .play-safe { font-size: 12.5px; padding: 8px 10px; border-radius: var(--radius-m); background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--foreground); margin: 0; }
  .home-resume.play-resume .home-resume-icon { padding: 0; overflow: hidden; background: none; }
  .home-resume.play-resume .home-resume-icon img { width: 100%; height: 100%; image-rendering: pixelated; display: block; object-fit: cover; }
  .sidebar-beta { margin-left: auto; font-size: 9.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--accent-2); }
  #sidebar:not(.expanded) .sidebar-beta { display: none; }
  .play-beta-tag { display: inline-block; vertical-align: middle; margin-left: 8px; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent-2); }
  #play-panel.detail { max-width: 1280px; margin-inline: auto; }
  .play-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; align-items: start; }
  @media (max-width: 900px) { .play-cols { grid-template-columns: 1fr; } }
  .play-in { width: 100%; box-sizing: border-box; font: inherit; font-size: 13.5px; padding: 8px 10px; border-radius: var(--radius-m); border: 1px solid var(--border); background: var(--surface-raised); color: var(--foreground); margin-top: 6px; }
  .play-in:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .play-chips { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 8px 0 6px; font-size: 12.5px; color: var(--muted); }
  .play-chips label { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
  .play-vlist { max-height: 168px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-m); padding: 4px; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 4px; background: var(--surface-raised); }
  .play-vlist button { font: inherit; font-size: 13px; text-align: left; padding: 6px 8px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: var(--foreground); cursor: pointer; font-variant-numeric: tabular-nums; }
  .play-vlist button:hover { background: var(--surface); }
  .play-vlist button[aria-selected="true"] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .play-vlist small { color: var(--muted); font-size: 10.5px; }
  .play-warn { margin: 8px 0 0; font-size: 12.5px; color: var(--warn); }
  #play-panel .home-section-header { align-items: center; min-height: 36px; }
  .play-welcome { display: grid; justify-items: center; text-align: center; gap: 10px; padding: 40px 24px; border: 1px dashed var(--border); border-radius: var(--radius-l); background: var(--surface); }
  .play-welcome h3 { margin: 4px 0 0; font-size: 18px; color: var(--foreground); }
  .play-welcome > p { margin: 0; max-width: 56ch; color: var(--muted); font-size: 13.5px; }
  .play-steps { list-style: none; margin: 12px 0 6px; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 200px)); gap: 12px; }
  .play-steps li { display: grid; gap: 6px; justify-items: center; padding: 14px 12px; border-radius: var(--radius-m); background: var(--surface-raised); font-size: 12.5px; color: var(--muted); }
  .play-steps b { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent-2); font-size: 13px; }
  .play-steps strong { color: var(--foreground); font-weight: 600; font-size: 13px; }
  .play-welcome .acts { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }
  @media (max-width: 760px) { .play-steps { grid-template-columns: 1fr; } }
  .play-col-empty { display: grid; justify-items: center; text-align: center; gap: 8px; padding: 28px 16px; border: 1px dashed var(--border); border-radius: var(--radius-l); color: var(--muted); font-size: 13px; }
  .play-col-empty p { margin: 0; max-width: 40ch; }
  .play-modal { position: fixed; inset: 36px 0 0 0; z-index: 250; background: rgba(4, 7, 14, 0.66); display: grid; place-items: center; padding: 16px; }
  .play-modal .modal-box { max-height: calc(100vh - 80px); overflow: auto; }
  .bk-hint { font-size:12px; opacity:.75; margin:6px 0 0; }
  /* Fenêtre Sauvegardes (design A « Curseur », choisi le 25/10). */
  .nb-box { max-width: 600px; text-align: left; }
  .nb-box h3 { margin: 0 0 2px; }
  .nb-sub { font-size: 12.5px; color: var(--muted); margin: 0 0 14px; }
  .nl-del { color: var(--danger) !important; }
  .nl-danger { background: var(--danger) !important; border-color: var(--danger) !important; }
  .nl-danger:disabled { opacity: .45; }
  .nb-all { display: inline-block; font-size: 11px; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); padding: 1px 8px; border-radius: 999px; margin-right: 4px; }
  .nb-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .nb-tiles.one { grid-template-columns: 1fr; }
  .nb-tile { padding: 10px 12px; border-radius: var(--radius-m); background: var(--surface-raised); border: 1px solid var(--border); font-size: 12.5px; display: flex; flex-direction: column; gap: 3px; }
  .nb-tile > span { color: var(--muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
  .nb-tile b { font-size: 14px; font-weight: 650; }
  .nb-tile small { color: var(--muted); font-size: 11.5px; }
  .nb-bar { height: 6px; border-radius: 99px; background: color-mix(in srgb, var(--foreground) 10%, transparent); overflow: hidden; margin-top: 4px; }
  .nb-bar i { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
  .nb-q { margin: 18px 0 8px; font-size: 13px; font-weight: 600; display: flex; align-items: baseline; gap: 8px; }
  .nb-q .tag { font-size: 11px; font-weight: 600; color: var(--accent); }
  .nb-res { font-size: 12.5px; margin: 10px 0 0; padding: 8px 10px; border-radius: var(--radius-m); line-height: 1.45; }
  .nb-res.ok { background: color-mix(in srgb, var(--success) 12%, transparent); }
  .nb-res.warn { background: color-mix(in srgb, var(--warn) 14%, transparent); }
  .nb-cloud { display: flex; gap: 8px; font-size: 12.5px; line-height: 1.45; margin-top: 10px; padding: 9px 11px; border-radius: var(--radius-m); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); background: color-mix(in srgb, var(--accent) 7%, transparent); }
  .nb-cloud > span:first-child { color: var(--accent); }
  .nb-check { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; margin-top: 12px; cursor: pointer; }
  .nb-check input { margin-top: 3px; }
  .nb-check small { display: block; font-size: 12px; color: var(--muted); }
  .nb-adv { margin-top: 12px; font-size: 12.5px; }
  .nb-adv > button { font-size: 12.5px; }
  .nb-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .nb-pills button { font: inherit; font-size: 13px; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--foreground); cursor: pointer; position: relative; }
  .nb-pills button:hover { border-color: color-mix(in srgb, var(--accent) 50%, var(--border)); }
  .nb-pills button[aria-checked=true] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); font-weight: 650; }
  .nb-ingame { margin-top: 14px; padding: 10px 12px; border-radius: var(--radius-m); background: var(--surface-raised); border: 1px solid var(--border); font-size: 12.5px; line-height: 1.5; }
  .nb-ingame kbd { font: inherit; font-size: 11.5px; font-weight: 600; padding: 1px 6px; border-radius: 5px; border: 1px solid var(--border); background: var(--surface); }
  .nb-ingame label { display: flex; gap: 8px; align-items: center; margin-top: 6px; cursor: pointer; }
  .nb-list { margin-top: 8px; max-height: 230px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-m); }
  .nb-row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 7px 10px; font-size: 12.5px; border-bottom: 1px solid var(--border); }
  .nb-row:last-child { border-bottom: 0; }
  .nb-row .s { color: var(--muted); font-variant-numeric: tabular-nums; }
  .nb-row b { font-weight: 600; }
  .nb-row.gone { opacity: .5; }
  .nb-row.gone .d { text-decoration: line-through; }
  .nb-row small { display: inline-block; margin-left: 6px; color: var(--warn); font-size: 11px; }
  .nb-empty { margin-top: 10px; padding: 14px; border: 1px dashed var(--border); border-radius: var(--radius-m); font-size: 12.5px; color: var(--muted); text-align: center; }
  .nb-acts { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-top: 18px; }
  /* A : curseur */
  .nb-big { display: flex; align-items: baseline; gap: 8px; }
  .nb-big b { font-size: 34px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .nb-big span { font-size: 13.5px; color: var(--muted); }
  .nb-range { width: 100%; margin: 12px 0 2px; accent-color: var(--accent); height: 22px; cursor: pointer; }
  .nb-ticks { display: grid; font-size: 11px; color: var(--muted); text-align: center; margin: 0 -2px; }
  .nb-ticks span { cursor: pointer; }
  .nb-ticks span.on { color: var(--foreground); font-weight: 700; }
  .nb-ticks span:first-child { text-align: left; } .nb-ticks span:last-child { text-align: right; }
  @media (max-width: 640px) { .nb-tiles { grid-template-columns: 1fr; } }
  /* Une confirmation (showModal) ouverte depuis une fenêtre de l'onglet Jouer passe toujours au-dessus
     (retour de test du 25/10 : « Retirer du cloud » restait cachée derrière Synchroniser). */
  body:has(.play-modal) .modal-overlay { z-index: 300; }
  .cloud-box { width: min(520px, 100%); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-l); padding: 22px; display: grid; gap: 12px; box-shadow: 0 20px 60px -20px rgba(0,0,0,.7); max-height: calc(100vh - 80px); overflow: auto; }
  .cloud-box h3 { margin: 0; font-size: 17px; display: flex; align-items: center; gap: 8px; }
  .cloud-box > p { margin: 0; font-size: 13.5px; color: var(--muted); line-height: 1.5; }
  .cloud-bar { height: 8px; border-radius: 4px; background: var(--surface-raised); overflow: hidden; }
  .cloud-bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .25s linear; }
  .cloud-meta { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .cloud-list { display: grid; gap: 6px; }
  .cloud-row { display: grid; grid-template-columns: 32px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: var(--radius-m); background: var(--surface-raised); font-size: 13px; }
  .cloud-row img { width: 32px; height: 32px; border-radius: 6px; image-rendering: pixelated; object-fit: cover; }
  .cloud-row small { display: block; color: var(--muted); font-size: 11.5px; }
  .cloud-row .st { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cloud-warn { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: var(--radius-m); background: color-mix(in srgb, var(--warn) 14%, transparent); color: var(--warn); font-size: 13px; }
  .cloud-acts { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
  .play-cloud-line { font-size: 12px; }
  /* Plusieurs PC (preview validée du 24/10) : bandeau « Nouveau PC », conflit d'appareils. */
  .play-remote { display:flex; gap:14px; align-items:center; padding:12px 14px; margin:0 0 10px; border-radius:var(--radius-l); border:1px solid color-mix(in srgb, var(--accent) 45%, var(--border)); background:color-mix(in srgb, var(--accent) 10%, var(--surface)); }
  .play-remote > div { flex:1; } .play-remote strong { font-size:13.5px; } .play-remote p { margin:4px 0 0; font-size:12.5px; opacity:.8; }
  .play-remote .join-btn { white-space:nowrap; }
  .cf-devs { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
  .cf-dev { padding:10px 12px; border-radius:var(--radius-m); border:1px solid var(--border); background:var(--surface-raised); font-size:12.5px; display:flex; flex-direction:column; gap:3px; }
  .cf-dev.new { border-color:color-mix(in srgb, var(--accent) 55%, var(--border)); }
  .cf-dev b { font-size:13px; }
  .cf-dev span { opacity:.75; }
  .play-split-line { color:var(--warn); font-size:12px; }
  /* Liste « Mes mondes » (variante B choisie le 25/10) : lignes fines, ▶ toujours visible, le reste
     dans « … », recherche et tri dès 8 mondes, filtres dès 16, sections repliables. */
  .play-cols.mv-wide { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
  @media (max-width: 900px) { .play-cols.mv-wide { grid-template-columns: 1fr; } }
  .mv-tools { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:0 0 10px; }
  .mv-search { flex:1 1 180px; min-width:0; display:flex; align-items:center; gap:6px; padding:0 10px; height:34px; border-radius:var(--radius-m); border:1px solid var(--border); background:var(--surface-raised); color:var(--muted); }
  .mv-search:focus-within { outline:2px solid var(--accent); outline-offset:1px; }
  .mv-search input { flex:1; min-width:0; border:0; background:none; color:var(--foreground); font:inherit; font-size:13px; outline:none; }
  .mv-select { height:34px; border-radius:var(--radius-m); border:1px solid var(--border); background:var(--surface-raised); color:var(--foreground); font:inherit; font-size:12.5px; padding:0 8px; }
  .mv-chips { display:flex; flex-wrap:wrap; gap:6px; margin:-2px 0 10px; }
  .mv-chip { font:inherit; font-size:12px; padding:4px 10px; border-radius:999px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; display:inline-flex; gap:5px; align-items:center; }
  .mv-chip[aria-pressed=true] { border-color:var(--accent); color:var(--foreground); background:color-mix(in srgb, var(--accent) 14%, transparent); }
  .mv-chip b { font-weight:600; font-variant-numeric:tabular-nums; }
  .mv-sec { margin:4px 0 12px; }
  .mv-sec-h { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); margin:0 0 6px; padding:0 2px; border:0; background:none; font-family:inherit; cursor:pointer; }
  .mv-sec-h svg { transition:transform .15s; }
  .mv-sec-h[aria-expanded=true] svg { transform:rotate(90deg); }
  .mv-sec-h .n { font-weight:600; opacity:.8; }
  .mv-list { display:flex; flex-direction:column; gap:4px; }
  .mv-row { display:grid; grid-template-columns:34px minmax(0,1fr) auto auto auto; align-items:center; gap:10px; min-height:52px; padding:6px 8px 6px 9px; border-radius:var(--radius-m); border:1px solid transparent; background:var(--surface); transition:background .12s, border-color .12s; }
  .mv-row:hover, .mv-row:focus-within { background:var(--surface-raised); border-color:var(--border); }
  .mv-row img { width:34px; height:34px; border-radius:7px; image-rendering:pixelated; object-fit:cover; display:block; }
  .mv-row.recent { min-height:58px; grid-template-columns:40px minmax(0,1fr) auto auto auto; }
  .mv-row.recent img { width:40px; height:40px; }
  .mv-row.cloud-only img { opacity:.6; }
  .mv-list.dim .mv-row { opacity:.75; }
  .mv-txt { min-width:0; display:flex; flex-direction:column; gap:1px; }
  .mv-name { font-size:13.5px; font-weight:600; color:var(--foreground); white-space:nowrap; overflow:hidden; display:flex; align-items:center; gap:6px; }
  .mv-name > span { overflow:hidden; text-overflow:ellipsis; }
  .mv-name .pin { color:var(--state-busy, #e3a73b); flex-shrink:0; display:inline-flex; }
  .mv-meta { font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; }
  .mv-st { display:flex; gap:6px; align-items:center; }
  .mv-ic { display:inline-flex; align-items:center; gap:4px; color:var(--success); }
  .mv-tag { display:inline-flex; align-items:center; gap:4px; font:inherit; font-size:11px; font-weight:600; padding:2px 7px; border:0; border-radius:999px; white-space:nowrap; }
  .mv-tag.warn { color:var(--warn); background:color-mix(in srgb, var(--warn) 13%, transparent); }
  button.mv-tag { cursor:pointer; }
  .mv-tag.off { color:var(--muted); background:color-mix(in srgb, var(--muted) 18%, transparent); }
  .mv-tag.busy { color:var(--accent-2); background:color-mix(in srgb, var(--accent) 14%, transparent); }
  .mv-play { height:36px; min-width:36px; padding:0 10px; border-radius:999px; border:1px solid var(--accent); background:color-mix(in srgb, var(--accent) 16%, transparent); color:var(--accent-2, var(--accent)); display:inline-flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; font:inherit; font-size:13px; font-weight:600; white-space:nowrap; transition:background .12s, color .12s; }
  .mv-play .lbl { display:none; }
  .mv-row:hover .mv-play:not(:disabled) .lbl, .mv-row:focus-within .mv-play:not(:disabled) .lbl, .mv-play.big .lbl { display:inline; }
  .mv-row:hover .mv-play:not(:disabled), .mv-play:focus-visible, .mv-play.big:not(:disabled) { background:var(--accent); color:var(--accent-foreground, #fff); }
  .mv-play:disabled { opacity:.45; cursor:not-allowed; border-color:var(--border); background:transparent; color:var(--muted); }
  .mv-play.dl { border-color:var(--border); background:transparent; color:var(--foreground); }
  .mv-run { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 12px; border-radius:999px; font-size:12.5px; font-weight:600; color:var(--success); background:color-mix(in srgb, var(--success) 14%, transparent); }
  .mv-run i { width:8px; height:8px; border-radius:50%; background:var(--success); animation:mvp 1.2s infinite; }
  @keyframes mvp { 50% { opacity:.3; } }
  .mv-dots { width:32px; height:32px; border-radius:var(--radius-m); border:0; background:none; color:var(--muted); cursor:pointer; display:grid; place-items:center; margin-left:4px; }
  .mv-dots:hover, .mv-dots[aria-expanded=true] { background:color-mix(in srgb, var(--foreground) 10%, transparent); color:var(--foreground); }
  .mv-more { width:100%; margin-top:6px; font:inherit; font-size:12.5px; padding:8px; border-radius:var(--radius-m); border:1px dashed var(--border); background:none; color:var(--muted); cursor:pointer; }
  .mv-more:hover { color:var(--foreground); border-color:var(--accent); }
  .mv-empty { text-align:center; padding:24px 10px; font-size:13px; color:var(--muted); border:1px dashed var(--border); border-radius:var(--radius-l); }
  .mv-menu { position:fixed; z-index:250; min-width:230px; padding:6px; border-radius:var(--radius-l); border:1px solid var(--border); background:var(--surface); box-shadow:0 18px 48px -14px rgba(0,0,0,.6); display:grid; gap:1px; }
  .mv-menu button { font:inherit; font-size:13px; text-align:left; padding:8px 10px; border-radius:var(--radius-m); border:0; background:none; color:var(--foreground); cursor:pointer; display:flex; align-items:center; gap:8px; }
  .mv-menu button:hover, .mv-menu button:focus-visible { background:var(--surface-raised); outline:none; }
  .mv-menu .danger { color:var(--warn); }
  .mv-menu hr { border:0; border-top:1px solid var(--border); margin:4px 2px; }
  .mv-menu .sw { margin-left:auto; width:30px; height:17px; border-radius:9px; background:color-mix(in srgb, var(--foreground) 22%, transparent); position:relative; flex-shrink:0; }
  .mv-menu .sw::after { content:""; position:absolute; top:2px; left:2px; width:13px; height:13px; border-radius:50%; background:#fff; transition:transform .15s; }
  .mv-menu .sw.on { background:var(--success); }
  .mv-menu .sw.on::after { transform:translateX(13px); }
  `;
  document.head.appendChild(css);

  // --- Bouton du menu de gauche, sous « Serveurs » ---------------------------------------
  const sidebar = document.getElementById("sidebar");
  const navServers = document.getElementById("nav-servers");
  const nav = document.createElement("button");
  nav.id = "nav-play";
  nav.type = "button";
  nav.className = "sidebar-btn";
  navServers.after(nav);
  // Laboratoire (25/10) : l'onglet n'existe que si le site dit « visible » pour ce joueur ;
  // le badge « Bêta » suit l'état du mode Jouer (tout sauf « Pour tous »). Voir features.js.
  let playVisible = false;
  let betaBadge = true;
  nav.hidden = true;
  function applyFeatures(state) {
    const f = state?.play || {};
    const wasVisible = playVisible;
    playVisible = f.visible === true;
    betaBadge = f.beta !== false;
    nav.hidden = !playVisible;
    drawNav();
    if (!playVisible) {
      if (!panel.hidden) {
        panel.hidden = true;
        nav.classList.remove("active");
        document.getElementById("nav-home")?.click();
      }
      homePanel?.querySelector(".play-home-section")?.remove();
    } else if (!wasVisible) {
      refresh().catch(() => {});
    }
  }
  function drawNav() {
    nav.title = betaBadge ? `${T("nav")} (${T("beta")})` : T("nav");
    nav.innerHTML = `${CUBE}<span class="sidebar-label">${esc(T("nav"))}</span>${betaBadge ? `<span class="sidebar-beta">${esc(T("beta"))}</span>` : ""}`;
  }
  drawNav();

  const main = document.querySelector("main");
  const panel = document.createElement("div");
  panel.id = "play-panel";
  panel.className = "detail";
  panel.hidden = true;
  main.appendChild(panel);

  const OTHER_PANELS = ["home-panel", "status", "list", "list-toolbar", "list-title", "detail", "settings-panel", "account-panel", "favorites-panel", "recent-panel", "my-instances-panel", "friends-panel", "help-panel"];
  function showPlay() {
    for (const id of OTHER_PANELS) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
    try {
      updateGuestBanner(false);
    } catch {
      /* bandeau visiteur absent */
    }
    sidebar.querySelectorAll(".sidebar-btn").forEach((b) => b.classList.remove("active"));
    nav.classList.add("active");
    panel.hidden = false;
    refresh().then(maybeOfferCloud);
  }
  nav.addEventListener("click", showPlay);
  // Une autre vue s'affiche (menu, lien, notification…) : l'onglet Jouer se cache.
  const hideObserver = new MutationObserver(() => {
    if (panel.hidden) return;
    if (OTHER_PANELS.some((id) => document.getElementById(id)?.hidden === false)) {
      panel.hidden = true;
      nav.classList.remove("active");
    }
  });
  for (const id of OTHER_PANELS) {
    const el = document.getElementById(id);
    if (el) hideObserver.observe(el, { attributes: true, attributeFilter: ["hidden"] });
  }
  sidebar.addEventListener("click", (e) => {
    const btn = e.target.closest(".sidebar-btn");
    if (btn && btn !== nav && btn.id !== "sidebar-toggle") nav.classList.remove("active");
  }, true);

  function toast(text) {
    document.querySelectorAll(".undo-toast.play").forEach((e) => e.remove());
    const el = document.createElement("div");
    el.className = "undo-toast play";
    el.setAttribute("role", "status");
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }
  function overlay(html, { className = "play-modal" } = {}) {
    const ov = document.createElement("div");
    ov.className = className;
    ov.innerHTML = html;
    document.body.appendChild(ov);
    const onKey = (e) => {
      if (e.key === "Escape" && !ov.dataset.locked) close();
    };
    const close = () => {
      ov.remove();
      document.removeEventListener("keydown", onKey, true);
    };
    document.addEventListener("keydown", onKey, true);
    ov.addEventListener("mousedown", (e) => {
      if (e.target === ov && !ov.dataset.locked) close();
    });
    return { ov, close, $: (sel) => ov.querySelector(sel) };
  }

  // --- Données ------------------------------------------------------------------------------
  const data = { versions: [], worlds: [], packs: [], mcVersions: null, running: null, cloud: null, job: null, djob: null };
  async function loadPacks(force = false) {
    const r = await api.packs({ force }).catch(() => null);
    if (r) {
      data.packs = Array.isArray(r.packs) ? r.packs : [];
    }
  }
  async function refresh() {
    if (!playVisible) return;
    const [v, w] = await Promise.all([api.listVersions(), api.listWorlds()]);
    data.versions = v?.versions || [];
    data.worlds = w?.worlds || [];
    // main.js ne connaît que la version lancée : on garde le monde lancé depuis sa ligne.
    const prevKey = data.running?.versionId === w?.running?.versionId ? data.running?.worldKey : null;
    data.running = w?.running ? { ...w.running, worldKey: prevKey || null } : null;
    if (!panel.hidden) render();
    injectHome();
    loadPacks().then(() => !panel.hidden && render());
    loadCloud().then(() => !panel.hidden && render());
  }
  api.onWorldsChanged(() => refresh());
  window.mchub.onGameState?.((running) => {
    if (!running) data.running = null;
    if (!panel.hidden) render();
  });

  // --- Rendu de l'onglet --------------------------------------------------------------------
  function header() {
    return `<div class="instances-header"><div><h2>${esc(T("nav"))}${betaBadge ? `<span class="play-beta-tag">${esc(T("beta"))}</span>` : ""}</h2><p class="join-note">${esc(T("sub"))}</p></div></div>`;
  }
  function versionRow(v) {
    const label = v.name || v.minecraftVersion;
    const badge = v.pack ? `<span class="instance-badge offline-available">${esc(packName(v.pack))}</span>` : `<span class="instance-badge paused">Vanilla</span>`;
    const isRunning = data.running?.versionId === v.id;
    return `<div class="instance-card" style="padding:10px 12px;">
      <span class="instance-card-icon">${CUBE.replace("<svg", '<svg width="20" height="20"')}</span>
      <div class="instance-card-body"><div class="instance-card-title"><h3>${esc(label)}</h3>${badge}</div>
        <p class="instance-card-meta">${v.name ? `${esc(v.minecraftVersion)} · ` : ""}${v.pack ? `${v.modCount} ${esc(T("mods"))} · ` : ""}${esc(v.lastPlayedAt ? T("lastPlayed", { t: ago(v.lastPlayedAt) }) : T("never"))}</p></div>
      <div class="instance-card-actions" style="display:flex;gap:6px;align-items:center;">
        <button type="button" class="link-btn" data-del-version="${esc(v.id)}" style="font-size:12px;">${esc(T("remove"))}</button>
        <button type="button" class="join-btn" data-play-version="${esc(v.id)}" ${isRunning ? "disabled" : ""}>${esc(isRunning ? T("playing") : T("play"))}</button>
      </div>
    </div>`;
  }
  // Monde du cloud pas encore sur ce PC (autre PC du même compte, Supporter) : « Pas sur ce PC ».
  const downloading = (cw) => data.djob && !data.djob.done && data.djob.items.some((i) => i.worldId === cw.id && !i.done && !i.error);
  // Bandeau « Nouveau PC » : la taille exacte à télécharger ; la place libre est vérifiée avant.
  function remoteBannerHtml(cloudOnly) {
    const rem = cloudOnly.filter((cw) => !downloading(cw));
    if (!rem.length || (data.djob && !data.djob.done)) return "";
    const fr = L() === "fr";
    const n = rem.length;
    // Toutes les versions de chaque monde viennent sur ce PC : taille exacte de leurs .zip.
    const tot = rem.reduce((a, cw) => a + (cw.totalBytes || cw.sizeBytes || 0), 0);
    return `<div class="play-remote">
      <div><strong>${fr ? `${data.worlds.length ? "" : "Nouveau PC : "}${n} monde${n > 1 ? "s" : ""} t'attend${n > 1 ? "ent" : ""} dans le cloud` : `${data.worlds.length ? "" : "New PC: "}${n} world${n > 1 ? "s" : ""} waiting in the cloud`}</strong>
      <p>${fr ? `${sizeFmt(tot)} à télécharger, avec toutes leurs versions (les mêmes que sur le site) : il faut au moins cette place de libre sur ce PC. On vérifie la place avant de commencer. La version et le pack de chaque monde s'installent avec lui.` : `${sizeFmt(tot)} to download, with all their versions (the same as on the website): you need at least that much free space on this PC. We check the space before starting. Each world's version and pack install with it.`}</p></div>
      <button type="button" class="join-btn" data-cloud-download-all>↓ ${fr ? "Télécharger mes mondes" : "Download my worlds"}</button></div>`;
  }

  // --- Liste « Mes mondes » (variante B, choisie par Rushi le 25/10) ---------------------------
  // Lignes fines avec ▶ toujours visible ; sauvegardes, interrupteur, épingler, masquer, dossier et
  // cloud dans le menu « … ». Recherche et tri dès 8 mondes, filtres dès 16. Sections Récents (3),
  // Épinglés et Tous mes mondes qu'on ouvre et ferme ; mondes masqués et mondes seulement dans le
  // cloud repliés en bas. Épinglés, masqués, tri et sections ouvertes restent sur ce PC.
  const MV_ICON = {
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    dots: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z"/><path d="m9.5 13.5 2 2 3.5-3.5"/></svg>',
    cloudWarn: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z"/><path d="M12 11v3M12 16.3v.01"/></svg>',
    shieldOff: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 1.6-.8 3-1.9 4.1-3.2M19 13.5V6l-7-3"/><path d="m3 3 18 18"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2L3 9.4l6.2-.9z"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  };
  const MV_KEY = "omni-play-worlds";
  const mv = { q: "", filter: "all", ver: "", showAll: false, sort: "recent", pins: new Set(), hidden: new Set(), open: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(MV_KEY) || "{}");
    if (["recent", "name", "size"].includes(saved.sort)) mv.sort = saved.sort;
    if (Array.isArray(saved.pins)) mv.pins = new Set(saved.pins);
    if (Array.isArray(saved.hidden)) mv.hidden = new Set(saved.hidden);
    if (saved.open && typeof saved.open === "object") mv.open = saved.open;
  } catch {}
  function mvSave() {
    try {
      localStorage.setItem(MV_KEY, JSON.stringify({ sort: mv.sort, pins: [...mv.pins], hidden: [...mv.hidden], open: mv.open }));
    } catch {}
  }
  // Sections ouvertes par défaut, sauf les mondes masqués et ceux seulement dans le cloud (sauf
  // s'il n'y a aucun monde sur ce PC : on les montre).
  const mvOpen = (k, def = true) => (typeof mv.open[k] === "boolean" ? mv.open[k] : def);
  const mvCloudOf = (key) => data.cloud?.worlds?.find((x) => x.worldKey === key) || null;
  function mvSorted(list) {
    const a = [...list];
    if (mv.sort === "name") a.sort((x, y) => String(x.name).localeCompare(String(y.name), L()));
    else if (mv.sort === "size") a.sort((x, y) => (y.sizeBytes || 0) - (x.sizeBytes || 0));
    else a.sort((x, y) => (y.lastPlayed || 0) - (x.lastPlayed || 0));
    return a;
  }
  const mvVersion = (w) => w.lastVersionLabel?.minecraftVersion || w.minecraftVersion || "";
  const mvPack = (w) => (w.lastVersionLabel ? (w.lastVersionLabel.pack ? packName({ name: w.lastVersionLabel.pack }) : "Vanilla") : "");
  const mvNotCloud = (w) => !!data.cloud?.offer?.cloud && w.backup && !mvCloudOf(w.key);
  function mvFiltered() {
    const q = mv.q.trim().toLowerCase();
    return data.worlds.filter((w) => {
      if (q && !`${w.name} ${mvVersion(w)} ${mvPack(w)} ${w.lastVersionLabel?.name || ""}`.toLowerCase().includes(q)) return false;
      if (mv.filter === "notcloud" && !mvNotCloud(w)) return false;
      if (mv.filter === "off" && w.backup) return false;
      if (mv.ver && mvVersion(w) !== mv.ver) return false;
      return true;
    });
  }
  const mvSearching = () => !!(mv.q.trim() || mv.filter !== "all" || mv.ver);
  function mvMeta(w) {
    const lv = w.lastVersionLabel;
    const ver = lv ? lv.name || `${lv.minecraftVersion} · ${mvPack(w)}` : w.minecraftVersion || "";
    const bk = w.backups === 0 ? T("mvBk0") : w.backups === 1 ? T("mvBk1") : T("mvBk", { n: w.backups });
    return [ver, w.lastPlayed ? ago(w.lastPlayed) : "", bk, sizeFmt(w.sizeBytes)].filter(Boolean).map(esc).join(" · ");
  }
  function mvStatus(w) {
    const fr = L() === "fr";
    if (!w.backup) return `<span class="mv-tag off" title="${esc(T("bkpOffTip"))}">${MV_ICON.shieldOff}${esc(T("off"))}</span>`;
    const c = data.cloud;
    if (!c?.offer?.cloud) return "";
    if (data.job && !data.job.done && data.job.items.some((i) => i.key === w.key && !i.done)) return `<span class="mv-tag busy">☁ ${esc(T("sending"))}</span>`;
    const cw = mvCloudOf(w.key);
    if (cw?.split) return `<button type="button" class="mv-tag warn" data-split="${esc(w.key)}" title="${fr ? "Choisir laquelle continuer" : "Choose which to continue"}">⚠ ${esc(T("mvSplit"))}</button>`;
    if (cw?.restorePending) return `<span class="mv-tag warn" title="${esc(T("restorePending"))}">☁ …</span>`;
    if (!cw) return `<span class="mv-tag warn" title="${esc(T("notInCloud"))}">${MV_ICON.cloudWarn}${esc(T("notInCloud"))}</span>`;
    const n = cw.versionCount || 1;
    const tip = `${T("inCloud")} · ${T(n > 1 ? "cloudVers" : "cloudVer", { n })} · ${T("zipped", { s: sizeFmt(cw.sizeBytes) })}${w.lastBackupAt ? ` · ${T("saved", { t: ago(w.lastBackupAt) })}` : ""}`;
    return `<span class="mv-ic" title="${esc(tip)}" aria-label="${esc(T("inCloud"))}">${MV_ICON.cloud}</span>`;
  }
  function mvPlayBtn(w, big) {
    if (data.running?.worldKey === w.key) return `<span class="mv-run" aria-live="polite"><i></i>${esc(T("mvRunning"))}</span>`;
    const tip = esc(T("mvPlayTip", { w: w.name }));
    return `<button type="button" class="mv-play${big ? " big" : ""}" data-play-world="${esc(w.key)}" aria-label="${tip}" ${data.running ? `disabled title="${esc(T("mvBusy"))}"` : `title="${tip}"`}>${MV_ICON.play}<span class="lbl">${esc(T("play"))}</span></button>`;
  }
  function mvRow(w, cls = "") {
    const pin = mv.pins.has(w.key) ? `<span class="pin" title="${esc(T("mvPinned"))}">${MV_ICON.pin}</span>` : "";
    return `<div class="mv-row ${cls}" data-world="${esc(w.key)}">
      <img src="${worldThumb(w)}" alt="">
      <div class="mv-txt"><div class="mv-name">${pin}<span class="sensitive" data-mask="${esc(T("mvMask"))}" title="${esc(w.name)}">${esc(w.name)}</span></div><div class="mv-meta">${mvMeta(w)}</div></div>
      <div class="mv-st">${mvStatus(w)}</div>
      ${mvPlayBtn(w, cls.includes("recent"))}
      <button type="button" class="mv-dots" data-mv-menu="${esc(w.key)}" aria-label="${esc(T("mvMenu"))} : ${esc(w.name)}" aria-haspopup="menu" aria-expanded="false">${MV_ICON.dots}</button>
    </div>`;
  }
  function mvCloudRow(cw) {
    const busy = downloading(cw);
    const meta = `${cw.minecraftVersion ? `Minecraft ${cw.minecraftVersion}` : "Minecraft"} · ${cw.packName || "Vanilla"}${cw.headDeviceName ? ` · ${cw.headDeviceName}` : ""} · ${sizeFmt(cw.totalBytes || cw.sizeBytes)}`;
    const tip = esc(T("mvDlTip", { w: cw.name }));
    return `<div class="mv-row cloud-only" data-cloud-world="${esc(cw.id)}">
      <img src="${grassThumb(cw.worldKey)}" alt="">
      <div class="mv-txt"><div class="mv-name"><span class="sensitive" data-mask="${esc(T("mvMask"))}" title="${esc(cw.name)}">${esc(cw.name)}</span></div><div class="mv-meta">${busy ? `↓ ${L() === "fr" ? "Téléchargement en cours (voir en haut à droite)" : "Downloading (see top right)"}` : esc(meta)}</div></div>
      <div class="mv-st"><span class="mv-ic" style="color:var(--accent-2)" title="${esc(T("cloudOnly"))}">${MV_ICON.cloud}</span></div>
      <button type="button" class="mv-play dl" data-cloud-download="${esc(cw.id)}" aria-label="${tip}" title="${tip}" ${busy || (data.djob && !data.djob.done) ? "disabled" : ""}>${MV_ICON.down}<span class="lbl">${esc(T("download").split(" ")[0])}</span></button>
      <span></span>
    </div>`;
  }
  function mvSection(key, title, n, body, def = true) {
    const open = mvOpen(key, def);
    return `<div class="mv-sec"><button type="button" class="mv-sec-h" data-mv-toggle="${esc(key)}" aria-expanded="${open}">${MV_ICON.chev}${esc(title)} <span class="n">(${n})</span></button>${open ? body : ""}</div>`;
  }
  function mvLimited(list, mk) {
    const max = 30;
    if (mv.showAll || list.length <= max) return list.map(mk).join("");
    return list.slice(0, max).map(mk).join("") + `<button type="button" class="mv-more" data-mv-more>${esc(T("mvMore", { n: list.length - max }))}</button>`;
  }
  function mvTools() {
    const N = data.worlds.length;
    if (N < 8) return "";
    const vers = [...new Set(data.worlds.map(mvVersion).filter(Boolean))].sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
    const nNot = data.worlds.filter(mvNotCloud).length;
    const nOff = data.worlds.filter((w) => !w.backup).length;
    const chip = (f, label, n) => `<button type="button" class="mv-chip" data-mv-filter="${f}" aria-pressed="${mv.filter === f}">${label} <b>${n}</b></button>`;
    const chips = N >= 16
      ? `<div class="mv-chips" role="group">${chip("all", esc(T("mvFAll")), N)}${data.cloud?.offer?.cloud ? chip("notcloud", `${MV_ICON.cloudWarn}${esc(T("mvFNotCloud"))}`, nNot) : ""}${chip("off", `${MV_ICON.shieldOff}${esc(T("mvFOff"))}`, nOff)}${vers.length > 1 ? `<select class="mv-select" data-mv-ver style="height:26px;border-radius:999px;font-size:12px;" aria-label="${esc(T("mvAllVersions"))}"><option value="">${esc(T("mvAllVersions"))}</option>${vers.map((v) => `<option value="${esc(v)}" ${mv.ver === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>` : ""}</div>`
      : "";
    const sorts = { recent: "mvSortRecent", name: "mvSortName", size: "mvSortSize" };
    return `<div class="mv-tools">
        <label class="mv-search">${MV_ICON.search}<input type="search" data-mv-q value="${esc(mv.q)}" placeholder="${esc(T("mvSearch"))}" aria-label="${esc(T("mvSearch"))}"></label>
        <select class="mv-select" data-mv-sort aria-label="${esc(T("mvSort"))}">${Object.entries(sorts).map(([k, l]) => `<option value="${k}" ${mv.sort === k ? "selected" : ""}>${esc(T("mvSort"))} : ${esc(T(l))}</option>`).join("")}</select>
      </div>${chips}`;
  }
  // Le corps de la liste (sans la recherche) : redessiné seul pendant la frappe, pour garder le
  // curseur dans le champ.
  function mvBody(cloudOnly) {
    if (mvSearching()) {
      const list = mvSorted(mvFiltered());
      return list.length ? `<div class="mv-list">${mvLimited(list, (w) => mvRow(w))}</div>` : `<div class="mv-empty">${esc(T("mvNone"))}</div>`;
    }
    const N = data.worlds.length;
    const visible = data.worlds.filter((w) => !mv.hidden.has(w.key));
    const hid = mvSorted(data.worlds.filter((w) => mv.hidden.has(w.key)));
    let h = "";
    if (N < 8) {
      // Peu de mondes : une seule liste, les épinglés d'abord.
      const list = [...mvSorted(visible.filter((w) => mv.pins.has(w.key))), ...mvSorted(visible.filter((w) => !mv.pins.has(w.key)))];
      if (list.length) h += `<div class="mv-list" style="margin-bottom:12px;">${list.map((w) => mvRow(w)).join("")}</div>`;
    } else {
      const pinned = mvSorted(visible.filter((w) => mv.pins.has(w.key)));
      const rest = visible.filter((w) => !mv.pins.has(w.key));
      const recent = [...rest].sort((x, y) => (y.lastPlayed || 0) - (x.lastPlayed || 0)).slice(0, 3);
      const recentKeys = new Set(recent.map((w) => w.key));
      const others = mvSorted(rest.filter((w) => !recentKeys.has(w.key)));
      if (recent.length) h += mvSection("recent", T("mvRecent"), recent.length, `<div class="mv-list">${recent.map((w) => mvRow(w, "recent")).join("")}</div>`);
      if (pinned.length) h += mvSection("pinned", T("mvPinned"), pinned.length, `<div class="mv-list">${pinned.map((w) => mvRow(w)).join("")}</div>`);
      if (others.length) h += mvSection("others", T("mvOthers"), others.length, `<div class="mv-list">${mvLimited(others, (w) => mvRow(w))}</div>`);
    }
    if (hid.length) h += mvSection("hidden", T("mvHidden"), hid.length, `<div class="mv-list dim">${hid.map((w) => mvRow(w)).join("")}</div>`, false);
    if (cloudOnly.length) h += mvSection("cloud", T("mvCloudOnly"), cloudOnly.length, `<div class="mv-list">${cloudOnly.map(mvCloudRow).join("")}</div>`, !data.worlds.length);
    return h;
  }
  const mvCloudOnly = () => {
    const localKeys = new Set(data.worlds.map((w) => w.key));
    return (data.cloud?.offer?.cloud ? data.cloud.worlds || [] : []).filter((cw) => !localKeys.has(cw.worldKey));
  };
  function mvRedrawBody() {
    const el = panel.querySelector(".mv-body");
    if (el) el.innerHTML = mvBody(mvCloudOnly());
  }

  // Menu « … » d'un monde.
  let mvMenuEl = null;
  function mvCloseMenu() {
    if (!mvMenuEl) return;
    mvMenuEl.remove();
    mvMenuEl = null;
    document.removeEventListener("keydown", mvMenuKey, true);
    panel.querySelectorAll('.mv-dots[aria-expanded="true"]').forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  function mvMenuKey(e) {
    if (!mvMenuEl) return;
    const items = [...mvMenuEl.querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.stopPropagation();
      const key = mvMenuEl.dataset.key;
      mvCloseMenu();
      panel.querySelector(`.mv-dots[data-mv-menu="${CSS.escape(key)}"]`)?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  }
  function mvOpenMenu(btn, key) {
    mvCloseMenu();
    const w = data.worlds.find((x) => x.key === key);
    if (!w) return;
    const cw = data.cloud?.offer?.cloud ? mvCloudOf(key) : null;
    btn.setAttribute("aria-expanded", "true");
    const it = (act, label, extra = "") => `<button type="button" role="menuitem" data-act="${act}" ${extra}>${label}</button>`;
    mvMenuEl = document.createElement("div");
    mvMenuEl.className = "mv-menu";
    mvMenuEl.setAttribute("role", "menu");
    mvMenuEl.dataset.key = key;
    mvMenuEl.innerHTML = it("backups", esc(T("mvMBackups", { n: w.backups })))
      + it("auto", `${esc(T("mvMAuto"))}<span class="sw ${w.backup ? "on" : ""}"></span>`, `role="menuitemcheckbox" aria-checked="${w.backup}"`)
      + "<hr>"
      + it("pin", `${MV_ICON.pin} ${esc(T(mv.pins.has(key) ? "mvMUnpin" : "mvMPin"))}`)
      + it("hide", esc(T(mv.hidden.has(key) ? "mvMUnhide" : "mvMHide")))
      + it("folder", esc(T("openFolder")))
      + (cw?.split ? it("split", esc(T("mvMSplit"))) : "")
      + (cw ? `<hr>${it("uncloud", esc(T("mvMUncloud")), 'class="danger"')}` : "");
    document.body.appendChild(mvMenuEl);
    const r = btn.getBoundingClientRect();
    const mh = mvMenuEl.offsetHeight;
    const mw = mvMenuEl.offsetWidth;
    mvMenuEl.style.left = `${Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8))}px`;
    mvMenuEl.style.top = `${r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4}px`;
    mvMenuEl.querySelector("button")?.focus();
    document.addEventListener("keydown", mvMenuKey, true);
    mvMenuEl.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const a = b.dataset.act;
      mvCloseMenu();
      if (a === "backups") return openBackupsList(key);
      if (a === "auto") return toggleBackup(key);
      if (a === "folder") return api.openWorldFolder(key);
      if (a === "split") return openSplit(key);
      if (a === "uncloud") return mvUncloud(w);
      if (a === "pin") {
        if (mv.pins.has(key)) mv.pins.delete(key);
        else {
          mv.pins.add(key);
          mv.hidden.delete(key);
          toast(T("mvPinOk", { w: w.name }));
        }
      } else if (a === "hide") {
        if (mv.hidden.has(key)) mv.hidden.delete(key);
        else {
          mv.hidden.add(key);
          mv.pins.delete(key);
          toast(T("mvHideOk", { w: w.name }));
        }
      }
      mvSave();
      render();
    });
  }
  document.addEventListener("mousedown", (e) => {
    if (mvMenuEl && !mvMenuEl.contains(e.target) && !e.target.closest(".mv-dots")) mvCloseMenu();
  });
  window.addEventListener("resize", () => mvCloseMenu());
  panel.addEventListener("scroll", () => mvCloseMenu(), true);
  // Même confirmation que dans « Synchroniser mes mondes ».
  async function mvUncloud(w) {
    const fr = L() === "fr";
    const r = await showModal({
      title: fr ? `Retirer « ${w.name} » du cloud ?` : `Remove “${w.name}” from the cloud?`,
      body: fr ? "Ses sauvegardes en ligne sont supprimées pour de bon. Le monde reste sur ton PC, avec ses sauvegardes locales." : "Its online backups are deleted for good. The world stays on your PC, with its local backups.",
      confirmLabel: fr ? "Oui, retirer" : "Yes, remove",
      cancelLabel: fr ? "Non" : "No",
      tone: "warn",
    });
    if (!r?.confirmed) return;
    const out = await api.cloud.remove(w.key);
    if (!out?.ok) return toast(out?.error || "");
    await loadCloud(true);
    render();
    toast(fr ? `« ${w.name} » retiré du cloud. Il est toujours sur ton PC.` : `“${w.name}” removed from the cloud. It is still on your PC.`);
  }
  panel.addEventListener("input", (e) => {
    if (!e.target.matches?.("[data-mv-q]")) return;
    mv.q = e.target.value;
    mv.showAll = false;
    mvRedrawBody();
  });
  panel.addEventListener("change", (e) => {
    if (e.target.matches?.("[data-mv-sort]")) {
      mv.sort = e.target.value;
      mvSave();
      mvRedrawBody();
    } else if (e.target.matches?.("[data-mv-ver]")) {
      mv.ver = e.target.value;
      mvRedrawBody();
    }
  });
  // Flèches haut et bas : passer d'un monde à l'autre au clavier.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rowEl = document.activeElement?.closest?.(".mv-row");
    if (!rowEl || !panel.contains(rowEl)) return;
    const rows = [...panel.querySelectorAll(".mv-row")];
    const next = rows[rows.indexOf(rowEl) + (e.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    (next.querySelector(".mv-play:not(:disabled), .mv-dots") || next).focus();
  });

  function render() {
    mvCloseMenu();
    const fr = L() === "fr";
    const localKeys = new Set(data.worlds.map((w) => w.key));
    const cloudOnly = (data.cloud?.offer?.cloud ? data.cloud.worlds || [] : []).filter((cw) => !localKeys.has(cw.worldKey));
    if (!data.versions.length && !data.worlds.length && !cloudOnly.length) {
      panel.innerHTML = `${header()}
        <div class="play-welcome">
          <span class="empty-state-icon">${CUBE}</span>
          <h3>${esc(T("welcomeT"))}</h3><p>${esc(T("welcomeD"))}</p>
          <ol class="play-steps">
            <li><b>1</b><strong>${esc(T("step1T"))}</strong>${esc(T("step1D"))}</li>
            <li><b>2</b><strong>${esc(T("step2T"))}</strong>${esc(T("step2D"))}</li>
            <li><b>3</b><strong>${esc(T("step3T"))}</strong>${esc(T("step3D"))}</li>
          </ol>
          <div class="acts"><button type="button" class="join-btn" data-new-version>+ ${esc(T("newV"))}</button><button type="button" class="btn-secondary" data-import style="margin:0;">${esc(T("import"))}</button></div>
        </div>`;
      return;
    }
    const versions = data.versions.length
      ? `<div class="instance-grid">${data.versions.map(versionRow).join("")}</div>`
      : `<div class="play-col-empty"><p>${esc(T("noVersions"))}</p></div>`;
    const worlds = data.worlds.length || cloudOnly.length
      ? `${mvTools()}<div class="mv-body">${mvBody(cloudOnly)}</div>`
      : `<div class="play-col-empty"><span class="empty-state-icon">${CUBE}</span><p>${esc(T("noWorlds"))}</p><button type="button" class="btn-secondary" data-import style="margin:4px 0 0;">${esc(T("import"))}</button></div>`;
    const sup = data.cloud?.offer?.cloud;
    const missing = sup && data.worlds.some((w) => w.backup && !data.cloud.worlds?.some((x) => x.worldKey === w.key));
    const syncBtn = sup && data.worlds.length
      ? `<button type="button" class="btn-secondary" data-sync ${data.job && !data.job.done ? "disabled" : ""} style="margin:0;padding:5px 12px;font-size:12.5px;">☁ ${esc(T("sync"))}${missing ? ' <span style="color:var(--warn);">•</span>' : ""}</button>`
      : "";
    panel.innerHTML = `${header()}
      ${cloudBannerHtml()}
      ${remoteBannerHtml(cloudOnly)}
      <div class="play-cols${data.worlds.length >= 8 ? " mv-wide" : ""}">
        <div><div class="home-section" style="margin:0;">
          <div class="home-section-header"><h3>${esc(T("mine"))}</h3><button type="button" class="join-btn" data-new-version style="margin-left:auto;">+ ${esc(T("newV"))}</button></div>
          ${versions}
        </div></div>
        <div><div class="home-section" style="margin:0;">
          <div class="home-section-header"><h3>${esc(T("mvAll"))}${data.worlds.length ? ` <span style="font-weight:500;color:var(--muted);font-size:.85em;">(${data.worlds.length})</span>` : ""}</h3><span style="margin-left:auto;display:flex;gap:12px;align-items:center;">${data.worlds.length ? `<button type="button" class="link-btn" data-bk-settings title="${fr ? "Réglages des sauvegardes" : "Backup settings"}" style="font-size:12.5px;">⚙ ${fr ? "Réglages" : "Settings"}</button>` : ""}${syncBtn}<button type="button" class="link-btn" data-import style="font-size:12.5px;">${esc(T("import"))}</button></span></div>
          ${worlds}
        </div></div>
      </div>`;
    void fr;
  }

  panel.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-new-version")) return openNewVersion();
    if (b.hasAttribute("data-import")) return openImport();
    if (b.hasAttribute("data-sync")) return openCloudSync({ resync: true });
    if (b.dataset.playVersion) return launch({ versionId: b.dataset.playVersion }, b);
    if (b.dataset.playWorld) return launch({ worldKey: b.dataset.playWorld }, b);
    if (b.dataset.delVersion) return removeVersion(b.dataset.delVersion);
    if (b.dataset.switch) return toggleBackup(b.dataset.switch);
    if (b.dataset.mvMenu) return b.getAttribute("aria-expanded") === "true" ? mvCloseMenu() : mvOpenMenu(b, b.dataset.mvMenu);
    if (b.dataset.mvToggle) {
      mv.open[b.dataset.mvToggle] = b.getAttribute("aria-expanded") !== "true";
      mvSave();
      return mvRedrawBody();
    }
    if (b.dataset.mvFilter) {
      mv.filter = b.dataset.mvFilter;
      mv.showAll = false;
      panel.querySelectorAll("[data-mv-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      return mvRedrawBody();
    }
    if (b.hasAttribute("data-mv-more")) {
      mv.showAll = true;
      return mvRedrawBody();
    }
    if (b.dataset.history) return openBackupsList(b.dataset.history);
    if (b.hasAttribute("data-bk-settings")) return openHistory(null);
    if (b.dataset.cloudDownload) return downloadFromCloud([b.dataset.cloudDownload]);
    if (b.hasAttribute("data-cloud-download-all")) {
      const localKeys = new Set(data.worlds.map((w) => w.key));
      return downloadFromCloud((data.cloud?.worlds || []).filter((cw) => !localKeys.has(cw.worldKey)).map((cw) => cw.id));
    }
    if (b.dataset.split) return openSplit(b.dataset.split);
    if (b.dataset.cloudBanner) return openCloudSync({ resync: false });
  });

  // --- Lancer ------------------------------------------------------------------------------
  // Même affichage que le lancement d'un serveur (renderer.js, launchOfflineInstance) : la pilule
  // passe tout de suite à « Lancement… » avec les étapes (Java, fichiers, mods, démarrage) et le
  // panneau s'ouvre, pour ne jamais laisser le joueur devant un écran sans rien (retour de test du
  // 24/10 : 1 min 30 sans signe de vie au premier lancement, le temps des téléchargements).
  let lastLaunch = null; // { versionId, label } : nom lisible dans la pilule pendant la partie
  window.playRunningLabel = (slug) => {
    const id = String(slug || "").replace(/^play:/, "");
    if (lastLaunch?.versionId === id) return lastLaunch.label;
    const v = data.versions.find((x) => x.id === id);
    return v ? versionLabel(v) : "Minecraft";
  };
  function versionLabel(v) {
    return v.name || `Minecraft ${v.minecraftVersion}${v.pack ? ` · ${packName(v.pack)}` : ""}`;
  }

  async function launch(opts, btn) {
    if (!signedIn) {
      const ok = await attemptSignIn(true);
      if (!ok) return;
    }
    if (launchInProgress) return;
    // Plusieurs PC : monde du cloud ouvert ou joué sur un autre appareil ? (un appel au site, et
    // seulement pour un monde déjà dans le cloud)
    if (opts.worldKey) {
      if (btn) btn.disabled = true;
      const go = await checkDevices(opts.worldKey).catch(() => true);
      if (btn) btn.disabled = false;
      if (!go) return;
    }
    const v = opts.versionId ? data.versions.find((x) => x.id === opts.versionId) : null;
    const w = opts.worldKey ? data.worlds.find((x) => x.key === opts.worldKey) : null;
    const wv = (opts.versionId && data.versions.find((x) => x.id === opts.versionId)) || (w?.lastVersionId ? data.versions.find((x) => x.id === w.lastVersionId) : null);
    const label = w ? `${w.name} · ${wv ? versionLabel(wv) : `Minecraft ${w.minecraftVersion || ""}`.trim()}` : v ? versionLabel(v) : "Minecraft";
    const oldHtml = btn?.innerHTML;
    if (btn) {
      btn.disabled = true;
      btn.textContent = L() === "fr" ? "Préparation…" : "Preparing…";
    }
    launchInProgress = true;
    activity.current = { slug: opts.versionId ? `play:${opts.versionId}` : "play:pending", name: label };
    activity.failure = null;
    activity.launch = { percent: null, text: L() === "fr" ? "Préparation de Minecraft…" : "Preparing Minecraft…" };
    renderActivity();
    openActivityPanel();
    const stopListening = window.mchub.onGameProgress((status) => {
      if (!status || typeof status !== "object") return;
      const next = { ...(activity.launch || {}) };
      if (status.text) next.text = status.text;
      if (typeof status.task === "number" && typeof status.total === "number" && status.total > 0) {
        next.percent = Math.min(100, Math.round((status.task / status.total) * 100));
      }
      activity.launch = next;
      renderActivity();
    });
    let r;
    try {
      r = await api.launch(opts);
    } catch (error) {
      r = { ok: false, error: error?.message || String(error) };
    } finally {
      stopListening();
      launchInProgress = false;
      activity.launch = null;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
      }
    }
    if (r?.ok) {
      lastLaunch = { versionId: r.versionId, label };
      activity.current = { slug: `play:${r.versionId}`, name: label };
      data.running = { versionId: r.versionId, worldKey: opts.worldKey || null };
      // Mêmes réglages que pour un serveur : console (Débogage), et launcher réduit pendant la partie
      // (Divers > Pendant la partie) ; il revient à la fin du jeu, sauf en mode discret (main.js).
      window.mchub.settings.get().then((st) => {
        if (st?.openConsoleOnLaunch) window.mchub.logs.openConsole();
        if (st && st.minimizeWhilePlaying !== false) window.mchub.windowControls.minimize();
      }).catch(() => {});
      // Le jeu met encore quelques secondes à ouvrir sa fenêtre : « Minecraft va s'ouvrir… ».
      if (!gamePlaying) {
        launchStarting = true;
        setTimeout(() => {
          launchStarting = false;
          renderActivity();
        }, 60_000);
      }
      renderActivity();
      await refresh();
      return;
    }
    renderActivity();
    if (r?.cancelled) return;
    // Version du monde absente de Mes versions (ou illisible) : rien n'a été lancé, on demande.
    if (r?.code === "needVersion") return askCreateVersion(opts.worldKey, r, btn);
    if (r?.code === "chooseVersion") return askChooseVersion(opts.worldKey, r, btn);
    if (r?.code === "signin") {
      await attemptSignIn(true);
      return;
    }
    activity.failure = { slug: activity.current.slug, name: label, error: r?.error || "" };
    renderActivity();
    await showModal({ title: L() === "fr" ? "Lancement impossible" : "Could not start", body: r?.error || "", confirmLabel: "OK", tone: "warn" });
  }

  // Un monde ne s'ouvre JAMAIS avec une autre version que la sienne (une autre version peut
  // l'abîmer) : « Version non détectée… Veux-tu la créer ? », puis lancement avec elle.
  async function askCreateVersion(worldKey, r, btn) {
    const fr = L() === "fr";
    const mc = r.minecraftVersion;
    const name = r.worldName || data.worlds.find((x) => x.key === worldKey)?.name || "";
    const res = await showModal({
      title: fr ? "Version non détectée" : "Version not found",
      body: fr
        ? `« ${name} » a été créé avec Minecraft ${mc}, qui n'est pas dans Mes versions. Veux-tu créer cette version ? Elle sera téléchargée, puis le monde s'ouvrira avec elle. On n'ouvre jamais un monde avec une autre version : ça pourrait l'abîmer.`
        : `“${name}” was made with Minecraft ${mc}, which is not in My versions. Create this version? It will be downloaded, then the world opens with it. We never open a world with another version: it could damage it.`,
      confirmLabel: fr ? `Oui, créer Minecraft ${mc}` : `Yes, create Minecraft ${mc}`,
      cancelLabel: fr ? "Non" : "No",
      tone: "ok",
    });
    if (!res?.confirmed) return;
    const out = await api.createVersion({ minecraftVersion: mc, packId: null, name: "" });
    if (!out?.ok) return showModal({ title: fr ? "Création impossible" : "Could not create", body: out?.error || "", confirmLabel: "OK", tone: "warn" });
    await refresh();
    return launch({ worldKey, versionId: out.version.id }, btn);
  }
  // Très vieux monde dont la version ne se lit pas : le joueur choisit dans Mes versions.
  function askChooseVersion(worldKey, r, btn) {
    const fr = L() === "fr";
    const name = r.worldName || data.worlds.find((x) => x.key === worldKey)?.name || "";
    if (!data.versions.length) {
      return showModal({ title: fr ? "Version inconnue" : "Unknown version", body: fr ? `On n'a pas pu lire la version de Minecraft de « ${name} ». Crée d'abord la bonne version avec « + Nouvelle version », puis relance le monde.` : `We could not read the Minecraft version of “${name}”. First create the right version with “+ New version”, then start the world again.`, confirmLabel: "OK", tone: "warn" });
    }
    const rows = data.versions.map((v, i) => `<label class="play-row"><input type="radio" name="cv" value="${esc(v.id)}" ${i === 0 ? "checked" : ""}><span class="t">${esc(versionLabel(v))}<small>Minecraft ${esc(v.minecraftVersion)}</small></span></label>`).join("");
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cv-t" style="max-width:480px;text-align:left;">
      <h3 id="cv-t">${fr ? "Avec quelle version ouvrir ce monde ?" : "Which version should open this world?"}</h3>
      <p style="margin:0 0 6px;">${fr ? `On n'a pas pu lire la version de Minecraft de « ${esc(name)} ». Choisis celle avec laquelle il a été créé : une autre version pourrait l'abîmer.` : `We could not read the Minecraft version of “${esc(name)}”. Pick the one it was made with: another version could damage it.`}</p>
      <div class="play-list">${rows}</div>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" class="btn-secondary" data-cv="cancel">${fr ? "Annuler" : "Cancel"}</button>
        <button type="button" class="join-btn" data-cv="ok">${fr ? "Ouvrir avec celle-ci" : "Open with this one"}</button></div></div>`);
    m.ov.addEventListener("click", (ev) => {
      const q = ev.target.closest("[data-cv]");
      if (!q) return;
      const pick = m.ov.querySelector("input[name=cv]:checked")?.value;
      m.close();
      if (q.dataset.cv === "ok" && pick) launch({ worldKey, versionId: pick }, btn);
    });
  }

  // --- Plusieurs PC : conflit d'appareils (preview validée du 24/10) ----------------------------
  // Rien n'est jamais écrasé : si les deux copies avancent, le site garde les deux versions et le
  // joueur choisit laquelle continuer ; l'autre reste dans les sauvegardes.
  async function checkDevices(key, force = false) {
    const r = await api.cloud.beforePlay(key, { force });
    if (!r?.ok || !r.conflict) return true;
    return openConflict(key, r);
  }
  function openConflict(key, r) {
    const fr = L() === "fr";
    const w = data.worlds.find((x) => x.key === key);
    const name = w?.name || r.name || "";
    const c = r.conflict;
    const there = c.deviceName || (fr ? "un autre PC" : "another PC");
    const here = r.here || "PC";
    const kind = c.kind; // open | played | missing
    const title = kind === "open"
      ? (fr ? `« ${esc(name)} » est ouvert sur un autre appareil` : `“${esc(name)}” is open on another device`)
      : kind === "played"
        ? (fr ? `« ${esc(name)} » a été joué sur un autre appareil` : `“${esc(name)}” was played on another device`)
        : (fr ? `La dernière partie sur « ${esc(there)} » n'est pas arrivée` : `The last game on “${esc(there)}” has not arrived`);
    const thereLine = kind === "open"
      ? (fr ? `Ouvert ${c.since ? ago(c.since) : "en ce moment"} · ou sauvegarde en cours d'envoi` : `Open ${c.since ? ago(c.since) : "right now"} · or its backup is being sent`)
      : kind === "played"
        ? (fr ? `Joué ${ago(c.at)} · dans le cloud` : `Played ${ago(c.at)} · in the cloud`)
        : (fr ? `Dernier signe ${c.at ? ago(c.at) : "inconnu"} · pas encore dans le cloud` : `Last seen ${c.at ? ago(c.at) : "unknown"} · not in the cloud yet`);
    const hereLine = w?.lastPlayed ? (fr ? `Joué ${ago(w.lastPlayed)}` : `Played ${ago(w.lastPlayed)}`) : "";
    const body = kind === "played"
      ? (fr ? `La copie de ce PC est plus ancienne que celle de « ${esc(there)} ». Récupère d'abord la dernière version pour continuer là où tu t'étais arrêté.` : `This PC's copy is older than the one on “${esc(there)}”. Get the latest version first to continue where you left off.`)
      : kind === "open"
        ? (fr ? `Si tu joues ici en même temps, les deux parties avancent chacune de leur côté. Ferme d'abord le jeu sur « ${esc(there)} ». S'il a planté ou s'est éteint sans fermer le jeu, tu peux jouer quand même.` : `If you play here at the same time, both games move on separately. Close the game on “${esc(there)}” first. If it crashed or shut down without closing the game, you can play anyway.`)
        : (fr ? `« ${esc(there)} » s'est sans doute éteint avant d'avoir envoyé sa sauvegarde. Rallume-le avec le launcher pour qu'elle parte, ou joue avec la copie de ce PC.` : `“${esc(there)}” probably shut down before sending its backup. Turn it on with the launcher so it goes out, or play with this PC's copy.`);
    const acts = kind === "played"
      ? `<button type="button" class="btn-secondary" data-c="cancel">${fr ? "Annuler" : "Cancel"}</button>
         <button type="button" class="btn-secondary" data-c="anyway">${fr ? "Jouer avec la copie de ce PC" : "Play with this PC's copy"}</button>
         <button type="button" class="join-btn" data-c="fetch">↓ ${fr ? "Récupérer la dernière version et jouer" : "Get the latest version and play"}</button>`
      : `<button type="button" class="btn-secondary" data-c="cancel">${fr ? "Annuler" : "Cancel"}</button>
         <button type="button" class="btn-secondary" data-c="anyway">${kind === "open" ? (fr ? "Jouer quand même" : "Play anyway") : (fr ? "Jouer avec la copie de ce PC" : "Play with this PC's copy")}</button>
         <button type="button" class="join-btn" data-c="wait">${kind === "open" ? (fr ? "Me prévenir quand il est fermé" : "Tell me when it's closed") : (fr ? "Me prévenir quand elle arrive" : "Tell me when it arrives")}</button>`;
    return new Promise((resolve) => {
      const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cf-t" style="max-width:520px;text-align:left;">
        <h3 id="cf-t">⚠ ${title}</h3>
        <div class="cf-devs">
          <div class="cf-dev new"><b class="sensitive">${esc(there)}</b><span>${thereLine}</span></div>
          <div class="cf-dev"><b>${fr ? "Ce PC" : "This PC"} (<span class="sensitive">${esc(here)}</span>)</b><span>${hereLine}</span></div>
        </div>
        <p style="margin:12px 0 0;">${body}</p>
        <p class="bk-hint" style="margin-top:8px;">${fr ? "Rien n'est perdu : si les deux versions avancent, on garde les deux et tu choisis laquelle continuer. L'autre reste dans les sauvegardes." : "Nothing is lost: if both versions move on, we keep both and you choose which to continue. The other stays in the backups."}</p>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">${acts}</div></div>`);
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        m.close();
        resolve(v);
      };
      // Échap ou clic à côté : Annuler.
      new MutationObserver((_, obs) => {
        if (!document.body.contains(m.ov)) {
          obs.disconnect();
          finish(false);
        }
      }).observe(document.body, { childList: true });
      m.ov.addEventListener("click", async (ev) => {
        const q = ev.target.closest("[data-c]");
        if (!q) return;
        const choice = q.dataset.c;
        if (choice === "cancel") return finish(false);
        if (choice === "wait") {
          finish(false);
          await api.cloud.waitClosed(key);
          toast(kind === "open"
            ? (fr ? `On te prévient dès que « ${name} » est fermé sur « ${there} » et que sa sauvegarde est arrivée.` : `We'll tell you as soon as “${name}” is closed on “${there}” and its backup has arrived.`)
            : (fr ? `On te prévient dès que la sauvegarde de « ${there} » est arrivée.` : `We'll tell you as soon as the backup from “${there}” has arrived.`));
          return;
        }
        if (choice === "fetch") {
          m.ov.querySelectorAll("button").forEach((x) => (x.disabled = true));
          q.textContent = fr ? "Récupération…" : "Fetching…";
          const out = await api.cloud.fetchLatest(key);
          if (!out?.ok) {
            finish(false);
            showModal({ title: fr ? "Récupération impossible" : "Could not fetch", body: out?.error || "", confirmLabel: "OK", tone: "warn" });
            return;
          }
          toast(fr ? `Dernière version de « ${name} » récupérée depuis « ${there} ». Lancement…` : `Latest version of “${name}” fetched from “${there}”. Starting…`);
          await refresh();
          finish(await checkDevices(key, true));
          return;
        }
        // Jouer quand même / avec la copie de ce PC : on prend le verrou malgré tout.
        const out = await api.cloud.beforePlay(key, { force: true }).catch(() => null);
        if (kind !== "open") toast(fr ? `Partie lancée avec la copie de ce PC. La version de « ${there} » est gardée : tu choisiras laquelle continuer.` : `Game started with this PC's copy. The “${there}” version is kept: you'll choose which to continue.`);
        finish(out?.ok !== false);
      });
    });
  }
  api.cloud.onWaitDone((r) => {
    const fr = L() === "fr";
    const w = data.worlds.find((x) => x.key === r.key);
    const name = w?.name || "";
    let msg;
    if (r.timeout) msg = fr ? `« ${name} » est toujours ouvert sur l'autre PC : on a arrêté d'attendre.` : `“${name}” is still open on the other PC: we stopped waiting.`;
    else if (r.error) msg = fr ? `« ${name} » est fermé sur l'autre PC, mais la récupération a échoué : ${r.error}` : `“${name}” is closed on the other PC, but fetching failed: ${r.error}`;
    else msg = fr ? `✓ « ${name} » est fermé sur ${r.deviceName ? `« ${r.deviceName} »` : "l'autre PC"}.${r.fetched ? " La dernière version est arrivée :" : ""} tu peux jouer.` : `✓ “${name}” is closed on ${r.deviceName ? `“${r.deviceName}”` : "the other PC"}.${r.fetched ? " The latest version arrived:" : ""} you can play.`;
    toast(msg);
    if (typeof notifyIfAway === "function") notifyIfAway(fr ? "Monde prêt" : "World ready", msg);
    refresh();
  });

  // « 2 versions de ce monde · Choisir laquelle continuer ».
  function openSplit(key) {
    const fr = L() === "fr";
    const w = data.worlds.find((x) => x.key === key);
    const cw = data.cloud?.worlds?.find((x) => x.worldKey === key);
    if (!w || !cw?.split) return;
    const here = data.cloud?.device || "PC";
    const opt = (id, dev, at) => {
      const mine = id === cw.localBase;
      const label = mine ? (fr ? `Version de ce PC (${esc(here)})` : `This PC's version (${esc(here)})`) : (fr ? `Version de « ${esc(dev || "un autre PC")} »` : `“${esc(dev || "another PC")}” version`);
      return `<label class="play-row"><input type="radio" name="sp" value="${esc(id)}" ${mine ? "checked" : ""}><span class="t">${label}<small>${fr ? `Envoyée ${ago(at)}` : `Sent ${ago(at)}`}</small></span></label>`;
    };
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="sp-t" style="max-width:500px;text-align:left;">
      <h3 id="sp-t">${fr ? `Quelle version de « ${esc(w.name)} » continuer ?` : `Which version of “${esc(w.name)}” to continue?`}</h3>
      <p style="margin:0 0 10px;">${fr ? "Les deux ont avancé de leur côté. Celle que tu ne choisis pas reste dans les sauvegardes : tu pourras y revenir." : "Both moved on separately. The one you don't pick stays in the backups: you can go back to it."}</p>
      <div class="play-list">${opt(cw.latestVersionId, cw.headDeviceName, cw.updatedAt)}${opt(cw.split.versionId, cw.split.deviceName, cw.split.createdAt)}</div>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button type="button" class="btn-secondary" data-s="cancel">${fr ? "Plus tard" : "Later"}</button>
        <button type="button" class="join-btn" data-s="ok">${fr ? "Continuer celle-ci" : "Continue this one"}</button></div></div>`);
    if (!m.ov.querySelector("input[name=sp]:checked")) m.ov.querySelector("input[name=sp]").checked = true;
    m.ov.addEventListener("click", async (ev) => {
      const q = ev.target.closest("[data-s]");
      if (!q) return;
      if (q.dataset.s === "cancel") return m.close();
      const pick = m.ov.querySelector("input[name=sp]:checked").value;
      m.ov.querySelectorAll("button").forEach((x) => (x.disabled = true));
      q.textContent = fr ? "Un instant…" : "One moment…";
      const out = await api.cloud.resolveSplit(key, pick);
      m.close();
      if (!out?.ok) return showModal({ title: fr ? "Choix impossible" : "Could not choose", body: out?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(fr ? `C'est noté. L'autre version est gardée dans les sauvegardes de « ${w.name} ».` : `Done. The other version is kept in the backups of “${w.name}”.`);
      await loadCloud(true);
      refresh();
    });
  }

  async function removeVersion(id) {
    const v = data.versions.find((x) => x.id === id);
    if (!v) return;
    const label = v.name || `${v.minecraftVersion} · ${packName(v.pack)}`;
    const res = await showModal({ title: T("removeT", { v: label }), body: T("removeD"), confirmLabel: T("yesRemove"), cancelLabel: T("no"), tone: "warn" });
    if (!res?.confirmed) return;
    const r = await api.removeVersion(id);
    if (!r?.ok && r?.error) return showModal({ title: label, body: r.error, confirmLabel: "OK", tone: "warn" });
    toast(T("removed"));
    refresh();
  }

  // --- Nouvelle version ------------------------------------------------------------------------
  async function openNewVersion() {
    let selV = null;
    let selP = "vanilla";
    let q = "";
    const types = new Set(["release"]);
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="pnv-t" style="max-width:560px;text-align:left;">
      <h3 id="pnv-t">${esc(T("newV"))}</h3><p style="margin:0 0 12px;">${esc(T("newVD"))}</p>
      <div class="field-label">${esc(T("nameL"))}</div><input type="text" class="play-in" id="pnv-name" maxlength="60" placeholder="${esc(T("nameP"))}">
      <div class="field-label" style="margin-top:12px;">${esc(T("verL"))}</div>
      <input type="search" class="play-in" id="pnv-q" placeholder="${esc(T("search"))}" autocomplete="off">
      <div class="play-chips">${[["release", "fRel"], ["snapshot", "fSnap"], ["old", "fOld"]].map(([t, k]) => `<label><input type="checkbox" data-t="${t}" ${types.has(t) ? "checked" : ""}> ${esc(T(k))}</label>`).join("")}<span class="join-note" id="pnv-count" style="margin:0 0 0 auto;"></span></div>
      <div class="play-vlist" id="pnv-list" role="listbox" aria-label="${esc(T("verL"))}"><p class="join-note" style="margin:8px;">${esc(T("loadingVersions"))}</p></div>
      <p class="play-warn" id="pnv-warn" hidden></p>
      <div class="field-label" id="pnv-plabel" style="margin-top:12px;">${esc(T("packL"))}</div>
      <div class="play-list" id="pnv-packs" style="margin-top:6px;max-height:none;"></div>
      <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button type="button" class="btn-secondary" id="pnv-cancel">${esc(T("cancel"))}</button>
        <button type="button" class="btn-secondary" id="pnv-create" disabled>${esc(T("create"))}</button>
        <button type="button" class="join-btn" id="pnv-play" disabled>${esc(T("createPlay"))}</button>
      </div></div>`);
    const { $ } = m;
    m.$("#pnv-cancel").addEventListener("click", m.close);
    const [vr] = await Promise.all([data.mcVersions ? { ok: true, versions: data.mcVersions } : api.mcVersions(), loadPacks()]);
    if (!vr?.ok) {
      $("#pnv-list").innerHTML = `<p class="join-note" style="margin:8px;">${esc(T("versionsError"))}</p>`;
      return;
    }
    data.mcVersions = vr.versions;
    const all = vr.versions;
    selV = all.find((x) => x.type === "release")?.id || all[0]?.id;
    const packsFor = (ver) => data.packs.filter((p) => (p.versions || []).some((x) => x.minecraftVersion === ver));
    const draw = () => {
      const f = all.filter((x) => types.has(x.type) && x.id.toLowerCase().includes(q.toLowerCase()));
      $("#pnv-count").textContent = T("count", { n: f.length });
      $("#pnv-list").innerHTML = f.length
        ? f.map((x) => `<button type="button" role="option" aria-selected="${x.id === selV}" data-v="${esc(x.id)}">${esc(x.id)}${x.type === "snapshot" ? " <small>snapshot</small>" : x.type === "old" ? ` <small>${L() === "fr" ? "ancienne" : "old"}</small>` : ""}</button>`).join("")
        : `<p class="join-note" style="margin:8px;">${esc(T("none"))}</p>`;
      const t = all.find((x) => x.id === selV)?.type;
      $("#pnv-warn").hidden = !selV || t === "release";
      $("#pnv-warn").textContent = t === "snapshot" ? T("snapW") : t === "old" ? T("oldW") : "";
      // Seuls les packs vraiment prêts (publiés) pour cette version : rien n'est promis ailleurs.
      const avail = packsFor(selV);
      if (selP !== "vanilla" && !avail.some((p) => p.id === selP)) selP = "vanilla";
      $("#pnv-plabel").hidden = $("#pnv-packs").hidden = !avail.length;
      $("#pnv-packs").innerHTML = [
        `<label class="play-row" style="align-items:flex-start;"><input type="radio" name="pnv-pack" value="vanilla" ${selP === "vanilla" ? "checked" : ""} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">Vanilla</b><small>${esc(T("vanillaD"))}</small></span><span class="sz">${esc(T("noMods"))}</span></label>`,
        ...avail.map((p) => {
          const pv = p.versions.find((x) => x.minecraftVersion === selV);
          return `<label class="play-row" style="align-items:flex-start;"><input type="radio" name="pnv-pack" value="${esc(p.id)}" ${p.id === selP ? "checked" : ""} style="margin-top:3px;"><span class="t"><b style="font-weight:600;">${esc(packName(p))} <span class="play-beta-tag" style="margin-left:4px;">${esc(T("official"))}</span></b><small>${esc(p.description?.[L()] || p.description?.fr || "")}</small></span><span class="sz">${pv.files.length} ${esc(T("mods"))}</span></label>`;
        }),
      ].join("");
      $("#pnv-create").disabled = $("#pnv-play").disabled = !selV;
    };
    draw();
    $("#pnv-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]");
      if (!b) return;
      selV = b.dataset.v;
      draw();
    });
    $("#pnv-packs").addEventListener("change", (e) => {
      if (e.target.name === "pnv-pack") selP = e.target.value;
    });
    $("#pnv-q").addEventListener("input", (e) => {
      q = e.target.value.trim();
      draw();
    });
    m.ov.querySelectorAll("[data-t]").forEach((c) => c.addEventListener("change", () => {
      c.checked ? types.add(c.dataset.t) : types.delete(c.dataset.t);
      draw();
    }));
    const make = async (andPlay) => {
      $("#pnv-create").disabled = $("#pnv-play").disabled = true;
      const name = $("#pnv-name").value.trim();
      const r = await api.createVersion({ minecraftVersion: selV, packId: selP === "vanilla" ? null : selP, name });
      if (!r?.ok) {
        $("#pnv-create").disabled = $("#pnv-play").disabled = false;
        $("#pnv-warn").hidden = false;
        $("#pnv-warn").textContent = r?.error || "";
        return;
      }
      m.close();
      await refresh();
      if (andPlay) launch({ versionId: r.version.id });
      else toast(T("created", { n: r.version.name || `${selV} · ${packName(r.version.pack)}` }));
    };
    $("#pnv-create").addEventListener("click", () => make(false));
    $("#pnv-play").addEventListener("click", () => make(true));
    $("#pnv-q").focus();
  }

  // --- Sauvegarde par monde -----------------------------------------------------------------
  async function toggleBackup(key) {
    const w = data.worlds.find((x) => x.key === key);
    if (!w) return;
    if (!w.backup) {
      await api.setWorldBackup(key, true);
      toast(T("toastOn", { w: w.name }));
      return refresh();
    }
    // Case décochée par défaut : les sauvegardes restent si le joueur ne fait rien.
    const res = await showModal({
      title: T("offT", { w: w.name }),
      body: w.backups ? T("offD", { n: w.backups }) : T("offD0"),
      confirmLabel: T("offOk"),
      cancelLabel: T("cancel"),
      checkboxLabel: w.backups ? T("offBox", { n: w.backups }) : undefined,
      tone: "warn",
    });
    if (!res?.confirmed) return;
    await api.setWorldBackup(key, false, { deleteExisting: !!res.checked });
    toast(res.checked ? T("toastOffDel", { w: w.name }) : T("toastOffKeep", { n: w.backups, w: w.name }));
    refresh();
  }

  // Ce que la limite garde et supprime vraiment (même calcul que planBackups dans playMode.js) :
  // la plus récente et la dernière « avant restauration » sont toujours gardées ; les sauvegardes
  // avec un nom aussi si la case est cochée (elles comptent quand même dans la place utilisée).
  function planBackups(list, cfg) {
    const keep = [];
    const drop = [];
    const lastRestore = list.find((b) => b.reason === "before-restore");
    let n = 0;
    let used = 0;
    list.forEach((b, i) => {
      const size = Number(b.sizeBytes) || 0;
      if ((cfg.named && b.label) || b === lastRestore) {
        keep.push(b);
        n++; // compte dans le nombre (une limite de 10 = 10 au total), jamais supprimée
        used += size;
        return;
      }
      const fits = cfg.mode === "size" ? used + size <= cfg.sizeMb * 1e6 : cfg.count === 0 || n < cfg.count;
      if (i === 0 || fits) {
        keep.push(b);
        n++;
        used += size;
      } else drop.push(b);
    });
    return { keep, drop };
  }

  // Fenêtre « Sauvegardes » (design A « Curseur » choisi par Rushi le 25/10) : la fréquence de la
  // sauvegarde automatique, combien en garder (un curseur, ou une taille max par monde en option
  // avancée) et l'envoi automatique dans le cloud (Supporter). Réglages LES MÊMES POUR TOUS LES
  // MONDES (retour de Rushi, 25/10). Ouverte depuis un monde : on y voit aussi ses sauvegardes ;
  // depuis « Réglages des sauvegardes » (en-tête de Mes mondes) : seulement les réglages.
  // Aucun chiffre estimé : seulement les tailles réelles et ce que le réglage supprimerait vraiment.
  const BK_STOPS = [1, 2, 3, 5, 10, 15, 20, 30, 50, 0]; // 0 = tout garder
  const BK_EVERY = [5, 10, 15, 30, 60];
  const BK_SIZES = [250, 500, 1000, 2000, 5000];
  async function openHistory(key = null) {
    const w = key ? data.worlds.find((x) => x.key === key) : null;
    if (key && !w) return;
    const fr = L() === "fr";
    const tr = (a, b) => (fr ? a : b);
    // Les sauvegardes de chaque monde : le réglage s'applique à tous, on montre ce qu'il fait partout.
    const lists = await Promise.all(data.worlds.map((x) => api.listBackups(x.key).then((res) => ({ key: x.key, name: x.name, list: res?.backups || [], keep: res?.keep })).catch(() => ({ key: x.key, name: x.name, list: [] }))));
    const r = lists.find((x) => x.keep) || (await api.listBackups(null));
    const list = (key && lists.find((x) => x.key === key)?.list) || [];
    const all = lists.flatMap((x) => x.list);
    const saved = r?.keep || { mode: "count", count: 10, sizeMb: 1000, named: true, every: 30, send: "all", online: 3 };
    const cfg = { every: 30, send: "all", online: 3, ...saved };
    const savedOnline = cfg.online;
    const savedSend = cfg.send;
    if (!BK_EVERY.includes(cfg.every)) cfg.every = 30;
    // Un nombre réglé avant le curseur (ex. 12) devient un cran de plus.
    const stops = [...BK_STOPS];
    if (!stops.includes(cfg.count)) stops.splice(stops.findIndex((s) => s === 0 || s > cfg.count), 0, cfg.count);
    const reasons = S[L()].reason;
    const c = data.cloud;
    const sup = !!c?.offer?.cloud;
    const sum = (arr) => arr.reduce((a, b) => a + (Number(b.sizeBytes) || 0), 0);
    const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
    const lab = (v) => (v === 60 ? "1 h" : `${v} min`);
    let showList = false;
    // Ce que le réglage garderait et supprimerait, monde par monde.
    const planAll = () => {
      const keep = [];
      const drop = [];
      let worlds = 0;
      for (const x of lists) {
        const pl = planBackups(x.list, cfg);
        keep.push(...pl.keep);
        drop.push(...pl.drop);
        if (pl.drop.length) worlds++;
      }
      return { keep, drop, worlds };
    };
    const m = overlay(`<div class="modal-box pop-in nb-box" role="dialog" aria-modal="true" aria-labelledby="nb-t">
      <h3 id="nb-t">${esc(w ? T("histT", { w: w.name }) : tr("Réglages des sauvegardes", "Backup settings"))}</h3>
      <p class="nb-sub"><span class="nb-all">${tr("Pour tous tes mondes", "For all your worlds")}</span> ${tr("Tes sauvegardes se font toutes seules pendant la partie et quand tu quittes le monde.", "Your backups are made automatically while you play and when you leave the world.")}</p>
      <div class="nb-tiles${sup ? "" : " one"}" id="nb-tiles"></div>
      <div id="nb-freq"></div>
      <div id="nb-ctrl"></div>
      <div class="nb-adv" id="nb-adv"></div>
      <p class="nb-res" id="nb-res"></p>
      <div id="nb-cloud"></div>
      <label class="nb-check"><input type="checkbox" id="nb-named" ${cfg.named ? "checked" : ""}> <span>${tr("Garder pour toujours les sauvegardes avec un nom", "Keep backups with a name forever")}<small>${tr("Celles faites avec Maj+F6 en jeu (ex. « Elytra obtenu »). Elles comptent dans le nombre.", "Made with Shift+F6 in game (e.g. “Got the elytra”). They count in the number.")}</small></span></label>
      ${!w ? "" : list.length ? `<button type="button" class="link-btn" id="nb-tog" style="font-size:12.5px;margin-top:12px;"></button><div class="nb-list" id="nb-list" hidden></div>` : `<div class="nb-empty">${esc(T("histEmpty"))}</div>`}
      <div class="nb-ingame"><strong>${tr("Pendant la partie", "While playing")}</strong> · <kbd>F6</kbd> ${tr("sauvegarder maintenant", "save now")} · <kbd>${tr("Maj", "Shift")}+F6</kbd> ${tr("sauvegarder avec un nom", "save with a name")}
        <label><input type="checkbox" id="nb-toast" checked> ${esc(T("inGameToast"))}</label></div>
      <div class="nb-acts">
        ${w ? `<button type="button" class="link-btn" id="nb-folder" style="margin-right:auto;">${esc(T("openFolder"))}</button>
        <button type="button" class="btn-secondary" id="nb-now" style="margin:0;" ${data.running || !w.backup ? "disabled" : ""}>${esc(T("backupNow"))}</button>` : `<span style="margin-right:auto;"></span>`}
        <button type="button" class="btn-secondary" id="nb-close" style="margin:0;">${esc(T("cancel"))}</button>
        <button type="button" class="join-btn" id="nb-save">${tr("Enregistrer", "Save")}</button>
      </div></div>`);
    const $ = m.$;

    function tiles(pl) {
      const nw = lists.length;
      const pc = `<div class="nb-tile"><span>${tr("Sur ce PC", "On this PC")} · ${esc(plural(nw, tr("monde", "world"), tr("mondes", "worlds")))}</span><b>${plural(all.length, tr("sauvegarde", "backup"), tr("sauvegardes", "backups"))} · ${esc(sizeFmt(sum(all)))}</b>
        <small>${all.length ? (pl.drop.length ? esc(tr(`Après réglage : ${pl.keep.length} · ${sizeFmt(sum(pl.keep))}`, `After this setting: ${pl.keep.length} · ${sizeFmt(sum(pl.keep))}`)) : tr("Rien ne change avec ce réglage", "Nothing changes with this setting")) : tr("La première arrive pendant ta prochaine partie", "The first one comes during your next game")}</small></div>`;
      if (!sup) return pc;
      const quota = c.offer.quotaBytes || 0;
      const inCloud = all.filter((b) => b.cloud?.versionId);
      // Ce que la limite retirerait aussi en ligne : jamais les sauvegardes avec un nom.
      const usedAfter = Math.max(0, (c.usedBytes || 0) - sum(pl.drop.filter((b) => b.cloud?.versionId && !b.label)));
      const pct = quota ? Math.min(100, (usedAfter / quota) * 100) : 0;
      return pc + `<div class="nb-tile"><span>☁ ${tr("Dans le cloud", "In the cloud")}</span><b>${inCloud.length ? `${plural(inCloud.length, "version", "versions")} · ${esc(sizeFmt(sum(inCloud)))}` : tr("Rien pour l'instant", "Nothing yet")}</b>
        <div class="nb-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <small>${esc(tr(`Ton espace : ${sizeFmt(usedAfter)} sur ${sizeFmt(quota)} · il reste ${sizeFmt(Math.max(0, quota - usedAfter))}`, `Your space: ${sizeFmt(usedAfter)} of ${sizeFmt(quota)} · ${sizeFmt(Math.max(0, quota - usedAfter))} left`))}</small></div>`;
    }
    function freqHtml() {
      let back = "";
      if (cfg.mode === "count") {
        if (cfg.count === 0) back = tr("Tu peux revenir aussi loin que tu veux.", "You can go back as far as you want.");
        else {
          const mins = cfg.count * cfg.every;
          const d = mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60}` : ""}` : `${mins} min`;
          back = tr(`Avec ${cfg.count} sauvegarde${cfg.count > 1 ? "s" : ""} toutes les ${lab(cfg.every)}, tu peux revenir jusqu'à ${d} de jeu en arrière.`, `With ${cfg.count} backup${cfg.count > 1 ? "s" : ""} every ${lab(cfg.every)}, you can go back up to ${d} of play.`);
        }
      }
      return `<div class="nb-q">${tr("Sauvegarde automatique pendant la partie", "Automatic backup while playing")}</div>
        <div class="nb-big"><span>${tr("toutes les", "every")}</span><b style="font-size:26px;">${lab(cfg.every)}</b></div>
        <input type="range" class="nb-range" id="nb-every" min="0" max="${BK_EVERY.length - 1}" step="1" value="${BK_EVERY.indexOf(cfg.every)}" aria-label="${tr("Fréquence", "Frequency")}">
        <div class="nb-ticks" style="grid-template-columns:repeat(${BK_EVERY.length},1fr);">${BK_EVERY.map((v, i) => `<span data-ei="${i}" class="${v === cfg.every ? "on" : ""}">${lab(v)}</span>`).join("")}</div>
        <p class="nb-sub" style="margin:8px 0 0;">${esc(back)}${back ? " " : ""}${tr("Le compte repart à chaque sauvegarde (F6 compris).", "The count restarts at each backup (F6 included).")}</p>`;
    }
    function ctrlHtml() {
      if (cfg.mode === "size") {
        return `<div class="nb-q">${tr("Place maximale par monde sur ce PC", "Maximum space per world on this PC")}<span class="tag">${tr("option avancée", "advanced")}</span></div>
          <div class="nb-pills" role="radiogroup">${BK_SIZES.map((v) => `<button type="button" role="radio" data-size="${v}" aria-checked="${cfg.sizeMb === v}">${esc(sizeFmt(v * 1e6))}</button>`).join("")}</div>`;
      }
      const idx = stops.indexOf(cfg.count);
      return `<div class="nb-q">${tr("Combien de sauvegardes garder ?", "How many backups to keep?")}</div>
        <div class="nb-big"><b>${cfg.count === 0 ? "∞" : cfg.count}</b><span>${cfg.count === 0 ? tr("on garde tout", "keep everything") : cfg.count === 1 ? tr("seulement la dernière, par monde", "only the latest, per world") : tr("dernières sauvegardes par monde", "latest backups per world")}</span></div>
        <input type="range" class="nb-range" id="nb-range" min="0" max="${stops.length - 1}" step="1" value="${idx < 0 ? 4 : idx}" aria-label="${tr("Nombre de sauvegardes", "Number of backups")}">
        <div class="nb-ticks" style="grid-template-columns:repeat(${stops.length},1fr);">${stops.map((s, i) => `<span data-i="${i}" class="${s === cfg.count ? "on" : ""}">${s === 0 ? "∞" : s}</span>`).join("")}</div>`;
    }
    function cloudHtml() {
      if (!sup) return `<p class="nb-sub" style="margin:10px 0 0;">${tr("Tes sauvegardes restent seulement sur ce PC.", "Your backups stay only on this PC.")}</p>`;
      const sends = [
        ["all", tr("Toutes", "All"), tr("Chaque sauvegarde part dans le cloud, après la partie (rien n'est envoyé pendant que tu joues). Sur ton autre PC, tu retrouves exactement les mêmes.", "Every backup goes to the cloud, after the game (nothing is sent while you play). On your other PC you get exactly the same ones.")],
        // « Partiel » : ancien « Une par partie », renommé par Rushi le 25/10 (on choisit combien en ligne).
        ["game", tr("Partiel", "Partial"), tr("Seulement la dernière de chaque partie, plus celles avec un nom, et tu choisis combien en garder en ligne. Les autres restent sur ce PC.", "Only the last one of each game, plus named ones, and you choose how many stay online. The others stay on this PC.")],
        ["manual", tr("À la main", "Manually"), tr("Rien ne part tout seul. Tu envoies quand tu veux avec « ☁ Synchroniser » dans Mes mondes.", "Nothing is sent automatically. You send when you want with “☁ Sync” in My worlds.")],
      ];
      const cur = sends.find((x) => x[0] === cfg.send) || sends[0];
      // Versions en ligne par monde (25/10) : plafonné par l'offre (table des offres du site).
      const cap = Number(c.offer?.cloudVersions) > 0 ? Number(c.offer.cloudVersions) : 10;
      const onl = [1, 2, 3, 5, 10].filter((v) => v <= cap);
      if (!onl.includes(cap)) onl.push(cap);
      if (cfg.online > cap) cfg.online = cap;
      const n = cfg.online;
      return `<div class="nb-q">☁ ${tr("Envoi automatique dans le cloud", "Automatic cloud upload")}</div>
        <div class="nb-pills" role="radiogroup">${sends.map(([v, l]) => `<button type="button" role="radio" data-send="${v}" aria-checked="${cfg.send === v}">${esc(l)}</button>`).join("")}</div>
        <p class="nb-sub" style="margin:8px 0 0;">${esc(cur[2])}</p>
        ${cfg.send !== "game" ? "" : `<div class="nb-q" style="margin-top:14px;">☁ ${tr("Versions gardées en ligne, par monde", "Versions kept online, per world")}</div>
        <div class="nb-pills" role="radiogroup">${onl.map((v) => `<button type="button" role="radio" data-online="${v}" aria-checked="${cfg.online === v}">${v}</button>`).join("")}</div>
        <div class="nb-cloud"><span>☁</span><span>${fr
          ? `<b>En ligne : ${n === 1 ? "la dernière" : `les ${n} dernières`} de chaque monde</b>, plus celles avec un nom (★) et celles que tu envoies toi-même (☁ Envoyer, dans la liste d'un monde). Les plus anciennes sortent du cloud et restent sur ce PC.`
          : `<b>Online: the latest ${n === 1 ? "one" : n} of each world</b>, plus named ones (★) and the ones you send yourself (☁ Send, in a world's list). Older ones leave the cloud and stay on this PC.`}</span></div>`}`;
    }
    // Pendant qu'on fait glisser un curseur, on garde l'élément <input type=range> (sinon le
    // glissement s'arrête) et on remplace seulement ce qu'il y a autour.
    function fill(el, html) {
      const range = el.querySelector("input[type=range]");
      if (!range || document.activeElement !== range || range.parentNode !== el) {
        el.innerHTML = html;
        return;
      }
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const fresh = tmp.querySelector(":scope > input[type=range]");
      if (!fresh) {
        el.innerHTML = html;
        return;
      }
      [...el.childNodes].forEach((n) => n !== range && n.remove());
      const kids = [...tmp.childNodes];
      const at = kids.indexOf(fresh);
      kids.slice(0, at).forEach((n) => el.insertBefore(n, range));
      kids.slice(at + 1).forEach((n) => el.appendChild(n));
    }
    function draw() {
      const pl = planAll();
      const plW = planBackups(list, cfg);
      $("#nb-tiles").innerHTML = tiles(pl);
      fill($("#nb-freq"), freqHtml());
      fill($("#nb-ctrl"), ctrlHtml());
      $("#nb-adv").innerHTML = cfg.mode === "size"
        ? `<button type="button" class="link-btn" data-mode="count">← ${tr("Revenir au nombre de sauvegardes (conseillé)", "Back to a number of backups (advised)")}</button>`
        : `<button type="button" class="link-btn" data-mode="size">${tr("Option avancée : limiter plutôt par place sur le disque", "Advanced: limit by disk space instead")}</button>`;
      const res = $("#nb-res");
      const n = pl.drop.length;
      if (!all.length) {
        res.className = "nb-res ok";
        res.textContent = tr("Aucune sauvegarde pour l'instant : ce réglage s'appliquera dès les premières.", "No backups yet: this setting will apply from the first ones.");
      } else if (n) {
        res.className = "nb-res warn";
        const inW = pl.worlds > 1 ? tr(` dans ${pl.worlds} mondes`, ` in ${pl.worlds} worlds`) : "";
        res.textContent = tr(
          `En enregistrant, ${n} ancienne${n > 1 ? "s" : ""} sauvegarde${n > 1 ? "s" : ""}${inW} (${sizeFmt(sum(pl.drop))}) ser${n > 1 ? "ont" : "a"} supprimée${n > 1 ? "s" : ""}${sup ? " de ce PC et du cloud" : " de ce PC"}. On te le redemande avant.`,
          `When you save, ${n} old backup${n > 1 ? "s" : ""}${inW} (${sizeFmt(sum(pl.drop))}) will be deleted${sup ? " from this PC and the cloud" : " from this PC"}. We ask again first.`);
      } else {
        res.className = "nb-res ok";
        res.textContent = cfg.mode === "count" && cfg.count === 0
          ? tr("Rien n'est jamais supprimé tout seul. Attention, ça prend de plus en plus de place.", "Nothing is ever deleted automatically. Careful, it takes more and more space.")
          : tr("Tes sauvegardes actuelles rentrent : rien n'est supprimé maintenant.", "Your current backups fit: nothing is deleted now.");
      }
      if (cfg.mode === "size" && cfg.named && lists.some((x) => sum(x.list.filter((b) => b.label)) > cfg.sizeMb * 1e6)) res.textContent += tr(" Les sauvegardes nommées sont gardées même si elles dépassent la limite.", " Named backups are kept even if they go over the limit.");
      else if (cfg.mode === "size" && lists.some((x) => x.list[0] && x.list[0].sizeBytes > cfg.sizeMb * 1e6)) res.textContent += tr(" La plus récente de chaque monde est toujours gardée, même si elle est plus grosse que la limite.", " Each world's newest is always kept, even if it is bigger than the limit.");
      $("#nb-cloud").innerHTML = cloudHtml();
      const tog = $("#nb-tog");
      if (!tog) return;
      tog.textContent = showList ? tr("Cacher la liste", "Hide the list") : tr(`Voir les ${list.length} sauvegardes`, `See the ${list.length} backups`);
      $("#nb-list").hidden = !showList;
      if (!showList) return;
      const drop = new Set(plW.drop);
      $("#nb-list").innerHTML = list.map((b) => `<div class="nb-row${drop.has(b) ? " gone" : ""}">
          <span class="d">${esc(dateFmt(b.createdAt))}${b.label ? ` · <b>★ « ${esc(b.label)} »</b>` : ` · ${esc(reasons[b.reason] || b.reason)}`}${b.cloud?.versionId ? " · ☁" : ""}${drop.has(b) ? `<small>${tr("sera supprimée", "will be deleted")}</small>` : ""}</span>
          <span class="s">${esc(sizeFmt(b.sizeBytes))}</span>
          <button type="button" class="link-btn" data-restore="${esc(b.id)}" style="font-size:12px;" ${data.running ? "disabled" : ""}>${esc(T("restore"))}</button></div>`).join("");
    }
    draw();

    m.ov.addEventListener("click", async (e) => {
      const b = e.target.closest("button,[data-i],[data-ei]");
      if (!b || !m.ov.contains(b)) return;
      if (b.dataset.restore) return restore(b.dataset.restore);
      if (b.dataset.mode) { cfg.mode = b.dataset.mode; return draw(); }
      if (b.dataset.size) { cfg.sizeMb = Number(b.dataset.size); return draw(); }
      if (b.dataset.send) { cfg.send = b.dataset.send; return draw(); }
      if (b.dataset.online) { cfg.online = Number(b.dataset.online); return draw(); }
      if (b.dataset.ei != null) { cfg.every = BK_EVERY[Number(b.dataset.ei)]; return draw(); }
      if (b.dataset.i != null) { cfg.count = stops[Number(b.dataset.i)]; return draw(); }
      if (b.id === "nb-tog") { showList = !showList; return draw(); }
    });
    m.ov.addEventListener("input", (e) => {
      if (e.target.id === "nb-every") { cfg.every = BK_EVERY[Number(e.target.value)]; draw(); }
      if (e.target.id === "nb-range") { cfg.count = stops[Number(e.target.value)]; draw(); }
    });
    $("#nb-named").addEventListener("change", (e) => { cfg.named = e.target.checked; draw(); });
    $("#nb-close").addEventListener("click", m.close);
    window.mchub.settings.get().then((st) => { if (st && st.playSaveToast === false) $("#nb-toast").checked = false; }).catch(() => {});
    $("#nb-toast").addEventListener("change", (e) => window.mchub.settings.set({ playSaveToast: e.target.checked }));
    $("#nb-folder")?.addEventListener("click", () => api.openWorldFolder(key));
    $("#nb-now")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      const res = await api.backupNow(key);
      m.close();
      if (!res?.ok) return showModal({ title: w.name, body: res?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(T("backupDone"));
      refresh();
    });
    $("#nb-save").addEventListener("click", async () => {
      const pl = planAll();
      const n = pl.drop.length;
      if (n) {
        const ok = await showModal({
          title: tr(`Supprimer ${n} ancienne${n > 1 ? "s" : ""} sauvegarde${n > 1 ? "s" : ""} ?`, `Delete ${n} old backup${n > 1 ? "s" : ""}?`),
          body: (() => {
            const per = lists.map((x) => [x.name, planBackups(x.list, cfg).drop.length]).filter(([, k]) => k).map(([nm, k]) => `« ${nm} » : ${k}`).join(" · ");
            return fr
              ? `${per} (${sizeFmt(sum(pl.drop))}). ${n > 1 ? "Elles seront supprimées" : "Elle sera supprimée"} de ce PC pour de bon${sup ? ", et du cloud" : ""}. Tes mondes ne sont pas touchés. Les sauvegardes avec un nom sont gardées en ligne.`
              : `${per} (${sizeFmt(sum(pl.drop))}). ${n > 1 ? "They will be deleted" : "It will be deleted"} from this PC for good${sup ? ", and from the cloud" : ""}. Your worlds are not touched. Named backups are kept online.`;
          })(),
          confirmLabel: tr("Oui, supprimer", "Yes, delete"),
          cancelLabel: tr("Non", "No"),
          tone: "warn",
        });
        if (!ok?.confirmed) return;
      }
      // Passer à « Partiel », ou y baisser le nombre : des versions en ligne peuvent sortir du cloud.
      if (sup && cfg.send === "game" && (savedSend !== "game" || cfg.online < savedOnline)) {
        const ok = await showModal({
          title: tr(`Garder ${cfg.online} version${cfg.online > 1 ? "s" : ""} en ligne par monde ?`, `Keep ${cfg.online} version${cfg.online > 1 ? "s" : ""} online per world?`),
          body: tr("Les versions en ligne en trop (les plus anciennes, sans nom) sortent du cloud. Elles restent sur ce PC. Celles avec un nom et celles envoyées à la main restent en ligne.", "Extra online versions (the oldest, unnamed) leave the cloud. They stay on this PC. Named ones and the ones you sent by hand stay online."),
          confirmLabel: tr("Oui", "Yes"),
          cancelLabel: tr("Non", "No"),
          tone: "warn",
        });
        if (!ok?.confirmed) return;
      }
      const out = await api.setBackupLimit(null, cfg);
      m.close();
      if (!out?.ok) return showModal({ title: tr("Réglages des sauvegardes", "Backup settings"), body: out?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(out.deleted
        ? tr(`${out.deleted} ancienne${out.deleted > 1 ? "s" : ""} sauvegarde${out.deleted > 1 ? "s" : ""} supprimée${out.deleted > 1 ? "s" : ""}. Réglages enregistrés pour tous tes mondes.`, `${out.deleted} old backup${out.deleted > 1 ? "s" : ""} deleted. Settings saved for all your worlds.`)
        : tr("Réglages enregistrés pour tous tes mondes.", "Settings saved for all your worlds."));
      refresh();
    });
    async function restore(id) {
      const backup = list.find((x) => x.id === id);
      if (!backup) return;
      m.close();
      const res = await showModal({ title: T("restoreT", { w: w.name }), body: T("restoreD", { d: dateFmt(backup.createdAt) }), confirmLabel: T("restore"), cancelLabel: T("cancel"), tone: "warn" });
      if (!res?.confirmed) return;
      const out = await api.restoreBackup(key, backup.id);
      if (!out?.ok) return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(T("restored", { w: w.name }));
      refresh();
    }
  }

  // Liste des sauvegardes d'un monde (clic sur « N sauvegardes sur ce PC », retour de Rushi du
  // 25/10) : juste la liste, chacune avec Restaurer et Supprimer (confirmation en tapant
  // « supprimer »). Les réglages sont dans « ⚙ Réglages des sauvegardes ».
  async function openBackupsList(key) {
    const w = data.worlds.find((x) => x.key === key);
    if (!w) return;
    const fr = L() === "fr";
    const tr = (a, b) => (fr ? a : b);
    const r = await api.listBackups(key);
    let list = r?.backups || [];
    const reasons = S[L()].reason;
    const sup = !!data.cloud?.offer?.cloud;
    const sum = (arr) => arr.reduce((a, b) => a + (Number(b.sizeBytes) || 0), 0);
    const m = overlay(`<div class="modal-box pop-in nb-box" role="dialog" aria-modal="true" aria-labelledby="nl-t">
      <h3 id="nl-t">${esc(T("histT", { w: w.name }))}</h3>
      <p class="nb-sub" id="nl-sub"></p>
      <div id="nl-body"></div>
      <div class="nb-acts">
        <button type="button" class="link-btn" id="nl-folder">${esc(T("openFolder"))}</button>
        <button type="button" class="link-btn" id="nl-settings" style="margin-right:auto;">⚙ ${tr("Réglages", "Settings")}</button>
        <button type="button" class="btn-secondary" id="nl-now" style="margin:0;" ${data.running || !w.backup ? "disabled" : ""}>${esc(T("backupNow"))}</button>
        <button type="button" class="join-btn" id="nl-close">${esc(T("close"))}</button>
      </div></div>`);
    const $ = m.$;
    function draw() {
      $("#nl-sub").textContent = list.length
        ? `${list.length} ${tr(list.length > 1 ? "sauvegardes" : "sauvegarde", list.length > 1 ? "backups" : "backup")} · ${sizeFmt(sum(list))}${sup ? tr(" · ☁ = aussi dans le cloud", " · ☁ = also in the cloud") : ""}`
        : "";
      $("#nl-body").innerHTML = list.length
        ? `<div class="nb-list" style="max-height:min(420px, calc(100vh - 260px));">${list.map((b) => `<div class="nb-row" style="grid-template-columns:1fr auto ${sup ? "auto " : ""}auto auto;">
            <span class="d">${esc(dateFmt(b.createdAt))}${b.label ? ` · <b>★ « ${esc(b.label)} »</b>` : ` · ${esc(reasons[b.reason] || b.reason)}`}${b.cloud?.versionId ? ` · <span title="${esc(b.cloudKeep ? tr("Envoyée à la main : gardée en ligne en plus", "Sent by hand: kept online as an extra") : tr("Dans le cloud", "In the cloud"))}">☁${b.cloudKeep ? "+" : ""}</span>` : ""}</span>
            <span class="s">${esc(sizeFmt(b.sizeBytes))}</span>
            ${sup ? (b.cloud?.versionId
              ? `<button type="button" class="link-btn nl-uncloud" data-uncloud="${esc(b.id)}" title="${esc(tr("Retirer du cloud (elle reste sur ce PC)", "Remove from the cloud (it stays on this PC)"))}" aria-label="${esc(tr("Retirer du cloud", "Remove from the cloud"))}" style="font-size:12px;">✕ ☁</button>`
              : `<button type="button" class="link-btn" data-send-one="${esc(b.id)}" title="${esc(tr("L'envoyer dans le cloud, en plus des versions automatiques", "Send it to the cloud, on top of the automatic versions"))}" style="font-size:12px;">☁ ${tr("Envoyer", "Send")}</button>`) : ""}
            <button type="button" class="link-btn" data-restore="${esc(b.id)}" style="font-size:12px;" ${data.running ? "disabled" : ""}>${esc(T("restore"))}</button>
            <button type="button" class="link-btn nl-del" data-del="${esc(b.id)}" style="font-size:12px;">${tr("Supprimer", "Delete")}</button></div>`).join("")}</div>`
        : `<div class="nb-empty">${esc(T("histEmpty"))}</div>`;
    }
    draw();
    m.ov.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b || !m.ov.contains(b)) return;
      if (b.dataset.restore) {
        const backup = list.find((x) => x.id === b.dataset.restore);
        if (!backup) return;
        m.close();
        const res = await showModal({ title: T("restoreT", { w: w.name }), body: T("restoreD", { d: dateFmt(backup.createdAt) }), confirmLabel: T("restore"), cancelLabel: T("cancel"), tone: "warn" });
        if (!res?.confirmed) return;
        const out = await api.restoreBackup(key, backup.id);
        if (!out?.ok) return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
        toast(T("restored", { w: w.name }));
        return refresh();
      }
      if (b.dataset.sendOne || b.dataset.uncloud) {
        const id = b.dataset.sendOne || b.dataset.uncloud;
        b.disabled = true;
        const out = b.dataset.sendOne ? await api.cloud.sendBackup(key, id) : await api.cloud.uncloudBackup(key, id);
        if (!out?.ok) {
          b.disabled = false;
          return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
        }
        toast(b.dataset.sendOne
          ? tr("Envoi en cours (voir en haut à droite). Elle restera en ligne en plus des versions automatiques.", "Sending (see top right). It will stay online on top of the automatic versions.")
          : tr("Retirée du cloud. Elle est toujours sur ce PC.", "Removed from the cloud. It is still on this PC."));
        list = (await api.listBackups(key))?.backups || list;
        draw();
        loadCloud(true).then(() => !panel.hidden && render());
        return;
      }
      if (b.dataset.del) {
        const backup = list.find((x) => x.id === b.dataset.del);
        if (!backup || !(await confirmDelete(backup))) return;
        const out = await api.deleteBackup(key, backup.id);
        if (!out?.ok) return showModal({ title: w.name, body: out?.error || "", confirmLabel: "OK", tone: "warn" });
        list = list.filter((x) => x !== backup);
        draw();
        toast(tr("Sauvegarde supprimée.", "Backup deleted."));
        refresh();
      }
    });
    // Confirmation en tapant le mot (comme sur la page Mes mondes du site).
    function confirmDelete(backup) {
      const word = tr("supprimer", "delete");
      // La version à continuer (la plus récente du cloud) est gardée en ligne par le site.
      const head = data.cloud?.worlds?.find((x) => x.worldKey === key)?.latestVersionId;
      const cloudToo = !!backup.cloud?.versionId && backup.cloud.versionId !== head;
      return new Promise((resolve) => {
        const c = overlay(`<div class="modal-box pop-in nb-box" role="dialog" aria-modal="true" aria-labelledby="nd-t" style="max-width:440px;">
          <h3 id="nd-t">${tr("Supprimer cette sauvegarde ?", "Delete this backup?")}</h3>
          <p class="nb-sub" style="margin:6px 0 10px;">${esc(dateFmt(backup.createdAt))}${backup.label ? ` · « ${esc(backup.label)} »` : ""} · ${esc(sizeFmt(backup.sizeBytes))}</p>
          <p style="font-size:13px;margin:0 0 10px;line-height:1.45;">${esc(tr(`Elle sera supprimée de ce PC pour de bon${cloudToo ? ", et du cloud" : ""}. Ton monde n'est pas touché.`, `It will be deleted from this PC for good${cloudToo ? ", and from the cloud" : ""}. Your world is not touched.`))}${backup.cloud?.versionId && !cloudToo ? ` ${esc(tr("C'est la dernière version du cloud : elle y reste, pour tes autres PC.", "It is the latest version in the cloud: it stays there, for your other PCs."))}` : ""}</p>
          <label style="font-size:12.5px;color:var(--muted);">${tr(`Tape « ${word} » pour confirmer`, `Type “${word}” to confirm`)}</label>
          <input type="text" id="nd-in" class="play-in" autocomplete="off" spellcheck="false" style="width:100%;margin-top:6px;">
          <div class="nb-acts"><button type="button" class="btn-secondary" id="nd-no" style="margin:0;">${esc(T("cancel"))}</button><button type="button" class="join-btn nl-danger" id="nd-ok" disabled>${tr("Supprimer", "Delete")}</button></div></div>`);
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          obs.disconnect();
          c.close();
          resolve(v);
        };
        // Échap ou clic à côté ferment la fenêtre : on répond « non ».
        const obs = new MutationObserver(() => !document.body.contains(c.ov) && finish(false));
        obs.observe(document.body, { childList: true });
        const input = c.$("#nd-in");
        input.focus();
        input.addEventListener("input", () => (c.$("#nd-ok").disabled = input.value.trim().toLowerCase() !== word));
        input.addEventListener("keydown", (e) => e.key === "Enter" && !c.$("#nd-ok").disabled && finish(true));
        c.$("#nd-no").addEventListener("click", () => finish(false));
        c.$("#nd-ok").addEventListener("click", () => finish(true));
      });
    }
    $("#nl-close").addEventListener("click", m.close);
    $("#nl-folder").addEventListener("click", () => api.openWorldFolder(key));
    $("#nl-settings").addEventListener("click", () => {
      m.close();
      openHistory(null);
    });
    $("#nl-now").addEventListener("click", async (e) => {
      e.target.disabled = true;
      const res = await api.backupNow(key);
      if (!res?.ok) {
        m.close();
        return showModal({ title: w.name, body: res?.error || "", confirmLabel: "OK", tone: "warn" });
      }
      toast(T("backupDone"));
      list = (await api.listBackups(key))?.backups || list;
      e.target.disabled = false;
      draw();
      refresh();
    });
  }

  // --- Import depuis .minecraft (copie) -------------------------------------------------------
  async function openImport(dir = null) {
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="pi-t" style="max-width:540px;text-align:left;">
      <h3 id="pi-t">${esc(T("impT"))}</h3><p class="join-note" id="pi-body">${esc(T("impScanning"))}</p></div>`);
    const r = await api.scanImport(dir);
    if (!document.body.contains(m.ov)) return;
    const found = r?.worlds || [];
    const picked = new Set(found.slice(0, 3).map((f) => f.folder));
    const box = m.ov.querySelector(".modal-box");
    box.innerHTML = `<h3 id="pi-t">${esc(T("impT"))}</h3>
      <p style="margin:0 0 4px;">${esc(found.length ? T("impFrom") : T("impNone"))}</p>
      <span class="play-path">${esc(r?.dir || "")}</span>
      <div class="play-list">${found.map((f) => `<label class="play-row"><input type="checkbox" data-f="${esc(f.folder)}" ${picked.has(f.folder) ? "checked" : ""}>
        <img src="${f.icon || grassThumb(f.folder)}" alt=""><span class="t">${esc(f.name)}<small>Minecraft ${esc(f.minecraftVersion || "?")}${f.lastPlayed ? ` · ${esc(ago(f.lastPlayed))}` : ""}</small></span>
        <span class="sz">${esc(sizeFmt(f.sizeBytes))}</span></label>`).join("")}</div>
      <p class="play-safe">✓ ${esc(T("impSafe"))}</p>
      <div class="modal-actions" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;">
        <button type="button" class="link-btn" id="pi-other" style="margin-right:auto;">${esc(T("impOther"))}</button>
        <button type="button" class="btn-secondary" id="pi-cancel">${esc(T("cancel"))}</button>
        <button type="button" class="join-btn" id="pi-copy" ${picked.size ? "" : "disabled"}>${esc(T("impCopy", { n: picked.size }))}</button>
      </div>`;
    const copy = m.$("#pi-copy");
    m.$("#pi-cancel").addEventListener("click", m.close);
    m.$("#pi-other").addEventListener("click", async () => {
      const p = await api.pickImportDir();
      if (!p?.ok) return;
      m.close();
      openImport(p.dir);
    });
    m.ov.querySelectorAll("input[data-f]").forEach((c) => c.addEventListener("change", () => {
      c.checked ? picked.add(c.dataset.f) : picked.delete(c.dataset.f);
      copy.textContent = T("impCopy", { n: picked.size });
      copy.disabled = picked.size === 0;
    }));
    copy.addEventListener("click", async () => {
      copy.disabled = true;
      copy.textContent = T("impCopying");
      m.ov.dataset.locked = "1";
      const out = await api.importWorlds(r.dir, [...picked]);
      m.close();
      if (!out?.ok) return showModal({ title: T("impT"), body: out?.error || "", confirmLabel: "OK", tone: "warn" });
      toast(T("impDone", { n: out.imported.length }));
      refresh();
    });
    copy.focus();
  }

  // --- Accueil : carte « Continuer mon monde » --------------------------------------------------
  // Design A (25/10) : la carte du dernier monde se place a cote de celle du dernier serveur, dans
  // #home-halves (voir paintHomeView). Sans cet emplacement, ancienne place : sous la carte serveur.
  const homePanel = document.getElementById("home-panel");
  function injectHome() {
    if (!homePanel) return;
    homePanel.querySelector(".play-home-section")?.remove();
    if (!playVisible) return;
    const w = data.worlds[0];
    if (!w) return;
    const halves = homePanel.querySelector("#home-halves");
    const anchor = halves ? null : homePanel.querySelector(".home-resume")?.closest(".home-section") || homePanel.querySelector(".home-main > *");
    if (!halves && !anchor) return;
    const lv = w.lastVersionLabel;
    const card = `<div class="home-resume play-resume" role="button" tabindex="0">
        <span class="home-resume-icon"><img src="${worldThumb(w)}" alt=""></span>
        <div class="home-resume-txt">
          <span class="home-resume-when">${esc(T("homeWhen", { p: lv?.pack ? packName({ name: lv.pack }) : "Vanilla", v: lv?.minecraftVersion || w.minecraftVersion || "" }))}</span>
          <h2>${esc(w.name)}</h2>
          <p><span class="status-dot ${w.backup ? "online" : "offline"}"></span>${esc(w.backup ? (w.lastBackupAt ? T("saved", { t: ago(w.lastBackupAt) }) : T("notSaved")) : T("off"))}</p>
        </div>
        <button type="button" class="home-resume-play join-btn" data-play-home ${data.running ? "disabled" : ""}>${esc(T("play"))}</button>
      </div>`;
    let sec;
    if (halves) {
      halves.insertAdjacentHTML("beforeend", card);
      sec = halves.lastElementChild;
      sec.classList.add("play-home-section");
      sec.title = T("allWorlds");
    } else {
      sec = document.createElement("div");
      sec.className = "home-section play-home-section";
      sec.innerHTML = `<div class="home-section-header"><h3>${esc(T("contT"))}</h3><button type="button" class="home-see-all" data-play-all>${esc(T("allWorlds"))}</button></div>${card}`;
      anchor.after(sec);
      sec.querySelector("[data-play-all]").addEventListener("click", showPlay);
    }
    const resume = sec.classList.contains("play-resume") ? sec : sec.querySelector(".play-resume");
    resume.addEventListener("click", (e) => {
      if (!e.target.closest("[data-play-home]")) showPlay();
    });
    sec.querySelector("[data-play-home]").addEventListener("click", (e) => launch({ worldKey: w.key }, e.target));
  }
  // L'accueil se redessine souvent (renderHomeView) : on remet la tuile après chaque rendu.
  if (homePanel) {
    let pending = false;
    new MutationObserver(() => {
      if (pending || homePanel.querySelector(".play-home-section")) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        injectHome();
      });
    }).observe(homePanel, { childList: true, subtree: true });
  }

  // --- Cloud (Supporters) ---------------------------------------------------------------------
  // force : après une action du joueur. Sinon la réponse gardée par le launcher suffit (30 min sans
  // offre cloud, 2 min avec), pour ne pas appeler le site à chaque rafraîchissement de l'onglet.
  async function loadCloud(force = false) {
    const r = await api.cloud.status({ force }).catch(() => null);
    data.cloud = r?.ok ? r : null;
    if (r?.job) setJob(r.job);
    if (r?.djob && !data.djob) setDjob(r.djob);
  }
  let cloudLater = false;
  function cloudBannerHtml() {
    const c = data.cloud;
    if (!c?.offer?.cloud || c.setupDone || !cloudLater || (data.job && !data.job.done)) return "";
    const fr = L() === "fr";
    return `<div class="guest-banner" style="display:flex;align-items:center;gap:12px;padding:12px 14px;margin:0 0 16px;border-radius:var(--radius-l);border:1px solid color-mix(in srgb, var(--warn) 40%, transparent);background:color-mix(in srgb, var(--warn) 10%, transparent);font-size:13px;">
      <span style="flex:1;">★ ${fr ? "Tu es Supporter : tes mondes ne sont pas encore dans le cloud." : "You are a Supporter: your worlds are not in the cloud yet."}</span>
      <button type="button" class="join-btn" data-cloud-banner="1">${fr ? "Activer la sauvegarde en ligne" : "Turn on online backup"}</button></div>`;
  }
  // Supporter qui n'a encore rien envoyé depuis ce PC : la fenêtre s'ouvre une fois à l'arrivée.
  let offered = false;
  function maybeOfferCloud() {
    const c = data.cloud;
    if (offered || !c?.offer?.cloud || c.setupDone || cloudLater || !data.worlds.some((w) => w.backup)) return;
    if (data.job && !data.job.done) return;
    offered = true;
    openCloudSync({ resync: false });
  }

  const moFmt = (bytes) => sizeFmt(bytes);
  const etaFmt = (sec) => {
    const fr = L() === "fr";
    if (!Number.isFinite(sec)) return "";
    if (sec < 60) return `${Math.max(1, Math.round(sec))} s`;
    if (sec < 5400) return `${Math.round(sec / 60)} min`;
    return `${(sec / 3600).toFixed(1).replace(".", fr ? "," : ".")} h`;
  };

  // Fenêtre « Synchroniser » : test de connexion (petit envoi), puis choix des mondes dans la
  // limite du quota de l'offre (jamais une valeur écrite en dur ici), puis envoi en arrière-plan.
  async function openCloudSync({ resync }) {
    const fr = L() === "fr";
    const m = overlay(`<div class="cloud-box" role="dialog" aria-modal="true" aria-labelledby="cl-t" aria-busy="true">
      <h3 id="cl-t">${fr ? "Test de ta connexion en cours…" : "Testing your connection…"}</h3>
      <p>${fr ? "On envoie un petit fichier test pour savoir combien de temps prendra l'envoi de tes mondes." : "We send a small test file to know how long sending your worlds will take."}</p>
      <div class="cloud-bar"><i id="cl-test-bar" style="width:0%;transition:width 3s cubic-bezier(.2,.6,.3,1);"></i></div></div>`, { className: "play-modal" });
    m.ov.dataset.locked = "1";
    // Retour de test du 24/10 : la barre ne bougeait pas. Elle avance maintenant en 3 s jusqu'à 90 %
    // pendant que le vrai test tourne, puis finit à 100 % quand il est fini (jamais avant 3 s).
    const bar = m.$("#cl-test-bar");
    requestAnimationFrame(() => requestAnimationFrame(() => bar && (bar.style.width = "90%")));
    const [test] = await Promise.all([api.cloud.testConnection(), loadCloud(true), new Promise((r) => setTimeout(r, 3000))]);
    if (bar) {
      bar.style.transition = "width .3s ease-out";
      bar.style.width = "100%";
      await new Promise((r) => setTimeout(r, 320));
    }
    delete m.ov.dataset.locked;
    if (!document.body.contains(m.ov)) return;
    const c = data.cloud;
    if (!c?.offer?.cloud) {
      m.close();
      return;
    }
    const mbps = test?.ok && test.mbps > 0 ? test.mbps : null;
    const upBps = mbps ? (mbps * 1e6) / 8 : null;
    const offer = c.offer;
    const quota = offer.quotaBytes;
    const used = c.usedBytes || 0;
    const inCloud = new Map((c.worlds || []).map((x) => [x.worldKey, x]));
    const all = data.worlds.filter((w) => w.backup);
    const skipped = data.worlds.filter((w) => !w.backup);
    // Taille réelle de ce qui part : toutes les sauvegardes .zip du monde pas encore en ligne
    // (versions miroir, 25/10). Un monde sans sauvegarde en reçoit une au lancement : sa taille
    // n'est connue qu'après, on montre alors la taille du monde.
    const sizeOf = (w) => (w.notInCloud ? w.notInCloudBytes || 0 : w.sizeBytes || 0);
    const pendingTracked = data.worlds.filter((w) => w.backup && inCloud.has(w.key)).reduce((a, w) => a + (w.notInCloudBytes || 0), 0);
    const notIn = all.filter((w) => !inCloud.has(w.key));
    const pick = new Set();
    // Par défaut : les mondes pas encore en ligne, du plus petit au plus gros, tant que ça rentre.
    let acc = used + pendingTracked;
    for (const w of notIn.slice().sort((a, b) => sizeOf(a) - sizeOf(b))) {
      if (acc + sizeOf(w) <= quota) {
        pick.add(w.key);
        acc += sizeOf(w);
      }
    }
    const allTotal = notIn.reduce((a, w) => a + sizeOf(w), 0) + used + pendingTracked;
    const over = allTotal > quota;
    const offerName = offer.name?.[L()] || offer.name?.fr || "";
    const qTxt = fr ? `ton quota de ${moFmt(quota)} (offre ${offerName})` : `your ${moFmt(quota)} quota (${offerName} plan)`;
    const draw = () => {
      const sel = notIn.filter((w) => pick.has(w.key));
      const addBytes = sel.reduce((a, w) => a + sizeOf(w), 0);
      const tot = used + pendingTracked + addBytes;
      const pct = quota ? Math.min(100, (tot / quota) * 100) : 100;
      const bad = tot > quota;
      const near = !bad && tot > quota * 0.8;
      const rows = all.map((w) => inCloud.has(w.key)
        ? `<div class="cloud-row" style="grid-template-columns:18px 32px minmax(0,1fr) auto auto;"><span style="color:var(--success);">✓</span><img src="${worldThumb(w)}" alt=""><span>${esc(w.name)}<small>${w.notInCloud ? (fr ? `Dans le cloud · encore ${w.notInCloud} sauvegarde${w.notInCloud > 1 ? "s" : ""} à envoyer (${moFmt(w.notInCloudBytes)})` : `In the cloud · ${w.notInCloud} more backup${w.notInCloud > 1 ? "s" : ""} to send (${moFmt(w.notInCloudBytes)})`) : fr ? "Déjà dans le cloud" : "Already in the cloud"}</small></span><span class="st">${moFmt(inCloud.get(w.key).totalBytes || inCloud.get(w.key).sizeBytes || 0)}</span><button type="button" class="link-btn" data-rm="${esc(w.key)}" style="font-size:12px;">${fr ? "Retirer du cloud" : "Remove from cloud"}</button></div>`
        : `<label class="cloud-row" style="cursor:pointer;grid-template-columns:18px 32px minmax(0,1fr) auto;"><input type="checkbox" data-w="${esc(w.key)}" ${pick.has(w.key) ? "checked" : ""}><img src="${worldThumb(w)}" alt=""><span>${esc(w.name)}<small>${esc(w.minecraftVersion || "")}${w.backups ? ` · ${fr ? `${w.backups} sauvegarde${w.backups > 1 ? "s" : ""}` : `${w.backups} backup${w.backups > 1 ? "s" : ""}`}` : ""}</small></span><span class="st">${moFmt(sizeOf(w))}</span></label>`).join("")
        + skipped.map((w) => `<div class="cloud-row" style="opacity:.6;grid-template-columns:18px 32px minmax(0,1fr) auto;"><span></span><img src="${worldThumb(w)}" alt=""><span>${esc(w.name)}<small>${fr ? "Sauvegarde coupée pour ce monde : pas envoyé" : "Backup is off for this world: not sent"}</small></span><span class="st">–</span></div>`).join("");
      const eta = upBps ? etaFmt((addBytes + pendingTracked) / upBps) : null;
      const n = sel.length;
      m.ov.innerHTML = `<div class="cloud-box" role="dialog" aria-modal="true" aria-labelledby="cl-t">
        <h3 id="cl-t">${resync || c.setupDone ? (fr ? "Synchroniser mes mondes" : "Sync my worlds") : `★ ${fr ? "Merci, tu es Supporter !" : "Thanks, you are a Supporter!"}`}</h3>
        <p>${resync || c.setupDone
          ? (fr ? `Coche les mondes à ajouter au cloud. Pour faire de la place dans ${qTxt}, tu peux retirer un monde du cloud : il reste sur ton PC.` : `Tick the worlds to add to the cloud. To make room in ${qTxt}, you can remove a world from the cloud: it stays on your PC.`)
          : over
            ? (fr ? `Tes mondes font ${moFmt(allTotal)} au total : c'est plus que ${qTxt}. Choisis ceux à mettre dans le cloud. Les autres restent sauvegardés sur ton PC, comme avant.` : `Your worlds are ${moFmt(allTotal)} in total: more than ${qTxt}. Pick the ones to put in the cloud. The others stay backed up on your PC, as before.`)
            : (fr ? "On va envoyer tes mondes dans le cloud. Ensuite, ils seront sauvegardés en ligne tout seuls et tu les retrouveras sur n'importe quel PC, et sur le site." : "We will send your worlds to the cloud. After that, they are backed up online on their own and you get them on any PC, and on the website.")}</p>
        <div class="cloud-bar"><i style="width:${pct}%;${bad ? "background:var(--danger)" : near ? "background:var(--warn)" : ""}"></i></div>
        <div class="cloud-meta"><span>${moFmt(tot)} ${fr ? "sur" : "of"} ${moFmt(quota)}</span><span style="${bad ? "color:var(--danger)" : near ? "color:var(--warn)" : ""}">${bad ? (fr ? `${moFmt(tot - quota)} de trop` : `${moFmt(tot - quota)} too much`) : fr ? `il restera ${moFmt(quota - tot)}` : `${moFmt(quota - tot)} will be left`}</span></div>
        ${near ? `<div class="cloud-warn">${fr ? "Ton espace en ligne sera presque plein. Quand il sera plein, rien n'est supprimé : les nouvelles sauvegardes restent sur ton PC et on te le dit." : "Your online space will be almost full. When it is full, nothing is deleted: new backups stay on your PC and we tell you."}</div>` : ""}
        <div class="cloud-list">${rows}</div>
        ${over || bad ? `<p style="font-size:12.5px;">${fr ? "Besoin de plus de place ?" : "Need more space?"} <button type="button" class="link-btn" id="cl-more" style="font-size:12.5px;">${fr ? "Voir les offres avec plus d'espace" : "See plans with more space"}</button></p>` : ""}
        <p style="font-size:12.5px;">${fr ? "Ça se fait en arrière-plan : tu peux continuer à utiliser le launcher, et l'envoi se met en pause pendant que tu joues." : "It runs in the background: you can keep using the launcher, and sending pauses while you play."} ${eta ? (fr ? `Avec ta connexion (${Math.round(mbps)} Mb/s en envoi), environ <b>${eta}</b>.` : `With your connection (${Math.round(mbps)} Mb/s upload), about <b>${eta}</b>.`) : !mbps && n ? (fr ? "On n'a pas pu mesurer ta connexion : on ne peut pas dire combien de temps ça prendra, mais tu peux lancer quand même." : "We could not measure your connection: we can't tell how long it will take, but you can start anyway.") : ""}</p>
        <div class="cloud-acts"><button type="button" class="btn-secondary" id="cl-later" style="margin:0;">${resync || c.setupDone ? (fr ? "Annuler" : "Cancel") : fr ? "Plus tard" : "Later"}</button><button type="button" class="join-btn" id="cl-go" ${bad || (!n && !pendingTracked) ? "disabled" : ""}>${n ? (fr ? `Lancer la synchronisation (${n} monde${n > 1 ? "s" : ""})` : `Start syncing (${n} world${n > 1 ? "s" : ""})`) : fr ? "Envoyer les sauvegardes manquantes" : "Send the missing backups"}</button></div></div>`;
      m.ov.querySelectorAll("[data-w]").forEach((cb) => cb.addEventListener("change", () => {
        cb.checked ? pick.add(cb.dataset.w) : pick.delete(cb.dataset.w);
        draw();
      }));
      m.ov.querySelector("#cl-more")?.addEventListener("click", () => toast(fr ? "Pour l'instant, seule l'offre Supporter existe. Une offre avec plus d'espace viendra plus tard." : "For now only the Supporter plan exists. A plan with more space will come later."));
      m.ov.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", async () => {
        const w = all.find((x) => x.key === b.dataset.rm);
        const r = await showModal({
          title: fr ? `Retirer « ${w.name} » du cloud ?` : `Remove “${w.name}” from the cloud?`,
          body: fr ? "Ses sauvegardes en ligne sont supprimées pour de bon. Le monde reste sur ton PC, avec ses sauvegardes locales." : "Its online backups are deleted for good. The world stays on your PC, with its local backups.",
          confirmLabel: fr ? "Oui, retirer" : "Yes, remove",
          cancelLabel: fr ? "Non" : "No",
          tone: "warn",
        });
        if (!r?.confirmed) return;
        const out = await api.cloud.remove(w.key);
        if (!out?.ok) return toast(out?.error || "");
        inCloud.delete(w.key);
        notIn.push(w);
        await loadCloud(true);
        draw();
        render();
        toast(fr ? `« ${w.name} » retiré du cloud. Il est toujours sur ton PC.` : `“${w.name}” removed from the cloud. It is still on your PC.`);
      }));
      m.ov.querySelector("#cl-later").addEventListener("click", () => {
        m.close();
        if (!resync && !c.setupDone) {
          cloudLater = true;
          render();
        }
      });
      m.ov.querySelector("#cl-go").addEventListener("click", async () => {
        const keys = [...pick].filter((k) => !inCloud.has(k));
        m.close();
        const out = await api.cloud.sync(keys);
        if (!out?.ok) return showModal({ title: fr ? "Synchronisation" : "Sync", body: out?.error || "", confirmLabel: "OK", tone: "warn" });
        cloudLater = false;
        toast(fr ? "Synchronisation lancée. Suis-la en haut à droite : tu peux continuer à utiliser le launcher." : "Sync started. Follow it at the top right: you can keep using the launcher.");
        await loadCloud(true);
        render();
      });
    };
    draw();
  }

  // Téléchargement en arrière-plan (un ou plusieurs mondes), suivi dans la pilule en haut à droite.
  async function downloadFromCloud(ids) {
    if (!ids.length) return;
    const fr = L() === "fr";
    const r = await api.cloud.downloadMany(ids);
    if (!r?.ok) return showModal({ title: fr ? "Téléchargement impossible" : "Download failed", body: r?.error || "", confirmLabel: "OK", tone: "warn" });
    toast(fr ? "Téléchargement lancé. Suis-le en haut à droite : tu peux continuer à utiliser le launcher." : "Download started. Follow it at the top right: you can keep using the launcher.");
  }
  function setDjob(djob) {
    const was = data.djob && !data.djob.done;
    data.djob = djob;
    try {
      renderActivity();
    } catch {
      /* pilule pas encore prête */
    }
    if (was && djob?.done) {
      const fr = L() === "fr";
      const ok = djob.items.filter((i) => i.done).length;
      const bad = djob.items.filter((i) => i.error);
      if (ok) {
        const msg = fr ? `✓ ${ok} monde${ok > 1 ? "s" : ""} téléchargé${ok > 1 ? "s" : ""} : prêt${ok > 1 ? "s" : ""} à jouer.` : `✓ ${ok} world${ok > 1 ? "s" : ""} downloaded: ready to play.`;
        toast(msg);
        if (typeof notifyIfAway === "function") notifyIfAway(fr ? "Mondes téléchargés" : "Worlds downloaded", msg);
      }
      if (bad.length) showModal({ title: fr ? "Téléchargement incomplet" : "Download incomplete", body: bad.map((i) => `${i.name} : ${i.error}`).join("\n"), confirmLabel: "OK", tone: "warn" });
      refresh();
    } else if (!panel.hidden && (!was || djob?.done)) render();
  }
  api.cloud.onDownloadUpdate(setDjob);
  api.cloud.downloadJob().then((j) => j && setDjob(j)).catch(() => {});

  // Envoi en arrière-plan : affiché dans la pilule en haut à droite (renderActivity de renderer.js
  // appelle window.playCloudActivity) quand rien d'autre ne tourne.
  function setJob(job) {
    const wasActive = data.job && !data.job.done;
    data.job = job;
    try {
      renderActivity();
    } catch {
      /* pilule pas encore prête */
    }
    // « Fermer quand c'est fini » : la synchro est terminée (ou arrêtée), le launcher se ferme.
    if (data.closeWhenDone && (!job || job.done)) {
      data.closeWhenDone = false;
      if (!job?.error) return window.mchub.windowControls.close();
    }
    if (wasActive && job?.done) {
      const n = job.items.filter((i) => i.done).length;
      if (n) toast(L() === "fr" ? `✓ Synchronisation terminée : ${n} monde${n > 1 ? "s" : ""} dans le cloud.` : `✓ Sync complete: ${n} world${n > 1 ? "s" : ""} in the cloud.`);
      loadCloud(true).then(() => !panel.hidden && render());
    } else if (!panel.hidden && (!wasActive || job?.done)) render();
  }
  api.cloud.onUpdate(setJob);

  window.playCloudActivity = () => {
    const list = [saveActivity(), downloadActivity(), uploadActivity()].filter(Boolean);
    if (!list.length) return null;
    // Une sauvegarde passe devant tout (même la partie en cours) : elle ne dure que quelques secondes.
    return { parts: list[0].parts, panelHtml: list.map((a) => a.panelHtml).join(""), over: !!list[0].over };
  };

  // Sauvegarde d'un monde dans la pilule (retour de Rushi du 25/10 : « on dirait qu'il ne se passe
  // rien »). Même très rapide, elle reste au moins 2 s, puis « Sauvegarde terminée ✓ » pendant 3 s.
  const SAVE_MIN_MS = 2000;
  const SAVE_DONE_MS = 3000;
  let saveTimer = null;
  const pillRefresh = () => {
    try {
      renderActivity();
    } catch {
      /* pilule pas encore prête */
    }
  };
  api.onSaveActivity?.((a) => {
    clearTimeout(saveTimer);
    const name = a.name || data.worlds.find((w) => w.key === a.key)?.name || "";
    if (a.phase === "start" || a.phase === "wait") {
      const since = data.save && (data.save.phase === "start" || data.save.phase === "wait") ? data.save.since : Date.now();
      data.save = { name, label: a.label, phase: a.phase, since };
      return pillRefresh();
    }
    const finish = () => {
      data.save = { name, label: a.label, phase: a.phase };
      pillRefresh();
      saveTimer = setTimeout(() => {
        data.save = null;
        pillRefresh();
      }, SAVE_DONE_MS);
    };
    const left = SAVE_MIN_MS - (Date.now() - (data.save?.since || 0));
    if (left > 0) saveTimer = setTimeout(finish, left);
    else finish();
  });
  function saveActivity() {
    const s = data.save;
    if (!s) return null;
    const fr = L() === "fr";
    const what = s.label ? `★ « ${s.label} »` : s.name ? `« ${s.name} »` : "";
    const [long, short, icon] = {
      start: [fr ? `Sauvegarde ${what ? `de ${what} ` : ""}en cours…` : `Backing up ${what}…`, fr ? "Sauvegarde…" : "Saving…", '<span class="activity-ring"></span>'],
      wait: [fr ? "Sauvegarde : appuie sur Échap dans le jeu" : "Backup: press Esc in the game", fr ? "Sauvegarde…" : "Saving…", '<span class="status-dot" style="background:var(--warn)"></span>'],
      done: [fr ? "Sauvegarde terminée ✓" : "Backup done ✓", "✓", '<span class="status-dot" style="background:var(--success)"></span>'],
      skip: [fr ? "Déjà sauvegardé, rien n'a changé ✓" : "Already backed up, nothing changed ✓", "✓", '<span class="status-dot" style="background:var(--success)"></span>'],
      fail: [fr ? "Sauvegarde pas faite" : "Backup not done", "!", '<span class="status-dot" style="background:var(--danger)"></span>'],
    }[s.phase] || [];
    if (!long) return null;
    const panelHtml = `<div class="play-cloud-task" style="padding:10px 10px 4px;border-bottom:1px solid var(--border);">
      <p class="tasks-section-label" style="margin:0 2px 6px 6px;">${fr ? "Sauvegarde" : "Backup"}${what ? ` · ${esc(what)}` : ""}</p>
      <p class="muted" style="margin:0 6px 8px;font-size:11.5px;">${esc(long)}</p></div>`;
    return { parts: { cls: "hl", icon, long, short }, panelHtml, over: true };
  }
  // Téléchargement de mondes depuis le cloud (autre PC) : même présentation que la synchro.
  function downloadActivity() {
    const dj = data.djob;
    if (!dj || dj.done) return null;
    const fr = L() === "fr";
    const pct = dj.total ? Math.round((dj.got / dj.total) * 100) : 0;
    const installing = dj.items.find((i) => i.phase === "install");
    const lab = fr ? "Téléchargement des mondes" : "Downloading worlds";
    const long = installing ? `${lab} · ${fr ? `installation de la version de « ${installing.name} »` : `installing the version of “${installing.name}”`}` : `${lab} ${pct} %`;
    const rows = dj.items.map((i) => {
      const p = i.size ? Math.round((i.got / i.size) * 100) : 0;
      const meta = i.done ? (i.missed ? (fr ? `✓ Sur ce PC · ${i.missed} version${i.missed > 1 ? "s" : ""} pas venue${i.missed > 1 ? "s" : ""} (voir le journal)` : `✓ On this PC · ${i.missed} version${i.missed > 1 ? "s" : ""} missing (see the log)`) : fr ? `✓ Sur ce PC · ${i.versions} version${i.versions > 1 ? "s" : ""}` : `✓ On this PC · ${i.versions} version${i.versions > 1 ? "s" : ""}`)
        : i.error ? esc(i.error)
        : i.phase === "install" ? (fr ? "Installation de sa version et de son pack…" : "Installing its version and pack…")
        : i.got > 0 ? `${moFmt(i.got)} / ${moFmt(i.size)}` : fr ? `En attente · ${moFmt(i.size)}` : `Waiting · ${moFmt(i.size)}`;
      return `<div class="task-item"><div class="task-item-row"><div class="task-item-body"><div class="task-item-name">${esc(i.name)}</div><div class="task-item-meta">${meta}</div></div></div>
        ${i.done || i.error || i.phase === "install" ? "" : `<div class="task-progress-track"><div class="task-progress-fill" style="width:${p}%;"></div></div>`}</div>`;
    }).join("");
    const panelHtml = `<div class="play-cloud-task" style="padding:10px 10px 4px;border-bottom:1px solid var(--border);">
      <p class="tasks-section-label" style="margin:0 2px 6px 6px;">${lab} · ${pct} %</p>
      <div class="task-progress-track" style="margin:0 6px 6px;"><div class="task-progress-fill" style="width:${pct}%;"></div></div>
      <p class="muted" style="margin:0 6px 6px;font-size:11.5px;">${moFmt(dj.got)} / ${moFmt(dj.total)}</p>
      ${rows}</div>`;
    return { parts: { cls: "hl", icon: '<span class="activity-ring"></span>', long, short: `↓ ${pct} %` }, panelHtml };
  }
  function uploadActivity() {
    const job = data.job;
    if (!job || (job.done && !job.error)) return null;
    const fr = L() === "fr";
    const pct = job.total ? Math.round((job.sent / job.total) * 100) : 0;
    const left = job.bps > 0 ? (job.total - job.sent) / job.bps : NaN;
    const why = job.error
      ? (fr ? "erreur, nouvel essai bientôt" : "error, retrying soon")
      : job.paused === "game" ? (fr ? "en pause, jeu lancé" : "paused, game running") : job.paused ? (fr ? "en pause" : "paused") : "";
    const long = why ? (fr ? `Synchro cloud ${pct} % · ${why}` : `Cloud sync ${pct}% · ${why}`) : `${fr ? "Synchro cloud" : "Cloud sync"} ${pct} %${Number.isFinite(left) ? ` · ${etaFmt(left)}` : ""}`;
    const rows = job.items.map((i) => {
      const p = i.size ? Math.round((i.sent / i.size) * 100) : 0;
      const nm = `${i.name}${i.label ? ` · « ${i.label} »` : i.when ? ` · ${dateFmt(i.when)}` : ""}`;
      return `<div class="task-item"><div class="task-item-row"><div class="task-item-body"><div class="task-item-name">${esc(nm)}</div><div class="task-item-meta">${i.done ? (fr ? "✓ Dans le cloud" : "✓ In the cloud") : i.error ? esc(i.error) : i.sent > 0 ? `${moFmt(i.sent)} / ${moFmt(i.size)}` : fr ? `En attente · ${moFmt(i.size)}` : `Waiting · ${moFmt(i.size)}`}</div></div></div>
        ${i.done ? "" : `<div class="task-progress-track"><div class="task-progress-fill" style="width:${p}%;"></div></div>`}</div>`;
    }).join("");
    const panelHtml = `<div class="play-cloud-task" style="padding:10px 10px 4px;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:6px;margin:0 2px 6px 6px;"><p class="tasks-section-label" style="margin:0;flex:1;">${fr ? "Synchronisation avec le cloud" : "Cloud sync"} · ${pct} %</p>
        <button type="button" class="task-item-action" data-cloud-toggle title="${job.paused ? (fr ? "Reprendre" : "Resume") : "Pause"}">${job.paused ? TASK_RESUME_SVG : TASK_PAUSE_SVG}</button>
        <button type="button" class="link-btn" data-cloud-stop style="font-size:12px;color:var(--warn);">${fr ? "Arrêter" : "Stop"}</button></div>
      <div class="task-progress-track" style="margin:0 6px 6px;"><div class="task-progress-fill" style="width:${pct}%;${job.paused ? "background:var(--warn);" : ""}"></div></div>
      <p class="muted" style="margin:0 6px 6px;font-size:11.5px;">${moFmt(job.sent)} / ${moFmt(job.total)}${why ? ` · ${why}` : Number.isFinite(left) ? ` · ${fr ? `encore ~${etaFmt(left)}` : `~${etaFmt(left)} left`}` : ""}</p>
      ${data.closeWhenDone ? `<p class="muted" style="margin:0 6px 8px;font-size:11.5px;">${fr ? "Le launcher se fermera tout seul à la fin de l'envoi." : "The launcher will close on its own when sending is done."} <button type="button" class="link-btn" data-cloud-keepopen style="font-size:11.5px;">${fr ? "Garder ouvert" : "Keep open"}</button></p>` : ""}
      ${job.paused === "game" ? `<p class="muted" style="margin:0 6px 8px;font-size:11.5px;">${fr ? "L'envoi s'est mis en pause tout seul pendant la partie. Il reprend quand tu quittes le jeu." : "Sending paused on its own during the game. It resumes when you quit the game."}</p>` : ""}
      ${rows}</div>`;
    return {
      parts: { cls: "hl", icon: job.paused || job.error ? '<span class="status-dot" style="background:var(--warn)"></span>' : '<span class="activity-ring"></span>', long, short: `☁ ${pct} %` },
      panelHtml,
    };
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cloud-toggle]");
    if (!b) return;
    e.stopPropagation();
    if (data.job?.paused) api.cloud.resume();
    else api.cloud.pause();
  }, true);
  // « Arrêter » la synchro (retour de Rushi du 25/10) : ce qui est déjà parti reste en ligne.
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cloud-stop]");
    if (!b) return;
    e.stopPropagation();
    const fr = L() === "fr";
    const left = (data.job?.items || []).filter((i) => !i.done).length;
    const res = await showModal({
      title: fr ? "Arrêter la synchronisation ?" : "Stop syncing?",
      body: fr
        ? `L'envoi s'arrête tout de suite. Ce qui est déjà dans le cloud y reste, et rien n'est supprimé sur ton PC. ${left > 1 ? `Les ${left} sauvegardes pas encore envoyées repartiront` : "La sauvegarde pas encore envoyée repartira"} quand tu cliqueras sur Synchroniser.`
        : `Sending stops right away. What is already in the cloud stays there, and nothing is deleted on your PC. ${left > 1 ? `The ${left} backups not sent yet will go` : "The backup not sent yet will go"} when you click Sync.`,
      confirmLabel: fr ? "Arrêter" : "Stop",
      cancelLabel: fr ? "Continuer l'envoi" : "Keep sending",
      tone: "warn",
    });
    if (!res?.confirmed) return;
    data.closeWhenDone = false; // arrêter n'est pas « fini » : le launcher reste ouvert
    await api.cloud.stop();
    toast(fr ? "Synchronisation arrêtée. Ce qui est déjà en ligne y reste." : "Sync stopped. What is already online stays there.");
    loadCloud(true).then(() => !panel.hidden && render());
  }, true);

  // Fermer la fenêtre pendant un envoi : « Réduire » (continue en arrière-plan), « Fermer quand
  // même » (s'arrête, reprend au prochain démarrage depuis le dernier morceau envoyé) ou Annuler.
  document.addEventListener("click", (e) => {
    const downOn = data.djob && !data.djob.done;
    if (!e.target.closest("#win-close") || ((!data.job || data.job.done) && !downOn)) return;
    e.stopPropagation();
    e.preventDefault();
    const fr = L() === "fr";
    if (downOn) {
      // Téléchargement de mondes : « Réduire » (il continue), « Fermer quand même » (le monde en
      // cours est abandonné, ceux déjà arrivés restent ; rien n'est abîmé) ou Annuler.
      const pct = data.djob.total ? Math.round((data.djob.got / data.djob.total) * 100) : 0;
      const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cq-t" style="max-width:440px;text-align:left;">
        <h3 id="cq-t">${fr ? "Téléchargement en cours" : "Download in progress"} · ${pct} %</h3>
        <p style="margin:0 0 12px;">${fr ? "Tes mondes arrivent sur ce PC. Si tu réduis le launcher, le téléchargement continue en arrière-plan. Si tu le fermes, il s'arrête : les mondes déjà arrivés restent, les autres seront à télécharger à nouveau." : "Your worlds are coming to this PC. If you minimize the launcher, the download continues in the background. If you close it, it stops: worlds already here stay, the others will need downloading again."}</p>
        <div class="modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          <button type="button" class="btn-secondary" data-q="cancel">${fr ? "Annuler" : "Cancel"}</button>
          <button type="button" class="btn-secondary" data-q="close">${fr ? "Fermer quand même" : "Close anyway"}</button>
          <button type="button" class="join-btn" data-q="min">${fr ? "Réduire" : "Minimize"}</button></div></div>`);
      m.$('[data-q="min"]').focus();
      m.ov.addEventListener("click", (ev) => {
        const q = ev.target.closest("[data-q]");
        if (!q) return;
        m.close();
        if (q.dataset.q === "min") window.mchub.windowControls.minimize();
        else if (q.dataset.q === "close") {
          data.djob = null;
          data.job = null;
          window.mchub.windowControls.close();
        }
      });
      return;
    }
    // Synchro : trois choix l'un sous l'autre, chacun avec ce qu'il fait (retour de Rushi du 25/10 :
    // pouvoir « fermer quand la synchro est finie »), plus Annuler en lien discret.
    const job = data.job;
    const pct = job.total ? Math.round((job.sent / job.total) * 100) : 0;
    const left = job.bps > 0 && !job.paused ? (job.total - job.sent) / job.bps : NaN;
    const eta = Number.isFinite(left) ? etaFmt(left) : "";
    const choice = (q, cls, label, sub) => `<button type="button" class="${cls}" data-q="${q}" style="display:block;width:100%;margin:0;text-align:left;padding:10px 14px;">
        <span style="display:block;font-weight:650;">${label}</span><span style="display:block;font-size:12px;opacity:.8;font-weight:400;margin-top:2px;">${sub}</span></button>`;
    const m = overlay(`<div class="modal-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cq-t" style="max-width:440px;text-align:left;">
      <h3 id="cq-t">${fr ? "Synchronisation en cours" : "Sync in progress"} · ${pct} %</h3>
      <p style="margin:0 0 14px;">${fr ? `Tes mondes sont en train de partir dans le cloud${eta ? ` (encore ~${eta})` : ""}.` : `Your worlds are being sent to the cloud${eta ? ` (~${eta} left)` : ""}.`}</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${choice("min", "join-btn", fr ? "Réduire" : "Minimize", fr ? "L'envoi continue, le launcher reste ouvert en arrière-plan." : "Sending continues, the launcher stays open in the background.")}
        ${choice("later", "btn-secondary", `${fr ? "Fermer quand c'est fini" : "Close when done"}${eta ? ` · ~${eta}` : ""}`, fr ? "Le launcher se réduit, puis se ferme tout seul à la fin de l'envoi." : "The launcher minimizes, then closes on its own when sending is done.")}
        ${choice("close", "btn-secondary", fr ? "Fermer maintenant" : "Close now", fr ? "L'envoi s'arrête. Il reprendra où il en était au prochain lancement." : "Sending stops. It will resume where it left off next time.")}
      </div>
      <div style="text-align:center;margin-top:10px;"><button type="button" class="link-btn" data-q="cancel" style="font-size:12.5px;">${fr ? "Annuler" : "Cancel"}</button></div></div>`);
    m.$('[data-q="min"]').focus();
    m.ov.addEventListener("click", (ev) => {
      const q = ev.target.closest("[data-q]");
      if (!q) return;
      m.close();
      if (q.dataset.q === "min") window.mchub.windowControls.minimize();
      else if (q.dataset.q === "later") {
        data.closeWhenDone = true;
        renderActivity();
        window.mchub.windowControls.minimize();
      } else if (q.dataset.q === "close") {
        data.job = null;
        window.mchub.windowControls.close();
      }
    });
  }, true);
  // « Garder ouvert » : annule la fermeture prévue à la fin de la synchro.
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-cloud-keepopen]")) return;
    data.closeWhenDone = false;
    renderActivity();
  }, true);

  // Premier chargement : le Laboratoire décide si l'onglet existe, puis tuile d'accueil et
  // reprise d'un envoi interrompu.
  window.mchub.onFeaturesChanged?.((state) => applyFeatures(state));
  setTimeout(() => {
    Promise.resolve(window.mchub.getFeatures?.())
      .then((state) => applyFeatures(state || {}))
      .catch(() => {});
  }, 1500);
})();
