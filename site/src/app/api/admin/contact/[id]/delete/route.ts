import { NextResponse } from "next/server";
import { adminForAction, backToServers } from "@/lib/adminServers";
import { deleteContactMessage } from "@/lib/contactMessages";

// Supprime definitivement un message de contact (panel admin, /admin/contact). Meme garde que
// la route "read" a cote (adminForAction : origine same-origin + session admin).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/contact/[id]/delete">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  if (!(await deleteContactMessage(id))) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  return backToServers(request, "/admin/contact");
}
