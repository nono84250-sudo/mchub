"use client";

import { useActionState } from "react";
import { User, Mail, Lock } from "lucide-react";
import { updateProfile } from "@/lib/actions/account";

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="field-label">
          Nom
        </label>
        <div className="field-with-icon">
          <User className="h-4 w-4" />
          <input id="name" name="name" type="text" required defaultValue={name} className="field-input w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <div className="field-with-icon">
          <Mail className="h-4 w-4" />
          <input id="email" name="email" type="email" required defaultValue={email} className="field-input w-full" />
        </div>
      </div>

      <div className="divider-fade" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className="field-label">
          Nouveau mot de passe
        </label>
        <div className="field-with-icon">
          <Lock className="h-4 w-4" />
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Laisser vide pour ne pas changer"
            className="field-input w-full"
          />
        </div>
      </div>

      {state && "error" in state ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state && "success" in state ? <p className="text-sm text-success">Modifications enregistrées.</p> : null}

      <div className="flex items-center justify-between">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
