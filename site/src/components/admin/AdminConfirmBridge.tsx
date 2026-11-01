"use client";

import { useEffect } from "react";
import { useConfirm, type ConfirmTone } from "@/components/ConfirmDialog";

// Panel admin (lot 4, 18/10) : les ecrans de la maquette sont du HTML injecte (bind.ts), sans
// React. Un formulaire qui porte data-confirm-title passe ici par la meme fenetre de
// confirmation que le reste du site, au lieu du confirm() gris du navigateur.
export function AdminConfirmBridge() {
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    const onSubmit = async (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form?.dataset.confirmTitle || form.dataset.confirmed === "1") return;
      e.preventDefault();
      const ok = await confirm({
        title: form.dataset.confirmTitle,
        body: form.dataset.confirmBody ?? "",
        confirmLabel: form.dataset.confirmBtn ?? "Confirmer",
        tone: (form.dataset.confirmTone as ConfirmTone | undefined) ?? "danger",
      });
      if (!ok) return;
      form.dataset.confirmed = "1";
      form.requestSubmit();
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [confirm]);

  return <>{dialog}</>;
}
