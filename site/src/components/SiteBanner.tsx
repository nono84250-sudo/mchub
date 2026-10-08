import { getSiteBanner } from "@/lib/platformSettings";
import { SiteBannerClient } from "@/components/SiteBannerClient";

// Bannière du site, posée par un admin depuis /admin/notifications (voir platformSettings.ts).
// Lue à chaque rendu : pas de cache, un retrait doit disparaître tout de suite.
export async function SiteBanner() {
  const banner = await getSiteBanner();
  if (!banner) return null;
  return <SiteBannerClient type={banner.type} text={banner.text} />;
}
