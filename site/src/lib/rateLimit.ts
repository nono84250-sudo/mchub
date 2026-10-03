import { NextResponse } from "next/server";

// Limitation de débit simple, en mémoire, par adresse IP et par route : un même
// visiteur qui envoie trop de requêtes reçoit une réponse 429 au lieu de charger
// la base. Limite connue : le compteur vit dans UNE instance du site ; sur Vercel
// plusieurs instances tournent en parallèle et chacune compte de son côté, donc
// ceci arrête un usage abusif venant d'une seule source mais pas une attaque
// répartie. Pour une vraie garantie, ajouter une règle de limitation dans le pare-feu
// Vercel (Firewall > Rate limiting) — sans changement de code.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

type RateLimitCheck = { limited: boolean; retryAfterSeconds: number };

// Coeur de la limitation, sans dependance a un objet Request : incremente le
// compteur de `key` et dit si `limit` requetes par `windowMs` sont depassees.
// Partage entre rateLimitResponse (routes API, ci-dessous) et les Server
// Components qui n'ont pas de Request (voir app/join/[code]/page.tsx, qui lit
// l'adresse via next/headers puis appelle ceci directement).
export function checkRateLimit(key: string, limit: number, windowMs = 60_000): RateLimitCheck {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(k);
  }

  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  bucket.count++;
  buckets.set(key, bucket);

  return { limited: bucket.count > limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

// Adresse du visiteur. On ne fait confiance qu'a un en-tete ecrit par la
// plateforme, jamais a la premiere valeur de x-forwarded-for (un client peut
// l'inventer). Vercel documente x-vercel-forwarded-for et x-real-ip comme copies
// de l'IP reelle du client, ecrites par la plateforme ; x-forwarded-for est
// reecrit par Vercel. Hors Vercel (proxy devant le site), le dernier element de
// x-forwarded-for est celui ajoute par le proxy le plus proche : le premier vient
// du client. `getHeader` est soit `request.headers.get` (route API), soit le
// resultat de `await headers()` de next/headers (voir clientIpFromHeadersList).
function extractClientIp(getHeader: (name: string) => string | null): string {
  const platformIp = getHeader("x-vercel-forwarded-for")?.trim() || getHeader("x-real-ip")?.trim();
  if (platformIp) return platformIp;
  const chain = getHeader("x-forwarded-for")?.split(",").map((ip) => ip.trim()).filter(Boolean) ?? [];
  return chain[chain.length - 1] || "inconnue";
}

function clientIp(request: Request): string {
  return extractClientIp((name) => request.headers.get(name));
}

// Pour un Server Component (pas de Request disponible) : `headersList` est le
// resultat de `await headers()`.
export function clientIpFromHeadersList(headersList: { get(name: string): string | null }): string {
  return extractClientIp((name) => headersList.get(name));
}

/**
 * Renvoie une réponse 429 si cette adresse a dépassé `limit` requêtes en
 * `windowMs` pour la route `name`, sinon `null` (la requête peut continuer).
 */
export function rateLimitResponse(
  request: Request,
  name: string,
  limit: number,
  { windowMs = 60_000, headers }: { windowMs?: number; headers?: Record<string, string> } = {},
): NextResponse | null {
  const { limited, retryAfterSeconds } = checkRateLimit(`${name}:${clientIp(request)}`, limit, windowMs);
  if (!limited) return null;
  return NextResponse.json(
    { error: "Trop de requêtes, réessaie dans un instant." },
    { status: 429, headers: { ...headers, "Retry-After": String(retryAfterSeconds) } },
  );
}
