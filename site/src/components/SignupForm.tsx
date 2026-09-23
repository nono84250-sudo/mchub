"use client";

import { useActionState, useState } from "react";
import { User, EnvelopeSimple, Lock } from "@phosphor-icons/react";
import { signup, verifySignupCode, resendSignupCode } from "@/lib/actions/auth";
import { useI18n } from "@/i18n/I18nProvider";

// Etape 2 : le code recu par email. email/password restent en memoire
// client (jamais dans un champ cache visible) — voir verifySignupCode(),
// qui en a besoin pour ouvrir la session juste apres validation du code.
function VerifyCodeStep({ email, password }: { email: string; password: string }) {
  const { t } = useI18n();
  const boundVerify = verifySignupCode.bind(null, email, password);
  const [state, formAction, pending] = useActionState(boundVerify, undefined);
  const [resent, setResent] = useState(false);

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

        {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t("auth.verifyCodePending") : t("auth.verifyCodeSubmit")}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          resendSignupCode(email);
          setResent(true);
        }}
        className="text-xs text-muted hover:text-foreground self-center"
      >
        {resent ? t("auth.verifyCodeResent") : t("auth.verifyCodeResend")}
      </button>
    </div>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const { t } = useI18n();
  const [password, setPassword] = useState("");

  if (state && "verifyEmail" in state) {
    return <VerifyCodeStep email={state.verifyEmail} password={password} />;
  }

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
          <EnvelopeSimple className="h-4 w-4" />
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input w-full"
          />
        </div>
        <p className="text-xs text-muted">{t("auth.passwordMin")}</p>
      </div>

      {state && "error" in state ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("auth.signupPending") : t("auth.signupSubmit")}
      </button>
    </form>
  );
}
