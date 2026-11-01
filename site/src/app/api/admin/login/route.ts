import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/adminAuth";
import { setPendingCookie } from "@/lib/adminTwoFactor";
import { rateLimitResponse } from "@/lib/rateLimit";

// Connexion au panel admin, étape 1 : nom d'utilisateur + mot de passe. Limité par adresse
// (10 essais par minute) ; le message d'erreur ne dit jamais quel champ est faux.
// Depuis la double authentification (2026-10-15), un mot de passe correct ne donne qu'une
// session "pending" de 10 minutes : la suite se passe sur /admin/double-authentification
// (ou d'abord /admin/premiere-connexion pour un nouveau compte qui n'a pas encore de 2FA).
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-login", 10);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const invalid = NextResponse.json({ error: "Nom d'utilisateur ou mot de passe incorrect." }, { status: 401 });
  if (!username || !password) return invalid;

  const account = await db.orm.public.AdminAccount.select("id", "passwordHash", "role", "mustChangeCredentials", "totpEnabledAt")
    .where({ username })
    .first();
  // Verifie toujours le mot de passe, meme si le compte n'existe pas (contre un hash factice) :
  // sinon la reponse est plus rapide pour un nom d'utilisateur inconnu que pour un mauvais mot
  // de passe, ce qui laisse deviner des noms d'utilisateur valides par le temps de reponse.
  const passwordOk = await verifyPassword(password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!account || !passwordOk) return invalid;

  // Nouveau compte sans 2FA : d'abord ses propres identifiants, puis la 2FA (ordre voulu par
  // Rushi le 15/10). Compte avec 2FA : le code d'abord, toujours.
  const next = account.mustChangeCredentials && !account.totpEnabledAt ? "credentials" : "2fa";
  const response = NextResponse.json({ ok: true, next });
  if (!setPendingCookie(response, account.id, account.role === "admin" ? "admin" : "moderator")) {
    return NextResponse.json({ error: "Connexion indisponible (configuration du serveur)." }, { status: 503 });
  }
  return response;
}
