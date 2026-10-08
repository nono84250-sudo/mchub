// Remplit les écrans de la maquette avec les vraies données, sans toucher au style.
// Ce qui n'existe pas encore dans le projet est entouré d'un contour pointillé
// (classe "nb", voir nocturne.css / DesignScreen) pour qu'on le voie tout de suite.
import { SCREENS } from "./screens";
import type { ReportSummary, ReportStatus } from "@/lib/reports";

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const fmt = (n: number) => n.toLocaleString("en-US");

// Fin de l'élément <div> ou <section> qui commence à `start` (appariement des balises).
export function balancedEnd(html: string, start: number, tag: "div" | "section"): number {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let depth = 0;
  let i = start;
  for (;;) {
    const o = html.indexOf(open, i);
    const c = html.indexOf(close, i);
    if (c < 0) return -1;
    if (o >= 0 && o < c) {
      depth++;
      i = o + open.length;
    } else {
      depth--;
      i = c + close.length;
      if (depth === 0) return i;
    }
  }
}

// Entoure l'élément qui contient le texte `heading` d'un contour "non branché" (kind "nb",
// rouge) ou "proposition" (kind "pr", jaune — ce qu'on propose de coder ensuite, a valider
// avant de brancher les vraies donnees).
export function markSectionNotBuilt(html: string, heading: string, kind: "nb" | "pr" = "nb"): string {
  const at = html.indexOf(heading);
  if (at < 0) return html;
  const start = html.lastIndexOf("<section", at);
  const end = balancedEnd(html, start, "section");
  if (start < 0 || end < 0) return html;
  const label = kind === "pr" ? `<div class="pr-block"><span class="pr-tag">Proposition</span>` : `<div class="nb-block"><span class="nb-tag">Non branché</span>`;
  return html.slice(0, start) + `${label}${html.slice(start, end)}</div>` + html.slice(end);
}

// Met en surbrillance un libellé qui n'est pas encore branché (kind "nb", rouge) ou que l'on
// propose de brancher ensuite (kind "pr", jaune).
export function markLabel(html: string, label: string, kind: "nb" | "pr" = "nb"): string {
  const cls = kind === "pr" ? "pr" : "nb";
  return html.split(`>${label}<`).join(`><span class="${cls}">${label}</span><`);
}

export function replaceOnce(html: string, from: string, to: string): string {
  const at = html.indexOf(from);
  if (at < 0) return html;
  return html.slice(0, at) + to + html.slice(at + from.length);
}

export function overviewHtml(data: {
  servers: number;
  openReports: number;
  olderThan24h: number;
  attention: { title: string; subtitle: string }[];
}): string {
  let html = SCREENS.overview;
  html = replaceOnce(html, "letter-spacing:-.01em;\">1,246</div>", `letter-spacing:-.01em;">${fmt(data.servers)}</div>`);
  html = replaceOnce(html, "letter-spacing:-.01em;\">12</div>", `letter-spacing:-.01em;">${fmt(data.openReports)}</div>`);
  html = replaceOnce(html, "4 older than 24 h", `${fmt(data.olderThan24h)} older than 24 h`);
  html = replaceOnce(html, "+38 this month", `<span class="nb">+38 this month</span>`);
  html = markLabel(html, "Total downloads");
  html = replaceOnce(html, "letter-spacing:-.01em;\">184,320</div>", `letter-spacing:-.01em;"><span class="nb">184,320</span></div>`);
  html = markLabel(html, "Players online now");
  html = replaceOnce(html, "letter-spacing:-.01em;\">3,482</div>", `letter-spacing:-.01em;"><span class="nb">3,482</span></div>`);
  const samples: [string, string][] = [
    ["Hate speech in server description", "Aetherfall · reported by 6 players 2 h ago"],
    ["Player harassment in chat", "Deepslate Anarchy · reported by Nyx_ 5 h ago"],
    ["Server using an unlicensed modpack", "Emberforge · flagged automatically 1 d ago"],
  ];
  samples.forEach(([title, subtitle], i) => {
    const item = data.attention[i];
    html = replaceOnce(html, title, item ? escapeHtml(item.title) : "—");
    html = replaceOnce(html, subtitle, item ? escapeHtml(item.subtitle) : "—");
  });
  html = markSectionNotBuilt(html, "Downloads per month");
  html = markSectionNotBuilt(html, "Downloads by OS");
  html = markSectionNotBuilt(html, "Players online by OS");
  return html;
}

// Table des serveurs : une ligne de la maquette sert de modèle, remplie pour chaque serveur.
const CHIP = "display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;margin:0 4px 4px 0;";

// Statut explicite : publié ou masqué de l'annuaire, et privé si la fiche est privée.
// Les deux se cumulent. « Gelé » viendra quand le gel existera (voir la proposition).
function statusChips(s: { published: boolean; isPrivate: boolean; frozen: boolean }): string {
  const listed = s.frozen
    ? `<span style="${CHIP}background:color-mix(in srgb, #8ac3e0 16%, transparent);color:#8ac3e0;">Gelé</span>`
    : s.published
    ? `<span style="${CHIP}background:color-mix(in srgb, #5fd3a0 16%, transparent);color:#5fd3a0;">Publié</span>`
    : `<span style="${CHIP}background:color-mix(in srgb, var(--color-text) 10%, transparent);color:var(--muted);">Masqué</span>`;
  const priv = s.isPrivate ? `<span style="${CHIP}background:color-mix(in srgb, var(--color-accent) 18%, transparent);color:var(--color-accent-100);">Privé</span>` : "";
  return listed + priv;
}

// « Hors ligne » quand le dernier ping a échoué ; « — » tant qu'aucun ping n'a eu lieu.
function onlineText(s: { players: number | null; capacity: number; pinged: boolean }): string {
  if (s.players !== null) return `${s.players} / ${s.capacity}`;
  return s.pinged ? "Hors ligne" : "—";
}

export type ServerFilters ={ q: string; status: "all" | "live" | "hidden" | "private" | "frozen"; type: "all" | "vanilla" | "modded"; page: number };

const BUTTON =
  "border:1px solid var(--color-divider);color:var(--color-text);background:transparent;padding:6px 12px;border-radius:var(--radius-md);font:500 12.5px var(--font-heading);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;flex-shrink:0;";

