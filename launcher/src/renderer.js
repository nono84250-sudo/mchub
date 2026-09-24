const t = window.i18n.t;

const gateEl = document.getElementById("gate");
const gateMessageEl = document.getElementById("gate-message");
const gateLoginBtn = document.getElementById("gate-login");
const appEl = document.getElementById("app");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const listToolbarEl = document.getElementById("list-toolbar");
const listSearchInputEl = document.getElementById("list-search-input");
const sortRecentBtn = document.getElementById("sort-recent");
const sortPlayersBtn = document.getElementById("sort-players");
const detailEl = document.getElementById("detail");
const msAccountEl = document.getElementById("ms-account");
const settingsPanelEl = document.getElementById("settings-panel");
const accountPanelEl = document.getElementById("account-panel");
const favoritesPanelEl = document.getElementById("favorites-panel");
const recentPanelEl = document.getElementById("recent-panel");
const myInstancesPanelEl = document.getElementById("my-instances-panel");
const homePanelEl = document.getElementById("home-panel");
const javaGateEl = document.getElementById("java-gate");
const bootstrapEl = document.getElementById("bootstrap");
const bootstrapStatusEl = document.getElementById("bootstrap-status");
const bootstrapProgressEl = document.getElementById("bootstrap-progress");
const bootstrapVersionEl = document.getElementById("bootstrap-version");
const navHomeBtn = document.getElementById("nav-home");
const navServersBtn = document.getElementById("nav-servers");
const navFavoritesBtn = document.getElementById("nav-favorites");
const navRecentBtn = document.getElementById("nav-recent");
const navMyInstancesBtn = document.getElementById("nav-my-instances");
const navSettingsBtn = document.getElementById("nav-settings");
// D'ou vient la fiche detail actuellement affichee (liste "Serveurs" ou
// page "Favoris") — pour que le bouton "Retour" ramene au bon endroit.
let detailOrigin = "servers";

let signedIn = false;
// Profil du compte actif tel que reçu du processus principal — conservé ici
// pour que la page "Gérer le compte" puisse afficher le skin sans un
// nouvel aller-retour IPC.
let currentProfile = null;
// Favori actuellement selectionne dans la barre de lancement rapide (voir
// refreshPlaybarFavorites/launchServer).
let selectedFavoriteSlug = null;

// Désactive/réactive le bouton de connexion — utilisé pendant une connexion
// en cours ET quand on revient au portail après une déconnexion (sinon il
// reste grisé depuis la dernière tentative).
function setGateBusy(busy) {
  gateLoginBtn.disabled = busy;
}

function typeBadge(type) {
  return type === "modded"
    ? `<span class="badge modded">${t("serverCard.modded")}</span>`
    : `<span class="badge">${t("serverCard.vanilla")}</span>`;
}

function playersText(server) {
  if (server.playerCount === null || server.playerCount === undefined) {
    return t("serverCard.statusUnknown");
  }
  const capacity = server.playerCapacity !== null && server.playerCapacity !== undefined
    ? ` / ${server.playerCapacity}`
    : "";
  return t("serverCard.playersOnline", { count: server.playerCount, capacity });
}

