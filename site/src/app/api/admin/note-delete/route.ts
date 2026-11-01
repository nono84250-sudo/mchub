import { NextResponse } from "next/server";
import { db, execSql } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

// Suppression d'une note du staff (fiche joueur admin, demande de Rushi du 23/10). Reservee au
// proprietaire du site (adminAccount.isOwner) : ce n'est pas un droit de role, aucun autre compte
// admin ou moderateur ne peut l'obtenir. Les traces d'export des donnees (kind = 'export') ne
// sont jamais supprimables, meme par le proprietaire. Route a plat (pas sous players/[id]) : le
// chemin reste court pour les outils qui copient le dossier du projet.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  if (!admin.isOwner) {
    return NextResponse.json({ error: "Seul le propriétaire du site peut supprimer une note." }, { status: 403 });
  }

  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const note = id ? await db.orm.public.AdminNote.select("id", "userId", "kind").where({ id }).first() : null;
  if (!note) return NextResponse.json({ error: "Note introuvable." }, { status: 404 });
  if (note.kind === "export") {
    return NextResponse.json({ error: "Cette note est une trace d'export des données : elle ne peut pas être supprimée." }, { status: 403 });
  }

  // Le WHERE repete la condition sur kind : meme si la ligne changeait entre la lecture et
  // l'ecriture, une trace d'export ne peut pas partir par cette route.
  await execSql(`DELETE FROM "adminNote" WHERE "id" = ? AND "kind" != 'export'`, [id]);
  return NextResponse.redirect(new URL(`/admin/players/${note.userId}?noteDeleted=1`, request.url), 303);
}
