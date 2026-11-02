// Catalogue de bugs (31/10, preview validée par Rushi) : les fenêtres du launcher quand une fiche est
// reconnue (voir bugCatalog.js). « consent » propose « Corriger », « manual » montre la marche à suivre,
// « auto » affiche au plus un petit message. Les textes des fiches viennent du site, en français et en anglais.
(function () {
  const bugsApi = window.mchub?.bugs;
  if (!bugsApi) return;
  const t = (k, o) => window.i18n.t(`bugs.${k}`, o);
  const L = () => (window.i18n.getLocale() === "en" ? "en" : "fr");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const css = document.createElement("style");
  css.textContent = `
    #bc-overlay .modal-box { max-width: 540px; width: calc(100vw - 48px); max-height: calc(100vh - 60px); display: flex; flex-direction: column; text-align: left; }
    .bc-scroll { overflow-y: auto; display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
    .bc-ic { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; font-weight: 800; }
    .bc-ic.ok { background: color-mix(in srgb, var(--success) 18%, transparent); color: var(--success); }
    .bc-ic.warn { background: color-mix(in srgb, var(--warn) 20%, transparent); color: var(--warn); }
    .bc-ic.acc { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
    .bc-ic svg { width: 16px; height: 16px; }
    .bc-kicker { font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin: 0; }
    .bc-title { margin: 2px 0 0; font-size: 15px; line-height: 1.35; }
    .bc-p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
    .bc-fix { padding: 11px 13px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border)); background: color-mix(in srgb, var(--accent) 7%, transparent); font-size: 13px; line-height: 1.5; }
    .bc-fix b { display: block; margin-bottom: 2px; }
    .bc-fix small { display: block; color: var(--muted); font-size: 12px; margin-top: 6px; }
    .bc-steps { margin: 0; padding: 0; list-style: none; counter-reset: s; display: flex; flex-direction: column; gap: 8px; }
    .bc-steps li { counter-increment: s; display: grid; grid-template-columns: 24px 1fr; gap: 10px; font-size: 13px; line-height: 1.5; }
    .bc-steps li::before { content: counter(s); width: 22px; height: 22px; border-radius: 50%; background: var(--surface-raised, color-mix(in srgb, var(--foreground) 8%, transparent)); display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; }
    .bc-det { border: 1px solid var(--border); border-radius: 10px; }
    .bc-det > summary { cursor: pointer; padding: 9px 12px; font-size: 13px; font-weight: 600; list-style: none; }
    .bc-det > summary::before { content: "▸ "; color: var(--muted); }
    .bc-det[open] > summary::before { content: "▾ "; }
    .bc-det > div { padding: 2px 12px 12px; }
    .bc-why { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0; }
    .bc-why b { color: var(--foreground); font-weight: 600; }
    .bc-link { background: none; border: 0; padding: 0; color: var(--accent); cursor: pointer; font: inherit; font-size: 12.5px; text-align: left; }
    .bc-page { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px dashed var(--border); font-size: 12.5px; color: var(--muted); }
    .bc-page button { margin: 0 0 0 auto; white-space: nowrap; }
    .bc-prog { display: flex; flex-direction: column; gap: 9px; padding: 4px 2px; }
    .bc-prog div { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--muted); }
    .bc-prog div.on, .bc-prog div.done { color: var(--foreground); }
    .bc-prog i { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; font-style: normal; font-size: 11px; display: flex; align-items: center; justify-content: center; }
    .bc-prog div.on i { border-color: var(--accent); border-right-color: transparent; animation: bcspin .8s linear infinite; }
    .bc-prog div.done i { border-color: var(--success); background: var(--success); color: #0d1a12; }
    @keyframes bcspin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .bc-prog div.on i { animation: none; } }
    .bc-toast { position: fixed; right: 18px; bottom: 18px; z-index: 9000; width: 340px; max-width: calc(100vw - 36px); display: flex; gap: 10px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--success); border-radius: 12px; box-shadow: var(--shadow-pop); font-size: 13px; line-height: 1.45; color: var(--foreground); }
    .bc-toast b { display: block; }
    .bc-toast span { color: var(--muted); font-size: 12.5px; }
    .bc-toast .x { margin-left: auto; background: none; border: 0; color: var(--muted); cursor: pointer; font-size: 16px; align-self: flex-start; }
    .bc-hint { position: fixed; left: 50%; top: 18px; transform: translateX(-50%); z-index: 9500; max-width: 520px; padding: 10px 16px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); color: var(--foreground); font-size: 13px; line-height: 1.45; box-shadow: var(--shadow-pop); }
  `;
  document.head.appendChild(css);

  const SVG = {
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="flex-shrink:0"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/></svg>',
  };

  let ov = null;
  let box = null;
  let busy = false;
  const queue = [];

  function ensureOverlay() {
    if (ov) return;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "bc-overlay";
    ov.hidden = true;
    ov.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="bc-h"></div>`;
    document.body.appendChild(ov);
    box = ov.firstChild;
    ov.addEventListener("mousedown", (e) => {
      if (e.target === ov && !busy) close();
    });
    document.addEventListener(
      "keydown",
      (e) => {
        if (!ov.hidden && e.key === "Escape" && !busy) {
          e.stopPropagation();
          close();
        }
      },
      true,
    );
  }
  function close() {
    ov.hidden = true;
    if (!document.querySelector(".modal-overlay:not([hidden]):not(#bc-overlay)")) document.body.classList.remove("modal-blocking");
    const next = queue.shift();
    if (next) setTimeout(() => show(next), 60);
  }
  function open(html) {
    ensureOverlay();
    box.innerHTML = html;
    ov.hidden = false;
    document.body.classList.add("modal-blocking");
    box.querySelector(".join-btn")?.focus();
  }
  function hint(text) {
    document.querySelectorAll(".bc-hint").forEach((x) => x.remove());
    const h = document.createElement("div");
    h.className = "bc-hint";
    h.setAttribute("role", "status");
    h.textContent = text;
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 5200);
  }

  const stepsOf = (f) => (f.steps?.[L()] || []).filter((x) => x.trim());
  const stepsHtml = (f) => `<ol class="bc-steps">${stepsOf(f).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;
  const pageRow = (f) => (f.hasGuide ? `<div class="bc-page">${SVG.book}<span>${esc(t("pageD"))}</span><button type="button" class="btn-secondary" id="bc-site">${esc(t("pageBtn"))}</button></div>` : "");
  const head = (cls, icon, kicker, title) => `<div class="modal-head" style="align-items:flex-start;gap:12px"><span class="bc-ic ${cls}">${icon}</span><div><p class="bc-kicker">${esc(kicker)}</p><h3 class="bc-title" id="bc-h">${esc(title)}</h3></div></div>`;
  const why = (f) => `<p class="bc-why"><b>${esc(t("why"))}</b> ${esc(f.cause?.[L()])}</p>`;

  async function copyLogs(btn) {
    const r = await window.mchub.play.crashLogs();
    if (!r?.ok) return;
    try {
      await navigator.clipboard.writeText(r.text);
      btn.textContent = `✓ ${t("copied")}`;
    } catch {
      /* presse-papiers refusé : rien à faire */
    }
  }
  function bindCommon(f) {
    box.querySelector("#bc-site")?.addEventListener("click", () => bugsApi.openPage(f.slug));
    const copy = box.querySelector("#bc-copy");
    copy?.addEventListener("click", () => copyLogs(copy));
  }

  function showConsent({ entry: f, versionId, test, hasLogs }) {
    open(`${head("acc", SVG.wrench, t("known"), f.title?.[L()])}
      <div class="bc-scroll">
        <p class="bc-p">${esc(f.symptom?.[L()])}</p>
        <div class="bc-fix"><b>${esc(t("canFix"))}</b>${esc(f.fixText?.[L()])}<small>${esc(t("safe"))}</small></div>
        ${stepsOf(f).length ? `<details class="bc-det"><summary>${esc(t("myself"))}</summary><div>${stepsHtml(f)}</div></details>` : ""}
        ${pageRow(f)}
        ${why(f)}
        ${hasLogs ? `<button type="button" class="bc-link" id="bc-copy">${esc(t("notMine"))}</button>` : ""}
      </div>
      <div class="modal-actions"><button type="button" class="btn-secondary" id="bc-no">${esc(t("notNow"))}</button><button type="button" class="join-btn" id="bc-go">${esc(t("fix"))}</button></div>`);
    bindCommon(f);
    box.querySelector("#bc-no").onclick = () => {
      if (!test) bugsApi.refused(f.slug);
      close();
      hint(t("refused"));
    };
    box.querySelector("#bc-go").onclick = () => {
      if (test) {
        close();
        return hint(t("testNoRepair"));
      }
      repair(f, versionId);
    };
  }

  async function repair(f, versionId) {
    busy = true;
    const labels = [t("stepBackup"), t(`step_${f.fixAction}`, { arg: f.fixArg }), t("stepCheck")];
    const draw = (i) => {
      box.querySelector(".bc-scroll").innerHTML = `<div class="bc-prog">${labels.map((s, k) => `<div class="${k < i ? "done" : k === i ? "on" : ""}"><i>${k < i ? "✓" : ""}</i>${esc(s)}</div>`).join("")}</div>`;
    };
    box.querySelector(".modal-actions").innerHTML = `<button type="button" class="join-btn" disabled>${esc(t("repairing"))}</button>`;
    draw(0);
    const out = await bugsApi.repair(f.slug, versionId, draw).catch((error) => ({ ok: false, error: error.message }));
    busy = false;
    if (!out?.ok) {
      box.querySelector(".modal-head").outerHTML = head("warn", "!", t("repairFailed"), f.title?.[L()]);
      box.querySelector(".bc-scroll").innerHTML = `<p class="bc-p">${esc(out?.error || "")}</p>${stepsOf(f).length ? `<div><p class="bc-kicker" style="margin-bottom:8px">${esc(t("whatToDo"))}</p>${stepsHtml(f)}</div>` : ""}`;
      box.querySelector(".modal-actions").innerHTML = `<button type="button" class="join-btn" id="bc-ok">OK</button>`;
      box.querySelector("#bc-ok").onclick = close;
      return box.querySelector("#bc-ok").focus();
    }
    draw(labels.length);
    box.querySelector(".modal-head").outerHTML = head("ok", SVG.check, t("repaired"), t("repairedT"));
    box.querySelector(".bc-scroll").insertAdjacentHTML("beforeend", `<p class="bc-p">${esc(f.fixText?.[L()])} ${esc(t("startAgain"))}</p>`);
    box.querySelector(".modal-actions").innerHTML = `<button type="button" class="btn-secondary" id="bc-close">${esc(t("close"))}</button><button type="button" class="join-btn" id="bc-play">${esc(t("play"))}</button>`;
    box.querySelector("#bc-close").onclick = close;
    box.querySelector("#bc-play").onclick = () => {
      close();
      window.__playLaunchVersion?.(versionId);
    };
    box.querySelector("#bc-play").focus();
  }

  function showManual({ entry: f, hasLogs }) {
    const list = stepsOf(f);
    open(`${head("warn", "!", t("known"), f.title?.[L()])}
      <div class="bc-scroll">
        <p class="bc-p">${esc(f.symptom?.[L()])}</p>
        ${list.length ? `<div><p class="bc-kicker" style="margin-bottom:8px">${esc(t("whatToDo"))}</p>${stepsHtml(f)}</div>` : ""}
        ${pageRow(f)}
        ${why(f)}
      </div>
      <div class="modal-actions">${hasLogs ? `<button type="button" class="btn-secondary" id="bc-copy">${esc(t("didntWork"))}</button>` : ""}<button type="button" class="join-btn" id="bc-ok">OK</button></div>`);
    bindCommon(f);
    box.querySelector("#bc-ok").onclick = close;
  }

  function showAuto({ entry: f }) {
    if (!f.notify) return;
    document.querySelectorAll(".bc-toast").forEach((x) => x.remove());
    const el = document.createElement("div");
    el.className = "bc-toast";
    el.setAttribute("role", "status");
    el.innerHTML = `<span class="bc-ic ok" style="width:24px;height:24px">${SVG.check}</span><div><b>${esc(t("avoided"))}</b><span>${esc(f.title?.[L()])}</span><br><button type="button" class="bc-link">${esc(t("details"))}</button></div><button type="button" class="x" aria-label="${esc(t("close"))}">×</button>`;
    document.body.appendChild(el);
    const timer = setTimeout(() => el.remove(), 9000);
    el.querySelector(".x").onclick = () => {
      clearTimeout(timer);
      el.remove();
    };
    el.querySelector(".bc-link").onclick = () => {
      clearTimeout(timer);
      el.remove();
      open(`${head("ok", SVG.check, t("fixedAlone"), f.title?.[L()])}
        <div class="bc-scroll"><p class="bc-p">${esc(f.symptom?.[L()])}</p><div class="bc-fix"><b>${esc(t("whatDone"))}</b>${esc(f.fixText?.[L()])}</div>${why(f)}<p class="bc-why">${esc(t("nothingToDo"))}</p></div>
        <div class="modal-actions"><button type="button" class="join-btn" id="bc-ok">OK</button></div>`);
      box.querySelector("#bc-ok").onclick = close;
    };
  }

  function show(found) {
    const f = found?.entry;
    if (!f) return;
    if (f.status === "auto") return showAuto(found);
    if (ov && !ov.hidden) return void queue.push(found);
    // « Corriger » seulement quand la réparation est possible ici : sinon, la marche à suivre.
    if (f.status === "consent" && (found.canRepair || found.test)) return showConsent(found);
    return showManual(found);
  }

  bugsApi.onFound(show);
  window.__bugCatalogShow = show;
})();
