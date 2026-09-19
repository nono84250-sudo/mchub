import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { deleteServer, toggleServerPublished, duplicateServer } from "@/lib/actions/servers";

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{server.name}</h1>
        <form action={boundDelete}>
          <button type="submit" className="text-sm text-danger hover:underline">
            Supprimer ce serveur
          </button>
        </form>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="tag-chip">{server.published ? "Publié" : "En pause"}</span>
        <form action={boundTogglePublished}>
          <button type="submit" className="text-sm text-accent hover:underline">
            {server.published ? "Mettre en pause" : "Republier"}
          </button>
        </form>
        {server.published ? (
          <Link href={`/servers/${server.slug}`} className="text-sm text-muted hover:text-foreground">
            Voir la fiche publique
          </Link>
        ) : null}
        <form action={boundDuplicate}>
          <button type="submit" className="text-sm text-muted hover:text-foreground">
            Dupliquer ce serveur
          </button>
        </form>
      </div>

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
