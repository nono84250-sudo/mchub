import { getSiteBanner } from "@/lib/platformSettings";

// Memes couleurs que le launcher (voir NOTIF_COLORS dans launcher/src/renderer.js) : une seule
// convention de couleur par type de message diffuse, partagee entre les deux apps.
const COLORS: Record<string, string> = {
  announcement: "#9184d9",
  maintenance: "#e8c547",
  alert: "#e5484d",
  promotion: "#5fd3a0",
};

// Bannière du site, posée par un admin depuis /admin/notifications (voir platformSettings.ts).
// Pas de croix pour la fermer : elle doit rester visible tant qu'un admin ne la retire pas
// lui-même (voir le bouton "Retirer" sur cette page). Lue à chaque rendu, sans cache.
export async function SiteBanner() {
  const banner = await getSiteBanner();
  if (!banner) return null;
  const color = COLORS[banner.type] ?? COLORS.announcement;
  return (
    <div style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, borderBottom: `1px solid ${color}` }} className="px-4 py-2.5">
      <div className="mx-auto max-w-5xl text-center text-sm" style={{ color }}>
        {banner.text}
      </div>
    </div>
  );
}
