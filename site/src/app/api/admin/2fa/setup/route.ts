import { NextResponse } from "next/server";
import { execSql } from "@/lib/db";
import { decryptTotpSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotp } from "@/lib/adminTotp";
import { lockedResponse, pendingAdminForAction, registerTotpFailure, setFullSessionCookie } from "@/lib/adminTwoFactor";
import { rateLimitResponse } from "@/lib/rateLimit";

// Activation de la double authentification : le membre du staff a scanné le QR code
// (/admin/double-authentification) et tape le premier code de son appli. Code bon : la 2FA est
// activée, 10 codes de secours sont générés (renvoyés UNE seule fois) et la session complète
// est ouverte.
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-2fa", 10);
  if (limited) return limited;
  const pending = await pendingAdminForAction(request);
  if (pending instanceof NextResponse) return pending;
  if (pending.totpEnabled) return NextResponse.json({ error: "La double authentification est déjà activée." }, { status: 409 });
  if (pending.mustChangeCredentials) {
    return NextResponse.json({ error: "Choisis d'abord tes identifiants." }, { status: 409 });
  }
  const locked = lockedResponse(pending.totpLockedUntil);
  if (locked) return locked;

  const secret = pending.totpSecret ? decryptTotpSecret(pending.totpSecret) : null;
  if (!secret) return NextResponse.json({ error: "QR code expiré : recharge la page." }, { status: 409 });

  const body = await request.json().catch(() => null);
  const step = verifyTotp(secret, String(body?.code ?? ""), null);
  if (step === null) return registerTotpFailure(pending.id);

  const codes = generateRecoveryCodes();
  const hashes = JSON.stringify(codes.map((c) => hashRecoveryCode(pending.id, c)));
  // WHERE "totpEnabledAt" IS NULL : deux validations simultanées n'activent qu'une fois (et ne
  // produisent qu'une seule liste de codes de secours valable).
  const rows = await execSql(
    `UPDATE "adminAccount" SET "totpEnabledAt" = ?, "totpLastStep" = ?, "totpFailedCount" = 0, "totpLockedUntil" = NULL, "totpRecoveryCodes" = ?
     WHERE "id" = ? AND "totpEnabledAt" IS NULL AND "totpSecret" = ? RETURNING "id"`,
    [new Date().toISOString(), step, hashes, pending.id, pending.totpSecret],
  );
  if (!rows.length) return NextResponse.json({ error: "La double authentification est déjà activée." }, { status: 409 });

  const response = NextResponse.json({ ok: true, recoveryCodes: codes });
  if (!setFullSessionCookie(response, pending.id, pending.role)) {
    return NextResponse.json({ error: "Connexion indisponible (configuration du serveur)." }, { status: 503 });
  }
  return response;
}
