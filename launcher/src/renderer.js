const t = window.i18n.t;

const gateEl = document.getElementById("gate");
const gateMessageEl = document.getElementById("gate-message");
const gateLoginBtn = document.getElementById("gate-login");
const appEl = document.getElementById("app");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const listTitleEl = document.getElementById("list-title");
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
// Systeme d'amis, phase 1 (2026-10-14) : pas une vue (jamais de classe "active"), juste le
// declencheur du panneau deroulant #friends-dropdown — voir wireFriends() plus bas, et
// renderAccountHeader()/renderGuestHeader() pour sa visibilite (compte Microsoft requis, comme
// nav-settings).
const navFriendsBtn = document.getElementById("nav-friends");
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
  // Juste le nombre : « 16170 / 200000 » (le libellé est donné par le titre de la case).
  return `${server.playerCount}${capacity}`;
}

function playersLabel(server) {
  const online = server.playerCount !== null && server.playerCount !== undefined;
  // Contacté mais sans réponse : serveur fermé, en rouge (et non « statut inconnu »).
  if (!online && server.pinged) {
    return `<span class="status-dot" style="background:var(--danger)"></span><span style="color:var(--danger)">${t("serverCard.offline")}</span>`;
  }
  return `<span class="status-dot${online ? " online" : ""}"></span>${playersText(server)}`;
}

// Echappe aussi les guillemets : utilisee dans des attributs ("...") comme dans
// du texte, donc un guillemet non echappe pourrait fermer l'attribut et en
// injecter un nouveau (textContent->innerHTML ne touche pas aux guillemets).
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// Active un element au clavier (Entree/Espace) en plus du clic souris — pour les
// ".row"/cartes cliquees via un simple <div onclick> sans semantique de bouton
// native (voir serverRowHtml/homeContinueCardHtml). Ne reagit qu'a l'element
// focalise lui-meme : un bouton imbrique (etoile favori, "Jouer"...) gere deja
// son propre clic/clavier et appelle stopPropagation() sur son clic, donc ce
// garde-fou evite de declencher aussi l'activation de la ligne en plus du
// bouton quand Entree/Espace est presse alors que le focus est sur ce bouton.
function onRowActivate(el, handler) {
  el.addEventListener("click", handler);
  el.addEventListener("keydown", (event) => {
    if (event.target !== el) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handler(event);
  });
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

// Vrai si le joueur actuellement connecte possede ce serveur (son UUID Minecraft
// est celui du proprietaire sur le site) — jamais vrai si server.ownerMinecraftUuid
// est absent (serveur sans proprietaire).
function isOwnServer(server) {
  return !!(currentProfile && server.ownerMinecraftUuid && server.ownerMinecraftUuid === currentProfile.id);
}

// Ligne serveur partagee entre la liste principale, "Favoris" et "Recents" —
// meme rendu partout, seule la source de la liste de serveurs change.
function serverRowHtml(server, isFav) {
  const ownerTag = isOwnServer(server) ? `<span class="owner-tag">${t("serverCard.owner")}</span>` : "";
  return `
    <div class="row" data-slug="${escapeHtml(server.slug)}" role="button" tabindex="0">
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

// Squelettes de chargement (meme principe que "Mes instances", voir
// myInstancesSkeletonHtml) : affiches tout de suite, avant l'aller-retour
// reseau, pour eviter un panneau vide ou foncer qui donne l'impression que
// l'appli a plante.
function skeletonRowHtml() {
  return `
    <div class="row" aria-hidden="true">
      <span class="sk-circle" style="width: 38px; height: 38px;"></span>
      <div class="row-body" style="gap: 6px;">
        <div class="sk-line" style="height: 13px; width: 45%;"></div>
        <div class="sk-line" style="height: 11px; width: 75%;"></div>
      </div>
    </div>`;
}

function skeletonListHtml(count = 3) {
  return `<div class="list-rows server-list" aria-busy="true">${skeletonRowHtml().repeat(count)}</div>`;
}

function skeletonDetailHtml() {
  return `
    <div class="detail-hero"><div class="detail-banner sk-bar"></div></div>
    <div class="detail-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="sk-circle" style="width: 44px; height: 44px;"></span>
        <div class="sk-line" style="height: 18px; width: 50%;"></div>
      </div>
    </div>
    <div class="stat-row" aria-busy="true">
      <div class="stat-tile"><div class="sk-line" style="height: 30px; width: 100%;"></div></div>
      <div class="stat-tile"><div class="sk-line" style="height: 30px; width: 100%;"></div></div>
      <div class="stat-tile"><div class="sk-line" style="height: 30px; width: 100%;"></div></div>
    </div>
    <div class="sk-line" style="height: 12px; width: 90%; margin-top: 12px;"></div>
    <div class="sk-line" style="height: 12px; width: 70%; margin-top: 8px;"></div>`;
}

async function renderRowsInto(container, servers, origin, onFavoriteToggled) {
  const favorites = await getFavoriteSlugs();
  container.innerHTML = servers.map((server) => serverRowHtml(server, favorites.includes(server.slug))).join("");

  container.querySelectorAll(".row").forEach((row) => {
    onRowActivate(row, () => {
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

// Meme pagination que "Mes instances" (voir MY_INSTANCES_PAGE_SIZE) : une dizaine de
// serveurs a la fois, sinon l'annuaire complet serait interminable a faire defiler.
let serverListPage = 1;
const SERVER_LIST_PAGE_SIZE = 10;

async function renderFilteredList() {
  const filtered = applySearchAndSort(allServers);
  if (filtered.length === 0 && listSearchQuery.trim()) {
    listEl.innerHTML = "";
    document.getElementById("server-list-pager-slot").innerHTML = "";
    statusEl.hidden = false;
    statusEl.classList.remove("error");
    statusEl.textContent = t("serverList.noResults");
    return;
  }
  statusEl.hidden = true;

  const pageCount = Math.max(1, Math.ceil(filtered.length / SERVER_LIST_PAGE_SIZE));
  serverListPage = Math.min(Math.max(1, serverListPage), pageCount);
  const shown = filtered.slice((serverListPage - 1) * SERVER_LIST_PAGE_SIZE, serverListPage * SERVER_LIST_PAGE_SIZE);

  await renderRowsInto(listEl, shown, "servers", renderFilteredList);
  document.getElementById("server-list-pager-slot").innerHTML = topPagerHtml(serverListPage, pageCount, "server-list-pager");
  document.getElementById("server-list-pager-prev")?.addEventListener("click", () => {
    serverListPage -= 1;
    renderFilteredList();
  });
  document.getElementById("server-list-pager-next")?.addEventListener("click", () => {
    serverListPage += 1;
    renderFilteredList();
  });
}

async function renderList(servers) {
  detailEl.hidden = true;
  listEl.hidden = false;
  listToolbarEl.hidden = servers.length === 0;
  listTitleEl.hidden = servers.length === 0;
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
  serverListPage = 1;
  renderFilteredList();
});
const listRefreshBtn = document.getElementById("list-refresh");
const LIST_REFRESH_COOLDOWN_S = 30;
let listRefreshTimer = null;
listRefreshBtn.addEventListener("click", () => {
  if (listRefreshTimer) return;
  let left = LIST_REFRESH_COOLDOWN_S;
  const label = t("serverList.refresh");
  listRefreshBtn.disabled = true;
  // Pendant le compte à rebours, le bouton n'a plus l'apparence « actif » (comme Plus récents).
  listRefreshBtn.classList.remove("active");
  listRefreshBtn.style.opacity = "0.5";
  const tick = () => {
    listRefreshBtn.textContent = left > 0 ? `${label} (${left} s)` : label;
    left -= 1;
    if (left < 0) {
      clearInterval(listRefreshTimer);
      listRefreshTimer = null;
      listRefreshBtn.disabled = false;
      listRefreshBtn.classList.add("active");
      listRefreshBtn.style.opacity = "";
    }
  };
  tick();
  listRefreshTimer = setInterval(tick, 1000);
  loadServers();
});

[sortRecentBtn, sortPlayersBtn].forEach((btn) => {
  btn.addEventListener("click", () => {
    listSortMode = btn.dataset.sort;
    sortRecentBtn.classList.toggle("active", listSortMode === "recent");
    sortPlayersBtn.classList.toggle("active", listSortMode === "players");
    serverListPage = 1;
    renderFilteredList();
  });
});

// Serveur gelé par l'équipe : même fiche, avec « Serveur gelé » à la place de « Rejoindre ».
function renderFrozenDetail(slug) {
  listEl.hidden = true;
  statusEl.hidden = true;
  detailEl.hidden = false;
  detailEl.innerHTML = `
    <button class="back">${t("serverDetail.back")}</button>
    <h2 style="margin: 16px 0 8px 0;">${escapeHtml(slug)}</h2>
    <p style="color: #8ac3e0; margin: 0 0 16px 0;">${t("serverDetail.frozenText")}</p>
    <button class="join-btn" disabled style="color: #8ac3e0; border-color: #8ac3e0;">${t("serverDetail.frozenBtn")}</button>
  `;
  detailEl.querySelector(".back").addEventListener("click", () => {
    if (detailOrigin === "favorites") showFavoritesView();
    else if (detailOrigin === "recent") showRecentView();
    else if (detailOrigin === "home") showHomeView();
    else loadServers();
  });
}

async function renderDetail(server) {
  listEl.hidden = true;
  statusEl.hidden = true;
  detailEl.hidden = false;

  const tags = [`<span class="tag-chip">${server.type === "modded" ? t("serverCard.modded") : t("serverCard.vanilla")}</span>`];
  if (server.type === "modded" && server.curseforgeModpackName) {
    const version = server.curseforgeModpackVersion ? ` — ${escapeHtml(server.curseforgeModpackVersion)}` : "";
    tags.push(`<span class="tag-chip">${escapeHtml(server.curseforgeModpackName)}${version}</span>`);
  }

  // Toujours actif, meme sans connexion (2026-10-11, audit onboarding) :
  // launchServer() demande la connexion lui-meme au clic si besoin — plus de
  // bouton desactive avec une note a ce stade. La progression de lancement ne
  // s'affiche plus ici — voir launchServer()/la barre de lancement rapide.
  // "Installer" a cote de "Rejoindre" (2026-10-11, audit onboarding) :
  // telecharge le modpack/Java sans lancer le jeu, donc sans demander de
  // connexion — voir installServerStandalone(). "Rejoindre" reste le seul
  // bouton qui demande un compte Microsoft (voir launchServer()).
  // "Installer" disponible pour tous les types de serveur (2026-10-11) : un
  // vanilla profite aussi de pouvoir etre prepare a l'avance (ex. avant un
  // evenement programme, pour qui a une connexion lente) — pas qu'un confort
  // reserve aux moddes. Une fois CE serveur precis pret, plus besoin du
  // bouton — jamais une disparition globale, juste pour ce serveur (voir
  // servers:installStatus cote main.js, qui gere les deux cas).
  const showInstallBtn = !(await window.mchub.getServerInstallStatus(server.slug)).installed;
  const joinSection = `
    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
      <button class="join-btn" id="join-btn">${t("serverDetail.joinBtn")}</button>
      ${showInstallBtn ? `<button class="btn-secondary" id="install-btn" type="button">${t("serverDetail.installBtn")}</button>` : ""}
    </div>
  `;

  const isFav = (await getFavoriteSlugs()).includes(server.slug);

  detailEl.innerHTML = `
    <button class="back">${t("serverDetail.back")}</button>
    <div class="detail-hero">
      <div class="detail-banner">
        ${server.bannerUrl ? `<img src="${escapeHtml(server.bannerUrl)}" alt="" />` : ""}
      </div>
    </div>
    <div class="detail-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="detail-icon detail-icon-inline">${serverIconInner(server)}</div>
        <h2 style="margin: 0;">${escapeHtml(server.name)}</h2>
        ${favoriteBtnHtml(server.slug, isFav, "detail-favorite-btn")}
        ${
          signedIn
            ? `<button class="favorite-btn" id="report-open-btn" type="button" title="${t("serverDetail.report")}" style="margin-left: auto;">${FLAG_SVG}</button>`
            : ""
        }
      </div>
      ${server.playerCount == null && server.pinged ? `<p class="meta">${playersLabel(server)}</p>` : ""}
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
              <div class="stat-value">${escapeHtml(String(server.recommendedRamGB))} ${t("serverDetail.ramUnit")}</div>
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

  const installBtn = document.getElementById("install-btn");
  if (installBtn) {
    installBtn.addEventListener("click", () => installServerStandalone(server, installBtn));
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

const REPORT_ISSUES = {
  technical: ["cant_connect", "wrong_version", "modpack_download", "crash", "other"],
  behavior: ["stolen_server", "stolen_content", "impersonating", "inappropriate_content", "scam_phishing", "other"],
};
const reportOverlayEl = document.getElementById("report-overlay");
const reportTitleEl = document.getElementById("report-title");
const reportChipsEl = document.getElementById("report-issue-chips");
const reportMessageEl = document.getElementById("report-message");
const reportDiagnosticsFieldEl = document.getElementById("report-diagnostics-field");
const reportDiagnosticsEl = document.getElementById("report-diagnostics");
const reportDiagnosticsDetailEl = document.getElementById("report-diagnostics-detail");
const reportProofFieldEl = document.getElementById("report-proof-field");
const reportProofEl = document.getElementById("report-proof");
const reportPrivacyNoteEl = document.getElementById("report-privacy-note");
const reportCategoryTechnicalEl = document.getElementById("report-category-technical");
const reportCategoryBehaviorEl = document.getElementById("report-category-behavior");
const reportErrorEl = document.getElementById("report-error");
const reportSendBtn = document.getElementById("report-send");
const reportCancelBtn = document.getElementById("report-cancel");
let reportSelectedIssue = null;
let reportSelectedCategory = "technical";

function closeReportDialog() {
  reportOverlayEl.hidden = true;
}

function renderReportIssueChips() {
  reportSelectedIssue = null;
  reportChipsEl.innerHTML = REPORT_ISSUES[reportSelectedCategory]
    .map((issue) => `<button type="button" class="issue-chip" data-issue="${issue}">${t(`report.issue${issue.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase())}`)}</button>`)
    .join("");
  reportChipsEl.querySelectorAll(".issue-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      reportSelectedIssue = chip.dataset.issue;
      reportChipsEl.querySelectorAll(".issue-chip").forEach((c) => c.classList.toggle("active", c === chip));
    });
  });
}

function setReportCategory(category) {
  reportSelectedCategory = category;
  reportCategoryTechnicalEl.classList.toggle("active", category === "technical");
  reportCategoryBehaviorEl.classList.toggle("active", category === "behavior");
  reportDiagnosticsFieldEl.hidden = category !== "technical";
  reportProofFieldEl.hidden = category !== "behavior";
  reportPrivacyNoteEl.textContent = category === "technical" ? t("report.privacyTechnical") : t("report.privacyBehavior");
  renderReportIssueChips();
}

