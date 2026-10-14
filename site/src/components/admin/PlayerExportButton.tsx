"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Bouton « Récupérer les données du joueur » de la fiche joueur admin (droit d'accès RGPD) et
// sa fenêtre en deux étapes : choix des catégories, puis fichiers prêts (JSON + résumé texte).
// Les fichiers sont générés par /api/admin/player-export, qui ajoute aussi la note de trace.
// Monté dans la barre d'actions par SlotPortal (voir players/[id]/page.tsx).

type Category = { key: string; title: string; desc: string; count: number };
type Result = { jsonName: string; txtName: string; json: string; summary: string };

const TOP_BUTTON: React.CSSProperties = {
  border: "1px solid var(--color-divider)",
  color: "var(--color-text)",
  background: "transparent",
  padding: "8px 16px",
  borderRadius: "var(--radius-md)",
  font: "500 13.5px var(--font-heading)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  flexShrink: 0,
};
const SMALL_BUTTON: React.CSSProperties = { ...TOP_BUTTON, padding: "6px 12px", font: "500 12.5px var(--font-heading)" };
// border complet (pas borderColor seul) : React refuse de melanger la propriete raccourcie
// "border" et "borderColor" sur un meme element (avertissement en console, 2026-10-14).
const PRIMARY: React.CSSProperties = { ...TOP_BUTTON, border: "1px solid var(--color-accent)", color: "var(--color-accent)" };
const BOX: React.CSSProperties = { border: "1px solid var(--color-divider)", background: "var(--color-bg)", borderRadius: "var(--radius-md)" };

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const size = (s: string) => `${(new Blob([s]).size / 1024).toFixed(1).replace(".", ",")} Ko`;

