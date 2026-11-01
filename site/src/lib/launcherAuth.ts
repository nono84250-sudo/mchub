import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSessionRevoked, LAUNCHER_SESSION_HEADER, normalizeMinecraftUuid, readLauncherSession, sanitizeMinecraftName } from "./launcherSession";

export { createLauncherSession, LAUNCHER_SESSION_HEADER, normalizeMinecraftUuid } from "./launcherSession";

// Comparaison en temps constant du secret partage avec le launcher — une
// comparaison de chaine standard (`===`) fuit un signal temporel exploitable
// en theorie sur le nombre de caracteres corrects avant la premiere
// difference. timingSafeEqual exige des buffers de meme longueur, d'ou le
// contrôle de longueur avant l'appel plutôt que de le laisser lever.
//
// Deux cles acceptees pendant un renouvellement (audit 14/10, S6, choix de Rushi) :
// LAUNCHER_API_KEY (la nouvelle, embarquee dans le prochain launcher) et, si elle existe,
// LAUNCHER_API_KEY_PREVIOUS (celle des launchers deja installes). On retire la seconde de
// Vercel quand plus personne ne l'utilise. Sans LAUNCHER_API_KEY_PREVIOUS : comportement d'avant.
function matchesSecret(authHeader: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const actualBuffer = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(`Bearer ${secret}`);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function isAuthorizedLauncherRequest(request: Request): boolean {
  if (!process.env.LAUNCHER_API_KEY) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  // Les deux comparaisons sont toujours faites, pour ne pas dire par le temps de reponse
  // laquelle des deux cles a ete reconnue.
  const current = matchesSecret(authHeader, process.env.LAUNCHER_API_KEY);
  const previous = matchesSecret(authHeader, process.env.LAUNCHER_API_KEY_PREVIOUS);
  return current || previous;
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
type CachedIdentity = { uuid: string; name: string | null; expiresAt: number };
const identityCache = new Map<string, CachedIdentity>();
const MAX_IDENTITY_CACHE_ENTRIES = 10_000;

// Trois issues distinctes, pour que le launcher ne dise pas "Connecte-toi" a un
// joueur dont la connexion est en parfait etat :
//  - "verified"    : Mojang confirme que le jeton appartient a cet UUID.
//  - "refused"     : le jeton manque, Mojang le rejette (401/403), le compte n'a
//                    pas de profil Minecraft (404), ou l'UUID ne correspond pas.
//  - "unavailable" : Mojang ne se prononce pas (timeout, reseau, 429, 5xx...).
export type IdentityCheck = "verified" | "refused" | "unavailable";

// Verrou de compte (fiche joueur, panel admin) : distinct du gel d'UN serveur
// (server.frozenAt). Un compte verrouille ne doit plus pouvoir s'authentifier
// dans le launcher du tout. Interroge a chaque fois (comme sessionsValidAfter
// plus bas) pour qu'un verrou pose par un admin coupe l'acces immediatement,
// pas seulement a la prochaine expiration de cache/session.
//
// Charge (audit 25/10) : cette lecture avait lieu a CHAQUE appel du launcher (presence, amis,
// notifications...), soit 1 appel D1 de plus sur presque toutes les routes. Elle est gardee
// AUTH_ROW_TTL_MS en memoire, par instance : un verrou ou une deconnexion pose par un admin
// coupe l'acces en 30 s au plus (tout de suite sur l'instance qui l'a pose, voir
// forgetAccountAuthState), au lieu d'immediatement.
type AccountAuthState = { lockedAt: string | null; lockedReason: string | null; sessionsValidAfter: string | null };
const AUTH_ROW_TTL_MS = 30_000;
const authRowCache = new Map<string, { state: AccountAuthState | null; expiresAt: number }>();

async function getAccountAuthState(uuid: string): Promise<AccountAuthState | null> {
  const key = normalizeMinecraftUuid(uuid);
  const cached = authRowCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.state;
  const user = await db.orm.public.User.select("lockedAt", "lockedReason", "sessionsValidAfter").where({ minecraftUuid: key }).first();
  const state: AccountAuthState | null = user
    ? { lockedAt: user.lockedAt ?? null, lockedReason: user.lockedReason ?? null, sessionsValidAfter: user.sessionsValidAfter ?? null }
    : null;
  if (authRowCache.size > MAX_IDENTITY_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [k, entry] of authRowCache) if (entry.expiresAt <= now) authRowCache.delete(k);
  }
  authRowCache.set(key, { state, expiresAt: Date.now() + AUTH_ROW_TTL_MS });
  return state;
}

// A appeler apres un changement de verrou, de deconnexion ou de compte (suppression) pour
// que cette instance ne serve plus l'ancien etat.
export function forgetAccountAuthState(uuid: string): void {
  authRowCache.delete(normalizeMinecraftUuid(uuid));
}

export async function getAccountLock(uuid: string): Promise<{ lockedReason: string | null } | null> {
  const user = await getAccountAuthState(uuid);
  return user?.lockedAt ? { lockedReason: user.lockedReason ?? null } : null;
}

// Une requete normale vers Mojang repond en quelques centaines de ms. 5 s laisse
// une grosse marge aux pointes de charge sans bloquer le sondage du launcher
// (toutes les 30 s) ni depasser la limite de duree des fonctions serverless.
const MOJANG_TIMEOUT_MS = 5_000;

// Interroge Mojang pour un jeton : renvoie l'UUID et le pseudo confirmes, ou la raison du refus.
// Un compte verrouille renvoie aussi l'UUID que Mojang a confirme, pour que l'appelant ne
// montre le motif qu'au vrai titulaire du jeton (audit 14/10, S2).
type MojangLookup =
  | { uuid: string; name: string | null }
  | { check: "refused" | "unavailable" }
  | { check: "locked"; uuid: string; lockedReason: string | null };

async function lookupMojangProfile(token: string): Promise<MojangLookup> {
  const cached = identityCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    // Le cache ne retient que l'identite Mojang, pas le verrou : on le revérifie
    // a chaque appel pour qu'un verrou pose par un admin coupe l'acces tout de suite.
    const lock = await getAccountLock(cached.uuid);
    if (lock) return { check: "locked", uuid: cached.uuid, lockedReason: lock.lockedReason };
    return { uuid: cached.uuid, name: cached.name };
  }

  let verifiedUuid: string;
  let verifiedName: string | null;
  try {
    const res = await fetch("https://api.minecraftservices.com/minecraft/profile", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(MOJANG_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) return { check: "refused" };
    if (!res.ok) return { check: "unavailable" };
    const profile: { id?: string; name?: string } = await res.json();
    if (!profile.id) return { check: "unavailable" };
    verifiedUuid = normalizeMinecraftUuid(profile.id);
    verifiedName = sanitizeMinecraftName(profile.name);
  } catch {
    // Timeout, coupure reseau, reponse non JSON : Mojang injoignable ou degrade.
    return { check: "unavailable" };
  }

  const lock = await getAccountLock(verifiedUuid);
  if (lock) return { check: "locked", uuid: verifiedUuid, lockedReason: lock.lockedReason };

  if (identityCache.size > MAX_IDENTITY_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of identityCache) if (entry.expiresAt <= now) identityCache.delete(key);
  }
  identityCache.set(token, { uuid: verifiedUuid, name: verifiedName, expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS });
  return { uuid: verifiedUuid, name: verifiedName };
}

