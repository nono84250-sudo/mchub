"use client";

import { useState, useTransition } from "react";
import { Copy, Check, ArrowsClockwise } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { newFriendCodeAction, setFriendPolicyAction } from "@/lib/actions/friends";

type Policy = "all" | "code" | "none";

// Carte « Qui peut m'ajouter en ami ? » (variante C, 18/10) : la meme sur la page Amis et dans
// Parametres > Confidentialite ; changer l'une change l'autre (meme reglage en base).
export function FriendPrivacyCard({
  initialPolicy,
  initialCode,
  alsoOnFriends = false,
}: {
  initialPolicy: Policy;
  initialCode: string;
  alsoOnFriends?: boolean;
}) {
  const { t } = useI18n();
  const [policy, setPolicy] = useState<Policy>(initialPolicy);
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(false);
  const [pending, start] = useTransition();
  const shown = `${code.slice(0, 3)}-${code.slice(3)}`;

  function saved() {
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }

  function choose(next: Policy) {
    if (next === policy) return;
    const before = policy;
    setPolicy(next);
    start(async () => {
      const res = await setFriendPolicyAction(next);
      if (res?.error) setPolicy(before);
      else saved();
    });
  }

  function regenerate() {
    start(async () => {
      const res = await newFriendCodeAction();
      if (res && "code" in res && res.code) {
        setCode(res.code);
        saved();
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown);
    } catch {
      // le code reste visible a l'ecran
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const options: { id: Policy; label: string; desc: string }[] = [
    { id: "all", label: t("friends.all"), desc: t("friends.allD") },
    { id: "code", label: t("friends.code"), desc: t("friends.codeD") },
    { id: "none", label: t("friends.none"), desc: t("friends.noneD") },
  ];

  return (
    <div className="relative flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2" disabled={pending}>
        <legend className="mb-1 text-[15px] font-semibold text-foreground">{t("friends.q")}</legend>
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${policy === o.id ? "border-accent" : "border-border"}`}
          >
            <input type="radio" name="friendPolicy" checked={policy === o.id} onChange={() => choose(o.id)} className="mt-1 accent-[var(--accent)]" />
            <span className="min-w-0">
              <span className="text-sm font-medium text-foreground">
                {o.label}
                {o.id === "code" ? (
                  <span className="ml-2 rounded-full border border-accent px-1.5 text-[10.5px] font-semibold text-accent">{t("friends.recommended")}</span>
                ) : null}
              </span>
              <span className="block text-[13px] text-muted">{o.desc}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {policy === "code" ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5">
          <span className="text-xs text-muted">{t("friends.myCode")}</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-lg font-semibold tracking-[0.12em] text-foreground">{shown}</code>
            <button type="button" onClick={copy} className="btn-secondary px-2.5 py-1 text-xs">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t("friends.copied") : t("friends.copy")}
            </button>
            <button type="button" onClick={regenerate} disabled={pending} className="btn-secondary px-2.5 py-1 text-xs">
              <ArrowsClockwise className="h-3.5 w-3.5" />
              {t("friends.newCode")}
            </button>
          </div>
          <span className="text-[11.5px] text-muted">{t("friends.newCodeD")}</span>
        </div>
      ) : null}

      {alsoOnFriends ? <p className="text-xs text-muted">{t("friends.alsoOnFriends")}</p> : null}

      {toast ? (
        <div role="status" className="fixed bottom-5 right-5 z-50 rounded-[10px] border px-3.5 py-2.5 text-[13.5px] text-foreground shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]" style={{ background: "color-mix(in srgb, var(--success) 14%, var(--surface))", borderColor: "color-mix(in srgb, var(--success) 45%, transparent)" }}>
          ✓ {t("friends.saved")}
        </div>
      ) : null}
    </div>
  );
}
