import { NextResponse } from "next/server";
import { db, execSql } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

// Remise à zéro de la double authentification d'un membre du staff (téléphone ET codes de
// secours perdus). Réservé aux admins, jamais sur son propre compte (un admin bloqué passe par
// scripts/reset-2fa.mjs). Le membre refait la configuration à sa prochaine connexion ; ses
// sessions ouvertes sont coupées (passwordChangedAt sert de date de révocation, voir
// adminSession.ts), au cas où le téléphone perdu aurait été volé.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/staff/[id]/2fa-reset">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  if (id === admin.id) {
    return NextResponse.json({ error: "Tu ne peux pas réinitialiser ta propre double authentification." }, { status: 400 });
  }
  const target = await db.orm.public.AdminAccount.select("id", "isOwner").where({ id }).first();
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  // Proprietaire du site (audit du 25/10, comme staff/[id]/route.ts) : un autre admin n'y touche pas.
  if (target.isOwner) {
    return NextResponse.json({ error: "Le compte du propriétaire du site ne peut pas être modifié par un autre compte." }, { status: 403 });
  }

  await execSql(
    `UPDATE "adminAccount" SET "totpSecret" = NULL, "totpEnabledAt" = NULL, "totpLastStep" = NULL, "totpFailedCount" = 0,
       "totpLockedUntil" = NULL, "totpRecoveryCodes" = NULL, "passwordChangedAt" = ? WHERE "id" = ?`,
    [new Date().toISOString(), id],
  );
  return NextResponse.redirect(new URL("/admin/parametres?reset2fa=1", request.url), 303);
}