// Identite verifiee + pseudo confirme par Mojang (name est null si l'identite n'est pas verifiee).
// lock n'est rempli que si Mojang a confirme que le jeton appartient bien a claimedUuid : le
// motif d'un verrou n'est jamais montre a quelqu'un d'autre que le joueur concerne.
export type VerifiedProfile = { check: IdentityCheck; name: string | null; lock?: { lockedReason: string | null } };

export async function verifyMinecraftProfile(token: string | null, claimedUuid: string | null): Promise<VerifiedProfile> {
  if (!token || !claimedUuid) return { check: "refused", name: null };
  const result = await lookupMojangProfile(token);
  const isClaimed = "uuid" in result && result.uuid === normalizeMinecraftUuid(claimedUuid);
  if ("check" in result) {
    if (result.check === "locked") {
      return isClaimed ? { check: "refused", name: null, lock: { lockedReason: result.lockedReason } } : { check: "refused", name: null };
    }
    return { check: result.check, name: null };
  }
  return isClaimed ? { check: "verified", name: result.name } : { check: "refused", name: null };
}

export async function verifyMinecraftIdentity(token: string | null, claimedUuid: string | null): Promise<IdentityCheck> {
  return (await verifyMinecraftProfile(token, claimedUuid)).check;
}

// Identite du joueur pour une requete launcher qui le designe par `claimedUuid`.
// Si l'en-tete X-Launcher-Session est present, il decide SEUL (pas de repli sur
// le jeton Mojang : un jeton de session expire ou falsifie donne donc 401, meme
// si un jeton Mojang valide accompagne la requete). Sinon, comportement d'avant
// (X-Minecraft-Token verifie chez Mojang), pour que les launchers 0.3.2 marchent encore.
// Uuid du joueur d'un jeton de session : signature et expiration (15 min) OK,
// et jeton non revoque (User.sessionsValidAfter, voir route session/revoke).
export async function sessionIdentity(token: string): Promise<string | null> {
  return (await sessionProfile(token))?.uuid ?? null;
}

