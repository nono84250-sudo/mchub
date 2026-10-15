"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Bouton "Demander un second avis" (manage/[id]/page.tsx, serveur gelé sans recours en cours) —
// même convention que ManageActions.tsx : confirmation avant l'action, erreur affichée inline,
// router.refresh() pour que le reste de la page (hint, historique) reflète tout de suite le
// nouvel état sans recharger.
export function AppealRequestButton({
  onRequest,
  label,
  confirmText,
}: {
  onRequest: () => Promise<{ error: string } | undefined>;
  label: string;
  confirmText: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!window.confirm(confirmText)) return;
    setPending(true);
    setError(null);
    try {
      const result = await onRequest();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <button type="button" disabled={pending} onClick={run} className="btn-secondary text-sm self-start">
        {pending ? "..." : label}
      </button>
    </div>
  );
}
