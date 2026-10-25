// Sauvegarde PENDANT la partie (mode Jouer, 24/10, versionnage V2/V3 validés par Rushi) :
//   - F6 : sauvegarder maintenant ; Maj+F6 : sauvegarder avec un nom (« Elytra obtenu »), gardée
//     à part de la rotation si le joueur le veut (voir planBackups dans playMode.js) ;
//   - automatique toutes les X min de jeu (30 par défaut, réglable dans la fenêtre Sauvegardes
//     depuis le 25/10, le même pour tous les mondes), sans rien demander (retour de test de Rushi, 24/10) :
//     copie de ce que le jeu a déjà enregistré sur le disque (il le fait tout seul toutes les
//     5 min environ), avec le petit menu « Sauvegarde automatique… » et son pourcentage. Si le
//     joueur met le jeu en pause après l'échéance, on en profite (le monde vient d'être enregistré) ;
//   - en quittant un monde vers le menu (le jeu l'a fermé et enregistré).
// La sauvegarde à la fermeture du jeu reste dans playMode.afterGame.
//
// Copier un monde ouvert : ce que le jeu a écrit sur le disque doit être cohérent. Le launcher ne
// prend JAMAIS le focus (retour de Rushi du 25/10 : icône orange, barre des tâches, plein écran
// réduit). Il essaie d'abord de copier tout de suite ; si le jeu écrivait, le petit menu demande au
// joueur d'appuyer sur Échap (Minecraft enregistre alors : « Saving and pausing game... »), et la
// copie part aussi d'elle-même juste après l'enregistrement automatique du jeu (level.dat réécrit,
// toutes les 5 min environ). Rien ne se passe : la sauvegarde est reportée, jamais abandonnée en
// silence. On ne simule jamais Échap (ça couperait le joueur en plein combat ou dans le chat).
// playMode copie le monde dans un dossier figé (recopie de ce qui change encore) et zippe la copie.
// Les sauvegardes passent ensuite par la file du cloud (worldCloud, en pause pendant le jeu).
const fsp = require("node:fs/promises");
const path = require("node:path");

const INTERVAL_MS = 30 * 60_000; // par défaut ; sinon le réglage « every » (playMode.keepConfig)
// Copie pas fiable (le jeu écrivait) : on réessaie un peu plus tard, jamais de sauvegarde douteuse.
const RETRY_MS = 2 * 60_000;
const PAUSE_WAIT_MS = 5_000;
const AFTER_PAUSE_MS = 1_500;
// Après l'enregistrement automatique du jeu : on laisse le disque se calmer avant de copier.
const CALM_MS = 3_000;
// Après F6 : temps laissé au joueur pour appuyer sur Échap. Automatique : jusqu'au prochain
// enregistrement du jeu (5 min environ), sans rien bloquer.
const F6_WAIT_MS = 30_000;
const AUTO_WAIT_MS = 6 * 60_000;
// Copies essayées dans une même sauvegarde (une tout de suite, puis après chaque enregistrement).
const TRIES = 3;

const RE_WORLD_START = /Starting integrated minecraft server/i;
const RE_PAUSE_SAVE = /Saving and pausing game/i;
const RE_WORLD_STOP = /Stopping (?:singleplayer )?server/i;
const RE_WORLD_SAVED = /All (?:dimensions|chunks) are saved/i;