// Meme controle que sessionIdentity, avec le pseudo signe dans le jeton (voir launcherSession.ts).
async function sessionProfile(token: string): Promise<{ uuid: string; name: string | null } | null> {
  const claims = readLauncherSession(token);
  if (!claims) return null;
  const user = await getAccountAuthState(claims.uuid);
  if (isSessionRevoked(claims.issuedAt, user?.sessionsValidAfter)) return null;
  if (user?.lockedAt) return null;
  return { uuid: claims.uuid, name: claims.name };
}

// Deconnexion : refuse desormais tous les jetons de session emis jusqu'a maintenant
// pour ce joueur. Renvoie false si aucun compte site ne porte cet UUID (le launcher
// n'en cree pas : voir le rapport, les jetons de ces joueurs expirent seuls en 15 min).
export async function revokeLauncherSessions(uuid: string): Promise<boolean> {
  const updated = await db.orm.public.User.where({ minecraftUuid: normalizeMinecraftUuid(uuid) }).update({ sessionsValidAfter: new Date().toISOString() });
  forgetAccountAuthState(uuid);
  return !!updated;
}

export async function verifyLauncherIdentity(request: Request, claimedUuid: string | null): Promise<IdentityCheck> {
  return (await verifyLauncherProfile(request, claimedUuid)).check;
}

// Comme verifyLauncherIdentity, avec en plus le pseudo VERIFIE du joueur (profil Mojang, ou
// jeton de session signe). C'est le seul pseudo a enregistrer : celui du corps de la requete
// n'est jamais cru (audit 14/10, B2). name peut etre null (jeton de session emis avant le
// 14/10) : findOrCreateUserByMinecraft garde alors le pseudo deja connu.
export async function verifyLauncherProfile(request: Request, claimedUuid: string | null): Promise<VerifiedProfile> {
  const session = request.headers.get(LAUNCHER_SESSION_HEADER);
  if (session !== null) {
    const profile = await sessionProfile(session);
    if (!profile || !claimedUuid) return { check: "refused", name: null };
    return profile.uuid === normalizeMinecraftUuid(claimedUuid) ? { check: "verified", name: profile.name } : { check: "refused", name: null };
  }
  return verifyMinecraftProfile(request.headers.get("x-minecraft-token"), claimedUuid);
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
  return "uuid" in result && !("check" in result) ? result.uuid : null;
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
