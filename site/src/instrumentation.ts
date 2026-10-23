import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, SENTRY_OPTIONS } from "@/lib/sentry";

// Idee 3 du lancement (19/10) : erreurs du serveur (pages, routes, actions) envoyees a Sentry.
// Inactif tant que NEXT_PUBLIC_SENTRY_DSN est vide (voir lib/sentry.ts).
export function register() {
  if (!SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(SENTRY_OPTIONS);
  }
}

export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  if (SENTRY_DSN) Sentry.captureRequestError(...args);
};