// Dialogue "Signaler" (voir "03b/03c Report a server" dans Design/Omniscient Launcher UI
// Mockups.dc.html) — deux categories : "Probleme technique" (va au proprietaire) et
// "Comportement/contenu" (va aux moderateurs Omniscient, jamais vu par le proprietaire).
async function openReportDialog(server) {
  reportTitleEl.textContent = `${t("report.title")} — ${server.name}`;
  reportMessageEl.value = "";
  reportProofEl.value = "";
  reportDiagnosticsEl.checked = true;
  const info = await window.mchub.diagnostics.getSystemInfo();
  reportDiagnosticsDetailEl.textContent = `client ${server.minecraftVersion} · launcher ${info.launcherVersion || ""}`;
  reportErrorEl.hidden = true;
  reportSendBtn.disabled = false;
  reportSendBtn.textContent = t("report.send");

  setReportCategory("technical");
  reportCategoryTechnicalEl.onclick = () => setReportCategory("technical");
  reportCategoryBehaviorEl.onclick = () => setReportCategory("behavior");

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
      category: reportSelectedCategory,
      issue: reportSelectedCategory === "technical" ? reportSelectedIssue : null,
      behaviorIssue: reportSelectedCategory === "behavior" ? reportSelectedIssue : null,
      message,
      clientVersion: server.minecraftVersion,
      attachDiagnostics: reportDiagnosticsEl.checked,
      proofUrl: reportSelectedCategory === "behavior" ? reportProofEl.value.trim() : null,
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

// Fenêtre du choix de RAM : deux boutons (lancer avec la RAM du serveur / garder mes paramètres)
// et deux cases indépendantes qui retiennent le choix pour les prochains lancements. Les boutons
// ne valent que pour la partie en cours.
function showRamChoiceModal({ recommended, configured, warning }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("ram-choice-overlay");
    const autoBox = document.getElementById("ram-choice-auto");
    const manualBox = document.getElementById("ram-choice-manual");
    const serverBtn = document.getElementById("ram-choice-server");
    const mineBtn = document.getElementById("ram-choice-mine");
    const closeBtn = document.getElementById("ram-choice-close");

    document.getElementById("ram-choice-title").textContent = t("modal.ramRecommendedTitle");
    document.getElementById("ram-choice-body").textContent = t("modal.ramChoiceBody", { recommended, configured });
    const warnEl = document.getElementById("ram-choice-warning");
    warnEl.textContent = warning || "";
    warnEl.hidden = !warning;
    // Mêmes phrases que dans Paramètres > Mémoire.
    document.getElementById("ram-choice-auto-label").textContent = t("settings.alwaysRecommended");
    document.getElementById("ram-choice-manual-label").textContent = t("settings.alwaysCustom");
    serverBtn.textContent = t("modal.ramChoiceServerBtn", { recommended });
    mineBtn.textContent = t("modal.ramChoiceMineBtn", { configured });
    autoBox.checked = false;
    manualBox.checked = false;
    overlay.querySelector(".modal-box").classList.add("pop-in");
    overlay.hidden = false;

    // Les deux cases s'excluent : une seule préférence à la fois.
    const onAuto = () => {
      if (autoBox.checked) manualBox.checked = false;
    };
    const onManual = () => {
      if (manualBox.checked) autoBox.checked = false;
    };
    const cleanup = () => {
      overlay.hidden = true;
      autoBox.removeEventListener("change", onAuto);
      manualBox.removeEventListener("change", onManual);
      serverBtn.removeEventListener("click", onServer);
      mineBtn.removeEventListener("click", onMine);
      closeBtn.removeEventListener("click", onClose);
    };
    const finish = (useServer, close) => {
      const always = autoBox.checked ? "auto" : manualBox.checked ? "manual" : null;
      cleanup();
      resolve({ close, useServer, always });
    };
    const onServer = () => finish(true, false);
    const onMine = () => finish(false, false);
    const onClose = () => finish(false, true);

    autoBox.addEventListener("change", onAuto);
    manualBox.addEventListener("change", onManual);
    serverBtn.addEventListener("click", onServer);
    mineBtn.addEventListener("click", onMine);
    closeBtn.addEventListener("click", onClose);
  });
}

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
  const configured = settings.memoryMaxGB;

  // « Toujours avec ma RAM » : si la mienne suffit, on lance sans rien demander. Sinon le joueur
  // est prévenu et revoit les deux boutons (voir la fenêtre plus bas, avec l'avertissement).
  if (settings.alwaysUseCustomRam && recommended <= configured) return { proceed: true, memoryOverride: null };

  // Au-dela de 80% de la RAM totale, il ne resterait quasiment rien pour
  // l'OS et le reste du systeme — on refuse d'appliquer la valeur telle
  // quelle, meme si "toujours utiliser la RAM recommandée" est coché.
  const isUnsafe = recommended > settings.totalGB * 0.8;

  if (isUnsafe) {
    const fallbackMaxGB = Math.max(1, Math.floor(settings.totalGB / 2));
    const fallbackMinGB = Math.max(1, Math.floor(fallbackMaxGB / 2));
    const result = await showModal({
      tone: "danger",
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

  const warning = recommended > configured ? t("modal.ramChoiceWarning", { recommended, configured }) : null;
  const choice = await showRamChoiceModal({ recommended, configured, warning });
  if (choice.close) return { proceed: false, memoryOverride: null };

  // Les cases retiennent le choix pour les prochains lancements ; les boutons ne valent que pour cette partie.
  const halfGB = Math.max(1, Math.floor(recommended / 2));
  if (choice.always === "auto") {
    await window.mchub.settings.set({ memoryMinGB: halfGB, memoryMaxGB: recommended, alwaysUseRecommendedRam: true, alwaysUseCustomRam: false });
  } else if (choice.always === "manual") {
    await window.mchub.settings.set({ alwaysUseCustomRam: true, alwaysUseRecommendedRam: false });
  }
  if (!choice.useServer) return { proceed: true, memoryOverride: null };
  return { proceed: true, memoryOverride: { minGB: halfGB, maxGB: recommended } };
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

// Bouton « Jouer » : pendant le démarrage ou pendant que Minecraft tourne, il affiche l'état
// (et clignote) au lieu de « Jouer » — on ne peut pas lancer deux Minecraft à la fois.
function syncPlaybarWithGame() {
  const playBtn = document.getElementById("playbar-play");
  const running = gamePlaying || launchStarting;
  playBtn.classList.toggle("playing", running);
  if (gamePlaying) {
    playBtn.textContent = t("playbar.minecraftRunning");
    playBtn.disabled = true;
  } else if (launchStarting) {
    playBtn.textContent = t("playbar.minecraftStarting");
    playBtn.disabled = true;
  } else {
    playBtn.textContent = t("playbar.play");
    playBtn.disabled = !selectedFavoriteSlug || launchInProgress;
  }
}

async function launchServer(server) {
  // Le flag doit etre pose ICI, avant le moindre await — pas apres
  // applyRecommendedRamIfNeeded() (qui peut ouvrir une modale bloquante et
  // laisser largement le temps a un second clic de passer le test
  // ci-dessus avant que le flag soit leve). C'est ce qui protege tous les
  // points d'entree (playbar, carte "Continuer", "Mes instances"/"Rejoint",
  // fiche detail) d'un seul coup, meme ceux qui ne desactivent pas aussi
  // leur propre bouton par securite.
  if (launchInProgress) return null;
  launchInProgress = true;

  // Connexion demandee ici, pas avant (2026-10-11, audit onboarding) : premier
  // moment ou elle est reellement necessaire, quel que soit le point d'entree
  // (playbar, carte "Continuer", "Mes instances"/"Rejoint", fiche detail).
  if (!signedIn) {
    const signedInNow = await attemptSignIn(true);
    if (!signedInNow) {
      launchInProgress = false;
      return null;
    }
  }

  const { proceed, memoryOverride } = await applyRecommendedRamIfNeeded(server);
  if (!proceed) {
    launchInProgress = false;
    return null;
  }

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
    selectedFavoriteSlug = server.slug;
    await refreshPlaybarFavorites();

    // Parametres > Debogage (voir renderDebugTab) — deux reglages qui
    // n'ont d'effet qu'au moment ou une partie demarre reellement.
    if (settings.openConsoleOnLaunch) window.mchub.logs.openConsole();
    if (settings.keepLauncherOpenWhilePlaying === false) window.mchub.windowControls.minimize();

    setTimeout(() => {
      setPlaybarBusy(false);
      launchStarting = true;
      syncPlaybarWithGame();
      // Sécurité : si le jeu ne s'annonce jamais, le bouton reprend son état normal.
      setTimeout(() => {
        launchStarting = false;
        syncPlaybarWithGame();
      }, 60_000);
    }, 1800);
  } else {
    fill.classList.add("error");
    label.textContent = result.error;
    if (result.frozen) {
      await showModal({
        title: t("modal.frozenTitle"),
        body: t("modal.frozenBody", { name: server.name }),
        confirmLabel: t("modal.frozenClose"),
      });
    }
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

// Bouton "Installer" (2026-10-11, audit onboarding) : telecharge le modpack
// et le Java requis sans lancer le jeu, donc sans demander de connexion
// Microsoft — voir server:install cote main.js. La progression ne s'affiche
// plus sur ce bouton : elle vit dans le panneau de taches de la barre de
// titre (renderTasksPanel/wireTasksMenu), comme "Rejoindre" — ce bouton ne
// fait plus que declencher la tache, brievement desactive pour eviter un
// double-clic qui en creerait une seconde pour rien (meme si server:install
// la rejette aussi de son cote, par securite).
async function installServerStandalone(server, btn) {
  btn.disabled = true;
  try {
    const result = await window.mchub.installServer(server.slug, server.name);
    if (result?.ok) {
      // Disparait tout de suite pour CE serveur (2026-10-11) — pas besoin de
      // quitter puis revenir sur la fiche pour que ça se mette a jour.
      btn.remove();
      return;
    }
    if (result?.frozen) {
      await showModal({
        title: t("modal.frozenTitle"),
        body: t("modal.frozenBody", { name: server.name }),
        confirmLabel: t("modal.frozenClose"),
      });
    }
  } finally {
    if (document.body.contains(btn)) btn.disabled = false;
  }
}

async function openDetail(slug) {
  homePanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  detailEl.hidden = false;
  detailEl.innerHTML = skeletonDetailHtml();

  const result = await window.mchub.getServer(slug);
  if (!result.ok && result.frozen) {
    renderFrozenDetail(slug);
    return;
  }
  if (!result.ok) {
    detailEl.hidden = true;
    statusEl.hidden = false;
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
  statusEl.hidden = true;
  detailEl.hidden = true;
  listEl.hidden = false;
  listEl.innerHTML = skeletonRowHtml().repeat(6);

  // Toujours un aller-retour reseau ici : c'est le point d'entree explicite
  // "l'utilisateur veut voir la liste a jour" (nav, connexion, rafraichissement
  // silencieux) — mais il alimente au passage le cache ci-dessus pour la
  // barre de lancement rapide.
  const result = await fetchServerList({ force: true });
  if (!result.ok) {
    listEl.hidden = true;
    statusEl.hidden = false;
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
  const secured = url.replace(/^http:/, "https:");
  // Cette URL finit dans un url('...') CSS a l'interieur d'un style="...":
  // l'echappement HTML ne suffit pas pour la partie CSS, on refuse donc
  // plutot que d'injecter une valeur qui sortirait de la chaine.
  return /^https:\/\/[^\s"'()<>\\`]+$/.test(secured) ? secured : "";
}

function renderAccountHeader(profile, { rememberFailed } = {}) {
  // "Parametres" reprend sa place normale au-dessus de l'avatar (2026-10-11) :
  // en mode visiteur, renderGuestHeader() l'avait deplace tout en bas, a la
  // place de l'avatar absent — voir ce commentaire la-bas.
  navSettingsBtn.hidden = false;
  navFriendsBtn.closest(".friends-menu").hidden = false;
  if (currentProfile && currentProfile.id !== profile.id) {
    myInstancesServers = [];
    myJoinedServers = [];
  }
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
    myInstancesServers = [];
    myJoinedServers = [];
    // Retour en mode visiteur, pas vers l'ecran de connexion bloquant
    // (2026-10-11, audit onboarding) : se deconnecter doit laisser l'annuaire
    // parcourable, comme au tout premier demarrage. L'annuaire plutot que
    // l'accueil : l'accueil (carte "Continuer", favoris) n'a rien a montrer
    // sans historique de connexion.
    renderGuestHeader();
    showServersView();
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

// Statut des services dont ce launcher depend reellement, par fournisseur
// (Minecraft, Modrinth, CurseForge — voir servicesStatus.js ; Mojang n'a plus
// d'API de statut officielle depuis 2022). Le point du bouton prend la pire
// couleur parmi tous les services ; chaque bloc peut etre replie.
const mcStatusTrigger = document.getElementById("mc-status-trigger");
const mcStatusDot = document.getElementById("mc-status-dot");
const mcStatusPanel = document.getElementById("mc-status-panel");
const mcStatusList = document.getElementById("mc-status-list");

const MC_STATUS_RANK = { ok: 0, degraded: 1, offline: 2 };
const MC_STATUS_CLASS = { ok: "online", degraded: "degraded", offline: "offline" };
const MC_STATUS_TILE = { minecraft: ["MC", "#62b246"], modrinth: ["Mr", "#1bd96a"], curseforge: ["CF", "#f16436"] };
const MC_STATUS_REFRESH_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>';
const MC_STATUS_CHEV_SVG = '<svg class="mc-status-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
// Replies par defaut : seul le test de connexion reste ouvert. Un clic sur un
// fournisseur l'ouvre (il sort de cet ensemble).
const mcStatusCollapsed = new Set(["minecraft", "modrinth", "curseforge"]);
let mcStatusData = null; // derniere reponse { fetchedAt, groups }
let mcStatusLoading = false;
// Test de debit de CE PC : state "idle" | "running" | "done" | "error" (voir main.js status:getConnection).
let mcConnection = { state: "idle", phase: "", percent: 0, result: null };

function mcConnectionHtml() {
  let body;
  if (mcConnection.state === "running" || mcConnection.state === "done") {
    // Etapes : 1 = ping, 2 = telechargement, 3 = envoi (barre animee, pas de progression reelle).
    const phase = mcConnection.state === "done" ? "finished" : mcConnection.phase;
    const v = mcConnection.state === "done" ? mcConnection.result : mcConnection.values || {};
    const pingDone = phase !== "ping";
    const downDone = phase === "upload" || phase === "finished";
    const upDone = phase === "finished";
    const segment = (filled, inner) =>
      `<div style="flex:1;height:4px;border-radius:2px;background:var(--surface-2);overflow:hidden">${
        filled ? `<div style="width:100%;height:100%;background:#9184d9"></div>` : inner || ""
      }</div>`;
    const downPct = phase === "download" ? mcConnection.percent : 0;
    const steps = `<div style="display:flex;gap:6px;margin:12px 0 6px">
      ${segment(pingDone, phase === "ping" ? `<div style="width:30%;height:100%;background:#9184d9;opacity:0.7"></div>` : "")}
      ${segment(downDone, phase === "download" ? `<div style="width:${downPct}%;height:100%;background:#9184d9"></div>` : "")}
      ${segment(upDone, phase === "upload" ? `<div class="conn-indeterminate"></div>` : "")}
    </div>`;
    const stepLabel = (label, done, active) =>
      `<span style="${done ? "color: var(--muted);" : active ? "color: var(--accent);" : "color: var(--muted); opacity: 0.6;"}">${escapeHtml(label)}${done ? " ✓" : ""}</span>`;
    const labels = `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:12px">
      ${stepLabel(t("serviceStatus.connPing"), pingDone, phase === "ping")}
      ${stepLabel(t("serviceStatus.connDown"), downDone, phase === "download")}
      ${stepLabel(t("serviceStatus.connUp"), upDone, phase === "upload")}
    </div>`;
    // Pendant le test : "mesure…" ; une fois fini, "—" si la mesure a echoue.
    const missing = mcConnection.state === "done" ? "—" : t("serviceStatus.connMeasuring");
    const tile = (label, value) =>
      `<div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px"><div style="font-size:11px;color:var(--muted)">${escapeHtml(label)}</div><div style="font-size:15px;font-weight:600;margin-top:2px;color:${value ? "var(--foreground)" : "var(--muted)"}">${escapeHtml(value || missing)}</div></div>`;
    const fmt = (value, unit) => (value == null ? "" : `${value} ${unit}`);
    const tiles = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${tile(t("serviceStatus.connPing"), fmt(v.pingMs, "ms"))}
      ${tile(t("serviceStatus.connDown"), fmt(v.downloadMbps, "Mb/s"))}
      ${tile(t("serviceStatus.connUp"), fmt(v.uploadMbps, "Mb/s"))}
    </div>`;
    const info = phase === "finished" ? "" : `<p class="join-note" style="margin: 10px 0 0;">${escapeHtml(t("serviceStatus.connInfo"))}</p>`;
    body = `<div class="mc-status-rows" style="padding: 0 12px 8px;">${steps}${labels}${tiles}${info}</div>`;
  } else if (mcConnection.state === "error") {
    body = `<div class="mc-status-rows"><div class="mc-status-row"><span class="mc-status-row-label">${escapeHtml(t("serviceStatus.connError"))}</span></div></div>`;
  } else {
    body = `<div class="mc-status-rows"><div class="mc-status-row"><span class="mc-status-row-label">${escapeHtml(t("serviceStatus.connIdle"))}</span></div></div>`;
  }
  return `
    <section class="mc-status-group">
      <div class="mc-status-group-head" style="cursor: default;">
        <span class="mc-status-tile" style="background: #9184d9;">Ta</span>
        <span class="mc-status-group-name">${escapeHtml(t("serviceStatus.connTitle"))}</span>
      </div>
      ${body}
    </section>`;
}

window.mchub.onConnectionProgress((progress) => {
  mcConnection = {
    state: "running",
    phase: progress.phase,
    percent: progress.percent,
    values: { pingMs: progress.pingMs ?? null, downloadMbps: progress.downloadMbps ?? null },
    result: null,
  };
  if (mcStatusData) renderMcStatus(mcStatusData);
});

function mcStatusLabel(state) {
  return t(`mcStatus.${state}`);
}

function worstMcState(states) {
  return states.reduce((acc, s) => (MC_STATUS_RANK[s] > MC_STATUS_RANK[acc] ? s : acc), "ok");
}

// "Tous les services fonctionnent" / "1 service ralenti" / "2 services hors ligne · 1 ralenti"
function mcStatusSummary(states) {
  const slow = states.filter((s) => s === "degraded").length;
  const offline = states.filter((s) => s === "offline").length;
  const count = (n, oneKey, manyKey) => (n === 1 ? t(oneKey) : t(manyKey, { n }));
  if (!offline && !slow) return t("serviceStatus.allOk");
  if (!offline) return count(slow, "serviceStatus.slowOne", "serviceStatus.slowMany");
  const offlineText = count(offline, "serviceStatus.offlineOne", "serviceStatus.offlineMany");
  return slow ? `${offlineText} · ${count(slow, "serviceStatus.slowShortOne", "serviceStatus.slowShortMany")}` : offlineText;
}

function mcStatusCheckedText(fetchedAt) {
  const seconds = Math.max(0, Math.round((Date.now() - fetchedAt) / 1000));
  if (seconds < 5) return t("serviceStatus.checkedNow");
  if (seconds < 60) return t("serviceStatus.checkedSeconds", { n: seconds });
  return t("serviceStatus.checkedMinutes", { n: Math.round(seconds / 60) });
}

function mcStatusRowHtml(service) {
  const latency =
    service.state === "offline"
      ? mcStatusLabel("offline")
      : service.state === "degraded"
        ? t("serviceStatus.slowLatency", { ms: service.latencyMs })
        : `${service.latencyMs} ms`;
  return `
    <div class="mc-status-row ${service.state}">
      <span class="mc-status-row-label"><span class="status-dot ${MC_STATUS_CLASS[service.state]}"></span>${escapeHtml(t(`serviceStatus.svc.${service.id}`))}</span>
      <span class="mc-status-row-latency">${latency}</span>
    </div>`;
}

function renderMcStatus(data) {
  mcStatusData = data;
  const { groups, fetchedAt } = data;
  const states = groups.flatMap((g) => g.services.map((s) => s.state));
  const worst = worstMcState(states);
  mcStatusDot.className = `status-dot ${MC_STATUS_CLASS[worst]}`;

  const groupsHtml = groups
    .map((group) => {
      const [letters, color] = MC_STATUS_TILE[group.id] || [group.name.slice(0, 2), "#9184d9"];
      const collapsed = mcStatusCollapsed.has(group.id);
      const groupWorst = worstMcState(group.services.map((s) => s.state));
      const okCount = group.services.filter((s) => s.state === "ok").length;
      return `
        <section class="mc-status-group${collapsed ? " collapsed" : ""}">
          <button class="mc-status-group-head" type="button" data-group="${escapeHtml(group.id)}" aria-expanded="${!collapsed}">
            <span class="mc-status-tile" style="background: ${color};">${letters}</span>
            <span class="mc-status-group-name">${escapeHtml(group.name)}</span>
            <span class="mc-status-count"><span class="status-dot ${MC_STATUS_CLASS[groupWorst]}"></span>${okCount}/${group.services.length}</span>
            ${MC_STATUS_CHEV_SVG}
          </button>
          ${collapsed ? "" : `<div class="mc-status-rows">${group.services.map(mcStatusRowHtml).join("")}</div>`}
        </section>`;
    })
    .join("");

  mcStatusList.innerHTML = `
    <div class="mc-status-head">
      <div>
        <div class="mc-status-title">${t("serviceStatus.title")}</div>
        <div class="mc-status-summary"><span class="status-dot ${MC_STATUS_CLASS[worst]}"></span><span>${escapeHtml(mcStatusSummary(states))}</span></div>
      </div>
      <button class="mc-status-refresh" id="mc-status-refresh" type="button" title="${t("serviceStatus.refresh")}" aria-label="${t("serviceStatus.refresh")}">${MC_STATUS_REFRESH_SVG}</button>
    </div>
    <div class="mc-status-groups">${mcConnectionHtml()}${groupsHtml}</div>
    <div class="mc-status-foot"><span>${mcStatusCheckedText(fetchedAt)}</span><span>${t("serviceStatus.measured")}</span></div>`;

  mcStatusList.querySelectorAll(".mc-status-group-head").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.group;
      if (mcStatusCollapsed.has(id)) mcStatusCollapsed.delete(id);
      else mcStatusCollapsed.add(id);
      renderMcStatus(mcStatusData);
    });
  });
  document.getElementById("mc-status-refresh").addEventListener("click", () => loadMcStatus(true));
}

// `force` : "Actualiser" — repasse outre le cache de 30 s du processus principal.
const CONNECTION_TEST_ENABLED = false;

async function loadMcStatus(force = false) {
  if (mcStatusLoading) return;
  mcStatusLoading = true;
  if (mcStatusData) document.getElementById("mc-status-refresh")?.classList.add("spinning");
  else mcStatusList.innerHTML = `<div class="mc-status-row" style="padding: 14px;">${t("common.checking")}</div>`;
  try {
    renderMcStatus(await window.mchub.getServicesStatus(force));
    // Test de connexion (ping + envoi/téléchargement de fichiers vers le site) : désactivé pour le moment,
    // il charge le site et ralentit tout le reste. Remettre à true pour le réactiver.
    if (CONNECTION_TEST_ENABLED) {
      mcConnection = { state: "running", phase: "ping", percent: 0, result: null };
      renderMcStatus(mcStatusData);
      const connection = await window.mchub.getConnection(force);
      mcConnection = connection.error ? { state: "error", phase: "", percent: 0, result: null } : { state: "done", phase: "", percent: 0, result: connection };
      renderMcStatus(mcStatusData);
    }
  } finally {
    mcStatusLoading = false;
  }
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
  // Un clic DANS le panneau (replier un bloc, actualiser) ne doit pas le fermer.
  mcStatusPanel.addEventListener("click", (event) => event.stopPropagation());
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

// Couleur par type de notification : gel en bleu, messages de l'équipe selon leur type, messages
// diffusés (panel admin, voir site/src/app/admin/design/bind.ts notificationsHtml) pareil.
const NOTIF_COLORS = {
  server_frozen: "#8ac3e0",
  admin_info: "#9184d9",
  admin_warning: "#e8c547",
  admin_error: "var(--danger)",
  broadcast_announcement: "#9184d9",
  broadcast_maintenance: "#e8c547",
  broadcast_alert: "var(--danger)",
  broadcast_promotion: "#5fd3a0",
  verification_approved: "#5fd3a0",
  verification_rejected: "var(--danger)",
  instance_back_online: "#5fd3a0",
};
const BROADCAST_TITLE_KEYS = {
  broadcast_announcement: "broadcastAnnouncementTitle",
  broadcast_maintenance: "broadcastMaintenanceTitle",
  broadcast_alert: "broadcastAlertTitle",
  broadcast_promotion: "broadcastPromotionTitle",
};

function notifItemHtml(notif) {
  const color = NOTIF_COLORS[notif.type];
  const colorStyle = color ? ` style="color:${color};overflow-wrap:anywhere"` : "";
  const isAdmin = notif.type.startsWith("admin_");
  const broadcastKey = BROADCAST_TITLE_KEYS[notif.type];
  const title = notif.type === "server_frozen"
    ? t("notifications.serverFrozenTitle", { server: notif.serverName })
    : notif.type === "verification_approved"
      ? t("notifications.verificationApprovedTitle", { server: notif.serverName })
      : notif.type === "verification_rejected"
        ? t("notifications.verificationRejectedTitle", { server: notif.serverName })
        : notif.type === "instance_back_online"
          ? t("notifications.instanceBackOnlineTitle", { server: notif.serverName })
          : broadcastKey
          ? t(`notifications.${broadcastKey}`)
          : isAdmin
            ? t("notifications.adminMessageTitle", { server: notif.serverName })
            : notif.type === "report_resolved"
              ? t("notifications.reportResolvedTitle", { server: notif.serverName })
              : t("notifications.reportRepliedTitle", { server: notif.serverName });
  let message = "";
  if (notif.type === "server_frozen") {
    message = `<div class="notif-item-message" style="color:${color};overflow-wrap:anywhere">${t("notifications.serverFrozenBody")}</div>`;
  } else if (notif.message) {
    message = `<div class="notif-item-message"${colorStyle}>${escapeHtml(notif.message)}</div>`;
  }
  return `
    <div class="notif-item${notif.read ? "" : " unread"}" data-id="${escapeHtml(notif.id)}">
      <button type="button" class="notif-item-delete" data-id="${escapeHtml(notif.id)}" title="${t("notifications.deleteOne")}">×</button>
      <div class="notif-item-title"${colorStyle}>${escapeHtml(title)}</div>
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

// Pop-up : un message diffuse (voir BROADCAST_TITLE_KEYS) jamais vu dans cette fenetre de
// l'appli declenche un petit encart temporaire, en plus de la cloche — pas pour les
// notifications personnelles (gel, reponse a un signalement...), deja assez visibles.
const seenNotificationIds = new Set();
let popupSeeded = false;

// Centree et bloquante (reutilise la modale generique showModal, deja partagee par le
// reste de l'appli) : affichee une a la fois, le launcher attend que chacune soit fermee
// avant de montrer la suivante — pas d'empilement ni de modale qui en ecrase une autre.
// Une fois le bon code entre, on ne rebloque plus cette session — meme si la maintenance
// reste active cote site (c'est exactement le role du code : laisser passer malgre tout).
let maintenanceBypassed = false;

// Ecran plein (voir Design/Omniscient Launcher UI Mockups, "01a Maintenance") : bloque tout
// le reste de l'appli jusqu'a un code valide. Reutilisable au demarrage (ensureNotInMaintenance)
// et depuis le pop-up d'une notification "maintenance" deja en session.
function showMaintenanceScreen(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("maintenance-overlay");
    const input = document.getElementById("maintenance-code-input");
    const errorEl = document.getElementById("maintenance-code-error");
    const continueBtn = document.getElementById("maintenance-continue");

    document.getElementById("maintenance-message").textContent = message || t("maintenance.defaultMessage");
    errorEl.hidden = true;
    input.value = "";
    overlay.hidden = false;
    document.body.classList.add("modal-blocking");
    input.focus();

    const cleanup = () => {
      overlay.hidden = true;
      document.body.classList.remove("modal-blocking");
      continueBtn.removeEventListener("click", onSubmit);
      input.removeEventListener("keydown", onKey);
    };
    const onSubmit = async () => {
      const code = input.value.trim();
      if (!code) return;
      continueBtn.disabled = true;
      const result = await window.mchub.verifyMaintenanceCode(code);
      continueBtn.disabled = false;
      if (result.ok) {
        maintenanceBypassed = true;
        cleanup();
        resolve();
        return;
      }
      errorEl.textContent = t("maintenance.wrongCode");
      errorEl.hidden = false;
    };
    const onKey = (event) => {
      if (event.key === "Enter") onSubmit();
    };
    continueBtn.addEventListener("click", onSubmit);
    input.addEventListener("keydown", onKey);
  });
}

// Au demarrage, avant meme l'ecran de connexion : si une maintenance est active, personne ne
// passe sans le code (voir platformSettings.ts cote site, activateLauncherMaintenance).
async function ensureNotInMaintenance() {
  const status = await window.mchub.checkMaintenance();
  if (!status.active) return;
  bootstrapEl.hidden = true;
  await showMaintenanceScreen(status.message);
}

// Re-verifiee periodiquement (voir scheduleRefresh plus bas) : une maintenance activee
// pendant que le launcher tourne deja (apres l'ecran de connexion) doit aussi bloquer,
// pas seulement au demarrage. maintenanceBypassed evite de rebloquer la meme session
// une fois le bon code entre.
async function checkMaintenanceLoop() {
  if (maintenanceBypassed) return;
  const status = await window.mchub.checkMaintenance();
  if (status.active) await showMaintenanceScreen(status.message);
}

async function showNotificationPopup(notif) {
  const title = t(`notifications.${BROADCAST_TITLE_KEYS[notif.type]}`);
  const tone = notif.type === "broadcast_alert" ? "danger" : undefined;
  const isMaintenance = notif.type === "broadcast_maintenance";
  const result = await showModal({
    title,
    body: notif.message ?? "",
    confirmLabel: t("common.close"),
    cancelLabel: isMaintenance ? t("notifications.viewMaintenance") : undefined,
    tone,
    stripeColor: NOTIF_COLORS[notif.type],
  });
  // "Fermer" (confirmed:true) ne fait rien de plus. Le deuxieme bouton, uniquement present
  // pour une maintenance, verifie si elle est reellement active et bloque si oui.
  if (isMaintenance && !result.confirmed) {
    const status = await window.mchub.checkMaintenance();
    if (status.active) await showMaintenanceScreen(status.message);
  }
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

  // Au tout premier chargement, les notifications deja la ne sont pas "nouvelles" : on les
  // marque vues sans pop-up, pour n'afficher que celles qui arrivent vraiment pendant la session.
  const freshBroadcasts = [];
  for (const notif of latestNotifications) {
    if (seenNotificationIds.has(notif.id)) continue;
    seenNotificationIds.add(notif.id);
    if (popupSeeded && BROADCAST_TITLE_KEYS[notif.type]) freshBroadcasts.push(notif);
  }
  popupSeeded = true;
  // Une a la fois (await), jamais deux modales en meme temps.
  for (const notif of freshBroadcasts) await showNotificationPopup(notif);
}

// --- Panneau de taches "Download Manager" (2026-10-11, inspire de Modrinth) ---
// Un seul flux d'etat (window.mchub.onTasksUpdate) pour tout ce qui telecharge,
// que ce soit via le bouton "Installer" ou "Rejoindre" — voir server:install/
// game:launch cote main.js.

const TASK_PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const TASK_RESUME_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 4v16l14-8z"/></svg>';
const TASK_CANCEL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const TASK_RING_CIRCUMFERENCE = 62.8; // 2 * PI * r(=10), voir le cercle dans index.html

function formatTaskBytes(n) {
  if (!n || n <= 0) return "0 Mo";
  const mb = n / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} Go` : `${mb.toFixed(1)} Mo`;
}

function formatTaskSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return "";
  const mbps = bytesPerSecond / (1024 * 1024);
  return mbps >= 1 ? `${mbps.toFixed(1)} Mo/s` : `${Math.round(bytesPerSecond / 1024)} Ko/s`;
}

function taskRowHtml(task, isActive) {
  const metaParts = [];
  if (isActive) {
    if (task.status === "paused") metaParts.push(t("titlebar.taskPaused"));
    else if (task.text) metaParts.push(task.text);
    if (task.totalBytes) metaParts.push(`${formatTaskBytes(task.bytes)} / ${formatTaskBytes(task.totalBytes)}`);
  } else {
    metaParts.push(task.status === "error" ? task.error || t("titlebar.taskFailed") : task.status === "cancelled" ? t("titlebar.taskCancelled") : t("titlebar.taskComplete"));
  }
  const pct = isActive && task.totalBytes ? Math.min(100, Math.round((task.bytes / task.totalBytes) * 100)) : null;
  const actions = isActive
    ? `
      <button class="task-item-action" data-action="${task.status === "paused" ? "resume" : "pause"}" data-id="${task.id}" title="${task.status === "paused" ? t("titlebar.taskResume") : t("titlebar.taskPause")}">
        ${task.status === "paused" ? TASK_RESUME_SVG : TASK_PAUSE_SVG}
      </button>
      <button class="task-item-action" data-action="cancel" data-id="${task.id}" title="${t("titlebar.taskCancel")}">${TASK_CANCEL_SVG}</button>
    `
    : "";
  return `
    <div class="task-item${task.status === "error" ? " task-error" : ""}">
      <div class="task-item-row">
        <div class="task-item-icon">${escapeHtml((task.name || task.slug || "?").slice(0, 1).toUpperCase())}</div>
        <div class="task-item-body">
          <div class="task-item-name">${escapeHtml(task.name || task.slug)}</div>
          <div class="task-item-meta">${escapeHtml(metaParts.filter(Boolean).join(" · "))}</div>
        </div>
        <div class="task-item-actions">${actions}</div>
      </div>
      ${pct != null ? `<div class="task-progress-track"><div class="task-progress-fill" style="width:${pct}%;"></div></div>` : ""}
    </div>
  `;
}

function renderTasksPanel(tasks) {
  const active = tasks.filter((task) => task.status === "active" || task.status === "paused");
  const complete = tasks.filter((task) => task.status === "complete" || task.status === "error" || task.status === "cancelled");

  const trigger = document.getElementById("tasks-trigger");
  const nameEl = document.getElementById("tasks-current-name");
  const speedEl = document.getElementById("tasks-speed");
  const ringFill = document.getElementById("tasks-ring-fill");
  const hasActive = active.length > 0;
  trigger.classList.toggle("has-active", hasActive);
  if (hasActive) {
    // Le premier de la liste "active" : des que celui-ci passe a "complete",
    // il sort de ce tableau et le suivant prend naturellement sa place au
    // prochain rendu — pas besoin de suivre explicitement "lequel afficher".
    nameEl.textContent = active[0].name || active[0].slug;
    nameEl.hidden = false;
    const totalSpeed = active.reduce((sum, task) => sum + (task.speedBps || 0), 0);
    const speedText = formatTaskSpeed(totalSpeed);
    speedEl.textContent = speedText || "…";
    speedEl.hidden = false;
    const totalBytes = active.reduce((sum, task) => sum + (task.totalBytes || 0), 0);
    const doneBytes = active.reduce((sum, task) => sum + (task.bytes || 0), 0);
    const progress = totalBytes ? doneBytes / totalBytes : 0;
    ringFill.style.strokeDashoffset = String(TASK_RING_CIRCUMFERENCE * (1 - progress));
  } else {
    nameEl.hidden = true;
    speedEl.hidden = true;
    ringFill.style.strokeDashoffset = String(TASK_RING_CIRCUMFERENCE);
  }

  document.getElementById("tasks-empty").hidden = tasks.length > 0;
  document.getElementById("tasks-active-section").hidden = active.length === 0;
  document.getElementById("tasks-complete-section").hidden = complete.length === 0;
  document.getElementById("tasks-active-list").innerHTML = active.map((task) => taskRowHtml(task, true)).join("");
  document.getElementById("tasks-complete-list").innerHTML = complete.map((task) => taskRowHtml(task, false)).join("");
}

function wireTasksMenu() {
  const trigger = document.getElementById("tasks-trigger");
  const panel = document.getElementById("tasks-panel");

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => {
    panel.hidden = true;
  });
  wireDismissOnEscape(panel, trigger);

  document.getElementById("tasks-list-scroll").addEventListener("click", async (event) => {
    const btn = event.target.closest(".task-item-action");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === "pause") await window.mchub.tasks.pause(id);
    else if (btn.dataset.action === "resume") await window.mchub.tasks.resume(id);
    else if (btn.dataset.action === "cancel") await window.mchub.tasks.cancel(id);
  });

  document.getElementById("tasks-clear-all").addEventListener("click", () => window.mchub.tasks.clearCompleted());

  window.mchub.onTasksUpdate((tasks) => renderTasksPanel(tasks));
  window.mchub.tasks.list().then(renderTasksPanel);
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

// --- Panneau "Amis" (systeme d'amis, phase 1, 2026-10-14) ---
// Statut binaire en ligne/hors ligne uniquement (pas de "absent"/"invisible"/"ne pas
// deranger", scope valide par l'utilisateur) ; ajout direct et reciproque, pas de demande a
// accepter/refuser. Chargee a la demande (a l'ouverture du panneau), pas de badge/compteur
// proactif comme les notifications — bien plus simple, coherent avec "un panneau simple"
// demande pour cette V1.
let friendsList = [];

function friendRowHtml(friend) {
  return `
    <div class="friends-item" data-id="${escapeHtml(friend.userId)}">
      <span class="friends-item-name">
        <span class="status-dot${friend.online ? " online" : ""}"></span>
        ${escapeHtml(friend.minecraftUsername || "?")}
      </span>
      <button type="button" class="icon-btn friends-item-remove" data-id="${escapeHtml(friend.userId)}" title="${t("friends.remove")}" aria-label="${t("friends.remove")}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>`;
}

function renderFriendsList() {
  const listEl = document.getElementById("friends-list");
  if (friendsList.length === 0) {
    listEl.className = "friends-empty";
    listEl.textContent = t("friends.empty");
    return;
  }
  listEl.className = "";
  listEl.innerHTML = friendsList.map(friendRowHtml).join("");
}

async function refreshFriends() {
  if (!signedIn) return;
  const result = await window.mchub.friends.list();
  if (!result.ok) return;
  friendsList = result.friends;
  renderFriendsList();
}

function wireFriends() {
  const trigger = navFriendsBtn;
  const panel = document.getElementById("friends-dropdown");
  const form = document.getElementById("friends-add-form");
  const input = document.getElementById("friends-add-input");
  const submitBtn = document.getElementById("friends-add-submit");
  const feedbackEl = document.getElementById("friends-feedback");
  const listEl = document.getElementById("friends-list");

  trigger.addEventListener("click", async (event) => {
    event.stopPropagation();
    const wasHidden = panel.hidden;
    panel.hidden = !panel.hidden;
    if (wasHidden) await refreshFriends();
  });
  // Meme raisonnement que notif-panel/tasks-panel ci-dessus : sans ca, tout clic a l'interieur
  // (champ, bouton Ajouter, croix de retrait) remonterait jusqu'au listener document et
  // refermerait le panneau avant meme que l'action ait un effet visible.
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => {
    panel.hidden = true;
  });
  wireDismissOnEscape(panel, trigger);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = input.value.trim();
    if (!username) return;
    submitBtn.disabled = true;
    feedbackEl.hidden = true;
    const result = await window.mchub.friends.add(username);
    submitBtn.disabled = false;
    if (!result.ok) {
      feedbackEl.textContent = result.error || t("friends.addError");
      feedbackEl.hidden = false;
      return;
    }
    input.value = "";
    // Message TOUJOURS le meme (anti-enumeration, voir addFriendByUsername cote site) : ne dit
    // jamais si le pseudo existait vraiment ou etait deja ami — seul le rafraichissement de la
    // liste ci-dessous dira si ca a marche.
    feedbackEl.textContent = t("friends.addFeedback");
    feedbackEl.hidden = false;
    await refreshFriends();
  });

  listEl.addEventListener("click", async (event) => {
    const removeBtn = event.target.closest(".friends-item-remove");
    if (!removeBtn) return;
    removeBtn.disabled = true;
    await window.mchub.friends.remove(removeBtn.dataset.id);
    await refreshFriends();
  });
}

// Heartbeat de presence : greffe sur le cycle de 60s existant (scheduleRefresh(sendPresenceHeartbeat)
// plus bas, meme intervalle que silentRefreshList — REFRESH_INTERVAL_MS), jamais un intervalle a
// part. Echec silencieux (voir presence:heartbeat cote main.js, qui ne rejette jamais) : un
// heartbeat rate ne fait que retarder le passage "hors ligne" d'un ami, jamais a signaler au joueur.
async function sendPresenceHeartbeat() {
  if (!signedIn) return;
  await window.mchub.sendPresenceHeartbeat();
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

// Accueil (voir "01b Home" dans Design/archive/2026-09-23/Omniscient Launcher
// Mockups.dc.html — retire par megarde du dernier export, mais toujours voulu) —
// sans le bandeau "a la une" (lie au futur systeme payant, voir memoire
// project_page_builder) ni les actualites (aucun systeme de contenu a
// publier dessus pour l'instant) : uniquement ce qui vient de donnees deja
// disponibles localement — dernier serveur joue, favoris, et un apercu de
// "Mes instances" pour les proprietaires.
function homeContinueCardHtml(server) {
  return `
    <div class="home-continue-card" data-slug="${escapeHtml(server.slug)}" role="button" tabindex="0">
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
          <span class="badge"${server.frozenAt ? " style=\"color:#8ac3e0;border-color:#8ac3e0\"" : ""}>${t(`myInstances.${instanceBadgeKey(status, server)}`)}</span>
          ${verificationBadgeHtml(server)}
        </div>
        <p>${instanceStatusLineHtml(server, status)}</p>
      </div>
    </div>`;
}

async function showHomeView() {
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
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
  homePanelEl.innerHTML = `
    <h2 style="margin-bottom: 18px;">${t("home.greeting", { name: escapeHtml(currentProfile ? currentProfile.name : "") })}</h2>
    ${skeletonListHtml(2)}`;

  const [settings, favoriteSlugs, myServersResult] = await Promise.all([
    window.mchub.settings.get(),
    getFavoriteSlugs(),
    currentProfile ? window.mchub.listMyServers() : Promise.resolve({ ok: false, servers: [] }),
  ]);

  const continueServer = settings.lastPlayedSlug ? (await resolveServersBySlug([settings.lastPlayedSlug]))[0] : null;
  const favoriteServers = favoriteSlugs.length > 0 ? await resolveServersBySlug(favoriteSlugs.slice(0, 4)) : [];
  const myServers = myServersResult.ok ? myServersResult.servers.slice(0, 4) : [];

  homePanelEl.innerHTML = `
    <h2 style="margin-bottom: 18px;">${t("home.greeting", { name: escapeHtml(currentProfile ? currentProfile.name : "") })}</h2>
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
    // Desactivation synchrone AVANT tout await (meme principe que le bouton
    // "Rejoindre" de la fiche detail) : sans ca, un double-clic rapide peut
    // lancer deux fois avant que launchInProgress ne soit leve (§3.13).
    playBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!continueServer || playBtn.disabled) return;
      playBtn.disabled = true;
      try {
        await launchServer(continueServer);
      } finally {
        playBtn.disabled = false;
      }
    });
  }
  const continueCard = homePanelEl.querySelector(".home-continue-card");
  if (continueCard) {
    onRowActivate(continueCard, () => {
      detailOrigin = "home";
      openDetail(continueCard.dataset.slug);
    });
  }

  const favoritesListEl = document.getElementById("home-favorites-list");
  if (favoritesListEl) {
    favoritesListEl.querySelectorAll(".row").forEach((row) => {
      onRowActivate(row, () => {
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
// Un slug absent de l'annuaire public n'est pas forcement supprime : un serveur prive rejoint
// par code, en pause, ou gele n'y figure pas non plus (voir /api/public/servers). On ne le
// confirme vraiment mort qu'avec un servers:get individuel (notFound=true, vrai 404) — seul ce
// cas justifie de le retirer des favoris/recents (voir pruneDeadSlug ci-dessous), sinon on
// garde l'ancien placeholder plutot que de perdre une fiche encore valide a tort.
async function resolveServersBySlug(slugs) {
  const result = await fetchServerList();
  const allServers = result.ok ? result.servers : [];
  const resolved = await Promise.all(
    slugs.map(async (slug) => {
      const found = allServers.find((s) => s.slug === slug);
      if (found) return found;
      const single = await window.mchub.getServer(slug);
      if (single.ok) return single.server;
      if (single.notFound) {
        await pruneDeadSlug(slug);
        return null;
      }
      return { slug, name: slug, description: "", type: "vanilla", playerCount: null, playerCapacity: null, bannerUrl: null };
    }),
  );
  return resolved.filter((s) => s !== null);
}

async function pruneDeadSlug(slug) {
  const settings = await window.mchub.settings.get();
  const favoriteServers = (settings.favoriteServers || []).filter((s) => s !== slug);
  const recentlyPlayed = (settings.recentlyPlayed || []).filter((s) => s !== slug);
  await window.mchub.settings.set({ favoriteServers, recentlyPlayed });
}

async function showFavoritesView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
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

  favoritesPanelEl.className = "server-list";
  favoritesPanelEl.innerHTML = `
    <h2>${t("nav.favorites")}</h2>
    <p class="join-note">${t("favorites.header")}</p>
    ${skeletonListHtml(favorites.length)}`;

  const favoriteServers = await resolveServersBySlug(favorites);
  favoritesPanelEl.innerHTML = `
    <h2>${t("nav.favorites")}</h2>
    <p class="join-note">${t("favorites.header")}</p>
    <div class="list-rows server-list"></div>`;
  await renderRowsInto(favoritesPanelEl.querySelector(".list-rows"), favoriteServers, "favorites", renderFavoritesList);
}

async function showRecentView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
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

  recentPanelEl.className = "server-list";
  recentPanelEl.innerHTML = `
    <h2>${t("nav.recent")}</h2>
    <p class="join-note">${t("recent.header")}</p>
    ${skeletonListHtml(recentSlugs.length)}`;

  const recentServers = await resolveServersBySlug(recentSlugs);
  recentPanelEl.innerHTML = `
    <h2>${t("nav.recent")}</h2>
    <p class="join-note">${t("recent.header")}</p>
    <div class="list-rows server-list"></div>`;
  await renderRowsInto(recentPanelEl.querySelector(".list-rows"), recentServers, "recent", renderRecentList);
}

// "Mes instances" : tous les serveurs du proprietaire connecte (publies OU
// en pause), retrouves via son UUID Minecraft (le meme compte Microsoft que sur
// le site, plus aucune liaison a faire). Rendu dedie plutot que serverRowHtml/
// openDetail : contrairement a la liste publique, ces serveurs peuvent etre
// en pause (donc absents de /api/public/servers/[slug], qui 404 dessus).
// La configuration (republier, changer la visibilite...) se fait toujours
// sur le site — jamais depuis une carte ici.
let myInstancesServers = [];
let myInstancesFilter = "all";
// Pagination : une dizaine de cartes a la fois, sinon un compte avec beaucoup de serveurs
// rendrait la page interminable a faire defiler.
let myInstancesPage = 1;
const MY_INSTANCES_PAGE_SIZE = 10;
// Pour le bouton "copier le lien d'invitation" (voir instanceStatusLineHtml) —
// resolu une fois au demarrage, largement avant qu'on affiche "Mes instances".
let siteUrl = "";
window.mchub.getSiteUrl().then((url) => { siteUrl = url; });

// Onglet "Rejoint" : serveurs prives rejoints via le code/lien de quelqu'un
// d'autre (voir settingsStore.joinedServers / servers:listJoined cote main) —
// une liste independante de myInstancesServers (les serveurs POSSEDES),
// jamais fusionnee avec elle ni comptee dans le filtre "Tout".
let myJoinedServers = [];

function instanceStatus(server) {
  if (!server.published) return "paused";
  return server.isPrivate ? "private" : "public";
}

function instanceBadgeKey(status, server) {
  if (server.frozenAt) return "badgeFrozen";
  return status === "public" ? "badgePublic" : status === "private" ? "badgePrivate" : "badgePaused";
}

// Petit tag additionnel accole au badge principal (Public/Privé/En pause),
// jamais a sa place : un serveur publie mais pas encore valide par un admin
// (verificationStatus, voir site/src/lib/verification.ts) n'est pas reellement
// joignable par les joueurs malgre le toggle "publie" du proprietaire, donc on
// l'indique en plus plutot qu'en remplacement de "Public". Rendu avec la meme
// classe .instance-badge que le badge principal (voir index.html) pour rester
// coherent avec le style existant, juste une variante de couleur en plus.
function verificationBadgeHtml(server) {
  if (server.frozenAt) return "";
  if (server.verificationStatus === "pending") {
    return `<span class="instance-badge verification-pending">${t("myInstances.badgePendingVerification")}</span>`;
  }
  if (server.verificationStatus === "rejected") {
    return `<span class="instance-badge verification-rejected">${t("myInstances.badgeRejectedVerification")}</span>`;
  }
  return "";
}

// Partagee entre la carte de "Mes instances" et la ligne compacte de
// l'accueil (voir homeInstanceRowHtml) — le seul endroit qui decide quoi
// afficher a la place du nombre de joueurs pour un serveur prive/en pause.
function instanceStatusLineHtml(server, status) {
  if (status === "paused" && server.frozenAt) {
    return `<span class="status-dot" style="background:#8ac3e0"></span><span style="color:#8ac3e0">${t("myInstances.frozenLine")}</span>`;
  }
  if (!server.frozenAt && server.verificationStatus === "pending") {
    return `<span class="status-dot" style="background:var(--warn)"></span><span style="color:var(--warn)">${t("myInstances.pendingLine")}</span>`;
  }
  if (!server.frozenAt && server.verificationStatus === "rejected") {
    return `<span class="status-dot" style="background:var(--danger)"></span><span style="color:var(--danger)">${t("myInstances.rejectedLine")}</span>`;
  }
  if (status === "paused") return `<span class="status-dot"></span>${t("myInstances.hiddenNote")}`;
  if (status !== "private") return playersLabel(server);
  const label = t("myInstances.inviteCodeLabel", { code: `<code>${escapeHtml(server.inviteCode || "")}</code>` });
  return `${label} <button type="button" class="icon-btn copy-invite-link" data-code="${escapeHtml(server.inviteCode || "")}" title="${t("myInstances.copyInviteLink")}" aria-label="${t("myInstances.copyInviteLink")}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  </button>`;
}

// Visible seulement pour un serveur que le proprietaire peut encore faire passer en public
// (prive, pas gele, pas encore teste avec succes) — une fois public ou deja teste, plus rien
// a prouver, le bouton disparait plutot que de rester affiche pour rien (voir le brief :
// "hide/disable [...] once the test has already passed, or once the server is already
// public"). Jamais pour un serveur gele : lancer le jeu echouerait (voir game:launch, erreur
// "frozen"), inutile d'offrir un test qui ne peut pas marcher.
function canSelfTest(server) {
  return !server.frozenAt && server.isPrivate && !server.selfTestPassedAt;
}

function instanceCardHtml(server) {
  const status = instanceStatus(server);
  const badgeKey = instanceBadgeKey(status, server);
  const statusLine = instanceStatusLineHtml(server, status);

  return `
    <div class="instance-card" data-slug="${escapeHtml(server.slug)}">
      <span class="instance-card-icon">${serverIconInner(server)}</span>
      <div class="instance-card-body">
        <div class="instance-card-title">
          <h3>${escapeHtml(server.name)}</h3>
          <span class="instance-badge ${server.frozenAt ? "frozen" : status}">${t(`myInstances.${badgeKey}`)}</span>
          ${verificationBadgeHtml(server)}
        </div>
        <p>${t(server.type === "modded" ? "serverCard.modded" : "serverCard.vanilla")} · ${escapeHtml(server.minecraftVersion)} · ${escapeHtml(server.ip)}</p>
        ${status === "public" && server.verificationStatus === "approved" ? "" : `<div class="instance-card-status">${statusLine}</div>`}
      </div>
      <div class="instance-card-actions">
        ${canSelfTest(server) ? `<button type="button" class="btn-secondary my-instance-selftest" data-slug="${escapeHtml(server.slug)}">${t("myInstances.selfTestButton")}</button>` : ""}
        ${status !== "paused" ? `<button type="button" class="btn-secondary my-instance-play" data-slug="${escapeHtml(server.slug)}">${t("myInstances.joinShort")}</button>` : ""}
        <button type="button" class="btn-secondary my-instance-channel" data-slug="${escapeHtml(server.slug)}">${t("myInstances.channelButton")}</button>
        <button type="button" class="btn-secondary my-instance-manage" data-id="${escapeHtml(server.id)}">${t("myInstances.manage")} ↗</button>
      </div>
    </div>`;
}

// Carte d'un serveur prive rejoint via le code/lien de quelqu'un d'autre
// (onglet "Rejoint") — fiche PUBLIQUE seulement (meme forme que servers:get,
// voir site/src/lib/public-servers.ts/getPublicServerBySlug) : pas d'id, pas
// d'ip, pas de published/isPrivate a lire comme sur les cartes "Mes
// instances" possedees (instanceCardHtml, voir instanceStatus) — ce joueur
// n'est pas proprietaire, donc jamais de bouton "Gerer" ; "Quitter" a la
// place, qui retire juste l'entree locale (voir settingsStore.joinedServers).
function joinedCardHtml(server) {
  return `
    <div class="instance-card" data-slug="${escapeHtml(server.slug)}">
      <span class="instance-card-icon">${serverIconInner(server)}</span>
      <div class="instance-card-body">
        <div class="instance-card-title">
          <h3>${escapeHtml(server.name)}</h3>
          <span class="instance-badge private">${t("myInstances.badgeJoined")}</span>
        </div>
        <p>${t(server.type === "modded" ? "serverCard.modded" : "serverCard.vanilla")} · ${escapeHtml(server.minecraftVersion)}</p>
      </div>
      <div class="instance-card-actions">
        <button type="button" class="btn-secondary my-instance-play" data-slug="${escapeHtml(server.slug)}">${t("myInstances.joinShort")}</button>
        <button type="button" class="btn-secondary my-instance-channel" data-slug="${escapeHtml(server.slug)}">${t("myInstances.channelButton")}</button>
        <button type="button" class="btn-secondary my-instance-leave" data-slug="${escapeHtml(server.slug)}">${t("myInstances.leave")}</button>
      </div>
    </div>`;
}

const INSTANCE_FILTERS = ["all", "public", "private", "paused"];

function instancesToolbarHtml(servers, joinedCount, pagerHtml = "") {
  const counts = { all: servers.length, public: 0, private: 0, paused: 0 };
  servers.forEach((server) => counts[instanceStatus(server)]++);
  const chipHtml = (filter, count) => {
    const labelKey = `filter${filter.charAt(0).toUpperCase()}${filter.slice(1)}`;
    return `<button type="button" class="sort-chip${filter === myInstancesFilter ? " active" : ""}" data-filter="${filter}">${t(`myInstances.${labelKey}`)}<span class="count">${count}</span></button>`;
  };

  // "Rejoint" s'intercale entre "Tout" et "Public" — jamais compte dans
  // counts.all, qui reste uniquement les serveurs que ce joueur POSSEDE.
  const chips = [chipHtml("all", counts.all), chipHtml("joined", joinedCount), ...INSTANCE_FILTERS.slice(1).map((f) => chipHtml(f, counts[f]))].join("");

  // Le pager (si fourni) s'affiche a droite de cette meme rangee, plutot
  // qu'en bas de la grille — voir topPagerHtml().
  return `
    <div class="instances-toolbar">
      <div class="instances-filters">${chips}</div>
      ${pagerHtml}
    </div>`;
}

// Petite fenetre "Rejoindre" (reutilise le modal de confirmation) : demande le
// code, le resout cote site (joinServerByCode dans main.js), puis l'ajoute aux
// serveurs rejoints. Reste ouverte avec le message d'erreur tant que le code
// est refuse ; annuler ferme sans rien faire.
function askJoinCode(errorMessage) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modal-overlay");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const checkboxRow = document.getElementById("modal-checkbox-row");
    const bodyEl = document.getElementById("modal-body");

    document.getElementById("modal-title").textContent = t("myInstances.joinByCodeLabel");
    bodyEl.textContent = errorMessage || t("myInstances.joinByCodeHelp");
    bodyEl.style.color = errorMessage ? "var(--danger)" : "";
    checkboxRow.hidden = true;
    confirmBtn.textContent = t("myInstances.joinByCodeSubmit");
    cancelBtn.hidden = false;
    cancelBtn.textContent = t("common.cancel");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "settings-input";
    input.placeholder = t("myInstances.joinByCodePlaceholder");
    input.style.width = "100%";
    input.style.marginTop = "12px";
    bodyEl.after(input);
    overlay.hidden = false;
    input.focus();

    const cleanup = () => {
      overlay.hidden = true;
      bodyEl.style.color = "";
      input.remove();
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKey);
    };
    const onConfirm = () => {
      const code = input.value.trim();
      if (!code) return;
      cleanup();
      resolve(code);
    };
    const onCancel = () => {
      cleanup();
      resolve(null);
    };
    const onKey = (event) => {
      if (event.key === "Enter") onConfirm();
    };
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKey);
  });
}

