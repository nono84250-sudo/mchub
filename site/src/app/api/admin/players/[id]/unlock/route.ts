import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/players/[id]/unlock">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;

  const player = await db.orm.public.User.select("id").where({ id }).first();
  if (!player) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  await db.orm.public.User.where({ id }).update({ lockedAt: null, lockedReason: null, lockedBy: null });
  return NextResponse.redirect(new URL(`/admin/players/${id}`, request.url), 303);
}
