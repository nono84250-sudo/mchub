"use client";

import { useMemo, useState } from "react";
import type { AdminBugEntry, BugCategory, BugFix, BugStatus, BugWhere } from "@/lib/bugCatalog";

// Page « Bugs » du panel (/admin/bugs, 31/10, preview validée par Rushi) : la liste des fiches à
// gauche, la fiche à droite. Rien ne part avant « Enregistrer » ; les launchers reçoivent les fiches
// publiées sous 10 minutes, sans republier le site.

type Lang = "fr" | "en";
type Draft = Omit<AdminBugEntry, "id" | "createdAt" | "updatedAt" | "stats"> & { id: string | null; createdAt: string; updatedAt: string; stats: AdminBugEntry["stats"] };

const STATUS: Record<BugStatus, string> = { auto: "Se corrige tout seul", consent: "Réparation proposée", manual: "À corriger à la main", analyse: "En cours d'analyse" };
const STATUS_HELP: Record<BugStatus, string> = {
  auto: "Le launcher corrige sans rien demander. Le joueur ne voit rien, ou un petit message si tu coches la case.",
  consent: "Le launcher propose « Corriger » au joueur. Rien ne change sans son clic.",
  manual: "Le launcher affiche la marche à suivre.",
  analyse: "Pas encore de solution : jamais montrée aux joueurs, même publiée.",
};
const CATEGORY: Record<BugCategory, string> = { mods: "Mods et packs", curseforge: "CurseForge", crash: "Le jeu plante", launcher: "Launcher", dev: "Équipe (dev)" };
const FIX: Record<BugFix, string> = {
  none: "Aucune",
  ignore: "Corrigé dans le code du launcher (rien à faire)",
  loader: "Changer la version du chargeur",
  remove: "Retirer un mod",
  replace: "Remplacer un mod par un autre (Modrinth)",
  update: "Mettre un mod à jour (Modrinth)",
  redownload: "Retélécharger les fichiers du jeu",
  cache: "Vider le cache du launcher",
};
const ARG_LABEL: Partial<Record<BugFix, string>> = { loader: "Version du chargeur", remove: "Mod à retirer", replace: "Mod → remplaçant", update: "Mod à mettre à jour" };
const WHERE: Record<BugWhere, string> = { log: "Journal du jeu (latest.log)", crash: "Rapport de plantage (crash-reports)", launcher: "Erreur du launcher" };
const LOADERS = [["", "Tous"], ["fabric", "Fabric"], ["forge", "Forge"], ["neoforge", "NeoForge"], ["quilt", "Quilt"]] as const;
const FILTERS = [["all", "Toutes"], ["auto", STATUS.auto], ["consent", STATUS.consent], ["manual", STATUS.manual], ["analyse", STATUS.analyse], ["internal", "Équipe seulement"], ["draft", "Brouillons"]] as const;
type Filter = (typeof FILTERS)[number][0];

const inFilter = (f: AdminBugEntry, k: Filter) => k === "all" || (k === "internal" ? f.visibility === "internal" : k === "draft" ? !f.published : f.status === k);
const empty = { fr: "", en: "" };
const blank = (): Draft => ({
  id: null,
  slug: "",
  status: "analyse",
  visibility: "player",
  hasGuide: false,
  notify: true,
  published: false,
  category: "crash",
  title: { fr: "Nouvelle fiche", en: "New card" },
  symptom: { ...empty },
  cause: { ...empty },
  fixAction: "none",
  fixArg: "",
  fixText: { ...empty },
  steps: { fr: [], en: [] },
  match: { where: "log", text: "", mc: "", loader: "" },
  fixedIn: "",
  logSample: "",
  createdAt: "",
  updatedAt: "",
  stats: { seen: 0, repaired: 0, refused: 0 },
});
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const frDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "");
// Même règle que le launcher : variantes séparées par « || », sans tenir compte des majuscules.
const markerFound = (marker: string, text: string) => marker.split("||").map((p) => p.trim().toLowerCase()).filter(Boolean).some((p) => text.toLowerCase().includes(p));

