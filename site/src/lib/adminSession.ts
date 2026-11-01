import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, ADMIN_PENDING_COOKIE, readAdminSession, type AdminRole } from "@/lib/adminAuth";

// Compte admin connecté, ou null. Relit le compte en base à chaque appel : un
// compte supprimé ou dont le rôle change perd l'accès immédiatement.
// isOwner : proprietaire du site (Rushi, 23/10). Pas un role ni un droit attribuable : marque
// une seule fois en base (adminAccount.isOwner, index unique), aucune route ne permet de le donner.
export type CurrentAdmin = { id: string; username: string; role: AdminRole; mustChangeCredentials: boolean; isOwner: boolean };

async function getCurrentAdminUncached(): Promise<CurrentAdmin | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const session = readAdminSession(token);
  if (!session) return null;
  const account = await db.orm.public.AdminAccount.select("id", "username", "role", "mustChangeCredentials", "isOwner", "passwordChangedAt", "totpEnabledAt")
    .where({ id: session.sub })
    .first();
  // totpEnabledAt : une session complete n'existe qu'apres le code 2FA ; si la 2FA du compte a
  // ete remise a zero entre-temps, la session ne vaut plus rien (en plus de la revocation par
  // passwordChangedAt que fait aussi la remise a zero).
  if (!account || !account.totpEnabledAt) return null;
  // Session emise avant le dernier changement de mot de passe : revoquee (voir le commentaire
  // sur AdminSession.iat dans adminAuth.ts) — un cookie vole ne survit plus a un changement de
  // mot de passe, meme avant son expiration naturelle de 8h.
  if (account.passwordChangedAt && new Date(account.passwordChangedAt).getTime() > session.iat) return null;
  return {
    id: account.id,
    username: account.username,
    role: account.role === "admin" ? "admin" : "moderator",
    mustChangeCredentials: account.mustChangeCredentials,
    isOwner: account.isOwner === true,
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

// Compte qui a donne un mot de passe correct mais pas encore le code 2FA (cookie "pending",
// 10 minutes). Sert UNIQUEMENT a l'ecran /admin/double-authentification, aux routes
// /api/admin/2fa/* et, pour un compte sans 2FA en premiere connexion, au changement
// d'identifiants. N'ouvre jamais le reste du panel.
export type PendingAdmin = CurrentAdmin & {
  totpEnabled: boolean;
  totpSecret: string | null;
  totpLastStep: number | null;
  totpLockedUntil: string | null;
  totpRecoveryCodes: string | null;
};

export async function getPendingAdmin(): Promise<PendingAdmin | null> {
  const token = (await cookies()).get(ADMIN_PENDING_COOKIE)?.value;
  const session = readAdminSession(token, Date.now(), "pending");
  if (!session) return null;
  const account = await db.orm.public.AdminAccount.select(
    "id", "username", "role", "mustChangeCredentials", "isOwner", "passwordChangedAt",
    "totpSecret", "totpEnabledAt", "totpLastStep", "totpLockedUntil", "totpRecoveryCodes",
  )
    .where({ id: session.sub })
    .first();
  if (!account) return null;
  if (account.passwordChangedAt && new Date(account.passwordChangedAt).getTime() > session.iat) return null;
  return {
    id: account.id,
    username: account.username,
    role: account.role === "admin" ? "admin" : "moderator",
    mustChangeCredentials: account.mustChangeCredentials,
    isOwner: account.isOwner === true,
    totpEnabled: !!account.totpEnabledAt,
    totpSecret: account.totpSecret ?? null,
    totpLastStep: account.totpLastStep ?? null,
    totpLockedUntil: account.totpLockedUntil ?? null,
    totpRecoveryCodes: account.totpRecoveryCodes ?? null,
  };
}
