import { NextResponse } from "next/server";
import { adminForAction, backToServers } from "@/lib/adminServers";
import { markContactMessageRead } from "@/lib/contactMessages";

// Marque un message de contact comme lu (panel admin, /admin/contact). Meme garde que les
// autres actions d'ecriture du panel (adminForAction : origine same-origin + session admin).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/contact/[id]/read">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  await markContactMessageRead(id);
  return backToServers(request, "/admin/contact");
}