function playersLabel(server) {
  const online = server.playerCount !== null && server.playerCount !== undefined;
  return `<span class="status-dot${online ? " online" : ""}"></span>${playersText(server)}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function serverInitial(name) {
  return escapeHtml((name || "?").trim().charAt(0).toUpperCase() || "?");
}

// Contenu d'un ".server-icon"/".detail-icon" pour un serveur (jamais pour un
// compte Microsoft — ceux-la gardent leur pastille-initiale) : l'image
// configuree par le proprietaire si presente, sinon la pastille-initiale
// existante.
function serverIconInner(server) {
  return server.iconUrl ? `<img src="${escapeHtml(server.iconUrl)}" alt="" />` : serverInitial(server.name);
}

// Favoris (barre de lancement rapide en bas de l'appli) : une simple liste de
// slugs dans les paramètres — pas de nouvel IPC dédié, on réutilise
// settings.get/set comme pour tout le reste des préférences locales.
const STAR_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>';
const FLAG_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';

async function getFavoriteSlugs() {
  const settings = await window.mchub.settings.get();
  return settings.favoriteServers || [];
}

async function toggleFavorite(slug) {
  const current = await getFavoriteSlugs();
  const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
  await window.mchub.settings.set({ favoriteServers: next });
  return next;
}

function favoriteBtnHtml(slug, isFav, extraClass = "") {
  return `
    <button class="favorite-btn${extraClass ? ` ${extraClass}` : ""}${isFav ? " active" : ""}" type="button" data-slug="${escapeHtml(slug)}" title="${isFav ? t("common.removeFavorite") : t("common.addFavorite")}">
      ${STAR_SVG}
    </button>`;
}

// Vrai si le joueur actuellement connecte possede ce serveur (compte
// Minecraft lie a son compte Omniscient, voir minecraft-link) — jamais vrai
// tant qu'aucun compte n'est lie ou que server.ownerMinecraftUuid est absent
// (serveur sans proprietaire lie).
function isOwnServer(server) {
  return !!(currentProfile && server.ownerMinecraftUuid && server.ownerMinecraftUuid === currentProfile.id);
}

// Ligne serveur partagee entre la liste principale, "Favoris" et "Recents" —
// meme rendu partout, seule la source de la liste de serveurs change.
function serverRowHtml(server, isFav) {
  const ownerTag = isOwnServer(server) ? `<span class="owner-tag">${t("serverCard.owner")}</span>` : "";
  return `
    <div class="row" data-slug="${escapeHtml(server.slug)}">
      <span class="server-icon" style="width: 38px; height: 38px; border-radius: 8px; font-size: 14px;">${serverIconInner(server)}</span>
      <div class="row-body">
        <div class="row-title-line">
          <h3>${escapeHtml(server.name)}</h3>
          ${typeBadge(server.type)}
          ${ownerTag}
        </div>
        <p>${escapeHtml(server.description || "")}</p>
      </div>
      <div class="players">${playersLabel(server)}</div>
      ${favoriteBtnHtml(server.slug, isFav)}
    </div>`;
}

// Liste principale "Serveurs" uniquement : recherche + tri cote client sur
// la liste deja recuperee (pas de nouvel appel reseau par frappe/clic). Les
// vues "Favoris"/"Recents" continuent d'appeler renderRowsInto() directement
// sans passer par cet etat de filtre.
let allServers = [];
let listSearchQuery = "";
let listSortMode = "recent";

function applySearchAndSort(servers) {
  const query = listSearchQuery.trim().toLowerCase();
  const filtered = query ? servers.filter((s) => s.name.toLowerCase().includes(query)) : servers.slice();
  if (listSortMode === "players") {
    filtered.sort((a, b) => (b.playerCount ?? -1) - (a.playerCount ?? -1));
  }
  return filtered;
}

async function renderRowsInto(container, servers, origin, onFavoriteToggled) {
  const favorites = await getFavoriteSlugs();
  container.innerHTML = servers.map((server) => serverRowHtml(server, favorites.includes(server.slug))).join("");

  container.querySelectorAll(".row").forEach((row) => {
    row.addEventListener("click", () => {
      detailOrigin = origin;
      openDetail(row.dataset.slug);
    });
  });
  container.querySelectorAll(".favorite-btn").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleFavorite(btn.dataset.slug);
      await refreshPlaybarFavorites();
      onFavoriteToggled();
    });
  });
}

function renderFilteredList() {
  const filtered = applySearchAndSort(allServers);
  if (filtered.length === 0 && listSearchQuery.trim()) {
    listEl.innerHTML = "";
    statusEl.hidden = false;
    statusEl.classList.remove("error");
    statusEl.textContent = t("serverList.noResults");
    return;
  }
  statusEl.hidden = true;
  renderRowsInto(listEl, filtered, "servers", renderFilteredList);
}

async function renderList(servers) {
  detailEl.hidden = true;
  listEl.hidden = false;
  listToolbarEl.hidden = servers.length === 0;
  allServers = servers;

  if (servers.length === 0) {
    listEl.innerHTML = "";
    statusEl.hidden = false;
    statusEl.textContent = t("serverList.empty");
    return;
  }

  statusEl.hidden = true;
  renderFilteredList();
}

listSearchInputEl.addEventListener("input", () => {
  listSearchQuery = listSearchInputEl.value;
  renderFilteredList();
});
[sortRecentBtn, sortPlayersBtn].forEach((btn) => {
  btn.addEventListener("click", () => {
    listSortMode = btn.dataset.sort;
    sortRecentBtn.classList.toggle("active", listSortMode === "recent");
    sortPlayersBtn.classList.toggle("active", listSortMode === "players");
    renderFilteredList();
  });
});

async function renderDetail(server) {
  listEl.hidden = true;
  statusEl.hidden = true;
  detailEl.hidden = false;

  const tags = [`<span class="tag-chip">${server.type === "modded" ? t("serverCard.modded") : t("serverCard.vanilla")}</span>`];
  if (server.type === "modded" && server.curseforgeModpackName) {
    const version = server.curseforgeModpackVersion ? ` — ${escapeHtml(server.curseforgeModpackVersion)}` : "";
    tags.push(`<span class="tag-chip">${escapeHtml(server.curseforgeModpackName)}${version}</span>`);
  }

  // signedIn est toujours vrai ici (le portail bloque l'accès sans connexion),
  // mais on garde le garde-fou par prudence. La progression de lancement ne
  // s'affiche plus ici — voir launchServer()/la barre de lancement rapide.
  const joinSection = signedIn
    ? `<button class="join-btn" id="join-btn">${t("serverDetail.joinBtn")}</button>`
    : `
      <button class="join-btn" disabled>${t("serverDetail.joinBtn")}</button>
      <p class="join-note">${t("serverDetail.joinNote")}</p>
    `;

  const isFav = (await getFavoriteSlugs()).includes(server.slug);

  detailEl.innerHTML = `
    <button class="back">${t("serverDetail.back")}</button>
    <div class="detail-hero">
      <div class="detail-banner">
        ${server.bannerUrl ? `<img src="${escapeHtml(server.bannerUrl)}" alt="" />` : ""}
      </div>
      <div class="detail-icon">${serverIconInner(server)}</div>
    </div>
    <div class="detail-header">
      <div style="display: flex; align-items: center; gap: 10px;">
        <h2 style="margin: 0;">${escapeHtml(server.name)}</h2>
        ${favoriteBtnHtml(server.slug, isFav, "detail-favorite-btn")}
        ${
          signedIn
            ? `<button class="favorite-btn" id="report-open-btn" type="button" title="${t("serverDetail.report")}" style="margin-left: auto;">${FLAG_SVG}</button>`
            : ""
        }
      </div>
      <p class="meta">${playersLabel(server)}</p>
    </div>
    <div class="stat-row">
      <div class="stat-tile">
        <div class="stat-label">${t("serverDetail.version")}</div>
        <div class="stat-value">${escapeHtml(server.minecraftVersion)}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-label">${t("serverDetail.players")}</div>
        <div class="stat-value">${escapeHtml(playersText(server))}</div>
      </div>
      ${
        server.recommendedRamGB
          ? `<div class="stat-tile">
              <div class="stat-label">${t("serverDetail.recommendedRam")}</div>
              <div class="stat-value">${server.recommendedRamGB} ${t("serverDetail.ramUnit")}</div>
            </div>`
          : ""
      }
    </div>
    <div class="tag-row">${tags.join("")}</div>
    <p class="desc">${escapeHtml(server.description)}</p>
    ${joinSection}
  `;

  detailEl.querySelector(".back").addEventListener("click", () => {
    if (detailOrigin === "favorites") showFavoritesView();
    else if (detailOrigin === "recent") showRecentView();
    else if (detailOrigin === "home") showHomeView();
    else loadServers();
  });

  const joinBtn = document.getElementById("join-btn");
  if (joinBtn) {
    joinBtn.addEventListener("click", () => joinServer(server, joinBtn));
  }

  const favBtn = detailEl.querySelector(".detail-favorite-btn");
  favBtn.addEventListener("click", async () => {
    await toggleFavorite(server.slug);
    await refreshPlaybarFavorites();
    renderDetail(server);
  });

  const reportBtn = document.getElementById("report-open-btn");
  if (reportBtn) reportBtn.addEventListener("click", () => openReportDialog(server));
}

const REPORT_ISSUES = ["cant_connect", "wrong_version", "modpack_download", "crash", "other"];
const reportOverlayEl = document.getElementById("report-overlay");
const reportTitleEl = document.getElementById("report-title");
const reportChipsEl = document.getElementById("report-issue-chips");
const reportMessageEl = document.getElementById("report-message");
const reportDiagnosticsEl = document.getElementById("report-diagnostics");
const reportDiagnosticsDetailEl = document.getElementById("report-diagnostics-detail");
const reportErrorEl = document.getElementById("report-error");
const reportSendBtn = document.getElementById("report-send");
const reportCancelBtn = document.getElementById("report-cancel");
let reportSelectedIssue = null;

function closeReportDialog() {
  reportOverlayEl.hidden = true;
}

// Dialogue "Signaler un probleme technique" (voir "03b Report a server" dans
// Design/Omniscient Launcher Mockups.dc.html) — uniquement pour le
// proprietaire du serveur (voir le commentaire sur le modele Report cote
// site pour la categorie "Comportement/contenu", pas implementee).
async function openReportDialog(server) {
  reportSelectedIssue = null;
  reportTitleEl.textContent = `${t("report.title")} — ${server.name}`;
  reportMessageEl.value = "";
  reportDiagnosticsEl.checked = true;
  const info = await window.mchub.diagnostics.getSystemInfo();
  reportDiagnosticsDetailEl.textContent = `client ${server.minecraftVersion} · launcher ${info.launcherVersion || ""}`;
  reportErrorEl.hidden = true;
  reportSendBtn.disabled = false;
  reportSendBtn.textContent = t("report.send");

  reportChipsEl.innerHTML = REPORT_ISSUES.map(
    (issue) => `<button type="button" class="issue-chip" data-issue="${issue}">${t(`report.issue${issue.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase())}`)}</button>`,
  ).join("");
  reportChipsEl.querySelectorAll(".issue-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      reportSelectedIssue = chip.dataset.issue;
      reportChipsEl.querySelectorAll(".issue-chip").forEach((c) => c.classList.toggle("active", c === chip));
    });
  });

  reportOverlayEl.hidden = false;

  reportSendBtn.onclick = async () => {
    const message = reportMessageEl.value.trim();
    if (!reportSelectedIssue || !message) {
      reportErrorEl.textContent = t("report.missingFields");
      reportErrorEl.hidden = false;
      return;
    }
    reportErrorEl.hidden = true;
    reportSendBtn.disabled = true;
    reportSendBtn.textContent = t("report.sending");
    const result = await window.mchub.submitReport({
      slug: server.slug,
      issue: reportSelectedIssue,
      message,
      clientVersion: server.minecraftVersion,
      attachDiagnostics: reportDiagnosticsEl.checked,
    });
    if (result.ok) {
      closeReportDialog();
      showModal({ title: t("report.sent"), body: "", confirmLabel: t("common.close") });
    } else {
      reportErrorEl.textContent = t("report.failed");
      reportErrorEl.hidden = false;
      reportSendBtn.disabled = false;
      reportSendBtn.textContent = t("report.send");
    }
  };
}

reportCancelBtn.addEventListener("click", closeReportDialog);
reportOverlayEl.addEventListener("click", (event) => {
  if (event.target === reportOverlayEl) closeReportDialog();
});

// Un serveur peut suggérer une RAM (voir ServerForm côté site) — comparée à
// la RAM totale de la machine avant de lancer, avec un vrai avertissement
// de sécurité si la valeur demandée est irréaliste pour ce PC (voir cahier
// des charges, "avertissement de sécurité RAM"). Renvoie `{ proceed,
// memoryOverride }` : `memoryOverride` (ou null) s'applique UNIQUEMENT à ce
// lancement (voir game:launch) — les paramètres par défaut du joueur ne
// sont modifiés que quand il a explicitement demandé que ça devienne le
// nouveau défaut ("toujours utiliser la RAM recommandée").
async function applyRecommendedRamIfNeeded(server) {
  if (!server.recommendedRamGB) return { proceed: true, memoryOverride: null };

  const settings = await window.mchub.settings.get();
  const recommended = server.recommendedRamGB;
  // Au-dela de 80% de la RAM totale, il ne resterait quasiment rien pour
  // l'OS et le reste du systeme — on refuse d'appliquer la valeur telle
  // quelle, meme si "toujours utiliser la RAM recommandée" est coché.
  const isUnsafe = recommended > settings.totalGB * 0.8;

  if (isUnsafe) {
    const fallbackMaxGB = Math.max(1, Math.floor(settings.totalGB / 2));
    const fallbackMinGB = Math.max(1, Math.floor(fallbackMaxGB / 2));
    const result = await showModal({
      title: t("modal.ramTooHighTitle"),
      body: t("modal.ramTooHighBody", { recommended, total: settings.totalGB, fallback: fallbackMaxGB }),
      confirmLabel: t("modal.continueAnyway"),
      cancelLabel: t("common.cancel"),
    });
    if (!result.confirmed) return { proceed: false, memoryOverride: null };
    // Valeur de secours pour CE lancement seulement — l'irréalisme vient du
    // serveur, pas d'un choix durable du joueur, donc pas de persistance.
    return { proceed: true, memoryOverride: { minGB: fallbackMinGB, maxGB: fallbackMaxGB } };
  }

  if (settings.alwaysUseRecommendedRam) {
    // Le joueur a deja choisi explicitement que ça devienne le
    // comportement permanent : ça vaut la peine de le refléter dans les
    // paramètres, contrairement au cas "confirmé une fois" plus bas.
    const memoryMinGB = Math.max(1, Math.floor(recommended / 2));
    await window.mchub.settings.set({ memoryMinGB, memoryMaxGB: recommended });
    return { proceed: true, memoryOverride: null };
  }

  const result = await showModal({
    title: t("modal.ramRecommendedTitle"),
    body: t("modal.ramRecommendedBody", { recommended }),
    confirmLabel: t("modal.launchWith", { recommended }),
    cancelLabel: t("modal.keepCurrentSettings"),
    checkboxLabel: t("settings.alwaysRecommended"),
  });

  if (!result.confirmed) {
    if (result.checked) await window.mchub.settings.set({ alwaysUseRecommendedRam: true });
    return { proceed: true, memoryOverride: null };
  }

  const memoryMinGB = Math.max(1, Math.floor(recommended / 2));
  if (result.checked) {
    // "Toujours" coché en même temps que "lancer maintenant" : devient le
    // nouveau défaut, pas juste ce lancement.
    await window.mchub.settings.set({ memoryMinGB, memoryMaxGB: recommended, alwaysUseRecommendedRam: true });
    return { proceed: true, memoryOverride: null };
  }
  // Confirmé sans cocher "toujours" : uniquement pour ce lancement — ne
  // touche pas aux paramètres par défaut du joueur (c'était le bug :
  // l'ancien code persistait quand même memoryMinGB/memoryMaxGB ici).
  return { proceed: true, memoryOverride: { minGB: memoryMinGB, maxGB: recommended } };
}

// Orchestration partagee du lancement, quel que soit le point d'entree
// (bouton "Rejoindre" d'une fiche serveur ou bouton "Jouer" de la barre de
// lancement rapide) — un seul endroit qui pilote la barre de progression du
// bas, pour ne jamais avoir deux indicateurs de progression differents.
let launchInProgress = false;

function setPlaybarBusy(busy) {
  document.getElementById("playbar-idle").hidden = busy;
  document.getElementById("playbar-progress").hidden = !busy;
}

async function launchServer(server) {
  if (launchInProgress) return null;

  const { proceed, memoryOverride } = await applyRecommendedRamIfNeeded(server);
  if (!proceed) return null;

  launchInProgress = true;
  const playBtn = document.getElementById("playbar-play");
  const label = document.getElementById("playbar-progress-label");
  const percentEl = document.getElementById("playbar-progress-percent");
  const fill = document.getElementById("playbar-progress-fill");

  playBtn.disabled = true;
  fill.classList.remove("error");
  fill.style.width = "0%";
  percentEl.textContent = "";
  label.textContent = t("playbar.launchingServer", { name: server.name });
  setPlaybarBusy(true);

  const stopListening = window.mchub.onGameProgress((status) => {
    if (!status || typeof status !== "object") return;
    if (status.text) label.textContent = status.text;
    if (typeof status.task === "number" && typeof status.total === "number" && status.total > 0) {
      const percent = Math.min(100, Math.round((status.task / status.total) * 100));
      fill.style.width = `${percent}%`;
      percentEl.textContent = `${percent}%`;
    }
  });

  const result = await window.mchub.playServer(server.slug, memoryOverride);
  stopListening();
  launchInProgress = false;

  if (result.ok) {
    fill.style.width = "100%";
    percentEl.textContent = "";
    label.textContent = t("playbar.launched");

    // Historique de lancement (dernier joue, compteur par serveur, liste des
    // derniers joues) — sert au menu rapide de la barre de lancement (voir
    // refreshPlaybarFavorites) et a la page "Recents" de la barre laterale.
    const settings = await window.mchub.settings.get();
    const playCounts = { ...(settings.playCounts || {}) };
    playCounts[server.slug] = (playCounts[server.slug] || 0) + 1;
    const recentlyPlayed = [server.slug, ...(settings.recentlyPlayed || []).filter((s) => s !== server.slug)].slice(0, 10);
    await window.mchub.settings.set({ playCounts, lastPlayedSlug: server.slug, recentlyPlayed });
    await refreshPlaybarFavorites();

    // Parametres > Debogage (voir renderDebugTab) — deux reglages qui
    // n'ont d'effet qu'au moment ou une partie demarre reellement.
    if (settings.openConsoleOnLaunch) window.mchub.logs.openConsole();
    if (settings.keepLauncherOpenWhilePlaying === false) window.mchub.windowControls.minimize();

    setTimeout(() => {
      setPlaybarBusy(false);
      playBtn.disabled = !selectedFavoriteSlug;
    }, 1800);
  } else {
    fill.classList.add("error");
    label.textContent = result.error;
    playBtn.disabled = !selectedFavoriteSlug;
    // Meme mecanisme que le succes (setPlaybarBusy(false) different) —
    // sinon la barre reste bloquee sur l'erreur pour toujours, le bouton
    // Jouer et le selecteur de favoris devenant inaccessibles (c'etait le
    // bug : ce chemin n'appelait jamais setPlaybarBusy(false)). Delai plus
    // long qu'en cas de succes pour laisser le temps de lire l'erreur.
    setTimeout(() => setPlaybarBusy(false), 4000);
  }

  return result;
}

async function joinServer(server, joinBtn) {
  joinBtn.disabled = true;
  joinBtn.textContent = t("serverDetail.joinBtnLaunching");

  const result = await launchServer(server);

  if (result && result.ok) {
    joinBtn.textContent = t("serverDetail.joinBtnLaunched");
    return;
  }

  joinBtn.disabled = false;
  joinBtn.textContent = t("serverDetail.joinBtn");
}

async function openDetail(slug) {
  homePanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  listToolbarEl.hidden = true;
  statusEl.hidden = false;
  statusEl.classList.remove("error");
  statusEl.textContent = t("serverList.loadingDetail");

  const result = await window.mchub.getServer(slug);
  if (!result.ok) {
    statusEl.classList.add("error");
    statusEl.textContent = t("serverList.errorDetailPrefix", { error: result.error });
    return;
  }
  renderDetail(result.server);
}

// Cache court partage entre la vue "Serveurs" et la barre de lancement
// rapide (favoris/recents) : sans lui, chaque clic sur une etoile, chaque
// lancement ou ouverture du panneau redemandait la liste complete au
// site, y compris juste apres que loadServers() venait de la recevoir.
let serverListCache = null;
let serverListCacheAt = 0;
const SERVER_LIST_CACHE_MS = 15_000;

async function fetchServerList({ force = false } = {}) {
  if (!force && serverListCache && Date.now() - serverListCacheAt < SERVER_LIST_CACHE_MS) {
    return serverListCache;
  }
  const result = await window.mchub.listServers();
  if (result.ok) {
    serverListCache = result;
    serverListCacheAt = Date.now();
  }
  return result;
}

async function loadServers() {
  statusEl.hidden = false;
  statusEl.classList.remove("error");
  statusEl.textContent = t("serverList.loading");
  detailEl.hidden = true;
  listEl.hidden = true;

  // Toujours un aller-retour reseau ici : c'est le point d'entree explicite
  // "l'utilisateur veut voir la liste a jour" (nav, connexion, rafraichissement
  // silencieux) — mais il alimente au passage le cache ci-dessus pour la
  // barre de lancement rapide.
  const result = await fetchServerList({ force: true });
  if (!result.ok) {
    statusEl.classList.add("error");
    statusEl.textContent = t("serverList.errorPrefix", { error: result.error });
    return;
  }
  renderList(result.servers);
}

// Un seul écouteur global pour fermer le menu au clic extérieur — posé une
// fois pour toutes (pas à chaque renderAccountHeader, sinon une reconnexion
// après déconnexion en empilerait un nouveau à chaque fois). Redemande
// l'élément par son id à chaque clic plutôt que de garder une référence,
// puisque innerHTML le recrée à chaque appel de renderAccountHeader.
let accountMenuOutsideClickWired = false;

// Rendu du skin en entier (vue de face) pour la page "Mon compte" — chaque
// partie du corps est une simple fenêtre sur la texture complète, comme
// .skin-face/.mini-skin-face déjà utilisés pour la tête ailleurs dans
// l'appli, généralisé à tout le corps via les coordonnées standard du format
// de skin 64x64 (tête, torse, bras, jambes + calques chapeau/veste/manches/
// pantalon). Gauche/droite à l'écran = droite/gauche du personnage (il fait
// face au joueur, comme dans un miroir) — un détail cosmétique mineur qui ne
// se voit que sur des skins asymétriques.
const SKIN_PARTS = {
  head: { x: 8, y: 8, w: 8, h: 8 },
  headOverlay: { x: 40, y: 8, w: 8, h: 8 },
  body: { x: 20, y: 20, w: 8, h: 12 },
  bodyOverlay: { x: 20, y: 36, w: 8, h: 12 },
  armL: { x: 44, y: 20, w: 4, h: 12 },
  armLOverlay: { x: 44, y: 36, w: 4, h: 12 },
  armR: { x: 36, y: 52, w: 4, h: 12 },
  armROverlay: { x: 52, y: 52, w: 4, h: 12 },
  legL: { x: 4, y: 20, w: 4, h: 12 },
  legLOverlay: { x: 4, y: 36, w: 4, h: 12 },
  legR: { x: 20, y: 52, w: 4, h: 12 },
  legROverlay: { x: 4, y: 52, w: 4, h: 12 },
};

function skinPartStyle(part, scale, skinUrl) {
  const { x, y, w, h } = SKIN_PARTS[part];
  return `width:${w * scale}px;height:${h * scale}px;background-image:url('${escapeHtml(skinUrl)}');background-size:${64 * scale}px ${64 * scale}px;background-position:-${x * scale}px -${y * scale}px;`;
}

function skinPartHtml(part, overlayPart, scale, skinUrl) {
  const { w, h } = SKIN_PARTS[part];
  return `
    <div class="skin-part-wrap" style="width:${w * scale}px;height:${h * scale}px;">
      <div class="skin-part" style="${skinPartStyle(part, scale, skinUrl)}"></div>
      <div class="skin-part" style="${skinPartStyle(overlayPart, scale, skinUrl)}"></div>
    </div>`;
}

function fullSkinHtml(skinUrl, scale) {
  return `
    <div class="skin-body">
      <div class="skin-body-row">${skinPartHtml("head", "headOverlay", scale, skinUrl)}</div>
      <div class="skin-body-row">
        ${skinPartHtml("armL", "armLOverlay", scale, skinUrl)}
        ${skinPartHtml("body", "bodyOverlay", scale, skinUrl)}
        ${skinPartHtml("armR", "armROverlay", scale, skinUrl)}
      </div>
      <div class="skin-body-row">
        ${skinPartHtml("legL", "legLOverlay", scale, skinUrl)}
        ${skinPartHtml("legR", "legROverlay", scale, skinUrl)}
      </div>
    </div>`;
}

function skinUrlFor(profile) {
  const skins = profile.skins || [];
  const url = (skins.find((s) => s.state === "ACTIVE") || skins[0])?.url || "";
  // L'API Mojang renvoie ces URLs en http:// même si le CDN sert aussi en
  // https — notre CSP (img-src 'self' https: data:) bloquerait silencieusement
  // l'image sinon.
  return url.replace(/^http:/, "https:");
}

function renderAccountHeader(profile, { rememberFailed } = {}) {
  currentProfile = profile;
  const skinUrl = skinUrlFor(profile);

  // Avatar dans la barre latérale : la tête du skin si on l'a, sinon
  // l'initiale du pseudo — jamais le pseudo en texte, la sidebar est trop
  // étroite (56px) pour ça. Le pseudo complet reste visible en infobulle et
  // dans le menu déroulant.
  const avatarHtml = skinUrl
    ? `
      <div class="mini-skin-face-wrap">
        <div class="mini-skin-face" style="background-image: url('${escapeHtml(skinUrl)}')"></div>
        <div class="mini-skin-face-overlay" style="background-image: url('${escapeHtml(skinUrl)}')"></div>
      </div>
    `
    : `<span class="server-icon" style="width: 32px; height: 32px;">${serverInitial(profile.name)}</span>`;

  msAccountEl.innerHTML = `
    <div class="account-menu">
      <button class="account-trigger" id="account-trigger" type="button" title="${escapeHtml(profile.name)}">
        ${avatarHtml}
        <span class="status-dot online"></span>
      </button>
      <div class="account-dropdown" id="account-dropdown" hidden>
        ${
          skinUrl
            ? `
          <div class="skin-face-wrap">
            <div class="skin-face" style="background-image: url('${escapeHtml(skinUrl)}')"></div>
            <div class="skin-face-overlay" style="background-image: url('${escapeHtml(skinUrl)}')"></div>
          </div>
        `
            : ""
        }
        <div class="account-dropdown-name">${escapeHtml(profile.name)}</div>
        ${rememberFailed ? `<p class="ms-error account-dropdown-note">${t("account.sessionNotRemembered")}</p>` : ""}
        <button id="manage-account" class="btn-secondary account-dropdown-signout" type="button">${t("account.manageAccount")}</button>
        <button id="sign-out" class="btn-secondary account-dropdown-signout" type="button">${t("account.signOut")}</button>
      </div>
    </div>
  `;

  document.getElementById("account-trigger").addEventListener("click", (event) => {
    event.stopPropagation();
    const dropdown = document.getElementById("account-dropdown");
    dropdown.hidden = !dropdown.hidden;
  });

  if (!accountMenuOutsideClickWired) {
    accountMenuOutsideClickWired = true;
    document.addEventListener("click", () => {
      const dropdown = document.getElementById("account-dropdown");
      if (dropdown) dropdown.hidden = true;
    });
  }

  document.getElementById("sign-out").addEventListener("click", async (event) => {
    event.stopPropagation();
    const result = await window.mchub.signOut();
    if (!result.ok) {
      // La session reste active côté processus principal (le nettoyage a
      // échoué) : ne pas faire croire à l'écran que le joueur est déconnecté.
      return;
    }
    signedIn = false;
    currentProfile = null;
    appEl.hidden = true;
    gateEl.hidden = false;
    gateMessageEl.textContent = "";
    setGateBusy(false);
  });

  document.getElementById("manage-account").addEventListener("click", (event) => {
    event.stopPropagation();
    document.getElementById("account-dropdown").hidden = true;
    showAccountView();
  });
}

function enterApp(profile, opts) {
  signedIn = true;
  gateEl.hidden = true;
  appEl.hidden = false;
  renderAccountHeader(profile, opts);
  showHomeView();
  refreshPlaybarFavorites();
  refreshNotifications();
}

function wireGate() {
  gateLoginBtn.addEventListener("click", async () => {
    const remember = document.getElementById("gate-remember").checked;
    setGateBusy(true);
    gateMessageEl.textContent = t("gate.connecting");
    gateMessageEl.classList.remove("ms-error");

    const result = await window.mchub.signIn(remember);

    if (result.ok) {
      enterApp(result.profile, { rememberFailed: result.rememberFailed });
      return;
    }

    setGateBusy(false);

    if (result.pendingApproval) {
      gateMessageEl.textContent = t("gate.pendingApproval");
      return;
    }

    gateMessageEl.textContent = result.error;
    gateMessageEl.classList.add("ms-error");
  });
}

// Barre de titre custom : voir windowControls.js (module partage avec
// debug-console.js, sur le modele de theme.js/i18n.js).
const wireWindowControls = window.windowControls.wireWindowControls;

// Statut des services Minecraft/Microsoft dont ce launcher depend
// reellement (voir minecraftStatus.js — Mojang n'a plus d'API de statut
// officielle depuis 2022). Le point du bouton prend la pire couleur parmi
// tous les services.
const mcStatusTrigger = document.getElementById("mc-status-trigger");
const mcStatusDot = document.getElementById("mc-status-dot");
const mcStatusPanel = document.getElementById("mc-status-panel");
const mcStatusList = document.getElementById("mc-status-list");

const MC_STATUS_RANK = { ok: 0, degraded: 1, offline: 2 };
const MC_STATUS_CLASS = { ok: "online", degraded: "degraded", offline: "offline" };
function mcStatusLabel(state) {
  return t(`mcStatus.${state}`);
}

function renderMcStatus(services) {
  const worst = services.reduce(
    (acc, s) => (MC_STATUS_RANK[s.state] > MC_STATUS_RANK[acc] ? s.state : acc),
    "ok",
  );
  mcStatusDot.className = `status-dot ${MC_STATUS_CLASS[worst]}`;

  mcStatusList.innerHTML = services
    .map(
      (s) => `
      <div class="mc-status-row">
        <span class="mc-status-row-label">
          <span class="status-dot ${MC_STATUS_CLASS[s.state]}"></span>${escapeHtml(s.name)}
        </span>
        <span class="mc-status-row-latency">${s.latencyMs !== null ? `${s.latencyMs} ms` : mcStatusLabel(s.state)}</span>
      </div>`,
    )
    .join("");
}

async function loadMcStatus() {
  mcStatusList.innerHTML = `<div class="mc-status-row">${t("common.checking")}</div>`;
  const services = await window.mchub.getMinecraftStatus();
  renderMcStatus(services);
}

// Ferme un panneau deroulant a l'appui sur Echap et rend le focus a son
// bouton declencheur — sans ca, un utilisateur au clavier qui ouvre un
// panneau (mc-status/notifications) ne pouvait le refermer qu'en cliquant
// ailleurs a la souris.
function wireDismissOnEscape(panel, trigger) {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      trigger.focus();
    }
  });
}

