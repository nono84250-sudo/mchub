import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { overviewHtml } from "@/app/admin/design/bind";
import { listBehaviorReports } from "@/lib/reports";

export const dynamic = "force-dynamic";

// 2026-10-10 : "Open reports" comptait les signalements TECHNIQUES (categorie "technical",
// jamais traitables depuis ce panel — ils vont au proprietaire du serveur, voir
// lib/actions/reports.ts), alors que le badge "Reports" du menu lateral et /admin/reports
// comptent les signalements COMPORTEMENT (lib/reports.ts, listBehaviorReports), la seule
// categorie que l'admin traite reellement ici. Alignement sur la meme source.
export default async function Overview() {
  await requireAdmin();
  // 2026-10-12 : page desactivee temporairement (perimetre admin reduit), voir administration/page.tsx.
  redirect("/admin/servers");
  const [servers, openReports] = await Promise.all([db.orm.public.Server.select("id").all(), listBehaviorReports("open")]);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const html = overviewHtml({
    servers: servers.length,
    openReports: openReports.length,
    olderThan24h: openReports.filter((r) => new Date(r.createdAt).getTime() < cutoff).length,
  });
  return <DesignScreen name="overview" html={html} />;
}
