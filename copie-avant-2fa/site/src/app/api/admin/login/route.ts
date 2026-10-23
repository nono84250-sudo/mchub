import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_MS, DUMMY_PASSWORD_HASH, createAdminSession, verifyPassword } from "@/lib/adminAuth";
import { rateLimitResponse } from "@/lib/rateLimit";

// Connexion au panel admin : nom d'utilisateur + mot de passe. Limité par adresse
// (10 essais par minute) ; le message d'erreur ne dit jamais quel champ est faux.
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-login", 10);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const invalid = NextResponse.json({ error: "Nom d'utilisateur ou mot de passe incorrect." }, { status: 401 });
  if (!username || !password) return invalid;

  const account = await db.orm.public.AdminAccount.select("id", "passwordHash", "role", "mustChangeCredentials")
    .where({ username })
    .first();
  // Verifie toujours le mot de passe, meme si le compte n'existe pas (contre un hash factice) :
  // sinon la reponse est plus rapide pour un nom d'utilisateur inconnu que pour un mauvais mot
  // de passe, ce qui laisse deviner des noms d'utilisateur valides par le temps de reponse.
  const passwordOk = await verifyPassword(password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!account || !passwordOk) return invalid;

  const token = createAdminSession(account.id, account.role === "admin" ? "admin" : "moderator");
  if (!token) return NextResponse.json({ error: "Connexion indisponible (configuration du serveur)." }, { status: 503 });

  const response = NextResponse.json({ ok: true, mustChangeCredentials: account.mustChangeCredentials });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
  return response;
}
