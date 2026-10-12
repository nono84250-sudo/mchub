import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

// Ajoute un avertissement sur la fiche joueur (pop-up "Add warning"). Purement
// informatif pour l'instant : rien ne gele/verrouille automatiquement le compte
// a un certain seuil (contrairement au texte de la maquette) — c'est a l'admin
// de geler/verrouiller lui-meme si besoin.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/players/[id]/warnings">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  if (reason.length < 3) return NextResponse.json({ error: "Indiquez un motif (3 caractères minimum)." }, { status: 400 });

  const player = await db.orm.public.User.select("id").where({ id }).first();
  if (!player) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  await db.orm.public.PlayerWarning.create({ userId: id, reason, createdBy: admin.username });
  return NextResponse.redirect(new URL(`/admin/players/${id}`, request.url), 303);
}
