import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { deleteServer, toggleServerPublished, duplicateServer } from "@/lib/actions/servers";
import { ManageActions } from "@/components/ManageActions";

export const metadata = { title: "Vue d'ensemble — Omniscient" };

export default async function ManageServerOverviewPage({ params }: PageProps<"/manage/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const server = await db.orm.public.Server.where({ id, ownerId: session.user.id }).first();
  if (!server) notFound();

  const boundDelete = deleteServer.bind(null, server.id);
  const boundTogglePublished = toggleServerPublished.bind(null, server.id);
  const boundDuplicate = duplicateServer.bind(null, server.id);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">{server.name}</h1>

      <ManageActions
        slug={server.slug}
        published={server.published}
        onTogglePublished={boundTogglePublished}
        onDuplicate={boundDuplicate}
        onDelete={boundDelete}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-tile">
          <div className="stat-label">Vues de la fiche</div>
          <div className="stat-value">{server.viewCount}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Lancements via le launcher</div>
          <div className="stat-value">{server.launchCount}</div>
        </div>
      </div>
    </div>
  );
}
