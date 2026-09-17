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
const onboardingEl = document.getElementById("onboarding");
const navServersBtn = document.getElementById("nav-servers");
const navSettingsBtn = document.getElementById("nav-settings");

let signedIn = false;
// Profil du compte actif tel que reçu du processus principal — conservé ici
// pour que la page "Gérer le compte" puisse afficher le skin sans un
// nouvel aller-retour IPC.
let currentProfile = null;

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

function renderList(servers) {
  detailEl.hidden = true;
  listEl.hidden = false;

  if (servers.length === 0) {
    listEl.innerHTML = "";
    statusEl.hidden = false;
    statusEl.textContent = "Aucun serveur publié pour le moment.";
    return;
  }

  statusEl.hidden = true;
  listEl.innerHTML = servers
    .map(
      (server) => `
      <div class="card" data-slug="${escapeHtml(server.slug)}">
        <div class="banner">
          ${
            server.bannerUrl
              ? `<img src="${escapeHtml(server.bannerUrl)}" alt="" />`
              : `<div class="banner-scrim">${escapeHtml(server.name)}</div>`
          }
          ${typeBadge(server.type)}
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <span class="server-icon">${serverInitial(server.name)}</span>
            <h3>${escapeHtml(server.name)}</h3>
          </div>
          <p>${escapeHtml(server.description)}</p>
          <div class="players">${playersLabel(server)}</div>
        </div>
      </div>`,
    )
    .join("");

  listEl.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openDetail(card.dataset.slug));
  });
}

function renderDetail(server) {
  listEl.hidden = true;
  statusEl.hidden = true;
  detailEl.hidden = false;

  const tags = [`<span class="tag-chip">${server.type === "modded" ? "Moddé" : "Vanilla"}</span>`];
  if (server.type === "modded" && server.curseforgeModpackName) {
    const version = server.curseforgeModpackVersion ? ` — ${escapeHtml(server.curseforgeModpackVersion)}` : "";
    tags.push(`<span class="tag-chip">${escapeHtml(server.curseforgeModpackName)}${version}</span>`);
  }

  // signedIn est toujours vrai ici (le portail bloque l'accès sans connexion),
  // mais on garde le garde-fou par prudence.
  const joinSection = signedIn
    ? `
      <button class="join-btn" id="join-btn">▶ Rejoindre le serveur</button>
      <p class="join-note" id="join-status"></p>
    `
    : `
      <button class="join-btn" disabled>▶ Rejoindre le serveur</button>
      <p class="join-note">Connecte-toi avec ton compte Microsoft pour rejoindre ce serveur.</p>
    `;

  detailEl.innerHTML = `
    <button class="back">&larr; Retour à la liste</button>
    <div class="detail-banner">
      ${server.bannerUrl ? `<img src="${escapeHtml(server.bannerUrl)}" alt="" />` : ""}
      <div class="detail-icon">${serverInitial(server.name)}</div>
    </div>
    <div class="detail-header">
      <h2>${escapeHtml(server.name)}</h2>
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

  detailEl.querySelector(".back").addEventListener("click", loadServers);

  const joinBtn = document.getElementById("join-btn");
  if (joinBtn) {
    joinBtn.addEventListener("click", () => joinServer(server, joinBtn));
  }
}

// Un serveur peut suggérer une RAM (voir ServerForm côté site) — comparée à
// la RAM totale de la machine avant de lancer, avec un vrai avertissement
// de sécurité si la valeur demandée est irréaliste pour ce PC (voir cahier
// des charges, "avertissement de sécurité RAM"). Renvoie true si le
// lancement doit continuer.
async function applyRecommendedRamIfNeeded(server) {
  if (!server.recommendedRamGB) return true;

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
    if (!result.confirmed) return false;
    await window.mchub.settings.set({ memoryMinGB: fallbackMinGB, memoryMaxGB: fallbackMaxGB });
    return true;
  }

  if (settings.alwaysUseRecommendedRam) {
    await window.mchub.settings.set({
      memoryMinGB: Math.max(1, Math.floor(recommended / 2)),
      memoryMaxGB: recommended,
    });
    return true;
  }

  const result = await showModal({
    title: "RAM recommandée pour ce serveur",
    body: `Ce serveur recommande ${recommended} Go de RAM. Lancer le jeu avec cette valeur ?`,
    confirmLabel: `Lancer avec ${recommended} Go`,
    cancelLabel: "Garder mes paramètres actuels",
    checkboxLabel: "Toujours lancer avec la RAM recommandée du serveur",
  });

  if (result.confirmed) {
    await window.mchub.settings.set({
      memoryMinGB: Math.max(1, Math.floor(recommended / 2)),
      memoryMaxGB: recommended,
      alwaysUseRecommendedRam: result.checked,
    });
  } else if (result.checked) {
    await window.mchub.settings.set({ alwaysUseRecommendedRam: true });
  }
  return true;
}

async function joinServer(server, joinBtn) {
  const joinStatus = document.getElementById("join-status");
  const slug = server.slug;

  const shouldContinue = await applyRecommendedRamIfNeeded(server);
  if (!shouldContinue) return;

  joinBtn.disabled = true;
  joinBtn.textContent = "Lancement…";

  const stopListening = window.mchub.onGameProgress((status) => {
    if (joinStatus) joinStatus.textContent = status;
  });

  const result = await window.mchub.playServer(slug);
  stopListening();

  if (result.ok) {
    joinBtn.textContent = "Jeu lancé";
    if (joinStatus) joinStatus.textContent = "Le jeu a démarré dans une fenêtre séparée.";
    return;
  }

  joinBtn.disabled = false;
  joinBtn.textContent = "Rejoindre le serveur";
  if (joinStatus) {
    joinStatus.textContent = result.error;
    joinStatus.classList.add("ms-error");
  }
}

async function openDetail(slug) {
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

async function loadServers() {
  statusEl.hidden = false;
  statusEl.classList.remove("error");
  statusEl.textContent = "Chargement des serveurs…";
  detailEl.hidden = true;
  listEl.hidden = true;

  const result = await window.mchub.listServers();
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

// Bascule entre la vue "serveurs" (liste/détail) et la vue "paramètres" dans
// la barre latérale — deux destinations distinctes plutôt qu'un simple lien,
// pour matcher la convention des launchers du genre (Lunar, Modrinth...).
function showServersView() {
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  navSettingsBtn.classList.remove("active");
  navServersBtn.classList.add("active");
  loadServers();
}

async function showSettingsView() {
  statusEl.hidden = true;
  listEl.hidden = true;
  detailEl.hidden = true;
  accountPanelEl.hidden = true;
  settingsPanelEl.hidden = false;
  navServersBtn.classList.remove("active");
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

// Partagé entre l'assistant de premier démarrage et les paramètres : verifie
// Java (voir javaManager.js — 64 bits requis pour allouer beaucoup de
// mémoire) et affiche un bouton d'installation automatique si besoin.
async function refreshJavaStatus(statusElId, installBtnId) {
  const statusEl2 = document.getElementById(statusElId);
  const installBtn = document.getElementById(installBtnId);
  statusEl2.textContent = "Vérification de Java…";
  installBtn.hidden = true;

  const java = await window.mchub.java.detect();
  if (java.found && java.is64Bit) {
    statusEl2.textContent = `Java détecté${java.version ? ` (${java.version}, 64 bits)` : " (64 bits)"} ✓`;
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
    } else {
      statusEl2.textContent = `Échec de l'installation : ${result.error}`;
    }
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
  accountPanelEl.hidden = false;
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  await renderAccountPanel();
}

