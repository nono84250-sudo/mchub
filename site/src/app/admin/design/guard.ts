import { redirect } from "next/navigation";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/adminSession";

// Garde des pages du panel : connexion obligatoire, puis changement d'identifiants
// si le compte l'exige. Renvoie le compte connecté.
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangeCredentials) redirect("/admin/premiere-connexion");
  return admin;
}
