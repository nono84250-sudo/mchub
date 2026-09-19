"use client";

import { usePathname } from "next/navigation";

// La console de gestion d'un serveur (/manage/[id]/...) prend toute la
// page, comme un back-office separe du site public — pas de nav/footer du
// site autour, elle a sa propre barre laterale et son propre menu (voir
// ManageSidebar/ManageAvatarMenu). Nav et Footer restent des composants
// serveur classiques ; ce wrapper ne fait que decider s'il faut les monter,
// a partir du chemin courant.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/manage/")) return null;
  return <>{children}</>;
}
