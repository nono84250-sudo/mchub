import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Notifications — Omniscient" };

export default async function NotificationsPage() {
  const { dict } = await getT();

  // Emplacement reserve pour un futur systeme de notifications (annonces du
  // site, alertes sur ses propres serveurs, compte...) — pour l'instant juste
  // des categories vides, pensees pour en ajouter d'autres au fur et a mesure
  // sans reprendre la mise en page.
  const NOTIFICATION_CATEGORIES = [
    { id: "announcements", label: dict.dashboard.categoryAnnouncements },
    { id: "servers", label: dict.dashboard.categoryServers },
    { id: "account", label: dict.dashboard.categoryAccount },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.dashboard.notificationsTitle}</h1>

      <div className="panel mt-8 p-6">
        <div className="flex flex-col gap-5">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <div key={category.id}>
              <p className="text-sm font-medium text-foreground">{category.label}</p>
              <p className="mt-1 text-sm text-muted">{dict.dashboard.notificationsEmpty}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
