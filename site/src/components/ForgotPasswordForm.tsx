"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { EnvelopeSimple, Lock } from "@phosphor-icons/react";
import { requestPasswordResetCode, submitPasswordResetCode } from "@/lib/actions/passwordReset";
import { useI18n } from "@/i18n/I18nProvider";

function ResetCodeStep({ email }: { email: string }) {
  const { t } = useI18n();
  const boundSubmit = submitPasswordResetCode.bind(null, email);
  const [state, formAction, pending] = useActionState(boundSubmit, undefined);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("auth.verifyCodeSent", { email })}</p>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="field-label">
            {t("auth.verifyCodeLabel")}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            maxLength={6}
            autoComplete="one-time-code"
            className="field-input w-full text-center font-mono text-lg tracking-[0.3em] uppercase"
          />
        </div>

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
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetCode, undefined);
  const { t } = useI18n();
  const [email, setEmail] = useState("");

  if (state?.sent) {
    return <ResetCodeStep email={email} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("auth.forgotPasswordHelp")}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="field-label">
          {t("auth.email")}
        </label>
        <div className="field-with-icon">
          <EnvelopeSimple className="h-4 w-4" />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input w-full"
          />
        </div>
      </div>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("auth.sendCodePending") : t("auth.sendCodeSubmit")}
      </button>
      <Link href="/login" className="text-xs text-muted hover:text-foreground self-center">
        {t("auth.backToLogin")}
      </Link>
    </form>
  );
}
