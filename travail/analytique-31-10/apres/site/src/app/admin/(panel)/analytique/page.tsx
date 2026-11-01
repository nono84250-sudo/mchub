import { notFound } from "next/navigation";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { requireAdmin } from "@/app/admin/design/guard";
import { getAnalyticsSnapshot } from "@/lib/analytics";
import { featureState } from "@/lib/features";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytique — Omniscient" };

// 2026-10-31 : panel Analytique (preview validée par Rushi), voir lib/analytics.ts. Interrupteur du
// Laboratoire sur « Cachée » : ni menu, ni page.
export default async function Analytique() {
  await requireAdmin();
  const state = await featureState("analytics");
  if (state === "hidden") notFound();
  const initial = await getAnalyticsSnapshot().catch((error) => {
    console.error("[analytics] lecture impossible", error);
    return null;
  });
  return (
    <AdminChrome active="analytique">
      <AdminAnalytics initial={initial} everyVisitor={state === "beta" || state === "all"} />
    </AdminChrome>
  );
}
