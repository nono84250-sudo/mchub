import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

// Note privee entre admins sur un compte joueur (pop-up "Add note", section Staff notes).
// Jamais montree au joueur.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/players/[id]/notes">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  if (text.length < 3) return NextResponse.json({ error: "Écrivez une note (3 caractères minimum)." }, { status: 400 });

  const player = await db.orm.public.User.select("id").where({ id }).first();
  if (!player) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  await db.orm.public.AdminNote.create({ userId: id, text, createdBy: admin.username });
  return NextResponse.redirect(new URL(`/admin/players/${id}`, request.url), 303);
}
