import { NextResponse } from "next/server";
import { db, execSql } from "@/lib/db";
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_MS, createAdminSession, hashPassword, passwordProblem, verifyPassword } from "@/lib/adminAuth";
import { adminForAction } from "@/lib/adminServers";
import { pendingAdminForAction, setPendingCookie } from "@/lib/adminTwoFactor";
import { rateLimitResponse } from "@/lib/rateLimit";

// Changement du nom d'utilisateur et du mot de passe (première connexion obligatoire,
// ou paramètres ensuite). Demande toujours le mot de passe actuel.
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-credentials", 10);
  if (limited) return limited;
  // allowMustChangeCredentials : un compte en première connexion (mustChangeCredentials=true)
  // doit encore pouvoir appeler CETTE route pour en sortir. requireAdminRole: false — changer
  // SES PROPRES identifiants n'est pas réservé aux admins (modérateurs inclus, comme avant).
  const full = await adminForAction(request, { allowMustChangeCredentials: true, requireAdminRole: false });
  let admin: { id: string; role: "admin" | "moderator" };
  // Premiere connexion d'un compte qui n'a pas encore de 2FA : il change ses identifiants avec
  // sa session "pending" (mot de passe seul), PUIS configure la 2FA. Seulement dans ce cas : un
  // compte qui a deja la 2FA doit donner son code avant de toucher a ses identifiants.
  let firstLoginWithout2fa = false;
  if (full instanceof NextResponse) {
    const pending = await pendingAdminForAction(request);
    if (pending instanceof NextResponse || !pending.mustChangeCredentials || pending.totpEnabled) return full;
    admin = pending;
    firstLoginWithout2fa = true;
  } else {
    admin = full;
  }

  const body = await request.json().catch(() => null);
  const currentPassword = String(body?.currentPassword ?? "");
  const username = String(body?.username ?? "").trim();
  const newPassword = String(body?.newPassword ?? "");

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json({ error: "Nom d'utilisateur : 3 à 32 caractères (lettres, chiffres, _ . -)." }, { status: 400 });
  }
  if (username.toLowerCase() === "admin") {
    return NextResponse.json({ error: "Choisis un nom d'utilisateur différent de « admin »." }, { status: 400 });
  }
  const problem = passwordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const account = await db.orm.public.AdminAccount.select("passwordHash").where({ id: admin.id }).first();
  if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
  }

  // Changement force (compte cree par un autre admin, mot de passe connu de lui) : reprendre le
  // meme mot de passe ne changerait rien (audit 25/10).
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "Choisis un nouveau mot de passe, différent de l'actuel." }, { status: 400 });
  }

  const taken = await db.orm.public.AdminAccount.select("id").where({ username }).first();
  if (taken && taken.id !== admin.id) {
    return NextResponse.json({ error: "Ce nom d'utilisateur est déjà pris." }, { status: 409 });
  }

  const passwordHash = await hashPassword(newPassword);
  const changedAt = new Date().toISOString();
  await execSql(
    'UPDATE "adminAccount" SET "username" = ?, "passwordHash" = ?, "mustChangeCredentials" = 0, "passwordChangedAt" = ? WHERE "id" = ?',
    [username, passwordHash, changedAt, admin.id],
  );

  // Revoque toute AUTRE session (voir adminSession.ts) — mais la session courante doit survivre
  // au changement qu'elle vient elle-meme de declencher, sinon l'admin se deconnecte lui-meme :
  // reemission immediate d'un cookie frais (iat >= passwordChangedAt).
  if (firstLoginWithout2fa) {
    // Nouveau jeton "pending" (le changement de mot de passe vient de revoquer l'ancien), la
    // suite est la configuration de la 2FA.
    const response = NextResponse.json({ ok: true, next: "2fa" });
    setPendingCookie(response, admin.id, admin.role);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  const token = createAdminSession(admin.id, admin.role);
  if (token) {
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_MS / 1000,
    });
  }
  return response;
}
