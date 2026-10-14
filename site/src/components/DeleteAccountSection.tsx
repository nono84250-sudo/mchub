"use client";

import { useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { deleteAccount } from "@/lib/actions/account";

// Zone de danger de la page Compte — confirmation renforcee (retaper "supprimer") plutot
// qu'un simple window.confirm comme pour un serveur (voir ManageActions) : une suppression de
// COMPTE entier (tous ses serveurs, modpacks, abonnement le jour ou il existera) merite un
// geste plus deliberé qu'un clic. Voir lib/actions/account.ts pour ce qui est reellement
// efface.
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText.trim().toLowerCase() === "supprimer";

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const result = await deleteAccount(confirmText);
      if (result && "error" in result && result.error) {
        setError(result.error);
        setPending(false);
        return;
      }
      // deleteAccount() redirige via signOut() (NEXT_REDIRECT) si tout s'est bien passe :
      // rien d'autre a faire ici.
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err && typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      setError("Une erreur est survenue — réessaie dans un instant.");
      setPending(false);
    }
  }

  return (
    <div className="mt-8 rounded-lg p-4" style={{ border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}>
      <p className="text-sm font-medium text-foreground">Supprimer mon compte</p>
      <p className="mt-1 text-xs text-muted">Définitif — ton compte et tout son contenu seront effacés.</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary btn-secondary-danger mt-3 text-sm"
      >
        <Trash className="h-4 w-4" />
        Supprimer mon compte
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Supprimer définitivement le compte"
        >
          <div className="w-full max-w-sm rounded-lg bg-surface p-5" style={{ border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
              Attention : action irréversible
            </p>
            <p className="mt-2 text-sm text-foreground">
              Si vous supprimez votre compte, cela supprimera définitivement tout son contenu : vos serveurs, leurs
              modpacks, etc. Impossible à annuler.
            </p>
            <label className="mt-4 block text-xs text-muted">
              Écrivez <span className="font-semibold text-foreground">supprimer</span> pour valider
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            />
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={pending}
                className="btn-secondary text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm || pending}
                className="btn-secondary btn-secondary-danger text-sm"
              >
                {pending ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
