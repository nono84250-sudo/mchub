// Application du theme/accent (voir index.html :root[data-theme] et
// Parametres > Apparence). Module a part de renderer.js pour rester
// applicable des que les settings sont lus, avant tout rendu de contenu.
//
// IIFE : script classique charge par index.html, pas de type="module" — sans
// ce wrapper les top-level const/function ci-dessous fuiteraient dans le
// meme scope global que renderer.js/i18n.js (voir la meme remarque dans
// i18n.js, qui a cause une vraie collision de nom avant l'ajout du wrapper).
(function () {

// Bleu (2026-10-11) en position 0 : nouvelle couleur par defaut, l'ancien
// blurple reste disponible en 2e position pour qui l'avait deja choisi.
// Re-sature la meme nuance (2026-10-11, suite a la comparaison avec
// Modrinth) : la version precedente (#5fa3d3) etait jugee trop pastel pour
// que les elements importants ressortent — pas une nouvelle couleur, juste
// la meme poussee plus loin.
const ACCENT_PRESETS = ["#2792dd", "#9184d9", "#5fd3a0", "#e0a45f", "#d17ab0"];

function resolveThemeMode(theme) {
  if (theme === "light" || theme === "dark") return theme;
  // "system" : suit prefers-color-scheme, comme themeSystem dans la
  // maquette — pas de valeur "system" ecrite sur <html>, juste le resultat.
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// Reduire les animations (design 17/10, point 5) : "auto" suit le reglage Windows
// (prefers-reduced-motion), "on"/"off" le forcent.
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let lastMotionSetting = "auto";
function applyMotion(setting) {
  lastMotionSetting = setting || "auto";
  const reduce = lastMotionSetting === "on" || (lastMotionSetting === "auto" && reducedMotionQuery.matches);
  document.documentElement.classList.toggle("reduce-motion", reduce);
}
reducedMotionQuery.addEventListener("change", () => applyMotion(lastMotionSetting));

function applyTheme(settings) {
  document.documentElement.dataset.theme = resolveThemeMode(settings.theme);
  document.documentElement.style.setProperty("--accent", settings.accentColor || ACCENT_PRESETS[0]);
  applyMotion(settings.reduceMotion);
}

let systemThemeQuery = null;
function watchSystemTheme(getSettings) {
  systemThemeQuery = window.matchMedia("(prefers-color-scheme: light)");
  systemThemeQuery.addEventListener("change", async () => {
    const settings = await getSettings();
    if (settings.theme === "system") applyTheme(settings);
  });
}

window.themeControls = { ACCENT_PRESETS, applyTheme, watchSystemTheme };

})();
