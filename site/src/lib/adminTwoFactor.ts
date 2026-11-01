import { NextResponse } from "next/server";
import { execSql } from "@/lib/db";
import {
  ADMIN_COOKIE,
  ADMIN_PENDING_COOKIE,
  ADMIN_PENDING_TTL_MS,
  ADMIN_SESSION_TTL_MS,
  createAdminSession,
  createPendingAdminSession,
  type AdminRole,
} from "@/lib/adminAuth";
import { getPendingAdmin, type PendingAdmin } from "@/lib/adminSession";
import { TOTP_LOCK_MS, TOTP_MAX_FAILURES } from "@/lib/adminTotp";

// Etapes communes des routes de double authentification du panel admin (voir adminTotp.ts).

const COOKIE_BASE = { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/" };

export function setPendingCookie(response: NextResponse, id: string, role: AdminRole): boolean {
  const token = createPendingAdminSession(id, role);
  if (!token) return false;
  response.cookies.set(ADMIN_PENDING_COOKIE, token, { ...COOKIE_BASE, maxAge: ADMIN_PENDING_TTL_MS / 1000 });
  response.cookies.set(ADMIN_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
  return true;
}

// Code 2FA accepte : session complete, et le cookie "pending" disparait.
export function setFullSessionCookie(response: NextResponse, id: string, role: AdminRole): boolean {
  const token = createAdminSession(id, role);
  if (!token) return false;
  response.cookies.set(ADMIN_COOKIE, token, { ...COOKIE_BASE, maxAge: ADMIN_SESSION_TTL_MS / 1000 });
  response.cookies.set(ADMIN_PENDING_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
  return true;
}

export function clearAdminCookies(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
  response.cookies.set(ADMIN_PENDING_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
}

// Meme controle d'origine que adminForAction (anti-CSRF, fail-closed), puis le compte "pending".
export async function pendingAdminForAction(request: Request): Promise<PendingAdmin | NextResponse> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }
  const pending = await getPendingAdmin();
  if (!pending) {
    return NextResponse.json({ error: "Session expirée : reconnecte-toi avec ton mot de passe.", expired: true }, { status: 401 });
  }
  return pending;
}

export function lockedResponse(lockedUntil: string | null, nowMs: number = Date.now()): NextResponse | null {
  if (!lockedUntil) return null;
  const until = new Date(lockedUntil).getTime();
  if (!(until > nowMs)) return null;
  const minutes = Math.max(1, Math.ceil((until - nowMs) / 60_000));
  return NextResponse.json(
    { error: `Trop d'essais. Réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`, locked: true },
    { status: 429, headers: { "Retry-After": String(Math.ceil((until - nowMs) / 1000)) } },
  );
}

// Mauvais code : compteur en base (pas seulement en memoire, qui vit par instance Vercel), en
// une seule instruction pour rester juste meme avec des essais simultanes. Au 5e echec, le
// compte est bloque 15 minutes et le compteur repart de zero.
export async function registerTotpFailure(id: string, nowMs: number = Date.now()): Promise<NextResponse> {
  const lockUntil = new Date(nowMs + TOTP_LOCK_MS).toISOString();
  const rows = (await execSql(
    `UPDATE "adminAccount" SET
       "totpLockedUntil" = CASE WHEN "totpFailedCount" + 1 >= ? THEN ? ELSE "totpLockedUntil" END,
       "totpFailedCount" = CASE WHEN "totpFailedCount" + 1 >= ? THEN 0 ELSE "totpFailedCount" + 1 END
     WHERE "id" = ? RETURNING "totpFailedCount", "totpLockedUntil"`,
    [TOTP_MAX_FAILURES, lockUntil, TOTP_MAX_FAILURES, id],
  )) as { totpFailedCount: number; totpLockedUntil: string | null }[];
  const row = rows[0];
  const locked = row ? lockedResponse(row.totpLockedUntil, nowMs) : null;
  if (locked) return locked;
  const left = TOTP_MAX_FAILURES - Number(row?.totpFailedCount ?? 0);
  return NextResponse.json(
    { error: `Code incorrect. Il te reste ${left} essai${left > 1 ? "s" : ""} avant un blocage de 15 minutes.` },
    { status: 401 },
  );
}
