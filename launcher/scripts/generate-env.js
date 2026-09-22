// Genere src/env.generated.js a partir de .env juste avant chaque build
// (voir le script npm "predist", execute automatiquement par npm avant
// "dist"). Necessaire parce que .env n'est jamais inclus dans le paquet
// distribue (un .exe public contenant les secrets en clair serait une fuite
// immediate — c'est deja arrive une fois sur ce projet, voir main.js) : les
// valeurs sont figees ici, au moment du build, a la place.
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const required = ["LAUNCHER_API_KEY"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[generate-env] Variable(s) manquante(s) dans .env avant le build : ${missing.join(", ")}`);
  process.exit(1);
}

const content = `// Genere automatiquement par scripts/generate-env.js juste avant chaque
// build — ne pas editer a la main, ne jamais committer (voir .gitignore).
module.exports = {
  LAUNCHER_API_KEY: ${JSON.stringify(process.env.LAUNCHER_API_KEY)},
  MCHUB_SITE_URL: ${JSON.stringify(process.env.MCHUB_SITE_URL || "http://localhost:3000")},
};
`;

fs.writeFileSync(path.join(__dirname, "..", "src", "env.generated.js"), content);
console.log("[generate-env] src/env.generated.js genere.");
