"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Page Laboratoire (/admin/laboratoire, 25/10, preview validée par Rushi) : un interrupteur à 5
// états par fonctionnalité, les comptes testeurs, et ce que voit chaque type de joueur dans le
// menu du launcher. Rien n'est appliqué avant « Enregistrer les modifications » ; ouvrir à tout
// le monde ou cacher demande une confirmation dans la page.

type State = "hidden" | "test" | "betaTesters" | "beta" | "all";
type Section = "worldsSaves" | "importPack" | "buildPack" | "playPage" | "comfort";
type Feature = {
  id: string;
  parent?: string;
  state: State;
  where: ("site" | "launcher")[];
  minLauncher?: string;
  group: "play" | "social" | "launcher";
  section?: Section;
  name: { fr: string };
  description: { fr: string };
  updatedAt: string | null;
};
type Tester = { uuid: string; name: string };
type Lab = { features: Feature[]; testers: Tester[] };

const STATES: State[] = ["hidden", "test", "betaTesters", "beta", "all"];
const RANK: Record<State, number> = { hidden: 0, test: 1, betaTesters: 2, beta: 3, all: 4 };
const LABEL: Record<State, string> = { hidden: "Cachée", test: "Test", betaTesters: "Bêta testeurs", beta: "Bêta publique", all: "Pour tous" };
const HELP: Record<State, string> = {
  hidden: "personne ne la voit, le site refuse ses appels",
  test: "seulement les comptes testeurs",
  betaTesters: "joueurs du launcher bêta, avec badge",
  beta: "tout le monde, avec badge bêta",
  all: "tout le monde, sans badge",
};
const COLOR: Record<State, string> = {
  hidden: "var(--muted)",
  test: "#f0b25a",
  betaTesters: "#6fb4f0",
  beta: "var(--color-accent-400, #b5abfc)",
  all: "var(--success)",
};
const ICON: Record<State, string> = { hidden: "ph-eye-slash", test: "ph-flask", betaTesters: "ph-users-three", beta: "ph-sparkle", all: "ph-check-circle" };
const GROUPS: { id: Feature["group"]; label: string }[] = [
  { id: "play", label: "Jouer et mondes" },
  { id: "social", label: "Joueurs et teams" },
  { id: "launcher", label: "Launcher" },
];
// 31/10 (preview « Laboratoire regroupé » validée par Rushi) : les fonctions de « Jouer et mondes »
// sont rangées par section, sous l'interrupteur principal. Une fonction sans section va dans « Autres ».
const MASTER = "play";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "worldsSaves", label: "Mondes et sauvegardes" },
  { id: "importPack", label: "Importer un pack" },
  { id: "buildPack", label: "Créer son pack" },
  { id: "playPage", label: "Page Jouer et versions" },
  { id: "comfort", label: "Confort et aide" },
];
const OTHER = { id: "other", label: "Autres" };
type Viewer = "player" | "betaPlayer" | "tester";
const VIEWERS: { id: Viewer; label: string; sub: string }[] = [
  { id: "player", label: "Un joueur", sub: "launcher normal (version stable)" },
  { id: "betaPlayer", label: "Un joueur bêta", sub: "launcher bêta (0.4.0-beta…)" },
  { id: "tester", label: "Un compte testeur", sub: "pseudo dans la liste, launcher officiel" },
];

function effective(id: string, states: Record<string, State>, features: Feature[]): State {
  const f = features.find((x) => x.id === id);
  if (!f) return "hidden";
  const own = states[id] ?? f.state;
  if (!f.parent) return own;
  const parent = effective(f.parent, states, features);
  return RANK[own] > RANK[parent] ? parent : own;
}
function visibleFor(state: State, viewer: Viewer): boolean {
  if (state === "all" || state === "beta") return true;
  if (state === "betaTesters") return viewer !== "player";
  if (state === "test") return viewer === "tester";
  return false;
}
const dateFr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "jamais (valeur par défaut)";
const functions = (n: number) => (n > 1 ? `${n} fonctions` : "1 fonction");
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Surligne le mot cherché dans le texte d'origine : les positions trouvées dans le texte sans
// accents sont ramenées à celles du texte affiché.
function highlight(text: string, needle: string): React.ReactNode {
  if (!needle) return text;
  let folded = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const part = fold(text[i]);
    for (let j = 0; j < part.length; j++) origin.push(i);
    folded += part;
  }
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (let at = folded.indexOf(needle); at !== -1; at = folded.indexOf(needle, at + needle.length)) {
    const start = Math.max(origin[at], last);
    const end = origin[at + needle.length - 1] + 1;
    parts.push(text.slice(last, start), <mark key={at} className="lab-hit">{text.slice(start, end)}</mark>);
    last = end;
  }
  parts.push(text.slice(last));
  return parts;
}

