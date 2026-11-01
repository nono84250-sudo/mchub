import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { updateServer, deleteServer, toggleServerPublished, duplicateServer } from "@/lib/actions/servers";
import { getMinecraftVersions } from "@/lib/minecraft-versions";
import { allSourceStates, getSourceMaintenance } from "@/lib/platformSettings";
import { ServerForm } from "@/components/ServerForm";
import { ManageActions } from "@/components/ManageActions";
import { getT } from "@/i18n/getDictionary";
import { ServerTeamPicker } from "@/components/ServerTeamPicker";
import { listMyTeams } from "@/lib/teams";
import { TEAMS_READY } from "@/lib/teamRules";
import { featureVisibleOnSite } from "@/lib/features";

export const metadata = { title: "Paramètres — Omniscient" };

export default async function ManageServerSettingsPage({ params }: PageProps<"/manage/[id]/settings">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const server = await db.orm.public.Server.where({ id, ownerId: session.user.id }).first();
  if (!server) notFound();
  const { dict } = await getT();

  const boundUpdate = updateServer.bind(null, server.id);
  const boundDelete = deleteServer.bind(null, server.id);
  const boundTogglePublished = toggleServerPublished.bind(null, server.id);
  const boundDuplicate = duplicateServer.bind(null, server.id);
  const showTeamPicker = TEAMS_READY && (await featureVisibleOnSite("team"));
  const [versions, sourceStates, sourceMaintenance, teams] = await Promise.all([getMinecraftVersions(), allSourceStates(), getSourceMaintenance(), showTeamPicker ? listMyTeams(session.user.id) : Promise.resolve([])]);
  const currentTeamId = (server as { teamId?: string | null }).teamId ?? null;

  const defaultValues = {
    name: server.name,
    description: server.description,
    bannerUrl: server.bannerUrl ?? "",
    iconUrl: server.iconUrl ?? "",
    backgroundUrl: server.backgroundUrl ?? "",
    isPrivate: server.isPrivate,
    type: server.type,
    minecraftVersion: server.minecraftVersion,
    ip: server.ip,
    curseforgeModpackId: server.curseforgeModpackId ?? "",
    modpackSource: server.modpackSource,
    modpackChannel: server.modpackChannel,
    curseforgeModpackName: server.curseforgeModpackName ?? "",
    curseforgeModpackVersion: server.curseforgeModpackVersion ?? "",
    recommendedRamGB: server.recommendedRamGB?.toString() ?? "",
    autoConnect: server.autoConnect,
    addToServerList: server.addToServerList !== false,
  };
  // Controle "Publier" (visibilite publique) masque tant que l'auto-test de publication
  // (launcher, voir /api/launcher/servers/[slug]/self-test) n'a pas encore reussi une fois.
  const canPublish = !!server.selfTestPassedAt;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">{dict.manage.settingsTitle}</h1>

      <div className="panel p-6 sm:p-8">
        <ServerForm
          // Remonte le formulaire quand les valeurs enregistrees changent :
          // le select de version/le type gardent un etat React local
          // initialise une seule fois au montage (voir ServerForm), qui ne se
          // resynchronise jamais tout seul avec des props mises a jour — sans
          // ce remount, la valeur choisie juste avant semblait "revenir" a
          // l'ancienne apres l'enregistrement (visuel seulement, la base est
          // deja a jour) jusqu'a un rechargement complet de la page. Cle
          // fondee sur les valeurs et non sur updatedAt : Pause/Republier
          // (ManageActions, dans ce meme formulaire) change updatedAt sans
          // toucher aux champs, et ne doit pas effacer une saisie en cours.
          key={JSON.stringify(defaultValues)}
          action={boundUpdate}
          submitLabel={dict.manage.saveChanges}
          versions={versions}
          serverId={server.id}
          inviteCode={server.inviteCode}
          canPublish={canPublish}
          sourceStates={sourceStates}
          sourceMaintenance={sourceMaintenance}
          defaultValues={defaultValues}
        >
          <div className="border-t border-border pt-5">
            <ManageActions
              slug={server.slug}
              serverName={server.name}
              published={server.published}
              isPrivate={server.isPrivate}
              frozen={server.frozenAt !== null}
              verificationStatus={server.verificationStatus}
              onTogglePublished={boundTogglePublished}
              onDuplicate={boundDuplicate}
              onDelete={boundDelete}
            />
          </div>
        </ServerForm>
      </div>

      {showTeamPicker ? (
        <ServerTeamPicker
          serverId={server.id}
          teams={teams.map((team) => ({ id: team.id, name: team.name }))}
          current={teams.some((team) => team.id === currentTeamId) ? currentTeamId : null}
        />
      ) : null}
    </div>
  );
}
