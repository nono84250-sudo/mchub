// Remplit les écrans de la maquette avec les vraies données, sans toucher au style.
// Ce qui n'existe pas encore dans le projet est entouré d'un contour pointillé
// (classe "nb", voir nocturne.css / DesignScreen) pour qu'on le voie tout de suite.
import { SCREENS } from "./screens";
import type { ReportSummary, ReportStatus, BehaviorReportSummary, BehaviorIssue } from "@/lib/reports";
import type { PendingServerSummary, VerificationDetail, VerificationStatus } from "@/lib/verification";
import type { AppealHistoryEntry } from "@/lib/appeals";
import { formatAdminTime } from "@/lib/timezone";

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const fmt = (n: number) => n.toLocaleString("en-US");

// Fin de l'élément <div>/<section>/<main> qui commence à `start` (appariement des balises).
export function balancedEnd(html: string, start: number, tag: "div" | "section" | "main"): number {
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

// Retire entierement la <section> qui contient `heading` (blocs de la maquette qui n'existent
// pas dans le projet : rien de factice ne doit s'afficher en production, demande de Rushi
// 2026-10-14).
function removeSection(html: string, heading: string): string {
  const at = html.indexOf(heading);
  if (at < 0) return html;
  const start = html.lastIndexOf("<section", at);
  const end = balancedEnd(html, start, "section");
  if (start < 0 || end < 0) return html;
  return html.slice(0, start) + html.slice(end);
}

// Retire la ligne "libelle / valeur" d'une carte de la maquette (ex. "Peak online").
function removeInfoRow(html: string, label: string): string {
  const at = html.indexOf(`white-space:nowrap;">${label}</span>`);
  if (at < 0) return html;
  const start = html.lastIndexOf("<div", at);
  const end = balancedEnd(html, start, "div");
  if (start < 0 || end < 0) return html;
  return html.slice(0, start) + html.slice(end);
}

export function replaceOnce(html: string, from: string, to: string): string {
  const at = html.indexOf(from);
  if (at < 0) return html;
  return html.slice(0, at) + to + html.slice(at + from.length);
}

// Badges de compte du menu lateral ("Vérification" / "Reports") : la maquette (screens.ts,
// jamais modifiee a la main) y code en dur "5" et "12". reportsHtml/verificationHtml ne
// patchaient ca que sur leur propre page — partout ailleurs (News, Administration, Overview...)
// le faux chiffre restait affiche. Applique maintenant une seule fois depuis DesignScreen,
// pour que les deux badges soient corrects sur chaque page admin.
// Convention conservee telle qu'elle existait deja (les deux badges n'avaient pas la meme) :
// Vérification disparait a 0, Reports affiche toujours un chiffre (y compris "0").
export function markNavBadges(html: string, counts: { verificationPending: number; reportsOpen: number }): string {
  html = replaceOnce(
    html,
    '>Vérification</span><span style="font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;background:color-mix(in srgb, var(--color-accent) 20%, transparent);color:var(--color-accent-100);">5</span>',
    counts.verificationPending
      ? `>Vérification</span><span style="font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;background:color-mix(in srgb, var(--color-accent) 20%, transparent);color:var(--color-accent-100);">${fmt(counts.verificationPending)}</span>`
      : ">Vérification</span>",
  );
  return replaceOnce(
    html,
    '>Reports</span><span style="font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;background:color-mix(in srgb, var(--danger) 18%, transparent);color:var(--danger);">12</span>',
    `>Reports</span><span style="font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;background:color-mix(in srgb, var(--danger) 18%, transparent);color:var(--danger);">${fmt(counts.reportsOpen)}</span>`,
  );
}

export function overviewHtml(data: {
  servers: number;
  openReports: number;
  olderThan24h: number;
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
  // 2026-10-10 : le replaceOnce sur le sous-titre echouait toujours en silence (le texte
  // cherche, ex. "Aetherfall · reported by 6 players 2 h ago", n'existe pas tel quel dans le
  // HTML reel, qui separe le texte et l'horodatage dans des elements distincts) — "Needs
  // attention" affichait donc en permanence les 3 incidents fictifs de la maquette. Les
  // boutons "Review"/"All reports" de ce widget n'ont de toute facon pas de onclick/href
  // reel : on le marque "Non branché", comme les 3 graphiques juste en dessous, plutot que
  // d'essayer de corriger un remplacement qui resterait fragile.
  html = markSectionNotBuilt(html, "Needs attention");
  html = markSectionNotBuilt(html, "Downloads per month");
  html = markSectionNotBuilt(html, "Downloads by OS");
  html = markSectionNotBuilt(html, "Players online by OS");
  return html;
}

// Table des serveurs : une ligne de la maquette sert de modèle, remplie pour chaque serveur.
const CHIP = "display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;margin:0 4px 4px 0;";

// Statut explicite : publié ou masqué de l'annuaire, et privé si la fiche est privée.
// Les deux se cumulent. « Gelé » viendra quand le gel existera (voir la proposition).
function statusChips(s: { published: boolean; isPrivate: boolean; frozen: boolean; verificationStatus?: string }): string {
  // En attente/refusé de vérification prime sur "Publié" : un serveur pending n'est pas
  // réellement visible/joignable (voir le filtre dans public-servers.ts), même si le
  // propriétaire a laissé son interrupteur "published" sur oui — l'admin doit le voir ici,
  // pas croire que le serveur est déjà en ligne.
  const listed = s.frozen
    ? `<span style="${CHIP}background:color-mix(in srgb, #8ac3e0 16%, transparent);color:#8ac3e0;">Gelé</span>`
    : s.verificationStatus === "pending"
    ? `<span style="${CHIP}background:color-mix(in srgb, #e0c28a 16%, transparent);color:#e0c28a;">En attente de validation</span>`
    : s.verificationStatus === "rejected"
    ? `<span style="${CHIP}background:color-mix(in srgb, var(--danger) 16%, transparent);color:var(--danger);">Refusé</span>`
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
  rows: { name: string; slug: string; address: string; owner: string; ownerId: string; type: string; published: boolean; isPrivate: boolean; frozen: boolean; verificationStatus: string; pinged: boolean; players: number | null; capacity: number; openReports: number }[];
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
    // 2026-10-10 : le groupe 1 capture tout l'attribut style d'origine (plutot que de le
    // reconstruire en reutilisant "[^>]*" comme texte litteral, ce qui cassait l'attribut).
    row = row.replace(/(<span style="display:inline-flex[^>]*>)(<i class="ph ph-flag"[^>]*><\/i>)6<\/span>/, s.openReports > 0 ? `$1$2${s.openReports}</span>` : `<span style="color:var(--muted);">—</span>`);
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

// Fiche d'un joueur : tout ce qui reste affiche vient de vraies donnees. Les blocs de la
// maquette sans equivalent dans le projet (abonnement, paiement, version du launcher, IP,
// 2FA) sont retires, pas marques (2026-10-14 : rien de factice en production).
export type PlayerServerRow = { name: string; slug: string; address: string; published: boolean; isPrivate: boolean; frozen: boolean; openReports: number };
export type PlayerWarningRow = { id: string; reason: string; createdBy: string; createdAt: string };
export type AdminNoteRow = { id: string; text: string; createdBy: string; createdAt: string };

// Abonnements : pas encore construits (tout est gratuit). La carte "Subscription" de la fiche
// joueur reste dans la maquette mais n'est affichee qu'une fois ce drapeau active.
const SUBSCRIPTIONS_ENABLED = false;

export function playerDetailHtml(data: {
  id: string;
  name: string;
  minecraftUuid: string | null;
  createdAt: string;
  serversTotal: number;
  serversFrozen: number;
  serversShown: PlayerServerRow[];
  serversPage: number;
  serversPageCount: number;
  serversFrom: number;
  serversTo: number;
  reportsTotal: number;
  reportsOpen: number;
  locked: boolean;
  lockedReason: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  warnings: PlayerWarningRow[];
  notes: AdminNoteRow[];
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

  // Badges : "Active" n'a pas d'equivalent (aucun statut de compte) sauf si le compte est
  // verrouille, ou il devient reel. "Server owner" ne s'affiche que si le compte possede
  // reellement au moins un serveur.
  if (data.locked) {
    html = replaceOnce(
      html,
      '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:color-mix(in srgb, var(--success) 14%, transparent);color:var(--success);">Active</span>',
      '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:color-mix(in srgb, var(--danger) 16%, transparent);color:var(--danger);"><i class="ph ph-lock-simple" style="font-size:11px;"></i>Verrouillé</span>',
    );
  }
  // Sinon "Active" reste tel quel : un compte non verrouille est bien actif.
  if (data.serversTotal === 0) html = replaceOnce(html, '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:var(--color-accent-800);color:var(--color-accent-100);">Server owner</span>', "");

  // Ligne d'identite : pas d'email (connexion Microsoft uniquement, jamais stocke) ; "Last
  // seen" retire aussi, rien ne le suit — mieux vaut l'omettre qu'afficher une fausse heure.
  const joined = new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  html = replaceOnce(
    html,
    '<span style="font-size:13px;color:var(--muted);">kael.thorn@mail.com · Microsoft linked · Joined Jan 12, 2026 · Last seen 2 h ago</span>',
    `<span style="font-size:13px;color:var(--muted);">Lié à Microsoft · Inscrit le ${joined}</span>`,
  );

  // Barre d'actions : Message, Add warning et Freeze/Lock (ou Unlock si deja verrouille)
  // sont tous reels desormais.
  const actionsStart = html.indexOf('<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">');
  if (actionsStart >= 0) {
    const actionsEnd = balancedEnd(html, actionsStart, "div");
    const lockActions = data.locked
      ? unlockAccountHtml({ id: data.id, name: data.name })
      : freezeOrLockAccountHtml({ id: data.id, name: data.name });
    // player-export-slot : emplacement du bouton « Récupérer les données du joueur », un vrai
    // composant React monte par SlotPortal (voir players/[id]/page.tsx).
    const newActions =
      `<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">` +
      `<span id="player-export-slot" style="display:contents"></span>` +
      playerMessageHtml({ id: data.id, name: data.name }) +
      addWarningHtml({ id: data.id, name: data.name }) +
      lockActions +
      `</div>`;
    html = html.slice(0, actionsStart) + newActions + html.slice(actionsEnd);
  }

  // Pastilles chiffrees. "Warnings" est desormais branche (tuile + section) : plus de markLabel.
  const lastWarning = data.warnings[0] ? new Date(data.warnings[0].createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;
  html = replaceOnce(
    html,
    'letter-spacing:-.01em;">2</div><div style="font-size:12px;color:var(--danger)">Last on Sep 21</div>',
    `letter-spacing:-.01em;">${fmt(data.warnings.length)}</div><div style="font-size:12px;color:${data.warnings.length ? "var(--danger)" : "var(--muted)"}">${lastWarning ? `Dernier le ${lastWarning}` : "Aucun"}</div>`,
  );
  html = replaceOnce(
    html,
    'letter-spacing:-.01em;">2</div><div style="font-size:12px;color:var(--muted)">1 frozen</div>',
    `letter-spacing:-.01em;">${fmt(data.serversTotal)}</div><div style="font-size:12px;color:var(--muted)">${data.serversFrozen > 0 ? `${fmt(data.serversFrozen)} gelé(s)` : "Aucun gelé"}</div>`,
  );
  // Pas d'abonnement pour l'instant : tout est gratuit (demande de Rushi, 2026-10-14). La tuile
  // reste, avec la valeur reelle « Gratuit ».
  html = replaceOnce(
    html,
    'letter-spacing:-.01em;">Pro</div><div style="font-size:12px;color:var(--muted)">Monthly · renews Oct 12</div>',
    'letter-spacing:-.01em;">Gratuit</div><div style="font-size:12px;color:var(--muted)">Tout est gratuit pour le moment</div>',
  );
  // "Reports against" -> en realite "signalements sur ses serveurs" (rien ne modelise un
  // signalement contre le joueur lui-meme dans ce projet). Le titre de la maquette est
  // remplace aussi (second audit du 14/10 : en anglais et trompeur).
  html = replaceOnce(html, "></i>Reports against</div>", "></i>Signalements sur ses serveurs</div>");
  html = replaceOnce(
    html,
    'letter-spacing:-.01em;">9</div><div style="font-size:12px;color:var(--muted)">7 on his servers</div>',
    `letter-spacing:-.01em;">${fmt(data.reportsTotal)}</div><div style="font-size:12px;color:var(--muted)">${fmt(data.reportsOpen)} ouvert(s)</div>`,
  );

  // Section "Servers owned" : liste paginee 5 par 5 (Previous/Next), sans « Voir tout /
  // Réduire » (retire le 2026-10-14 a la demande de Rushi : il affichait 3 puis 7).
  html = replaceSectionBody(html, ">Servers owned</h2>", playerServersSectionHtml(data));

  html = replaceSectionBody(html, ">Warnings</h2>", playerWarningsSectionHtml(data));
  // Carte "Subscription" (plan, paiement, Refund/Cancel) : masquee tant qu'aucun abonnement
  // n'existe — jamais de faux numero de carte a l'ecran. A brancher sur les vraies donnees le
  // jour ou SUBSCRIPTIONS_ENABLED passe a true.
  if (!SUBSCRIPTIONS_ENABLED) html = removeSection(html, ">Subscription</h2>");

  // Compte : l'UUID est reel. Last IP, 2FA et Launcher sont retires (IP et version du launcher
  // jamais enregistrees, et le site n'a pas de 2FA — Microsoft gere deja l'authentification).
  html = replaceOnce(
    html,
    'text-align:right;min-width:0;"><span style="font:12px ui-monospace,Menlo,monospace;">8f2c…a91e</span>',
    `text-align:right;min-width:0;"><span style="font:12px ui-monospace,Menlo,monospace;">${data.minecraftUuid ? escapeHtml(data.minecraftUuid) : "—"}</span>`,
  );
  html = replaceOnce(html, '<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:var(--muted);white-space:nowrap;">Last IP</span><span style="text-align:right;min-width:0;">83.12.•••.•• · France</span></div>', "");
  html = removeInfoRow(html, "Launcher");
  html = replaceOnce(html, '<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:var(--muted);white-space:nowrap;">2FA</span><span style="text-align:right;min-width:0;">Off</span></div>', "");

  html = replaceSectionBody(html, ">Staff notes</h2>", playerNotesSectionHtml(data));

  return html;
}

// Liste des serveurs possedes, paginee 5 par 5.
function playerServersSectionHtml(data: {
  id: string;
  serversTotal: number;
  serversShown: PlayerServerRow[];
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

  if (!data.serversShown.length) return list;

  const hrefPage = (page: number) => `/admin/players/${escapeHtml(data.id)}?serversPage=${page}`;
  const pager =
    `<div style="display:flex;align-items:center;gap:10px;padding:10px 0 0;font-size:12.5px;color:var(--muted);">` +
    `<span>${data.serversFrom}–${data.serversTo} sur ${fmt(data.serversTotal)}</span>` +
    `<div style="margin-left:auto;display:flex;gap:6px;">` +
    (data.serversPage > 1 ? `<a href="${hrefPage(data.serversPage - 1)}" style="${BUTTON}text-decoration:none;">Previous</a>` : `<span style="${BUTTON}opacity:.4;">Previous</span>`) +
    (data.serversPage < data.serversPageCount ? `<a href="${hrefPage(data.serversPage + 1)}" style="${BUTTON}text-decoration:none;">Next</a>` : `<span style="${BUTTON}opacity:.4;">Next</span>`) +
    `</div></div>`;
  return list + pager;
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

// Pop-up « Add warning » : motif libre, affiche ensuite dans la section Warnings (plus
// recent en premier). A 3 avertissements la maquette dit que le compte est gele
// automatiquement — rien ne le fait aujourd'hui, l'admin doit encore geler/verrouiller lui-meme.
function addWarningHtml(data: { id: string; name: string }): string {
  const id = escapeHtml(data.id);
  return (
    `<button type="button" popovertarget="add-warning-${id}" style="${TOP_BUTTON}"><i class="ph ph-warning" style="font-size:14.5px;"></i>Add warning</button>` +
    `<div id="add-warning-${id}" popover style="position:fixed;inset:0;margin:auto;height:fit-content;width:440px;max-width:calc(100vw - 32px);padding:0;border-radius:var(--radius-lg);background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);overflow:hidden;">` +
    `<div style="height:4px;background:var(--danger);"></div>` +
    `<form method="post" action="/api/admin/players/${id}/warnings" style="display:flex;flex-direction:column;gap:14px;padding:22px 24px;">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">Avertir ${escapeHtml(data.name)}</h2>` +
    `<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted);">Motif<textarea class="input" name="reason" required minlength="3" maxlength="500" style="min-height:90px;font-size:13.5px;"></textarea></label>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
    `<button type="button" popovertarget="add-warning-${id}" popovertargetaction="hide" style="${CANCEL}">Annuler</button>` +
    `<button type="submit" style="${CONFIRM}border-color:var(--danger);color:var(--danger);">Avertir</button></div>` +
    `</form></div>`
  );
}

function warningRowHtml(w: PlayerWarningRow): string {
  const date = new Date(w.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return (
    `<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:var(--radius-md);background:var(--color-bg);border:1px solid var(--color-divider);">` +
    `<div style="flex:1;min-width:0;"><div style="display:flex;flex-direction:column;gap:2px;min-width:0;"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(w.reason)}</span><span style="font-size:12px;color:var(--muted);">Par ${escapeHtml(w.createdBy)}</span></div></div>` +
    `<span style="font-size:12px;color:var(--muted2);white-space:nowrap;">${date}</span>` +
    `</div>`
  );
}

function playerWarningsSectionHtml(data: { id: string; name: string; warnings: PlayerWarningRow[] }): string {
  const body = data.warnings.length
    ? `<div style="display:flex;flex-direction:column;gap:12px;">${data.warnings.map(warningRowHtml).join("")}</div>`
    : `<p style="margin:0;font-size:13px;color:var(--muted);">Aucun avertissement.</p>`;
  return body;
}

// Pop-up « Geler » ou « Verrouiller » le compte : meme mecanisme (colonnes user.lockedAt/
// lockedReason/lockedBy, voir lib/launcherAuth.ts), seuls le libelle et le motif par defaut
// changent — la maquette ne distingue pas les deux au-dela du bouton.
function lockAccountPopoverHtml(data: { id: string; name: string }, kind: "freeze" | "lock"): string {
  const id = escapeHtml(data.id);
  const isLock = kind === "lock";
  const anchor = `${kind}-account-${id}`;
  const label = isLock ? "Verrouiller le compte" : "Geler le compte";
  const icon = isLock ? "ph-lock-simple" : "ph-snowflake";
  const color = isLock ? "var(--danger)" : "#8ac3e0";
  const buttonStyle = isLock
    ? `border:1px solid color-mix(in srgb, var(--danger) 55%, transparent);color:var(--danger);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;flex-shrink:0;`
    : `${TOP_BUTTON}color:${color};border-color:${color};`;
  return (
    `<button type="button" popovertarget="${anchor}" style="${buttonStyle}"><i class="ph ${icon}" style="font-size:14.5px;"></i>${label}</button>` +
    `<div id="${anchor}" popover style="position:fixed;inset:0;margin:auto;height:fit-content;width:440px;max-width:calc(100vw - 32px);padding:0;border-radius:var(--radius-lg);background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);overflow:hidden;">` +
    `<div style="height:4px;background:${color};"></div>` +
    `<form method="post" action="/api/admin/players/${id}/lock" style="display:flex;flex-direction:column;gap:14px;padding:22px 24px;">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">${label} de ${escapeHtml(data.name)} ?</h2>` +
    `<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.55;">Le compte ne pourra plus se connecter au launcher jusqu'au déverrouillage.</p>` +
    `<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted);">Motif<textarea class="input" name="reason" required minlength="3" maxlength="500" style="min-height:80px;font-size:13.5px;"></textarea></label>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
    `<button type="button" popovertarget="${anchor}" popovertargetaction="hide" style="${CANCEL}">Annuler</button>` +
    `<button type="submit" style="${CONFIRM}border-color:${color};color:${color};">${label}</button></div>` +
    `</form></div>`
  );
}

function freezeOrLockAccountHtml(data: { id: string; name: string }): string {
  return lockAccountPopoverHtml(data, "freeze") + lockAccountPopoverHtml(data, "lock");
}

function unlockAccountHtml(data: { id: string; name: string }): string {
  const id = escapeHtml(data.id);
  return (
    `<button type="button" popovertarget="unlock-account-${id}" style="${TOP_BUTTON}color:#8ac3e0;border-color:#8ac3e0;"><i class="ph ph-lock-simple-open" style="font-size:14.5px;"></i>Déverrouiller le compte</button>` +
    `<div id="unlock-account-${id}" popover style="position:fixed;inset:0;margin:auto;height:fit-content;width:440px;max-width:calc(100vw - 32px);padding:0;border-radius:var(--radius-lg);background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);overflow:hidden;">` +
    `<div style="height:4px;background:#8ac3e0;"></div>` +
    `<form method="post" action="/api/admin/players/${id}/unlock" style="display:flex;flex-direction:column;gap:14px;padding:22px 24px;">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">Déverrouiller ${escapeHtml(data.name)} ?</h2>` +
    `<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.55;">Le compte pourra de nouveau se connecter au launcher.</p>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
    `<button type="button" popovertarget="unlock-account-${id}" popovertargetaction="hide" style="${CANCEL}">Annuler</button>` +
    `<button type="submit" style="${CONFIRM}color:#8ac3e0;border-color:#8ac3e0;">Déverrouiller</button></div>` +
    `</form></div>`
  );
}

// Pop-up « Add note » (Staff notes) : jamais affichee au joueur, mais exportable s'il demande
// ses donnees (voir playerExport.ts et legal.tsx).
function addNoteHtml(data: { id: string; name: string }): string {
  const id = escapeHtml(data.id);
  return (
    `<button type="button" popovertarget="add-note-${id}" style="border:1px solid var(--color-divider);color:var(--color-text);background:transparent;padding:6px 12px;border-radius:var(--radius-md);font:500 12.5px var(--font-heading);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;flex-shrink:0;"><i class="ph ph-plus" style="font-size:13.5px;"></i>Add note</button>` +
    `<div id="add-note-${id}" popover style="position:fixed;inset:0;margin:auto;height:fit-content;width:440px;max-width:calc(100vw - 32px);padding:0;border-radius:var(--radius-lg);background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);overflow:hidden;">` +
    `<div style="height:4px;background:#9184d9;"></div>` +
    `<form method="post" action="/api/admin/players/${id}/notes" style="display:flex;flex-direction:column;gap:14px;padding:22px 24px;">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">Note sur ${escapeHtml(data.name)}</h2>` +
    `<label style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted);">Note interne (pas affichée au joueur ; peut lui être communiquée s'il demande ses données)<textarea class="input" name="text" required minlength="3" maxlength="1000" style="min-height:90px;font-size:13.5px;"></textarea></label>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
    `<button type="button" popovertarget="add-note-${id}" popovertargetaction="hide" style="${CANCEL}">Annuler</button>` +
    `<button type="submit" style="${CONFIRM}">Ajouter</button></div>` +
    `</form></div>`
  );
}

function noteRowHtml(note: AdminNoteRow): string {
  const date = new Date(note.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return `<div style="min-height:70px;padding:10px 12px;background:var(--color-bg);border:1px solid var(--color-divider);border-radius:var(--radius-md);font-size:13.5px;line-height:1.6;text-wrap:pretty;">${escapeHtml(note.text)} — ${escapeHtml(note.createdBy)}, ${date}</div>`;
}

function playerNotesSectionHtml(data: { id: string; name: string; notes: AdminNoteRow[] }): string {
  const body = data.notes.length
    ? `<div style="display:flex;flex-direction:column;gap:10px;">${data.notes.map(noteRowHtml).join("")}</div>`
    : `<p style="margin:0;font-size:13px;color:var(--muted);">Aucune note.</p>`;
  return body + addNoteHtml(data);
}

// Composer de message diffuse — portee reduite par rapport a la maquette (voir la route
// /api/admin/notifications/send) : un seul canal reel (boite de reception du launcher), deux
// audiences (Tout le monde, Proprietaires de serveur — "Un joueur" existe deja depuis la fiche
// joueur, pas la peine de le dupliquer ici), envoi immediat, pas de brouillon ni de
// programmation.
export function notificationsHtml(data: {
  sentCount: number | null;
  scheduledConfirmed: boolean;
  activeBanner: { type: string; text: string } | null;
  maintenance: { active: boolean; code: string; message: string } | null;
  pendingScheduled: { id: string; type: string; audience: string; text: string; scheduledAt: string; blockLauncher: boolean }[];
}): string {
  let html = SCREENS.notifications;
  html = replaceOnce(html, ">Notifications / New message</span>", ">Notifications</span>");

  const sentBanner = data.sentCount !== null
    ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--success);background:color-mix(in srgb, var(--success) 10%, transparent);color:var(--success);font-size:13px;"><i class="ph ph-check-circle" style="font-size:16px;"></i>Message envoyé à ${fmt(data.sentCount)} compte(s).</div>`
    : data.scheduledConfirmed
      ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--success);background:color-mix(in srgb, var(--success) 10%, transparent);color:var(--success);font-size:13px;"><i class="ph ph-check-circle" style="font-size:16px;"></i>Message programmé.</div>`
      : "";
  const activeBannerNotice = data.activeBanner
    ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-bg);font-size:13px;">` +
      `<i class="ph ph-browser" style="font-size:16px;color:var(--muted)"></i><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Bannière active : ${escapeHtml(data.activeBanner.text)}</span>` +
      `<form method="post" action="/api/admin/notifications/banner/clear"><button type="submit" style="${BUTTON}">Retirer</button></form></div>`
    : "";

  // Mode maintenance du launcher : bloque l'ecran d'accueil pour tout le monde, sauf code.
  const maintenanceBox = data.maintenance?.active
    ? `<div style="display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:var(--radius-md);border:1px solid #e8c547;background:color-mix(in srgb, #e8c547 8%, transparent);font-size:13px;">` +
      `<div style="display:flex;align-items:center;gap:8px;"><i class="ph ph-wrench" style="font-size:16px;color:#e8c547"></i><strong>Maintenance du launcher active</strong></div>` +
      `<span style="color:var(--muted);">${escapeHtml(data.maintenance.message)}</span>` +
      `<div style="display:flex;align-items:center;gap:10px;"><span style="color:var(--muted);">Code d'accès :</span><code style="font:600 16px ui-monospace,Menlo,monospace;letter-spacing:.08em;padding:4px 10px;border-radius:var(--radius-md);background:var(--color-bg);border:1px solid var(--color-divider);">${escapeHtml(data.maintenance.code)}</code></div>` +
      `<form method="post" action="/api/admin/notifications/maintenance/clear"><button type="submit" style="${BUTTON}">Désactiver la maintenance</button></form>` +
      `</div>`
    : `<form method="post" action="/api/admin/notifications/maintenance/activate" style="display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-bg);font-size:13px;">` +
      `<div style="display:flex;align-items:center;gap:8px;"><i class="ph ph-wrench" style="font-size:16px;color:var(--muted)"></i><strong>Mode maintenance du launcher</strong></div>` +
      `<span style="color:var(--muted);">Bloque l'écran d'accueil du launcher pour tout le monde, sauf qui a le code généré ici.</span>` +
      `<textarea class="input" name="message" required minlength="3" maxlength="500" placeholder="Message affiché pendant la maintenance" style="min-height:60px;font-size:13px;"></textarea>` +
      `<button type="submit" style="${BUTTON}width:fit-content;">Activer la maintenance</button>` +
      `</form>`;

  const field = "display:flex;flex-direction:column;gap:6px;min-width:0;";
  const label = "font-size:12px;color:var(--muted)";
  const body =
    sentBanner +
    activeBannerNotice +
    maintenanceBox +
    `<form method="post" action="/api/admin/notifications/send" style="display:flex;flex-direction:column;gap:16px;">` +
    `<label style="${field}"><span style="${label}">Type</span><select name="type" class="input" style="height:36px;" required>` +
    `<option value="announcement">Annonce</option><option value="maintenance">Maintenance</option><option value="alert">Alerte</option><option value="promotion">Promotion</option></select></label>` +
    `<label style="${field}"><span style="${label}">Audience</span><select name="audience" class="input" style="height:36px;" required>` +
    `<option value="everyone">Tout le monde</option><option value="owners">Propriétaires de serveur</option></select></label>` +
    `<label style="${field}"><span style="${label}">Système concerné (si Maintenance)</span><select name="system" class="input" style="height:36px;">` +
    `<option value="">—</option><option value="Site">Site</option><option value="Launcher">Launcher</option><option value="CurseForge">CurseForge</option><option value="Modrinth">Modrinth</option><option value="Tout">Tout</option></select></label>` +
    `<label style="${field}"><span style="${label}">Message</span><textarea class="input" name="text" required minlength="3" maxlength="1000" style="min-height:110px;font-size:13.5px;"></textarea></label>` +
    `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-bg);font-size:13px;"><input type="checkbox" name="banner" style="accent-color:var(--color-accent);width:16px;height:16px;margin:0;">Aussi afficher en bannière sur le site (remplace la bannière active)</label>` +
    `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-bg);font-size:13px;"><input type="checkbox" name="blockLauncher" style="accent-color:var(--color-accent);width:16px;height:16px;margin:0;">Activer le mode maintenance du launcher à cette heure (si Type = Maintenance)</label>` +
    `<div style="display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-bg);">` +
    `<span style="${label}">Programmer (heure de Belgique, la tienne) — laisser vide pour un envoi immédiat</span>` +
    `<div style="display:flex;gap:10px;">` +
    `<input type="date" name="scheduledDate" class="input" style="height:36px;flex:1;">` +
    `<input type="time" name="scheduledTime" class="input" style="height:36px;flex:1;">` +
    `</div></div>` +
    `<div style="display:flex;justify-content:flex-end;gap:10px;">` +
    `<button type="submit" name="when" value="now" style="${CONFIRM}">Envoyer maintenant</button>` +
    `<button type="submit" name="when" value="schedule" style="${BUTTON}">Programmer</button>` +
    `</div>` +
    `</form>`;

  html = replaceSectionBody(html, ">Compose</h2>", body);

  const TYPE_LABELS: Record<string, string> = { announcement: "Annonce", maintenance: "Maintenance", alert: "Alerte", promotion: "Promotion" };
  const AUDIENCE_LABELS: Record<string, string> = { everyone: "Tout le monde", owners: "Propriétaires de serveur" };
  const pendingBody = data.pendingScheduled.length
    ? data.pendingScheduled
        .map(
          (item) =>
            `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-bg);font-size:13px;">` +
            `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;">` +
            `<span><strong>${TYPE_LABELS[item.type] ?? item.type}</strong> · ${AUDIENCE_LABELS[item.audience] ?? item.audience}${item.blockLauncher ? " · bloque le launcher" : ""}</span>` +
            `<span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.text)}</span>` +
            `<span style="color:var(--muted);">${formatAdminTime(item.scheduledAt)}</span>` +
            `</div>` +
            `<form method="post" action="/api/admin/notifications/schedule/cancel"><input type="hidden" name="id" value="${escapeHtml(item.id)}"><button type="submit" style="${BUTTON}">Annuler</button></form>` +
            `</div>`
        )
        .join("")
    : `<span style="color:var(--muted);font-size:13px;">Aucun message programmé.</span>`;
  html = replaceSectionBody(html, ">Launcher preview</h2>", pendingBody);
  html = replaceOnce(html, ">Launcher preview</h2>", ">Programmés</h2>");
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
  verificationStatus: string;
  ip: string;
  minecraftVersion: string;
  modpackName: string | null;
  modpackVersion: string | null;
  createdAt: string;
  launchCount: number;
  reports: ReportSummary[];
  behaviorReports: Omit<BehaviorReportSummary, "serverName">[];
  ownerId: string;
  appealStatus: string | null;
  appealAssignedAdminId: string | null;
  appealHistory: AppealHistoryEntry[];
  currentAdminUsername: string;
}): string {
  const frozen = data.frozenAt !== null;
  // Recours en cours : si un admin DIFFERENT de celui qui a gele est assigne, quiconque n'est
  // pas ce dernier (le second avis attendu, ou un autre admin qui regarde) voit une lecture a
  // l'aveugle — motif factuel et etat du serveur seulement, jamais le nom de qui a gele (pas de
  // ton accusateur). L'auto-revision (appealAssignedAdminId === null, un seul admin actif)
  // n'a pas ce probleme : c'est deja la meme personne.
  const appealPending = data.appealStatus === "pending";
  const blindAppealReview = appealPending && data.appealAssignedAdminId !== null && data.currentAdminUsername !== data.frozenBy;
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
  // Lecture a l'aveugle (blindAppealReview) : pas de "Gelé par X", juste la date et le motif.
  const bannerStart = html.indexOf('<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;');
  if (bannerStart >= 0) {
    const bannerEnd = balancedEnd(html, bannerStart, "div");
    const when = data.frozenAt ? escapeHtml(new Date(data.frozenAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })) : "";
    const title = blindAppealReview ? `Gelé le ${when}` : `Gelé par ${escapeHtml(data.frozenBy ?? "—")} · ${when}`;
    const banner =
      `<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border-radius:var(--radius-md);border:1px solid color-mix(in srgb, #8ac3e0 35%, transparent);background:color-mix(in srgb, #8ac3e0 7%, transparent);">` +
      `<i class="ph ph-snowflake" style="font-size:18px;color:#8ac3e0;margin-top:1px"></i>` +
      `<div style="display:flex;flex-direction:column;gap:3px;font-size:13px;"><span style="font-weight:500;">${title}</span>` +
      `<span style="color:var(--muted);line-height:1.5;">Masqué de l'annuaire et de la recherche. Les connexions sont bloquées dans le launcher, y compris depuis les favoris et raccourcis. Motif : ${escapeHtml(data.frozenReason ?? "")}</span></div></div>` +
      (appealPending ? appealReviewHtml({ id: data.id, blindReview: blindAppealReview, hasAssignedAdmin: data.appealAssignedAdminId !== null, history: data.appealHistory }) : "");
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
      `<a href="/admin/servers/${escapeHtml(data.slug)}/transfert" style="${TOP_BUTTON}">Transfert de propriété</a>` +
      `<a href="/admin/servers/${escapeHtml(data.slug)}/supprimer" style="${TOP_BUTTON}color:var(--danger);border-color:var(--danger);">Supprimer le serveur</a>` +
      `</div>`;
    html = html.slice(0, barStart) + newBar + html.slice(barEnd);
  }
  // Published content (maquette "Aetherfall", boutons sans action) fait doublon avec l'edition
  // cote proprietaire : retire (2026-10-14 : rien de factice en production).
  html = removeSection(html, ">Published content</h2>");
  html = replaceModerationHistorySection(html, data.behaviorReports);
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

// Historique de moderation (lecture seule) : signalements de comportement/contenu passes contre
// ce serveur. Aucune action ici — Rejeter/Avertir vivent uniquement sur /admin/reports (voir
// reportsHtml), pour ne pas dupliquer ce flux a deux endroits.
function behaviorReportRowHtml(report: Omit<BehaviorReportSummary, "serverName">): string {
  const status = REPORT_STATUS_STYLE[report.status];
  const date = new Date(report.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return (
    `<div style="display:flex;gap:10px;align-items:flex-start;">` +
    `<i class="ph ph-flag" style="font-size:15px;color:var(--muted);margin-top:2px"></i>` +
    `<div style="flex:1;min-width:0;"><div style="display:flex;flex-direction:column;gap:2px;min-width:0;">` +
    `<span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(BEHAVIOR_ISSUE_LABELS[report.behaviorIssue])}</span>` +
    `<span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(report.reporterMinecraftUsername)}</span></div></div>` +
    `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:${status.bg};color:${status.color};">${status.label}</span>` +
    `<span style="font-size:12px;color:var(--muted2);white-space:nowrap;">${date}</span>` +
    `</div>`
  );
}

function replaceModerationHistorySection(html: string, reports: Omit<BehaviorReportSummary, "serverName">[]): string {
  const body = reports.length
    ? `<div style="display:flex;flex-direction:column;gap:14px;">${reports.slice(0, 10).map(behaviorReportRowHtml).join("")}</div>`
    : `<p style="margin:0;font-size:13px;color:var(--muted);">Aucun signalement de comportement/contenu pour ce serveur.</p>`;
  return replaceSectionBody(html, "Moderation history", body);
}

const BEHAVIOR_ISSUE_LABELS: Record<BehaviorIssue, string> = {
  stolen_server: "Serveur volé / copie",
  stolen_content: "Contenu ou assets volés",
  impersonating: "Usurpation d'un autre serveur",
  inappropriate_content: "Contenu inapproprié",
  scam_phishing: "Arnaque / phishing",
  other: "Autre",
};

export type BehaviorReportDetail = BehaviorReportSummary & {
  serverSlug: string;
  ownerId: string;
  ownerName: string;
  ownerMinecraftUuid: string | null;
};

// Page de moderation (comportement/contenu uniquement — les signalements "Probleme technique"
// vont chez le proprietaire, voir manage/[id]/reports). Pas de filtre par categorie (chips de
// la maquette) : volontairement omis tant que le volume ne le justifie pas.
export function reportsHtml(data: {
  status: "open" | "resolved";
  openCount: number;
  resolvedCount: number;
  reports: BehaviorReportSummary[];
  selected: BehaviorReportDetail | null;
}): string {
  const chrome = SCREENS.reports;
  const mainStart = chrome.indexOf("<main");
  const html = chrome.slice(0, mainStart);
  // Badge "Reports" du menu : patché partout (y compris ici) par markNavBadges dans
  // DesignScreen, pas la peine de le refaire ici.

  const tab = (label: string, status: "open" | "resolved", count: number) =>
    status === data.status
      ? `<a href="/admin/reports?status=${status}" style="text-decoration:none;padding:5px 11px;border-radius:6px;font-size:12.5px;white-space:nowrap;background:var(--color-accent-800);color:var(--color-accent-100);">${label} ${fmt(count)}</a>`
      : `<a href="/admin/reports?status=${status}" style="text-decoration:none;padding:5px 11px;border-radius:6px;font-size:12.5px;white-space:nowrap;color:var(--muted);">${label} ${fmt(count)}</a>`;

  const rowHtml = (r: BehaviorReportSummary) => {
    const style = REPORT_STATUS_STYLE[r.status];
    const date = new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const selected = data.selected?.id === r.id;
    return (
      `<div style="position:relative;display:grid;min-width:420px;grid-template-columns:minmax(0,1.8fr) minmax(0,1.2fr) 70px 24px;gap:14px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--color-divider);font-size:13px;${selected ? "background:var(--raised);" : ""}">` +
      `<div style="min-width:0;"><div style="display:flex;align-items:center;gap:10px;min-width:0;"><span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${style.color};"></span>` +
      `<div style="display:flex;flex-direction:column;gap:2px;min-width:0;"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(BEHAVIOR_ISSUE_LABELS[r.behaviorIssue])}</span>` +
      `<span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r.reporterMinecraftUsername)}</span></div></div></div>` +
      `<div style="min-width:0;"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r.serverName)}</span></div>` +
      `<div style="min-width:0;"><span style="color:var(--muted);white-space:nowrap;">${date}</span></div>` +
      `<div style="min-width:0;"><i class="ph ph-caret-right" style="font-size:14px;color:var(--muted)"></i></div>` +
      `<a class="srv-cover" href="/admin/reports?status=${data.status}&reportId=${escapeHtml(r.id)}" aria-label="Ouvrir le signalement"></a>` +
      `</div>`
    );
  };

  const list =
    `<section style="display:flex;flex-direction:column;gap:16px;padding:20px 22px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-width:0;padding:12px 8px;">` +
    `<div style="overflow-x:auto;"><div class="srv-table">` +
    `<div class="srv-head" style="display:grid;min-width:420px;grid-template-columns:minmax(0,1.8fr) minmax(0,1.2fr) 70px 24px;gap:14px;padding:0 14px 10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted2);border-bottom:1px solid var(--color-divider);"><span>Signalement</span><span>Serveur</span><span>Date</span><span></span></div>` +
    (data.reports.length ? data.reports.map(rowHtml).join("") : `<p style="margin:0;padding:14px;font-size:13px;color:var(--muted);">Aucun signalement.</p>`) +
    `</div></div></section>`;

  let detail: string;
  if (!data.selected) {
    detail =
      `<section style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:40px 22px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-width:0;min-height:200px;">` +
      `<i class="ph ph-flag" style="font-size:22px;color:var(--muted2);"></i><p style="margin:0;font-size:13px;color:var(--muted);">Sélectionne un signalement pour voir le détail.</p></section>`;
  } else {
    const r = data.selected;
    const style = REPORT_STATUS_STYLE[r.status];
    const date = new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    // Defense en profondeur : meme si report/route.ts valide deja le schema a la reception
    // (voir safeProofUrl), on ne rend jamais un href dont le schema n'est pas http(s) — une
    // ligne deja en base avant ce correctif (ou ecrite par un autre chemin un jour) ne doit
    // jamais pouvoir executer du JS dans le contexte authentifie de l'admin (XSS stocke
    // critique, trouve par l'audit du 2026-10-10 — escapeHtml() n'echappe pas le schema d'une
    // URL, seuls les caracteres & < > " le sont).
    const proofUrlSafe = r.proofUrl && /^https?:\/\//i.test(r.proofUrl) ? r.proofUrl : null;
    const evidence = proofUrlSafe
      ? `<div style="display:flex;flex-direction:column;gap:6px;min-width:0;"><label style="font-size:12px;color:var(--muted)">Preuve fournie</label><a href="${escapeHtml(proofUrlSafe)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;word-break:break-all;">${escapeHtml(proofUrlSafe)}</a></div>`
      : `<div style="display:flex;flex-direction:column;gap:6px;min-width:0;"><label style="font-size:12px;color:var(--muted)">Preuve fournie</label><span style="font-size:13px;color:var(--muted);">${r.proofUrl ? "Lien invalide." : "Aucune."}</span></div>`;
    const actions =
      r.status === "resolved"
        ? `<p style="margin:0;font-size:12px;color:var(--muted2);">Signalement traité.</p>`
        : `<div style="display:flex;flex-direction:column;gap:10px;">` +
          `<div style="display:flex;gap:8px;flex-wrap:wrap;">` +
          `<form method="post" action="/api/admin/reports/${escapeHtml(r.id)}/dismiss"><button type="submit" style="${BUTTON}">Rejeter</button></form>` +
          `<a href="/admin/servers/${escapeHtml(r.serverSlug)}" style="${TOP_BUTTON}text-decoration:none;">Voir le serveur</a>` +
          `</div>` +
          (r.ownerMinecraftUuid
            ? `<form method="post" action="/api/admin/reports/${escapeHtml(r.id)}/warn" style="display:flex;flex-direction:column;gap:8px;">` +
              `<textarea class="input" name="text" required minlength="3" maxlength="1000" placeholder="Message d'avertissement au propriétaire" style="min-height:70px;font-size:13px;"></textarea>` +
              `<button type="submit" style="${CONFIRM}width:fit-content;">Avertir le propriétaire</button>` +
              `</form>`
            : `<p style="margin:0;font-size:12px;color:var(--muted2);">Propriétaire injoignable (pas de compte Minecraft lié).</p>`) +
          `</div>`;

    detail =
      `<section style="display:flex;flex-direction:column;gap:16px;padding:20px 22px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-width:0;">` +
      `<div style="display:flex;align-items:center;gap:12px;min-height:28px;"><h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:15px;">${escapeHtml(BEHAVIOR_ISSUE_LABELS[r.behaviorIssue])} · ${escapeHtml(r.serverName)}</h2></div>` +
      `<div style="display:flex;gap:8px;flex-wrap:wrap;"><span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;background:${style.bg};color:${style.color};">${style.label}</span></div>` +
      `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:var(--muted);white-space:nowrap;">Serveur</span><span style="text-align:right;min-width:0;"><a href="/admin/servers/${escapeHtml(r.serverSlug)}">${escapeHtml(r.serverName)}</a></span></div>` +
      `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:var(--muted);white-space:nowrap;">Propriétaire</span><span style="text-align:right;min-width:0;"><a href="/admin/players/${escapeHtml(r.ownerId)}">${escapeHtml(r.ownerName)}</a></span></div>` +
      `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:var(--muted);white-space:nowrap;">Signalé le</span><span style="text-align:right;min-width:0;">${date}</span></div>` +
      `<div style="display:flex;flex-direction:column;gap:6px;min-width:0;"><label style="font-size:12px;color:var(--muted)">Message du joueur</label><div style="min-height:70px;padding:10px 12px;background:var(--color-bg);border:1px solid var(--color-divider);border-radius:var(--radius-md);font-size:13.5px;line-height:1.6;text-wrap:pretty;">${escapeHtml(r.message)}<br><span style="color:var(--muted);font-size:12.5px;">— ${escapeHtml(r.reporterMinecraftUsername)}, via launcher</span></div></div>` +
      evidence +
      `<div style="height:1px;background:linear-gradient(to right, transparent, var(--color-divider) 24px, var(--color-divider) calc(100% - 24px), transparent);"></div>` +
      actions +
      `<p style="margin:0;font-size:12px;color:var(--muted2);">Le joueur signalant n'est pas identifié auprès du propriétaire.</p>` +
      `</section>`;
  }

  return (
    html +
    `<main style="flex:1;min-width:0;padding:28px 32px 40px;display:flex;flex-direction:column;gap:22px;">` +
    `<div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;"><div style="display:flex;flex-direction:column;gap:4px;min-width:0;"><h1 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:24px;letter-spacing:-.01em;">Reports</h1><p style="margin:0;font-size:13.5px;color:var(--muted);">Signalements de comportement/contenu. Les problèmes techniques vont directement chez le propriétaire du serveur.</p></div>` +
    `<div style="margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><div style="display:inline-flex;padding:3px;gap:2px;border-radius:var(--radius-md);background:var(--raised);border:1px solid var(--color-divider);flex-shrink:0;">${tab("Ouverts", "open", data.openCount)}${tab("Résolus", "resolved", data.resolvedCount)}</div></div></div>` +
    `<div style="display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px;align-items:start;">${list}${detail}</div>` +
    `</main></div></div>`
  );
}

const VERIF_STATUS_STYLE: Record<VerificationStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "En attente", bg: "color-mix(in srgb, var(--color-accent) 16%, transparent)", color: "var(--color-accent-100)" },
  approved: { label: "Validé", bg: "color-mix(in srgb, var(--success) 18%, transparent)", color: "var(--success)" },
  rejected: { label: "Refusé", bg: "color-mix(in srgb, var(--danger) 16%, transparent)", color: "var(--danger)" },
};

// Resume en une ligne les signaux remontes par les controles automatiques (voir
// lib/verification.ts) — affiche sous le nom du serveur dans la liste, comme la
// maquette ("Version Minecraft détectée différente de celle déclarée…").
function checksSummary(checks: PendingServerSummary["checks"]): string {
  if (!checks) return "Contrôle automatique non disponible.";
  const flags: string[] = [];
  if (checks.reachable === null) flags.push("adresse injoignable lors du contrôle");
  if (checks.versionMismatch) flags.push(`version détectée (${checks.detectedVersion}) différente de celle déclarée (${checks.declaredVersion})`);
  if (checks.similarName) flags.push(`nom proche de « ${checks.similarName.name} »`);
  if (checks.contentFlags.length) flags.push("contenu à vérifier");
  return flags.length ? flags.join(" · ") : "Aucun écart détecté par le contrôle automatique.";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

// File de verification des serveurs (panel admin, voir Design "verification" / "verification-vide"
// / "verification-erreur") : les trois ecrans de la maquette ne sont que des etats differents de
// la meme liste (en attente / vide / un controle injoignable) — une seule page reelle les couvre
// tous (voir verification/page.tsx), comme reportsHtml couvre "Ouverts"/"Résolus" pour les reports.
export function verificationHtml(data: {
  status: VerificationStatus;
  counts: { pending: number; approved: number; rejected: number };
  servers: PendingServerSummary[];
  selected: VerificationDetail | null;
}): string {
  const chrome = SCREENS.verification;
  const mainStart = chrome.indexOf("<main");
  const html = chrome.slice(0, mainStart);
  // Badge "Vérification" du menu : patché partout (y compris ici) par markNavBadges dans
  // DesignScreen, pas la peine de le refaire ici.

  const tab = (label: string, status: VerificationStatus, count: number) =>
    status === data.status
      ? `<a href="/admin/verification?status=${status}" style="text-decoration:none;padding:6px 14px;border-radius:6px;font-size:12.5px;white-space:nowrap;background:var(--color-accent-800);color:var(--color-accent-100);">${label} · ${fmt(count)}</a>`
      : `<a href="/admin/verification?status=${status}" style="text-decoration:none;padding:6px 14px;border-radius:6px;font-size:12.5px;white-space:nowrap;color:var(--muted);">${label} · ${fmt(count)}</a>`;

  const cardHtml = (s: PendingServerSummary) => {
    const selected = data.selected?.id === s.id;
    const initial = s.name.slice(0, 1).toUpperCase() || "?";
    return (
      `<div style="position:relative;display:flex;flex-direction:column;gap:10px;padding:16px 18px;border-radius:var(--radius-md);border:1px solid ${selected ? "var(--color-accent)" : "var(--color-divider)"};background:${selected ? "color-mix(in srgb, var(--color-accent) 7%, var(--color-surface))" : "var(--color-surface)"};">` +
      `<div style="display:flex;align-items:center;gap:10px;"><span style="width:30px;height:30px;flex-shrink:0;border-radius:8px;background:var(--raised);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--muted);">${escapeHtml(initial)}</span>` +
      `<h3 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:15px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.name)}</h3>` +
      `<span style="font-size:11px;padding:3px 9px;border-radius:999px;background:${VERIF_STATUS_STYLE[data.status].bg};color:${VERIF_STATUS_STYLE[data.status].color};flex-shrink:0;">${VERIF_STATUS_STYLE[data.status].label}</span></div>` +
      `<p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.5;">${escapeHtml(checksSummary(s.checks))}</p>` +
      `<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted2);"><span>${escapeHtml(s.ownerName)}</span><span>Ajouté ${timeAgo(s.createdAt)}</span></div>` +
      `<a class="srv-cover" href="/admin/verification?status=${data.status}&serverId=${escapeHtml(s.id)}" aria-label="Ouvrir la fiche"></a>` +
      `</div>`
    );
  };

  const list =
    `<section style="display:flex;flex-direction:column;gap:12px;min-width:0;">` +
    (data.servers.length
      ? data.servers.map(cardHtml).join("")
      : `<section style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:40px 22px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-height:200px;"><i class="ph ph-shield-check" style="font-size:22px;color:var(--muted2);"></i><p style="margin:0;font-size:13px;color:var(--muted);">Aucun serveur ${data.status === "pending" ? "en attente" : data.status === "approved" ? "validé" : "refusé"}.</p></section>`) +
    `</section>`;

  let detail: string;
  if (!data.selected) {
    detail =
      `<section style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:40px 22px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-width:0;min-height:200px;">` +
      `<i class="ph ph-shield-check" style="font-size:22px;color:var(--muted2);"></i><p style="margin:0;font-size:13px;color:var(--muted);">Sélectionne un serveur pour voir le détail du contrôle.</p></section>`;
  } else {
    const s = data.selected;
    const c = s.checks;
    const reachableRow = c
      ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--color-bg);font-size:13px;"><span style="color:var(--muted);">Adresse joignable</span>${
          c.reachable
            ? `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--success);"><i class="ph ph-check-circle" style="font-size:14px;"></i>Oui</span>`
            : `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--danger);"><i class="ph ph-warning-circle" style="font-size:14px;"></i>Injoignable au moment du contrôle</span>`
        }</div>` +
        // Auto-test du proprietaire (launcher) : complement au ping du site ci-dessus — montre les
        // DEUX, jamais un remplacement l'un de l'autre (voir lib/verification.ts/selfTestPassedAt).
        (s.selfTestPassedAt
          ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--color-bg);font-size:13px;"><span style="color:var(--muted);">Auto-test propriétaire</span><span style="display:inline-flex;align-items:center;gap:6px;color:var(--success);"><i class="ph ph-check-circle" style="font-size:14px;"></i>Joignable pendant le test du propriétaire (${timeAgo(s.selfTestPassedAt)})</span></div>`
          : "")
      : "";
    // Version detectee : le ping du site peut echouer (serveur injoignable depuis l'exterieur,
    // pare-feu...) alors que l'auto-test du proprietaire (execute depuis SON reseau) a reussi —
    // dans ce cas on affiche la version qu'IL a detectee plutot que de laisser "Inconnue".
    const detectedVersionDisplay = c?.detectedVersion ?? s.selfTestDetectedVersion ?? null;
    const versionRows = c
      ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--color-bg);font-size:13px;"><span style="color:var(--muted);">Version détectée</span><span>${escapeHtml(detectedVersionDisplay ?? "Inconnue")}</span></div>` +
        `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--color-bg);font-size:13px;"><span style="color:var(--muted);">Version déclarée</span><span style="${c.versionMismatch ? "color:var(--danger);" : ""}">${escapeHtml(c.declaredVersion)}</span></div>`
      : "";
    const nameRow = c
      ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--color-bg);font-size:13px;"><span style="color:var(--muted);">Nom</span>${
          c.similarName
            ? `<span style="color:var(--danger);">Proche de « ${escapeHtml(c.similarName.name)} » (${Math.round(c.similarName.score * 100)}%)</span>`
            : `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--success);"><i class="ph ph-check-circle" style="font-size:14px;"></i>Aucun nom proche publié</span>`
        }</div>`
      : "";
    const contentRow = c
      ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--color-bg);font-size:13px;"><span style="color:var(--muted);">Contenu (nom/description)</span>${
          c.contentFlags.length
            ? `<span style="color:var(--danger);">${escapeHtml(c.contentFlags.join(", "))}</span>`
            : `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--success);"><i class="ph ph-check-circle" style="font-size:14px;"></i>Conforme</span>`
        }</div>`
      : "";
    const checksBlock = c
      ? `<div style="display:flex;flex-direction:column;gap:1px;border:1px solid var(--color-divider);border-radius:var(--radius-md);overflow:hidden;">${reachableRow}${versionRows}${nameRow}${contentRow}</div>`
      : `<div style="padding:10px 14px;background:var(--color-bg);border:1px solid var(--color-divider);border-radius:var(--radius-md);font-size:13px;color:var(--muted);">Contrôle automatique non disponible pour cette fiche.</div>`;

    const historyBlock =
      `<div style="display:flex;flex-direction:column;gap:6px;"><label style="font-size:12px;color:var(--muted)">Historique</label>` +
      `<div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--muted);">${
        s.history.length
          ? s.history.map((h) => `<div style="display:flex;gap:8px;"><span style="flex-shrink:0;color:var(--muted2);">${timeAgo(h.at)}</span><span>${escapeHtml(h.text)}</span></div>`).join("")
          : `<span>Aucun évènement.</span>`
      }</div></div>`;

    const actions =
      s.status === "rejected"
        ? `<p style="margin:0;font-size:12px;color:var(--muted2);">${s.verificationReason ? `Refusé — ${escapeHtml(s.verificationReason)}` : "Refusé."}</p>`
        : s.status === "approved"
          ? `<p style="margin:0;font-size:12px;color:var(--muted2);">Validé — visible dans l'annuaire selon ses réglages de publication.</p>`
          : `<div style="display:flex;flex-direction:column;gap:12px;">` +
            `<div style="display:flex;gap:8px;flex-wrap:wrap;">` +
            `<form method="post" action="/api/admin/verification/${escapeHtml(s.id)}/approve"><button type="submit" style="${CONFIRM}display:inline-flex;align-items:center;gap:7px;"><i class="ph ph-check" style="font-size:14.5px;"></i>Valider</button></form>` +
            `<a href="/admin/servers/${escapeHtml(s.slug)}" style="${TOP_BUTTON}">Voir le serveur</a>` +
            `</div>` +
            `<form method="post" action="/api/admin/verification/${escapeHtml(s.id)}/request-info" style="display:flex;flex-direction:column;gap:8px;">` +
            `<textarea class="input" name="text" required minlength="3" maxlength="1000" placeholder="Demander des informations au propriétaire" style="min-height:60px;font-size:13px;"></textarea>` +
            `<button type="submit" style="${TOP_BUTTON}width:fit-content;"><i class="ph ph-chat-centered-text" style="font-size:14.5px;"></i>Demander des infos</button>` +
            `</form>` +
            `<form method="post" action="/api/admin/verification/${escapeHtml(s.id)}/reject" style="display:flex;flex-direction:column;gap:8px;">` +
            `<textarea class="input" name="reason" required minlength="3" maxlength="1000" placeholder="Motif de refus (envoyé au propriétaire)" style="min-height:60px;font-size:13px;"></textarea>` +
            `<button type="submit" style="border:1px solid transparent;color:var(--danger);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);cursor:pointer;width:fit-content;">Refuser</button>` +
            `</form>` +
            `</div>`;

    detail =
      `<section style="display:flex;flex-direction:column;gap:16px;padding:20px 22px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-width:0;">` +
      `<div style="display:flex;align-items:center;gap:12px;min-height:28px;"><h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:15px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.name)}</h2><span style="font-size:11px;color:var(--muted2);flex-shrink:0;">Soumis ${timeAgo(s.createdAt)}</span></div>` +
      `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:var(--muted);white-space:nowrap;">Propriétaire</span><span style="text-align:right;min-width:0;"><a href="/admin/players/${escapeHtml(s.ownerId)}">${escapeHtml(s.ownerName)}</a></span></div>` +
      checksBlock +
      historyBlock +
      `<div style="height:1px;background:linear-gradient(to right, transparent, var(--color-divider) 24px, var(--color-divider) calc(100% - 24px), transparent);"></div>` +
      actions +
      `</section>`;
  }

  return (
    html +
    `<main style="flex:1;min-width:0;padding:28px 32px 40px;display:flex;flex-direction:column;gap:22px;">` +
    `<div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;"><div style="display:flex;flex-direction:column;gap:4px;min-width:0;"><h1 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:24px;letter-spacing:-.01em;">Vérification des serveurs</h1><p style="margin:0;font-size:13.5px;color:var(--muted);">Les serveurs retenus par le contrôle automatique attendent une décision avant publication.</p></div></div>` +
    `<div style="display:inline-flex;padding:3px;gap:2px;border-radius:var(--radius-md);background:var(--raised);border:1px solid var(--color-divider);width:fit-content;">${tab("En attente", "pending", data.counts.pending)}${tab("Validés", "approved", data.counts.approved)}${tab("Refusés", "rejected", data.counts.rejected)}</div>` +
    `<div style="display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px;align-items:start;">${list}${detail}</div>` +
    `</main></div></div>`
  );
}

