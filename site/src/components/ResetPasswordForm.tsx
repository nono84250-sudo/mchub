"use client";

import { useActionState } from "react";
import { Lock } from "@phosphor-icons/react";
import { resetPasswordWithToken } from "@/lib/actions/passwordReset";
import { useI18n } from "@/i18n/I18nProvider";

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useI18n();
  const boundAction = resetPasswordWithToken.bind(null, token);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className="field-label">
          {t("account.newPassword")}
        </label>
        <div className="field-with-icon">
          <Lock className="h-4 w-4" />
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="field-input w-full"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="field-label">
          {t("auth.confirmPassword")}
        </label>
        <div className="field-with-icon">
          <Lock className="h-4 w-4" />
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="field-input w-full"
          />
        </div>
      </div>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("auth.resetPasswordPending") : t("auth.resetPasswordSubmit")}
      </button>
    </form>
  );
}
