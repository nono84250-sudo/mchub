"use client";

import { useRouter } from "next/navigation";

// Déconnexion du panel admin : efface le cookie de session côté serveur.
export function AdminLogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={logout} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>
      Se déconnecter
    </button>
  );
}