// Created et Launcher joins viennent de vraies colonnes (createdAt, launchCount). Players (30 d)
// et Peak online ne sont pas suivis (aucun comptage de joueurs dans le temps, voir le commentaire
// sur ServerEvent dans contract.prisma) et Plan viendrait d'abonnements qui n'existent pas :
// les trois lignes de la maquette sont retirees (2026-10-14).
function replaceStatsSection(html: string, data: { createdAt: string; launchCount: number }): string {
  const created = new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  html = replaceOnce(html, '<span style="text-align:right;min-width:0;">Mar 4, 2026</span>', `<span style="text-align:right;min-width:0;">${created}</span>`);
  html = removeInfoRow(html, "Players (30 d)");
  html = removeInfoRow(html, "Peak online");
  html = replaceOnce(html, '<span style="text-align:right;min-width:0;">12,390</span>', `<span style="text-align:right;min-width:0;">${fmt(data.launchCount)}</span>`);
  html = removeInfoRow(html, "Plan");
  return html;
}

// Bloc "Recours" affiché sous le bandeau de gel quand le propriétaire a demandé un second avis
// (voir lib/appeals.ts, serverDetailHtml) : "Confirmer le gel" clôt le recours sans rien changer
// (/appeal-confirm) ; "Annuler le gel" réutilise la route unfreeze existante, qui clôt le recours
// elle-même quand il y en a un en cours (voir unfreeze/route.ts). blindReview masque déjà le
// "Gelé par X" du bandeau au-dessus (voir serverDetailHtml) — ce bloc n'a donc rien d'autre à
// cacher, juste l'historique et les deux actions.
function appealReviewHtml(data: { id: string; blindReview: boolean; hasAssignedAdmin: boolean; history: { at: string; text: string }[] }): string {
  const id = escapeHtml(data.id);
  const title = data.hasAssignedAdmin ? "Recours — second avis demandé" : "Recours — délai de réflexion demandé";
  const note = data.blindReview
    ? "Lecture à l'aveugle : seuls le motif et l'état du serveur sont montrés ci-dessus, pas qui a prononcé le gel."
    : "Un seul administrateur actif : c'est à toi de réexaminer ta propre décision après le délai de réflexion.";
  const historyRows = data.history.length
    ? data.history.map((h) => `<div style="display:flex;gap:8px;"><span style="flex-shrink:0;color:var(--muted2);">${timeAgo(h.at)}</span><span>${escapeHtml(h.text)}</span></div>`).join("")
    : `<span>Aucun évènement.</span>`;
  return (
    `<div style="margin-top:12px;display:flex;flex-direction:column;gap:12px;padding:14px 16px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);">` +
    `<div style="display:flex;align-items:center;gap:8px;"><i class="ph ph-scales" style="font-size:16px;color:var(--color-accent);"></i><span style="font-weight:500;font-size:13.5px;">${title}</span></div>` +
    `<p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.5;">${note}</p>` +
    `<div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--muted);">${historyRows}</div>` +
    `<div style="display:flex;gap:8px;flex-wrap:wrap;">` +
    `<form method="post" action="/api/admin/servers/${id}/appeal-confirm"><button type="submit" style="border:1px solid transparent;color:var(--danger);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);cursor:pointer;">Confirmer le gel</button></form>` +
    `<form method="post" action="/api/admin/servers/${id}/unfreeze"><input type="hidden" name="notify" value="on" /><button type="submit" style="${CONFIRM}color:#8ac3e0;border-color:#8ac3e0;">Annuler le gel</button></form>` +
    `</div></div>`
  );
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

// Liste des articles (panel admin /admin/news). Pas de filtre par type ni d'auteur (voir
// AGENTS/la tache : modele volontairement minimal — titre, texte, publie/brouillon).
export type NewsRow = { id: string; title: string; published: boolean; publishedAt: string | null; createdAt: string };

function newsStatusChip(published: boolean): string {
  return published
    ? `<span style="${CHIP}background:color-mix(in srgb, var(--success) 14%, transparent);color:var(--success);">Publié</span>`
    : `<span style="${CHIP}background:var(--raised);color:var(--muted);border:1px solid var(--color-divider);">Brouillon</span>`;
}

function newsRowHtml(n: NewsRow): string {
  const date =
    n.published && n.publishedAt
      ? new Date(n.publishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
      : "—";
  return (
    `<div style="display:grid;min-width:640px;grid-template-columns:minmax(0,2.4fr) 120px 110px 170px;gap:14px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--color-divider);font-size:13px;">` +
    `<div style="min-width:0;"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(n.title)}</span></div>` +
    `<div style="min-width:0;">${newsStatusChip(n.published)}</div>` +
    `<div style="min-width:0;"><span style="color:var(--muted);white-space:nowrap;">${date}</span></div>` +
    `<div style="min-width:0;display:flex;gap:10px;align-items:center;">` +
    `<a href="/admin/news/${escapeHtml(n.id)}" style="color:var(--color-accent);text-decoration:none;font-size:12.5px;">Modifier</a>` +
    `<form method="post" action="/api/admin/news/${escapeHtml(n.id)}/${n.published ? "unpublish" : "publish"}"><button type="submit" style="border:none;background:transparent;color:var(--muted);font-size:12.5px;cursor:pointer;padding:0;">${n.published ? "Dépublier" : "Publier"}</button></form>` +
    `<form method="post" action="/api/admin/news/${escapeHtml(n.id)}/delete" onsubmit="return confirm('Supprimer cet article ?')"><button type="submit" style="border:none;background:transparent;color:var(--danger);font-size:12.5px;cursor:pointer;padding:0;">Supprimer</button></form>` +
    `</div></div>`
  );
}

export function newsHtml(data: { rows: NewsRow[] }): string {
  const chrome = SCREENS.news;
  const mainStart = chrome.indexOf("<main");
  const html = chrome.slice(0, mainStart);
  const header =
    `<div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;">` +
    `<div style="display:flex;flex-direction:column;gap:4px;min-width:0;"><h1 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:24px;letter-spacing:-.01em;">News</h1>` +
    `<p style="margin:0;font-size:13.5px;color:var(--muted);">Articles affichés sur la page « Actualités » du tableau de bord, une fois publiés.</p></div>` +
    `<div style="margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><a href="/admin/news/nouveau" style="border:1px solid var(--color-accent);color:var(--color-accent);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);white-space:nowrap;display:inline-flex;align-items:center;gap:7px;flex-shrink:0;text-decoration:none;"><i class="ph ph-plus" style="font-size:14.5px;"></i>Nouvel article</a></div></div>`;
  const list = data.rows.length
    ? `<section style="display:flex;flex-direction:column;gap:16px;padding:12px 8px 4px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-width:0;"><div style="overflow-x:auto;"><div style="display:grid;min-width:640px;grid-template-columns:minmax(0,2.4fr) 120px 110px 170px;gap:14px;padding:0 14px 10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted2);border-bottom:1px solid var(--color-divider);"><span>Titre</span><span>Statut</span><span>Date</span><span>Actions</span></div>${data.rows.map(newsRowHtml).join("")}</div></div></section>`
    : `<section style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:40px 22px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-width:0;min-height:160px;"><i class="ph ph-newspaper" style="font-size:22px;color:var(--muted2);"></i><p style="margin:0;font-size:13px;color:var(--muted);">Aucun article pour le moment.</p></section>`;
  return html + `<main style="flex:1;min-width:0;padding:28px 32px 40px;display:flex;flex-direction:column;gap:22px;">${header}${list}</main></div></div>`;
}

// Editeur (creation et edition) : titre + texte brut (pas d'editeur riche) + case Publie.
// Le reste de la maquette (type, image de couverture, programmation, langue...) n'existe pas
// dans ce modele minimal — volontairement omis plutot que fictif.
export function newsEditorHtml(data: { id: string | null; title: string; body: string; published: boolean }): string {
  const chrome = SCREENS["news-editor"];
  const mainStart = chrome.indexOf("<main");
  let html = chrome.slice(0, mainStart);
  html = replaceOnce(
    html,
    ">News / New article</span>",
    data.id ? ">News / Modifier</span>" : ">News / Nouvel article</span>",
  );
  const action = data.id ? `/api/admin/news/${escapeHtml(data.id)}` : "/api/admin/news";
  const field = "display:flex;flex-direction:column;gap:6px;min-width:0;";
  const label = "font-size:12px;color:var(--muted)";
  const deleteForm = data.id
    ? `<form method="post" action="/api/admin/news/${escapeHtml(data.id)}/delete" onsubmit="return confirm('Supprimer cet article ?')" style="margin-top:4px;"><button type="submit" style="border:1px solid var(--danger);color:var(--danger);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);cursor:pointer;">Supprimer</button></form>`
    : "";
  const form =
    `<form method="post" action="${action}" style="display:flex;flex-direction:column;gap:16px;max-width:720px;">` +
    `<label style="${field}"><span style="${label}">Titre</span><input class="input" name="title" required minlength="1" maxlength="200" value="${escapeHtml(data.title)}" style="height:36px;font-size:13.5px;"></label>` +
    `<label style="${field}"><span style="${label}">Texte</span><textarea class="input" name="body" required minlength="1" maxlength="20000" style="min-height:260px;font-size:13.5px;line-height:1.6;">${escapeHtml(data.body)}</textarea></label>` +
    `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-bg);font-size:13px;width:fit-content;"><input type="checkbox" name="published" ${data.published ? "checked" : ""} style="accent-color:var(--color-accent);width:16px;height:16px;margin:0;">Publié</label>` +
    `<div style="display:flex;gap:10px;"><button type="submit" style="${CONFIRM}">Enregistrer</button><a href="/admin/news" style="${CANCEL}">Annuler</a></div>` +
    `</form>` +
    deleteForm;
  return (
    html +
    `<main style="flex:1;min-width:0;padding:28px 32px 40px;display:flex;flex-direction:column;gap:22px;"><h1 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:24px;letter-spacing:-.01em;">${data.id ? "Modifier l’article" : "Nouvel article"}</h1>${form}</main></div></div>`
  );
}

// Page de transfert de propriété : recherche d'un joueur (même filtre nom/UUID que la liste des
// joueurs, voir admin/(panel)/players/page.tsx), puis confirmation avant de changer Server.ownerId.
// Deux étapes en GET (recherche, puis sélection) suivies d'un seul POST — même esprit "sans
// JavaScript" que le reste du panel.
export function transferPageHtml(data: {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  ownerName: string;
  q: string;
  candidates: { id: string; name: string; minecraftUuid: string | null }[];
  target: { id: string; name: string } | null;
}): string {
  const backLink = `/admin/servers/${escapeHtml(data.slug)}`;
  const searchForm =
    `<form method="get" action="/admin/servers/${escapeHtml(data.slug)}/transfert" style="display:flex;gap:10px;">` +
    `<input class="input" name="q" value="${escapeHtml(data.q)}" placeholder="Nom ou UUID Minecraft du nouveau propriétaire…" style="width:auto;height:36px;flex:1;" autofocus>` +
    `<button type="submit" style="${BUTTON}height:36px;">Chercher</button></form>`;

  let body: string;
  if (data.target) {
    // Étape 2 : confirmation du transfert vers le joueur choisi.
    body =
      `<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.55;">Transférer <strong>${escapeHtml(data.name)}</strong> de <strong>${escapeHtml(data.ownerName)}</strong> vers <strong>${escapeHtml(data.target.name)}</strong> ? Les deux comptes seront notifiés.</p>` +
      `<form method="post" action="/api/admin/servers/${escapeHtml(data.id)}/transfer" style="display:flex;flex-direction:column;gap:14px;">` +
      `<input type="hidden" name="targetId" value="${escapeHtml(data.target.id)}">` +
      `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
      `<a href="/admin/servers/${escapeHtml(data.slug)}/transfert?q=${encodeURIComponent(data.q)}" style="${CANCEL}">Changer de joueur</a>` +
      `<button type="submit" style="${CONFIRM}">Confirmer le transfert</button></div></form>`;
  } else {
    // Étape 1 : recherche. Le propriétaire actuel ne s'affiche pas (ça ne serait pas un transfert).
    const results = data.candidates.filter((c) => c.id !== data.ownerId);
    const rows = results.length
      ? results
          .map(
            (c) =>
              `<a href="/admin/servers/${escapeHtml(data.slug)}/transfert?q=${encodeURIComponent(data.q)}&targetId=${escapeHtml(c.id)}" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--color-divider);text-decoration:none;color:inherit;">` +
              `<span style="width:30px;height:30px;flex-shrink:0;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">${escapeHtml(c.name.charAt(0).toUpperCase())}</span>` +
              `<div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.name)}</span>${c.minecraftUuid ? `<span style="font-size:12px;color:var(--muted);">${escapeHtml(c.minecraftUuid)}</span>` : ""}</div>` +
              `<span style="font-size:12.5px;color:var(--color-accent-100);">Choisir</span></a>`,
          )
          .join("")
      : data.q
        ? `<p style="margin:0;font-size:13px;color:var(--muted);">Aucun joueur ne correspond.</p>`
        : "";
    body = `<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.55;">Propriétaire actuel : <strong>${escapeHtml(data.ownerName)}</strong>.</p>${searchForm}${rows}`;
  }

  return shellHtml(
    `<div style="display:flex;flex-direction:column;gap:6px;padding:28px 32px 40px;"><a href="${backLink}" style="font-size:13px;color:var(--muted);">← Retour à la fiche</a>` +
      confirmCard(`Transfert de propriété — ${escapeHtml(data.name)}`, body) +
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

// Page Administration : gestion des comptes staff (admin/moderateur). La maquette propose une
// matrice de permissions fine (Owner/Admin/Moderator/Editor/Support) qui n'a pas d'equivalent
// ici (seulement deux roles, voir adminAuth.ts) : cette section reste donc "non branchee".
export type StaffAccountRow = { id: string; username: string; role: "admin" | "moderator"; createdAt: string; mustChangeCredentials: boolean };
export type StaffRoleLabels = { admin: string; moderator: string };

function staffStatusChip(mustChangeCredentials: boolean): string {
  return mustChangeCredentials
    ? `<span style="${CHIP}background:color-mix(in srgb, #e0c28a 16%, transparent);color:#e0c28a;">En attente</span>`
    : `<span style="${CHIP}background:color-mix(in srgb, var(--success) 14%, transparent);color:var(--success);">Actif</span>`;
}

// Petit menu deroulant ancre au bouton "..." (via <details>, pas le grand pop-up centre utilise
// ailleurs) — se ferme au clic exterieur grace au petit script en bas de administrationHtml.
// "Changer le role" est lui-meme un sous-menu (select + Valider), pas un bouton qui bascule
// aveuglement vers l'autre role. Supprimer : confirmation oui/non native (confirm()).
function manageStaffHtml(row: StaffAccountRow, isSelf: boolean, lastAdmin: boolean, roleLabels: StaffRoleLabels): string {
  const id = escapeHtml(row.id);
  const item = "display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;border:none;background:transparent;color:var(--color-text);font-size:13px;text-align:left;cursor:pointer;";
  const divider = `<div style="height:1px;background:var(--color-divider);margin:4px 0;"></div>`;

  const changeRole = !lastAdmin
    ? `<details><summary style="${item}list-style:none;">Changer le rôle</summary>` +
      `<form method="post" action="/api/admin/staff/${id}" style="display:flex;flex-direction:column;gap:8px;padding:8px 14px 10px;">` +
      `<select name="role" class="input" style="height:32px;font-size:13px;">` +
      `<option value="admin"${row.role === "admin" ? " selected" : ""}>${escapeHtml(roleLabels.admin)}</option>` +
      `<option value="moderator"${row.role === "moderator" ? " selected" : ""}>${escapeHtml(roleLabels.moderator)}</option>` +
      `</select><button type="submit" style="${CONFIRM}height:32px;">Valider le changement de rôle</button></form></details>`
    : `<p style="margin:0;padding:9px 14px;font-size:12px;color:var(--muted);">Dernier administrateur : rôle verrouillé.</p>`;
  const resetCredentials =
    `<form method="post" action="/api/admin/staff/${id}"><input type="hidden" name="role" value="${escapeHtml(row.role)}"><input type="hidden" name="resetCredentials" value="on">` +
    `<button type="submit" style="${item}">Forcer le changement des identifiants</button></form>`;
  const deleteItem =
    !isSelf && !lastAdmin
      ? `<form method="post" action="/api/admin/staff/${id}/delete" onsubmit="return confirm('Supprimer le compte ${escapeHtml(row.username)} ?')"><button type="submit" style="${item}color:var(--danger);">Supprimer le compte</button></form>`
      : isSelf
        ? `<p style="margin:0;padding:9px 14px;font-size:12px;color:var(--muted);">Tu ne peux pas supprimer ton propre compte.</p>`
        : `<p style="margin:0;padding:9px 14px;font-size:12px;color:var(--muted);">Dernier administrateur : suppression impossible.</p>`;

  return (
    `<details class="staff-menu" style="position:relative;">` +
    `<summary class="staff-menu-summary" style="list-style:none;cursor:pointer;color:var(--muted);width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-md);"><i class="ph ph-dots-three" style="font-size:18px;"></i></summary>` +
    `<div style="position:absolute;right:0;top:100%;margin-top:4px;z-index:20;min-width:260px;padding:6px 0;border-radius:var(--radius-md);background:var(--color-surface);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);">` +
    changeRole +
    resetCredentials +
    divider +
    deleteItem +
    `</div></details>`
  );
}

// Pop-up « Créer un compte » : mot de passe initial choisi par l'admin (pas de systeme d'email
// pour en envoyer un ailleurs) ; mustChangeCredentials force a 1, le nouveau membre choisit son
// propre nom d'utilisateur et mot de passe a la premiere connexion (voir premiere-connexion/).
function createStaffHtml(roleLabels: StaffRoleLabels): string {
  const field = "display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted);";
  return (
    `<button type="button" popovertarget="staff-new" style="${TOP_BUTTON}border-color:var(--color-accent);color:var(--color-accent);"><i class="ph ph-user-plus" style="font-size:14.5px;"></i>Créer un compte</button>` +
    `<div id="staff-new" popover style="position:fixed;inset:0;margin:auto;height:fit-content;width:440px;max-width:calc(100vw - 32px);padding:0;border-radius:var(--radius-lg);background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);overflow:hidden;">` +
    `<div style="height:4px;background:var(--color-accent);"></div>` +
    `<form method="post" action="/api/admin/staff" style="display:flex;flex-direction:column;gap:14px;padding:22px 24px;">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">Créer un compte</h2>` +
    `<label style="${field}">Nom d'utilisateur<input class="input" name="username" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9_.-]{3,32}" autocomplete="off" style="height:36px;font-size:13.5px;"></label>` +
    `<label style="${field}">Mot de passe initial (12 caractères min.)<input class="input" type="password" name="initialPassword" required minlength="12" style="height:36px;font-size:13.5px;"></label>` +
    `<label style="${field}">Rôle<select name="role" class="input" style="height:36px;"><option value="moderator">${escapeHtml(roleLabels.moderator)}</option><option value="admin">${escapeHtml(roleLabels.admin)}</option></select></label>` +
    `<p style="margin:0;font-size:12px;color:var(--muted);">Communique ce mot de passe au nouveau membre : il devra choisir son propre nom d'utilisateur et mot de passe à la première connexion.</p>` +
    `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
    `<button type="button" popovertarget="staff-new" popovertargetaction="hide" style="${CANCEL}">Annuler</button>` +
    `<button type="submit" style="${CONFIRM}">Créer</button></div>` +
    `</form></div>`
  );
}

function staffRowHtml(row: StaffAccountRow, isSelf: boolean, lastAdmin: boolean, roleLabels: StaffRoleLabels): string {
  const initial = escapeHtml(row.username.charAt(0).toUpperCase());
  const created = new Date(row.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return (
    `<div style="display:grid;min-width:640px;grid-template-columns:minmax(0,1.8fr) 150px 140px 110px 40px;gap:14px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--color-divider);font-size:13px;">` +
    `<div style="min-width:0;"><div style="display:flex;align-items:center;gap:12px;min-width:0;">` +
    `<span style="width:32px;height:32px;flex-shrink:0;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;">${initial}</span>` +
    `<span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(row.username)}${isSelf ? ` <span style="color:var(--muted);font-weight:400;">(toi)</span>` : ""}</span>` +
    `</div></div>` +
    `<div style="min-width:0;"><span style="color:var(--muted);white-space:nowrap;">${escapeHtml(roleLabels[row.role])}</span></div>` +
    `<div style="min-width:0;"><span style="color:var(--muted);white-space:nowrap;">${created}</span></div>` +
    `<div style="min-width:0;">${staffStatusChip(row.mustChangeCredentials)}</div>` +
    `<div style="min-width:0;display:flex;justify-content:flex-end;">${manageStaffHtml(row, isSelf, lastAdmin, roleLabels)}</div>` +
    `</div>`
  );
}

// Permissions de la maquette (grille "Role permissions", encore non branchée) — reprises ici
// juste pour affichage, dans le pop-up "Modifier le rôle" : une preview de ce qui viendra avec
// le vrai système de permissions, pas des cases fonctionnelles (voir note dans le pop-up).
const PERMISSION_CATEGORIES: { name: string; items: string[] }[] = [
  { name: "Overview", items: ["View statistics", "Export data"] },
  { name: "Notifications", items: ["Send to everyone", "Send to one player"] },
  { name: "News", items: ["Create & edit drafts", "Publish"] },
  { name: "Servers", items: ["View all servers", "Edit content", "Freeze / unfreeze", "Delete"] },
  { name: "Players", items: ["View accounts", "Add warnings", "Freeze & lock accounts", "Manage subscriptions"] },
  { name: "Reports", items: ["View & resolve"] },
  { name: "Administration", items: ["Manage members & roles"] },
];

// Section "Rôles" (sous Members) : un rôle par ligne, menu "..." -> "Modifier le rôle" (renommer,
// réel, + un aperçu des permissions à venir, pas encore fonctionnel — voir PERMISSION_CATEGORIES).
function roleRowHtml(role: "admin" | "moderator", accountCount: number, roleLabels: StaffRoleLabels): string {
  const id = `role-${role}`;
  const label = roleLabels[role];
  const otherRole = role === "admin" ? "moderator" : "admin";
  const field = "display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted);";
  const permissionsPreview = PERMISSION_CATEGORIES.map(
    (cat) =>
      `<div style="display:flex;flex-direction:column;gap:4px;">` +
      `<span style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted2);">${escapeHtml(cat.name)}</span>` +
      cat.items.map((p) => `<label style="display:flex;align-items:center;gap:8px;font-size:13px;opacity:.5;"><input type="checkbox" disabled>${escapeHtml(p)}</label>`).join("") +
      `</div>`,
  ).join("");

  return (
    `<div style="display:grid;min-width:480px;grid-template-columns:minmax(0,1.8fr) 140px 40px;gap:14px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--color-divider);font-size:13px;">` +
    `<div style="min-width:0;"><span style="font-weight:500;">${escapeHtml(label)}</span></div>` +
    `<div style="min-width:0;"><span style="color:var(--muted);white-space:nowrap;">${fmt(accountCount)} compte(s)</span></div>` +
    `<div style="min-width:0;display:flex;justify-content:flex-end;">` +
    `<details class="staff-menu" style="position:relative;">` +
    `<summary class="staff-menu-summary" style="list-style:none;cursor:pointer;color:var(--muted);width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-md);"><i class="ph ph-dots-three" style="font-size:18px;"></i></summary>` +
    `<div style="position:absolute;right:0;top:100%;margin-top:4px;z-index:20;min-width:260px;padding:6px 0;border-radius:var(--radius-md);background:var(--color-surface);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);">` +
    `<button type="button" popovertarget="${id}" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;border:none;background:transparent;color:var(--color-text);font-size:13px;text-align:left;cursor:pointer;">Modifier le rôle</button>` +
    `</div></details>` +
    `<div id="${id}" popover style="position:fixed;inset:0;margin:auto;height:fit-content;max-height:calc(100vh - 64px);width:460px;max-width:calc(100vw - 32px);padding:0;border-radius:var(--radius-lg);background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-divider);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;">` +
    `<div style="height:4px;background:var(--color-accent);flex-shrink:0;"></div>` +
    `<div style="overflow-y:auto;padding:22px 24px;display:flex;flex-direction:column;gap:16px;">` +
    `<h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:18px;">Modifier le rôle</h2>` +
    `<form method="post" action="/api/admin/staff/role-labels" style="display:flex;flex-direction:column;gap:10px;">` +
    `<input type="hidden" name="${otherRole}" value="${escapeHtml(roleLabels[otherRole])}">` +
    `<label style="${field}">Nom du rôle<input class="input" name="${role}" required maxlength="24" value="${escapeHtml(label)}" style="height:36px;font-size:13.5px;"></label>` +
    `<div style="display:flex;justify-content:flex-end;"><button type="submit" style="${CONFIRM}">Enregistrer le nom</button></div>` +
    `</form>` +
    `<div style="height:1px;background:var(--color-divider);"></div>` +
    `<div style="display:flex;flex-direction:column;gap:3px;"><span style="font-size:13px;font-weight:500;">Permissions</span><span style="font-size:12px;color:var(--muted);">Aperçu de ce qui arrivera avec le système de permissions — pas encore fonctionnel.</span></div>` +
    `<div style="display:flex;flex-direction:column;gap:12px;">${permissionsPreview}</div>` +
    `<div style="display:flex;justify-content:flex-end;"><button type="button" popovertarget="${id}" popovertargetaction="hide" style="${CANCEL}">Fermer</button></div>` +
    `</div></div>`
  );
}

