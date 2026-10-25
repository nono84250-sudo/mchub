// Laboratoire (25/10, demande de Rushi) : ce que CE launcher a le droit de montrer, d'après le
// site (/api/launcher/features, calculé pour le joueur connecté et le canal bêta). Le site
// refuse de toute façon les routes d'une fonctionnalité cachée ; ici on évite surtout de
// montrer l'onglet et de démarrer son code.
//
// Au démarrage, rien n'est visible (sauf les amis, ouverts à tous avant le Laboratoire) tant que
// le site n'a pas répondu. Site injoignable : on reprend le dernier état reçu pour CE compte
// (gardé sur le disque), jamais celui d'un autre compte.
const fs = require("node:fs");
const path = require("node:path");

const FALLBACK = { friends: { visible: true, beta: false } };
const REFRESH_MS = 10 * 60_000;

function createFeatures({ cacheDir, siteUrl, authHeaders, currentUuid, fetchJson, onChange, log }) {
  const file = path.join(cacheDir, "features.json");
  let state = FALLBACK;
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(file, "utf8"));
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
        saved = { at: Date.now(), uuid: currentUuid() || null, features: next };
        fs.promises.mkdir(cacheDir, { recursive: true }).then(() => fs.promises.writeFile(file, JSON.stringify(saved))).catch(() => {});
        if (changed) {
          log?.(`Laboratoire : ${Object.entries(next).filter(([, f]) => f.visible).map(([id]) => id).join(", ") || "rien"} visible`);
          onChange?.(state);
        }
      } catch (error) {
        log?.(`Laboratoire : lecture impossible (${error instanceof Error ? error.message : error}), dernier état gardé`, "warn");
        const backup = saved && typeof saved.features === "object" && saved.uuid === (currentUuid() || null) ? saved.features : FALLBACK;
        if (JSON.stringify(backup) !== JSON.stringify(state)) {
          state = backup;
          onChange?.(state);
        }
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
