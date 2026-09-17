"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/lib/actions/auth";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="field-label">
          Nom
        </label>
        <input id="name" name="name" type="text" required autoComplete="name" className="field-input" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field-input" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="field-label">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field-input"
        />
        <p className="text-xs text-muted">8 caractères minimum.</p>
      </div>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Création..." : "Créer mon compte"}
      </button>

      <p className="text-sm text-muted text-center">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
