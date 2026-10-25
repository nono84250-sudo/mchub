// Genere src/env.generated.js a partir de .env juste avant chaque build
// (voir le script npm "predist", execute automatiquement par npm avant
// "dist"). Necessaire parce que .env n'est jamais inclus dans le paquet
// distribue (un .exe public contenant les secrets en clair serait une fuite
// immediate — c'est deja arrive une fois sur ce projet, voir main.js) : les
// valeurs sont figees ici, au moment du build, a la place.
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const required = ["LAUNCHER_API_KEY", "MCHUB_SITE_URL"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[generate-env] Variable(s) manquante(s) dans .env avant le build : ${missing.join(", ")}`);
  process.exit(1);
}

// Audit 14/10 (B8) : sans MCHUB_SITE_URL, le launcher distribue visait http://localhost:3000
// sans prevenir. Un build publie doit viser une adresse https publique.
// Audit 25/10 : un build publie vise EXACTEMENT le site officiel (sans www, un seul slash final
// tolere puis retire). Toute autre adresse (faute de frappe, ancien domaine vercel.app, site de
// test) est refusee, sauf build de test explicite avec MCHUB_ALLOW_CUSTOM_SITE=1.
const OFFICIAL_SITE_URL = "https://omniscientlauncher.com";
const allowCustomSite = process.env.MCHUB_ALLOW_CUSTOM_SITE === "1";
const rawSiteUrl = String(process.env.MCHUB_SITE_URL).trim().replace(/\/$/, "");
if (!allowCustomSite && rawSiteUrl !== OFFICIAL_SITE_URL) {
  console.error(
    `[generate-env] MCHUB_SITE_URL doit etre exactement ${OFFICIAL_SITE_URL} (sans www ni chemin), recu : ${process.env.MCHUB_SITE_URL}\n` +
      "[generate-env] Pour un build de test vers une autre adresse, relance avec MCHUB_ALLOW_CUSTOM_SITE=1.",
  );
  process.exit(1);
}
let siteUrl;
try {
  siteUrl = new URL(rawSiteUrl);
} catch {
  siteUrl = null;
}
if (!siteUrl || siteUrl.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(siteUrl.hostname)) {
  console.error(`[generate-env] MCHUB_SITE_URL doit etre une adresse https publique (ex. ${OFFICIAL_SITE_URL}), recu : ${process.env.MCHUB_SITE_URL}`);
  process.exit(1);
}
if (allowCustomSite && siteUrl.origin !== OFFICIAL_SITE_URL) {
  console.warn(`[generate-env] ATTENTION : build de test vers ${siteUrl.origin} (MCHUB_ALLOW_CUSTOM_SITE=1), a ne jamais publier.`);
}

const content = `// Genere automatiquement par scripts/generate-env.js juste avant chaque
// build — ne pas editer a la main, ne jamais committer (voir .gitignore).
module.exports = {
  LAUNCHER_API_KEY: ${JSON.stringify(process.env.LAUNCHER_API_KEY)},
  MCHUB_SITE_URL: ${JSON.stringify(siteUrl.origin)},
  // Optionnel (voir discordPresence.js) : Rich Presence desactive proprement
  // si absent, jamais bloquant pour le build.
  DISCORD_CLIENT_ID: ${JSON.stringify(process.env.DISCORD_CLIENT_ID || "")},
};
`;

fs.writeFileSync(path.join(__dirname, "..", "src", "env.generated.js"), content);
console.log("[generate-env] src/env.generated.js genere.");
