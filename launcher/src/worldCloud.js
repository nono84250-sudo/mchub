// Synchro des mondes avec le cloud (mode Jouer, bêta, 24/10), pour les joueurs dont l'offre
// inclut la sauvegarde en ligne (Supporter ; offre simulée dans l'admin tant que le paiement
// n'existe pas). Principe :
// - on n'envoie JAMAIS le monde en cours d'écriture : seulement une sauvegarde .zip déjà faite,
//   jeu fermé (playMode.backupWorld) — une copie figée ;
// - envoi par morceaux, directement vers le stockage (liens signés donnés par le site), chaque
//   morceau vérifié (empreinte MD5 comparée à celle renvoyée par le stockage), renvoyé s'il est
//   abîmé ; le monde n'est marqué « dans le cloud » qu'une fois tout assemblé et vérifié ;
// - en arrière-plan, en pause pendant que le jeu tourne (ou à la main), avec reprise après une
//   coupure ou un redémarrage du launcher (file d'attente sur le disque, morceaux déjà reçus
//   demandés au site) ;
// - le quota vient de l'offre renvoyée par le site, jamais d'une valeur écrite ici.
// Plusieurs PC (24/10, preview validée) :
// - un autre PC du même compte voit les mondes du cloud « Pas sur ce PC » et les télécharge en
//   arrière-plan (place vérifiée avant, version et pack installés avec le monde) ;
// - avant chaque « Jouer » d'un monde du cloud, le site dit s'il est ouvert ailleurs ou s'il a été
//   joué ailleurs depuis la copie de ce PC (verrou avec battement de cœur toutes les 5 min, gardé
//   jusqu'à la fin de l'envoi de la sauvegarde) ;
// - rien n'est jamais écrasé : si deux PC avancent chacun de leur côté, le site garde les deux
//   versions et le joueur choisit laquelle continuer (l'autre reste dans les sauvegardes).
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");

const URL_BATCH = 50; // liens signés demandés par appel (limite du site)
const PART_TRIES = 4;
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000];
const SPEEDTEST_BYTES = 1024 * 1024;
const BEAT_MS = 5 * 60_000; // battement de cœur du verrou (le site le croit périmé après 12 min)
const WAIT_POLL_MS = 60_000; // « Me prévenir quand il est fermé » : une vérification par minute
const WAIT_MAX_MS = 6 * 60 * 60_000;

