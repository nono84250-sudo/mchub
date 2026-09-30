import { timingSafeEqual } from "node:crypto";

// Comparaison en temps constant du secret partage avec le launcher — une
// comparaison de chaine standard (`===`) fuit un signal temporel exploitable
// en theorie sur le nombre de caracteres corrects avant la premiere
// difference. timingSafeEqual exige des buffers de meme longueur, d'ou le
// contrôle de longueur avant l'appel plutôt que de le laisser lever.
export function isAuthorizedLauncherRequest(request: Request): boolean {
  const secret = process.env.LAUNCHER_API_KEY;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const actualBuffer = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

// Verifie QUI joue, pas seulement "c'est un launcher" (ce que fait deja
// isAuthorizedLauncherRequest, toujours requis en plus). Le launcher envoie
// son vrai jeton d'acces Minecraft (Mojang) dans l'en-tete X-Minecraft-Token
// — il le detient deja apres sa connexion Microsoft/Xbox, voir
// launcher/src/msAuth.js. Avant ce controle, les routes /api/launcher/*
// croyaient sur parole le minecraftUuid fourni en parametre : n'importe qui
// connaissant l'UUID d'un autre joueur pouvait lire ses serveurs prives et
// ses notifications (faille IDOR, audit de securite du 2026-09-28).
//
// Mis en cache quelques minutes (le launcher sonde les notifications toutes
// les 30 s, voir REFRESH_INTERVAL_MS dans launcher/src/renderer.js) pour ne
// pas rappeler Mojang a chaque sondage. Echoue TOUJOURS ferme (false) si le
// jeton manque, si Mojang le refuse, ou si Mojang est injoignable — jamais de
// repli sur l'ancien comportement "je te crois sur parole".
const IDENTITY_CACHE_TTL_MS = 5 * 60_000;
type CachedIdentity = { uuid: string; expiresAt: number };
const identityCache = new Map<string, CachedIdentity>();
const MAX_IDENTITY_CACHE_ENTRIES = 10_000;

function normalizeUuid(uuid: string): string {
  return uuid.toLowerCase().replaceAll("-", "");
}

export async function verifyMinecraftIdentity(token: string | null, claimedUuid: string | null): Promise<boolean> {
  if (!token || !claimedUuid) return false;
  const normalizedClaim = normalizeUuid(claimedUuid);

  const cached = identityCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.uuid === normalizedClaim;

  let verifiedUuid: string;
  try {
    const res = await fetch("https://api.minecraftservices.com/minecraft/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const profile: { id?: string } = await res.json();
    if (!profile.id) return false;
    verifiedUuid = normalizeUuid(profile.id);
  } catch {
    return false;
  }

  if (identityCache.size > MAX_IDENTITY_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of identityCache) if (entry.expiresAt <= now) identityCache.delete(key);
  }
  identityCache.set(token, { uuid: verifiedUuid, expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS });

  return verifiedUuid === normalizedClaim;
}
