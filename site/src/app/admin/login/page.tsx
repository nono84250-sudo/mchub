import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { getCurrentAdmin } from "@/lib/adminSession";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration — Omniscient" };

export default async function AdminLogin() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f1119", color: "#e5e7eb", padding: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Connexion administration</h1>
        <AdminLoginForm />
      </div>
    </main>
  );
}