function createWorldCloud({ playMode, siteUrl, authHeaders, currentUuid, log, onUpdate, onDownload, ensureVersionForMeta, installVersion, device }) {
  const STATE_FILE = path.join(playMode.PLAY_ROOT, "cloud-queue.json");
  // { syncedKeys: [clés choisies par le joueur], queue: [{ key, name, backupId, file, size, sha256 }] }
  // locks : mondes dont ce PC tient le verrou sur le site (repris au redémarrage).
  let state = { syncedKeys: [], queue: [], locks: [] };
  try {
    state = { syncedKeys: [], queue: [], locks: [], ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) };
  } catch {
    /* premier lancement */
  }
  const saveState = () =>
    fsp
      .mkdir(path.dirname(STATE_FILE), { recursive: true })
      .then(() => fsp.writeFile(`${STATE_FILE}.part`, JSON.stringify(state)))
      .then(() => fsp.rename(`${STATE_FILE}.part`, STATE_FILE))
      .catch(() => {});

  // État affiché dans la pilule et le panneau des tâches (window.playCloudActivity côté renderer).
  let job = null; // { items: [{ key, name, size, sent, done, error }], total, sent, bps, paused, done, error }
  let manualPause = false;
  // Laboratoire (25/10) : « Mondes en ligne » coupé pour ce joueur → plus rien ne part (voir suspend).
  let suspended = false;
  let gameRunning = false;
  let running = false;
  let retryTimer = null;
  // « Arrêter » (retour de Rushi du 25/10) : coupe le morceau en cours d'envoi.
  let stopCtl = new AbortController();
  const stoppedError = () => Object.assign(new Error("Synchronisation arrêtée."), { code: "stopped" });
  let lastStatus = null;

  const emit = () => {
    if (job) {
      job.total = job.items.reduce((a, i) => a + (i.size || 0), 0);
      job.sent = job.items.reduce((a, i) => a + (i.done ? i.size : i.sent || 0), 0);
      job.paused = gameRunning ? "game" : manualPause ? "manual" : false;
    }
    onUpdate?.(job ? JSON.parse(JSON.stringify(job)) : null);
  };

  async function api(method, route, { query = {}, body } = {}) {
    const uuid = currentUuid();
    if (!uuid) throw Object.assign(new Error("Connecte-toi pour utiliser la sauvegarde en ligne."), { code: "session" });
    const url = new URL(`${siteUrl}${route}`);
    if (method === "GET" || method === "DELETE") {
      url.searchParams.set("minecraftUuid", uuid);
      for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v);
    }
    const res = await fetch(url, {
      method,
      headers: { ...authHeaders(), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify({ minecraftUuid: uuid, ...body }) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Réponse ${res.status} du site Omniscient`), { code: data.code, status: res.status });
    return data;
  }

  // Économe (retour de Rushi, 24/10 : appels répétés pour un compte sans offre) : la réponse est
  // gardée 30 min si l'offre n'inclut pas le cloud, 2 min sinon ; deux demandes en même temps
  // n'en font qu'une. `force` : après une action du joueur (synchro, retrait, fenêtre cloud).
  let statusPending = null;
  async function status({ force = false } = {}) {
    if (!force && lastStatus) {
      const maxAge = lastStatus.data.offer?.cloud ? 2 * 60_000 : 30 * 60_000;
      if (Date.now() - lastStatus.at < maxAge && lastStatus.uuid === currentUuid()) return view(lastStatus.data);
    }
    if (!statusPending) statusPending = fetchStatus().finally(() => (statusPending = null));
    return statusPending;
  }
  async function fetchStatus() {
    const data = await api("GET", "/api/launcher/worlds");
    lastStatus = { at: Date.now(), data, uuid: currentUuid() };
    // Nombre max de versions en ligne par monde selon l'offre (table des offres du site).
    playMode.setOnlineCap?.(data.offer?.cloudVersions);
    // Un monde retiré du cloud depuis le site (ou un autre PC) n'est plus suivi ici.
    const inCloud = new Set((data.worlds || []).map((w) => w.worldKey));
    const gone = state.syncedKeys.filter((k) => !inCloud.has(k) && !state.queue.some((q) => q.key === k));
    if (gone.length) {
      state.syncedKeys = state.syncedKeys.filter((k) => !gone.includes(k));
      saveState();
      // Ses sauvegardes ne sont plus en ligne : elles repartiront si le joueur le resynchronise.
      for (const k of gone) playMode.clearBackupCloud?.(k).catch(() => {});
    }
    return view(data);
  }
  // Ce que voit le renderer : + la version du cloud dont part la copie de ce PC (localBase, pour
  // « 2 versions de ce monde »), le téléchargement en cours et le nom de cet appareil.
  function view(data) {
    const worlds = (data.worlds || []).map((w) => ({ ...w, localBase: baseOf(w.worldKey) }));
    return { ok: true, ...data, worlds, job, djob, device: device.name };
  }

  // Petit envoi au site pour estimer le débit montant (annonce de la durée de la synchro).
  async function testConnection() {
    try {
      const body = crypto.randomBytes(SPEEDTEST_BYTES);
      const started = performance.now();
      const res = await fetch(`${siteUrl}/api/launcher/worlds/speedtest`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/octet-stream" },
        body,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return { ok: false };
      const sec = Math.max(0.05, (performance.now() - started) / 1000);
      return { ok: true, mbps: (SPEEDTEST_BYTES * 8) / sec / 1e6 };
    } catch {
      return { ok: false };
    }
  }

  async function sha256File(file) {
    const hash = crypto.createHash("sha256");
    await pipeline(fs.createReadStream(file), hash);
    return hash.digest("hex");
  }

  // Ajoute (ou remplace) la dernière sauvegarde d'un monde dans la file d'envoi.
  // Versions miroir (25/10, demande de Rushi) : CHAQUE sauvegarde du PC part dans le cloud, pas
  // seulement la dernière, pour qu'on retrouve la même liste sur le site et sur un autre PC.
  // Réglage « Envoi automatique dans le cloud » (fenêtre Sauvegardes, 25/10, tous les mondes) : toutes, une
  // par partie (la dernière : fin de partie ou sortie du monde, plus celles avec un nom), ou à la
  // main (seulement le bouton Synchroniser, `manual`).
  const GAME_REASONS = new Set(["auto", "world-exit", "named", "manual", "import"]);
  // Réglage « Envoi au cloud ». Retour de Rushi du 25/10 : « Une par partie » vaut aussi pour le
  // bouton Synchroniser (il envoyait toutes les sauvegardes). « À la main » : seulement Synchroniser.
  function sendAllowed(key, backup, manual) {
    if (backup.cloudDropped) return false; // retirée du cloud : reste sur le PC
    if (backup.label || backup.cloudKeep) return true;
    const send = playMode.keepConfig?.(key)?.send || "all";
    if (send === "game") return GAME_REASONS.has(backup.reason);
    if (send === "manual") return manual;
    return true;
  }
  // Sauvegarde marquée « envoyée » vers un monde du cloud qui n'existe plus (retiré puis
  // resynchronisé, retour de Rushi du 25/10 : 11 sauvegardes sur le PC, 10 en ligne) : le monde
  // en ligne a un autre identifiant, elle n'y est donc pas.
  function sentToOldWorld(key, backup) {
    const worlds = lastStatus?.data?.worlds;
    if (!backup.cloud?.worldId || !Array.isArray(worlds)) return false;
    const cw = worlds.find((w) => w.worldKey === key);
    return !!cw && cw.id !== backup.cloud.worldId;
  }
  async function enqueue(key, backup, { kickNow = true, manual = false } = {}) {
    if ((backup.cloud && !sentToOldWorld(key, backup)) || state.queue.some((q) => q.key === key && q.backupId === backup.id)) return false;
    if (!sendAllowed(key, backup, manual)) return false;
    // Plus vieille que la durée de conservation de l'offre : le site la retirerait aussitôt.
    const keepDays = lastStatus?.data?.offer?.keepDays || 0;
    if (keepDays > 0 && Date.parse(backup.createdAt) < Date.now() - keepDays * 86_400_000) return false;
    const file = playMode.backupFile(key, backup);
    const stat = await fsp.stat(file).catch(() => null);
    if (!stat) return false;
    const world = (await playMode.listWorlds()).find((w) => w.key === key);
    const pack = world?.lastVersionLabel?.pack;
    const item = {
      key,
      name: backup.name || "Monde",
      backupId: backup.id,
      file,
      size: stat.size,
      sha256: backup.sha256 || (await sha256File(file)),
      minecraftVersion: backup.minecraftVersion || null,
      packName: pack ? (typeof pack === "string" ? pack : pack.fr || pack.en || null) : null,
      reason: backup.reason || null,
      label: backup.label || null,
      createdAt: backup.createdAt || null,
    };
    state.queue.push(item);
    if (kickNow) {
      await saveState();
      ensureJob();
      kick();
    }
    return true;
  }
  // Toutes les sauvegardes pas encore en ligne des mondes donnés, les plus récentes d'abord.
  async function backfill(keys, { manual = false } = {}) {
    let added = 0;
    for (const key of keys) {
      const list = await playMode.listBackups(key).catch(() => []);
      // Seulement celles qui doivent être en ligne (les N plus récentes, les ★, les envois à la main).
      const plan = playMode.cloudPlan ? playMode.cloudPlan(list) : null;
      for (const b of list) {
        if (plan && !plan.has(b.id)) continue;
        if (await enqueue(key, b, { kickNow: false, manual }).catch(() => false)) added++;
      }
    }
    if (added) {
      await saveState();
      ensureJob();
      kick();
    }
    return added;
  }
  // Limite du monde sur ce PC (nombre ou taille) : les sauvegardes retirées d'ici le sont aussi du
  // cloud, sauf les sauvegardes nommées ; celles pas encore envoyées sortent de la file.
  // `explicit` : supprimée à la main par le joueur, retirée du cloud même si elle a un nom.
  function dropPruned(key, drop, { explicit = false } = {}) {
    const ids = new Set(drop.map((b) => b.id));
    const before = state.queue.length;
    state.queue = state.queue.filter((q) => q.key !== key || q.uploading || !ids.has(q.backupId));
    if (state.queue.length !== before) {
      saveState();
      ensureJob();
    }
    const versionIds = drop.filter((b) => b.cloud?.versionId && (explicit || !b.label)).map((b) => b.cloud.versionId);
    if (!versionIds.length || !state.syncedKeys.includes(key) || !currentUuid()) return;
    deviceApi("drop", { worldKey: key, versionIds, explicit })
      .then((r) => {
        lastStatus = null;
        log("info", `Cloud : ${r.deleted || 0} ancienne(s) version(s) retirée(s) en ligne, comme sur ce PC (limite du monde)`);
      })
      .catch((error) => log("warn", `Cloud : anciennes versions pas retirées en ligne (${error.message})`));
  }

  function ensureJob() {
    const items = state.queue.map((q) => {
      const old = job?.items.find((i) => i.key === q.key && i.backupId === q.backupId);
      return old || { key: q.key, backupId: q.backupId, name: q.name, when: q.createdAt || null, label: q.label || null, size: q.size, sent: 0, done: false, error: null };
    });
    const keepDone = job && !job.done ? job.items.filter((i) => i.done && !items.some((x) => x.key === i.key && x.backupId === i.backupId)) : [];
    job = { items: [...keepDone, ...items], total: 0, sent: 0, bps: 0, paused: false, done: items.length === 0, error: null };
    emit();
  }

  // « Lancer la synchronisation » : les mondes cochés. On part de leur dernière sauvegarde ; un
  // monde sans sauvegarde en reçoit une maintenant (jeu fermé, donc copie figée).
  async function sync(keys) {
    if (gameRunning) return { ok: false, error: "Quitte le jeu d'abord : la synchronisation démarrera ensuite." };
    const st = await status({ force: true });
    if (!st.offer?.cloud) return { ok: false, error: "La sauvegarde en ligne n'est pas incluse dans ton offre." };
    const worlds = await playMode.listWorlds();
    for (const key of keys) {
      const w = worlds.find((x) => x.key === key);
      if (!w || !w.backup) continue;
      const [latest] = await playMode.listBackups(key);
      if (!latest) await playMode.backupWorld(key, { reason: "manual", force: true });
      if (!state.syncedKeys.includes(key)) state.syncedKeys.push(key);
    }
    await saveState();
    // Les mondes cochés ET ceux déjà suivis : toutes leurs sauvegardes manquantes partent.
    await backfill(state.syncedKeys, { manual: true });
    return { ok: true };
  }

  // Après une partie (main.js) : la nouvelle sauvegarde part toute seule si ce monde est suivi.
  function queueBackup(key, backup) {
    if (!state.syncedKeys.includes(key)) return;
    pendingEnqueue++;
    enqueue(key, backup)
      .catch((error) => log("warn", `Cloud : envoi de « ${backup.name} » pas mis en file (${error.message})`))
      .finally(() => {
        pendingEnqueue--;
        releaseLocks();
      });
  }

  async function remove(key) {
    try {
      await api("DELETE", "/api/launcher/worlds", { query: { worldKey: key } });
    } catch (error) {
      return { ok: false, error: error.message };
    }
    state.syncedKeys = state.syncedKeys.filter((k) => k !== key);
    await playMode.clearBackupCloud?.(key).catch(() => {});
    const dropped = state.queue.filter((q) => q.key === key);
    state.queue = state.queue.filter((q) => q.key !== key);
    await saveState();
    for (const q of dropped) if (q.uploadId) api("POST", "/api/launcher/worlds/upload", { body: { action: "abort", id: q.uploadId } }).catch(() => {});
    if (job) {
      job.items = job.items.filter((i) => i.key !== key);
      if (!job.items.some((i) => !i.done)) job.done = true;
      emit();
    }
    return { ok: true };
  }

  function setGameRunning(on) {
    gameRunning = !!on;
    emit();
    if (!gameRunning) {
      kick();
      releaseLocks();
    }
  }
  function pause() {
    manualPause = true;
    emit();
    return { ok: true };
  }
  function resume() {
    manualPause = false;
    emit();
    kick();
    return { ok: true };
  }
  // « Versions en ligne » (25/10) : au plus N versions automatiques par monde en ligne ; les ★ et
  // les envois à la main restent en plus. Les autres sortent du cloud et restent sur le PC
  // (cloudDropped : elles ne repartent plus toutes seules).
  async function limitOnline(key) {
    if (!playMode.cloudPlan || !currentUuid()) return 0;
    const list = await playMode.listBackups(key);
    const plan = playMode.cloudPlan(list);
    const extra = list.filter((b) => b.cloud?.versionId && !plan.has(b.id));
    if (!extra.length) return 0;
    const r = await deviceApi("drop", { worldKey: key, versionIds: extra.map((b) => b.cloud.versionId), explicit: false });
    const gone = new Set(r.deletedIds || []);
    for (const b of extra) if (gone.has(b.cloud.versionId)) await playMode.patchBackup(key, b.id, { cloud: null, cloudDropped: true });
    if (gone.size) {
      lastStatus = null;
      log("info", `Cloud : ${gone.size} ancienne(s) version(s) retirée(s) en ligne (limite de ${playMode.onlineLimit()} par monde), gardée(s) sur ce PC`);
    }
    return gone.size;
  }
  async function limitAllOnline() {
    let n = 0;
    for (const key of state.syncedKeys) n += await limitOnline(key).catch(() => 0);
    return n;
  }
  // ✕ « Retirer du cloud » sur une sauvegarde : elle reste sur le PC.
  async function uncloudBackup(key, backupId) {
    state.queue = state.queue.filter((q) => q.uploading || !(q.key === key && q.backupId === backupId));
    const b = (await playMode.listBackups(key)).find((x) => x.id === backupId);
    if (!b) return { ok: false, error: "Sauvegarde introuvable." };
    if (b.cloud?.versionId) {
      try {
        const r = await deviceApi("drop", { worldKey: key, versionIds: [b.cloud.versionId], explicit: true });
        if (!(r.deletedIds || []).includes(b.cloud.versionId)) return { ok: false, error: "C'est la version à continuer de ce monde : elle reste en ligne pour tes autres PC." };
      } catch (error) {
        return { ok: false, error: error.message };
      }
      lastStatus = null;
    }
    await playMode.patchBackup(key, backupId, { cloud: null, cloudDropped: true, cloudKeep: null });
    await saveState();
    return { ok: true };
  }
  // « ☁ Envoyer » sur une sauvegarde : elle part et reste en ligne en plus des N automatiques.
  async function sendBackup(key, backupId) {
    if (!(await status().catch(() => null))?.offer?.cloud) return { ok: false, error: "La sauvegarde en ligne n'est pas incluse dans ton offre." };
    const b = await playMode.patchBackup(key, backupId, { cloudKeep: true, cloudDropped: null });
    if (!b) return { ok: false, error: "Sauvegarde introuvable." };
    if (b.cloud?.versionId) return { ok: true, already: true };
    await enqueue(key, b, { manual: true });
    return { ok: true };
  }

  // Arrête l'envoi : le morceau en cours est abandonné et l'envoi pas fini est nettoyé en ligne.
  // Ce qui est déjà parti reste dans le cloud, rien n'est supprimé sur le PC ; les sauvegardes
  // pas envoyées repartiront au prochain « Synchroniser ».
  async function stop() {
    const dropped = state.queue;
    state.queue = [];
    manualPause = false;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    stopCtl.abort();
    stopCtl = new AbortController();
    await saveState();
    for (const q of dropped) if (q.uploadId) api("POST", "/api/launcher/worlds/upload", { body: { action: "abort", id: q.uploadId } }).catch(() => {});
    if (job) {
      job.items = job.items.filter((i) => i.done);
      job.done = true;
      job.error = null;
      emit();
    }
    releaseLocks();
    log("info", `Cloud : synchronisation arrêtée par le joueur (${dropped.length} sauvegarde${dropped.length > 1 ? "s" : ""} pas envoyée${dropped.length > 1 ? "s" : ""}, gardée${dropped.length > 1 ? "s" : ""} sur le PC)`);
    return { ok: true, left: dropped.length };
  }

  const isPaused = () => suspended || gameRunning || manualPause;
  const waitWhilePaused = async () => {
    const signal = stopCtl.signal;
    while (isPaused()) {
      if (signal.aborted) throw stoppedError();
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (signal.aborted) throw stoppedError();
  };

  function kick() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (running || !state.queue.length || isPaused() || !currentUuid()) return;
    running = true;
    runQueue()
      .catch(() => {})
      .finally(() => {
        running = false;
      });
  }

  let failures = 0;
  async function runQueue() {
    while (state.queue.length) {
      await waitWhilePaused();
      const item = state.queue[0];
      const view = job?.items.find((i) => i.key === item.key && i.backupId === item.backupId);
      const signal = stopCtl.signal;
      try {
        if (!fs.existsSync(item.file)) throw Object.assign(new Error("Sauvegarde locale disparue : la suivante sera envoyée."), { code: "gone" });
        await uploadItem(item, view);
        failures = 0;
        // Plus que N versions en ligne pour ce monde : la plus vieille sort du cloud (reste sur le PC).
        limitOnline(item.key).catch((error) => log("warn", `Cloud : limite des versions en ligne pas appliquée (${error.message})`));
        state.queue.shift();
        await saveState();
        releaseLocks();
        if (view) {
          view.done = true;
          view.error = null;
        }
        if (job) job.error = null;
        emit();
      } catch (error) {
        // Arrêtée par le joueur : stop() a déjà vidé la file et nettoyé.
        if (error.code === "stopped" || signal.aborted) return;
        const msg = error instanceof Error ? error.message : String(error);
        log("warn", `Cloud : envoi de « ${item.name} » interrompu (${msg})`);
        // Erreurs définitives pour CE fichier : on passe au suivant.
        if (["gone", "tooBig", "sizeMismatch", "invalid"].includes(error.code)) {
          state.queue.shift();
          await saveState();
          if (view) view.error = msg;
          emit();
          releaseLocks();
          continue;
        }
        if (error.code === "noUpload") {
          delete item.uploadId;
          await saveState();
          continue;
        }
        // Plus d'offre cloud ou quota plein : on arrête et on le dit, sans boucler.
        if (error.code === "quotaFull") {
          // Plein : on s'arrête proprement, rien n'est supprimé, et on dit le nombre exact.
          const n = state.queue.length;
          const full = `Ton espace en ligne est plein : ${n} sauvegarde${n > 1 ? "s n'ont" : " n'a"} pas pu partir. ${n > 1 ? "Elles restent" : "Elle reste"} sur ton PC.`;
          if (view) view.error = full;
          if (job) {
            job.error = full;
            job.quotaFull = n;
          }
          log("warn", `Cloud : ${full}`);
          emit();
          return;
        }
        if (error.code === "noCloud" || error.code === "session") {
          if (view) view.error = msg;
          if (job) job.error = msg;
          emit();
          return;
        }
        // Coupure réseau, site occupé… : nouvel essai plus tard, depuis le dernier morceau reçu.
        if (view) view.error = null;
        if (job) job.error = msg;
        emit();
        const delay = RETRY_DELAYS_MS[Math.min(failures++, RETRY_DELAYS_MS.length - 1)];
        retryTimer = setTimeout(kick, delay);
        return;
      }
    }
    if (job) {
      job.done = true;
      emit();
    }
  }

  async function uploadItem(item, view) {
    const stopSignal = stopCtl.signal;
    // Le fichier n'a pas changé depuis sa mise en file (sinon il est renvoyé en entier).
    const stat = await fsp.stat(item.file);
    if (stat.size !== item.size) throw Object.assign(new Error("Sauvegarde modifiée pendant l'envoi."), { code: "gone" });
    const start = await api("POST", "/api/launcher/worlds/upload", {
      body: {
        action: "start",
        worldKey: item.key,
        name: item.name,
        minecraftVersion: item.minecraftVersion,
        packName: item.packName || null,
        reason: item.reason,
        sizeBytes: item.size,
        sha256: item.sha256,
        backupId: item.backupId,
        label: item.label || null,
        createdAt: item.createdAt || null,
      },
    });
    // Déjà en ligne (envoyée avant une coupure, ou depuis un autre PC) : rien à renvoyer.
    if (start.already) {
      await playMode.markBackupCloud(item.key, item.backupId, { versionId: start.versionId, worldId: start.worldId, at: new Date().toISOString() });
      return;
    }
    item.uploadId = start.id;
    item.uploading = true;
    await saveState();
    const partSize = start.partSize;
    const parts = new Map((start.uploaded || []).map((p) => [p.partNumber, p.etag]));
    const doneBytes = () => [...parts.keys()].reduce((a, n) => a + Math.min(partSize, item.size - (n - 1) * partSize), 0);
    if (view) view.sent = doneBytes();
    emit();

    const missing = [];
    for (let n = 1; n <= start.partCount; n++) if (!parts.has(n)) missing.push(n);
    const handle = await fsp.open(item.file, "r");
    try {
      for (let b = 0; b < missing.length; b += URL_BATCH) {
        const batch = missing.slice(b, b + URL_BATCH);
        const { urls } = await api("POST", "/api/launcher/worlds/upload", { body: { action: "parts", id: start.id, partNumbers: batch } });
        for (const { partNumber, url } of urls) {
          await waitWhilePaused();
          const offset = (partNumber - 1) * partSize;
          const length = Math.min(partSize, item.size - offset);
          const buf = Buffer.alloc(length);
          await handle.read(buf, 0, length, offset);
          const md5Buf = crypto.createHash("md5").update(buf).digest();
          const md5 = md5Buf.toString("hex");
          let etag = null;
          for (let tries = 1; !etag; tries++) {
            const t0 = performance.now();
            try {
              // Content-MD5 : le stockage refuse lui-même un morceau arrivé abîmé.
              const res = await fetch(url, { method: "PUT", body: buf, headers: { "Content-MD5": md5Buf.toString("base64") }, signal: AbortSignal.any([AbortSignal.timeout(5 * 60_000), stopSignal]) });
              const got = (res.headers.get("etag") || "").replace(/"/g, "");
              if (!res.ok) throw new Error(`stockage : HTTP ${res.status}`);
              // Empreinte différente : le morceau est arrivé abîmé, on le renvoie.
              if (/^[0-9a-f]{32}$/i.test(got) && got.toLowerCase() !== md5) throw new Error("morceau abîmé pendant l'envoi");
              if (!got) throw new Error("stockage : réponse sans empreinte");
              etag = got;
              const sec = Math.max(0.05, (performance.now() - t0) / 1000);
              if (job) job.bps = job.bps ? job.bps * 0.6 + (length / sec) * 0.4 : length / sec;
            } catch (error) {
              if (stopSignal.aborted) throw stoppedError();
              if (tries >= PART_TRIES) throw error;
              await new Promise((r) => setTimeout(r, 2000 * tries));
            }
          }
          parts.set(partNumber, etag);
          if (view) view.sent = doneBytes();
          emit();
        }
      }
    } finally {
      await handle.close();
    }
    if (stopSignal.aborted) throw stoppedError();
    const done = await api("POST", "/api/launcher/worlds/upload", {
      body: {
        action: "complete",
        id: start.id,
        parts: [...parts].map(([partNumber, etag]) => ({ partNumber, etag })),
        // Plusieurs PC : version du cloud dont la copie de ce PC est partie (split sinon).
        deviceId: device.id,
        deviceName: device.name,
        baseVersionId: baseOf(item.key),
      },
    });
    if (done.split) log("info", `Cloud : « ${item.name} » a avancé sur deux PC : les deux versions sont gardées, à choisir dans Mes mondes`);
    item.uploading = false;
    await playMode.markBackupCloud(item.key, item.backupId, { versionId: done.versionId, worldId: done.worldId, at: new Date().toISOString() });
    // Base pour les conflits entre PC : seulement si c'est la sauvegarde la plus récente envoyée
    // (une ancienne sauvegarde envoyée après coup ne change pas la version à continuer).
    const ws = playMode.worldState(item.key);
    if (!ws.cloud?.backupAt || !item.createdAt || item.createdAt >= ws.cloud.backupAt) {
      ws.cloud = { worldId: done.worldId, versionId: done.versionId, at: new Date().toISOString(), backupAt: item.createdAt || null };
      await playMode.saveState();
    }
    lastStatus = null; // la liste du site a changé (version à continuer, deux versions…)
  }

  // Télécharge une version (vérifiée par son empreinte) dans un fichier temporaire.
  async function fetchVersion(query, { onBytes } = {}) {
    const info = await api("GET", "/api/launcher/worlds/download", { query });
    await ensureSpace(info.sizeBytes, "le téléchargement");
    const tmpDir = path.join(playMode.PLAY_ROOT, "downloads");
    await fsp.mkdir(tmpDir, { recursive: true });
    const tmp = path.join(tmpDir, `${crypto.randomBytes(6).toString("hex")}.zip`);
    const res = await fetch(info.url, { signal: AbortSignal.timeout(60 * 60_000) });
    if (!res.ok || !res.body) throw new Error(`Téléchargement refusé (HTTP ${res.status})`);
    const hash = crypto.createHash("sha256");
    const { Readable, Transform } = require("node:stream");
    await pipeline(
      Readable.fromWeb(res.body),
      new Transform({
        transform(chunk, _enc, cb) {
          hash.update(chunk);
          onBytes?.(chunk.length);
          cb(null, chunk);
        },
      }),
      fs.createWriteStream(tmp),
    );
    if (hash.digest("hex") !== info.sha256) {
      await fsp.rm(tmp, { force: true });
      throw new Error("Le fichier téléchargé est abîmé : réessaie.");
    }
    return { tmp, info };
  }

  // « Télécharger sur ce PC » : monde présent dans le cloud mais pas sur ce PC.
  async function download(worldId) {
    let tmp;
    try {
      const got = await fetchVersion({ worldId });
      tmp = got.tmp;
      await ensureSpace(await unzippedSize(tmp), "le monde");
      const out = await playMode.importFromZip(tmp, { key: got.info.worldKey, name: got.info.name });
      if (!state.syncedKeys.includes(out.key)) state.syncedKeys.push(out.key);
      await saveState();
      await setBase(out.key, got.info);
      // Même pack et même version que sur l'autre PC (meta.json du zip).
      let versionId = null;
      if (out.meta && ensureVersionForMeta) {
        versionId = await ensureVersionForMeta(out.meta).catch(() => null);
        if (versionId) await playMode.setWorldVersion(out.key, versionId);
      }
      return { ok: true, name: out.name, key: out.key, versionId };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      if (tmp) await fsp.rm(tmp, { force: true }).catch(() => {});
    }
  }

  // Avant de lancer un monde (main.js) : une restauration demandée sur le site est appliquée
  // (sauvegarde « avant restauration » d'abord, voir playMode.restoreFromZip).
  async function applyPendingRestore(worldKey) {
    if (!worldKey || !state.syncedKeys.includes(worldKey) || !currentUuid()) return null;
    const st = await status({ force: true }).catch(() => null);
    const w = st?.worlds?.find((x) => x.worldKey === worldKey);
    if (!w?.restorePending || !w.restoreVersionId) return null;
    const { tmp } = await fetchVersion({ worldId: w.id, versionId: w.restoreVersionId });
    try {
      await playMode.restoreFromZip(worldKey, tmp);
    } finally {
      await fsp.rm(tmp, { force: true }).catch(() => {});
    }
    await api("POST", "/api/launcher/worlds/restore-done", { body: { worldKey } }).catch(() => {});
    // Restauration voulue par le joueur : la suite part de la version à continuer du cloud.
    if (w.latestVersionId) await setBase(worldKey, { versionId: w.latestVersionId });
    log("info", `Cloud : « ${w.name} » remis à la version demandée sur le site`);
    return { restored: true };
  }

  // Au démarrage / à la connexion : reprend la file laissée par la dernière session.
  function start() {
    suspended = false;
    if (state.queue.length) {
      for (const q of state.queue) q.uploading = false;
      ensureJob();
      kick();
    }
    // Versions miroir : les sauvegardes des mondes suivis pas encore en ligne partent (une fois
    // l'offre connue ; aucun appel en plus pour un compte sans offre, la réponse est gardée).
    if (state.syncedKeys.length && currentUuid()) {
      status()
        .then((st) => st?.offer?.cloud && backfill(state.syncedKeys))
        .catch(() => {});
    }
    // Verrous laissés par la dernière session : gardés tant que leur sauvegarde n'est pas partie.
    if (state.locks.length && currentUuid()) {
      startBeat();
      releaseLocks();
    }
  }

  // --- Plusieurs PC -----------------------------------------------------------------------------
  const baseOf = (key) => playMode.worldState(key).cloud?.versionId || null;
  async function setBase(key, info) {
    const ws = playMode.worldState(key);
    ws.cloud = { ...(ws.cloud || {}), versionId: info.versionId, at: new Date().toISOString(), backupAt: info.createdAt || null };
    await playMode.saveState();
  }
  function deviceApi(action, body = {}) {
    return api("POST", "/api/launcher/worlds/device", { body: { action, deviceId: device.id, deviceName: device.name, ...body } });
  }

  // Place libre sur le disque des mondes, vérifiée avant d'écrire (jamais un chiffre estimé : la
  // taille exacte du .zip, puis celle des fichiers qu'il contient avant de l'ouvrir).
  async function freeBytes() {
    let dir = playMode.PLAY_ROOT;
    while (!fs.existsSync(dir) && path.dirname(dir) !== dir) dir = path.dirname(dir);
    const st = await fsp.statfs(dir);
    return Number(st.bavail) * Number(st.bsize);
  }
  async function ensureSpace(bytes, what) {
    if (!bytes) return;
    const free = await freeBytes().catch(() => Infinity);
    if (free < bytes) {
      const mo = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1).replace(".", ",")} Go` : `${Math.ceil(n / 1e6)} Mo`);
      throw Object.assign(new Error(`Pas assez de place sur ce PC pour ${what} : il faut ${mo(bytes)} de libre, il reste ${mo(free)}.`), { code: "noSpace" });
    }
  }
  async function unzippedSize(zipFile) {
    const { listZip } = require("./zipStream");
    return (await listZip(zipFile)).reduce((a, e) => a + (e.size || 0), 0);
  }

  // Avant « Jouer » sur un monde : rien à demander au site si le monde n'est pas dans le cloud
  // (compte sans offre, monde jamais envoyé) ; sinon UN appel, qui prend aussi le verrou s'il n'y a
  // pas de conflit. `force` : le joueur a choisi de jouer quand même.
  async function beforePlay(key, { force = false } = {}) {
    if (!key || !currentUuid() || !state.syncedKeys.includes(key)) return { ok: true, conflict: null };
    const st = await status().catch(() => null);
    if (!st?.offer?.cloud || !st.worlds?.some((w) => w.worldKey === key)) return { ok: true, conflict: null };
    const r = await deviceApi("open", { worldKey: key, baseVersionId: baseOf(key), force });
    if (r.locked) {
      if (!state.locks.includes(key)) state.locks.push(key);
      await saveState();
      startBeat();
    }
    const world = st.worlds.find((w) => w.worldKey === key);
    return { ok: true, conflict: r.conflict || null, here: device.name, name: world?.name };
  }

  let beatTimer = null;
  function startBeat() {
    if (beatTimer || suspended) return;
    beatTimer = setInterval(() => {
      if (!state.locks.length) {
        clearInterval(beatTimer);
        beatTimer = null;
        return;
      }
      deviceApi("beat", { worldKeys: state.locks }).catch((error) => log("warn", `Cloud : verrou des mondes pas renouvelé (${error.message})`));
    }, BEAT_MS);
  }
  // Verrou rendu quand le jeu est fermé ET que la sauvegarde de ce monde est arrivée dans le cloud
  // (l'autre PC récupère alors la bonne version).
  let pendingEnqueue = 0;
  async function releaseLocks() {
    if (gameRunning || pendingEnqueue > 0) return;
    for (const key of [...state.locks]) {
      if (state.queue.some((q) => q.key === key)) continue;
      try {
        await deviceApi("close", { worldKey: key });
        state.locks = state.locks.filter((k) => k !== key);
        await saveState();
      } catch (error) {
        log("warn", `Cloud : verrou de monde pas rendu (${error.message}), nouvel essai plus tard`);
      }
    }
  }

  // « Récupérer la dernière version » : la version à continuer du cloud remplace la copie de ce
  // PC, après une sauvegarde « avant restauration » (playMode.restoreFromZip) : rien n'est perdu.
  async function fetchLatest(key, versionId = null) {
    const { tmp, info } = await fetchVersion(versionId ? { worldKey: key, versionId } : { worldKey: key });
    try {
      await ensureSpace(await unzippedSize(tmp), "le monde");
      const out = await playMode.restoreFromZip(key, tmp);
      if (out?.meta && ensureVersionForMeta) {
        const vId = await ensureVersionForMeta(out.meta).catch(() => null);
        if (vId) await playMode.setWorldVersion(key, vId);
      }
      // La version récupérée rejoint aussi les sauvegardes de ce PC (même liste que le site).
      await playMode.addBackupFromZip(key, tmp, { ...info, sizeBytes: info.sizeBytes }).catch(() => {});
    } finally {
      await fsp.rm(tmp, { force: true }).catch(() => {});
    }
    await setBase(key, info);
    lastStatus = null;
    log("info", `Cloud : dernière version de « ${info.name} » récupérée${info.deviceName ? ` (${info.deviceName})` : ""}`);
    return { ok: true, name: info.name, deviceName: info.deviceName || null };
  }

  // « Me prévenir quand il est fermé » : une vérification par minute (6 h au plus), jusqu'à ce que
  // le monde ne soit plus ouvert ailleurs ; la dernière version est alors récupérée si besoin.
  const waiters = new Map(); // key -> timer
  function waitClosed(key, onDone) {
    if (waiters.has(key)) return { ok: true };
    const until = Date.now() + WAIT_MAX_MS;
    const tick = async () => {
      if (!waiters.has(key)) return;
      try {
        const r = await deviceApi("check", { worldKey: key, baseVersionId: baseOf(key) });
        const c = r.conflict;
        if (!c || c.kind === "played") {
          waiters.delete(key);
          let fetched = null;
          if (c?.kind === "played" && !gameRunning) fetched = await fetchLatest(key).catch((error) => ({ ok: false, error: error.message }));
          onDone({ ok: true, deviceName: c?.deviceName || fetched?.deviceName || null, fetched: !!fetched?.ok, error: fetched && !fetched.ok ? fetched.error : null });
          return;
        }
      } catch (error) {
        log("warn", `Cloud : vérification du monde ouvert ailleurs impossible (${error.message})`);
      }
      if (Date.now() > until) {
        waiters.delete(key);
        onDone({ ok: false, timeout: true });
        return;
      }
      waiters.set(key, setTimeout(tick, WAIT_POLL_MS));
    };
    waiters.set(key, setTimeout(tick, WAIT_POLL_MS));
    return { ok: true };
  }
  function cancelWait(key) {
    clearTimeout(waiters.get(key));
    waiters.delete(key);
  }

  // « 2 versions de ce monde · Choisir laquelle continuer » : la version gardée devient celle à
  // continuer sur le site ; si ce n'est pas celle de ce PC, elle remplace la copie locale (qui part
  // d'abord dans les sauvegardes « avant restauration »). L'autre reste dans les versions du cloud.
  async function resolveSplit(key, versionId) {
    if (gameRunning) return { ok: false, error: "Quitte le jeu d'abord." };
    try {
      await deviceApi("resolve", { worldKey: key, versionId });
      if (versionId !== baseOf(key)) await fetchLatest(key, versionId);
      lastStatus = null;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Téléchargement de plusieurs mondes (« Télécharger mes mondes » ou un seul), en arrière-plan,
  // suivi dans la pilule (onDownload). Un seul à la fois ; la place est vérifiée avant chaque monde.
  let djob = null; // { items: [{ worldId, key, name, size, got, phase, done, error }], total, got, done }
  const emitDown = () => {
    if (djob) {
      djob.total = djob.items.reduce((a, i) => a + (i.size || 0), 0);
      djob.got = djob.items.reduce((a, i) => a + (i.done ? i.size : i.got || 0), 0);
    }
    onDownload?.(djob ? JSON.parse(JSON.stringify(djob)) : null);
  };
  async function downloadMany(worldIds) {
    if (djob && !djob.done) return { ok: false, error: "Un téléchargement est déjà en cours. Attends qu'il finisse." };
    const st = await status({ force: true }).catch(() => null);
    if (!st?.offer?.cloud) return { ok: false, error: "La sauvegarde en ligne n'est pas incluse dans ton offre." };
    const local = new Set((await playMode.listWorlds()).map((w) => w.key));
    const items = (st.worlds || [])
      .filter((w) => worldIds.includes(w.id) && !local.has(w.worldKey))
      // Taille exacte de TOUTES les versions du monde : elles viennent toutes sur ce PC.
      .map((w) => ({ worldId: w.id, key: w.worldKey, name: w.name, size: w.totalBytes || w.sizeBytes || 0, versions: w.versionCount || 1, got: 0, phase: "wait", done: false, error: null }));
    if (!items.length) return { ok: false, error: "Ces mondes sont déjà sur ce PC." };
    try {
      await ensureSpace(items.reduce((a, i) => a + i.size, 0), "le téléchargement");
    } catch (error) {
      return { ok: false, error: error.message, code: error.code };
    }
    djob = { items, total: 0, got: 0, done: false };
    emitDown();
    (async () => {
      for (const it of djob.items) {
        it.phase = "download";
        emitDown();
        let last = 0;
        const r = await downloadOne(it, (n) => {
          it.got += n;
          if (Date.now() - last > 300) {
            last = Date.now();
            emitDown();
          }
        });
        if (!r.ok) {
          it.error = r.error;
          it.phase = "error";
          emitDown();
          continue;
        }
        it.got = it.size;
        it.missed = r.missed || 0;
        if (r.versionId && installVersion) {
          it.phase = "install";
          emitDown();
          await installVersion(r.versionId).catch((error) => log("warn", `Cloud : version de « ${it.name} » pas installée maintenant (${error.message}) : elle le sera au lancement`));
        }
        it.phase = "done";
        it.done = true;
        emitDown();
      }
      djob.done = true;
      emitDown();
    })().catch(() => {});
    return { ok: true };
  }
  // Un monde du cloud sur ce PC : d'abord la version à continuer (le monde lui-même), puis toutes
  // les autres versions, qui deviennent ses sauvegardes sur ce PC (même liste que sur le site).
  async function downloadOne(it, onBytes) {
    let tmp;
    try {
      const list = await api("GET", "/api/launcher/worlds/versions", { query: { worldId: it.worldId } });
      const versions = list.versions || [];
      const headId = list.headVersionId || versions[0]?.id;
      const got = await fetchVersion({ worldId: it.worldId, versionId: headId }, { onBytes });
      tmp = got.tmp;
      await ensureSpace(await unzippedSize(tmp), "le monde");
      const out = await playMode.importFromZip(tmp, { key: got.info.worldKey, name: got.info.name });
      if (!state.syncedKeys.includes(out.key)) state.syncedKeys.push(out.key);
      await saveState();
      await setBase(out.key, got.info);
      await playMode.addBackupFromZip(out.key, tmp, got.info);
      tmp = null;
      let versionId = null;
      if (out.meta && ensureVersionForMeta) {
        versionId = await ensureVersionForMeta(out.meta).catch(() => null);
        if (versionId) await playMode.setWorldVersion(out.key, versionId);
      }
      let missed = 0;
      for (const v of versions) {
        if (v.id === headId) continue;
        try {
          const one = await fetchVersion({ worldId: it.worldId, versionId: v.id }, { onBytes });
          await playMode.addBackupFromZip(out.key, one.tmp, one.info);
        } catch (error) {
          missed++;
          log("warn", `Cloud : une version de « ${it.name} » n'a pas pu venir sur ce PC (${error.message})`);
        }
      }
      return { ok: true, versionId, missed };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      if (tmp) await fsp.rm(tmp, { force: true }).catch(() => {});
    }
  }

  // Laboratoire : la fonctionnalité vient d'être coupée pour ce joueur. Plus aucun minuteur ni
  // appel au site ; la file reste sur le disque et repart avec start() si elle revient.
  function suspend() {
    suspended = true;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    if (beatTimer) clearInterval(beatTimer);
    beatTimer = null;
    for (const t of waiters.values()) clearTimeout(t);
    waiters.clear();
  }

  return {
    status,
    testConnection,
    sync,
    queueBackup,
    remove,
    pause,
    resume,
    stop,
    limitOnline,
    limitAllOnline,
    uncloudBackup,
    sendBackup,
    setGameRunning,
    download,
    downloadMany,
    downloadJob: () => djob,
    suspend,
    applyPendingRestore,
    start,
    beforePlay,
    fetchLatest,
    waitClosed,
    cancelWait,
    resolveSplit,
    releaseLocks,
    dropPruned,
    device: () => device,
    isTracked: (k) => state.syncedKeys.includes(k),
    lastStatus: () => lastStatus,
  };
}

module.exports = { createWorldCloud };
