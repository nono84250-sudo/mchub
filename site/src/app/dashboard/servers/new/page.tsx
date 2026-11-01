import { redirect } from "next/navigation";
import { featureVisibleOnSite } from "@/lib/features";
import { auth } from "@/auth";
import { createServer } from "@/lib/actions/servers";
import { getMinecraftVersions } from "@/lib/minecraft-versions";
import { allSourceStates, getSourceMaintenance } from "@/lib/platformSettings";
import { NewServerWizard } from "@/components/NewServerWizard";
import { listMyTeams } from "@/lib/teams";

export const metadata = { title: "Nouveau serveur — Omniscient" };

// Hors du groupe (shell) de /dashboard : pas de barre laterale du tableau de
// bord autour, l'assistant prend toute la page (voir SiteChrome et
// NewServerWizard). L'authentification est donc verifiee ici, plus dans le
// layout du tableau de bord.
export default async function NewServerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [versions, sourceStates, sourceMaintenance, teams] = await Promise.all([
    getMinecraftVersions(),
    allSourceStates(),
    getSourceMaintenance(),
    featureVisibleOnSite("team").then((on) => (on ? listMyTeams(session.user.id) : [])),
  ]);

  return (
    <NewServerWizard
      action={createServer}
      versions={versions}
      sourceStates={sourceStates}
      sourceMaintenance={sourceMaintenance}
      teams={teams.map((team) => ({ id: team.id, name: team.name }))}
    />
  );
}