function wireMcStatus() {
  mcStatusTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const wasHidden = mcStatusPanel.hidden;
    mcStatusPanel.hidden = !mcStatusPanel.hidden;
    if (wasHidden) loadMcStatus();
  });
  document.addEventListener("click", () => {
    mcStatusPanel.hidden = true;
  });
  wireDismissOnEscape(mcStatusPanel, mcStatusTrigger);
  // Vérifié dès le démarrage (avant même la connexion) pour que le point
  // ait une vraie couleur sans attendre un clic.
  loadMcStatus();
}

// Cloche de notifications : alertes personnelles du joueur (reponse/
// resolution de signalement, voir site/src/lib/notifications.ts) — pas les
// Actualites (diffusion admin, distincte, pas encore construite).
let notifBadgeEl;
let notifListEl;
let latestNotifications = [];

function notifTimeLabel(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t("notifications.justNow");
  if (minutes < 60) return t("notifications.minutesAgo", { count: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("notifications.hoursAgo", { count: String(hours) });
  const days = Math.floor(hours / 24);
  return t("notifications.daysAgo", { count: String(days) });
}

function notifItemHtml(notif) {
  const title =
    notif.type === "report_resolved"
      ? t("notifications.reportResolvedTitle", { server: notif.serverName })
      : t("notifications.reportRepliedTitle", { server: notif.serverName });
  const message = notif.message ? `<div class="notif-item-message">${escapeHtml(notif.message)}</div>` : "";
  return `
    <div class="notif-item${notif.read ? "" : " unread"}" data-id="${escapeHtml(notif.id)}">
      <button type="button" class="notif-item-delete" data-id="${escapeHtml(notif.id)}" title="${t("notifications.deleteOne")}">×</button>
      <div class="notif-item-title">${escapeHtml(title)}</div>
      ${message}
      <div class="notif-item-time">${notifTimeLabel(notif.createdAt)}</div>
    </div>
  `;
}

function renderNotifications() {
  if (!latestNotifications.length) {
    notifListEl.className = "notif-empty";
    notifListEl.textContent = t("titlebar.noNotifications");
    return;
  }
  notifListEl.className = "";
  notifListEl.innerHTML = latestNotifications.map(notifItemHtml).join("");
}

async function refreshNotifications() {
  if (!signedIn) return;
  const result = await window.mchub.listNotifications();
  if (!result.ok) return;
  latestNotifications = result.notifications;
  renderNotifications();
  const unreadCount = latestNotifications.filter((n) => !n.read).length;
  notifBadgeEl.hidden = unreadCount === 0;
  if (unreadCount > 0) notifBadgeEl.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
}

function wireNotifications() {
  const trigger = document.getElementById("notif-trigger");
  const panel = document.getElementById("notif-panel");
  notifBadgeEl = document.getElementById("notif-badge");
  notifListEl = document.getElementById("notif-list");
  const markAllReadBtn = document.getElementById("notif-mark-all-read");
  const clearReadBtn = document.getElementById("notif-clear-read");

  trigger.addEventListener("click", async (event) => {
    event.stopPropagation();
    const wasHidden = panel.hidden;
    panel.hidden = !panel.hidden;
    if (wasHidden) await refreshNotifications();
  });
  // Sans ca, tout clic a l'interieur du panneau (croix de suppression,
  // boutons du bas) remonterait jusqu'a ce listener document et refermerait
  // le panneau avant meme que l'action ait un effet visible.
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => {
    panel.hidden = true;
  });

  notifListEl.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest(".notif-item-delete");
    if (!deleteBtn) return;
    await window.mchub.deleteNotification(deleteBtn.dataset.id);
    await refreshNotifications();
  });

  markAllReadBtn.addEventListener("click", async () => {
    await window.mchub.markNotificationsRead();
    await refreshNotifications();
  });

  clearReadBtn.addEventListener("click", async () => {
    await window.mchub.clearReadNotifications();
    await refreshNotifications();
  });
  wireDismissOnEscape(panel, trigger);
}

