import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { setStaffRoleLabels } from "@/lib/platformSettings";

// Renomme juste l'affichage des deux rôles existants (admin/moderator restent les deux seules
// valeurs réelles, voir adminAuth.ts) — demandé séparément du système de permissions fin.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;

  const form = await request.formData();
  const adminLabel = String(form.get("admin") ?? "").trim().slice(0, 24);
  const moderatorLabel = String(form.get("moderator") ?? "").trim().slice(0, 24);
  if (!adminLabel || !moderatorLabel) {
    return NextResponse.json({ error: "Les deux noms de rôle sont requis." }, { status: 400 });
  }

  await setStaffRoleLabels({ admin: adminLabel, moderator: moderatorLabel });
  return NextResponse.redirect(new URL("/admin/servers", request.url), 303);
}
