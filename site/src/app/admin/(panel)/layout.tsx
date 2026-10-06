import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { getCurrentAdmin } from "@/lib/adminSession";

export const dynamic = "force-dynamic";

const NAV: [string, string][] = [
  ["/admin/overview", "Vue d'ensemble"],
  ["/admin/servers", "Serveurs"],
  ["/admin/verification", "Vérification"],
  ["/admin/reports", "Signalements"],
  ["/admin/packs", "Packs curés"],
  ["/admin/players", "Joueurs"],
  ["/admin/news", "Actualités"],
  ["/admin/notifications", "Notifications"],
  ["/admin/administration", "Administration"],
  ["/admin/parametres", "Paramètres"],
];

// Coque commune de toutes les pages du panel : menu, bouton retour au site,
// compte connecté. Les pages de connexion et de première connexion n'y sont pas.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangeCredentials) redirect("/admin/premiere-connexion");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh", background: "#0f1119", color: "#e5e7eb" }}>
      <aside style={{ borderRight: "1px solid #2a2d45", padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
        <Link href="/" style={{ color: "#9ca3af", fontSize: 13, marginBottom: 14, textDecoration: "none" }}>← Retour au site</Link>
        <div style={{ fontSize: 12, color: "#6b7280", padding: "4px 8px" }}>Panel admin</div>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} style={{ padding: "7px 8px", borderRadius: 8, color: "#d1d5db", textDecoration: "none" }}>
            {label}
          </Link>
        ))}
        <div style={{ marginTop: "auto", fontSize: 12, color: "#6b7280", display: "grid", gap: 6 }}>
          <span>{admin.username} ({admin.role === "admin" ? "administrateur" : "modérateur"})</span>
          <AdminLogoutButton />
        </div>
      </aside>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
