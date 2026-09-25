import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { GlobeHemisphereWest, LockSimple } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { getServerActivity } from "@/lib/server-activity";
import { getServerStatus } from "@/lib/server-status";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Vue d'ensemble — Omniscient" };

function OverviewStat({ label, caption, children }: { label: string; caption: string; children: ReactNode }) {
  return (
    <div className="flex min-w-40 flex-1 flex-col gap-1.5 rounded-lg border border-border bg-surface px-[18px] py-4">
      <span className="text-[11px] uppercase tracking-[0.04em] text-muted2">{label}</span>
      <span className="text-[22px] font-medium text-foreground">{children}</span>
      <span className="text-xs text-muted">{caption}</span>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-[13px] text-muted">{label}</span>
      {children}
    </div>
  );
}

export default async function ManageServerOverviewPage({ params }: PageProps<"/manage/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const server = await db.orm.public.Server.where({ id, ownerId: session.user.id }).first();
  if (!server) notFound();
  const { locale, dict } = await getT();

  // Statut re-mesure en direct si la derniere mesure a plus d'une minute (voir
  // getServerStatus) : c'est ce qui rend "en ce moment" vrai, contrairement a
  // la page Activite qui n'affiche que la derniere valeur deja en base.
  const [activity, status] = await Promise.all([
    getServerActivity(server.id, "month"),
    getServerStatus(server.id, server.ip, server),
  ]);
  const views30 = activity.reduce((sum, point) => sum + point.views, 0);
  const launches30 = activity.reduce((sum, point) => sum + point.launches, 0);

  const createdOn = new Date(server.createdAt).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">{dict.manage.overviewTitle}</h1>

      <div className="mb-4 flex flex-wrap gap-3.5">
        <OverviewStat label={dict.manage.viewsStat} caption={dict.manage.statLast30Days}>
          {views30}
        </OverviewStat>
        <OverviewStat label={dict.manage.launchesStat} caption={dict.manage.statLast30Days}>
          {launches30}
        </OverviewStat>
        <OverviewStat label={dict.manage.playersOnlineStat} caption={dict.manage.statRightNow}>
          {status.playerCount ?? "—"}
          {status.playerCapacity != null ? <span className="text-sm text-muted"> / {status.playerCapacity}</span> : null}
        </OverviewStat>
      </div>

      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        <DetailRow label={dict.manage.detailStatus}>
          <span className={server.published ? "tag-chip tag-chip-accent" : "tag-chip"}>
            {server.published ? dict.manage.published : dict.manage.paused}
          </span>
        </DetailRow>
        <DetailRow label={dict.manage.detailVisibility}>
          <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-foreground">
            {server.isPrivate ? <LockSimple className="h-4 w-4" /> : <GlobeHemisphereWest className="h-4 w-4" />}
            {server.isPrivate ? dict.serverForm.visibilityPrivate : dict.serverForm.visibilityPublic}
          </span>
        </DetailRow>
        <DetailRow label={dict.manage.detailAddress}>
          <span className="font-mono text-[12.5px] text-foreground">{server.ip}</span>
        </DetailRow>
        {server.isPrivate && server.inviteCode ? (
          <DetailRow label={dict.manage.detailInviteCode}>
            <span className="font-mono text-[12.5px] text-foreground">{server.inviteCode}</span>
          </DetailRow>
        ) : null}
        <DetailRow label={dict.manage.detailCreated}>
          <span className="text-[13.5px] text-foreground">{createdOn}</span>
        </DetailRow>
      </div>
    </div>
  );
}
