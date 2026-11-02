// Idee 3 du lancement (19/10) : rapports d'erreurs du launcher envoyes a Sentry (region UE).
// Inactif sans SENTRY_DSN (dans launcher/.env, que Rushi remplit lui-meme ; fige au build par
// scripts/generate-env.js comme les autres valeurs). Inactif aussi si le module n'est pas encore
// installe (npm install pas fait) : le launcher demarre comme avant.
// Jamais de pseudo, d'adresse IP, de nom du PC ni de chemin avec le nom de la session Windows.
const os = require("node:os");
const { app } = require("electron");

let Sentry = null;
let rendererReports = 0;
// Une page qui boucle sur la meme erreur ne doit pas vider le quota gratuit.
const MAX_RENDERER_REPORTS = 10;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Les chemins des fichiers (C:\Users\<nom>\...) contiennent le nom de la session Windows :
// remplaces par « ~ » partout dans le rapport, sous leur forme brute et echappee (JSON).
function scrub(event) {
  delete event.user;
  delete event.server_name;
  const home = os.homedir();
  if (!home) return scrubStrings(event);
  const raw = JSON.stringify(event);
  const escaped = JSON.stringify(home).slice(1, -1);
  const cleaned = raw.replace(new RegExp(escapeRegExp(escaped), "gi"), "~").replace(new RegExp(escapeRegExp(home.replace(/\\/g, "/")), "gi"), "~");
  return scrubStrings(JSON.parse(cleaned));
}

// Audit du 01/11 : un lien signé (mondes, packs) ou un UUID Minecraft ne part jamais dans un rapport.
// La partie après « ? » ou « # » d'une adresse est retirée, les UUID sont masqués. Les identifiants
// propres à Sentry restent intacts (sans eux, le rapport serait refusé).
const SENTRY_ID_KEYS = new Set(["event_id", "trace_id", "span_id", "parent_span_id", "debug_id", "sid", "replay_id"]);
const UUID_DASHED = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const UUID_PLAIN = /\b[0-9a-f]{32}\b/gi;
function scrubText(text) {
  return text
    .replace(/(https?:\/\/[^\s"'<>?#]+)[?#][^\s"'<>]*/gi, "$1")
    .replace(UUID_DASHED, "<uuid>")
    .replace(UUID_PLAIN, "<uuid>");
}
function scrubStrings(value, key = "") {
  if (typeof value === "string") return SENTRY_ID_KEYS.has(key) ? value : scrubText(value);
  if (Array.isArray(value)) return value.map((item) => scrubStrings(item, key));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubStrings(v, k)]));
  return value;
}

function init({ dsn, release, isEnabled = () => true }) {
  if (!dsn) return;
  try {
    Sentry = require("@sentry/electron/main");
  } catch {
    Sentry = null;
    return;
  }
  Sentry.init({
    dsn,
    release: `omniscient-launcher@${release}`,
    environment: app.isPackaged ? "production" : "development",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    serverName: "launcher",
    // Paramètres > Confidentialité : coupé = plus aucun rapport, sans redémarrer.
    beforeSend: (event) => (isEnabled() ? scrub(event) : null),
    // Pas de minidump : une copie de la mémoire peut contenir un jeton de session.
    integrations: (defaults) => defaults.filter((integration) => integration.name !== "SentryMinidump"),
    // Les messages de la console peuvent contenir un pseudo.
    beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === "console" ? null : breadcrumb),
  });
}

// Erreurs de l'interface (renderer.js), transmises par le preload : la fenetre est isolee
// (sandbox), elle ne charge pas Sentry elle-meme.
function reportRendererError(info) {
  if (!Sentry || rendererReports >= MAX_RENDERER_REPORTS) return;
  rendererReports += 1;
  const error = new Error(String(info?.message ?? "Erreur inconnue").slice(0, 500));
  error.name = "RendererError";
  if (info?.stack) error.stack = String(info.stack).slice(0, 4000);
  Sentry.captureException(error, { tags: { process: "renderer" } });
}

module.exports = { init, reportRendererError };
