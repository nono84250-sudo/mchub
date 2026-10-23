import { NextResponse } from "next/server";
import { execSql } from "@/lib/db";
import { consumeRecoveryCode, decryptTotpSecret, verifyTotp } from "@/lib/adminTotp";
import { lockedResponse, pendingAdminForAction, registerTotpFailure, setFullSessionCookie } from "@/lib/adminTwoFactor";
import { rateLimitResponse } from "@/lib/rateLimit";

// Connexion au panel admin, étape 2 : code à 6 chiffres de l'appli, ou un code de secours.
// 5 erreurs = compte bloqué 15 minutes (compteur en base, voir registerTotpFailure).
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-2fa", 10);
  if (limited) return limited;
  const pending = await pendingAdminForAction(request);
  if (pending instanceof NextResponse) return pending;
  if (!pending.totpEnabled) {
    return NextResponse.json({ error: "La double authentification n'est pas encore configurée." }, { status: 409 });
  }
  const locked = lockedResponse(pending.totpLockedUntil);
  if (locked) return locked;

  const body = await request.json().catch(() => null);
  let remainingRecoveryCodes: number | null = null;

  if (body?.recoveryCode !== undefined) {
    const remaining = consumeRecoveryCode(pending.id, String(body.recoveryCode), pending.totpRecoveryCodes);
    if (!remaining) return registerTotpFailure(pending.id);
    // Comparer-et-remplacer : un même code de secours ne passe qu'une fois, même envoyé deux
    // fois en même temps.
    const rows = await execSql(
      `UPDATE "adminAccount" SET "totpRecoveryCodes" = ?, "totpFailedCount" = 0 WHERE "id" = ? AND "totpRecoveryCodes" = ? RETURNING "id"`,
      [JSON.stringify(remaining), pending.id, pending.totpRecoveryCodes],
    );
    if (!rows.length) return registerTotpFailure(pending.id);
    remainingRecoveryCodes = remaining.length;
  } else {
    const secret = pending.totpSecret ? decryptTotpSecret(pending.totpSecret) : null;
    if (!secret) {
      return NextResponse.json(
        { error: "Double authentification illisible sur le serveur. Utilise un code de secours ou demande à un admin de la réinitialiser." },
        { status: 500 },
      );
    }
    const step = verifyTotp(secret, String(body?.code ?? ""), pending.totpLastStep);
    if (step === null) return registerTotpFailure(pending.id);
    // Anti-rejeu : un code déjà utilisé (même pas de 30 s ou plus ancien) est refusé.
    const rows = await execSql(
      `UPDATE "adminAccount" SET "totpLastStep" = ?, "totpFailedCount" = 0 WHERE "id" = ? AND ("totpLastStep" IS NULL OR "totpLastStep" < ?) RETURNING "id"`,
      [step, pending.id, step],
    );
    if (!rows.length) return registerTotpFailure(pending.id);
  }

  const response = NextResponse.json({ ok: true, mustChangeCredentials: pending.mustChangeCredentials, remainingRecoveryCodes });
  if (!setFullSessionCookie(response, pending.id, pending.role)) {
    return NextResponse.json({ error: "Connexion indisponible (configuration du serveur)." }, { status: 503 });
  }
  return response;
}