export function PlayerExportButton({ playerId, playerName, categories }: { playerId: string; playerName: string; categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(categories.map((c) => c.key)));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<"txt" | "json">("txt");
  const [copied, setCopied] = useState(false);
  const traced = useRef(false);
  const outRef = useRef<HTMLPreElement>(null);

  function close() {
    setOpen(false);
    // La note « Export généré » vient d'être ajoutée : recharge la fiche pour l'afficher.
    if (traced.current) {
      traced.current = false;
      router.refresh();
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/player-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: playerId, categories: [...picked], email: email.trim() || undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.json) {
        setError(data?.error ?? "L'export a échoué. Réessaie.");
        return;
      }
      traced.current = true;
      setResult(data as Result);
      setTab("txt");
      setStep(2);
    } catch {
      setError("L'export a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setTab("txt");
      const range = document.createRange();
      if (outRef.current) range.selectNodeContents(outRef.current);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  const toggle = (key: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const dialog = open ? (
    <div
      onClick={(e) => e.target === e.currentTarget && close()}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(5,6,12,.6)", display: "flex", overflowY: "auto", padding: "24px 16px" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-export-title"
        style={{ width: 640, maxWidth: "100%", margin: "auto", borderRadius: "var(--radius-lg)", background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}
      >
        <div style={{ height: 4, background: "var(--color-accent)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 id="player-export-title" style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 18 }}>
                Récupérer les données de {playerName}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Pour répondre à une demande d&apos;accès (RGPD, article 15). Tu obtiens un fichier complet lisible par une machine et un résumé en français à envoyer au joueur.
              </p>
            </div>
            <button type="button" onClick={close} aria-label="Fermer" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}>
              <i className="ph ph-x" style={{ fontSize: 18 }} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--muted)" }}>
            <span style={{ color: step === 1 ? "var(--color-text)" : undefined }}>1 · Choisir</span>
            <span>·</span>
            <span style={{ color: step === 2 ? "var(--color-text)" : undefined }}>2 · Fichiers prêts</span>
          </div>

          {step === 1 ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                <label style={{ ...BOX, display: "flex", gap: 10, padding: "10px 12px", minWidth: 0 }}>
                  <input type="checkbox" checked disabled style={{ marginTop: 2 }} />
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Compte</span>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Pseudo, UUID Minecraft, dates, verrouillage</span>
                  </span>
                </label>
                {categories.map((c) => (
                  <label key={c.key} style={{ ...BOX, display: "flex", gap: 10, padding: "10px 12px", cursor: "pointer", minWidth: 0 }}>
                    <input type="checkbox" checked={picked.has(c.key)} onChange={() => toggle(c.key)} style={{ marginTop: 2, accentColor: "var(--color-accent)" }} />
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{c.title}</span>
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.desc}</span>
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>{c.count}</span>
                  </label>
                ))}
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                Email du demandeur (facultatif)
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex. joueur@exemple.fr"
                  autoComplete="off"
                  style={{ height: 36, fontSize: 13.5 }}
                />
                <span style={{ fontSize: 11.5 }}>Les messages du formulaire Contact ne sont pas liés au compte. Avec l&apos;email, ceux envoyés depuis cette adresse sont ajoutés.</span>
              </label>
              <div style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: "var(--radius-md)", fontSize: 12.5, lineHeight: 1.5, background: "color-mix(in srgb, #e0c28a 10%, transparent)", border: "1px solid color-mix(in srgb, #e0c28a 35%, transparent)" }}>
                <i className="ph ph-shield-check" style={{ fontSize: 16, color: "#e0c28a", marginTop: 1 }} />
                <div>
                  <b style={{ fontWeight: 500 }}>Jamais inclus, même si coché</b>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    <li>Jetons et dates de session, secrets du launcher</li>
                    <li>Codes d&apos;invitation des serveurs privés</li>
                    <li>Pseudos et UUID des joueurs qui ont signalé ses serveurs (remplacés par « un joueur »)</li>
                    <li>Identifiants internes des admins</li>
                  </ul>
                </div>
              </div>
              {error ? <p style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>{error}</p> : null}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 100%", fontSize: 12, color: "var(--muted)" }}>Une note « Export généré » sera ajoutée aux notes du staff.</span>
                <button type="button" onClick={close} style={SMALL_BUTTON}>Annuler</button>
                <button type="button" onClick={generate} disabled={busy} style={{ ...PRIMARY, opacity: busy ? 0.6 : 1 }}>
                  <i className="ph ph-download-simple" style={{ fontSize: 14.5 }} />
                  {busy ? "Génération…" : "Générer les fichiers"}
                </button>
              </div>
            </>
          ) : result ? (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "var(--success)" }}>
                <i className="ph ph-check" />
                Fichiers générés. Trace ajoutée aux notes du staff.
              </div>
              {(
                [
                  { name: result.jsonName, label: "JSON", content: result.json, type: "application/json", icon: "ph-brackets-curly" },
                  { name: result.txtName, label: "Texte", content: result.summary, type: "text/plain;charset=utf-8", icon: "ph-file-text" },
                ] as const
              ).map((f) => (
                <div key={f.name} style={{ ...BOX, display: "flex", alignItems: "center", gap: 10, padding: 12, minWidth: 0 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-accent-800)", color: "var(--color-accent-100)" }}>
                    <i className={`ph ${f.icon}`} style={{ fontSize: 17 }} />
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ font: "12.5px ui-monospace, Menlo, monospace", overflowWrap: "anywhere" }}>{f.name}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{f.label} · {size(f.content)}</span>
                  </span>
                  <button type="button" onClick={() => download(f.name, f.content, f.type)} style={{ ...SMALL_BUTTON, marginLeft: "auto" }} aria-label={`Télécharger ${f.name}`}>
                    <i className="ph ph-download-simple" style={{ fontSize: 13.5 }} />
                    Télécharger
                  </button>
                </div>
              ))}
              <div role="tablist" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-divider)" }}>
                {(["txt", "json"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === key ? "var(--color-accent)" : "transparent"}`, marginBottom: -1, padding: "7px 10px", cursor: "pointer", fontSize: 12.5, color: tab === key ? "var(--color-text)" : "var(--muted)" }}
                  >
                    {key === "txt" ? "Résumé" : "JSON complet"}
                  </button>
                ))}
              </div>
              <pre
                ref={outRef}
                style={{ ...BOX, margin: 0, maxHeight: 300, overflow: "auto", padding: "12px 14px", font: "12px/1.55 ui-monospace, Menlo, monospace", whiteSpace: tab === "txt" ? "pre-wrap" : "pre" }}
              >
                {tab === "txt" ? result.summary : result.json}
              </pre>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 100%", fontSize: 12, color: "var(--muted)" }}>Joins les deux fichiers à ton email au joueur.</span>
                <button type="button" onClick={() => setStep(1)} style={SMALL_BUTTON}>Modifier</button>
                <button type="button" onClick={copySummary} style={SMALL_BUTTON}>
                  <i className="ph ph-copy" style={{ fontSize: 13.5 }} />
                  {copied ? "Copié" : "Copier le résumé"}
                </button>
                <button type="button" onClick={close} style={PRIMARY}>Terminé</button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStep(1);
          setError(null);
          setOpen(true);
        }}
        style={TOP_BUTTON}
      >
        <i className="ph ph-download-simple" style={{ fontSize: 14.5 }} />
        Récupérer les données du joueur
      </button>
      {/* Rendu sur place (position fixe), pas dans document.body : les couleurs --muted,
          --danger, --success sont definies sur le cadre du panel, pas sur la page. */}
      {dialog}
    </>
  );
}