export function administrationHtml(data: { selfId: string; accounts: StaffAccountRow[]; adminCount: number; created: string | null; roleLabels: StaffRoleLabels }): string {
  let html = SCREENS.administration;

  html = replaceOnce(
    html,
    '<button style="border:1px solid var(--color-accent);color:var(--color-accent);background:transparent;padding:8px 16px;border-radius:var(--radius-md);font:500 13.5px var(--font-heading);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;flex-shrink:0;"><i class="ph ph-user-plus" style="font-size:14.5px;"></i>Invite member</button>',
    createStaffHtml(data.roleLabels),
  );
  html = replaceOnce(html, "Members of the staff and what each role can do.", "Comptes staff (administrateurs et modérateurs) et leurs accès.");
  html = replaceOnce(html, '<span style="color:var(--muted);white-space:nowrap;">5 members</span>', `<span style="color:var(--muted);white-space:nowrap;">${fmt(data.accounts.length)} comptes</span>`);

  const createdNotice = data.created
    ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--success);background:color-mix(in srgb, var(--success) 10%, transparent);color:var(--success);font-size:13px;"><i class="ph ph-check-circle" style="font-size:16px;"></i>Compte « ${escapeHtml(data.created)} » créé.</div>`
    : "";

  const rows = data.accounts.map((a) => staffRowHtml(a, a.id === data.selfId, a.role === "admin" && data.adminCount <= 1, data.roleLabels));
  const table =
    `<div class="srv-table">` +
    createdNotice +
    `<div style="display:grid;min-width:640px;grid-template-columns:minmax(0,1.8fr) 150px 140px 110px 40px;gap:14px;padding:0 14px 10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted2);border-bottom:1px solid var(--color-divider);"><span>Member</span><span>Role</span><span>Created</span><span>Status</span><span></span></div>` +
    (rows.length ? rows.join("") : `<p style="margin:0;padding:14px;font-size:13px;color:var(--muted);">Aucun compte staff.</p>`) +
    `</div>` +
    // Ferme le menu "..." au clic exterieur — <details> seul ne le fait pas nativement.
    `<script>document.addEventListener("click",function(e){document.querySelectorAll("details.staff-menu[open]").forEach(function(d){if(!d.contains(e.target))d.removeAttribute("open");});});</script>`;
  html = replaceSectionBody(html, ">Members</h2>", table);

  // Nouvelle section "Rôles" (pas dans la maquette d'origine) : un rôle par ligne, menu "..." ->
  // "Modifier le rôle" (renommer, réel, + aperçu des permissions à venir). Insérée juste avant
  // "Role permissions" (qui, elle, reste la grande grille non branchée de la maquette).
  const roleRows =
    roleRowHtml("admin", data.accounts.filter((a) => a.role === "admin").length, data.roleLabels) +
    roleRowHtml("moderator", data.accounts.filter((a) => a.role === "moderator").length, data.roleLabels);
  const rolesSection =
    `<section style="display:flex;flex-direction:column;gap:16px;padding:20px 22px;border-radius:var(--radius-md);border:1px solid var(--color-divider);background:var(--color-surface);min-width:0;">` +
    `<div style="display:flex;align-items:center;gap:12px;min-height:28px;"><h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:15px;">Rôles</h2></div>` +
    `<div class="srv-table"><div class="srv-head" style="display:grid;min-width:480px;grid-template-columns:minmax(0,1.8fr) 140px 40px;gap:14px;padding:0 14px 10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted2);border-bottom:1px solid var(--color-divider);"><span>Rôle</span><span>Comptes</span><span></span></div>` +
    roleRows +
    `</div></section>`;
  const rolePermHeadingAt = html.indexOf(">Role permissions</h2>");
  const rolePermSectionStart = html.lastIndexOf("<section", rolePermHeadingAt);
  if (rolePermSectionStart >= 0) html = html.slice(0, rolePermSectionStart) + rolesSection + html.slice(rolePermSectionStart);

  html = markSectionNotBuilt(html, ">Role permissions</h2>", "nb");
  // 2026-10-10 : la pop-up "Modifier le rôle" (role-admin / role-moderator, voir roleRowHtml)
  // ne se fermait ni par Echap ni par clic sur le fond assombri — contrairement aux autres
  // pop-ups de cette page (ex. createStaffHtml), celle-ci n'a qu'un bouton "Fermer" explicite.
  // Script minimal, meme style que le script de fermeture du menu "..." juste au-dessus.
  html +=
    `<script>(function(){function openRoleModals(){return document.querySelectorAll('[id^="role-"][popover]');}` +
    `document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;openRoleModals().forEach(function(d){if(d.matches(":popover-open"))d.hidePopover();});});` +
    `document.addEventListener("click",function(e){openRoleModals().forEach(function(d){if(!d.matches(":popover-open"))return;if(d.contains(e.target))return;if(e.target.closest('[popovertarget="'+d.id+'"]'))return;d.hidePopover();});});})();</script>`;
  return html;
}
