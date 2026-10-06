import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { adminForAction, backToServers } from "@/lib/adminServers";
import { createNotification, type NotificationType } from "@/lib/notifications";

// Message au propriétaire (pop-up du panel admin). Le type change la couleur côté launcher.
// « gel » n'est possible que sur un serveur gelé, et sert au message accompagnant le gel.
const KINDS: Record<string, NotificationType> = {
  gel: "server_frozen",
  info: "admin_info",
  warning: "admin_warning",
  error: "admin_error",
};

export async function POST(request: Request, ctx: RouteContext<"/api/admin/servers/[id]/message">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  const type = KINDS[kind];
  if (!type) return NextResponse.json({ error: "Type de message inconnu." }, { status: 400 });
  if (text.length < 3) return NextResponse.json({ error: "Écrivez un message (3 caractères minimum)." }, { status: 400 });

  const server = await db.orm.public.Server.select("id", "slug", "name", "frozenAt")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ id })
    .first();
  if (!server) return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });
  if (kind === "gel" && !server.frozenAt) {
    return NextResponse.json({ error: "Le type Gel n'est possible que sur un serveur gelé." }, { status: 400 });
  }
  if (!server.owner?.minecraftUuid) {
    return NextResponse.json({ error: "Le propriétaire n'a pas de compte Minecraft lié : impossible de le joindre." }, { status: 400 });
  }
  await createNotification({ recipientMinecraftUuid: server.owner.minecraftUuid, type, serverName: server.name, message: text });
  return backToServers(request, `/admin/servers/${server.slug}`);
}
