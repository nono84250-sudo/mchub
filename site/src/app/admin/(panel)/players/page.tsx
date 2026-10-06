import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";

export const dynamic = "force-dynamic";

// La maquette n'a pas de liste de joueurs (seulement la fiche d'un joueur) : la liste
// est donc marquée comme non branchée. La fiche est ouverte depuis la liste plus tard.
export default async function AdminPlayers() {
  await requireAdmin();
  return <DesignScreen name="player-detail" markAll />;
}