// Reglages d'une instance (petite fenetre "Reglages", Mes instances, 2026-10-13) — structures
// en LISTE plutot qu'en champs fixes : chaque reglage sait lui-meme s'il s'applique au serveur
// courant (appliesTo) et comment se charger/s'enregistrer (load/save), pour qu'un futur reglage
// s'ajoute a ce tableau sans reecrire la fenetre ni son flux (openInstanceSettingsModal
// ci-dessous). Canal du modpack (reserve au PROPRIETAIRE d'un serveur modde, voir
// servers:getChannel/setChannel) et, depuis le point 9, suivi de statut (ouvert a TOUTE
// instance — possedee ou rejointe — voir servers:getWatch/setWatch dans main.js).
const INSTANCE_SETTINGS_FIELDS = [
  {
    id: "modpackChannel",
    appliesTo: (server, ctx) => ctx.owned && server.type === "modded",
    load: (server) => window.mchub.getServerChannel(server.slug).then((r) => (r.ok ? { ok: true, value: r.modpackChannel } : r)),
    save: (server, value) => window.mchub.setServerChannel(server.slug, value),
    renderHtml: (value) => `
      <div style="margin-top:12px;text-align:left;">
        <label for="instance-setting-modpackChannel" style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px;">${t("channelSettings.channelFieldLabel")}</label>
        <select id="instance-setting-modpackChannel" class="settings-input" style="width:100%;">
          <option value="release" ${value === "beta" ? "" : "selected"}>${t("channelSettings.release")}</option>
          <option value="beta" ${value === "beta" ? "selected" : ""}>${t("channelSettings.beta")}</option>
        </select>
      </div>`,
    readValue: () => document.getElementById("instance-setting-modpackChannel").value,
  },
  // Point 9 : case decochee par defaut, s'applique a TOUTE instance (possedee ou rejointe),
  // pas seulement les favoris existants — un seul declencheur pour l'instant (hors ligne ->
  // en ligne, voir /api/cron/process-instance-watch), jamais le pic de joueurs ni le modpack
  // mis a jour (reportes a plus tard).
  {
    id: "notifyOnStatusChange",
    appliesTo: () => true,
    load: (server) => window.mchub.getServerWatch(server.slug).then((r) => (r.ok ? { ok: true, value: r.notifyOnStatusChange } : r)),
    save: (server, value) => window.mchub.setServerWatch(server.slug, value),
    renderHtml: (value) => `
      <div style="margin-top:12px;text-align:left;">
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
          <input type="checkbox" id="instance-setting-notifyOnStatusChange" ${value ? "checked" : ""} style="margin-top:2px;" />
          <span>${t("channelSettings.watchFieldLabel")}</span>
        </label>
        <p style="font-size:12px;color:var(--muted);margin:4px 0 0 24px;">${t("channelSettings.watchFieldHelp")}</p>
      </div>`,
    readValue: () => document.getElementById("instance-setting-notifyOnStatusChange").checked,
  },
];

