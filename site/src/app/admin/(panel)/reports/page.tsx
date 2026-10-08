import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";

export const dynamic = "force-dynamic";

// Cette maquette concerne les signalements de comportement/contenu (modération), une
// categorie qui n'existe pas dans le projet (le launcher ne propose que les problemes
// techniques, qui partent chez le proprietaire). Pas un gain facile : nouvelle categorie,
// nouveau modele, flux de moderation, et une modification du launcher — donc rouge, pas
// jaune, tant que ce chantier n'est pas lance pour de vrai.
export default async function Reports() {
  await requireAdmin();
  return <DesignScreen name="reports" markAll />;
}
