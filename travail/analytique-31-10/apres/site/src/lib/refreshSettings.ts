// Reglages des delais de rafraichissement du site (chantier « cache des fiches », 21/10).
// TOUS les delais lies a la charge sur la base sont ici, pour pouvoir les changer en un seul
// endroit (par exemple les raccourcir quand le site aura plus de budget d'appels Cloudflare).
// Le launcher a son propre bloc de reglages en tete de launcher/src/renderer.js.

// Infos FIXES des fiches (nom, description, images, etiquettes, modpack, team...) : gardees en
// cache au plus 1 h. Ce n'est qu'une securite : chaque modification d'une fiche (proprietaire,
// admin, gel, pause, validation, team...) vide ce cache tout de suite.
export const FIXED_SERVER_INFO_SECONDS = 3600;

// Infos VIVANTES (joueurs en ligne, statut) : UNE lecture pour tous les serveurs, gardee 5 min.
// La tache automatique qui mesure les serveurs (toutes les 5 min) vide ce cache des qu'elle a fini.
export const LIVE_STATUS_SECONDS = 300;

// « Mes instances » du launcher (serveurs d'un proprietaire) : garde par compte.
export const OWNED_SERVERS_SECONDS = 60;

// Liste publique des serveurs (/api/public/servers, lue par le launcher) : duree pendant laquelle
// le CDN de Vercel peut resservir la meme reponse sans appeler le site, puis duree pendant
// laquelle il peut encore la servir en allant chercher la nouvelle en arriere-plan.
// Jamais utilise pour une reponse propre a un joueur.
export const PUBLIC_LIST_CDN_SECONDS = 30;
export const PUBLIC_LIST_CDN_STALE_SECONDS = 30;

// Amis : un joueur est « en ligne » si son launcher a donne signe de vie depuis moins de 7 min.
// En jeu, le launcher n'envoie sa presence que toutes les 5 min (voir renderer.js) : 7 min
// laissent la marge d'un envoi en retard. Consequence acceptee par Rushi : apres la fermeture du
// launcher, un ami peut encore le voir « en ligne » jusqu'a 7 min.
export const ONLINE_WINDOW_SECONDS = 7 * 60;

// Panel Analytique (31/10) : un onglet visible du site envoie un signal par minute ; un visiteur est
// « en ligne » 2 min après son dernier signal, puis sa ligne est effacée.
export const ANALYTICS_PING_SECONDS = 60;
export const ANALYTICS_SITE_WINDOW_SECONDS = 120;
// Le site n'écrit les signaux reçus dans la base qu'une fois toutes les 15 s au plus (par instance) :
// voir lib/analytics.ts, le quota Cloudflare est partagé avec tout le reste.
export const ANALYTICS_FLUSH_SECONDS = 15;
// Page /admin/analytique ouverte et visible : une requête groupée toutes les 30 s.
export const ANALYTICS_ADMIN_REFRESH_SECONDS = 30;