// Chaque enfant juste sous son parent (ex. vanillaModded sous vanillaPage), le reste dans l'ordre du catalogue.
function ordered(items: Feature[]): Feature[] {
  const ids = new Set(items.map((f) => f.id));
  const out: Feature[] = [];
  const add = (f: Feature) => {
    out.push(f);
    items.filter((c) => c.parent === f.id).forEach(add);
  };
  items.filter((f) => !f.parent || !ids.has(f.parent)).forEach(add);
  return out;
}

function GroupHead(props: { name: string; ids: string[]; draft: Record<string, State>; saved: Record<string, State>; expanded: boolean; top?: boolean; onToggle: () => void }) {
  const { name, ids, draft, saved, expanded, top, onToggle } = props;
  const changes = ids.filter((id) => draft[id] !== saved[id]).length;
  return (
    <button type="button" className={`lab-head${top ? " top" : ""}`} aria-expanded={expanded} onClick={onToggle}>
      <i className="ph ph-caret-right lab-chev" aria-hidden="true" />
      <span className="lab-head-name">{name}</span>
      <span className="lab-head-count">{functions(ids.length)}</span>
      {changes ? <span className="lab-chg">{changes > 1 ? `${changes} changements` : "1 changement"}</span> : null}
      <span className="lab-sum">
        {STATES.map((s) => {
          const count = ids.filter((id) => draft[id] === s).length;
          return count ? (
            <span key={s}>
              <span className="lab-dot" style={{ background: COLOR[s] }} />
              {count} {LABEL[s]}
            </span>
          ) : null;
        })}
      </span>
    </button>
  );
}

const card: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-lg)", padding: 20, minWidth: 0 };
const btn = (solid = false): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: "var(--radius-md)",
  border: `1px solid ${solid ? "var(--color-accent)" : "var(--color-divider)"}`,
  background: solid ? "var(--color-accent)" : "transparent",
  color: solid ? "var(--color-accent-100)" : "var(--color-text)",
  cursor: "pointer",
  font: "inherit",
  fontSize: 13,
  whiteSpace: "nowrap",
});

