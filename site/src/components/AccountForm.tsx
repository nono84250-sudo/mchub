"use client";

import { useActionState, useState } from "react";
import { User, EnvelopeSimple, Lock } from "@phosphor-icons/react";
import { updateProfile } from "@/lib/actions/account";
import { requestPasswordResetLink } from "@/lib/actions/passwordReset";
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

      {state && "error" in state ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state && "success" in state ? <p className="text-sm text-success">{t("account.saved")}</p> : null}

      <div className="flex items-center justify-between">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t("account.saving") : t("account.save")}
        </button>
      </div>

      <div className="divider-fade" />

      <PasswordResetButton />
    </form>
  );
}

function PasswordResetButton() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleClick() {
    if (!window.confirm(t("account.resetPasswordConfirm"))) return;
    setStatus("sending");
    const result = await requestPasswordResetLink();
    setStatus("sent" in result ? "sent" : "error");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={handleClick} disabled={status === "sending"} className="btn-secondary self-start">
        <Lock className="h-4 w-4" />
        {status === "sending" ? t("account.resetPasswordSending") : t("account.resetPasswordButton")}
      </button>
      {status === "sent" ? <p className="text-sm text-success">{t("account.resetPasswordSent")}</p> : null}
      {status === "error" ? <p className="text-sm text-danger">{t("account.resetPasswordError")}</p> : null}
    </div>
  );
}
