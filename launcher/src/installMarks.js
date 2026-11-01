// Repère « Installé » (26/10, variante A de la preview validée par Rushi) : une petite pastille
// « ✓ Installé » à côté des badges, partout où un serveur apparaît (Annuaire, Accueil, Favoris,
// Récents, Mes serveurs), pour savoir sans ouvrir le menu « … » ce qui est déjà sur ce PC.
// Pendant une installation : « ⬇ 42 % » avec une fine barre. Non installé : rien.
// Les puces Favoris de l'accueil, trop petites pour du texte, ont un rond ✓ dans le coin de l'icône.
//
// Chargé après renderer.js (activity, libraryTab, favoritesPanelEl, escapeHtml, renderTasksPanel,
// uninstallServer, deleteInstanceFiles en viennent). La pastille est posée APRÈS chaque rendu
// (MutationObserver) : aucune fonction qui dessine les cartes n'est modifiée.
(function () {
  const L = () => (window.i18n?.getLocale?.() === "en" ? "en" : "fr");
  const S = {
    fr: { ok: "Installé", okTip: "Installé sur ce PC", busy: "{pct} %", busyTip: "Installation en cours : {pct} %", queued: "En attente", queuedTip: "Installation en attente", paused: "En pause {pct} %" },
    en: { ok: "Installed", okTip: "Installed on this PC", busy: "{pct}%", busyTip: "Installing: {pct}%", queued: "Queued", queuedTip: "Installation queued", paused: "Paused {pct}%" },
  };
  const tr = (key, vars = {}) => S[L()][key].replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");

  let installedSlugs = new Set();
  let loaded = false;
  let lastBusy = new Set();

  // Relit la liste des serveurs installés (lecture disque seule, voir instances:listInstalled).
  async function refreshInstalledMarks() {
    const local = await window.mchub.listLocalInstances().catch(() => null);
    if (local?.ok) installedSlugs = new Set(local.instances.map((instance) => instance.slug));
    loaded = true;
    paintInstallMarks();
  }
  window.refreshInstalledMarks = refreshInstalledMarks;

  // Installations en cours (bouton Installer ou téléchargement avant de rejoindre).
  function installingBySlug() {
    const map = new Map();
    for (const task of activity.tasks || []) {
      if (!task.slug || !["active", "paused", "queued"].includes(task.status)) continue;
      const pct = task.totalBytes ? Math.min(99, Math.floor((task.bytes / task.totalBytes) * 100)) : 0;
      map.set(task.slug, { pct, status: task.status });
    }
    return map;
  }

  // Où poser la pastille dans chaque sorte de carte.
  const TARGETS = [
    { sel: ".row[data-slug]", title: ".row-title-line" },
    { sel: ".instance-card[data-slug]", title: ".instance-card-title" },
    { sel: ".home-resume[data-slug]", title: ".home-resume-txt p" },
    { sel: ".home-fav-chip[data-slug]", icon: ".home-fav-chip-icon" },
    { sel: ".home-pick[data-slug]", title: ".home-pick-tag", after: true },
  ];

  function stateOf(el, busy) {
    // Bibliothèque > Installés : tout y est installé, la pastille n'apprendrait rien.
    if (libraryTab === "installed" && favoritesPanelEl.contains(el)) return "";
    const task = busy.get(el.dataset.slug);
    if (task) return `${task.status === "active" ? "busy" : task.status}:${task.pct}`;
    return installedSlugs.has(el.dataset.slug) ? "ok" : "";
  }

  const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';
  const DL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3.5 13.5h9"/></svg>';

  function markEl(state, corner) {
    const [what, pctText] = state.split(":");
    const pct = Number(pctText) || 0;
    const el = document.createElement("span");
    el.className = `inst-mark ${corner ? "inst-corner" : "inst-chip"} ${what}`;
    el.style.setProperty("--pct", `${pct}%`);
    const tip = what === "ok" ? tr("okTip") : what === "queued" ? tr("queuedTip") : what === "paused" ? tr("paused", { pct }) : tr("busyTip", { pct });
    el.title = tip;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", tip);
    if (corner) {
      el.innerHTML = what === "ok" ? CHECK : DL;
      return el;
    }
    const label = what === "ok" ? tr("ok") : what === "queued" ? tr("queued") : what === "paused" ? tr("paused", { pct }) : tr("busy", { pct });
    el.innerHTML = `${what === "ok" ? CHECK : DL}<span>${escapeHtml(label)}</span>${what === "ok" ? "" : '<i class="inst-bar"></i>'}`;
    return el;
  }

  // Le rond du coin a besoin d'un parent en position relative (l'icône coupe ce qui dépasse).
  function iconWrap(icon) {
    if (icon.parentElement?.classList.contains("inst-icon-wrap")) return icon.parentElement;
    const wrap = document.createElement("span");
    wrap.className = "inst-icon-wrap";
    icon.replaceWith(wrap);
    wrap.appendChild(icon);
    return wrap;
  }

  let painting = false;
  function paintInstallMarks(root = document) {
    if (!loaded) return;
    painting = true;
    try {
      const busy = installingBySlug();
      for (const target of TARGETS) {
        root.querySelectorAll(target.sel).forEach((el) => {
          const state = stateOf(el, busy);
          const key = `${L()}|${state}`;
          // Rien n'a changé : on ne touche pas au DOM (sinon l'observateur se relancerait).
          if (el.dataset.instMark === key && (!state || el.querySelector(".inst-mark"))) return;
          el.querySelectorAll(".inst-mark").forEach((mark) => mark.remove());
          el.dataset.instMark = key;
          if (!state) return;
          if (target.icon) {
            const icon = el.querySelector(target.icon);
            if (icon) iconWrap(icon).appendChild(markEl(state, true));
            return;
          }
          const anchor = el.querySelector(target.title);
          if (!anchor) return;
          if (target.after) anchor.after(markEl(state, false));
          else anchor.appendChild(markEl(state, false));
        });
      }
    } finally {
      painting = false;
    }
  }
  window.paintInstallMarks = paintInstallMarks;

  // Repeint après chaque rendu (listes, accueil, Mes serveurs), une fois par image au plus.
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      paintInstallMarks();
    });
  }
  const ownNode = (node) => node.nodeType !== 1 || node.classList.contains("inst-mark") || node.classList.contains("inst-icon-wrap");
  new MutationObserver((records) => {
    if (painting) return;
    if (records.every((record) => [...record.addedNodes, ...record.removedNodes].every(ownNode))) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true });

  // Mise à jour tout de suite après Installer / Désinstaller : une installation qui se termine
  // (ou est annulée) relit le disque ; Désinstaller et « Supprimer les fichiers » aussi.
  const baseRenderTasksPanel = renderTasksPanel;
  renderTasksPanel = function (tasks) {
    baseRenderTasksPanel(tasks);
    const busyNow = new Set(installingBySlug().keys());
    const finished = [...lastBusy].some((slug) => !busyNow.has(slug));
    lastBusy = busyNow;
    if (finished) refreshInstalledMarks();
    else schedule();
  };
  const baseUninstallServer = uninstallServer;
  uninstallServer = async function (server) {
    const done = await baseUninstallServer(server);
    await refreshInstalledMarks();
    return done;
  };
  const baseDeleteInstanceFiles = deleteInstanceFiles;
  deleteInstanceFiles = async function (server) {
    const done = await baseDeleteInstanceFiles(server);
    await refreshInstalledMarks();
    return done;
  };
  // Un dossier supprimé à la main pendant que le launcher est ouvert : relu au retour sur la fenêtre.
  window.addEventListener("focus", () => refreshInstalledMarks());

  refreshInstalledMarks();

  const css = document.createElement("style");
  css.textContent = `
  .inst-mark svg { width: 11px; height: 11px; flex: none; }
  .inst-chip { position: relative; overflow: hidden; display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 0 8px 0 6px; line-height: 18px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; color: var(--muted); border: 1px solid var(--border); }
  .inst-chip.ok svg { color: var(--success); }
  .inst-chip.busy, .inst-chip.paused, .inst-chip.queued { color: var(--accent-2); border-color: color-mix(in srgb, var(--accent) 45%, transparent); font-variant-numeric: tabular-nums; }
  .inst-chip .inst-bar { position: absolute; left: 0; bottom: 0; height: 2px; width: var(--pct); background: var(--accent); transition: width 0.5s; }
  .home-pick-tag + .inst-chip { margin-top: 4px; width: max-content; }
  .inst-icon-wrap { position: relative; display: inline-flex; flex: none; }
  .inst-corner { position: absolute; right: -4px; bottom: -4px; width: 13px; height: 13px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: var(--success); color: #06261a; box-shadow: 0 0 0 2px var(--surface); z-index: 1; }
  .inst-corner svg { width: 8px; height: 8px; }
  .inst-corner.busy, .inst-corner.paused, .inst-corner.queued { background: conic-gradient(var(--accent) var(--pct), color-mix(in srgb, var(--accent) 30%, var(--surface)) 0); color: #fff; }
  `;
  document.head.appendChild(css);
})();