const CSS = `
.lab-wrap { container-type: inline-size; }
.lab-grid { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); align-items: start; }
@container (min-width: 980px) { .lab-grid { grid-template-columns: minmax(0, 1fr) 320px; } }
.lab-feat { border: 1px solid var(--color-divider); border-radius: var(--radius-md); padding: 12px 14px; display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
.lab-feat + .lab-feat { margin-top: 8px; }
.lab-feat.child { margin-left: 22px; border-style: dashed; }
.lab-feat.master { margin-bottom: 10px; background: color-mix(in srgb, var(--color-accent) 6%, transparent); }
.lab-list { container-type: inline-size; min-width: 0; }
@container (max-width: 820px) { .lab-feat { grid-template-columns: minmax(0, 1fr); } .lab-feat.child { margin-left: 10px; } }
.lab-tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.lab-search { flex: 1; min-width: 200px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--color-divider); border-radius: var(--radius-md); background: var(--color-surface); color: var(--muted); }
.lab-search:focus-within { border-color: var(--color-accent); }
.lab-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--color-text); font: inherit; padding: 8px 0; }
.lab-cat { background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: var(--radius-lg); margin-bottom: 14px; overflow: hidden; }
.lab-cat-body { padding: 0 16px 16px; }
.lab-sub { border: 1px solid var(--color-divider); border-radius: var(--radius-md); margin-top: 8px; overflow: hidden; }
.lab-sub-body { padding: 4px 12px 12px; }
.lab-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; width: 100%; padding: 11px 12px; border: 0; background: transparent; color: var(--color-text); font: inherit; text-align: left; cursor: pointer; }
.lab-head.top { padding: 14px 16px; }
.lab-head:hover { background: var(--raised); }
.lab-head:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.lab-head-name { font-weight: 500; }
.lab-head.top .lab-head-name { font-size: 15px; }
.lab-head-count { font-size: 12px; color: var(--muted2); }
.lab-chev { color: var(--muted); transition: transform .15s; }
.lab-head[aria-expanded="true"] .lab-chev { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .lab-chev { transition: none; } }
.lab-chg { font-size: 11px; padding: 1px 7px; border-radius: 999px; font-weight: 500; color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 18%, transparent); }
.lab-sum { margin-left: auto; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px 10px; font-size: 12px; color: var(--muted); }
.lab-sum > span { display: inline-flex; align-items: center; gap: 5px; }
.lab-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex: none; }
.lab-bulk { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; padding: 8px 10px; margin-bottom: 8px; border-radius: var(--radius-md); background: var(--raised); font-size: 12.5px; color: var(--muted); }
.lab-bulk em { font-style: normal; color: var(--muted2); }
.lab-hit { background: color-mix(in srgb, #f0b25a 35%, transparent); border-radius: 3px; color: inherit; }
.lab-states { display: inline-flex; flex-wrap: wrap; gap: 3px; border: 1px solid var(--color-divider); border-radius: var(--radius-md); padding: 3px; background: var(--color-bg); }
.lab-states button { border: 0; background: transparent; padding: 5px 9px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 12.5px; color: var(--muted); display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; }
.lab-states button:hover { color: var(--color-text); }
.lab-states button[aria-pressed="true"] { color: var(--c); background: color-mix(in srgb, var(--c) 15%, transparent); font-weight: 500; }
.lab-states.sm button { padding: 4px 8px; font-size: 12px; }
.lab-states button.mixed { outline: 1px dashed color-mix(in srgb, var(--c) 60%, transparent); outline-offset: -1px; color: var(--c); }
`;

