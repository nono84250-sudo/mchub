import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getT } from "@/i18n/getDictionary";
import { featureVisibleOnSite } from "@/lib/features";
import { listMySubmissions } from "@/lib/omniPacks";
import { OmnipackSubmit, type MySubmission } from "@/components/OmnipackSubmit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposer un pack — Omniscient" };

// « Proposer un pack » (Pack Omniscient, 27/10, preview v22 validée par Rushi) : le joueur envoie
// le .omnipack exporté depuis le launcher ; l'équipe le teste puis le publie dans « Packs
// officiels ». Visible seulement si l'interrupteur « Pack Omniscient » du Laboratoire le montre.
export default async function PacksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await featureVisibleOnSite("omniPack"))) notFound();
  const { dict } = await getT();
  const o = dict.omnipack;
  const rows = await listMySubmissions(session.user.id);
  const mine: MySubmission[] = rows.map((r) => {
    let versions = 0;
    try {
      versions = (JSON.parse(r.manifest || "{}").versions ?? []).length;
    } catch {
      versions = 0;
    }
    return { id: r.id, name: r.name, sizeBytes: Number(r.sizeBytes), status: r.status, note: r.note ?? null, createdAt: r.createdAt, versions };
  });
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {o.title}
        <span className="ml-2 inline-block rounded-full bg-[color-mix(in_srgb,var(--state-busy)_18%,transparent)] px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-[var(--state-busy)]">
          {o.beta}
        </span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{o.lead}</p>
      <p className="mt-1 max-w-2xl text-xs text-muted">{o.rules}</p>
      <OmnipackSubmit mine={mine} />
    </div>
  );
}
