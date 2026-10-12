"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Téléporte ses enfants React dans un élément du HTML statique (voir AdminChrome.tsx) une
// fois que ce HTML est bien monté dans le DOM — ne peut se faire qu'après coup côté client,
// d'où le useEffect : au premier rendu serveur, l'élément cible n'existe pas encore pour React.
export function SlotPortal({ slotId, children }: { slotId: string; children: React.ReactNode }) {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    setTarget(document.getElementById(slotId));
  }, [slotId]);

  if (!target) return null;
  return createPortal(children, target);
}
