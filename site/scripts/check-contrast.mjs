// Verifie les contrastes du theme (lot 8, 18/10) : chaque couleur de texte doit faire au moins
// 4,5:1 sur le fond et sur les cartes, en theme sombre ET en theme clair. Lance a la main :
//   node scripts/check-contrast.mjs
// Les valeurs sont lues dans src/app/globals.css (variables en hex seulement : les formules
// color-mix sont ignorees). Sort avec le code 1 si une couleur est trop pale.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function block(selector) {
  const i = css.indexOf(selector);
  if (i < 0) return {};
  const body = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
  const vars = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[m[1]] = m[2];
  return vars;
}

const dark = block(":root {");
const light = { ...dark, ...block(':root[data-theme="light"] {') };

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const TEXT = ["foreground", "accent", "danger", "warn", "success", "frozen", "pending", "state-busy", "state-off"];
let failed = 0;
for (const [name, theme] of [["sombre", dark], ["clair", light]]) {
  for (const bg of ["background", "surface"]) {
    for (const fg of TEXT) {
      if (!theme[fg] || !theme[bg]) continue;
      const r = ratio(theme[fg], theme[bg]);
      const ok = r >= 4.5;
      if (!ok) failed++;
      console.log(`${ok ? "ok " : "KO "} ${name.padEnd(6)} --${fg.padEnd(11)} sur --${bg.padEnd(10)} ${r.toFixed(2)}:1`);
    }
  }
}
// Bouton plein : texte blanc sur l'accent fonce.
const fill = light.accent;
const r = ratio("#ffffff", fill);
console.log(`${r >= 4.5 ? "ok " : "KO "} bouton plein (texte blanc sur ${fill}) ${r.toFixed(2)}:1`);
if (r < 4.5) failed++;
process.exit(failed ? 1 : 0);
