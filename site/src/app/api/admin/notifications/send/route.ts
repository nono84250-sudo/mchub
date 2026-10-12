import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { broadcastNotification, resolveAudienceRecipients, type NotificationType } from "@/lib/notifications";
import { setSiteBanner, activateLauncherMaintenance } from "@/lib/platformSettings";
import { createScheduledBroadcast } from "@/lib/scheduledBroadcasts";
import { adminLocalToUtc, formatAdminTime } from "@/lib/timezone";
import { rateLimitResponse } from "@/lib/rateLimit";

// Compose un message diffuse (panel admin, voir /admin/notifications). Envoi immediat ou
// programme (voir "when" ci-dessous) ; l'audience "un joueur" existe deja depuis la fiche
// joueur, pas la peine de la dupliquer ici.
const TYPES: Record<string, NotificationType> = {
  announcement: "broadcast_announcement",
  maintenance: "broadcast_maintenance",
  alert: "broadcast_alert",
  promotion: "broadcast_promotion",
};

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-notifications-send", 20);
  if (limited) return limited;
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const typeKey = String(form.get("type") ?? "");
  const type = TYPES[typeKey];
  const audience = String(form.get("audience") ?? "");
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  // "Systeme concerne" n'existe que pour la maintenance (voir bind.ts) : un texte libre, pas un
  // vrai mecanisme qui bloque quoi que ce soit — juste affiche en tete du message.
  const system = String(form.get("system") ?? "").trim().slice(0, 60);
  const banner = form.get("banner") === "on";
  const blockLauncher = form.get("blockLauncher") === "on" && typeKey === "maintenance";
  const when = String(form.get("when") ?? "now");

  if (!type) return NextResponse.json({ error: "Type de message inconnu." }, { status: 400 });
  if (audience !== "everyone" && audience !== "owners") return NextResponse.json({ error: "Audience inconnue." }, { status: 400 });
  if (text.length < 3) return NextResponse.json({ error: "Écrivez un message (3 caractères minimum)." }, { status: 400 });
  const message = typeKey === "maintenance" && system ? `[${system}] ${text}` : text;

  if (when === "schedule") {
    const dateStr = String(form.get("scheduledDate") ?? "");
    const timeStr = String(form.get("scheduledTime") ?? "");
    if (!dateStr || !timeStr) return NextResponse.json({ error: "Choisissez une date et une heure." }, { status: 400 });
    const scheduledAt = adminLocalToUtc(dateStr, timeStr);
    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "L'heure programmée doit être dans le futur." }, { status: 400 });
    }
    await createScheduledBroadcast({
      type: typeKey as "announcement" | "maintenance" | "alert" | "promotion",
      audience,
      system: system || null,
      text,
      banner,
      blockLauncher,
      scheduledAt,
    });
    // Previent tout de suite que c'est programme (le message reel n'arrive qu'a l'heure dite,
    // voir processDueScheduledBroadcasts) — demande explicite : pas que pour la maintenance.
    const noticeRecipients = await resolveAudienceRecipients(audience);
    if (noticeRecipients.length > 0) {
      await broadcastNotification({
        recipientMinecraftUuids: noticeRecipients,
        type,
        serverName: "—",
        message: `Programmé pour ${formatAdminTime(scheduledAt)} : ${message}`,
        eventAt: scheduledAt.toISOString(),
      });
    }
    return NextResponse.redirect(new URL("/admin/notifications?scheduled=1", request.url), 303);
  }

  const recipients = await resolveAudienceRecipients(audience);
  if (recipients.length === 0) return NextResponse.json({ error: "Aucun destinataire pour cette audience." }, { status: 400 });
  const sent = await broadcastNotification({ recipientMinecraftUuids: recipients, type, serverName: "—", message });

  if (banner) await setSiteBanner({ type: typeKey as "announcement" | "maintenance" | "alert" | "promotion", text: message });
  if (blockLauncher) await activateLauncherMaintenance(message);

  return NextResponse.redirect(new URL(`/admin/notifications?sent=${sent}`, request.url), 303);
}
