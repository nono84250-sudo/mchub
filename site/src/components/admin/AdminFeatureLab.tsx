"use client";

import { useMemo, useState } from "react";

// Page Laboratoire (/admin/laboratoire, 25/10, preview validée par Rushi) : un interrupteur à 5
// états par fonctionnalité, les comptes testeurs, et ce que voit chaque type de joueur dans le
// menu du launcher. Rien n'est appliqué avant « Enregistrer les modifications » ; ouvrir à tout
// le monde ou cacher demande une confirmation dans la page.

type State = "hidden" | "test" | "betaTesters" | "beta" | "all";
type Feature = {
  id: string;
  parent?: string;
  state: State;
  where: ("site" | "launcher")[];
  minLauncher?: string;
  group: "play" | "social" | "launcher";
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
  test: "toi et les comptes testeurs seulement",
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
type Viewer = "player" | "betaPlayer" | "tester";
const VIEWERS: { id: Viewer; label: string; sub: string }[] = [
  { id: "player", label: "Un joueur", sub: "launcher normal (version stable)" },
  { id: "betaPlayer", label: "Un joueur bêta", sub: "launcher bêta (0.4.0-beta…)" },
  { id: "tester", label: "Toi (testeur)", sub: "compte testeur, launcher officiel" },
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
@container (max-width: 760px) { .lab-feat { grid-template-columns: minmax(0, 1fr); } .lab-feat.child { margin-left: 10px; } }
.lab-states { display: inline-flex; flex-wrap: wrap; gap: 3px; border: 1px solid var(--color-divider); border-radius: var(--radius-md); padding: 3px; background: var(--color-bg); }
.lab-states button { border: 0; background: transparent; padding: 5px 9px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 12.5px; color: var(--muted); display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; }
.lab-states button:hover { color: var(--color-text); }
.lab-states button[aria-pressed="true"] { color: var(--c); background: color-mix(in srgb, var(--c) 15%, transparent); font-weight: 500; }
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
  const [testerName, setTesterName] = useState("");
  const [testerError, setTesterError] = useState<string | null>(null);

  const features = lab.features;
  const dirty = features.filter((f) => draft[f.id] !== saved[f.id]);
  const toAll = dirty.filter((f) => draft[f.id] === "all").map((f) => f.name.fr);
  const toHidden = dirty.filter((f) => draft[f.id] === "hidden").map((f) => f.name.fr);

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

  async function addTester(event: React.FormEvent) {
    event.preventDefault();
    const name = testerName.trim();
    if (!name) return;
    setTesterError(null);
    try {
      const next = await post({ addTester: name });
      if (next) setLab((current) => ({ ...current, testers: next.testers }));
      setTesterName("");
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
        <section style={card}>
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
            <div style={{ textAlign: "center", padding: "34px 16px", color: "var(--muted)" }}>
              <i className="ph ph-flask" style={{ fontSize: 34 }} />
              <p style={{ margin: "8px 0 0", color: "var(--color-text)", fontWeight: 500 }}>Aucune fonctionnalité dans le laboratoire</p>
              <p style={{ margin: "4px 0 0" }}>Chaque nouvelle fonctionnalité arrive ici avec un interrupteur, cachée par défaut.</p>
            </div>
          ) : (
            GROUPS.map((group) => {
              const items = features.filter((f) => f.group === group.id);
              if (!items.length) return null;
              return (
                <div key={group.id}>
                  <div style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted2)", margin: "16px 0 8px", fontWeight: 500 }}>{group.label}</div>
                  {items.map((f) => {
                    const parent = f.parent ? features.find((x) => x.id === f.parent) : null;
                    const capped = !!parent && RANK[draft[f.id]] > RANK[effective(parent.id, draft, features)];
                    return (
                      <div key={f.id} className={`lab-feat${f.parent ? " child" : ""}`} style={draft[f.id] !== saved[f.id] ? { boxShadow: "0 0 0 1px var(--color-accent) inset" } : undefined}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 8px" }}>
                            {f.name.fr}
                            {f.where.map((w) => (
                              <span key={w} style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, border: "1px solid var(--color-divider)", color: "var(--muted)", fontWeight: 400 }}>
                                <i className={`ph ${w === "site" ? "ph-globe" : "ph-desktop"}`} /> {w === "site" ? "Site" : "Launcher"}
                              </span>
                            ))}
                          </div>
                          <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.45 }}>{f.description.fr}</p>
                          <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--muted2)" }}>
                            {parent ? `dépend de ${parent.name.fr} · ` : ""}
                            {f.minLauncher ? `launcher minimum ${f.minLauncher} · ` : ""}modifié {dateFr(f.updatedAt)}
                          </div>
                          {capped ? (
                            <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                              <i className="ph ph-link" /> Suit « {parent!.name.fr} » : ne peut pas être plus visible.
                            </div>
                          ) : null}
                        </div>
                        <div className="lab-states" role="group" aria-label={f.name.fr}>
                          {STATES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              aria-pressed={draft[f.id] === s}
                              style={{ ["--c" as string]: COLOR[s] } as React.CSSProperties}
                              onClick={() => {
                                setDraft((d) => ({ ...d, [f.id]: s }));
                                setConfirming(false);
                                setJustSaved(false);
                              }}
                            >
                              <i className={`ph ${ICON[s]}`} />
                              {LABEL[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
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
              Les comptes Minecraft qui voient l&apos;état « Test » dans le launcher et sur le site. Être connecté à l&apos;admin suffit aussi sur le site.
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
                Aucun compte testeur. Ajoute ton pseudo Minecraft pour voir l&apos;état « Test » dans le launcher.
              </p>
            )}
            <form onSubmit={addTester} style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                id="lab-tester"
                value={testerName}
                onChange={(e) => setTesterName(e.target.value)}
                placeholder="Pseudo Minecraft"
                aria-label="Pseudo Minecraft"
                autoComplete="off"
                style={{ flex: 1, minWidth: 0, border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", padding: "7px 10px", background: "var(--color-bg)", color: "var(--color-text)", font: "inherit" }}
              />
              <button type="submit" style={btn()}>Ajouter</button>
            </form>
            {testerError ? <p role="alert" style={{ color: "var(--danger)", margin: "8px 0 0", fontSize: 13 }}>{testerError}</p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
