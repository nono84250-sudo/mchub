const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");

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

  detailEl.innerHTML = `
    <button class="back">&larr; Retour à la liste</button>
    <h2>${escapeHtml(server.name)}</h2>
    <p class="meta">Minecraft ${escapeHtml(server.minecraftVersion)}</p>
    <p class="meta">${playersLabel(server)}</p>
    ${modpack}
    <p class="desc">${escapeHtml(server.description)}</p>
    <button class="join-btn" disabled>Rejoindre le serveur</button>
    <p class="join-note">Connecte-toi avec ton compte Microsoft pour rejoindre ce serveur (bientôt disponible).</p>
  `;

  detailEl.querySelector(".back").addEventListener("click", loadServers);
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
