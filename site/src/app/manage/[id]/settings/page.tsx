import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { updateServer } from "@/lib/actions/servers";
import { getMinecraftVersions } from "@/lib/minecraft-versions";
import { ServerForm } from "@/components/ServerForm";

export const metadata = { title: "Paramètres — Omniscient" };

export default async function ManageServerSettingsPage({ params }: PageProps<"/manage/[id]/settings">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const server = await db.orm.public.Server.where({ id, ownerId: session.user.id }).first();
  if (!server) notFound();

  const boundUpdate = updateServer.bind(null, server.id);
  const versions = await getMinecraftVersions();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Paramètres</h1>

      <div className="panel p-6 sm:p-8">
        <ServerForm
          // Remonte le formulaire a chaque sauvegarde reussie (updatedAt
          // change) : le select de version/le type gardent un etat React
          // local initialise une seule fois au montage (voir ServerForm),
          // qui ne se resynchronise jamais tout seul avec des props mises a
          // jour — sans ce remount, la valeur choisie juste avant semblait
          // "revenir" a l'ancienne apres l'enregistrement (visuel seulement,
          // la base est deja a jour) jusqu'a un rechargement complet de la
          // page.
          key={server.updatedAt}
          action={boundUpdate}
          submitLabel="Enregistrer les modifications"
          versions={versions}
          defaultValues={{
            name: server.name,
            description: server.description,
            bannerUrl: server.bannerUrl ?? "",
            iconUrl: server.iconUrl ?? "",
            type: server.type,
            minecraftVersion: server.minecraftVersion,
            ip: server.ip,
            curseforgeModpackId: server.curseforgeModpackId ?? "",
            curseforgeModpackName: server.curseforgeModpackName ?? "",
            curseforgeModpackVersion: server.curseforgeModpackVersion ?? "",
            recommendedRamGB: server.recommendedRamGB?.toString() ?? "",
          }}
        />
      </div>
    </div>
  );
}
