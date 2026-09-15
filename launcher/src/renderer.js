const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");
const msAccountEl = document.getElementById("ms-account");

let signedIn = false;

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

function wireMsLoginButton() {
  const btn = document.getElementById("ms-login");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    msAccountEl.innerHTML = `<button class="ms-login" disabled>Connexion en cours…</button>`;

    const result = await window.mchub.signIn();

    if (result.ok) {
      signedIn = true;
      msAccountEl.innerHTML = `<span class="ms-account-name"><span class="status-dot online"></span>${escapeHtml(result.profile.name)}</span>`;
      return;
    }

    if (result.pendingApproval) {
      msAccountEl.innerHTML = `
        <span class="ms-pending">Connexion Microsoft OK — en attente de validation par Microsoft pour l'accès Minecraft.</span>
        <button id="ms-login" class="ms-login">Réessayer</button>
      `;
      wireMsLoginButton();
      return;
    }

    msAccountEl.innerHTML = `
      <span class="ms-error">${escapeHtml(result.error)}</span>
      <button id="ms-login" class="ms-login">Réessayer</button>
    `;
    wireMsLoginButton();
  });
}

wireMsLoginButton();
loadServers();

// Modèle "polling" retenu pour le MVP (cahier des charges, section 3) :
// pas de WebSocket, juste un rafraîchissement régulier en arrière-plan.
// Ne touche à rien si le joueur est sur une page de détail, et reste
// silencieux en cas d'échec (on ne veut pas interrompre l'utilisateur
// pour un ping raté en tâche de fond).
const REFRESH_INTERVAL_MS = 30_000;

async function silentRefreshList() {
  if (listEl.hidden) return;
  const result = await window.mchub.listServers();
  if (result.ok) renderList(result.servers);
}

setInterval(silentRefreshList, REFRESH_INTERVAL_MS);
