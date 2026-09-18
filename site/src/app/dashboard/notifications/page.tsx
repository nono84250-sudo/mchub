export const metadata = { title: "Notifications — Omniscient" };

// Emplacement reserve pour un futur systeme de notifications (annonces du
// site, alertes sur ses propres serveurs, compte...) — pour l'instant juste
// des categories vides, pensees pour en ajouter d'autres au fur et a mesure
// sans reprendre la mise en page.
const NOTIFICATION_CATEGORIES = [
  { id: "announcements", label: "Annonces" },
  { id: "servers", label: "Serveurs" },
  { id: "account", label: "Compte" },
];

export default function NotificationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>

      <div className="panel mt-8 p-6">
        <div className="flex flex-col gap-5">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <div key={category.id}>
              <p className="text-sm font-medium text-foreground">{category.label}</p>
              <p className="mt-1 text-sm text-muted">Aucune notification pour le moment.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