async function renderAccountPanel() {
  const skinUrl = currentProfile ? skinUrlFor(currentProfile) : "";
  const skinPreviewHtml = skinUrl
    ? `
      <div class="skin-face-wrap">
        <div class="skin-face" style="background-image: url('${escapeHtml(skinUrl)}')"></div>
        <div class="skin-face-overlay" style="background-image: url('${escapeHtml(skinUrl)}')"></div>
      </div>`
    : `<span class="server-icon" style="width: 72px; height: 72px; font-size: 28px;">${serverInitial(currentProfile?.name || "?")}</span>`;

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
  const { accounts, activeId } = await window.mchub.account.list();

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

function wireSidebar() {
  navServersBtn.addEventListener("click", showServersView);
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

// Assistant de premier démarrage : affiché une seule fois (voir
// settings.onboarded) avant même le portail de connexion, pour choisir une
// RAM raisonnable dès le départ et vérifier Java sans attendre le premier
// clic sur "Rejoindre".
async function showOnboarding(settings) {
  onboardingEl.hidden = false;
  document.getElementById("onboarding-mem-min").value = settings.suggestedMinGB;
  document.getElementById("onboarding-mem-max").value = settings.suggestedMaxGB;
  document.getElementById("onboarding-ram-note").textContent =
    `Cette machine a ${settings.totalGB} Go de RAM au total — ${settings.suggestedMinGB}/${settings.suggestedMaxGB} Go est une valeur prudente pour commencer, modifiable plus tard dans les paramètres.`;

  await refreshJavaStatus("onboarding-java-status", "onboarding-java-install");
}

function wireOnboarding() {
  document.getElementById("onboarding-continue").addEventListener("click", async () => {
    const min = Number(document.getElementById("onboarding-mem-min").value);
    const max = Number(document.getElementById("onboarding-mem-max").value);
    await window.mchub.settings.set({ memoryMinGB: min, memoryMaxGB: max, onboarded: true });
    onboardingEl.hidden = true;
    await proceedToGate();
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
  wireOnboarding();

  const settings = await window.mchub.settings.get();
  if (!settings.onboarded) {
    await showOnboarding(settings);
    return;
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
  const result = await window.mchub.listServers();
  if (result.ok) renderList(result.servers);
}

setInterval(silentRefreshList, REFRESH_INTERVAL_MS);