const TEXTS = {
  fr: {
    title: "Sauvegarde du monde",
    saving: "Sauvegarde en cours…",
    waitGame: "Le jeu enregistre le monde…",
    done: "Monde sauvegardé",
    doneNamed: (n) => `« ${n} » sauvegardé`,
    unchanged: "Rien n'a changé depuis la dernière sauvegarde.",
    autoDone: "Sauvegarde automatique faite",
    autoTitle: "Sauvegarde automatique",
    ready: (m) => `Automatique toutes les ${m} min. Quand le petit menu le demande, appuie sur Échap ; si tu continues à jouer, la sauvegarde est reportée et refaite plus tard.`,
    retry: "Pas fiable maintenant (le jeu écrivait), rien n'est gardé. Nouvel essai dans 2 min.",
    pressEsc: "Le jeu écrit le monde : appuie sur Échap pour finir la sauvegarde.",
    autoAsk: "Appuie sur Échap quand tu peux. Sinon, elle se fera toute seule à la prochaine sauvegarde du jeu (5 min max).",
    waiting: "La sauvegarde attend ta pause : appuie sur Échap.",
    postponed: "Sauvegarde reportée : elle se fera à ta prochaine pause (Échap) ou à la prochaine sauvegarde du jeu.",
    autoPostponed: "Pas de pause ni de sauvegarde du jeu : reportée, nouvel essai dans 2 min.",
    marked: (d) => `Marquée le ${d}`,
    noWorld: "Ouvre un monde pour le sauvegarder.",
    off: "La sauvegarde est coupée pour ce monde (réglage dans le launcher, Mes mondes).",
    busy: "Une sauvegarde est déjà en cours.",
    failed: "Sauvegarde impossible",
    askTitle: "Sauvegarder avec un nom",
    askText: "Le jeu est en pause le temps de taper le nom.",
    placeholder: "Ex. Elytra obtenu",
    ok: "Sauvegarder",
    cancel: "Annuler",
    cancelled: "Sauvegarde annulée.",
    back: "Appuie sur Échap dans le jeu pour reprendre.",
    hint: "[F6] Sauvegarder · [Maj+F6] Sauvegarde marquée ★",
  },
  en: {
    title: "World backup",
    saving: "Saving…",
    waitGame: "The game is saving the world…",
    done: "World saved",
    doneNamed: (n) => `“${n}” saved`,
    unchanged: "Nothing changed since the last backup.",
    autoDone: "Automatic backup done",
    autoTitle: "Automatic backup",
    ready: (m) => `Automatic every ${m} min. When this menu asks, press Esc; if you keep playing, the backup is postponed and done later.`,
    retry: "Not reliable right now (the game was writing), nothing kept. Retrying in 2 min.",
    pressEsc: "The game is writing the world: press Esc to finish the backup.",
    autoAsk: "Press Esc when you can. Otherwise it happens on its own at the game's next save (5 min max).",
    waiting: "The backup is waiting for your pause: press Esc.",
    postponed: "Backup postponed: it will happen at your next pause (Esc) or the game's next save.",
    autoPostponed: "No pause and no game save: postponed, retrying in 2 min.",
    marked: (d) => `Marked on ${d}`,
    noWorld: "Open a world to back it up.",
    off: "Backups are turned off for this world (setting in the launcher, My worlds).",
    busy: "A backup is already running.",
    failed: "Backup failed",
    askTitle: "Save with a name",
    askText: "The game is paused while you type the name.",
    placeholder: "e.g. Got the elytra",
    ok: "Save",
    cancel: "Cancel",
    cancelled: "Backup cancelled.",
    back: "Press Esc in the game to resume.",
    hint: "[F6] Save · [Shift+F6] Marked backup ★",
  },
};

