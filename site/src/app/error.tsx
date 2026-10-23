"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowClockwise, House, Warning } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { reportClientError } from "@/lib/sentry";

// Idee 1 du lancement (19/10) : une page entiere n'a pas pu s'afficher (le plus souvent la base
// Cloudflare qui refuse un appel). La barre du haut et le pied de page restent (ils sont dans le
// layout racine, au-dessus de cette page). Meme mise en page que la 404 (not-found.tsx), en
// orange « attention » au lieu du bleu. La reference (digest) sert a retrouver l'erreur dans les
// journaux du serveur, puis dans Sentry (idee 3).
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  // retry() relance la page dans une transition ; on remet le bouton a l'etat normal si
  // l'erreur revient (le composant reste alors affiche).
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(false), 4000);
    return () => clearTimeout(id);
  }, [pending]);

  const ref = (error.digest ?? "").slice(0, 8).toUpperCase();

  return (
    <section className="relative flex flex-col items-center overflow-hidden px-6 pb-28 pt-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(45% 40% at 50% 0%, color-mix(in srgb, var(--warn) 22%, transparent), transparent 70%)",
          opacity: 0.55,
        }}
      />

      <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full border border-border bg-surface shadow-md">
        <span
          className="flex h-[62px] w-[62px] items-center justify-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--warn) 14%, var(--surface))",
            boxShadow: "0 0 22px 2px color-mix(in srgb, var(--warn) 30%, transparent)",
          }}
        >
          <Warning weight="fill" size={30} style={{ color: "var(--warn)" }} />
        </span>
      </div>

      <p className="relative mt-7 font-mono text-[13px] uppercase tracking-[0.1em]" style={{ color: "var(--warn)" }}>
        {t("errorPage.code")}
      </p>

      <h1 className="relative mt-3.5 max-w-[640px] text-[38px] font-medium leading-[1.15] tracking-[-0.015em] text-foreground">
        {t("errorPage.title")}
      </h1>

      <p className="relative mt-[22px] max-w-[470px] text-[14.5px] leading-[1.6] text-muted">{t("errorPage.body")}</p>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="btn-fill px-[22px] py-[11px] text-[14px]"
          disabled={pending}
          onClick={() => {
            setPending(true);
            retry();
          }}
        >
          <ArrowClockwise size={16} className={pending ? "animate-spin" : ""} />
          {pending ? t("errorPage.retrying") : t("errorPage.retry")}
        </button>
        <Link href="/" className="btn-secondary px-[22px] py-[11px] text-[14px] no-underline">
          <House size={16} />
          {t("errorPage.home")}
        </Link>
      </div>

      <p className="relative mt-6 text-[13px] text-muted">
        {t("errorPage.helpBefore")}{" "}
        <Link href="/contact" className="text-accent hover:underline">
          {t("errorPage.helpLink")}
        </Link>
        .
      </p>
      {ref ? <p className="relative mt-1.5 font-mono text-[12px] text-muted">{t("errorPage.ref", { ref })}</p> : null}
    </section>
  );
}
