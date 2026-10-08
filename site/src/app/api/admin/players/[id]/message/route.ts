import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";
import { createNotification, type NotificationType } from "@/lib/notifications";

// Message direct a un joueur (pop-up de la fiche joueur) — pas de type "gel" ici, contrairement
// au message depuis une fiche serveur : rien ne gele un compte joueur aujourd'hui.
const KINDS: Record<string, NotificationType> = { info: "admin_info", warning: "admin_warning", error: "admin_error" };

export async function POST(request: Request, ctx: RouteContext<"/api/admin/players/[id]/message">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  const type = KINDS[kind];
  if (!type) return NextResponse.json({ error: "Type de message inconnu." }, { status: 400 });
  if (text.length < 3) return NextResponse.json({ error: "Écrivez un message (3 caractères minimum)." }, { status: 400 });

  const player = await db.orm.public.User.select("id", "minecraftUuid").where({ id }).first();
  if (!player) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });
  if (!player.minecraftUuid) {
    return NextResponse.json({ error: "Ce compte n'a pas de compte Minecraft lié : impossible de le joindre." }, { status: 400 });
  }
  // serverName est un champ obligatoire du modele Notification (toujours rempli jusqu'ici par
  // un vrai nom de serveur) : ce message n'est rattache a aucun serveur, d'ou ce tiret neutre
  // plutot qu'une migration pour le rendre optionnel pour ce seul cas.
  await createNotification({ recipientMinecraftUuid: player.minecraftUuid, type, serverName: "—", message: text });
  return NextResponse.redirect(new URL(`/admin/players/${id}`, request.url), 303);
}
