import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { broadcastNotification, resolveAudienceRecipients, type NotificationType } from "@/lib/notifications";
import { setSiteBanner, scheduleMaintenance, MAINTENANCE_SYSTEMS, type MaintenanceSystem } from "@/lib/platformSettings";
import { buildMaintenanceNotice } from "@/lib/maintenanceNotice";
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
  const banner = form.get("banner") === "on";
  const when = String(form.get("when") ?? "now");

  if (!type) return NextResponse.json({ error: "Type de message inconnu." }, { status: 400 });
  if (audience !== "everyone" && audience !== "owners") return NextResponse.json({ error: "Audience inconnue." }, { status: 400 });
  if (typeKey === "maintenance") return sendMaintenance(request, form, { audience, text, banner, when });
  if (text.length < 3) return NextResponse.json({ error: "Écrivez un message (3 caractères minimum)." }, { status: 400 });
  const message = text;

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
      system: null,
      text,
      banner,
      blockLauncher: false,
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

  return NextResponse.redirect(new URL(`/admin/notifications?sent=${sent}`, request.url), 303);
}

// 25/10 (demande de Rushi) : la maintenance passe par ce formulaire. Systeme + debut (maintenant ou
// programme) + fin (date et heure, ou pas de fin). Les joueurs sont prevenus TOUT DE SUITE ; le
// blocage commence a l'heure de debut et s'arrete seul a l'heure de fin (phase calculee a la
// lecture, voir maintenancePhase), sans cron. Seuls "Tout" et "Launcher" bloquent le launcher.
async function sendMaintenance(
  request: Request,
  form: FormData,
  input: { audience: "everyone" | "owners"; text: string; banner: boolean; when: string },
) {
  const system = String(form.get("system") ?? "");
  if (!MAINTENANCE_SYSTEMS.includes(system as MaintenanceSystem)) {
    return NextResponse.json({ error: "Choisissez le système concerné." }, { status: 400 });
  }
  const now = input.when !== "schedule";
  let startsAt = new Date();
  if (!now) {
    const dateStr = String(form.get("scheduledDate") ?? "");
    const timeStr = String(form.get("scheduledTime") ?? "");
    if (!dateStr || !timeStr) return NextResponse.json({ error: "Choisissez la date et l'heure de début." }, { status: 400 });
    startsAt = adminLocalToUtc(dateStr, timeStr);
    if (startsAt.getTime() <= Date.now()) return NextResponse.json({ error: "Le début doit être dans le futur." }, { status: 400 });
  }
  let endsAt: Date | null = null;
  if (form.get("endMode") === "end") {
    const dateStr = String(form.get("endDate") ?? "");
    const timeStr = String(form.get("endTime") ?? "");
    if (!dateStr || !timeStr) return NextResponse.json({ error: "Choisissez la date et l'heure de fin, ou « Pas de fin prévue »." }, { status: 400 });
    endsAt = adminLocalToUtc(dateStr, timeStr);
    if (endsAt.getTime() <= startsAt.getTime()) return NextResponse.json({ error: "La fin doit être après le début." }, { status: 400 });
  }

  const notice = buildMaintenanceNotice({ system, startsAt, endsAt, now, extra: input.text });
  await scheduleMaintenance({ message: notice, system: system as MaintenanceSystem, startsAt, endsAt });

  const recipients = await resolveAudienceRecipients(input.audience);
  const sent = recipients.length
    ? await broadcastNotification({
        recipientMinecraftUuids: recipients,
        type: "broadcast_maintenance",
        serverName: "—",
        message: notice,
        eventAt: startsAt.toISOString(),
      })
    : 0;
  if (input.banner) await setSiteBanner({ type: "maintenance", text: notice }, endsAt ? endsAt.toISOString() : null);
  return NextResponse.redirect(new URL(`/admin/notifications?sent=${sent}`, request.url), 303);
}
