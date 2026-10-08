import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";
import { broadcastNotification, type NotificationType } from "@/lib/notifications";
import { setSiteBanner } from "@/lib/platformSettings";

// Compose un message diffuse (panel admin, voir /admin/notifications). Portee volontairement
// reduite par rapport a la maquette : pas de programmation differee, pas de brouillon, pas de
// canal pop-up/banniere (voir bind.ts) — un envoi immediat dans la boite de reception du
// launcher, a trois audiences realisables avec ce qui existe deja.
const TYPES: Record<string, NotificationType> = {
  announcement: "broadcast_announcement",
  maintenance: "broadcast_maintenance",
  alert: "broadcast_alert",
  promotion: "broadcast_promotion",
};

export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const type = TYPES[String(form.get("type") ?? "")];
  const audience = String(form.get("audience") ?? "");
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  // "Systeme concerne" n'existe que pour la maintenance (voir bind.ts) : un texte libre, pas un
  // vrai mecanisme qui bloque quoi que ce soit — juste affiche en tete du message.
  const system = String(form.get("system") ?? "").trim().slice(0, 60);

  if (!type) return NextResponse.json({ error: "Type de message inconnu." }, { status: 400 });
  if (text.length < 3) return NextResponse.json({ error: "Écrivez un message (3 caractères minimum)." }, { status: 400 });
  const message = type === "broadcast_maintenance" && system ? `[${system}] ${text}` : text;

  let recipients: string[];
  if (audience === "one") {
    const playerId = String(form.get("playerId") ?? "");
    const player = await db.orm.public.User.select("minecraftUuid").where({ id: playerId }).first();
    if (!player?.minecraftUuid) return NextResponse.json({ error: "Joueur introuvable ou sans compte Minecraft lié." }, { status: 400 });
    recipients = [player.minecraftUuid];
  } else if (audience === "owners") {
    const [users, servers] = await Promise.all([
      db.orm.public.User.select("id", "minecraftUuid").all(),
      db.orm.public.Server.select("ownerId").all(),
    ]);
    const ownerIds = new Set(servers.map((s) => s.ownerId));
    recipients = users.filter((u) => ownerIds.has(u.id) && u.minecraftUuid).map((u) => u.minecraftUuid!);
  } else if (audience === "everyone") {
    const users = await db.orm.public.User.select("minecraftUuid").all();
    recipients = users.map((u) => u.minecraftUuid).filter((u): u is string => !!u);
  } else {
    return NextResponse.json({ error: "Audience inconnue." }, { status: 400 });
  }

  if (recipients.length === 0) return NextResponse.json({ error: "Aucun destinataire pour cette audience." }, { status: 400 });
  const sent = await broadcastNotification({ recipientMinecraftUuids: recipients, type, serverName: "—", message });

  if (form.get("banner") === "on") {
    const bannerType = String(form.get("type") ?? "") as "announcement" | "maintenance" | "alert" | "promotion";
    await setSiteBanner({ type: bannerType, text: message });
  }

  return NextResponse.redirect(new URL(`/admin/notifications?sent=${sent}`, request.url), 303);
}
