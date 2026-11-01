"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyticsSnapshot } from "@/lib/analytics";
import { ANALYTICS_ADMIN_REFRESH_SECONDS, ANALYTICS_SITE_WINDOW_SECONDS } from "@/lib/refreshSettings";

// Page Analytique (/admin/analytique, 31/10, preview validée par Rushi) : qui est là en ce moment,
// sur le site et dans le launcher, comparé à la base de comptes. Une seule requête groupée toutes
// les 30 s, et aucune quand l'onglet n'est pas visible (quota Cloudflare). L'admin est en français
// seulement, comme les autres pages du panel.

const CSS = `
.an-wrap { container-type: inline-size; }
.an-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.an-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.an-live { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); padding: 6px 10px; border: 1px solid var(--color-divider); border-radius: 999px; font-variant-numeric: tabular-nums; }
.an-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); animation: an-pulse 2s infinite; }
.an-dot.is-off { background: var(--warn); animation: none; }
@keyframes an-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 60%, transparent); } 70%, 100% { box-shadow: 0 0 0 7px transparent; } }
@media (prefers-reduced-motion: reduce) { .an-dot { animation: none; } }
.an-btn { background: var(--raised); border: 1px solid var(--color-divider); color: var(--color-text); padding: 6px 12px; border-radius: var(--radius-md); cursor: pointer; font: inherit; font-size: 13px; }
.an-btn:hover { border-color: var(--color-accent); }
.an-btn:disabled { opacity: .6; cursor: default; }
.an-sec { margin: 26px 0 10px; font-size: 15px; font-weight: 600; }
.an-grid { display: grid; gap: 14px; }
.an-g3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.an-g2 { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); }
@container (max-width: 760px) { .an-g3, .an-g2 { grid-template-columns: minmax(0, 1fr); } }
.an-card { background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: var(--radius-lg); padding: 16px; min-width: 0; }
.an-card h3 { margin: 0 0 4px; font-size: 13px; color: var(--muted); font-weight: 500; }
.an-big { font-size: 34px; font-weight: 600; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
.an-note { font-size: 12px; color: var(--muted2); margin-top: 4px; line-height: 1.4; }
.an-split { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 10px; font-size: 12px; color: var(--muted); }
.an-split b { color: var(--color-text); font-weight: 600; font-variant-numeric: tabular-nums; }
.an-meter { height: 8px; border-radius: 999px; background: var(--raised); overflow: hidden; margin-top: 10px; }
.an-meter div { height: 100%; background: var(--color-accent); border-radius: 999px; transition: width .5s; }
.an-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-divider); font-size: 13px; }
.an-row:last-child { border-bottom: 0; }
.an-row span { color: var(--muted); }
.an-row b { font-weight: 600; font-variant-numeric: tabular-nums; }
.an-tabs { display: inline-flex; gap: 4px; margin-left: auto; }
.an-tabs button { background: none; border: 1px solid var(--color-divider); color: var(--muted); padding: 3px 10px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 12px; }
.an-tabs button.is-on { border-color: var(--color-accent); color: var(--color-text); }
.an-legend { display: flex; gap: 14px; font-size: 12px; color: var(--muted); margin-top: 6px; }
.an-sw { display: inline-block; width: 10px; height: 3px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
.an-chart text { fill: var(--muted2); font-size: 10px; }
.an-empty { text-align: center; padding: 30px 16px; color: var(--muted); }
.an-empty b { color: var(--color-text); font-weight: 500; }
.an-privacy { margin-top: 14px; background: color-mix(in srgb, var(--success) 9%, var(--color-surface)); border-color: color-mix(in srgb, var(--success) 35%, transparent); }
.an-privacy ul { margin: 6px 0 0; padding-left: 18px; color: var(--muted); font-size: 13px; line-height: 1.6; }
.an-banner { margin: 0 0 14px; padding: 10px 12px; border-radius: var(--radius-md); font-size: 13px; line-height: 1.45; color: var(--color-text); background: color-mix(in srgb, var(--warn) 12%, var(--color-surface)); border: 1px solid color-mix(in srgb, var(--warn) 35%, transparent); }
.an-tip { position: fixed; pointer-events: none; background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: 8px; padding: 6px 9px; font-size: 12px; z-index: 9; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.an-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 20; padding: 16px; }
.an-modal { background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: var(--radius-lg); padding: 20px; max-width: 520px; width: 100%; max-height: 90vh; overflow: auto; line-height: 1.55; font-size: 14px; }
.an-modal h2 { margin: 0 0 8px; font-size: 17px; font-weight: 600; }
.an-toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: var(--color-surface); border: 1px solid var(--color-divider); padding: 9px 14px; border-radius: 8px; font-size: 13px; z-index: 30; }
`;

