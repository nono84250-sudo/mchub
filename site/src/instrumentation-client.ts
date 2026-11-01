import { SENTRY_DSN, SENTRY_OPTIONS } from "@/lib/sentry";

// Idee 3 du lancement (19/10) : erreurs du navigateur envoyees a Sentry. Le module Sentry n'est
// telecharge que s'il est configure : sans NEXT_PUBLIC_SENTRY_DSN, la page ne charge rien de plus.
if (SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) => Sentry.init(SENTRY_OPTIONS)).catch(() => {});
}
