const gateEl = document.getElementById("gate");
const gateMessageEl = document.getElementById("gate-message");
const gateLoginBtn = document.getElementById("gate-login");
const appEl = document.getElementById("app");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");
const msAccountEl = document.getElementById("ms-account");

let signedIn = false;

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
    </div>
    <div class="tag-row">${tags.join("")}</div>
    <p class="desc">${escapeHtml(server.description)}</p>
    ${joinSection}
  `;

  detailEl.querySelector(".back").addEventListener("click", loadServers);

  const joinBtn = document.getElementById("join-btn");
  if (joinBtn) {
    joinBtn.addEventListener("click", () => joinServer(server.slug, joinBtn));
  }
}

async function joinServer(slug, joinBtn) {
  const joinStatus = document.getElementById("join-status");
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
  const skinUrl = skinUrlFor(profile);

  msAccountEl.innerHTML = `
    <div class="account-menu">
      <button class="account-trigger" id="account-trigger" type="button">
        <span class="status-dot online"></span>${escapeHtml(profile.name)}
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
    appEl.hidden = true;
    gateEl.hidden = false;
    gateMessageEl.textContent = "";
    setGateBusy(false);
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

async function boot() {
  wireGate();
  gateEl.hidden = false;
  gateMessageEl.textContent = "Reprise de la session…";

  const restored = await window.mchub.tryRestoreSession();
  if (restored.ok) {
    enterApp(restored.profile);
    return;
  }

  gateMessageEl.textContent = restored.pendingApproval ? PENDING_APPROVAL_MESSAGE : "";
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
