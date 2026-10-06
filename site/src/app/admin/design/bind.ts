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
export function serversHtml(data: {
  total: number;
  rows: { name: string; address: string; owner: string; type: string; published: boolean; players: number; capacity: number; openReports: number }[];
}): string {
  let html = SCREENS.servers;
  const rowStart = `<div style="display:grid;min-width:860px;`;
  const starts: number[] = [];
  for (let at = html.indexOf(rowStart); at >= 0; at = html.indexOf(rowStart, at + 1)) starts.push(at);
  const rows = starts.map((start) => ({ start, end: balancedEnd(html, start, "div") }));
  const dataRows = rows.filter((r) => !html.slice(r.start, r.end).includes("Open reports"));
  if (dataRows.length === 0) return html;
  const template = html.slice(dataRows[0].start, dataRows[0].end);
  const liveBadge = (html.match(/<span style="display:inline-flex[^>]*>Live<\/span>/) || [""])[0];
  const hiddenBadge = (html.match(/<span style="display:inline-flex[^>]*>Hidden<\/span>/) || [""])[0];

  const built = data.rows.map((s) => {
    let row = template;
    row = replaceOnce(row, 'font-weight:600;">A</span>', `font-weight:600;">${escapeHtml(s.name.charAt(0).toUpperCase())}</span>`);
    row = replaceOnce(row, ">Aetherfall</span>", `>${escapeHtml(s.name)}</span>`);
    row = replaceOnce(row, ">play.aetherfall.gg</span>", `>${escapeHtml(s.address)}</span>`);
    row = replaceOnce(row, ">Kaelthorn</a>", `>${escapeHtml(s.owner)}</a>`);
    row = replaceOnce(row, ">Modded</span>", `>${escapeHtml(s.type === "modded" ? "Modded" : "Vanilla")}</span>`);
    row = row.replace(/<span style="display:inline-flex[^>]*>Frozen<\/span>/, s.published ? liveBadge : hiddenBadge);
    row = replaceOnce(row, ">0 / 150</span>", `>${s.players} / ${s.capacity}</span>`);
    row = row.replace(/<span style="display:inline-flex[^>]*>(<i class="ph ph-flag"[^>]*><\/i>)6<\/span>/, s.openReports > 0 ? `<span style="display:inline-flex[^>]*>$1${s.openReports}</span>` : `<span style="color:var(--muted);">—</span>`);
    return row;
  });

  // Reconstruit le tableau : lignes de données remplacées, en-tête et reste inchangés.
  const firstData = dataRows[0].start;
  const lastData = dataRows[dataRows.length - 1].end;
  html = html.slice(0, firstData) + built.join("") + html.slice(lastData);
  html = replaceOnce(html, "1,246 servers", `${fmt(data.total)} servers`);
  html = replaceOnce(html, "Showing 1–6 of 1,246", `Showing 1–${data.rows.length} of ${fmt(data.total)}`);
  html = markLabel(html, "Previous");
  html = markLabel(html, "Next");
  return html;
}