// Barre de recherche et filtres : un formulaire GET, sans JavaScript (l'URL porte les filtres).
function filterBarHtml(f: ServerFilters): string {
  const select = (name: string, value: string, options: [string, string][], extra = "") =>
    `<select name="${name}" class="input" style="width:auto;height:36px;min-width:150px;">${options
      .map(([v, label]) => `<option value="${v}"${v === value ? " selected" : ""}>${label}</option>`)
      .join("")}${extra}</select>`;
  return (
    `<form method="get" action="/admin/servers" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">` +
    `<input class="input" name="q" value="${escapeHtml(f.q)}" placeholder="Search servers, owners, addresses…" style="width:auto;height:36px;flex:1;min-width:260px;max-width:420px;">` +
    select("status", f.status, [["all", "Statut : tous"], ["live", "Publiés"], ["hidden", "Masqués"], ["private", "Privés"], ["frozen", "Gelés"]]) +
    select("type", f.type, [["all", "Type: All"], ["vanilla", "Vanilla"], ["modded", "Modded"]]) +
    `<button type="submit" style="${BUTTON}height:36px;">Apply</button></form>`
  );
}

// Pagination : liens Previous / Next qui gardent les filtres.
function pagerHtml(f: ServerFilters, from: number, to: number, total: number, pageCount: number): string {
  const href = (page: number) => `/admin/servers?${new URLSearchParams({ q: f.q, status: f.status, type: f.type, page: String(page) })}`;
  const button = (label: string, page: number, enabled: boolean) =>
    enabled
      ? `<a href="${escapeHtml(href(page))}" style="${BUTTON}text-decoration:none;">${label}</a>`
      : `<span style="${BUTTON}opacity:.4;">${label}</span>`;
  return (
    `<div style="display:flex;align-items:center;gap:10px;padding:4px 14px;font-size:12.5px;color:var(--muted);">` +
    `<span>Showing ${from}–${to} of ${fmt(total)}</span>` +
    `<div style="margin-left:auto;display:flex;gap:6px;">${button("Previous", f.page - 1, f.page > 1)}${button("Next", f.page + 1, f.page < pageCount)}</div></div>`
  );
}

