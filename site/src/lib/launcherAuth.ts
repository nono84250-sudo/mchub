import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

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
// pas rappeler Mojang a chaque sondage. Seule l'identite CONFIRMEE est mise en
// cache : ni les refus ni les pannes (un hoquet ne doit pas durer 5 min).
const IDENTITY_CACHE_TTL_MS = 5 * 60_000;
type CachedIdentity = { uuid: string; expiresAt: number };
const identityCache = new Map<string, CachedIdentity>();
const MAX_IDENTITY_CACHE_ENTRIES = 10_000;

// Trois issues distinctes, pour que le launcher ne dise pas "Connecte-toi" a un
// joueur dont la connexion est en parfait etat :
//  - "verified"    : Mojang confirme que le jeton appartient a cet UUID.
//  - "refused"     : le jeton manque, Mojang le rejette (401/403), le compte n'a
//                    pas de profil Minecraft (404), ou l'UUID ne correspond pas.
//  - "unavailable" : Mojang ne se prononce pas (timeout, reseau, 429, 5xx...).
export type IdentityCheck = "verified" | "refused" | "unavailable";

// Une requete normale vers Mojang repond en quelques centaines de ms. 5 s laisse
// une grosse marge aux pointes de charge sans bloquer le sondage du launcher
// (toutes les 30 s) ni depasser la limite de duree des fonctions serverless.
const MOJANG_TIMEOUT_MS = 5_000;

function normalizeUuid(uuid: string): string {
  return uuid.toLowerCase().replaceAll("-", "");
}

export async function verifyMinecraftIdentity(token: string | null, claimedUuid: string | null): Promise<IdentityCheck> {
  if (!token || !claimedUuid) return "refused";
  const normalizedClaim = normalizeUuid(claimedUuid);

  const cached = identityCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.uuid === normalizedClaim ? "verified" : "refused";

  let verifiedUuid: string;
  try {
    const res = await fetch("https://api.minecraftservices.com/minecraft/profile", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(MOJANG_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) return "refused";
    if (!res.ok) return "unavailable";
    const profile: { id?: string } = await res.json();
    if (!profile.id) return "unavailable";
    verifiedUuid = normalizeUuid(profile.id);
  } catch {
    // Timeout, coupure reseau, reponse non JSON : Mojang injoignable ou degrade.
    return "unavailable";
  }

  if (identityCache.size > MAX_IDENTITY_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of identityCache) if (entry.expiresAt <= now) identityCache.delete(key);
  }
  identityCache.set(token, { uuid: verifiedUuid, expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS });

  return verifiedUuid === normalizedClaim ? "verified" : "refused";
}

// Reponse d'erreur pour une identite non confirmee. 401 : le launcher demande
// une reconnexion (jeton refuse). 503 : Mojang est en panne, rien a faire pour
// le joueur, donc pas de faux "Connecte-toi" cote launcher.
export function identityErrorResponse(check: Exclude<IdentityCheck, "verified">): NextResponse {
  if (check === "unavailable") {
    return NextResponse.json({ error: "Service de vérification indisponible, réessaie dans un instant" }, { status: 503 });
  }
  return NextResponse.json({ error: "Identité non vérifiée" }, { status: 401 });
}
