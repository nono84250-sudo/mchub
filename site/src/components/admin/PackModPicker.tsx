"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// « Mods inclus » du formulaire Packs officiels (25/10, preview validée par Rushi) : recherche
// des mods Fabric de Modrinth (via /api/admin/play/modrinth) à gauche, mods du pack à droite.
// Le formulaire reçoit toujours `projects` (noms courts, un par ligne) : la préparation des
// versions côté serveur ne change pas.
type Mod = { slug: string; title: string; author: string; description: string; icon: string | null; downloads: number; versions: string[] };
type Dep = { slug: string; title: string };

// Même seuil que REVIEW_RATIO (lib/playPacks.ts) : sous 75 % des mods, pas de version.
const REVIEW_RATIO = 0.75;

async function call<T>(body: object): Promise<T> {
  const res = await fetch("/api/admin/play/modrinth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data as T;
}

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: n >= 1e7 ? 0 : 1 })} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n));

function Icon({ mod, size }: { mod: { title: string; icon: string | null }; size: number }) {
  const box: React.CSSProperties = { width: size, height: size, borderRadius: size > 32 ? 9 : 7, flexShrink: 0, objectFit: "cover", background: "var(--color-divider)" };
  if (mod.icon) {
    // eslint-disable-next-line @next/next/no-img-element -- icone d'origine externe (Modrinth), pas un asset local optimisable
    return <img src={mod.icon} alt="" style={box} />;
  }
  return <span aria-hidden style={{ ...box, display: "grid", placeItems: "center", fontWeight: 700, fontSize: size / 2.6, color: "var(--muted)" }}>{mod.title.charAt(0)}</span>;
}

