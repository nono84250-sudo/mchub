import { cookies } from "next/headers";
import { db } from "@/prisma/db";
import { ADMIN_COOKIE, readAdminSession, type AdminRole } from "@/lib/adminAuth";

// Compte admin connecté, ou null. Relit le compte en base à chaque appel : un
// compte supprimé ou dont le rôle change perd l'accès immédiatement.
export type CurrentAdmin = { id: string; username: string; role: AdminRole; mustChangeCredentials: boolean };

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const session = readAdminSession(token);
  if (!session) return null;
  const account = await db.orm.public.AdminAccount.select("id", "username", "role", "mustChangeCredentials")
    .where({ id: session.sub })
    .first();
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    role: account.role === "admin" ? "admin" : "moderator",
    mustChangeCredentials: account.mustChangeCredentials,
  };
}
