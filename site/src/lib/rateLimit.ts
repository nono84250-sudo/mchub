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

// Adresse du visiteur : Vercel place la vraie adresse en tête de x-forwarded-for.
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "inconnue";
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
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }

  const key = `${name}:${clientIp(request)}`;
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  bucket.count++;
  buckets.set(key, bucket);

  if (bucket.count <= limit) return null;
  return NextResponse.json(
    { error: "Trop de requêtes, réessaie dans un instant." },
    { status: 429, headers: { ...headers, "Retry-After": String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))) } },
  );
}
