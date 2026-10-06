"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Formulaire de connexion du panel admin. Après connexion : premier passage
// obligatoire par le changement d'identifiants si le compte l'exige.
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
    router.push(data.mustChangeCredentials ? "/admin/premiere-connexion" : "/admin/administration");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <input name="username" placeholder="Nom d'utilisateur" autoComplete="username" required style={inputStyle} />
      <input name="password" type="password" placeholder="Mot de passe" autoComplete="current-password" required style={inputStyle} />
      {error && <p role="alert" style={{ color: "#f87171", margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy} style={buttonStyle}>{busy ? "Connexion…" : "Se connecter"}</button>
    </form>
  );
}

export const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #2a2d45",
  background: "#161826",
  color: "#e5e7eb",
};

export const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #9184d9",
  background: "#9184d9",
  color: "#fff",
  cursor: "pointer",
};
