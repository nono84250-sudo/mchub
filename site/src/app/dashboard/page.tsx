import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/prisma/db";

export const metadata = { title: "Mon espace — MCHub" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const servers = await db.orm.public.Server.select("id", "slug", "name", "type", "createdAt")
    .where({ ownerId: session.user.id })
    .orderBy((s) => s.createdAt.desc())
    .all();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Mes serveurs</h1>
        <Link
          href="/dashboard/servers/new"
          className="rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover transition-colors"
        >
          + Nouveau serveur
        </Link>
      </div>

      {servers.length === 0 ? (
        <p className="mt-8 text-muted">
          Tu n&apos;as pas encore de serveur. Crée ta première fiche pour apparaître dans l&apos;annuaire.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {servers.map((server) => (
            <li key={server.id}>
              <Link
                href={`/dashboard/servers/${server.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent transition-colors"
              >
                <div>
                  <p className="font-medium text-foreground">{server.name}</p>
                  <p className="text-sm text-muted">{server.type === "modded" ? "Moddé" : "Vanilla"}</p>
                </div>
                <span className="text-sm text-accent">Gérer →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
