"use client";

import { useActionState } from "react";
import { markReportResolved } from "@/lib/actions/reports";

// 2026-10-10 : markReportResolved renvoie maintenant {error} (serveur gele exclu ici, mais
// session absente / signalement pas possede) au lieu de reussir silencieusement sans rien
// faire — passe desormais par useActionState (meme pattern que ReportReplyForm) pour que
// cette erreur soit reellement affichee, plutot qu'un simple <form> qui ignorerait tout
// retour.
export function MarkReportResolvedButton({ reportId, label }: { reportId: string; label: string }) {
  const [state, formAction, pending] = useActionState(markReportResolved.bind(null, reportId), undefined);

  return (
    <form action={formAction} className="ml-auto flex flex-col items-end gap-1.5">
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary text-sm">
        {label}
      </button>
    </form>
  );
}
