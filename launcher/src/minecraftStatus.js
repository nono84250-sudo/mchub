// Mojang a retire son ancienne API de statut (status.mojang.com/check) en
// 2022 et n'en a jamais republie d'equivalente. Plutot que de s'appuyer sur
// un agregateur tiers non officiel (peu fiable, souvent derriere Cloudflare),
// on teste directement les services dont CE launcher a reellement besoin
// pour se connecter et jouer — un statut honnete ("est-ce que MON launcher
// peut fonctionner maintenant"), pas un statut marketing.

const REQUEST_TIMEOUT_MS = 6000;
const DEGRADED_THRESHOLD_MS = 1500;

const SERVICES = [
  {
    id: "microsoft",
    name: "Connexion Microsoft",
    // Point de metadonnees public d'OpenID Connect : toujours accessible
    // sans identifiants, reponse rapide si le service d'authentification
    // fonctionne.
    url: "https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration",
    method: "GET",
  },
  {
    id: "xboxlive",
    name: "Xbox Live",
    // N'accepte que POST avec un vrai jeton — on verifie juste que le
    // service repond (meme une erreur 4xx prouve qu'il est en ligne),
    // pas qu'on peut s'authentifier.
    url: "https://user.auth.xboxlive.com/user/authenticate",
    method: "GET",
  },
  {
    id: "xsts",
    name: "Xbox Live (XSTS)",
    url: "https://xsts.auth.xboxlive.com/xsts/authorize",
    method: "GET",
  },
  {
    id: "minecraftServices",
    name: "API Minecraft",
    // Sans jeton, renvoie 401 rapidement si l'API fonctionne.
    url: "https://api.minecraftservices.com/minecraft/profile",
    method: "GET",
  },
  {
    id: "textures",
    name: "Skins & textures",
    url: "https://textures.minecraft.net/",
    method: "HEAD",
  },
];

async function checkOne(service) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    await fetch(service.url, { method: service.method, signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    // Le code de statut HTTP importe peu ici (401/403/405 sont attendus sur
    // ces endpoints sans identifiants) : recevoir une reponse du tout prouve
    // que le service est joignable. Seule la latence distingue "ok" de
    // "degrade".
    return { id: service.id, name: service.name, state: latencyMs > DEGRADED_THRESHOLD_MS ? "degraded" : "ok", latencyMs };
  } catch {
    return { id: service.id, name: service.name, state: "offline", latencyMs: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkMinecraftStatus() {
  return Promise.all(SERVICES.map(checkOne));
}

module.exports = { checkMinecraftStatus };
