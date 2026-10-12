import { redirect } from "next/navigation";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/adminSession";

// getCurrentAdmin est deja memoise par requete (React.cache) a sa source dans lib/adminSession.ts
// — reexporte ici pour compatibilite avec le code existant qui l'importe depuis ce fichier,
// mais c'est bien la MEME instance cache() partout (voir le commentaire dans adminSession.ts).
export { getCurrentAdmin };

// Garde des pages du panel : connexion obligatoire, puis changement d'identifiants
// si le compte l'exige. Renvoie le compte connecté.
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangeCredentials) redirect("/admin/premiere-connexion");
  return admin;
}
