"use client";

import { useActionState } from "react";
import { Mail, Lock } from "lucide-react";
import { login } from "@/lib/actions/auth";
import { useI18n } from "@/i18n/I18nProvider";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const { t } = useI18n();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="field-label">
          {t("auth.email")}
        </label>
        <div className="field-with-icon">
          <Mail className="h-4 w-4" />
          <input id="email" name="email" type="email" required autoComplete="email" className="field-input w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="field-label">
          {t("auth.password")}
        </label>
        <div className="field-with-icon">
          <Lock className="h-4 w-4" />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="field-input w-full"
          />
        </div>
      </div>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("auth.loginPending") : t("auth.loginSubmit")}
      </button>
    </form>
  );
}
