"use client";

import { useEffect, useState } from "react";

// Memes couleurs que le launcher (voir NOTIF_COLORS dans launcher/src/renderer.js) : une seule
// convention de couleur par type de message diffuse, partagee entre les deux apps.
const COLORS: Record<string, string> = {
  announcement: "#9184d9",
  maintenance: "#e8c547",
  alert: "#e5484d",
  promotion: "#5fd3a0",
};

// Fermeture gardee en local (par navigateur, pas par compte) : pas besoin d'etre connecte pour
// fermer la bannière, et elle ne doit pas reapparaitre au prochain chargement de la meme bannière.
function storageKey(type: string, text: string) {
  return `omniscient:banner-dismissed:${type}:${text.slice(0, 80)}`;
}

export function SiteBannerClient({ type, text }: { type: string; text: string }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey(type, text)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [type, text]);

  if (dismissed) return null;
  const color = COLORS[type] ?? COLORS.announcement;

  return (
    <div style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, borderBottom: `1px solid ${color}` }} className="px-4 py-2.5">
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-sm" style={{ color }}>
        <span className="flex-1">{text}</span>
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => {
            try {
              localStorage.setItem(storageKey(type, text), "1");
            } catch {
              // ignore
            }
            setDismissed(true);
          }}
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
