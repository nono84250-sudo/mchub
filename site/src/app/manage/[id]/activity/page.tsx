import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { getServerActivity, type ActivityRange } from "@/lib/server-activity";
import { ActivityChart } from "@/components/ActivityChart";

export const metadata = { title: "Activité — Omniscient" };

const RANGES: { value: ActivityRange; label: string }[] = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "year", label: "Année" },
];

export default async function ManageServerActivityPage({
  params,
  searchParams,
}: PageProps<"/manage/[id]/activity">) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const server = await db.orm.public.Server.where({ id, ownerId: session.user.id }).first();
  if (!server) notFound();

  const rangeParam = typeof query.range === "string" ? query.range : "week";
  const range: ActivityRange = RANGES.some((r) => r.value === rangeParam) ? (rangeParam as ActivityRange) : "week";

  const data = await getServerActivity(server.id, range);
  const totalViews = data.reduce((sum, p) => sum + p.views, 0);
  const totalLaunches = data.reduce((sum, p) => sum + p.launches, 0);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Activité</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/manage/${server.id}/activity?range=${r.value}`}
            className={r.value === range ? "btn-secondary text-sm" : "btn-secondary text-sm opacity-60"}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="stat-tile">
          <div className="stat-label">Vues sur la période</div>
          <div className="stat-value">{totalViews}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Lancements sur la période</div>
          <div className="stat-value">{totalLaunches}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Joueurs en ligne (instantané)</div>
          <div className="stat-value">{server.playerCount ?? "—"}</div>
        </div>
      </div>

      <div className="panel p-4 sm:p-6">
        <ActivityChart data={data} />
      </div>

      <p className="mt-4 text-sm text-muted">
        Le nombre de joueurs en ligne n&apos;est pas encore suivi dans le temps — seule la dernière valeur connue est
        affichée ci-dessus. Un historique demanderait un ping régulier en arrière-plan, qui n&apos;existe pas encore
        pour ce projet.
      </p>
    </div>
  );
}
