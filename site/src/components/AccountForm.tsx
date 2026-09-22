"use client";

import { useActionState } from "react";
import { User, EnvelopeSimple, Lock } from "@phosphor-icons/react";
import { updateProfile } from "@/lib/actions/account";
import { useI18n } from "@/i18n/I18nProvider";

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);
  const { t } = useI18n();

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="field-label">
          {t("account.name")}
        </label>
        <div className="field-with-icon">
          <User className="h-4 w-4" />
          <input id="name" name="name" type="text" required defaultValue={name} className="field-input w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="field-label">
          {t("account.email")}
        </label>
        <div className="field-with-icon">
          <EnvelopeSimple className="h-4 w-4" />
          <input id="email" name="email" type="email" required defaultValue={email} className="field-input w-full" />
        </div>
      </div>

      <div className="divider-fade" />

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
            minLength={8}
            autoComplete="new-password"
            placeholder={t("account.newPasswordPlaceholder")}
            className="field-input w-full"
          />
        </div>
      </div>

      {state && "error" in state ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state && "success" in state ? <p className="text-sm text-success">{t("account.saved")}</p> : null}

      <div className="flex items-center justify-between">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t("account.saving") : t("account.save")}
        </button>
      </div>
    </form>
  );
}
