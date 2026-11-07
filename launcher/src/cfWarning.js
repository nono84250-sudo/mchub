// Avertissement CurseForge (06/11, preview validée par Rushi) : une seule fois par PC, la première
// fois que le joueur lance ou crée un pack CurseForge. Bouton « Je suis d'accord et je valide »
// bloqué 8 s (compte à rebours visible). Relisible dans Paramètres > Divers.
// Expose window.confirmCurseforgeWarning({ force }) -> Promise<boolean> (false = annulé).
(function () {
  const KEY = "omniscient.cfWarning.v1";
  const SECONDS = 8;
  const TEXTS = {
    fr: {
      title: "Attention : CurseForge et ses règles",
      p1: "Pour utiliser ou créer un pack CurseForge, sache que CurseForge a ses propres règles et conditions d'utilisation.",
      p2: "Certains contenus ne peuvent pas être téléchargés automatiquement par Omniscient. Pour ceux-là, le launcher ouvre la bonne page, tu récupères le fichier toi-même, et il vérifie que c'est le bon.",
      tipT: "Tu crées un modpack ou un serveur ?",
      tipB: "Pour la tranquillité d'esprit de tes joueurs, passe par Modrinth. Ses mods s'installent automatiquement : personne n'a de fichier à ajouter à la main.",
      modrinth: "Découvrir Modrinth ↗",
      cancel: "Annuler",
      wait: (n) => `Lis le message (${n} s)`,
      ok: "Je suis d'accord et je valide",
      footOnce: "Affiché une seule fois, quand tu utilises ou crées un pack CurseForge. Tu peux le relire dans Paramètres › Divers.",
      footAgain: "Tu peux le relire à tout moment dans Paramètres › Divers.",
      setT: "Avertissement CurseForge",
      setD: "Relis le message affiché quand tu utilises ou crées un pack CurseForge.",
      setB: "Relire",
    },
    en: {
      title: "Attention: CurseForge and its rules",
      p1: "When you use or create a CurseForge pack, keep in mind that CurseForge has its own rules and terms of use.",
      p2: "Some content cannot be downloaded automatically by Omniscient. For those files, the launcher opens the right page, you get the file yourself, and it checks it is the right one.",
      tipT: "Creating a modpack or a server?",
      tipB: "For your players' peace of mind, go through Modrinth. Its mods install automatically, so nobody has to add files by hand.",
      modrinth: "Discover Modrinth ↗",
      cancel: "Cancel",
      wait: (n) => `Read the message (${n} s)`,
      ok: "I agree and confirm",
      footOnce: "Shown once, when you use or create a CurseForge pack. You can read it again in Settings › Misc.",
      footAgain: "You can read it again any time in Settings › Misc.",
      setT: "CurseForge warning",
      setD: "Read again the message shown when you use or create a CurseForge pack.",
      setB: "Read again",
    },
  };
  const L = () => {
    const loc = (window.i18n && window.i18n.getLocale && window.i18n.getLocale()) || "fr";
    return String(loc).startsWith("fr") ? TEXTS.fr : TEXTS.en;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const seen = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
  const markSeen = () => { try { localStorage.setItem(KEY, "1"); } catch {} };

  const style = document.createElement("style");
  style.textContent = `
  .cfw-box { max-width: 480px; }
  .cfw-box p + p { margin-top: 10px; }
  .cfw-tip { margin-top: 14px; padding: 11px 13px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--success) 35%, transparent); background: color-mix(in srgb, var(--success) 12%, transparent); }
  .cfw-tip b { display: block; font-size: 13.5px; color: var(--foreground); margin-bottom: 3px; }
  .cfw-tip p { color: var(--foreground); font-size: 13px; }
  .cfw-link { margin-top: 8px; padding: 0; border: 0; background: none; color: var(--accent); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
  .cfw-link:hover { text-decoration: underline; }
  .cfw-bar { margin-top: 16px; height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; }
  .cfw-bar i { display: block; height: 100%; width: 0; background: var(--state-busy); transition: width ${SECONDS}s linear; }
  .cfw-bar.done i { background: var(--success); }
  .cfw-foot { margin: 10px 0 0; font-size: 12px; }
  .cfw-box .modal-actions { margin-top: 14px; }
  .cfw-ok:disabled { opacity: .55; cursor: not-allowed; }`;
  document.head.appendChild(style);

  let pending = null;
  function show(again) {
    if (pending) return pending;
    pending = new Promise((resolve) => {
      const T = L();
      const ov = document.createElement("div");
      ov.className = "modal-overlay";
      ov.innerHTML = `<div class="modal-box tone-warn cfw-box pop-in" role="dialog" aria-modal="true" aria-labelledby="cfw-title">
        <div class="modal-head"><span class="modal-icon">!</span><h3 id="cfw-title">${esc(T.title)}</h3></div>
        <p>${esc(T.p1)}</p><p>${esc(T.p2)}</p>
        <div class="cfw-tip"><b>${esc(T.tipT)}</b><p>${esc(T.tipB)}</p><button type="button" class="cfw-link">${esc(T.modrinth)}</button></div>
        <div class="cfw-bar"><i></i></div>
        <div class="modal-actions"><button type="button" class="btn-secondary cfw-cancel">${esc(T.cancel)}</button><button type="button" class="join-btn tone-warn cfw-ok" disabled>${esc(T.wait(SECONDS))}</button></div>
        <p class="cfw-foot">${esc(again ? T.footAgain : T.footOnce)}</p></div>`;
      document.body.appendChild(ov);
      document.body.classList.add("modal-blocking");
      const opener = document.activeElement;
      const box = ov.querySelector(".modal-box");
      const ok = ov.querySelector(".cfw-ok");
      const cancel = ov.querySelector(".cfw-cancel");
      const bar = ov.querySelector(".cfw-bar");
      const fill = bar.querySelector("i");
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = "100%"; }));
      let left = SECONDS;
      const timer = setInterval(() => {
        left -= 1;
        if (left > 0) { ok.textContent = T.wait(left); return; }
        clearInterval(timer);
        ok.disabled = false;
        ok.textContent = T.ok;
        bar.classList.add("done");
        ok.focus();
      }, 1000);
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === "Tab") {
          const items = [...box.querySelectorAll("button")].filter((b) => !b.disabled);
          if (!items.length) return;
          const first = items[0], last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      const done = (yes) => {
        clearInterval(timer);
        document.removeEventListener("keydown", onKey, true);
        ov.remove();
        document.body.classList.remove("modal-blocking");
        pending = null;
        if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
        resolve(yes);
      };
      document.addEventListener("keydown", onKey, true);
      cancel.addEventListener("click", () => done(false));
      ov.querySelector(".cfw-link").addEventListener("click", () => {
        try { window.mchub.packBrowse.openPage("https://modrinth.com"); } catch {}
      });
      ok.addEventListener("click", () => { if (ok.disabled) return; markSeen(); done(true); });
      cancel.focus();
    });
    return pending;
  }

  // force : relecture depuis Paramètres (toujours affichée). Sinon : seulement la première fois.
  window.confirmCurseforgeWarning = function confirmCurseforgeWarning(opts = {}) {
    if (!opts.force && seen()) return Promise.resolve(true);
    return show(Boolean(opts.force));
  };

  // Ligne « Avertissement CurseForge » dans Paramètres > Divers (même méthode que tour.js).
  const shown = (el) => !!el && !el.hidden && el.offsetParent !== null;
  function addRow() {
    const content = document.getElementById("settings-content");
    const misc = document.querySelector('#settings-panel .settings-nav-btn.active[data-tab="misc"]');
    if (!content || !misc || !shown(content) || document.getElementById("cf-warning-row")) return;
    const T = L();
    const sec = document.createElement("section");
    sec.className = "settings-section";
    sec.id = "cf-warning-row";
    sec.innerHTML = `<div class="settings-row"><span><span class="settings-row-label">${esc(T.setT)}</span><p class="settings-row-desc">${esc(T.setD)}</p></span><span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;"><button class="btn-secondary" type="button">${esc(T.setB)}</button></span></div>`;
    sec.querySelector("button").onclick = () => { window.confirmCurseforgeWarning({ force: true }); };
    content.append(sec);
  }
  let queued = false;
  new MutationObserver((records) => {
    if (queued || !records.some((r) => (r.target.nodeType === 1 ? r.target : r.target.parentElement)?.closest?.("#settings-panel"))) return;
    queued = true;
    setTimeout(() => { queued = false; addRow(); }, 60);
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class"] });
})();
