import { NextResponse } from "next/server";
import { adminForAction, refreshServersCache } from "@/lib/adminServers";
import { rateLimitResponse } from "@/lib/rateLimit";
import { acceptTeamRequest, clearTeamField, deleteTeam, refuseTeamRequest, saveTeam } from "@/lib/teams";

// Teams d'un joueur depuis sa fiche admin (teams, 19/10) : creer une team (sans limite de nombre),
// changer le nom et la description d'une de ses teams (les noms reserves comme « Omniscient »
// sont permis ici), retirer l'icone ou la description, ou supprimer une team. Route courte (pas sous players/[id]) : le dossier local
// n'accepte pas de chemins plus profonds. L'icone se depose depuis l'onglet « Ma team » du compte.
const ERRORS: Record<string, string> = {
  nameLength: "Le nom doit faire entre 3 et 24 caractères.",
  nameChars: "Lettres, chiffres, espaces et . _ - ' seulement.",
  nameBanned: "Ce nom contient un mot interdit.",
  icon: "Icône refusée.",
  nameTaken: "Ce nom est déjà pris par une autre team.",
  renameTooSoon: "Nom changé il y a moins de 30 jours.",
  descriptionLength: "La description fait plus de 160 caractères.",
  descriptionLink: "Pas de lien dans la description.",
  descriptionBanned: "La description contient un mot interdit.",
};

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-team", 30);
  if (limited) return limited;
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;

  const form = await request.formData();

  // Page « Demandes de team » (/admin/teams) : accepter (cree la team) ou refuser avec un motif.
  const requestAction = String(form.get("action") ?? "");
  if (requestAction === "acceptRequest" || requestAction === "refuseRequest") {
    const requestId = String(form.get("requestId") ?? "");
    const result =
      requestAction === "acceptRequest"
        ? await acceptTeamRequest(requestId, admin.username)
        : await refuseTeamRequest(requestId, admin.username, String(form.get("reason") ?? ""));
    const target = new URL("/admin/teams", request.url);
    target.searchParams.set("tab", "demandes");
    if ("error" in result) target.searchParams.set("error", result.error);
    else target.searchParams.set("done", requestAction === "acceptRequest" ? "accepted" : "refused");
    if (requestAction === "acceptRequest" && !("error" in result)) refreshServersCache();
    return NextResponse.redirect(target, 303);
  }

  const userId = String(form.get("userId") ?? "");
  const teamId = String(form.get("teamId") ?? "") || null;
  const action = String(form.get("action") ?? "");
  // Depuis la page admin « Teams » (back=teams) : retour sur cette page avec un message, au lieu
  // de la fiche du joueur.
  const fromTeamsPage = form.get("back") === "teams";
  const backToTeams = (key: "done" | "error", value: string) => {
    const target = new URL("/admin/teams", request.url);
    target.searchParams.set(key, value);
    return NextResponse.redirect(target, 303);
  };
  if (!userId) return NextResponse.json({ error: "Joueur introuvable." }, { status: 400 });
  if (action !== "save" && !teamId) return NextResponse.json({ error: "Team introuvable." }, { status: 400 });

  if (action === "save") {
    const result = await saveTeam(
      userId,
      teamId,
      { name: String(form.get("name") ?? ""), description: String(form.get("description") ?? ""), iconUrl: String(form.get("iconUrl") ?? "") || null },
      { host: request.headers.get("host"), isAdmin: true },
    );
    if ("error" in result) {
      const message = ERRORS[result.error] ?? "Enregistrement impossible.";
      return fromTeamsPage ? backToTeams("error", message) : NextResponse.json({ error: message }, { status: 400 });
    }
  } else if (action === "clearIcon") {
    await clearTeamField(teamId!, "icon");
  } else if (action === "clearDescription") {
    await clearTeamField(teamId!, "description");
  } else if (action === "delete") {
    await deleteTeam(userId, teamId!);
  } else {
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }
  refreshServersCache();
  if (fromTeamsPage) return backToTeams("done", action);
  return NextResponse.redirect(new URL(`/admin/players/${encodeURIComponent(userId)}`, request.url), 303);
}
