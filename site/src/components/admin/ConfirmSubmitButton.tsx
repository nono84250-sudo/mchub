"use client";

import type { CSSProperties, ReactNode } from "react";
import { useConfirm, type ConfirmTone } from "@/components/ConfirmDialog";

// Bouton d'envoi de formulaire avec confirmation (la page /admin/contact est un composant
// serveur : pas d'onsubmit possible sans ce petit composant client). Lot 4 (18/10) : la meme
// fenetre de confirmation que le reste du site, plus le confirm() gris du navigateur.
export function ConfirmSubmitButton({
  confirmText,
  confirmBody = "",
  confirmLabel = "Supprimer",
  tone = "danger",
  style,
  children,
}: {
  confirmText: string;
  confirmBody?: string;
  confirmLabel?: string;
  tone?: ConfirmTone;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { confirm, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <button
        type="submit"
        style={style}
        onClick={async (event) => {
          event.preventDefault();
          const form = event.currentTarget.form;
          const ok = await confirm({ title: confirmText, body: confirmBody, confirmLabel, tone });
          if (!ok || !form) return;
          form.requestSubmit(event.currentTarget);
        }}
      >
        {children}
      </button>
    </>
  );
}
