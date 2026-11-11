// Mon compte > bloc Skin : aperçu 3D, garde-robe, capes, skin d'un joueur.
// Chargé après renderer.js : remplace seulement le bloc skin de renderAccountPanel(), la page
// « Mon compte » reste au même endroit. Le 3D vient de skinview3d (MIT), voir vendor/.
(function () {
  const isEn = () => window.i18n && window.i18n.getLocale() === "en";
  const T = (fr, en) => (isEn() ? en : fr);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (m) => {
    document.querySelectorAll(".undo-toast.sk").forEach((e) => e.remove());
    const el = document.createElement("div"); el.className = "undo-toast sk"; el.setAttribute("role", "status"); el.textContent = m;
    document.body.appendChild(el); setTimeout(() => el.remove(), 4500);
  };
  const ERR = {
    SKIN_INVALID_FORMAT: () => T("Ce fichier n'est pas une image PNG. Rien n'a été ajouté.", "This file isn't a PNG image. Nothing was added."),
    SKIN_INVALID_SIZE: () => T("Ce skin n'a pas la bonne taille : Minecraft n'accepte que 64×64 (ou 64×32). Rien n'a été ajouté.", "This skin has the wrong size: Minecraft only accepts 64×64 (or 64×32). Nothing was added."),
    SKIN_TOO_LARGE: () => T("Ce fichier est trop gros pour un skin.", "This file is too big for a skin."),
    WARDROBE_FULL: () => T("Ta garde-robe est pleine (60 skins). Supprime-en un d'abord.", "Your wardrobe is full (60 skins). Delete one first."),
    NOT_SIGNED_IN: () => T("Connecte-toi avec Microsoft pour porter un skin.", "Sign in with Microsoft to wear a skin."),
    PLAYER_NOT_FOUND: () => T("Aucun joueur Minecraft avec ce nom.", "No Minecraft player with this name."),
    INVALID_NAME: () => T("Pseudo invalide (3 à 16 lettres, chiffres ou _), ou UUID.", "Invalid name (3–16 letters, digits or _), or UUID."),
    RATE_LIMITED: () => T("Trop de demandes. Réessaie dans une minute.", "Too many requests. Try again in a minute."),
    MOJANG_UNAVAILABLE: () => T("Les services Minecraft ne répondent pas. Réessaie plus tard.", "Minecraft services are not responding. Try again later."),
    CAPE_NOT_OWNED: () => T("Tu ne possèdes pas cette cape.", "You don't own this cape."),
    NOT_FOUND: () => T("Skin introuvable.", "Skin not found."),
  };
  const errText = (r) => (ERR[r && r.code] ? ERR[r.code]() : (r && r.message) || T("Erreur inconnue.", "Unknown error."));

  // Skin par défaut (Steve / Alex n'étant pas fournis) : dessiné ici, aucune image externe.
  function makeDefault() {
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64; const c = cv.getContext("2d");
    const fill = (col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    fill("#c58c6c", 0, 0, 32, 16); fill("#3b2a1d", 8, 0, 8, 8); fill("#3b2a1d", 8, 8, 8, 2); fill("#fff", 10, 12, 1, 1); fill("#fff", 13, 12, 1, 1); fill("#4a3dc8", 11, 12, 2, 1); fill("#8a4b3b", 11, 14, 2, 1);
    fill("#00a8a8", 16, 16, 24, 16); fill("#c58c6c", 40, 16, 16, 16); fill("#00a8a8", 40, 20, 16, 5); fill("#c58c6c", 32, 48, 16, 16); fill("#00a8a8", 32, 52, 16, 5);
    fill("#3a3a9c", 0, 16, 16, 16); fill("#3a3a9c", 16, 48, 16, 16);
    return cv.toDataURL("image/png");
  }
  const DEFAULT_URL = makeDefault();

  const css = document.createElement("style");
  css.textContent = `
  .sk-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
  .sk-sub { color: var(--muted); font-size: 13px; margin: 0 0 18px; }
  .sk-grid { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 20px; align-items: start; }
  @media (max-width: 900px) { .sk-grid { grid-template-columns: 1fr; } }
  .sk-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
  .sk-card h3 { margin: 0 0 10px; font-size: 14px; }
  .sk-stage { position: relative; display: flex; justify-content: center; align-items: center; height: 380px; border-radius: 12px; background: radial-gradient(ellipse at 50% 85%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%), var(--surface-raised); border: 1px solid var(--border); overflow: hidden; }
  .sk-stage canvas { display: block; cursor: grab; }
  .sk-stage .sk-load { position: absolute; color: var(--muted); font-size: 13px; padding: 0 20px; text-align: center; }
  .sk-tag { position: absolute; top: 10px; left: 10px; z-index: 1; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: var(--accent); color: #fff; }
  .sk-tag.prev { background: #b7791f; }
  .sk-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .sk-chip { font: inherit; font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--foreground); cursor: pointer; }
  .sk-chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .sk-label { font-size: 12px; color: var(--muted); margin: 14px 0 0; }
  .sk-checks { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 13px; }
  .sk-checks label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .sk-select { width: 100%; margin-top: 6px; }
  .sk-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .sk-note { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 10px 0 0; }
  .sk-note.err { color: #e5534b; }
  .sk-top { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
  .sk-top .grow { flex: 1; }
  .sk-wardrobe { display: grid; grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); gap: 12px; }
  .sk-item { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 8px 10px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-raised); cursor: pointer; text-align: center; }
  .sk-item:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
  .sk-item.sel { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent); }
  .sk-item .skin-body, .sk-found .skin-body { background: transparent; border: none; padding: 0; }
  .sk-badge { position: absolute; top: 6px; right: 6px; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: #1f9d55; color: #fff; }
  .sk-name { font-size: 13px; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sk-meta { font-size: 11px; color: var(--muted); margin-top: -4px; }
  .sk-mini { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; }
  .sk-mini button { font: inherit; font-size: 11px; padding: 2px 6px; border-radius: 7px; border: 1px solid var(--border); background: transparent; color: var(--foreground); cursor: pointer; }
  .sk-mini button.danger { color: #e5534b; }
  .sk-edit { width: 100%; font: inherit; font-size: 13px; padding: 3px 6px; border-radius: 7px; border: 1px solid var(--accent); background: var(--background); color: var(--foreground); box-sizing: border-box; }
  .sk-empty { text-align: center; padding: 34px 16px; border: 1px dashed var(--border); border-radius: 12px; color: var(--muted); }
  .sk-empty b { display: block; color: var(--foreground); font-size: 15px; margin-bottom: 4px; }
  .sk-search { display: flex; gap: 8px; margin-top: 8px; }
  .sk-search input { flex: 1; min-width: 0; }
  .sk-hint { font-size: 12px; margin-top: 6px; min-height: 16px; } .sk-hint.err { color: #e5534b; }
  .sk-found { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding: 10px; border-radius: 10px; background: var(--surface-raised); border: 1px solid var(--border); }
  .sk-banner { border: 1px solid #b7791f; background: color-mix(in srgb, #b7791f 14%, transparent); border-radius: 10px; padding: 10px 12px; font-size: 13px; margin-bottom: 14px; }
  `;
  document.head.appendChild(css);

  const S = {
    items: [], current: null, capes: [], signedIn: false, loaded: false,
    sel: null, wornKey: "def", cape: null, capeWorn: null,
    anim: "none", layers: { hat: true, jacket: true, sleeves: true, pants: true }, elytra: false, rot: true,
    preview: null, editing: null, delConfirm: null, status: null,
  };
  const WORN_KEY = "omniscient.skinWorn";
  const readWorn = () => { try { return JSON.parse(localStorage.getItem(WORN_KEY) || "null"); } catch { return null; } };
  const writeWorn = (v) => { try { localStorage.setItem(WORN_KEY, JSON.stringify(v)); } catch { /* sans stockage */ } };

  const curItem = () => (S.current ? { id: "cur", name: T("Skin actuel", "Current skin"), dataUrl: S.current.dataUrl, model: S.current.model } : null);
  const defItem = () => ({ id: "def", name: T("Skin par défaut", "Default skin"), dataUrl: DEFAULT_URL, model: "classic" });
  const find = (id) => (id === "cur" ? curItem() : id === "def" ? defItem() : S.items.find((w) => w.id === id));
  const cards = () => {
    const list = [];
    if (S.wornKey === "cur" && S.current) list.push(curItem());
    if (!S.current || !S.signedIn) list.push(defItem());
    return list.concat(S.items);
  };

  async function load() {
    const r = await window.mchub.skins.list();
    if (!r || !r.ok) { S.status = { text: errText(r), err: true }; return; }
    S.items = r.items; S.current = r.current; S.capes = r.capes; S.signedIn = r.signedIn; S.loaded = true;
    const stored = readWorn();
    const matched = r.current && stored && stored.url === r.current.url ? r.items.find((w) => w.id === stored.id) : null;
    S.wornKey = matched ? matched.id : r.current ? "cur" : "def";
    const activeCape = r.capes.find((c) => c.active);
    S.capeWorn = activeCape ? activeCape.id : null;
    if (!S.preview) { if (!find(S.sel)) S.sel = S.wornKey; if (S.cape === undefined || !S.cape || !S.capes.find((c) => c.id === S.cape)) S.cape = S.capeWorn; }
  }

  // ---------- 3D ----------
  let lib = null, viewer = null, canvas = null, stage = null, io = null;
  function loadLib() {
    // Script classique (pas de module : file:// les bloque selon le contexte), chargé seulement quand on ouvre la page.
    return (lib ||= new Promise((resolve, reject) => {
      if (window.__skinview3d) return resolve(window.__skinview3d);
      const sc = document.createElement("script"); sc.src = "vendor/skinview3d.js";
      sc.onload = () => (window.__skinview3d ? resolve(window.__skinview3d) : reject(new Error("skinview3d")));
      sc.onerror = () => { lib = null; reject(new Error("skinview3d")); };
      document.head.appendChild(sc);
    }));
  }
  const ANIMS = () => [["none", T("Immobile", "Still")], ["idle", T("Respire", "Idle")], ["walk", T("Marche", "Walk")], ["run", T("Course", "Run")], ["wave", T("Salue", "Wave")], ["fly", T("Vol", "Fly")], ["crouch", T("Accroupi", "Crouch")]];
  function shown() {
    if (S.preview) return { url: S.preview.dataUrl, model: S.preview.model, capeUrl: S.preview.capeDataUrl || null };
    const it = find(S.sel) || defItem();
    const cape = S.capes.find((c) => c.id === S.cape);
    return { url: it.dataUrl, model: it.model, capeUrl: cape ? cape.dataUrl : null };
  }
  async function syncViewer() {
    try {
      const L = await loadLib();
      if (!stage || !stage.isConnected) return;
      if (!viewer) {
        canvas = document.createElement("canvas");
        viewer = new L.SkinViewer({ canvas, width: 300, height: 360, zoom: 0.62 });
        viewer.globalLight.intensity = 2.2; viewer.cameraLight.intensity = 1;
      }
      if (canvas.parentNode !== stage) stage.appendChild(canvas);
      stage.querySelector(".sk-load")?.remove();
      if (io) io.disconnect();
      io = new IntersectionObserver((es) => { if (viewer) viewer.renderPaused = !es[es.length - 1].isIntersecting; });
      io.observe(stage);
      const a = shown();
      await viewer.loadSkin(a.url, { model: a.model === "slim" ? "slim" : "default" });
      if (a.capeUrl) await viewer.loadCape(a.capeUrl, { backEquipment: S.elytra ? "elytra" : "cape" }); else viewer.resetCape();
      const sk = viewer.playerObject.skin;
      sk.head.outerLayer.visible = S.layers.hat; sk.body.outerLayer.visible = S.layers.jacket;
      sk.leftArm.outerLayer.visible = sk.rightArm.outerLayer.visible = S.layers.sleeves;
      sk.leftLeg.outerLayer.visible = sk.rightLeg.outerLayer.visible = S.layers.pants;
      const C = { idle: L.IdleAnimation, walk: L.WalkingAnimation, run: L.RunningAnimation, wave: L.WaveAnimation, fly: L.FlyingAnimation, crouch: L.CrouchAnimation }[S.anim];
      viewer.animation = C ? new C() : null;
      viewer.autoRotate = S.rot; viewer.autoRotateSpeed = 0.8;
    } catch (e) {
      const el = stage && stage.querySelector(".sk-load");
      if (el) el.textContent = T("La 3D n'est pas disponible sur cet ordinateur. Le reste de la page fonctionne.", "3D isn't available on this computer. The rest of the page still works.");
      else if (stage) { const m = document.createElement("span"); m.className = "sk-load"; m.textContent = T("La 3D n'est pas disponible sur cet ordinateur. Le reste de la page fonctionne.", "3D isn't available on this computer. The rest of the page still works."); stage.appendChild(m); }
    }
  }

  // ---------- Rendu ----------
  const host = () => document.getElementById("sk-host");
  const modelLabel = (m) => (m === "slim" ? T("Bras fins", "Slim arms") : T("Bras épais", "Classic arms"));
  function itemHtml(w) {
    const real = w.id !== "cur" && w.id !== "def";
    const worn = w.id === S.wornKey ? `<span class="sk-badge">${T("Porté", "Worn")}</span>` : "";
    const nm = S.editing === w.id ? `<input class="sk-edit" data-edit="${w.id}" value="${esc(w.name)}" maxlength="32" />` : `<div class="sk-name" title="${esc(w.name)}">${esc(w.name)}</div>`;
    const acts = real ? `<div class="sk-mini"><button data-act="rename" data-id="${w.id}">${T("Nom", "Name")}</button><button data-act="dl" data-id="${w.id}">PNG</button><button class="danger" data-act="del" data-id="${w.id}">${S.delConfirm === w.id ? T("Confirmer ?", "Sure?") : T("Suppr.", "Delete")}</button></div>`
      : w.id === "cur" ? `<div class="sk-mini"><button data-act="keepcur">${T("Garder", "Keep")}</button></div>` : "";
    return `<div class="sk-item ${w.id === S.sel && !S.preview ? "sel" : ""}" data-pick="${w.id}">${worn}${fullSkinHtml(w.dataUrl, 3)}${nm}<div class="sk-meta">${modelLabel(w.model)}</div>${acts}</div>`;
  }
  function wardrobeHtml() {
    if (!S.items.length) return `<div class="sk-empty"><b>${T("Ta garde-robe est vide", "Your wardrobe is empty")}</b>${T("Ajoute un fichier PNG, ou cherche un joueur pour récupérer son skin public. Tes skins restent sur ton PC.", "Add a PNG file, or look up a player to grab their public skin. Your skins stay on your PC.")}</div>${cards().length ? `<div class="sk-wardrobe" style="margin-top:12px;">${cards().map(itemHtml).join("")}</div>` : ""}`;
    return `<div class="sk-wardrobe">${cards().map(itemHtml).join("")}</div>`;
  }
  function previewBox() {
    if (!S.preview) return "";
    const p = S.preview;
    return `<div class="sk-found">${fullSkinHtml(p.dataUrl, 3)}<div style="flex:1;min-width:0;"><div class="sk-name">${esc(p.name)}</div><div class="sk-meta">${modelLabel(p.model)}${p.capeDataUrl ? " · " + T("avec cape", "with cape") : ""}</div></div><div class="sk-mini"><button data-act="keep">${T("Ajouter à ma garde-robe", "Add to my wardrobe")}</button><button data-act="closeprev">✕</button></div></div>`;
  }
  function render() {
    const el = host(); if (!el) return;
    const sel = find(S.sel) || defItem();
    const prof = (typeof currentProfile !== "undefined" && currentProfile && currentProfile.name) || "";
    const stat = S.status ? `<p class="sk-note ${S.status.err ? "err" : ""}" id="sk-status">${esc(S.status.text)}</p>` : `<p class="sk-note" id="sk-status">${T("Clique un skin pour le voir en 3D ; « Porter » l'applique à ton compte Minecraft.", "Click a skin to see it in 3D; “Wear” applies it to your Minecraft account.")}</p>`;
    const editable = sel.id !== "cur" && sel.id !== "def" && !S.preview;
    el.innerHTML = `
      <div class="sk-head"><h3 style="margin:0;font-size:17px;">${T("Mon skin", "My skin")}</h3><span class="sk-sub" style="margin:0">${esc(prof)}</span></div>
      <p class="sk-sub">${T("Ton skin, ta cape et ta garde-robe. Tout est dessiné par le launcher, sans site tiers.", "Your skin, cape and wardrobe. Everything is drawn by the launcher, no third-party site.")}</p>
      ${S.signedIn ? "" : `<div class="sk-banner">${T("Tu n'es pas connecté. Tu peux essayer des skins en 3D, mais il faut te connecter avec Microsoft pour en porter un.", "You're not signed in. You can try skins in 3D, but you need to sign in with Microsoft to wear one.")}</div>`}
      <div class="sk-grid">
        <div class="sk-card">
          <div class="sk-stage" id="sk-stage"><span class="sk-tag ${S.preview ? "prev" : ""}">${S.preview ? T("Aperçu : ", "Preview: ") + esc(S.preview.name) : (S.sel === S.wornKey ? T("Skin porté", "Worn skin") : T("Essai (pas encore porté)", "Trying (not worn yet)"))}</span><span class="sk-load">${T("Chargement de la 3D…", "Loading 3D…")}</span></div>
          <div class="sk-row">${ANIMS().map(([k, l]) => `<button class="sk-chip ${S.anim === k ? "on" : ""}" data-anim="${k}" type="button">${l}</button>`).join("")}</div>
          <div class="sk-checks">
            <label><input type="checkbox" data-layer="hat" ${S.layers.hat ? "checked" : ""}> ${T("Chapeau", "Hat")}</label>
            <label><input type="checkbox" data-layer="jacket" ${S.layers.jacket ? "checked" : ""}> ${T("Veste", "Jacket")}</label>
            <label><input type="checkbox" data-layer="sleeves" ${S.layers.sleeves ? "checked" : ""}> ${T("Manches", "Sleeves")}</label>
            <label><input type="checkbox" data-layer="pants" ${S.layers.pants ? "checked" : ""}> ${T("Pantalon", "Pants")}</label>
            <label><input type="checkbox" id="sk-rot" ${S.rot ? "checked" : ""}> ${T("Rotation auto", "Auto-rotate")}</label>
          </div>
          <div class="sk-label">${T("Cape", "Cape")}</div>
          ${S.capes.length ? `<select class="settings-input sk-select" id="sk-cape"><option value="">${T("Aucune cape", "No cape")}</option>${S.capes.map((c) => `<option value="${esc(c.id)}" ${S.cape === c.id ? "selected" : ""}>${esc(c.name)}${c.id === S.capeWorn ? " · " + T("portée", "worn") : ""}</option>`).join("")}</select>
          <div class="sk-checks"><label><input type="checkbox" id="sk-elytra" ${S.elytra ? "checked" : ""}> ${T("Voir en élytres (aperçu)", "Show as elytra (preview)")}</label></div>` : `<p class="sk-note" style="margin-top:6px;">${T("Tu ne possèdes aucune cape. Les capes officielles s'obtiennent chez Mojang ; le launcher ne peut pas en donner.", "You don't own any cape. Official capes come from Mojang; the launcher can't give any.")}</p>`}
        </div>
        <div>
          <div class="sk-card" style="margin-bottom:16px;">
            <h3>${T("Ma garde-robe", "My wardrobe")} <span style="color:var(--muted);font-weight:400;">· ${S.items.length}</span></h3>
            <div class="sk-top"><button class="join-btn" data-act="add" type="button">+ ${T("Ajouter un skin (PNG)", "Add a skin (PNG)")}</button><span class="grow"></span>
              <div class="account-variant-row" style="margin:0;"><label><input type="radio" name="sk-model" value="classic" ${sel.model !== "slim" ? "checked" : ""} ${editable ? "" : "disabled"}> ${T("Bras épais", "Classic")}</label><label><input type="radio" name="sk-model" value="slim" ${sel.model === "slim" ? "checked" : ""} ${editable ? "" : "disabled"}> ${T("Bras fins", "Slim")}</label></div></div>
            ${wardrobeHtml()}
            <div class="sk-actions">
              <button class="join-btn" data-act="apply" type="button">${S.preview ? T("Copier dans ma garde-robe", "Copy to my wardrobe") : T("Porter ce skin", "Wear this skin")}</button>
              <button class="btn-secondary" data-act="reset" type="button">${T("Skin par défaut", "Default skin")}</button>
            </div>
            ${stat}
          </div>
          <div class="sk-card">
            <h3>${T("Voir le skin d'un joueur", "Look up a player's skin")}</h3>
            <div class="sk-search"><input class="settings-input" id="sk-q" placeholder="${T("Pseudo ou UUID", "Name or UUID")}" maxlength="36" /><button class="btn-secondary" id="sk-go" type="button">${T("Chercher", "Search")}</button></div>
            <div class="sk-hint" id="sk-hint"></div>
            ${previewBox()}
            <p class="sk-note">${T("Les skins sont publics chez Mojang : on peut les voir et les copier chez soi, jamais modifier le compte d'un autre joueur.", "Skins are public at Mojang: you can view and copy them to your own wardrobe, never change another player's account.")}</p>
          </div>
        </div>
      </div>`;
    stage = document.getElementById("sk-stage");
    if (canvas && canvas.parentNode !== stage) { stage.querySelector(".sk-load")?.remove(); stage.appendChild(canvas); }
    syncViewer();
  }
  const say = (text, err) => { S.status = { text, err: !!err }; const s = document.getElementById("sk-status"); if (s) { s.textContent = text; s.classList.toggle("err", !!err); } };
  async function reloadRender() { await load(); render(); }

  async function copyToWardrobe(name, dataUrl, model) {
    const r = await window.mchub.skins.addData({ name, dataUrl, model });
    if (!r.ok) { say(errText(r), true); return null; }
    return r.item;
  }
  async function applyNow() {
    if (S.preview) {
      const p = S.preview; const it = await copyToWardrobe(p.name, p.dataUrl, p.model); if (!it) return;
      S.sel = it.id; S.preview = null; await reloadRender(); say(T("Skin copié dans ta garde-robe. Clique « Porter ce skin » pour l'appliquer.", "Skin copied to your wardrobe. Click “Wear this skin” to apply it.")); return;
    }
    if (!S.signedIn) { say(ERR.NOT_SIGNED_IN(), true); toast(ERR.NOT_SIGNED_IN()); return; }
    const it = find(S.sel); if (!it) return;
    const skinChange = S.sel !== S.wornKey; const capeChange = S.cape !== S.capeWorn;
    if (!skinChange && !capeChange) { say(T("Ce skin et cette cape sont déjà portés.", "This skin and cape are already worn.")); return; }
    say(T("Envoi à Minecraft…", "Sending to Minecraft…"));
    document.querySelectorAll("#sk-host [data-act=apply]").forEach((b) => (b.disabled = true));
    try {
      if (skinChange) {
        if (it.id === "def") { const r = await window.mchub.skins.reset(); if (!r.ok) return say(errText(r), true); renderAccountHeader(r.profile, {}); writeWorn(null); }
        else if (it.id === "cur") { /* déjà sur le compte */ }
        else { const r = await window.mchub.skins.apply({ id: it.id, model: it.model }); if (!r.ok) return say(errText(r), true); renderAccountHeader(r.profile, {}); const sk = (r.profile.skins || []).find((s) => s.state === "ACTIVE"); writeWorn(sk ? { id: it.id, url: String(sk.url) } : null); }
      }
      if (capeChange) { const r = await window.mchub.skins.setCape({ capeId: S.cape }); if (!r.ok) return say(errText(r), true); renderAccountHeader(r.profile, {}); }
      S.status = null; await reloadRender(); toast(T("Skin et cape mis à jour.", "Skin and cape updated.")); say(T("Appliqué à ton compte Minecraft.", "Applied to your Minecraft account."));
    } finally { document.querySelectorAll("#sk-host [data-act=apply]").forEach((b) => (b.disabled = false)); }
  }
  async function search() {
    const input = document.getElementById("sk-q"); const h = document.getElementById("sk-hint"); const q = (input.value || "").trim();
    h.className = "sk-hint";
    if (!q) { h.textContent = T("Écris un pseudo.", "Type a name."); return; }
    h.textContent = T("Recherche…", "Searching…");
    const r = await window.mchub.skins.lookup({ query: q });
    if (!r.ok) { h.className = "sk-hint err"; h.textContent = errText(r); return; }
    S.preview = r; render(); const hh = document.getElementById("sk-hint"); if (hh) hh.textContent = T("Aperçu en 3D. Rien n'est changé sur ton compte.", "3D preview. Nothing is changed on your account.");
  }

  function wire(el) {
    el.addEventListener("click", async (e) => {
      const t = e.target;
      const anim = t.closest("[data-anim]"); if (anim) { S.anim = anim.dataset.anim; el.querySelectorAll("[data-anim]").forEach((b) => b.classList.toggle("on", b === anim)); syncViewer(); return; }
      const act = t.closest("[data-act]");
      if (act) {
        const a = act.dataset.act, id = act.dataset.id;
        if (a === "add") { const r = await window.mchub.skins.pick({ title: T("Choisir un skin (PNG)", "Choose a skin (PNG)") }); if (r.canceled) return; if (!r.ok) return say(errText(r), true); S.sel = r.item.id; S.preview = null; await reloadRender(); say(T("Skin vérifié et ajouté à ta garde-robe (sur ton PC).", "Skin checked and added to your wardrobe (on your PC).")); return; }
        if (a === "rename") { S.editing = id; render(); const i = el.querySelector("[data-edit]"); if (i) { i.focus(); i.select(); } return; }
        if (a === "dl") { const r = await window.mchub.skins.save({ id, title: T("Enregistrer le skin", "Save the skin") }); if (r.ok && !r.canceled) toast(T("Skin enregistré.", "Skin saved.")); else if (!r.ok) say(errText(r), true); return; }
        if (a === "del") { if (S.delConfirm !== id) { S.delConfirm = id; render(); return; } S.delConfirm = null; await window.mchub.skins.remove({ id }); if (S.sel === id) S.sel = null; await reloadRender(); say(T("Skin supprimé de ta garde-robe (le skin porté sur ton compte ne change pas).", "Skin removed from your wardrobe (the skin worn on your account doesn't change).")); return; }
        if (a === "keepcur") { const it = await copyToWardrobe(T("Mon skin", "My skin"), S.current.dataUrl, S.current.model); if (!it) return; const sk = S.current; writeWorn({ id: it.id, url: sk.url }); S.sel = it.id; await reloadRender(); say(T("Skin actuel gardé dans ta garde-robe.", "Current skin kept in your wardrobe.")); return; }
        if (a === "keep") { const p = S.preview; const it = await copyToWardrobe(p.name, p.dataUrl, p.model); if (!it) return; S.sel = it.id; S.preview = null; await reloadRender(); say(T(`Skin de ${p.name} ajouté à ta garde-robe. Sa cape n'est pas copiée (elle appartient à son compte).`, `${p.name}'s skin added to your wardrobe. Their cape isn't copied (it belongs to their account).`)); return; }
        if (a === "closeprev") { S.preview = null; render(); return; }
        if (a === "apply") return applyNow();
        if (a === "reset") {
          if (!S.signedIn) { say(ERR.NOT_SIGNED_IN(), true); return; }
          const r = await window.mchub.skins.reset(); if (!r.ok) return say(errText(r), true);
          renderAccountHeader(r.profile, {}); writeWorn(null); S.sel = null; S.preview = null; await reloadRender(); say(T("Skin par défaut remis.", "Default skin restored.")); toast(T("Skin réinitialisé.", "Skin reset.")); return;
        }
      }
      if (t.closest("#sk-go")) return search();
      const pick = t.closest("[data-pick]"); if (pick && !t.closest("button") && !t.closest("input")) { S.sel = pick.dataset.pick; S.preview = null; S.delConfirm = null; render(); }
    });
    el.addEventListener("change", async (e) => {
      const t = e.target;
      if (t.dataset.layer) { S.layers[t.dataset.layer] = t.checked; syncViewer(); }
      else if (t.id === "sk-rot") { S.rot = t.checked; syncViewer(); }
      else if (t.id === "sk-elytra") { S.elytra = t.checked; syncViewer(); }
      else if (t.id === "sk-cape") { S.cape = t.value || null; syncViewer(); }
      else if (t.name === "sk-model") { const w = find(S.sel); if (w && w.id !== "cur" && w.id !== "def") { await window.mchub.skins.update({ id: w.id, model: t.value }); w.model = t.value; } render(); }
      else if (t.dataset.edit) { const w = find(t.dataset.edit); const name = t.value.trim().slice(0, 32); S.editing = null; if (w && name) { await window.mchub.skins.update({ id: w.id, name }); w.name = name; } render(); }
    });
    el.addEventListener("keydown", (e) => { if (e.target.id === "sk-q" && e.key === "Enter") search(); if (e.target.dataset && e.target.dataset.edit && e.key === "Enter") e.target.blur(); });
  }

  // ---------- Branchement : « Mon compte » reste au même endroit, seul le bloc skin est remplacé ----------
  const origRender = renderAccountPanel;
  renderAccountPanel = async function () {
    await origRender();
    const el = document.getElementById("account-panel");
    const h2s = el.querySelectorAll("h2");
    if (h2s.length < 2) return;
    const nodes = [];
    for (let n = h2s[0].nextElementSibling; n && n !== h2s[1]; n = n.nextElementSibling) nodes.push(n);
    nodes.forEach((n) => n.remove());
    const h = document.createElement("div"); h.id = "sk-host"; h.style.marginBottom = "8px"; h2s[0].after(h);
    stage = null; wire(h); S.status = null; S.preview = null;
    h.innerHTML = `<p class="sk-note">${T("Chargement…", "Loading…")}</p>`;
    await load();
    if (document.getElementById("sk-host") === h) render();
  };
})();
