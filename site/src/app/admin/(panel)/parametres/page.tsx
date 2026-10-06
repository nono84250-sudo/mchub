import { redirect } from "next/navigation";
import { AdminCredentialsForm } from "@/components/admin/AdminCredentialsForm";
import { getCurrentAdmin } from "@/lib/adminSession";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paramètres — Omniscient" };

export default async function AdminSettings() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangeCredentials) redirect("/admin/premiere-connexion");
  return (
    <main style={{ minHeight: "100vh", background: "#0f1119", color: "#e5e7eb", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Paramètres du compte</h1>
      <AdminCredentialsForm firstLogin={false} currentUsername={admin.username} />
    </main>
  );
}