const CSS = `
  .bc-page { display: flex; flex-direction: column; gap: 14px; }
  .bc-page h1 { margin: 0; font-family: var(--font-heading); font-weight: 500; font-size: 24px; letter-spacing: -.01em; display: flex; align-items: center; gap: 10px; }
  .bc-test { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; color: var(--warn); background: color-mix(in srgb, var(--warn) 16%, transparent); }
  .bc-page .er-chip { border: 1px solid var(--color-divider); background: transparent; color: var(--muted); padding: 5px 12px; border-radius: 999px; font-size: 12.5px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
  .bc-page .er-chip b { font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
  .bc-page .er-chip.on { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
  .er-st { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
  .er-st.auto { background: color-mix(in srgb, var(--success) 16%, transparent); color: var(--success); }
  .er-st.consent { background: color-mix(in srgb, var(--color-accent) 16%, transparent); color: var(--color-accent); }
  .er-st.manual { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
  .er-st.analyse { background: var(--raised); color: var(--muted); }
  .er-st.draft { background: transparent; border: 1px dashed var(--color-divider); color: var(--muted); }
  .er-st.team { background: color-mix(in srgb, #b48ae0 18%, transparent); color: #b48ae0; }
  .er-card { cursor: pointer; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--color-divider); background: var(--color-surface); text-align: left; color: inherit; font: inherit; width: 100%; }
  .er-card.on { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface)); }
  .er-card h3 { margin: 0; font-family: var(--font-heading); font-weight: 500; font-size: 14.5px; line-height: 1.35; }
  .er-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); align-items: center; }
  .er-meta b { color: var(--color-text); font-weight: 600; }
  .er-panel { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; border-radius: var(--radius-md); border: 1px solid var(--color-divider); background: var(--color-surface); min-width: 0; }
  .ad-mini { border: 1px solid var(--color-divider); color: var(--color-text); background: transparent; padding: 6px 12px; border-radius: var(--radius-md); font: 500 12.5px var(--font-heading); cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
  .ad-mini.acc { border-color: var(--color-accent); color: var(--color-accent); }
  .ad-mini.dang { border-color: transparent; color: var(--danger); }
  .ad-mini.on { background: var(--raised); border-color: var(--color-text); }
  .ad-mini:disabled, .ad-mini[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
  .er-in { height: 36px; padding: 0 12px; background: var(--color-bg); border: 1px solid var(--color-divider); border-radius: var(--radius-md); color: var(--color-text); font-size: 13px; width: 100%; box-sizing: border-box; }
  select.er-in { padding: 0 8px; }
  .er-ta { min-height: 56px; padding: 9px 12px; background: var(--color-bg); border: 1px solid var(--color-divider); border-radius: var(--radius-md); color: var(--color-text); font-size: 13px; line-height: 1.5; resize: vertical; width: 100%; box-sizing: border-box; font-family: inherit; }
  .ad-note { margin: 0; font-size: 11.5px; color: var(--muted2, var(--muted)); line-height: 1.5; }
  .ad-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 5; padding: 10px 16px; border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-divider); font-size: 13px; box-shadow: var(--shadow-md); }
  .er-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 70px 20px; border: 1px dashed var(--color-divider); border-radius: var(--radius-md); }
  .er-empty h3 { margin: 0; font-family: var(--font-heading); font-weight: 500; font-size: 16px; }
  .er-empty p { margin: 0; color: var(--muted); font-size: 13.5px; max-width: 460px; line-height: 1.55; }
  .bc-f { display: flex; flex-direction: column; gap: 6px; }
  .bc-f > label, .bc-lbl { font-size: 12px; color: var(--muted); font-weight: 500; }
  .bc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .bc-row3 { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 10px; }
  .bc-opts { display: flex; gap: 6px; flex-wrap: wrap; }
  .bc-box { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-divider); background: var(--color-bg); }
  .bc-box h4 { margin: 0; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 600; }
  .bc-step { display: grid; grid-template-columns: 22px minmax(0,1fr) auto; gap: 8px; align-items: center; }
  .bc-step > span:first-child { font-size: 12px; font-weight: 700; color: var(--muted); text-align: center; }
  .bc-ic-btn { border: 1px solid var(--color-divider); background: transparent; color: var(--muted); width: 28px; height: 28px; border-radius: 7px; cursor: pointer; font-size: 13px; }
  .bc-ic-btn:disabled { opacity: .35; cursor: default; }
  .bc-check { display: flex; gap: 9px; align-items: flex-start; font-size: 13px; line-height: 1.45; cursor: pointer; }
  .bc-check input { margin-top: 3px; accent-color: var(--color-accent); }
  .bc-check small { display: block; color: var(--muted); font-size: 12px; }
  .bc-res { font-size: 12.5px; padding: 7px 10px; border-radius: var(--radius-md); }
  .bc-res.y { color: var(--success); background: color-mix(in srgb, var(--success) 10%, transparent); }
  .bc-res.n { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
  .bc-dirty { font-size: 12px; color: var(--warn); }
  .bc-lang { display: inline-flex; border: 1px solid var(--color-divider); border-radius: 8px; overflow: hidden; }
  .bc-lang button { background: transparent; border: 0; padding: 4px 10px; font: 600 12px var(--font-heading); color: var(--muted); cursor: pointer; }
  .bc-lang button.on { background: var(--raised); color: var(--color-text); }
  .bc-cols { display: grid; grid-template-columns: minmax(0,.85fr) minmax(0,1.35fr); gap: 18px; align-items: start; }
  @media (max-width: 900px) { .bc-cols, .bc-row, .bc-row3 { grid-template-columns: minmax(0,1fr); } }
`;

