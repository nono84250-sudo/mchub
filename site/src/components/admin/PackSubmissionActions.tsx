"use client";

import { useState } from "react";

// Boutons d'un pack proposé (page admin Packs officiels, 31/10, preview validée par Rushi) :
// Tester dans le launcher · Accepter · Refuser. Accepter et Refuser ouvrent une fenêtre avec un
// message pour le joueur (facultatif à l'acceptation, obligatoire au refus), puis Confirmer.
// La fenêtre contient un vrai formulaire : il part vers /api/admin/play comme avant.
const mini = (color: string, solid = false): React.CSSProperties => ({
  border: `1px solid ${color}`,
  color: solid ? "#fff" : color,
  background: solid ? color : "transparent",
  padding: "6px 12px",
  borderRadius: "var(--radius-md)",
  font: "500 12.5px var(--font-heading)",
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export function PackSubmissionActions({ id, name }: { id: string; name: string }) {
  const [dialog, setDialog] = useState<"accept" | "refuse" | null>(null);
  const [testing, setTesting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function test() {
    setTesting(true);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/omnipack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "testLink", id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || `HTTP ${res.status}`);
      setInfo("Ton navigateur va demander d'ouvrir le launcher : accepte. Le pack s'installe chez toi, en privé.");
      window.location.href = data.url;
    } catch (error) {
      setInfo(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  }

  const refuse = dialog === "refuse";
  return (
    <>
      <button type="button" disabled={testing} onClick={test} style={mini("var(--color-accent)", true)} title="Installe ce pack dans TON launcher, en privé, pour l'essayer. Aucun joueur ne le voit.">
        Tester dans le launcher
      </button>
      <button type="button" onClick={() => setDialog("accept")} style={mini("var(--success)")} title="Ajoute le pack aux Packs officiels (toujours caché des joueurs jusqu'à « Publier »).">
        Accepter
      </button>
      <button type="button" onClick={() => setDialog("refuse")} style={mini("var(--danger)")}>
        Refuser
      </button>
      {info ? <span style={{ flexBasis: "100%", fontSize: 12, color: "var(--muted)" }}>{info}</span> : null}

      {dialog ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setDialog(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100 }}
        >
          <form
            method="post"
            action="/api/admin/play"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-lg)", padding: 22, maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 12 }}
          >
            <input type="hidden" name="action" value={refuse ? "refuseSubmission" : "importSubmission"} />
            <input type="hidden" name="submissionId" value={id} />
            <p style={{ margin: 0, fontWeight: 600 }}>{refuse ? `Refuser « ${name} » ?` : `Accepter « ${name} » ?`}</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              {refuse
                ? "Le fichier sera effacé et le joueur verra ton message."
                : "Le pack rejoint les Packs officiels, caché des joueurs jusqu'à « Publier ». Tu peux ajouter un message pour le joueur (facultatif)."}
            </p>
            <textarea
              name="note"
              required={refuse}
              maxLength={300}
              rows={4}
              autoFocus
              placeholder="Ton message pour le joueur…"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--color-divider)", background: "var(--color-bg)", color: "var(--color-text)", borderRadius: "var(--radius-md)", padding: 10, font: "400 13.5px var(--font-body, inherit)" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setDialog(null)} style={mini("var(--muted)")}>
                Annuler
              </button>
              <button type="submit" style={mini(refuse ? "var(--danger)" : "var(--success)", true)}>
                Confirmer
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
