"use client";

import { useEffect, useRef } from "react";

// Incremente le compteur de vues cote client, une fois par ouverture de
// page — pas pendant le rendu serveur (voir recordServerView : la page est
// revalidee au plus toutes les 60s via ISR, un increment pendant le rendu
// sous-compterait massivement les vues reelles).
export function ViewTracker({ slug }: { slug: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch(`/api/public/servers/${encodeURIComponent(slug)}/view`, { method: "POST" }).catch(() => {});
  }, [slug]);

  return null;
}
