"use client";

import { useActionState } from "react";
import { User, Mail, Lock } from "lucide-react";
import { signup } from "@/lib/actions/auth";
import { useI18n } from "@/i18n/I18nProvider";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const { t } = useI18n();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="field-label">
          {t("auth.name")}
        </label>
        <div className="field-with-icon">
          <User className="h-4 w-4" />
          <input id="name" name="name" type="text" required autoComplete="name" className="field-input w-full" />
        </div>
      </div>

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
            minLength={8}
            autoComplete="new-password"
            className="field-input w-full"
          />
        </div>
        <p className="text-xs text-muted">{t("auth.passwordMin")}</p>
      </div>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("auth.signupPending") : t("auth.signupSubmit")}
      </button>
    </form>
  );
}
