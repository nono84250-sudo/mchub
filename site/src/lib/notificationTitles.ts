import type { Dictionary } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import type { NotificationSummary } from "@/lib/notifications";

// Titre d'une notification, partage par la page Notifications et la bande « Pour toi » du
// tableau de bord (memes libelles que notifItemHtml cote launcher).
export function notificationTitle(dict: Dictionary, n: NotificationSummary): string {
  // 25/10 : message d'article (serverName « news:<id> », voir lib/newsNotify.ts).
  if (isNewsNotification(n)) return dict.dashboard.notifNewsTitle;
  switch (n.type) {
    case "server_frozen":
      return t(dict, "dashboard.notifServerFrozenTitle", { server: n.serverName });
    case "verification_approved":
      return t(dict, "dashboard.notifVerificationApprovedTitle", { server: n.serverName });
    case "verification_rejected":
      return t(dict, "dashboard.notifVerificationRejectedTitle", { server: n.serverName });
    case "instance_back_online":
      return t(dict, "dashboard.notifInstanceBackOnlineTitle", { server: n.serverName });
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

export function isNewsNotification(n: NotificationSummary): boolean {
  return n.serverName.startsWith("news:");
}

// « Nouvel article : Titre (à lire dans Actualités sur le site) » -> « Titre ».
export function newsTitleFromMessage(message: string | null): string {
  return String(message ?? "").replace(/^Nouvel article : /, "").replace(/ \(à lire dans Actualités sur le site\)$/, "");
}
