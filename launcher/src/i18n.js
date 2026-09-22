// Systeme de traduction du launcher, sur le meme principe que celui du site
// (voir site/src/i18n) : dictionnaire plat en pointilles + interpolation
// {param}, mais en JS simple (pas de build step ici) et persiste via
// settingsStore (settings.locale) plutot qu'un cookie. Seuls le francais et
// l'anglais ont une vraie traduction pour l'instant — les autres langues du
// selecteur (ES/DE/PT) restent affichees mais desactivees, voir LOCALES.
//
// IIFE : ce fichier est charge en <script> classique (pas de type="module"),
// donc tout top-level const/function non enveloppe fuiterait dans le meme
// scope global que renderer.js/theme.js — d'ou la collision "Identifier 't'
// has already been declared" la premiere fois (t() interne ici vs const t
// dans renderer.js) avant l'ajout de ce wrapper.
(function () {

const LOCALES = {
  fr: { label: "Français", enabled: true },
  en: { label: "English (US)", enabled: true },
  es: { label: "Español", enabled: false },
  de: { label: "Deutsch", enabled: false },
  pt: { label: "Português (BR)", enabled: false },
};

const DICTIONARIES = {
  fr: {
    common: {
      checking: "Vérification…",
      cancel: "Annuler",
      addFavorite: "Ajouter aux favoris",
      removeFavorite: "Retirer des favoris",
    },
    titlebar: {
      minimize: "Réduire",
      maximize: "Agrandir",
      close: "Fermer",
      mcStatus: "Minecraft Status",
      notifications: "Notifications",
      noNotifications: "Aucune notification pour le moment.",
    },
    bootstrap: {
      starting: "Démarrage…",
      checkingUpdates: "Vérification des mises à jour…",
      downloadingUpdate: "Téléchargement de la mise à jour {version}…",
      downloadingUpdateProgress: "Téléchargement de la mise à jour… {percent}%",
      updateReady: "Redémarrage pour installer la mise à jour…",
      checkingJava: "Vérification de Java…",
      resumingSession: "Reprise de la session…",
    },
    javaGate: {
      title: "Java requis",
      tagline: "Minecraft a besoin de Java (64 bits) pour se lancer — sans lui, le launcher ne peut pas continuer.",
    },
    java: {
      installAuto: "Installer Java automatiquement",
      detectedWithVersion: "Java détecté ({version}, 64 bits) ✓",
      detectedNoVersion: "Java détecté (64 bits) ✓",
      is32Bit: "Java 32 bits détecté — insuffisant pour allouer beaucoup de mémoire.",
      notFound: "Java introuvable — nécessaire pour lancer Minecraft.",
      installed: "Java {version} installé ✓",
      installFailed: "Échec de l'installation : {error}",
    },
    gate: {
      tagline: "Connecte-toi avec ton compte Microsoft pour voir les serveurs et jouer.",
      loginBtn: "Se connecter avec Microsoft",
      remember: "Se souvenir de moi",
      connecting: "Connexion en cours…",
      pendingApproval: "Connexion Microsoft OK — en attente de validation par Microsoft pour l'accès Minecraft.",
    },
    ramSetup: {
      title: "Mémoire allouée au jeu",
      body: "Choisis combien de RAM le jeu peut utiliser — modifiable plus tard dans les paramètres.",
      minLabel: "Minimale (Go)",
      maxLabel: "Maximale (Go)",
      note: "Cette machine a {total} Go de RAM au total — {min}/{max} Go est une valeur prudente pour commencer.",
      continueBtn: "Continuer",
    },
    nav: {
      servers: "Serveurs",
      favorites: "Favoris",
      recent: "Récents",
      settings: "Paramètres",
    },
    serverList: {
      loading: "Chargement des serveurs…",
      empty: "Aucun serveur publié pour le moment.",
      searchPlaceholder: "Rechercher un serveur…",
      noResults: "Aucun serveur ne correspond à cette recherche.",
      sortRecent: "Plus récents",
      sortPlayers: "Plus de joueurs",
      errorPrefix: "Impossible de contacter le site Omniscient : {error}",
      loadingDetail: "Chargement…",
      errorDetailPrefix: "Impossible de charger ce serveur : {error}",
    },
    serverCard: {
      vanilla: "Vanilla",
      modded: "Moddé",
      statusUnknown: "Statut inconnu",
      playersOnline: { one: "{count} joueur en ligne{capacity}", other: "{count} joueurs en ligne{capacity}" },
    },
    serverDetail: {
      back: "← Retour à la liste",
      version: "Version",
      players: "Joueurs",
      recommendedRam: "RAM recommandée",
      ramUnit: "Go",
      joinBtn: "▶ Rejoindre le serveur",
      joinBtnLaunching: "Lancement…",
      joinBtnLaunched: "Jeu lancé",
      joinNote: "Connecte-toi avec ton compte Microsoft pour rejoindre ce serveur.",
    },
    favorites: {
      empty: "Aucun favori pour l'instant — clique sur l'étoile d'un serveur pour l'ajouter ici.",
    },
    recent: {
      empty: "Aucun serveur joué pour l'instant — les derniers serveurs lancés apparaîtront ici.",
    },
    settings: {
      title: "Paramètres",
      tabAppearance: "Apparence",
      tabLanguage: "Langue",
      tabMemory: "Mémoire",
      tabMisc: "Divers",
      tabDebug: "Débogage",
      version: "Version",
      saveChanges: "Enregistrer les modifications",
      saved: "Paramètres enregistrés.",
      ramAllocation: "Allocation de RAM",
      ramAllocationDesc: "Quantité de mémoire que Minecraft peut utiliser au lancement.",
      memoryMin: "Minimale (Go)",
      memoryMax: "Maximale (Go)",
      ramAvailable: "{used} Go sur {total} Go disponibles sur cette machine.",
      alwaysRecommended: "Toujours lancer avec la RAM recommandée du serveur",
      javaLabel: "Java (64 bits, requis pour jouer)",
      gameFolder: "Dossier du jeu",
      openFolder: "Ouvrir le dossier",
      changeFolder: "Changer d'emplacement",
      launcherVersion: "Version du launcher",
      upToDate: "À jour.",
    },
    appearance: {
      theme: "Thème",
      themeDesc: "Choisis l'apparence du launcher. Système suit le réglage de ton PC.",
      themeSystem: "Système",
      themeDark: "Sombre",
      themeLight: "Clair",
      accentColor: "Couleur d'accent",
      accentColorDesc: "Utilisée pour les boutons, liens et mises en avant dans tout le launcher.",
      compactList: "Liste compacte",
      compactListDesc: "Affiche plus de serveurs à la fois avec des lignes plus petites.",
    },
    language: {
      launcherLanguage: "Langue du launcher",
      restartNote: "Le changement prend effet au redémarrage du launcher.",
      available: "Langues disponibles",
      restartNeeded: "Redémarre le launcher pour appliquer.",
    },
    debug: {
      title: "Débogage",
      subtitle: "Outils pour diagnostiquer les problèmes de lancement.",
      consoleLabel: "Console de débogage",
      consoleDesc: "Journal en direct du launcher et du jeu, avec filtres.",
      openConsole: "Ouvrir la console",
      shortcutHint: "Raccourci : {shortcut}",
    },
    debugConsole: {
      title: "Debug console · Omniscient Launcher",
      all: "Tout",
      launcher: "Launcher",
      game: "Jeu",
      errors: "Erreurs",
      warnings: "Avertissements",
      filterPlaceholder: "Filtrer…",
      pause: "Pause",
      clear: "Effacer",
      copy: "Copier",
      empty: "Aucun journal pour l'instant.",
    },
    account: {
      myAccount: "Mon compte",
      currentSkin: "Skin actuel",
      changeSkinLabel: "Changer de skin (PNG, 64×64)",
      classic: "Classic (Steve)",
      slim: "Slim (Alex)",
      changeSkinBtn: "Changer de skin",
      resetBtn: "Réinitialiser",
      sendingSkin: "Envoi…",
      skinUpdated: "Skin mis à jour.",
      skinReset: "Skin réinitialisé.",
      chooseFileFirst: "Choisis d'abord un fichier PNG.",
      rememberedAccounts: "Comptes mémorisés",
      noAccounts: "Aucun compte mémorisé — coche « Se souvenir de moi » à la connexion.",
      active: "Actif",
      switchBtn: "Basculer",
      switching: "Bascule…",
      forgetBtn: "Oublier",
      addAccountBtn: "+ Ajouter un compte",
      addingAccount: "Connexion…",
      manageAccount: "Gérer le compte",
      signOut: "Se déconnecter",
      sessionNotRemembered: "Session non mémorisée",
    },
    playbar: {
      addFavoritePrompt: "Ajoute un serveur en favoris",
      emptyHint: "Clique sur l'étoile d'un serveur pour l'ajouter ici.",
      lastPlayed: "Dernier joué",
      moreFavorites: "+ de favoris",
      play: "▶ Jouer",
      launchingServer: "Lancement de {name}…",
      launched: "Jeu lancé — fenêtre séparée ouverte.",
    },
    mcStatus: {
      ok: "OK",
      degraded: "Dégradé",
      offline: "Hors ligne",
    },
    modal: {
      ramTooHighTitle: "RAM recommandée trop élevée pour cette machine",
      ramTooHighBody:
        "Ce serveur recommande {recommended} Go de RAM, mais cette machine n'a que {total} Go au total. Le jeu va démarrer avec {fallback} Go à la place (la moitié de la RAM totale) — au-delà, attends-toi à des latences, des bugs ou des plantages.",
      continueAnyway: "Continuer quand même",
      ramRecommendedTitle: "RAM recommandée pour ce serveur",
      ramRecommendedBody: "Ce serveur recommande {recommended} Go de RAM. Lancer le jeu avec cette valeur ?",
      launchWith: "Lancer avec {recommended} Go",
      keepCurrentSettings: "Garder mes paramètres actuels",
    },
  },
  en: {
    common: {
      checking: "Checking…",
      cancel: "Cancel",
      addFavorite: "Add to favorites",
      removeFavorite: "Remove from favorites",
    },
    titlebar: {
      minimize: "Minimize",
      maximize: "Maximize",
      close: "Close",
      mcStatus: "Minecraft Status",
      notifications: "Notifications",
      noNotifications: "No notifications for now.",
    },
    bootstrap: {
      starting: "Starting…",
      checkingUpdates: "Checking for updates…",
      downloadingUpdate: "Downloading update {version}…",
      downloadingUpdateProgress: "Downloading update… {percent}%",
      updateReady: "Restarting to install the update…",
      checkingJava: "Checking Java…",
      resumingSession: "Resuming session…",
    },
    javaGate: {
      title: "Java required",
      tagline: "Minecraft needs Java (64-bit) to launch — without it, the launcher can't continue.",
    },
    java: {
      installAuto: "Install Java automatically",
      detectedWithVersion: "Java detected ({version}, 64-bit) ✓",
      detectedNoVersion: "Java detected (64-bit) ✓",
      is32Bit: "32-bit Java detected — not enough to allocate a lot of memory.",
      notFound: "Java not found — required to launch Minecraft.",
      installed: "Java {version} installed ✓",
      installFailed: "Installation failed: {error}",
    },
    gate: {
      tagline: "Sign in with your Microsoft account to see servers and play.",
      loginBtn: "Sign in with Microsoft",
      remember: "Remember me",
      connecting: "Signing in…",
      pendingApproval: "Microsoft sign-in OK — waiting on Microsoft's approval for Minecraft access.",
    },
    ramSetup: {
      title: "Memory allocated to the game",
      body: "Choose how much RAM the game can use — changeable later in settings.",
      minLabel: "Minimum (GB)",
      maxLabel: "Maximum (GB)",
      note: "This machine has {total} GB of RAM total — {min}/{max} GB is a safe value to start with.",
      continueBtn: "Continue",
    },
    nav: {
      servers: "Servers",
      favorites: "Favorites",
      recent: "Recent",
      settings: "Settings",
    },
    serverList: {
      loading: "Loading servers…",
      empty: "No server published yet.",
      searchPlaceholder: "Search a server…",
      noResults: "No server matches this search.",
      sortRecent: "Most recent",
      sortPlayers: "Most players",
      errorPrefix: "Couldn't reach the Omniscient site: {error}",
      loadingDetail: "Loading…",
      errorDetailPrefix: "Couldn't load this server: {error}",
    },
    serverCard: {
      vanilla: "Vanilla",
      modded: "Modded",
      statusUnknown: "Unknown status",
      playersOnline: { one: "{count} player online{capacity}", other: "{count} players online{capacity}" },
    },
    serverDetail: {
      back: "← Back to list",
      version: "Version",
      players: "Players",
      recommendedRam: "Recommended RAM",
      ramUnit: "GB",
      joinBtn: "▶ Join server",
      joinBtnLaunching: "Launching…",
      joinBtnLaunched: "Game launched",
      joinNote: "Sign in with your Microsoft account to join this server.",
    },
    favorites: {
      empty: "No favorites yet — click a server's star to add it here.",
    },
    recent: {
      empty: "No server played yet — recently launched servers will appear here.",
    },
    settings: {
      title: "Settings",
      tabAppearance: "Appearance",
      tabLanguage: "Language",
      tabMemory: "Memory",
      tabMisc: "Misc",
      tabDebug: "Debug",
      version: "Version",
      saveChanges: "Save changes",
      saved: "Settings saved.",
      ramAllocation: "RAM allocation",
      ramAllocationDesc: "How much memory Minecraft is allowed to use when you launch.",
      memoryMin: "Minimum (GB)",
      memoryMax: "Maximum (GB)",
      ramAvailable: "{used} GB of {total} GB available on this machine.",
      alwaysRecommended: "Always launch with the server's recommended RAM",
      javaLabel: "Java (64-bit, required to play)",
      gameFolder: "Game folder",
      openFolder: "Open folder",
      changeFolder: "Change location",
      launcherVersion: "Launcher version",
      upToDate: "You're up to date.",
    },
    appearance: {
      theme: "Theme",
      themeDesc: "Choose how the launcher looks. System matches your OS setting.",
      themeSystem: "System",
      themeDark: "Dark",
      themeLight: "Light",
      accentColor: "Accent color",
      accentColorDesc: "Used for buttons, links and highlights across the launcher.",
      compactList: "Compact server list",
      compactListDesc: "Show more servers at once with smaller rows.",
    },
    language: {
      launcherLanguage: "Launcher language",
      restartNote: "Changes take effect after restarting the launcher.",
      available: "Available languages",
      restartNeeded: "Restart the launcher to apply.",
    },
    debug: {
      title: "Debug",
      subtitle: "Tools for troubleshooting launch problems.",
      consoleLabel: "Debug console",
      consoleDesc: "Live launcher and game output, with filters.",
      openConsole: "Open console",
      shortcutHint: "Shortcut: {shortcut}",
    },
    debugConsole: {
      title: "Debug console · Omniscient Launcher",
      all: "All",
      launcher: "Launcher",
      game: "Game",
      errors: "Errors",
      warnings: "Warnings",
      filterPlaceholder: "Filter output…",
      pause: "Pause",
      clear: "Clear",
      copy: "Copy",
      empty: "No logs yet.",
    },
    account: {
      myAccount: "My account",
      currentSkin: "Current skin",
      changeSkinLabel: "Change skin (PNG, 64×64)",
      classic: "Classic (Steve)",
      slim: "Slim (Alex)",
      changeSkinBtn: "Change skin",
      resetBtn: "Reset",
      sendingSkin: "Uploading…",
      skinUpdated: "Skin updated.",
      skinReset: "Skin reset.",
      chooseFileFirst: "Choose a PNG file first.",
      rememberedAccounts: "Remembered accounts",
      noAccounts: "No remembered accounts — check “Remember me” when signing in.",
      active: "Active",
      switchBtn: "Switch",
      switching: "Switching…",
      forgetBtn: "Forget",
      addAccountBtn: "+ Add account",
      addingAccount: "Signing in…",
      manageAccount: "Manage account",
      signOut: "Sign out",
      sessionNotRemembered: "Session not remembered",
    },
    playbar: {
      addFavoritePrompt: "Add a server to favorites",
      emptyHint: "Click a server's star to add it here.",
      lastPlayed: "Last played",
      moreFavorites: "+ more favorites",
      play: "▶ Play",
      launchingServer: "Launching {name}…",
      launched: "Game launched — separate window opened.",
    },
    mcStatus: {
      ok: "OK",
      degraded: "Degraded",
      offline: "Offline",
    },
    modal: {
      ramTooHighTitle: "Recommended RAM too high for this machine",
      ramTooHighBody:
        "This server recommends {recommended} GB of RAM, but this machine only has {total} GB total. The game will start with {fallback} GB instead (half the total RAM) — beyond that, expect lag, bugs or crashes.",
      continueAnyway: "Continue anyway",
      ramRecommendedTitle: "Recommended RAM for this server",
      ramRecommendedBody: "This server recommends {recommended} GB of RAM. Launch the game with this value?",
      launchWith: "Launch with {recommended} GB",
      keepCurrentSettings: "Keep my current settings",
    },
  },
};

let currentLocale = "fr";

function setLocale(locale) {
  currentLocale = DICTIONARIES[locale] ? locale : "fr";
}

function getLocale() {
  return currentLocale;
}

function resolve(dict, path) {
  return path.split(".").reduce((node, key) => (node && typeof node === "object" ? node[key] : undefined), dict);
}

function interpolate(text, params) {
  if (!params) return text;
  let out = text;
  for (const [key, value] of Object.entries(params)) {
    out = out.replace(`{${key}}`, String(value));
  }
  return out;
}

// t("serverCard.playersOnline", {count, capacity: "..."}) : si la valeur
// resolue est un objet {one, other}, on choisit avec `params.count`.
function t(path, params) {
  const dict = DICTIONARIES[currentLocale] || DICTIONARIES.fr;
  let value = resolve(dict, path);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const count = params && typeof params.count === "number" ? params.count : 1;
    value = count === 1 ? value.one : value.other;
  }
  if (typeof value !== "string") return path;
  return interpolate(value, params);
}

// Applique le dictionnaire courant a tout le HTML statique (attributs
// data-i18n/-placeholder/-title) — appele une fois au demarrage, avant tout
// rendu dynamique base sur t(). Les langues sans vraie traduction utilisent
// le francais comme repli via DICTIONARIES.fr en cascade dans resolve().
function applyStaticI18n(root) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const value = t(el.getAttribute("data-i18n-title"));
    el.setAttribute("title", value);
    el.setAttribute("aria-label", value);
  });
}

window.i18n = { t, setLocale, getLocale, applyStaticI18n, LOCALES };

})();
