"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
          autoComplete="current-password"
          className="field-input"
        />
      </div>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Connexion..." : "Se connecter"}
      </button>

      <p className="text-sm text-muted text-center">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
