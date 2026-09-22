(function () {
  const t = window.i18n.t;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = (n, len = 2) => String(n).padStart(len, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  function rowHtml(entry) {
    return `
      <div class="log-row level-${entry.level}" data-id="${entry.id}">
        <span class="log-time">${formatTime(entry.ts)}</span>
        <span class="log-level">${entry.level.toUpperCase()}</span>
        <span class="log-source">${escapeHtml(entry.source)}</span>
        <span class="log-msg">${escapeHtml(entry.message)}</span>
      </div>`;
  }

  function rowText(entry) {
    return `${formatTime(entry.ts)}  ${entry.level.toUpperCase().padEnd(5)}  ${entry.source.padEnd(8)}  ${entry.message}`;
  }

  const bodyEl = document.getElementById("console-body");
  const searchEl = document.getElementById("console-search");
  const pauseBtn = document.getElementById("console-pause");
  const clearBtn = document.getElementById("console-clear");
  const copyBtn = document.getElementById("console-copy");
  const countErrorEl = document.getElementById("count-error");
  const countWarnEl = document.getElementById("count-warn");

  let entries = [];
  let pendingWhilePaused = [];
  let paused = false;
  let sourceFilter = "all";
  let levelFilter = null;

  function matchesFilter(entry) {
    if (sourceFilter !== "all" && entry.source !== sourceFilter) return false;
    if (levelFilter && entry.level !== levelFilter) return false;
    const query = searchEl.value.trim().toLowerCase();
    if (query && !entry.message.toLowerCase().includes(query)) return false;
    return true;
  }

  function updateCounts() {
    countErrorEl.textContent = entries.filter((e) => e.level === "error").length;
    countWarnEl.textContent = entries.filter((e) => e.level === "warn").length;
  }

  function renderAll() {
    const visible = entries.filter(matchesFilter);
    bodyEl.innerHTML = visible.length
      ? visible.map(rowHtml).join("")
      : `<div id="console-empty">${t("debugConsole.empty")}</div>`;
    bodyEl.scrollTop = bodyEl.scrollHeight;
    updateCounts();
  }

  function appendEntry(entry) {
    entries.push(entry);
    if (!matchesFilter(entry)) {
      updateCounts();
      return;
    }
    const nearBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 60;
    const empty = document.getElementById("console-empty");
    if (empty) empty.remove();
    bodyEl.insertAdjacentHTML("beforeend", rowHtml(entry));
    if (nearBottom) bodyEl.scrollTop = bodyEl.scrollHeight;
    updateCounts();
  }

  document.querySelectorAll(".filter-chip[data-source]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sourceFilter = btn.dataset.source;
      document.querySelectorAll(".filter-chip[data-source]").forEach((b) => b.classList.toggle("active", b === btn));
      renderAll();
    });
  });

  document.querySelectorAll(".filter-chip[data-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const level = btn.dataset.level;
      levelFilter = levelFilter === level ? null : level;
      document.querySelectorAll(".filter-chip[data-level]").forEach((b) => b.classList.toggle("active", b.dataset.level === levelFilter));
      renderAll();
    });
  });

  searchEl.addEventListener("input", renderAll);

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.classList.toggle("active", paused);
    if (!paused) {
      for (const entry of pendingWhilePaused) appendEntry(entry);
      pendingWhilePaused = [];
    }
  });

  clearBtn.addEventListener("click", () => {
    entries = [];
    pendingWhilePaused = [];
    // Vide aussi le tampon partage cote main.js (logStore.js) — sinon
    // rouvrir cette fenetre restaure les lignes "effacees" via getAll().
    window.mchub.logs.clear();
    renderAll();
  });

  copyBtn.addEventListener("click", async () => {
    const text = entries.filter(matchesFilter).map(rowText).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Presse-papier indisponible (permissions) — pas de raison bloquante
      // pour une simple commodité de copie.
    }
  });

  // Barre de titre custom : voir windowControls.js (module partage avec
  // renderer.js, sur le modele de theme.js/i18n.js).
  const wireWindowControls = window.windowControls.wireWindowControls;

  async function boot() {
    const settings = await window.mchub.settings.get();
    window.i18n.setLocale(settings.locale);
    window.i18n.applyStaticI18n(document);
    window.themeControls.applyTheme(settings);
    window.themeControls.watchSystemTheme(() => window.mchub.settings.get());
    document.documentElement.lang = settings.locale;

    wireWindowControls();

    entries = await window.mchub.logs.getAll();
    renderAll();

    window.mchub.logs.onEntry((entry) => {
      if (paused) {
        pendingWhilePaused.push(entry);
        return;
      }
      appendEntry(entry);
    });
  }

  boot();
})();
