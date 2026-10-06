import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { AdminSourceToggles } from "@/components/admin/AdminSourceToggles";
import { getCurrentAdmin } from "@/lib/adminSession";
import { allSourceStates } from "@/lib/platformSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration — Omniscient" };

export default async function AdminAdministration() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangeCredentials) redirect("/admin/premiere-connexion");
  const sources = await allSourceStates();
  return (
    <main style={{ minHeight: "100vh", background: "#0f1119", color: "#e5e7eb", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Administration</h1>
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/admin/parametres" style={{ color: "#9184d9" }}>Paramètres</Link>
          <span style={{ color: "#6b7280" }}>{admin.username} ({admin.role})</span>
          <AdminLogoutButton />
        </nav>
      </header>
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Sources de modpacks</h2>
        <p style={{ color: "#9ca3af", marginTop: 0, marginBottom: 14 }}>
          Une source désactivée n&apos;est plus proposée ni servie aux joueurs.
        </p>
        {admin.role === "admin" ? (
          <AdminSourceToggles initial={sources} />
        ) : (
          <p style={{ color: "#9ca3af" }}>Réservé aux administrateurs.</p>
        )}
      </section>
    </main>
  );
}
