import { getSiteBanner } from "@/lib/platformSettings";

// Repris sur les memes roles que le launcher (voir NOTIF_COLORS dans
// launcher/src/renderer.js), mais via les tokens de theme (var(--accent) etc.)
// plutot qu'en hex fige : les couleurs ne basculaient jamais en theme clair.
const COLORS: Record<string, string> = {
  announcement: "var(--accent)",
  maintenance: "var(--warn)",
  alert: "var(--danger)",
  promotion: "var(--success)",
};

// Bannière du site, posée par un admin depuis /admin/notifications (voir platformSettings.ts).
// Pas de croix pour la fermer : elle doit rester visible tant qu'un admin ne la retire pas
// lui-même (voir le bouton "Retirer" sur cette page). En cache, vidé dès qu'un admin la change (voir getSiteBanner).
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