// Bascule entre la vue "serveurs" (liste/détail) et la vue "paramètres" dans
// la barre latérale — deux destinations distinctes plutôt qu'un simple lien,
// pour matcher la convention des launchers du genre (Lunar, Modrinth...).
function showServersView() {
  homePanelEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  navHomeBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navServersBtn.classList.add("active");
  loadServers();
}

// Accueil (voir "01b Home" dans Design/Omniscient Launcher Mockups.dc.html) —
// sans le bandeau "a la une" (lie au futur systeme payant, voir memoire
// project_page_builder) ni les actualites (aucun systeme de contenu a
// publier dessus pour l'instant) : uniquement ce qui vient de donnees deja
// disponibles localement — dernier serveur joue, favoris, et un apercu de
// "Mes instances" pour les proprietaires.
function homeContinueCardHtml(server) {
  return `
    <div class="home-continue-card" data-slug="${escapeHtml(server.slug)}">
      <div class="home-continue-banner">
        ${server.bannerUrl ? `<img src="${escapeHtml(server.bannerUrl)}" alt="" />` : ""}
        <span class="home-continue-icon">${serverIconInner(server)}</span>
      </div>
      <div class="home-continue-body">
        <span class="home-continue-eyebrow">${t("home.continuePlaying")}</span>
        <h2>${escapeHtml(server.name)}</h2>
        <p>${playersLabel(server)}</p>
        <button type="button" class="join-btn home-continue-play" data-slug="${escapeHtml(server.slug)}">${t("serverDetail.joinBtn")}</button>
      </div>
    </div>`;
}

function homeInstanceRowHtml(server) {
  const status = instanceStatus(server);
  return `
    <div class="row" data-slug="${escapeHtml(server.slug)}" style="cursor: default;">
      <span class="server-icon" style="width: 38px; height: 38px; border-radius: 8px; font-size: 14px;">${serverIconInner(server)}</span>
      <div class="row-body">
        <div class="row-title-line">
          <h3>${escapeHtml(server.name)}</h3>
          <span class="badge">${t(`myInstances.${instanceBadgeKey(status)}`)}</span>
        </div>
        <p>${instanceStatusLineHtml(server, status)}</p>
      </div>
    </div>`;
}

async function showHomeView() {
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  homePanelEl.hidden = false;
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navHomeBtn.classList.add("active");
  await renderHomeView();
}

async function renderHomeView() {
  homePanelEl.className = "detail";

  const [settings, favoriteSlugs, myServersResult] = await Promise.all([
    window.mchub.settings.get(),
    getFavoriteSlugs(),
    currentProfile ? window.mchub.listMyServers() : Promise.resolve({ ok: false, servers: [] }),
  ]);

  const continueServer = settings.lastPlayedSlug ? (await resolveServersBySlug([settings.lastPlayedSlug]))[0] : null;
  const favoriteServers = favoriteSlugs.length > 0 ? await resolveServersBySlug(favoriteSlugs.slice(0, 4)) : [];
  const myServers = myServersResult.ok ? myServersResult.servers.slice(0, 4) : [];

  homePanelEl.innerHTML = `
    <h2 style="margin-bottom: 18px;">${t("home.greeting", { name: currentProfile ? currentProfile.name : "" })}</h2>
    ${
      continueServer
        ? homeContinueCardHtml(continueServer)
        : `<p class="join-note" style="margin-bottom: 18px;">${t("home.noHistory")}</p>`
    }
    <div class="home-section">
      <div class="home-section-header">
        <h3>${t("nav.favorites")}</h3>
        ${favoriteServers.length > 0 ? `<button type="button" class="home-see-all" data-target="favorites">${t("home.seeAll")}</button>` : ""}
      </div>
      ${
        favoriteServers.length > 0
          ? `<div class="server-list" id="home-favorites-list">${favoriteServers.map((s) => serverRowHtml(s, true)).join("")}</div>`
          : `<p class="join-note">${t("favorites.empty")}</p>`
      }
    </div>
    ${
      myServers.length > 0
        ? `<div class="home-section">
            <div class="home-section-header">
              <h3>${t("home.myServersTitle")}</h3>
              <button type="button" class="home-see-all" data-target="instances">${t("home.seeAll")}</button>
            </div>
            <div class="server-list">${myServers.map(homeInstanceRowHtml).join("")}</div>
          </div>`
        : ""
    }
  `;

  const playBtn = homePanelEl.querySelector(".home-continue-play");
  if (playBtn) {
    playBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (continueServer) launchServer(continueServer);
    });
  }
  const continueCard = homePanelEl.querySelector(".home-continue-card");
  if (continueCard) {
    continueCard.addEventListener("click", () => {
      detailOrigin = "home";
      openDetail(continueCard.dataset.slug);
    });
  }

  const favoritesListEl = document.getElementById("home-favorites-list");
  if (favoritesListEl) {
    favoritesListEl.querySelectorAll(".row").forEach((row) => {
      row.addEventListener("click", () => {
        detailOrigin = "home";
        openDetail(row.dataset.slug);
      });
    });
  }
  homePanelEl.querySelectorAll(".favorite-btn").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleFavorite(btn.dataset.slug);
      await refreshPlaybarFavorites();
      renderHomeView();
    });
  });
  homePanelEl.querySelectorAll(".home-see-all").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.target === "favorites") showFavoritesView();
      else showMyInstancesView();
    });
  });
}

// Resout une liste de slugs en objets serveur complets (nom, description,
// joueurs...) via la liste publique — utilise par "Favoris" et "Recents", qui
// ne stockent localement que des slugs.
async function resolveServersBySlug(slugs) {
  const result = await fetchServerList();
  const allServers = result.ok ? result.servers : [];
  return slugs.map(
    (slug) =>
      allServers.find((s) => s.slug === slug) || {
        slug,
        name: slug,
        description: "",
        type: "vanilla",
        playerCount: null,
        playerCapacity: null,
        bannerUrl: null,
      },
  );
}

async function showFavoritesView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  favoritesPanelEl.hidden = false;
  navHomeBtn.classList.remove("active");
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navFavoritesBtn.classList.add("active");
  await renderFavoritesList();
}

async function renderFavoritesList() {
  const favorites = await getFavoriteSlugs();

  if (favorites.length === 0) {
    favoritesPanelEl.className = "detail";
    favoritesPanelEl.innerHTML = `
      <h2>${t("nav.favorites")}</h2>
      <p class="join-note">${t("favorites.empty")}</p>
    `;
    return;
  }

  const favoriteServers = await resolveServersBySlug(favorites);
  favoritesPanelEl.className = "server-list";
  await renderRowsInto(favoritesPanelEl, favoriteServers, "favorites", renderFavoritesList);
}

async function showRecentView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  recentPanelEl.hidden = false;
  navHomeBtn.classList.remove("active");
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navRecentBtn.classList.add("active");
  await renderRecentList();
}

async function renderRecentList() {
  const settings = await window.mchub.settings.get();
  const recentSlugs = settings.recentlyPlayed || [];

  if (recentSlugs.length === 0) {
    recentPanelEl.className = "detail";
    recentPanelEl.innerHTML = `
      <h2>${t("nav.recent")}</h2>
      <p class="join-note">${t("recent.empty")}</p>
    `;
    return;
  }

  const recentServers = await resolveServersBySlug(recentSlugs);
  recentPanelEl.className = "server-list";
  await renderRowsInto(recentPanelEl, recentServers, "recent", renderRecentList);
}

// "Mes instances" : tous les serveurs du proprietaire connecte (publies OU
// en pause), retrouves via son compte Minecraft lie (voir Reglages > Divers
// et minecraft-link cote site). Rendu dedie plutot que serverRowHtml/
// openDetail : contrairement a la liste publique, ces serveurs peuvent etre
// en pause (donc absents de /api/public/servers/[slug], qui 404 dessus).
// La configuration (republier, changer la visibilite...) se fait toujours
// sur le site — voir la note "manageNote" — jamais depuis une carte ici.
let myInstancesServers = [];
let myInstancesFilter = "all";

function instanceStatus(server) {
  if (!server.published) return "paused";
  return server.isPrivate ? "private" : "public";
}

function instanceBadgeKey(status) {
  return status === "public" ? "badgePublic" : status === "private" ? "badgePrivate" : "badgePaused";
}

// Partagee entre la carte de "Mes instances" et la ligne compacte de
// l'accueil (voir homeInstanceRowHtml) — le seul endroit qui decide quoi
// afficher a la place du nombre de joueurs pour un serveur prive/en pause.
function instanceStatusLineHtml(server, status) {
  return status === "paused"
    ? `<span class="status-dot"></span>${t("myInstances.hiddenNote")}`
    : status === "private"
      ? t("myInstances.inviteCodeLabel", { code: `<code>${escapeHtml(server.inviteCode || "")}</code>` })
      : playersLabel(server);
}

function instanceCardHtml(server) {
  const status = instanceStatus(server);
  const badgeKey = instanceBadgeKey(status);
  const statusLine = instanceStatusLineHtml(server, status);

  return `
    <div class="instance-card" data-slug="${escapeHtml(server.slug)}">
      <div class="instance-card-banner">
        <span class="instance-card-icon">${serverIconInner(server)}</span>
        <span class="instance-badge ${status}">${t(`myInstances.${badgeKey}`)}</span>
      </div>
      <div class="instance-card-body">
        <h3>${escapeHtml(server.name)}</h3>
        <p>${t(server.type === "modded" ? "serverCard.modded" : "serverCard.vanilla")} · ${escapeHtml(server.minecraftVersion)} · ${escapeHtml(server.ip)}</p>
        <div class="instance-card-status">${statusLine}</div>
        <div class="instance-card-actions">
          ${status !== "paused" ? `<button type="button" class="btn-secondary my-instance-play" data-slug="${escapeHtml(server.slug)}">${t("serverDetail.joinBtn")}</button>` : ""}
          <button type="button" class="btn-secondary my-instance-manage" data-id="${escapeHtml(server.id)}">${t("myInstances.manage")} ↗</button>
        </div>
      </div>
    </div>`;
}