// Petite fenetre "Reglages" d'une instance (reutilise le modal de confirmation generique, meme
// pattern que askJoinCode ci-dessus) : charge les reglages applicables (voir appliesTo/load de
// chaque champ ci-dessus), les affiche via INSTANCE_SETTINGS_FIELDS, et les enregistre sur
// confirmation. Distincte du bouton "Gerer" (openManageServer), qui continue d'ouvrir le site
// dans le navigateur. `owned` : true pour une instance de l'onglet "Tout"/possedee (filtre
// appliesTo du canal modpack), false pour une instance "Rejoint" — ce joueur n'en est jamais
// proprietaire, voir joinedCardHtml.
async function openInstanceSettingsModal(server, { owned = true } = {}) {
  const overlay = document.getElementById("modal-overlay");
  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn = document.getElementById("modal-cancel");
  const checkboxRow = document.getElementById("modal-checkbox-row");
  const bodyEl = document.getElementById("modal-body");

  const fields = INSTANCE_SETTINGS_FIELDS.filter((field) => field.appliesTo(server, { owned }));

  document.getElementById("modal-title").textContent = t("channelSettings.title", { name: server.name });
  checkboxRow.hidden = true;
  bodyEl.textContent = t("channelSettings.loading");
  bodyEl.style.color = "";
  cancelBtn.hidden = false;
  cancelBtn.textContent = t("common.cancel");
  confirmBtn.hidden = true;
  overlay.hidden = false;

  const cleanup = () => {
    overlay.hidden = true;
    bodyEl.style.color = "";
    confirmBtn.hidden = false;
    confirmBtn.disabled = false;
    document.getElementById("instance-settings-fields")?.remove();
  };

  const currentValues = {};
  for (const field of fields) {
    const result = await field.load(server);
    if (!result.ok) {
      bodyEl.textContent = result.error || t("channelSettings.loadError");
      bodyEl.style.color = "var(--danger)";
      cancelBtn.textContent = t("common.close");
      await new Promise((resolve) => {
        const onCancel = () => {
          cancelBtn.removeEventListener("click", onCancel);
          cleanup();
          resolve();
        };
        cancelBtn.addEventListener("click", onCancel);
      });
      return;
    }
    currentValues[field.id] = result.value;
  }

  // La description du canal du modpack ne s'applique qu'a ce reglage precis — vide sinon (le
  // texte d'aide de la case de suivi, juste en dessous d'elle, suffit dans ce cas).
  bodyEl.textContent = fields.some((field) => field.id === "modpackChannel") ? t("channelSettings.description") : "";
  const fieldsContainer = document.createElement("div");
  fieldsContainer.id = "instance-settings-fields";
  fieldsContainer.innerHTML = fields.map((field) => field.renderHtml(currentValues[field.id])).join("");
  bodyEl.after(fieldsContainer);

  confirmBtn.hidden = false;
  confirmBtn.textContent = t("channelSettings.save");
  overlay.querySelector(".modal-box").classList.add("pop-in");

  await new Promise((resolve) => {
    const onConfirm = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = t("channelSettings.saving");
      const values = Object.fromEntries(fields.map((field) => [field.id, field.readValue()]));
      for (const field of fields) {
        const save = await field.save(server, values[field.id]);
        if (!save.ok) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = t("channelSettings.save");
          bodyEl.textContent = save.error || t("channelSettings.saveError");
          bodyEl.style.color = "var(--danger)";
          return;
        }
      }
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      cleanup();
      resolve();
    };
    const onCancel = () => {
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      cleanup();
      resolve();
    };
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
  });
}

