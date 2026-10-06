"use client";

import { useState } from "react";

const LABELS: Record<string, string> = { curseforge: "CurseForge", modrinth: "Modrinth" };

// Interrupteurs des sources de modpacks. Désactiver une source la coupe pour tous
// les joueurs immédiatement (recherche et installation).
export function AdminSourceToggles({ initial }: { initial: Record<string, boolean> }) {
  const [sources, setSources] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function toggle(source: string) {
    setError(null);
    const res = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, enabled: !sources[source] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Modification impossible.");
      return;
    }
    setSources(data.sources);
  }

  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
      {Object.keys(LABELS).map((source) => (
        <label key={source} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "1px solid #2a2d45", borderRadius: 10 }}>
          <span>{LABELS[source]}</span>
          <input type="checkbox" checked={!!sources[source]} onChange={() => toggle(source)} aria-label={`Activer ${LABELS[source]}`} />
        </label>
      ))}
      {error && <p role="alert" style={{ color: "#f87171", margin: 0 }}>{error}</p>}
    </div>
  );
}
