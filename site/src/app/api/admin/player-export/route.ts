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

  const body = (await request.json().catch(() => null)) as { id?: unknown; categories?: unknown; email?: unknown; emailConfirmed?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const asked = Array.isArray(body?.categories) ? body.categories : [];
  const categories = EXPORT_CATEGORIES.filter((c) => asked.includes(c)) as ExportCategory[];
  const rawEmail = typeof body?.email === "string" ? body.email.trim().slice(0, 200) : "";
  const email = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
  if (rawEmail && !email) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  // Les messages de contact ne sont pas lies au compte : ne les joindre que si la demande d'acces
  // est arrivee depuis cette adresse, sinon n'importe qui pourrait obtenir ceux d'un tiers en
  // donnant son adresse (audit 14/10, I-8b). L'admin le confirme explicitement.
  if (email && body?.emailConfirmed !== true) {
    return NextResponse.json({ error: "Confirme que la demande est arrivée depuis cette adresse email, ou laisse le champ vide." }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  const result = await buildPlayerExport(id, { categories, email });
  if (!result) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  await db.orm.public.AdminNote.create({
    userId: id,
    // Trace complete (audit 14/10, I-8d) : categories exportees et adresse qui a fait la demande.
    text: `Export des données généré (droit d'accès) : compte${categories.length ? ", " + categories.join(", ") : ""}${email ? `. Messages de contact joints, demande reçue depuis ${email}` : ""}.`,
    createdBy: admin.username,
    // Note de trace verrouillee (23/10) : jamais supprimable, meme par le proprietaire, pour
    // garder la preuve de qui a recupere les donnees de qui (voir api/admin/note-delete).
    kind: "export",
  });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
