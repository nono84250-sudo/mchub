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
  if (!admin.mustChangeCredentials) redirect("/admin/administration");
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f1119", color: "#e5e7eb", padding: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Choisis tes identifiants</h1>
        <AdminCredentialsForm firstLogin currentUsername={admin.username} />
      </div>
    </main>
  );
}
