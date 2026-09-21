const gateEl = document.getElementById("gate");
const gateMessageEl = document.getElementById("gate-message");
const gateLoginBtn = document.getElementById("gate-login");
const appEl = document.getElementById("app");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");
const msAccountEl = document.getElementById("ms-account");
const settingsPanelEl = document.getElementById("settings-panel");
const accountPanelEl = document.getElementById("account-panel");
const favoritesPanelEl = document.getElementById("favorites-panel");
const recentPanelEl = document.getElementById("recent-panel");
const javaGateEl = document.getElementById("java-gate");
const navServersBtn = document.getElementById("nav-servers");
const navFavoritesBtn = document.getElementById("nav-favorites");
const navRecentBtn = document.getElementById("nav-recent");
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
    ? '<span class="badge modded">Moddé</span>'
    : '<span class="badge">Vanilla</span>';
}

function playersText(server) {
  if (server.playerCount === null || server.playerCount === undefined) {
    return "Statut inconnu";
  }
  const capacity = server.playerCapacity !== null && server.playerCapacity !== undefined
    ? ` / ${server.playerCapacity}`
    : "";
  return `${server.playerCount} joueur${server.playerCount === 1 ? "" : "s"} en ligne${capacity}`;
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
    <button class="favorite-btn${extraClass ? ` ${extraClass}` : ""}${isFav ? " active" : ""}" type="button" data-slug="${escapeHtml(slug)}" title="${isFav ? "Retirer des favoris" : "Ajouter aux favoris"}">
      ${STAR_SVG}
    </button>`;
}

// Carte serveur partagee entre la liste principale, "Favoris" et "Recents" —
// meme rendu partout, seule la source de la liste de serveurs change.
function serverCardHtml(server, isFav) {
  return `
    <div class="card" data-slug="${escapeHtml(server.slug)}">
      <div class="banner">
        ${server.bannerUrl ? `<img src="${escapeHtml(server.bannerUrl)}" alt="" />` : ""}
        ${favoriteBtnHtml(server.slug, isFav)}
        ${typeBadge(server.type)}
      </div>
      <div class="card-body">
        <div class="card-title-row">
          <span class="server-icon">${serverIconInner(server)}</span>
          <h3>${escapeHtml(server.name)}</h3>
        </div>
        <p>${escapeHtml(server.description || "")}</p>
        <div class="players">${playersLabel(server)}</div>
      </div>
    </div>`;
}

async function renderList(servers) {
  detailEl.hidden = true;
  listEl.hidden = false;

  if (servers.length === 0) {
    listEl.innerHTML = "";
    statusEl.hidden = false;
    statusEl.textContent = "Aucun serveur publié pour le moment.";
    return;
  }

  statusEl.hidden = true;
  const favorites = await getFavoriteSlugs();
  listEl.innerHTML = servers.map((server) => serverCardHtml(server, favorites.includes(server.slug))).join("");

  listEl.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => {
      detailOrigin = "servers";
      openDetail(card.dataset.slug);
    });
  });
  listEl.querySelectorAll(".favorite-btn").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleFavorite(btn.dataset.slug);
      await refreshPlaybarFavorites();
      renderList(servers);
    });
  });
}

async function renderDetail(server) {
  listEl.hidden = true;
  statusEl.hidden = true;
  detailEl.hidden = false;

  const tags = [`<span class="tag-chip">${server.type === "modded" ? "Moddé" : "Vanilla"}</span>`];
  if (server.type === "modded" && server.curseforgeModpackName) {
    const version = server.curseforgeModpackVersion ? ` — ${escapeHtml(server.curseforgeModpackVersion)}` : "";
    tags.push(`<span class="tag-chip">${escapeHtml(server.curseforgeModpackName)}${version}</span>`);
  }

  // signedIn est toujours vrai ici (le portail bloque l'accès sans connexion),
  // mais on garde le garde-fou par prudence. La progression de lancement ne
  // s'affiche plus ici — voir launchServer()/la barre de lancement rapide.
  const joinSection = signedIn
    ? `<button class="join-btn" id="join-btn">▶ Rejoindre le serveur</button>`
    : `
      <button class="join-btn" disabled>▶ Rejoindre le serveur</button>
      <p class="join-note">Connecte-toi avec ton compte Microsoft pour rejoindre ce serveur.</p>
    `;

  const isFav = (await getFavoriteSlugs()).includes(server.slug);

  detailEl.innerHTML = `
    <button class="back">&larr; Retour à la liste</button>
    <div class="detail-banner">
      ${server.bannerUrl ? `<img src="${escapeHtml(server.bannerUrl)}" alt="" />` : ""}
      <div class="detail-icon">${serverIconInner(server)}</div>
    </div>
    <div class="detail-header">
      <div style="display: flex; align-items: center; gap: 10px;">
        <h2 style="margin: 0;">${escapeHtml(server.name)}</h2>
        ${favoriteBtnHtml(server.slug, isFav, "detail-favorite-btn")}
      </div>
      <p class="meta">${playersLabel(server)}</p>
    </div>
    <div class="stat-row">
      <div class="stat-tile">
        <div class="stat-label">Version</div>
        <div class="stat-value">${escapeHtml(server.minecraftVersion)}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-label">Joueurs</div>
        <div class="stat-value">${escapeHtml(playersText(server))}</div>
      </div>
      ${
        server.recommendedRamGB
          ? `<div class="stat-tile">
              <div class="stat-label">RAM recommandée</div>
              <div class="stat-value">${server.recommendedRamGB} Go</div>
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
  // Au-dela de 80% de la RAM totale, il ne resterait quasiment rien pour
  // l'OS et le reste du systeme — on refuse d'appliquer la valeur telle
  // quelle, meme si "toujours utiliser la RAM recommandée" est coché.
  const isUnsafe = recommended > settings.totalGB * 0.8;

  if (isUnsafe) {
    const fallbackMaxGB = Math.max(1, Math.floor(settings.totalGB / 2));
    const fallbackMinGB = Math.max(1, Math.floor(fallbackMaxGB / 2));
    const result = await showModal({
      title: "RAM recommandée trop élevée pour cette machine",
      body: `Ce serveur recommande ${recommended} Go de RAM, mais cette machine n'a que ${settings.totalGB} Go au total. Le jeu va démarrer avec ${fallbackMaxGB} Go à la place (la moitié de la RAM totale) — au-delà, attends-toi à des latences, des bugs ou des plantages.`,
      confirmLabel: "Continuer quand même",
      cancelLabel: "Annuler",
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
    title: "RAM recommandée pour ce serveur",
    body: `Ce serveur recommande ${recommended} Go de RAM. Lancer le jeu avec cette valeur ?`,
    confirmLabel: `Lancer avec ${recommended} Go`,
    cancelLabel: "Garder mes paramètres actuels",
    checkboxLabel: "Toujours lancer avec la RAM recommandée du serveur",
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
  label.textContent = `Lancement de ${server.name}…`;
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
    label.textContent = "Jeu lancé — fenêtre séparée ouverte.";

    // Historique de lancement (dernier joue, compteur par serveur, liste des
    // derniers joues) — sert au menu rapide de la barre de lancement (voir
    // refreshPlaybarFavorites) et a la page "Recents" de la barre laterale.
    const settings = await window.mchub.settings.get();
    const playCounts = { ...(settings.playCounts || {}) };
    playCounts[server.slug] = (playCounts[server.slug] || 0) + 1;
    const recentlyPlayed = [server.slug, ...(settings.recentlyPlayed || []).filter((s) => s !== server.slug)].slice(0, 10);
    await window.mchub.settings.set({ playCounts, lastPlayedSlug: server.slug, recentlyPlayed });
    await refreshPlaybarFavorites();

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
  joinBtn.textContent = "Lancement…";

  const result = await launchServer(server);

  if (result && result.ok) {
    joinBtn.textContent = "Jeu lancé";
    return;
  }

  joinBtn.disabled = false;
  joinBtn.textContent = "▶ Rejoindre le serveur";
}

async function openDetail(slug) {
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  statusEl.hidden = false;
  statusEl.classList.remove("error");
  statusEl.textContent = "Chargement…";

  const result = await window.mchub.getServer(slug);
  if (!result.ok) {
    statusEl.classList.add("error");
    statusEl.textContent = `Impossible de charger ce serveur : ${result.error}`;
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
  statusEl.textContent = "Chargement des serveurs…";
  detailEl.hidden = true;
  listEl.hidden = true;

  // Toujours un aller-retour reseau ici : c'est le point d'entree explicite
  // "l'utilisateur veut voir la liste a jour" (nav, connexion, rafraichissement
  // silencieux) — mais il alimente au passage le cache ci-dessus pour la
  // barre de lancement rapide.
  const result = await fetchServerList({ force: true });
  if (!result.ok) {
    statusEl.classList.add("error");
    statusEl.textContent = `Impossible de contacter le site Omniscient : ${result.error}`;
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
        ${rememberFailed ? '<p class="ms-error account-dropdown-note">Session non mémorisée</p>' : ""}
        <button id="manage-account" class="ms-login account-dropdown-signout" type="button">Gérer le compte</button>
        <button id="sign-out" class="ms-login account-dropdown-signout" type="button">Se déconnecter</button>
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
  loadServers();
  refreshPlaybarFavorites();
}

const PENDING_APPROVAL_MESSAGE =
  "Connexion Microsoft OK — en attente de validation par Microsoft pour l'accès Minecraft.";

function wireGate() {
  gateLoginBtn.addEventListener("click", async () => {
    const remember = document.getElementById("gate-remember").checked;
    setGateBusy(true);
    gateMessageEl.textContent = "Connexion en cours…";
    gateMessageEl.classList.remove("ms-error");

    const result = await window.mchub.signIn(remember);

    if (result.ok) {
      enterApp(result.profile, { rememberFailed: result.rememberFailed });
      return;
    }

    setGateBusy(false);

    if (result.pendingApproval) {
      gateMessageEl.textContent = PENDING_APPROVAL_MESSAGE;
      return;
    }

    gateMessageEl.textContent = result.error;
    gateMessageEl.classList.add("ms-error");
  });
}

// Barre de titre custom (fenêtre sans cadre natif, voir main.js) : les
// boutons appellent l'IPC exposé par preload.js plutôt que des raccourcis
// natifs, puisqu'il n'y a plus de barre système pour les fournir.
function wireWindowControls() {
  document.getElementById("win-min").addEventListener("click", () => window.mchub.windowControls.minimize());
  document.getElementById("win-close").addEventListener("click", () => window.mchub.windowControls.close());

  const maxBtn = document.getElementById("win-max");
  maxBtn.addEventListener("click", () => window.mchub.windowControls.toggleMaximize());

  const RESTORE_ICON =
    '<svg viewBox="0 0 10 10"><rect x="2" y="0.5" width="7" height="7" fill="none" stroke="currentColor" /><rect x="0.5" y="2.5" width="7" height="7" fill="rgba(15,23,41,0.92)" stroke="currentColor" /></svg>';
  const MAXIMIZE_ICON = '<svg viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" /></svg>';
  const setMaximizedIcon = (isMaximized) => {
    maxBtn.innerHTML = isMaximized ? RESTORE_ICON : MAXIMIZE_ICON;
  };

  window.mchub.windowControls.isMaximized().then(setMaximizedIcon);
  window.mchub.windowControls.onMaximizedChange(setMaximizedIcon);
}

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
const MC_STATUS_LABEL = { ok: "OK", degraded: "Dégradé", offline: "Hors ligne" };

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
        <span class="mc-status-row-latency">${s.latencyMs !== null ? `${s.latencyMs} ms` : MC_STATUS_LABEL[s.state]}</span>
      </div>`,
    )
    .join("");
}

async function loadMcStatus() {
  mcStatusList.innerHTML = '<div class="mc-status-row">Vérification…</div>';
  const services = await window.mchub.getMinecraftStatus();
  renderMcStatus(services);
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
  // Vérifié dès le démarrage (avant même la connexion) pour que le point
  // ait une vraie couleur sans attendre un clic.
  loadMcStatus();
}

// Cloche de notifications : juste le bouton + un panneau vide pour l'instant
// (voir index.html) — le vrai contenu viendra d'un futur systeme controle
// par les admins/moderateurs depuis le site.
function wireNotifications() {
  const trigger = document.getElementById("notif-trigger");
  const panel = document.getElementById("notif-panel");
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  document.addEventListener("click", () => {
    panel.hidden = true;
  });
}

// Bascule entre la vue "serveurs" (liste/détail) et la vue "paramètres" dans
// la barre latérale — deux destinations distinctes plutôt qu'un simple lien,
// pour matcher la convention des launchers du genre (Lunar, Modrinth...).
function showServersView() {
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navServersBtn.classList.add("active");
  loadServers();
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

function wireServerGridPanel(panelEl, origin, onFavoriteToggled) {
  panelEl.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => {
      detailOrigin = origin;
      openDetail(card.dataset.slug);
    });
  });
  panelEl.querySelectorAll(".favorite-btn").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleFavorite(btn.dataset.slug);
      await refreshPlaybarFavorites();
      onFavoriteToggled();
    });
  });
}

async function showFavoritesView() {
  statusEl.hidden = true;
  listEl.hidden = true;
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  favoritesPanelEl.hidden = false;
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navFavoritesBtn.classList.add("active");
  await renderFavoritesList();
}

async function renderFavoritesList() {
  const favorites = await getFavoriteSlugs();

  if (favorites.length === 0) {
    favoritesPanelEl.className = "detail";
    favoritesPanelEl.innerHTML = `
      <h2>Favoris</h2>
      <p class="join-note">Aucun favori pour l'instant — clique sur l'étoile d'un serveur pour l'ajouter ici.</p>
    `;
    return;
  }

  const favoriteServers = await resolveServersBySlug(favorites);
  favoritesPanelEl.className = "grid";
  favoritesPanelEl.innerHTML = favoriteServers.map((server) => serverCardHtml(server, true)).join("");
  wireServerGridPanel(favoritesPanelEl, "favorites", renderFavoritesList);
}

async function showRecentView() {
  statusEl.hidden = true;
  listEl.hidden = true;
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = false;
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.add("active");
  await renderRecentList();
}

async function renderRecentList() {
  const settings = await window.mchub.settings.get();
  const recentSlugs = settings.recentlyPlayed || [];

  if (recentSlugs.length === 0) {
    recentPanelEl.className = "detail";
    recentPanelEl.innerHTML = `
      <h2>Récents</h2>
      <p class="join-note">Aucun serveur joué pour l'instant — les derniers serveurs lancés apparaîtront ici.</p>
    `;
    return;
  }

  const favorites = await getFavoriteSlugs();
  const recentServers = await resolveServersBySlug(recentSlugs);
  recentPanelEl.className = "grid";
  recentPanelEl.innerHTML = recentServers.map((server) => serverCardHtml(server, favorites.includes(server.slug))).join("");
  wireServerGridPanel(recentPanelEl, "recent", renderRecentList);
}

async function showSettingsView() {
  statusEl.hidden = true;
  listEl.hidden = true;
  detailEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  settingsPanelEl.hidden = false;
  navServersBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navSettingsBtn.classList.add("active");

  const settingsStatusEl = document.getElementById("settings-status");
  settingsStatusEl.textContent = "";
  settingsStatusEl.classList.remove("ms-error");

  const settings = await window.mchub.settings.get();
  document.getElementById("settings-version").textContent = settings.appVersion ? `v${settings.appVersion}` : "—";
  document.getElementById("settings-mem-min").value = settings.memoryMinGB;
  document.getElementById("settings-mem-max").value = settings.memoryMaxGB;
  document.getElementById("settings-always-recommended").checked = settings.alwaysUseRecommendedRam;
  document.getElementById("settings-game-root").textContent = settings.gameRoot;

  await refreshJavaStatus("settings-java-status", "settings-java-install");
}

// Partagé entre le verrou Java obligatoire et les paramètres : verifie Java
// (voir javaManager.js — 64 bits requis pour allouer beaucoup de mémoire) et
// affiche un bouton d'installation automatique si besoin. `onReady` est
// appelé dès que Java est détecté OK (tout de suite, ou juste après une
// installation réussie) — utilisé par le verrou pour débloquer le launcher.
async function refreshJavaStatus(statusElId, installBtnId, { onReady } = {}) {
  const statusEl2 = document.getElementById(statusElId);
  const installBtn = document.getElementById(installBtnId);
  statusEl2.textContent = "Vérification de Java…";
  installBtn.hidden = true;

  const java = await window.mchub.java.detect();
  if (java.found && java.is64Bit) {
    statusEl2.textContent = `Java détecté${java.version ? ` (${java.version}, 64 bits)` : " (64 bits)"} ✓`;
    if (onReady) onReady();
  } else if (java.found) {
    statusEl2.textContent = "Java 32 bits détecté — insuffisant pour allouer beaucoup de mémoire.";
    installBtn.hidden = false;
  } else {
    statusEl2.textContent = "Java introuvable — nécessaire pour lancer Minecraft.";
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
      statusEl2.textContent = `Java ${result.version} installé ✓`;
      installBtn.hidden = true;
      if (onReady) onReady();
    } else {
      statusEl2.textContent = `Échec de l'installation : ${result.error}`;
    }
  });
}

