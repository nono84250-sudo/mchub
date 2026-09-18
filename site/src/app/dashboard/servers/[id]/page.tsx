import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { updateServer, deleteServer } from "@/lib/actions/servers";
import { getMinecraftVersions } from "@/lib/minecraft-versions";
import { ServerForm } from "@/components/ServerForm";

export const metadata = { title: "Modifier le serveur — Omniscient" };

export default async function EditServerPage({ params }: PageProps<"/dashboard/servers/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const server = await db.orm.public.Server.where({ id, ownerId: session.user.id }).first();
  if (!server) notFound();

  const boundUpdate = updateServer.bind(null, server.id);
  const boundDelete = deleteServer.bind(null, server.id);
  const versions = await getMinecraftVersions();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Modifier {server.name}</h1>
        <form action={boundDelete}>
          <button type="submit" className="text-sm text-danger hover:underline">
            Supprimer ce serveur
          </button>
        </form>
      </div>

      <div className="panel p-6 sm:p-8">
        <ServerForm
          action={boundUpdate}
          submitLabel="Enregistrer les modifications"
          versions={versions}
          defaultValues={{
            name: server.name,
            description: server.description,
            bannerUrl: server.bannerUrl ?? "",
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
