"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonStyle, inputStyle } from "@/components/admin/AdminLoginForm";

// Changement du nom d'utilisateur et du mot de passe. Sert à la première connexion
// (obligatoire) et dans les paramètres. Le mot de passe actuel est toujours demandé.
export function AdminCredentialsForm({ firstLogin, currentUsername }: { firstLogin: boolean; currentUsername: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirm")) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        username: form.get("username"),
        newPassword: form.get("newPassword"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Modification impossible.");
      return;
    }
    router.push("/admin/administration");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      {firstLogin && (
        <p style={{ margin: 0, color: "#fbbf24" }}>
          Première connexion : tu dois choisir un nouveau nom d'utilisateur et un nouveau mot de passe avant de continuer.
        </p>
      )}
      <input name="currentPassword" type="password" placeholder="Mot de passe actuel" autoComplete="current-password" required style={inputStyle} />
      <input name="username" placeholder="Nouveau nom d'utilisateur" defaultValue={firstLogin ? "" : currentUsername} autoComplete="username" required style={inputStyle} />
      <input name="newPassword" type="password" placeholder="Nouveau mot de passe (12 caractères min.)" autoComplete="new-password" required style={inputStyle} />
      <input name="confirm" type="password" placeholder="Confirmer le nouveau mot de passe" autoComplete="new-password" required style={inputStyle} />
      {error && <p role="alert" style={{ color: "#f87171", margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy} style={buttonStyle}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}
