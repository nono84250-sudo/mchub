import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { isSessionRevoked, LAUNCHER_SESSION_HEADER, normalizeMinecraftUuid, readLauncherSession } from "./launcherSession";

export { createLauncherSession, LAUNCHER_SESSION_HEADER, normalizeMinecraftUuid } from "./launcherSession";

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

// Interroge Mojang pour un jeton : renvoie l'UUID confirme, ou la raison du refus.
async function lookupMojangProfile(token: string): Promise<{ uuid: string } | { check: "refused" | "unavailable" }> {
  const cached = identityCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return { uuid: cached.uuid };

  let verifiedUuid: string;
  try {
    const res = await fetch("https://api.minecraftservices.com/minecraft/profile", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(MOJANG_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) return { check: "refused" };
    if (!res.ok) return { check: "unavailable" };
    const profile: { id?: string } = await res.json();
    if (!profile.id) return { check: "unavailable" };
    verifiedUuid = normalizeMinecraftUuid(profile.id);
  } catch {
    // Timeout, coupure reseau, reponse non JSON : Mojang injoignable ou degrade.
    return { check: "unavailable" };
  }

  if (identityCache.size > MAX_IDENTITY_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of identityCache) if (entry.expiresAt <= now) identityCache.delete(key);
  }
  identityCache.set(token, { uuid: verifiedUuid, expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS });
  return { uuid: verifiedUuid };
}

export async function verifyMinecraftIdentity(token: string | null, claimedUuid: string | null): Promise<IdentityCheck> {
  if (!token || !claimedUuid) return "refused";
  const result = await lookupMojangProfile(token);
  if ("check" in result) return result.check === "refused" ? "refused" : "unavailable";
  return result.uuid === normalizeMinecraftUuid(claimedUuid) ? "verified" : "refused";
}

// Identite du joueur pour une requete launcher qui le designe par `claimedUuid`.
// Si l'en-tete X-Launcher-Session est present, il decide SEUL (pas de repli sur
// le jeton Mojang : un jeton de session expire ou falsifie donne donc 401, meme
// si un jeton Mojang valide accompagne la requete). Sinon, comportement d'avant
// (X-Minecraft-Token verifie chez Mojang), pour que les launchers 0.3.2 marchent encore.
// Uuid du joueur d'un jeton de session : signature et expiration (15 min) OK,
// et jeton non revoque (User.sessionsValidAfter, voir route session/revoke).
export async function sessionIdentity(token: string): Promise<string | null> {
  const claims = readLauncherSession(token);
  if (!claims) return null;
  const user = await db.orm.public.User.select("sessionsValidAfter").where({ minecraftUuid: claims.uuid }).first();
  if (isSessionRevoked(claims.issuedAt, user?.sessionsValidAfter)) return null;
  return claims.uuid;
}

// Deconnexion : refuse desormais tous les jetons de session emis jusqu'a maintenant
// pour ce joueur. Renvoie false si aucun compte site ne porte cet UUID (le launcher
// n'en cree pas : voir le rapport, les jetons de ces joueurs expirent seuls en 15 min).
export async function revokeLauncherSessions(uuid: string): Promise<boolean> {
  const updated = await db.orm.public.User.where({ minecraftUuid: uuid }).update({ sessionsValidAfter: new Date().toISOString() });
  return !!updated;
}

export async function verifyLauncherIdentity(request: Request, claimedUuid: string | null): Promise<IdentityCheck> {
  const session = request.headers.get(LAUNCHER_SESSION_HEADER);
  if (session !== null) {
    const uuid = await sessionIdentity(session);
    if (!uuid || !claimedUuid) return "refused";
    return uuid === normalizeMinecraftUuid(claimedUuid) ? "verified" : "refused";
  }
  return verifyMinecraftIdentity(request.headers.get("x-minecraft-token"), claimedUuid);
}

// Joueur identifie par la requete, sans UUID de reference (routes qui ne lisent
// pas de donnee propre a un joueur mais exigent un launcher connecte). Renvoie
// l'UUID verifie, ou null.
export async function launcherIdentityUuid(request: Request): Promise<string | null> {
  const session = request.headers.get(LAUNCHER_SESSION_HEADER);
  if (session !== null) return sessionIdentity(session);
  const token = request.headers.get("x-minecraft-token");
  if (!token) return null;
  const result = await lookupMojangProfile(token);
  return "uuid" in result ? result.uuid : null;
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
