// RAM par pack (01/11, preview validée par Rushi, Laboratoire « packRam »).
// Chaque installation garde son réglage : « auto » (calculé : nombre de mods, version, shaders, RAM
// conseillée par le fichier du pack, RAM du PC), « global » (la valeur de Paramètres › Mémoire) ou
// « custom » (une valeur choisie). La même formule est recopiée dans play.js (fenêtres).
const os = require("node:os");

const MODES = ["auto", "global", "custom"];
const cmpMc = (a, b) => String(a || "").localeCompare(String(b || ""), "en", { numeric: true });
const intGB = (x) => {
  const n = Math.round(Number(x));
  return Number.isFinite(n) && n >= 1 && n <= 64 ? n : null;
};
const totalGB = () => Math.max(1, Math.round(os.totalmem() / 1024 ** 3));
const freeGB = () => Math.max(0, Math.floor(os.freemem() / 1024 ** 3));

// Ce dont le pack a besoin, en Go.
function needGB({ mods = 0, mc = "", shaders = false, packGB = null } = {}) {
  let n = !mods ? (cmpMc(mc, "1.18") >= 0 ? 3 : 2) : mods <= 40 ? 4 : mods <= 120 ? 6 : mods <= 220 ? 8 : 10;
  if (shaders) n += 1;
  const p = intGB(packGB);
  if (p) n = Math.max(n, Math.min(p, 32));
  return n;
}
// Maximum sûr : au moins 4 Go pour Windows, et jamais plus des 3/4 du PC.
const safeMaxGB = (total = totalGB()) => Math.max(2, Math.min(total - 4, Math.floor(total * 0.75)));
const autoGB = (ctx, total = totalGB()) => Math.max(1, Math.min(needGB(ctx), safeMaxGB(total)));

// Réglage reçu de la fenêtre ou lu dans play.json : toujours nettoyé.
function cleanRam(r) {
  if (!r || typeof r !== "object") return null;
  const mode = MODES.includes(r.mode) ? r.mode : "auto";
  const gb = intGB(r.gb);
  const packGB = intGB(r.packGB);
  return { mode, ...(mode === "custom" ? { gb: gb || 4 } : {}), ...(packGB ? { packGB } : {}) };
}

// Ce qu'il faut savoir d'une installation pour le calcul.
function ctxOf(v) {
  const mods = v?.pack ? (Array.isArray(v.mods) ? v.mods.filter((m) => m.on !== false).length : (v.files || []).length) : 0;
  const shaders = Array.isArray(v?.mods) && v.mods.some((m) => m.on !== false && /\b(iris|oculus)\b/i.test(`${m.name || ""} ${m.id || ""}`));
  return { mods, mc: v?.minecraftVersion || "", shaders, packGB: v?.ram?.packGB || null };
}

// RAM (Go) pour lancer cette installation. `settingsGB` : Paramètres › Mémoire.
function resolveGB(v, settingsGB) {
  const r = cleanRam(v?.ram) || { mode: "auto" };
  if (r.mode === "global") return Number(settingsGB) || 4;
  if (r.mode === "custom") return r.gb;
  return autoGB(ctxOf(v));
}

module.exports = { MODES, needGB, safeMaxGB, autoGB, cleanRam, ctxOf, resolveGB, totalGB, freeGB, intGB };
