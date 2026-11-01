"use server";

import { headers } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";
import { deleteTeam, saveTeam, setServerTeam, submitTeamRequest, type TeamRequestSubmitError, type TeamSaveError } from "@/lib/teams";
import { featureVisibleOnSite } from "@/lib/features";

export type TeamActionState = { error: TeamSaveError } | { savedAt: number; id: string; slug: string } | undefined;
export type TeamRequestActionState = { error: TeamRequestSubmitError } | { sentAt: number } | undefined;

const TEAM_PAGE_PATH = "/dashboard/team";

function refresh() {
  // Le nom, l'icone et la team de chaque serveur apparaissent sur les fiches (cache des fiches).
  updateTag(SERVERS_CACHE_TAG);
  revalidatePath(TEAM_PAGE_PATH);
}

// Onglet « Ma team » (teams, 19/10) : creer (champ teamId vide) ou modifier une team. Tout est
// revérifie dans lib/teams.ts (saveTeam) ; ici seulement la session et une limite d'essais (un
// nom deja pris se devine sinon a la chaine).
export async function saveTeamAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "generic" };
  if (!(await featureVisibleOnSite("team"))) return { error: "generic" };
  if (checkRateLimit(`team-write:${session.user.id}`, 10, 60_000).limited) return { error: "generic" };

  const result = await saveTeam(
    session.user.id,
    String(formData.get("teamId") ?? "") || null,
    {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      iconUrl: String(formData.get("iconUrl") ?? "") || null,
    },
    { host: (await headers()).get("host") },
  );
  if ("error" in result) return { error: result.error };
  refresh();
  return { savedAt: Date.now(), id: result.id, slug: result.slug };
}

export async function deleteTeamAction(teamId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  if (!(await featureVisibleOnSite("team"))) return;
  await deleteTeam(session.user.id, String(teamId));
  refresh();
}

// Interrupteur « Dans la team » de Ma team, liste « Team » de Paramètres : teamId null = aucune.
export async function setServerTeamAction(serverId: string, teamId: string | null): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  if (!(await featureVisibleOnSite("team"))) return { ok: false };
  if (checkRateLimit(`team-server:${session.user.id}`, 60, 60_000).limited) return { ok: false };
  const ok = await setServerTeam(session.user.id, String(serverId), teamId ? String(teamId) : null);
  if (ok) {
    refresh();
    revalidatePath(`/manage/${serverId}/settings`);
  }
  return { ok };
}

// « Demander une autre team » : nom, pourquoi, preuve (lien ou image). Validee par un admin.
export async function submitTeamRequestAction(_prev: TeamRequestActionState, formData: FormData): Promise<TeamRequestActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "generic" };
  if (!(await featureVisibleOnSite("team"))) return { error: "generic" };
  if (checkRateLimit(`team-request:${session.user.id}`, 5, 60_000).limited) return { error: "generic" };
  const result = await submitTeamRequest(
    session.user.id,
    {
      name: String(formData.get("name") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      proof: String(formData.get("proof") ?? ""),
      proofImageUrl: String(formData.get("proofImageUrl") ?? "") || null,
    },
    (await headers()).get("host"),
  );
  if ("error" in result) return { error: result.error };
  revalidatePath(TEAM_PAGE_PATH);
  return { sentAt: Date.now() };
}
