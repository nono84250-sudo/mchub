// Toutes les heures programmees (panel admin, voir /admin/notifications) sont saisies dans
// le fuseau de l'admin plutot que converties a la main a chaque fois.
export const ADMIN_TIMEZONE = "Europe/Brussels";

// Convertit un "date" + "heure" tels que saisis par l'admin (toujours en heure de Belgique) en
// instant UTC correct. Truc classique sans dependance : on formate la meme date naive dans le
// fuseau cible et en UTC, la difference des deux donne le decalage a appliquer. Precision a la
// minute pres, largement suffisant ici (pas de calcul de paie).
export function adminLocalToUtc(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const asZoned = new Date(naive.toLocaleString("en-US", { timeZone: ADMIN_TIMEZONE }));
  const asUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = asUtc.getTime() - asZoned.getTime();
  return new Date(naive.getTime() + offsetMs);
}

// "jeudi 9 octobre 2026 à 14:00" — l'heure "officielle" affichee a tout le monde, quel que
// soit son propre fuseau.
export function formatAdminTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("fr-FR", { timeZone: ADMIN_TIMEZONE, dateStyle: "full", timeStyle: "short" });
}
