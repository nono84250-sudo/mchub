import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, readAdminSession } from "@/lib/adminAuth";
import { clearAdminCookies } from "@/lib/adminTwoFactor";
import { execSql } from "@/lib/db";

// Audit du 01/11 : effacer le cookie ne suffisait pas, un cookie copié restait valable 8 h. La date de
// révocation (passwordChangedAt, voir adminSession.ts) coupe toutes les sessions de ce compte. Même
// origine exigée pour cette écriture : un autre site ne peut pas déconnecter un admin.
export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  const origin = request.headers.get("origin");
  const session = readAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
  if (session && origin === new URL(request.url).origin) {
    await execSql('UPDATE "adminAccount" SET "passwordChangedAt" = ? WHERE "id" = ?', [new Date().toISOString(), session.sub]).catch(() => null);
  }
  clearAdminCookies(response);
  return response;
}
