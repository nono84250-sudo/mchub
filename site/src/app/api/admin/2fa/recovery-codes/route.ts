import { NextResponse } from "next/server";
import { db, execSql } from "@/lib/db";
import { decryptTotpSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotp } from "@/lib/adminTotp";
import { lockedResponse, registerTotpFailure } from "@/lib/adminTwoFactor";
import { adminForAction } from "@/lib/adminServers";
import { rateLimitResponse } from "@/lib/rateLimit";

// Paramètres : nouveaux codes de secours (les anciens cessent de marcher). Demande un code
// de l'appli, pour qu'une session restée ouverte ne suffise pas.
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-2fa", 10);
  if (limited) return limited;
  const admin = await adminForAction(request, { requireAdminRole: false });
  if (admin instanceof NextResponse) return admin;

  const account = await db.orm.public.AdminAccount.select("totpSecret", "totpLastStep", "totpLockedUntil").where({ id: admin.id }).first();
  const locked = lockedResponse(account?.totpLockedUntil ?? null);
  if (locked) return locked;
  const secret = account?.totpSecret ? decryptTotpSecret(account.totpSecret) : null;
  if (!secret) return NextResponse.json({ error: "Double authentification illisible sur le serveur." }, { status: 500 });

  const body = await request.json().catch(() => null);
  const step = verifyTotp(secret, String(body?.code ?? ""), account?.totpLastStep ?? null);
  if (step === null) return registerTotpFailure(admin.id);

  const codes = generateRecoveryCodes();
  const rows = await execSql(
    `UPDATE "adminAccount" SET "totpRecoveryCodes" = ?, "totpLastStep" = ?, "totpFailedCount" = 0
     WHERE "id" = ? AND ("totpLastStep" IS NULL OR "totpLastStep" < ?) RETURNING "id"`,
    [JSON.stringify(codes.map((c) => hashRecoveryCode(admin.id, c))), step, admin.id, step],
  );
  if (!rows.length) return registerTotpFailure(admin.id);
  return NextResponse.json({ ok: true, recoveryCodes: codes });
}
