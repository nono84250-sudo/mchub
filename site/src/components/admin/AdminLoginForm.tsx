"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Formulaire de connexion du panel admin (mot de passe). La double authentification suit
// toujours, sur /admin/double-authentification.
export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Connexion impossible.");
      return;
    }
    // Etape 2 : code de double authentification (ou, pour un nouveau compte, d'abord ses
    // propres identifiants puis la configuration de la 2FA).
    router.push(data.next === "credentials" ? "/admin/premiere-connexion" : "/admin/double-authentification");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      {/* 2026-10-10 : aria-label ajoute (pas de <label> visible dans la maquette) — sans ca, un
         lecteur d'ecran n'avait que le placeholder, qui disparait a la saisie. */}
      <input
        name="username"
        placeholder="Nom d'utilisateur"
        aria-label="Nom d'utilisateur"
        autoComplete="username"
        required
        style={inputStyle}
      />
      <input
        name="password"
        type="password"
        placeholder="Mot de passe"
        aria-label="Mot de passe"
        autoComplete="current-password"
        required
        style={inputStyle}
      />
      {error && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy} style={buttonStyle}>{busy ? "Connexion…" : "Se connecter"}</button>
    </form>
  );
}

// 2026-10-12 : tokens Nocturne (--color-*) plutot que les tokens du site public
// (--accent/--surface/--border) — ces champs vivent sur des pages admin qui chargent
// nocturne.css, pas globals.css ; avec les anciens tokens ils rendaient dans les couleurs
// du site public, visuellement incoherent avec le reste du panel.
export const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-divider)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};

export const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-accent)",
  background: "var(--color-accent)",
  color: "var(--color-accent-100)",
  cursor: "pointer",
};
