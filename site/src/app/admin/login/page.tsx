import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { getCurrentAdmin } from "@/lib/adminSession";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration — Omniscient" };

// 2026-10-12 : chargeait globals.css (tokens du site public, --background/--foreground) au
// lieu de nocturne.css — seule la carte de connexion rendait dans un style different du
// reste du panel admin, signale par l'utilisateur. Reprend l'esprit du "Staff sign in" de la
// maquette (voir screens.ts/SCREENS.login) en JSX plutot qu'en recyclant son HTML, pour
// garder AdminLoginForm en vrai composant client.
export default async function AdminLogin() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");
  return (
    <>
      <link rel="stylesheet" href="/admin/nocturne.css" />
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--color-bg)", color: "var(--color-text)", padding: 16 }}>
        <div style={{ width: 360, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 16, height: 16, border: "1.5px solid var(--color-accent)", transform: "rotate(45deg)", flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 17 }}>Omniscient</span>
            <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 999, background: "var(--color-accent-800)", color: "var(--color-accent-100)" }}>Admin</span>
          </div>
          <h1 style={{ margin: 0, fontWeight: 500, fontSize: 24, letterSpacing: "-0.01em" }}>Connexion administration</h1>
          <div style={{ padding: 22, borderRadius: "var(--radius-md)", border: "1px solid var(--color-divider)", background: "var(--color-surface)" }}>
            <AdminLoginForm />
          </div>
        </div>
      </main>
    </>
  );
}
