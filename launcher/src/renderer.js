const t = window.i18n.t;

// Idee 3 du lancement (19/10) : une erreur non prevue de l'interface part dans le rapport
// d'erreurs (Sentry, seulement s'il est configure ; voir errorReports.js cote main.js).
window.addEventListener("error", (event) => {
  window.mchub.reportError({ message: event.message, stack: event.error?.stack });
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  window.mchub.reportError({ message: reason?.message ?? String(reason), stack: reason?.stack });
});

const gateEl = document.getElementById("gate");
const gateMessageEl = document.getElementById("gate-message");
const gateLoginBtn = document.getElementById("gate-login");
const appEl = document.getElementById("app");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const listTitleEl = document.getElementById("list-title");
const guestBannerEl = document.getElementById("guest-banner");
const listToolbarEl = document.getElementById("list-toolbar");
const listSearchInputEl = document.getElementById("list-search-input");
const listSortSelectEl = document.getElementById("list-sort");
const detailEl = document.getElementById("detail");
const msAccountEl = document.getElementById("ms-account");
const settingsPanelEl = document.getElementById("settings-panel");
const accountPanelEl = document.getElementById("account-panel");
const favoritesPanelEl = document.getElementById("favorites-panel");
const recentPanelEl = document.getElementById("recent-panel");
const myInstancesPanelEl = document.getElementById("my-instances-panel");
const friendsPanelEl = document.getElementById("friends-panel");
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
// Systeme d'amis, phase 1 (2026-10-14) : vue plein ecran #friends-panel (voir showFriendsView()
// plus bas), et renderAccountHeader()/renderGuestHeader() pour sa visibilite (compte Microsoft
// requis, comme nav-settings).
const navFriendsBtn = document.getElementById("nav-friends");
// Laboratoire (25/10) : l'onglet Amis suit l'interrupteur « friends » du site (voir features.js).
let friendsFeatureOn = true;
function applyLabFeatures(state) {
  friendsFeatureOn = state?.friends?.visible === true;
  if (!friendsFeatureOn) {
    navFriendsBtn.hidden = true;
    if (!document.getElementById("friends-panel")?.hidden) navHomeBtn?.click();
  } else if (currentProfile) navFriendsBtn.hidden = false;
}
window.mchub.getFeatures?.().then(applyLabFeatures).catch(() => {});
window.mchub.onFeaturesChanged?.(applyLabFeatures);
const navSettingsBtn = document.getElementById("nav-settings");
// D'ou vient la fiche detail actuellement affichee (liste "Serveurs" ou
// page "Favoris") — pour que le bouton "Retour" ramene au bon endroit.
let detailOrigin = "servers";

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
    ? `<span class="badge modded">${t("serverCard.modded")}</span>`
    : `<span class="badge">${t("serverCard.vanilla")}</span>`;
}

function playersText(server) {
  if (server.playerCount === null || server.playerCount === undefined) {
    return t("serverCard.statusUnknown");
  }
  // Version A (19/10, validee par Rushi) : un maximum de 0 veut dire « pas de maximum annonce »
  // (beaucoup de grands serveurs cachent leur limite), jamais « 3570 / 0 ».
  const capacity = server.playerCapacity > 0 ? ` / ${Number(server.playerCapacity)}` : "";
  // Juste le nombre : « 16170 / 200000 » (le libellé est donné par le titre de la case).
  return `${Number(server.playerCount)}${capacity}`;
}

// Remplissage du serveur (17/10, meme logique que la jauge du site) : orange a partir de 80 % des
// places, rouge a 100 % avec le mot « Complet » en plus de la couleur. null sans capacite connue.
function fillLevel(server) {
  const count = server.playerCount;
  const capacity = server.playerCapacity;
  if (count == null || !capacity || capacity <= 0) return null;
  const ratio = count / capacity;
  return ratio >= 1 ? "full" : ratio >= 0.8 ? "busy" : "ok";
}

function playersLabel(server) {
  const online = server.playerCount !== null && server.playerCount !== undefined;
  // Table des etats (audit 17/10, lot 2) : hors ligne en gris (le rouge est pour « Complet »),
  // presque plein en orange avec son mot, inconnu en rond pointille.
  if (!online && server.pinged) {
    return `<span class="status-dot" style="background:var(--state-off)"></span><span style="color:var(--state-off)">${t("serverCard.offline")}</span>`;
  }
  if (!online) return `<span class="status-dot unknown"></span><span class="muted">${escapeHtml(t("serverCard.unknown"))}</span>`;
  const level = fillLevel(server);
  if (level === "full" || level === "busy") {
    return `<span class="players-fill ${level}"><span class="status-dot"></span>${playersText(server)} · ${escapeHtml(t(level === "full" ? "serverCard.full" : "serverCard.busy"))}</span>`;
  }
  return `<span class="status-dot online"></span>${playersText(server)}`;
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

// Teams (19/10, meme logique que le site : site/src/components/TeamByline.tsx). server.team :
// { name, slug, iconUrl, description, official } ou null (site plus ancien : absent, rien ne
// s'affiche). Team Omniscient : « Proposé par Omniscient · C'est ton serveur ? », qui deplie la
// description et « Nous contacter » (page Contact du site, sujet « C'est mon serveur »).
const TEAM_SLUG_RE = /^[a-z0-9-]{1,80}$/;
function teamOf(server) {
  const team = server && server.team;
  return team && typeof team.name === "string" && TEAM_SLUG_RE.test(team.slug || "") ? team : null;
}
function teamHue(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
function teamAvatarHtml(team, size = 16) {
  const words = team.name.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : team.name.slice(0, 2)).toUpperCase();
  const h = teamHue(team.name);
  const style = `width:${size}px;height:${size}px;font-size:${Math.max(8, Math.round(size * 0.42))}px;${team.iconUrl ? "" : `background:linear-gradient(135deg, hsl(${h} 55% 42%), hsl(${(h + 40) % 360} 60% 18%));`}`;
  return `<span class="team-avatar" aria-hidden="true" style="${style}">${team.iconUrl ? `<img src="${escapeHtml(team.iconUrl)}" alt="" />` : escapeHtml(initials)}</span>`;
}
// Ligne des listes (Serveurs, Ma bibliothèque) : « par [icone] Nom », sans lien (la ligne en est un).
function teamRowHtml(server) {
  const team = teamOf(server);
  if (!team) return "";
  // La liste est deja filtree sur cette team (bandeau au-dessus) : inutile de la repeter sur chaque ligne.
  if (listFilters.team === team.slug && !listEl.hidden) return "";
  const word = team.official ? t("team.proposedBy").toLowerCase() : t("team.byShort");
  return `<span class="row-team">${escapeHtml(word)} ${teamAvatarHtml(team, 14)}<button type="button" class="row-team-btn" data-team-filter="${escapeHtml(team.slug)}" title="${escapeHtml(t("serverList.teamSeeServers", { name: team.name }))}">${escapeHtml(team.name)}</button></span>`;
}
// Ligne sous le nom sur la fiche.
function teamBylineHtml(server) {
  const team = teamOf(server);
  if (!team) return "";
  const name = `<button type="button" class="team-name-btn" data-team-open="${escapeHtml(team.slug)}">${teamAvatarHtml(team, 18)}${escapeHtml(team.name)}</button>`;
  if (!team.official) return `<p class="team-byline">${escapeHtml(t("team.by"))} ${name}</p>`;
  return `
    <div class="team-byline-wrap">
      <p class="team-byline">${escapeHtml(t("team.proposedBy"))} ${name}<span aria-hidden="true">·</span><button type="button" class="team-claim-toggle" aria-expanded="false">${escapeHtml(t("team.isItYours"))}</button></p>
      <div class="team-claim" hidden>
        <span>${escapeHtml(team.description || t("team.officialFallback"))}</span>
        <button type="button" class="join-btn team-claim-btn" data-team-claim="${escapeHtml(server.slug)}">${escapeHtml(t("team.contactUs"))}</button>
      </div>
    </div>`;
}
function wireTeamByline(container) {
  container.querySelectorAll("[data-team-open]").forEach((btn) => {
    btn.addEventListener("click", () => showTeamInServers(btn.dataset.teamOpen));
  });
  container.querySelectorAll(".team-claim-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const box = btn.closest(".team-byline-wrap").querySelector(".team-claim");
      box.hidden = !box.hidden;
      btn.setAttribute("aria-expanded", String(!box.hidden));
    });
  });
  container.querySelectorAll("[data-team-claim]").forEach((btn) => {
    btn.addEventListener("click", () => window.mchub.openTeamLink("claim", btn.dataset.teamClaim));
  });
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
// `playedAt` (page Recents seulement) : date de la derniere partie, affichee avant les joueurs.
// Bandeau aux couleurs du serveur (point 5) : sa banniere etiree sur 5 px, sinon un degrade
// tire de son nom (toujours le meme pour un serveur donne).
// Bande en haut des cartes (17/10, variante A choisie par Rushi) : elle montre l'etat du serveur,
// avec les memes seuils que la jauge de joueurs. Avant, c'etait la banniere ou une couleur tiree
// du nom : un serveur ferme pouvait sortir orange, ce qui ne voulait rien dire.
function serverBandState(server) {
  const online = server.playerCount !== null && server.playerCount !== undefined;
  if (!online) return server.pinged ? "off" : "unknown";
  return fillLevel(server) || "ok";
}

// Lot 2 (audit 17/10) : memes couleurs que la table des etats du site ; inconnu en rayures grises.
const BAND_COLORS = {
  ok: "var(--success)",
  busy: "var(--state-busy)",
  full: "var(--danger)",
  off: "var(--state-off)",
  unknown: "repeating-linear-gradient(90deg, var(--state-off) 0 6px, transparent 6px 12px)",
};
// Reglage en attente de Rushi : true = bande seulement quand l'etat n'est PAS « En ligne »
// (avis de 9 testeurs sur 10), false = bande sur toutes les cartes (variante A du 17/10).
const BAND_ONLY_WHEN_PROBLEM = true;

function serverBandCss(server) {
  const state = serverBandState(server);
  if (BAND_ONLY_WHEN_PROBLEM && state === "ok") return "transparent";
  return BAND_COLORS[state];
}

function serverBandTitle(server) {
  return t(`band.tip_${serverBandState(server)}`);
}

// « ? » a cote des filtres (liste Serveurs, Ma bibliotheque) : la legende des couleurs.
var bandLegendOpen = false;
function bandLegendHtml() {
  const rows = ["ok", "busy", "full", "off", "unknown"]
    .map((key) => `<span><i style="background:${BAND_COLORS[key]}"></i>${escapeHtml(t(`band.legend_${key}`))}</span>`)
    .join("");
  return `<span class="band-legend-anchor">
      <button type="button" class="band-help" data-band-legend aria-expanded="${bandLegendOpen}" title="${escapeHtml(t("band.legendTitle"))}" aria-label="${escapeHtml(t("band.legendTitle"))}">?</button>
      ${bandLegendOpen ? `<span class="band-legend-pop" role="dialog" aria-label="${escapeHtml(t("band.legendTitle"))}"><b>${escapeHtml(t("band.legendTitle"))}</b><span class="muted">${escapeHtml(t("band.legendText"))}</span><span class="band-legend-rows">${rows}</span></span>` : ""}
    </span>`;
}

document.addEventListener("click", (event) => {
  const btn = event.target.closest?.("[data-band-legend]");
  if (!btn && !bandLegendOpen) return;
  if (!btn && event.target.closest?.(".band-legend-pop")) return;
  bandLegendOpen = btn ? !bandLegendOpen : false;
  document.querySelectorAll(".band-legend-anchor").forEach((anchor) => (anchor.outerHTML = bandLegendHtml()));
});

function serverRowHtml(server, isFav, playedAt = null, withPlay = false) {
  const ownerTag = isOwnServer(server) ? `<span class="owner-tag">${t("serverCard.owner")}</span>` : "";
  const played = playedAt ? playedLabel(playedAt, Date.now()) : null;
  // Disposition A du site (19/10, choisie par Rushi) : ligne 1 = nom puis la team (qui se
  // raccourcit en premier) ; ligne 2 = etiquettes principales (3) puis secondaires, cachees en
  // entier si elles ne tiennent pas ; ligne 3 = « version · type » en petit, puis la description
  // (gardee dans le launcher). A droite : les joueurs, et la langue dessous, jamais cachee.
  // « Nouveau » en coin de l'icone (les lignes n'ont pas de banniere).
  const newBadge = server.isNew ? `<span class="row-new-corner">${t("serverList.newBadge")}</span>` : "";
  const tags = serverTagsOf(server);
  const mainSet = new Set(Array.isArray(server.mainTags) ? server.mainTags : tags.slice(0, 3));
  const tagChip = (tag, cls) => `<span class="row-tag ${cls}">${escapeHtml(tagLabel(tag))}</span>`;
  const tagsHtml = tags.filter((tag) => mainSet.has(tag)).map((tag) => tagChip(tag, "main")).join("") + tags.filter((tag) => !mainSet.has(tag)).map((tag) => tagChip(tag, "sec")).join("");
  const langs = serverLangsOf(server);
  const langsHtml = langs.length
    ? langs.map((lang) => `<span class="row-lang${langs.length === 1 ? " solo" : ""}" title="${escapeHtml(t(`serverPage.languages.${lang}`))}">${lang.toUpperCase()}</span>`).join("")
    : `<span class="row-lang none">${escapeHtml(t("serverList.noLang"))}</span>`;
  const tech = [
    server.minecraftVersion,
    server.type === "modded" ? server.modpackName || t("serverCard.modded") : t("serverCard.vanilla"),
    server.recommendedRamGB ? t("serverList.ramAdvised", { count: server.recommendedRamGB }) : null,
  ].filter(Boolean).join(" · ");
  const friendNames = friendsBySlug().get(server.slug) || [];
  const friendsHtml = friendNames.length
    ? `<span class="chipx online"><span class="row-friends">${escapeHtml(t("serverList.friendsPlaying", { count: friendNames.length, names: friendNames.slice(0, 3).join(", ") + (friendNames.length > 3 ? "…" : "") }))}</span></span>`
    : "";
  // Joueurs : un seul endroit, la colonne de droite. Maximum 0 = pas de maximum (« en ligne »).
  const online = server.playerCount !== null && server.playerCount !== undefined;
  const fill = fillLevel(server);
  const side = online
    ? `<b class="${fill === "full" || fill === "busy" ? `players-fill ${fill}` : ""}">${escapeHtml(String(server.playerCount))}</b><small>${escapeHtml(server.playerCapacity > 0 ? t("serverList.ofCapacity", { count: server.playerCapacity }) : t("serverList.onlineWord"))}</small>${fill === "full" || fill === "busy" ? `<small class="players-fill ${fill}">${escapeHtml(t(fill === "full" ? "serverCard.full" : "serverCard.busy"))}</small>` : ""}`
    : server.pinged
      ? `<b class="muted">—</b><small style="color:var(--state-off)">${escapeHtml(t("serverCard.offline"))}</small>`
      : `<b class="muted">?</b><small class="muted">${escapeHtml(t("serverCard.unknown"))}</small>`;
  const team = teamRowHtml(server);
  return `
    <div class="row row-2l" data-slug="${escapeHtml(server.slug)}" role="button" tabindex="0" style="--row-band: ${serverBandCss(server)}">
      <span class="row-band-hit" title="${escapeHtml(serverBandTitle(server))}"></span>
      <span class="row-icon-wrap"><span class="server-icon" style="width: 38px; height: 38px; border-radius: 8px; font-size: 14px;">${serverIconInner(server)}</span>${newBadge}</span>
      <div class="row-body">
        <div class="row-title-line">
          <h3 title="${escapeHtml(server.name)}">${escapeHtml(server.name)}</h3>
          ${team ? `<span class="row-sep" aria-hidden="true">·</span>${team}` : ""}
          ${manualModsBadgeHtml(server)}
          ${ownerTag}
        </div>
        <div class="row-chips row-tags-line">${tagsHtml}${friendsHtml}</div>
        <p>${played ? `<span class="row-played-inline">${escapeHtml(played.line)} · </span>` : ""}<span class="row-tech">${escapeHtml(tech)}</span>${server.description ? ` · ${escapeHtml(server.description)}` : ""}</p>
      </div>
      <div class="row-side">${side}<span class="row-langs">${langsHtml}</span></div>
      ${played ? `<div class="row-played">${escapeHtml(played.line)}</div>` : ""}
      ${withPlay ? `<button type="button" class="row-play" data-play-slug="${escapeHtml(server.slug)}" title="${escapeHtml(t("home.playOn", { name: server.name }))}" aria-label="${escapeHtml(t("home.playOn", { name: server.name }))}">▶</button>` : ""}
      ${withPlay ? `<span class="instance-more row-more"><button type="button" class="row-more-btn" data-more-slug="${escapeHtml(server.slug)}" aria-haspopup="menu" aria-expanded="false" title="${escapeHtml(t("myInstances.menuMore"))}" aria-label="${escapeHtml(t("myInstances.menuMore"))}">…</button><span class="instance-menu" role="menu" hidden><button type="button" class="instance-menu-item" data-row-install="${escapeHtml(server.slug)}">⬇<span>${escapeHtml(t("myInstances.menuInstall"))}<small>${escapeHtml(t("myInstances.menuInstallHint"))}</small></span></button><button type="button" class="instance-menu-item" data-row-open="${escapeHtml(server.slug)}">↗ ${escapeHtml(t("myInstances.menuPage"))}</button></span></span>` : ""}
      ${favoriteBtnHtml(server.slug, isFav)}
    </div>`;
}

// --- Recents (14/10, preview validee par Rushi) ------------------------------
// 10 serveurs au plus, joues ces 7 derniers jours, avec la date de la derniere partie. Tout
// reste local (settings.recentlyPlayed + settings.recentPlayedAt), aucune requete au site.
const RECENT_MAX = 10;
const RECENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function datesForSlugs(dates, slugs) {
  const out = {};
  for (const slug of slugs) if (typeof dates?.[slug] === "number") out[slug] = dates[slug];
  return out;
}

// Liste a afficher, et ce qu'il faut reecrire dans les reglages (`patch`, null si rien) :
// les serveurs de plus de 7 jours sortent de la liste. Un serveur enregistre avant les dates
// (ancienne version) recoit la date d'aujourd'hui : il reste 7 jours, puis sort comme les autres.
// Liste vide mais « dernier joue » connu (voir recentSlugsFromSettings) : celui-ci est repris.
// Le « dernier joue » (menu rapide, accueil) suit la meme regle des 7 jours (second audit du
// 14/10) : sa date est gardee meme hors de la liste, et il est efface une fois trop vieux.
// Avant, le repli lui redonnait la date du jour a chaque ouverture et il ne sortait jamais.
function recentEntries(settings, now) {
  const slugs = recentSlugsFromSettings(settings).slice(0, RECENT_MAX);
  const last = settings?.lastPlayedSlug || null;
  const dates = { ...(settings?.recentPlayedAt || {}) };
  let changed = !Array.isArray(settings?.recentlyPlayed) || settings.recentlyPlayed.length !== slugs.length;
  for (const slug of last && !slugs.includes(last) ? [...slugs, last] : slugs) {
    if (typeof dates[slug] !== "number" || dates[slug] > now) {
      dates[slug] = now;
      changed = true;
    }
  }
  const kept = slugs.filter((slug) => now - dates[slug] < RECENT_MAX_AGE_MS).sort((a, b) => dates[b] - dates[a]);
  if (kept.length !== slugs.length) changed = true;
  const lastExpired = !!last && now - dates[last] >= RECENT_MAX_AGE_MS;
  if (lastExpired) changed = true;
  const recentPlayedAt = datesForSlugs(dates, last && !lastExpired && !kept.includes(last) ? [...kept, last] : kept);
  return {
    entries: kept.map((slug) => ({ slug, playedAt: recentPlayedAt[slug] })),
    patch: changed ? { recentlyPlayed: kept, recentPlayedAt, ...(lastExpired ? { lastPlayedSlug: null } : {}) } : null,
  };
}

// Reglages avec la regle des 7 jours deja appliquee (et enregistree) : utilise par l'accueil et
// le menu rapide, pour que le « dernier joue » sorte aussi sans passer par la page Recents.
async function settingsWithFreshRecents() {
  const settings = await window.mchub.settings.get();
  const { patch } = recentEntries(settings, Date.now());
  if (!patch) return settings;
  await window.mchub.settings.set(patch);
  return { ...settings, ...patch };
}

// « Aujourd'hui / Hier / Il y a 3 jours » compte en jours du calendrier (pas en tranches de
// 24 h) : une partie d'hier soir reste « Hier » ce matin.
function playedLabel(playedAt, now) {
  const startOfDay = (ms) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(playedAt)) / 86_400_000));
  const day = days === 0 ? t("recent.today") : days === 1 ? t("recent.yesterday") : t("recent.daysAgo", { count: days });
  const time = new Date(playedAt).toLocaleTimeString(window.i18n.getLocale() === "en" ? "en-US" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
  // Une seule ligne (16/10, preview validee) : « Il y a 2 jours · 22:44 ».
  return { day, time, line: t("recent.oneLine", { day, time }) };
}

// --- Filtres de la liste (16/10, option C validee, preview https://claude.ai/artifact/DGSAjFDstaKgMRLwudGMYd)
// Memes regles que le site (site/src/lib/serverFilters.ts) : garder les deux alignees. Tout se
// calcule sur la liste deja recuperee, aucun appel reseau par frappe ou par clic. Les champs du
// 16/10 (tags, languages, minecraftVersion, launchCount, trendScore, isNew) peuvent manquer face a
// un site plus ancien : chaque lecture a sa valeur par defaut, et le tri « Plus recents » garde
// simplement l'ordre recu du site.
let allServers = [];
// Etiquettes filtrables = celles de la fiche (PAGE_TAGS, plus bas ; french/english sont devenues
// des langues). Fonction : PAGE_TAGS est declaree apres cette section.
const filterTags = () => PAGE_TAGS.filter((tag) => tag !== "french" && tag !== "english");
const FILTER_LANGS = ["fr", "en"];
const LIST_SORTS = ["recent", "trend", "players", "played", "az", "small"];
function defaultListFilters() {
  return { q: "", type: "all", online: false, lang: "all", tags: [], version: "all", friend: false, team: "all", sort: "recent", reversed: false };
}
let listFilters = defaultListFilters();
let listFiltersPanelOpen = false;

// 23/10 (« Remplacer une etiquette » du site) : noms des etiquettes renommees ou ajoutees par
// l'equipe, recus avec la liste (server.tagLabels) ; sinon le nom du dictionnaire du launcher.
const serverTagLabels = new Map();
function rememberTagLabels(servers) {
  for (const server of servers || []) {
    if (!server || typeof server.tagLabels !== "object" || !server.tagLabels) continue;
    for (const [tag, names] of Object.entries(server.tagLabels)) {
      if (names && typeof names.fr === "string" && typeof names.en === "string") serverTagLabels.set(tag, names);
    }
  }
}
function tagLabel(tag) {
  const names = serverTagLabels.get(tag);
  if (names) return window.i18n.getLocale() === "en" ? names.en : names.fr;
  return t(`serverPage.tags.${tag}`);
}

function serverTagsOf(server) {
  return Array.isArray(server.tags) ? server.tags.filter((tag) => filterTags().includes(tag)) : [];
}
function serverLangsOf(server) {
  return Array.isArray(server.languages) ? server.languages.filter((lang) => FILTER_LANGS.includes(lang)) : [];
}
// Branche d'une version : "1.20.1" -> "1.20". Snapshots, -pre, texte libre -> "other".
function versionBranch(version) {
  const m = /^1\.(\d{1,2})(?:\.\d{1,2})?$/.exec(String(version || "").trim());
  return m ? `1.${m[1]}` : "other";
}
function isServerOnline(server) {
  return !!server.pinged && server.playerCount !== null && server.playerCount !== undefined;
}

// « Un ami y joue » : slug -> pseudos des amis en ligne sur ce serveur. Vient de la liste d'amis
// (friendsList, deja gardee une minute par main.js) : seulement quand une liste de serveurs est
// ouverte par un joueur connecte. Audit de charge du 19/10 (B2) : rechargee au plus toutes les
// 5 min ici (et non plus chaque minute, ~75 % du cout d'un joueur sur l'onglet Serveurs) ; l'onglet
// Amis, lui, la recharge toujours a l'ouverture.
function friendsBySlug() {
  const map = new Map();
  for (const friend of friendsList) {
    if (!friend.online || !friend.playingSlug) continue;
    if (!map.has(friend.playingSlug)) map.set(friend.playingSlug, []);
    map.get(friend.playingSlug).push(friend.minecraftUsername || "?");
  }
  return map;
}
let friendsForListsAt = 0;
const FRIENDS_FOR_LISTS_MS = 5 * 60_000;
function refreshFriendsForLists(onChange) {
  // 21/10 : pas de relecture des amis pendant une partie (une seule a la fermeture du jeu).
  if (!signedIn || gamePlaying || Date.now() - friendsForListsAt < FRIENDS_FOR_LISTS_MS) return;
  friendsForListsAt = Date.now();
  const before = JSON.stringify([...friendsBySlug()]);
  refreshFriends({ background: true }).then(() => {
    if (JSON.stringify([...friendsBySlug()]) !== before) onChange();
  });
}

function serverMatches(server, f, skip, friends) {
  const needle = (f.q || "").trim().toLowerCase();
  if (needle && ![server.name, server.description, server.modpackName].some((v) => String(v || "").toLowerCase().includes(needle))) return false;
  if (skip !== "type" && f.type && f.type !== "all" && server.type !== f.type) return false;
  if (skip !== "online" && f.online && !isServerOnline(server)) return false;
  if (skip !== "lang" && f.lang && f.lang !== "all" && !serverLangsOf(server).includes(f.lang)) return false;
  // Plusieurs styles coches : au moins un (3 etiquettes max par serveur).
  if (skip !== "tags" && f.tags?.length && !serverTagsOf(server).some((tag) => f.tags.includes(tag))) return false;
  if (skip !== "version" && f.version && f.version !== "all" && versionBranch(server.minecraftVersion) !== f.version) return false;
  if (skip !== "friend" && f.friend && !friends.has(server.slug)) return false;
  // Filtre Team (19/10, version C validee par Rushi) : le clic sur le nom d'une team y mene.
  if (skip !== "team" && f.team && f.team !== "all" && teamOf(server)?.slug !== f.team) return false;
  return true;
}

// Team d'apres son slug, lue sur les serveurs de l'annuaire (le site n'a pas de liste des teams).
function teamBySlug(slug) {
  for (const server of allServers) {
    const team = teamOf(server);
    if (team && team.slug === slug) return team;
  }
  return null;
}

// Clic sur le nom d'une team (lignes, fiche, lien omniscient://team/...) : la page Serveurs,
// filtree sur cette team, avec son bandeau. Les autres filtres sont remis a zero.
function showTeamInServers(slug) {
  if (!TEAM_SLUG_RE.test(slug || "")) return;
  listFilters = { ...defaultListFilters(), team: slug };
  listFiltersPanelOpen = false;
  serverListPage = 1;
  showServersView();
}

// Tri stable : a egalite, l'ordre recu (deja du plus recent au plus ancien).
// Tris inversables (19/10, variante A validee par Rushi, memes mots que le site) : `reversed`
// retourne l'ordre. Pour Tendance, Joueurs en ligne, Les plus joues et Petits serveurs actifs,
// les serveurs pas actifs (hors ligne, sans mesure ou vides ; pour « Petits serveurs actifs »,
// aussi ceux a moins de 3 joueurs) restent toujours a la fin, meme inverses : on ne met jamais en
// avant un serveur mort.
const SMALL_ACTIVE_MIN_PLAYERS = 3;
// Duree du « Nouveau » et du coup de pouce en Tendance, en jours : meme valeur que NEW_DAYS du site
// (site/src/lib/serverFilters.ts). Le site calcule isNew lui-meme ; ce nombre ne sert qu'au texte.
const NEW_SERVER_DAYS = 7;
function sortServerRows(servers, sort, reversed = false) {
  const indexed = servers.map((server, index) => ({ server, index }));
  const players = (s) => (isServerOnline(s) ? s.playerCount : -1);
  const cmp = {
    trend: (a, b) => (b.trendScore ?? 0) - (a.trendScore ?? 0),
    players: (a, b) => players(b) - players(a),
    played: (a, b) => (b.launchCount ?? 0) - (a.launchCount ?? 0),
    az: (a, b) => String(a.name).localeCompare(String(b.name)),
    small: (a, b) => players(a) - players(b),
    online: (a, b) => Number(isServerOnline(b)) - Number(isServerOnline(a)) || players(b) - players(a),
  }[sort];
  // Actif = en ligne avec au moins 1 joueur (3 pour « Petits serveurs actifs »), meme regle que le site.
  const activeWith = (min) => (s) => isServerOnline(s) && s.playerCount >= min;
  const counts = { trend: activeWith(1), players: activeWith(1), played: activeWith(1), small: activeWith(SMALL_ACTIVE_MIN_PLAYERS) }[sort];
  const order = (list) => {
    if (cmp) list.sort((a, b) => cmp(a.server, b.server) || a.index - b.index);
    return reversed ? list.reverse() : list;
  };
  if (!counts) return order(indexed).map((entry) => entry.server);
  const live = order(indexed.filter((entry) => counts(entry.server)));
  const rest = indexed.filter((entry) => !counts(entry.server)).sort((a, b) => players(b.server) - players(a.server) || a.index - b.index);
  return [...live, ...rest].map((entry) => entry.server);
}

// Sens affiche sur le bouton ↑↓ (« Plus → moins ») pour chaque tri.
function sortDirLabel(sort, reversed) {
  const pair = String(t(`serverList.sortDir.${sort}`) || "").split("|");
  return pair[reversed ? 1 : 0] || "";
}

function activeFilterKeys(f) {
  const keys = [];
  if (f.type !== "all") keys.push("type");
  if (f.online) keys.push("online");
  if (f.lang !== "all") keys.push("lang");
  for (const tag of f.tags) keys.push(`tag:${tag}`);
  if (f.version !== "all") keys.push("version");
  if (f.friend) keys.push("friend");
  if (f.team && f.team !== "all") keys.push("team");
  return keys;
}
function withoutFilter(f, key) {
  if (key === "type") return { ...f, type: "all" };
  if (key === "online") return { ...f, online: false };
  if (key === "lang") return { ...f, lang: "all" };
  if (key === "version") return { ...f, version: "all" };
  if (key === "friend") return { ...f, friend: false };
  if (key === "team") return { ...f, team: "all" };
  return { ...f, tags: f.tags.filter((tag) => `tag:${tag}` !== key) };
}
function filterKeyLabel(key, f) {
  if (key === "type") return t(`serverCard.${f.type}`);
  if (key === "online") return t("serverList.filterOnline");
  if (key === "lang") return t(`serverList.lang.${f.lang}`);
  if (key === "version") return f.version === "other" ? t("serverList.versionOther") : f.version;
  if (key === "friend") return t("serverList.filterFriend");
  if (key === "team") return `${t("serverList.filterTeam")} : ${teamBySlug(f.team)?.name || f.team}`;
  return tagLabel(key.slice(4));
}

// Le filtre dont le retrait rendrait le plus de serveurs (etat vide : « le filtre qui bloque »).
function blockingFilter(servers, f, friends) {
  let best = null;
  for (const key of activeFilterKeys(f)) {
    const next = withoutFilter(f, key);
    const gain = servers.filter((s) => serverMatches(s, next, null, friends)).length;
    if (!best || gain > best.gain) best = { key, gain };
  }
  return best && best.gain > 0 ? best : null;
}

function filteredServerList() {
  const friends = friendsBySlug();
  const rows = allServers.filter((s) => serverMatches(s, listFilters, null, friends));
  return sortServerRows(rows, listFilters.sort, listFilters.reversed);
}

function chipHtml(key, label, active, count = null, extra = "") {
  const countHtml = count === null ? "" : `<span class="count">${count}</span>`;
  return `<button type="button" class="sort-chip${active ? " active" : ""}" data-fkey="${escapeHtml(key)}" aria-pressed="${active}" ${extra}>${escapeHtml(label)}${countHtml}</button>`;
}

// Barre de filtres de la page Serveurs : ambiances, type, en ligne, langue, ami, panneau
// « Filtres (n) » (styles + versions), filtres actifs et nombre de resultats. Re-dessinee a
// chaque changement (les compteurs bougent) ; le focus clavier est remis sur le meme bouton.
function renderListFilters(shownCount) {
  const el = document.getElementById("list-filters");
  const focusedKey = el.contains(document.activeElement) ? document.activeElement.dataset.fkey : null;
  const f = listFilters;
  const friends = friendsBySlug();
  const pool = (skip) => allServers.filter((s) => serverMatches(s, f, skip, friends));
  const byType = pool("type");
  const byLang = pool("lang");
  const byTags = pool("tags");
  const byVersion = pool("version");
  const versionCounts = new Map();
  for (const s of byVersion) {
    const branch = versionBranch(s.minecraftVersion);
    versionCounts.set(branch, (versionCounts.get(branch) || 0) + 1);
  }
  if (f.version !== "all" && !versionCounts.has(f.version)) versionCounts.set(f.version, 0);
  const rank = (b) => (b === "other" ? -1 : Number(b.slice(2)));
  const versions = [...versionCounts.entries()].sort((a, b) => rank(b[0]) - rank(a[0]));
  // Barre allegee (19/10, preview « Filtre Team » version C validee) : la barre garde la recherche,
  // Tous / Vanilla / Moddés et « Filtres » ; En ligne, Un ami y joue, langue, style, version et team
  // vont dans le panneau. Le bouton compte tout ce qui est actif dans le panneau.
  const panelCount = activeFilterKeys(f).filter((key) => key !== "type").length;
  // Teams presentes (avec leur nombre de serveurs selon les autres filtres), la plus grosse d'abord.
  const teamCounts = new Map();
  for (const s of pool("team")) {
    const team = teamOf(s);
    if (!team) continue;
    const entry = teamCounts.get(team.slug) || { team, count: 0 };
    entry.count += 1;
    teamCounts.set(team.slug, entry);
  }
  if (f.team !== "all" && !teamCounts.has(f.team)) teamCounts.set(f.team, { team: teamBySlug(f.team) || { slug: f.team, name: f.team }, count: 0 });
  const teams = [...teamCounts.values()].sort((a, b) => b.count - a.count || a.team.name.localeCompare(b.team.name));
  // Sans tags ni versions (site plus ancien), le panneau n'aurait rien a proposer.
  const hasPanel = allServers.length > 0;
  const hasLangs = allServers.some((s) => serverLangsOf(s).length);
  const showFriend = signedIn && (f.friend || friends.size > 0);

  const typeSeg = ["all", "vanilla", "modded"]
    .map((type) => chipHtml(`type:${type}`, type === "all" ? t("serverList.filterAll") : t(`serverCard.${type}`), f.type === type, byType.filter((s) => type === "all" || s.type === type).length))
    .join("");
  const langSeg = ["all", ...FILTER_LANGS]
    .map((lang) => chipHtml(`lang:${lang}`, t(`serverList.lang.${lang}`), f.lang === lang, lang === "all" ? null : byLang.filter((s) => serverLangsOf(s).includes(lang)).length))
    .join("");
  const section = (title, body, extra = "") => `<div class="list-filters-section"><div class="list-filters-panel-title">${title}${extra}</div>${body}</div>`;
  const statusChips =
    chipHtml("online", t("serverList.filterOnline"), f.online, pool("online").filter(isServerOnline).length) +
    (showFriend ? chipHtml("friend", t("serverList.filterFriend"), f.friend, pool("friend").filter((s) => friends.has(s.slug)).length) : "");
  const tagChips = filterTags()
    .filter((tag) => f.tags.includes(tag) || byTags.some((s) => serverTagsOf(s).includes(tag)))
    .map((tag) => chipHtml(`tag:${tag}`, tagLabel(tag), f.tags.includes(tag), byTags.filter((s) => serverTagsOf(s).includes(tag)).length))
    .join("");
  const versionChips =
    chipHtml("version:all", t("serverList.versionAll"), f.version === "all") +
    versions.map(([value, count]) => chipHtml(`version:${value}`, value === "other" ? t("serverList.versionOther") : value, f.version === value, count)).join("");
  // Section Team : recherche (utile quand il y aura beaucoup de teams), icone, nom et nombre de serveurs.
  const teamList = teams
    .map(
      ({ team, count }) =>
        `<button type="button" class="filters-team-item${f.team === team.slug ? " active" : ""}" data-fkey="team:${escapeHtml(f.team === team.slug ? "all" : team.slug)}" data-team-name="${escapeHtml(team.name.toLowerCase())}" aria-pressed="${f.team === team.slug}">${teamAvatarHtml(team, 18)}<span>${escapeHtml(team.name)}</span><small>${count}</small></button>`,
    )
    .join("");
  const panel = listFiltersPanelOpen
    ? `<div class="list-filters-panel" role="dialog" aria-label="${escapeHtml(t("serverList.filters"))}">
        ${section(t("serverList.filterType"), `<div class="list-filters-wrap">${typeSeg}</div>`)}
        ${section(t("serverList.filterStatus"), `<div class="list-filters-wrap">${statusChips}</div>`)}
        ${tagChips ? section(t("serverList.style"), `<div class="list-filters-wrap">${tagChips}</div>`, ` <span class="muted">${t("serverList.styleHelp")}</span>`) : ""}
        ${hasLangs ? section(t("serverList.filterLang"), `<div class="list-filters-wrap">${langSeg}</div>`) : ""}
        ${versions.length ? section(t("serverList.version"), `<div class="list-filters-wrap">${versionChips}</div>`) : ""}
        ${
          teams.length
            ? section(
                t("serverList.filterTeam"),
                `${teams.length ? `<input type="search" id="filters-team-search" class="filters-team-search" placeholder="${escapeHtml(t("serverList.teamSearch"))}" autocomplete="off" />` : ""}<div class="filters-team-list">${teamList}</div>`,
              )
            : ""
        }
        <div class="list-filters-panel-foot">${panelCount ? `<button type="button" class="link-btn" data-fkey="clear">${t("serverList.clearAll")}</button>` : ""}</div>
      </div>`
    : "";
  const active = activeFilterKeys(f);
  const activeChips = active.length
    ? `<div class="list-filters-active">${active
        .map((key) => `<button type="button" class="active-chip" data-fkey="remove:${escapeHtml(key)}" aria-label="${escapeHtml(t("serverList.removeFilter", { filter: filterKeyLabel(key, f) }))}">${escapeHtml(filterKeyLabel(key, f))} <span aria-hidden="true">✕</span></button>`)
        .join("")}<button type="button" class="link-btn" data-fkey="clear">${t("serverList.clearAll")}</button></div>`
    : "";

  el.innerHTML = `
    <div class="list-filters-row">
      <div class="instances-filters" title="${escapeHtml(t("serverList.typeHelp"))}">${typeSeg}</div>
      ${hasPanel ? `<div class="list-filters-anchor">${chipHtml("panel", panelCount ? `${t("serverList.filters")} (${panelCount})` : t("serverList.filters"), listFiltersPanelOpen || panelCount > 0, null, `aria-expanded="${listFiltersPanelOpen}"`)}${panel}</div>` : ""}
      <span class="list-sort-group" id="list-sort-slot"></span>
      ${bandLegendHtml()}
      <span class="list-filters-count" aria-live="polite">${t("serverList.resultCount", { count: shownCount })}</span>
    </div>
    ${listFilters.sort === "trend" ? `<p class="list-filters-note">${t("serverList.trendNote", { days: NEW_SERVER_DAYS })}</p>` : ""}
    ${activeChips}
    ${f.team !== "all" ? teamFilterBannerHtml(f.team, shownCount) : ""}`;

  el.querySelectorAll("[data-fkey]").forEach((btn) => btn.addEventListener("click", (event) => {
    event.stopPropagation();
    applyFilterKey(btn.dataset.fkey);
  }));
  el.querySelector("[data-team-site]")?.addEventListener("click", (event) => window.mchub.openTeamLink("team", event.currentTarget.dataset.teamSite));
  // Le menu « Trier » (element fixe, son ecouteur reste) est deplace a droite de « Filtres ».
  const sortSlot = el.querySelector("#list-sort-slot");
  if (sortSlot) {
    listSortSelectEl.value = listFilters.sort;
    sortSlot.append(listSortSelectEl.closest(".list-sort-label"), listSortDirBtn);
    syncListSortDir();
  }
  // « Chercher une team… » : filtre la liste du panneau sans le redessiner (le texte tape reste).
  el.querySelector("#filters-team-search")?.addEventListener("input", (event) => {
    const needle = event.target.value.trim().toLowerCase();
    el.querySelectorAll(".filters-team-item").forEach((item) => {
      item.hidden = Boolean(needle) && !item.dataset.teamName.includes(needle);
    });
  });
  if (focusedKey) el.querySelector(`[data-fkey="${CSS.escape(focusedKey)}"]`)?.focus();
}

function teamFilterBannerHtml(slug, count) {
  const team = teamBySlug(slug) || { slug, name: slug };
  return `
    <div class="team-filter-banner">
      ${teamAvatarHtml(team, 44)}
      <div class="team-filter-txt">
        <b>${escapeHtml(team.name)}</b> <span class="muted">· ${escapeHtml(t("serverList.teamServerCount", { count }))}</span>
        ${team.description ? `<p>${escapeHtml(team.description)}</p>` : ""}
      </div>
      <button type="button" class="link-btn" data-team-site="${escapeHtml(team.slug)}">${escapeHtml(t("serverList.teamOnSite"))}</button>
      <button type="button" class="btn-secondary" data-fkey="remove:team">${escapeHtml(t("serverList.teamRemove"))}</button>
    </div>`;
}

function applyFilterKey(key) {
  const f = listFilters;
  const [kind, value] = key.split(/:(.*)/s);
  if (kind === "type") listFilters = { ...f, type: value };
  else if (kind === "lang") listFilters = { ...f, lang: value };
  else if (kind === "online") listFilters = { ...f, online: !f.online };
  else if (kind === "friend") listFilters = { ...f, friend: !f.friend };
  else if (kind === "tag") listFilters = { ...f, tags: f.tags.includes(value) ? f.tags.filter((tag) => tag !== value) : [...f.tags, value] };
  else if (kind === "version") listFilters = { ...f, version: value };
  else if (kind === "team") listFilters = { ...f, team: value || "all" };
  else if (kind === "remove") listFilters = withoutFilter(f, value);
  else if (kind === "clear") listFilters = { ...defaultListFilters(), q: f.q, sort: f.sort };
  else if (kind === "panel") listFiltersPanelOpen = !listFiltersPanelOpen;
  serverListPage = 1;
  renderFilteredList();
}

// Le panneau « Filtres » se ferme avec Echap ou un clic en dehors.
document.addEventListener("click", (event) => {
  if (!listFiltersPanelOpen || event.target.closest?.(".list-filters-anchor")) return;
  listFiltersPanelOpen = false;
  renderFilteredList();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !listFiltersPanelOpen) return;
  listFiltersPanelOpen = false;
  renderFilteredList();
  document.querySelector('#list-filters [data-fkey="panel"]')?.focus();
});

// Etat vide quand des filtres ne laissent rien : on nomme le filtre qui bloque.
function filtersEmptyHtml() {
  const friends = friendsBySlug();
  const block = blockingFilter(allServers, listFilters, friends);
  const remove = block
    ? `<button type="button" class="btn-secondary" data-empty="remove:${escapeHtml(block.key)}">${escapeHtml(t("serverList.noneRemove", { filter: filterKeyLabel(block.key, listFilters) }))} (+${block.gain})</button>`
    : "";
  const clear = activeFilterKeys(listFilters).length ? `<button type="button" class="btn-secondary" data-empty="clear">${t("serverList.clearAll")}</button>` : "";
  const query = (listFilters.q || document.getElementById("server-search")?.value || "").trim();
  const title = query ? t("serverList.noneForQuery", { query }) : t(activeFilterKeys(listFilters).length ? "serverList.noneTitle" : "serverList.noResults");
  return `
    <div class="filters-empty empty-state">
      <span class="empty-state-icon">${EMPTY_ICONS.search}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(block ? t("serverList.noneHint", { filter: filterKeyLabel(block.key, listFilters) }) : t("serverList.noneTry"))}</p>
      <div class="filters-empty-actions">${remove}${clear.replace('class="btn-secondary"', 'class="join-btn"')}</div>
    </div>`;
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

// `playedAtBySlug` : page Recents seulement (date de la derniere partie de chaque serveur).
async function renderRowsInto(container, servers, origin, onFavoriteToggled, playedAtBySlug = null) {
  const favorites = await getFavoriteSlugs();
  container.innerHTML = servers
    .map((server) => serverRowHtml(server, favorites.includes(server.slug), playedAtBySlug?.[server.slug] ?? null, origin === "favorites" || origin === "recent" || origin === "installed"))
    .join("");

  container.querySelectorAll("[data-team-filter]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      showTeamInServers(btn.dataset.teamFilter);
    });
  });

  // « … » des lignes (option C) : Installer (meme pendant une partie) et Voir la fiche.
  container.querySelectorAll(".row-more-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = btn.parentElement.querySelector(".instance-menu");
      const opening = menu.hidden;
      closeInstanceMenus();
      menu.hidden = !opening;
      btn.setAttribute("aria-expanded", String(opening));
    });
  });
  container.querySelectorAll("[data-row-install]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeInstanceMenus();
      const server = servers.find((item) => item.slug === btn.dataset.rowInstall);
      if (server) installServerStandalone(server, null);
    });
  });
  container.querySelectorAll("[data-row-open]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeInstanceMenus();
      detailOrigin = origin;
      openDetail(btn.dataset.rowOpen);
    });
  });

  // ▶ : lance sans ouvrir la fiche (meme garde que partout : launchServer refuse un 2e lancement).
  container.querySelectorAll(".row-play").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const server = servers.find((item) => item.slug === btn.dataset.playSlug);
      if (!server || btn.disabled) return;
      btn.disabled = true;
      try {
        await launchServer(server);
      } finally {
        btn.disabled = false;
      }
    });
  });

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
      onFavoriteToggled();
    });
  });
}

// Meme pagination que "Mes instances" (voir MY_INSTANCES_PAGE_SIZE) : une dizaine de
// serveurs a la fois, sinon l'annuaire complet serait interminable a faire defiler.
let serverListPage = 1;
const SERVER_LIST_PAGE_SIZE = 10;

async function renderFilteredList() {
  const filtered = filteredServerList();
  renderListFilters(filtered.length);
  statusEl.hidden = true;
  if (filtered.length === 0) {
    listEl.innerHTML = filtersEmptyHtml();
    document.getElementById("server-list-pager-slot").innerHTML = "";
    listEl.querySelectorAll("[data-empty]").forEach((btn) => btn.addEventListener("click", () => applyFilterKey(btn.dataset.empty)));
    return;
  }

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
  updateGuestBanner(true);
  allServers = servers;

  if (servers.length === 0) {
    listEl.innerHTML = "";
    statusEl.hidden = false;
    statusEl.textContent = t("serverList.empty");
    return;
  }

  statusEl.hidden = true;
  renderFilteredList();
  refreshFriendsForLists(() => {
    if (!listEl.hidden) renderFilteredList();
  });
}

// Recherche en direct (nom, description, modpack), sans appel reseau : la liste est deja la.
listSearchInputEl.addEventListener("input", () => {
  listFilters = { ...listFilters, q: listSearchInputEl.value };
  serverListPage = 1;
  renderFilteredList();
});
const listRefreshBtn = document.getElementById("list-refresh");
const LIST_REFRESH_COOLDOWN_S = 30;
let listRefreshTimer = null;
listRefreshBtn.addEventListener("click", async () => {
  if (listRefreshTimer) return;
  // « Actualiser » : seule façon voulue de passer outre le cache d'une minute (voir main.js).
  await window.mchub.clearServerCache();
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

// Bouton ↑↓ a cote du menu « Trier » : inverse l'ordre et dit dans quel sens on est.
const listSortDirBtn = document.createElement("button");
listSortDirBtn.type = "button";
listSortDirBtn.id = "list-sort-dir";
listSortDirBtn.className = "list-sort-dir";
listSortDirBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  listFilters = { ...listFilters, reversed: !listFilters.reversed };
  serverListPage = 1;
  renderFilteredList();
});
function syncListSortDir() {
  const label = sortDirLabel(listFilters.sort, listFilters.reversed);
  listSortDirBtn.innerHTML = `<span aria-hidden="true">${listFilters.reversed ? "↑" : "↓"}</span><small>${escapeHtml(label)}</small>`;
  listSortDirBtn.title = t("serverList.sortReverse");
  listSortDirBtn.setAttribute("aria-label", `${t("serverList.sortReverse")} : ${label}`);
}

listSortSelectEl.addEventListener("change", () => {
  // Un nouveau tri repart toujours dans son sens habituel.
  listFilters = { ...listFilters, sort: LIST_SORTS.includes(listSortSelectEl.value) ? listSortSelectEl.value : "recent", reversed: false };
  serverListPage = 1;
  renderFilteredList();
});

// Serveur gelé par l'équipe : même fiche, avec « Serveur gelé » à la place de « Rejoindre ».
// Fiche disparue (19/10) : supprimee, ou plus publique. Au lieu d'une page vide ou d'une ligne
// d'erreur, un message clair et ce qu'on peut encore faire (dossier installe, retirer des listes).
async function renderMissingDetail(slug) {
  listEl.hidden = true;
  statusEl.hidden = true;
  detailEl.hidden = false;
  const local = await window.mchub.listLocalInstances().catch(() => ({ instances: [] }));
  const installed = (local?.instances || []).some((instance) => instance.slug === slug);
  detailEl.innerHTML = `
    ${detailBreadcrumbHtml(slug)}
    <div class="detail-missing">
      <h2>${escapeHtml(slug)}</h2>
      <p>${escapeHtml(t("serverDetail.missingText"))}</p>
      <div class="detail-missing-actions">
        ${installed ? `<button type="button" class="btn-secondary" id="missing-folder">${escapeHtml(t("myInstances.menuFolder"))}</button>` : ""}
        <button type="button" class="btn-secondary" id="missing-forget">${escapeHtml(t("serverDetail.missingForget"))}</button>
      </div>
      ${installed ? `<p class="join-note">${escapeHtml(t("serverDetail.missingInstalledNote"))}</p>` : ""}
    </div>`;
  wireDetailBreadcrumb();
  document.getElementById("missing-folder")?.addEventListener("click", () => window.mchub.instances.openFolder(slug));
  document.getElementById("missing-forget")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    await pruneDeadSlug(slug);
    toolsToast(t("serverDetail.missingForgotten"));
  });
}

function renderFrozenDetail(slug) {
  listEl.hidden = true;
  statusEl.hidden = true;
  detailEl.hidden = false;
  detailEl.innerHTML = `
    ${detailBreadcrumbHtml(slug)}
    <h2 style="margin: 16px 0 8px 0;">${escapeHtml(slug)}</h2>
    <p style="color: var(--frozen); margin: 0 0 16px 0;">${t("serverDetail.frozenText")}</p>
    <button class="join-btn" disabled style="color: var(--frozen); border-color: var(--frozen);">${t("serverDetail.frozenBtn")}</button>
  `;
  wireDetailBreadcrumb();
}

// Fiche personnalisable (16/10, disposition « deux colonnes » validee par Rushi) : le site envoie
// server.page (voir site/src/lib/serverPage.ts), server.discordUrl et server.websiteUrl. Tout le
// texte du proprietaire passe par escapeHtml ; seuls **gras**, *italique*, « ## titre » et
// « - liste » sont mis en forme, apres echappement. Les liens ne sont jamais des <a> (la fenetre
// ne navigue pas) : un clic demande a main.js de les re-verifier puis d'ouvrir le navigateur.
const PAGE_SECTIONS = ["about", "gallery", "video", "rules", "social"];
const DOWNLOAD_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
const PAGE_ACCENTS = { blue: "#2f78ad", green: "#2f9e6e", violet: "#7a5bd0", orange: "#d0742f", red: "#c0453f", gold: "#b08a1a" };
// Liste fermee de 30 etiquettes (16/10), meme ordre que site/src/lib/serverPage.ts.
const PAGE_TAGS = [
  "survival", "creative", "pvp", "pve", "coop", "roleplay", "minigames", "tech", "magic", "adventure",
  "economy", "hardcore", "skyblock", "factions", "bedwars", "prison", "towny", "smp", "anarchy", "events",
  "quests", "dungeons", "building", "redstone", "farming", "exploration", "competitive", "chill", "whitelist", "bedrock",
];
const PAGE_LANGUAGES = ["fr", "en"];
// Couleur libre : un #rrggbb seulement. Trop claire ou trop sombre, elle est ajustee selon le
// theme pour rester lisible (memes seuils que le site : ACCENT_PALE / ACCENT_DEEP).
const ACCENT_PALE = 0.35;
const ACCENT_DEEP = 0.08;
function accentLuminance(hex) {
  const lin = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}
const SOCIAL_ICONS = {
  discord:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.3 5.3A17 17 0 0 0 15 4l-.5 1a15.6 15.6 0 0 0-5 0L9 4a17 17 0 0 0-4.3 1.3C2 9.4 1.3 13.4 1.6 17.3A17.2 17.2 0 0 0 6.9 20l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.3 12.3 0 0 0 10.6 0l.4.3a11 11 0 0 1-1.7.8l1.1 1.8a17.1 17.1 0 0 0 5.3-2.7c.4-4.5-.7-8.5-3.1-12ZM8.5 14.9c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Zm7 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Z"/></svg>',
  website:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z"/></svg>',
  youtube:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.6 2.6 0 0 0-1.8 1.8A27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z"/></svg>',
  tiktok:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 3h-3.2v12.2a2.8 2.8 0 1 1-2-2.7V9.2a6 6 0 1 0 5.2 6V9a7.6 7.6 0 0 0 4.4 1.4V7.2a4.4 4.4 0 0 1-4.4-4.2Z"/></svg>',
};

// La fiche telle qu'envoyee par le site, relue prudemment : un site plus ancien (sans « page »)
// ou une valeur inattendue donnent simplement une fiche sans sections, comme avant.
function readServerPage(server) {
  const raw = server && typeof server.page === "object" && server.page ? server.page : {};
  const str = (v) => (typeof v === "string" ? v : "");
  const order = Array.isArray(raw.order) ? raw.order.filter((s) => PAGE_SECTIONS.includes(s)) : [];
  for (const s of PAGE_SECTIONS) if (!order.includes(s)) order.push(s);
  return {
    accent:
      typeof raw.accent === "string" && (Object.hasOwn(PAGE_ACCENTS, raw.accent) || /^#[0-9a-f]{6}$/.test(raw.accent)) ? raw.accent : null,
    wallpaper: raw.wallpaper === true,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => PAGE_TAGS.includes(tag)).slice(0, 3) : [],
    extraTags: Array.isArray(raw.extraTags)
      ? raw.extraTags.filter((tag) => PAGE_TAGS.includes(tag) && !(Array.isArray(raw.tags) && raw.tags.includes(tag))).slice(0, 8)
      : [],
    languages: Array.isArray(raw.languages) ? [...new Set(raw.languages.filter((l) => PAGE_LANGUAGES.includes(l)))] : [],
    order,
    hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((s) => PAGE_SECTIONS.includes(s)) : [],
    about: str(raw.about).slice(0, 2000),
    gallery: Array.isArray(raw.gallery)
      ? raw.gallery
          .filter((g) => g && safeHttpsUrl(g.url))
          .slice(0, 3)
          .map((g) => ({ url: safeHttpsUrl(g.url), caption: str(g.caption).slice(0, 40) }))
      : [],
    videoId: typeof raw.videoId === "string" && /^[\w-]{11}$/.test(raw.videoId) ? raw.videoId : null,
    videoAutoplay: raw.videoAutoplay === true,
    rules: Array.isArray(raw.rules) ? raw.rules.filter((r) => typeof r === "string" && r.trim()).slice(0, 8).map((r) => r.slice(0, 120)) : [],
    youtubeUrl: str(raw.youtubeUrl) || null,
    tiktokUrl: str(raw.tiktokUrl) || null,
  };
}

// Adresse d'image ou de lien : https seulement, normalisee par URL (guillemets et espaces
// encodes), donc sure dans un attribut ou dans url("...").
function safeHttpsUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function pageVisibleSections(page, server) {
  const hasContent = {
    about: !!page.about.trim(),
    gallery: page.gallery.length > 0,
    video: !!page.videoId,
    rules: page.rules.length > 0,
    social: !!(server.discordUrl || server.websiteUrl || page.youtubeUrl || page.tiktokUrl),
  };
  return page.order.filter((s) => !page.hidden.includes(s) && hasContent[s]);
}

function richInlineHtml(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*|\*(.+?)\*/g, (_m, bold, italic) =>
    bold !== undefined ? `<strong>${bold}</strong>` : `<em>${italic}</em>`,
  );
}

// Meme mise en forme que site/src/components/RichText.tsx.
function richTextHtml(source) {
  const blocks = [];
  let para = [];
  let list = [];
  const flushPara = () => {
    if (para.length) blocks.push(`<p>${para.map(richInlineHtml).join("<br />")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(`<ul>${list.map((item) => `<li>${richInlineHtml(item)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const line of source.split("\n")) {
    if (/^##\s+/.test(line)) {
      flushPara();
      flushList();
      blocks.push(`<h4>${richInlineHtml(line.replace(/^##\s+/, ""))}</h4>`);
    } else if (/^-\s+/.test(line)) {
      flushPara();
      list.push(line.replace(/^-\s+/, ""));
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return `<div class="page-rich">${blocks.join("")}</div>`;
}

function pageSectionBodyHtml(section, page, server) {
  switch (section) {
    case "about":
      return richTextHtml(page.about);
    case "gallery":
      return `<div class="page-gallery count-${page.gallery.length}">${page.gallery
        .map(
          (item, i) => `
          <button type="button" class="page-gallery-item" data-gallery-index="${i}" aria-label="${escapeHtml(item.caption || t("serverPage.image", { n: i + 1 }))}">
            <img src="${escapeHtml(item.url)}" alt="" />
            ${item.caption ? `<span>${escapeHtml(item.caption)}</span>` : ""}
          </button>`,
        )
        .join("")}</div>`;
    case "video":
      // Repli du 16/10 (VIDEO_EMBED_ENABLED coupe : YouTube demandait de se connecter) : la
      // vignette ouvre la video sur YouTube, dans le navigateur.
      if (!VIDEO_EMBED_ENABLED) {
        return `
        <button type="button" class="page-video" data-link-kind="video" data-link-value="${escapeHtml(page.videoId)}" aria-label="${escapeHtml(t("serverPage.videoCaption"))}">
          <span class="page-video-play"></span>
        </button>
        <p class="page-video-note">${t("serverPage.videoCaption")}</p>`;
      }
      // Vignette sans requete vers YouTube, lecteur youtube-nocookie au clic (ou tout seul et
      // sans le son si le proprietaire a coche « Lancer automatiquement », voir setupPageVideo).
      return `
        <div class="page-video-box" data-video-id="${escapeHtml(page.videoId)}" data-video-autoplay="${page.videoAutoplay ? "1" : ""}">
          <button type="button" class="page-video" aria-label="${escapeHtml(t("serverPage.videoPlay"))}">
            <span class="page-video-play"></span>
          </button>
        </div>
        <p class="page-video-note">${t("serverPage.videoCookies")}
          <button type="button" class="page-video-open" data-link-kind="video" data-link-value="${escapeHtml(page.videoId)}">${t("serverPage.videoOpen")}</button>
        </p>
        <p class="page-video-autonote">${t("serverPage.videoAutoplayNote")}</p>`;
    case "rules":
      return `<ol class="page-rules">${page.rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ol>`;
    case "social": {
      const links = [
        ["discord", server.discordUrl],
        ["website", server.websiteUrl],
        ["youtube", page.youtubeUrl],
        ["tiktok", page.tiktokUrl],
      ].filter(([, href]) => !!href);
      return `<div class="page-social">${links
        .map(
          ([kind, href]) => `
          <button type="button" class="page-social-btn" data-link-kind="${kind}" data-link-value="${escapeHtml(href)}" title="${escapeHtml(href)}">
            ${SOCIAL_ICONS[kind]}${t(`serverPage.social.${kind}`)}
          </button>`,
        )
        .join("")}</div>`;
    }
    default:
      return "";
  }
}

// Agrandit une image de la galerie ; Echap ou un clic la referme.
function openGalleryLightbox(item, index) {
  const overlay = document.createElement("div");
  overlay.className = "page-lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", item.caption || t("serverPage.image", { n: index + 1 }));
  overlay.innerHTML = `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.caption)}" />`;
  const close = () => {
    overlay.remove();
    window.removeEventListener("keydown", onKey);
  };
  const onKey = (event) => {
    if (event.key === "Escape") close();
  };
  overlay.addEventListener("click", close);
  window.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

// Lecteur integre, lancement automatique, reglage « Bloquer » et petite phrase : coupes le 16/10
// (YouTube demandait de se connecter, « pas un robot »). Le code reste ; true pour les reactiver.
const VIDEO_EMBED_ENABLED = true; // rallume le 18/10 (test de Rushi : le lecteur marche)

// Video de la fiche (16/10) : le lecteur YouTube (domaine youtube-nocookie) ne se charge qu'au
// clic, ou des que la video est visible a 90 % si le proprietaire a coche « Lancer
// automatiquement » (alors sans le son). L'identifiant est deja verifie par readServerPage.
// Le joueur peut l'interdire dans Parametres > Divers (blockVideoAutoplay) : clic seulement.
function setupPageVideo(box, blockAutoplay) {
  const id = box.dataset.videoId;
  if (!/^[\w-]{11}$/.test(id || "")) return;
  let observer = null;
  const play = (muted) => {
    if (observer) observer.disconnect();
    if (box.querySelector("iframe")) return;
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1${muted ? "&mute=1" : ""}`;
    frame.title = t("serverPage.videoPlay");
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    box.replaceChildren(frame);
  };
  box.querySelector(".page-video")?.addEventListener("click", () => play(false));
  if (box.dataset.videoAutoplay === "1" && !blockAutoplay) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) play(true);
    }, { threshold: 0.9 });
    observer.observe(box);
  }
}

// Couleur choisie par le proprietaire : remplace l'accent sur la fiche seulement. Les teintes
// derivees (--accent-hover, --accent-fill...) sont calculees sur :root, donc redeclarees ici.
function applyPageTheme(page, server) {
  let accent = page.accent ? PAGE_ACCENTS[page.accent] || page.accent : null;
  let onAccent = "#ffffff";
  if (accent) {
    const lum = accentLuminance(accent);
    const light = document.documentElement.dataset.theme === "light";
    if (lum > ACCENT_PALE) {
      if (light) accent = `color-mix(in srgb, ${accent} 55%, black)`;
      else onAccent = "#15161d";
    } else if (lum < ACCENT_DEEP && !light) {
      accent = `color-mix(in srgb, ${accent} 55%, white)`;
      onAccent = "#15161d";
    }
  }
  detailEl.style.cssText = accent
    ? `--accent: ${accent}; --accent-hover: color-mix(in srgb, ${accent} 70%, white); --accent-2: color-mix(in srgb, ${accent} 85%, white); --accent-fill: color-mix(in srgb, ${accent} 45%, black); --accent-on: ${onAccent};`
    : "";
  // Fond d'ecran pleine page : pose sur <main> (le conteneur qui defile), visible seulement
  // tant que cette fiche est affichee (voir main:has(> #detail.has-wallpaper) dans index.html).
  const wallpaper = page.wallpaper ? safeHttpsUrl(server.backgroundUrl) : null;
  detailEl.classList.toggle("has-wallpaper", !!wallpaper);
  const mainEl = detailEl.parentElement;
  if (wallpaper) mainEl.style.setProperty("--detail-wallpaper", `url("${wallpaper}")`);
  else mainEl.style.removeProperty("--detail-wallpaper");
}

function clearPageTheme() {
  detailEl.style.cssText = "";
  detailEl.classList.remove("has-wallpaper");
}

// Derniere fiche affichee : la pilule s'en sert pour retrouver un serveur prive (voir knownServer).
var currentDetailServer = null;

// En-tete de fiche, variante A (19/10, choisie par Rushi) : l'icone prend la hauteur du bloc de
// texte a cote (nom, team, etiquettes), entre 44 et 108 px, coins arrondis. Recalculee quand la
// fenetre change de largeur (le texte peut passer sur plus ou moins de lignes).
const DETAIL_ICON_MIN = 44;
const DETAIL_ICON_MAX = 108;
let detailIconObserver = null;
function fitDetailIcon() {
  const head = detailEl.querySelector(".detail-header-col");
  const icon = head?.querySelector(".detail-icon-fit");
  const text = head?.querySelector(".detail-head-text");
  if (!icon || !text) return;
  const apply = () => {
    const size = Math.max(DETAIL_ICON_MIN, Math.min(DETAIL_ICON_MAX, Math.round(text.offsetHeight)));
    icon.style.width = icon.style.height = `${size}px`;
    icon.style.fontSize = `${Math.round(size * 0.38)}px`;
    icon.style.borderRadius = `${Math.max(12, Math.round(size * 0.2))}px`;
  };
  apply();
  detailIconObserver?.disconnect();
  if (typeof ResizeObserver !== "undefined") {
    detailIconObserver = new ResizeObserver(apply);
    detailIconObserver.observe(text);
  }
}

async function renderDetail(server) {
  currentDetailServer = server;
  // Une fiche s'affiche seule : jamais l'en-tete de la page Serveurs (titre, recherche, filtres).
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
  listEl.hidden = true;
  updateGuestBanner(false);
  ownerInstallMessage(server);
  listEl.hidden = true;
  statusEl.hidden = true;
  detailEl.hidden = false;

  const page = readServerPage(server);
  const sections = pageVisibleSections(page, server);

  const tags = [`<span class="tag-chip">${server.type === "modded" ? t("serverCard.modded") : t("serverCard.vanilla")}</span>`];
  for (const tag of page.tags) tags.push(`<span class="tag-chip tag-chip-accent">${escapeHtml(tagLabel(tag))}</span>`);
  // Langue : meme etiquette que les lignes (variante A du 20/10), le code avec le nom en infobulle.
  for (const lang of page.languages) tags.push(`<span class="lang-code${page.languages.length === 1 ? " solo" : ""}" title="${escapeHtml(t(`serverPage.languages.${lang}`))}">${escapeHtml(lang.toUpperCase())}</span>`);
  if (!page.languages.length) tags.push(`<span class="lang-code none">${escapeHtml(t("serverList.noLang"))}</span>`);

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
  const isFav = (await getFavoriteSlugs()).includes(server.slug);
  // Lot 3 (audit 17/10) : le bouton principal dit l'action reelle, et « Installer » n'apparait
  // plus deux fois.
  const action = detailJoinAction(server, { installed: !showInstallBtn });

  const modpack =
    server.type === "modded" && server.curseforgeModpackName
      ? `${escapeHtml(server.curseforgeModpackName)}${server.curseforgeModpackVersion ? ` — ${escapeHtml(server.curseforgeModpackVersion)}` : ""}`
      : "";
  // Presentation vide ou masquee : la description courte reste visible, comme avant.
  const showDescription = !page.about.trim() || page.hidden.includes("about");

  applyPageTheme(page, server);
  detailEl.innerHTML = `
    ${detailBreadcrumbHtml(server.name)}
    <div class="detail-hero">
      <div class="detail-banner">
        ${server.bannerUrl ? `<img src="${escapeHtml(server.bannerUrl)}" alt="" />` : ""}
      </div>
    </div>
    <div class="detail-header detail-header-col">
      <div class="detail-icon detail-icon-inline detail-icon-fit">${serverIconInner(server)}</div>
      <div class="detail-head-text">
        <div class="detail-head-title">
          <h2 style="margin: 0;">${escapeHtml(server.name)}</h2>
          ${serverStatePillHtml(server)}
          ${manualModsBadgeHtml(server)}
        </div>
        ${teamBylineHtml(server)}
        <div class="tag-row">${tags.join("")}</div>
      </div>
    </div>
    <div class="detail-columns">
      <div class="detail-main">
        ${showDescription ? `<section class="detail-card"><p class="desc">${escapeHtml(server.description)}</p></section>` : ""}
        ${sections
          .map(
            (section) => `
          <section class="detail-card">
            <h3 class="detail-card-title">${t(`serverPage.sections.${section}`)}</h3>
            ${pageSectionBodyHtml(section, page, server)}
          </section>`,
          )
          .join("")}
      </div>
      <aside class="detail-side">
        <div class="detail-card detail-actions">
          <button class="join-btn join-btn-wide" id="join-btn" data-join-slug="${escapeHtml(server.slug)}" data-base-class="join-btn-wide" data-join-label="${action.label}" data-join-action="${action.kind}"${action.blocked ? ' data-join-blocked="1"' : ""}>${escapeHtml(t(action.label))}</button>
          ${server.addToServerList === false ? `<p class="detail-list-note"><i aria-hidden="true"></i>${escapeHtml(t("serverDetail.noServerListNote"))}</p>` : ""}
          <div class="detail-actions-row">
            ${showInstallBtn && action.kind !== "install" ? `<button class="btn-secondary" id="install-btn" type="button">${DOWNLOAD_SVG}${t("serverDetail.installBtn")}</button>` : ""}
            <button class="btn-secondary detail-fav-btn${isFav ? " active" : ""}" type="button" aria-pressed="${isFav}">${STAR_SVG}${isFav ? t("serverPage.favOn") : t("serverPage.fav")}</button>
            ${
              signedIn
                ? `<button class="btn-secondary detail-report-btn" id="report-open-btn" type="button">${FLAG_SVG}${t("serverDetail.report")}</button>`
                : ""
            }
          </div>
        </div>
        <section class="detail-card">
          <h3 class="detail-card-title">${t("serverPage.infos")}</h3>
          <div class="detail-info-grid">
            <div class="stat-tile">
              <div class="stat-label">${t("serverDetail.version")}</div>
              <div class="stat-value">${escapeHtml(server.minecraftVersion)}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-label">${t("serverDetail.players")}</div>
              <div class="stat-value${fillLevel(server) && fillLevel(server) !== "ok" ? ` players-fill ${fillLevel(server)}` : ""}">${escapeHtml(playersText(server))}${fillLevel(server) === "full" ? ` · ${escapeHtml(t("serverCard.full"))}` : ""}</div>
              ${fillLevel(server) ? `<div class="players-gauge ${fillLevel(server)}"><i style="width:${Math.min(100, Math.round((server.playerCount / server.playerCapacity) * 100))}%"></i></div>` : ""}
            </div>
            <div class="stat-tile">
              <div class="stat-label">${t("serverPage.type")}</div>
              <div class="stat-value">${server.type === "modded" ? t("serverCard.modded") : t("serverCard.vanilla")}</div>
            </div>
            ${
              server.recommendedRamGB
                ? `<div class="stat-tile">
                    <div class="stat-label">${t("serverDetail.recommendedRam")}</div>
                    <div class="stat-value">${escapeHtml(String(server.recommendedRamGB))} ${t("serverDetail.ramUnit")}</div>
                  </div>`
                : ""
            }
            ${
              modpack
                ? `<div class="stat-tile detail-info-wide">
                    <div class="stat-label">${t("serverPage.modpack")}</div>
                    <div class="stat-value">${modpack}</div>
                  </div>`
                : ""
            }
          </div>
          ${
            page.extraTags.length
              ? `<div class="detail-more-tags">
                  <div class="stat-label">${t("serverPage.moreTags")}</div>
                  <div class="tag-row">${page.extraTags.map((tag) => `<span class="tag-chip">${escapeHtml(tagLabel(tag))}</span>`).join("")}</div>
                </div>`
              : ""
          }
        </section>
      </aside>
    </div>
  `;

  wireDetailBreadcrumb();
  fitDetailIcon();
  // Fiche partielle (19/10) : un de SES serveurs pas encore dans l'annuaire, lu par la route du
  // lancement (sans banniere ni description). On le dit plutot que de montrer des cases vides.
  if (server.partial) {
    const note = document.createElement("p");
    note.className = "detail-partial-note";
    note.textContent = t("serverDetail.partialNote");
    const crumb = detailEl.querySelector(".detail-breadcrumb, nav");
    if (crumb) crumb.after(note);
    else detailEl.prepend(note);
  }

  const joinBtn = document.getElementById("join-btn");
  if (joinBtn) {
    joinBtn.addEventListener("click", async () => {
      if (joinBtn.dataset.joinAction === "install") {
        // Installer (sans lancer de compte) ; une fois pret, la fiche passe a « Jouer ».
        await installServerStandalone(server, null);
        const status = await window.mchub.getServerInstallStatus(server.slug).catch(() => null);
        if (status?.installed && !detailEl.hidden && detailEl.querySelector(`[data-join-slug="${CSS.escape(server.slug)}"]`)) renderDetail(server);
        return;
      }
      if (joinBtn.dataset.joinAction === "signin") {
        await attemptSignIn(true);
        if (signedIn && !detailEl.hidden) renderDetail(server);
        return;
      }
      joinServer(server, joinBtn);
    });
    syncJoinButtons();
  }

  const installBtn = document.getElementById("install-btn");
  if (installBtn) {
    installBtn.addEventListener("click", () => installServerStandalone(server, installBtn));
  }

  const favBtn = detailEl.querySelector(".detail-fav-btn");
  favBtn.addEventListener("click", async () => {
    await toggleFavorite(server.slug);
    renderDetail(server);
  });

  const reportBtn = document.getElementById("report-open-btn");
  if (reportBtn) reportBtn.addEventListener("click", () => openReportDialog(server));
  wireTeamByline(detailEl);

  detailEl.querySelectorAll("[data-link-kind]").forEach((btn) => {
    btn.addEventListener("click", () => window.mchub.openServerPageLink(btn.dataset.linkKind, btn.dataset.linkValue));
  });
  detailEl.querySelectorAll("[data-gallery-index]").forEach((btn) => {
    const index = Number(btn.dataset.galleryIndex);
    btn.addEventListener("click", () => openGalleryLightbox(page.gallery[index], index));
  });
  const blockVideoAutoplay = (await window.mchub.settings.get()).blockVideoAutoplay === true;
  detailEl.querySelectorAll(".page-video-box").forEach((box) => setupPageVideo(box, blockVideoAutoplay));
}

// Bouton « Ouvrir dans le launcher » du site (lien omniscient://, voir parseServerLink cote
// main.js) : ouvre la fiche du serveur, comme un clic dans l'annuaire. Un lien avec un code
// d'invitation rejoint d'abord le serveur prive (meme chemin que « Rejoindre avec un code »).
async function openServerFromLink(link) {
  if (link?.kind === "team") {
    showTeamInServers(link.value);
    return;
  }
  if (!link || (link.kind !== "server" && link.kind !== "join")) return;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  [navHomeBtn, navSettingsBtn, navFavoritesBtn, navRecentBtn, navMyInstancesBtn, navFriendsBtn].forEach((btn) => btn.classList.remove("active"));
  navServersBtn.classList.add("active");
  detailOrigin = "servers";
  let slug = link.value;
  if (link.kind === "join") {
    const result = await window.mchub.joinServerByCode(link.value);
    if (!result.ok || !result.server?.slug) {
      openDetailError(t("serverPage.linkJoinFailed", { error: result.error || "?" }));
      return;
    }
    slug = result.server.slug;
  }
  openDetail(slug);
}

function openDetailError(message) {
  homePanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  friendsPanelEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
  listEl.hidden = true;
  detailEl.hidden = true;
  statusEl.hidden = false;
  statusEl.classList.add("error");
  statusEl.textContent = message;
}

// Appele une fois l'appli affichee (fin de boot()) : prend le lien recu au demarrage, puis
// ecoute les suivants (launcher deja ouvert quand le joueur clique sur le site).
let serverLinksStarted = false;
async function startServerLinks() {
  if (serverLinksStarted) return;
  serverLinksStarted = true;
  window.mchub.onServerLink((link) => openServerFromLink(link));
  const pending = await window.mchub.takeServerLink();
  if (pending) openServerFromLink(pending);
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
// (bouton "Rejoindre" d'une fiche serveur, carte "Reprendre", "Mes instances"...).
// La progression ne vit plus dans une barre du bas (supprimee, design 17/10 point 1) mais dans
// la pilule d'etat de la barre du haut (voir renderActivity ci-dessous).
let launchInProgress = false;

// --- Pilule d'etat (design 17/10, points 1 et 2, preview validee par Rushi) ------------------
// Un seul etat, lu au meme endroit par la pilule de la barre du haut ET par le bouton Rejoindre
// de la fiche serveur : "empty" (jamais joue), "idle", "install", "start", "play", "fail".
// Arreter le jeu se fait uniquement depuis le panneau de la pilule, avec confirmation.
const activity = {
  tasks: [], // derniere liste recue par tasks:update
  current: null, // { slug, name } du lancement en cours / de la partie en cours
  launch: null, // { percent, text } pendant launchServer, apres la fin des telechargements
  failure: null, // { slug, name, error }
  playingSince: 0,
  confirmStop: false,
  lastPlayed: null, // { slug, at }
  speedEma: 0, // vitesse lissee (le temps restant ne doit pas sauter d'une seconde a l'autre)
  autoLaunch: new Set(), // installations « Installer » a lancer des qu'elles sont finies
  stopRequested: false, // arret demande par le joueur : sa fermeture n'est pas un plantage
  diskFreeBytes: null, // place libre affichee dans l'erreur « disque plein »
};

const ACTIVITY_DL_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10"/></svg>';

// Serveur deja connu du renderer (liste affichee, cache de la liste, fiche ouverte) — sans appel.
function knownServer(slug) {
  if (!slug) return null;
  return allServers.find((server) => server.slug === slug) || serverListCache?.servers?.find((server) => server.slug === slug) || (currentDetailServer?.slug === slug ? currentDetailServer : null);
}

// Meme chose, en allant chercher la fiche si besoin (serveur prive, liste pas encore chargee).
async function resolveServer(slug) {
  const known = knownServer(slug);
  if (known) return known;
  try {
    const result = await window.mchub.getServer(slug);
    return result?.ok ? result.server : null;
  } catch {
    return null;
  }
}

// Message du proprietaire pendant l'installation (design 17/10, point 6) : ecrit sur le site
// (fiche > « Message pendant l'installation », pageConfig.installMessage), garde ici par serveur des
// qu'une fiche ou un lancement le fait connaitre.
const installMessages = new Map();
function ownerInstallMessage(server) {
  if (!server) return "";
  const message = String(server.installMessage || server.page?.installMessage || "").trim();
  if (message) installMessages.set(server.slug, message);
  return message || installMessages.get(server.slug) || "";
}

function activityServerName(slug) {
  if (!slug) return "";
  if (activity.current?.slug === slug && activity.current.name) return activity.current.name;
  if (activity.lastPlayed?.slug === slug && activity.lastPlayed.name) return activity.lastPlayed.name;
  // Mode Jouer (24/10) : « play:<id de version> » n'est pas un serveur, nom lisible fourni par play.js.
  if (String(slug).startsWith("play:")) return window.playRunningLabel?.(slug) || "Minecraft";
  return knownServer(slug)?.name || slug;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return t("activity.etaSeconds", { n: Math.max(5, Math.round(seconds / 5) * 5) });
  return t("activity.etaMinutes", { n: Math.round(seconds / 60) });
}

function formatPlayMinutes(since) {
  const minutes = Math.max(0, Math.floor((Date.now() - since) / 60_000));
  if (minutes < 60) return t("activity.minutes", { n: minutes });
  return t("activity.hours", { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, "0") });
}

// Calcule l'etat a afficher a partir de tout ce que le renderer sait deja (taches de
// telechargement, lancement en cours, partie en cours, dernier echec).
function activityState() {
  if (gamesMoveProgress && gamesMoveProgress.stage !== "switched") {
    const { doneBytes = 0, totalBytes = 0 } = gamesMoveProgress;
    return { phase: "move", percent: totalBytes ? Math.min(99, Math.floor((doneBytes / totalBytes) * 100)) : 0, drive: gamesMoveProgress.drive };
  }
  if (gamePlaying) {
    const slug = runningGameSlug && runningGameSlug !== "unknown" ? runningGameSlug : activity.current?.slug;
    return { phase: "play", slug, name: activityServerName(slug) };
  }
  if (launchStarting) return { phase: "start", slug: activity.current?.slug, name: activity.current?.name || "" };
  const active = activity.tasks.filter((task) => task.status === "active" || task.status === "paused");
  if (active.length) {
    const task = active[0];
    const totalBytes = active.reduce((sum, item) => sum + (item.totalBytes || 0), 0);
    const doneBytes = active.reduce((sum, item) => sum + (item.bytes || 0), 0);
    const speed = active.reduce((sum, item) => sum + (item.status === "active" ? item.speedBps || 0 : 0), 0);
    const percent = totalBytes ? Math.min(99, Math.floor((doneBytes / totalBytes) * 100)) : null;
    const smoothed = activity.speedEma || speed;
    const etaS = totalBytes && smoothed > 0 ? (totalBytes - doneBytes) / smoothed : null;
    return {
      phase: "install",
      slug: task.slug,
      name: task.name || activityServerName(task.slug),
      task,
      percent,
      etaS,
      speed,
      doneBytes,
      totalBytes,
      paused: task.status === "paused",
    };
  }
  if (activity.launch && activity.current) {
    const { percent } = activity.launch;
    const installing = typeof percent === "number" && percent < 100;
    return { phase: installing ? "install" : "start", slug: activity.current.slug, name: activity.current.name, percent: installing ? percent : null, launchText: activity.launch.text };
  }
  if (launchInProgress && activity.current) return { phase: "start", slug: activity.current.slug, name: activity.current.name };
  if (activity.failure) return { phase: "fail", ...activity.failure };
  return { phase: activity.lastPlayed ? "idle" : "empty", slug: activity.lastPlayed?.slug, name: activityServerName(activity.lastPlayed?.slug) };
}

function activityPillParts(state) {
  switch (state.phase) {
    case "install": {
      let long;
      if (state.paused) long = t("activity.pillPaused", { percent: state.percent ?? 0 });
      else if (state.percent == null) long = t("activity.pillInstallNoPercent");
      else {
        const eta = formatEta(state.etaS);
        long = eta ? t("activity.pillInstallEta", { percent: state.percent, eta }) : t("activity.pillInstall", { percent: state.percent });
      }
      const short = state.percent == null ? t("activity.shortInstall") : t("activity.shortPercent", { percent: state.percent });
      // File d'attente (serie 2, idee 4) : « … · 2 en attente » quand d'autres installations attendent.
      const waiting = queuedTasks().length;
      if (waiting) long = `${long} · ${t("queue.waitingShort", { count: waiting })}`;
      return { cls: "hl", icon: '<span class="activity-ring"></span>', long, short };
    }
    case "move":
      return { cls: "hl", icon: '<span class="activity-ring"></span>', long: t("games.pill", { percent: state.percent, drive: state.drive || "" }), short: `⇄ ${state.percent} %` };
    case "start":
      return { cls: "hl", icon: '<span class="activity-ring"></span>', long: t("activity.pillStart"), short: t("activity.shortStart") };
    case "play":
      return {
        cls: "hl",
        icon: '<span class="status-dot online"></span>',
        long: state.name ? t("activity.pillPlay", { name: state.name, time: formatPlayMinutes(activity.playingSince || Date.now()) }) : t("activity.shortPlay"),
        short: t("activity.shortPlay"),
      };
    case "fail":
      return { cls: "err", icon: '<span class="status-dot offline"></span>', long: t("activity.pillFail"), short: t("activity.shortFail") };
    default:
      return { cls: "", icon: ACTIVITY_DL_SVG, long: t("activity.ready"), short: t("activity.ready") };
  }
}

function activityPanelHtml(state) {
  const name = escapeHtml(state.name || "");
  switch (state.phase) {
    case "move":
      return `
        <h4>${escapeHtml(t("games.pill", { percent: state.percent, drive: state.drive || "" }))}</h4>
        <span class="muted">${escapeHtml(t("games.closeHint"))}</span>
        <div class="activity-row"><button type="button" class="activity-btn full" data-activity="move-show">${escapeHtml(t("games.showMove"))}</button></div>`;
    case "empty":
      return `
        <h4>${escapeHtml(t("activity.nothing"))}</h4>
        <span class="muted">${escapeHtml(t("activity.emptyText"))}</span>
        <div class="activity-row"><button type="button" class="activity-btn full" data-activity="browse">${escapeHtml(t("activity.browse"))}</button></div>`;
    case "idle": {
      const when = activity.lastPlayed?.at ? relativeDayText(activity.lastPlayed.at) : "";
      return `
        <span class="muted">${escapeHtml(t("activity.nothing"))}</span>
        <div class="activity-row between">
          <span>${name}<br><span class="muted">${escapeHtml(when ? t("activity.lastPlayedWhen", { when }) : t("activity.lastPlayed"))}</span></span>
          <button type="button" class="activity-btn full" data-activity="relaunch">${escapeHtml(t("activity.relaunch"))}</button>
        </div>`;
    }
    case "install": {
      const task = state.task;
      const controls = task
        ? `<span class="activity-row">
            <button type="button" class="activity-btn" data-activity="${state.paused ? "resume" : "pause"}" data-id="${task.id}">${escapeHtml(state.paused ? t("titlebar.taskResume") : t("activity.pause"))}</button>
            <button type="button" class="activity-btn danger" data-activity="cancel" data-id="${task.id}">${escapeHtml(t("activity.cancel"))}</button>
          </span>`
        : "";
      const step = (task?.text || state.launchText || t("activity.preparing")).trim();
      const volume =
        state.totalBytes
          ? `${formatTaskBytes(state.doneBytes)} / ${formatTaskBytes(state.totalBytes)}${state.speed > 0 ? ` · ${formatTaskSpeed(state.speed)}` : ""}`
          : "";
      const eta = state.paused ? t("titlebar.taskPaused") : formatEta(state.etaS);
      const firstTime = state.slug && !playCountsCache[state.slug];
      const steps = activitySteps(state);
      // Pack FTB (21/10, preview validee) : d'ou viennent les mods, une ligne par origine non vide.
      const origins = task?.origins;
      const originsHtml = origins
        ? [
            ["curseforge", "activity.originCurseforge"],
            ["modrinth", "activity.originModrinth"],
            ["ftb", "activity.originFtb"],
          ]
            .filter(([key]) => Number(origins[key]) > 0)
            .map(([key, label]) => `<span class="muted activity-detail">✓ ${escapeHtml(t(label, { count: Number(origins[key]) }))}</span>`)
            .join("")
        : "";
      const autoLaunch =
        task?.kind === "install"
          ? `<label class="activity-row muted activity-check"><input type="checkbox" data-autolaunch="${escapeHtml(state.slug)}"${activity.autoLaunch.has(state.slug) ? " checked" : ""}> ${escapeHtml(t("activity.autoLaunch"))}</label>`
          : "";
      return `
        <span class="activity-section">${escapeHtml(t("queue.inProgress"))}</span>
        <div class="activity-row between"><h4>${name}</h4>${controls}</div>
        <span class="activity-stepof">${escapeHtml(t("activity.stepOf", { n: steps.index, total: steps.total }))}</span>
        ${steps.html}
        ${originsHtml}
        <span class="muted activity-detail">${escapeHtml(step)}</span>
        <div class="activity-bar${state.percent == null ? " indeterminate" : ""}"><i style="width:${state.percent ?? 0}%"></i></div>
        ${volume || eta ? `<div class="activity-row between"><span class="muted">${escapeHtml(volume)}</span><b class="activity-eta">${escapeHtml(eta ? `~${eta}` : "")}</b></div>` : ""}
        ${firstTime ? `<span class="activity-tip">${escapeHtml(t("activity.firstTimeTip"))}</span>` : ""}
        ${installMessages.get(state.slug) ? `<div class="owner-message"><span class="owner-message-label">${escapeHtml(t("firstInstall.ownerLabel"))}</span>${escapeHtml(installMessages.get(state.slug))}</div>` : ""}
        ${autoLaunch}
        ${queueHtml()}`;
    }
    case "start":
      return `
        <h4>${name}</h4>
        <span class="muted">${escapeHtml(t("activity.starting"))}</span>
        <div class="activity-bar indeterminate"><i></i></div>`;
    case "play": {
      const confirm = activity.confirmStop
        ? `<div class="activity-confirm">
            <span>${escapeHtml(t("activity.confirmStop"))}</span>
            <div class="activity-row">
              <button type="button" class="activity-btn danger-full" data-activity="stop-yes">${escapeHtml(t("activity.confirmYes"))}</button>
              <button type="button" class="activity-btn" data-activity="stop-no">${escapeHtml(t("activity.confirmNo"))}</button>
            </div>
          </div>`
        : "";
      return `
        <h4>${name || escapeHtml(t("activity.shortPlay"))}</h4>
        <span class="muted">${escapeHtml(t("activity.playingFor", { time: formatPlayMinutes(activity.playingSince || Date.now()) }))}</span>
        <div class="activity-row">
          <button type="button" class="activity-btn danger" data-activity="stop">${escapeHtml(t("activity.stop"))}</button>
          <button type="button" class="activity-btn" data-activity="log">${escapeHtml(t("activity.log"))}</button>
        </div>
        ${confirm}`;
    }
    case "fail": {
      const info = describeFailure(state);
      const btn = (action, label, cls = "") => `<button type="button" class="activity-btn${cls ? ` ${cls}` : ""}" data-activity="${action}">${escapeHtml(label)}</button>`;
      const actions = {
        disk: [btn("retry", t("activity.retry"), "full"), btn("move-games", t("games.moveShort")), btn("game-folder", t("activity.openFolder")), btn("copy-report", t("activity.copyReport"))],
        net: [btn("retry", t("activity.retry"), "full"), btn("copy-report", t("activity.copyReport"))],
        crash: [btn("retry", t("activity.retry"), "full"), btn("memory", t("activity.fixMemory")), btn("repair", t("activity.repairFiles")), btn("log", t("activity.seeLog"))],
        java: [btn("retry", t("activity.retry"), "full"), btn("java-fix", t("activity.fixJava")), btn("log", t("activity.seeLog"))],
        manual: [btn("manual", t("activity.showManual"), "full"), btn("retry", t("activity.retry"))],
        generic: [btn("retry", t("activity.retry"), "full"), btn("log", t("activity.seeLog")), btn("services", t("activity.servicesStatus"))],
      }[info.kind];
      // Detail technique replie (lot 5 bis) : utile pour l'aide, sans faire peur au joueur.
      const raw = String(state.error || "").trim();
      const tech = raw && info.kind !== "manual" ? `<details class="activity-tech"><summary>${escapeHtml(t("activity.techDetails"))}</summary><code>${escapeHtml(raw.slice(0, 600))}</code></details>` : "";
      const stage = activity.failure?.reportStage || null;
      const warn = state.slug && signedIn && !stage ? btn("warn-server", t("activity.warnServer")) : "";
      const report =
        stage === "confirm"
          ? `<div class="activity-confirm">
              <b>${escapeHtml(t("activity.warnTitle"))}</b>
              <ul class="activity-list">${["warnItemVersions", "warnItemProblem", "warnItemMod"].map((key) => `<li>${escapeHtml(t(`activity.${key}`))}</li>`).join("")}</ul>
              <span class="muted">${escapeHtml(t("activity.warnPrivacy"))}</span>
              <div class="activity-row">${btn("warn-send", t("activity.warnSend"), "full")}${btn("warn-cancel", t("activity.cancel"))}</div>
            </div>`
          : stage === "sending"
            ? `<div class="activity-confirm"><span class="muted">${escapeHtml(t("activity.warnSending"))}</span></div>`
            : stage === "sent"
              ? `<div class="activity-okbox">${escapeHtml(t("activity.warnSent"))}</div>`
              : stage === "error"
                ? `<div class="activity-confirm"><span class="muted">${escapeHtml(t("activity.warnFailed"))}</span><div class="activity-row">${btn("warn-send", t("activity.retry"))}</div></div>`
                : "";
      return `
        <div class="activity-errbox">
          <b>✕ ${escapeHtml(info.title)}</b>
          <span class="muted">${escapeHtml(info.body)}</span>
          ${tech}
          <div class="activity-row">${actions.join("")}${warn}</div>
        </div>
        ${report}
        <div class="activity-row"><button type="button" class="activity-btn ghost" data-activity="dismiss">${escapeHtml(t("activity.dismiss"))}</button></div>`;
    }
    default:
      return "";
  }
}

// Etapes visibles du panneau (design 17/10, point 4, L3-A). Serveur moddé : 6 etapes, dont la
// recherche sur Modrinth des mods que CurseForge bloque et les mods a ajouter a la main ; vanilla :
// 3 etapes. Les etapes viennent de main.js (task.step) puis de game:progress pour le demarrage.
const MODDED_STEPS = ["prepare", "java", "mods", "blocked", "manual", "start"];
const VANILLA_STEPS = ["prepare", "java", "start"];

function activitySteps(state) {
  const task = state.task;
  const modded = task ? task.modded !== false : knownServer(state.slug)?.type === "modded";
  const order = modded ? MODDED_STEPS : VANILLA_STEPS;
  const current = task ? task.step || "prepare" : "start";
  const blocked = task?.blocked || null;
  const curIndex = Math.max(0, order.indexOf(current));
  const lines = order.map((step, index) => {
    let label;
    let done = index < curIndex;
    if (step === "prepare") label = t("activity.stepPrepare");
    else if (step === "java") label = t("activity.stepJava");
    else if (step === "mods") label = task?.modsTotal ? t("activity.stepModsCount", { done: task.modsDone || 0, total: task.modsTotal }) : t("activity.stepMods");
    else if (step === "blocked") {
      // La recherche sur Modrinth se fait juste avant le telechargement des mods : deja connue.
      if (blocked) done = true;
      label = blocked ? t("activity.stepBlockedFound", { found: blocked.found, total: blocked.total }) : current === "mods" ? t("activity.stepBlockedNone") : t("activity.stepBlocked");
      if (!blocked && current === "mods") done = true;
    } else if (step === "manual") {
      const left = blocked ? blocked.total - blocked.found : 0;
      if (current === "mods") done = left === 0;
      label = left > 0 ? t("activity.stepManualLeft", { count: left }) : t("activity.stepManualNone");
    } else label = t("activity.stepStart");
    const cur = index === curIndex && !done;
    return `<div class="activity-step${done ? " done" : cur ? " cur" : ""}"><span class="activity-step-n">${done ? "✓" : index + 1}</span><span>${escapeHtml(label)}</span></div>`;
  });
  return { html: `<div class="activity-steps">${lines.join("")}</div>`, index: curIndex + 1, total: order.length };
}

// Echec affiche par la pilule (L3-E) : un titre clair et une phrase, plus le texte brut. Le type
// choisit les boutons proposes (disque plein, connexion coupee, plantage du jeu...).
function describeFailure(failure) {
  const raw = String(failure.error || "");
  const name = failure.name || "";
  if (failure.manualMods) {
    return { kind: "manual", title: t("manualMods.playbar", { count: failure.manualMods.filter((mod) => mod.reason !== "removed").length || failure.manualMods.length }), body: t("activity.manualBody") };
  }
  if (/ENOSPC|no space left|not enough space|espace disque/i.test(raw)) {
    const free = activity.diskFreeBytes;
    return { kind: "disk", title: t("activity.errDiskTitle"), body: free != null ? t("activity.errDiskFree", { free: formatTaskBytes(free) }) : t("activity.errDiskBody") };
  }
  // Site saturé (audit de charge du 19/10) : message de main.js, rien a reparer de ce cote.
  if (/très demandé : réessaie dans une minute/i.test(raw)) {
    return { kind: "net", title: t("activity.errBusyTitle"), body: t("activity.errBusyBody") };
  }
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|fetch failed|socket hang up|network|timed out|timeout/i.test(raw)) {
    return { kind: "net", title: t("activity.errNetTitle"), body: t("activity.errNetBody") };
  }
  const code = raw.match(/code\s*(-?\d+)/i)?.[1];
  if (failure.crashCode != null || (code && /fermé|arrêté|closed|exited|stopped/i.test(raw))) {
    return { kind: "crash", title: t("activity.errCrashTitle", { code: failure.crashCode ?? code }), body: t("activity.errCrashBody") };
  }
  // Lot 5 bis : Java qui manque ou ne se prepare pas -> dit pourquoi et propose de le reparer.
  if (/Version de Java|Java \d+ disponible|Java introuvable|Java a été téléchargé|UnsupportedClassVersionError|JAVA_HOME|could not find java|java\.exe.*ENOENT/i.test(raw)) {
    const major = raw.match(/Java\s*(\d{1,2})/i)?.[1];
    return { kind: "java", title: t("activity.errJavaTitle"), body: major ? t("activity.errJavaBodyMajor", { major }) : t("activity.errJavaBody") };
  }
  // Plus de texte technique brut en premier (lot 5 bis) : une phrase claire, le detail replie.
  return { kind: "generic", title: t("activity.failTitle", { name }), body: t("activity.errGenericBody") };
}

// Notification Windows (L3-G) quand le launcher n'est pas au premier plan : installation finie,
// ou jeu qui se lance tout seul. Un clic ramene la fenetre.
function notifyIfAway(title, body) {
  if (document.hasFocus() || typeof Notification === "undefined" || discreetMode) return;
  try {
    const notification = new Notification(title, { body, silent: false });
    notification.onclick = () => window.mchub.windowControls.focus();
  } catch {
    // Notifications coupees par Windows : rien a faire, la pilule montre deja l'etat.
  }
}

// --- Mode discret (design 17/10, point 6, preview validee) ------------------------------------
// Un interrupteur dans la barre du haut et dans Parametres > Apparence. Il cache les adresses des
// serveurs, les codes d'invitation, les pseudos des amis et les notifications (pas de pastille,
// pas de notification Windows). Tout passe par la classe html.discreet et les elements .sensitive.
let discreetMode = false;

function applyDiscreetMode(on) {
  discreetMode = Boolean(on);
  document.documentElement.classList.toggle("discreet", discreetMode);
  const btn = document.getElementById("discreet-toggle");
  if (btn) {
    btn.setAttribute("aria-pressed", String(discreetMode));
    btn.innerHTML = `${discreetMode ? "◐" : "◑"} <span class="discreet-word">${escapeHtml(t("discreet.toggle"))}</span>`;
    btn.title = t(discreetMode ? "discreet.onHint" : "discreet.offHint");
    btn.setAttribute("aria-label", t("discreet.toggle"));
  }
}

async function setDiscreetMode(on) {
  applyDiscreetMode(on);
  await window.mchub.settings.set({ discreetMode: discreetMode });
}

document.getElementById("discreet-toggle")?.addEventListener("click", () => setDiscreetMode(!discreetMode));
window.mchub.settings.get().then((settings) => applyDiscreetMode(settings.discreetMode)).catch(() => applyDiscreetMode(false));

// --- Etats vides (design 17/10, point 6, L5-G) : une phrase et un seul bouton par page ---------
const EMPTY_ICONS = {
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  cloudOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><path d="m1 1 22 22"/></svg>',
};

function emptyStateHtml({ icon, title, text, action, actionId, extraClass = "" }) {
  return `
    <div class="empty-state ${extraClass}">
      <span class="empty-state-icon">${EMPTY_ICONS[icon] || ""}</span>
      <h3>${escapeHtml(title)}</h3>
      ${text ? `<p>${escapeHtml(text)}</p>` : ""}
      ${action ? `<button type="button" class="join-btn" id="${actionId}">${escapeHtml(action)}</button>` : ""}
    </div>`;
}

// --- File d'attente des installations (serie 2, idee 4, version A) -------------------------------
function queuedTasks() {
  return activity.tasks.filter((task) => task.status === "queued").sort((a, b) => (a.queuePosition || 99) - (b.queuePosition || 99));
}

function queueHtml() {
  const queued = queuedTasks();
  const rows = queued
    .map((task, index) => `
      <div class="queue-row${activity.queueMoved === task.id ? " moved" : ""}">
        <span class="queue-n">${index + 1}</span>
        <span class="task-item-icon">${escapeHtml((task.name || task.slug || "?").slice(0, 1).toUpperCase())}</span>
        <span class="queue-name">${escapeHtml(task.name || task.slug)}</span>
        ${index > 0 ? `<button type="button" class="activity-btn sm" data-activity="queue-first" data-id="${task.id}">${escapeHtml(t("queue.moveFirst"))}</button>` : ""}
        <button type="button" class="queue-remove" data-activity="cancel" data-id="${task.id}" title="${escapeHtml(t("queue.remove"))}" aria-label="${escapeHtml(t("queue.remove"))}">✕</button>
      </div>`)
    .join("");
  return `
    <span class="activity-section">${escapeHtml(t("queue.waiting", { count: queued.length }))}</span>
    ${queued.length ? rows : `<div class="queue-empty"><b>${escapeHtml(t("queue.emptyTitle"))}</b><span class="muted">${escapeHtml(t("queue.emptyText"))}</span></div>`}`;
}

// "aujourd'hui" / "hier" / "il y a 3 jours" — utilise par le panneau "Rien en cours".
function relativeDayText(at) {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return t("activity.today");
  if (days === 1) return t("activity.yesterday");
  return t("activity.daysAgo", { n: days });
}

let playCountsCache = {};
let activityRenderKey = "";

function renderActivity() {
  const state = activityState();
  const pill = document.getElementById("tasks-trigger");
  if (!pill) return;
  let parts = activityPillParts(state);
  // Mode Jouer (24/10) : la synchro des mondes avec le cloud (play.js) prend la pilule quand rien
  // d'autre ne tourne, et s'affiche en tete du panneau.
  const cloud = window.playCloudActivity?.() || null;
  if (cloud && (cloud.over || !["install", "move", "start", "play", "fail"].includes(state.phase))) parts = cloud.parts;
  pill.className = `activity-pill${parts.cls ? ` ${parts.cls}` : ""}`;
  document.getElementById("activity-pill-icon").innerHTML = parts.icon;
  document.getElementById("activity-pill-text").textContent = parts.long;
  document.getElementById("activity-pill-short").textContent = parts.short;
  pill.title = parts.long;
  pill.setAttribute("aria-label", parts.long);

  // Le panneau n'est redessine que si son contenu change (sinon un clic en cours sur un de ses
  // boutons pourrait tomber sur un element remplace entre mousedown et click).
  const panelHtml = (cloud?.panelHtml || "") + activityPanelHtml(state);
  if (panelHtml !== activityRenderKey) {
    activityRenderKey = panelHtml;
    document.getElementById("activity-panel").innerHTML = panelHtml;
  }
  syncJoinButtons(state);
}

// Bouton Rejoindre de la fiche serveur (design 17/10, point 2) : il suit le meme etat que la
// pilule, pour que le joueur voie la suite la ou il a clique. Seulement pour le serveur
// concerne : les autres fiches restent sur « Rejoindre » (desactive pendant qu'un autre
// lancement est en cours, minecraft-launcher-core ne gere qu'un jeu a la fois).
function syncJoinButtons(state = activityState()) {
  document.querySelectorAll("[data-join-slug]").forEach((btn) => {
    const slug = btn.dataset.joinSlug;
    const mine = state.slug === slug;
    let html;
    let cls = "join-btn";
    let disabled = false;
    if (mine && state.phase === "install") {
      cls += " join-progress";
      disabled = true;
      const modded = knownServer(slug)?.type === "modded";
      const label = state.percent == null ? t("activity.joinPreparing") : t(modded ? "activity.joinMods" : "activity.joinFiles", { percent: state.percent });
      html = `<span class="join-progress-label">${escapeHtml(label)}</span><span class="activity-bar${state.percent == null ? " indeterminate" : ""}"><i style="width:${state.percent ?? 0}%"></i></span>`;
    } else if (mine && state.phase === "start") {
      cls += " join-starting";
      disabled = true;
      html = `<span class="activity-ring"></span>${escapeHtml(t("activity.joinStarting"))}`;
    } else if (mine && state.phase === "play") {
      cls += " join-stop";
      html = escapeHtml(t("activity.joinStop", { time: formatPlayMinutes(activity.playingSince || Date.now()) }));
    } else if (mine && state.phase === "fail") {
      cls += " join-retry";
      html = escapeHtml(t("activity.joinRetry"));
    } else {
      html = escapeHtml(t(btn.dataset.joinLabel || "serverDetail.joinBtn"));
      // Un seul lancement a la fois (minecraft-launcher-core) : les autres fiches attendent.
      // Complet / hors ligne : bouton grise (lot 3), sauf si « Essayer quand meme » est choisi.
      disabled = launchInProgress || launchStarting || btn.dataset.joinBlocked === "1";
    }
    if (btn.dataset.joinState !== `${cls}|${html}|${disabled}`) {
      btn.dataset.joinState = `${cls}|${html}|${disabled}`;
      btn.className = `${btn.dataset.baseClass || ""} ${cls}`.trim();
      btn.innerHTML = html;
      btn.disabled = disabled;
    }
  });
}

function openActivityPanel() {
  const panel = document.getElementById("tasks-panel");
  panel.hidden = false;
  document.getElementById("tasks-trigger").setAttribute("aria-expanded", "true");
}

function closeActivityPanel() {
  const panel = document.getElementById("tasks-panel");
  if (panel.hidden) return;
  panel.hidden = true;
  document.getElementById("tasks-trigger").setAttribute("aria-expanded", "false");
  if (activity.confirmStop) {
    activity.confirmStop = false;
    renderActivity();
  }
}

async function handleActivityAction(btn) {
  const action = btn.dataset.activity;
  const state = activityState();
  if (action === "browse") {
    closeActivityPanel();
    showServersView();
  } else if (action === "relaunch" || action === "retry") {
    const slug = state.slug;
    const installOnly = action === "retry" && activity.failure?.action === "install";
    closeActivityPanel();
    activity.failure = null;
    renderActivity();
    const server = await resolveServer(slug);
    if (server && installOnly) await installServerStandalone(server, null);
    else if (server) await launchServer(server);
    else if (slug) await openDetail(slug);
  } else if (action === "pause") await window.mchub.tasks.pause(Number(btn.dataset.id));
  else if (action === "resume") await window.mchub.tasks.resume(Number(btn.dataset.id));
  else if (action === "cancel") await window.mchub.tasks.cancel(Number(btn.dataset.id));
  else if (action === "stop") {
    activity.confirmStop = true;
    renderActivity();
  } else if (action === "stop-no") {
    activity.confirmStop = false;
    renderActivity();
  } else if (action === "stop-yes") {
    activity.confirmStop = false;
    activity.stopRequested = true;
    closeActivityPanel();
    const result = await window.mchub.stopGame();
    toolsToast(result?.ok ? t("instanceTools.stopped") : t("instanceTools.stopFailed"));
  } else if (action === "log") {
    window.mchub.logs.openConsole();
  } else if (action === "memory") {
    closeActivityPanel();
    openSettingsTab("memory");
  } else if (action === "repair") {
    // Reparer : reverifie et retelecharge les fichiers du jeu manquants ou abimes (meme outil
    // que Parametres > Debogage), puis on peut relancer.
    closeActivityPanel();
    const { confirmed } = await showModal({ tone: "ok", title: t("activity.repairTitle"), body: t("activity.repairBody"), confirmLabel: t("activity.repairFiles"), cancelLabel: t("common.cancel") });
    if (!confirmed) return;
    await window.mchub.diagnostics.repair();
    toolsToast(t("activity.repairDone"));
  } else if (action === "java-fix") {
    closeActivityPanel();
    openSettingsTab("misc");
  } else if (action === "services") {
    closeActivityPanel();
    mcStatusPanel.hidden = false;
    loadMcStatus();
  } else if (action === "help") {
    closeActivityPanel();
    const server = await resolveServer(state.slug);
    if (server) openReportDialog(server);
  } else if (action === "dismiss") {
    activity.failure = null;
    closeActivityPanel();
    renderActivity();
  } else if (action === "game-folder") {
    window.mchub.settings.openGameFolder();
  } else if (action === "move-show") {
    closeActivityPanel();
    if (!gamesMoveModal?.isOpen() && gamesMoveRequest) {
      gamesMoveModal = openToolsModal({ title: t("games.movingTitle", { drive: gamesMoveRequest.drive }), bodyHtml: "", actions: [{ label: t("games.safeCancel"), value: "cancel-move" }] });
      gamesMoveModal.done.then((value) => {
        if (value === "cancel-move" && gamesMoveProgress && gamesMoveProgress.stage !== "switched") window.mchub.games.cancelMove();
      });
      renderGamesMoveProgress();
    }
  } else if (action === "move-games") {
    closeActivityPanel();
    openSettingsTab("misc");
    openGamesMove();
  } else if (action === "copy-report") {
    const failure = activity.failure || {};
    const report = [`Omniscient Launcher — ${failure.name || ""} (${failure.slug || "?"})`, new Date().toLocaleString(), String(failure.error || "")].join("\n");
    try {
      await navigator.clipboard.writeText(report);
      toolsToast(t("activity.reportCopied"));
    } catch {
      toolsToast(t("activity.reportCopyFailed"));
    }
  } else if (action === "manual") {
    const failure = activity.failure;
    closeActivityPanel();
    if (!failure?.manualMods) return;
    const choice = await showManualModsModal(failure.manualMods, failure.fromModrinth, failure.fromModrinthMods, { slug: failure.slug });
    if (choice !== "retry") return;
    activity.failure = null;
    renderActivity();
    const server = await resolveServer(failure.slug);
    if (!server) return;
    if (failure.action === "install") await installServerStandalone(server, null);
    else await launchServer(server);
  } else if (action === "warn-server" || action === "warn-cancel") {
    if (!activity.failure) return;
    activity.failure.reportStage = action === "warn-server" ? "confirm" : null;
    renderActivity();
  } else if (action === "warn-send") {
    const failure = activity.failure;
    if (!failure?.slug) return;
    const info = describeFailure(failure);
    failure.reportStage = "sending";
    renderActivity();
    const kind = { disk: "disk", net: "net", crash: "crash", manual: "manual_mods" }[info.kind] || "other";
    const result = await window.mchub.reportInstallProblem({
      slug: failure.slug,
      kind,
      summary: info.title,
      detail: String(failure.error || "").slice(0, 300),
      minecraftVersion: knownServer(failure.slug)?.minecraftVersion || null,
    });
    if (activity.failure === failure) {
      failure.reportStage = result?.ok ? "sent" : "error";
      renderActivity();
    }
  } else if (action === "queue-first") {
    const id = Number(btn.dataset.id);
    const task = activity.tasks.find((item) => item.id === id);
    await window.mchub.tasks.moveFirst(id);
    activity.queueMoved = id;
    setTimeout(() => {
      if (activity.queueMoved === id) activity.queueMoved = null;
      renderActivity();
    }, 1400);
    if (task) toolsToast(t("queue.moved", { name: task.name || task.slug }));
  } else if (action === "play-task") {
    closeActivityPanel();
    const server = await resolveServer(btn.dataset.slug);
    if (server) await launchServer(server);
  }
}

// Ouvre la pilule sur la confirmation d'arret : utilise par le bouton « Arrêter » de la fiche et
// des cartes d'instance, pour qu'il n'y ait qu'une seule facon d'arreter le jeu.
function askStopFromPill() {
  // Ouvert juste APRES le clic (19/10, bug « Arrêter ne fait rien » vu par Rushi) : le clic du
  // bouton « Arrêter » (fiche, carte, bibliotheque, accueil) remontait jusqu'a l'ecouteur global
  // qui ferme le panneau au clic exterieur — il s'ouvrait et se refermait aussitot, sans rien
  // montrer. Attendre la fin du clic regle tous ces boutons d'un coup.
  setTimeout(() => {
    activity.confirmStop = true;
    renderActivity();
    openActivityPanel();
  }, 0);
}

// Compat : l'ancien nom est encore appele depuis plusieurs endroits (cartes d'instance...).
function syncPlaybarWithGame() {
  renderActivity();
}

async function loadActivityHistory() {
  try {
    const settings = await window.mchub.settings.get();
    playCountsCache = settings.playCounts || {};
    const slug = settings.lastPlayedSlug || settings.recentlyPlayed?.[0] || null;
    activity.lastPlayed = slug ? { slug, at: settings.recentPlayedAt?.[slug] || 0 } : null;
  } catch {
    // Reglages illisibles : la pilule reste sur « Prêt », rien de bloquant.
  }
  renderActivity();
}

async function launchServer(server) {
  // Le flag doit etre pose ICI, avant le moindre await — pas apres
  // applyRecommendedRamIfNeeded() (qui peut ouvrir une modale bloquante et
  // laisser largement le temps a un second clic de passer le test
  // ci-dessus avant que le flag soit leve). C'est ce qui protege tous les
  // points d'entree (carte "Reprendre", "Mes instances"/"Rejoint", fiche
  // detail) d'un seul coup, meme ceux qui ne desactivent pas aussi
  // leur propre bouton par securite.
  if (launchInProgress) return null;
  launchInProgress = true;

  // Connexion demandee ici, pas avant (2026-10-11, audit onboarding) : premier
  // moment ou elle est reellement necessaire, quel que soit le point d'entree.
  if (!signedIn) {
    const signedInNow = await attemptSignIn(true);
    if (!signedInNow) {
      launchInProgress = false;
      return null;
    }
  }

  if (!(await confirmFirstInstall(server, { launch: true }))) {
    launchInProgress = false;
    return null;
  }

  const { proceed, memoryOverride } = await applyRecommendedRamIfNeeded(server);
  if (!proceed) {
    launchInProgress = false;
    return null;
  }

  activity.current = { slug: server.slug, name: server.name };
  activity.failure = null;
  activity.launch = null;
  renderActivity();

  // Les telechargements (modpack, Java) arrivent par tasks:update ; ce qui suit (bibliotheques et
  // assets de Minecraft, telecharges par minecraft-launcher-core) arrive seulement ici.
  const stopListening = window.mchub.onGameProgress((status) => {
    if (!status || typeof status !== "object") return;
    const stillDownloading = activity.tasks.some((task) => task.slug === server.slug && (task.status === "active" || task.status === "paused"));
    if (stillDownloading) return;
    const next = { ...(activity.launch || {}) };
    if (status.text) next.text = status.text;
    if (typeof status.task === "number" && typeof status.total === "number" && status.total > 0) {
      next.percent = Math.min(100, Math.round((status.task / status.total) * 100));
    }
    activity.launch = next;
    renderActivity();
  });
  const firstLaunch = !playCountsCache[server.slug];

  const result = await window.mchub.playServer(server.slug, memoryOverride);
  stopListening();
  launchInProgress = false;
  activity.launch = null;

  if (result.ok) {
    // Historique de lancement (dernier joue, compteur par serveur, liste des
    // derniers joues) — sert a la carte « Reprendre » de l'Accueil et a la page "Recents".
    const settings = await window.mchub.settings.get();
    const playCounts = { ...(settings.playCounts || {}) };
    playCounts[server.slug] = (playCounts[server.slug] || 0) + 1;
    playCountsCache = playCounts;
    const recentlyPlayed = [server.slug, ...(settings.recentlyPlayed || []).filter((s) => s !== server.slug)].slice(0, RECENT_MAX);
    const recentPlayedAt = datesForSlugs({ ...(settings.recentPlayedAt || {}), [server.slug]: Date.now() }, recentlyPlayed);
    await window.mchub.settings.set({ playCounts, lastPlayedSlug: server.slug, recentlyPlayed, recentPlayedAt });
    activity.lastPlayed = { slug: server.slug, at: Date.now() };

    // Parametres > Debogage (voir renderDebugTab) — deux reglages qui
    // n'ont d'effet qu'au moment ou une partie demarre reellement.
    if (settings.openConsoleOnLaunch) window.mchub.logs.openConsole();
    // Divers > Pendant la partie : reduit au demarrage, revient a la fin sauf en mode discret (main.js).
    if (settings.minimizeWhilePlaying !== false) window.mchub.windowControls.minimize();

    if (firstLaunch) notifyIfAway(t("activity.notifyLaunchingTitle", { name: server.name }), t("activity.notifyLaunchingBody"));
    if (!gamePlaying) {
      launchStarting = true;
      // Sécurité : si le jeu ne s'annonce jamais, la pilule reprend son état normal.
      setTimeout(() => {
        launchStarting = false;
        renderActivity();
      }, 60_000);
    }
    renderActivity();
  } else if (result.cancelled) {
    renderActivity();
  } else {
    if (result.code === "manual_mods" && Array.isArray(result.manualMods)) {
      // Mods a ajouter a la main (14/10) : la fenetre explique quoi faire, et « Réessayer »
      // relance tout de suite.
      renderActivity();
      const choice = await showManualModsModal(result.manualMods, result.fromModrinth, result.fromModrinthMods, { slug: server.slug });
      if (choice === "retry") return launchServer(server);
      // Fenetre fermee : l'echec reste dans la pilule, avec un bouton pour la rouvrir.
      activity.failure = { slug: server.slug, name: server.name, error: result.error, action: "launch", manualMods: result.manualMods, fromModrinth: result.fromModrinth, fromModrinthMods: result.fromModrinthMods };
      renderActivity();
      return result;
    }
    if (result.frozen) {
      renderActivity();
      await showModal({
        title: t("modal.frozenTitle"),
        body: t("modal.frozenBody", { name: server.name }),
        confirmLabel: t("modal.frozenClose"),
      });
      return result;
    }
    // L'echec reste affiche (pilule rouge « Échec · Voir ») jusqu'a ce que le joueur relance ou
    // ferme le message — plus de barre qui se vide toute seule apres 4 secondes.
    activity.failure = { slug: server.slug, name: server.name, error: result.error, action: "launch" };
    refreshDiskFreeForFailure();
    renderActivity();
    openActivityPanel();
  }

  return result;
}

// Ecran avant la 1re installation d'un serveur (design 17/10, point 4, L3-H) : place sur le disque,
// memoire utilisee et message du proprietaire, avec un seul bouton. Il ne s'affiche que si le
// serveur n'est pas encore installe. Disque trop plein : le bouton reste grise et l'ecran se met a
// jour tout seul quand le joueur libere de la place. Resout true pour continuer.
const FIRST_INSTALL_NEED_BYTES = { modded: 3 * 1024 ** 3, vanilla: 1024 ** 3 };

async function confirmFirstInstall(server, { launch }) {
  let installed = true;
  try {
    installed = (await window.mchub.getServerInstallStatus(server.slug))?.installed !== false;
  } catch {
    installed = true;
  }
  if (installed) return true;

  const need = server.type === "modded" ? FIRST_INSTALL_NEED_BYTES.modded : FIRST_INSTALL_NEED_BYTES.vanilla;
  let low = false;
  const bodyHtml = (free) => {
    low = free != null && free < need;
    const size =
      free == null
        ? `<p class="first-install-line">${escapeHtml(t("firstInstall.sizeUnknown", { need: formatTaskBytes(need) }))}</p>`
        : low
          ? `<div class="activity-errbox"><b>✕ ${escapeHtml(t("activity.errDiskTitle"))}</b><span class="muted">${escapeHtml(t("firstInstall.diskNeed", { need: formatTaskBytes(need), free: formatTaskBytes(free) }))}</span><span class="muted">${escapeHtml(t("firstInstall.diskFreeUp"))}</span></div>`
          : `<p class="first-install-line ok">✓ ${escapeHtml(t("firstInstall.sizeOk", { need: formatTaskBytes(need), free: formatTaskBytes(free) }))}</p>`;
    const ram = server.recommendedRamGB ? `<p class="first-install-line">${escapeHtml(t("firstInstall.ram", { count: server.recommendedRamGB }))}</p>` : "";
    // Lot 5 bis : prevenir AVANT l'installation qu'il y aura des mods a ajouter a la main.
    const manualCount = Number(server.manualModsCount) || 0;
    const manual = manualCount > 0 ? `<p class="first-install-line">ⓘ ${escapeHtml(t("manualMods.badgeTip", { count: manualCount }))}</p>` : "";
    const ownerMessage = ownerInstallMessage(server);
    const message = ownerMessage ? `<div class="owner-message"><span class="owner-message-label">${escapeHtml(t("firstInstall.ownerLabel"))}</span>${escapeHtml(ownerMessage)}</div>` : "";
    return `${size}${ram}${manual}${message}<p class="first-install-note">${escapeHtml(t("firstInstall.onlyOnce"))}</p>`;
  };
  const readFree = async () => {
    try {
      const result = await window.mchub.diskFree();
      return result?.ok ? result.freeBytes : null;
    } catch {
      return null;
    }
  };

  const modal = openToolsModal({
    title: t("firstInstall.title", { name: server.name }),
    bodyHtml: bodyHtml(await readFree()),
    actions: [],
  });
  const goLabel = launch ? t("firstInstall.installPlay") : t("firstInstall.install");
  const renderActions = () =>
    modal.setActions([
      { label: t("firstInstall.cancel"), value: "cancel" },
      ...(low ? [{ label: t("activity.openFolder"), onClick: () => window.mchub.settings.openGameFolder() }] : []),
      { label: goLabel, cls: "join-btn", onClick: (btn) => (low ? btn.blur() : modal.close("go")) },
    ]);
  renderActions();
  const markGo = () => document.getElementById("instance-tools-actions")?.querySelector(".join-btn")?.toggleAttribute("disabled", low);
  markGo();
  // Disque trop plein : on relit la place libre toutes les 3 s tant que l'ecran est ouvert.
  const poll = setInterval(async () => {
    if (!modal.isOpen()) return clearInterval(poll);
    const wasLow = low;
    const free = await readFree();
    if (!modal.isOpen()) return;
    modal.bodyEl.innerHTML = bodyHtml(free);
    if (wasLow !== low) renderActions();
    markGo();
  }, 3000);
  const choice = await modal.done;
  clearInterval(poll);
  return choice === "go";
}

// Erreur « disque plein » : la place restante est relue pour l'afficher dans le message.
function refreshDiskFreeForFailure() {
  if (!/ENOSPC|no space left|not enough space|espace disque/i.test(String(activity.failure?.error || ""))) return;
  window.mchub.diskFree().then((result) => {
    activity.diskFreeBytes = result?.ok ? result.freeBytes : null;
    renderActivity();
  });
}

async function joinServer(server, joinBtn) {
  // Pendant une partie sur CE serveur, le meme bouton sert a arreter (avec confirmation, dans
  // le panneau de la pilule).
  const state = activityState();
  if (state.slug === server.slug && state.phase === "play") {
    askStopFromPill();
    return;
  }
  joinBtn.disabled = true;
  await launchServer(server);
  syncJoinButtons();
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
  // `btn` peut manquer : « Réessayer » de la pilule relance une installation sans bouton.
  if (btn) btn.disabled = true;
  if (!(await confirmFirstInstall(server, { launch: false }))) {
    if (btn) btn.disabled = false;
    return;
  }
  // « Lancer le jeu quand c'est fini » (point 4, L3-G) : coche par defaut, decochable dans la pilule.
  activity.autoLaunch.add(server.slug);
  activity.failure = null;
  renderActivity();
  let retry = false;
  let launchAfter = false;
  try {
    const result = await window.mchub.installServer(server.slug, server.name);
    if (result?.ok) {
      // Disparait tout de suite pour CE serveur (2026-10-11) — pas besoin de
      // quitter puis revenir sur la fiche pour que ça se mette a jour.
      btn?.remove();
      launchAfter = activity.autoLaunch.has(server.slug);
      notifyIfAway(
        launchAfter ? t("activity.notifyLaunchingTitle", { name: server.name }) : t("activity.notifyReadyTitle", { name: server.name }),
        launchAfter ? t("activity.notifyLaunchingBody") : t("activity.notifyReadyBody"),
      );
      return;
    }
    if (result?.cancelled) return;
    if (result?.code === "manual_mods" && Array.isArray(result.manualMods)) {
      retry = (await showManualModsModal(result.manualMods, result.fromModrinth, result.fromModrinthMods, { slug: server.slug })) === "retry";
      if (!retry) activity.failure = { slug: server.slug, name: server.name, error: result.error, action: "install", manualMods: result.manualMods, fromModrinth: result.fromModrinth, fromModrinthMods: result.fromModrinthMods };
    } else if (result?.frozen) {
      await showModal({
        title: t("modal.frozenTitle"),
        body: t("modal.frozenBody", { name: server.name }),
        confirmLabel: t("modal.frozenClose"),
      });
    } else {
      activity.failure = { slug: server.slug, name: server.name, error: result?.error || "", action: "install" };
      refreshDiskFreeForFailure();
      openActivityPanel();
    }
  } finally {
    activity.autoLaunch.delete(server.slug);
    renderActivity();
    if (btn && document.body.contains(btn)) btn.disabled = false;
    if (launchAfter) launchServer(server);
  }
  if (retry) await installServerStandalone(server, btn && document.body.contains(btn) ? btn : null);
}

// Fenetre des mods qu'un modpack CurseForge interdit de telecharger par les autres launchers
// (14/10, preview validee par Rushi) : lien vers la page de chaque mod, dossier Telechargements
// ou les deposer, puis « Réessayer » (main.js/modpack.js les y retrouvent et verifient leur
// empreinte). Un fichier retire de CurseForge ne se rattrape pas : seul « Fermer » est propose.
// Resout "retry" ou "close".
function boldLabelIn(el, text, label) {
  const at = label ? text.indexOf(label) : -1;
  if (at < 0) {
    el.textContent = text;
    return;
  }
  const strong = document.createElement("b");
  strong.textContent = label;
  el.append(text.slice(0, at), strong, text.slice(at + label.length));
}

// `fromModrinth` : mods bloques deja recuperes sur Modrinth (meme fichier, voir findOnModrinth dans
// modpack.js) — la liste ne montre que ceux qui restent, le bandeau dit combien ont ete pris.
// Point 4 (L3-F) : les lignes se cochent seules quand le fichier arrive dans Telechargements
// (verifie toutes les 2 s), « Je l'ai déjà » coche a la main, et l'installation reprend toute seule
// des que tout est la. Les mods deja pris sur Modrinth sont listes en dessous.
// Lot 5 (audit 17/10, preview v3 validee) : titre « Encore X mods à ajouter », 3 etapes courtes,
// barre « 1 sur 2 ajouté », boutons Plus tard / Réessayer / Continuer l'installation (actif quand
// tout est la), puis « Tout est prêt ». Un fichier retire de CurseForge : bouton « Prévenir le
// serveur » (jamais d'envoi sans clic, audit du 19/10), une fois par serveur et par session.
const removedModsReported = new Set();
function showManualModsModal(manualMods, fromModrinth = 0, fromModrinthMods = [], context = {}) {
  return new Promise((resolve) => {
    const modrinthEl = document.getElementById("manual-mods-modrinth");
    modrinthEl.hidden = !(fromModrinth > 0);
    modrinthEl.textContent = fromModrinth > 0 ? t("manualMods.modrinthBanner", { count: fromModrinth }) : "";
    const viaModrinthEl = document.getElementById("manual-mods-via-modrinth");
    viaModrinthEl.innerHTML = Array.isArray(fromModrinthMods) && fromModrinthMods.length
      ? `<p class="manual-mods-section">${escapeHtml(t("manualMods.fromModrinthTitle"))}</p>${fromModrinthMods
          .map((name) => `<div class="manual-mod"><div class="manual-mod-text"><span class="manual-mod-name">${escapeHtml(name)}</span><span class="manual-mod-file">${escapeHtml(t("manualMods.sameFile"))}</span></div><span class="manual-mod-chip done">${escapeHtml(t("manualMods.modrinthOk"))}</span></div>`)
          .join("")}`
      : "";
    viaModrinthEl.hidden = !viaModrinthEl.innerHTML;
    const overlay = document.getElementById("manual-mods-overlay");
    const stepsEl = document.getElementById("manual-mods-steps");
    const listEl2 = document.getElementById("manual-mods-list");
    const actionsEl = document.getElementById("manual-mods-actions");
    const blocked = manualMods.filter((mod) => mod.reason !== "removed");
    const removed = manualMods.filter((mod) => mod.reason === "removed");
    const onlyRemoved = blocked.length === 0;

    // Audit du 19/10 (L-B1) : plus d'envoi automatique. Le proprietaire n'est prevenu que si le
    // joueur clique sur « Prévenir le serveur » (bouton plus bas) ; seuls partent les noms des
    // fichiers retires, deja affiches dans cette fenetre, et les versions.
    const reportRemoved = async (button) => {
      if (!context.slug || removedModsReported.has(context.slug)) return;
      removedModsReported.add(context.slug);
      button.disabled = true;
      button.textContent = t("activity.warnSending");
      const result = await window.mchub
        .reportInstallProblem({
          slug: context.slug,
          kind: "manual_mods",
          summary: t("manualMods.removedTitle"),
          detail: removed.map((mod) => mod.fileName || mod.modName || `#${mod.fileId}`).join(", ").slice(0, 300),
          minecraftVersion: knownServer(context.slug)?.minecraftVersion || null,
        })
        .catch(() => null);
      if (result?.ok) {
        button.textContent = `✓ ${t("manualMods.warnSent")}`;
      } else {
        removedModsReported.delete(context.slug);
        button.disabled = false;
        button.textContent = t("activity.warnServer");
        toolsToast(t("activity.warnFailed"));
      }
    };
    document.getElementById("manual-mods-title").textContent = onlyRemoved
      ? t("manualMods.removedTitle")
      : t("manualMods.title", { count: blocked.length });
    document.getElementById("manual-mods-body").textContent = onlyRemoved ? t("manualMods.removedBody") : t("manualMods.body");
    document.getElementById("manual-mods-note").textContent = onlyRemoved ? t("manualMods.removedNote") : t("manualMods.note");

    stepsEl.innerHTML = "";
    stepsEl.hidden = onlyRemoved;
    for (const [key, label] of [
      ["manualMods.step1", t("manualMods.openPage")],
      ["manualMods.step2", "Download"],
      ["manualMods.step3", t("manualMods.downloadsWord")],
    ]) {
      const li = document.createElement("li");
      boldLabelIn(li, t(key), label);
      stepsEl.append(li);
    }
    // Barre « 1 sur 2 ajouté » (lot 5).
    const progressEl = document.getElementById("manual-mods-progress");
    const progressBar = progressEl.querySelector("i");
    const progressText = document.getElementById("manual-mods-progress-text");
    const totalToAdd = blocked.filter((mod) => mod.fileName).length;
    progressEl.hidden = onlyRemoved || totalToAdd === 0;
    progressText.hidden = progressEl.hidden;
    let continueBtn = null;
    const syncProgress = () => {
      const done = Math.min(received.size, totalToAdd);
      progressBar.style.width = `${totalToAdd ? Math.round((done / totalToAdd) * 100) : 0}%`;
      progressText.textContent = t("manualMods.progress", { count: done, total: totalToAdd });
      if (continueBtn) continueBtn.disabled = done < totalToAdd;
    };

    // Lignes a cocher : nom de fichier attendu -> { chip, row }.
    const received = new Set();
    const rowsByFile = new Map();
    let finished = false;
    let pollTimer = null;
    const titleEl = document.getElementById("manual-mods-title");
    const noteEl = document.getElementById("manual-mods-note");
    const markReceived = (fileName) => {
      if (finished || received.has(fileName) || !rowsByFile.has(fileName)) return;
      received.add(fileName);
      const { chip, row } = rowsByFile.get(fileName);
      chip.className = "manual-mod-chip done";
      chip.textContent = t("manualMods.received");
      row.classList.add("received");
      row.querySelectorAll("button").forEach((button) => button.remove());
      const left = rowsByFile.size - received.size;
      titleEl.textContent = left > 0 ? t("manualMods.title", { count: left }) : t("manualMods.allHere");
      syncProgress();
      if (left === 0 && !onlyRemoved && removed.length === 0) {
        // « Tout est prêt » puis l'installation reprend toute seule.
        document.getElementById("manual-mods-body").textContent = t("manualMods.doneBody", { count: totalToAdd });
        stepsEl.hidden = true;
        progressBar.classList.add("done");
        noteEl.textContent = t("manualMods.continuing");
        noteEl.classList.add("ok");
        setTimeout(() => finish("retry"), 1600);
      }
    };

    listEl2.innerHTML = "";
    for (const mod of [...blocked, ...removed]) {
      const row = document.createElement("div");
      row.className = "manual-mod";
      const text = document.createElement("div");
      text.className = "manual-mod-text";
      const name = document.createElement("span");
      name.className = "manual-mod-name";
      name.textContent = mod.modName || mod.fileName || t("manualMods.fileFallback", { id: mod.fileId });
      const file = document.createElement("span");
      file.className = "manual-mod-file";
      file.textContent = mod.fileName || "—";
      // Sans nom de mod connu, le nom de fichier sert deja de titre : pas besoin de le repeter.
      file.hidden = !mod.modName && Boolean(mod.fileName);
      text.append(name, file);
      const chip = document.createElement("span");
      const gone = mod.reason === "removed";
      chip.className = `manual-mod-chip ${gone ? "gone" : "todo"}`;
      chip.textContent = gone ? t("manualMods.notFound") : t("manualMods.waiting");
      row.append(text, chip);
      if (!gone && mod.pageUrl) {
        const open = document.createElement("button");
        open.type = "button";
        open.className = "btn-secondary";
        open.textContent = t("manualMods.openPage");
        open.addEventListener("click", () => {
          window.mchub.openModPage(mod.pageUrl);
          open.textContent = `✓ ${t("manualMods.openPage")}`;
        });
        row.append(open);
      }
      if (!gone && mod.fileName) {
        rowsByFile.set(mod.fileName, { chip, row });
        const have = document.createElement("button");
        have.type = "button";
        have.className = "btn-ghost";
        have.textContent = t("manualMods.haveIt");
        have.addEventListener("click", () => markReceived(mod.fileName));
        row.append(have);
      }
      listEl2.append(row);
    }

    actionsEl.innerHTML = "";
    const makeButton = (label, className, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = label;
      button.addEventListener("click", onClick);
      actionsEl.append(button);
      return button;
    };
    const finish = (choice) => {
      if (finished) return;
      finished = true;
      clearInterval(pollTimer);
      noteEl.classList.remove("ok");
      overlay.hidden = true;
      document.body.classList.remove("modal-blocking");
      resolve(choice);
    };
    // Surveillance du dossier Telechargements tant que la fenetre est ouverte.
    if (rowsByFile.size) {
      const poll = async () => {
        try {
          const found = await window.mchub.findModsInDownloads([...rowsByFile.keys()]);
          found.forEach(markReceived);
        } catch {
          // Dossier illisible : le joueur peut toujours cocher a la main.
        }
      };
      pollTimer = setInterval(poll, 2000);
      poll();
    }
    if (removed.length && context.slug && signedIn) {
      const warnBtn = makeButton(t("activity.warnServer"), "btn-ghost", () => reportRemoved(warnBtn));
      if (removedModsReported.has(context.slug)) {
        warnBtn.disabled = true;
        warnBtn.textContent = `✓ ${t("manualMods.warnSent")}`;
      }
    }
    if (onlyRemoved) {
      makeButton(t("manualMods.close"), "join-btn push", () => finish("close"));
    } else {
      makeButton(t("manualMods.openDownloads"), "btn-ghost", () => window.mchub.openDownloadsFolder());
      makeButton(t("manualMods.later"), "btn-secondary push", () => finish("close"));
      makeButton(t("manualMods.retry"), "btn-secondary", () => finish("retry"));
      continueBtn = makeButton(t("manualMods.continue"), "join-btn", () => finish("retry"));
    }
    syncProgress();

    overlay.querySelector(".modal-box").classList.add("pop-in");
    overlay.hidden = false;
    document.body.classList.add("modal-blocking");
  });
}

async function openDetail(slug) {
  // Retour qui garde la place (serie 2, idee 3) : position de la liste et serveur ouvert.
  detailReturn = { origin: detailOrigin, scroll: document.querySelector("main")?.scrollTop || 0, slug, query: detailOrigin === "search" ? paletteLastQuery : "" };
  listViewGeneration++;
  homePanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  friendsPanelEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
  updateGuestBanner(false);
  statusEl.hidden = true;
  listEl.hidden = true;
  detailEl.hidden = false;
  clearPageTheme();
  detailEl.innerHTML = skeletonDetailHtml();

  const result = await window.mchub.getServer(slug);
  if (!result.ok && result.frozen) {
    renderFrozenDetail(slug);
    return;
  }
  if (!result.ok && result.notFound) {
    renderMissingDetail(slug);
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

async function fetchServerList({ force = false, background = false } = {}) {
  if (!force && serverListCache && Date.now() - serverListCacheAt < SERVER_LIST_CACHE_MS) {
    return serverListCache;
  }
  const result = await window.mchub.listServers({ background });
  if (result.ok) {
    rememberTagLabels(result.servers);
    serverListCache = result;
    serverListCacheAt = Date.now();
  }
  return result;
}

// Vue demandee en dernier : une liste qui finit de charger APRES l'ouverture d'une fiche (lien
// « Ouvrir dans le launcher » du site, clic rapide) ne doit plus reafficher l'en-tete Serveurs
// par-dessus la fiche (bug vu par Rushi le 17/10).
let listViewGeneration = 0;

async function loadServers() {
  const generation = ++listViewGeneration;
  statusEl.hidden = true;
  detailEl.hidden = true;
  listEl.hidden = false;
  listEl.innerHTML = skeletonRowHtml().repeat(6);

  // Toujours un aller-retour reseau ici : c'est le point d'entree explicite
  // "l'utilisateur veut voir la liste a jour" (nav, connexion, rafraichissement
  // silencieux) — mais il alimente au passage le cache ci-dessus pour la
  // barre de lancement rapide.
  const result = await fetchServerList({ force: true });
  if (generation !== listViewGeneration) return;
  if (!result.ok) {
    // Idee 2 du lancement (19/10) : un bloc calme avec deux sorties plutot qu'une ligne rouge.
    // Le detail technique reste en petit, pour l'aide.
    listEl.innerHTML = `
      <div class="filters-empty empty-state list-error-state">
        <span class="empty-state-icon">${EMPTY_ICONS.cloudOff}</span>
        <h3>${escapeHtml(t("serverList.errorTitle"))}</h3>
        <p>${escapeHtml(t("serverList.errorText"))}</p>
        <div class="filters-empty-actions">
          <button type="button" class="join-btn" id="list-error-retry">${escapeHtml(t("serverList.errorRetry"))}</button>
          <button type="button" class="btn-secondary" id="list-error-library">${escapeHtml(t("serverList.errorLibrary"))}</button>
        </div>
        ${result.error ? `<small class="list-error-detail">${escapeHtml(result.error)}</small>` : ""}
      </div>`;
    const pager = document.getElementById("server-list-pager-slot");
    if (pager) pager.innerHTML = "";
    document.getElementById("list-error-retry").addEventListener("click", () => loadServers());
    document.getElementById("list-error-library").addEventListener("click", () => showLibraryView());
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
  navFriendsBtn.hidden = !friendsFeatureOn;
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
    clearBootProfile();
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
  saveBootProfile(profile);
  updateGuestBanner(false);
  gateEl.hidden = true;
  appEl.hidden = false;
  renderAccountHeader(profile, opts);
  showHomeView();
  refreshNotifications();
  maybeShowFirstRunWizard();
}

// Assistant du premier lancement (design 17/10, point 6, L5-I) : trois gros choix au tout premier
// demarrage, puis plus jamais (« Continuer » comme « Passer » le marquent comme vu). Un joueur qui a
// deja joue (historique present) ne le voit pas.
let firstRunWizardShown = false;
async function maybeShowFirstRunWizard() {
  if (firstRunWizardShown) return;
  const settings = await window.mchub.settings.get();
  if (settings.firstRunWizardDone || settings.lastPlayedSlug || (settings.recentlyPlayed || []).length) return;
  firstRunWizardShown = true;
  const options = [
    { value: "join", icon: "▶", color: "linear-gradient(135deg,#2c6e45,#1f4f8a)", title: t("wizard.join"), sub: t("wizard.joinSub") },
    { value: "packs", icon: "▣", color: "linear-gradient(135deg,#7a3fb0,#2a1840)", title: t("wizard.packs"), sub: t("wizard.packsSub") },
    { value: "vanilla", icon: "⛏", color: "linear-gradient(135deg,#b06a3f,#40220f)", title: t("wizard.vanilla"), sub: t("wizard.vanillaSub") },
  ];
  let choice = "join";
  const modal = openToolsModal({
    title: t("wizard.title"),
    bodyHtml: `<p class="first-install-note" style="margin:0">${escapeHtml(t("wizard.body"))}</p><div class="wizard-options">${options
      .map((o) => `<button type="button" class="wizard-option" data-wizard="${o.value}" aria-pressed="${o.value === choice}"><span class="wiz-ico" style="background:${o.color}">${o.icon}</span><b>${escapeHtml(o.title)}</b><small>${escapeHtml(o.sub)}</small></button>`)
      .join("")}</div>`,
    actions: [
      { label: t("wizard.skip"), value: "skip" },
      { label: t("wizard.next"), cls: "join-btn", value: "go" },
    ],
  });
  modal.bodyEl.querySelectorAll(".wizard-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      choice = btn.dataset.wizard;
      modal.bodyEl.querySelectorAll(".wizard-option").forEach((other) => other.setAttribute("aria-pressed", String(other === btn)));
    });
    btn.addEventListener("dblclick", () => modal.close("go"));
  });
  const result = await modal.done;
  await window.mchub.settings.set({ firstRunWizardDone: true });
  // Serie 2, idee 9 : si le disque des jeux a peu de place, proposer d'en choisir un autre.
  if (await maybeAskGamesDrive()) return;
  if (result !== "go") return;
  if (choice === "packs") showMyInstancesView();
  else {
    if (choice === "vanilla") listFilters = { ...listFilters, type: "vanilla" };
    showServersView();
  }
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
// FTB : texte seulement, couleur neutre (pas de logo ni de couleur de marque).
const MC_STATUS_TILE = { minecraft: ["MC", "#62b246"], modrinth: ["Mr", "#1bd96a"], curseforge: ["CF", "#f16436"], ftb: ["FTB", "#6b7280"] };
const MC_STATUS_REFRESH_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>';
const MC_STATUS_CHEV_SVG = '<svg class="mc-status-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
// Replies par defaut : seul le test de connexion reste ouvert. Un clic sur un
// fournisseur l'ouvre (il sort de cet ensemble).
const mcStatusCollapsed = new Set(["minecraft", "modrinth", "curseforge", "ftb"]);
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
  // Barre du haut allegee (design 17/10, point 1) : une pastille seule quand tout va bien, un mot
  // ne revient qu'en cas de panne ou de ralentissement (un point seul ferait croire a une panne).
  const word = document.getElementById("mc-status-word");
  const label = worst === "offline" ? t("titlebar.servicesDown") : worst === "degraded" ? t("titlebar.servicesSlow") : t("titlebar.servicesOk");
  word.textContent = label;
  word.hidden = worst === "ok";
  mcStatusTrigger.classList.toggle("down", worst === "offline");
  mcStatusTrigger.classList.toggle("slow", worst === "degraded");
  mcStatusTrigger.title = label;
  mcStatusTrigger.setAttribute("aria-label", label);

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
// Test de connexion reactive (15/10) : main.js ne le refait qu'une fois par jour,
// "Actualiser" le relance a la demande.
const CONNECTION_TEST_ENABLED = true;

async function loadMcStatus(force = false) {
  if (mcStatusLoading) return;
  mcStatusLoading = true;
  if (mcStatusData) document.getElementById("mc-status-refresh")?.classList.add("spinning");
  else mcStatusList.innerHTML = `<div class="mc-status-row" style="padding: 14px;">${t("common.checking")}</div>`;
  try {
    renderMcStatus(await window.mchub.getServicesStatus(force));
    // Test de connexion (ping + envoi/téléchargement) : une seule mesure par jour (voir main.js
    // status:getConnection), sinon le dernier résultat du jour est réaffiché tout de suite.
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
  // Vérifié en DERNIER au démarrage (bug signalé par Rushi le 18/10) : lancé en même temps que
  // tout le reste, le test subissait les ralentissements du chargement et le point passait à
  // l'orange alors que tout allait bien. On attend que l'appli soit affichée et au calme.
  scheduleStartupMcStatus();
}

function scheduleStartupMcStatus() {
  const ready = () => !appEl.hidden && !document.body.classList.contains("bootstrapping");
  const run = () => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 0));
    setTimeout(() => idle(() => { if (!mcStatusData && !mcStatusLoading) loadMcStatus(); }, { timeout: 4000 }), 3000);
  };
  if (ready()) return run();
  const timer = setInterval(() => {
    if (!ready()) return;
    clearInterval(timer);
    run();
  }, 500);
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
  // Couleurs du theme (sombre ET clair) au lieu de codes fixes (audit 17/10, lot 1).
  server_frozen: "var(--notif-frozen)",
  admin_info: "var(--notif-info)",
  admin_warning: "var(--warn)",
  admin_error: "var(--danger)",
  broadcast_announcement: "var(--notif-info)",
  broadcast_maintenance: "var(--warn)",
  broadcast_alert: "var(--danger)",
  broadcast_promotion: "var(--success)",
  verification_approved: "var(--success)",
  verification_rejected: "var(--danger)",
  instance_back_online: "var(--success)",
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
    notifListEl.className = "";
    // Pas de bouton ici (audit 17/10, lot 1) : « Régler les notifications » menait a des
    // Parametres sans aucun reglage de notifications.
    notifListEl.innerHTML = emptyStateHtml({ icon: "bell", title: t("notifications.emptyTitle"), text: t("notifications.emptyText"), extraClass: "notif-empty-state" });
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
async function ensureNotInMaintenance(pendingCheck) {
  const status = await (pendingCheck || window.mchub.checkMaintenance());
  if (!status.active) return;
  bootstrapEl.hidden = true;
  await showMaintenanceScreen(status.message);
}

// Re-verifiee periodiquement (voir scheduleRefresh plus bas) : une maintenance activee
// pendant que le launcher tourne deja (apres l'ecran de connexion) doit aussi bloquer,
// pas seulement au demarrage. maintenanceBypassed evite de rebloquer la meme session
// une fois le bon code entre.
async function checkMaintenanceLoop() {
  if (maintenanceBypassed || pulseIsFresh()) return;
  const status = await window.mchub.checkMaintenance({ background: true });
  if (status.active) await showMaintenanceScreen(status.message);
}

// Idee 2 du lancement (19/10) : le signal de presence (sendPresenceHeartbeat, chaque minute)
// rapporte aussi la maintenance et, une fois sur 5, les notifications. Tant qu'il repond, les
// verifications separees ci-dessus et plus bas ne refont pas l'appel (moins de charge sur la
// base du site). Pas connecte ou site pas encore a jour : elles tournent comme avant.
let lastGroupedPulseAt = 0;
let maintenanceScreenOpen = false;
// Frais = recu depuis moins de 2,5 envois de presence (en jeu, la presence ne part que toutes les
// 5 min : voir window.OMNI_REFRESH dans refreshSettings.js).
function pulseIsFresh() {
  const every = gamePlaying ? window.OMNI_REFRESH.PRESENCE_PLAYING_MS : window.OMNI_REFRESH.PRESENCE_IDLE_MS;
  return Date.now() - lastGroupedPulseAt < every * 2.5;
}

async function showMaintenanceFromPulse(message) {
  if (maintenanceBypassed || maintenanceScreenOpen) return;
  maintenanceScreenOpen = true;
  try {
    await showMaintenanceScreen(message);
  } finally {
    maintenanceScreenOpen = false;
  }
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

async function refreshNotifications({ background = false } = {}) {
  if (!signedIn) return;
  const result = await window.mchub.listNotifications({ background });
  if (!result.ok) return;
  await applyNotifications(result.notifications);
}

// Tour planifie (toutes les 5 min) : inutile si le signal groupe vient de les rapporter.
async function scheduledRefreshNotifications() {
  if (pulseIsFresh()) return;
  await refreshNotifications({ background: true });
}

async function applyNotifications(notifications) {
  latestNotifications = notifications;
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
  const playDone = !isActive && task.status === "complete" && task.kind === "install"
    ? `<button type="button" class="activity-btn full task-play" data-activity="play-task" data-slug="${escapeHtml(task.slug)}">${escapeHtml(t("home.play"))}</button>`
    : "";
  return `
    <div class="task-item${task.status === "error" ? " task-error" : ""}">
      <div class="task-item-row">
        <div class="task-item-icon">${escapeHtml((task.name || task.slug || "?").slice(0, 1).toUpperCase())}</div>
        <div class="task-item-body">
          <div class="task-item-name">${escapeHtml(task.name || task.slug)}</div>
          <div class="task-item-meta">${escapeHtml(metaParts.filter(Boolean).join(" · "))}</div>
        </div>
        <div class="task-item-actions">${actions}${playDone}</div>
      </div>
      ${pct != null ? `<div class="task-progress-track"><div class="task-progress-fill" style="width:${pct}%;"></div></div>` : ""}
    </div>
  `;
}

function renderTasksPanel(tasks) {
  activity.tasks = tasks;
  const running = tasks.filter((task) => task.status === "active");
  const speed = running.reduce((sum, task) => sum + (task.speedBps || 0), 0);
  // Moyenne glissante : le temps restant reste lisible au lieu de sauter a chaque paquet recu.
  activity.speedEma = running.length === 0 ? 0 : activity.speedEma ? activity.speedEma * 0.8 + speed * 0.2 : speed;
  // Le haut du panneau montre deja la tache en cours (voir activityPanelHtml) : la liste ne
  // garde que les AUTRES telechargements actifs et ceux qui sont termines.
  const active = tasks.filter((task) => task.status === "active" || task.status === "paused").slice(1);
  const complete = tasks.filter((task) => task.status === "complete" || task.status === "error" || task.status === "cancelled");

  document.getElementById("tasks-active-section").hidden = active.length === 0;
  document.getElementById("tasks-complete-section").hidden = complete.length === 0;
  document.getElementById("tasks-list-scroll").classList.toggle("empty", active.length === 0 && complete.length === 0);
  document.getElementById("tasks-active-list").innerHTML = active.map((task) => taskRowHtml(task, true)).join("");
  document.getElementById("tasks-complete-list").innerHTML = complete.map((task) => taskRowHtml(task, false)).join("");
  renderActivity();
}

function wireTasksMenu() {
  const trigger = document.getElementById("tasks-trigger");
  const panel = document.getElementById("tasks-panel");

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (panel.hidden) openActivityPanel();
    else closeActivityPanel();
  });
  panel.addEventListener("click", (event) => {
    event.stopPropagation();
    const btn = event.target.closest("[data-activity]");
    if (btn) handleActivityAction(btn);
  });
  panel.addEventListener("change", (event) => {
    const box = event.target.closest("[data-autolaunch]");
    if (!box) return;
    if (box.checked) activity.autoLaunch.add(box.dataset.autolaunch);
    else activity.autoLaunch.delete(box.dataset.autolaunch);
  });
  document.addEventListener("click", () => closeActivityPanel());
  wireDismissOnEscape(panel, trigger);
  // « En jeu · 12 min » : la duree avance toute seule.
  setInterval(() => {
    if (gamePlaying) renderActivity();
  }, 30_000);

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

// --- Page "Amis" (systeme d'amis, 2026-10-14) ---
// Statut binaire en ligne/hors ligne uniquement (pas de "absent"/"invisible"/"ne pas
// deranger", scope valide par l'utilisateur), visible des seuls amis acceptes. Demande puis
// accord (corrige le 2026-10-14, avant : ajout direct sans accord) : sections "Demandes
// recues" (Accepter/Refuser), amis en ligne/hors ligne, puis "Demandes envoyees" (Annuler).
// Chargee a l'ouverture de la page, pas de badge/compteur proactif comme les notifications.
let friendsList = [];
let friendsIncoming = [];
let friendsOutgoing = [];
// Etat du chargement (audit 14/10, K2) : avant, une panne s'affichait comme « Pas encore
// d'amis », et les listes du compte precedent restaient affichees apres un changement de compte.
// friendsOwnerId = compte a qui appartiennent les listes ci-dessus.
let friendsStatus = "idle"; // "idle" | "loaded" | "error"
let friendsOwnerId = null;

function resetFriendsState() {
  friendsList = [];
  friendsIncoming = [];
  friendsOutgoing = [];
  friendsStatus = "idle";
  friendsOwnerId = null;
}

function friendRowHtml(friend) {
  const name = friend.minecraftUsername || "?";
  return `
    <div class="friends-item${friend.online ? "" : " offline"}" data-id="${escapeHtml(friend.userId)}">
      <span class="friends-item-avatar">
        ${escapeHtml(name.charAt(0).toUpperCase())}
        <span class="status-dot${friend.online ? " online" : ""}"></span>
      </span>
      <span class="friends-item-text">
        <span class="friends-item-name sensitive" data-mask="${escapeHtml(t("discreet.friendMask"))}">${escapeHtml(name)}</span>
        <span class="friends-item-status${friend.online ? " online" : ""}">${t(friend.online ? "friends.online" : "friends.offline")}</span>
      </span>
      <button type="button" class="icon-btn friends-item-remove" data-id="${escapeHtml(friend.userId)}" title="${t("friends.remove")}" aria-label="${t("friends.remove")}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>`;
}

// Demande en attente : pas de pastille ni de statut en ligne (l'autre joueur n'a pas encore
// accepte, ou c'est moi qui n'ai pas encore repondu).
function friendRequestRowHtml(request, kind) {
  const name = request.minecraftUsername || "?";
  const id = escapeHtml(request.userId);
  const actions =
    kind === "incoming"
      ? `<button type="button" class="join-btn friends-request-btn friends-request-accept" data-id="${id}">${t("friends.accept")}</button>
         <button type="button" class="friends-request-btn ghost friends-request-decline" data-id="${id}">${t("friends.decline")}</button>`
      : `<button type="button" class="friends-request-btn ghost friends-request-cancel" data-id="${id}">${t("friends.cancel")}</button>`;
  return `
    <div class="friends-item friends-request ${kind}" data-id="${id}">
      <span class="friends-item-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</span>
      <span class="friends-item-text">
        <span class="friends-item-name sensitive" data-mask="${escapeHtml(t("discreet.friendMask"))}">${escapeHtml(name)}</span>
        <span class="friends-item-status">${t(kind === "incoming" ? "friends.incomingHint" : "friends.outgoingHint")}</span>
      </span>
      <span class="friends-request-actions">${actions}</span>
    </div>`;
}

function friendsSectionHtml(titleKey, items, rowHtml = friendRowHtml) {
  if (items.length === 0) return "";
  return `
    <section class="friends-section">
      <h3 class="friends-section-title">${t(titleKey)} <span class="count">${items.length}</span></h3>
      <div class="friends-grid">${items.map(rowHtml).join("")}</div>
    </section>`;
}

function renderFriendsList() {
  const listEl = document.getElementById("friends-list");
  if (friendsOwnerId !== (currentProfile?.id ?? null)) resetFriendsState();
  const nothing = friendsList.length === 0 && friendsIncoming.length === 0 && friendsOutgoing.length === 0;
  if (nothing && friendsStatus !== "loaded") {
    listEl.innerHTML = `
      <div class="friends-empty">
        <h3>${t(friendsStatus === "error" ? "friends.loadError" : "friends.loading")}</h3>
        ${friendsStatus === "error" ? `<p>${t("friends.loadErrorHint")}</p>` : ""}
      </div>`;
    return;
  }
  if (nothing) {
    listEl.innerHTML = `
      <div class="friends-empty">
        <span class="friends-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <h3>${t("friends.empty")}</h3>
        <p>${t("friends.emptyHint")}</p>
        <button type="button" class="join-btn friends-empty-add">${t("friends.emptyAction")}</button>
      </div>`;
    listEl.querySelector(".friends-empty-add")?.addEventListener("click", () => document.getElementById("friends-add-input")?.focus());
    return;
  }
  const online = friendsList.filter((f) => f.online);
  const offline = friendsList.filter((f) => !f.online);
  listEl.innerHTML =
    friendsSectionHtml("friends.sectionIncoming", friendsIncoming, (r) => friendRequestRowHtml(r, "incoming")) +
    friendsSectionHtml("friends.sectionOnline", online) +
    friendsSectionHtml("friends.sectionOffline", offline) +
    friendsSectionHtml("friends.sectionOutgoing", friendsOutgoing, (r) => friendRequestRowHtml(r, "outgoing"));
}

// `background` : rafraichissement des listes de serveurs (refreshFriendsForLists), garde 5 min par
// main.js et mis en pause quand le site est sature. Sans lui (page Amis ouverte, apres une
// action), main.js ne garde la liste qu'une minute, comme avant.
async function refreshFriends({ background = false } = {}) {
  if (!signedIn) return;
  const ownerId = currentProfile?.id ?? null;
  const result = await window.mchub.friends.list({ background });
  // Compte change ou deconnecte pendant la requete : la reponse ne le concerne plus.
  if (!signedIn || (currentProfile?.id ?? null) !== ownerId) return;
  if (friendsOwnerId !== ownerId) resetFriendsState();
  friendsOwnerId = ownerId;
  if (!result.ok) {
    // Les listes deja affichees restent (panne passagere) ; sinon, message d'erreur.
    if (friendsStatus !== "loaded") friendsStatus = "error";
    renderFriendsList();
    return;
  }
  friendsList = result.friends;
  friendsIncoming = result.incoming;
  friendsOutgoing = result.outgoing;
  friendsStatus = "loaded";
  renderFriendsList();
}

async function showFriendsView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
  updateGuestBanner(false);
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  friendsPanelEl.hidden = false;
  navHomeBtn.classList.remove("active");
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navFriendsBtn.classList.add("active");
  document.getElementById("friends-feedback").hidden = true;
  // Etat vide affiche tout de suite (la page n'est jamais blanche), remplace par la vraie liste
  // des que l'API repond.
  renderFriendsList();
  document.getElementById("friends-policy-pop").hidden = true;
  document.getElementById("friends-gear")?.setAttribute("aria-expanded", "false");
  document.getElementById("friends-gear").hidden = !signedIn;
  renderFriendPolicyCard(document.getElementById("friends-policy-slot"), { where: "friends" });
  await refreshFriends();
}

function wireFriends() {
  const form = document.getElementById("friends-add-form");
  const input = document.getElementById("friends-add-input");
  const submitBtn = document.getElementById("friends-add-submit");
  const feedbackEl = document.getElementById("friends-feedback");
  const listEl = document.getElementById("friends-list");

  navFriendsBtn.addEventListener("click", showFriendsView);

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
    // Message TOUJOURS le meme (anti-enumeration, voir sendFriendRequest cote site) : ne dit
    // jamais si le pseudo existait vraiment ou etait deja ami — la demande apparait ensuite dans
    // "Demandes envoyees" si elle a bien ete creee.
    feedbackEl.textContent = t("friends.addFeedback");
    feedbackEl.hidden = false;
    await refreshFriends();
  });

  // Retirer un ami, refuser une demande recue et annuler une demande envoyee passent tous par
  // friends.remove (la ligne de la paire est supprimee cote site) ; seul Accepter a sa route.
  listEl.addEventListener("click", async (event) => {
    const btn = event.target.closest(".friends-item-remove, .friends-request-accept, .friends-request-decline, .friends-request-cancel");
    if (!btn) return;
    // Retirer un ami se confirme (lot 4) ; refuser ou annuler une demande, non (rien n'est perdu).
    if (btn.classList.contains("friends-item-remove")) {
      // Mode discret : le pseudo reste masque, meme dans la fenetre.
      const name = discreetMode ? t("discreet.friendMask") : btn.closest(".friends-item")?.querySelector(".friends-item-name")?.textContent?.trim() || "";
      const { confirmed } = await showModal({
        tone: "danger",
        title: t("friends.removeTitle", { name }),
        body: t("friends.removeBody", { name }),
        confirmLabel: t("friends.removeBtn"),
        cancelLabel: t("common.cancel"),
      });
      if (!confirmed) return;
    }
    btn.closest(".friends-item").querySelectorAll("button").forEach((b) => (b.disabled = true));
    feedbackEl.hidden = true;
    const result = btn.classList.contains("friends-request-accept")
      ? await window.mchub.friends.accept(btn.dataset.id)
      : await window.mchub.friends.remove(btn.dataset.id);
    // Echec d'Accepter/Refuser/Retirer : dit au joueur que rien n'a change (avant : silencieux).
    if (!result?.ok) {
      feedbackEl.textContent = t("friends.actionError");
      feedbackEl.hidden = false;
    }
    await refreshFriends();
  });
}

// Heartbeat de presence : greffe sur le cycle de 60s existant (scheduleRefresh(sendPresenceHeartbeat)
// plus bas, meme intervalle que silentRefreshList — REFRESH_INTERVAL_MS), jamais un intervalle a
// part. Echec silencieux (voir presence:heartbeat cote main.js, qui ne rejette jamais) : un
// heartbeat rate ne fait que retarder le passage "hors ligne" d'un ami, jamais a signaler au joueur.
let presencePulseCount = 0;
async function sendPresenceHeartbeat() {
  if (!signedIn) return;
  // Notifications 1 fois sur 5 (toutes les 5 min, comme avant) ; en jeu, a chaque envoi (il n'y en
  // a qu'un toutes les 5 min).
  presencePulseCount += 1;
  const result = await window.mchub.sendPresenceHeartbeat({ withNotifications: gamePlaying || presencePulseCount % 5 === 0 });
  if (result?.accountDeleted) {
    handleAccountDeleted();
    return;
  }
  if (!result?.ok || !result.grouped || !signedIn) return;
  lastGroupedPulseAt = Date.now();
  if (result.notifications) await applyNotifications(result.notifications);
  if (result.maintenance?.active) showMaintenanceFromPulse(result.maintenance.message);
}

// Compte Omniscient supprime sur le site pendant que le launcher etait connecte (voir
// presence:heartbeat dans main.js, qui a deja coupe et oublie la session) : meme retour au mode
// visiteur que "Se deconnecter", avec l'ecran de connexion pour expliquer pourquoi. Se
// reconnecter avec Microsoft recree un compte neuf.
function handleAccountDeleted() {
  signedIn = false;
  currentProfile = null;
  myInstancesServers = [];
  myJoinedServers = [];
  renderGuestHeader();
  showServersView();
  appEl.hidden = true;
  gateEl.hidden = false;
  setGateBusy(false);
  gateMessageEl.textContent = t("gate.accountDeleted");
  gateMessageEl.classList.remove("ms-error");
  if (signInCountdownTimer) clearInterval(signInCountdownTimer);
  startBackToGuestCountdown(document.getElementById("gate-countdown"), 15);
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
  friendsPanelEl.hidden = true;
  navHomeBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navFriendsBtn.classList.remove("active");
  navServersBtn.classList.add("active");
  updateGuestBanner(true);
  loadServers();
}

// Bandeau "Tu navigues en visiteur" en haut de l'annuaire (2026-10-15) : seulement en mode
// visiteur, dans la vue Serveurs. "Plus tard" le masque jusqu'au prochain demarrage (simple
// variable en memoire, rien d'enregistre). Les autres vues appellent updateGuestBanner(false).
let guestBannerDismissed = false;
function updateGuestBanner(inServersView) {
  guestBannerEl.hidden = !inServersView || signedIn || guestBannerDismissed;
}
document.getElementById("guest-banner-signin").addEventListener("click", () => attemptSignIn(true));
document.getElementById("guest-banner-later").addEventListener("click", () => {
  guestBannerDismissed = true;
  updateGuestBanner(false);
});

// Accueil (voir "01b Home" dans Design/archive/2026-09-23/Omniscient Launcher
// Mockups.dc.html — retire par megarde du dernier export, mais toujours voulu) —
// sans le bandeau "a la une" (lie au futur systeme payant, voir memoire
// project_page_builder) ni les actualites (aucun systeme de contenu a
// publier dessus pour l'instant) : uniquement ce qui vient de donnees deja
// disponibles localement — dernier serveur joue, favoris, et un apercu de
// "Mes instances" pour les proprietaires.
// Carte « Reprendre » (design 17/10, point 3, preview validee) : le dernier serveur joue, un gros
// bouton Jouer qui suit l'etat de la pilule (voir syncJoinButtons), et les favoris en puces juste
// en dessous. Remplace l'ancienne grande carte « Continuer » et le menu favori de la barre du bas.
function homeContinueCardHtml(server, playedAt) {
  const when = playedAt ? relativeDayText(playedAt) : "";
  return `
    <div class="home-resume" data-slug="${escapeHtml(server.slug)}" role="button" tabindex="0">
      <span class="home-resume-icon">${serverIconInner(server)}</span>
      <div class="home-resume-txt">
        <span class="home-resume-when">${escapeHtml(when ? t("activity.lastPlayedWhen", { when }) : t("activity.lastPlayed"))}</span>
        <h2>${escapeHtml(server.name)}</h2>
        <p>${playersLabel(server)}</p>
      </div>
      <button type="button" class="join-btn home-resume-play" data-join-slug="${escapeHtml(server.slug)}" data-base-class="home-resume-play" data-join-label="home.play">${t("home.play")}</button>
    </div>`;
}

// Premier lancement : pas encore de dernier serveur, on invite a en choisir un.
function homeResumeEmptyHtml() {
  return `
    <div class="home-resume-empty">
      <b>${escapeHtml(t("home.firstServerTitle"))}</b>
      <p>${escapeHtml(t("home.firstServerBody"))}</p>
      <button type="button" class="join-btn" id="home-first-browse">${escapeHtml(t("home.browseServers"))}</button>
    </div>`;
}

function homeFavoriteChipsHtml(servers) {
  return `<div class="home-fav-chips" id="home-fav-chips">${servers
    .slice(0, 3)
    .map(
      (server) => `
      <button type="button" class="home-fav-chip" data-slug="${escapeHtml(server.slug)}" title="${escapeHtml(t("home.playOn", { name: server.name }))}">
        <span class="home-fav-chip-icon">${serverIconInner(server)}</span>
        <span class="home-fav-chip-name">${escapeHtml(server.name)}</span>
        <span class="home-fav-chip-play" aria-hidden="true">▶</span>
      </button>`,
    )
    .join("")}</div>`;
}

function homeInstanceRowHtml(server) {
  const status = instanceStatus(server);
  return `
    <div class="row" data-slug="${escapeHtml(server.slug)}" style="cursor: default;">
      <span class="server-icon" style="width: 38px; height: 38px; border-radius: 8px; font-size: 14px;">${serverIconInner(server)}</span>
      <div class="row-body">
        <div class="row-title-line">
          <h3>${escapeHtml(server.name)}</h3>
          <span class="badge"${server.frozenAt ? " style=\"color:var(--frozen);border-color:var(--frozen)\"" : ""}>${t(`myInstances.${instanceBadgeKey(status, server)}`)}</span>
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
  updateGuestBanner(false);
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  friendsPanelEl.hidden = true;
  homePanelEl.hidden = false;
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navFriendsBtn.classList.remove("active");
  navHomeBtn.classList.add("active");
  await renderHomeView();
}

// Slugs de serveurs mis en avant par l'equipe (gratuit, jamais paye) pour la colonne "A la une"
// de l'accueil. Vide = le serveur le plus actif non deja affiche. Decision de Rushi (14/10) :
// la carte dit « Le plus actif » (home.teamPick) ; si un slug est ajoute ici un jour, changer
// aussi ce libelle, sinon il serait faux.
const TEAM_PICK_SLUGS = [];

// --- Demarrage plus rapide (18/10, point 1) : dernier pseudo et dernier accueil gardes en memoire
// (localStorage, jamais de jeton : seulement id, pseudo et skins du profil Minecraft public).
const BOOT_PROFILE_KEY = "mchub.bootProfile";
const HOME_CACHE_KEY = "mchub.homeCache";
let homeBootPreview = false;
let homeRenderGeneration = 0;

function readBootProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(BOOT_PROFILE_KEY) || "null");
    return profile && profile.id && profile.name ? profile : null;
  } catch {
    return null;
  }
}
function saveBootProfile(profile) {
  try {
    if (profile?.id) localStorage.setItem(BOOT_PROFILE_KEY, JSON.stringify({ id: profile.id, name: profile.name, skins: profile.skins }));
  } catch {
    // Pas de memoire : le prochain demarrage attendra la reconnexion, comme avant.
  }
}
function clearBootProfile() {
  try {
    localStorage.removeItem(BOOT_PROFILE_KEY);
    localStorage.removeItem(HOME_CACHE_KEY);
  } catch {
    // Rien de plus a faire.
  }
}
function readHomeCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(HOME_CACHE_KEY) || "null");
    return cache && currentProfile && cache.profileId === currentProfile.id ? cache.data : null;
  } catch {
    return null;
  }
}
function saveHomeCache(data) {
  try {
    if (currentProfile) localStorage.setItem(HOME_CACHE_KEY, JSON.stringify({ profileId: currentProfile.id, data }));
  } catch {
    // Cache facultatif.
  }
}

async function renderHomeView() {
  homePanelEl.className = "detail";
  const generation = ++homeRenderGeneration;
  const cached = readHomeCache();
  if (cached) {
    paintHomeView(cached);
  } else {
    homePanelEl.innerHTML = `
    <h2 style="margin-bottom: 18px;">${t("home.greeting", { name: escapeHtml(currentProfile ? currentProfile.name : "") })}</h2>
    ${skeletonListHtml(2)}`;
  }
  // Apercu du demarrage : les vraies donnees viendront avec la reconnexion (enterApp).
  if (homeBootPreview) return;

  const [settings, favoriteSlugs, myServersResult] = await Promise.all([
    settingsWithFreshRecents(),
    getFavoriteSlugs(),
    currentProfile ? window.mchub.listMyServers() : Promise.resolve({ ok: false, servers: [] }),
  ]);

  // En même temps plutôt que l'une après l'autre (14/10) : l'accueil attendait la somme des trois.
  const [continueResolved, favoriteServers, listResult, featuredResult] = await Promise.all([
    settings.lastPlayedSlug ? resolveServersBySlug([settings.lastPlayedSlug]) : Promise.resolve([]),
    favoriteSlugs.length > 0 ? resolveServersBySlug(favoriteSlugs.slice(0, 4)) : Promise.resolve([]),
    fetchServerList(),
    window.mchub.getFeaturedServer().catch(() => ({ ok: false })),
  ]);
  if (generation !== homeRenderGeneration) return;
  // Seulement ce que l'accueil affiche (les serveurs les plus actifs), pas tout l'annuaire.
  const busiestForCache = (listResult.ok ? listResult.servers : [])
    .filter((s) => (s.playerCount ?? 0) > 0)
    .sort((a, b) => (b.playerCount ?? 0) - (a.playerCount ?? 0))
    .slice(0, 8);
  const homeData = {
    settings: { lastPlayedSlug: settings.lastPlayedSlug || null, recentPlayedAt: settings.recentPlayedAt || {} },
    favoriteSlugs,
    myServersResult: myServersResult.ok ? { ok: true, servers: myServersResult.servers.slice(0, 4).map(({ ip: _ip, inviteCode: _code, ...rest }) => rest) } : { ok: false, servers: [] },
    continueResolved,
    favoriteServers,
    listResult: { ok: Boolean(listResult.ok), servers: listResult.ok ? busiestForCache : [] },
    featured: featuredResult?.ok && featuredResult.server?.slug ? { server: featuredResult.server } : null,
  };
  // Un echec reseau ne remplace pas un bon cache par un accueil vide.
  if (listResult.ok) saveHomeCache(homeData);
  paintHomeView(homeData);
}

function paintHomeView({ settings, favoriteSlugs, myServersResult, continueResolved, favoriteServers, listResult, featured = null }) {
  const continueServer = continueResolved[0] || null;
  const continuePlayedAt = continueServer ? settings.recentPlayedAt?.[continueServer.slug] || null : null;
  const myServers = myServersResult.ok ? myServersResult.servers.slice(0, 4) : [];

  // Joueur sans historique : au lieu d'une phrase grise, les serveurs les plus actifs du moment.
  // "A la une" (colonne de droite, grand ecran) : place reservee a la future mise en avant
  // payante, remplie pour l'instant par un "Choix de l'equipe" gratuit — slug force dans
  // TEAM_PICK_SLUGS s'il existe, sinon le serveur le plus actif qui n'est pas deja affiche.
  const busiest = (listResult.ok ? listResult.servers : [])
    .filter((s) => (s.playerCount ?? 0) > 0)
    .sort((a, b) => (b.playerCount ?? 0) - (a.playerCount ?? 0));
  const shownSlugs = new Set([continueServer?.slug, ...favoriteServers.map((s) => s.slug)].filter(Boolean));
  const whereServers = continueServer ? [] : busiest.slice(0, 3);
  whereServers.forEach((s) => shownSlugs.add(s.slug));
  const allKnown = listResult.ok ? listResult.servers : [];
  // « Petit serveur du jour » choisi par le site (19/10) s'il n'est pas deja affiche ailleurs sur
  // l'accueil ; sinon (null, appel rate, doublon) l'ancien choix : le plus actif non affiche.
  const dailyPick = featured?.server && !shownSlugs.has(featured.server.slug) ? featured.server : null;
  const teamPick =
    dailyPick ||
    TEAM_PICK_SLUGS.map((slug) => allKnown.find((s) => s.slug === slug)).find(Boolean) ||
    busiest.find((s) => !shownSlugs.has(s.slug)) ||
    null;

  // Accueil en deux colonnes (design A, preview validee par Rushi le 25/10) : a gauche ce qui sert
  // a jouer (dernier serveur et dernier monde cote a cote, puis les favoris), a droite « Mes
  // serveurs » et « A la une ». Toutes les infos restent visibles ; sur une fenetre etroite, la
  // colonne de droite passe sous la gauche au lieu d'etre cachee. play.js ajoute la carte du
  // dernier monde dans #home-halves.
  const hasAside = Boolean(teamPick) || myServers.length > 0;
  homePanelEl.innerHTML = `
    <h2 style="margin-bottom: 18px;">${t("home.greeting", { name: escapeHtml(currentProfile ? currentProfile.name : "") })}</h2>
    <div class="home-layout${hasAside ? " has-aside" : ""}">
    <div class="home-main">
    <div class="home-section">
      <div class="home-section-header"><h3>${t("home.play")}</h3></div>
      <div class="home-halves" id="home-halves">${continueServer ? homeContinueCardHtml(continueServer, continuePlayedAt) : homeResumeEmptyHtml()}</div>
    </div>
    ${
      !continueServer && whereServers.length > 0
        ? `<div class="home-section">
            <div class="home-section-header"><h3>${t("home.whereTitle")}</h3></div>
            <p class="join-note" style="margin: 0 0 12px;">${t("home.whereSub")}</p>
            <div class="server-list" id="home-where-list">${whereServers.map((s) => serverRowHtml(s, favoriteSlugs.includes(s.slug))).join("")}</div>
          </div>`
        : ""
    }
    <div class="home-section">
      <div class="home-section-header">
        <h3>${t("home.yourFavorites")}</h3>
        ${favoriteServers.length > 0 ? `<button type="button" class="home-see-all" data-target="favorites">${t("home.seeAll")}</button>` : ""}
      </div>
      ${
        favoriteServers.length > 0
          ? homeFavoriteChipsHtml(favoriteServers)
          : `<div class="home-empty-card"><p>${t("favorites.empty")}</p><button type="button" class="btn-secondary" id="home-browse-btn">${t("home.browseServers")}</button></div>`
      }
    </div>
    </div>
    ${
      hasAside
        ? `<aside class="home-aside">
            ${
              myServers.length > 0
                ? `<div class="home-section home-side-box" style="margin-bottom: 0;">
                    <div class="home-section-header">
                      <h3>${t("home.myServersTitle")}</h3>
                      <button type="button" class="home-see-all" data-target="instances">${t("home.seeAll")}</button>
                    </div>
                    <div class="server-list">${myServers.map(homeInstanceRowHtml).join("")}</div>
                  </div>`
                : ""
            }
            ${
              teamPick
                ? `<div class="home-section" style="margin-bottom: 0;">
                    <div class="home-section-header"><h3>${t("home.featuredTitle")}</h3></div>
                    <div class="home-pick" id="home-pick" data-slug="${escapeHtml(teamPick.slug)}" role="button" tabindex="0">
                      <div class="home-pick-banner">${teamPick.bannerUrl ? `<img src="${escapeHtml(teamPick.bannerUrl)}" alt="" />` : ""}</div>
                      <div class="home-pick-body">
                        <span class="home-pick-tag">${t(dailyPick ? "home.dailyPick" : "home.teamPick")}</span>
                        <h3>${escapeHtml(teamPick.name)}</h3>
                        <p>${t(dailyPick ? "home.dailyPickDesc" : "home.teamPickDesc")}</p>
                        <button type="button" class="btn-secondary">${t("home.viewPage")}</button>
                      </div>
                    </div>
                  </div>`
                : ""
            }
          </aside>`
        : ""
    }
    </div>
  `;

  const browseBtn = document.getElementById("home-browse-btn");
  if (browseBtn) browseBtn.addEventListener("click", showServersView);
  for (const el of [document.getElementById("home-where-list"), document.getElementById("home-pick")]) {
    if (!el) continue;
    const rows = el.classList.contains("home-pick") ? [el] : [...el.querySelectorAll(".row")];
    rows.forEach((row) => {
      onRowActivate(row, () => {
        detailOrigin = "home";
        openDetail(row.dataset.slug);
      });
    });
  }

  const playBtn = homePanelEl.querySelector(".home-resume-play");
  if (playBtn) {
    // Meme bouton que « Rejoindre » de la fiche : il lance, puis devient « Arrêter » pendant la
    // partie (joinServer s'en charge, avec la confirmation de la pilule).
    playBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!continueServer || playBtn.disabled) return;
      joinServer(continueServer, playBtn);
    });
    syncJoinButtons();
  }
  const continueCard = homePanelEl.querySelector(".home-resume");
  if (continueCard) {
    onRowActivate(continueCard, () => {
      detailOrigin = "home";
      openDetail(continueCard.dataset.slug);
    });
  }
  document.getElementById("home-first-browse")?.addEventListener("click", showServersView);

  // Puces favoris : un clic lance directement le serveur.
  homePanelEl.querySelectorAll(".home-fav-chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      const server = favoriteServers.find((item) => item.slug === chip.dataset.slug);
      if (!server || chip.disabled) return;
      chip.disabled = true;
      try {
        await launchServer(server);
      } finally {
        chip.disabled = false;
      }
    });
  });
  homePanelEl.querySelectorAll(".favorite-btn").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleFavorite(btn.dataset.slug);
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
// Second audit du 14/10 : un de MES serveurs en pause (ou en attente) repond aussi 404, meme a
// son proprietaire. Avant d'effacer un slug, on verifie donc qu'il n'est pas dans « Mes
// instances » (servers:mine) ; si cette liste est illisible (hors ligne, pas connecte), on
// garde le slug plutot que de risquer de l'effacer a tort.
async function resolveServersBySlug(slugs) {
  const result = await fetchServerList();
  const allServers = result.ok ? result.servers : [];
  let mine = null;
  const myServers = () =>
    (mine ||= currentProfile ? window.mchub.listMyServers().catch(() => ({ ok: false })) : Promise.resolve({ ok: false }));
  const placeholder = (slug) => ({ slug, name: slug, description: "", type: "vanilla", playerCount: null, playerCapacity: null, bannerUrl: null });
  const resolved = await Promise.all(
    slugs.map(async (slug) => {
      const found = allServers.find((s) => s.slug === slug);
      if (found) return found;
      const single = await window.mchub.getServer(slug);
      if (single.ok) return single.server;
      if (single.notFound) {
        const owned = await myServers();
        if (!owned?.ok) return placeholder(slug);
        const own = (owned.servers || []).find((s) => s.slug === slug);
        if (own) return { ...placeholder(slug), ...own };
        await pruneDeadSlug(slug);
        return null;
      }
      return placeholder(slug);
    }),
  );
  return resolved.filter((s) => s !== null);
}

async function pruneDeadSlug(slug) {
  const settings = await window.mchub.settings.get();
  const favoriteServers = (settings.favoriteServers || []).filter((s) => s !== slug);
  const recentlyPlayed = (settings.recentlyPlayed || []).filter((s) => s !== slug);
  // Le « dernier joué » du menu rapide suit la même règle (14/10) : avant, il gardait un serveur
  // retiré des Récents, d'où deux listes qui ne disaient pas la même chose.
  const patch = { favoriteServers, recentlyPlayed };
  if (settings.lastPlayedSlug === slug) patch.lastPlayedSlug = null;
  await window.mchub.settings.set(patch);
}

// Slugs de la page Récents (14/10) : la liste enregistrée, ou à défaut le « dernier joué » du
// menu rapide — un joueur dont les Récents avaient été vidés à tort (voir servers:get côté
// main.js) retrouve au moins ce serveur, comme dans le menu rapide.
function recentSlugsFromSettings(settings) {
  const recent = Array.isArray(settings?.recentlyPlayed) ? settings.recentlyPlayed : [];
  if (recent.length) return recent;
  return settings?.lastPlayedSlug ? [settings.lastPlayedSlug] : [];
}

async function showFavoritesView({ tab = "favorites" } = {}) {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
  updateGuestBanner(false);
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  friendsPanelEl.hidden = true;
  favoritesPanelEl.hidden = false;
  navHomeBtn.classList.remove("active");
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navFriendsBtn.classList.remove("active");
  navFavoritesBtn.classList.add("active");
  if (tab === "installed") await renderInstalledList();
  else await renderFavoritesList();
}

// Etat vide des pages Favoris et Recents (preview validee le 2026-10-14) : grand bloc grise
// centre, icone, titre, phrase et bouton vers la liste des serveurs. Textes en dur (i18n),
// aucune donnee utilisateur dedans.
const PAGE_EMPTY_ICONS = {
  favorites: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  recent: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>',
};

// --- Ma bibliotheque (planche L5-C) -----------------------------------------------------------
// Favoris, Recents et Installes reunis dans une seule page a onglets : une seule icone dans la
// barre laterale, qui rouvre le dernier onglet choisi.
// Lot 3 (audit 17/10) : Installes en premier et par defaut, puis le dernier onglet choisi est
// garde dans les reglages (relu au premier affichage).
let libraryTab = "installed";
let libraryTabLoaded = false;
let librarySavedTab = null;

function setLibraryTab(tab) {
  libraryTab = tab;
  if (librarySavedTab !== tab) {
    librarySavedTab = tab;
    window.mchub.settings.set({ libraryTab: tab }).catch(() => {});
  }
}

function libraryHeaderHtml(tab) {
  const tabs = [
    ["installed", t("library.installed")],
    ["favorites", t("nav.favorites")],
    ["recent", t("nav.recent")],
  ];
  return `
    <h2>${escapeHtml(t("nav.library"))}</h2>
    <div class="library-tabs" role="tablist" aria-label="${escapeHtml(t("nav.library"))}">
      ${tabs.map(([key, label]) => `<button type="button" role="tab" data-library-tab="${key}" aria-selected="${key === tab}">${escapeHtml(label)}</button>`).join("")}
      ${bandLegendHtml()}
    </div>`;
}

function wireLibraryTabs(panelEl) {
  panelEl.querySelectorAll("[data-library-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.libraryTab;
      if (tab === "recent") showRecentView();
      else if (tab === "installed") showInstalledView();
      else showFavoritesView();
    });
  });
}

async function showLibraryView() {
  if (!libraryTabLoaded) {
    libraryTabLoaded = true;
    const saved = (await window.mchub.settings.get().catch(() => ({})))?.libraryTab;
    if (["installed", "favorites", "recent"].includes(saved)) libraryTab = librarySavedTab = saved;
  }
  if (libraryTab === "recent") showRecentView();
  else if (libraryTab === "installed") showInstalledView();
  else showFavoritesView();
}

// Onglet « Installés » : les serveurs prets a jouer sur ce PC (instances presentes sur le disque),
// avec le meme ▶ que Favoris et Recents. Affiche dans le panneau des favoris.
async function showInstalledView() {
  await showFavoritesView({ tab: "installed" });
}

async function renderInstalledList() {
  setLibraryTab("installed");
  favoritesPanelEl.className = "server-list";
  favoritesPanelEl.innerHTML = `${libraryHeaderHtml("installed")}${skeletonListHtml(3)}`;
  wireLibraryTabs(favoritesPanelEl);
  let slugs = [];
  try {
    const local = await window.mchub.listLocalInstances();
    slugs = local?.ok ? local.instances.map((instance) => instance.slug).filter(Boolean) : [];
  } catch {
    slugs = [];
  }
  if (libraryTab !== "installed") return;
  if (slugs.length === 0) {
    favoritesPanelEl.className = "detail is-empty";
    favoritesPanelEl.innerHTML = `${libraryHeaderHtml("installed")}${emptyStateHtml({ icon: "box", title: t("myInstances.offlineEmptyTitle"), text: t("myInstances.offlineEmpty"), action: t("myInstances.offlineEmptyAction"), actionId: "library-installed-join" })}`;
    wireLibraryTabs(favoritesPanelEl);
    document.getElementById("library-installed-join")?.addEventListener("click", showServersView);
    return;
  }
  const servers = await resolveServersBySlug(slugs);
  if (libraryTab !== "installed") return;
  favoritesPanelEl.innerHTML = `
    ${libraryHeaderHtml("installed")}
    <p class="join-note library-installed-summary">${escapeHtml(t("library.installedCount", { count: servers.length }))}</p>
    ${pageToolbarHtml("installed")}
    <div class="list-rows server-list"></div>`;
  wireLibraryTabs(favoritesPanelEl);
  const rowsEl = favoritesPanelEl.querySelector(".list-rows");
  const settings = await window.mchub.settings.get().catch(() => ({}));
  const playedAt = settings?.recentPlayedAt || {};
  const sizes = {};
  const draw = async (rows) => {
    if (rows.length === 0) {
      rowsEl.innerHTML = pageNoMatchHtml();
      return;
    }
    const f = pageFilters.installed;
    const sorted =
      f.sort === "size" ? [...rows].sort((a, b) => (sizes[b.slug] || 0) - (sizes[a.slug] || 0))
      : f.sort === "last" ? [...rows].sort((a, b) => (playedAt[b.slug] || 0) - (playedAt[a.slug] || 0))
      : rows;
    await renderRowsInto(rowsEl, sorted, "installed", renderInstalledList);
    // Taille de chaque serveur, a droite de la ligne (vide tant qu'elle n'est pas lue).
    rowsEl.querySelectorAll(".row[data-slug]").forEach((row) => {
      const bytes = sizes[row.dataset.slug];
      // Un serveur vanilla partage les fichiers du jeu : son dossier pese quelques octets, rien a afficher.
      if (!bytes || bytes < 1024 * 1024) return;
      const tag = document.createElement("span");
      tag.className = "row-size";
      tag.textContent = formatTaskBytes(bytes);
      row.insertBefore(tag, row.querySelector(".row-play") || row.lastElementChild);
    });
  };
  let redraw = draw;
  wirePageToolbar(favoritesPanelEl, "installed", servers, (rows) => {
    redraw = () => draw(rows);
    draw(rows);
  });
  // Tailles lues en arriere-plan, puis total en en-tete et lien vers la suppression groupee.
  const read = await window.mchub.instances.sizes(servers.map((server) => server.slug)).catch(() => ({}));
  if (libraryTab !== "installed" || favoritesPanelEl.hidden) return;
  Object.assign(sizes, read || {});
  const total = Object.values(sizes).reduce((sum, bytes) => sum + (bytes || 0), 0);
  const summary = favoritesPanelEl.querySelector(".library-installed-summary");
  if (summary && total >= 1024 * 1024) {
    summary.innerHTML = `${escapeHtml(t("library.installedTotal", { count: servers.length, size: formatTaskBytes(total) }))} · <button type="button" class="link-btn" id="library-free-space">${escapeHtml(t("library.freeSpace"))}</button>`;
    summary.querySelector("#library-free-space").addEventListener("click", async () => {
      await showMyInstancesView();
      bulk.on = true;
      bulk.sel.clear();
      renderMyInstancesGrid();
    });
  }
  redraw();
}

function renderPageEmpty(panelEl, kind, titleKey) {
  panelEl.className = "detail is-empty";
  panelEl.innerHTML = `
    ${kind === "favorites" || kind === "recent" ? libraryHeaderHtml(kind) : `<h2>${t(titleKey)}</h2>`}
    <div class="page-empty">
      <div class="page-empty-icon">${PAGE_EMPTY_ICONS[kind]}</div>
      <h3>${t(`${kind}.emptyTitle`)}</h3>
      <p>${t(`${kind}.emptyText`)}</p>
      <button type="button" class="join-btn page-empty-browse">${t(`${kind}.emptyAction`)}</button>
    </div>
  `;
  panelEl.querySelector(".page-empty-browse").addEventListener("click", showServersView);
  wireLibraryTabs(panelEl);
}

// Favoris et Recents (16/10, option C) : recherche, « En ligne », « Un ami y joue » et un tri
// propre a chaque page, sur la liste deja chargee (aucun appel en plus par clic). La barre est
// dessinee une fois par ouverture ; seules les lignes sont re-dessinees quand on tape.
const PAGE_SORTS = { favorites: ["online", "az", "players"], recent: ["last", "players", "az"], installed: ["last", "az", "size"] };
const pageFilters = {
  favorites: { q: "", online: false, friend: false, sort: "online" },
  recent: { q: "", online: false, friend: false, sort: "last" },
  installed: { q: "", online: false, friend: false, sort: "last" },
};

function pageToolbarHtml(kind) {
  const f = pageFilters[kind];
  const sortLabel = (sort) => t({ online: "serverList.sortOnlineFirst", last: "serverList.sortLastPlayed", az: "serverList.sortAz", players: "serverList.sortPlayers", size: "library.sortSize" }[sort]);
  return `
    <div class="list-toolbar page-toolbar">
      <div class="list-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input type="search" class="page-search" value="${escapeHtml(f.q)}" placeholder="${escapeHtml(t("serverList.searchPlaceholder"))}" aria-label="${escapeHtml(t("serverList.searchPlaceholder"))}" />
      </div>
      ${chipHtml("online", t("serverList.filterOnline"), f.online)}
      <span class="page-friend-slot"></span>
      <label class="list-sort-label">${t("serverList.sortLabel")}
        <select class="list-sort page-sort">${PAGE_SORTS[kind].map((sort) => `<option value="${sort}"${f.sort === sort ? " selected" : ""}>${escapeHtml(sortLabel(sort))}</option>`).join("")}</select>
      </label>
    </div>`;
}

// Branche la barre d'une page sur ses lignes. `servers` : liste resolue ; `render` : dessine
// les lignes filtrees dans le conteneur ; `rerender` : rouvre la page (favori retire...).
function wirePageToolbar(panelEl, kind, servers, render) {
  const f = pageFilters[kind];
  const update = () => {
    const friends = friendsBySlug();
    // Le bouton ami n'apparait que si au moins un ami joue sur un de ces serveurs.
    const slot = panelEl.querySelector(".page-friend-slot");
    const showFriend = signedIn && (f.friend || servers.some((s) => friends.has(s.slug)));
    slot.innerHTML = showFriend ? chipHtml("friend", t("serverList.filterFriend"), f.friend) : "";
    slot.querySelector("[data-fkey]")?.addEventListener("click", () => {
      f.friend = !f.friend;
      update();
    });
    panelEl.querySelector('.page-toolbar [data-fkey="online"]').classList.toggle("active", f.online);
    panelEl.querySelector('.page-toolbar [data-fkey="online"]').setAttribute("aria-pressed", String(f.online));
    const rows = servers.filter((s) => serverMatches(s, { q: f.q, online: f.online, friend: f.friend }, null, friends));
    render(f.sort === "last" ? rows : sortServerRows(rows, f.sort));
  };
  panelEl.querySelector(".page-search").addEventListener("input", (event) => {
    f.q = event.target.value;
    update();
  });
  panelEl.querySelector('.page-toolbar [data-fkey="online"]').addEventListener("click", () => {
    f.online = !f.online;
    update();
  });
  panelEl.querySelector(".page-sort").addEventListener("change", (event) => {
    f.sort = PAGE_SORTS[kind].includes(event.target.value) ? event.target.value : PAGE_SORTS[kind][0];
    update();
  });
  update();
  refreshFriendsForLists(() => {
    if (!panelEl.hidden) update();
  });
}

function pageNoMatchHtml() {
  return `<div class="filters-empty"><h3>${t("serverList.noneTitle")}</h3></div>`;
}

async function renderFavoritesList() {
  setLibraryTab("favorites");
  const favorites = await getFavoriteSlugs();

  if (favorites.length === 0) {
    renderPageEmpty(favoritesPanelEl, "favorites", "nav.favorites");
    return;
  }

  favoritesPanelEl.className = "server-list";
  favoritesPanelEl.innerHTML = `
    ${libraryHeaderHtml("favorites")}
    <p class="join-note">${t("favorites.header")}</p>
    ${skeletonListHtml(favorites.length)}`;

  const favoriteServers = await resolveServersBySlug(favorites);
  // Onglet change pendant le chargement : ne pas ecraser l'onglet affiche entre-temps.
  if (libraryTab !== "favorites") return;
  favoritesPanelEl.innerHTML = `
    ${libraryHeaderHtml("favorites")}
    <p class="join-note">${t("favorites.header")}</p>
    ${pageToolbarHtml("favorites")}
    <div class="list-rows server-list"></div>`;
  const rowsEl = favoritesPanelEl.querySelector(".list-rows");
  wireLibraryTabs(favoritesPanelEl);
  wirePageToolbar(favoritesPanelEl, "favorites", favoriteServers, (rows) => {
    if (rows.length === 0) rowsEl.innerHTML = pageNoMatchHtml();
    else renderRowsInto(rowsEl, rows, "favorites", renderFavoritesList);
  });
}

async function showRecentView() {
  homePanelEl.hidden = true;
  statusEl.hidden = true;
  listEl.hidden = true;
  listToolbarEl.hidden = true;
  listTitleEl.hidden = true;
  updateGuestBanner(false);
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  friendsPanelEl.hidden = true;
  recentPanelEl.hidden = false;
  navHomeBtn.classList.remove("active");
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navFriendsBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navFavoritesBtn.classList.add("active");
  await renderRecentList();
}

async function renderRecentList() {
  setLibraryTab("recent");
  const settings = await window.mchub.settings.get();
  const { entries, patch } = recentEntries(settings, Date.now());
  if (patch) await window.mchub.settings.set(patch);
  const recentSlugs = entries.map((entry) => entry.slug);
  const playedAtBySlug = Object.fromEntries(entries.map((entry) => [entry.slug, entry.playedAt]));

  if (recentSlugs.length === 0) {
    renderPageEmpty(recentPanelEl, "recent", "nav.recent");
    return;
  }

  recentPanelEl.className = "server-list";
  recentPanelEl.innerHTML = `
    ${libraryHeaderHtml("recent")}
    <p class="join-note">${t("recent.header")}</p>
    ${skeletonListHtml(recentSlugs.length)}`;

  const recentServers = await resolveServersBySlug(recentSlugs);
  if (libraryTab !== "recent") return;
  recentPanelEl.innerHTML = `
    ${libraryHeaderHtml("recent")}
    <p class="join-note">${t("recent.header")}</p>
    ${pageToolbarHtml("recent")}
    <div class="list-rows server-list"></div>`;
  const rowsEl = recentPanelEl.querySelector(".list-rows");
  wireLibraryTabs(recentPanelEl);
  // « Derniere partie » : l'ordre de resolveServersBySlug, deja du plus recent au plus ancien.
  wirePageToolbar(recentPanelEl, "recent", recentServers, (rows) => {
    if (rows.length === 0) rowsEl.innerHTML = pageNoMatchHtml();
    else renderRowsInto(rowsEl, rows, "recent", renderRecentList, playedAtBySlug);
  });
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

// Variante B (19/10, choisie par Rushi) : l'etat et les joueurs de chaque serveur en une pastille
// sur la ligne du nom, apres ses badges (deplacee le 19/10 a la demande de Rushi), sans colonne de plus a cote de Tester / Jouer / « … ». Memes couleurs que
// l'annuaire ; maximum 0 = pas de maximum. Sans mesure (jamais joint) : « Statut inconnu ».
function instancePlayersPillHtml(server) {
  if (server.frozenAt) return "";
  const online = server.playerCount !== null && server.playerCount !== undefined;
  if (!online) {
    return server.pinged
      ? `<span class="instance-players off"><span class="status-dot"></span>${escapeHtml(t("serverCard.offline"))}</span>`
      : `<span class="instance-players unknown"><span class="status-dot unknown"></span>${escapeHtml(t("serverCard.unknown"))}</span>`;
  }
  const fill = fillLevel(server);
  const count = server.playerCapacity > 0 ? `${server.playerCount} / ${server.playerCapacity}` : t("serverList.onlineChip", { count: server.playerCount });
  const word = fill === "full" || fill === "busy" ? ` · ${t(fill === "full" ? "serverCard.full" : "serverCard.busy")}` : "";
  return `<span class="instance-players ${fill === "full" || fill === "busy" ? fill : "on"}"><span class="status-dot${fill === "full" || fill === "busy" ? "" : " online"}"></span>${escapeHtml(count + word)}</span>`;
}

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
    return `<span class="status-dot" style="background:var(--frozen)"></span><span style="color:var(--frozen)">${t("myInstances.frozenLine")}</span>`;
  }
  if (!server.frozenAt && server.verificationStatus === "pending") {
    return `<span class="status-dot" style="background:var(--pending)"></span><span style="color:var(--pending)">${t("myInstances.pendingLine")}</span>`;
  }
  if (!server.frozenAt && server.verificationStatus === "rejected") {
    return `<span class="status-dot" style="background:var(--danger)"></span><span style="color:var(--danger)">${t("myInstances.rejectedLine")}</span>`;
  }
  if (status === "paused") return `<span class="status-dot"></span>${t("myInstances.hiddenNote")}`;
  if (status !== "private") return playersLabel(server);
  const label = t("myInstances.inviteCodeLabel", { code: `<code class="sensitive" data-mask="••••••">${escapeHtml(server.inviteCode || "")}</code>` });
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

// Option C des cartes « Mes instances » (validee par Rushi, 2026-10-14) : boutons compacts a
// droite, en icones, avec une infobulle (data-tip, voir .instance-action dans index.html) ;
// aria-label repete le nom pour les lecteurs d'ecran (pas de title : il doublerait l'infobulle).
const INSTANCE_ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" /></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M9 3h6" /><path d="M10 3v6.2L4.6 18.4A2 2 0 0 0 6.3 21.4h11.4a2 2 0 0 0 1.7-3L14 9.2V3" /><path d="M7.5 15h9" /></svg>',
  external: '<svg viewBox="0 0 24 24"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>',
  leave: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3" /><path d="m16 7 3 3" /><path d="m14 9 2 2" /></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>',
};

// `label` : texte affiche a cote de l'icone (seulement quand l'icone seule ne suffit pas).
function instanceActionHtml({ cls, icon, tip, label = "", data, extra = "", disabled = false, attrsExtra = "" }) {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${escapeHtml(v)}"`).join("");
  return `<button type="button" class="instance-action ${extra} ${cls}"${attrs}${disabled ? " disabled" : ""}${attrsExtra} data-tip="${escapeHtml(tip)}" aria-label="${escapeHtml(tip)}">${INSTANCE_ICONS[icon]}${label ? `<span>${label}</span>` : ""}</button>`;
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
          ${instancePlayersPillHtml(server)}
        </div>
        <p class="instance-card-meta">${t(server.type === "modded" ? "serverCard.modded" : "serverCard.vanilla")} · ${escapeHtml(server.minecraftVersion)} · <span class="sensitive" data-mask="${escapeHtml(t("discreet.hiddenAddress"))}">${escapeHtml(server.ip)}</span></p>
        ${status === "public" && server.verificationStatus === "approved" ? "" : `<div class="instance-card-status">${statusLine}</div>`}
      </div>
      <div class="instance-card-actions">
        ${canSelfTest(server) ? instanceActionHtml({ cls: "my-instance-selftest", icon: "flask", tip: t("myInstances.selfTestButton"), label: t("myInstances.selfTestShort"), data: { slug: server.slug } }) : ""}
        ${status !== "paused" ? instancePlayOrStopHtml(server.slug) : ""}
        ${instanceMoreMenuHtml(server, [
          `<button type="button" class="instance-menu-item my-instance-manage" data-id="${escapeHtml(server.id)}">${INSTANCE_ICONS.external}${escapeHtml(t("myInstances.manageTip"))}</button>`,
          `<button type="button" class="instance-menu-item my-instance-channel" data-slug="${escapeHtml(server.slug)}">${INSTANCE_ICONS.gear}${escapeHtml(t("myInstances.channelButton"))}</button>`,
        ])}
      </div>
    </div>`;
}

// Menu « … » des cartes (option C validee par Rushi le 18/10) : Installer y est toujours actif,
// meme pendant une partie (installation en arriere-plan), avec la fiche, les reglages et le dossier.
function instanceMoreMenuHtml(server, extraItems = []) {
  const items = [
    `<button type="button" class="instance-menu-item my-instance-install" data-slug="${escapeHtml(server.slug)}">${INSTANCE_ICONS.download || "⬇"}<span>${escapeHtml(t("myInstances.menuInstall"))}<small>${escapeHtml(t("myInstances.menuInstallHint"))}</small></span></button>`,
    ...extraItems,
    `<button type="button" class="instance-menu-item my-instance-folder" data-slug="${escapeHtml(server.slug)}">${INSTANCE_ICONS.folder || "📁"}${escapeHtml(t("myInstances.menuFolder"))}</button>`,
  ];
  return `<span class="instance-more">
      ${instanceActionHtml({ cls: "my-instance-more", icon: "more", tip: t("myInstances.menuMore"), data: { slug: server.slug }, attrsExtra: ' aria-haspopup="menu" aria-expanded="false"' })}
      <span class="instance-menu" role="menu" hidden>${items.join("")}</span>
    </span>`;
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
        ${instancePlayOrStopHtml(server.slug)}
        ${instanceMoreMenuHtml(server, [
          `<button type="button" class="instance-menu-item my-instance-leave" data-slug="${escapeHtml(server.slug)}"${runningGameSlug === server.slug ? " disabled" : ""}>${INSTANCE_ICONS.leave}${escapeHtml(t("myInstances.leave"))}</button>`,
          `<button type="button" class="instance-menu-item my-instance-channel" data-slug="${escapeHtml(server.slug)}">${INSTANCE_ICONS.gear}${escapeHtml(t("myInstances.channelButton"))}</button>`,
        ])}
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
// Une seule fenetre Reglages a la fois (2026-10-14, bug vu par Rushi : sections repetees 2-3
// fois). Pendant le chargement, l'engrenage derriere la fenetre gardait le focus : Entree ou
// Espace le re-cliquait, et chaque appel ajoutait ses propres sections et ses propres
// ecouteurs (un clic sur Enregistrer sauvegardait alors autant de fois).
let instanceSettingsOpen = false;
// Jeton de generation (audit 14/10, K1) : apres « Annuler » pendant le chargement, la fenetre
// est liberee tout de suite (l'engrenage repond de nouveau) alors que les requetes en cours
// finissent en arriere-plan ; leur fin ne doit pas liberer le verrou d'une fenetre plus recente.
let instanceSettingsGeneration = 0;

async function openInstanceSettingsModal(server, options) {
  if (instanceSettingsOpen) return;
  instanceSettingsOpen = true;
  const generation = ++instanceSettingsGeneration;
  try {
    await showInstanceSettingsModal(server, options);
  } finally {
    if (generation === instanceSettingsGeneration) instanceSettingsOpen = false;
  }
}

// Chargement de la fenetre (variante B validee par Rushi, 2026-10-14) : le losange Omniscient
// qui pulse au centre, un message si le site tarde (apres 3 s), et en cas d'erreur un ecran
// avec Reessayer / Fermer plutot qu'une simple ligne rouge.
const SETTINGS_SLOW_DELAY_MS = 3000;
const ICON_ALERT =
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>';

async function showInstanceSettingsModal(server, { owned = true } = {}) {
  const overlay = document.getElementById("modal-overlay");
  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn = document.getElementById("modal-cancel");
  const checkboxRow = document.getElementById("modal-checkbox-row");
  const bodyEl = document.getElementById("modal-body");

  const fields = INSTANCE_SETTINGS_FIELDS.filter((field) => field.appliesTo(server, { owned }));

  // Zone d'attente/erreur a part : #modal-body est un <p>, qui ne peut pas contenir de blocs.
  document.getElementById("instance-settings-state")?.remove();
  const stateEl = document.createElement("div");
  stateEl.id = "instance-settings-state";
  bodyEl.after(stateEl);

  document.getElementById("modal-title").textContent = t("channelSettings.title", { name: server.name });
  checkboxRow.hidden = true;
  bodyEl.textContent = "";
  bodyEl.hidden = true;
  bodyEl.style.color = "";
  cancelBtn.hidden = false;
  overlay.querySelector(".modal-box").classList.add("pop-in");
  overlay.hidden = false;

  let slowTimer = null;
  const cleanup = () => {
    clearTimeout(slowTimer);
    overlay.hidden = true;
    bodyEl.hidden = false;
    bodyEl.style.color = "";
    confirmBtn.hidden = false;
    confirmBtn.disabled = false;
    stateEl.remove();
    document.getElementById("instance-settings-fields")?.remove();
  };

  const showLoading = () => {
    stateEl.innerHTML = `
      <div class="settings-loader" role="status" aria-live="polite">
        <div class="settings-loader-halo"><span class="settings-loader-mark"></span></div>
        <span class="settings-loader-text">${t("channelSettings.loading")}</span>
      </div>`;
    cancelBtn.textContent = t("common.cancel");
    confirmBtn.hidden = true;
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      stateEl.querySelector(".settings-loader")?.insertAdjacentHTML("beforeend", `<p class="settings-loader-slow">${t("channelSettings.slow")}</p>`);
    }, SETTINGS_SLOW_DELAY_MS);
  };

  const showError = (message) => {
    clearTimeout(slowTimer);
    stateEl.innerHTML = `
      <div class="settings-error" role="alert">
        <span class="settings-error-icon">${ICON_ALERT}</span>
        <p>${escapeHtml(message)}</p>
      </div>`;
    cancelBtn.textContent = t("common.close");
    confirmBtn.hidden = false;
    confirmBtn.disabled = false;
    confirmBtn.textContent = t("channelSettings.retry");
  };

  // Annuler marche aussi pendant le chargement (avant, le bouton ne faisait rien a ce stade) ;
  // apres une erreur, Reessayer relance le chargement dans la meme fenetre.
  const currentValues = {};
  for (;;) {
    showLoading();
    let cancelledWhileLoading = false;
    const onLoadingCancel = () => {
      cancelledWhileLoading = true;
      // L'ecouteur est retire ici : la boucle ci-dessous sort par `return` sans l'atteindre.
      cancelBtn.removeEventListener("click", onLoadingCancel);
      cleanup();
      instanceSettingsOpen = false;
    };
    cancelBtn.addEventListener("click", onLoadingCancel);
    let failure = null;
    for (const field of fields) {
      const result = await field.load(server);
      if (cancelledWhileLoading) return;
      if (!result.ok) {
        failure = result.error || t("channelSettings.loadError");
        break;
      }
      currentValues[field.id] = result.value;
    }
    cancelBtn.removeEventListener("click", onLoadingCancel);
    if (!failure) break;

    showError(failure);
    const retry = await new Promise((resolve) => {
      const onRetry = () => done(true);
      const onClose = () => done(false);
      const done = (value) => {
        confirmBtn.removeEventListener("click", onRetry);
        cancelBtn.removeEventListener("click", onClose);
        resolve(value);
      };
      confirmBtn.addEventListener("click", onRetry);
      cancelBtn.addEventListener("click", onClose);
    });
    if (!retry) {
      cleanup();
      return;
    }
  }

  clearTimeout(slowTimer);
  stateEl.innerHTML = "";
  // La description du canal du modpack ne s'applique qu'a ce reglage precis — vide sinon (le
  // texte d'aide de la case de suivi, juste en dessous d'elle, suffit dans ce cas).
  const hasDescription = fields.some((field) => field.id === "modpackChannel");
  bodyEl.textContent = hasDescription ? t("channelSettings.description") : "";
  bodyEl.hidden = !hasDescription;
  const fieldsContainer = document.createElement("div");
  fieldsContainer.id = "instance-settings-fields";
  fieldsContainer.className = "settings-fade-in";
  document.getElementById("instance-settings-fields")?.remove();
  fieldsContainer.innerHTML = fields.map((field) => field.renderHtml(currentValues[field.id])).join("") + instanceFilesSectionHtml(server);
  stateEl.after(fieldsContainer);
  wireInstanceFilesSection(fieldsContainer, server);

  cancelBtn.textContent = t("common.cancel");
  confirmBtn.hidden = false;
  confirmBtn.textContent = t("channelSettings.save");

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
          bodyEl.hidden = false;
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

// Rejoindre un de SES serveurs par code reste possible (14/10, demande de Rushi : il teste ses
// codes ainsi) et suit la procedure normale. Mais a chaque chargement de Mes instances, un
// serveur qu'il possede deja est retire de « Rejoint » (et de son compteur) : il est deja dans
// « Tout ». Seule l'entree de la liste locale des rejoints (settings.joinedServers, sur ce PC)
// est supprimee, via servers:leaveJoined : ni le serveur ni les donnees d'autres joueurs ne sont
// touches. Le proprietaire n'a pas besoin du code pour lancer son serveur (son jeton suffit).
function withoutOwnedServers(joined, owned) {
  const ownedSlugs = new Set((owned || []).map((server) => server.slug));
  return (joined || []).filter((server) => !ownedSlugs.has(server.slug));
}

function ownedJoinedSlugs(joined, owned) {
  const ownedSlugs = new Set((owned || []).map((server) => server.slug));
  return (joined || []).filter((server) => ownedSlugs.has(server.slug)).map((server) => server.slug);
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
      <div class="instances-header-actions">
        ${all.length ? `<button type="button" class="btn-secondary" id="my-instances-select">${bulk.on ? escapeHtml(t("bulk.cancel")) : `☐ ${escapeHtml(t("bulk.select"))}`}</button>` : ""}
        <button type="button" class="btn-secondary join-code-btn" id="my-instances-join">${INSTANCE_ICONS.key}${t("myInstances.joinByCodeButton")}</button>
      </div>
    </div>
    ${instancesToolbarHtml(myInstancesServers, myJoinedServers.length, topPagerHtml(myInstancesPage, pageCount, "my-instances-pager"))}
    ${bulk.on ? bulkBarHtml(all) : ""}
    ${
      all.length === 0
        ? `<p class="join-note">${t("myInstances.filterEmpty")}</p>`
        : `<div class="instance-grid">${filtered.map((server) => (myInstancesFilter === "joined" ? joinedCardHtml(server) : instanceCardHtml(server))).join("")}</div>`
    }
  `;

  document.getElementById("my-instances-join").addEventListener("click", joinByCodeFlow);
  wireBulkSelection(all);

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

  myInstancesPanelEl.querySelectorAll(".my-instance-stop").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      confirmStopGame();
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

  myInstancesPanelEl.querySelectorAll(".my-instance-more").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = btn.parentElement.querySelector(".instance-menu");
      const opening = menu.hidden;
      closeInstanceMenus();
      menu.hidden = !opening;
      btn.setAttribute("aria-expanded", String(opening));
      if (opening) menu.querySelector("button:not([disabled])")?.focus();
    });
  });
  myInstancesPanelEl.querySelectorAll(".instance-menu-item").forEach((item) => item.addEventListener("click", () => setTimeout(closeInstanceMenus, 0)));
  myInstancesPanelEl.querySelectorAll(".my-instance-install").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeInstanceMenus();
      const server = myInstancesServers.find((s) => s.slug === btn.dataset.slug) || myJoinedServers.find((s) => s.slug === btn.dataset.slug);
      // Installation sans lancer le jeu : possible pendant une partie (file d'attente du lot 4).
      if (server) installServerStandalone(server, null);
    });
  });
  myInstancesPanelEl.querySelectorAll(".my-instance-folder").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeInstanceMenus();
      window.mchub.instances.openFolder(btn.dataset.slug);
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
      const leaveName = (myJoinedServers || []).find((item) => item.slug === btn.dataset.slug)?.name || btn.dataset.slug;
      const { confirmed } = await showModal({
        tone: "ok",
        title: t("myInstances.leaveTitle", { name: leaveName }),
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
  updateGuestBanner(false);
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  friendsPanelEl.hidden = true;
  myInstancesPanelEl.hidden = false;
  navHomeBtn.classList.remove("active");
  navServersBtn.classList.remove("active");
  navSettingsBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navFriendsBtn.classList.remove("active");
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
        ${instanceActionHtml({ cls: "my-instance-play-offline", icon: "play", extra: "is-play", tip: t("myInstances.playOffline"), label: t("myInstances.playOffline"), data: { slug: instance.slug } })}
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
        ? emptyStateHtml({ icon: "box", title: t("myInstances.offlineEmptyTitle"), text: t("myInstances.offlineEmpty"), action: t("myInstances.offlineEmptyAction"), actionId: "instances-empty-join" })
        : `<div class="instance-grid">${instances.map(offlineInstanceCardHtml).join("")}</div>`
    }
  `;

  document.getElementById("instances-empty-join")?.addEventListener("click", showServersView);
  myInstancesPanelEl.querySelectorAll(".my-instance-play-offline").forEach((btn) => {
    // Meme garde synchrone qu'ailleurs (my-instance-play) : desactive avant tout await.
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
  const name = instance.modpackName || instance.slug;
  activity.current = { slug: instance.slug, name };
  activity.failure = null;
  activity.launch = { percent: null, text: "" };
  renderActivity();

  const stopListening = window.mchub.onGameProgress((status) => {
    if (!status || typeof status !== "object") return;
    const next = { ...(activity.launch || {}) };
    if (status.text) next.text = status.text;
    if (typeof status.task === "number" && typeof status.total === "number" && status.total > 0) {
      next.percent = Math.min(100, Math.round((status.task / status.total) * 100));
    }
    activity.launch = next;
    renderActivity();
  });

  const result = await window.mchub.playOfflineServer(instance.slug);
  stopListening();
  launchInProgress = false;
  activity.launch = null;

  if (result.ok) {
    if (!gamePlaying) {
      launchStarting = true;
      setTimeout(() => {
        launchStarting = false;
        renderActivity();
      }, 60_000);
    }
  } else if (!result.cancelled) {
    activity.failure = { slug: instance.slug, name, error: result.error };
    openActivityPanel();
  }
  renderActivity();
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
  const joinedServers = joinedResult.ok ? joinedResult.servers : [];
  myJoinedServers = withoutOwnedServers(joinedServers, myInstancesServers);
  // Retire aussi ces serveurs de la liste sauvegardee des rejoints (settings.joinedServers),
  // sinon ils revenaient des le code suivant (retour de test de Rushi, 14/10).
  await Promise.all(
    ownedJoinedSlugs(joinedServers, myInstancesServers).map((slug) => window.mchub.leaveJoinedServer(slug).catch(() => {})),
  );

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
  updateGuestBanner(false);
  detailEl.hidden = true;
  accountPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  friendsPanelEl.hidden = true;
  settingsPanelEl.hidden = false;
  navHomeBtn.classList.remove("active");
  navServersBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navFriendsBtn.classList.remove("active");
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
  // Une section choisie fait quitter la recherche (serie 2, idee 8).
  if (settingsSearchActive()) clearSettingsSearch();
  const settings = await window.mchub.settings.get();
  // Debogage (grille) et Divers (colonnes facon journal) s'etalent sur la largeur ; les autres
  // onglets gardent leur colonne etroite.
  contentEl.classList.toggle("settings-content-wide", tab === "debug" || tab === "misc");
  if (tab === "language") return renderLanguageTab(contentEl, settings);
  if (tab === "privacy") return renderPrivacyTab(contentEl);
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
    <div class="settings-grid">
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
    </div>

    <section class="settings-section settings-reset">
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
      [t("games.folderTitle"), info.gamesFree ? `${info.gamesFolder} · ${t("games.freeShort", { free: info.gamesFree })}` : info.gamesFolder || "—"],
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

  // Refuse pendant une partie ou une installation (voir diagnostics:repair dans main.js) : memes
  // messages que « Supprimer les fichiers » d'une instance.
  const diagnosticsRefusal = (result) =>
    result?.code === "running" ? t("instanceTools.delRefusedRunning")
      : result?.code === "installing" || result?.code === "launching" ? t("instanceTools.delRefusedInstalling")
        : null;

  document.getElementById("settings-repair").addEventListener("click", async () => {
    const result = await window.mchub.diagnostics.repair();
    document.getElementById("settings-reset-status").textContent = diagnosticsRefusal(result) || t("debug.repaired");
  });

  const formatCacheSize = (bytes) =>
    bytes > 1024 ** 3
      ? `${(bytes / 1024 ** 3).toFixed(2)} ${t("debug.unitGB")}`
      : `${(bytes / (1024 * 1024)).toFixed(0)} ${t("debug.unitMB")}`;

  window.mchub.diagnostics.getCacheSizeBytes().then((bytes) => {
    document.getElementById("settings-cache-size-desc").textContent = t("debug.clearCacheDesc", { size: formatCacheSize(bytes) });
  });
  document.getElementById("settings-clear-cache").addEventListener("click", async () => {
    const { confirmed } = await showModal({ tone: "warn", title: t("debug.clearCacheTitle"), body: t("debug.clearCacheBody"), confirmLabel: t("debug.clearCacheBtn"), cancelLabel: t("common.cancel") });
    if (!confirmed) return;
    const result = await window.mchub.diagnostics.clearCache();
    const refusal = diagnosticsRefusal(result);
    if (refusal) {
      document.getElementById("settings-reset-status").textContent = refusal;
      return;
    }
    document.getElementById("settings-reset-status").textContent = t("debug.cacheCleared");
    document.getElementById("settings-cache-size-desc").textContent = t("debug.clearCacheDesc", { size: formatCacheSize(0) });
  });

  document.getElementById("settings-reset").addEventListener("click", async () => {
    const { confirmed } = await showModal({ tone: "danger", title: t("debug.resetTitle"), body: t("debug.resetBody"), confirmLabel: t("debug.resetBtn"), cancelLabel: t("common.cancel") });
    if (!confirmed) return;
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
            // Meme ordre que ACCENT_PRESETS (theme.js) : bleu, violet, vert, orange, rose (audit 17/10,
            // lot 1 : les deux premiers noms etaient inverses). La pastille active porte une coche.
            const names = [t("appearance.accentBlue"), t("appearance.accentPurple"), t("appearance.accentGreen"), t("appearance.accentOrange"), t("appearance.accentPink")];
            const active = (settings.accentColor || window.themeControls.ACCENT_PRESETS[0]) === color;
            return `<button type="button" class="accent-swatch${active ? " active" : ""}" data-accent-value="${color}" style="background:${color};" aria-label="${names[i] || color}" title="${names[i] || color}" aria-pressed="${active}">${active ? '<span aria-hidden="true">✓</span>' : ""}</button>`;
          }).join("")}
        </div>
      </div>
      <div class="settings-divider"></div>
      <div>
        <div class="settings-row-label">${t("appearance.reduceMotion")}</div>
        <p class="settings-row-desc">${t("appearance.reduceMotionDesc")}</p>
        <div class="motion-options" role="group" aria-label="${escapeHtml(t("appearance.reduceMotion"))}">
          ${["auto", "on", "off"]
            .map((value) => `<button type="button" class="${(settings.reduceMotion || "auto") === value ? "active" : ""}" data-motion-value="${value}" aria-pressed="${(settings.reduceMotion || "auto") === value}">${t(`appearance.reduceMotion_${value}`)}</button>`)
            .join("")}
        </div>
      </div>
      <div class="settings-divider"></div>
      <label class="settings-row" style="cursor: pointer;">
        <span>
          <span class="settings-row-label">${t("discreet.settingTitle")}</span>
          <p class="settings-row-desc">${t("discreet.settingDesc")}</p>
        </span>
        <input type="checkbox" id="settings-discreet" ${discreetMode ? "checked" : ""} />
      </label>
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
  contentEl.querySelectorAll("[data-motion-value]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const updated = await window.mchub.settings.set({ reduceMotion: btn.dataset.motionValue });
      window.themeControls.applyTheme(updated);
      renderAppearanceTab(contentEl, updated);
    });
  });
  document.getElementById("settings-discreet").addEventListener("change", (event) => setDiscreetMode(event.target.checked));
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
  // Colonnes facon journal (preview validee le 16/10) : 1, 2 ou 3 selon la largeur, chaque carte
  // sous la precedente, sans le trou d'une grille quand la carte Java est plus haute.
  contentEl.innerHTML = `
    <div class="settings-masonry">
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
      <div class="games-folder-card">
        <div class="settings-row-label">${t("games.folderTitle")}</div>
        <p class="settings-row-desc">${t("games.folderDesc")}</p>
        <p class="settings-path" id="games-folder-path" style="margin-top: 6px;">${escapeHtml(settings.gameRoot)}</p>
        <p class="settings-row-desc" id="games-folder-size">${t("common.checking")}</p>
        <p class="games-folder-warn" id="games-folder-warn" hidden></p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
          <button id="games-change-drive" class="join-btn" type="button">${t("games.change")}</button>
          <button id="settings-open-folder" class="btn-secondary" type="button">${t("settings.openFolder")}</button>
        </div>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-row">
        <span>
          <span class="settings-row-label">${t("settings.launcherVersion")}</span>
          <p class="settings-row-desc">${t(UPDATE_PHASE_TEXT[lastUpdatePhase] || "settings.updateNotChecked")}</p>
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
    <section class="settings-section">
      <h3 class="settings-section-title">${t("settings.playingSection")}</h3>
      <div class="settings-row">
        <span>
          <label class="settings-row-label" for="settings-minimize-playing">${t("settings.minimizeWhilePlaying")}</label>
          <p class="settings-row-desc">${t(settings.discreetMode ? "settings.minimizeWhilePlayingDiscreet" : "settings.minimizeWhilePlayingDesc")}</p>
        </span>
        <input type="checkbox" id="settings-minimize-playing" ${settings.minimizeWhilePlaying !== false ? "checked" : ""} />
      </div>
    </section>
    <section class="settings-section">
      <h3 class="settings-section-title">${t("settings.discordSection")}</h3>
      <div class="settings-row">
        <span>
          <label class="settings-row-label" for="settings-discord-presence">${t("settings.discordPresence")}</label>
          <p class="settings-row-desc">${t("settings.discordPresenceDesc")}</p>
        </span>
        <input type="checkbox" id="settings-discord-presence" ${settings.discordPresence !== false ? "checked" : ""} />
      </div>
    </section>
    ${VIDEO_EMBED_ENABLED ? `
    <section class="settings-section">
      <h3 class="settings-section-title">${t("settings.videoSection")}</h3>
      <div class="settings-row">
        <span>
          <label class="settings-row-label" for="settings-block-video-autoplay">${t("settings.blockVideoAutoplay")}</label>
          <p class="settings-row-desc">${t("settings.blockVideoAutoplayDesc")}</p>
        </span>
        <input type="checkbox" id="settings-block-video-autoplay" ${settings.blockVideoAutoplay ? "checked" : ""} />
      </div>
    </section>` : ""}
    <section class="settings-section">
      <h3 class="settings-section-title">${t("settings.aboutSection")}</h3>
      <button type="button" class="settings-link-row" data-legal-page="terms">
        <span><span class="settings-row-label">${t("settings.terms")}</span><p class="settings-link-url">omniscientlauncher.com/cgu</p></span>
        <span class="settings-link-ext" aria-hidden="true">↗</span>
      </button>
      <div class="settings-divider"></div>
      <button type="button" class="settings-link-row" data-legal-page="privacy">
        <span><span class="settings-row-label">${t("settings.privacy")}</span><p class="settings-link-url">omniscientlauncher.com/confidentialite</p></span>
        <span class="settings-link-ext" aria-hidden="true">↗</span>
      </button>
      <p class="join-note">${t("settings.aboutNote")}</p>
    </section>
    </div>
  `;

  document.getElementById("settings-open-folder").addEventListener("click", () => {
    window.mchub.games.openFolder();
  });
  document.getElementById("games-change-drive").addEventListener("click", () => openGamesMove());
  fillGamesFolderCard();
  document.getElementById("settings-beta-channel").addEventListener("change", async (event) => {
    await window.mchub.settings.set({ betaChannel: event.target.checked });
    renderMiscTab(contentEl, { ...settings, betaChannel: event.target.checked }, { betaPending: true });
  });
  document.getElementById("settings-beta-restart-btn")?.addEventListener("click", () => window.mchub.restartApp());
  // Enregistre avec les autres reglages ; main.js coupe ou rallume la presence Discord tout de suite.
  document.getElementById("settings-minimize-playing").addEventListener("change", async (event) => {
    settings.minimizeWhilePlaying = event.target.checked;
    await window.mchub.settings.set({ minimizeWhilePlaying: event.target.checked });
  });
  document.getElementById("settings-discord-presence").addEventListener("change", async (event) => {
    settings.discordPresence = event.target.checked;
    await window.mchub.settings.set({ discordPresence: event.target.checked });
  });
  document.getElementById("settings-block-video-autoplay")?.addEventListener("change", async (event) => {
    settings.blockVideoAutoplay = event.target.checked;
    await window.mchub.settings.set({ blockVideoAutoplay: event.target.checked });
  });
  contentEl.querySelectorAll("[data-legal-page]").forEach((button) => {
    button.addEventListener("click", () => window.mchub.openLegalPage(button.dataset.legalPage));
  });
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
  updateGuestBanner(false);
  detailEl.hidden = true;
  settingsPanelEl.hidden = true;
  favoritesPanelEl.hidden = true;
  recentPanelEl.hidden = true;
  myInstancesPanelEl.hidden = true;
  friendsPanelEl.hidden = true;
  accountPanelEl.hidden = false;
  navServersBtn.classList.remove("active");
  navFavoritesBtn.classList.remove("active");
  navRecentBtn.classList.remove("active");
  navMyInstancesBtn.classList.remove("active");
  navFriendsBtn.classList.remove("active");
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

    <h2 style="margin-top: 32px;">${t("account.myDataTitle")}</h2>
    <p class="join-note" style="margin: 4px 0 10px;">${t("account.myDataHint")}</p>
    <button id="account-my-data-btn" class="btn-secondary" type="button">${t("account.myDataBtn")}</button>
  `;

  // « Récupérer mes données » (23/10) : ouvre Paramètres du site, où se trouve le bouton.
  document.getElementById("account-my-data-btn").addEventListener("click", () => window.mchub.openLegalPage("myData"));
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
      const name = accounts.find((a) => a.id === id)?.name || "";
      const { confirmed } = await showModal({
        tone: "warn",
        title: t("account.forgetTitle", { name }),
        body: t("account.forgetBody"),
        confirmLabel: t("account.forgetConfirmBtn"),
        cancelLabel: t("common.cancel"),
      });
      if (!confirmed) return;
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

function wireSidebar() {
  navHomeBtn.addEventListener("click", showHomeView);
  navServersBtn.addEventListener("click", showServersView);
  navFavoritesBtn.addEventListener("click", showLibraryView);
  navRecentBtn.addEventListener("click", showRecentView);
  navMyInstancesBtn.addEventListener("click", showMyInstancesView);
  navSettingsBtn.addEventListener("click", showSettingsView);
}

// Modale générique (confirmation / avertissement) — utilisée par
// l'avertissement de sécurité RAM, réutilisable pour n'importe quel prompt
// bloquant futur. Résout avec { confirmed, checked } plutôt que de bloquer
// le thread comme un confirm() natif, pour rester cohérent avec le reste de
// l'UI (pas de fenêtre système grise dans une appli aussi personnalisée).
// Fenetre de confirmation unique (audit 17/10, lot 4, preview validee par Rushi) :
// - tone "ok" | "warn" | "danger" : filet du haut, icone et bouton de la meme couleur ;
// - Echap ou clic sur le fond = Annuler, focus sur Annuler a l'ouverture, Tab reste dans la
//   fenetre, le focus revient au bouton qui l'a ouverte ;
// - requireText : le bouton reste grise tant que ce texte exact n'est pas tape.
// stripeColor reste pour les messages diffuses (couleur du type de message).
const MODAL_TONE_ICONS = { ok: "i", warn: "!", danger: "!" };
function showModal({ title, body, confirmLabel, cancelLabel, checkboxLabel, tone, stripeColor, requireText, requireLabel }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modal-overlay");
    const modalBox = overlay.querySelector(".modal-box");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const checkboxRow = document.getElementById("modal-checkbox-row");
    const checkbox = document.getElementById("modal-checkbox");
    const icon = document.getElementById("modal-icon");
    const typedRow = document.getElementById("modal-typed-row");
    const typedInput = document.getElementById("modal-typed-input");
    const opener = document.activeElement;

    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-title").style.color = stripeColor || "";
    document.getElementById("modal-body").textContent = body;
    document.getElementById("modal-body").hidden = !body;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className = `join-btn${tone === "warn" || tone === "danger" ? ` tone-${tone}` : ""}`;
    cancelBtn.hidden = !cancelLabel;
    cancelBtn.textContent = cancelLabel || "";
    checkboxRow.hidden = !checkboxLabel;
    document.getElementById("modal-checkbox-label").textContent = checkboxLabel || "";
    checkbox.checked = false;
    icon.hidden = !tone;
    icon.textContent = MODAL_TONE_ICONS[tone] || "";
    modalBox.classList.remove("tone-ok", "tone-warn", "tone-danger");
    if (tone) modalBox.classList.add(`tone-${tone}`);
    modalBox.style.borderTopColor = stripeColor || "";
    typedRow.hidden = !requireText;
    typedInput.value = "";
    document.getElementById("modal-typed-label").textContent = requireLabel || "";
    const syncTyped = () => {
      confirmBtn.disabled = !!requireText && typedInput.value.trim() !== requireText;
    };
    syncTyped();

    modalBox.classList.add("pop-in");
    overlay.hidden = false;
    // Filet de securite : coupe les clics sur le reste de l'appli tant que cette modale est
    // ouverte, independamment du z-index (voir le commentaire CSS sur body.modal-blocking).
    document.body.classList.add("modal-blocking");
    (requireText ? typedInput : cancelLabel ? cancelBtn : confirmBtn).focus();

    const finish = (confirmed) => {
      const checked = checkbox.checked;
      overlay.hidden = true;
      document.body.classList.remove("modal-blocking");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("mousedown", onBackdrop);
      document.removeEventListener("keydown", onKey, true);
      typedInput.removeEventListener("input", syncTyped);
      confirmBtn.disabled = false;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
      resolve({ confirmed, checked });
    };
    const onConfirm = () => {
      if (!confirmBtn.disabled) finish(true);
    };
    // Sans bouton Annuler (simple message), Echap et le fond ferment comme le bouton.
    const onCancel = () => finish(!cancelLabel);
    const onBackdrop = (event) => {
      if (event.target === overlay) onCancel();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      } else if (event.key === "Tab") {
        const items = [...modalBox.querySelectorAll("button, input")].filter((el) => !el.hidden && !el.disabled && el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      } else if (event.key === "Enter" && event.target === typedInput && !confirmBtn.disabled) {
        event.preventDefault();
        finish(true);
      }
    };
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("mousedown", onBackdrop);
    document.addEventListener("keydown", onKey, true);
    typedInput.addEventListener("input", syncTyped);
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
    status === "warn"
      ? `<span class="selftest-warn-icon" aria-hidden="true">!</span>`
      : status === "pass"
      ? `<span style="color:var(--success);">✅</span>`
      : status === "fail"
        ? `<span style="color:var(--danger);">❌</span>`
        : status === "running"
          ? `<span class="status-dot" style="background:var(--warn);"></span>`
          : status === "skipped"
            ? `<span style="color:var(--muted);">—</span>`
            : `<span class="status-dot"></span>`;
  const statusText =
    status === "warn"
      ? t("selfTest.statusWarn")
      : status === "pass"
      ? t("selfTest.statusPass")
      : status === "fail"
        ? t("selfTest.statusFail")
        : status === "running"
          ? t("selfTest.statusRunning")
          : status === "skipped"
            ? t("selfTest.statusSkipped")
            : "";
  const color = status === "pass" ? "var(--success)" : status === "warn" ? "var(--state-busy)" : status === "fail" ? "var(--danger)" : "var(--muted)";
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
    </div>${selfTestDetailHtml(step, status, detail)}`;
}

// Explication sous un controle (14/10) : avant, un echec n'affichait que « échoué », sans dire
// pourquoi. Mods bloques par CurseForge : leur liste et le conseil au proprietaire.
function selfTestDetailHtml(step, status, detail) {
  let text = "";
  if (step.key === "modpack" && (status === "warn" || status === "pass") && detail) {
    const rescued = Array.isArray(detail.fromModrinthMods) ? detail.fromModrinthMods.length : 0;
    const manual = Array.isArray(detail.manualMods) ? detail.manualMods.length : 0;
    if (rescued + manual > 0) {
      text = [t("selfTest.blockedCount", { count: rescued + manual }), t("selfTest.rescuedCount", { count: rescued }), manual ? t("selfTest.manualCount", { count: manual }) : ""].filter(Boolean).join(" · ");
    }
  } else if (step.key === "modpack" && status === "fail" && detail) {
    const mods = Array.isArray(detail.manualMods) ? detail.manualMods : [];
    const blocked = mods.filter((mod) => mod.reason !== "removed");
    if (blocked.length) {
      const names = blocked.map((mod) => mod.modName || mod.fileName || t("manualMods.fileFallback", { id: mod.fileId }));
      text = t("selfTest.manualModsDetail", { count: blocked.length, names: names.slice(0, 8).join(", ") + (names.length > 8 ? "…" : "") });
    } else if (mods.length) {
      text = t("selfTest.removedModsDetail");
    } else if (typeof detail.error === "string") {
      text = detail.error.slice(0, 300);
    }
  } else if (step.key === "gameStarted" && status === "skipped" && detail?.incompletePack) {
    text = t("selfTest.incompletePack");
  } else if (step.key === "gameStarted" && status === "skipped" && detail?.manualModsSkipped) {
    text = t("selfTest.manualSkipped");
  }
  if (!text) return "";
  return `<div style="margin:-4px 0 0 30px;font-size:12.5px;color:var(--muted);line-height:1.45;">${escapeHtml(text)}</div>`;
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
    if (statuses[step.key] !== "pass" && statuses[step.key] !== "fail" && statuses[step.key] !== "warn") {
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
    outcomeEl.className = "join-note";
    errorEl.hidden = true;
    actionsEl.innerHTML = "";
    document.getElementById("selftest-report").innerHTML = "";

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
      stopManual();
      overlay.hidden = true;
      document.body.classList.remove("modal-blocking");
      resolve();
    };

    // Lot 5 (« aide puis lancement ») : mods a ajouter a la main pendant le test.
    const stopManual = window.mchub.onSelfTestManualMods(async (fields) => {
      overlay.hidden = true;
      const choice = await showManualModsModal(fields.manualMods || [], fields.fromModrinth || 0, fields.fromModrinthMods || [], { slug: server.slug });
      overlay.hidden = false;
      document.body.classList.add("modal-blocking");
      window.mchub.answerSelfTestManualMods(choice);
    });
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

      const manualList = Array.isArray(result.manualMods) ? result.manualMods : [];
      const rescuedList = Array.isArray(result.fromModrinthMods) ? result.fromModrinthMods : [];
      document.getElementById("selftest-report").innerHTML = selfTestReportHtml(manualList, rescuedList);
      if (result.allPassed || result.canPublish) {
        outcomeEl.className = `selftest-verdict ${manualList.length ? "allow" : "go"}`;
        outcomeEl.textContent = manualList.length
          ? t("selfTest.verdictAllow", { count: manualList.length })
          : rescuedList.length
            ? t("selfTest.verdictGo", { count: rescuedList.length })
            : `${t("selfTest.allPassedTitle")} ${t("selfTest.allPassedBody")}`;
        if (manualList.length) {
          const copyBtn = closeBtn(t("selfTest.copyList"), async () => {
            const lines = manualList.map((mod) => `${mod.modName || mod.fileName || ""}${mod.pageUrl ? ` — ${mod.pageUrl}` : ""}`);
            try {
              await navigator.clipboard.writeText(lines.join("\n"));
              toolsToast(t("selfTest.copied"));
            } catch {
              /* presse-papiers indisponible */
            }
          });
          copyBtn.className = "btn-secondary";
          actionsEl.appendChild(copyBtn);
          const retestBtn = closeBtn(t("selfTest.retest"), () => {
            finish();
            runSelfTestFlow(server);
          });
          retestBtn.className = "btn-secondary";
          actionsEl.appendChild(retestBtn);
        }
        const submitBtn = closeBtn(t("selfTest.submit"), async () => {
          submitBtn.disabled = true;
          submitBtn.textContent = t("selfTest.submitting");
          const report = await window.mchub.reportSelfTest({
            slug: server.slug,
            checks: result.checks,
            detectedVersion: result.detectedVersion,
            manualMods: manualList,
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
        if (!manualList.length) actionsEl.appendChild(closeBtn(t("selfTest.close"), finish));
      } else {
        outcomeEl.className = "join-note";
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

  startBackToGuestCountdown(countdownEl, 5);
  return false;
}

// Compte a rebours de l'ecran de connexion vers le mode visiteur (echec de connexion, compte
// Omniscient supprime) : le joueur n'y reste jamais bloque.
function startBackToGuestCountdown(countdownEl, seconds) {
  // Retour automatique en mode visiteur apres un echec (2026-10-11) : rester
  // bloque sur l'ancien ecran de connexion casserait le principe de
  // navigation libre — le joueur peut toujours relancer la connexion plus
  // tard, au clic sur "Jouer" ou sur "Se connecter" en Parametres.
  let remaining = seconds;
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
}

// Barre laterale quand personne n'est connecte : un bouton-icone "Se connecter"
// (2026-10-15, avant il n'y avait que le clic sur "Jouer" pour se connecter,
// voir launchServer()/attemptSignIn()), au-dessus de "Parametres". Celui-ci prend la place de l'avatar
// absent (2026-10-11, retour utilisateur : le laisser dans sa position
// habituelle laissait un trou vide a la toute fin de la sidebar) plutot que
// de laisser cet espace reserve a l'avatar completement vide.
function renderGuestHeader() {
  navSettingsBtn.hidden = true;
  // Plus de compte : les listes d'amis du compte precedent ne doivent plus etre affichees.
  resetFriendsState();
  // Amis = necessite un compte Microsoft (comme Parametres ci-dessus) : rien a afficher pour
  // un visiteur sans session.
  navFriendsBtn.hidden = true;
  if (!friendsPanelEl.hidden) showHomeView();
  msAccountEl.innerHTML = `
    <button id="ms-account-signin" class="sidebar-btn signin-btn" data-i18n-title="nav.signIn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    </button>
    <button id="ms-account-settings" class="sidebar-btn" data-i18n-title="nav.settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  `;
  document.getElementById("ms-account-signin").addEventListener("click", () => attemptSignIn(true));
  document.getElementById("ms-account-settings").addEventListener("click", showSettingsView);
  window.i18n.applyStaticI18n(msAccountEl);
}

// Dernier etat connu de la verification de mise a jour (au demarrage), affiche dans Parametres
// a cote de la version. Avant le 14/10, « À jour. » s'affichait toujours, meme apres un echec ou
// sans verification (audit, T9). null = pas de verification (lancement en dev, hors app packagee).
let lastUpdatePhase = null;
const UPDATE_PHASE_TEXT = { "up-to-date": "settings.upToDate", error: "settings.updateCheckFailed" };

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

  // Ecran de demarrage : ne couvre que les verifications reelles qui
  // precedent la premiere UI interactive (mise a jour, Java, reprise de
  // session). Si Java manque, ensureJavaAvailable() masque cet ecran
  // lui-meme pour laisser place a son propre ecran de blocage.
  bootstrapVersionEl.textContent = settings.appVersion ? `v${settings.appVersion}` : "";

  // Verification de mise a jour (voir main.js/electron-updater) — hors app
  // packagee (dev via `electron .`), main.js resout tout de suite sans rien
  // verifier reellement, mais cette etape reste visible un court instant
  // pour ne pas donner une impression buguee (texte qui clignote).
  // Demarrage plus rapide (18/10, point 2 valide par Rushi) : maintenance et reconnexion
  // Microsoft partent tout de suite, en meme temps que la verification de mise a jour, au lieu
  // d'attendre chacune la precedente. Leurs resultats sont lus plus bas, au meme endroit qu'avant.
  const maintenanceCheck = window.mchub.checkMaintenance().catch(() => ({ active: false }));
  const sessionRestore = window.mchub.tryRestoreSession().catch(() => ({ ok: false }));

  bootstrapStatusEl.textContent = t("bootstrap.checkingUpdates");
  // Ecran de demarrage honnete (design 17/10, point 4) : la vraie etape et une barre qui tourne ;
  // un vrai pourcentage seulement pendant le telechargement d'une mise a jour.
  bootstrapProgressEl.parentElement.classList.add("indeterminate");
  let updateReadyToInstall = false;
  const stopUpdateStatus = window.mchub.updates.onStatus((status) => {
    lastUpdatePhase = status.phase;
    if (status.phase === "downloading") {
      bootstrapStatusEl.textContent = status.percent
        ? t("bootstrap.downloadingUpdateProgress", { percent: status.percent })
        : t("bootstrap.downloadingUpdate", { version: status.version });
      if (status.percent) {
        bootstrapProgressEl.parentElement.classList.remove("indeterminate");
        bootstrapProgressEl.style.width = `${Math.round(status.percent)}%`;
      }
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
  bootstrapProgressEl.parentElement.classList.add("indeterminate");
  // Laboratoire : droits de ce compte lus pendant le chargement, pour que le menu apparaisse
  // complet du premier coup (Jouer, Amis…), sans icône qui surgit après.
  const labState = await window.mchub.featuresReady?.().catch(() => null);
  if (labState) {
    applyLabFeatures(labState);
    window.dispatchEvent(new CustomEvent("omniscient:features", { detail: labState }));
  }

  // Sortie de la petite fenetre de demarrage vers la taille normale de
  // l'appli — sans effet si ensureJavaAvailable() l'a deja fait juste avant
  // (setSize/setResizable/setMinimumSize sont idempotents cote main.js).
  await window.mchub.windowControls.expandFromBootstrap();

  document.body.classList.remove("bootstrapping");

  if (!settings.onboarded) {
    await applyDefaultRamSilently(settings);
  }

  bootstrapEl.hidden = true;
  await ensureNotInMaintenance(maintenanceCheck);

  // Connexion differee (2026-10-11, audit onboarding) : une reprise de
  // session silencieuse est tentee, mais on ne bloque plus sur l'ecran de
  // connexion si elle echoue — l'annuaire reste parcourable sans compte.
  // Voir attemptSignIn() pour le moment ou la connexion est reellement
  // demandee (clic sur "Jouer").
  // Point 1 (18/10) : si la reconnexion n'est pas encore finie, l'accueil s'affiche deja avec le
  // dernier pseudo et les dernieres donnees connues, puis se rafraichit tout seul des qu'elle
  // aboutit. Les clics sur l'accueil attendent ce moment (classe boot-preview, voir index.html).
  const lastProfile = readBootProfile();
  let restored = lastProfile ? await Promise.race([sessionRestore, new Promise((resolve) => setTimeout(() => resolve(null), 120))]) : null;
  if (!restored && lastProfile) {
    homeBootPreview = true;
    document.body.classList.add("boot-preview");
    gateEl.hidden = true;
    appEl.hidden = false;
    renderAccountHeader(lastProfile);
    showHomeView();
  }
  if (!restored) restored = await sessionRestore;
  homeBootPreview = false;
  document.body.classList.remove("boot-preview");
  if (restored.ok) {
    enterApp(restored.profile);
    startServerLinks();
    return;
  }
  if (lastProfile) {
    // Reconnexion ratee : on oublie l'apercu, retour au mode visiteur comme avant.
    currentProfile = null;
    clearBootProfile();
  }

  gateEl.hidden = true;
  appEl.hidden = false;
  renderGuestHeader();
  // L'annuaire plutot que l'accueil : l'accueil (carte "Continuer", favoris)
  // n'a rien a montrer a un visiteur sans historique de connexion.
  showServersView();
  startServerLinks();
}

boot();

// Modèle "polling" retenu pour le MVP (cahier des charges, section 3) :
// pas de WebSocket, juste un rafraîchissement régulier en arrière-plan.
// Ne touche à rien si le joueur est sur une page de détail, et reste
// silencieux en cas d'échec (on ne veut pas interrompre l'utilisateur
// pour un ping raté en tâche de fond).
// 21/10 (cache des fiches) : delais lus dans refreshSettings.js (un seul fichier de reglages).
// La liste ne se rafraichit seule qu'au plus toutes les 3 min, hors partie, et seulement si la
// fenetre du launcher est visible (pas reduite ni cachee).
const REFRESH_INTERVAL_MS = window.OMNI_REFRESH.PRESENCE_IDLE_MS;
let lastSilentListRefreshAt = Date.now();

async function silentRefreshList() {
  if (!signedIn || listEl.hidden || gamePlaying || document.hidden) return;
  lastSilentListRefreshAt = Date.now();
  const generation = listViewGeneration;
  const result = await fetchServerList({ force: true, background: true });
  if (result.ok && generation === listViewGeneration && !listEl.hidden) renderList(result.servers);
}

// Pendant une partie, on interroge moins souvent (le launcher reste ouvert pour
// la console de debug). Le delai est relu a chaque tour.
const REFRESH_PLAYING_INTERVAL_MS = 300_000;
// `var` (pas `let`) : lu aussi par des fonctions definies plus haut (refreshFriendsForLists,
// pulseIsFresh), qui peuvent tourner avant cette ligne.
var gamePlaying = false;
let launchStarting = false;
window.mchub.onGameState((running, exitCode) => {
  if (running && !gamePlaying) {
    activity.playingSince = Date.now();
    activity.stopRequested = false;
  }
  // Jeu ferme avec une erreur dans les 2 premieres minutes, sans que le joueur l'ait arrete :
  // c'est un plantage au demarrage, affiche comme un echec clair (point 4, L3-E).
  if (!running && gamePlaying && exitCode && !activity.stopRequested && Date.now() - activity.playingSince < 120_000) {
    const slug = runningGameSlug && runningGameSlug !== "unknown" ? runningGameSlug : activity.current?.slug;
    activity.failure = { slug, name: activityServerName(slug), error: t("activity.errCrashTitle", { code: exitCode }), crashCode: exitCode, action: "launch" };
    setTimeout(openActivityPanel, 0);
  }
  const changed = gamePlaying !== running;
  gamePlaying = running;
  // 21/10 : presence envoyee tout de suite au lancement et a la fermeture du jeu (puis toutes les
  // 5 min en jeu) ; a la fermeture, une actualisation de la liste et des amis.
  if (changed) {
    schedulePresence(0);
    if (!running) {
      friendsForListsAt = 0;
      silentRefreshList();
    }
  }
  // Que le jeu demarre ou s'arrete, "en cours de demarrage" n'est plus vrai.
  launchStarting = false;
  if (!running) activity.confirmStop = false;
  renderActivity();
});

function scheduleRefresh(task, baseMs = REFRESH_INTERVAL_MS) {
  const tick = async () => {
    // Toujours reprogramme (audit 25/10) : avant, une seule erreur dans `task` arretait ce
    // cycle pour toute la session (plus de liste, de notifications ni de maintenance).
    try {
      await task();
    } catch (error) {
      console.error("Rafraîchissement périodique échoué :", error);
    } finally {
      setTimeout(tick, gamePlaying ? REFRESH_PLAYING_INTERVAL_MS : baseMs);
    }
  };
  setTimeout(tick, baseMs);
}

scheduleRefresh(silentRefreshList, window.OMNI_REFRESH.LIST_REFRESH_MS);
// Fenetre de nouveau visible apres plus de 3 min sans rafraichissement : une actualisation.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastSilentListRefreshAt >= window.OMNI_REFRESH.LIST_REFRESH_MS) silentRefreshList();
});
// Notifications : toutes les 5 minutes (chaque appel interroge la base du site).
scheduleRefresh(scheduledRefreshNotifications, 300_000);
scheduleRefresh(checkMaintenanceLoop, 120_000);
// Presence (systeme d'amis) : son propre cycle de 2 min (audit 25/10, charge du site : avant 60 s,
// comme silentRefreshList). Le site compte un ami « en ligne » pendant 5 min apres son dernier
// heartbeat (ONLINE_WINDOW_MS cote site), donc un heartbeat rate ne le fait pas encore passer
// « hors ligne ». Delibérément PAS via scheduleRefresh() : ce helper ralentit a
// REFRESH_PLAYING_INTERVAL_MS (5 min) pendant une partie, ce qui est le bon choix pour la liste
// de serveurs (pas besoin de la rafraichir pendant que le joueur est en jeu) mais serait exactement
// le mauvais choix ici — un ami en train de JOUER est le cas ou on veut le plus montrer "en
// ligne", pas le laisser passer "hors ligne" apres 2 min (ONLINE_WINDOW_MS cote site) faute de
// heartbeat. setInterval direct, jamais ralenti, jamais arrete.
// 21/10 (cache des fiches, valide par Rushi) : en jeu, la presence ne part plus que toutes les
// 5 min (PRESENCE_PLAYING_MS), plus un envoi immediat au lancement et a la fermeture du jeu (voir
// onGameState). Le site garde « en ligne » 7 min : pas de clignotement pour un ami en partie.
var presenceTimer = null;
function schedulePresence(delayMs) {
  clearTimeout(presenceTimer);
  presenceTimer = setTimeout(async () => {
    try {
      await sendPresenceHeartbeat();
    } finally {
      schedulePresence(gamePlaying ? window.OMNI_REFRESH.PRESENCE_PLAYING_MS : window.OMNI_REFRESH.PRESENCE_IDLE_MS);
    }
  }, delayMs);
}
schedulePresence(REFRESH_INTERVAL_MS);

// --- Fichiers de l'instance + « Arrêter le jeu » (16/10, option B validee par Rushi) ----------
// Les actions sur les fichiers vivent dans la fenetre Reglages (engrenage, tout a droite de la
// carte) : Dossier, Logs, Copier les logs, Reparer, Supprimer. Pendant une partie, « Rejoindre » devient « Arrêter le
// jeu » (rouge, avec confirmation), Reparer et Supprimer sont grises. Supprimer ≠ Quitter : le
// serveur reste dans la liste. Tout passe par main.js (game:stop, instances:*).
// `var` (pas `let`) : lu par les cartes (instancePlayOrStopHtml), qui peuvent etre rendues avant
// que cette ligne ne s'execute — undefined au lieu d'une erreur « before initialization ».
var runningGameSlug = null;

function instancePlayOrStopHtml(slug) {
  if (runningGameSlug && runningGameSlug === slug) {
    return instanceActionHtml({ cls: "my-instance-stop", icon: "stop", extra: "is-stop", tip: t("instanceTools.stop"), label: t("instanceTools.stop"), data: { slug } });
  }
  const otherRunning = !!runningGameSlug;
  return instanceActionHtml({
    cls: "my-instance-play",
    icon: "play",
    extra: "is-play",
    tip: otherRunning ? t("instanceTools.otherRunning") : t("myInstances.joinShort"),
    data: { slug },
    disabled: otherRunning,
  });
}

function formatSize(bytes) {
  const en = window.i18n.getLocale() === "en";
  const units = en ? ["B", "KB", "MB", "GB"] : ["o", "ko", "Mo", "Go"];
  let value = Math.max(0, bytes || 0);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit >= 2 && value < 10 ? 1 : 0;
  return `${value.toLocaleString(en ? "en-US" : "fr-FR", { maximumFractionDigits: digits })} ${units[unit]}`;
}

let toolsToastTimer = null;
function toolsToast(message) {
  clearTimeout(toolsToastTimer);
  document.querySelector(".tools-toast")?.remove();
  const el = document.createElement("div");
  el.className = "tools-toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.appendChild(el);
  toolsToastTimer = setTimeout(() => el.remove(), 3200);
}

// Petite fenetre a part (#instance-tools-overlay) : showModal() n'affiche que du texte, ici il
// faut une zone de logs, une case a cocher qui met a jour la taille, une barre d'attente.
let currentToolsModal = null;
function openToolsModal({ title, bodyHtml, actions, wide = false, tone = "" }) {
  currentToolsModal?.close("cancel");
  const overlay = document.getElementById("instance-tools-overlay");
  const box = overlay.querySelector(".modal-box");
  const bodyEl = document.getElementById("instance-tools-body");
  const actionsEl = document.getElementById("instance-tools-actions");
  document.getElementById("instance-tools-title").textContent = title;
  bodyEl.innerHTML = bodyHtml;
  box.classList.toggle("wide", wide);
  box.classList.toggle("danger", tone === "danger");

  let closed = false;
  let resolveDone;
  const done = new Promise((resolve) => (resolveDone = resolve));
  const onKey = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close("cancel");
    }
  };
  function close(value) {
    if (closed) return;
    closed = true;
    overlay.hidden = true;
    document.body.classList.remove("modal-blocking");
    document.removeEventListener("keydown", onKey, true);
    if (currentToolsModal === controller) currentToolsModal = null;
    resolveDone(value);
  }
  function setActions(list) {
    actionsEl.innerHTML = "";
    for (const action of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = action.cls || "btn-secondary";
      btn.textContent = action.label;
      btn.addEventListener("click", () => (action.onClick ? action.onClick(btn) : close(action.value)));
      actionsEl.appendChild(btn);
    }
  }
  setActions(actions);
  overlay.onclick = (event) => {
    if (event.target === overlay) close("cancel");
  };
  document.addEventListener("keydown", onKey, true);
  box.classList.remove("pop-in");
  void box.offsetWidth;
  box.classList.add("pop-in");
  overlay.hidden = false;
  document.body.classList.add("modal-blocking");
  actionsEl.querySelector("button")?.focus();

  const controller = { done, bodyEl, setActions, close, isOpen: () => !closed };
  currentToolsModal = controller;
  return controller;
}

// Arreter le jeu (design 17/10, point 2) : une seule facon, la confirmation du panneau de la
// pilule — les boutons « Arrêter » des cartes et de la fiche y renvoient.
function confirmStopGame() {
  askStopFromPill();
}

// --- Section « Fichiers de l'instance » de la fenetre Reglages ------------------------------
const TOOLS_ICONS = {
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>',
  logs: '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>',
  repair: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>',
};

function instanceFilesSectionHtml(server) {
  const locked = !!runningGameSlug;
  const modded = server.type === "modded";
  const btn = (act, icon, label, { danger = false, disabled = false } = {}) =>
    `<button type="button" class="${danger ? "btn-danger" : "btn-secondary"}" data-tool="${act}"${disabled ? " disabled" : ""}>${TOOLS_ICONS[icon]}<span>${escapeHtml(label)}</span></button>`;
  const hint = locked ? t("instanceTools.lockedHint") : !modded ? t("instanceTools.vanillaHint") : "";
  return `
    <div class="instance-files">
      <h4>${escapeHtml(t("instanceTools.filesTitle"))}</h4>
      <div class="instance-files-grid">
        ${btn("folder", "folder", t("instanceTools.openFolder"))}
        ${btn("logs", "logs", t("instanceTools.viewLogs"))}
        ${btn("copylogs", "copy", t("instanceTools.copyLogs"))}
        ${btn("repair", "repair", t("instanceTools.repair"), { disabled: locked })}
        ${modded ? btn("delete", "trash", t("instanceTools.deleteFiles"), { danger: true, disabled: locked }) : ""}
      </div>
      ${hint ? `<p class="instance-files-hint">${escapeHtml(hint)}</p>` : ""}
    </div>`;
}

function wireInstanceFilesSection(container, server) {
  container.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      if (btn.disabled) return;
      runInstanceTool(btn.dataset.tool, server);
    });
  });
}

function runInstanceTool(action, server) {
  if (action === "folder") return openInstanceFolder(server);
  if (action === "logs") return openInstanceLogs(server);
  if (action === "copylogs") return copyInstanceLogs(server);
  if (action === "repair") return repairInstance(server);
  if (action === "delete") return deleteInstanceFiles(server);
  return null;
}

async function openInstanceFolder(server) {
  const result = await window.mchub.instances.openFolder(server.slug);
  if (!result?.ok) toolsToast(t("instanceTools.folderError"));
}

function colorizeLog(text) {
  return text
    .split("\n")
    .map((line) => {
      const safe = escapeHtml(line);
      if (/\/(ERROR|FATAL)\]|\[(ERROR|FATAL)\]/.test(line)) return `<span class="e">${safe}</span>`;
      if (/\/WARN\]|\[WARN\]/.test(line)) return `<span class="w">${safe}</span>`;
      return safe;
    })
    .join("\n");
}

async function copyInstanceLogs(server) {
  const result = await window.mchub.instances.readLog(server.slug);
  const text = result?.ok ? result.fullText ?? result.text : "";
  if (!text) {
    toolsToast(t(result?.ok ? "instanceTools.copyEmpty" : "instanceTools.copyFailed"));
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toolsToast(t("instanceTools.copied"));
  } catch {
    toolsToast(t("instanceTools.copyFailed"));
  }
}

async function openInstanceLogs(server) {
  const result = await window.mchub.instances.readLog(server.slug);
  const hasText = result?.ok && result.text;
  const content = hasText
    ? `<div class="tools-log-box" id="tools-log-box">${colorizeLog(result.text)}</div>${result.truncated ? `<p class="tools-note">${escapeHtml(t("instanceTools.logsTruncated"))}</p>` : ""}`
    : `<p class="tools-note">${escapeHtml(result?.ok ? t("instanceTools.logsEmpty") : result?.error || t("instanceTools.copyFailed"))}</p>`;
  const modal = openToolsModal({
    title: t("instanceTools.logsTitle", { name: server.name }),
    bodyHtml: `<p>${escapeHtml(t("instanceTools.logsBody"))}</p>${content}`,
    wide: true,
    actions: [
      { label: t("instanceTools.logsOpenFolder"), onClick: () => window.mchub.instances.openLogsFolder(server.slug) },
      ...(hasText ? [{ label: t("instanceTools.copyLogs"), onClick: () => copyInstanceLogs(server) }] : []),
      { label: t("instanceTools.close"), value: "close" },
    ],
  });
  const logBox = modal.bodyEl.querySelector("#tools-log-box");
  if (logBox) logBox.scrollTop = logBox.scrollHeight;
}

// « Réparer » : la meme verification que « Installer » / « Rejoindre » (server:install, voir
// main.js) — chaque fichier du modpack est compare a son empreinte SHA-1 et retelecharge s'il
// est abime ou manquant. Suivi aussi dans le panneau des telechargements.
async function repairInstance(server) {
  if (runningGameSlug) {
    toolsToast(t("instanceTools.lockedHint"));
    return;
  }
  const modal = openToolsModal({
    title: t("instanceTools.repairTitle", { name: server.name }),
    bodyHtml: `<p id="tools-repair-text">${escapeHtml(t("instanceTools.repairChecking"))}</p><div class="tools-progress" id="tools-repair-progress"><div class="conn-indeterminate"></div></div>`,
    actions: [{ label: t("instanceTools.close"), value: "close" }],
  });
  const result = await window.mchub.installServer(server.slug, server.name);
  const message = result?.ok ? t("instanceTools.repairDone") : t("instanceTools.repairError", { error: result?.error || "?" });
  if (modal.isOpen()) {
    modal.bodyEl.querySelector("#tools-repair-text").textContent = message;
    modal.bodyEl.querySelector("#tools-repair-progress").classList.add(result?.ok ? "done" : "failed");
  } else {
    toolsToast(result?.ok ? t("instanceTools.repairDoneToast", { name: server.name }) : message);
  }
}

async function deleteInstanceFiles(server) {
  if (runningGameSlug) {
    toolsToast(t("instanceTools.delRefusedRunning"));
    return;
  }
  const info = await window.mchub.instances.filesInfo(server.slug);
  if (!info?.ok) {
    toolsToast(t("instanceTools.delError", { error: info?.error || "?" }));
    return;
  }
  if (!info.modded) {
    toolsToast(t("instanceTools.vanillaHint"));
    return;
  }
  if (!info.bytesAll) {
    toolsToast(t("instanceTools.delNothing"));
    return;
  }

  let keepPersonal = true;
  const modal = openToolsModal({
    title: t("instanceTools.delTitle", { name: server.name }),
    tone: "danger",
    bodyHtml: `
      <p>${escapeHtml(t("instanceTools.delBody"))}</p>
      <div class="tools-size-row"><span>${escapeHtml(t("instanceTools.delSize"))}</span><strong id="tools-del-size">${escapeHtml(formatSize(info.bytesKeep))}</strong></div>
      <label class="tools-check"><input type="checkbox" id="tools-del-keep" checked /><span>${escapeHtml(t("instanceTools.delKeep"))}</span></label>
      <p class="tools-note">${escapeHtml(t("instanceTools.delKeepWorlds"))}</p>`,
    actions: [
      { label: t("instanceTools.cancel"), value: "cancel" },
      { label: t("instanceTools.delConfirm"), cls: "btn-danger", value: "delete" },
    ],
  });
  modal.bodyEl.querySelector("#tools-del-keep").addEventListener("change", (event) => {
    keepPersonal = event.target.checked;
    modal.bodyEl.querySelector("#tools-del-size").textContent = formatSize(keepPersonal ? info.bytesKeep : info.bytesAll);
  });
  if ((await modal.done) !== "delete") return;

  const result = await window.mchub.instances.deleteFiles(server.slug, { keepPersonal });
  if (result?.ok) {
    toolsToast(t("instanceTools.deleted", { name: server.name, size: formatSize(result.freedBytes) }));
  } else if (result?.code === "running") {
    toolsToast(t("instanceTools.delRefusedRunning"));
  } else if (result?.code === "installing" || result?.code === "launching") {
    toolsToast(t("instanceTools.delRefusedInstalling"));
  } else if (result?.code === "vanilla") {
    toolsToast(t("instanceTools.vanillaHint"));
  } else {
    toolsToast(t("instanceTools.delError", { error: result?.error || "?" }));
  }
}

// Partie demarree / fermee : on retient quel serveur tourne, et les cartes se redessinent
// (Rejoindre ↔ Arrêter le jeu). Seulement la grille en ligne : la vue hors ligne a ses propres
// cartes (renderOfflineInstancesGrid) et ne doit pas etre remplacee.
async function refreshRunningGame(running) {
  let slug = null;
  if (running) {
    try {
      slug = (await window.mchub.getGameStatus())?.slug || "unknown";
    } catch {
      slug = "unknown";
    }
  }
  runningGameSlug = slug;
  renderActivity();
  if (!myInstancesPanelEl.hidden && myInstancesPanelEl.querySelector(".instances-filters")) renderMyInstancesGrid();
}

window.mchub.onGameState((running) => refreshRunningGame(running));
// Fenetre rechargee pendant une partie : on reprend l'etat reel du jeu.
window.mchub
  .getGameStatus()
  .then((status) => {
    if (!status?.running) return;
    gamePlaying = true;
    activity.playingSince = Date.now();
    renderActivity();
    return refreshRunningGame(true);
  })
  .catch(() => {});

// Pilule d'etat : dernier serveur joue (panneau « Rien en cours » / « Relancer »).
loadActivityHistory();

// Ctrl+Entrée (design 17/10, point 3) : relance le dernier serveur joué depuis n'importe quelle
// page. Ignoré dans un champ de saisie (Ctrl+Entrée peut y valoir « envoyer ») et tant que
// l'appli n'est pas ouverte (portail de connexion, écran de démarrage).
document.addEventListener("keydown", async (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter" || event.repeat) return;
  if (event.target.closest?.("input, textarea, select, [contenteditable='true']")) return;
  if (appEl.hidden || document.body.classList.contains("modal-blocking")) return;
  event.preventDefault();
  const state = activityState();
  const slug = activity.lastPlayed?.slug;
  if (!slug) {
    toolsToast(t("home.shortcutNone"));
    return;
  }
  if (state.phase === "install" || state.phase === "start" || state.phase === "play") {
    toolsToast(t("home.shortcutBusy", { name: state.name || activityServerName(slug) }));
    return;
  }
  const server = await resolveServer(slug);
  if (!server) {
    toolsToast(t("home.shortcutNone"));
    return;
  }
  toolsToast(t("home.shortcutLaunching", { name: server.name }));
  launchServer(server);
});

// --- Barre laterale depliable (serie 2, idee 1, preview validee) ---------------------------------
// Repliee par defaut ; le bouton en haut la deplie et le launcher s'en souvient. Sous 900 px elle se
// replie seule : depliee a la main, elle passe par-dessus la page (sans etre memorisee) et se referme
// des qu'on choisit une page. Les noms viennent des memes cles que les infobulles (data-i18n-title).
const sidebarEl = document.getElementById("sidebar");
const sidebarToggleEl = document.getElementById("sidebar-toggle");
let sidebarExpandedSetting = false;
let sidebarOverlayOpen = false;
const SIDEBAR_NARROW = 900;

function applySidebarLabels() {
  sidebarEl.querySelectorAll(".sidebar-btn[data-i18n-title]").forEach((btn) => {
    let label = btn.querySelector(".sidebar-label");
    if (!label) {
      label = document.createElement("span");
      label.className = "sidebar-label";
      btn.appendChild(label);
    }
    label.textContent = t(btn.dataset.i18nTitle);
  });
  // Compte (avatar en bas) : son pseudo, discret comme le reste en mode Discret.
  const account = sidebarEl.querySelector("#ms-account .account-trigger");
  if (account && !account.querySelector(".sidebar-label")) {
    const label = document.createElement("span");
    label.className = "sidebar-label";
    label.textContent = currentProfile?.name || t("nav.account");
    account.appendChild(label);
  }
}

function renderSidebarState() {
  const narrow = window.innerWidth < SIDEBAR_NARROW;
  const expanded = narrow ? sidebarOverlayOpen : sidebarExpandedSetting;
  sidebarEl.classList.toggle("expanded", expanded);
  sidebarEl.classList.toggle("overlay", narrow && expanded);
  // Coin du logo (variante D) : s'elargit avec la barre quand elle est depliee dans la page
  // (pas quand elle passe par-dessus en petite fenetre).
  document.body.classList.toggle("sidebar-expanded", expanded && !narrow);
  let scrim = document.querySelector(".sidebar-scrim");
  if (narrow && expanded && !scrim) {
    scrim = document.createElement("div");
    scrim.className = "sidebar-scrim";
    scrim.addEventListener("click", () => {
      sidebarOverlayOpen = false;
      renderSidebarState();
    });
    document.body.appendChild(scrim);
  } else if (!(narrow && expanded) && scrim) scrim.remove();
  const label = t(expanded ? "nav.collapse" : "nav.expand");
  sidebarToggleEl.setAttribute("aria-expanded", String(expanded));
  sidebarToggleEl.title = label;
  sidebarToggleEl.setAttribute("aria-label", label);
  let toggleLabel = sidebarToggleEl.querySelector(".sidebar-label");
  if (!toggleLabel) {
    toggleLabel = document.createElement("span");
    toggleLabel.className = "sidebar-label";
    sidebarToggleEl.appendChild(toggleLabel);
  }
  toggleLabel.textContent = label;
}

sidebarToggleEl.addEventListener("click", async () => {
  if (window.innerWidth < SIDEBAR_NARROW) {
    sidebarOverlayOpen = !sidebarOverlayOpen;
  } else {
    sidebarExpandedSetting = !sidebarExpandedSetting;
    window.mchub.settings.set({ sidebarExpanded: sidebarExpandedSetting }).catch(() => {});
  }
  renderSidebarState();
});
// Petite fenetre : choisir une page referme la barre depliee par-dessus.
sidebarEl.addEventListener("click", (event) => {
  if (event.target.closest(".sidebar-btn:not(.sidebar-toggle)") && sidebarOverlayOpen) {
    sidebarOverlayOpen = false;
    renderSidebarState();
  }
});
window.addEventListener("resize", () => {
  if (window.innerWidth >= SIDEBAR_NARROW) sidebarOverlayOpen = false;
  renderSidebarState();
});
new MutationObserver(() => applySidebarLabels()).observe(document.getElementById("ms-account"), { childList: true });
window.mchub.settings
  .get()
  .then((settings) => {
    sidebarExpandedSetting = settings.sidebarExpanded === true;
  })
  .catch(() => {})
  .finally(() => {
    applySidebarLabels();
    renderSidebarState();
    // La langue est appliquee pendant le demarrage : on remet les noms a jour juste apres.
    setTimeout(applySidebarLabels, 2500);
  });

// --- Recherche globale Ctrl+K (serie 2, idee 2, preview validee) --------------------------------
// Une seule recherche pour tout le launcher : serveurs, Ma bibliotheque, Mes instances, amis,
// reglages et quelques actions. Fleches pour choisir, Entree pour ouvrir, Echap pour fermer ; le ▶
// d'un serveur le lance directement. Tout se cherche dans ce qui est deja charge (aucun appel en
// plus). Rien tape : derniers serveurs joues et quelques raccourcis.
const paletteEl = document.getElementById("palette");
const paletteInput = document.getElementById("palette-input");
const paletteList = document.getElementById("palette-list");
let paletteItems = [];
let paletteSel = 0;
let paletteFavorites = [];
let paletteRecent = [];
var paletteLastQuery = "";

const normSearch = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function openSettingsTab(tab) {
  activeSettingsTab = tab;
  settingsPanelEl.querySelectorAll(".settings-nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  showSettingsView();
}

// Reglages et actions : liste fixe, avec des mots en plus pour les trouver (« ram » -> Memoire).
function paletteStaticEntries() {
  const setting = (key, tab, words) => ({ group: "settings", title: t(key), sub: `${t("nav.settings")} › ${t(`settings.tab${tab[0].toUpperCase()}${tab.slice(1)}`)}`, words, icon: "⚙", run: () => openSettingsTab(tab) });
  const lastSlug = activity.lastPlayed?.slug;
  return [
    setting("appearance.theme", "appearance", "theme sombre clair dark light"),
    setting("appearance.accentColor", "appearance", "couleur accent color"),
    setting("appearance.reduceMotion", "appearance", "animations motion"),
    setting("discreet.settingTitle", "appearance", "discret streamer live"),
    setting("language.launcherLanguage", "language", "langue language english francais"),
    setting("search.memory", "memory", "memoire ram memory java go gb"),
    setting("settings.javaLabel", "misc", "java jdk memoire"),
    setting("settings.gameFolder", "misc", "dossier folder jeu game disque"),
    setting("settings.betaVersion", "misc", "beta version mise a jour update"),
    setting("settings.tabDebug", "debug", "debug journal logs"),
    ...(lastSlug
      ? [{ group: "actions", title: t("search.actionRelaunch", { name: activityServerName(lastSlug) }), sub: "Ctrl+Entrée", words: "relancer jouer play again", icon: "▶", run: async () => { const server = await resolveServer(lastSlug); if (server) launchServer(server); } }]
      : []),
    { group: "actions", title: t("help.title"), sub: "F1", words: "aide help probleme problem souci bug", icon: "?", run: () => showHelpView() },
    { group: "actions", title: t("search.actionGameFolder"), sub: "", words: "dossier folder", icon: "↳", run: () => window.mchub.settings.openGameFolder() },
    { group: "actions", title: t("search.actionCopyLog"), sub: "", words: "bug rapport report journal log copier copy", icon: "↳", run: async () => { try { await navigator.clipboard.writeText(await window.mchub.logs.copyLatest()); toolsToast(t("debug.copied")); } catch { toolsToast(t("activity.reportCopyFailed")); } } },
    { group: "actions", title: t(discreetMode ? "search.actionDiscreetOff" : "search.actionDiscreetOn"), sub: "", words: "discret streamer live", icon: "◐", run: () => setDiscreetMode(!discreetMode) },
  ];
}

function serverEntry(server, group, sub) {
  return {
    group,
    title: server.name,
    sub,
    words: `${server.slug} ${server.modpackName || ""}`,
    server,
    run: () => {
      detailOrigin = "search";
      openDetail(server.slug);
    },
  };
}

function paletteIndex() {
  const servers = serverListCache?.servers || allServers || [];
  const byslug = new Map(servers.map((server) => [server.slug, server]));
  const entries = [];
  for (const server of servers) {
    const online = server.playerCount != null ? ` · ${t("serverList.onlineChip", { count: server.playerCount })}` : "";
    entries.push(serverEntry(server, "servers", `${server.minecraftVersion || ""}${online}`));
  }
  for (const slug of paletteFavorites) {
    const server = byslug.get(slug) || knownServer(slug);
    if (server) entries.push(serverEntry(server, "library", t("search.favorite")));
  }
  for (const server of myInstancesServers || []) entries.push({ ...serverEntry(server, "instances", server.minecraftVersion || ""), run: () => showMyInstancesView() });
  if (!discreetMode) {
    for (const friend of friendsList || []) {
      entries.push({ group: "friends", title: friend.minecraftUsername || "?", sub: t(friend.online ? "friends.online" : "friends.offline"), words: "", icon: (friend.minecraftUsername || "?").charAt(0).toUpperCase(), run: () => showFriendsView() });
    }
  }
  return entries.concat(paletteStaticEntries());
}

function paletteResults(query) {
  const q = normSearch(query.trim());
  if (!q) {
    const recent = paletteRecent.map((slug) => knownServer(slug)).filter(Boolean).slice(0, 3).map((server) => serverEntry(server, "recent", server.minecraftVersion || ""));
    const statics = paletteStaticEntries();
    return recent.concat(statics.filter((entry) => entry.group === "actions").slice(0, 2), statics.filter((entry) => entry.group === "settings").slice(5, 6));
  }
  const order = ["servers", "library", "instances", "friends", "settings", "actions"];
  return paletteIndex()
    .filter((entry) => normSearch(`${entry.title} ${entry.sub} ${entry.words}`).includes(q))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
    .slice(0, 40);
}

function highlightMatch(text, query) {
  const raw = String(text || "");
  const q = normSearch(query.trim());
  const at = q ? normSearch(raw).indexOf(q) : -1;
  if (at < 0) return escapeHtml(raw);
  return `${escapeHtml(raw.slice(0, at))}<mark>${escapeHtml(raw.slice(at, at + q.length))}</mark>${escapeHtml(raw.slice(at + q.length))}`;
}

function renderPalette() {
  const query = paletteInput.value;
  paletteItems = paletteResults(query);
  if (paletteSel >= paletteItems.length) paletteSel = Math.max(0, paletteItems.length - 1);
  if (!paletteItems.length) {
    paletteList.innerHTML = `<div class="palette-none"><b>${escapeHtml(t("search.none", { query }))}</b><span>${escapeHtml(t("search.noneHint"))}</span><button type="button" class="join-btn" id="palette-directory">${escapeHtml(t("search.noneAction"))}</button></div>`;
    document.getElementById("palette-directory").addEventListener("click", () => {
      const text = paletteInput.value;
      closeCommandPalette();
      listFilters = { ...listFilters, q: text };
      showServersView();
    });
    return;
  }
  let lastGroup = null;
  paletteList.innerHTML = paletteItems
    .map((entry, index) => {
      const head = entry.group !== lastGroup ? `<div class="palette-group">${escapeHtml(t(`search.group_${entry.group}`))}</div>` : "";
      lastGroup = entry.group;
      const icon = entry.server ? serverIconInner(entry.server) : escapeHtml(entry.icon || "");
      const play = entry.server && entry.group !== "instances" ? `<button type="button" class="palette-play" data-palette-play="${index}" aria-label="${escapeHtml(t("home.playOn", { name: entry.title }))}">▶</button>` : "";
      // Option C (18/10) : pendant une partie, Installer reste possible depuis la recherche.
      const install = entry.server && gamePlaying ? `<button type="button" class="palette-play palette-install" data-palette-install="${index}" title="${escapeHtml(t("myInstances.menuInstall"))}" aria-label="${escapeHtml(t("myInstances.menuInstall"))}">⬇</button>` : "";
      return `${head}<div class="palette-item${index === paletteSel ? " sel" : ""}" role="option" aria-selected="${index === paletteSel}" data-palette-index="${index}"><span class="palette-icon">${icon}</span><span class="palette-text"><span>${highlightMatch(entry.title, query)}</span>${entry.sub ? `<small>${highlightMatch(entry.sub, query)}</small>` : ""}</span>${install}${play}</div>`;
    })
    .join("");
  paletteList.querySelector(".palette-item.sel")?.scrollIntoView({ block: "nearest" });
}

async function openCommandPalette(initialQuery = "") {
  if (appEl.hidden) return;
  try {
    const settings = await window.mchub.settings.get();
    paletteFavorites = await getFavoriteSlugs();
    paletteRecent = settings.recentlyPlayed || [];
  } catch {
    // Donnees locales illisibles : la recherche marche quand meme sur le reste.
  }
  paletteInput.value = typeof initialQuery === "string" ? initialQuery : "";
  paletteSel = 0;
  paletteEl.hidden = false;
  renderPalette();
  paletteInput.focus();
}

function closeCommandPalette() {
  paletteEl.hidden = true;
}

function runPaletteEntry(index, play) {
  const entry = paletteItems[index];
  if (!entry) return;
  paletteLastQuery = paletteInput.value;
  closeCommandPalette();
  if (play && entry.server) launchServer(entry.server);
  else entry.run();
}

document.getElementById("search-trigger").addEventListener("click", () => openCommandPalette());
paletteInput.addEventListener("input", () => {
  paletteSel = 0;
  renderPalette();
});
paletteEl.addEventListener("click", (event) => {
  if (event.target === paletteEl) return closeCommandPalette();
  const installBtn = event.target.closest("[data-palette-install]");
  if (installBtn) {
    const entry = paletteItems[Number(installBtn.dataset.paletteInstall)];
    closeCommandPalette();
    if (entry?.server) installServerStandalone(entry.server, null);
    return;
  }
  const play = event.target.closest("[data-palette-play]");
  if (play) return runPaletteEntry(Number(play.dataset.palettePlay), true);
  const item = event.target.closest("[data-palette-index]");
  if (item) runPaletteEntry(Number(item.dataset.paletteIndex), false);
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (paletteEl.hidden) openCommandPalette();
    else closeCommandPalette();
    return;
  }
  // Fiche ouverte : Echap revient a la liste (sauf si un panneau ou une fenetre est ouvert).
  if (event.key === "Escape" && paletteEl.hidden && !detailEl.hidden && !document.body.classList.contains("modal-blocking") && !event.target.closest?.("input, textarea, select") && !document.querySelector(".tasks-panel:not([hidden]), .notif-panel:not([hidden]), .mc-status-panel:not([hidden])")) {
    event.preventDefault();
    goBackFromDetail();
    return;
  }
  if (paletteEl.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeCommandPalette();
  } else if (event.key === "ArrowDown" && paletteItems.length) {
    event.preventDefault();
    paletteSel = (paletteSel + 1) % paletteItems.length;
    renderPalette();
  } else if (event.key === "ArrowUp" && paletteItems.length) {
    event.preventDefault();
    paletteSel = (paletteSel - 1 + paletteItems.length) % paletteItems.length;
    renderPalette();
  } else if (event.key === "Enter") {
    event.preventDefault();
    runPaletteEntry(paletteSel, event.ctrlKey);
  }
});

// --- Fil d'Ariane et Retour qui garde la place (serie 2, idee 3, preview validee) ---------------
// Sur une fiche, une ligne montre d'ou l'on vient (« ‹ Serveurs › Moddé › Cobblemon FR »). Le lien,
// Echap ou le bouton « retour » de la souris ramenent au meme endroit de la liste, avec les memes
// filtres, et la carte ouverte s'allume un instant pour qu'on la retrouve.
var detailReturn = { origin: "servers", scroll: 0, slug: null, query: "" };

function detailBreadcrumbHtml(name) {
  const origin = detailReturn.origin || "servers";
  const typeLabel = { all: t("crumb.all"), vanilla: t("serverCard.vanilla"), modded: t("serverCard.modded") }[listFilters.type] || t("crumb.all");
  const parts = {
    servers: [t("nav.servers"), listFilters.q ? `« ${listFilters.q} »` : typeLabel],
    home: [t("nav.home"), null],
    favorites: [t("nav.library"), t("nav.favorites")],
    recent: [t("nav.library"), t("nav.recent")],
    installed: [t("nav.library"), t("library.installed")],
    instances: [t("nav.myInstances"), null],
    search: [t("crumb.search"), detailReturn.query ? `« ${detailReturn.query} »` : null],
  }[origin] || [t("nav.servers"), null];
  return `
    <nav class="detail-crumb" aria-label="${escapeHtml(t("crumb.label"))}">
      <button type="button" class="detail-crumb-back" title="${escapeHtml(t("crumb.backHint"))}">‹ ${escapeHtml(parts[0])}</button>
      ${parts[1] ? `<span class="detail-crumb-sep">›</span><span>${escapeHtml(parts[1])}</span>` : ""}
      <span class="detail-crumb-sep">›</span><b>${escapeHtml(name || "")}</b>
    </nav>`;
}

function wireDetailBreadcrumb() {
  detailEl.querySelector(".detail-crumb-back")?.addEventListener("click", goBackFromDetail);
}

async function goBackFromDetail() {
  const { origin, scroll, slug, query } = detailReturn;
  if (origin === "search") {
    openCommandPalette(query);
    return;
  }
  if (origin === "favorites") await showFavoritesView();
  else if (origin === "recent") await showRecentView();
  else if (origin === "installed") await showInstalledView();
  else if (origin === "home") await showHomeView();
  else if (origin === "instances") await showMyInstancesView();
  else {
    navServersBtn.classList.add("active");
    await loadServers();
  }
  // La liste se redessine en plusieurs temps : on attend que la carte soit la (1,5 s au plus), puis
  // meme position et la carte ouverte s'allume un instant.
  const main = document.querySelector("main");
  for (let i = 0; i < 30; i++) {
    const card = slug ? document.querySelector(`.row[data-slug="${CSS.escape(slug)}"]`) : null;
    if (card && card.offsetParent) {
      if (main) main.scrollTop = scroll;
      card.classList.add("row-flash");
      setTimeout(() => card.classList.remove("row-flash"), 1400);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (main) main.scrollTop = scroll;
}

// Bouton « retour » de la souris (bouton 4) sur une fiche.
document.addEventListener("mouseup", (event) => {
  if (event.button !== 3 || detailEl.hidden || appEl.hidden) return;
  event.preventDefault();
  goBackFromDetail();
});

// --- Page Aide (serie 2, idee 6, version A validee) -----------------------------------------------
// Tout l'aide au meme endroit : recherche, problemes frequents expliques simplement avec des
// boutons qui menent au bon endroit, et « Toujours bloque ? » (rapport de diagnostic, journaux,
// console). Ces outils restent aussi dans Parametres > Debogage. F1 ouvre la page de partout.
const helpPanelEl = document.getElementById("help-panel");
const navHelpBtn = document.getElementById("nav-help");
let helpOpen = "launch";
let helpQuery = "";

const HELP_QUESTIONS = [
  { id: "launch", icon: "▶", words: "lance lancer demarre demarrer crash java start launch run", actions: ["log", "retry"] },
  { id: "mods", icon: "⬇", words: "mod mods telecharge telecharger curseforge modrinth bloque download blocked", actions: ["downloads"] },
  { id: "disk", icon: "💾", words: "disque place stockage espace plein disk space storage full deplacer move", actions: ["instances", "move-games"] },
  { id: "ram", icon: "🧠", words: "memoire ram rame lag lent ferme memory slow close", actions: ["memory"] },
  { id: "ms", icon: "🔑", words: "microsoft compte connexion connecter account sign login", actions: ["account"] },
  { id: "off", icon: "📡", words: "hors ligne serveur offline ping down", actions: ["report"] },
];

function helpMatches() {
  const q = normSearch(helpQuery.trim());
  if (!q) return HELP_QUESTIONS;
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  return HELP_QUESTIONS.filter((item) => {
    const hay = normSearch(`${t(`help.q_${item.id}`)} ${item.words}`);
    return words.some((w) => hay.includes(w) || item.words.split(" ").some((x) => w.startsWith(x)));
  });
}

async function runHelpAction(action) {
  const lastSlug = activity.lastPlayed?.slug;
  if (action === "log") window.mchub.logs.openConsole();
  else if (action === "retry") {
    const server = lastSlug ? await resolveServer(lastSlug) : null;
    if (server) launchServer(server);
    else showServersView();
  } else if (action === "downloads") window.mchub.openDownloadsFolder();
  else if (action === "instances") showMyInstancesView();
  else if (action === "move-games") {
    openSettingsTab("misc");
    openGamesMove();
  }
  else if (action === "memory") openSettingsTab("memory");
  else if (action === "account") showAccountView();
  else if (action === "report") {
    const server = lastSlug ? await resolveServer(lastSlug) : null;
    if (server) openReportDialog(server);
    else showServersView();
  } else if (action === "export") {
    const result = await window.mchub.diagnostics.exportReport();
    if (result?.ok) toolsToast(t("debug.reportExported"));
  } else if (action === "logs-folder") window.mchub.logs.openLogsFolder();
  else if (action === "console") window.mchub.logs.openConsole();
}

function renderHelpList() {
  const list = document.getElementById("help-faq");
  if (!list) return;
  const found = helpMatches();
  if (found.length && !found.some((item) => item.id === helpOpen)) helpOpen = found[0].id;
  list.innerHTML = found.length
    ? found
        .map((item) => {
          const open = item.id === helpOpen;
          const steps = t(`help.a_${item.id}`).split("\n");
          return `
          <div class="help-q${open ? " open" : ""}">
            <button type="button" data-help-q="${item.id}" aria-expanded="${open}"><span class="help-q-icon">${item.icon}</span>${escapeHtml(t(`help.q_${item.id}`))}<span class="help-q-chev">›</span></button>
            ${open ? `<div class="help-a"><ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol><div class="help-a-actions">${item.actions.map((action, i) => `<button type="button" class="${i === 0 ? "join-btn" : "btn-secondary"}" data-help-action="${action}">${escapeHtml(t(`help.act_${action}`))}</button>`).join("")}</div></div>` : ""}
          </div>`;
        })
        .join("")
    : `<div class="help-none"><b>${escapeHtml(t("help.none", { query: helpQuery }))}</b>${escapeHtml(t("help.noneText"))}</div>`;
}

async function showHelpView() {
  [homePanelEl, statusEl, listEl, listToolbarEl, listTitleEl, detailEl, settingsPanelEl, accountPanelEl, favoritesPanelEl, recentPanelEl, myInstancesPanelEl, friendsPanelEl].forEach((el) => {
    if (el) el.hidden = true;
  });
  updateGuestBanner(false);
  helpPanelEl.hidden = false;
  [navHomeBtn, navServersBtn, navFavoritesBtn, navRecentBtn, navMyInstancesBtn, navFriendsBtn, navSettingsBtn].forEach((btn) => btn.classList.remove("active"));
  navHelpBtn.classList.add("active");
  helpPanelEl.innerHTML = `
    <h2>${escapeHtml(t("help.title"))}</h2>
    <label class="help-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" id="help-search" value="${escapeHtml(helpQuery)}" placeholder="${escapeHtml(t("help.search"))}" autocomplete="off" />
    </label>
    <h3 style="font-size: 14px; margin: 0;">${escapeHtml(t("help.frequent"))}</h3>
    <div class="help-faq" id="help-faq"></div>
    <div class="help-stuck">
      <b>${escapeHtml(t("help.stuckTitle"))}</b>
      <p>${escapeHtml(t("help.stuckText"))}</p>
      <div class="help-stuck-actions">
        <button type="button" class="join-btn" data-help-action="export">${escapeHtml(t("help.act_export"))}</button>
        <button type="button" class="btn-secondary" data-help-action="logs-folder">${escapeHtml(t("help.act_logs-folder"))}</button>
        <button type="button" class="btn-secondary" data-help-action="console">${escapeHtml(t("help.act_console"))}</button>
      </div>
    </div>
    <div class="help-version"><span id="help-version-text">…</span><button type="button" class="btn-secondary" id="help-copy" style="padding: 3px 10px;">${escapeHtml(t("help.copy"))}</button></div>`;
  renderHelpList();
  const input = document.getElementById("help-search");
  input.addEventListener("input", () => {
    helpQuery = input.value;
    renderHelpList();
  });
  helpPanelEl.addEventListener("click", helpPanelClick);
  try {
    const info = await window.mchub.diagnostics.getSystemInfo();
    const line = `Omniscient ${info.launcherVersion || ""} · ${info.os || ""} · Java ${info.java || "—"}`;
    document.getElementById("help-version-text").textContent = line;
    document.getElementById("help-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(line);
        toolsToast(t("help.copied"));
      } catch {
        // Presse-papiers indisponible : rien de bloquant.
      }
    };
  } catch {
    document.getElementById("help-version-text").textContent = "Omniscient";
  }
}

function helpPanelClick(event) {
  const q = event.target.closest("[data-help-q]");
  if (q) {
    helpOpen = helpOpen === q.dataset.helpQ ? null : q.dataset.helpQ;
    renderHelpList();
    return;
  }
  const action = event.target.closest("[data-help-action]");
  if (action) runHelpAction(action.dataset.helpAction);
}

function hideHelpPanel() {
  helpPanelEl.hidden = true;
  navHelpBtn.classList.remove("active");
  helpPanelEl.removeEventListener("click", helpPanelClick);
}

// Toute autre page cache l'Aide : boutons de la barre laterale (ecouteurs deja poses), et les
// fonctions d'affichage appelees ailleurs (recherche Ctrl+K, cartes, liens).
sidebarEl.addEventListener("click", (event) => {
  const btn = event.target.closest(".sidebar-btn");
  if (btn && btn !== navHelpBtn && btn !== sidebarToggleEl) hideHelpPanel();
}, true);
for (const name of ["showHomeView", "showServersView", "showFavoritesView", "showRecentView", "showInstalledView", "showMyInstancesView", "showFriendsView", "showSettingsView", "showAccountView", "openDetail"]) {
  // Les fonctions declarees en haut d'un script classique sont des proprietes de window : les
  // remplacer ici change aussi les appels faits par leur nom ailleurs dans ce fichier.
  const original = globalThis[name];
  if (typeof original !== "function") continue;
  globalThis[name] = function (...args) {
    hideHelpPanel();
    return original.apply(this, args);
  };
}
navHelpBtn.addEventListener("click", showHelpView);
document.addEventListener("keydown", (event) => {
  if (event.key !== "F1" || appEl.hidden) return;
  event.preventDefault();
  showHelpView();
});

// --- Suppression en masse (serie 2, idee 7, version A : corbeille + Annuler) ---------------------
// « Sélectionner » dans Mes instances : on coche plusieurs cartes (Maj+clic pour une suite, Ctrl+A
// pour tout, Echap pour annuler), des raccourcis « Serveurs de test » / « Pas joué depuis 30
// jours », puis une seule confirmation. Les fichiers partent dans la corbeille, avec « Annuler »
// pendant quelques secondes. Le serveur en cours de jeu et les vanilla (pas de fichiers propres)
// ne peuvent pas etre coches.
var bulk = { on: false, sel: new Set(), last: null, sizes: new Map() };
const BULK_UNDO_MS = 8000;

// Cochable : serveur moddé, pas en cours de jeu, et des fichiers presents sur ce PC (taille lue
// par filesInfo ; tant qu'elle n'est pas connue, la carte reste cochable).
function bulkSelectable(server) {
  return server.type === "modded" && server.slug !== runningGameSlug && bulk.sizes.get(server.slug) !== 0;
}

function bulkBarHtml(all) {
  const total = [...bulk.sel].reduce((sum, slug) => sum + (bulk.sizes.get(slug) || 0), 0);
  // Rien de supprimable (que des serveurs vanilla, ou rien d'installe) : on le dit clairement.
  if (all && !all.some(bulkSelectable)) {
    return `
    <div class="bulk-bar bulk-none">
      <span><b>${escapeHtml(t("bulk.noneTitle"))}</b><br /><span class="muted">${escapeHtml(t("bulk.noneText"))}</span></span>
    </div>`;
  }
  return `
    <div class="bulk-chips">
      <button type="button" class="sort-chip" data-bulk-pick="test">${escapeHtml(t("bulk.pickTest"))}</button>
      <button type="button" class="sort-chip" data-bulk-pick="old">${escapeHtml(t("bulk.pickOld"))}</button>
      <button type="button" class="sort-chip" data-bulk-pick="all">${escapeHtml(t("bulk.pickAll"))}</button>
      <button type="button" class="sort-chip" data-bulk-pick="none">${escapeHtml(t("bulk.pickNone"))}</button>
    </div>
    <div class="bulk-bar">
      <b>${escapeHtml(bulk.sel.size ? t("bulk.selected", { count: bulk.sel.size, size: formatTaskBytes(total) }) : t("bulk.hint"))}</b>
      <button type="button" class="btn-danger" id="bulk-delete"${bulk.sel.size ? "" : " disabled"}>${escapeHtml(t("bulk.delete"))}</button>
    </div>`;
}

function wireBulkSelection(all) {
  document.getElementById("my-instances-select")?.addEventListener("click", () => {
    bulk.on = !bulk.on;
    bulk.sel.clear();
    renderMyInstancesGrid();
  });
  if (!bulk.on) return;
  const selectable = all.filter(bulkSelectable).map((server) => server.slug);
  // Tailles affichees : lues une fois par instance (fichiers supprimables, mondes gardes).
  selectable.filter((slug) => !bulk.sizes.has(slug)).forEach(async (slug) => {
    const info = await window.mchub.instances.filesInfo(slug).catch(() => null);
    bulk.sizes.set(slug, info?.ok && info.modded ? info.bytesKeep : 0);
    if (bulk.sizes.get(slug) === 0) bulk.sel.delete(slug);
    if (bulk.on) renderMyInstancesGrid();
  });
  myInstancesPanelEl.querySelectorAll(".instance-card").forEach((card) => {
    const slug = card.dataset.slug;
    const ok = selectable.includes(slug);
    card.classList.add("bulk-mode");
    card.classList.toggle("bulk-disabled", !ok);
    card.classList.toggle("bulk-selected", bulk.sel.has(slug));
    const server = all.find((item) => item.slug === slug);
    // Carte non cochable : la raison est ecrite sur la carte (retour de Rushi 17/10), pas
    // seulement au survol.
    const reason = slug === runningGameSlug ? "Playing" : server?.type !== "modded" ? "Vanilla" : "Installed";
    card.title = ok ? "" : t(`bulk.not${reason}`);
    card.insertAdjacentHTML(
      "afterbegin",
      ok ? `<span class="bulk-check" aria-hidden="true">${bulk.sel.has(slug) ? "✓" : ""}</span>` : `<span class="bulk-reason">${escapeHtml(t(`bulk.short${reason}`))}</span>`,
    );
    card.addEventListener("click", (event) => {
      if (!ok || event.target.closest("button, a")) return;
      if (event.shiftKey && bulk.last && selectable.includes(bulk.last)) {
        const [from, to] = [selectable.indexOf(bulk.last), selectable.indexOf(slug)].sort((a, b) => a - b);
        selectable.slice(from, to + 1).forEach((item) => bulk.sel.add(item));
      } else if (bulk.sel.has(slug)) bulk.sel.delete(slug);
      else bulk.sel.add(slug);
      bulk.last = slug;
      renderMyInstancesGrid();
    });
  });
  myInstancesPanelEl.querySelectorAll("[data-bulk-pick]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pick = btn.dataset.bulkPick;
      let slugs = [];
      if (pick === "all") slugs = selectable;
      else if (pick === "test") slugs = all.filter((server) => selectable.includes(server.slug) && /test/i.test(server.name)).map((server) => server.slug);
      else if (pick === "old") {
        const settings = await window.mchub.settings.get();
        const limit = Date.now() - 30 * 86_400_000;
        slugs = selectable.filter((slug) => (settings.recentPlayedAt?.[slug] || 0) < limit);
      }
      bulk.sel = new Set(slugs);
      renderMyInstancesGrid();
    });
  });
  document.getElementById("bulk-delete")?.addEventListener("click", () => confirmBulkDelete(all));
}

async function confirmBulkDelete(all) {
  const chosen = all.filter((server) => bulk.sel.has(server.slug));
  if (!chosen.length) return;
  const total = chosen.reduce((sum, server) => sum + (bulk.sizes.get(server.slug) || 0), 0);
  const modal = openToolsModal({
    title: t("bulk.confirmTitle", { count: chosen.length }),
    tone: "danger",
    bodyHtml: `
      <ul class="bulk-list">${chosen.map((server) => `<li>${escapeHtml(server.name)} · ${escapeHtml(formatTaskBytes(bulk.sizes.get(server.slug) || 0))}</li>`).join("")}</ul>
      <p>${escapeHtml(t("bulk.freed", { size: formatTaskBytes(total) }))}</p>
      <label class="bulk-keep"><input type="checkbox" id="bulk-keep" checked /> ${escapeHtml(t("bulk.keep"))}</label>
      <p class="tools-note">${escapeHtml(t("bulk.trashNote"))}</p>`,
    actions: [
      { label: t("bulk.cancel"), value: "cancel" },
      { label: t("bulk.confirmBtn", { count: chosen.length }), cls: "btn-danger", value: "go" },
    ],
  });
  const keepEl = modal.bodyEl.querySelector("#bulk-keep");
  let keepPersonal = true;
  keepEl.addEventListener("change", () => (keepPersonal = keepEl.checked));
  if ((await modal.done) !== "go") return;
  const result = await window.mchub.instances.trashFiles(chosen.map((server) => server.slug), { keepPersonal });
  bulk.on = false;
  bulk.sel.clear();
  bulk.sizes.clear();
  renderMyInstancesGrid();
  if (!result?.ok) return toolsToast(t("instanceTools.delError", { error: result?.error || "?" }));
  if (result.done.length) showUndoToast(result);
  else toolsToast(t("bulk.noneDone"));
}

// Bandeau « Annuler » (8 s) : a part des petits messages (toolsToast). Avant (audit 17/10, lot 1),
// il portait la meme classe et le message suivant l'effacait : « Annuler » disparaissait alors que
// la suppression partait quand meme a la fin du delai.
function showUndoToast(result) {
  const el = document.createElement("div");
  el.className = "undo-toast";
  el.setAttribute("role", "status");
  el.innerHTML = `<span>✓ ${escapeHtml(t("bulk.done", { count: result.done.length, size: formatTaskBytes(result.freedBytes) }))}</span><button type="button" class="btn-secondary">${escapeHtml(t("bulk.undo"))}</button>`;
  document.body.appendChild(el);
  let undone = false;
  const timer = setTimeout(() => {
    el.remove();
    if (!undone) window.mchub.instances.finalizeTrash(result.batch);
  }, BULK_UNDO_MS);
  el.querySelector("button").addEventListener("click", async () => {
    undone = true;
    clearTimeout(timer);
    el.remove();
    await window.mchub.instances.undoTrash(result.batch);
    toolsToast(t("bulk.undone"));
    if (!myInstancesPanelEl.hidden) renderMyInstancesGrid();
  });
}

document.addEventListener("keydown", (event) => {
  if (!bulk.on || myInstancesPanelEl.hidden || document.body.classList.contains("modal-blocking") || event.target.closest?.("input, textarea")) return;
  if (event.key === "Escape") {
    bulk.on = false;
    bulk.sel.clear();
    renderMyInstancesGrid();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    const pool = myInstancesFilter === "joined" ? myJoinedServers : myInstancesServers;
    pool.filter(bulkSelectable).forEach((server) => bulk.sel.add(server.slug));
    renderMyInstancesGrid();
  }
});

// --- Parametres plein ecran (serie 2, idee 8, version A validee) ---------------------------------
// Les onglets dessinent toujours leurs <section> comme avant ; ici on les re-range en cartes :
// chaque bloc separe par un trait devient sa propre carte, le titre d'une section devient un titre
// de groupe, et le tout tombe dans une grille qui met autant de colonnes que la largeur le permet.
// Les noeuds sont deplaces (pas recopies) : les ecouteurs poses par les onglets restent en place.
const settingsContentEl = document.getElementById("settings-content");
const settingsResultsEl = document.getElementById("settings-search-results");
const settingsFindInput = document.getElementById("settings-find-input");
const SETTINGS_TABS = ["appearance", "language", "memory", "misc", "privacy", "debug"];

function cardifySettings(host) {
  if (!host || host.firstElementChild?.classList.contains("settings-cards")) return;
  if (!host.firstElementChild) return;
  const grid = document.createElement("div");
  grid.className = "settings-cards";
  const raw = [...host.children];
  const sections = [];
  for (const node of raw) {
    if (node.matches(".settings-grid, .settings-masonry")) sections.push(...node.querySelectorAll(":scope > .settings-section, :scope > section"));
    else sections.push(node);
  }
  for (const node of sections) {
    if (!node.matches?.(".settings-section")) {
      node.classList.add("settings-wide");
      grid.append(node);
      continue;
    }
    // Chaque section devient un groupe (titre + sa propre grille) : les cartes d'un groupe
    // s'etirent sur toute la largeur et ont la meme hauteur sur une rangee (retour de Rushi 17/10).
    const danger = node.classList.contains("settings-reset");
    const group = document.createElement("div");
    group.className = "settings-group";
    const first = node.firstElementChild;
    if (first && first.tagName === "H3") {
      const title = document.createElement("h3");
      title.className = "settings-group-title";
      title.textContent = first.textContent;
      group.append(title);
      first.remove();
    }
    const groupGrid = document.createElement("div");
    groupGrid.className = "settings-group-grid";
    group.append(groupGrid);
    grid.append(group);
    let card = null;
    const flush = () => {
      if (card && card.childElementCount) groupGrid.append(card);
      card = null;
    };
    for (const child of [...node.children]) {
      if (child.classList.contains("settings-divider")) {
        flush();
        continue;
      }
      if (!card) {
        card = document.createElement("section");
        card.className = `settings-section${danger ? " settings-card-danger" : ""}`;
      }
      card.append(child);
    }
    flush();
  }
  host.replaceChildren(grid);
  if (host === settingsContentEl || host.closest("#settings-search-results")) applySettingsFilter();
}

// Les onglets se redessinent eux-memes apres un changement (innerHTML) : on re-range a chaque fois.
new MutationObserver(() => {
  if (settingsContentEl.firstElementChild && !settingsContentEl.firstElementChild.classList.contains("settings-cards")) cardifySettings(settingsContentEl);
  settingsResultsEl.querySelectorAll(".settings-search-host").forEach((host) => {
    if (host.firstElementChild && !host.firstElementChild.classList.contains("settings-cards")) cardifySettings(host);
  });
}).observe(document.getElementById("settings-panel"), { childList: true, subtree: true });

// Un reglage modifie : sa carte s'allume un instant (l'enregistrement reste immediat).
document.getElementById("settings-panel").addEventListener("change", (event) => {
  const card = event.target.closest?.(".settings-group-grid > .settings-section");
  if (!card) return;
  card.classList.add("settings-card-flash");
  setTimeout(() => card.classList.remove("settings-card-flash"), 900);
});

// --- Recherche dans les reglages ---
function settingsSearchActive() {
  return !settingsResultsEl.hidden;
}

function clearSettingsSearch() {
  settingsFindInput.value = "";
  settingsResultsEl.replaceChildren();
  settingsResultsEl.hidden = true;
  settingsContentEl.hidden = false;
}

let settingsSearchToken = 0;
async function runSettingsSearch() {
  const query = settingsFindInput.value.trim();
  if (!query) {
    if (settingsSearchActive()) {
      clearSettingsSearch();
      settingsPanelEl.querySelectorAll(".settings-nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === activeSettingsTab));
      await renderSettingsTab(activeSettingsTab);
    }
    return;
  }
  if (!settingsSearchActive()) {
    // Toutes les sections a la fois : on vide la section affichee (sinon ses id seraient en double).
    const token = ++settingsSearchToken;
    settingsContentEl.replaceChildren();
    settingsContentEl.hidden = true;
    settingsResultsEl.hidden = false;
    settingsPanelEl.querySelectorAll(".settings-nav-btn").forEach((b) => b.classList.remove("active"));
    const settings = await window.mchub.settings.get();
    if (token !== settingsSearchToken || !settingsSearchActive()) return;
    const count = document.createElement("p");
    count.className = "settings-search-count";
    settingsResultsEl.append(count);
    for (const tab of SETTINGS_TABS) {
      const block = document.createElement("div");
      block.className = "settings-search-tab";
      block.dataset.tab = tab;
      const title = document.createElement("h3");
      title.className = "settings-tab-title";
      title.textContent = t(`settings.tab${tab[0].toUpperCase()}${tab.slice(1)}`);
      const host = document.createElement("div");
      host.className = "settings-search-host";
      block.append(title, host);
      settingsResultsEl.append(block);
      const render = { language: renderLanguageTab, memory: renderMemoryTab, misc: renderMiscTab, privacy: renderPrivacyTab, debug: renderDebugTab }[tab] || renderAppearanceTab;
      try {
        await render(host, settings);
      } catch {
        /* une section qui ne se dessine pas ne bloque pas la recherche */
      }
      cardifySettings(host);
    }
  }
  applySettingsFilter();
}

function applySettingsFilter() {
  if (!settingsSearchActive()) return;
  const words = normSearch(settingsFindInput.value).split(/\s+/).filter(Boolean);
  let total = 0;
  settingsResultsEl.querySelectorAll(".settings-search-tab").forEach((block) => {
    let shown = 0;
    block.querySelectorAll(".settings-cards > .settings-group").forEach((group) => {
      const lastTitle = group.querySelector(".settings-group-title");
      let groupHits = 0;
      group.querySelectorAll(".settings-group-grid > .settings-section").forEach((item) => {
      const text = normSearch(`${lastTitle?.textContent || ""} ${item.textContent} ${[...item.querySelectorAll("[placeholder], [title], [aria-label]")].map((el) => el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("aria-label")).join(" ")}`);
      // Debut de mot : « ram » trouve « RAM » mais pas « paramètres ».
      const textWords = text.split(/[^a-z0-9+]+/).filter(Boolean);
      const hit = item.classList.contains("settings-section") && words.every((word) => textWords.some((w) => w.startsWith(word)));
      item.hidden = !hit;
      if (hit) {
        shown++;
        groupHits++;
      }
      });
      group.hidden = groupHits === 0;
    });
    block.querySelectorAll(".settings-cards > .settings-wide").forEach((item) => (item.hidden = true));
    block.hidden = shown === 0;
    total += shown;
  });
  const count = settingsResultsEl.querySelector(".settings-search-count");
  settingsResultsEl.querySelector(".settings-nores")?.remove();
  if (count) count.textContent = total ? t("settings.found", { count: total }) : "";
  if (!total) {
    const empty = document.createElement("div");
    empty.className = "settings-nores";
    empty.innerHTML = `<b>${escapeHtml(t("settings.noResult", { query: settingsFindInput.value.trim() }))}</b>
      <span>${escapeHtml(t("settings.noResultHint"))}</span>
      <button type="button" class="btn-secondary">${escapeHtml(t("settings.openHelp"))}</button>`;
    empty.querySelector("button").addEventListener("click", () => showHelpView());
    settingsResultsEl.append(empty);
  }
}

let settingsFindTimer = null;
settingsFindInput.addEventListener("input", () => {
  clearTimeout(settingsFindTimer);
  settingsFindTimer = setTimeout(runSettingsSearch, 120);
});
settingsFindInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsFindInput.value) {
    event.preventDefault();
    event.stopPropagation();
    settingsFindInput.value = "";
    runSettingsSearch();
  }
});
// Ctrl+F sur la page Parametres : va dans la recherche des reglages.
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && !settingsPanelEl.hidden) {
    event.preventDefault();
    settingsFindInput.focus();
    settingsFindInput.select();
  }
});
cardifySettings(settingsContentEl);

// --- Dossier des jeux sur un autre disque (serie 2, idee 9, version validee) --------------------
// Un seul dossier pour tout (instances, mondes, mods, Java, cache), deplace en entier par le
// launcher : choisir le disque -> confirmer -> copier, verifier, basculer (redemarrage) -> l'ancien
// dossier est efface au demarrage suivant. Voir gamesLocation.js et games:* dans main.js.
var gamesMoveProgress = null;
const GAMES_LOW_FREE = 30 * 1024 ** 3;

function gamesBytes(bytes) {
  return formatTaskBytes(bytes || 0);
}

window.mchub.games.onProgress((payload) => {
  gamesMoveProgress = payload;
  renderActivity();
  if (gamesMoveModal?.isOpen()) renderGamesMoveProgress();
});

async function fillGamesFolderCard() {
  const info = await window.mchub.games.info();
  const pathEl = document.getElementById("games-folder-path");
  if (!pathEl) return;
  pathEl.textContent = info.base;
  const warn = document.getElementById("games-folder-warn");
  if (info.missingRoot && warn) {
    warn.hidden = false;
    warn.textContent = t("games.missing", { path: info.missingRoot, drive: info.drive });
  }
  const size = await window.mchub.games.size();
  const sizeEl = document.getElementById("games-folder-size");
  if (sizeEl) sizeEl.textContent = t("games.sizeOn", { size: gamesBytes(size.bytes), drive: info.drive });
}

function gamesDiskHtml(disk, needBytes, selected) {
  const tooSmall = !disk.current && disk.free < needBytes + 300 * 1024 ** 2;
  const blocked = disk.current || tooSmall || disk.type === "network";
  const usedPct = disk.total ? Math.round(((disk.total - disk.free) / disk.total) * 100) : 0;
  const badge = disk.current
    ? `<span class="games-badge">${escapeHtml(t("games.current"))}</span>`
    : tooSmall
      ? `<span class="games-badge warn">${escapeHtml(t("games.tooSmall"))}</span>`
      : disk.type === "network"
        ? `<span class="games-badge warn">${escapeHtml(t("games.network"))}</span>`
        : disk.type === "removable"
          ? `<span class="games-badge warn">${escapeHtml(t("games.usb"))}</span>`
          : disk.best
            ? `<span class="games-badge ok">${escapeHtml(t("games.best"))}</span>`
            : "";
  const name = disk.label ? `${disk.label} (${disk.drive})` : disk.drive;
  return `<button type="button" class="games-disk${selected ? " on" : ""}" data-drive="${escapeHtml(disk.drive)}" ${blocked ? "disabled" : ""}>
      <span class="games-disk-ico">${escapeHtml(disk.drive)}</span>
      <span class="games-disk-col"><b>${escapeHtml(name)}</b><span class="games-cap"><i style="width:${usedPct}%"></i></span><small>${escapeHtml(t("games.free", { free: gamesBytes(disk.free), total: gamesBytes(disk.total) }))}</small></span>
      ${badge}
    </button>`;
}

let gamesMoveModal = null;
let gamesMoveRequest = null;

// Etape 1 : choisir le disque.
async function openGamesMove({ firstRun = false } = {}) {
  const busy = gamesMoveProgress && gamesMoveProgress.stage !== "switched";
  if (busy && gamesMoveModal?.isOpen()) return;
  const info = await window.mchub.games.info();
  if (info.interrupted) return showGamesInterrupted(info.interrupted);
  const modal = openToolsModal({
    title: t(firstRun ? "games.wizTitle" : "games.pickTitle"),
    bodyHtml: `<p class="first-install-note" style="margin:0">${escapeHtml(t("common.checking"))}</p>`,
    actions: [{ label: t(firstRun ? "games.keepHere" : "activity.cancel"), value: "cancel" }],
    wide: false,
  });
  gamesMoveModal = modal;
  const [size, drives] = await Promise.all([window.mchub.games.size(), window.mchub.games.drives()]);
  if (!modal.isOpen()) return;
  const candidates = drives.filter((d) => !d.current && d.type !== "network" && d.free >= size.bytes + 300 * 1024 ** 2);
  const best = candidates.filter((d) => d.type !== "removable").sort((a, b) => b.free - a.free)[0];
  drives.forEach((d) => (d.best = best && d.drive === best.drive));
  let chosen = best?.drive || candidates[0]?.drive || null;
  const render = () => {
    modal.bodyEl.innerHTML = `
      <p class="first-install-note" style="margin:0">${escapeHtml(firstRun ? t("games.wizBody") : t("games.pickBody", { size: gamesBytes(size.bytes) }))}</p>
      <div class="games-disks">${drives.map((d) => gamesDiskHtml(d, size.bytes, d.drive === chosen)).join("")}</div>
      ${candidates.length ? "" : `<p class="games-folder-warn">${escapeHtml(t("games.noOther"))}</p>`}`;
    modal.bodyEl.querySelectorAll(".games-disk:not([disabled])").forEach((btn) =>
      btn.addEventListener("click", () => {
        chosen = btn.dataset.drive;
        render();
      }),
    );
    modal.setActions([
      { label: t(firstRun ? "games.keepHere" : "activity.cancel"), value: "cancel" },
      { label: t("games.next"), cls: "join-btn", value: "next" },
    ]);
    const nextBtn = modal.bodyEl.parentElement.querySelector("#instance-tools-actions .join-btn");
    if (nextBtn) nextBtn.disabled = !chosen;
  };
  render();
  const result = await modal.done;
  if (result !== "next" || !chosen) return false;
  return confirmGamesMove(drives.find((d) => d.drive === chosen), size, info);
}

// Etape 2 : confirmer (d'ou vers ou, taille, place restante, ce qui part, ce qui reste).
async function confirmGamesMove(disk, size, info) {
  let deleteOld = true;
  const after = Math.max(0, disk.free - size.bytes);
  const modal = openToolsModal({
    title: t("games.confirmTitle", { drive: disk.drive }),
    bodyHtml: `
      <div class="games-ft">
        <div><small>${escapeHtml(t("games.from"))}</small><b>${escapeHtml(info.drive)}</b><span class="games-mono">${escapeHtml(info.base)}</span></div>
        <span aria-hidden="true">→</span>
        <div><small>${escapeHtml(t("games.to"))}</small><b>${escapeHtml(disk.drive)}</b><span class="games-mono">${escapeHtml(disk.target)}</span></div>
      </div>
      <div class="games-line"><span>${escapeHtml(t("games.toMove"))}</span><b>${escapeHtml(gamesBytes(size.bytes))}</b></div>
      <span class="games-muted">${escapeHtml(t("games.after", { free: gamesBytes(after), drive: disk.drive }))}</span>
      <ul class="games-list">${["what1", "what2", "what3", "what4"].map((k) => `<li>${escapeHtml(t(`games.${k}`))}</li>`).join("")}</ul>
      <span class="games-muted">${escapeHtml(t("games.stays", { drive: gamesDriveOfUserData(info) }))}</span>
      <label class="games-check"><input type="checkbox" id="games-delete-old" checked /> ${escapeHtml(t("games.deleteOld"))}</label>
      <span class="games-hint">${escapeHtml(t("games.closeHint"))}</span>`,
    actions: [
      { label: t("activity.cancel"), value: "cancel" },
      { label: t("games.move"), cls: "join-btn", value: "move" },
    ],
  });
  modal.bodyEl.querySelector("#games-delete-old").addEventListener("change", (event) => (deleteOld = event.target.checked));
  const result = await modal.done;
  if (result !== "move") return false;
  return runGamesMove({ drive: disk.drive, deleteOld });
}

function gamesDriveOfUserData(info) {
  return info.isDefault ? info.drive : "C:";
}

const GAMES_STEPS = ["copy", "verify", "switch", "delete"];

function renderGamesMoveProgress() {
  if (!gamesMoveModal?.isOpen()) return;
  const p = gamesMoveProgress || { stage: "scan", doneBytes: 0, totalBytes: 0 };
  const idx = { scan: 0, copy: 0, verify: 1, switched: 3 }[p.stage] ?? 0;
  const percent = p.totalBytes ? Math.min(100, Math.floor((p.doneBytes / p.totalBytes) * 100)) : 0;
  let html = `
    <div class="games-line"><b>${p.stage === "scan" ? escapeHtml(t("games.scanning")) : `${escapeHtml(gamesBytes(p.doneBytes))} / ${escapeHtml(gamesBytes(p.totalBytes))}`}</b><span class="games-muted">${percent} %</span></div>
    <div class="games-bar"><i style="width:${p.stage === "scan" ? 3 : percent}%"></i></div>
    <span class="games-muted">${escapeHtml(t("games.currentFile"))}</span>
    <span class="games-mono">${escapeHtml(p.file || "—")}</span>
    <div class="games-steps">${GAMES_STEPS.map((step, i) => `<div class="games-step ${i < idx ? "done" : i === idx ? "cur" : ""}"><span class="n">${i < idx ? "✓" : i + 1}</span>${escapeHtml(t(`games.step_${step}`))}${step === "delete" && gamesMoveRequest && !gamesMoveRequest.deleteOld ? " (—)" : ""}</div>`).join("")}</div>`;
  gamesMoveModal.bodyEl.innerHTML = html;
}

// Etape 3 : deplacement, puis bascule et redemarrage.
async function runGamesMove({ drive, deleteOld, resume = false }) {
  gamesMoveRequest = { drive, deleteOld, resume };
  gamesMoveProgress = { stage: "scan", doneBytes: 0, totalBytes: 0, drive };
  renderActivity();
  const modal = openToolsModal({
    title: t("games.movingTitle", { drive }),
    bodyHtml: "",
    actions: [{ label: t("games.safeCancel"), value: "cancel-move" }],
  });
  gamesMoveModal = modal;
  renderGamesMoveProgress();
  // « Annuler (sans risque) » arrete le deplacement tant que la bascule n'est pas faite. Fermer la
  // fenetre autrement (Echap, clic a cote) la cache seulement : la pilule montre la suite.
  modal.done.then((value) => {
    if (value === "cancel-move" && gamesMoveProgress && gamesMoveProgress.stage !== "switched") window.mchub.games.cancelMove();
  });
  const result = await window.mchub.games.move({ drive, deleteOld, resume });
  gamesMoveProgress = null;
  renderActivity();
  if (result?.ok) {
    const done = openToolsModal({
      title: t("games.switchedTitle", { drive: result.drive }),
      bodyHtml: `<div class="games-ok"><b>✓ ${escapeHtml(t("games.switchedBody", { drive: result.drive }))}</b><span class="games-mono">${escapeHtml(result.to)}</span><span class="games-muted">${escapeHtml(t(deleteOld ? "games.switchedDelete" : "games.switchedKeep"))}</span></div>`,
      actions: [{ label: t("games.restartNow"), cls: "join-btn", value: "restart" }],
    });
    // Le launcher doit redemarrer pour utiliser le nouveau dossier : il le fait de lui-meme.
    const timer = setTimeout(() => done.close("restart"), 6000);
    await done.done;
    clearTimeout(timer);
    window.mchub.games.restart();
    return true;
  }
  if (modal.isOpen()) modal.close("result");
  showGamesMoveError(result || { code: "failed" }, { drive, deleteOld });
  return false;
}

function showGamesMoveError(result, request) {
  const code = result.code;
  if (code === "cancelled") {
    openToolsModal({
      title: t("games.cancelledTitle"),
      bodyHtml: `<p class="first-install-note" style="margin:0">${escapeHtml(t("games.cancelledBody", { drive: request.drive }))}</p>`,
      actions: [{ label: t("games.ok"), cls: "join-btn", value: "ok" }],
    });
    return;
  }
  const texts = {
    noSpace: [t("games.eSpaceTitle", { drive: request.drive }), t("games.eSpaceBody", { need: gamesBytes(result.needBytes), free: gamesBytes(result.freeBytes), drive: request.drive })],
    gameRunning: [t("games.eGameTitle"), t("games.eGameBody")],
    installing: [t("games.eInstallTitle"), t("games.eInstallBody")],
    targetLost: [t("games.eLostTitle", { drive: request.drive }), t("games.eLostBody")],
    targetNotEmpty: [t("games.eNotEmptyTitle"), t("games.eNotEmptyBody", { path: result.target || "" })],
    sameDrive: [t("games.eSameTitle"), t("games.eSameBody")],
  }[code] || [t("games.eFailTitle"), `${t("games.eFailBody")}${result.error ? `\n${result.error}` : ""}`];
  const actions =
    code === "noSpace" || code === "targetNotEmpty" || code === "sameDrive"
      ? [
          { label: t("activity.cancel"), value: "cancel" },
          { label: t("games.otherDrive"), cls: "join-btn", value: "pick" },
        ]
      : code === "gameRunning"
        ? [
            { label: t("games.later"), value: "cancel" },
            { label: t("games.stopGame"), cls: "join-btn", value: "stop" },
          ]
        : code === "installing"
          ? [{ label: t("games.ok"), cls: "join-btn", value: "cancel" }]
          : [
              { label: t("games.keepCurrent"), value: "abandon" },
              { label: t("activity.retry"), cls: "join-btn", value: "retry" },
            ];
  const modal = openToolsModal({
    title: texts[0],
    bodyHtml: `<p class="first-install-note" style="margin:0;white-space:pre-line">${escapeHtml(texts[1])}</p>`,
    actions,
    tone: "danger",
  });
  modal.done.then(async (value) => {
    if (value === "pick") openGamesMove();
    else if (value === "stop") askStopFromPill();
    else if (value === "retry") runGamesMove({ ...request, resume: true });
    else if (value === "abandon") {
      await window.mchub.games.abandonInterrupted();
      toolsToast(t("games.keptToast"));
    }
  });
}

// Deplacement interrompu (launcher ferme pendant la copie, coupure de courant).
function showGamesInterrupted(interrupted) {
  const modal = openToolsModal({
    title: t("games.eCrashTitle"),
    bodyHtml: `<p class="first-install-note" style="margin:0">${escapeHtml(t("games.eCrashBody", { copied: gamesBytes(interrupted.copiedBytes), drive: interrupted.toDrive }))}</p>`,
    actions: [
      { label: t("games.eCrashCancel"), value: "abandon" },
      { label: t("games.eCrashResume"), cls: "join-btn", value: "resume" },
    ],
  });
  modal.done.then(async (value) => {
    if (value === "resume") runGamesMove({ drive: interrupted.toDrive, deleteOld: true, resume: true });
    else if (value === "abandon") {
      await window.mchub.games.abandonInterrupted();
      toolsToast(t("games.keptToast"));
    }
  });
}

// Premier lancement : proposer un autre disque seulement si celui des jeux a peu de place
// (moins de 30 Go) et qu'un autre disque local en a nettement plus.
async function maybeAskGamesDrive() {
  try {
    const info = await window.mchub.games.info();
    if (!info.isDefault || info.interrupted) return false;
    const drives = await window.mchub.games.drives();
    const current = drives.find((d) => d.current);
    if (!current || current.free >= GAMES_LOW_FREE) return false;
    if (!drives.some((d) => !d.current && d.type === "local" && d.free > current.free + 20 * 1024 ** 3)) return false;
    return await openGamesMove({ firstRun: true });
  } catch {
    return false;
  }
}

// Au demarrage : fin d'un deplacement, ou deplacement interrompu a reprendre.
setTimeout(async () => {
  const info = await window.mchub.games.info().catch(() => null);
  if (!info) return;
  if (info.justMoved) {
    window.mchub.games.ackMoved();
    openToolsModal({
      title: t("games.doneHeading"),
      bodyHtml: `<div class="games-ok"><b>✓ ${escapeHtml(t("games.doneTitle", { drive: info.justMoved.drive }))}</b><span class="games-muted">${escapeHtml(info.justMoved.freedBytes ? t("games.doneFreed", { size: gamesBytes(info.justMoved.freedBytes), drive: info.justMoved.fromDrive }) : t("games.doneKept", { drive: info.justMoved.fromDrive }))}</span><span class="games-mono">${escapeHtml(info.justMoved.to)}</span></div>`,
      actions: [{ label: t("games.ok"), cls: "join-btn", value: "ok" }],
    });
  } else if (info.interrupted) {
    showGamesInterrupted(info.interrupted);
  }
}, 1800);

// Coin du logo (variante D) : la barre laterale n'existe que quand #app est affiche (pas sur
// l'ecran de demarrage ni sur la connexion) ; sinon le logo garde son nom.
{
  const appBox = document.getElementById("app");
  const syncSidebarPresence = () => document.body.classList.toggle("has-sidebar", !appBox.hidden);
  new MutationObserver(syncSidebarPresence).observe(appBox, { attributes: true, attributeFilter: ["hidden"] });
  syncSidebarPresence();
}

// --- Fiche serveur : bouton qui dit l'action + pastille d'etat (audit 17/10, lot 3) ------------
// Reglage en attente de Rushi : false = complet / hors ligne -> bouton grise qui dit pourquoi ;
// true = bouton actif « Essayer quand meme ».
const JOIN_TRY_ANYWAY = true;

function detailJoinAction(server, { installed }) {
  const state = serverBandState(server);
  if (state === "full" || state === "off") {
    if (JOIN_TRY_ANYWAY) return { kind: "join", label: "serverDetail.tryAnyway" };
    return { kind: "blocked", label: state === "full" ? "serverDetail.btnFull" : "serverDetail.btnOffline", blocked: true };
  }
  if (server.type === "modded" && !installed) return { kind: "install", label: "serverDetail.btnInstall" };
  if (!signedIn) return { kind: "signin", label: "serverDetail.btnSignIn" };
  return { kind: "join", label: "serverDetail.btnPlay" };
}

// Meme mot et meme couleur que la table des etats (lot 2) : « En ligne · 34 / 40 »,
// « Presque plein », « Complet », « Hors ligne », « Inconnu ».
function serverStatePillHtml(server) {
  const state = serverBandState(server);
  const text = {
    ok: `${t("serverCard.onlineWord")} · ${playersText(server)}`,
    busy: `${t("serverCard.busy")} · ${playersText(server)}`,
    full: `${t("serverCard.full")} · ${playersText(server)}`,
    off: t("serverCard.offline"),
    unknown: t("serverCard.unknown"),
  }[state];
  const dot = state === "unknown" ? '<span class="status-dot unknown"></span>' : `<span class="status-dot" style="background:${BAND_COLORS[state]}"></span>`;
  return `<span class="detail-state detail-state-${state}">${dot}${escapeHtml(text)}</span>`;
}

// Rapport du test (lot 5, preview v3) : mods a ajouter a la main, avec ce que vivront les joueurs.
// Jamais « les joueurs ne pourront pas jouer » : le launcher les guide pas a pas.
function selfTestReportHtml(manualList, rescuedList) {
  if (!manualList.length) return "";
  const items = manualList
    .map(
      (mod) => `<li><b>${escapeHtml(mod.modName || mod.fileName || "?")}</b><span class="selftest-tag">${escapeHtml(t("selfTest.notOnModrinth"))}</span>${
        mod.pageUrl ? `<button type="button" class="link-btn" data-mod-page="${escapeHtml(mod.pageUrl)}">${escapeHtml(t("selfTest.curseforgePage"))}</button>` : ""
      }</li>`,
    )
    .join("");
  const rescued = rescuedList.length
    ? `<details><summary>${escapeHtml(t("selfTest.rescuedTitle", { count: rescuedList.length }))}</summary><ul class="selftest-mods">${rescuedList
        .map((name) => `<li><b>${escapeHtml(name)}</b><span class="selftest-tag ok">Modrinth ✓</span></li>`)
        .join("")}</ul></details>`
    : "";
  return `<div class="selftest-box">
      <h4>${escapeHtml(t("selfTest.manualTitle", { count: manualList.length }))}</h4>
      <p>${escapeHtml(t("selfTest.manualBody"))}</p>
      <ul class="selftest-mods">${items}</ul>
      ${rescued}
      <p>${escapeHtml(t("selfTest.manualTodo"))}</p>
    </div>`;
}

document.getElementById("selftest-report")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-mod-page]");
  if (btn) window.mchub.openModPage(btn.dataset.modPage);
});

// Badge bleu « X mods à ajouter » (lot 5) : fiche et lignes de liste. Jamais rouge, et le bouton
// principal reste « Installer ».
function manualModsBadgeHtml(server) {
  const count = Number(server?.manualModsCount) || 0;
  if (count <= 0) return "";
  return `<span class="manual-mods-badge" title="${escapeHtml(t("manualMods.badgeTip", { count }))}">ⓘ ${escapeHtml(t("manualMods.badge", { count }))}</span>`;
}

// --- « Qui peut m'ajouter en ami » (variante C validee par Rushi le 18/10) --------------------------
// Meme carte en haut de la page Amis et dans Parametres > Confidentialite : changer l'un change
// l'autre (le reglage vit sur le site). Par defaut « Seulement avec mon code ». En mode discret,
// le code d'ami est cache (« ••• ••• » + œil), comme les adresses.
let friendCodeRevealed = false;

async function renderFriendPolicyCard(slot, { where }) {
  if (!slot) return;
  if (!signedIn) {
    slot.innerHTML = "";
    return;
  }
  const settings = await window.mchub.friends.getSettings().catch(() => null);
  // Site plus ancien (pas encore cette API) : pas de carte plutot qu'une carte cassee.
  if (!settings?.ok) {
    slot.innerHTML = where === "settings" || where === "pop" ? `<p class="friend-policy-note">${escapeHtml(t("friends.policyUnavailable"))}</p>` : "";
    if (where === "friends") renderFriendCodeLine(null);
    return;
  }
  const policy = settings.friendPolicy;
  // Le site renvoie le code sans tiret (« K7Q9XM ») : affiche « K7Q-9XM », plus facile a dicter.
  const rawCode = String(settings.friendCode || "").replace(/-/g, "");
  const code = rawCode.length === 6 ? `${rawCode.slice(0, 3)}-${rawCode.slice(3)}` : rawCode;
  const shownCode = discreetMode && !friendCodeRevealed ? "••• •••" : code;
  const opt = (value, recommended) => `
    <label class="friend-policy-opt">
      <input type="radio" name="friend-policy-${where}" value="${value}" ${policy === value ? "checked" : ""} />
      <span><b>${escapeHtml(t(`friends.policy_${value}`))}</b>${recommended ? `<span class="friend-policy-rec">${escapeHtml(t("friends.recommended"))}</span>` : ""}<small>${escapeHtml(t(`friends.policy_${value}D`))}</small></span>
    </label>`;
  // Page Amis (preview de l'engrenage, 18/10) : plus de carte au milieu, seulement le rappel
  // « Personne » et la ligne du code sous le champ d'ajout. Le reglage s'ouvre par l'engrenage.
  if (where === "friends") {
    slot.innerHTML = policy === "none" ? `<div class="friend-policy-banner"><span>${escapeHtml(t("friends.noneBanner"))}</span><button type="button" class="link-btn" data-friend-policy-open>${escapeHtml(t("friends.change"))}</button></div>` : "";
    slot.querySelector("[data-friend-policy-open]")?.addEventListener("click", () => openFriendsGear());
    renderFriendCodeLine(policy === "code" ? code : null);
    return;
  }
  slot.innerHTML = `
    <div class="friend-policy">
      ${where === "pop" ? `<div class="friend-policy-head"><h3>${escapeHtml(t("friends.policyQ"))}</h3><button type="button" class="friend-policy-close" data-friend-policy-close aria-label="${escapeHtml(t("common.close"))}">✕</button></div>` : `<h3>${escapeHtml(t("friends.policyQ"))}</h3>`}
      <div class="friend-policy-opts" role="radiogroup" aria-label="${escapeHtml(t("friends.policyQ"))}">${opt("all")}${opt("code", true)}${opt("none")}</div>
      ${
        policy === "code" && code
          ? `<div class="friend-code-row">
              <span class="settings-row-label">${escapeHtml(t("friends.myCode"))}</span>
              <span class="friend-code">${escapeHtml(shownCode)}</span>
              ${discreetMode ? `<button type="button" class="icon-btn" data-friend-code-eye title="${escapeHtml(t("friends.showCode"))}" aria-label="${escapeHtml(t("friends.showCode"))}">👁</button>` : ""}
              <button type="button" class="btn-secondary" data-friend-code-copy>${escapeHtml(t("friends.copy"))}</button>
              <button type="button" class="btn-secondary" data-friend-code-new>${escapeHtml(t("friends.newCode"))}</button>
            </div>
            <p class="friend-policy-note">${escapeHtml(t("friends.newCodeD"))}</p>`
          : ""
      }
      ${where === "settings" ? `<p class="friend-policy-note">${escapeHtml(t("friends.alsoOnFriends"))}</p>` : ""}
      ${where === "pop" ? `<p class="friend-policy-note">${escapeHtml(t("friends.alsoIn"))} <button type="button" class="link-btn" data-friend-policy-settings>${escapeHtml(t("friends.alsoInLink"))}</button></p>` : ""}
    </div>`;
  slot.querySelector("[data-friend-policy-close]")?.addEventListener("click", () => closeFriendsGear());
  slot.querySelector("[data-friend-policy-settings]")?.addEventListener("click", () => {
    closeFriendsGear();
    openSettingsTab("privacy");
  });
  slot.querySelectorAll(`input[name="friend-policy-${where}"]`).forEach((input) =>
    input.addEventListener("change", async () => {
      const result = await window.mchub.friends.setPolicy(input.value);
      toolsToast(result?.ok ? t("friends.saved") : t("friends.actionError"));
      renderFriendPolicyCard(slot, { where });
      // Le bandeau et la ligne du code de la page Amis suivent le changement fait dans l'engrenage.
      if (where === "pop") renderFriendPolicyCard(document.getElementById("friends-policy-slot"), { where: "friends" });
    }),
  );
  slot.querySelector("[data-friend-code-eye]")?.addEventListener("click", () => {
    friendCodeRevealed = !friendCodeRevealed;
    renderFriendPolicyCard(slot, { where });
  });
  slot.querySelector("[data-friend-code-copy]")?.addEventListener("click", async (event) => {
    try {
      await navigator.clipboard.writeText(code);
      event.target.textContent = t("friends.copied");
    } catch {
      /* presse-papiers indisponible */
    }
  });
  slot.querySelector("[data-friend-code-new]")?.addEventListener("click", async () => {
    const { confirmed } = await showModal({ tone: "warn", title: t("friends.newCodeTitle"), body: t("friends.newCodeD"), confirmLabel: t("friends.newCode"), cancelLabel: t("common.cancel") });
    if (!confirmed) return;
    const result = await window.mchub.friends.newCode();
    toolsToast(result?.ok ? t("friends.saved") : t("friends.actionError"));
    renderFriendPolicyCard(slot, { where });
  });
}

// Ligne « Ton code d'ami : K7Q-9XM · Copier » sous le champ d'ajout (cache en mode discret).
function renderFriendCodeLine(code) {
  const line = document.getElementById("friends-mycode");
  if (!line) return;
  line.hidden = !code;
  if (!code) return;
  const shown = discreetMode && !friendCodeRevealed ? "••• •••" : code;
  line.innerHTML = `${escapeHtml(t("friends.yourCode"))} <code>${escapeHtml(shown)}</code>${discreetMode ? `<button type="button" class="link-btn" data-code-eye>${escapeHtml(t("friends.showCode"))}</button>` : ""}<button type="button" class="link-btn" data-code-copy>${escapeHtml(t("friends.copy"))}</button>`;
  line.querySelector("[data-code-eye]")?.addEventListener("click", () => {
    friendCodeRevealed = !friendCodeRevealed;
    renderFriendCodeLine(code);
  });
  line.querySelector("[data-code-copy]")?.addEventListener("click", async (event) => {
    try {
      await navigator.clipboard.writeText(code);
      event.target.textContent = t("friends.copied");
    } catch {
      /* presse-papiers indisponible */
    }
  });
}

// Engrenage de la page Amis : ouvre/ferme le panneau du reglage (croix, Echap, clic a cote).
function openFriendsGear() {
  const pop = document.getElementById("friends-policy-pop");
  const gear = document.getElementById("friends-gear");
  if (!pop || !gear) return;
  pop.hidden = false;
  gear.setAttribute("aria-expanded", "true");
  renderFriendPolicyCard(pop, { where: "pop" }).then(() => pop.querySelector("input:checked")?.focus());
}
function closeFriendsGear() {
  const pop = document.getElementById("friends-policy-pop");
  const gear = document.getElementById("friends-gear");
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  gear?.setAttribute("aria-expanded", "false");
  gear?.focus();
}
document.getElementById("friends-gear")?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (document.getElementById("friends-policy-pop").hidden) openFriendsGear();
  else closeFriendsGear();
});
document.addEventListener("click", (event) => {
  const pop = document.getElementById("friends-policy-pop");
  if (pop && !pop.hidden && !pop.contains(event.target) && !document.body.classList.contains("modal-blocking")) closeFriendsGear();
});
document.addEventListener("keydown", (event) => {
  const pop = document.getElementById("friends-policy-pop");
  if (event.key === "Escape" && pop && !pop.hidden && !document.body.classList.contains("modal-blocking")) {
    event.stopPropagation();
    closeFriendsGear();
  }
});

// Parametres > Confidentialite : pour l'instant ce seul reglage (le Mode discret reste dans
// Apparence, son deplacement est un autre sujet).
function renderPrivacyTab(contentEl) {
  contentEl.innerHTML = `
    <section class="settings-section">
      <h3 class="settings-section-title">${escapeHtml(t("friends.policyQ"))}</h3>
      <div class="settings-wide-slot" id="settings-friend-policy-${contentEl.id || "search"}"></div>
    </section>`;
  const slot = contentEl.querySelector(".settings-wide-slot");
  renderFriendPolicyCard(slot, { where: "settings" });
}

// --- Menus « … » (option C, 18/10) : fermeture commune ---------------------------------------
function closeInstanceMenus() {
  document.querySelectorAll(".instance-menu:not([hidden])").forEach((menu) => {
    menu.hidden = true;
    menu.parentElement.querySelector("[aria-expanded]")?.setAttribute("aria-expanded", "false");
  });
}
document.addEventListener("click", (event) => {
  if (!event.target.closest?.(".instance-more")) closeInstanceMenus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.querySelector(".instance-menu:not([hidden])")) {
    event.stopPropagation();
    closeInstanceMenus();
  }
}, true);
