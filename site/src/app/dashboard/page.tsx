import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/prisma/db";

export const metadata = { title: "Mon espace — Omniscient" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const servers = await db.orm.public.Server.select("id", "slug", "name", "type", "published", "createdAt")
    .where({ ownerId: session.user.id })
    .orderBy((s) => s.createdAt.desc())
    .all();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mes serveurs</h1>
        <Link href="/dashboard/servers/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          Nouveau serveur
        </Link>
      </div>

      {servers.length === 0 ? (
        <div className="panel mt-8 p-8 text-center text-muted">
          Tu n&apos;as pas encore de serveur. Crée ta première fiche pour apparaître dans l&apos;annuaire.
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {servers.map((server) => (
            <li key={server.id}>
              <Link
                href={`/manage/${server.id}`}
                className="glow-card flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="server-icon h-9 w-9 text-sm">{server.name.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div>
                    <p className="font-medium text-foreground">{server.name}</p>
                    <p className="text-sm text-muted">
                      {server.type === "modded" ? "Moddé" : "Vanilla"}
                      {server.published ? "" : " · En pause"}
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-sm text-accent">
                  Gérer
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
