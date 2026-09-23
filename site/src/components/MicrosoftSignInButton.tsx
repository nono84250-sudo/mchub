"use client";

import { signInWithMicrosoft } from "@/lib/actions/auth";
import { useI18n } from "@/i18n/I18nProvider";

export function MicrosoftSignInButton() {
  const { t } = useI18n();

  return (
    <form action={signInWithMicrosoft}>
      <button type="submit" className="btn-primary w-full justify-center gap-2.5">
        <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden="true">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        {t("auth.signInWithMicrosoft")}
      </button>
    </form>
  );
}