export function AdminFeatureLab({ initial }: { initial: Lab }) {
  const [lab, setLab] = useState(initial);
  const saved = useMemo(() => Object.fromEntries(lab.features.map((f) => [f.id, f.state])) as Record<string, State>, [lab]);
  const [draft, setDraft] = useState<Record<string, State>>(saved);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [viewer, setViewer] = useState<Viewer>("tester");
  const [testerError, setTesterError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ cat_play: true });
  const [query, setQuery] = useState("");

  const features = lab.features;
  const dirty = features.filter((f) => draft[f.id] !== saved[f.id]);
  const toAll = dirty.filter((f) => draft[f.id] === "all").map((f) => f.name.fr);
  const toHidden = dirty.filter((f) => draft[f.id] === "hidden").map((f) => f.name.fr);

  // Pendant une recherche, tout ce qui correspond est déplié et le reste masqué. Toucher à un
  // groupe ou à « Tout déplier / replier » quitte la recherche.
  const needle = fold(query.trim());
  const searching = needle !== "";
  const matches = (f: Feature) => !searching || fold(f.name.fr).includes(needle) || fold(f.description.fr).includes(needle);
  const resultCount = features.filter(matches).length;

  function toggle(key: string) {
    if (searching) setQuery("");
    setOpen((o) => ({ ...o, [key]: searching ? false : !o[key] }));
  }

  function setAll(value: boolean) {
    setQuery("");
    const keys = [...GROUPS.map((g) => `cat_${g.id}`), ...[...SECTIONS, OTHER].map((s) => `sec_${s.id}`)];
    setOpen(Object.fromEntries(keys.map((k) => [k, value])));
  }

  function change(patch: Record<string, State>) {
    setDraft((d) => ({ ...d, ...patch }));
    setConfirming(false);
    setJustSaved(false);
  }

  function renderFeature(f: Feature, master = false) {
    const parent = f.parent ? features.find((x) => x.id === f.parent) : null;
    const capped = !!parent && RANK[draft[f.id]] > RANK[effective(parent.id, draft, features)];
    const child = !!f.parent && f.parent !== MASTER;
    return (
      <div key={f.id} className={`lab-feat${child ? " child" : ""}${master ? " master" : ""}`} style={draft[f.id] !== saved[f.id] ? { boxShadow: "0 0 0 1px var(--color-accent) inset" } : undefined}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 8px" }}>
            <span>{highlight(f.name.fr, needle)}</span>
            {f.where.map((w) => (
              <span key={w} style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, border: "1px solid var(--color-divider)", color: "var(--muted)", fontWeight: 400 }}>
                <i className={`ph ${w === "site" ? "ph-globe" : "ph-desktop"}`} /> {w === "site" ? "Site" : "Launcher"}
              </span>
            ))}
          </div>
          <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.45 }}>{highlight(f.description.fr, needle)}</p>
          <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--muted2)" }}>
            {child && parent ? `dépend de ${parent.name.fr} · ` : ""}
            {f.minLauncher ? `launcher minimum ${f.minLauncher} · ` : ""}modifié {dateFr(f.updatedAt)}
          </div>
          {master ? <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>Interrupteur principal : tout le groupe suit ce réglage, rien ne peut être plus visible que lui.</div> : null}
          {capped ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
              <i className="ph ph-link" /> Suit « {parent!.name.fr} » : ne peut pas être plus visible.
            </div>
          ) : null}
        </div>
        <div className="lab-states" role="group" aria-label={f.name.fr}>
          {STATES.map((s) => (
            <button key={s} type="button" aria-pressed={draft[f.id] === s} style={{ ["--c" as string]: COLOR[s] } as React.CSSProperties} onClick={() => change({ [f.id]: s })}>
              <i className={`ph ${ICON[s]}`} />
              {LABEL[s]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderSection(id: string, label: string, items: Feature[]) {
    const shown = items.filter(matches);
    if (!items.length || !shown.length) return null;
    const key = `sec_${id}`;
    const expanded = searching || !!open[key];
    const ids = items.map((f) => f.id);
    const present = new Set(ids.map((i) => draft[i]));
    const same = present.size === 1 ? draft[ids[0]] : null;
    return (
      <div key={id} className="lab-sub">
        <GroupHead name={label} ids={ids} draft={draft} saved={saved} expanded={expanded} onToggle={() => toggle(key)} />
        {expanded ? (
          <div className="lab-sub-body">
            {searching ? null : (
              <div className="lab-bulk">
                <span>
                  Mettre tout le groupe sur : {same ? null : <em>(réglages mélangés pour l&apos;instant)</em>}
                </span>
                <div className="lab-states sm" role="group" aria-label={`Mettre tout le groupe ${label} sur`}>
                  {STATES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={same === s}
                      className={!same && present.has(s) ? "mixed" : undefined}
                      style={{ ["--c" as string]: COLOR[s] } as React.CSSProperties}
                      onClick={() => change(Object.fromEntries(ids.map((i) => [i, s])))}
                    >
                      {LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {ordered(shown).map((f) => renderFeature(f))}
          </div>
        ) : null}
      </div>
    );
  }

  async function post(body: unknown): Promise<Lab | null> {
    const res = await fetch("/api/admin/features", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Modification impossible.");
    return data.lab as Lab;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const next = await post({ states: Object.fromEntries(dirty.map((f) => [f.id, draft[f.id]])) });
      if (next) {
        setLab(next);
        setDraft(Object.fromEntries(next.features.map((f) => [f.id, f.state])) as Record<string, State>);
      }
      setConfirming(false);
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function addTester(uuid: string) {
    setTesterError(null);
    try {
      const next = await post({ addTester: uuid });
      if (next) setLab((current) => ({ ...current, testers: next.testers }));
    } catch (e) {
      setTesterError(e instanceof Error ? e.message : "Ajout impossible.");
    }
  }

  async function removeTester(uuid: string) {
    setTesterError(null);
    try {
      const next = await post({ removeTester: uuid });
      if (next) setLab((current) => ({ ...current, testers: next.testers }));
    } catch (e) {
      setTesterError(e instanceof Error ? e.message : "Retrait impossible.");
    }
  }

  const menu: { icon: string; label: string; feature?: string }[] = [
    { icon: "ph-house", label: "Accueil" },
    { icon: "ph-hard-drives", label: "Serveurs" },
    { icon: "ph-cube", label: "Jouer", feature: "play" },
    { icon: "ph-cloud-arrow-up", label: "Mondes en ligne", feature: "worlds" },
    { icon: "ph-users", label: "Amis", feature: "friends" },
    { icon: "ph-gear", label: "Paramètres" },
  ];

  return (
    <div className="lab-wrap">
      <style>{CSS}</style>
      <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
        <i className="ph ph-flask" style={{ color: "var(--color-accent)" }} />
        Laboratoire
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--muted)", maxWidth: "64ch", lineHeight: 1.5 }}>
        Chaque fonctionnalité a un interrupteur. Tu la testes dans le vrai launcher sans que les joueurs la voient, puis tu l&apos;ouvres aux bêta-testeurs, puis à tout le monde. Le site décide : une
        fonctionnalité cachée est refusée par le serveur, pas seulement masquée.
      </p>

      <div className="lab-grid">
        <section style={{ minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", margin: "0 0 14px", padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--raised)", fontSize: 12.5 }}>
            {STATES.map((s) => (
              <span key={s} style={{ display: "flex", gap: 6, alignItems: "baseline", color: "var(--muted)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLOR[s], display: "inline-block", flex: "none" }} />
                <span>
                  <strong style={{ fontWeight: 500, color: "var(--color-text)" }}>{LABEL[s]}</strong> : {HELP[s]}
                </span>
              </span>
            ))}
          </div>

          {features.length === 0 ? (
            <div className="lab-cat" style={{ textAlign: "center", padding: "34px 16px", color: "var(--muted)" }}>
              <i className="ph ph-flask" style={{ fontSize: 34 }} />
              <p style={{ margin: "8px 0 0", color: "var(--color-text)", fontWeight: 500 }}>Aucune fonctionnalité dans le laboratoire</p>
              <p style={{ margin: "4px 0 0" }}>Chaque nouvelle fonctionnalité arrive ici avec un interrupteur, cachée par défaut.</p>
            </div>
          ) : (
            <div className="lab-list">
              <div className="lab-tools">
                <label className="lab-search">
                  <i className="ph ph-magnifying-glass" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Chercher une fonctionnalité (ex. CurseForge, F6, touches)"
                    aria-label="Chercher une fonctionnalité"
                    autoComplete="off"
                  />
                  {searching ? <span aria-live="polite" style={{ fontSize: 12, color: "var(--muted2)", whiteSpace: "nowrap" }}>{resultCount > 1 ? `${resultCount} résultats` : `${resultCount} résultat`}</span> : null}
                </label>
                <button type="button" style={btn()} onClick={() => setAll(true)}>Tout déplier</button>
                <button type="button" style={btn()} onClick={() => setAll(false)}>Tout replier</button>
              </div>

              {searching && resultCount === 0 ? (
                <div className="lab-cat" style={{ textAlign: "center", padding: "34px 16px", color: "var(--muted)" }}>
                  <i className="ph ph-magnifying-glass" style={{ fontSize: 30 }} />
                  <p style={{ margin: "8px 0 0", color: "var(--color-text)", fontWeight: 500 }}>Aucune fonctionnalité ne correspond à « {query.trim()} »</p>
                  <p style={{ margin: "4px 0 0" }}>Essaie un autre mot, ou vide la recherche.</p>
                </div>
              ) : (
                GROUPS.map((group) => {
                  const items = features.filter((f) => f.group === group.id);
                  if (!items.some(matches)) return null;
                  const key = `cat_${group.id}`;
                  const expanded = searching || !!open[key];
                  const master = group.id === "play" ? items.find((f) => f.id === MASTER) : undefined;
                  const inSections = items.filter((f) => f.id !== MASTER);
                  return (
                    <section key={group.id} className="lab-cat">
                      <GroupHead top name={group.label} ids={items.map((f) => f.id)} draft={draft} saved={saved} expanded={expanded} onToggle={() => toggle(key)} />
                      {expanded ? (
                        <div className="lab-cat-body">
                          {group.id === "play" ? (
                            <>
                              {master && matches(master) ? renderFeature(master, true) : null}
                              {SECTIONS.map((s) => renderSection(s.id, s.label, inSections.filter((f) => f.section === s.id)))}
                              {renderSection(OTHER.id, OTHER.label, inSections.filter((f) => !f.section))}
                            </>
                          ) : (
                            ordered(items.filter(matches)).map((f) => renderFeature(f))
                          )}
                        </div>
                      ) : null}
                    </section>
                  );
                })
              )}
            </div>
          )}

          {error ? <p role="alert" style={{ color: "var(--danger)", margin: "14px 0 0" }}>{error}</p> : null}
          {dirty.length ? (
            <>
              <div style={{ position: "sticky", bottom: 12, marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--color-surface)", border: "1px solid var(--color-accent)" }}>
                <span>{dirty.length > 1 ? `${dirty.length} changements pas encore enregistrés` : "1 changement pas encore enregistré"}</span>
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={btn()} onClick={() => { setDraft(saved); setConfirming(false); }}>Annuler</button>
                  <button type="button" style={btn(true)} disabled={busy} onClick={() => (toAll.length || toHidden.length ? setConfirming(true) : save())}>
                    Enregistrer les modifications
                  </button>
                </span>
              </div>
              {confirming ? (
                <div role="alertdialog" style={{ marginTop: 10, padding: 12, borderRadius: "var(--radius-md)", border: "1px solid #f0b25a", background: "color-mix(in srgb, #f0b25a 9%, transparent)", fontSize: 13, lineHeight: 1.5, display: "grid", gap: 10 }}>
                  <div>
                    {toAll.length ? <p style={{ margin: 0 }}>Tu ouvres à tout le monde : {toAll.join(", ")}. Les joueurs la verront dès leur prochain lancement.</p> : null}
                    {toHidden.length ? (
                      <p style={{ margin: toAll.length ? "6px 0 0" : 0 }}>
                        Tu caches : {toHidden.join(", ")}. Ceux qui l&apos;utilisaient ne la verront plus et le site refusera ses appels. Leurs données restent en base.
                      </p>
                    ) : null}
                    <p style={{ margin: "6px 0 0" }}>Continuer ?</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={btn(true)} disabled={busy} onClick={save}>Oui, enregistrer</button>
                    <button type="button" style={btn()} onClick={() => setConfirming(false)}>Annuler</button>
                  </div>
                </div>
              ) : null}
            </>
          ) : justSaved ? (
            <p role="status" style={{ margin: "14px 0 0", padding: "10px 12px", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--success)", background: "color-mix(in srgb, var(--success) 12%, transparent)" }}>
              Enregistré. Le site et le launcher appliquent le changement dans la minute.
            </p>
          ) : null}
        </section>

        <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
          <section style={card}>
            <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 500 }}>Ce que voit…</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>Le menu du launcher selon qui l&apos;ouvre, avec les états choisis à gauche (même avant d&apos;enregistrer).</p>
            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              {VIEWERS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={viewer === v.id}
                  onClick={() => setViewer(v.id)}
                  style={{ textAlign: "left", border: `1px solid ${viewer === v.id ? "var(--color-accent)" : "var(--color-divider)"}`, background: viewer === v.id ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "transparent", borderRadius: "var(--radius-md)", padding: "8px 10px", cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--color-text)" }}
                >
                  {v.label}
                  <small style={{ display: "block", color: "var(--muted2)", fontSize: 11.5, marginTop: 2 }}>{v.sub}</small>
                </button>
              ))}
            </div>
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-divider)", background: "#12131d", color: "#e9e9ed", padding: "10px 8px", display: "grid", gap: 2, fontSize: 12 }}>
              {menu.map((item) => {
                const state = item.feature ? effective(item.feature, draft, features) : "all";
                if (!visibleFor(state, viewer)) return null;
                const tag = state === "test" ? "TEST" : state === "beta" || state === "betaTesters" ? "BÊTA" : null;
                return (
                  <div key={item.label} style={{ display: "flex", gap: 7, alignItems: "center", padding: "6px 7px", borderRadius: 6, color: "#b6b8c8" }}>
                    <i className={`ph ${item.icon}`} style={{ fontSize: 14 }} />
                    {item.label}
                    {tag ? (
                      <span style={{ marginLeft: "auto", fontSize: 9, padding: "0 5px", borderRadius: 999, background: tag === "TEST" ? "rgba(240,178,90,.22)" : "rgba(181,171,252,.22)", color: tag === "TEST" ? "#f6cf93" : "#d2cefd" }}>{tag}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              Si le launcher n&apos;arrive pas à joindre le site, il garde le dernier état reçu (au tout premier lancement : seulement « Pour tous »).
            </p>
          </section>

          <section style={card}>
            <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 500 }}>Comptes testeurs</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Les comptes Minecraft qui voient l&apos;état « Test » dans le launcher et sur le site.
            </p>
            {lab.testers.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {lab.testers.map((t) => (
                  <div key={t.uuid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://mc-heads.net/avatar/${t.uuid}/26`} alt="" width={26} height={26} style={{ borderRadius: 5, flex: "none" }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.uuid}</div>
                    </div>
                    <button type="button" aria-label={`Retirer ${t.name}`} title="Retirer" onClick={() => removeTester(t.uuid)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
                      <i className="ph ph-x" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, padding: "14px 8px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                Aucun compte testeur. Cherche ton pseudo ci-dessous pour voir l&apos;état « Test » dans le launcher et sur le site.
              </p>
            )}
            <TesterPicker testers={lab.testers} onPick={addTester} />
            {testerError ? <p role="alert" style={{ color: "var(--danger)", margin: "8px 0 0", fontSize: 13 }}>{testerError}</p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}

// Choix d'un compte testeur (06/11) : on cherche parmi les joueurs INSCRITS sur Omniscient
// (au moins 2 lettres, début du pseudo) et on ne peut ajouter que l'un d'eux. Flèches + Entrée au clavier.
type Candidate = { uuid: string; name: string; createdAt: string };

function TesterPicker({ testers, onPick }: { testers: Tester[]; onPick: (uuid: string) => Promise<void> }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState<string | null>(null);
  const seq = useRef(0);
  const needle = q.trim();
  const ready = /^[A-Za-z0-9_]{2,16}$/.test(needle);
  const already = new Set(testers.map((t) => t.uuid.toLowerCase().replaceAll("-", "")));

  useEffect(() => {
    if (!ready) return;
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/features", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ searchPlayers: needle }) });
        const data = await res.json().catch(() => ({}));
        if (id === seq.current) setResults(Array.isArray(data.players) ? data.players : []);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [needle, ready]);

  async function pick(c: Candidate | undefined) {
    if (!c || already.has(c.uuid)) return;
    await onPick(c.uuid);
    setQ("");
    setResults([]);
    setAdded(c.name);
    setTimeout(() => setAdded(null), 2500);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(results[active]); }
    else if (e.key === "Escape") setOpen(false);
  }

  const showBox = open && ready;
  const date = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }); };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative" }}>
        <i className="ph ph-magnifying-glass" aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted2)", pointerEvents: "none" }} />
        <input
          id="lab-tester"
          role="combobox"
          aria-expanded={showBox}
          aria-controls="lab-tester-list"
          aria-activedescendant={showBox && results.length ? `lab-tester-${active}` : undefined}
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
          placeholder="Chercher un joueur inscrit…"
          aria-label="Chercher un joueur inscrit"
          autoComplete="off"
          maxLength={16}
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", padding: "7px 10px 7px 32px", background: "var(--color-bg)", color: "var(--color-text)", font: "inherit" }}
        />
        {showBox ? (
          <div id="lab-tester-list" role="listbox" style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 20, background: "var(--color-surface)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgb(0 0 0 / .25)", padding: 4, maxHeight: 280, overflowY: "auto" }}>
            {results.length ? results.map((c, i) => {
              const done = already.has(c.uuid);
              return (
                <div
                  key={c.uuid}
                  id={`lab-tester-${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={done}
                  onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                  onMouseEnter={() => setActive(i)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6, cursor: done ? "default" : "pointer", opacity: done ? 0.55 : 1, background: i === active && !done ? "color-mix(in srgb, var(--color-accent) 14%, transparent)" : "transparent" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://mc-heads.net/avatar/${c.uuid}/26`} alt="" width={26} height={26} style={{ borderRadius: 5, flex: "none" }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>
                      <span style={{ color: "var(--color-accent)", fontWeight: 600 }}>{c.name.slice(0, needle.length)}</span>
                      {c.name.slice(needle.length)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted2)" }}>{done ? "déjà testeur" : `inscrit le ${date(c.createdAt)}`}</div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ padding: "10px 8px", fontSize: 13, color: "var(--muted)" }}>
                {loading ? "Recherche…" : `Aucun joueur inscrit ne commence par « ${needle} ».`}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
        Seuls les joueurs inscrits sur Omniscient apparaissent. Tape au moins 2 lettres.
      </p>
      {added ? <p role="status" style={{ margin: "6px 0 0", fontSize: 13, color: "var(--success)" }}>{added} ajouté aux testeurs.</p> : null}
    </div>
  );
}
