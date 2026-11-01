"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

// Idee 1 du lancement (19/10) : un seul bloc de la page n'a pas pu lire la base (Cloudflare
// occupe ou en panne). Le reste de la page reste affiche ; « Reessayer » recharge seulement les
// donnees de la page (router.refresh), sans recharger tout le site.
export function ErrorBlock({ title, body }: { title: string; body: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="alert"
      className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center"
      style={{
        borderColor: "color-mix(in srgb, var(--warn) 60%, var(--border))",
        background: "color-mix(in srgb, var(--warn) 7%, var(--surface))",
      }}
    >
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-[440px] text-muted">{body}</p>
      <button type="button" className="btn-fill" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        <ArrowClockwise className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? t("errorPage.retrying") : t("errorPage.retry")}
      </button>
    </div>
  );
}
