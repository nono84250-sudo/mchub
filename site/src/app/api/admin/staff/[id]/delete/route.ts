import { NextResponse } from "next/server";
import { db, execSql } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

// Suppression d'un compte staff. Confirmation : un simple oui/non cote client (voir
// manageStaffHtml, confirm() natif) — interdit de se supprimer soi-meme, et interdit de
// supprimer le dernier compte administrateur (plus personne ne pourrait alors gerer le staff).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/staff/[id]/delete">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;

  if (id === admin.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 });
  }

  const target = await db.orm.public.AdminAccount.select("id", "role", "isOwner").where({ id }).first();
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  // Proprietaire du site (audit du 25/10, comme staff/[id]/route.ts) : un autre admin n'y touche pas.
  if (target.isOwner) {
    return NextResponse.json({ error: "Le compte du propriétaire du site ne peut pas être modifié par un autre compte." }, { status: 403 });
  }

  // Garde "dernier administrateur" atomique (meme raisonnement que staff/[id]/route.ts, audit du
  // 2026-10-10 §2.21) : une instruction SQL unique dont le WHERE reevalue le compte au moment de
  // l'ecriture, au lieu d'un lire-puis-ecrire en deux appels separes vulnerable a une course.
  await execSql(
    `DELETE FROM "adminAccount" WHERE "id" = ? AND ("role" != 'admin' OR (SELECT COUNT(*) FROM "adminAccount" WHERE "role" = 'admin') > 1)`,
    [id],
  );

  const stillExists = await db.orm.public.AdminAccount.select("id").where({ id }).first();
  if (stillExists) {
    return NextResponse.json({ error: "Impossible de supprimer le dernier administrateur." }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/admin/servers", request.url), 303);
}
