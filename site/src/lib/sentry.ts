import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

// Idee 3 du lancement (19/10) : alertes d'erreurs avec Sentry (region UE). Une seule variable,
// NEXT_PUBLIC_SENTRY_DSN, que Rushi met lui-meme dans site/.env.local (et plus tard dans Vercel).
// Sans elle, rien n'est charge ni envoye. Le DSN n'est pas un secret (il finit dans le
// navigateur), mais il ne va jamais dans le code versionne.
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

export const SENTRY_OPTIONS = {
  dsn: SENTRY_DSN,
  // Pas d'adresse IP, de cookies, d'en-tetes ni d'utilisateur (voir la page Confidentialite).
  sendDefaultPii: false,
  // Erreurs seulement : pas de suivi des performances (quota gratuit garde pour les erreurs).
  tracesSampleRate: 0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || "development",
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};

// Les adresses peuvent porter un identifiant Minecraft (?minecraftUuid=...) ou un code
// d'invitation : on garde le chemin, jamais la partie apres « ? ».
function stripQuery(url: unknown): unknown {
  return typeof url === "string" ? url.split("?")[0] : url;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.server_name;
  if (event.request) {
    event.request.url = stripQuery(event.request.url) as string | undefined;
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Les messages de la console peuvent contenir un pseudo ou une adresse e-mail.
  if (breadcrumb.category === "console") return null;
  if (breadcrumb.data) {
    breadcrumb.data.url = stripQuery(breadcrumb.data.url);
    breadcrumb.data.from = stripQuery(breadcrumb.data.from);
    breadcrumb.data.to = stripQuery(breadcrumb.data.to);
  }
  return breadcrumb;
}

// Pour les pages d'erreur (cote navigateur) : charge Sentry seulement s'il est configure, et
// seulement pour les erreurs nees dans le navigateur. Celles du serveur (avec un digest) sont
// deja envoyees par onRequestError (instrumentation.ts), sans doublon.
export function reportClientError(error: Error & { digest?: string }) {
  if (!SENTRY_DSN || error.digest) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
}
