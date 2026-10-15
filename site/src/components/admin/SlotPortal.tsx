"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Téléporte ses enfants React dans un élément du HTML statique (voir AdminChrome.tsx) une
// fois que ce HTML est bien monté dans le DOM — ne peut se faire qu'après coup côté client,
// d'où le useEffect : au premier rendu serveur, l'élément cible n'existe pas encore pour React.
export function SlotPortal({ slotId, children }: { slotId: string; children: React.ReactNode }) {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    const find = () => setTarget((current) => {
      const found = document.getElementById(slotId);
      return found === current ? current : found;
    });
    find();
    // router.refresh() réinjecte le HTML statique quand il a changé (dangerouslySetInnerHTML) :
    // l'élément cible est alors remplacé par un nouveau, et le portail doit le suivre, sinon son
    // contenu disparaît (bug du bouton d'export de la fiche joueur, 2026-10-14).
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [slotId]);

  if (!target) return null;
  return createPortal(children, target);
}
