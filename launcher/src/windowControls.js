// Barre de titre custom (fenetre sans cadre natif, voir main.js) : les
// boutons appellent l'IPC expose par preload.js plutot que des raccourcis
// natifs, puisqu'il n'y a plus de barre systeme pour les fournir. Module a
// part (sur le modele de theme.js/i18n.js) car partage a l'identique entre
// la fenetre principale (renderer.js) et la console de debug
// (debug-console.js) — auparavant copie-colle entre les deux.
//
// IIFE : script classique charge par index.html/debug-console.html, pas de
// type="module" — voir la meme remarque dans i18n.js/theme.js.
(function () {

function wireWindowControls() {
  document.getElementById("win-min").addEventListener("click", () => window.mchub.windowControls.minimize());
  document.getElementById("win-close").addEventListener("click", () => window.mchub.windowControls.close());

  const maxBtn = document.getElementById("win-max");
  maxBtn.addEventListener("click", () => window.mchub.windowControls.toggleMaximize());

  const RESTORE_ICON =
    '<svg viewBox="0 0 10 10"><rect x="2" y="0.5" width="7" height="7" fill="none" stroke="currentColor" /><rect x="0.5" y="2.5" width="7" height="7" fill="rgba(15,23,41,0.92)" stroke="currentColor" /></svg>';
  const MAXIMIZE_ICON = '<svg viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" /></svg>';
  const setMaximizedIcon = (isMaximized) => {
    maxBtn.innerHTML = isMaximized ? RESTORE_ICON : MAXIMIZE_ICON;
  };

  window.mchub.windowControls.isMaximized().then(setMaximizedIcon);
  window.mchub.windowControls.onMaximizedChange(setMaximizedIcon);
}

window.windowControls = { wireWindowControls };

})();