// Boucle "Rejoindre" : redemande le code tant que le site le refuse, avec le
// message d'erreur dans la meme fenetre. Un succes met a jour l'onglet Rejoint.
async function joinByCodeFlow() {
  let error = null;
  for (;;) {
    const code = await askJoinCode(error);
    if (code === null) return;
    const result = await window.mchub.joinServerByCode(code);
    if (result.ok) {
      const listed = await window.mchub.listJoinedServers();
      myJoinedServers = listed.ok ? listed.servers : myJoinedServers;
      myInstancesFilter = "joined";
      myInstancesPage = 1;
      renderMyInstancesGrid();
      return;
    }
    error = result.error;
  }
}

// Generique : utilise par "Mes instances" et par la liste publique des serveurs (voir
// renderFilteredList) — chaque appelant fournit sa propre page courante et ses propres id
// de boutons, pour ne jamais confondre les deux pagers (tous deux presents dans le DOM a la
// fois, un seul visible a la fois). Rendu compact (‹ page/total ›) pense pour s'inserer a
// droite d'une rangee de filtres existante, plutot qu'en bas de liste.
function topPagerHtml(page, pageCount, idPrefix) {
  if (pageCount <= 1) return "";
  return `
    <div class="top-pager" id="${idPrefix}">
      <button type="button" class="btn-secondary" id="${idPrefix}-prev" ${page <= 1 ? "disabled" : ""} aria-label="${t("myInstances.pagerPrevious")}">‹</button>
      <span class="pager-label">${t("myInstances.pagerPage", { page: String(page), count: String(pageCount) })}</span>
      <button type="button" class="btn-secondary" id="${idPrefix}-next" ${page >= pageCount ? "disabled" : ""} aria-label="${t("myInstances.pagerNext")}">›</button>
    </div>`;
}

