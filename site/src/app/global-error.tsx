"use client";

import { useEffect, useSyncExternalStore } from "react";
import "./globals.css";
import { reportClientError } from "@/lib/sentry";

// Idee 1 du lancement (19/10) : dernier filet, quand meme le layout racine (barre du haut, pied
// de page, dictionnaires) n'a pas pu s'afficher. Cette page remplace tout le document : pas de
// I18nProvider ni de cookie lu cote serveur ici, donc les textes FR/EN sont ecrits ci-dessous
// (copie de errorPage dans les dictionnaires) et la langue/le theme sont relus dans le
// navigateur, comme le fait le script du layout. Aucun appel a la base. Les liens gardes sont
// ceux qui ne dependent pas de la base (telecharger, pages legales).
const TEXT = {
  fr: {
    code: "Petit souci de notre côté",
    title: "Omniscient est en panne pour quelques instants",
    body: "Le site ne répond plus du tout. Réessaie dans une minute. Le launcher déjà installé continue de lancer tes serveurs.",
    retry: "Réessayer",
    links: [
      ["/download", "Télécharger le launcher"],
      ["/cgu", "Conditions d'utilisation"],
      ["/confidentialite", "Confidentialité"],
    ],
    ref: "Réf. de l'erreur : ",
  },
  en: {
    code: "Small problem on our side",
    title: "Omniscient is down for a moment",
    body: "The site isn't responding at all. Try again in a minute. The launcher you already installed still launches your servers.",
    retry: "Try again",
    links: [
      ["/download", "Download the launcher"],
      ["/cgu", "Terms of use"],
      ["/confidentialite", "Privacy"],
    ],
    ref: "Error ref: ",
  },
} as const;

const noSubscribe = () => () => {};
const readLocale = (): "fr" | "en" => (/(?:^|;\s*)NEXT_LOCALE=en(?:;|$)/.test(document.cookie) ? "en" : "fr");

export default function GlobalError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useSyncExternalStore(noSubscribe, readLocale, () => "fr" as const);

  useEffect(() => {
    console.error(error);
    reportClientError(error);
    try {
      const p = localStorage.getItem("theme") || "system";
      document.documentElement.dataset.theme =
        p === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : p;
    } catch {}
  }, [error]);

  const t = TEXT[locale];
  const ref = (error.digest ?? "").slice(0, 8).toUpperCase();

  return (
    <html lang={locale} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <title>Omniscient</title>
        {/* eslint-disable-next-line @next/next/no-css-tags -- meme feuille statique que le layout racine */}
        <link rel="stylesheet" href="/fonts/inter/inter.css" />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-2.5 font-semibold text-lg text-foreground">
          <span
            aria-hidden="true"
            className="h-4 w-4"
            style={{ border: "1.5px solid var(--accent)", transform: "rotate(45deg)", display: "inline-block" }}
          />
          Omniscient
        </div>
        <main className="flex flex-1 flex-col items-center px-6 pb-24 pt-20 text-center">
          <p className="font-mono text-[13px] uppercase tracking-[0.1em]" style={{ color: "var(--warn)" }}>
            {t.code}
          </p>
          <h1 className="mt-3.5 max-w-[640px] text-[34px] font-medium leading-[1.15] tracking-[-0.015em] text-foreground">{t.title}</h1>
          <p className="mt-[22px] max-w-[470px] text-[14.5px] leading-[1.6] text-muted">{t.body}</p>
          {/* Rechargement complet plutot que retry() : ici c'est le layout racine qui a echoue. */}
          <button type="button" className="btn-fill mt-8 px-[22px] py-[11px] text-[14px]" onClick={() => window.location.reload()}>
            {t.retry}
          </button>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {t.links.map(([href, label]) => (
              // Liens <a> simples (pas next/link) : on veut un vrai chargement de page, le routeur
              // de l'application n'est plus fiable a ce stade.
              <a key={href} href={href} className="rounded-full border border-dashed border-border px-3 py-1 text-[13px] text-muted no-underline">
                {label}
              </a>
            ))}
          </div>
          {ref ? (
            <p className="mt-5 font-mono text-[12px] text-muted">
              {t.ref}
              {ref}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