const INSTANCE_FILTERS = ["all", "public", "private", "paused"];

function instancesToolbarHtml(servers) {
  const counts = { all: servers.length, public: 0, private: 0, paused: 0 };
  servers.forEach((server) => counts[instanceStatus(server)]++);
  const chips = INSTANCE_FILTERS.map((filter) => {
    const labelKey = `filter${filter.charAt(0).toUpperCase()}${filter.slice(1)}`;
    return `<button type="button" class="sort-chip${filter === myInstancesFilter ? " active" : ""}" data-filter="${filter}">${t(`myInstances.${labelKey}`)}<span class="count">${counts[filter]}</span></button>`;
  }).join("");

  return `
    <div class="instances-toolbar">
      <div class="instances-filters">${chips}</div>
      <span class="instances-note">${t("myInstances.manageNote")}</span>
    </div>`;
}

function renderMyInstancesGrid() {
  const filtered =
    myInstancesFilter === "all" ? myInstancesServers : myInstancesServers.filter((server) => instanceStatus(server) === myInstancesFilter);

  myInstancesPanelEl.innerHTML = `
    <div class="instances-header">
      <div>
        <h2>${t("nav.myInstances")}</h2>
        <p class="join-note">${t("myInstances.subtitle")}</p>
      </div>
      <button type="button" class="btn-secondary" id="my-instances-new">+ ${t("myInstances.newInstance")}</button>
    </div>
    ${instancesToolbarHtml(myInstancesServers)}
    ${
      filtered.length === 0
        ? `<p class="join-note">${t("myInstances.filterEmpty")}</p>`
        : `<div class="instance-grid">${filtered.map(instanceCardHtml).join("")}</div>`
    }
  `;

  document.getElementById("my-instances-new").addEventListener("click", () => window.mchub.openNewInstance());

  myInstancesPanelEl.querySelectorAll(".instances-filters .sort-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      myInstancesFilter = btn.dataset.filter;
      renderMyInstancesGrid();
    });
  });

  myInstancesPanelEl.querySelectorAll(".my-instance-play").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const server = myInstancesServers.find((s) => s.slug === btn.dataset.slug);
      if (server) launchServer(server);
    });
  });

  myInstancesPanelEl.querySelectorAll(".my-instance-manage").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      window.mchub.openManageServer(btn.dataset.id);
    });
  });
}

async function showMyInstancesView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = false;
  navHomeBtn.classList.remove("active");
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.add("active");
  await renderMyInstancesList();
}

async function renderMyInstancesList() {
  if (!currentProfile) {
    myInstancesPanelEl.className = "detail";
    myInstancesPanelEl.innerHTML = `
      <h2>${t("nav.myInstances")}</h2>
      <p class="join-note">${t("myInstances.loginRequired")}</p>
    `;
    return;
  }

  const result = await window.mchub.listMyServers();
  myInstancesServers = result.ok ? result.servers : [];

  if (myInstancesServers.length === 0) {
    myInstancesPanelEl.className = "detail";
    myInstancesPanelEl.innerHTML = `
      <h2>${t("nav.myInstances")}</h2>
      <p class="join-note">${result.ok ? t("myInstances.empty") : t("myInstances.loginRequired")}</p>
    `;
    return;
  }

  myInstancesFilter = "all";
  myInstancesPanelEl.className = "instances-view";
  renderMyInstancesGrid();
}

const ICON_DESKTOP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
const ICON_MOON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const ICON_SUN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const ICON_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--accent);flex-shrink:0;"><polyline points="20 6 9 17 4 12" /></svg>';

// Panneau "Parametres" en 4 onglets (maquette "04 Settings") : un seul
// panneau qui re-rend #settings-content selon l'onglet actif, plutot que 4
// pages separees — plus proche de la structure existante (une seule vue
// "settings" dans la sidebar) que de la maquette au pied de la lettre.
let activeSettingsTab = "appearance";

async function showSettingsView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  detailEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  settingsPanelEl.hidden = false;
  navHomeBtn.classList.remove("active");
  navServersBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navSettingsBtn.classList.add("active");
  await renderSettingsTab(activeSettingsTab);
}

function wireSettingsNav() {
  settingsPanelEl.querySelectorAll(".settings-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeSettingsTab = btn.dataset.tab;
      settingsPanelEl.querySelectorAll(".settings-nav-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderSettingsTab(activeSettingsTab);
    });
  });
}

async function renderSettingsTab(tab) {
  const contentEl = document.getElementById("settings-content");
  const settings = await window.mchub.settings.get();
  if (tab === "language") return renderLanguageTab(contentEl, settings);
  if (tab === "memory") return renderMemoryTab(contentEl, settings);
  if (tab === "misc") return renderMiscTab(contentEl, settings);
  if (tab === "debug") return renderDebugTab(contentEl, settings);
  return renderAppearanceTab(contentEl, settings);
}

// Maquette V3, "04e Settings - Debug". Simplifications assumees par rapport
// a la maquette (pas de modpacks/CurseForge dans ce launcher pour l'instant,
// voir mcLaunch.js) : "Reparer"/"Vider le cache" portent sur les sous-dossiers
// de GAME_ROOT geres par minecraft-launcher-core plutot que sur un cache de
// modpack qui n'existe pas encore ; "Exporter le rapport" produit un fichier
// texte (infos systeme + fin du log du jour) plutot qu'une archive zip.
function renderDebugTab(contentEl, settings) {
  const LOG_LEVELS = ["error", "warn", "info", "debug"];

  contentEl.innerHTML = `
    <section class="settings-section">
      <h3 class="settings-row-desc" style="text-transform: uppercase; letter-spacing: .06em; font-weight: 600; margin: 0;">${t("debug.consoleSection")}</h3>
      <div class="settings-row">
        <span>
          <span class="settings-row-label">${t("debug.consoleLabel")}</span>
          <p class="settings-row-desc">${t("debug.consoleDesc")}</p>
        </span>
        <button id="settings-open-console" class="btn-secondary" type="button">${t("debug.openConsole")}</button>
      </div>
      <p class="settings-row-desc" style="margin-top: -10px;">${t("debug.shortcutHint", { shortcut: "Ctrl+Shift+D" })}</p>
      <div class="settings-divider"></div>
      <div class="settings-row">
        <span>
          <span class="settings-row-label">${t("debug.logLevel")}</span>
          <p class="settings-row-desc">${t("debug.logLevelDesc")}</p>
        </span>
        <div class="segmented" id="settings-log-level">
          ${LOG_LEVELS.map(
            (level) =>
              `<button type="button" class="segmented-btn${settings.logLevel === level ? " active" : ""}" data-level="${level}">${t(`debug.logLevel${level[0].toUpperCase()}${level.slice(1)}`)}</button>`,
          ).join("")}
        </div>
      </div>
      <div class="settings-divider"></div>
      <label class="settings-row" style="cursor: pointer;">
        <span>
          <span class="settings-row-label">${t("debug.openOnLaunch")}</span>
          <p class="settings-row-desc">${t("debug.openOnLaunchDesc")}</p>
        </span>
        <input type="checkbox" id="settings-open-on-launch" ${settings.openConsoleOnLaunch ? "checked" : ""} />
      </label>
      <label class="settings-row" style="cursor: pointer;">
        <span>
          <span class="settings-row-label">${t("debug.keepOpen")}</span>
          <p class="settings-row-desc">${t("debug.keepOpenDesc")}</p>
        </span>
        <input type="checkbox" id="settings-keep-open" ${settings.keepLauncherOpenWhilePlaying ? "checked" : ""} />
      </label>
    </section>

    <section class="settings-section">
      <h3 class="settings-row-desc" style="text-transform: uppercase; letter-spacing: .06em; font-weight: 600; margin: 0;">${t("debug.logsSection")}</h3>
      <div>
        <div class="settings-row-label">${t("debug.logFiles")}</div>
        <p class="settings-path" style="margin-top: 6px;" id="settings-logs-path"></p>
        <div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
          <button id="settings-open-logs" class="btn-secondary" type="button">${t("debug.openLogsFolder")}</button>
          <button id="settings-copy-log" class="btn-secondary" type="button">${t("debug.copyLatestLog")}</button>
        </div>
        <p class="join-note" id="settings-logs-status" style="margin-top: 6px;"></p>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-row">
        <span>
          <span class="settings-row-label">${t("debug.diagnosticReport")}</span>
          <p class="settings-row-desc">${t("debug.diagnosticReportDesc")}</p>
        </span>
        <button id="settings-export-report" class="btn-secondary" type="button">${t("debug.exportReport")}</button>
      </div>
      <p class="join-note" id="settings-report-status"></p>
    </section>

    <section class="settings-section">
      <h3 class="settings-row-desc" style="text-transform: uppercase; letter-spacing: .06em; font-weight: 600; margin: 0;">${t("debug.systemSection")}</h3>
      <div class="system-info-grid" id="settings-system-info">
        <span class="label">${t("common.checking")}</span><span class="value"></span>
      </div>
      <div><button id="settings-copy-sysinfo" class="btn-secondary" type="button" hidden>${t("debug.copyToClipboard")}</button></div>
    </section>

    <section class="settings-section">
      <h3 class="settings-row-desc" style="text-transform: uppercase; letter-spacing: .06em; font-weight: 600; margin: 0;">${t("debug.resetSection")}</h3>
      <div class="settings-row">
        <span>
          <span class="settings-row-label">${t("debug.repairFiles")}</span>
          <p class="settings-row-desc">${t("debug.repairFilesDesc")}</p>
        </span>
        <button id="settings-repair" class="btn-secondary" type="button">${t("debug.repair")}</button>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-row">
        <span>
          <span class="settings-row-label">${t("debug.clearCache")}</span>
          <p class="settings-row-desc" id="settings-cache-size-desc">${t("debug.clearCacheDesc", { size: "…" })}</p>
        </span>
        <button id="settings-clear-cache" class="btn-danger" type="button">${t("debug.clearCache")}</button>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-row">
        <span>
          <span class="settings-row-label">${t("debug.resetSettings")}</span>
          <p class="settings-row-desc">${t("debug.resetSettingsDesc")}</p>
        </span>
        <button id="settings-reset" class="btn-danger" type="button">${t("debug.reset")}</button>
      </div>
      <p class="join-note" id="settings-reset-status"></p>
    </section>
  `;

  document.getElementById("settings-open-console").addEventListener("click", () => {
    window.mchub.logs.openConsole();
  });

  contentEl.querySelectorAll("#settings-log-level .segmented-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await window.mchub.settings.set({ logLevel: btn.dataset.level });
      contentEl.querySelectorAll("#settings-log-level .segmented-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  document.getElementById("settings-open-on-launch").addEventListener("change", (event) => {
    window.mchub.settings.set({ openConsoleOnLaunch: event.target.checked });
  });
  document.getElementById("settings-keep-open").addEventListener("change", (event) => {
    window.mchub.settings.set({ keepLauncherOpenWhilePlaying: event.target.checked });
  });

  document.getElementById("settings-open-logs").addEventListener("click", () => window.mchub.logs.openLogsFolder());
  document.getElementById("settings-copy-log").addEventListener("click", async () => {
    const content = await window.mchub.logs.copyLatest();
    try {
      await navigator.clipboard.writeText(content);
      document.getElementById("settings-logs-status").textContent = t("debug.copied");
    } catch {
      // Presse-papiers indisponible — pas bloquant pour une simple commodite.
    }
  });
  document.getElementById("settings-logs-path").textContent = settings.logsDir;

  document.getElementById("settings-export-report").addEventListener("click", async () => {
    const result = await window.mchub.diagnostics.exportReport();
    document.getElementById("settings-report-status").textContent = result.ok ? t("debug.reportExported") : "";
  });

  const sysInfoEl = document.getElementById("settings-system-info");
  window.mchub.diagnostics.getSystemInfo().then((info) => {
    const rows = [
      [t("settings.launcherVersion"), `v${info.launcherVersion}`],
      [t("debug.labelElectron"), info.electronVersion],
      [t("debug.labelOs"), info.os],
      [t("debug.labelJava"), info.java || t("debug.javaNotDetected")],
      [t("settings.ramAllocation"), info.memory],
      [t("debug.labelGpu"), info.gpu || t("debug.gpuUnknown")],
    ];
    sysInfoEl.innerHTML = rows.map(([label, value]) => `<span class="label">${label}</span><span class="value">${escapeHtml(value)}</span>`).join("");
    const copyBtn = document.getElementById("settings-copy-sysinfo");
    copyBtn.hidden = false;
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(rows.map(([label, value]) => `${label}: ${value}`).join("\n"));
      } catch {
        // Presse-papiers indisponible — pas bloquant.
      }
    });
  });

  document.getElementById("settings-repair").addEventListener("click", async () => {
    await window.mchub.diagnostics.repair();
    document.getElementById("settings-reset-status").textContent = t("debug.repaired");
  });

  const formatCacheSize = (bytes) =>
    bytes > 1024 ** 3
      ? `${(bytes / 1024 ** 3).toFixed(2)} ${t("debug.unitGB")}`
      : `${(bytes / (1024 * 1024)).toFixed(0)} ${t("debug.unitMB")}`;

  window.mchub.diagnostics.getCacheSizeBytes().then((bytes) => {
    document.getElementById("settings-cache-size-desc").textContent = t("debug.clearCacheDesc", { size: formatCacheSize(bytes) });
  });
  document.getElementById("settings-clear-cache").addEventListener("click", async () => {
    if (!window.confirm(t("debug.clearCacheConfirm"))) return;
    await window.mchub.diagnostics.clearCache();
    document.getElementById("settings-reset-status").textContent = t("debug.cacheCleared");
    document.getElementById("settings-cache-size-desc").textContent = t("debug.clearCacheDesc", { size: formatCacheSize(0) });
  });

  document.getElementById("settings-reset").addEventListener("click", async () => {
    if (!window.confirm(t("debug.resetConfirm"))) return;
    const updated = await window.mchub.settings.reset();
    window.themeControls.applyTheme(updated);
    document.body.classList.toggle("compact-list", !!updated.compactServerList);
    renderDebugTab(contentEl, { ...settings, ...updated });
    document.getElementById("settings-reset-status").textContent = t("debug.resetDone");
  });
}

