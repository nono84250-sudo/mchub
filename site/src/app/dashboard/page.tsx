import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Mon espace — Omniscient" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { dict } = await getT();

  const servers = await db.orm.public.Server.select("id", "slug", "name", "type", "published", "createdAt")
    .where({ ownerId: session.user.id })
    .orderBy((s) => s.createdAt.desc())
    .all();

  return (
    <div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.dashboard.myServers}</h1>
        <Link href="/dashboard/servers/new" className="btn-primary justify-center sm:self-auto">
          <Plus className="h-4 w-4" />
          {dict.dashboard.newServer}
        </Link>
      </div>

      {servers.length === 0 ? (
        <div className="panel mt-8 p-8 text-center text-muted">{dict.dashboard.empty}</div>
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
                      {server.type === "modded" ? dict.dashboard.modded : dict.dashboard.vanilla}
                      {server.published ? "" : ` · ${dict.dashboard.paused}`}
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-sm text-accent">
                  {dict.dashboard.manage}
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