function renderMyInstancesGrid() {
  const all =
    myInstancesFilter === "joined"
      ? myJoinedServers
      : myInstancesFilter === "all"
        ? myInstancesServers
        : myInstancesServers.filter((server) => instanceStatus(server) === myInstancesFilter);

  const pageCount = Math.max(1, Math.ceil(all.length / MY_INSTANCES_PAGE_SIZE));
  myInstancesPage = Math.min(Math.max(1, myInstancesPage), pageCount);
  const filtered = all.slice((myInstancesPage - 1) * MY_INSTANCES_PAGE_SIZE, myInstancesPage * MY_INSTANCES_PAGE_SIZE);

  myInstancesPanelEl.innerHTML = `
    <div class="instances-header">
      <div>
        <h2>${t("nav.myInstances")}</h2>
        <p class="join-note">${t("myInstances.subtitle")}</p>
      </div>
      <button type="button" class="btn-secondary" id="my-instances-join">${t("myInstances.joinButton")}</button>
    </div>
    ${instancesToolbarHtml(myInstancesServers, myJoinedServers.length, topPagerHtml(myInstancesPage, pageCount, "my-instances-pager"))}
    ${
      all.length === 0
        ? `<p class="join-note">${t("myInstances.filterEmpty")}</p>`
        : `<div class="instance-grid">${filtered.map((server) => (myInstancesFilter === "joined" ? joinedCardHtml(server) : instanceCardHtml(server))).join("")}</div>`
    }
  `;

  document.getElementById("my-instances-join").addEventListener("click", joinByCodeFlow);

  document.getElementById("my-instances-pager-prev")?.addEventListener("click", () => {
    myInstancesPage -= 1;
    renderMyInstancesGrid();
  });
  document.getElementById("my-instances-pager-next")?.addEventListener("click", () => {
    myInstancesPage += 1;
    renderMyInstancesGrid();
  });

  myInstancesPanelEl.querySelectorAll(".instances-filters .sort-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      myInstancesFilter = btn.dataset.filter;
      myInstancesPage = 1;
      renderMyInstancesGrid();
    });
  });

  myInstancesPanelEl.querySelectorAll(".my-instance-play").forEach((btn) => {
    // Desactivation synchrone AVANT tout await (meme principe que le bouton
    // "Rejoindre" de la fiche detail) : sans ca, un double-clic rapide peut
    // lancer deux fois avant que launchInProgress ne soit leve (§3.13).
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (btn.disabled) return;
      const pool = myInstancesFilter === "joined" ? myJoinedServers : myInstancesServers;
      const server = pool.find((s) => s.slug === btn.dataset.slug);
      if (!server) return;
      btn.disabled = true;
      try {
        await launchServer(server);
      } finally {
        btn.disabled = false;
      }
    });
  });

  myInstancesPanelEl.querySelectorAll(".my-instance-selftest").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const server = myInstancesServers.find((s) => s.slug === btn.dataset.slug);
      if (!server) return;
      await runSelfTestFlow(server);
      // Le test peut avoir change selfTestPassedAt (succes rapporte) : on recharge pour que le
      // bouton disparaisse et que le badge reflete le nouvel etat (voir canSelfTest ci-dessus).
      await renderMyInstancesList();
    });
  });

  myInstancesPanelEl.querySelectorAll(".copy-invite-link").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      // Meme principe que settings-copy-log/settings-copy-sysinfo (Parametres > Debogage) :
      // un retour visuel temporaire plutot qu'un clic qui ne montre rien.
      try {
        await navigator.clipboard.writeText(`${siteUrl}/join/${btn.dataset.code}`);
        const originalHtml = btn.innerHTML;
        const originalTitle = btn.title;
        btn.innerHTML = ICON_CHECK;
        btn.title = t("myInstances.linkCopied");
        btn.setAttribute("aria-label", t("myInstances.linkCopied"));
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.title = originalTitle;
          btn.setAttribute("aria-label", originalTitle);
        }, 1500);
      } catch {
        // Presse-papiers indisponible — pas bloquant pour une simple commodite.
      }
    });
  });

  myInstancesPanelEl.querySelectorAll(".my-instance-channel").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      // Le bouton "Reglages" existe maintenant aussi sur les cartes "Rejoint" (point 9, suivi
      // de statut ouvert a toute instance) — on cherche dans les deux pools, jamais les deux a
      // la fois (un meme slug n'apparait que dans un seul des deux).
      const owned = myInstancesServers.some((s) => s.slug === btn.dataset.slug);
      const server = owned ? myInstancesServers.find((s) => s.slug === btn.dataset.slug) : myJoinedServers.find((s) => s.slug === btn.dataset.slug);
      if (!server) return;
      openInstanceSettingsModal(server, { owned });
    });
  });

  myInstancesPanelEl.querySelectorAll(".my-instance-manage").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      window.mchub.openManageServer(btn.dataset.id);
    });
  });

  myInstancesPanelEl.querySelectorAll(".my-instance-leave").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const { confirmed } = await showModal({
        title: t("myInstances.leave"),
        body: t("myInstances.leaveConfirm"),
        confirmLabel: t("myInstances.leave"),
        cancelLabel: t("common.cancel"),
      });
      if (!confirmed) return;
      const result = await window.mchub.leaveJoinedServer(btn.dataset.slug);
      if (!result.ok) {
        // Pas de mutation optimiste si l'appel IPC a echoue : la carte doit
        // rester telle quelle plutot que de faire croire a un depart reussi.
        await showModal({ tone: "danger", title: t("myInstances.leave"), body: t("myInstances.leaveError"), confirmLabel: t("common.close") });
        return;
      }
      myJoinedServers = myJoinedServers.filter((s) => s.slug !== btn.dataset.slug);
      renderMyInstancesGrid();
    });
  });
}

async function showMyInstancesView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
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

function myInstancesSkeletonHtml() {
  const card = `<div class="sk-card"><div class="sk-bar"></div><div class="sk-body"><div class="sk-line" style="height:14px;width:60%;"></div><div class="sk-line" style="height:11px;width:80%;"></div><div class="sk-line" style="height:30px;width:100%;margin-top:6px;"></div></div></div>`;
  return `
    <div class="instances-header">
      <div>
        <h2>${t("nav.myInstances")}</h2>
        <p class="join-note">${t("myInstances.subtitle")}</p>
      </div>
    </div>
    <div class="instance-grid" aria-busy="true">${card.repeat(3)}</div>`;
}

// Carte "disponible hors ligne" (2026-10-12) : pas la meme forme qu'instanceCardHtml, qui
// attend un objet serveur complet (ip, published, isPrivate...) venu du site — une instance
// locale (voir instances:listInstalled cote main.js) n'a que { slug, type, minecraftVersion,
// modpackName }. Pas d'icone personnalisee possible hors ligne (iconUrl vient du site), donc
// toujours la pastille-initiale ; pas de bouton "Gerer" (il ouvrirait le site) ni "Rejoindre"
// (demande une session) — juste "Jouer en solo", qui passe par game:launchOffline.
function offlineInstanceCardHtml(instance) {
  const title = instance.modpackName || instance.slug;
  return `
    <div class="instance-card" data-slug="${escapeHtml(instance.slug)}">
      <span class="instance-card-icon">${serverInitial(title)}</span>
      <div class="instance-card-body">
        <div class="instance-card-title">
          <h3>${escapeHtml(title)}</h3>
          <span class="instance-badge offline-available">${t("myInstances.badgeOfflineAvailable")}</span>
        </div>
        <p>${t(instance.type === "modded" ? "serverCard.modded" : "serverCard.vanilla")} · ${escapeHtml(instance.minecraftVersion)}</p>
      </div>
      <div class="instance-card-actions">
        <button type="button" class="btn-secondary my-instance-play-offline" data-slug="${escapeHtml(instance.slug)}">${t("myInstances.playOffline")}</button>
      </div>
    </div>`;
}

