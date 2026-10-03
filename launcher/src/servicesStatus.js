// Statut des services dont CE launcher a reellement besoin, regroupes par
// fournisseur (Minecraft, Modrinth, CurseForge). Mojang a retire son ancienne
// API de statut (status.mojang.com/check) en 2022 et n'en a jamais republie
// d'equivalente. Plutot que de s'appuyer sur un agregateur tiers non
// officiel (peu fiable, souvent derriere Cloudflare), on teste directement
// les adresses utilisees pour se connecter, chercher et telecharger — un
// statut honnete ("est-ce que MON launcher peut fonctionner maintenant"),
// pas un statut marketing.

const REQUEST_TIMEOUT_MS = 6000;
const DEGRADED_THRESHOLD_MS = 1500;
// Modrinth exige un User-Agent identifiable, et les CDN derriere Cloudflare
// refusent parfois celui par defaut.
const USER_AGENT = "Omniscient-Launcher (statut des services)";

const GROUPS = [
  {
    id: "minecraft",
    name: "Minecraft",
    services: [
      {
        id: "microsoft",
        // Point de metadonnees public d'OpenID Connect : toujours accessible
        // sans identifiants, reponse rapide si le service d'authentification
        // fonctionne.
        url: "https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration",
        method: "GET",
      },
      {
        id: "xboxlive",
        // N'accepte que POST avec un vrai jeton — on verifie juste que le
        // service repond (meme une erreur 4xx prouve qu'il est en ligne),
        // pas qu'on peut s'authentifier.
        url: "https://user.auth.xboxlive.com/user/authenticate",
        method: "GET",
      },
      { id: "xsts", url: "https://xsts.auth.xboxlive.com/xsts/authorize", method: "GET" },
      {
        id: "minecraftServices",
        // Sans jeton, renvoie 401 rapidement si l'API fonctionne.
        url: "https://api.minecraftservices.com/minecraft/profile",
        method: "GET",
      },
      { id: "textures", url: "https://textures.minecraft.net/", method: "HEAD" },
    ],
  },
  {
    id: "modrinth",
    name: "Modrinth",
    services: [
      { id: "modrinthApi", url: "https://api.modrinth.com/", method: "GET" },
      { id: "modrinthCdn", url: "https://cdn.modrinth.com/", method: "HEAD" },
    ],
  },
  {
    id: "curseforge",
    name: "CurseForge",
    services: [
      // Sans cle, l'API repond quand meme (accueil ou 403) : c'est la
      // joignabilite qui compte, la cle reste sur le site.
      { id: "curseforgeApi", url: "https://api.curseforge.com/", method: "GET" },
      { id: "curseforgeCdn", url: "https://edge.forgecdn.net/", method: "HEAD" },
    ],
  },
];

async function checkOne(service) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(service.url, {
      method: service.method,
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    // Le code de statut HTTP importe peu ici (401/403/404/405 sont attendus sur
    // ces adresses sans identifiants) : recevoir une reponse prouve que le
    // service est joignable. Seule une erreur serveur (5xx, ex. Cloudflare
    // 521/522) le donne pour hors ligne, et la latence distingue "ok" de
    // "degrade".
    if (res.status >= 500) return { id: service.id, state: "offline", latencyMs: null };
    return { id: service.id, state: latencyMs > DEGRADED_THRESHOLD_MS ? "degraded" : "ok", latencyMs };
  } catch {
    return { id: service.id, state: "offline", latencyMs: null };
  } finally {
    clearTimeout(timeout);
  }
}

// [{ id, name, services: [{ id, state: "ok"|"degraded"|"offline", latencyMs }] }]
// — les libelles des services sont dans i18n (serviceStatus.svc.<id>).
async function checkServicesStatus() {
  return Promise.all(
    GROUPS.map(async (group) => ({
      id: group.id,
      name: group.name,
      services: await Promise.all(group.services.map(checkOne)),
    })),
  );
}

// Test de connexion de CE PC (ping, telechargement, envoi). Lance seulement
// a l'ouverture du panneau ou sur "Actualiser", jamais en arriere-plan
// permanent. Donnees envoyees et recues volontairement grosses (100 Mo en
// reception, 25 Mo en envoi) pour mesurer un debit reel ; les octets sont des
// zeros, aucune donnee personnelle n'est transmise.
const SPEED_HOST = "https://speed.cloudflare.com";
const PING_SAMPLES = 3;
const DOWNLOAD_BYTES = 100_000_000;
const UPLOAD_BYTES = 25_000_000;
const CONNECTION_STEP_TIMEOUT_MS = 90_000;

function timedSignal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTION_STEP_TIMEOUT_MS);
  return { signal: controller.signal, done: () => clearTimeout(timeout) };
}

async function measurePing() {
  const samples = [];
  for (let i = 0; i < PING_SAMPLES; i += 1) {
    const { signal, done } = timedSignal();
    const startedAt = performance.now();
    try {
      await fetch(`${SPEED_HOST}/__down?bytes=0`, { headers: { "User-Agent": USER_AGENT }, signal, cache: "no-store" });
      samples.push(performance.now() - startedAt);
    } finally {
      done();
    }
  }
  samples.sort((a, b) => a - b);
  return Math.round(samples[Math.floor(samples.length / 2)]);
}

async function measureDownload(onProgress) {
  const { signal, done } = timedSignal();
  try {
    const res = await fetch(`${SPEED_HOST}/__down?bytes=${DOWNLOAD_BYTES}`, {
      headers: { "User-Agent": USER_AGENT },
      signal,
      cache: "no-store",
    });
    const reader = res.body.getReader();
    let received = 0;
    const startedAt = performance.now();
    for (;;) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      received += value.length;
      onProgress(Math.min(100, Math.round((received / DOWNLOAD_BYTES) * 100)));
    }
    const seconds = (performance.now() - startedAt) / 1000;
    return Math.round(((received * 8) / seconds / 1_000_000) * 10) / 10;
  } finally {
    done();
  }
}

async function measureUpload() {
  const { signal, done } = timedSignal();
  try {
    const body = Buffer.alloc(UPLOAD_BYTES);
    const startedAt = performance.now();
    await fetch(`${SPEED_HOST}/__up`, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/octet-stream" },
      body,
      signal,
      cache: "no-store",
    });
    const seconds = (performance.now() - startedAt) / 1000;
    return Math.round(((UPLOAD_BYTES * 8) / seconds / 1_000_000) * 10) / 10;
  } finally {
    done();
  }
}

// { pingMs, downloadMbps, uploadMbps, fetchedAt } ; une etape en echec donne null.
// onProgress({ phase: "ping" | "download" | "upload", percent }) pour la barre.
async function measureConnection(onProgress) {
  onProgress({ phase: "ping", percent: 0 });
  const pingMs = await measurePing().catch(() => null);
  onProgress({ phase: "download", percent: 0 });
  const downloadMbps = await measureDownload((percent) => onProgress({ phase: "download", percent })).catch(() => null);
  onProgress({ phase: "upload", percent: 0 });
  const uploadMbps = await measureUpload().catch(() => null);
  onProgress({ phase: "upload", percent: 100 });
  return { pingMs, downloadMbps, uploadMbps, fetchedAt: Date.now() };
}

module.exports = { checkServicesStatus, measureConnection };
