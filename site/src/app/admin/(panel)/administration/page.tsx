import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { administrationHtml, type StaffAccountRow } from "@/app/admin/design/bind";
import { getStaffRoleLabels } from "@/lib/platformSettings";

export const dynamic = "force-dynamic";

// Réservé aux administrateurs (pas aux modérateurs) : c'est ici qu'on gère qui a accès au panel.
export default async function Administration({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  // 2026-10-12 : page desactivee temporairement (perimetre admin reduit a Serveurs/
  // Verification/Parametres, decision produit du 2026-10-11) — retirer cette ligne pour
  // reactiver quand le besoin reapparait.
  redirect("/admin/servers");
  if (admin.role !== "admin") {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--background)", color: "var(--foreground)", padding: 16 }}>
        <p>Cette page est réservée aux administrateurs.</p>
      </main>
    );
  }

  const params = await searchParams;
  const accounts = await db.orm.public.AdminAccount.select("id", "username", "role", "mustChangeCredentials", "createdAt", "totpEnabledAt")
    .orderBy((a) => a.createdAt.desc())
    .all();
  const adminCount = accounts.filter((a) => a.role === "admin").length;
  const roleLabels = await getStaffRoleLabels();

  const html = administrationHtml({
    selfId: admin.id,
    accounts: accounts.map((a): StaffAccountRow => ({
      id: a.id,
      username: a.username,
      role: a.role === "admin" ? "admin" : "moderator",
      createdAt: a.createdAt,
      mustChangeCredentials: a.mustChangeCredentials,
      totpEnabled: !!a.totpEnabledAt,
    })),
    adminCount,
    created: params.created ?? null,
    reset2fa: params.reset2fa === "1",
    roleLabels,
  });
  return <DesignScreen name="administration" html={html} />;
}
