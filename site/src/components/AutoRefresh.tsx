"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Modèle "polling" retenu pour le MVP (cahier des charges, section 3) : pas
// de WebSocket, juste un rafraîchissement régulier de la page pendant
// qu'elle reste ouverte, pour voir apparaître les nouveaux serveurs / le
// statut de ping mis à jour sans recharger à la main.
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  // Onglet en arrière-plan (20/10, /servers/hypixel redemandé en boucle dans les logs alors que
  // personne ne regardait la page) : aucun rafraîchissement tant que l'onglet est caché, et un seul
  // en revenant s'il date de plus de intervalMs. Chaque rafraîchissement relit la base.
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      last = Date.now();
      router.refresh();
    };
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= intervalMs) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