const REFRESH_MS = ANALYTICS_ADMIN_REFRESH_SECONDS * 1000;
const SITE_WINDOW_MIN = Math.round(ANALYTICS_SITE_WINDOW_SECONDS / 60);
const fmt = (n: number) => n.toLocaleString("fr-FR");
const pad = (n: number) => String(n).padStart(2, "0");

type Point = { label: string; tip: string; launcher: number; site: number };

function dayLabel(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", ...options });
}

function todayPoints(s: AnalyticsSnapshot): Point[] {
  const byHour = new Map(s.today.map((r) => [r.hour, r]));
  return Array.from({ length: s.currentHour + 1 }, (_, hour) => ({
    label: hour % 3 === 0 ? `${pad(hour)}h` : "",
    tip: `${pad(hour)}:00`,
    launcher: byHour.get(hour)?.launcher ?? 0,
    site: byHour.get(hour)?.site ?? 0,
  }));
}

function dayPoints(s: AnalyticsSnapshot): Point[] {
  const byDay = new Map(s.days.map((r) => [r.day, r]));
  const end = Date.parse(`${s.todayKey}T12:00:00Z`);
  return Array.from({ length: 14 }, (_, i) => {
    const day = new Date(end - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    return {
      label: i % 2 === 1 ? dayLabel(day, { day: "numeric", month: "short" }) : "",
      tip: dayLabel(day, { weekday: "short", day: "numeric", month: "short" }),
      launcher: byDay.get(day)?.launcher ?? 0,
      site: byDay.get(day)?.site ?? 0,
    };
  });
}

// Axe fixe (24 h ou 14 jours) : la courbe d'aujourd'hui s'arrête à l'heure en cours.
function Chart({ points, slots }: { points: Point[]; slots: number }) {
  const [tip, setTip] = useState<{ x: number; y: number; point: Point } | null>(null);
  const W = 640;
  const H = 180;
  const P = 24;
  const step = (W - P * 2) / (slots - 1);
  const max = Math.max(3, ...points.flatMap((p) => [p.launcher, p.site])) * 1.15;
  const x = (i: number) => P + i * step;
  const y = (v: number) => H - P - (v / max) * (H - P * 2);
  const path = (key: "launcher" | "site") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const last = points.length - 1;
  return (
    <>
      <svg className="an-chart" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img" aria-label="Pics du launcher et du site">
        {[0, 1, 2, 3].map((k) => {
          const v = Math.round((max * k) / 3);
          return (
            <g key={k}>
              <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="var(--color-divider)" />
              <text x={2} y={y(v) + 3}>{v}</text>
            </g>
          );
        })}
        {points.map((p, i) => (p.label ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{p.label}</text> : null))}
        <path d={`${path("launcher")} L${x(last)},${H - P} L${x(0)},${H - P}Z`} fill="color-mix(in srgb, var(--color-accent) 14%, transparent)" />
        <path d={path("launcher")} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
        <path d={path("site")} fill="none" stroke="var(--success)" strokeWidth={2} strokeDasharray="5 4" />
        {points.length === 1 ? (
          <>
            <circle cx={x(0)} cy={y(points[0].launcher)} r={3} fill="var(--color-accent)" />
            <circle cx={x(0)} cy={y(points[0].site)} r={3} fill="var(--success)" />
          </>
        ) : null}
        {points.map((p, i) => (
          <rect
            key={i}
            x={x(i) - step / 2}
            y={0}
            width={step}
            height={H}
            fill="transparent"
            onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, point: p })}
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </svg>
      <div className="an-legend">
        <span><span className="an-sw" style={{ background: "var(--color-accent)" }} />Launcher</span>
        <span><span className="an-sw" style={{ background: "var(--success)" }} />Site</span>
      </div>
      {tip ? (
        <div className="an-tip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          <b style={{ fontWeight: 600 }}>{tip.point.tip}</b>
          <br />Launcher : {fmt(tip.point.launcher)}
          <br />Site : {fmt(tip.point.site)}
        </div>
      ) : null}
    </>
  );
}

export function AdminAnalytics({ initial, everyVisitor }: { initial: AnalyticsSnapshot | null; everyVisitor: boolean }) {
  const [snap, setSnap] = useState(initial);
  const [failed, setFailed] = useState(!initial);
  const [ago, setAgo] = useState(0);
  const [range, setRange] = useState<"today" | "days">("today");
  const [howOpen, setHowOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const lastLoad = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async (): Promise<boolean> => {
    lastLoad.current = Date.now();
    const res = await fetch("/api/admin/analytics", { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json().catch(() => null)) as AnalyticsSnapshot | null) : null;
    setFailed(!data);
    if (data) {
      setSnap(data);
      setAgo(0);
    }
    return !!data;
  }, []);

  useEffect(() => {
    lastLoad.current = Date.now();
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setAgo(Math.round((Date.now() - lastLoad.current) / 1000));
      if (Date.now() - lastLoad.current >= REFRESH_MS) void load();
    }, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current >= REFRESH_MS) void load();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHowOpen(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("keydown", onKey);
    return () => {
      clearInterval(timer);
      clearTimeout(toastTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("keydown", onKey);
    };
  }, [load]);

  const refresh = async () => {
    setLoading(true);
    const ok = await load();
    setLoading(false);
    setToast(ok ? "Chiffres actualisés" : "Actualisation impossible, réessaie dans un instant");
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  };

  const site = snap ? snap.siteLogged + snap.siteAnon : 0;
  const total = snap ? snap.launcher + site - snap.both : 0;
  // Comptes en ligne seulement : les visiteurs anonymes ne sont pas des comptes.
  const accountsOnline = snap ? snap.launcher + snap.siteLogged - snap.both : 0;
  const percent = snap?.accounts ? Math.min(100, Math.round((accountsOnline / snap.accounts) * 100)) : 0;
  const windowMin = snap?.launcherWindowMinutes ?? 7;
  const hasHistory = !!snap && (range === "today" ? snap.today.length > 0 : snap.days.length > 0);

  return (
    <div className="an-wrap">
      <style>{CSS}</style>
      <div className="an-head">
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
            <i className="ph ph-chart-line-up" style={{ color: "var(--color-accent)" }} />
            Analytique
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--muted)" }}>Qui est là en ce moment, sur le site et dans le launcher.</p>
        </div>
        <div className="an-actions">
          <span className="an-live">
            <span className={`an-dot${failed ? " is-off" : ""}`} />
            {failed ? "Chiffres indisponibles" : `En direct · mis à jour il y a ${ago} s`}
          </span>
          <button type="button" className="an-btn" onClick={refresh} disabled={loading}>Actualiser</button>
          <button type="button" className="an-btn" onClick={() => setHowOpen(true)}>Comment ça marche ?</button>
        </div>
      </div>

      {!everyVisitor ? (
        <p className="an-banner">
          Interrupteur du Laboratoire sur « Test » ou « Bêta testeurs » : seuls les comptes testeurs envoient le signal du site. Mets « Bêta publique » ou « Pour tous » pour compter tous les visiteurs.
        </p>
      ) : null}

      {!snap ? (
        <div className="an-card an-empty">
          <b>Chiffres indisponibles</b>
          <div className="an-note">La base ne répond pas, ou la migration 2026-10-31-analytique n&apos;est pas appliquée. Nouvel essai toutes les 30 s.</div>
        </div>
      ) : (
        <>
          <div className="an-sec">En ligne maintenant</div>
          {total === 0 ? (
            <div className="an-card an-empty" style={{ marginBottom: 14 }}>
              <b>Personne en ligne pour l&apos;instant</b>
              <div className="an-note">Les chiffres apparaîtront dès qu&apos;un joueur ouvre le launcher ou le site.</div>
            </div>
          ) : null}
          <div className="an-grid an-g3">
            <div className="an-card">
              <h3>Launcher</h3>
              <div className="an-big">{fmt(snap.launcher)}</div>
              <div className="an-note">comptes uniques, vus il y a moins de {windowMin} min</div>
              <div className="an-split">
                <span title="En partie sur un serveur public de l'annuaire. Solo et serveurs privés comptent « dans le menu »."><b>{fmt(snap.inGame)}</b> en jeu</span>
                <span><b>{fmt(snap.launcher - snap.inGame)}</b> dans le menu</span>
              </div>
            </div>
            <div className="an-card">
              <h3>Site</h3>
              <div className="an-big">{fmt(site)}</div>
              <div className="an-note">visiteurs uniques, vus il y a moins de {SITE_WINDOW_MIN} min</div>
              <div className="an-split">
                <span><b>{fmt(snap.siteLogged)}</b> connectés</span>
                <span><b>{fmt(snap.siteAnon)}</b> anonymes</span>
              </div>
            </div>
            <div className="an-card">
              <h3>Total unique</h3>
              <div className="an-big">{fmt(total)}</div>
              <div className="an-note">une personne sur le site ET le launcher compte une seule fois</div>
              <div className="an-split">
                <span><b>{fmt(snap.both)}</b> sur les deux</span>
                <span><b>{snap.peak ? fmt(snap.peak.value) : "—"}</b> pic du jour{snap.peak ? ` à ${pad(snap.peak.hour)}:00` : ""}</span>
              </div>
            </div>
          </div>

          <div className="an-sec">Comparé à la base de données</div>
          <div className="an-grid an-g2">
            <div className="an-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>{range === "today" ? "Aujourd'hui, heure par heure" : "Pic de chaque jour"}</h3>
                <div className="an-tabs">
                  <button type="button" className={range === "today" ? "is-on" : ""} onClick={() => setRange("today")}>Aujourd&apos;hui</button>
                  <button type="button" className={range === "days" ? "is-on" : ""} onClick={() => setRange("days")}>14 derniers jours</button>
                </div>
              </div>
              {hasHistory ? (
                <Chart points={range === "today" ? todayPoints(snap) : dayPoints(snap)} slots={range === "today" ? 24 : 14} />
              ) : (
                <div className="an-empty">
                  <b>Pas encore d&apos;historique</b>
                  <div className="an-note">Le graphique se remplit tout seul, heure après heure.</div>
                </div>
              )}
            </div>
            <div className="an-card">
              <h3>Comptes inscrits</h3>
              <div className="an-big">{fmt(snap.accounts)}</div>
              <div className="an-note">total dans la base</div>
              <div className="an-meter"><div style={{ width: `${percent}%` }} /></div>
              <div className="an-note"><b style={{ color: "var(--color-text)", fontWeight: 600 }}>{percent} %</b> de tes comptes sont en ligne</div>
              <div style={{ marginTop: 10 }}>
                <div className="an-row"><span>Actifs aujourd&apos;hui</span><b>{fmt(snap.activeToday)}</b></div>
                <div className="an-row"><span>Actifs sur 7 jours</span><b>{fmt(snap.active7)}</b></div>
                <div className="an-row"><span>Actifs sur 30 jours</span><b>{fmt(snap.active30)}</b></div>
                <div className="an-row"><span>Jamais ouvert le launcher</span><b>{fmt(snap.neverLauncher)}</b></div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="an-card an-privacy">
        <b style={{ fontWeight: 600 }}>Vie privée</b>
        <ul>
          <li>Aucune adresse IP n&apos;est enregistrée.</li>
          <li>Launcher : le compte déjà connecté (aucune donnée en plus).</li>
          <li>Site : un identifiant au hasard dans le navigateur, changé à chaque visite et effacé du site au bout de {SITE_WINDOW_MIN} min sans signe de vie.</li>
          <li>On ne garde que des totaux par heure et par jour, jamais qui a fait quoi.</li>
        </ul>
      </div>

      {howOpen ? (
        <div className="an-modal-bg" onClick={(e) => e.target === e.currentTarget && setHowOpen(false)}>
          <div className="an-modal" role="dialog" aria-modal="true" aria-label="Comment on sait qui est en ligne">
            <h2>Comment on sait qui est en ligne</h2>
            <p><b>Launcher</b> : il envoie déjà un petit signal « je suis là » toutes les 3 minutes (5 min en jeu ou fenêtre réduite). On compte les comptes dont le dernier signal a moins de {windowMin} minutes. « En jeu » veut dire en partie sur un serveur public de l&apos;annuaire : le launcher n&apos;envoie rien de plus pour le solo et les serveurs privés. « Actifs » et « Jamais ouvert le launcher » se lisent aussi dans ces signaux.</p>
            <p><b>Site</b> : un onglet visible envoie un signal toutes les minutes avec un identifiant tiré au hasard, gardé dans le navigateur. Onglet fermé ou caché = plus de signal, la personne disparaît au bout de {SITE_WINDOW_MIN} minutes. Si la personne est connectée, on utilise son compte : elle n&apos;est comptée qu&apos;une fois, même avec 3 onglets ou le launcher ouvert en même temps. Un bloqueur de publicité peut empêcher ce signal.</p>
            <p><b>Pics</b> : enregistrés quand un visiteur envoie un signal ou que cette page est ouverte. S&apos;il n&apos;y a ni l&apos;un ni l&apos;autre, l&apos;heure reste vide, même si des joueurs sont dans le launcher.</p>
            <p><b>Pas d&apos;IP</b>, pas de cookie publicitaire, pas d&apos;outil externe. Les identifiants au hasard sont effacés du site après {SITE_WINDOW_MIN} minutes ; seuls les totaux (pic par heure et par jour) restent.</p>
            <div style={{ textAlign: "right", marginTop: 10 }}>
              <button type="button" className="an-btn" onClick={() => setHowOpen(false)}>Fermer</button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? <div className="an-toast" role="status">{toast}</div> : null}
    </div>
  );
}
