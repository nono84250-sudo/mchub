// Visite guidée du launcher (design A « Bulles », choisi par Rushi le 25/10) : au premier
// lancement, une bulle propose la visite, puis pointe chaque bouton du menu de gauche pendant que
// la page correspondante s'ouvre derrière. « Passer », Échap ou × la ferment à tout moment ; elle
// se rejoue depuis Paramètres > Divers (et depuis l'Aide quand la page existe).
//
// Fichier autonome, chargé après renderer.js : il ne dépend que des boutons #nav-* du menu. Une
// étape dont le bouton n'existe pas (ex. « Jouer » sur une version sans le mode Jouer) est sautée,
// la même visite marche donc avec ou sans les nouveautés.
(function () {
  const SEEN_KEY = "omniscient.tourSeen.v1";

  const TEXTS = {
    fr: {
      skip: "Passer", next: "Suivant", prev: "Précédent", done: "C'est parti !", close: "Fermer", of: "{i} sur {n}", beta: "bêta",
      welcomeT: "Bienvenue sur Omniscient 👋", welcomeD: "Une visite rapide pour voir où tout se trouve ? Ça prend moins d'une minute.",
      start: "Faire la visite", later: "Pas maintenant",
      skipped: "Pas de souci. Tu pourras revoir la visite dans les paramètres.",
      skippedHelp: "Pas de souci. Tu pourras revoir la visite dans l'Aide.",
      replayT: "Visite guidée", replayD: "Revois en une minute où tout se trouve dans le launcher.", replayBtn: "Revoir la visite",
      steps: {
        "nav-home": "Ta page de départ : reprends le dernier serveur joué en un clic, et retrouve tes favoris et tes amis en ligne.",
        "nav-servers": "L'annuaire. Cherche, filtre par version ou par style, et mets une ⭐ pour garder un serveur.",
        "nav-play": "Joue en solo dans la version que tu veux. À gauche « Mes versions », à droite « Mes mondes », sauvegardés tout seuls.",
        "nav-favorites": "Les serveurs que tu as mis en ⭐, pour les retrouver vite.",
        "nav-favorites:library": "Tes favoris, tes serveurs récents et ce qui est installé sur ce PC, au même endroit.",
        "nav-recent": "Les derniers serveurs sur lesquels tu as joué.",
        "nav-friends": "Ajoute tes amis avec leur pseudo, vois qui est en ligne et rejoins-les sur leur serveur.",
        "nav-my-instances": "Tu as un serveur ? Retrouve ici sa fiche et ses statistiques.",
        "nav-help": "Une question ? L'aide est ici (touche F1). Juste en dessous : thème, langue et mémoire. Tu peux revoir cette visite depuis l'Aide.",
        "nav-settings": "Thème, langue, mémoire… Tu peux aussi revoir cette visite ici, dans « Divers ».",
      },
    },
    en: {
      skip: "Skip", next: "Next", prev: "Back", done: "Let's go!", close: "Close", of: "{i} of {n}", beta: "beta",
      welcomeT: "Welcome to Omniscient 👋", welcomeD: "Want a quick tour to see where everything is? It takes less than a minute.",
      start: "Take the tour", later: "Not now",
      skipped: "No problem. You can take the tour again from Settings.",
      skippedHelp: "No problem. You can take the tour again from Help.",
      replayT: "Guided tour", replayD: "See where everything is in the launcher, in one minute.", replayBtn: "Take the tour again",
      steps: {
        "nav-home": "Your starting page: jump back into your last server in one click, and find your favorites and friends online.",
        "nav-servers": "The directory. Search, filter by version or style, and star ⭐ a server to keep it.",
        "nav-play": "Play solo in any version you like. “My versions” on the left, “My worlds” on the right, backed up automatically.",
        "nav-favorites": "The servers you starred ⭐, to find them quickly.",
        "nav-favorites:library": "Your favorites, recent servers and what's installed on this PC, in one place.",
        "nav-recent": "The last servers you played on.",
        "nav-friends": "Add friends by username, see who's online and join them on their server.",
        "nav-my-instances": "Own a server? Find its page and its stats here.",
        "nav-help": "Got a question? Help is here (F1 key). Right below: theme, language and memory. You can replay this tour from Help.",
        "nav-settings": "Theme, language, memory… You can also replay this tour here, under “Misc”.",
      },
    },
  };
  // Ordre de la visite. Une étape dont le bouton manque ou est caché est sautée ; « Paramètres »
  // n'a pas d'étape à lui quand l'Aide existe (l'étape Aide en parle déjà) : 7 étapes au plus.
  const STEPS = ["nav-home", "nav-servers", "nav-play", "nav-favorites", "nav-recent", "nav-friends", "nav-my-instances", "nav-help", "nav-settings"];

  const $ = (id) => document.getElementById(id);
  const L = () => {
    const loc = (window.i18n && window.i18n.getLocale && window.i18n.getLocale()) || "fr";
    return String(loc).startsWith("fr") ? TEXTS.fr : TEXTS.en;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (s, p) => s.replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? ""));
  const shown = (el) => !!el && !el.hidden && el.offsetParent !== null;
  const toast = (m) => { if (typeof toolsToast === "function") toolsToast(m); };
  const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return true; } };
  const markSeen = () => { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* rien de bloquant */ } };

  const css = document.createElement("style");
  css.textContent = `
  #tour-hole { position: fixed; z-index: 9000; border-radius: 10px; pointer-events: none; box-shadow: 0 0 0 9999px rgba(0,0,0,.55), 0 0 0 3px var(--accent); transition: all .25s ease; }
  #tour-block { position: fixed; inset: 0; z-index: 8999; }
  #tour-pop { position: fixed; z-index: 9001; width: 320px; max-width: calc(100vw - 32px); background: var(--surface-raised, var(--surface)); color: var(--foreground); border: 1px solid var(--border); border-radius: 14px; padding: 16px 16px 12px; box-shadow: var(--shadow-pop, 0 12px 40px rgba(0,0,0,.4)); transition: top .25s ease, left .25s ease; }
  #tour-pop::before { content: ""; position: absolute; left: -7px; top: var(--arrow, 22px); width: 12px; height: 12px; background: inherit; border-left: 1px solid var(--border); border-bottom: 1px solid var(--border); transform: rotate(45deg); }
  #tour-pop.center::before { display: none; }
  #tour-pop .tp-step { font-size: 11.5px; color: var(--muted); font-weight: 600; letter-spacing: .03em; }
  #tour-pop h4 { margin: 4px 0 6px; font-size: 16px; display: flex; align-items: center; gap: 8px; padding-right: 24px; }
  #tour-pop p { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--muted); }
  #tour-pop .tp-actions { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
  #tour-pop .tp-actions .sp { flex: 1; }
  #tour-pop .tp-x { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border: 0; background: transparent; color: var(--muted); font-size: 18px; cursor: pointer; border-radius: 6px; }
  #tour-pop .tp-x:hover { background: var(--surface); color: var(--foreground); }
  #tour-pop .tp-link { background: none; border: 0; color: var(--muted); font: inherit; font-size: 13px; cursor: pointer; padding: 6px 4px; }
  #tour-pop .tp-link:hover { color: var(--foreground); text-decoration: underline; }
  .tour-beta { font-size: 9.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--accent-2, var(--accent)); border: 1px solid currentColor; border-radius: 4px; padding: 1px 4px; }
  #tour-replay-card { display: flex; align-items: center; gap: 14px; border: 1px solid var(--border); background: var(--surface); border-radius: 12px; padding: 12px 14px; margin: 4px 0 14px; }
  #tour-replay-card .ic { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 18%, transparent); font-size: 18px; flex: 0 0 auto; }
  #tour-replay-card b { display: block; font-size: 14px; } #tour-replay-card small { color: var(--muted); font-size: 12.5px; }
  #tour-replay-card button { margin-left: auto; }
  `;
  document.head.appendChild(css);

  function steps() {
    const ids = STEPS.filter((id) => shown($(id)));
    return ids.includes("nav-help") ? ids.filter((id) => id !== "nav-settings") : ids;
  }
  // Nom de l'étape = nom du bouton (déjà traduit par i18n.js), sans le « (bêta) » ajouté au titre.
  function stepTitle(nav) {
    const label = nav.querySelector(".sidebar-label")?.textContent || nav.title || nav.getAttribute("aria-label") || "";
    return label.replace(/\s*\(.*\)\s*$/, "").trim();
  }
  function stepText(id, nav) {
    const T = L().steps;
    if (id === "nav-favorites" && /biblioth|library/i.test(stepTitle(nav))) return T["nav-favorites:library"];
    return T[id] || "";
  }
  const isBeta = (nav) => !!nav.querySelector(".sidebar-beta");

  let keyHandler = null;
  function setKeys(fn) {
    if (keyHandler) document.removeEventListener("keydown", keyHandler, true);
    keyHandler = fn;
    if (fn) document.addEventListener("keydown", fn, true);
  }
  function end(skipped) {
    ["tour-hole", "tour-block", "tour-pop"].forEach((id) => $(id)?.remove());
    setKeys(null);
    markSeen();
    if (skipped) toast(shown($("nav-help")) ? L().skippedHelp : L().skipped);
  }
  function pop() {
    let el = $("tour-pop");
    if (!el) {
      el = document.createElement("div");
      el.id = "tour-pop";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }
  function block(dim) {
    let el = $("tour-block");
    if (!el) { el = document.createElement("div"); el.id = "tour-block"; document.body.appendChild(el); }
    el.style.background = dim ? "rgba(0,0,0,.45)" : "transparent";
  }

  function welcome() {
    end(false);
    const T = L();
    block(true);
    const el = pop();
    el.classList.add("center");
    el.innerHTML = `<button class="tp-x" data-a="skip" aria-label="${esc(T.close)}">×</button><h4>${esc(T.welcomeT)}</h4><p>${esc(T.welcomeD)}</p>
      <div class="tp-actions"><button class="tp-link" data-a="skip">${esc(T.later)}</button><span class="sp"></span><button class="join-btn" data-a="start">${esc(T.start)}</button></div>`;
    el.style.left = `calc(50% - ${el.offsetWidth / 2}px)`;
    el.style.top = `calc(50% - ${el.offsetHeight / 2}px)`;
    el.onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "skip") end(true);
      if (a === "start") step(0);
    };
    setKeys((e) => { if (e.key === "Escape") { e.stopPropagation(); end(true); } });
    el.querySelector(".join-btn").focus();
  }

  function step(i) {
    const list = steps();
    if (!list.length) return end(false);
    i = Math.max(0, Math.min(i, list.length - 1));
    const id = list[i];
    const nav = $(id);
    const T = L();
    block(false);
    // Ouvre la page dont on parle, derrière la bulle.
    try { nav.click(); } catch { /* la bulle reste utile même si la page ne s'ouvre pas */ }
    let hole = $("tour-hole");
    if (!hole) { hole = document.createElement("div"); hole.id = "tour-hole"; document.body.appendChild(hole); }
    const r = nav.getBoundingClientRect();
    Object.assign(hole.style, { left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px" });
    const el = pop();
    el.classList.remove("center");
    el.dataset.step = String(i);
    const last = i === list.length - 1;
    el.innerHTML = `<button class="tp-x" data-a="skip" aria-label="${esc(T.close)}">×</button>
      <div class="tp-step">${esc(fmt(T.of, { i: i + 1, n: list.length }))}</div>
      <h4>${esc(stepTitle(nav))}${isBeta(nav) ? ` <span class="tour-beta">${esc(T.beta)}</span>` : ""}</h4><p>${esc(stepText(id, nav))}</p>
      <div class="tp-actions">${last ? "" : `<button class="tp-link" data-a="skip">${esc(T.skip)}</button>`}<span class="sp"></span>
      ${i > 0 ? `<button class="btn-secondary" data-a="prev">${esc(T.prev)}</button>` : ""}
      <button class="join-btn" data-a="next">${esc(last ? T.done : T.next)}</button></div>`;
    const top = Math.max(12, Math.min(window.innerHeight - el.offsetHeight - 12, r.top + r.height / 2 - 30));
    el.style.left = r.right + 16 + "px";
    el.style.top = top + "px";
    el.style.setProperty("--arrow", Math.max(14, Math.min(el.offsetHeight - 26, r.top + r.height / 2 - top - 6)) + "px");
    el.onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "skip") end(true);
      if (a === "prev") step(i - 1);
      if (a === "next") {
        if (!last) return step(i + 1);
        end(false);
        $("nav-home")?.click();
      }
    };
    setKeys((e) => {
      if (e.key === "Escape") { e.stopPropagation(); end(true); }
      else if (e.key === "ArrowRight") { e.preventDefault(); el.querySelector('[data-a="next"]').click(); }
      else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); step(i - 1); }
    });
    el.querySelector('[data-a="next"]').focus();
  }
  window.addEventListener("resize", () => {
    const el = $("tour-pop");
    if (el && !el.classList.contains("center") && el.dataset.step) step(Number(el.dataset.step));
  });

  // --- Rejouer : ligne dans Paramètres > Divers, carte en haut de l'Aide si elle existe --------
  function addReplay() {
    if (!tourOn) return;
    const T = L();
    const content = $("settings-content");
    const misc = document.querySelector('#settings-panel .settings-nav-btn.active[data-tab="misc"]');
    if (content && misc && shown(content) && !$("tour-replay-row")) {
      const sec = document.createElement("section");
      sec.className = "settings-section";
      sec.id = "tour-replay-row";
      sec.innerHTML = `<div class="settings-row"><span><span class="settings-row-label">${esc(T.replayT)}</span><p class="settings-row-desc">${esc(T.replayD)}</p></span><button class="btn-secondary" type="button">${esc(T.replayBtn)}</button></div>`;
      sec.querySelector("button").onclick = welcome;
      // À la fin de l'onglet : le premier enfant reste celui du launcher (certaines versions
      // re-rangent l'onglet en cartes quand son premier enfant change).
      content.append(sec);
    }
    const help = $("help-panel");
    if (help && shown(help) && !$("tour-replay-card")) {
      const card = document.createElement("div");
      card.id = "tour-replay-card";
      card.innerHTML = `<span class="ic">🧭</span><span><b>${esc(T.replayT)}</b><small>${esc(T.replayD)}</small></span><button class="join-btn" type="button">${esc(T.replayBtn)}</button>`;
      card.querySelector("button").onclick = welcome;
      const h2 = help.querySelector("h2");
      h2 ? h2.after(card) : help.prepend(card);
    }
  }
  let replayQueued = false;
  // Ne réagit qu'aux changements de Paramètres ou de l'Aide (audit 25/10) : avant, chaque
  // modification de la page (liste des serveurs, barres de progression…) relançait addReplay
  // pendant toute la session. L'observateur reste branché : l'onglet Divers est redessiné à
  // chaque ouverture et la ligne doit y revenir.
  const concernsReplay = (record) => {
    const el = record.target.nodeType === 1 ? record.target : record.target.parentElement;
    if (el?.closest?.("#settings-panel, #help-panel")) return true;
    return [...record.addedNodes].some((n) => n.nodeType === 1 && (n.id === "help-panel" || !!n.querySelector?.("#help-panel")));
  };
  new MutationObserver((records) => {
    if (replayQueued || !records.some(concernsReplay)) return;
    replayQueued = true;
    setTimeout(() => { replayQueued = false; addReplay(); }, 50);
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class"] });

  // --- Premier lancement : on attend que l'appli soit prête et qu'aucune fenêtre ne soit ouverte
  // (connexion, assistant du premier lancement, choix de la mémoire…), jamais pendant le démarrage.
  // Laboratoire (25/10) : la visite ne se propose que si l'interrupteur « tour » du site la montre.
  let tourOn = false;
  window.mchub?.getFeatures?.().then((state) => { tourOn = state?.tour?.visible === true; }).catch(() => {});
  window.mchub?.onFeaturesChanged?.((state) => { tourOn = state?.tour?.visible === true; });
  function readyForTour() {
    if (!tourOn) return false;
    if (!shown($("app")) || document.body.classList.contains("bootstrapping") || document.body.classList.contains("boot-preview")) return false;
    if ([...document.querySelectorAll(".modal-overlay")].some((o) => !o.hidden)) return false;
    return shown($("nav-home"));
  }
  if (!readSeen()) {
    let calm = 0;
    const timer = setInterval(() => {
      if (readSeen()) return clearInterval(timer);
      // 3 vérifications de suite sans fenêtre ouverte (1,5 s) avant de proposer la visite.
      calm = readyForTour() ? calm + 1 : 0;
      if (calm >= 3) { clearInterval(timer); welcome(); }
    }, 500);
  }

  window.omniscientTour = { start: welcome, reset: () => { try { localStorage.removeItem(SEEN_KEY); } catch {} } };
})();