function createLiveSave({ playMode, overlay, globalShortcut, onBackup, onActivity, log, getLocale, getToastEnabled, getDiscreet, trackWindow }) {
  let game = null; // partie en cours
  let chain = Promise.resolve(); // une sauvegarde à la fois (avec afterGame aussi)
  let busy = false;
  const pauseWaiters = new Set();

  const T = () => TEXTS[getLocale?.() === "en" ? "en" : "fr"];
  // Mode discret (stream) : le petit menu s'affiche toujours, mais sans le nom du monde.
  const wName = (world) => (getDiscreet?.() ? "" : world.name);
  const warn = (message) => log?.({ level: "warn", source: "launcher", message });
  // Journaux visibles dans la console de débogage (Ctrl+Maj+D), pour comprendre un test raté.
  const info = (message) => log?.({ level: "info", source: "launcher", message: `[Sauvegarde en jeu] ${message}` });

  // File unique : jamais deux zips du même monde en même temps.
  function enqueue(job) {
    const run = chain.then(job, job);
    chain = run.catch(() => {});
    return run;
  }

  function waitForPause(since, timeoutMs) {
    if (game && game.lastPauseAt >= since) return Promise.resolve(true);
    return new Promise((resolve) => {
      const waiter = (at) => {
        if (at < since) return;
        clearTimeout(timer);
        pauseWaiters.delete(waiter);
        resolve(true);
      };
      const timer = setTimeout(() => {
        pauseWaiters.delete(waiter);
        resolve(false);
      }, timeoutMs);
      pauseWaiters.add(waiter);
    });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Le jeu a-t-il écrit le monde depuis `since` ? Pause (Échap, « Saving and pausing game ») ou
  // son enregistrement automatique (level.dat réécrit). Renvoie "pause", "autosave" ou null.
  const levelMtime = (world) => fsp.stat(path.join(playMode.SAVES, world.folder, "level.dat")).then((st) => st.mtimeMs, () => 0);
  async function waitForWrite(world, since, timeoutMs) {
    const first = await levelMtime(world);
    const end = Date.now() + timeoutMs;
    while (game && Date.now() < end) {
      if (game.lastPauseAt >= since) {
        await sleep(AFTER_PAUSE_MS);
        return "pause";
      }
      const m = await levelMtime(world);
      if (first && m && m !== first) {
        await sleep(CALM_MS);
        return "autosave";
      }
      await sleep(1000);
    }
    return null;
  }
  // Une sauvegarde en jeu : copie tout de suite ; si le jeu écrivait (« unsafe »), le petit menu
  // demande Échap et on recopie juste après l'enregistrement du jeu (TRIES copies au plus).
  // Renvoie le résultat de playMode.backupWorld, ou null si rien n'a pu être copié (reportée).
  async function saveWhenWritten(world, opts, { title, ask, waitMs }) {
    for (let n = 1; n <= TRIES && game; n++) {
      const since = Date.now();
      try {
        return await enqueue(() => doBackup(world, opts));
      } catch (error) {
        if (error?.code !== "unsafe") throw error;
        info(`Copie pas fiable (essai ${n}/${TRIES}) : le jeu écrivait. On attend une pause (Échap) ou la prochaine sauvegarde du jeu.`);
      }
      if (n >= TRIES) break;
      overlay.show({ mode: "progress", title, text: ask, hint: T().hint });
      game.waiting = true;
      const how = await waitForWrite(world, since, waitMs).finally(() => game && (game.waiting = false));
      if (!how) break;
      info(how === "pause" ? "Jeu en pause : on copie." : "Le jeu vient d'enregistrer le monde : on copie.");
    }
    return null;
  }

  // Monde ouvert : repéré  // Monde ouvert : repéré par le journal du jeu (entrée/sortie d'un monde) et par session.lock.
  // Si le journal du jeu n'arrive pas du tout, on se fie seulement à session.lock. Retour de test
  // du 25/10 (sauvegarde des 30 min jamais faite) : à défaut, le monde lancé depuis sa carte
  // (Quick Play), tant qu'on n'a pas vu le joueur en sortir.
  async function currentWorld() {
    if (!game) return null;
    let world = null;
    if (game.inWorld) world = await playMode.openWorld(game.worldSince);
    else if (!game.sawWorldLog) world = await playMode.openWorld(game.startedAt);
    else return null;
    if (!world && game.launchedKey && !game.leftLaunched) world = await playMode.worldInfo?.(game.launchedKey);
    return world || null;
  }
  // Fréquence choisie (5 à 60 min), sinon 30 min.
  function everyMs(world) {
    void world; // même réglage pour tous les mondes depuis le 25/10
    const min = Number(playMode.keepConfig?.()?.every);
    return Number.isFinite(min) && min >= 1 ? min * 60_000 : INTERVAL_MS;
  }
  const minTxt = (ms) => `${Math.round(ms / 60_000)} min`;

  async function doBackup(world, { reason, label = null, live = true, show = true, title = null }) {
    const t = T();
    let last = -1;
    const onProgress = show
      ? (pct) => {
          if (pct === last) return;
          last = pct;
          overlay.show({ mode: "progress", title: title || t.title, text: `${t.saving}${wName(world) ? ` · ${wName(world)}` : ""}`, percent: pct });
        }
      : undefined;
    // Pilule en haut à droite du launcher (retour de Rushi du 25/10) : la sauvegarde s'y voit aussi.
    const act = (phase) => show && onActivity?.({ key: world.key, name: wName(world), label, phase });
    act("start");
    let r;
    try {
      r = await playMode.backupWorld(world.key, { reason, label, force: !!label, live, onProgress });
    } catch (error) {
      act(error?.code === "unsafe" ? "wait" : "fail");
      throw error;
    }
    act(r.backup ? "done" : "skip");
    if (r.backup) {
      if (game) game.lastSaveAt = Date.now();
      onBackup?.(world.key, r.backup);
    }
    return r;
  }

  // F6 (marked = false) ou Maj+F6 (marked = true : sauvegarde ★ gardée à part). Maj+F6 demande le
  // nom dans le petit menu, qui prend alors le focus (choix de Rushi du 25/10) : le jeu se met en
  // pause et enregistre. Échap ou Annuler : rien n'est sauvegardé. Pas de réponse en 90 s : nommée
  // par sa date.
  async function manual(marked) {
    const t = T();
    info(`${marked ? "Maj+F6" : "F6"} reçu.`);
    if (!game) return;
    if (busy) return overlay.show({ mode: "progress", title: t.title, text: game.waiting ? t.waiting : t.busy, hint: t.hint }, { hideAfter: 3500 });
    const world = await currentWorld().catch((error) => {
      warn(`Sauvegarde en jeu : monde ouvert introuvable (${error.message}).`);
      return null;
    });
    info(world ? `Monde ouvert : « ${world.name} » (sauvegarde ${world.backup ? "activée" : "coupée"}).` : "Aucun monde ouvert repéré.");
    if (!world) return overlay.show({ mode: "error", title: t.title, text: t.noWorld, hint: t.hint }, { hideAfter: 3500 });
    if (!world.backup) return overlay.show({ mode: "error", title: t.title, text: t.off }, { hideAfter: 5000 });
    busy = true;
    let label = null;
    try {
      if (marked) {
        const typed = await overlay.ask({ title: t.askTitle, text: t.askText, placeholder: t.placeholder, okLabel: t.ok, cancelLabel: t.cancel });
        if (typed === null) {
          info("Maj+F6 annulé : rien n'est sauvegardé.");
          overlay.show({ mode: "progress", title: t.cancelled, text: t.back }, { hideAfter: 3000 });
          return;
        }
        label = typed || t.marked(new Date().toLocaleString(getLocale?.() === "en" ? "en-GB" : "fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
      }
      overlay.show({ mode: "progress", title: t.title, text: `${t.saving}${wName(world) ? ` · ${wName(world)}` : ""}`, percent: 0, hint: t.hint });
      const r = await saveWhenWritten(world, { reason: label ? "named" : "ingame", label }, { title: t.title, ask: t.pressEsc, waitMs: F6_WAIT_MS });
      if (!r) {
        // Jamais abandonnée : elle part à la prochaine pause ou au prochain enregistrement du jeu.
        if (game) game.pending = { reason: label ? "named" : "ingame", label };
        info("Sauvegarde F6 reportée : elle partira à la prochaine pause ou au prochain enregistrement du jeu.");
        overlay.show({ mode: "error", title: t.title, text: t.postponed, hint: t.hint }, { hideAfter: 6000 });
        return;
      }
      overlay.show({ mode: "done", title: label ? t.doneNamed(label) : t.done, text: r.skipped ? t.unchanged : "", hint: t.hint }, { hideAfter: 3500 });
    } catch (error) {
      warn(`Sauvegarde en jeu impossible : ${error instanceof Error ? error.message : error}`);
      overlay.show({ mode: "error", title: t.failed, text: error instanceof Error ? error.message : String(error) }, { hideAfter: 6000 });
    } finally {
      busy = false;
    }
  }

  // Toutes les X min de jeu. `fromPause` : le jeu vient d'enregistrer (pause) ; sinon on copie ce
  // qu'il a déjà écrit sur le disque. Le petit menu (sans prendre le focus, le jeu continue)
  // montre la progression, sauf si le joueur a coupé la notification.
  async function interval(fromPause) {
    if (!game || busy) return;
    busy = true;
    let world = null;
    try {
      world = await currentWorld();
    } catch (error) {
      warn(`Sauvegarde automatique : monde ouvert introuvable (${error instanceof Error ? error.message : error}).`);
    }
    if (!game) {
      busy = false;
      return;
    }
    // Jeu fermé pendant la recherche du monde (audit du 25/10) : sinon `busy` restait bloqué.
    if (!game) {
      busy = false;
      return;
    }
    if (!world || !world.backup) {
      busy = false;
      // Jamais en silence : on le dit dans la console. Monde introuvable : nouvel essai dans 2 min.
      game.lastSaveAt = world ? Date.now() : Date.now() - game.everyMs + RETRY_MS;
      info(world ? `Sauvegarde automatique : coupée pour « ${world.name} ».` : "Sauvegarde automatique : aucun monde ouvert repéré, nouvel essai dans 2 min.");
      return;
    }
    game.everyMs = everyMs(world);
    info(`Sauvegarde automatique de « ${world.name} » (toutes les ${minTxt(game.everyMs)}${fromPause ? ", jeu en pause" : ""}).`);
    const t = T();
    // Une sauvegarde F6 reportée passe avant (même copie, avec son nom).
    const job = game.pending || { reason: "interval", label: null };
    game.pending = null;
    const show = getToastEnabled?.() !== false || job.reason !== "interval";
    try {
      if (fromPause) await sleep(AFTER_PAUSE_MS);
      if (show) overlay.show({ mode: "progress", title: t.autoTitle, text: `${t.saving}${wName(world) ? ` · ${wName(world)}` : ""}`, percent: 0, hint: t.hint });
      // Le petit menu demande Échap même si la notification est coupée : sans ça, le joueur ne
      // saurait pas pourquoi la sauvegarde attend.
      const r = await saveWhenWritten(world, { reason: job.reason, label: job.label, show, title: t.autoTitle }, { title: t.autoTitle, ask: t.autoAsk, waitMs: AUTO_WAIT_MS });
      if (!r) {
        if (game) {
          if (job.reason !== "interval") game.pending = job;
          game.lastSaveAt = Date.now() - game.everyMs + RETRY_MS;
        }
        info("Sauvegarde automatique reportée : ni pause ni sauvegarde du jeu. Nouvel essai dans 2 min.");
        overlay.show({ mode: "error", title: t.autoTitle, text: t.autoPostponed, hint: t.hint }, { hideAfter: 5000 });
        return;
      }
      if (game) {
        game.lastSaveAt = Date.now(); // sauvegardé, ou rien de changé : prochaine dans X min
        game.fails = 0;
      }
      info(r.backup ? `Sauvegarde automatique faite. Prochaine dans ${minTxt(game?.everyMs || INTERVAL_MS)}.` : "Sauvegarde automatique : rien n'a changé depuis la dernière, rien de nouveau gardé.");
      if (show) {
        if (r.backup) overlay.show({ mode: "done", title: job.label ? t.doneNamed(job.label) : t.autoDone, text: wName(world), hint: t.hint }, { hideAfter: 4000 });
        else overlay.show({ mode: "done", title: t.autoTitle, text: t.unchanged, hint: t.hint }, { hideAfter: 3000 });
      }
    } catch (error) {
      // Copie pas fiable ou erreur : aucune sauvegarde gardée, nouvel essai dans 2 min.
      if (game) {
        game.lastSaveAt = Date.now() - game.everyMs + RETRY_MS;
        game.fails = (game.fails || 0) + 1;
      }
      warn(`Sauvegarde automatique reportée : ${error instanceof Error ? error.message : error}`);
      if (game && job.reason !== "interval") game.pending = job;
      overlay.show({ mode: "error", title: t.autoTitle, text: error?.code === "unsafe" ? t.retry : `${error instanceof Error ? error.message : error} · ${t.autoPostponed}` }, { hideAfter: 5000 });
    } finally {
      busy = false;
    }
  }

  // Monde quitté vers le menu : le jeu l'a enregistré et fermé, on le zippe directement.
  // Mis dans la file tout de suite (avant même de savoir quel monde) : afterGame attend la file.
  function worldClosed(worldPromise) {
    enqueue(async () => {
      const world = await worldPromise;
      if (world?.backup) await doBackup(world, { reason: "world-exit", live: false, show: false });
    }).catch((error) =>
      warn(`Sauvegarde à la sortie du monde impossible : ${error instanceof Error ? error.message : error}`),
    );
  }

  // La sortie du jeu arrive par morceaux, qui peuvent couper une ligne en deux : on recolle les
  // morceaux et on ne lit que des lignes entières.
  function line(chunk) {
    if (!game) return;
    const parts = (game.partial + String(chunk)).split(/\r?\n/);
    game.partial = parts.pop().slice(-4000);
    for (const text of parts) if (text) readLine(text);
  }
  function readLine(text) {
    if (!game) return;
    const now = Date.now();
    if (!game.lines++) info("Le journal du jeu arrive bien au launcher.");
    if (RE_WORLD_START.test(text)) {
      // Quel monde (pour sa fréquence) : session.lock est écrit juste après cette ligne.
      const since = now;
      setTimeout(() => {
        if (!game || game.worldSince !== since) return;
        currentWorld()
          .then((w) => {
            if (!game || game.worldSince !== since) return;
            if (w) game.everyMs = everyMs(w);
            info(w ? `Entrée dans « ${w.name} » (journal du jeu). Sauvegarde automatique ${w.backup ? `dans ${minTxt(game.everyMs)}` : "coupée pour ce monde"}.` : "Entrée dans un monde (journal du jeu), pas encore repéré sur le disque.");
          })
          .catch(() => {});
      }, 3000);
      setTimeout(() => notice("journal du jeu"), 4000);
      game.sawWorldLog = true;
      game.inWorld = true;
      game.worldSince = now;
      game.lastSaveAt = now;
      game.closing = null;
    }
    if (RE_PAUSE_SAVE.test(text)) {
      game.lastPauseAt = now;
      for (const w of [...pauseWaiters]) w(now);
      if (game.inWorld && !busy && (game.pending || now - game.lastSaveAt >= game.everyMs)) interval(true).catch((error) => warn(`Sauvegarde automatique : ${error instanceof Error ? error.message : error}`));
    }
    if (RE_WORLD_STOP.test(text) && game.inWorld) {
      info("Sortie du monde (journal du jeu) : sauvegarde du monde fermé.");
      game.inWorld = false;
      game.leftLaunched = true; // le monde lancé depuis sa carte est fermé : on ne s'y fie plus
      // Le monde est encore repérable (session.lock) : on le retient avant qu'un autre s'ouvre.
      const since = game.worldSince;
      const closing = (game.closing = { world: playMode.openWorld(since).catch(() => null), timer: null });
      const finish = () => {
        if (game?.closing !== closing) return;
        game.closing = null;
        worldClosed(closing.world);
      };
      closing.finish = finish;
      closing.timer = setTimeout(finish, 10_000);
    }
    if (RE_WORLD_SAVED.test(text) && game.closing) {
      clearTimeout(game.closing.timer);
      game.closing.finish();
    }
  }

  function start({ startedAt = Date.now(), pid = null, worldKey = null } = {}) {
    stopTimers();
    // Le petit menu est créé tout de suite (caché) : ensuite seulement montré et caché, sans focus.
    overlay.warm?.();
    // Le petit menu suit la fenêtre du jeu (écran, position), voir gameWindow.js.
    tracker = trackWindow?.(pid, { onRect: (rect) => overlay.setAnchor(rect), log: (m) => info(m) }) || null;
    game = {
      startedAt, inWorld: false, sawWorldLog: false, lines: 0, partial: "", worldSince: startedAt, lastPauseAt: 0, lastSaveAt: startedAt,
      closing: null, timer: null, noticed: null, launchedKey: worldKey, leftLaunched: false, fails: 0, pending: null, waiting: false,
      everyMs: everyMs(worldKey ? { key: worldKey } : null),
    };
    info(`Partie lancée${worldKey ? " depuis la carte d'un monde" : ""} : sauvegarde automatique toutes les ${minTxt(game.everyMs)} dans un monde.`);
    // Toutes les X min dans un monde : sauvegarde automatique (vérifiée toutes les 20 s).
    game.timer = setInterval(() => {
      // Journal du jeu muet : le rappel des touches s'affiche quand un monde ouvert est repéré.
      if (game && !game.sawWorldLog && game.noticed == null) {
        playMode.openWorld(game.startedAt).then((w) => w && notice("session.lock")).catch(() => {});
      }
      if (game && (game.inWorld || !game.sawWorldLog) && !busy && (game.pending || Date.now() - game.lastSaveAt >= game.everyMs)) interval(false).catch((error) => warn(`Sauvegarde automatique : ${error instanceof Error ? error.message : error}`));
    }, 20_000);
    try {
      // Touches enregistrées seulement pendant la partie (elles sont prises à tout Windows).
      const run = (ask) => () => manual(ask).catch((error) => warn(`Sauvegarde en jeu : ${error instanceof Error ? error.message : error}`));
      const f6 = globalShortcut.register("F6", run(false));
      const shiftF6 = globalShortcut.register("Shift+F6", run(true));
      // false : une autre appli a déjà pris la touche (Windows ne la donne qu'à une seule).
      if (f6 && shiftF6) info("Touches F6 et Maj+F6 prêtes.");
      else warn(`Sauvegarde en jeu : touche déjà prise par une autre application (F6 ${f6 ? "ok" : "refusée"}, Maj+F6 ${shiftF6 ? "ok" : "refusée"}).`);
    } catch (error) {
      warn(`Touches F6 non enregistrées : ${error instanceof Error ? error.message : error}`);
    }
  }

  let tracker = null;
  function stopTimers() {
    tracker?.stop();
    tracker = null;
    overlay.setAnchor?.(null);
    if (game?.timer) clearInterval(game.timer);
    if (game?.closing?.timer) clearTimeout(game.closing.timer);
  }

  // Jeu fermé : touches libérées, menu fermé. Résout quand la dernière sauvegarde en cours est finie
  // (afterGame passe après, jamais en même temps).
  async function stop() {
    stopTimers();
    try {
      globalShortcut.unregister("F6");
      globalShortcut.unregister("Shift+F6");
    } catch {}
    // Détruite tout de suite : une fenêtre cachée empêcherait le launcher de se fermer, et la
    // fin de partie réaffiche toutes les fenêtres (keepLauncherOpenWhilePlaying).
    overlay.destroy();
    game = null;
    for (const w of [...pauseWaiters]) w(Infinity);
    await chain;
  }

  // Petit rappel des touches (5 s) à l'entrée dans un monde. Repéré par le journal du jeu, ou à
  // défaut par session.lock (voir le minuteur dans start), une fois par monde ouvert.
  function notice(how) {
    if (!game || busy || game.noticed === game.worldSince) return;
    game.noticed = game.worldSince;
    info(`Rappel des touches affiché (monde repéré par ${how}).`);
    const t = T();
    overlay.show({ mode: "done", title: t.title, text: t.ready(Math.round(game.everyMs / 60_000)), hint: t.hint }, { hideAfter: 9000 });
  }

  // Affiche le petit menu 4 s, sans jeu (l'ancien bouton de test a été retiré le 25/10).
  // `at` : la fenêtre du launcher (pendant une partie, le menu reste collé au jeu).
  function testOverlay(at = null) {
    const t = T();
    info("Test du petit menu demandé.");
    if (game) return overlay.show({ mode: "done", title: t.title, text: t.done, hint: t.hint }, { hideAfter: 4000 });
    // Hors partie (audit du 25/10) : la fenêtre est refermée après le test, sinon cachée elle
    // empêchait le launcher de se fermer.
    overlay.warm?.();
    setTimeout(() => !game && overlay.destroy(), 4600);
    return overlay.show({ mode: "done", title: t.title, text: t.done, hint: t.hint }, { hideAfter: 4000, at });
  }

  return { start, stop, line, enqueue, manual, interval, testOverlay };
}

module.exports = { createLiveSave, INTERVAL_MS };
