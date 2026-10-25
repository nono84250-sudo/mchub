// Laboratoire (25/10, demande de Rushi) : ce que CE launcher a le droit de montrer, d'après le
// site (/api/launcher/features, calculé pour le joueur connecté et le canal bêta). Le site
// refuse de toute façon les routes d'une fonctionnalité cachée ; ici on évite surtout de
// montrer l'onglet et de démarrer son code.
//
// Gardé sur le disque : hors ligne, on reprend le dernier état reçu. Jamais reçu : seules les
// fonctionnalités déjà ouvertes à tous avant le Laboratoire (amis) sont visibles.
const fs = require("node:fs");
const path = require("node:path");

const FALLBACK = { friends: { visible: true, beta: false } };
const REFRESH_MS = 10 * 60_000;

function createFeatures({ cacheDir, siteUrl, authHeaders, fetchJson, onChange, log }) {
  const file = path.join(cacheDir, "features.json");
  let state = FALLBACK;
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (saved && typeof saved.features === "object") state = saved.features;
  } catch {
    /* premier démarrage : repli */
  }
  let pending = null;
  let timer = null;

  const visible = (id) => state[id]?.visible === true;
  const all = () => state;

  async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      try {
        const data = await fetchJson(`${siteUrl}/api/launcher/features`, { background: true, headers: authHeaders() });
        if (!data || typeof data.features !== "object") return state;
        const next = data.features;
        const changed = JSON.stringify(next) !== JSON.stringify(state);
        state = next;
        if (changed) {
          fs.promises.mkdir(cacheDir, { recursive: true }).then(() => fs.promises.writeFile(file, JSON.stringify({ at: Date.now(), features: next }))).catch(() => {});
          log?.(`Laboratoire : ${Object.entries(next).filter(([, f]) => f.visible).map(([id]) => id).join(", ") || "rien"} visible`);
          onChange?.(state);
        }
      } catch (error) {
        log?.(`Laboratoire : lecture impossible (${error instanceof Error ? error.message : error}), dernier état gardé`, "warn");
      } finally {
        pending = null;
      }
      return state;
    })();
    return pending;
  }

  function start() {
    refresh();
    if (!timer) timer = setInterval(refresh, REFRESH_MS);
  }

  return { visible, all, refresh, start };
}

module.exports = { createFeatures };
