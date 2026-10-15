"use client";

import type { CSSProperties, ReactNode } from "react";

// Bouton d'envoi de formulaire avec confirmation (la page /admin/contact est un composant
// serveur : pas d'onsubmit possible sans ce petit composant client).
export function ConfirmSubmitButton({ confirmText, style, children }: { confirmText: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <button
      type="submit"
      style={style}
      onClick={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
