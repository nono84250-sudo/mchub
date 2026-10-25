import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getT } from "@/i18n/getDictionary";
import { TeamEditor } from "@/components/TeamEditor";
import { getTeamDashboard } from "@/lib/teams";
import { TEAMS_READY } from "@/lib/teamRules";
import { featureVisibleOnSite } from "@/lib/features";

export const metadata = { title: "Ma team — Omniscient" };

// Onglet « Ma team » (teams, 19/10) : entre Amis et Actualites, choix de Rushi. Ses teams, un
// interrupteur par serveur et la demande d'une autre team (lib/teams.ts, getTeamDashboard : un
// appels en parallele). Cache tant que la migration des teams n'est pas lancee (TEAMS_READY).
export default async function TeamDashboardPage() {
  if (!TEAMS_READY) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await featureVisibleOnSite("team"))) notFound();
  const [{ dict }, data] = await Promise.all([getT(), getTeamDashboard(session.user.id)]);

  return (
    <div>
      <h1 className="text-[26px] font-bold tracking-tight text-foreground">{dict.team.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{dict.team.intro}</p>
      <TeamEditor teams={data.teams} servers={data.servers} lastRequest={data.lastRequest} />
    </div>
  );
}
