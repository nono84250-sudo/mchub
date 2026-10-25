import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getT } from "@/i18n/getDictionary";
import { getPlayBeta, getUserOffer, listCloudWorlds, listOffers, pruneCloud, usedBytes } from "@/lib/playWorlds";
import { WorldsPanel, WorldsPlans } from "@/components/WorldsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes mondes — Omniscient" };

// Page « Mes mondes » (mode Jouer, bêta, 24/10, preview validée par Rushi, variante C). Supporter :
// les mondes envoyés par le launcher, leurs versions (.zip, Restaurer, Supprimer). Gratuit : ce que
// Supporter ajoute, bouton inactif tant que le paiement n'existe pas. Quota, durée et prix viennent
// de la table playOffer (jamais écrits ici).
export default async function MondesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const { dict, locale } = await getT();
  const w = dict.worlds;
  const [offer, beta] = await Promise.all([getUserOffer(userId), getPlayBeta()]);
  const betaTag = beta ? (
    <span className="ml-2 inline-block rounded-full bg-[color-mix(in_srgb,var(--state-busy)_18%,transparent)] px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-[var(--state-busy)]">
      {w.beta}
    </span>
  ) : null;

  if (!offer.cloud) {
    const supporter = (await listOffers()).find((o) => o.cloud) ?? null;
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {w.title}
          {betaTag}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{w.freeLead}</p>
        <WorldsPlans supporter={supporter} locale={locale} />
      </div>
    );
  }

  await pruneCloud(userId, offer);
  const [worlds, used] = await Promise.all([listCloudWorlds(userId), usedBytes(userId)]);
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {w.title}
        {betaTag}
        <span className="ml-2 inline-block rounded-full bg-[color-mix(in_srgb,var(--state-busy)_14%,transparent)] px-2 py-0.5 align-middle text-xs font-semibold text-[var(--state-busy)]">
          {w.supporter}
        </span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{w.lead}</p>
      <WorldsPanel worlds={worlds} usedBytes={used} quotaBytes={offer.quotaBytes} keepDays={offer.keepDays} />
    </div>
  );
}
