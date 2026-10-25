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
  let pendingUuid = null;
  let confirmed = false; // vrai dès qu'une réponse du site a été reçue pour le compte actuel
  let timer = null;

  const visible = (id) => state[id]?.visible === true;
  const all = () => state;

  // Repli sans réponse du site : le dernier état reçu pour CE compte, sinon « Pour tous » seulement.
  function useSaved() {
    const backup = saved && typeof saved.features === "object" && saved.uuid === (currentUuid() || null) ? saved.features : FALLBACK;
    if (JSON.stringify(backup) !== JSON.stringify(state)) {
      state = backup;
      onChange?.(state);
    }
  }

  async function refresh() {
    const uuid = currentUuid() || null;
    // Une lecture déjà en cours pour un autre compte (ex. avant la reprise de session) : on attend
    // qu'elle finisse puis on relit pour le bon compte.
    if (pending && pendingUuid === uuid) return pending;
    if (pending) await pending.catch(() => {});
    pendingUuid = uuid;
    confirmed = false;
    pending = (async () => {
      try {
        const data = await fetchJson(`${siteUrl}/api/launcher/features`, { background: true, headers: authHeaders() });
        if (!data || typeof data.features !== "object") return state;
        const next = data.features;
        const changed = JSON.stringify(next) !== JSON.stringify(state);
        state = next;
        saved = { at: Date.now(), uuid, features: next };
        confirmed = uuid === (currentUuid() || null);
        fs.promises.mkdir(cacheDir, { recursive: true }).then(() => fs.promises.writeFile(file, JSON.stringify(saved))).catch(() => {});
        if (changed) {
          log?.(`Laboratoire : ${Object.entries(next).filter(([, f]) => f.visible).map(([id]) => id).join(", ") || "rien"} visible`);
          onChange?.(state);
        }
      } catch (error) {
        log?.(`Laboratoire : lecture impossible (${error instanceof Error ? error.message : error}), dernier état gardé`, "warn");
        useSaved();
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

  // Démarrage (écran de chargement) : droits relus pour le compte, au plus `maxMs`. Trop long :
  // dernier état connu pour ce compte, et la réponse du site mettra le menu à jour en arrivant.
  async function ready(maxMs) {
    const done = await Promise.race([refresh().then(() => true), new Promise((r) => setTimeout(() => r(false), maxMs))]);
    if (!done && !confirmed) useSaved();
    return state;
  }

  return { visible, all, refresh, ready, start };
}

module.exports = { createFeatures };
