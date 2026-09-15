"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Modèle "polling" retenu pour le MVP (cahier des charges, section 3) : pas
// de WebSocket, juste un rafraîchissement régulier de la page pendant
// qu'elle reste ouverte, pour voir apparaître les nouveaux serveurs / le
// statut de ping mis à jour sans recharger à la main.
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
