"use client";

import { useState } from "react";

const LABELS: Record<string, string> = { curseforge: "CurseForge", modrinth: "Modrinth" };

// Interrupteurs des sources de modpacks. Désactiver une source la coupe pour tous
// les joueurs immédiatement (recherche et installation) — dès que "Enregistrer" est
// confirmé, pas tant que la case est juste cochée/décochée sans avoir encore sauvegardé.
// 2026-10-12 : sous-titre ajoute (coché = activé n'etait dit nulle part) ; et le
// cocher/decocher ne sauvegarde plus tout seul — un bouton "Enregistrer les modifications"
// apparait et confirme visuellement que le changement a bien ete pris en compte (signale
// par l'utilisateur : la case qui change de couleur toute seule ne prouvait rien).
export function AdminSourceToggles({ initial }: { initial: Record<string, boolean> }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const dirtySources = Object.keys(LABELS).filter((source) => draft[source] !== saved[source]);
  const isDirty = dirtySources.length > 0;

  function toggle(source: string) {
    setError(null);
    setJustSaved(false);
    setDraft((current) => ({ ...current, [source]: !current[source] }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const source of dirtySources) {
        const res = await fetch("/api/admin/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, enabled: draft[source] }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Modification impossible.");
          return;
        }
        setSaved(data.sources);
        setDraft(data.sources);
      }
      setJustSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
        Coché = source active pour la recherche et l'installation de modpacks, pour tous les joueurs. Décoché = désactivée, signalée en rouge partout où un propriétaire choisit son modpack.
      </p>
      {Object.keys(LABELS).map((source) => (
        <label key={source} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)" }}>
          <span>{LABELS[source]}</span>
          <input type="checkbox" checked={!!draft[source]} onChange={() => toggle(source)} aria-label={`Activer ${LABELS[source]}`} />
        </label>
      ))}
      {error && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
      {isDirty ? (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            justifySelf: "start",
            padding: "9px 16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-accent)",
            background: "var(--color-accent)",
            color: "var(--color-accent-100)",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      ) : justSaved ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--success)" }}>✓ Enregistré</p>
      ) : null}
    </div>
  );
}
