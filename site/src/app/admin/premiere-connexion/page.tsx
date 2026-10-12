import { redirect } from "next/navigation";
import { AdminCredentialsForm } from "@/components/admin/AdminCredentialsForm";
import { getCurrentAdmin } from "@/lib/adminSession";

export const dynamic = "force-dynamic";
export const metadata = { title: "Première connexion — Omniscient" };

// Étape obligatoire : tant que les identifiants initiaux ne sont pas changés, on ne
// peut aller nulle part ailleurs dans le panel.
export default async function FirstLogin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (!admin.mustChangeCredentials) redirect("/admin/servers");
  return (
    <>
      <link rel="stylesheet" href="/admin/nocturne.css" />
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--color-bg)", color: "var(--color-text)", padding: 16 }}>
        <div style={{ width: 360, maxWidth: "100%" }}>
          <h1 style={{ margin: "0 0 16px", fontWeight: 500, fontSize: 22 }}>Choisis tes identifiants</h1>
          <div style={{ padding: 22, borderRadius: "var(--radius-md)", border: "1px solid var(--color-divider)", background: "var(--color-surface)" }}>
            <AdminCredentialsForm firstLogin currentUsername={admin.username} />
          </div>
        </div>
      </main>
    </>
  );
}
