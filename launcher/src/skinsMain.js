// Page « Mon compte » > Skins : garde-robe sur le PC, skins publics d'un joueur, capes du compte.
// Principe de lanterne-skins (https://github.com/nono84250-sudo/lanterne-skins, MIT) : seulement
// l'API officielle de Mojang, jamais de site tiers, images vérifiées, jeton jamais journalisé.
// Le renderer ne fait aucun accès réseau : tout passe par ces handlers.
const { app, ipcMain, dialog, BrowserWindow } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const MC = "https://api.minecraftservices.com";
const TEXTURE_HOST = "textures.minecraft.net";
const MAX_SKIN_BYTES = 100 * 1024;
const MAX_WARDROBE = 60;
const ID_RE = /^[a-f0-9]{16}$/;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngInfo(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) return { code: "SKIN_INVALID_FORMAT" };
  if (buf.length > MAX_SKIN_BYTES) return { code: "SKIN_TOO_LARGE" };
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (!((w === 64 && h === 64) || (w === 64 && h === 32))) return { code: "SKIN_INVALID_SIZE" };
  return { w, h };
}
const toDataUrl = (buf) => "data:image/png;base64," + buf.toString("base64");
const timeout = () => AbortSignal.timeout(15_000);

function register({ getSession, setSession }) {
  const dir = () => path.join(app.getPath("userData"), "skins-wardrobe");
  const indexFile = () => path.join(dir(), "index.json");
  const textureCache = new Map();

  async function readIndex() {
    try {
      const list = JSON.parse(await fsp.readFile(indexFile(), "utf8"));
      return Array.isArray(list) ? list.filter((e) => e && ID_RE.test(e.id)) : [];
    } catch {
      return [];
    }
  }
  async function writeIndex(list) {
    await fsp.mkdir(dir(), { recursive: true });
    const tmp = indexFile() + ".tmp";
    await fsp.writeFile(tmp, JSON.stringify(list, null, 1));
    await fsp.rename(tmp, indexFile());
  }
  const fileOf = (id) => path.join(dir(), id + ".png");
  const cleanName = (n) => String(n || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 32);

  async function addToWardrobe(buf, name, model) {
    const info = pngInfo(buf);
    if (info.code) return { ok: false, code: info.code };
    const list = await readIndex();
    if (list.length >= MAX_WARDROBE) return { ok: false, code: "WARDROBE_FULL" };
    const id = crypto.randomBytes(8).toString("hex");
    await fsp.mkdir(dir(), { recursive: true });
    await fsp.writeFile(fileOf(id), buf);
    const item = { id, name: cleanName(name) || "Skin", model: model === "slim" ? "slim" : "classic", added: Date.now() };
    list.unshift(item);
    await writeIndex(list);
    return { ok: true, item: { ...item, dataUrl: toDataUrl(buf) } };
  }

  // Image officielle de textures.minecraft.net (un même lien ne change jamais : gardée en mémoire).
  async function fetchTexture(url, maxBytes = MAX_SKIN_BYTES) {
    let u;
    try { u = new URL(String(url).replace(/^http:/, "https:")); } catch { return null; }
    if (u.protocol !== "https:" || u.hostname !== TEXTURE_HOST) return null;
    if (textureCache.has(u.href)) return textureCache.get(u.href);
    const res = await fetch(u.href, { signal: timeout() });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
    const dataUrl = toDataUrl(buf);
    if (textureCache.size > 200) textureCache.clear();
    textureCache.set(u.href, dataUrl);
    return dataUrl;
  }

  const auth = () => {
    const s = getSession();
    return s ? { Authorization: `Bearer ${s.authorization.access_token}` } : null;
  };
  async function mojangError(res) {
    if (res.status === 429) return { ok: false, code: "RATE_LIMITED" };
    if (res.status >= 500) return { ok: false, code: "MOJANG_UNAVAILABLE" };
    const data = await res.json().catch(() => ({}));
    return { ok: false, code: "MOJANG_REJECTED", message: data.errorMessage || `(${res.status})` };
  }
  async function takeProfile(res) {
    let profile = null;
    try { profile = await res.json(); } catch { /* corps vide */ }
    if (!profile || !profile.id) {
      const r = await fetch(`${MC}/minecraft/profile`, { headers: auth(), signal: timeout() });
      if (r.ok) profile = await r.json();
    }
    if (profile && profile.id) setSession(profile, getSession().authorization);
    return profile;
  }
  const guard = (fn) => async (event, arg) => {
    try { return await fn(event, arg || {}); } catch (error) {
      return { ok: false, code: error && error.name === "TimeoutError" ? "MOJANG_UNAVAILABLE" : "INTERNAL", message: error instanceof Error ? error.message : "" };
    }
  };

  ipcMain.handle("skins:list", guard(async () => {
    const items = [];
    for (const e of await readIndex()) {
      try { items.push({ ...e, dataUrl: toDataUrl(await fsp.readFile(fileOf(e.id))) }); } catch { /* fichier disparu */ }
    }
    const session = getSession();
    let current = null;
    let capes = [];
    if (session) {
      const skin = (session.profile.skins || []).find((s) => s.state === "ACTIVE") || (session.profile.skins || [])[0];
      if (skin && skin.url) {
        const dataUrl = await fetchTexture(skin.url).catch(() => null);
        if (dataUrl) current = { url: String(skin.url), model: String(skin.variant).toUpperCase() === "SLIM" ? "slim" : "classic", dataUrl };
      }
      for (const c of session.profile.capes || []) {
        const dataUrl = c.url ? await fetchTexture(c.url, 64 * 1024).catch(() => null) : null;
        capes.push({ id: String(c.id), name: String(c.alias || "Cape"), active: c.state === "ACTIVE", dataUrl });
      }
    }
    return { ok: true, signedIn: !!session, items, current, capes };
  }));

  ipcMain.handle("skins:pick", guard(async (event, { title }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const r = await dialog.showOpenDialog(win, { title: String(title || "Skin"), filters: [{ name: "PNG", extensions: ["png"] }], properties: ["openFile"] });
    if (r.canceled || !r.filePaths[0]) return { ok: true, canceled: true };
    const file = r.filePaths[0];
    const st = await fsp.stat(file);
    if (st.size > MAX_SKIN_BYTES) return { ok: false, code: "SKIN_TOO_LARGE" };
    return addToWardrobe(await fsp.readFile(file), path.basename(file, path.extname(file)), "classic");
  }));

  ipcMain.handle("skins:addData", guard(async (_e, { name, dataUrl, model }) => {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
    if (!m) return { ok: false, code: "SKIN_INVALID_FORMAT" };
    return addToWardrobe(Buffer.from(m[1], "base64"), name, model);
  }));

  ipcMain.handle("skins:remove", guard(async (_e, { id }) => {
    if (!ID_RE.test(String(id))) return { ok: false, code: "NOT_FOUND" };
    await writeIndex((await readIndex()).filter((e) => e.id !== id));
    await fsp.rm(fileOf(id), { force: true });
    return { ok: true };
  }));

  ipcMain.handle("skins:update", guard(async (_e, { id, name, model }) => {
    if (!ID_RE.test(String(id))) return { ok: false, code: "NOT_FOUND" };
    const list = await readIndex();
    const e = list.find((x) => x.id === id);
    if (!e) return { ok: false, code: "NOT_FOUND" };
    if (name !== undefined && cleanName(name)) e.name = cleanName(name);
    if (model === "slim" || model === "classic") e.model = model;
    await writeIndex(list);
    return { ok: true };
  }));

  ipcMain.handle("skins:save", guard(async (event, { id, title }) => {
    if (!ID_RE.test(String(id))) return { ok: false, code: "NOT_FOUND" };
    const e = (await readIndex()).find((x) => x.id === id);
    if (!e) return { ok: false, code: "NOT_FOUND" };
    const win = BrowserWindow.fromWebContents(event.sender);
    const r = await dialog.showSaveDialog(win, { title: String(title || "Skin"), defaultPath: path.join(app.getPath("downloads"), `${e.name.replace(/[\\/:*?"<>|]/g, "_")}.png`), filters: [{ name: "PNG", extensions: ["png"] }] });
    if (r.canceled || !r.filePath) return { ok: true, canceled: true };
    await fsp.copyFile(fileOf(id), r.filePath);
    return { ok: true };
  }));

  // Porter un skin de la garde-robe sur le compte Minecraft.
  ipcMain.handle("skins:apply", guard(async (_e, { id, model }) => {
    const headers = auth();
    if (!headers) return { ok: false, code: "NOT_SIGNED_IN" };
    if (!ID_RE.test(String(id))) return { ok: false, code: "NOT_FOUND" };
    const buf = await fsp.readFile(fileOf(id)).catch(() => null);
    if (!buf) return { ok: false, code: "NOT_FOUND" };
    const info = pngInfo(buf);
    if (info.code) return { ok: false, code: info.code };
    const form = new FormData();
    form.append("variant", model === "slim" ? "slim" : "classic");
    form.append("file", new Blob([buf], { type: "image/png" }), "skin.png");
    const res = await fetch(`${MC}/minecraft/profile/skins`, { method: "POST", headers, body: form, signal: timeout() });
    if (!res.ok) return mojangError(res);
    return { ok: true, profile: await takeProfile(res) };
  }));

  ipcMain.handle("skins:reset", guard(async () => {
    const headers = auth();
    if (!headers) return { ok: false, code: "NOT_SIGNED_IN" };
    const res = await fetch(`${MC}/minecraft/profile/skins/active`, { method: "DELETE", headers, signal: timeout() });
    if (!res.ok) return mojangError(res);
    return { ok: true, profile: await takeProfile(res) };
  }));

  // Cape : seulement une cape que le compte possède (null = ne plus en porter).
  ipcMain.handle("skins:setCape", guard(async (_e, { capeId }) => {
    const session = getSession();
    const headers = auth();
    if (!headers) return { ok: false, code: "NOT_SIGNED_IN" };
    let res;
    if (capeId) {
      if (!(session.profile.capes || []).some((c) => String(c.id) === String(capeId))) return { ok: false, code: "CAPE_NOT_OWNED" };
      res = await fetch(`${MC}/minecraft/profile/capes/active`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ capeId: String(capeId) }), signal: timeout() });
    } else {
      res = await fetch(`${MC}/minecraft/profile/capes/active`, { method: "DELETE", headers, signal: timeout() });
    }
    if (!res.ok) return mojangError(res);
    return { ok: true, profile: await takeProfile(res) };
  }));

  // Voir le skin public d'un joueur (lecture seule, sans jeton).
  ipcMain.handle("skins:lookup", guard(async (_e, { query }) => {
    const q = String(query || "").trim();
    let id;
    if (/^[A-Za-z0-9_]{3,16}$/.test(q)) {
      const r = await fetch(`${MC}/minecraft/profile/lookup/name/${encodeURIComponent(q)}`, { signal: timeout() });
      if (r.status === 404 || r.status === 204) return { ok: false, code: "PLAYER_NOT_FOUND" };
      if (!r.ok) return mojangError(r);
      id = String((await r.json()).id || "");
    } else if (/^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(q)) {
      id = q.replace(/-/g, "").toLowerCase();
    } else return { ok: false, code: "INVALID_NAME" };
    if (!/^[0-9a-f]{32}$/i.test(id)) return { ok: false, code: "PLAYER_NOT_FOUND" };
    const r = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`, { signal: timeout() });
    if (r.status === 204 || r.status === 404) return { ok: false, code: "PLAYER_NOT_FOUND" };
    if (!r.ok) return mojangError(r);
    const prof = await r.json();
    const prop = (prof.properties || []).find((p) => p.name === "textures");
    let tex = {};
    try { tex = JSON.parse(Buffer.from(prop ? prop.value : "", "base64").toString("utf8")).textures || {}; } catch { /* sans skin */ }
    if (!tex.SKIN || !tex.SKIN.url) return { ok: false, code: "PLAYER_NOT_FOUND" };
    const dataUrl = await fetchTexture(tex.SKIN.url);
    if (!dataUrl) return { ok: false, code: "MOJANG_UNAVAILABLE" };
    const capeDataUrl = tex.CAPE && tex.CAPE.url ? await fetchTexture(tex.CAPE.url, 64 * 1024).catch(() => null) : null;
    return { ok: true, name: String(prof.name || q).slice(0, 16), model: tex.SKIN.metadata && tex.SKIN.metadata.model === "slim" ? "slim" : "classic", dataUrl, capeDataUrl };
  }));
}

module.exports = { register, pngInfo };