export function serversHtml(data: {
  filters: ServerFilters;
  totalAll: number;
  total: number;
  from: number;
  to: number;
  pageCount: number;
  rows: { name: string; slug: string; address: string; owner: string; ownerId: string; type: string; published: boolean; isPrivate: boolean; frozen: boolean; pinged: boolean; players: number | null; capacity: number; openReports: number }[];
}): string {
  let html = SCREENS.servers;
  const rowStart = `<div style="display:grid;min-width:860px;`;
  const starts: number[] = [];
  for (let at = html.indexOf(rowStart); at >= 0; at = html.indexOf(rowStart, at + 1)) starts.push(at);
  const rows = starts.map((start) => ({ start, end: balancedEnd(html, start, "div") }));
  const dataRows = rows.filter((r) => !html.slice(r.start, r.end).includes("Open reports"));
  if (dataRows.length === 0) return html;
  const template = html.slice(dataRows[0].start, dataRows[0].end);

  const built = data.rows.map((s) => {
    let row = template;
    row = replaceOnce(row, 'font-weight:600;">A</span>', `font-weight:600;">${escapeHtml(s.name.charAt(0).toUpperCase())}</span>`);
    row = replaceOnce(row, ">Aetherfall</span>", `><a href="/admin/servers/${escapeHtml(s.slug)}" style="color:inherit;text-decoration:none;">${escapeHtml(s.name)}</a></span>`);
    row = replaceOnce(row, ">play.aetherfall.gg</span>", `>${escapeHtml(s.address)}</span>`);
    row = replaceOnce(row, '<a href="#" style="white-space:nowrap;">Kaelthorn</a>', `<a href="/admin/players/${escapeHtml(s.ownerId)}" style="white-space:nowrap;">${escapeHtml(s.owner)}</a>`);
    row = replaceOnce(row, ">Modded</span>", `>${escapeHtml(s.type === "modded" ? "Modded" : "Vanilla")}</span>`);
    row = row.replace(/<span style="display:inline-flex[^>]*>Frozen<\/span>/, statusChips(s));
    row = replaceOnce(row, ">0 / 150</span>", `>${onlineText(s)}</span>`);
    row = row.replace(/<span style="display:inline-flex[^>]*>(<i class="ph ph-flag"[^>]*><\/i>)6<\/span>/, s.openReports > 0 ? `<span style="display:inline-flex[^>]*>$1${s.openReports}</span>` : `<span style="color:var(--muted);">—</span>`);
    row = row.replace(/<i class="ph ph-dots-three"[^>]*><\/i>/, "");
    // Toute la ligne ouvre la fiche : lien placé par-dessus la ligne (le texte reste sélectionnable).
    row = row.replace(`<div style="display:grid;min-width:860px;`, `<div class="srv-row" style="position:relative;display:grid;min-width:860px;`);
    row = row.replace(/<div style="[^"]*"><\/div>(?=<a class="srv-cover")/, "");
    row = row.slice(0, -6) + `<a class="srv-cover" style="position:absolute;inset:0;border-radius:6px;" href="/admin/servers/${escapeHtml(s.slug)}" aria-label="Ouvrir la fiche de ${escapeHtml(s.name)}"></a></div>`;
    return row;
  });

  // Reconstruit le tableau : lignes de données remplacées, en-tête et reste inchangés.
  const firstData = dataRows[0].start;
  const lastData = dataRows[dataRows.length - 1].end;
  html = html.slice(0, firstData) + built.join("") + html.slice(lastData);
  html = replaceOnce(html, '<div style="overflow-x:auto;">', '<div class="srv-table">');
  // Colonnes : plus de colonne « ... » ; Online et Open reports sont centrées.
  html = html.split("grid-template-columns:minmax(0,2.2fr) minmax(0,1.2fr) 100px 110px 90px 120px 40px").join("grid-template-columns:minmax(0,2.4fr) minmax(0,1.4fr) 110px 170px 130px 140px");
  html = replaceOnce(html, "<span>Open reports</span><span></span>", "<span>Open reports</span>");
  html = replaceOnce(html, '<div style="display:grid;min-width:860px;', '<div class="srv-head" style="display:grid;min-width:860px;');

  // Barre de filtres et pagination remplacées par les vraies commandes.
  const barStart = html.indexOf('<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">');
  const barEnd = html.indexOf("<section", barStart);
  html = html.slice(0, barStart) + filterBarHtml(data.filters) + "\n          " + html.slice(barEnd);
  const pagerStart = html.indexOf('<div style="display:flex;align-items:center;gap:10px;padding:4px 14px;font-size:12.5px;color:var(--muted);">');
  const pagerEnd = html.indexOf("</section>", pagerStart);
  html = html.slice(0, pagerStart) + pagerHtml(data.filters, data.from, data.to, data.total, data.pageCount) + html.slice(pagerEnd);

  html = replaceOnce(html, "1,246 servers", `${fmt(data.totalAll)} servers`);
  return html;
}

export type PlayerFilters = { q: string; page: number };

// Liste des joueurs : aucune maquette n'existe pour cet ecran (seule la fiche d'un joueur,
// "player-detail", existe) — on reprend donc son habillage (menu avec Players actif, barre du
// haut), et on construit la liste a la main, dans le meme style que serversHtml.
export function playersHtml(data: {
  filters: PlayerFilters;
  totalAll: number;
  total: number;
  from: number;
  to: number;
  pageCount: number;
  rows: { id: string; name: string; minecraftUuid: string | null; createdAt: string; serverCount: number }[];
}): string {
  const chrome = SCREENS["player-detail"];
  const mainStart = chrome.indexOf("<main");
  let html = chrome.slice(0, mainStart);
  html = replaceOnce(html, ">Players / Kaelthorn</span>", ">Players</span>");

  const filterBar =
    `<form method="get" action="/admin/players" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">` +
    `<input class="input" name="q" value="${escapeHtml(data.filters.q)}" placeholder="Search players…" style="width:auto;height:36px;flex:1;min-width:260px;max-width:420px;">` +
    `<button type="submit" style="${BUTTON}height:36px;">Apply</button></form>` +
    `<span style="margin-left:auto;font-size:12.5px;color:var(--muted);">${fmt(data.totalAll)} players</span>`;

  const rowHtml = (p: (typeof data.rows)[number]) => {
    const initial = escapeHtml(p.name.charAt(0).toUpperCase());
    const joined = new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    const uuid = p.minecraftUuid ? `<span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.minecraftUuid.slice(0, 8))}…</span>` : "";
    return (
      `<div class="srv-row" style="position:relative;display:grid;min-width:640px;grid-template-columns:minmax(0,2.4fr) 170px 110px 40px;gap:14px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--color-divider);font-size:13px;">` +
      `<div style="min-width:0;"><div style="display:flex;align-items:center;gap:12px;min-width:0;">` +
      `<span style="width:34px;height:34px;flex-shrink:0;border-radius:8px;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;">${initial}</span>` +
      `<div style="display:flex;flex-direction:column;gap:2px;min-width:0;"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.name)}</span>${uuid}</div>` +
      `</div></div>` +
      `<div style="min-width:0;"><span style="color:var(--muted);white-space:nowrap;">${joined}</span></div>` +
      `<div style="min-width:0;"><span style="color:var(--muted);white-space:nowrap;">${fmt(p.serverCount)}</span></div>` +
      `<div style="min-width:0;"><a class="srv-cover" href="/admin/players/${escapeHtml(p.id)}" aria-label="Ouvrir la fiche de ${escapeHtml(p.name)}"></a></div>` +
      `</div>`
    );
  };

  const table =
    `<section style="display:flex;flex-direction:column;gap:16px;padding:12px 8px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-width:0;">` +
    `<div class="srv-table"><div class="srv-head" style="display:grid;min-width:640px;grid-template-columns:minmax(0,2.4fr) 170px 110px 40px;gap:14px;padding:0 14px 10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted2);border-bottom:1px solid var(--color-divider);"><span>Joueur</span><span>Inscription</span><span>Serveurs</span><span></span></div>` +
    (data.rows.length ? data.rows.map(rowHtml).join("") : `<p style="margin:0;padding:14px;font-size:13px;color:var(--muted);">Aucun joueur ne correspond.</p>`) +
    `</div>` +
    pagerHtml2("/admin/players", data.filters, data.from, data.to, data.total, data.pageCount) +
    `</section>`;

  return (
    html +
    `<main style="flex:1;min-width:0;padding:28px 32px 40px;display:flex;flex-direction:column;gap:22px;">` +
    `<div style="display:flex;flex-direction:column;gap:4px;min-width:0;"><h1 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:24px;letter-spacing:-.01em;">Players</h1><p style="margin:0;font-size:13.5px;color:var(--muted);">Tous les comptes joueurs de l'annuaire.</p></div>` +
    `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">${filterBar}</div>` +
    table +
    `</main></div></div>`
  );
}

// Pagination generique (q + page), pour playersHtml.
function pagerHtml2(action: string, f: PlayerFilters, from: number, to: number, total: number, pageCount: number): string {
  const href = (page: number) => `${action}?${new URLSearchParams({ q: f.q, page: String(page) })}`;
  const button = (label: string, page: number, enabled: boolean) =>
    enabled
      ? `<a href="${escapeHtml(href(page))}" style="${BUTTON}text-decoration:none;">${label}</a>`
      : `<span style="${BUTTON}opacity:.4;">${label}</span>`;
  return (
    `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px 4px;font-size:12.5px;color:var(--muted);">` +
    `<span>Showing ${from}–${to} of ${fmt(total)}</span>` +
    `<div style="margin-left:auto;display:flex;gap:6px;">${button("Previous", f.page - 1, f.page > 1)}${button("Next", f.page + 1, f.page < pageCount)}</div></div>`
  );
}

// Fiche d'un joueur : pas encore branchee sur les vraies donnees (prochaine etape), mais
// classee ici element par element — jaune (pr) pour ce qui est facilement faisable avec ce
// qui existe deja, rouge (nb) pour ce qui demanderait un systeme qui n'existe pas du tout
// (avertissements, abonnements, gel/verrouillage de compte, IP, notes de moderation...).
export type PlayerServerRow = { name: string; slug: string; address: string; published: boolean; isPrivate: boolean; frozen: boolean; openReports: number };

export function playerDetailHtml(data: {
  id: string;
  name: string;
  minecraftUuid: string | null;
  createdAt: string;
  serversTotal: number;
  serversFrozen: number;
  serversShown: PlayerServerRow[];
  serversOpen: boolean;
  serversPage: number;
  serversPageCount: number;
  serversFrom: number;
  serversTo: number;
  reportsTotal: number;
  reportsOpen: number;
}): string {
  let html = SCREENS["player-detail"];

  // Fil d'ariane : lien reel.
  html = replaceOnce(
    html,
    '<span style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;"><i class="ph ph-arrow-left" style="font-size:13px;"></i>Back to Aetherfall</span>',
    '<a href="/admin/players" style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;text-decoration:none;"><i class="ph ph-arrow-left" style="font-size:13px;"></i>Retour aux joueurs</a>',
  );

  // Avatar + nom reels.
  html = replaceOnce(html, 'font-size:24px;font-weight:600;">K</span>', `font-size:24px;font-weight:600;">${escapeHtml(data.name.charAt(0).toUpperCase())}</span>`);
  html = replaceOnce(html, ">Kaelthorn</h1>", `>${escapeHtml(data.name)}</h1>`);
  html = replaceOnce(html, "Players / Kaelthorn", `Players / ${escapeHtml(data.name)}`);

  // Badges : "Active" n'a pas d'equivalent (aucun statut de compte) ; "Server owner" ne
  // s'affiche que si le compte possede reellement au moins un serveur.
  html = markLabel(html, "Active", "nb");
  if (data.serversTotal === 0) html = replaceOnce(html, '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:var(--color-accent-800);color:var(--color-accent-100);">Server owner</span>', "");

  // Ligne d'identite : pas d'email (connexion Microsoft uniquement, jamais stocke) ; "Last
  // seen" retire aussi, rien ne le suit — mieux vaut l'omettre qu'afficher une fausse heure.
  const joined = new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  html = replaceOnce(
    html,
    '<span style="font-size:13px;color:var(--muted);">kael.thorn@mail.com · Microsoft linked · Joined Jan 12, 2026 · Last seen 2 h ago</span>',
    `<span style="font-size:13px;color:var(--muted);">Lié à Microsoft · Inscrit le ${joined}</span>`,
  );

  // Boutons d'action : Message est reel. Les trois autres n'ont aucun systeme derriere.
  html = replaceOnce(html, '<button style="border:1px solid var(--color-divider);color:var(--color-text);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;flex-shrink:0;"><i class="ph ph-chat-circle" style="font-size:14.5px;"></i>Message</button>', playerMessageHtml({ id: data.id, name: data.name }));
  html = markLabel(html, "Add warning", "nb");
  html = markLabel(html, "Freeze account", "nb");
  html = markLabel(html, "Lock account", "nb");

  // Pastilles chiffrees.
  html = markLabel(html, "Warnings", "nb"); // tuile + section partagent ce libelle, pas construit
  html = replaceOnce(html, 'letter-spacing:-.01em;">2</div><div style="font-size:12px;color:var(--danger)">Last on Sep 21</div>', 'letter-spacing:-.01em;"><span class="nb">2</span></div><div style="font-size:12px;color:var(--danger)"><span class="nb">Last on Sep 21</span></div>');
  html = replaceOnce(
    html,
    'letter-spacing:-.01em;">2</div><div style="font-size:12px;color:var(--muted)">1 frozen</div>',
    `letter-spacing:-.01em;">${fmt(data.serversTotal)}</div><div style="font-size:12px;color:var(--muted)">${data.serversFrozen > 0 ? `${fmt(data.serversFrozen)} gelé(s)` : "Aucun gelé"}</div>`,
  );
  html = markLabel(html, "Subscription", "nb"); // laisse affiche en rouge : pas d'abonnements pour l'instant (site gratuit)
  html = replaceOnce(html, 'letter-spacing:-.01em;">Pro</div><div style="font-size:12px;color:var(--muted)">Monthly · renews Oct 12</div>', 'letter-spacing:-.01em;"><span class="nb">Pro</span></div><div style="font-size:12px;color:var(--muted)"><span class="nb">Monthly · renews Oct 12</span></div>');
  // "Reports against" -> en realite "signalements sur ses serveurs" (rien ne modelise un
  // signalement contre le joueur lui-meme dans ce projet).
  html = replaceOnce(
    html,
    'letter-spacing:-.01em;">9</div><div style="font-size:12px;color:var(--muted)">7 on his servers</div>',
    `letter-spacing:-.01em;">${fmt(data.reportsTotal)}</div><div style="font-size:12px;color:var(--muted)">${fmt(data.reportsOpen)} ouvert(s)</div>`,
  );

  // Section "Servers owned" : liste courte (3) par defaut, avec une fleche pour voir tout
  // (pagination 5 par 5 une fois ouvert) — sans ca, un compte avec beaucoup de serveurs
  // prendrait toute la page.
  html = replaceSectionBody(html, ">Servers owned</h2>", playerServersSectionHtml(data));

  html = markSectionNotBuilt(html, ">Warnings</h2>", "nb");
  html = markSectionNotBuilt(html, ">Subscription</h2>", "nb");

  // Compte : l'UUID est reel. Last IP et 2FA sont retires (jamais suivi, et le site n'a pas de
  // 2FA — Microsoft gere deja l'authentification). Launcher (version/OS) reste a construire.
  html = replaceOnce(
    html,
    'text-align:right;min-width:0;"><span style="font:12px ui-monospace,Menlo,monospace;">8f2c…a91e</span>',
    `text-align:right;min-width:0;"><span style="font:12px ui-monospace,Menlo,monospace;">${data.minecraftUuid ? escapeHtml(data.minecraftUuid) : "—"}</span>`,
  );
  html = replaceOnce(html, '<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:var(--muted);white-space:nowrap;">Last IP</span><span style="text-align:right;min-width:0;">83.12.•••.•• · France</span></div>', "");
  html = replaceOnce(html, '<span style="color:var(--muted);white-space:nowrap;">Launcher</span><span style="text-align:right;min-width:0;">1.4.2 · Windows</span>', '<span style="color:var(--muted);white-space:nowrap;">Launcher</span><span style="text-align:right;min-width:0;"><span class="nb">1.4.2 · Windows</span></span>');
  html = replaceOnce(html, '<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:var(--muted);white-space:nowrap;">2FA</span><span style="text-align:right;min-width:0;">Off</span></div>', "");

  html = markSectionNotBuilt(html, "Staff notes", "nb");

  return html;
}

// Liste des serveurs possedes : 3 affiches par defaut, lien pour tout voir (pagination 5 par 5).
function playerServersSectionHtml(data: {
  id: string;
  serversTotal: number;
  serversShown: PlayerServerRow[];
  serversOpen: boolean;
  serversPage: number;
  serversPageCount: number;
  serversFrom: number;
  serversTo: number;
}): string {
  const row = (s: PlayerServerRow) => {
    const status = s.frozen
      ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:color-mix(in srgb, #8ac3e0 16%, transparent);color:#8ac3e0;">Gelé</span>`
      : s.published
        ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:color-mix(in srgb, var(--success) 14%, transparent);color:var(--success);">Publié</span>`
        : `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:var(--raised);color:var(--muted);border:1px solid var(--color-divider);">Masqué</span>`;
    const flag = s.openReports > 0 ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:color-mix(in srgb, var(--danger) 16%, transparent);color:var(--danger);"><i class="ph ph-flag" style="font-size:11px;"></i>${s.openReports}</span>` : "";
    return (
      `<div style="position:relative;display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--color-divider);">` +
      `<span style="width:34px;height:34px;flex-shrink:0;border-radius:8px;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;">${escapeHtml(s.name.charAt(0).toUpperCase())}</span>` +
      `<div style="display:flex;flex-direction:column;gap:2px;min-width:0;"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.name)}</span><span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.address)}</span></div>` +
      `<span style="margin-left:auto;display:flex;gap:8px;">${flag}${status}</span>` +
      `<i class="ph ph-caret-right" style="font-size:14px;color:var(--muted)"></i>` +
      `<a class="srv-cover" href="/admin/servers/${escapeHtml(s.slug)}" aria-label="Ouvrir la fiche de ${escapeHtml(s.name)}"></a>` +
      `</div>`
    );
  };

  const list = data.serversShown.length
    ? `<div>${data.serversShown.map(row).join("")}</div>`
    : `<p style="margin:0;font-size:13px;color:var(--muted);">Ce compte ne possède aucun serveur.</p>`;

  if (!data.serversOpen) {
    const more = data.serversTotal > data.serversShown.length
      ? `<a href="/admin/players/${escapeHtml(data.id)}?serversOpen=1" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 0 0;font-size:12.5px;color:var(--muted);text-decoration:none;">Voir tout (${fmt(data.serversTotal)})<i class="ph ph-caret-down" style="font-size:12px;"></i></a>`
      : "";
    return list + more;
  }

  const hrefPage = (page: number) => `/admin/players/${escapeHtml(data.id)}?serversOpen=1&serversPage=${page}`;
  const pager =
    `<div style="display:flex;align-items:center;gap:10px;padding:10px 0 0;font-size:12.5px;color:var(--muted);">` +
    `<span>${data.serversFrom}–${data.serversTo} sur ${fmt(data.serversTotal)}</span>` +
    `<div style="margin-left:auto;display:flex;gap:6px;">` +
    (data.serversPage > 1 ? `<a href="${hrefPage(data.serversPage - 1)}" style="${BUTTON}text-decoration:none;">Previous</a>` : `<span style="${BUTTON}opacity:.4;">Previous</span>`) +
    (data.serversPage < data.serversPageCount ? `<a href="${hrefPage(data.serversPage + 1)}" style="${BUTTON}text-decoration:none;">Next</a>` : `<span style="${BUTTON}opacity:.4;">Next</span>`) +
    `</div></div>`;
  const less = `<a href="/admin/players/${escapeHtml(data.id)}" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:4px 0 0;font-size:12.5px;color:var(--muted);text-decoration:none;">Réduire<i class="ph ph-caret-up" style="font-size:12px;"></i></a>`;
  return list + pager + less;
}

// Pop-up « Message » depuis la fiche joueur : pas de type "Gel" ici (rien ne gele un compte
// joueur aujourd'hui), contrairement au message depuis une fiche serveur.
function playerMessageHtml(data: { id: string; name: string }): string {
  const COLORS = `{info:'#9184d9',warning:'#e8c547',error:'#e5484d'}`;
  const field = "display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted);";
  const locked = "display:flex;align-items:center;height:36px;padding:0 10px;background:var(--color-bg);border:1px solid var(--color-divider);border-radius:var(--radius-md);font-size:13.5px;color:var(--color-text);";
  return (
    `<button type="button" popovertarget="player-message-${escapeHtml(data.id)}" style="${TOP_BUTTON}"><i class="ph ph-chat-circle" style="font-size:14.5px;"></i>Message</button>` +
    `<div id="player-message-${escapeHtml(data.id)}" popover style="position:fixed;inset:0;margin:auto;height:fit-content;width:460px;max-width:calc(100vw - 32px);padding:0;border-radius:var(--radius-lg);background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);overflow:hidden;">` +
    `<div data-stripe style="height:4px;background:#9184d9;"></div>` +
    `<form method="post" action="/api/admin/players/${escapeHtml(data.id)}/message" style="display:flex;flex-direction:column;gap:14px;padding:22px 24px;">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">Message à ${escapeHtml(data.name)}</h2>` +
    `<label style="${field}">Type de message<select name="kind" class="input" style="height:36px;" onchange="this.form.querySelector('[data-stripe]').style.background=${COLORS}[this.value]"><option value="info">Information</option><option value="warning">Avertissement</option><option value="error">Erreur</option></select></label>` +
    `<div style="${field}">Destinataire<span style="${locked}">${escapeHtml(data.name)}</span></div>` +
    `<label style="${field}">Message<textarea class="input" name="text" required minlength="3" maxlength="1000" style="min-height:110px;font-size:13.5px;"></textarea></label>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
    `<button type="button" popovertarget="player-message-${escapeHtml(data.id)}" popovertargetaction="hide" style="${CANCEL}">Annuler</button>` +
    `<button type="submit" style="${CONFIRM}">Envoyer</button></div>` +
    `</form></div>`
  );
}

// Composer de message diffuse — portee reduite par rapport a la maquette (voir la route
// /api/admin/notifications/send) : un seul canal reel (boite de reception du launcher), deux
// audiences (Tout le monde, Proprietaires de serveur — "Un joueur" existe deja depuis la fiche
// joueur, pas la peine de le dupliquer ici), envoi immediat, pas de brouillon ni de
// programmation.
export function notificationsHtml(data: { sentCount: number | null; activeBanner: { type: string; text: string } | null }): string {
  let html = SCREENS.notifications;
  html = replaceOnce(html, ">Notifications / New message</span>", ">Notifications</span>");

  const sentBanner = data.sentCount !== null
    ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--success);background:color-mix(in srgb, var(--success) 10%, transparent);color:var(--success);font-size:13px;"><i class="ph ph-check-circle" style="font-size:16px;"></i>Message envoyé à ${fmt(data.sentCount)} compte(s).</div>`
    : "";
  const activeBannerNotice = data.activeBanner
    ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-bg);font-size:13px;">` +
      `<i class="ph ph-browser" style="font-size:16px;color:var(--muted)"></i><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Bannière active : ${escapeHtml(data.activeBanner.text)}</span>` +
      `<form method="post" action="/api/admin/notifications/banner/clear"><button type="submit" style="${BUTTON}">Retirer</button></form></div>`
    : "";

  const field = "display:flex;flex-direction:column;gap:6px;min-width:0;";
  const label = "font-size:12px;color:var(--muted)";
  const body =
    sentBanner +
    activeBannerNotice +
    `<form method="post" action="/api/admin/notifications/send" style="display:flex;flex-direction:column;gap:16px;">` +
    `<label style="${field}"><span style="${label}">Type</span><select name="type" class="input" style="height:36px;" required>` +
    `<option value="announcement">Annonce</option><option value="maintenance">Maintenance</option><option value="alert">Alerte</option><option value="promotion">Promotion</option></select></label>` +
    `<label style="${field}"><span style="${label}">Audience</span><select name="audience" class="input" style="height:36px;" required>` +
    `<option value="everyone">Tout le monde</option><option value="owners">Propriétaires de serveur</option></select></label>` +
    `<label style="${field}"><span style="${label}">Système concerné (si Maintenance)</span><select name="system" class="input" style="height:36px;">` +
    `<option value="">—</option><option value="Site">Site</option><option value="Launcher">Launcher</option><option value="Connexion Minecraft">Connexion Minecraft</option><option value="CurseForge">CurseForge</option><option value="Modrinth">Modrinth</option><option value="Tout">Tout</option></select></label>` +
    `<label style="${field}"><span style="${label}">Message</span><textarea class="input" name="text" required minlength="3" maxlength="1000" style="min-height:110px;font-size:13.5px;"></textarea></label>` +
    `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-bg);font-size:13px;"><input type="checkbox" name="banner" style="accent-color:var(--color-accent);width:16px;height:16px;margin:0;">Aussi afficher en bannière sur le site (remplace la bannière active)</label>` +
    `<div style="display:flex;justify-content:flex-end;"><button type="submit" style="${CONFIRM}">Envoyer</button></div>` +
    `</form>`;

  html = replaceSectionBody(html, ">Compose</h2>", body);
  html = markSectionNotBuilt(html, ">Launcher preview</h2>", "nb");
  html = markSectionNotBuilt(html, ">Recent</h2>", "nb");
  return html;
}

const TOP_BUTTON =
  "border:1px solid var(--color-divider);color:var(--color-text);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;flex-shrink:0;text-decoration:none;";

// Pop-up « Message au propriétaire » (native, sans script : popover). Depuis la fiche, le serveur
// est fixe ; si le serveur est gelé, le type est fixe aussi (Gel). Sinon le type se choisit.
function ownerMessageHtml(data: { id: string; slug: string; name: string; frozen: boolean }): string {
  const COLORS = `{info:'#9184d9',warning:'#e8c547',error:'#e5484d'}`;
  const field = "display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted);";
  const locked = "display:flex;align-items:center;height:36px;padding:0 10px;background:var(--color-bg);border:1px solid var(--color-divider);border-radius:var(--radius-md);font-size:13.5px;color:var(--color-text);";
  const typeField = data.frozen
    ? `<input type="hidden" name="kind" value="gel"><div style="${field}">Type de message<span style="${locked}">Gel</span></div>`
    : `<label style="${field}">Type de message<select name="kind" class="input" style="height:36px;" onchange="this.form.querySelector('[data-stripe]').style.background=${COLORS}[this.value]"><option value="info">Information</option><option value="warning">Avertissement</option><option value="error">Erreur</option></select></label>`;
  const stripe = data.frozen ? "#8ac3e0" : "#9184d9";
  return (
    `<button type="button" popovertarget="owner-message-${escapeHtml(data.id)}" style="${TOP_BUTTON}">Message au propriétaire</button>` +
    `<div id="owner-message-${escapeHtml(data.id)}" popover style="position:fixed;inset:0;margin:auto;height:fit-content;width:460px;max-width:calc(100vw - 32px);padding:0;border-radius:var(--radius-lg);background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);overflow:hidden;">` +
    `<div data-stripe style="height:4px;background:${stripe};"></div>` +
    `<form method="post" action="/api/admin/servers/${escapeHtml(data.id)}/message" style="display:flex;flex-direction:column;gap:14px;padding:22px 24px;">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">Message au propriétaire</h2>` +
    typeField +
    `<div style="${field}">Serveur concerné<span style="${locked}">${escapeHtml(data.name)}</span></div>` +
    `<label style="${field}">Message<textarea class="input" name="text" required minlength="3" maxlength="1000" style="min-height:110px;font-size:13.5px;"></textarea></label>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
    `<button type="button" popovertarget="owner-message-${escapeHtml(data.id)}" popovertargetaction="hide" style="${CANCEL}">Annuler</button>` +
    `<button type="submit" style="${CONFIRM}">Envoyer</button></div>` +
    `</form></div>`
  );
}

// Fiche d'un serveur : nom, badges, bandeau de gel réel et une seule barre d'actions (en haut à droite).
// Le reste des sections de la maquette reste marqué « Non branché » tant qu'il n'est pas codé.
export function serverDetailHtml(data: {
  id: string;
  slug: string;
  name: string;
  owner: string;
  type: string;
  published: boolean;
  isPrivate: boolean;
  frozenAt: string | null;
  frozenReason: string | null;
  frozenBy: string | null;
  ip: string;
  minecraftVersion: string;
  modpackName: string | null;
  modpackVersion: string | null;
  createdAt: string;
  launchCount: number;
  reports: ReportSummary[];
  ownerId: string;
}): string {
  const frozen = data.frozenAt !== null;
  let html = SCREENS["server-detail"];
  html = replaceOnce(html, ">Aetherfall</h1>", `>${escapeHtml(data.name)}</h1>`);
  html = replaceOnce(html, "Servers / Aetherfall", `Servers / ${escapeHtml(data.name)}`);
  html = html.replace(/<span style="display:inline-flex[^>]*>(<i class="ph ph-snowflake"[^>]*><\/i>)?Frozen<\/span>/, statusChips({ ...data, frozen }));
  html = replaceOnce(html, ">Modded</span>", data.type === "modded" ? ">Modded</span>" : ">Vanilla</span>");

  // En-tête : adresse, version Minecraft, modpack (nom et version), propriétaire du compte.
  const modpack = data.modpackName
    ? `<span>Modpack : ${escapeHtml(data.modpackName)}${data.modpackVersion ? " " + escapeHtml(data.modpackVersion) : ""}</span><span>·</span>`
    : "";
  html = replaceOnce(html, "<span>play.aetherfall.gg · 1.20.1 Forge</span><span>·</span>", `<span>${escapeHtml(data.ip)} · ${escapeHtml(data.minecraftVersion)}</span><span>·</span>${modpack}`);
  // Propriétaire du serveur (compte qui l'a créé) : nom et initiale réels, pas encore cliquable.
  html = replaceOnce(
    html,
    'href="#" style="display:inline-flex;align-items:center;gap:6px;padding:2px 8px 2px 3px;border-radius:999px;border:1px solid var(--color-accent-700);font-size:12.5px;"><span style="width:18px;height:18px;flex-shrink:0;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:600;">K</span>Kaelthorn <i',
    `href="/admin/players/${escapeHtml(data.ownerId)}" style="display:inline-flex;align-items:center;gap:6px;padding:2px 8px 2px 3px;border-radius:999px;border:1px solid var(--color-accent-700);font-size:12.5px;"><span style="width:18px;height:18px;flex-shrink:0;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:600;">${escapeHtml(data.owner.charAt(0).toUpperCase())}</span>${escapeHtml(data.owner)} <i`,
  );

  // Bandeau de gel : celui de la maquette, rempli avec le vrai gel. Retiré si le serveur n'est pas gelé.
  const bannerStart = html.indexOf('<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;');
  if (bannerStart >= 0) {
    const bannerEnd = balancedEnd(html, bannerStart, "div");
    const by = escapeHtml(data.frozenBy ?? "—");
    const when = data.frozenAt ? escapeHtml(new Date(data.frozenAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })) : "";
    const banner =
      `<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border-radius:var(--radius-md);border:1px solid color-mix(in srgb, #8ac3e0 35%, transparent);background:color-mix(in srgb, #8ac3e0 7%, transparent);">` +
      `<i class="ph ph-snowflake" style="font-size:18px;color:#8ac3e0;margin-top:1px"></i>` +
      `<div style="display:flex;flex-direction:column;gap:3px;font-size:13px;"><span style="font-weight:500;">Gelé par ${by} · ${when}</span>` +
      `<span style="color:var(--muted);line-height:1.5;">Masqué de l'annuaire et de la recherche. Les connexions sont bloquées dans le launcher, y compris depuis les favoris et raccourcis. Motif : ${escapeHtml(data.frozenReason ?? "")}</span></div></div>`;
    html = html.slice(0, bannerStart) + (frozen ? banner : "") + html.slice(bannerEnd);
  }

  // Une seule barre d'actions, en haut à droite. Les boutons de la maquette en double sont retirés.
  const barStart = html.indexOf('<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">');
  if (barStart >= 0) {
    const barEnd = balancedEnd(html, barStart, "div");
    const freeze = frozen
      ? unfreezeHtml({ id: data.id, name: data.name })
      : `<a href="/admin/servers/${escapeHtml(data.slug)}/geler" style="${TOP_BUTTON}color:#8ac3e0;border-color:#8ac3e0;">Geler le serveur</a>`;
    const newBar =
      `<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">` +
      `<a href="/servers/${escapeHtml(data.slug)}" style="${TOP_BUTTON}">Voir la fiche publique</a>` +
      freeze +
      ownerMessageHtml({ id: data.id, slug: data.slug, name: data.name, frozen }) +
      `<span class="nb" style="${TOP_BUTTON}">Transfert de propriété</span>` +
      `<a href="/admin/servers/${escapeHtml(data.slug)}/supprimer" style="${TOP_BUTTON}color:var(--danger);border-color:var(--danger);">Supprimer le serveur</a>` +
      `</div>`;
    html = html.slice(0, barStart) + newBar + html.slice(barEnd);
  }
  // Published content et Moderation history restent non branches (rouge) : le second demande un
  // vrai journal de moderation, pas encore construit ; le premier fait doublon avec l'edition
  // cote proprietaire.
  html = markSectionNotBuilt(html, "Published content", "nb");
  html = markSectionNotBuilt(html, "Moderation history", "nb");
  html = replaceReportsSection(html, data.reports);
  html = replaceStatsSection(html, { createdAt: data.createdAt, launchCount: data.launchCount });
  return html;
}

// Remplace le corps d'une section (tout ce qui suit son en-tete "titre + actions") par `body`,
// en gardant l'en-tete et l'habillage <section> de la maquette tels quels.
function replaceSectionBody(html: string, heading: string, body: string): string {
  const at = html.indexOf(heading);
  if (at < 0) return html;
  const sectionStart = html.lastIndexOf("<section", at);
  const sectionEnd = balancedEnd(html, sectionStart, "section");
  const headerStart = html.indexOf('<div style="display:flex;align-items:center;gap:12px;min-height:28px;', sectionStart);
  const headerEnd = balancedEnd(html, headerStart, "div");
  if (sectionStart < 0 || sectionEnd < 0 || headerStart < 0 || headerEnd < 0) return html;
  return html.slice(0, headerEnd) + body + "</section>" + html.slice(sectionEnd);
}

const REPORT_ISSUE_LABELS: Record<ReportSummary["issue"], string> = {
  cant_connect: "Impossible de se connecter",
  wrong_version: "Mauvaise version",
  modpack_download: "Le modpack ne se télécharge pas",
  crash: "Plantage au lancement",
  other: "Autre",
};

const REPORT_STATUS_STYLE: Record<ReportStatus, { label: string; bg: string; color: string }> = {
  new: { label: "Nouveau", bg: "color-mix(in srgb, var(--danger) 16%, transparent)", color: "var(--danger)" },
  replied: { label: "Répondu", bg: "color-mix(in srgb, var(--color-accent) 20%, transparent)", color: "var(--color-accent-100)" },
  resolved: { label: "Résolu", bg: "var(--raised)", color: "var(--muted)" },
};

function reportRowHtml(report: ReportSummary): string {
  const status = REPORT_STATUS_STYLE[report.status];
  const date = new Date(report.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const subtitle = `${escapeHtml(report.message.slice(0, 80))} · ${escapeHtml(report.reporterMinecraftUsername)}`;
  return (
    `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--color-divider);">` +
    `<div style="display:flex;flex-direction:column;gap:2px;min-width:0;">` +
    `<span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(REPORT_ISSUE_LABELS[report.issue])}</span>` +
    `<span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subtitle}</span>` +
    `</div>` +
    `<span style="margin-left:auto;font-size:12px;color:var(--muted2);white-space:nowrap;">${date}</span>` +
    `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:${status.bg};color:${status.color};">${status.label}</span>` +
    `</div>`
  );
}

function replaceReportsSection(html: string, reports: ReportSummary[]): string {
  const body = reports.length
    ? `<div>${reports.slice(0, 5).map(reportRowHtml).join("")}</div>`
    : `<p style="margin:0;font-size:13px;color:var(--muted);">Aucun signalement pour ce serveur.</p>`;
  return replaceSectionBody(html, "Reports on this server", body);
}

// Created et Launcher joins viennent de vraies colonnes (createdAt, launchCount). Players (30 d)
// et Peak online ne sont pas suivis (aucun comptage de joueurs dans le temps, voir le commentaire
// sur ServerEvent dans contract.prisma) ; Plan vient des abonnements, pas encore construits —
// les trois gardent leur valeur de maquette, marquee "non branchee".
function replaceStatsSection(html: string, data: { createdAt: string; launchCount: number }): string {
  const created = new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  html = replaceOnce(html, '<span style="text-align:right;min-width:0;">Mar 4, 2026</span>', `<span style="text-align:right;min-width:0;">${created}</span>`);
  html = replaceOnce(html, '<span style="text-align:right;min-width:0;">4,812</span>', `<span style="text-align:right;min-width:0;"><span class="nb">4,812</span></span>`);
  html = replaceOnce(html, '<span style="text-align:right;min-width:0;">150</span>', `<span style="text-align:right;min-width:0;"><span class="nb">150</span></span>`);
  html = replaceOnce(html, '<span style="text-align:right;min-width:0;">12,390</span>', `<span style="text-align:right;min-width:0;">${fmt(data.launchCount)}</span>`);
  html = replaceOnce(html, '<span style="text-align:right;min-width:0;">Pro</span>', `<span style="text-align:right;min-width:0;"><span class="nb">Pro</span></span>`);
  return html;
}

// Bouton « Dégeler » : ouvre une confirmation centrée (pop-up native). La case « message au
// propriétaire » est cochée par défaut ; si elle reste cochée, le propriétaire est prévenu.
function unfreezeHtml(data: { id: string; name: string }): string {
  const id = escapeHtml(data.id);
  return (
    `<button type="button" popovertarget="unfreeze-${id}" style="${TOP_BUTTON}color:#8ac3e0;border-color:#8ac3e0;">Dégeler le serveur</button>` +
    `<div id="unfreeze-${id}" popover style="position:fixed;inset:0;margin:auto;height:fit-content;width:440px;max-width:calc(100vw - 32px);padding:0;border-radius:var(--radius-lg);background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);overflow:hidden;">` +
    `<div style="height:4px;background:#8ac3e0;"></div>` +
    `<form method="post" action="/api/admin/servers/${id}/unfreeze" style="display:flex;flex-direction:column;gap:14px;padding:22px 24px;">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">Dégeler ${escapeHtml(data.name)} ?</h2>` +
    `<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.55;">Le serveur revient dans l'annuaire et les joueurs peuvent à nouveau le rejoindre.</p>` +
    `<label style="display:flex;align-items:center;gap:10px;font-size:13.5px;"><input type="checkbox" name="notify" value="on" checked />Envoyer un message au propriétaire</label>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
    `<button type="button" popovertarget="unfreeze-${id}" popovertargetaction="hide" style="${CANCEL}">Annuler</button>` +
    `<button type="submit" style="${CONFIRM}color:#8ac3e0;border-color:#8ac3e0;">Dégeler le serveur</button></div>` +
    `</form></div>`
  );
}

// Coque du panel (menu et en-tête de la maquette) avec un contenu central.
export function shellHtml(main: string): string {
  const html = SCREENS.servers;
  const start = html.indexOf("<main");
  const open = html.indexOf(">", start) + 1;
  const end = html.indexOf("</main>", open);
  return html.slice(0, open) + main + html.slice(end);
}

// Carte de confirmation (même style que la maquette A06b), pour geler ou supprimer.
function confirmCard(title: string, body: string): string {
  return (
    `<div style="display:flex;justify-content:center;padding:24px 0;">` +
    `<div style="width:460px;max-width:100%;display:flex;flex-direction:column;gap:18px;padding:24px;border-radius:var(--radius-lg);background:var(--color-surface);border:1px solid var(--color-divider);">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">${title}</h2>` +
    body +
    `</div></div>`
  );
}

const CANCEL = "border:1px solid transparent;color:var(--muted);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);cursor:pointer;text-decoration:none;";
const CONFIRM = "border:1px solid var(--color-accent);color:var(--color-accent);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);cursor:pointer;";

export function freezePageHtml(data: { id: string; slug: string; name: string }): string {
  const body =
    `<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.55;">Le serveur est masqué de la liste et de la recherche. Toutes les connexions depuis le launcher sont bloquées, y compris depuis les favoris et raccourcis. Le propriétaire garde accès à son tableau de bord.</p>` +
    `<form method="post" action="/api/admin/servers/${escapeHtml(data.id)}/freeze" style="display:flex;flex-direction:column;gap:14px;">` +
    `<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted);">Motif (visible par l'équipe)` +
    `<textarea class="input" name="reason" required minlength="3" maxlength="500" style="width:100%;min-height:80px;font-size:13.5px;"></textarea></label>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;"><a href="/admin/servers/${escapeHtml(data.slug)}" style="${CANCEL}">Annuler</a>` +
    `<button type="submit" style="${CONFIRM}">Geler le serveur</button></div></form>`;
  return shellHtml(
    `<div style="display:flex;flex-direction:column;gap:6px;padding:28px 32px 40px;"><a href="/admin/servers/${escapeHtml(data.slug)}" style="font-size:13px;color:var(--muted);">← Retour à la fiche</a>` +
      confirmCard(`Geler ${escapeHtml(data.name)} ?`, body) +
      `</div>`,
  );
}

export function deletePageHtml(data: { id: string; slug: string; name: string }): string {
  const body =
    `<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.55;">La suppression est définitive : la fiche, sa configuration et ses données sont effacées.</p>` +
    `<form method="post" action="/api/admin/servers/${escapeHtml(data.id)}/delete" style="display:flex;flex-direction:column;gap:14px;">` +
    `<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted);">Tapez « ${escapeHtml(data.name)} » pour confirmer` +
    `<input class="input" name="confirm" autocomplete="off" style="width:100%;font-size:13.5px;"></label>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;"><a href="/admin/servers/${escapeHtml(data.slug)}" style="${CANCEL}">Annuler</a>` +
    `<button type="submit" style="${CONFIRM}border-color:var(--danger);color:var(--danger);">Supprimer définitivement</button></div></form>`;
  return shellHtml(
    `<div style="display:flex;flex-direction:column;gap:6px;padding:28px 32px 40px;"><a href="/admin/servers/${escapeHtml(data.slug)}" style="font-size:13px;color:var(--muted);">← Retour à la fiche</a>` +
      confirmCard(`Supprimer ${escapeHtml(data.name)} ?`, body) +
      `</div>`,
  );
}

// Met en surbrillance chaque section d une page non encore branchee.
export function markAllSections(html: string, kind: "nb" | "pr" = "nb"): string {
  const label = kind === "pr" ? `<div class="pr-block"><span class="pr-tag">Proposition</span>` : `<div class="nb-block"><span class="nb-tag">Non branché</span>`;
  let out = "";
  let i = 0;
  for (;;) {
    const start = html.indexOf("<section", i);
    if (start < 0) break;
    const end = balancedEnd(html, start, "section");
    if (end < 0) break;
    out += html.slice(i, start) + `${label}${html.slice(start, end)}</div>`;
    i = end;
  }
  return out + html.slice(i);
}
