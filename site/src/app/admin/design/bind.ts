// Remplit les écrans de la maquette avec les vraies données, sans toucher au style.
// Ce qui n'existe pas encore dans le projet est entouré d'un contour pointillé
// (classe "nb", voir nocturne.css / DesignScreen) pour qu'on le voie tout de suite.
import { SCREENS } from "./screens";

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

// Entoure l'élément qui contient le texte `heading` d'un contour "non branché".
export function markSectionNotBuilt(html: string, heading: string): string {
  const at = html.indexOf(heading);
  if (at < 0) return html;
  const start = html.lastIndexOf("<section", at);
  const end = balancedEnd(html, start, "section");
  if (start < 0 || end < 0) return html;
  return html.slice(0, start) + `<div class="nb-block"><span class="nb-tag">Non branché</span>${html.slice(start, end)}</div>` + html.slice(end);
}

// Met en surbrillance un libellé qui n'est pas encore branché.
export function markLabel(html: string, label: string): string {
  return html.split(`>${label}<`).join(`><span class="nb">${label}</span><`);
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
  rows: { name: string; slug: string; address: string; owner: string; type: string; published: boolean; isPrivate: boolean; frozen: boolean; pinged: boolean; players: number | null; capacity: number; openReports: number }[];
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
    row = replaceOnce(row, ">Kaelthorn</a>", `>${escapeHtml(s.owner)}</a>`);
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
  html = replaceOnce(html, ">K</span>Kaelthorn <i", `>${escapeHtml(data.owner.charAt(0).toUpperCase())}</span><span class="nb">${escapeHtml(data.owner)}</span> <i`);

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
  return markAllSections(html);
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
