import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { GlobeHemisphereWest, LockSimple } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getServerActivity } from "@/lib/server-activity";
import { getServerStatus } from "@/lib/server-status";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import { FROZEN_CHIP_STYLE, PENDING_CHIP_STYLE } from "@/lib/frozen";
import { getFreshness, freshnessChipStyle } from "@/lib/freshness";
import { requestAppeal } from "@/lib/actions/servers";
import { AppealRequestButton } from "@/components/AppealRequestButton";
import { appealUsedForCurrentFreeze } from "@/lib/appeals";
import Link from "next/link";
import { parsePageConfig } from "@/lib/serverPage";
import { PlayLinkField } from "@/components/PlayLinkField";
import { readManualModsJson } from "@/lib/manualMods";
import { STATE_COLOR, gaugePercent, serverState } from "@/lib/playerGauge";

export const metadata = { title: "Vue d'ensemble — Omniscient" };

function OverviewStat({ label, caption, children }: { label: string; caption: string; children: ReactNode }) {
  return (
    <div className="flex min-w-40 flex-auto flex-col gap-1.5 rounded-lg border border-border bg-surface px-[18px] py-4">
      <span className="whitespace-nowrap text-[11px] uppercase tracking-[0.04em] text-muted2">{label}</span>
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

  // Badge de fraicheur (voir lib/freshness.ts) : meme niveau/wording que la fiche publique
  // (ServerDetailView.tsx), affiche ici cote proprietaire a cote du statut existant.
  const freshness = getFreshness(server.selfTestPassedAt);

  // Design 2026-10-17, point 7 : checklist de fiche, calculee avec ce que la fiche contient
  // deja (rien de nouveau en base). Chaque ligne non cochee mene au bon ecran.
  const pageConfig = parsePageConfig(server.pageConfig);
  const launcherTestHref = server.isPrivate && server.inviteCode
    ? `omniscient://join/${encodeURIComponent(server.inviteCode.toUpperCase())}`
    : `omniscient://server/${encodeURIComponent(server.slug)}`;
  const checklist = [
    { label: dict.manage.checkIconBanner, done: !!server.iconUrl && !!server.bannerUrl, href: `/manage/${server.id}/settings` },
    { label: dict.manage.checkDescription, done: server.description.trim().length >= 20, href: `/manage/${server.id}/settings` },
    { label: dict.manage.checkTags, done: pageConfig.tags.length > 0, href: `/manage/${server.id}/public-page` },
    { label: dict.manage.checkDiscord, done: !!server.discordUrl, href: `/manage/${server.id}/public-page` },
    { label: dict.manage.checkTested, done: !!server.selfTestPassedAt, href: launcherTestHref },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const percent = Math.round((doneCount / checklist.length) * 100);
  const nextStep = checklist.find((c) => !c.done);
  const views7 = activity.slice(-7).reduce((sum, point) => sum + point.views, 0);
  const playPath = server.isPrivate && server.inviteCode ? `/join/${server.inviteCode}` : `/servers/${server.slug}`;

  const createdOn = new Date(server.createdAt).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">{dict.manage.overviewTitle}</h1>

      {/* Carte « etat du serveur » : l'etat, la semaine, et la prochaine chose a faire. */}
      <div
        className="mb-4 flex flex-wrap items-center gap-3.5 rounded-2xl border px-4 py-3.5"
        style={
          status.playerCount != null
            ? { background: "color-mix(in srgb, var(--success) 12%, var(--surface))", borderColor: "color-mix(in srgb, var(--success) 40%, transparent)" }
            : { background: "var(--surface)", borderColor: "var(--border)" }
        }
      >
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-foreground">
            {status.playerCount == null
              ? dict.manage.stateOffline
              : status.playerCount === 1
                ? dict.manage.stateOnlineOne
                : t(dict, "manage.stateOnline", { count: status.playerCount })}
            <span className="font-normal text-muted"> · {t(dict, "manage.stateViews", { count: views7 })}</span>
          </p>
          <p className="text-[12.5px] text-muted">
            {nextStep ? t(dict, "manage.stateNext", { step: nextStep.label.replace(/\s*→$/, "").toLowerCase() }) : dict.manage.stateNextDone}
          </p>
        </div>
        {nextStep ? (
          <Link href={nextStep.href} className="btn-fill px-3 py-1.5 text-[13px]">
            {dict.manage.stateAdd}
          </Link>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-3.5">
        <OverviewStat label={dict.manage.viewsStat} caption={dict.manage.statLast30Days}>
          {views30}
        </OverviewStat>
        <OverviewStat label={dict.manage.launchesStat} caption={dict.manage.statLast30Days}>
          {launches30}
        </OverviewStat>
        {/* Memes couleurs d'etat que les joueurs (variante C, 17/10) : le proprietaire voit ce
            qu'ils voient. */}
        <OverviewStat label={dict.manage.playersOnlineStat} caption={dict.manage.statRightNow}>
          {status.playerCount ?? "—"}
          {status.playerCapacity ? <span className="text-sm text-muted"> / {status.playerCapacity}</span> : null}
          {gaugePercent(status.playerCount, status.playerCapacity) !== null ? (
            <span aria-hidden="true" className="mt-1.5 block h-[5px] w-full max-w-[140px] overflow-hidden rounded-full bg-foreground/10">
              <span
                className="block h-full rounded-full"
                style={{ width: `${gaugePercent(status.playerCount, status.playerCapacity)}%`, background: STATE_COLOR[serverState(status.playerCount, status.playerCapacity)] }}
              />
            </span>
          ) : null}
          <span className="mt-1 block text-xs font-semibold" style={{ color: STATE_COLOR[serverState(status.playerCount, status.playerCapacity)] }}>
            {dict.servers.state[serverState(status.playerCount, status.playerCapacity)]}
          </span>
        </OverviewStat>
      </div>

      {percent < 100 ? (
        <div
          className="mb-4 flex flex-col gap-2.5 rounded-2xl border bg-surface p-4"
          style={{ borderColor: "color-mix(in srgb, var(--accent) 50%, var(--border))" }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2.5">
            <p className="text-base font-semibold text-foreground">{t(dict, "manage.checklistTitle", { percent })}</p>
            <small className="tabular-nums text-muted">
              {doneCount}/{checklist.length}
            </small>
          </div>
          <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-foreground/10">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
          </span>
          <ul className="grid grid-cols-1 gap-x-[18px] gap-y-1.5 sm:grid-cols-2">
            {checklist.map((item) => (
              <li key={item.label}>
                {item.done ? (
                  <span className="flex items-center gap-2 py-[3px] text-[13.5px] text-muted line-through decoration-muted/50">
                    <span className="grid h-4 w-4 flex-shrink-0 place-items-center rounded border-[1.5px] border-success bg-success text-[11px] text-[#06261a] no-underline">✓</span>
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="flex items-center gap-2 py-[3px] text-[13.5px] text-accent hover:underline">
                    <span className="h-4 w-4 flex-shrink-0 rounded border-[1.5px] border-muted" />
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mb-4 text-[13px]" style={{ color: "var(--success)" }}>
          {dict.manage.checklistDone}
        </p>
      )}

      {/* Lot 5 (18/10) : mods que tes joueurs ajouteront a la main (liste du dernier test). */}
      {(() => {
        const mods = readManualModsJson((server as { manualModsJson?: string | null }).manualModsJson);
        if (!mods.length) return null;
        return (
          <div
            className="mb-4 flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-[13px]"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))", background: "color-mix(in srgb, var(--accent) 6%, var(--surface))" }}
          >
            <p className="font-medium text-foreground">
              {t(dict, mods.length === 1 ? "manage.manualModsLineOne" : "manage.manualModsLine", { count: mods.length })}
            </p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted">
              {mods.map((m) =>
                m.pageUrl ? (
                  <li key={m.fileName || m.modName}>
                    <a href={m.pageUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {m.modName}
                    </a>
                  </li>
                ) : (
                  <li key={m.fileName || m.modName}>{m.modName}</li>
                ),
              )}
            </ul>
          </div>
        );
      })()}

      <div className="mb-4 flex flex-col gap-1.5">
        <p className="text-[13px] font-medium text-foreground">{dict.manage.playLinkTitle}</p>
        <PlayLinkField path={playPath} />
      </div>

      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        <DetailRow label={dict.manage.detailStatus}>
          <span
            className={
              server.frozenAt || server.verificationStatus !== "approved" || !server.published || server.isPrivate
                ? "tag-chip"
                : "tag-chip tag-chip-accent"
            }
            style={
              server.frozenAt
                ? FROZEN_CHIP_STYLE
                : server.verificationStatus === "pending"
                  ? PENDING_CHIP_STYLE
                  : server.verificationStatus === "rejected"
                    ? { color: "var(--danger)" }
                    : undefined
            }
          >
            {server.frozenAt
              ? dict.manage.frozen
              : server.verificationStatus === "pending"
                ? dict.manage.pendingVerification
                : server.verificationStatus === "rejected"
                  ? dict.manage.rejectedVerification
                  : server.published && !server.isPrivate
                    ? dict.manage.published
                    : server.isPrivate
                      ? dict.manage.notPublished
                      : dict.manage.paused}
          </span>
        </DetailRow>
        {server.frozenAt ? (
          <div className="flex flex-col gap-1.5 px-4 py-3">
            <span className="whitespace-nowrap text-[13px] text-muted">{dict.manage.detailFrozenReason}</span>
            <span className="text-[13.5px]" style={{ color: "var(--frozen)" }}>
              {dict.manage.frozenBy}
            </span>
            {server.frozenReason ? (
              <span className="whitespace-pre-wrap break-words text-[13.5px] text-foreground">{server.frozenReason}</span>
            ) : null}
            {server.appealStatus === "pending" ? (
              <p className="pt-1 text-[13.5px] text-muted">
                {t(dict, server.appealAssignedAdminId ? "manage.appealPendingSecondOpinion" : "manage.appealPendingReflection", {
                  date: server.appealDeadline ? new Date(server.appealDeadline).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—",
                })}
              </p>
            ) : appealUsedForCurrentFreeze(server) ? (
              <p className="pt-1 text-[13.5px] text-muted">{dict.manage.appealUsed}</p>
            ) : (
              <div className="pt-1">
                <AppealRequestButton
                  onRequest={requestAppeal.bind(null, server.id)}
                  label={dict.manage.appealRequest}
                  confirmText={dict.manage.appealRequestConfirm}
                />
              </div>
            )}
          </div>
        ) : null}
        {!server.frozenAt && server.verificationStatus === "pending" ? (
          <div className="flex flex-col gap-1.5 px-4 py-3">
            <span className="text-[13.5px] text-foreground">{dict.manage.pendingVerificationHint}</span>
          </div>
        ) : null}
        {!server.frozenAt && server.verificationStatus === "rejected" ? (
          <div className="flex flex-col gap-1.5 px-4 py-3">
            <span className="whitespace-nowrap text-[13px] text-muted">{dict.manage.detailVerificationReason}</span>
            {server.verificationReason ? (
              <span className="whitespace-pre-wrap break-words text-[13.5px] text-foreground">{server.verificationReason}</span>
            ) : null}
          </div>
        ) : null}
        <DetailRow label={dict.manage.detailFreshness}>
          <span className="tag-chip" style={freshnessChipStyle(freshness.level)}>
            {t(dict, `freshness.${freshness.level}`, { days: freshness.days })}
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
        <DetailRow label={dict.manage.detailVersion}>
          <span className="text-[13.5px] text-foreground">{server.minecraftVersion}</span>
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