export function PackModPicker({ initial }: { initial: string[] }) {
  const [picked, setPicked] = useState<Mod[]>(() => initial.map((slug) => ({ slug, title: slug, author: "", description: "", icon: null, downloads: 0, versions: [] })));
  const [deps, setDeps] = useState<Record<string, Dep[]>>({});
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"downloads" | "az">("downloads");
  const [results, setResults] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const loadDeps = (slug: string) =>
    call<{ deps: Dep[] }>({ deps: slug })
      .then(({ deps: d }) => setDeps((prev) => ({ ...prev, [slug]: d })))
      .catch(() => {});

  // Pack existant : noms, icônes et versions de ses mods.
  useEffect(() => {
    if (!initial.length) return;
    call<{ mods: Mod[] }>({ describe: initial })
      .then(({ mods }) => setPicked((prev) => prev.map((p) => mods.find((m) => m.slug === p.slug) ?? p)))
      .catch(() => {});
    initial.forEach(loadDeps);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au chargement
  }, []);

  // Recherche (300 ms après la dernière touche). Champ vide : les mods Fabric les plus téléchargés.
  useEffect(() => {
    const id = ++seq.current;
    const t = setTimeout(() => {
      setLoading(true);
      call<{ mods: Mod[] }>({ search: query })
        .then(({ mods }) => {
          if (id !== seq.current) return;
          setResults(mods);
          setError(null);
        })
        .catch((e: Error) => id === seq.current && setError(e.message))
        .finally(() => id === seq.current && setLoading(false));
    }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query]);

  const shown = useMemo(() => (sort === "az" ? [...results].sort((a, b) => a.title.localeCompare(b.title)) : results), [results, sort]);
  const has = (slug: string) => picked.some((p) => p.slug === slug);
  const add = (m: Mod) => {
    if (has(m.slug) || picked.length >= 60) return;
    setPicked((prev) => [...prev, m]);
    if (!deps[m.slug]) loadDeps(m.slug);
  };
  const remove = (slug: string) => setPicked((prev) => prev.filter((p) => p.slug !== slug));

  const autoDeps = useMemo(() => {
    const out = new Map<string, Dep>();
    for (const p of picked) for (const d of deps[p.slug] ?? []) if (!has(d.slug)) out.set(d.slug, d);
    return [...out.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, deps]);

  // Versions de Minecraft prévues, comme à l'enregistrement : toutes les versions où au moins un
  // mod existe ; vert = tous, orange = il en manque (≥ 75 %), barré = pas assez de mods.
  const coverage = useMemo(() => {
    const known = picked.filter((p) => p.versions.length);
    const all = [...new Set(known.flatMap((p) => p.versions))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).slice(0, 14);
    return all.map((v) => {
      const missing = known.filter((p) => !p.versions.includes(v));
      const ratio = (known.length - missing.length) / known.length;
      return { v, kind: missing.length === 0 ? "ok" : ratio >= REVIEW_RATIO ? "part" : "no", tip: missing.length ? `Sans ${missing.map((m) => m.title).join(", ")}` : "Tous les mods" };
    });
  }, [picked]);

  const panel: React.CSSProperties = { border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", background: "var(--color-bg)", display: "flex", flexDirection: "column", minWidth: 0 };
  const head: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--color-divider)", display: "flex", gap: 8, alignItems: "center" };
  const headT: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", flex: 1 };
  const row: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--color-divider)" };
  const tag = (color: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `color-mix(in srgb, ${color} 16%, transparent)`, color, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" });
  const btn = (color: string): React.CSSProperties => ({ border: `1px solid ${color}`, color, background: "transparent", padding: "5px 11px", borderRadius: "var(--radius-md)", font: "500 12.5px var(--font-heading)", cursor: "pointer", whiteSpace: "nowrap" });
  const field: React.CSSProperties = { minWidth: 0, border: "1px solid var(--color-divider)", background: "var(--color-surface)", color: "var(--color-text)", borderRadius: "var(--radius-md)", padding: "8px 10px", font: "400 13.5px var(--font-body, inherit)" };
  const empty: React.CSSProperties = { padding: "26px 14px", textAlign: "center", color: "var(--muted)", fontSize: 12.5 };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))", alignItems: "start" }}>
      <input type="hidden" name="projects" value={picked.map((p) => p.slug).join("\n")} />

      <div style={panel}>
        <div style={head}>
          <span style={headT}>Chercher sur Modrinth</span>
          <span style={tag("var(--muted)")}>Fabric</span>
        </div>
        <div style={{ display: "flex", gap: 8, padding: 12, borderBottom: "1px solid var(--color-divider)", flexWrap: "wrap" }}>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} placeholder="Nom du mod (ex. sodium, iris…)" aria-label="Chercher un mod" autoComplete="off" style={{ ...field, flex: "1 1 200px" }} />
          <select value={sort} onChange={(e) => setSort(e.target.value as "downloads" | "az")} aria-label="Trier" style={field}>
            <option value="downloads">Les plus téléchargés</option>
            <option value="az">Nom (A → Z)</option>
          </select>
        </div>
        <div style={{ maxHeight: 470, overflowY: "auto" }} aria-busy={loading}>
          {error ? (
            <div style={{ ...empty, color: "var(--warn)" }}>Modrinth ne répond pas ({error}). Réessaie dans un instant.</div>
          ) : !shown.length ? (
            <div style={empty}>{loading ? "Recherche…" : `Aucun mod Fabric trouvé pour « ${query} ».`}</div>
          ) : (
            shown.map((m) => (
              <div key={m.slug} style={row}>
                <Icon mod={m} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <a href={`https://modrinth.com/mod/${m.slug}`} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{m.title}</a>
                    <small style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>par {m.author}</small>
                  </div>
                  <div title={m.description} style={{ fontSize: 12.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                    <span>↓ {fmt(m.downloads)}</span>
                    {m.versions.length ? <span>{m.versions[m.versions.length - 1]} → {m.versions[0]}</span> : null}
                  </div>
                </div>
                {has(m.slug) ? (
                  <button type="button" disabled style={{ ...btn("var(--success)"), borderColor: "var(--color-divider)", cursor: "default" }}>✓ Ajouté</button>
                ) : (
                  <button type="button" onClick={() => add(m)} style={btn("var(--color-accent)")}>Ajouter</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={panel}>
        <div style={head}>
          <span style={headT}>Mods du pack</span>
          <span style={tag("var(--success)")}>{picked.length}</span>
        </div>
        <div style={{ maxHeight: 470, overflowY: "auto" }}>
          {!picked.length ? (
            <div style={empty}>Aucun mod pour l&apos;instant. Cherche à gauche puis clique « Ajouter ».</div>
          ) : (
            <>
              {picked.map((m) => (
                <div key={m.slug} style={row}>
                  <Icon mod={m} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {m.title} {m.author ? <small style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>{m.author}</small> : null}
                    </div>
                    {deps[m.slug]?.length ? <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Demande : {deps[m.slug].map((d) => d.title).join(", ")}</div> : null}
                  </div>
                  <button type="button" onClick={() => remove(m.slug)} style={btn("var(--muted)")}>Retirer</button>
                </div>
              ))}
              {autoDeps.map((d) => (
                <div key={d.slug} style={row}>
                  <span aria-hidden style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--color-divider)", color: "var(--muted)", fontWeight: 700 }}>+</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{d.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Ajouté tout seul (dépendance)</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--color-divider)", fontSize: 12, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Versions qui seront préparées :</span>
          {coverage.length ? (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {coverage.map((c) => (
                <span key={c.v} title={c.tip} style={{ ...tag(c.kind === "ok" ? "var(--success)" : c.kind === "part" ? "var(--warn)" : "var(--muted)"), textDecoration: c.kind === "no" ? "line-through" : undefined }}>{c.v}</span>
              ))}
            </div>
          ) : (
            <span>Ajoute un mod pour les voir.</span>
          )}
          <span>Vert : tous les mods · orange : il en manque (à revoir) · barré : pas assez de mods.</span>
        </div>
      </div>
    </div>
  );
}
