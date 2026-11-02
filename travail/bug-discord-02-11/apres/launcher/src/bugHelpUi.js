// Aide Discord dans les bugs (02/11, preview validée par Rushi, Laboratoire « bugDiscord ») : le bloc
// « Besoin d'aide ? » et ses 3 boutons, pour les fenêtres de bug (play.js, bugCatalogUi.js). Le rapport
// est préparé et nettoyé côté main.js (voir crashHelp.js) ; ici, seulement l'affichage et les clics.
(function () {
  const api = window.mchub?.bugHelp;
  if (!api) return;
  const t = (k, o) => window.i18n.t(`bugHelp.${k}`, o);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const lang = () => (window.i18n.getLocale() === "en" ? "en" : "fr");

  let feat = {};
  window.mchub.getFeatures?.().then((f) => (feat = f || {})).catch(() => {});
  window.mchub.onFeaturesChanged?.((f) => (feat = f || {}));

  const css = document.createElement("style");
  css.textContent = `
    .btn-discord { background: #5865F2 !important; border-color: #5865F2 !important; color: #fff !important; }
    .btn-discord:hover { filter: brightness(1.08); }
    .bh-scroll { overflow-y: auto; max-height: calc(100vh - 230px); display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
    .bh-box { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px; border: 1px solid var(--border); background: color-mix(in srgb, var(--accent) 6%, transparent); }
    .bh-box h4 { margin: 0; font-size: 13.5px; }
    .bh-box ol { margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.55; color: var(--muted); }
    .bh-box ol b { color: var(--foreground); font-weight: 600; }
    .bh-tools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .bh-tools button { margin: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12.5px; padding: 9px 8px; line-height: 1.2; }
    .bh-tools svg { width: 15px; height: 15px; flex-shrink: 0; }
    .bh-tools button:disabled { opacity: .6; cursor: default; }
    @media (max-width: 520px) { .bh-tools { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(css);

  const ICON = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    zip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>',
    discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a14 14 0 0 0-4.4 0L10.6 3a19.8 19.8 0 0 0-4.9 1.4C2.6 9 1.8 13.5 2.2 18a19.9 19.9 0 0 0 6 3l.8-1.4-1.3-.6.3-.3a14.2 14.2 0 0 0 12 0l.3.3-1.3.6.8 1.4a19.9 19.9 0 0 0 6-3c.5-5.2-.8-9.7-3.5-13.6ZM8.7 15.3c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.6 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/></svg>',
  };

  function html() {
    return `<div class="bh-box">
      <h4>${esc(t("title"))}</h4>
      <ol><li><b>${esc(t("stepCopy"))}</b> ${esc(t("or"))} <b>${esc(t("stepZip"))}</b></li><li>${esc(t("stepJoin"))}</li><li>${esc(t("stepPaste"))}</li></ol>
      <div class="bh-tools">
        <button type="button" class="btn-secondary" data-bh="copy">${ICON.copy}${esc(t("copy"))}</button>
        <button type="button" class="btn-secondary" data-bh="zip">${ICON.zip}${esc(t("zip"))}</button>
        <button type="button" class="btn-secondary btn-discord" data-bh="discord">${ICON.discord}${esc(t("discord"))}</button>
      </div>
    </div>`;
  }

  async function copyAll(notify) {
    const r = await api.text(lang()).catch(() => null);
    if (!r?.ok) return notify(t("failed"));
    try {
      await navigator.clipboard.writeText(r.text);
      notify(t("copied", { n: r.text.split("\n").length }));
    } catch {
      notify(t("failed"));
    }
  }
  async function saveZip(notify, btn) {
    btn.disabled = true;
    const r = await api.zip(lang()).catch(() => null);
    btn.disabled = false;
    notify(r?.ok ? t("zipped", { name: r.name, kb: r.kb }) : t("failed"));
  }

  // `notify(texte)` : le petit message de la fenêtre qui affiche le bloc.
  function bind(root, notify) {
    root.querySelectorAll("[data-bh]").forEach((b) => {
      b.addEventListener("click", () => {
        if (b.dataset.bh === "copy") copyAll(notify);
        else if (b.dataset.bh === "zip") saveZip(notify, b);
        else api.discord();
      });
    });
  }

  window.__bugHelp = { isOn: () => feat?.bugDiscord?.visible === true, html, bind, safe: () => t("safe"), empty: () => t("empty") };
})();
