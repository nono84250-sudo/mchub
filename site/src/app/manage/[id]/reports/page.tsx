import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { listReportsForServer, getReportDetail, type ReportStatus, type ReportIssue } from "@/lib/reports";
import { markReportResolved } from "@/lib/actions/reports";
import { ReportReplyForm } from "@/components/ReportReplyForm";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Signalements — Omniscient" };

const ISSUE_KEYS: Record<ReportIssue, string> = {
  cant_connect: "issueCantConnect",
  wrong_version: "issueWrongVersion",
  modpack_download: "issueModpackDownload",
  crash: "issueCrash",
  other: "issueOther",
};

const STATUS_KEYS: Record<ReportStatus, string> = {
  new: "statusNew",
  replied: "statusReplied",
  resolved: "statusResolved",
};

export default async function ManageServerReportsPage({ params, searchParams }: PageProps<"/manage/[id]/reports">) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const server = await db.orm.public.Server.where({ id, ownerId: session.user.id }).first();
  if (!server) notFound();
  const { dict } = await getT();
  const reportsDict = dict.reports as unknown as Record<string, string>;

  const allReports = await listReportsForServer(server.id);
  const tab = query.tab === "resolved" ? "resolved" : "open";
  const filtered = allReports.filter((r) => (tab === "resolved" ? r.status === "resolved" : r.status !== "resolved"));
  const openCount = allReports.filter((r) => r.status !== "resolved").length;
  const resolvedCount = allReports.length - openCount;

  const selectedId = typeof query.reportId === "string" ? query.reportId : filtered[0]?.id;
  const selected = selectedId ? await getReportDetail(selectedId, server.id) : null;
  const mismatch = !!(selected?.clientVersion && selected.clientVersion !== server.minecraftVersion);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{dict.reports.title}</h1>
          <p className="text-sm text-muted">{dict.reports.subtitle}</p>
        </div>
        <div className="ml-auto flex gap-1 rounded-md border border-border bg-surface-raised p-0.5">
          <Link
            href={`/manage/${server.id}/reports?tab=open`}
            className={`rounded px-3 py-1.5 text-xs ${tab === "open" ? "bg-accent-fill text-accent-foreground" : "text-muted"}`}
          >
            {dict.reports.tabOpen} {openCount}
          </Link>
          <Link
            href={`/manage/${server.id}/reports?tab=resolved`}
            className={`rounded px-3 py-1.5 text-xs ${tab === "resolved" ? "bg-accent-fill text-accent-foreground" : "text-muted"}`}
          >
            {dict.reports.tabResolved} {resolvedCount}
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">{tab === "resolved" ? dict.reports.emptyResolved : dict.reports.empty}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="panel divide-y divide-border">
            {filtered.map((report) => (
              <Link
                key={report.id}
                href={`/manage/${server.id}/reports?tab=${tab}&reportId=${report.id}`}
                className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                  report.id === selectedId ? "bg-surface-raised" : "hover:bg-surface-raised"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{reportsDict[ISSUE_KEYS[report.issue]]}</p>
                  <p className="truncate text-xs text-muted">{report.reporterMinecraftUsername}</p>
                </div>
                <span
                  className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px]"
                  style={
                    report.status === "new"
                      ? { background: "color-mix(in srgb, var(--danger) 16%, transparent)", color: "var(--danger)" }
                      : report.status === "replied"
                        ? { background: "var(--accent-fill)", color: "var(--accent-foreground)" }
                        : { background: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)" }
                  }
                >
                  {reportsDict[STATUS_KEYS[report.status]]}
                </span>
              </Link>
            ))}
          </div>

          <div className="panel flex flex-col gap-4 p-5">
            {!selected ? (
              <p className="text-sm text-muted">{dict.reports.selectPrompt}</p>
            ) : (
              <>
                <h2 className="text-base font-medium text-foreground">{reportsDict[ISSUE_KEYS[selected.issue]]}</h2>

                <div className="flex justify-between text-sm">
                  <span className="text-muted">{dict.reports.playerLabel}</span>
                  <span>{selected.reporterMinecraftUsername}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{dict.reports.sentLabel}</span>
                  <span>
                    {new Date(selected.createdAt).toLocaleString()} · {dict.reports.sentVia}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="field-label">{dict.reports.messageLabel}</span>
                  <p className="rounded-md border border-border bg-background p-3 text-sm leading-relaxed">{selected.message}</p>
                </div>

                {selected.clientVersion || selected.launcherVersion ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="field-label">{dict.reports.diagnosticsLabel}</span>
                    <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted">{dict.reports.diagnosticsListed}</span>
                        <span className={mismatch ? "text-danger" : ""}>{server.minecraftVersion}</span>
                      </div>
                      {selected.clientVersion ? (
                        <div className="flex justify-between">
                          <span className="text-muted">{dict.reports.diagnosticsClient}</span>
                          <span className={mismatch ? "text-danger" : ""}>{selected.clientVersion}</span>
                        </div>
                      ) : null}
                      {selected.launcherVersion ? (
                        <div className="flex justify-between">
                          <span className="text-muted">{dict.reports.diagnosticsLauncher}</span>
                          <span>{selected.launcherVersion}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {mismatch ? (
                  <p
                    className="rounded-md border p-3 text-xs leading-relaxed"
                    style={{
                      borderColor: "color-mix(in srgb, #e0c28a 35%, transparent)",
                      background: "color-mix(in srgb, #e0c28a 7%, transparent)",
                    }}
                  >
                    {dict.reports.versionMismatchHint
                      .replace("{listed}", server.minecraftVersion)
                      .replace("{actual}", selected.clientVersion ?? "")}
                  </p>
                ) : null}

                <ReportReplyForm reportId={selected.id} existingReply={selected.reply} />

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Link href={`/manage/${server.id}/settings`} className="btn-secondary text-sm">
                    {dict.reports.openSettings}
                  </Link>
                  {selected.status !== "resolved" ? (
                    <form action={markReportResolved.bind(null, selected.id)} className="ml-auto">
                      <button type="submit" className="btn-primary text-sm">
                        {dict.reports.markResolved}
                      </button>
                    </form>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