function renderAppearanceTab(contentEl, settings) {
  const themes = [
    { value: "system", icon: ICON_DESKTOP, label: t("appearance.themeSystem") },
    { value: "dark", icon: ICON_MOON, label: t("appearance.themeDark") },
    { value: "light", icon: ICON_SUN, label: t("appearance.themeLight") },
  ];
  contentEl.innerHTML = `
    <section class="settings-section">
      <div>
        <div class="settings-row-label">${t("appearance.theme")}</div>
        <p class="settings-row-desc">${t("appearance.themeDesc")}</p>
        <div class="theme-options">
          ${themes
            .map(
              (th) => `
            <button type="button" class="theme-option${settings.theme === th.value ? " active" : ""}" data-theme-value="${th.value}">
              ${th.icon}<span>${th.label}</span>
            </button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="settings-divider"></div>
      <div>
        <div class="settings-row-label">${t("appearance.accentColor")}</div>
        <p class="settings-row-desc">${t("appearance.accentColorDesc")}</p>
        <div class="accent-swatches">
          ${window.themeControls.ACCENT_PRESETS.map((color, i) => {
            const names = [t("appearance.accentPurple"), t("appearance.accentBlue"), t("appearance.accentGreen"), t("appearance.accentOrange"), t("appearance.accentPink")];
            return `<button type="button" class="accent-swatch${settings.accentColor === color ? " active" : ""}" data-accent-value="${color}" style="background:${color};" aria-label="${names[i] || color}"></button>`;
          }).join("")}
        </div>
      </div>
      <div class="settings-divider"></div>
      <label class="settings-row" style="cursor: pointer;">
        <span>
          <span class="settings-row-label">${t("appearance.compactList")}</span>
          <p class="settings-row-desc">${t("appearance.compactListDesc")}</p>
        </span>
        <input type="checkbox" id="settings-compact-list" ${settings.compactServerList ? "checked" : ""} />
      </label>
    </section>
  `;

  contentEl.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const updated = await window.mchub.settings.set({ theme: btn.dataset.themeValue });
      window.themeControls.applyTheme(updated);
      renderAppearanceTab(contentEl, updated);
    });
  });
  contentEl.querySelectorAll(".accent-swatch").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const updated = await window.mchub.settings.set({ accentColor: btn.dataset.accentValue });
      window.themeControls.applyTheme(updated);
      renderAppearanceTab(contentEl, updated);
    });
  });
  document.getElementById("settings-compact-list").addEventListener("change", async (event) => {
    await window.mchub.settings.set({ compactServerList: event.target.checked });
    document.body.classList.toggle("compact-list", event.target.checked);
  });
}

function renderLanguageTab(contentEl, settings) {
  const locales = window.i18n.LOCALES;
  const currentLabel = locales[settings.locale]?.label || locales.fr.label;
  contentEl.innerHTML = `
    <section class="settings-section">
      <div>
        <div class="settings-row-label">${t("language.launcherLanguage")}</div>
        <p class="settings-row-desc">${t("language.restartNote")}</p>
        <div class="lang-picker">${currentLabel}</div>
      </div>
      <div class="settings-divider"></div>
      <div>
        <div class="settings-row-label">${t("language.available")}</div>
        <div class="lang-list">
          ${Object.entries(locales)
            .map(
              ([code, info]) => `
            <button type="button" class="lang-list-row${code === settings.locale ? " active" : ""}" ${info.enabled ? `data-locale="${code}"` : "disabled"}>
              <span>${info.label}</span>
              ${code === settings.locale ? ICON_CHECK : ""}
            </button>`,
            )
            .join("")}
        </div>
      </div>
      <p class="join-note" id="settings-lang-status"></p>
    </section>
  `;

  contentEl.querySelectorAll(".lang-list-row[data-locale]").forEach((row) => {
    row.addEventListener("click", async () => {
      const locale = row.dataset.locale;
      if (locale === settings.locale) return;
      await window.mchub.settings.set({ locale });
      document.getElementById("settings-lang-status").textContent = t("language.restartNeeded");
      renderLanguageTab(contentEl, { ...settings, locale });
    });
  });
}

function renderMemoryTab(contentEl, settings) {
  const usedPercent = Math.min(100, Math.round((settings.memoryMaxGB / settings.totalGB) * 100));
  contentEl.innerHTML = `
    <section class="settings-section">
      <div>
        <div class="settings-row-label">${t("settings.ramAllocation")}</div>
        <p class="settings-row-desc">${t("settings.ramAllocationDesc")}</p>
        <div style="display: flex; gap: 14px; margin-top: 8px;">
          <div class="settings-field" style="margin-bottom: 0;">
            <label class="field-label">${t("settings.memoryMin")}</label>
            <input type="number" id="settings-mem-min" min="1" max="32" class="settings-input" value="${settings.memoryMinGB}" />
          </div>
          <div class="settings-field" style="margin-bottom: 0;">
            <label class="field-label">${t("settings.memoryMax")}</label>
            <input type="number" id="settings-mem-max" min="1" max="32" class="settings-input" value="${settings.memoryMaxGB}" />
          </div>
        </div>
        <div class="ram-bar-track"><div class="ram-bar-fill" style="width: ${usedPercent}%;"></div></div>
        <p class="join-note" style="margin-top: 6px;">${t("settings.ramAvailable", { used: settings.memoryMaxGB, total: settings.totalGB })}</p>
      </div>
      <div class="settings-divider"></div>
      <label class="settings-row" style="cursor: pointer;">
        <span class="settings-row-label">${t("settings.alwaysRecommended")}</span>
        <input type="checkbox" id="settings-always-recommended" ${settings.alwaysUseRecommendedRam ? "checked" : ""} />
      </label>
    </section>
    <button id="settings-save-memory" class="join-btn" type="button" style="align-self: flex-start;">${t("settings.saveChanges")}</button>
    <p class="join-note" id="settings-status"></p>
  `;

  document.getElementById("settings-save-memory").addEventListener("click", async () => {
    const min = Number(document.getElementById("settings-mem-min").value);
    const max = Number(document.getElementById("settings-mem-max").value);
    const alwaysUseRecommendedRam = document.getElementById("settings-always-recommended").checked;
    const settingsStatusEl = document.getElementById("settings-status");
    const updated = await window.mchub.settings.set({ memoryMinGB: min, memoryMaxGB: max, alwaysUseRecommendedRam });
    settingsStatusEl.classList.remove("ms-error");
    settingsStatusEl.textContent = t("settings.saved");
    renderMemoryTab(contentEl, { ...settings, ...updated });
  });
}

function renderMiscTab(contentEl, settings) {
  const linkedName = settings.minecraftLinkedUserName;

  contentEl.innerHTML = `
    <section class="settings-section">
      <div>
        <div class="settings-row-label">${t("settings.javaLabel")}</div>
        <p class="join-note" id="settings-java-status" style="margin-top: 6px;">${t("common.checking")}</p>
        <button id="settings-java-install" class="btn-secondary" type="button" hidden style="margin-top: 8px;">${t("java.installAuto")}</button>
      </div>
      <div class="settings-divider"></div>
      <div>
        <div class="settings-row-label">${t("settings.gameFolder")}</div>
        <p class="settings-path" style="margin-top: 6px;">${escapeHtml(settings.gameRoot)}</p>
        <button id="settings-open-folder" class="btn-secondary" type="button" style="margin-top: 6px;">${t("settings.openFolder")}</button>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-row">
        <span>
          <span class="settings-row-label">${t("settings.launcherVersion")}</span>
          <p class="settings-row-desc">${t("settings.upToDate")}</p>
        </span>
        <span class="join-note">${settings.appVersion ? `v${settings.appVersion}` : "—"}</span>
      </div>
    </section>

    <section class="settings-section">
      <div>
        <div class="settings-row-label">${t("settings.omniscientAccountLabel")}</div>
        <p class="settings-row-desc" style="margin-top: 4px;">${
          linkedName
            ? t("settings.omniscientAccountLinked", { name: escapeHtml(linkedName) })
            : t("settings.omniscientAccountDesc")
        }</p>
        ${
          linkedName
            ? `<button id="settings-unlink-minecraft" class="btn-secondary" type="button" style="margin-top: 8px;">${t("settings.omniscientAccountForget")}</button>`
            : `
              <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center; flex-wrap: wrap;">
                <input id="settings-link-code" type="text" maxlength="6" placeholder="${t("settings.omniscientAccountCodePlaceholder")}" style="text-transform: uppercase; letter-spacing: .2em; width: 140px;" />
                <button id="settings-link-submit" class="btn-secondary" type="button">${t("settings.omniscientAccountLinkBtn")}</button>
              </div>
              <p class="join-note" id="settings-link-status" style="margin-top: 6px;"></p>
            `
        }
      </div>
    </section>
  `;

  document.getElementById("settings-open-folder").addEventListener("click", () => {
    window.mchub.settings.openGameFolder();
  });
  refreshJavaStatus("settings-java-status", "settings-java-install");

  const unlinkBtn = document.getElementById("settings-unlink-minecraft");
  if (unlinkBtn) {
    unlinkBtn.addEventListener("click", async () => {
      await window.mchub.settings.set({ minecraftLinkedUserName: null });
      renderSettingsTab("misc");
    });
  }

  const linkSubmitBtn = document.getElementById("settings-link-submit");
  if (linkSubmitBtn) {
    const codeInput = document.getElementById("settings-link-code");
    const statusEl2 = document.getElementById("settings-link-status");
    linkSubmitBtn.addEventListener("click", async () => {
      const code = codeInput.value.trim();
      if (!code) return;
      linkSubmitBtn.disabled = true;
      statusEl2.textContent = t("common.checking");
      statusEl2.style.color = "";
      const result = await window.mchub.account.linkMinecraft(code);
      linkSubmitBtn.disabled = false;
      if (result.ok) {
        renderSettingsTab("misc");
      } else {
        statusEl2.textContent = result.error;
        statusEl2.style.color = "var(--danger)";
      }
    });
  }
}

// Partagé entre le verrou Java obligatoire et les paramètres : verifie Java
// (voir javaManager.js — 64 bits requis pour allouer beaucoup de mémoire) et
// affiche un bouton d'installation automatique si besoin. `onReady` est
// appelé dès que Java est détecté OK (tout de suite, ou juste après une
// installation réussie) — utilisé par le verrou pour débloquer le launcher.
async function refreshJavaStatus(statusElId, installBtnId, { onReady } = {}) {
  const statusEl2 = document.getElementById(statusElId);
  const installBtn = document.getElementById(installBtnId);
  statusEl2.textContent = t("common.checking");
  installBtn.hidden = true;

  const java = await window.mchub.java.detect();
  if (java.found && java.is64Bit && java.meetsMinimum) {
    statusEl2.textContent = java.version ? t("java.detectedWithVersion", { version: java.version }) : t("java.detectedNoVersion");
    if (onReady) onReady();
  } else if (java.found && !java.is64Bit) {
    statusEl2.textContent = t("java.is32Bit");
    installBtn.hidden = false;
  } else if (java.found) {
    statusEl2.textContent = t("java.tooOld", { version: java.version || "?" });
    installBtn.hidden = false;
  } else {
    statusEl2.textContent = t("java.notFound");
    installBtn.hidden = false;
  }

  if (installBtn.dataset.wired) return;
  installBtn.dataset.wired = "1";
  installBtn.addEventListener("click", async () => {
    installBtn.disabled = true;
    const stopListening = window.mchub.onJavaInstallProgress((status) => {
      statusEl2.textContent = status;
    });
    const result = await window.mchub.java.install();
    stopListening();
    installBtn.disabled = false;
    if (result.ok) {
      statusEl2.textContent = t("java.installed", { version: result.version });
      installBtn.hidden = true;
      if (onReady) onReady();
    } else {
      statusEl2.textContent = t("java.installFailed", { error: result.error });
    }
  });
}

// Verrou obligatoire : Java est requis pour lancer Minecraft (allocation de
// RAM comprise), donc on bloque tout le launcher (avant même l'assistant RAM
// et le portail de connexion) tant qu'il n'est pas détecté — à chaque
// démarrage, pas seulement au premier lancement.
async function ensureJavaAvailable() {
  const initial = await window.mchub.java.detect();
  if (initial.found && initial.is64Bit && initial.meetsMinimum) return;

  // Java manquant : cet ecran peut impliquer une vraie attente (telechargement
  // + installation), donc on sort de la petite fenetre du bootstrap avant de
  // l'afficher plutot que de la laisser cramped dedans.
  await window.mchub.windowControls.expandFromBootstrap();
  bootstrapEl.hidden = true;
  document.body.classList.remove("bootstrapping");
  javaGateEl.hidden = false;
  await new Promise((resolve) => {
    refreshJavaStatus("java-gate-status", "java-gate-install", {
      onReady: () => {
        javaGateEl.hidden = true;
        resolve();
      },
    });
  });
}

// Page "Gérer le compte" : accessible depuis le menu déroulant du pseudo
// (pas depuis la barre latérale, pour ne pas la surcharger d'icônes) —
// changement de skin et bascule entre comptes Microsoft mémorisés.
async function showAccountView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  accountPanelEl.hidden = false;
  navServersBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  await renderAccountPanel();
}

async function renderAccountPanel() {
  const skinUrl = currentProfile ? skinUrlFor(currentProfile) : "";
  const skinPreviewHtml = skinUrl
    ? fullSkinHtml(skinUrl, 7)
    : `<span class="server-icon" style="width: 112px; height: 112px; font-size: 42px;">${serverInitial(currentProfile?.name || "?")}</span>`;

  accountPanelEl.innerHTML = `
    <h2>${t("account.myAccount")}</h2>
    <div class="account-skin-row">
      ${skinPreviewHtml}
      <div>
        <div class="account-dropdown-name">${escapeHtml(currentProfile?.name || "")}</div>
        <p class="join-note" style="margin: 4px 0 0;">${t("account.currentSkin")}</p>
      </div>
    </div>

    <div class="settings-field">
      <span class="field-label">${t("account.changeSkinLabel")}</span>
      <input type="file" accept="image/png" id="skin-file-input" class="settings-input" />
    </div>
    <div class="account-variant-row">
      <label><input type="radio" name="skin-variant" value="classic" checked /> ${t("account.classic")}</label>
      <label><input type="radio" name="skin-variant" value="slim" /> ${t("account.slim")}</label>
    </div>
    <div style="display: flex; gap: 8px; margin-top: 10px;">
      <button id="skin-upload-btn" class="join-btn" type="button">${t("account.changeSkinBtn")}</button>
      <button id="skin-reset-btn" class="btn-secondary" type="button">${t("account.resetBtn")}</button>
    </div>
    <p class="join-note" id="account-skin-status"></p>

    <h2 style="margin-top: 32px;">${t("account.rememberedAccounts")}</h2>
    <div id="account-list" style="margin-top: 12px;"></div>
    <p class="join-note" id="account-list-status"></p>
    <button id="account-add-btn" class="btn-secondary" type="button">${t("account.addAccountBtn")}</button>
  `;

  wireAccountPanelActions();
  await refreshAccountList();
}

async function refreshAccountList() {
  const listContainer = document.getElementById("account-list");
  const { accounts } = await window.mchub.account.list();
  // La session vraiment active est `currentProfile` (mis a jour a chaque
  // connexion/bascule reussie), pas le `activeId` persiste renvoye par
  // account.list() : les deux peuvent diverger (ex. reconnexion avec "se
  // souvenir de moi" decoche, qui ne touche pas l'activeId sur disque),
  // et se fier au seul id persiste desynchronisait l'etiquette "Actif" et
  // le bouton "Oublier" de la vraie session en cours.
  const activeId = currentProfile?.id ?? null;

  if (accounts.length === 0) {
    listContainer.innerHTML = `<p class="join-note">${t("account.noAccounts")}</p>`;
    return;
  }

  listContainer.innerHTML = accounts
    .map(
      (a) => `
      <div class="account-list-row">
        <span class="account-list-row-name">
          <span class="server-icon" style="width: 26px; height: 26px; font-size: 11px;">${serverInitial(a.name)}</span>
          ${escapeHtml(a.name)}
          ${a.id === activeId ? `<span class="account-active-tag">${t("account.active")}</span>` : ""}
        </span>
        <span class="account-list-row-actions">
          ${a.id === activeId ? "" : `<button class="btn-secondary account-switch-btn" type="button" data-id="${escapeHtml(a.id)}">${t("account.switchBtn")}</button>`}
          <button class="btn-secondary account-remove-btn" type="button" data-id="${escapeHtml(a.id)}">${t("account.forgetBtn")}</button>
        </span>
      </div>`,
    )
    .join("");

  const listStatusEl = document.getElementById("account-list-status");

  listContainer.querySelectorAll(".account-switch-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.textContent = t("account.switching");
      listStatusEl.textContent = "";
      listStatusEl.classList.remove("ms-error");

      const result = await window.mchub.account.switch(id);
      if (result.ok) {
        renderAccountHeader(result.profile, {});
        await renderAccountPanel();
        return;
      }
      btn.disabled = false;
      btn.textContent = t("account.switchBtn");
      listStatusEl.textContent = result.pendingApproval ? t("gate.pendingApproval") : result.error;
      listStatusEl.classList.add("ms-error");
    });
  });

  listContainer.querySelectorAll(".account-remove-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await window.mchub.account.remove(id);
      if (id === activeId) {
        // Le compte actif vient d'être oublié : retour au portail, comme
        // une déconnexion normale (plus rien à afficher/gérer ici).
        signedIn = false;
        currentProfile = null;
        appEl.hidden = true;
        gateEl.hidden = false;
        gateMessageEl.textContent = "";
        setGateBusy(false);
        return;
      }
      await refreshAccountList();
    });
  });
}

function wireAccountPanelActions() {
  const uploadBtn = document.getElementById("skin-upload-btn");
  const resetBtn = document.getElementById("skin-reset-btn");
  const fileInput = document.getElementById("skin-file-input");
  const skinStatusEl = document.getElementById("account-skin-status");

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      skinStatusEl.textContent = t("account.chooseFileFirst");
      skinStatusEl.classList.add("ms-error");
      return;
    }
    const variant = document.querySelector('input[name="skin-variant"]:checked')?.value || "classic";
    uploadBtn.disabled = true;
    uploadBtn.textContent = t("account.sendingSkin");
    skinStatusEl.textContent = "";
    skinStatusEl.classList.remove("ms-error");

    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await window.mchub.account.changeSkin(variant, buffer);

    if (result.ok) {
      renderAccountHeader(result.profile, {});
      await renderAccountPanel();
      document.getElementById("account-skin-status").textContent = t("account.skinUpdated");
      return;
    }
    uploadBtn.disabled = false;
    uploadBtn.textContent = t("account.changeSkinBtn");
    skinStatusEl.textContent = result.error;
    skinStatusEl.classList.add("ms-error");
  });

  resetBtn.addEventListener("click", async () => {
    resetBtn.disabled = true;
    const result = await window.mchub.account.resetSkin();
    if (result.ok) {
      renderAccountHeader(result.profile, {});
      await renderAccountPanel();
      document.getElementById("account-skin-status").textContent = t("account.skinReset");
      return;
    }
    resetBtn.disabled = false;
    skinStatusEl.textContent = result.error;
    skinStatusEl.classList.add("ms-error");
  });

  document.getElementById("account-add-btn").addEventListener("click", async () => {
    const addBtn = document.getElementById("account-add-btn");
    const listStatusEl = document.getElementById("account-list-status");
    addBtn.disabled = true;
    addBtn.textContent = t("account.addingAccount");
    listStatusEl.textContent = "";
    listStatusEl.classList.remove("ms-error");

    // "Ajouter un compte" mémorise toujours le nouveau compte (sinon il
    // n'apparaîtrait pas dans la liste juste après l'avoir ajouté).
    const result = await window.mchub.signIn(true);
    if (result.ok) {
      renderAccountHeader(result.profile, { rememberFailed: result.rememberFailed });
      await renderAccountPanel();
      return;
    }
    addBtn.disabled = false;
    addBtn.textContent = t("account.addAccountBtn");
    listStatusEl.textContent = result.pendingApproval ? t("gate.pendingApproval") : result.error;
    listStatusEl.classList.add("ms-error");
  });
}

// Barre de lancement rapide (bas de l'appli) : au plus 5 lignes — le dernier
// serveur reellement joue s'il n'est pas deja favori (mis en avant en haut,
// etiquette "Dernier joue"), puis les 3 favoris les plus joues (par nombre de
// lancements reussis, pas juste l'ordre d'ajout), puis un lien "+ de favoris"
// vers la page dediee si plus de 3 favoris existent.
async function refreshPlaybarFavorites() {
  const favTrigger = document.getElementById("playbar-fav-trigger");
  const favIcon = document.getElementById("playbar-fav-icon");
  const favName = document.getElementById("playbar-fav-name");
  const favPanel = document.getElementById("playbar-fav-panel");
  const playBtn = document.getElementById("playbar-play");

  const settings = await window.mchub.settings.get();
  const favorites = settings.favoriteServers || [];
  const playCounts = settings.playCounts || {};
  const lastPlayedSlug = settings.lastPlayedSlug || null;
  const showLastPlayed = !!lastPlayedSlug && !favorites.includes(lastPlayedSlug);

  if (favorites.length === 0 && !lastPlayedSlug) {
    selectedFavoriteSlug = null;
    favTrigger.disabled = true;
    favIcon.innerHTML = "";
    favName.textContent = t("playbar.addFavoritePrompt");
    if (!launchInProgress) playBtn.disabled = true;
    favPanel.innerHTML = `<div class="playbar-fav-empty">${t("playbar.emptyHint")}</div>`;
    return;
  }

  const result = await fetchServerList();
  const allServers = result.ok ? result.servers : [];
  const resolve = (slug) => allServers.find((s) => s.slug === slug) || { slug, name: slug };

  const topFavorites = [...favorites].sort((a, b) => (playCounts[b] || 0) - (playCounts[a] || 0)).slice(0, 3);

  const rows = [];
  if (showLastPlayed) rows.push({ slug: lastPlayedSlug, kind: "last-played" });
  topFavorites.forEach((slug) => rows.push({ slug, kind: "favorite" }));

  const hasMoreFavorites = favorites.length > 3;
  const availableSlugs = rows.map((r) => r.slug);

  if (!selectedFavoriteSlug || !availableSlugs.includes(selectedFavoriteSlug)) {
    selectedFavoriteSlug = availableSlugs.includes(lastPlayedSlug) ? lastPlayedSlug : rows[0]?.slug || null;
  }

  const selected = resolve(selectedFavoriteSlug);
  favTrigger.disabled = false;
  if (!launchInProgress) playBtn.disabled = false;
  favIcon.innerHTML = `<span class="server-icon" style="width: 22px; height: 22px; font-size: 10px;">${serverIconInner(selected)}</span>`;
  favName.textContent = selected.name;

  favPanel.innerHTML =
    rows
      .map((row) => {
        const server = resolve(row.slug);
        return `
      <div class="playbar-fav-row" data-slug="${escapeHtml(row.slug)}">
        <span class="server-icon" style="width: 24px; height: 24px; font-size: 11px;">${serverIconInner(server)}</span>
        <span class="playbar-fav-row-name">
          ${row.kind === "last-played" ? `<span class="playbar-fav-row-tag">${t("playbar.lastPlayed")}</span>` : ""}
          <span class="playbar-fav-row-title">${escapeHtml(server.name)}</span>
        </span>
        ${
          row.kind === "favorite"
            ? `<button class="playbar-fav-remove" type="button" data-slug="${escapeHtml(row.slug)}" title="${t("common.removeFavorite")}">✕</button>`
            : ""
        }
      </div>`;
      })
      .join("") + (hasMoreFavorites ? `<div class="playbar-fav-row playbar-fav-more" id="playbar-fav-more">${t("playbar.moreFavorites")}</div>` : "");

  favPanel.querySelectorAll(".playbar-fav-row:not(.playbar-fav-more)").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest(".playbar-fav-remove")) return;
      selectedFavoriteSlug = row.dataset.slug;
      favPanel.hidden = true;
      refreshPlaybarFavorites();
    });
  });
  favPanel.querySelectorAll(".playbar-fav-remove").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleFavorite(btn.dataset.slug);
      await refreshPlaybarFavorites();
      // L'etoile sur la carte/fiche correspondante ne se met a jour qu'au
      // prochain rendu de cette vue — un detail mineur, pas la peine de
      // garder une reference au serveur actuellement affiche juste pour ca.
    });
  });
  const moreBtn = document.getElementById("playbar-fav-more");
  if (moreBtn) {
    moreBtn.addEventListener("click", () => {
      favPanel.hidden = true;
      showFavoritesView();
    });
  }
}

function wirePlaybar() {
  const favTrigger = document.getElementById("playbar-fav-trigger");
  const favPanel = document.getElementById("playbar-fav-panel");
  const playBtn = document.getElementById("playbar-play");

  favTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    favPanel.hidden = !favPanel.hidden;
  });
  document.addEventListener("click", () => {
    favPanel.hidden = true;
  });

  playBtn.addEventListener("click", async () => {
    if (!selectedFavoriteSlug) return;
    const result = await window.mchub.getServer(selectedFavoriteSlug);
    if (!result.ok) return;
    // launchServer() enregistre deja lastPlayedSlug en cas de succes — cet
    // appel ecrivait une cle differente (lastPlayedFavoriteSlug, jamais lue
    // nulle part) qui n'avait donc aucun effet.
    await launchServer(result.server);
  });
}

function wireSidebar() {
  navHomeBtn.addEventListener("click", showHomeView);
  navServersBtn.addEventListener("click", showServersView);
  navFavoritesBtn.addEventListener("click", showFavoritesView);
  navRecentBtn.addEventListener("click", showRecentView);
  navMyInstancesBtn.addEventListener("click", showMyInstancesView);
  navSettingsBtn.addEventListener("click", showSettingsView);
}

// Modale générique (confirmation / avertissement) — utilisée par
// l'avertissement de sécurité RAM, réutilisable pour n'importe quel prompt
// bloquant futur. Résout avec { confirmed, checked } plutôt que de bloquer
// le thread comme un confirm() natif, pour rester cohérent avec le reste de
// l'UI (pas de fenêtre système grise dans une appli aussi personnalisée).
function showModal({ title, body, confirmLabel, cancelLabel, checkboxLabel }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modal-overlay");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const checkboxRow = document.getElementById("modal-checkbox-row");
    const checkbox = document.getElementById("modal-checkbox");

    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").textContent = body;
    confirmBtn.textContent = confirmLabel;
    cancelBtn.hidden = !cancelLabel;
    cancelBtn.textContent = cancelLabel || "";
    checkboxRow.hidden = !checkboxLabel;
    document.getElementById("modal-checkbox-label").textContent = checkboxLabel || "";
    checkbox.checked = false;

    overlay.hidden = false;

    const cleanup = () => {
      overlay.hidden = true;
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
    };
    const onConfirm = () => {
      const checked = checkbox.checked;
      cleanup();
      resolve({ confirmed: true, checked });
    };
    const onCancel = () => {
      const checked = checkbox.checked;
      cleanup();
      resolve({ confirmed: false, checked });
    };
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
  });
}

// Petite fenêtre (et non plus une page pleine) affichée une seule fois (voir
// settings.onboarded) pour choisir une RAM raisonnable dès le départ — Java
// est vérifié séparément par ensureJavaAvailable(), avant même cette étape.
function showRamSetupModal(settings) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("ram-setup-overlay");
    const minInput = document.getElementById("ram-setup-min");
    const maxInput = document.getElementById("ram-setup-max");
    const note = document.getElementById("ram-setup-note");
    const continueBtn = document.getElementById("ram-setup-continue");

    minInput.value = settings.suggestedMinGB;
    maxInput.value = settings.suggestedMaxGB;
    note.textContent = t("ramSetup.note", { total: settings.totalGB, min: settings.suggestedMinGB, max: settings.suggestedMaxGB });
    overlay.hidden = false;

    const onContinue = async () => {
      const min = Number(minInput.value);
      const max = Number(maxInput.value);
      await window.mchub.settings.set({ memoryMinGB: min, memoryMaxGB: max, onboarded: true });
      overlay.hidden = true;
      continueBtn.removeEventListener("click", onContinue);
      resolve();
    };
    continueBtn.addEventListener("click", onContinue);
  });
}

async function proceedToGate() {
  gateEl.hidden = false;
  gateMessageEl.textContent = t("bootstrap.resumingSession");

  const restored = await window.mchub.tryRestoreSession();
  if (restored.ok) {
    enterApp(restored.profile);
    return;
  }

  gateMessageEl.textContent = restored.pendingApproval ? t("gate.pendingApproval") : "";
}

async function boot() {
  // Langue/theme appliques avant tout le reste : le reste de boot() (et tout
  // le rendu dynamique via t()) doit deja voir la bonne langue/le bon theme.
  // Flash bref du francais/theme sombre par defaut inevitable ici (le
  // premier paint HTML/CSS a lieu avant que ce script async ne s'execute) —
  // pas de lecture synchrone des settings depuis le renderer.
  const settings = await window.mchub.settings.get();
  window.i18n.setLocale(settings.locale);
  window.i18n.applyStaticI18n(document);
  window.themeControls.applyTheme(settings);
  window.themeControls.watchSystemTheme(() => window.mchub.settings.get());
  document.body.classList.toggle("compact-list", !!settings.compactServerList);
  document.documentElement.lang = settings.locale;

  wireGate();
  wireWindowControls();
  wireSidebar();
  wireSettingsNav();
  wireMcStatus();
  wireNotifications();
  wirePlaybar();

  // Ecran de demarrage : ne couvre que les verifications reelles qui
  // precedent la premiere UI interactive (mise a jour, Java, reprise de
  // session). Si Java manque, ensureJavaAvailable() masque cet ecran
  // lui-meme pour laisser place a son propre ecran de blocage.
  bootstrapVersionEl.textContent = settings.appVersion ? `v${settings.appVersion}` : "";

  // Verification de mise a jour (voir main.js/electron-updater) — hors app
  // packagee (dev via `electron .`), main.js resout tout de suite sans rien
  // verifier reellement, mais cette etape reste visible un court instant
  // pour ne pas donner une impression buguee (texte qui clignote).
  bootstrapStatusEl.textContent = t("bootstrap.checkingUpdates");
  bootstrapProgressEl.style.width = "15%";
  let updateReadyToInstall = false;
  const stopUpdateStatus = window.mchub.updates.onStatus((status) => {
    if (status.phase === "downloading") {
      bootstrapStatusEl.textContent = status.percent
        ? t("bootstrap.downloadingUpdateProgress", { percent: status.percent })
        : t("bootstrap.downloadingUpdate", { version: status.version });
      bootstrapProgressEl.style.width = `${15 + Math.round((status.percent || 0) * 0.55)}%`;
    } else if (status.phase === "ready-to-install") {
      bootstrapStatusEl.textContent = t("bootstrap.updateReady");
      bootstrapProgressEl.style.width = "100%";
      updateReadyToInstall = true;
    }
    // "up-to-date" et "error" : silencieux, l'etape suivante (Java) prend le
    // relai tout de suite — jamais d'ecran d'erreur pour une verification de
    // mise a jour ratee (pas de connexion, releases indisponibles...).
  });
  await Promise.all([window.mchub.updates.check(), new Promise((resolve) => setTimeout(resolve, 500))]);
  stopUpdateStatus();

  if (updateReadyToInstall) {
    // BUG corrige ici : window.mchub.updates.check() se resolvait des que
    // "update-downloaded" arrivait, alors que main.js n'appelle
    // quitAndInstall() que ~1.2s plus tard (le temps de montrer ce message).
    // Boot() enchainait donc immediatement sur Java/reprise de session
    // PENDANT ce delai, et l'appli se fermait en plein milieu pour installer
    // la mise a jour — donnant l'impression d'un crash sans aucune erreur a
    // journaliser (il n'y en avait pas : l'appli se fermait exactement comme
    // prevu, juste au mauvais moment aux yeux du joueur). On s'arrete ici :
    // l'appli va se fermer puis se relancer seule (main.js, isForceRunAfter),
    // le prochain demarrage repartira de zero sur la nouvelle version.
    return;
  }

  bootstrapStatusEl.textContent = t("bootstrap.checkingJava");
  bootstrapProgressEl.style.width = "45%";

  await ensureJavaAvailable();

  bootstrapStatusEl.textContent = t("bootstrap.resumingSession");
  bootstrapProgressEl.style.width = "85%";

  // Sortie de la petite fenetre de demarrage vers la taille normale de
  // l'appli — sans effet si ensureJavaAvailable() l'a deja fait juste avant
  // (setSize/setResizable/setMinimumSize sont idempotents cote main.js).
  await window.mchub.windowControls.expandFromBootstrap();

  document.body.classList.remove("bootstrapping");

  if (!settings.onboarded) {
    bootstrapEl.hidden = true;
    await showRamSetupModal(settings);
  }

  bootstrapEl.hidden = true;
  await proceedToGate();
}

boot();

// Modèle "polling" retenu pour le MVP (cahier des charges, section 3) :
// pas de WebSocket, juste un rafraîchissement régulier en arrière-plan.
// Ne touche à rien si le joueur est sur une page de détail, et reste
// silencieux en cas d'échec (on ne veut pas interrompre l'utilisateur
// pour un ping raté en tâche de fond).
const REFRESH_INTERVAL_MS = 30_000;

async function silentRefreshList() {
  if (!signedIn || listEl.hidden) return;
  const result = await fetchServerList({ force: true });
  if (result.ok) renderList(result.servers);
}

setInterval(silentRefreshList, REFRESH_INTERVAL_MS);
setInterval(refreshNotifications, REFRESH_INTERVAL_MS);
