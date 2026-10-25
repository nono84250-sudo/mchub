import { NextResponse } from "next/server";
import { db, execSql } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

// Changement de rôle et/ou réinitialisation forcée des identifiants. On refuse de retirer le
// statut admin au dernier compte administrateur : plus personne ne pourrait alors gérer le staff.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/staff/[id]">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;

  const form = await request.formData();
  const role = String(form.get("role") ?? "");
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  const target = await db.orm.public.AdminAccount.select("id", "role", "isOwner").where({ id }).first();
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  // Proprietaire du site (23/10) : un autre admin ne peut ni le retrograder ni forcer la
  // reinitialisation de ses identifiants.
  if (target.isOwner && admin.id !== target.id) {
    return NextResponse.json({ error: "Le compte du propriétaire du site ne peut pas être modifié par un autre compte." }, { status: 403 });
  }
  if (target.isOwner && role !== "admin") {
    return NextResponse.json({ error: "Le propriétaire du site reste administrateur." }, { status: 400 });
  }

  const resetCredentials = form.get("resetCredentials") === "on";
  // Garde "dernier administrateur" atomique (audit du 2026-10-10, §2.21) : l'ancienne version
  // lisait "admins.length <= 1" puis ecrivait dans deux appels separes — deux requetes
  // concurrentes pouvaient toutes les deux lire "2 admins" avant que l'une ou l'autre n'ecrive,
  // et retirer chacune un admin different, laissant 0 administrateur (l'API REST D1 n'offre pas
  // de transaction app-level). Une seule instruction SQL dont le WHERE reevalue le compte au
  // moment meme de l'ecriture reste atomique au niveau du moteur SQLite (ecrivain unique), meme
  // sans transaction explicite — la 2e requete concurrente voit alors le compte deja retombe a 1
  // et son UPDATE n'affecte aucune ligne.
  const setClauses = ['"role" = ?'];
  const params: unknown[] = [role];
  if (resetCredentials) setClauses.push('"mustChangeCredentials" = 1');
  params.push(id, role);
  await execSql(
    `UPDATE "adminAccount" SET ${setClauses.join(", ")} WHERE "id" = ? AND ("role" != 'admin' OR ? = 'admin' OR (SELECT COUNT(*) FROM "adminAccount" WHERE "role" = 'admin') > 1)`,
    params,
  );

  const after = await db.orm.public.AdminAccount.select("role").where({ id }).first();
  if (after?.role !== role) {
    return NextResponse.json({ error: "Impossible de retirer le dernier administrateur." }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/admin/servers", request.url), 303);
}
