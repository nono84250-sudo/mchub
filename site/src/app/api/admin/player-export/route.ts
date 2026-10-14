import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";
import { buildPlayerExport, EXPORT_CATEGORIES, type ExportCategory } from "@/lib/playerExport";

// « Récupérer les données du joueur » (fiche joueur admin) : renvoie le JSON complet et le
// résumé texte, puis laisse une trace dans les notes du staff. Réservé au rôle admin
// (adminForAction, requireAdminRole par défaut). Route à plat (pas sous players/[id]) : le
// chemin reste court pour les outils qui copient le dossier du projet.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;

  const body = (await request.json().catch(() => null)) as { id?: unknown; categories?: unknown; email?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const asked = Array.isArray(body?.categories) ? body.categories : [];
  const categories = EXPORT_CATEGORIES.filter((c) => asked.includes(c)) as ExportCategory[];
  const rawEmail = typeof body?.email === "string" ? body.email.trim().slice(0, 200) : "";
  const email = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
  if (rawEmail && !email) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  if (!id) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  const result = await buildPlayerExport(id, { categories, email, adminName: admin.username });
  if (!result) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  await db.orm.public.AdminNote.create({
    userId: id,
    text: `Export des données généré (droit d'accès) : ${categories.length + 1} catégories${email ? " + messages de contact" : ""}.`,
    createdBy: admin.username,
  });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
