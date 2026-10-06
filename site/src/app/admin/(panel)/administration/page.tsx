import { redirect } from "next/navigation";
import { AdminSourceToggles } from "@/components/admin/AdminSourceToggles";
import { getCurrentAdmin } from "@/lib/adminSession";
import { allSourceStates } from "@/lib/platformSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration — Admin Omniscient" };

export default async function AdminAdministration() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangeCredentials) redirect("/admin/premiere-connexion");
  const sources = await allSourceStates();
  return (
    <section>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Administration</h1>
      <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Sources de modpacks</h2>
      <p style={{ color: "#9ca3af", marginTop: 0, marginBottom: 14 }}>
        Une source désactivée n&apos;est plus proposée ni servie aux joueurs.
      </p>
      {admin.role === "admin" ? <AdminSourceToggles initial={sources} /> : <p style={{ color: "#9ca3af" }}>Réservé aux administrateurs.</p>}
    </section>
  );
}
