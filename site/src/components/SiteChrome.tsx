"use client";

import { usePathname } from "next/navigation";

// La console de gestion d'un serveur (/manage/[id]/...) prend toute la
// page, comme un back-office separe du site public — pas de nav/footer du
// site autour, elle a sa propre barre laterale et son propre menu (voir
// ManageSidebar/ManageAvatarMenu). Meme chose pour l'assistant de creation
// de serveur (/dashboard/servers/new), qui a sa propre barre du haut avec
// l'etape en cours (voir NewServerWizard, maquette "02 · Onboarding"). Nav et
// Footer restent des composants serveur classiques ; ce wrapper ne fait que
// decider s'il faut les monter, a partir du chemin courant.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/manage/") || pathname === "/dashboard/servers/new") return null;
  return <>{children}</>;
}