function renderOfflineInstancesGrid(instances) {
  myInstancesPanelEl.className = "instances-view";
  myInstancesPanelEl.innerHTML = `
    <div class="instances-header">
      <div>
        <h2>${t("nav.myInstances")}</h2>
        <p class="join-note">${t("myInstances.offlineSubtitle")}</p>
      </div>
    </div>
    ${
      instances.length === 0
        ? `<p class="join-note">${t("myInstances.offlineEmpty")}</p>`
        : `<div class="instance-grid">${instances.map(offlineInstanceCardHtml).join("")}</div>`
    }
  `;

  myInstancesPanelEl.querySelectorAll(".my-instance-play-offline").forEach((btn) => {
    // Meme garde synchrone qu'ailleurs (my-instance-play, playbar) : desactive avant tout await.
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (btn.disabled) return;
      const instance = instances.find((i) => i.slug === btn.dataset.slug);
      if (!instance) return;
      btn.disabled = true;
      try {
        await launchOfflineInstance(instance);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// Lancement solo hors ligne (2026-10-12) : variante de launchServer() sans les etapes qui ne
// s'appliquent qu'en ligne (attemptSignIn, applyRecommendedRamIfNeeded — une instance locale
// n'a pas de recommendedRamGB venu du site). Reutilise la meme barre de progression du bas
// (playbar) pour rester visuellement coherent avec un lancement normal.
async function launchOfflineInstance(instance) {
  if (launchInProgress) return null;
  launchInProgress = true;

  const label = document.getElementById("playbar-progress-label");
  const percentEl = document.getElementById("playbar-progress-percent");
  const fill = document.getElementById("playbar-progress-fill");

  fill.classList.remove("error");
  fill.style.width = "0%";
  percentEl.textContent = "";
  label.textContent = t("playbar.launchingServer", { name: instance.modpackName || instance.slug });
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

  const result = await window.mchub.playOfflineServer(instance.slug);
  stopListening();
  launchInProgress = false;

  if (result.ok) {
    fill.style.width = "100%";
    percentEl.textContent = "";
    label.textContent = t("playbar.launched");
    setTimeout(() => {
      setPlaybarBusy(false);
      launchStarting = true;
      syncPlaybarWithGame();
      setTimeout(() => {
        launchStarting = false;
        syncPlaybarWithGame();
      }, 60_000);
    }, 1800);
  } else {
    fill.classList.add("error");
    label.textContent = result.error;
    setTimeout(() => setPlaybarBusy(false), 4000);
  }

  return result;
}

async function renderMyInstancesList() {
  if (!currentProfile) {
    // Pas de session Microsoft active (2026-10-12) : probablement hors ligne, ou simplement
    // pas encore connecte. Avant, cet ecran se contentait d'un message "connecte-toi" meme si
    // des instances etaient deja installees sur le disque (bug confirme : rien n'etait propose
    // au joueur sans internet alors qu'il pouvait deja jouer en solo). On regarde maintenant ce
    // qui est reellement installe localement (instances:listInstalled, lecture disque seule,
    // jamais le site) et on l'affiche a la place, avec un bouton "Jouer en solo" dedie
    // (launchOfflineInstance) plutot que le bouton "Rejoindre" habituel (qui exige une session).
    myInstancesPanelEl.className = "instances-view";
    myInstancesPanelEl.innerHTML = myInstancesSkeletonHtml();
    const localResult = await window.mchub.listLocalInstances();
    renderOfflineInstancesGrid(localResult.ok ? localResult.instances : []);
    return;
  }

  myInstancesPanelEl.className = "instances-view";
  myInstancesPanelEl.innerHTML = myInstancesSkeletonHtml();

  const [ownedResult, joinedResult] = await Promise.all([window.mchub.listMyServers(), window.mchub.listJoinedServers()]);
  if (!ownedResult.ok) {
    const authFailed = ownedResult.status === 401;
    myInstancesPanelEl.className = "detail";
    myInstancesPanelEl.innerHTML = `
      <h2>${t("nav.myInstances")}</h2>
      <p class="join-note" role="alert">${t(authFailed ? "myInstances.loginRequired" : "myInstances.loadError")}</p>
      ${authFailed ? "" : `<button type="button" class="join-btn" id="my-instances-retry">${t("myInstances.retry")}</button>`}
    `;
    document.getElementById("my-instances-retry")?.addEventListener("click", () => renderMyInstancesList());
    return;
  }
  myInstancesServers = ownedResult.servers;
  myJoinedServers = joinedResult.ok ? joinedResult.servers : [];

  // Toujours "Tout" a l'ouverture (meme sans aucun serveur possede ni rejoint
  // : l'onglet "Rejoint" doit rester atteignable pour entrer un code).
  myInstancesFilter = "all";
  myInstancesPage = 1;
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
  listTitleEl.hidden = true;
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

function renderLanguageTab(contentEl, settings, { restartPending = false } = {}) {
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
      ${restartPending ? `<p class="join-note">${t("language.restartNeeded")}</p><button type="button" class="join-btn" id="settings-restart-btn">${t("language.restartButton")}</button>` : ""}
    </section>
  `;

  contentEl.querySelectorAll(".lang-list-row[data-locale]").forEach((row) => {
    row.addEventListener("click", async () => {
      const locale = row.dataset.locale;
      if (locale === settings.locale) return;
      await window.mchub.settings.set({ locale });
      renderLanguageTab(contentEl, { ...settings, locale }, { restartPending: true });
    });
  });

  document.getElementById("settings-restart-btn")?.addEventListener("click", () => window.mchub.restartApp());
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
      <label class="settings-row" style="cursor: pointer; margin-top: 10px;">
        <span class="settings-row-label">${t("settings.alwaysCustom")}</span>
        <input type="checkbox" id="settings-always-custom" ${settings.alwaysUseCustomRam ? "checked" : ""} />
      </label>
    </section>
    <button id="settings-save-memory" class="join-btn" type="button" style="align-self: flex-start;">${t("settings.saveChanges")}</button>
    <p class="join-note" id="settings-status"></p>
  `;

  // Les deux cases sont exclusives : cocher l'une decoche l'autre.
  const alwaysRecommendedEl = document.getElementById("settings-always-recommended");
  const alwaysCustomEl = document.getElementById("settings-always-custom");
  alwaysRecommendedEl.addEventListener("change", () => {
    if (alwaysRecommendedEl.checked) alwaysCustomEl.checked = false;
  });
  alwaysCustomEl.addEventListener("change", () => {
    if (alwaysCustomEl.checked) alwaysRecommendedEl.checked = false;
  });

  document.getElementById("settings-save-memory").addEventListener("click", async () => {
    const min = Number(document.getElementById("settings-mem-min").value);
    const max = Number(document.getElementById("settings-mem-max").value);
    const settingsStatusEl = document.getElementById("settings-status");
    const updated = await window.mchub.settings.set({
      memoryMinGB: min,
      memoryMaxGB: max,
      alwaysUseRecommendedRam: alwaysRecommendedEl.checked,
      alwaysUseCustomRam: alwaysCustomEl.checked,
    });
    settingsStatusEl.classList.remove("ms-error");
    settingsStatusEl.textContent = t("settings.saved");
    renderMemoryTab(contentEl, { ...settings, ...updated });
    flashSavedButton(document.getElementById("settings-save-memory"));
  });
}

// Confirmation visuelle : le bouton passe au vert « Enregistré ✓ » pendant un instant.
function flashSavedButton(btn) {
  if (!btn) return;
  const label = btn.textContent;
  btn.textContent = t("settings.savedButton");
  btn.style.background = "color-mix(in srgb, #5fd3a0 22%, transparent)";
  btn.style.borderColor = "#5fd3a0";
  btn.style.color = "#5fd3a0";
  setTimeout(() => {
    btn.textContent = label;
    btn.style.background = "";
    btn.style.borderColor = "";
    btn.style.color = "";
  }, 1800);
}

function renderMiscTab(contentEl, settings, { betaPending = false } = {}) {
  contentEl.innerHTML = `
    <section class="settings-section">
      <div>
        <div class="settings-row-label">${t("settings.javaLabel")}</div>
        <p class="join-note" id="settings-java-status" style="margin-top: 6px;">${t("common.checking")}</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
          <button id="settings-java-install" class="btn-secondary" type="button" hidden>${t("java.installAuto")}</button>
          <button id="settings-java-repair" class="btn-danger" type="button">${t("java.repair")}</button>
        </div>
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
        <span class="join-note">${settings.appVersion ? `v${settings.appVersion.split("-")[0]}` : "—"}</span>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">${t("settings.betaVersion")}</span>
        <span class="join-note">${settings.appVersion && settings.appVersion.includes("-beta") ? `v${settings.appVersion}` : "—"}</span>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-row">
        <span>
          <span class="settings-row-label">${t("settings.betaChannel")}</span>
          <p class="settings-row-desc">${t("settings.betaChannelDesc")}</p>
        </span>
        <input type="checkbox" id="settings-beta-channel" ${settings.betaChannel ? "checked" : ""} />
      </div>
      ${betaPending ? `<p class="join-note">${t("settings.betaRestartNote")}</p><button type="button" class="join-btn" id="settings-beta-restart-btn">${t("language.restartButton")}</button>` : ""}
    </section>
  `;

  document.getElementById("settings-open-folder").addEventListener("click", () => {
    window.mchub.settings.openGameFolder();
  });
  document.getElementById("settings-beta-channel").addEventListener("change", async (event) => {
    await window.mchub.settings.set({ betaChannel: event.target.checked });
    renderMiscTab(contentEl, { ...settings, betaChannel: event.target.checked }, { betaPending: true });
  });
  document.getElementById("settings-beta-restart-btn")?.addEventListener("click", () => window.mchub.restartApp());
  refreshJavaStatus("settings-java-status", "settings-java-install");

  // "Reparer Java" : supprime les Java du launcher puis reinstalle les quatre.
  const javaStatusEl = document.getElementById("settings-java-status");
  const javaInstallBtn = document.getElementById("settings-java-install");
  const javaRepairBtn = document.getElementById("settings-java-repair");
  javaRepairBtn.addEventListener("click", async () => {
    javaRepairBtn.disabled = true;
    javaInstallBtn.disabled = true;
    const stopListening = window.mchub.onJavaInstallProgress((status) => {
      javaStatusEl.textContent = status;
    });
    javaStatusEl.textContent = t("common.checking");
    const result = await window.mchub.java.repair();
    stopListening();
    javaRepairBtn.disabled = false;
    javaInstallBtn.disabled = false;
    if (result.ok) refreshJavaStatus("settings-java-status", "settings-java-install");
    else javaStatusEl.textContent = t("java.repairFailed", { error: result.error });
  });
}

// Partagé entre le verrou Java obligatoire et les paramètres : verifie Java
// (voir javaManager.js — 64 bits requis pour allouer beaucoup de mémoire) et
// affiche un bouton d'installation automatique si besoin. `onReady` est
// appelé dès que Java est détecté OK (tout de suite, ou juste après une
// installation réussie) — utilisé par le verrou pour débloquer le launcher.
// `defaultOnly` (verrou de demarrage) : ne concerne que le Java 21 par defaut, les
// autres versions se telechargent au lancement d'un serveur qui en a besoin.
async function refreshJavaStatus(statusElId, installBtnId, { onReady, defaultOnly = false } = {}) {
  const statusEl2 = document.getElementById(statusElId);
  const installBtn = document.getElementById(installBtnId);
  statusEl2.textContent = t("common.checking");
  installBtn.hidden = true;

  const java = await window.mchub.java.detect();
  // Minecraft utilise un Java different selon sa version (8, 17, 21, 25) : on signale
  // ceux qui manquent, meme si le Java par defaut est bon, avec le bouton pour les installer.
  const missing = defaultOnly ? [] : [8, 17, 21, 25].filter((major) => java.installed && !java.installed[major]);
  if (java.found && java.is64Bit && java.meetsMinimum) {
    const detected = java.version ? t("java.detectedWithVersion", { version: java.version }) : t("java.detectedNoVersion");
    statusEl2.textContent = missing.length ? `${detected} ${t("java.missingOthers", { list: missing.join(", ") })}` : detected;
    installBtn.hidden = missing.length === 0;
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
    const result = await window.mchub.java.install(defaultOnly ? [21] : undefined);
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
// RAM comprise), donc on attend qu'il soit pret avant d'entrer dans l'appli —
// a chaque demarrage, pas seulement au premier lancement.
// Installation silencieuse (2026-10-11, audit onboarding) : reste dans le
// petit ecran de demarrage deja visible (meme barre de progression que la
// verification de mise a jour juste avant), aucune page dediee tant que ca
// fonctionne. Cet ecran dedie (javaGateEl) ne sert plus qu'au cas d'echec
// reel, pour laisser un moyen de reessayer plutot que rester bloque.
async function ensureJavaAvailable() {
  const initial = await window.mchub.java.detect();
  // Seul le Java par defaut (21+) verrouille le demarrage : les autres (8, 17, 25) sont
  // telecharges au lancement d'un serveur qui en a besoin, ou via le bouton des Reglages.
  if (initial.found && initial.is64Bit && initial.meetsMinimum) return;

  const stopListening = window.mchub.onJavaInstallProgress((status) => {
    bootstrapStatusEl.textContent = status;
  });
  const result = await window.mchub.java.install([21]);
  stopListening();

  if (result.ok) return;

  // Echec reel seulement : la, et seulement la, on sort de la petite fenetre
  // du bootstrap pour montrer l'ecran dedie avec un bouton pour reessayer.
  await window.mchub.windowControls.expandFromBootstrap();
  bootstrapEl.hidden = true;
  document.body.classList.remove("bootstrapping");
  javaGateEl.hidden = false;
  await new Promise((resolve) => {
    refreshJavaStatus("java-gate-status", "java-gate-install", {
      defaultOnly: true,
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
  listTitleEl.hidden = true;
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
      const result = await window.mchub.account.remove(id);
      if (!result.ok) {
        // Pas de mutation optimiste si l'appel IPC a echoue : le compte
        // reste affiche dans la liste plutot que de disparaitre a tort.
        listStatusEl.textContent = t("account.forgetError");
        listStatusEl.classList.add("ms-error");
        return;
      }
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
  if (!launchInProgress && !gamePlaying && !launchStarting) playBtn.disabled = false;
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
    if (!selectedFavoriteSlug || playBtn.disabled) return;
    // Desactivation synchrone AVANT le premier await (meme principe que le bouton
    // "Rejoindre" de la fiche detail) : sans ca, un double-clic rapide peut relancer
    // getServer()/launchServer() une seconde fois avant que launchInProgress ne soit
    // leve (§3.13). syncPlaybarWithGame() reprend ensuite la main sur l'etat du bouton.
    playBtn.disabled = true;
    try {
      const result = await window.mchub.getServer(selectedFavoriteSlug);
      // Si la fiche ne charge pas (serveur gelé, par exemple), on tente quand même : le launcher
      // affichera la raison exacte renvoyée par le site au lieu de ne rien faire.
      await launchServer(result.ok ? result.server : { slug: selectedFavoriteSlug, name: selectedFavoriteSlug });
    } finally {
      syncPlaybarWithGame();
    }
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
function showModal({ title, body, confirmLabel, cancelLabel, checkboxLabel, tone, stripeColor }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modal-overlay");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const checkboxRow = document.getElementById("modal-checkbox-row");
    const checkbox = document.getElementById("modal-checkbox");

    document.getElementById("modal-title").textContent = title;
    // Couleur du titre : celle du type de message diffuse si fournie, sinon rouge pour une
    // alerte critique (ex. RAM au-delà de 80 % de la machine), sinon la couleur par defaut.
    document.getElementById("modal-title").style.color = stripeColor || (tone === "danger" ? "var(--danger)" : "");
    document.getElementById("modal-body").textContent = body;
    confirmBtn.textContent = confirmLabel;
    cancelBtn.hidden = !cancelLabel;
    cancelBtn.textContent = cancelLabel || "";
    checkboxRow.hidden = !checkboxLabel;
    document.getElementById("modal-checkbox-label").textContent = checkboxLabel || "";
    checkbox.checked = false;

    const modalBox = overlay.querySelector(".modal-box");
    modalBox.classList.add("pop-in");
    modalBox.style.borderTopColor = stripeColor || "";
    overlay.hidden = false;
    // Filet de securite : coupe les clics sur le reste de l'appli tant que cette modale est
    // ouverte, independamment du z-index (voir le commentaire CSS sur body.modal-blocking).
    document.body.classList.add("modal-blocking");

    const cleanup = () => {
      overlay.hidden = true;
      document.body.classList.remove("modal-blocking");
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

// Les 3 controles de l'auto-test de publication (voir main.js/selftest:run), dans l'ordre ou
// ils se resolvent — chaque clé correspond au `step` envoyé par les évènements
// "selftest:progress". Le 4e controle ("Connexion au serveur") a ete retire le 2026-10-11 :
// intestable de maniere fiable pour le moment.
const SELF_TEST_STEPS = [
  { key: "reachable", labelKey: "selfTest.stepReachable" },
  { key: "modpack", labelKey: "selfTest.stepModpack" },
  { key: "gameStarted", labelKey: "selfTest.stepGameStarted" },
];

function selfTestStepRowHtml(step, status, detail) {
  // "pending" (avant son tour) reste gris, sans icone — seules les lignes "running"/"pass"/
  // "fail"/"skipped" ont une icone (sablier/coche/croix/tiret), comme le reste de la checklist
  // en direct. "skipped" (étape jamais atteinte car une étape précédente a échoué ou le test a
  // été annulé) est volontairement distinct de "fail" (étape réellement testée et ratée) :
  // sinon un simple échec d'IP affichait à tort "tout échoué" comme si chaque contrôle avait
  // individuellement rate, alors que les suivants n'ont jamais tourné (constate le 2026-10-10).
  const icon =
    status === "pass"
      ? `<span style="color:var(--success);">✅</span>`
      : status === "fail"
        ? `<span style="color:var(--danger);">❌</span>`
        : status === "running"
          ? `<span class="status-dot" style="background:var(--warn);"></span>`
          : status === "skipped"
            ? `<span style="color:var(--muted);">—</span>`
            : `<span class="status-dot"></span>`;
  const statusText =
    status === "pass"
      ? t("selfTest.statusPass")
      : status === "fail"
        ? t("selfTest.statusFail")
        : status === "running"
          ? t("selfTest.statusRunning")
          : status === "skipped"
            ? t("selfTest.statusSkipped")
            : "";
  const color = status === "pass" ? "var(--success)" : status === "fail" ? "var(--danger)" : "var(--muted)";
  // Check #1 ("IP joignable") : affiche la latence mesurée par le ping quand il réussit —
  // un chiffre concret plutot qu'un simple pass/fail. Voir mcPing.js pour la mesure (pingMs).
  const label =
    step.key === "reachable" && status === "pass" && typeof detail?.pingMs === "number"
      ? t("selfTest.stepReachableWithPing", { ms: detail.pingMs })
      : t(step.labelKey);
  return `
    <div style="display:flex;align-items:center;gap:10px;font-size:13.5px;" data-selftest-step="${step.key}">
      ${icon}
      <span style="flex:1;">${escapeHtml(label)}</span>
      <span style="color:${color};font-size:12.5px;">${escapeHtml(statusText)}</span>
    </div>`;
}

function renderSelfTestChecklist(statuses, details) {
  document.getElementById("selftest-checklist").innerHTML = SELF_TEST_STEPS.map((step) =>
    selfTestStepRowHtml(step, statuses[step.key] || "pending", details?.[step.key]),
  ).join("");
}

// Corrige le bug "en cours… / le test a échoué" (checklist bloquée) : quel que soit le
// chemin de sortie du test (annulation via "Annuler le test", ou n'importe quel check qui
// échoue avant que les suivants aient démarré), TOUT contrôle qui
// n'a pas atteint un état terminal ("pass"/"fail") au moment où le test se conclut est
// explicitement force a "skipped" (jamais laisse visuellement bloque sur "en cours…" ou
// "pending") — "skipped" plutot que "fail" pour ne pas laisser croire que ce controle a ete
// teste et a rate, alors qu'il n'a simplement jamais demarre (voir selfTestStepRowHtml). Un
// seul point d'entree, reutilise pour la fin normale du test ET pour l'annulation.
function finalizeSelfTestStatuses(statuses) {
  for (const step of SELF_TEST_STEPS) {
    if (statuses[step.key] !== "pass" && statuses[step.key] !== "fail") {
      statuses[step.key] = "skipped";
    }
  }
  return statuses;
}

// "Tester pour publication" (Mes instances) : ouvre la checklist, lance le test (qui démarre
// réellement le jeu — voir main.js/selftest:run), met les 3 lignes à jour en direct via les
// évènements "selftest:progress", puis propose d'envoyer le résultat au site si les 3
// contrôles sont réussis. Résout seulement à la fermeture de la fenêtre (jamais en arrière-
// plan : un test concurrent avec un lancement normal n'est pas permis, voir
// selfTestInProgress côté main.js).
function runSelfTestFlow(server) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("selftest-overlay");
    const actionsEl = document.getElementById("selftest-actions");
    const outcomeEl = document.getElementById("selftest-outcome");
    const errorEl = document.getElementById("selftest-error");

    document.getElementById("selftest-title").textContent = t("selfTest.title", { name: server.name });
    document.getElementById("selftest-intro").textContent = t("selfTest.intro");
    outcomeEl.hidden = true;
    errorEl.hidden = true;
    actionsEl.innerHTML = "";

    const statuses = { reachable: "pending", modpack: "pending", gameStarted: "pending", connection: "pending" };
    const details = {};
    renderSelfTestChecklist(statuses, details);

    overlay.hidden = false;
    document.body.classList.add("modal-blocking");

    const closeBtn = (label, onClick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "join-btn";
      btn.textContent = label;
      btn.addEventListener("click", onClick);
      return btn;
    };

    const finish = () => {
      stopListening();
      overlay.hidden = true;
      document.body.classList.remove("modal-blocking");
      resolve();
    };

    const stopListening = window.mchub.onSelfTestProgress((progress) => {
      if (!progress || !progress.step) return;
      statuses[progress.step] = progress.status;
      details[progress.step] = progress.detail;
      renderSelfTestChecklist(statuses, details);
    });

    // "Annuler le test" : visible seulement pendant que le test tourne (retiré dès que le
    // résultat arrive, succès/échec/erreur confondus). Demande l'annulation côté main.js
    // (selftest:abort) — la checklist et le résumé "test échoué" se mettent à jour tout
    // seuls quand window.mchub.runSelfTest() se résout ensuite, exactement comme pour un
    // échec normal : pas de chemin séparé, voir finalizeSelfTestStatuses().
    const abortBtn = document.createElement("button");
    abortBtn.type = "button";
    abortBtn.className = "btn-secondary";
    abortBtn.textContent = t("selfTest.abortButton");
    abortBtn.addEventListener("click", async () => {
      abortBtn.disabled = true;
      abortBtn.textContent = t("selfTest.aborting");
      await window.mchub.abortSelfTest();
    });
    actionsEl.appendChild(abortBtn);

    (async () => {
      const result = await window.mchub.runSelfTest(server.slug);
      abortBtn.remove();

      if (!result.ok) {
        finalizeSelfTestStatuses(statuses);
        renderSelfTestChecklist(statuses, details);
        errorEl.textContent = result.code === "busy" ? t("selfTest.alreadyRunning") : t("selfTest.runError", { error: result.error });
        errorEl.hidden = false;
        actionsEl.appendChild(closeBtn(t("selfTest.close"), finish));
        return;
      }

      // Forcé en dernier recours : que le test se soit conclu normalement ou via "Annuler le
      // test", aucune ligne ne doit rester affichée "en cours…" une fois que ce résumé
      // "réussi"/"échoué" est affiché.
      finalizeSelfTestStatuses(statuses);
      renderSelfTestChecklist(statuses, details);
      outcomeEl.hidden = false;

      if (result.allPassed) {
        outcomeEl.textContent = `${t("selfTest.allPassedTitle")} ${t("selfTest.allPassedBody")}`;
        const submitBtn = closeBtn(t("selfTest.submit"), async () => {
          submitBtn.disabled = true;
          submitBtn.textContent = t("selfTest.submitting");
          const report = await window.mchub.reportSelfTest({
            slug: server.slug,
            checks: result.checks,
            detectedVersion: result.detectedVersion,
          });
          if (report.ok && report.passed) {
            outcomeEl.textContent = t("selfTest.submitted");
            actionsEl.innerHTML = "";
            actionsEl.appendChild(closeBtn(t("selfTest.close"), finish));
          } else {
            errorEl.textContent = t("selfTest.submitError");
            errorEl.hidden = false;
            submitBtn.disabled = false;
            submitBtn.textContent = t("selfTest.submit");
          }
        });
        actionsEl.appendChild(submitBtn);
        actionsEl.appendChild(closeBtn(t("selfTest.close"), finish));
      } else {
        outcomeEl.textContent = `${t("selfTest.somePassedTitle")} ${t("selfTest.somePassedBody")}`;
        actionsEl.appendChild(closeBtn(t("selfTest.close"), finish));
      }
    })();
  });
}

// Applique la RAM suggeree sans rien demander (2026-10-11, audit onboarding) :
// la premiere fenetre qui forcait a confirmer min/max a ete retiree, les
// valeurs calculees par main.js (voir getSystemMemoryInfo) suffisent dans
// l'immense majorite des cas, et restent modifiables dans Parametres > Jeu.
async function applyDefaultRamSilently(settings) {
  await window.mchub.settings.set({
    memoryMinGB: settings.suggestedMinGB,
    memoryMaxGB: settings.suggestedMaxGB,
    onboarded: true,
  });
}

// Connexion Microsoft declenchee a la demande (2026-10-11, audit onboarding) :
// plus de portail bloquant avant meme de voir l'annuaire — voir boot() et
// launchServer(). Reutilisee par le bouton "Se connecter" invite et par le
// clic sur "Jouer" quand le joueur n'est pas encore connecte.
let signInCountdownTimer = null;

async function attemptSignIn(remember) {
  const result = await window.mchub.signIn(remember);
  if (result.ok) {
    enterApp(result.profile, { rememberFailed: result.rememberFailed });
    return true;
  }
  // Echec ou approbation en attente : seul cas ou l'ancien ecran de connexion
  // reapparait, pour afficher l'erreur et permettre de reessayer.
  appEl.hidden = true;
  gateEl.hidden = false;
  setGateBusy(false);
  gateMessageEl.textContent = result.pendingApproval ? t("gate.pendingApproval") : result.error;
  gateMessageEl.classList.toggle("ms-error", !result.pendingApproval);

  if (signInCountdownTimer) clearInterval(signInCountdownTimer);
  const countdownEl = document.getElementById("gate-countdown");
  // Pas pour "approbation en attente" (2026-10-11) : cet etat n'est pas un
  // simple echec/annulation (fenetre Microsoft fermee sans se connecter) —
  // il reste affiche tant que le compte n'est pas approuve, pas de retour
  // auto au mode visiteur qui ferait croire a tort que c'est regle.
  if (result.pendingApproval) {
    countdownEl.hidden = true;
    return false;
  }

  // Retour automatique en mode visiteur apres un echec (2026-10-11) : rester
  // bloque sur l'ancien ecran de connexion casserait le principe de
  // navigation libre — le joueur peut toujours relancer la connexion plus
  // tard, au clic sur "Jouer" ou sur "Se connecter" en Parametres.
  let remaining = 5;
  countdownEl.hidden = false;
  const tick = () => {
    countdownEl.textContent = t("gate.backToGuestIn", { seconds: remaining });
    if (remaining <= 0) {
      clearInterval(signInCountdownTimer);
      signInCountdownTimer = null;
      if (!gateEl.hidden) {
        // Rien a refaire du cote de la vue precedente : elle est restee dans
        // le DOM, juste cachee derriere #gate (voir launchServer()) — on la
        // redecouvre telle quelle en revelant simplement #app.
        gateEl.hidden = true;
        appEl.hidden = false;
        renderGuestHeader();
      }
      return;
    }
    remaining--;
  };
  tick();
  signInCountdownTimer = setInterval(tick, 1000);
  // Le joueur retente lui-meme pendant le compte a rebours : ne pas lui
  // fermer l'ecran de connexion sous le nez pendant qu'il s'authentifie.
  gateLoginBtn.addEventListener(
    "click",
    () => {
      if (signInCountdownTimer) {
        clearInterval(signInCountdownTimer);
        signInCountdownTimer = null;
      }
      countdownEl.hidden = true;
    },
    { once: true },
  );
  return false;
}

// Barre laterale quand personne n'est connecte : pas de bouton "Se connecter"
// ici (un texte ne tient pas dans cet espace de 56px prevu pour une icone
// ronde ; la connexion se declenche d'elle-meme au clic sur "Jouer", voir
// launchServer()/attemptSignIn()). "Parametres" prend la place de l'avatar
// absent (2026-10-11, retour utilisateur : le laisser dans sa position
// habituelle laissait un trou vide a la toute fin de la sidebar) plutot que
// de laisser cet espace reserve a l'avatar completement vide.
function renderGuestHeader() {
  navSettingsBtn.hidden = true;
  // Amis = necessite un compte Microsoft (comme Parametres ci-dessus) : rien a afficher pour
  // un visiteur sans session.
  navFriendsBtn.closest(".friends-menu").hidden = true;
  msAccountEl.innerHTML = `
    <button id="ms-account-settings" class="sidebar-btn" data-i18n-title="nav.settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  `;
  document.getElementById("ms-account-settings").addEventListener("click", showSettingsView);
  window.i18n.applyStaticI18n(msAccountEl);
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
  wireTasksMenu();
  wireNotifications();
  wireFriends();
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

  // Plus de verification/installation de Java au demarrage (2026-10-11) :
  // ensureJavaForMajor() (javaManager.js) resout et installe deja la version
  // exacte requise au moment reel du lancement d'un serveur (main.js,
  // game:launch) — rien a faire tant qu'on ne clique pas sur "Jouer".
  // ensureJavaAvailable() ci-dessus (helper du bootstrap) n'a donc plus
  // d'appelant ; laisse en place au cas ou un verrou au demarrage redevienne
  // utile, mais volontairement plus appele ici.

  bootstrapStatusEl.textContent = t("bootstrap.resumingSession");
  bootstrapProgressEl.style.width = "85%";

  // Sortie de la petite fenetre de demarrage vers la taille normale de
  // l'appli — sans effet si ensureJavaAvailable() l'a deja fait juste avant
  // (setSize/setResizable/setMinimumSize sont idempotents cote main.js).
  await window.mchub.windowControls.expandFromBootstrap();

  document.body.classList.remove("bootstrapping");

  if (!settings.onboarded) {
    await applyDefaultRamSilently(settings);
  }

  bootstrapEl.hidden = true;
  await ensureNotInMaintenance();

  // Connexion differee (2026-10-11, audit onboarding) : une reprise de
  // session silencieuse est tentee, mais on ne bloque plus sur l'ecran de
  // connexion si elle echoue — l'annuaire reste parcourable sans compte.
  // Voir attemptSignIn() pour le moment ou la connexion est reellement
  // demandee (clic sur "Jouer").
  const restored = await window.mchub.tryRestoreSession();
  if (restored.ok) {
    enterApp(restored.profile);
    return;
  }

  gateEl.hidden = true;
  appEl.hidden = false;
  renderGuestHeader();
  // L'annuaire plutot que l'accueil : l'accueil (carte "Continuer", favoris)
  // n'a rien a montrer a un visiteur sans historique de connexion.
  showServersView();
}

boot();

// Modèle "polling" retenu pour le MVP (cahier des charges, section 3) :
// pas de WebSocket, juste un rafraîchissement régulier en arrière-plan.
// Ne touche à rien si le joueur est sur une page de détail, et reste
// silencieux en cas d'échec (on ne veut pas interrompre l'utilisateur
// pour un ping raté en tâche de fond).
const REFRESH_INTERVAL_MS = 60_000;

async function silentRefreshList() {
  if (!signedIn || listEl.hidden) return;
  const result = await fetchServerList({ force: true });
  if (result.ok) renderList(result.servers);
}

// Pendant une partie, on interroge moins souvent (le launcher reste ouvert pour
// la console de debug). Le delai est relu a chaque tour.
const REFRESH_PLAYING_INTERVAL_MS = 300_000;
let gamePlaying = false;
let launchStarting = false;
window.mchub.onGameState((running) => {
  gamePlaying = running;
  // Que le jeu demarre ou s'arrete, "en cours de demarrage" n'est plus vrai.
  launchStarting = false;
  syncPlaybarWithGame();
});

function scheduleRefresh(task, baseMs = REFRESH_INTERVAL_MS) {
  const tick = async () => {
    await task();
    setTimeout(tick, gamePlaying ? REFRESH_PLAYING_INTERVAL_MS : baseMs);
  };
  setTimeout(tick, baseMs);
}

scheduleRefresh(silentRefreshList);
// Notifications : toutes les 5 minutes (chaque appel interroge la base du site).
scheduleRefresh(refreshNotifications, 300_000);
scheduleRefresh(checkMaintenanceLoop, 120_000);
// Presence (systeme d'amis) : MEME valeur de cycle que silentRefreshList ci-dessus
// (REFRESH_INTERVAL_MS, 60s) — greffe dessus comme demande, pas un nouvel intervalle ni celui
// des notifications (qui est a 5 min, pas 30s comme un ancien commentaire le pretendait a
// tort). Delibérément PAS via scheduleRefresh() : ce helper ralentit a
// REFRESH_PLAYING_INTERVAL_MS (5 min) pendant une partie, ce qui est le bon choix pour la liste
// de serveurs (pas besoin de la rafraichir pendant que le joueur est en jeu) mais serait exactement
// le mauvais choix ici — un ami en train de JOUER est le cas ou on veut le plus montrer "en
// ligne", pas le laisser passer "hors ligne" apres 2 min (ONLINE_WINDOW_MS cote site) faute de
// heartbeat. setInterval direct, jamais ralenti, jamais arrete.
setInterval(sendPresenceHeartbeat, REFRESH_INTERVAL_MS);
