import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminSession";

export const dynamic = "force-dynamic";

// Point d'entrée du panel : aiguille vers la bonne étape selon la session.
export default async function AdminIndex() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangeCredentials) redirect("/admin/premiere-connexion");
  redirect("/admin/administration");
}
