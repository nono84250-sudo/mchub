// Visite guidée du launcher (design A « Bulles », choisi par Rushi le 25/10) : au premier
// lancement, une bulle propose la visite, puis pointe chaque bouton du menu de gauche pendant que
// la page correspondante s'ouvre derrière. « Passer », Échap ou × la ferment à tout moment ; elle
// se rejoue depuis Paramètres > Divers (et depuis l'Aide quand la page existe).
//
// Fichier autonome, chargé après renderer.js : il ne dépend que des boutons #nav-* du menu. Une
// étape dont le bouton n'existe pas (ex. « Jouer » sur une version sans le mode Jouer) est sautée,
// la même visite marche donc avec ou sans les nouveautés.
//
// 25/10 soir (demande de Rushi) : la visite ne se propose plus en visiteur, dont le menu n'a que
// quelques onglets. Elle attend la connexion Microsoft (et l'assistant « Qu'est-ce que tu veux
// faire ? » qui s'ouvre juste après), puis montre le menu complet de ce compte. « Déjà vue » est
// retenu par compte sur ce PC : un autre compte qui se connecte la verra aussi une fois.
(function () {
  const SEEN_PREFIX = "omniscient.tourSeen.v2:";

  const TEXTS = {
    fr: {
      skip: "Passer", next: "Suivant", prev: "Précédent", done: "C'est parti !", close: "Fermer", of: "{i} sur {n}", beta: "bêta",
      welcomeT: "Bienvenue sur Omniscient 👋", welcomeD: "Une visite rapide pour voir où tout se trouve ? Ça prend moins d'une minute.",
      start: "Faire la visite", later: "Pas maintenant",
      skipped: "Pas de souci. Tu pourras revoir la visite dans les paramètres.",
      skippedHelp: "Pas de souci. Tu pourras revoir la visite dans l'Aide.",
      replayT: "Visite guidée", replayD: "Revois en une minute où tout se trouve dans le launcher.", replayBtn: "Revoir la visite",
      playDeep: "Visite de Jouer (1 min)", playReplay: "Visite de Jouer", resume: "Reprendre la visite", finish: "Terminer",
      ptLater: "Pas de souci. Tu pourras la faire plus tard depuis Paramètres › Divers ou l'Aide.",
      ptSet: ["Réglages des sauvegardes", "Choisis toutes les combien tes mondes sont sauvegardés, combien de sauvegardes garder et ce qui part dans le cloud."],
      ptAskT: "Première fois sur Jouer ?", ptAskD: "Une petite visite d'une minute pour voir comment marchent les installations, les mondes et les sauvegardes.",
      ptEndT: "C'est tout pour Jouer 🎮", ptEndD: "Tu peux revoir cette visite quand tu veux : Paramètres › Divers, ou dans l'Aide.",
      pt: [
        ["Continuer", "Ton dernier monde. Un clic sur « Reprendre » et tu es de retour dans ta partie."],
        ["Une installation", "Une installation, c'est une version de Minecraft (vanilla ou avec des mods) avec ses mondes. Clique dessus pour ouvrir sa page : mods, packs de ressources, data packs et fichiers."],
        ["Ses mondes", "« Mondes » ouvre la liste des mondes de cette installation juste en dessous, sans quitter la page."],
        ["Jouer et plus d'actions", "▶ lance l'installation sans choisir de monde. « ⋯ » sert à la renommer, la mettre à jour ou la retirer."],
        ["Un monde", "▶ Jouer reprend ce monde. « ⋯ » : ses sauvegardes, le restaurer, le copier ou le retirer."],
        ["Sauvegarde automatique", "Allumé, ton monde est sauvegardé tout seul : au lancement, puis toutes les 30 minutes (par défaut). En jeu, F6 sauvegarde tout de suite et Maj+F6 crée une sauvegarde ★ à garder."],
        ["Tous mes mondes", "Tous tes mondes, de toutes les installations, au même endroit. Tu y retrouves aussi ceux qui sont dans le cloud et ceux supprimés récemment."],
        ["Le menu « ⋯ »", "⚙ Réglages des sauvegardes : choisis toutes les combien, combien en garder et ce qui part dans le cloud. ☑ Sélectionner : choisis plusieurs installations pour les retirer d'un coup."],
        ["Nouvelle installation", "Cette tuile crée ta propre installation, installe un pack existant (Modrinth, CurseForge, FTB) ou importe ce que tu as déjà dans Minecraft ou un autre launcher."],
      ],
      steps: {
        "nav-home": "Ta page de départ : reprends le dernier serveur joué en un clic, et retrouve tes favoris et tes amis en ligne.",
        "nav-servers": "L'annuaire. Cherche, filtre par version ou par style, et mets une ⭐ pour garder un serveur.",
        "nav-play": "Joue en solo dans la version que tu veux, vanilla ou avec des mods. Tes mondes sont sauvegardés tout seuls. Il y a pas mal de choses ici : la visite de Jouer te montre tout en une minute.",
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
      playDeep: "Play tour (1 min)", playReplay: "Play tour", resume: "Back to the tour", finish: "Finish",
      ptLater: "No problem. You can take it later from Settings › Misc or Help.",
      ptSet: ["Backup settings", "Choose how often your worlds are backed up, how many backups to keep and what goes to the cloud."],
      ptAskT: "First time on Play?", ptAskD: "A quick one-minute tour of installations, worlds and backups.",
      ptEndT: "That's it for Play 🎮", ptEndD: "You can replay this tour any time: Settings › Misc, or in Help.",
      pt: [
        ["Continue", "Your last world. One click on “Resume” and you're back in your game."],
        ["An installation", "An installation is a Minecraft version (vanilla or modded) with its worlds. Click it to open its page: mods, resource packs, data packs and files."],
        ["Its worlds", "“Worlds” opens this installation's worlds right below, without leaving the page."],
        ["Play and more", "▶ starts the installation without picking a world. “⋯” lets you rename, update or remove it."],
        ["A world", "▶ Play resumes this world. “⋯”: its backups, restore, copy or remove it."],
        ["Automatic backup", "When on, your world is backed up on its own: at launch, then every 30 minutes (by default). In game, F6 backs up right away and Shift+F6 makes a ★ backup to keep."],
        ["All my worlds", "All your worlds, from every installation, in one place. Worlds in the cloud and recently deleted ones are there too."],
        ["The “⋯” menu", "⚙ Backup settings: choose how often, how many to keep and what goes to the cloud. ☑ Select: pick several installations to remove them at once."],
        ["New installation", "This tile creates your own installation, install an existing pack (Modrinth, CurseForge, FTB) or import what you already have in Minecraft or another launcher."],
      ],
      steps: {
        "nav-home": "Your starting page: jump back into your last server in one click, and find your favorites and friends online.",
        "nav-servers": "The directory. Search, filter by version or style, and star ⭐ a server to keep it.",
        "nav-play": "Play solo in any version you like, vanilla or modded. Your worlds are backed up automatically. There's a lot here: the Play tour shows you everything in one minute.",
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
  const STEPS = ["nav-home", "nav-servers", "nav-play", "nav-favorites", "nav-recent", "nav-my-instances", "nav-friends", "nav-help", "nav-settings"];

  const $ = (id) => document.getElementById(id);
  const L = () => {
    const loc = (window.i18n && window.i18n.getLocale && window.i18n.getLocale()) || "fr";
    return String(loc).startsWith("fr") ? TEXTS.fr : TEXTS.en;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (s, p) => s.replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? ""));
  const shown = (el) => !!el && !el.hidden && el.offsetParent !== null;
  const toast = (m) => { if (typeof toolsToast === "function") toolsToast(m); };
  // signedIn et currentProfile sont les variables globales de renderer.js (chargé avant ce fichier).
  const account = () => {
    try { return signedIn && currentProfile?.id ? String(currentProfile.id) : null; } catch { return null; }
  };
  const readSeen = () => {
    const id = account();
    if (!id) return false;
    try { return localStorage.getItem(SEEN_PREFIX + id) === "1"; } catch { return true; }
  };
  const markSeen = () => {
    const id = account();
    if (!id) return;
    try { localStorage.setItem(SEEN_PREFIX + id, "1"); } catch { /* rien de bloquant */ }
  };

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
  #tour-pop .tp-deep { display: block; width: 100%; margin: 12px 0 0; }
  #tour-pop.pt-below::before { left: var(--ax, 30px); top: -7px; border: 0; border-left: 1px solid var(--border); border-top: 1px solid var(--border); }
  #tour-pop.pt-above::before { left: var(--ax, 30px); top: auto; bottom: -7px; border: 0; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  #tour-pop .tp-dots { display: flex; gap: 4px; margin-top: 2px; } #tour-pop .tp-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--border); } #tour-pop .tp-dots i.on { background: var(--accent); }
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
  // Page ouverte avant la visite (ex. celle choisie dans l'assistant du premier lancement) : on y
  // revient à la fin, au lieu de laisser le joueur sur la dernière page montrée.
  let origin = null;
  function backToOrigin() {
    const nav = (origin && $(origin)) || $("nav-home");
    origin = null;
    if (shown(nav)) nav.click();
  }
  function end(skipped) {
    const wasStepping = !!$("tour-hole");
    ["tour-hole", "tour-block", "tour-pop"].forEach((id) => $(id)?.remove());
    setKeys(null);
    markSeen();
    if (wasStepping) backToOrigin();
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
    origin = document.querySelector('.sidebar-btn.active[id^="nav-"]')?.id || null;
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
      ${id === "nav-play" && PT.ready() ? `<button class="btn-secondary tp-deep" data-a="play">🧭 ${esc(T.playDeep)}</button>` : ""}
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
      if (a === "play") {
        // La visite de Jouer s'ouvre au milieu de la visite générale, qui reprend juste après.
        ["tour-hole", "tour-block", "tour-pop"].forEach((x) => $(x)?.remove());
        setKeys(null);
        PT.start({ resume: () => step(i + 1) });
      }
      if (a === "next") {
        if (!last) return step(i + 1);
        end(false);
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
    if (!tourOn && !PT.ready()) return;
    const T = L();
    const content = $("settings-content");
    const misc = document.querySelector('#settings-panel .settings-nav-btn.active[data-tab="misc"]');
    if (content && misc && shown(content) && !$("tour-replay-row")) {
      const sec = document.createElement("section");
      sec.className = "settings-section";
      sec.id = "tour-replay-row";
      // 28/10 (Rushi) : « Visite de Jouer » se relance ici, à côté de la visite complète (pas dans le « ⋯ » de Jouer).
      sec.innerHTML = `<div class="settings-row"><span><span class="settings-row-label">${esc(T.replayT)}</span><p class="settings-row-desc">${esc(T.replayD)}</p></span><span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">${PT.ready() ? `<button class="btn-secondary" type="button" data-pt>${esc(T.playReplay)}</button>` : ""}${tourOn ? `<button class="btn-secondary" type="button" data-w>${esc(T.replayBtn)}</button>` : ""}</span></div>`;
      const w = sec.querySelector("[data-w]");
      if (w) w.onclick = welcome;
      const pt = sec.querySelector("[data-pt]");
      if (pt) pt.onclick = () => PT.start({});
      // À la fin de l'onglet : le premier enfant reste celui du launcher (certaines versions
      // re-rangent l'onglet en cartes quand son premier enfant change).
      content.append(sec);
    }
    const help = $("help-panel");
    if (help && shown(help) && !$("tour-replay-card")) {
      const card = document.createElement("div");
      card.id = "tour-replay-card";
      card.innerHTML = `<span class="ic">🧭</span><span><b>${esc(T.replayT)}</b><small>${esc(T.replayD)}</small></span><span style="margin-left:auto;display:flex;gap:8px;">${PT.ready() ? `<button class="btn-secondary" type="button" data-pt>${esc(T.playReplay)}</button>` : ""}${tourOn ? `<button class="join-btn" type="button" data-w>${esc(T.replayBtn)}</button>` : ""}</span>`;
      const w = card.querySelector("[data-w]");
      if (w) w.onclick = welcome;
      const ptb = card.querySelector("[data-pt]");
      if (ptb) ptb.onclick = () => PT.start({});
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
  let playTourOn = false; // Laboratoire « playTour » (28/10)
  // La surveillance du premier lancement ne tourne que si la visite est ouverte (audit du 25/10).
  const setTour = (state) => {
    tourOn = state?.tour?.visible === true;
    playTourOn = state?.playTour?.visible === true;
    if (tourOn) watchFirstRun();
    if (playTourOn) watchPlayFirst();
  };
  window.mchub?.getFeatures?.().then(setTour).catch(() => {});
  window.mchub?.onFeaturesChanged?.(setTour);
  window.addEventListener("omniscient:features", (e) => setTour(e.detail));
  function readyForTour() {
    if (!tourOn || !account()) return false;
    if (!shown($("app")) || document.body.classList.contains("bootstrapping") || document.body.classList.contains("boot-preview")) return false;
    if ([...document.querySelectorAll(".modal-overlay")].some((o) => !o.hidden)) return false;
    return shown($("nav-home"));
  }
  // Tourne tant que la visite est ouverte dans le Laboratoire : en visiteur elle attend la
  // connexion, et après une déconnexion elle attend le compte suivant.
  let watching = false;
  function watchFirstRun() {
    if (watching) return;
    watching = true;
    let calm = 0;
    const timer = setInterval(() => {
      if (!tourOn) {
        watching = false;
        return clearInterval(timer);
      }
      if (!account() || readSeen() || $("tour-pop")) { calm = 0; return; }
      // 3 vérifications de suite sans fenêtre ouverte (1,5 s) avant de proposer la visite.
      calm = readyForTour() ? calm + 1 : 0;
      if (calm >= 3) { calm = 0; welcome(); }
    }, 500);
  }


  // --- Visite de Jouer (28/10, demande de Rushi) ------------------------------------------------
  // La page Jouer a beaucoup de choses (installations, tiroir des mondes, sauvegarde auto, menu ⋯ où
  // sont rangés les réglages des sauvegardes) : une visite à elle, en bulles qui pointent les vrais
  // éléments de la page. Elle se lance depuis la bulle « Jouer » de la visite générale (qui reprend
  // ensuite), toute seule à la première ouverture de Jouer (une fois par compte), depuis Paramètres ›
  // Divers et depuis l'Aide (Laboratoire « playTour »). Une étape dont l'élément manque (pas de monde,
  // pas d'installation) est sautée.
  const PT_SEEN = "omniscient.playTourSeen.v1:";
  const playPanel = () => $("play-panel");
  const ptSeen = () => { const id = account(); if (!id) return true; try { return localStorage.getItem(PT_SEEN + id) === "1"; } catch { return true; } };
  const ptMark = () => { const id = account(); if (!id) return; try { localStorage.setItem(PT_SEEN + id, "1"); } catch {} };
  const q = (sel) => [...(playPanel()?.querySelectorAll(sel) || [])].find(shown) || null;
  const firstTile = () => q("[data-pj-tile]");
  const tileWithWorlds = () => [...(playPanel()?.querySelectorAll("[data-pj-w]") || [])].find((b) => shown(b) && !/\(0\)/.test(b.textContent));
  const drawerOpen = () => !!q("[data-pj-drawer]");
  const closeDrawer = () => { const b = q('[data-pj-w][aria-expanded="true"]'); if (b) b.click(); };
  const openDrawer = () => { if (!drawerOpen()) tileWithWorlds()?.click(); };
  let ptMenu = false;
  // Ferme le menu « ⋯ » comme un clic ailleurs (play.js le retire et se remet à zéro).
  const closeMore = () => { if (ptMenu) { document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); ptMenu = false; } };
  // Sans le menu « ⋯ » (Laboratoire « packBrowse » coupé) : l'étape montre le bouton Réglages.
  const moreStep = () => {
    if (document.querySelector(".mv-menu")) return document.querySelector(".mv-menu");
    return q("[data-bk-settings]");
  };
  // Chaque étape : ce qu'elle prépare (ouvrir un tiroir, le menu ⋯…) puis l'élément montré.
  const PT_STEPS = [
    { pre: closeDrawer, el: () => q(".pj2-cont") },
    { pre: closeDrawer, el: firstTile },
    { pre: closeDrawer, el: () => tileWithWorlds() },
    { pre: closeDrawer, el: () => firstTile()?.querySelector(".pj2-acts") },
    { pre: openDrawer, el: () => q("[data-pj-drawer] .mv-row") },
    { pre: openDrawer, el: () => q("[data-pj-drawer] .mv-sw") },
    { pre: closeDrawer, el: () => q("[data-pj-all]") },
    { pre: () => { closeDrawer(); const b = q("[data-pb-more]"); if (b && !document.querySelector(".mv-menu")) { b.click(); ptMenu = true; } }, el: moreStep, alt: () => !document.querySelector(".mv-menu") },
    { pre: () => { closeMore(); closeDrawer(); }, el: () => q("[data-new-version]") },
  ];
  let ptCtx = {};
  function ptEnd(resume) {
    ["tour-hole", "tour-block", "tour-pop"].forEach((x) => $(x)?.remove());
    setKeys(null); closeMore(); closeDrawer(); ptMark();
    const r = ptCtx.resume; ptCtx = {};
    if (resume && r) r();
  }
  function ptPlace(el, r) {
    el.classList.remove("center", "pt-below", "pt-above");
    const w = el.offsetWidth, h = el.offsetHeight;
    const below = r.bottom + 14 + h < window.innerHeight - 8;
    const top = below ? r.bottom + 14 : Math.max(8, r.top - 14 - h);
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + Math.min(r.width, 260) / 2 - 30));
    el.classList.add(below ? "pt-below" : "pt-above");
    el.style.left = left + "px"; el.style.top = top + "px";
    el.style.setProperty("--ax", Math.max(16, Math.min(w - 28, r.left + Math.min(r.width, 260) / 2 - left - 6)) + "px");
  }
  function ptList() { return PT_STEPS.map((s, i) => ({ ...s, i })); }
  function ptStep(n, dir = 1) {
    const T = L(), all = ptList();
    if (n >= all.length) return ptFinal();
    if (n < 0) n = 0;
    const s = all[n];
    try { s.pre?.(); } catch {}
    setTimeout(() => {
      const target = s.el();
      if (!target) return ptStep(n + dir, dir); // rien à montrer (pas de monde…) : étape suivante
      target.scrollIntoView({ block: "center", behavior: "instant" });
      setTimeout(() => {
        const r = target.getBoundingClientRect();
        block(false);
        let hole = $("tour-hole");
        if (!hole) { hole = document.createElement("div"); hole.id = "tour-hole"; document.body.appendChild(hole); }
        Object.assign(hole.style, { left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" });
        const el = pop();
        const [title, text] = s.alt?.() ? T.ptSet : T.pt[s.i];
        el.dataset.step = "";
        el.innerHTML = `<button class="tp-x" data-a="skip" aria-label="${esc(T.close)}">×</button>
          <div class="tp-step">${esc(T.playReplay)} · ${esc(fmt(T.of, { i: n + 1, n: all.length }))}</div>
          <h4>${esc(title)}</h4><p>${esc(text)}</p>
          <div class="tp-actions"><button class="tp-link" data-a="skip">${esc(T.skip)}</button><span class="sp"></span>
          ${n > 0 ? `<button class="btn-secondary" data-a="prev">${esc(T.prev)}</button>` : ""}<button class="join-btn" data-a="next">${esc(T.next)}</button></div>`;
        ptPlace(el, r);
        el.onclick = (e) => {
          const a = e.target.closest("[data-a]")?.dataset.a;
          if (a === "skip") ptEnd(true);
          if (a === "prev") ptStep(n - 1, -1);
          if (a === "next") ptStep(n + 1, 1);
        };
        setKeys((e) => {
          if (e.key === "Escape") { e.stopPropagation(); ptEnd(true); }
          else if (e.key === "ArrowRight") { e.preventDefault(); ptStep(n + 1, 1); }
          else if (e.key === "ArrowLeft" && n > 0) { e.preventDefault(); ptStep(n - 1, -1); }
        });
        el.querySelector('[data-a="next"]').focus();
      }, 120);
    }, 180);
  }
  function ptCenter(title, text, actions, onA) {
    $("tour-hole")?.remove();
    block(true);
    const el = pop();
    el.classList.remove("pt-below", "pt-above"); el.classList.add("center"); el.dataset.step = "";
    el.innerHTML = `<button class="tp-x" data-a="close" aria-label="${esc(L().close)}">×</button><h4>${esc(title)}</h4><p>${esc(text)}</p><div class="tp-actions">${actions}</div>`;
    el.style.left = `calc(50% - ${el.offsetWidth / 2}px)`; el.style.top = `calc(50% - ${el.offsetHeight / 2}px)`;
    el.onclick = (e) => { const a = e.target.closest("[data-a]")?.dataset.a; if (a) onA(a); };
    setKeys((e) => { if (e.key === "Escape") { e.stopPropagation(); onA("close"); } });
    el.querySelector(".join-btn")?.focus();
  }
  function ptFinal() {
    const T = L();
    closeMore(); closeDrawer();
    ptCenter(T.ptEndT, T.ptEndD, `<span class="sp"></span><button class="join-btn" data-a="ok">${esc(ptCtx.resume ? T.resume : T.finish)}</button>`, () => ptEnd(true));
  }
  function ptStart(ctx = {}) {
    ptCtx = ctx;
    const nav = $("nav-play");
    if (!shown(playPanel()) && nav) nav.click();
    $("main")?.scrollTo?.({ top: 0 });
    setTimeout(() => ptStep(0), 250);
  }
  // Première ouverture de Jouer (une fois par compte) : on propose la visite, jamais pendant la
  // visite générale ni au-dessus d'une autre fenêtre.
  function ptAsk() {
    const T = L();
    ptCenter(T.ptAskT, T.ptAskD, `<button class="tp-link" data-a="close">${esc(T.later)}</button><span class="sp"></span><button class="join-btn" data-a="go">${esc(T.start)}</button>`,
      (a) => { if (a === "go") ptStart({}); else { ptEnd(false); toast(L().ptLater); } });
  }
  // Tourne tant que l'interrupteur « playTour » est ouvert ; attend que la visite générale soit vue
  // (ou coupée) pour ne jamais proposer deux visites l'une sur l'autre.
  let ptWatching = false;
  function watchPlayFirst() {
    if (ptWatching) return;
    ptWatching = true;
    let calm = 0, wasShown = false, openedAt = 0;
    const timer = setInterval(() => {
      // 28/10 (Rushi) : la visite s'est ouverte quand sa première tuile est apparue, en plein milieu
      // d'autre chose. On ne la propose plus que dans les 8 secondes qui suivent l'ouverture de Jouer ;
      // sinon, à la prochaine ouverture.
      const vis = shown(playPanel());
      if (vis && !wasShown) openedAt = Date.now();
      wasShown = vis;
      if (!playTourOn) {
        ptWatching = false;
        return clearInterval(timer);
      }
      if (!account() || ptSeen() || $("tour-pop") || (tourOn && !readSeen())) { calm = 0; return; }
      if (!vis || !firstTile() || Date.now() - openedAt > 8000) { calm = 0; return; }
      if ([...document.querySelectorAll(".modal-overlay, .play-modal")].some((o) => !o.hidden)) { calm = 0; return; }
      if (++calm >= 2) { calm = 0; ptAsk(); }
    }, 500);
  }
  const PT = { ready: () => playTourOn && !!$("nav-play") && !!playPanel(), start: ptStart };
  window.omniscientTour = { start: welcome, play: ptStart, playAsk: ptAsk, reset: () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith(SEEN_PREFIX) || k.startsWith(PT_SEEN) || k === "omniscient.tourSeen.v1").forEach((k) => localStorage.removeItem(k)); } catch {}
  } };
})();
