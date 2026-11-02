import { ADMIN_TIMEZONE } from "@/lib/timezone";

// Texte du message envoye aux joueurs quand l'admin programme une maintenance (25/10, demande de
// Rushi) : « ⚠ Maintenance de tout Omniscient le 27/10 à 15h00. Durée prévue : 3 h. ».
// En francais comme les autres messages ecrits par l'admin.

const UNITS: [string, number][] = [
  ["mois", 43200],
  ["semaine(s)", 10080],
  ["jour(s)", 1440],
  ["h", 60],
  ["min", 1],
];

// Deux unites au plus : « 1 jour(s) 4 h », « 2 semaine(s) 3 jour(s) », « 45 min ».
export function formatMaintenanceDuration(startsAt: Date, endsAt: Date): string {
  let minutes = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));
  const parts: string[] = [];
  for (const [name, size] of UNITS) {
    if (minutes < size) continue;
    const count = Math.floor(minutes / size);
    minutes -= count * size;
    parts.push(`${count} ${name}`);
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

function formatStart(date: Date): string {
  const day = date.toLocaleDateString("fr-FR", { timeZone: ADMIN_TIMEZONE, day: "2-digit", month: "2-digit" });
  const time = date.toLocaleTimeString("fr-FR", { timeZone: ADMIN_TIMEZONE, hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return `le ${day} à ${time}`;
}

export function buildMaintenanceNotice(input: { system: string; startsAt: Date; endsAt: Date | null; now: boolean; extra: string }): string {
  const what = input.system === "Tout" ? "de tout Omniscient" : `de ${input.system}`;
  const when = input.now ? "en cours" : formatStart(input.startsAt);
  const duration = input.endsAt ? `Durée prévue : ${formatMaintenanceDuration(input.startsAt, input.endsAt)}.` : "Durée indéterminée.";
  return `⚠ Maintenance ${what} ${when}. ${duration}${input.extra ? ` ${input.extra}` : ""}`;
}