function Chips({ d }: { d: Pick<Draft, "status" | "visibility" | "published"> }) {
  return (
    <>
      <span className={`er-st ${d.status}`}>{STATUS[d.status]}</span>
      {d.visibility === "internal" ? <span className="er-st team">Équipe seulement</span> : null}
      {d.published ? null : <span className="er-st draft">Brouillon</span>}
    </>
  );
}

export function AdminBugCatalog({ initial, missingTables }: { initial: AdminBugEntry[]; missingTables: boolean }) {
  const [list, setList] = useState<AdminBugEntry[]>(initial);
  const [sel, setSel] = useState<string | null>(initial[0]?.id ?? null);
  const [draft, setDraft] = useState<Draft | null>(initial[0] ? structuredClone(initial[0]) : null);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<Lang>("fr");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [tryText, setTryText] = useState(initial[0]?.logSample ?? "");
  const [tryResult, setTryResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((f) => inFilter(f, filter) && (!term || `${f.title.fr} ${f.title.en} ${f.match.text} ${f.slug}`.toLowerCase().includes(term)));
  }, [list, filter, q]);

  const say = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? "" : t)), 3600);
  };
  const open = (entry: Draft) => {
    setDraft(structuredClone(entry));
    setSel(entry.id);
    setDirty(false);
    setTryText(entry.logSample);
    setTryResult(null);
    setConfirmDelete(false);
  };
  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };
  const editLang = (key: "title" | "symptom" | "cause" | "fixText", value: string) => {
    setDraft((d) => (d ? { ...d, [key]: { ...d[key], [lang]: value } } : d));
    setDirty(true);
  };
  const editSteps = (steps: string[]) => {
    setDraft((d) => (d ? { ...d, steps: { ...d.steps, [lang]: steps } } : d));
    setDirty(true);
  };
  const editMatch = (patch: Partial<Draft["match"]>) => {
    setDraft((d) => (d ? { ...d, match: { ...d.match, ...patch } } : d));
    setDirty(true);
  };

  async function send(url: string, method: string, body?: unknown): Promise<{ id?: string; entries: AdminBugEntry[] } | null> {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const out = await res.json().catch(() => null);
      if (!res.ok || !out?.ok) {
        say(out?.error || "Impossible d'enregistrer, réessaie dans un instant.");
        return null;
      }
      setList(out.entries);
      return out;
    } catch {
      say("Le site ne répond pas, réessaie dans un instant.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<string | null> {
    if (!draft) return null;
    const payload = { ...draft, slug: draft.slug || slugify(draft.title.fr), logSample: tryText };
    const out = draft.id ? await send(`/api/admin/bugs/${encodeURIComponent(draft.id)}`, "PUT", payload) : await send("/api/admin/bugs", "POST", payload);
    if (!out) return null;
    const saved = out.entries.find((e) => e.id === (draft.id ?? out.id));
    if (saved) {
      setDraft(structuredClone(saved));
      setSel(saved.id);
    }
    setDirty(false);
    return saved?.id ?? null;
  }

  async function togglePublish() {
    if (!draft) return;
    const next = !draft.published;
    const id = dirty || !draft.id ? await save() : draft.id;
    if (!id) return;
    const out = await send(`/api/admin/bugs/${encodeURIComponent(id)}`, "PATCH", { published: next });
    const saved = out?.entries.find((e) => e.id === id);
    if (!saved) return;
    setDraft(structuredClone(saved));
    say(next ? (saved.status === "analyse" ? "Publiée, mais « En cours d'analyse » : toujours cachée aux joueurs." : "Publiée : launchers et page « Bugs connus » à jour sous 10 minutes.") : "Repassée en brouillon : retirée des launchers et du site.");
  }

  async function remove() {
    if (!draft?.id) {
      const first = list[0];
      if (first) open(first);
      else {
        setDraft(null);
        setSel(null);
      }
      return;
    }
    const out = await send(`/api/admin/bugs/${encodeURIComponent(draft.id)}`, "DELETE");
    if (!out) return;
    const first = out.entries[0];
    if (first) open(first);
    else {
      setDraft(null);
      setSel(null);
    }
    say("Fiche supprimée.");
  }

  function testMarker() {
    if (!draft) return;
    if (!draft.match.text.trim()) return setTryResult({ ok: false, text: "Écris d'abord une phrase repère." });
    if (!markerFound(draft.match.text, tryText)) return setTryResult({ ok: false, text: "✗ Pas reconnu : la phrase repère n'est pas dans ce journal." });
    setTryResult({ ok: true, text: `✓ Reconnu : le launcher afficherait cette fiche${draft.match.mc || draft.match.loader ? " (si la version et le chargeur collent aussi)" : ""}.` });
  }

  const newCard = () => {
    open(blank());
    setDirty(true);
    setFilter("all");
    setQ("");
    say("Nouvelle fiche en brouillon.");
  };

  const head = (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1>
          Bugs <span className="bc-test">Test</span>
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>Le catalogue des bugs connus, au même endroit.</p>
      </div>
      <p className="ad-note" style={{ fontSize: 13 }}>
        Chaque bug réglé devient une fiche. Le launcher la reconnaît chez le joueur et le corrige tout seul, propose de le corriger, ou montre la marche à suivre. Les fiches « Joueurs » apparaissent aussi sur la page publique « Bugs connus ».
      </p>
    </>
  );

  if (missingTables) {
    return (
      <div className="bc-page">
        <style>{CSS}</style>
        {head}
        <div className="er-empty">
          <h3>Tables du catalogue absentes</h3>
          <p>La migration d1/migrations/2026-10-31-catalogue-bugs.sql n&apos;a pas encore été passée sur cette base.</p>
        </div>
      </div>
    );
  }

  const steps = draft?.steps[lang] ?? [];
  const showFix = draft?.status === "auto" || draft?.status === "consent";
  const canView = draft?.id && draft.visibility === "player" && draft.published && draft.status !== "analyse";
  const canTry = canView && !dirty && draft?.status !== "auto";

  return (
    <div className="bc-page">
      <style>{CSS}</style>
      {head}
      {!list.length && !draft ? (
        <div className="er-empty">
          <h3>Aucune fiche pour l&apos;instant</h3>
          <p>Crée une fiche à la main dès qu&apos;un bug est réglé.</p>
          <button type="button" className="ad-mini acc" onClick={newCard}>
            + Nouvelle fiche
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {FILTERS.map(([k, label]) => (
              <button key={k} type="button" className={`er-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>
                {label} <b>{list.filter((x) => inFilter(x, k)).length}</b>
              </button>
            ))}
            <input className="er-in" placeholder="Chercher (titre, phrase repère)" aria-label="Chercher une fiche" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginLeft: "auto", width: 220 }} />
            <button type="button" className="ad-mini acc" onClick={newCard}>
              + Nouvelle fiche
            </button>
          </div>
          <div className="bc-cols">
            <section style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              {visible.length ? (
                visible.map((x) => (
                  <button key={x.id} type="button" className={`er-card ${x.id === sel ? "on" : ""}`} onClick={() => open(x)}>
                    <h3>{x.title.fr}</h3>
                    <span className="er-meta">
                      <Chips d={x} />
                      {x.id === sel && dirty ? <span className="bc-dirty">●</span> : null}
                    </span>
                    <span className="er-meta">
                      <span>{CATEGORY[x.category]}</span>
                      <span>
                        reconnue <b>{x.stats.seen}</b>
                      </span>
                      {x.hasGuide ? <span>guide complet</span> : null}
                    </span>
                  </button>
                ))
              ) : (
                <p className="ad-note" style={{ padding: "20px 4px" }}>
                  Rien dans ce filtre.
                </p>
              )}
            </section>
            {draft ? (
              <section className="er-panel">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 15, flex: 1, minWidth: 0 }}>{draft.title.fr || draft.title.en}</h2>
                  <Chips d={draft} />
                </div>
                <div className="er-meta">
                  <span>
                    Reconnue <b>{draft.stats.seen}</b> fois (7 j)
                  </span>
                  {draft.status === "consent" ? (
                    <>
                      <span>
                        Réparée <b>{draft.stats.repaired}</b>
                      </span>
                      <span>
                        Refusée <b>{draft.stats.refused}</b>
                      </span>
                    </>
                  ) : null}
                  {draft.updatedAt ? <span>Modifiée le {frDate(draft.updatedAt)}</span> : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="bc-lbl">Texte de la fiche en</span>
                  <div className="bc-lang">
                    {(["fr", "en"] as const).map((l) => (
                      <button key={l} type="button" className={lang === l ? "on" : ""} onClick={() => setLang(l)}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {dirty ? <span className="bc-dirty" style={{ marginLeft: "auto" }}>● Pas encore enregistré</span> : null}
                </div>
                <div className="bc-f">
                  <label htmlFor="bc-title">Titre (ce que le joueur cherche)</label>
                  <input className="er-in" id="bc-title" value={draft.title[lang]} onChange={(e) => editLang("title", e.target.value)} />
                </div>
                <div className="bc-row">
                  <div className="bc-f">
                    <label htmlFor="bc-slug">Adresse de la page (/aide/bugs/…)</label>
                    <input className="er-in" id="bc-slug" value={draft.slug} placeholder={slugify(draft.title.fr)} onChange={(e) => edit({ slug: e.target.value.toLowerCase() })} />
                  </div>
                  <div className="bc-f">
                    <label htmlFor="bc-cat">Catégorie</label>
                    <select className="er-in" id="bc-cat" value={draft.category} onChange={(e) => edit({ category: e.target.value as BugCategory })}>
                      {Object.entries(CATEGORY).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="bc-f">
                  <span className="bc-lbl">Statut</span>
                  <div className="bc-opts">
                    {(Object.keys(STATUS) as BugStatus[]).map((s) => (
                      <button key={s} type="button" className={`ad-mini ${draft.status === s ? "on" : ""}`} onClick={() => edit({ status: s, fixAction: s === "consent" && (draft.fixAction === "none" || draft.fixAction === "ignore") ? "loader" : draft.fixAction })}>
                        {STATUS[s]}
                      </button>
                    ))}
                  </div>
                  <p className="ad-note">{STATUS_HELP[draft.status]}</p>
                </div>
                <div className="bc-f">
                  <span className="bc-lbl">Visible par</span>
                  <div className="bc-opts">
                    <button type="button" className={`ad-mini ${draft.visibility === "player" ? "on" : ""}`} onClick={() => edit({ visibility: "player" })}>
                      Joueurs
                    </button>
                    <button type="button" className={`ad-mini ${draft.visibility === "internal" ? "on" : ""}`} onClick={() => edit({ visibility: "internal" })}>
                      Équipe seulement
                    </button>
                  </div>
                </div>
                {draft.visibility === "player" ? (
                  <label className="bc-check">
                    <input type="checkbox" checked={draft.hasGuide} onChange={(e) => edit({ hasGuide: e.target.checked })} />
                    <span>
                      Gros bug : guide complet sur le site
                      <small>Le launcher ajoute un bouton « Ouvrir la page d&apos;aide » qui mène à la page du site.</small>
                    </span>
                  </label>
                ) : null}
                {draft.status === "auto" ? (
                  <label className="bc-check">
                    <input type="checkbox" checked={draft.notify} onChange={(e) => edit({ notify: e.target.checked })} />
                    <span>
                      Prévenir le joueur avec un petit message
                      <small>Décoché : le joueur ne voit rien du tout.</small>
                    </span>
                  </label>
                ) : null}
                <div className="bc-f">
                  <label htmlFor="bc-sym">Ce que voit le joueur</label>
                  <textarea className="er-ta" id="bc-sym" value={draft.symptom[lang]} onChange={(e) => editLang("symptom", e.target.value)} />
                </div>
                <div className="bc-f">
                  <label htmlFor="bc-cause">Pourquoi</label>
                  <textarea className="er-ta" id="bc-cause" value={draft.cause[lang]} onChange={(e) => editLang("cause", e.target.value)} />
                </div>
                {showFix ? (
                  <div className="bc-box">
                    <h4>{draft.status === "auto" ? "Correction" : "Réparation proposée au joueur"}</h4>
                    <div className="bc-row">
                      <div className="bc-f">
                        <label htmlFor="bc-fix">Geste</label>
                        <select className="er-in" id="bc-fix" value={draft.fixAction} onChange={(e) => edit({ fixAction: e.target.value as BugFix })}>
                          {(Object.keys(FIX) as BugFix[])
                            .filter((k) => draft.status === "auto" || (k !== "none" && k !== "ignore"))
                            .map((k) => (
                              <option key={k} value={k}>
                                {FIX[k]}
                              </option>
                            ))}
                        </select>
                      </div>
                      {ARG_LABEL[draft.fixAction] ? (
                        <div className="bc-f">
                          <label htmlFor="bc-arg">{ARG_LABEL[draft.fixAction]}</label>
                          <input className="er-in" id="bc-arg" value={draft.fixArg} onChange={(e) => edit({ fixArg: e.target.value })} />
                        </div>
                      ) : draft.status === "auto" ? (
                        <div className="bc-f">
                          <label htmlFor="bc-ver">Corrigé dans le launcher</label>
                          <input className="er-in" id="bc-ver" value={draft.fixedIn} placeholder="0.4.2" onChange={(e) => edit({ fixedIn: e.target.value })} />
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>
                    <div className="bc-f">
                      <label htmlFor="bc-fixt">Phrase montrée au joueur</label>
                      <textarea className="er-ta" id="bc-fixt" style={{ minHeight: 44 }} value={draft.fixText[lang]} onChange={(e) => editLang("fixText", e.target.value)} />
                    </div>
                    <p className="ad-note">Seulement des gestes sûrs, choisis dans cette liste : jamais toucher aux mondes, sauvegarde du dossier mods avant, rien sans le clic du joueur (sauf « corrigé dans le code »).</p>
                  </div>
                ) : null}
                {draft.status !== "auto" ? (
                  <div className="bc-box">
                    <h4>{draft.status === "consent" ? "Le faire soi-même (facultatif)" : draft.status === "analyse" ? "En attendant" : "Marche à suivre"}</h4>
                    {steps.length ? (
                      steps.map((s, i) => (
                        <div className="bc-step" key={i}>
                          <span>{i + 1}</span>
                          <input className="er-in" aria-label={`Étape ${i + 1}`} value={s} onChange={(e) => editSteps(steps.map((x, k) => (k === i ? e.target.value : x)))} />
                          <span style={{ display: "flex", gap: 4 }}>
                            <button type="button" className="bc-ic-btn" disabled={!i} aria-label="Monter" onClick={() => editSteps(steps.map((x, k) => (k === i ? steps[i - 1] : k === i - 1 ? steps[i] : x)))}>
                              ↑
                            </button>
                            <button type="button" className="bc-ic-btn" disabled={i === steps.length - 1} aria-label="Descendre" onClick={() => editSteps(steps.map((x, k) => (k === i ? steps[i + 1] : k === i + 1 ? steps[i] : x)))}>
                              ↓
                            </button>
                            <button type="button" className="bc-ic-btn" aria-label="Retirer" onClick={() => editSteps(steps.filter((_, k) => k !== i))}>
                              ×
                            </button>
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="ad-note">Aucune étape.</p>
                    )}
                    <div>
                      <button type="button" className="ad-mini" onClick={() => editSteps([...steps, ""])}>
                        + Ajouter une étape
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="bc-box">
                  <h4>Comment le launcher la reconnaît</h4>
                  <div className="bc-row3">
                    <div className="bc-f">
                      <label htmlFor="bc-where">Où chercher</label>
                      <select className="er-in" id="bc-where" value={draft.match.where} onChange={(e) => editMatch({ where: e.target.value as BugWhere })}>
                        {Object.entries(WHERE).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bc-f">
                      <label htmlFor="bc-mc">Minecraft</label>
                      <input className="er-in" id="bc-mc" value={draft.match.mc} placeholder="toutes" onChange={(e) => editMatch({ mc: e.target.value })} />
                    </div>
                    <div className="bc-f">
                      <label htmlFor="bc-ld">Chargeur</label>
                      <select className="er-in" id="bc-ld" value={draft.match.loader} onChange={(e) => editMatch({ loader: e.target.value })}>
                        {LOADERS.map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="bc-f">
                    <label htmlFor="bc-text">Phrase repère (texte exact cherché ; plusieurs variantes séparées par « || »)</label>
                    <input className="er-in" id="bc-text" style={{ fontFamily: "ui-monospace,Consolas,monospace", fontSize: 12.5 }} value={draft.match.text} onChange={(e) => editMatch({ text: e.target.value })} />
                  </div>
                  <div className="bc-f">
                    <label htmlFor="bc-try">Tester sur un journal (colle un extrait, gardé comme exemple sur la page du site)</label>
                    <textarea className="er-ta" id="bc-try" style={{ font: "11.5px/1.5 ui-monospace,Consolas,monospace" }} value={tryText} onChange={(e) => { setTryText(e.target.value); setDirty(true); }} />
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button type="button" className="ad-mini" onClick={testMarker}>
                        Tester
                      </button>
                      {tryResult ? <span className={`bc-res ${tryResult.ok ? "y" : "n"}`} role="status">{tryResult.text}</span> : null}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" className="ad-mini acc" disabled={busy} onClick={async () => { const id = await save(); if (id) say(draft.published ? "Enregistré. Les launchers l'auront dans les 10 minutes, sans republier le site." : "Brouillon enregistré (les joueurs ne le voient pas)."); }}>
                    <i className="ph ph-check-circle" /> Enregistrer
                  </button>
                  <button type="button" className="ad-mini" disabled={busy} onClick={togglePublish}>
                    {draft.published ? "Repasser en brouillon" : "Publier"}
                  </button>
                  {canTry ? (
                    <a className="ad-mini" href={`omniscient://test-bug/${draft.slug}`} title="Ouvre la fenêtre de cette fiche dans ton launcher (sans réparer). La fiche doit déjà être reçue par le launcher : jusqu'à 10 minutes après l'avoir publiée.">
                      Essayer dans le launcher
                    </a>
                  ) : (
                    <button type="button" className="ad-mini" disabled title="Seulement pour une fiche enregistrée, publiée, visible par les joueurs, avec une fenêtre à montrer">
                      Essayer dans le launcher
                    </button>
                  )}
                  {canView ? (
                    <a className="ad-mini" href={`/aide/bugs/${draft.slug}`} target="_blank" rel="noreferrer">
                      Voir la page du site
                    </a>
                  ) : (
                    <button type="button" className="ad-mini" disabled title="Seulement pour une fiche publiée, visible par les joueurs, avec une solution">
                      Voir la page du site
                    </button>
                  )}
                  <button type="button" className="ad-mini dang" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => setConfirmDelete(true)}>
                    <i className="ph ph-x" /> Supprimer
                  </button>
                </div>
                {confirmDelete ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", background: "var(--raised)" }}>
                    <p style={{ margin: 0, fontSize: 13 }}>Supprimer cette fiche ? Les launchers l&apos;oublient sous 10 minutes. Mieux vaut souvent la repasser en brouillon.</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="ad-mini dang" style={{ borderColor: "var(--danger)" }} disabled={busy} onClick={remove}>
                        Oui, supprimer
                      </button>
                      <button type="button" className="ad-mini" onClick={() => setConfirmDelete(false)}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : null}
                <p className="ad-note">Les launchers reçoivent les fiches publiées par l&apos;API au démarrage puis toutes les 10 minutes, et les gardent pour jouer hors ligne. Modifier ou publier une fiche ne demande pas de republier le site.</p>
              </section>
            ) : null}
          </div>
        </>
      )}
      {toast ? <div className="ad-toast" role="status">{toast}</div> : null}
    </div>
  );
}
