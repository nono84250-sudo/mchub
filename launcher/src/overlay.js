// Petit menu de sauvegarde par-dessus le jeu (mode Jouer, 24/10). Les textes arrivent déjà
// traduits depuis liveSave.js : cette page ne fait qu'afficher, et renvoyer le nom tapé.
(() => {
  const $ = (id) => document.getElementById(id);
  const card = $("card");
  const form = $("form");
  const input = $("name");
  let asking = false;

  window.omniOverlay.onState((state) => {
    card.className = `card on ${state.mode || ""}`;
    $("title").textContent = state.title || "";
    $("text").textContent = state.text || "";
    $("text").hidden = !state.text;
    const hasPct = typeof state.percent === "number";
    $("pct").textContent = hasPct ? `${state.percent} %` : "";
    $("bar").hidden = !hasPct;
    if (hasPct) $("fill").style.width = `${state.percent}%`;
    $("hint").innerHTML = "";
    if (state.hint) {
      // « [F6] Sauvegarder · [Maj+F6] Avec un nom » : les crochets deviennent des touches.
      for (const part of String(state.hint).split(/(\[[^\]]+\])/)) {
        if (!part) continue;
        const el = part.startsWith("[") ? document.createElement("kbd") : document.createTextNode(part);
        if (part.startsWith("[")) el.textContent = part.slice(1, -1);
        $("hint").append(el);
      }
    }
    asking = state.mode === "ask";
    form.hidden = !asking;
    if (asking) {
      input.value = "";
      input.placeholder = state.placeholder || "";
      $("ok").textContent = state.okLabel || "OK";
      $("cancel").textContent = state.cancelLabel || "Annuler";
      setTimeout(() => input.focus(), 30);
    }
    if (state.mode === "hide") card.className = "card";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!asking) return;
    const value = input.value.trim();
    if (!value) return input.focus();
    asking = false;
    window.omniOverlay.answer(value);
  });
  $("cancel").addEventListener("click", () => {
    asking = false;
    window.omniOverlay.answer(null);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && asking) {
      asking = false;
      window.omniOverlay.answer(null);
    }
  });
})();
