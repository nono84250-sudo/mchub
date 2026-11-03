import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getT } from "@/i18n/getDictionary";
import { featureOnSite } from "@/lib/features";
import { getUserOffer, listCloudWorlds, listOffers, pruneCloud } from "@/lib/playWorlds";
import { cloudUsage, listCloudPacks, ownedServers } from "@/lib/cloudPacks";
import { CloudPanel } from "@/components/CloudPanel";
import { WorldsPanel } from "@/components/WorldsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon cloud — Omniscient" };

// Page « Mon cloud » (03/11, preview v2 validée par Rushi) : remplace « Mes mondes ». Onglet
// Modpacks (liens Modrinth + configs, relier à un serveur) et onglet Mondes (les mondes en ligne
// d'avant, Supporter et Créateur). Offres repliées par défaut, boutons « Bientôt disponible » : le
// paiement n'existe pas encore. Quota, durée et prix viennent de la table playOffer.
export default async function CloudPage({ searchParams }: PageProps<"/dashboard/cloud">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [packsFeature, worldsFeature] = await Promise.all([featureOnSite("cloudPacks"), featureOnSite("worlds")]);
  if (!packsFeature.visible && !worldsFeature.visible) notFound();
  const userId = session.user.id;
  const { dict } = await getT();
  const offer = await getUserOffer(userId);
  const worldsOn = worldsFeature.visible && offer.cloud;
  if (worldsOn) await pruneCloud(userId, offer, { throttle: true });
  const [packs, servers, usage, offers, worlds] = await Promise.all([
    packsFeature.visible ? listCloudPacks(userId) : Promise.resolve([]),
    packsFeature.visible ? ownedServers(userId) : Promise.resolve([]),
    cloudUsage(userId, offer),
    listOffers(),
    worldsOn ? listCloudWorlds(userId) : Promise.resolve([]),
  ]);
  const tabParam = (await searchParams).tab;
  const tab = tabParam === "worlds" || !packsFeature.visible ? "worlds" : "packs";

  return (
    <CloudPanel
      L={dict.cloud}
      beta={packsFeature.beta || worldsFeature.beta}
      showPacks={packsFeature.visible}
      showWorlds={worldsFeature.visible}
      initialTab={tab}
      offer={{ id: offer.id, cloud: offer.cloud, packServers: offer.packServers, keepDays: offer.keepDays }}
      offers={offers.map((o) => ({ id: o.id, cloud: o.cloud, quotaBytes: o.cloud ? o.quotaBytes : o.packQuotaBytes, priceCents: o.priceCents, keepDays: o.keepDays, packServers: o.packServers }))}
      usage={usage}
      packs={packs}
      servers={servers}
      worldsSlot={worldsOn ? <WorldsPanel worlds={worlds} usedBytes={usage.worlds} quotaBytes={offer.quotaBytes} keepDays={offer.keepDays} /> : null}
    />
  );
}