// Verrou obligatoire : Java est requis pour lancer Minecraft (allocation de
// RAM comprise), donc on bloque tout le launcher (avant même l'assistant RAM
// et le portail de connexion) tant qu'il n'est pas détecté — à chaque
// démarrage, pas seulement au premier lancement.
async function ensureJavaAvailable() {
  const initial = await window.mchub.java.detect();
  if (initial.found && initial.is64Bit) return;

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
  statusEl.hidden = true;
  listEl.hidden = true;
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  accountPanelEl.hidden = false;
  navServersBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  await renderAccountPanel();
}

async function renderAccountPanel() {
  const skinUrl = currentProfile ? skinUrlFor(currentProfile) : "";
  const skinPreviewHtml = skinUrl
    ? fullSkinHtml(skinUrl, 7)
    : `<span class="server-icon" style="width: 112px; height: 112px; font-size: 42px;">${serverInitial(currentProfile?.name || "?")}</span>`;

  accountPanelEl.innerHTML = `
    <h2>Mon compte</h2>
    <div class="account-skin-row">
      ${skinPreviewHtml}
      <div>
        <div class="account-dropdown-name">${escapeHtml(currentProfile?.name || "")}</div>
        <p class="join-note" style="margin: 4px 0 0;">Skin actuel</p>
      </div>
    </div>

    <div class="settings-field">
      <span class="field-label">Changer de skin (PNG, 64×64)</span>
      <input type="file" accept="image/png" id="skin-file-input" class="settings-input" />
    </div>
    <div class="account-variant-row">
      <label><input type="radio" name="skin-variant" value="classic" checked /> Classic (Steve)</label>
      <label><input type="radio" name="skin-variant" value="slim" /> Slim (Alex)</label>
    </div>
    <div style="display: flex; gap: 8px; margin-top: 10px;">
      <button id="skin-upload-btn" class="join-btn" type="button">Changer de skin</button>
      <button id="skin-reset-btn" class="ms-login" type="button">Réinitialiser</button>
    </div>
    <p class="join-note" id="account-skin-status"></p>

    <h2 style="margin-top: 32px;">Comptes mémorisés</h2>
    <div id="account-list" style="margin-top: 12px;"></div>
    <p class="join-note" id="account-list-status"></p>
    <button id="account-add-btn" class="ms-login" type="button">+ Ajouter un compte</button>
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
    listContainer.innerHTML = '<p class="join-note">Aucun compte mémorisé — coche "Se souvenir de moi" à la connexion.</p>';
    return;
  }

  listContainer.innerHTML = accounts
    .map(
      (a) => `
      <div class="account-list-row">
        <span class="account-list-row-name">
          <span class="server-icon" style="width: 26px; height: 26px; font-size: 11px;">${serverInitial(a.name)}</span>
          ${escapeHtml(a.name)}
          ${a.id === activeId ? '<span class="account-active-tag">Actif</span>' : ""}
        </span>
        <span class="account-list-row-actions">
          ${a.id === activeId ? "" : `<button class="ms-login account-switch-btn" type="button" data-id="${escapeHtml(a.id)}">Basculer</button>`}
          <button class="ms-login account-remove-btn" type="button" data-id="${escapeHtml(a.id)}">Oublier</button>
        </span>
      </div>`,
    )
    .join("");

  const listStatusEl = document.getElementById("account-list-status");

  listContainer.querySelectorAll(".account-switch-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.textContent = "Bascule…";
      listStatusEl.textContent = "";
      listStatusEl.classList.remove("ms-error");

      const result = await window.mchub.account.switch(id);
      if (result.ok) {
        renderAccountHeader(result.profile, {});
        await renderAccountPanel();
        return;
      }
      btn.disabled = false;
      btn.textContent = "Basculer";
      listStatusEl.textContent = result.pendingApproval ? PENDING_APPROVAL_MESSAGE : result.error;
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
      skinStatusEl.textContent = "Choisis d'abord un fichier PNG.";
      skinStatusEl.classList.add("ms-error");
      return;
    }
    const variant = document.querySelector('input[name="skin-variant"]:checked')?.value || "classic";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Envoi…";
    skinStatusEl.textContent = "";
    skinStatusEl.classList.remove("ms-error");

    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await window.mchub.account.changeSkin(variant, buffer);

    if (result.ok) {
      renderAccountHeader(result.profile, {});
      await renderAccountPanel();
      document.getElementById("account-skin-status").textContent = "Skin mis à jour.";
      return;
    }
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Changer de skin";
    skinStatusEl.textContent = result.error;
    skinStatusEl.classList.add("ms-error");
  });

  resetBtn.addEventListener("click", async () => {
    resetBtn.disabled = true;
    const result = await window.mchub.account.resetSkin();
    if (result.ok) {
      renderAccountHeader(result.profile, {});
      await renderAccountPanel();
      document.getElementById("account-skin-status").textContent = "Skin réinitialisé.";
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
    addBtn.textContent = "Connexion…";
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
    addBtn.textContent = "+ Ajouter un compte";
    listStatusEl.textContent = result.pendingApproval ? PENDING_APPROVAL_MESSAGE : result.error;
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
    favName.textContent = "Ajoute un serveur en favoris";
    if (!launchInProgress) playBtn.disabled = true;
    favPanel.innerHTML = '<div class="playbar-fav-empty">Clique sur l\'étoile d\'un serveur pour l\'ajouter ici.</div>';
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
          ${row.kind === "last-played" ? '<span class="playbar-fav-row-tag">Dernier joué</span>' : ""}
          <span class="playbar-fav-row-title">${escapeHtml(server.name)}</span>
        </span>
        ${
          row.kind === "favorite"
            ? `<button class="playbar-fav-remove" type="button" data-slug="${escapeHtml(row.slug)}" title="Retirer des favoris">✕</button>`
            : ""
        }
      </div>`;
      })
      .join("") + (hasMoreFavorites ? `<div class="playbar-fav-row playbar-fav-more" id="playbar-fav-more">+ de favoris</div>` : "");

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
  navServersBtn.addEventListener("click", showServersView);
  navFavoritesBtn.addEventListener("click", showFavoritesView);
  navRecentBtn.addEventListener("click", showRecentView);
  navSettingsBtn.addEventListener("click", showSettingsView);
}

