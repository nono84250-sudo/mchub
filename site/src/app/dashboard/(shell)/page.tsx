import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowRight, Globe, LockSimple } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Mon espace — Omniscient" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { dict } = await getT();

  const servers = await db.orm.public.Server.select("id", "slug", "name", "type", "published", "isPrivate", "createdAt")
    .where({ ownerId: session.user.id })
    .orderBy((s) => s.createdAt.desc())
    .all();

  return (
    <div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="text-[26px] font-bold tracking-tight text-foreground">{dict.dashboard.myServers}</h1>
        <Link href="/dashboard/servers/new" className="btn-primary justify-center sm:self-auto">
          <Plus className="h-4 w-4" />
          {dict.dashboard.newServer}
        </Link>
      </div>

      {servers.length === 0 ? (
        <div className="panel mt-8 p-8 text-center text-muted">{dict.dashboard.empty}</div>
      ) : (
        <ul className="mt-8 flex flex-col gap-2.5">
          {servers.map((server) => (
            <li key={server.id}>
              <Link
                href={`/manage/${server.id}`}
                className="panel glow-card flex items-center justify-between gap-4 px-[18px] py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="server-icon h-[38px] w-[38px] flex-shrink-0 text-[15px]">
                    {server.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{server.name}</p>
                    <p className="text-[13px] text-muted">
                      {server.type === "modded" ? dict.dashboard.modded : dict.dashboard.vanilla}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-5">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        server.published
                          ? "tag-chip tag-chip-accent px-[9px] py-[3px] text-[11px]"
                          : "tag-chip border-transparent px-[9px] py-[3px] text-[11px] text-muted"
                      }
                    >
                      {server.published ? dict.dashboard.published : dict.dashboard.paused}
                    </span>
                    <span className="hidden items-center gap-[5px] text-[12.5px] text-muted sm:inline-flex">
                      {server.isPrivate ? <LockSimple className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                      {server.isPrivate ? dict.dashboard.visibilityPrivate : dict.dashboard.visibilityPublic}
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm text-accent">
                    {dict.dashboard.manage}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
