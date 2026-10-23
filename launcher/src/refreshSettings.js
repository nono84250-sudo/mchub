// Reglages des delais de rafraichissement du launcher (chantier « cache des fiches », 21/10).
// TOUS les delais lies a la charge sur le site sont ici, pour pouvoir les changer en un seul
// endroit. Lu par main.js (require) ET par renderer.js (script charge avant lui dans index.html,
// expose sur window.OMNI_REFRESH). Le site a son propre fichier : site/src/lib/refreshSettings.ts.
//
// IIFE : script classique, comme theme.js (pas de fuite dans le scope global de renderer.js).
(function () {
  const MINUTE = 60_000;
  const settings = Object.freeze({
    // Liste des serveurs : rafraichie automatiquement au plus toutes les 3 min, seulement hors
    // partie et quand la fenetre du launcher est visible. Le site repond « pas de changement »
    // (304) quand rien n'a bouge.
    LIST_REFRESH_MS: 3 * MINUTE,
    // Liste et fiches gardees en memoire (main.js) avant de les redemander au site.
    LIST_CACHE_MS: 3 * MINUTE,
    SERVER_DETAIL_CACHE_MS: 60_000,
    // Presence (amis) : envoyee au lancement du jeu, a sa fermeture, puis toutes les 5 min en
    // jeu ; toutes les minutes hors partie (elle rapporte aussi maintenance et notifications).
    // Le site garde un joueur « en ligne » 7 min (ONLINE_WINDOW_SECONDS cote site) : un ami peut
    // donc encore le voir en ligne jusqu'a ~7 min apres la fermeture (accepte par Rushi).
    PRESENCE_IDLE_MS: MINUTE,
    PRESENCE_PLAYING_MS: 5 * MINUTE,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = settings;
  if (typeof window !== "undefined") window.OMNI_REFRESH = settings;
})();
