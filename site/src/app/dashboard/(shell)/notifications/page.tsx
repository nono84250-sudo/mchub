import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getT, type Dictionary } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import { listNotificationsForRecipient, type NotificationSummary, type NotificationType } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications — Omniscient" };

// 2026-10-10 : page branchee sur les vraies notifications (table "notification", voir
// lib/notifications.ts) — meme regroupement par categorie que la maquette d'origine, et
// mêmes libelles que notifItemHtml côté launcher (launcher/src/renderer.js), traduits ici
// via le dictionnaire du site plutôt que celui du launcher.
function categoryFor(type: NotificationType): "announcements" | "servers" | "account" {
  if (type.startsWith("broadcast_")) return "announcements";
  if (type.startsWith("admin_")) return "account";
  return "servers"; // report_replied / report_resolved / server_frozen / verification_*
}

function titleFor(dict: Dictionary, n: NotificationSummary): string {
  switch (n.type) {
    case "server_frozen":
      return t(dict, "dashboard.notifServerFrozenTitle", { server: n.serverName });
    case "verification_approved":
      return t(dict, "dashboard.notifVerificationApprovedTitle", { server: n.serverName });
    case "verification_rejected":
      return t(dict, "dashboard.notifVerificationRejectedTitle", { server: n.serverName });
    case "broadcast_announcement":
      return dict.dashboard.notifBroadcastAnnouncementTitle;
    case "broadcast_maintenance":
      return dict.dashboard.notifBroadcastMaintenanceTitle;
    case "broadcast_alert":
      return dict.dashboard.notifBroadcastAlertTitle;
    case "broadcast_promotion":
      return dict.dashboard.notifBroadcastPromotionTitle;
    case "admin_info":
    case "admin_warning":
    case "admin_error":
      return t(dict, "dashboard.notifAdminMessageTitle", { server: n.serverName });
    case "report_resolved":
      return t(dict, "dashboard.notifReportResolvedTitle", { server: n.serverName });
    case "report_replied":
    default:
      return t(dict, "dashboard.notifReportRepliedTitle", { server: n.serverName });
  }
}

export default async function NotificationsPage() {
  const { dict, locale } = await getT();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.orm.public.User.where({ id: session.user.id }).first();
  const notifications = user?.minecraftUuid ? await listNotificationsForRecipient(user.minecraftUuid) : [];

  const NOTIFICATION_CATEGORIES = [
    { id: "announcements" as const, label: dict.dashboard.categoryAnnouncements },
    { id: "servers" as const, label: dict.dashboard.categoryServers },
    { id: "account" as const, label: dict.dashboard.categoryAccount },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.dashboard.notificationsTitle}</h1>

      <div className="panel mt-8 p-6">
        <div className="flex flex-col gap-5">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const items = notifications.filter((n) => categoryFor(n.type) === category.id);
            return (
              <div key={category.id}>
                <p className="text-sm font-medium text-foreground">{category.label}</p>
                {items.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">{dict.dashboard.notificationsEmpty}</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {items.map((n) => (
                      <li
                        key={n.id}
                        className={n.read ? "rounded-md border border-border px-3 py-2" : "rounded-md border border-accent bg-surface px-3 py-2"}
                      >
                        <p className="text-sm font-medium text-foreground">{titleFor(dict, n)}</p>
                        {n.message ? <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{n.message}</p> : null}
                        <p className="mt-1 text-xs text-muted2">
                          {new Date(n.createdAt).toLocaleString(locale, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
