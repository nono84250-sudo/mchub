"use client";

import { useActionState, useEffect, useState } from "react";
import { GameController, Copy } from "@phosphor-icons/react";
import { startMinecraftLinkAction, unlinkMinecraftAccount } from "@/lib/actions/account";
import { useI18n } from "@/i18n/I18nProvider";

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}

// Carte "Compte Minecraft" de /account : genere un code de liaison ephemere
// a saisir dans le launcher (Reglages > Divers), plutot qu'un flux OAuth
// dans le navigateur — evite d'avoir a enregistrer une nouvelle redirection
// Azure/Entra pour le site en plus de celle du launcher (voir
// launcher/src/msAuth.js, deja approuve par Microsoft).
export function MinecraftLinkCard({
  minecraftUsername,
}: {
  minecraftUsername: string | null;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(startMinecraftLinkAction, undefined);
  const code = state && "code" in state ? state.code : null;
  const expiresAt = state && "expiresAt" in state ? state.expiresAt : null;
  const remaining = useCountdown(expiresAt);
  const expired = expiresAt !== null && remaining <= 0;

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised text-muted">
        <GameController className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{t("account.minecraftTitle")}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap ${
              minecraftUsername ? "bg-success/15 text-success" : "border border-border bg-surface-raised text-muted"
            }`}
          >
            {minecraftUsername ? t("account.minecraftLinked") : t("account.minecraftNotLinked")}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
          {minecraftUsername
            ? t("account.minecraftLinkedAs", { name: minecraftUsername })
            : t("account.minecraftHelp")}
        </p>

        {code && !expired ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-semibold tracking-[0.3em] text-foreground">{code}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(code)}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
                {t("account.minecraftCopyCode")}
              </button>
              <span className="ml-auto font-mono text-xs text-muted2">
                {minutes}:{seconds}
              </span>
            </div>
            <p className="text-[11.5px] text-muted2">{t("account.minecraftCodeInstructions")}</p>
          </div>
        ) : null}
        {expired ? <p className="mt-2 text-xs text-danger">{t("account.minecraftCodeExpired")}</p> : null}
        {state && "error" in state ? <p className="mt-2 text-xs text-danger">{state.error}</p> : null}
      </div>

      {minecraftUsername ? (
        <form action={unlinkMinecraftAccount} className="flex-shrink-0">
          <button type="submit" className="btn-secondary text-xs whitespace-nowrap">
            {t("account.minecraftUnlink")}
          </button>
        </form>
      ) : (
        <form action={formAction} className="flex-shrink-0">
          <button type="submit" disabled={pending} className="btn-secondary text-xs whitespace-nowrap">
            {pending ? t("account.minecraftGenerating") : t("account.minecraftLinkButton")}
          </button>
        </form>
      )}
    </div>
  );
}
