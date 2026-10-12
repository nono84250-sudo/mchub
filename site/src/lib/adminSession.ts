import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, readAdminSession, type AdminRole } from "@/lib/adminAuth";

// Compte admin connecté, ou null. Relit le compte en base à chaque appel : un
// compte supprimé ou dont le rôle change perd l'accès immédiatement.
export type CurrentAdmin = { id: string; username: string; role: AdminRole; mustChangeCredentials: boolean };

async function getCurrentAdminUncached(): Promise<CurrentAdmin | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const session = readAdminSession(token);
  if (!session) return null;
  const account = await db.orm.public.AdminAccount.select("id", "username", "role", "mustChangeCredentials", "passwordChangedAt")
    .where({ id: session.sub })
    .first();
  if (!account) return null;
  // Session emise avant le dernier changement de mot de passe : revoquee (voir le commentaire
  // sur AdminSession.iat dans adminAuth.ts) — un cookie vole ne survit plus a un changement de
  // mot de passe, meme avant son expiration naturelle de 8h.
  if (account.passwordChangedAt && new Date(account.passwordChangedAt).getTime() > session.iat) return null;
  return {
    id: account.id,
    username: account.username,
    role: account.role === "admin" ? "admin" : "moderator",
    mustChangeCredentials: account.mustChangeCredentials,
  };
}

// Memoise par requete (React.cache) : plusieurs composants d'une meme page admin appellent tous
// getCurrentAdmin() (ex. requireAdmin() + DesignScreen) — sans ca, autant d'allers-retours D1
// que d'appelants. Seul export canonique (tout le monde doit importer CELUI-CI, jamais la
// version non cachee ci-dessus) : deux wrappers cache() distincts sur la meme fonction ne
// partageraient pas leur memoisation entre eux (trouve par l'audit du 2026-10-10 — une 2e
// version cachee existait deja dans admin/design/guard.ts, mais seul DesignScreen l'importait,
// toutes les autres pages admin continuaient d'importer la version non cachee ci-dessous,
// annulant silencieusement le benefice de la memoisation des que les deux etaient appelees sur
// la meme page).
export const getCurrentAdmin = cache(getCurrentAdminUncached);