function wireSettingsPanel() {
  document.getElementById("settings-save").addEventListener("click", async () => {
    const min = Number(document.getElementById("settings-mem-min").value);
    const max = Number(document.getElementById("settings-mem-max").value);
    const alwaysUseRecommendedRam = document.getElementById("settings-always-recommended").checked;
    const settingsStatusEl = document.getElementById("settings-status");

    const updated = await window.mchub.settings.set({ memoryMinGB: min, memoryMaxGB: max, alwaysUseRecommendedRam });
    document.getElementById("settings-mem-min").value = updated.memoryMinGB;
    document.getElementById("settings-mem-max").value = updated.memoryMaxGB;
    document.getElementById("settings-always-recommended").checked = updated.alwaysUseRecommendedRam;
    settingsStatusEl.classList.remove("ms-error");
    settingsStatusEl.textContent = "Paramètres enregistrés.";
  });

  document.getElementById("settings-open-folder").addEventListener("click", () => {
    window.mchub.settings.openGameFolder();
  });
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
    note.textContent =
      `Cette machine a ${settings.totalGB} Go de RAM au total — ${settings.suggestedMinGB}/${settings.suggestedMaxGB} Go est une valeur prudente pour commencer.`;
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
  gateMessageEl.textContent = "Reprise de la session…";

  const restored = await window.mchub.tryRestoreSession();
  if (restored.ok) {
    enterApp(restored.profile);
    return;
  }

  gateMessageEl.textContent = restored.pendingApproval ? PENDING_APPROVAL_MESSAGE : "";
}

async function boot() {
  wireGate();
  wireWindowControls();
  wireSidebar();
  wireSettingsPanel();
  wireMcStatus();
  wireNotifications();
  wirePlaybar();

  await ensureJavaAvailable();

  const settings = await window.mchub.settings.get();
  if (!settings.onboarded) {
    await showRamSetupModal(settings);
  }

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
