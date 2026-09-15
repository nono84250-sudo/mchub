const gateEl = document.getElementById("gate");
const gateMessageEl = document.getElementById("gate-message");
const gateLoginBtn = document.getElementById("gate-login");
const gateTestBtn = document.getElementById("gate-test-mode");
const appEl = document.getElementById("app");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");
const msAccountEl = document.getElementById("ms-account");

let signedIn = false;

// Désactive/réactive les deux boutons du portail — utilisé pendant une
// connexion en cours (évite qu'une session de test écrase une vraie
// connexion, ou l'inverse) ET quand on revient au portail après une
// déconnexion (sinon ils restent grisés depuis la dernière connexion).
function setGateBusy(busy) {
  gateLoginBtn.disabled = busy;
  gateTestBtn.disabled = busy;
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
          ${server.bannerUrl ? `<img src="${escapeHtml(server.bannerUrl)}" alt="" />` : "Pas d'image"}
          ${typeBadge(server.type)}
        </div>
        <div class="card-body">
          <h3>${escapeHtml(server.name)}</h3>
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

  const modpack =
    server.type === "modded" && server.curseforgeModpackName
      ? `<p class="meta">Modpack CurseForge : ${escapeHtml(server.curseforgeModpackName)}${
          server.curseforgeModpackVersion ? ` — ${escapeHtml(server.curseforgeModpackVersion)}` : ""
        }</p>`
      : "";

  // signedIn est toujours vrai ici (le portail bloque l'accès sans connexion),
  // mais on garde le garde-fou par prudence.
  const joinSection = signedIn
    ? `
      <button class="join-btn" id="join-btn">Rejoindre le serveur</button>
      <p class="join-note" id="join-status"></p>
    `
    : `
      <button class="join-btn" disabled>Rejoindre le serveur</button>
      <p class="join-note">Connecte-toi avec ton compte Microsoft pour rejoindre ce serveur.</p>
    `;

  detailEl.innerHTML = `
    <button class="back">&larr; Retour à la liste</button>
    <h2>${escapeHtml(server.name)}</h2>
    <p class="meta">Minecraft ${escapeHtml(server.minecraftVersion)}</p>
    <p class="meta">${playersLabel(server)}</p>
    ${modpack}
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
    statusEl.textContent = `Impossible de contacter le site MCHub : ${result.error}`;
    return;
  }
  renderList(result.servers);
}

function renderAccountHeader(profile, { testMode, rememberFailed } = {}) {
  msAccountEl.innerHTML = `
    <span class="ms-account-name">
      <span class="status-dot online"></span>${escapeHtml(profile.name)}${testMode ? " (mode test)" : ""}
    </span>
    ${rememberFailed ? '<span class="ms-error" style="margin-left: 8px;">session non mémorisée</span>' : ""}
    <button id="sign-out" class="ms-login" style="margin-left: 10px;">Se déconnecter</button>
  `;
  document.getElementById("sign-out").addEventListener("click", async () => {
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

  // TEMPORAIRE, pour développement uniquement — voir TEST_MODE_ENABLED côté main.js.
  gateTestBtn.addEventListener("click", async () => {
    setGateBusy(true);
    gateMessageEl.textContent = "";
    gateMessageEl.classList.remove("ms-error");
    const result = await window.mchub.startTestSession();
    if (result.ok) {
      enterApp(result.profile, { testMode: true });
      return;
    }
    setGateBusy(false);
    gateMessageEl.textContent = result.error;
    gateMessageEl.classList.add("ms-error");
  });
}

async function boot() {
  wireGate();
  gateEl.hidden = false;
  gateMessageEl.textContent = "Reprise de la session…";

  window.mchub.isTestModeEnabled().then((enabled) => {
    gateTestBtn.hidden = !enabled;
  });

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
