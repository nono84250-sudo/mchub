import { execSql } from "@/lib/db";

// Second audit du 14/10 (I2) : le proprietaire d'un serveur gele pouvait recreer une fiche avec
// la meme adresse et partager le nouveau code d'invitation. On compare les adresses sous une
// forme commune : nom d'hote en minuscules, sans point final, port compris (25565 par defaut).
export function normalizeServerAddress(raw: string): string {
  const a = raw.trim().toLowerCase();
  let host = a;
  let port = "";
  const bracketed = a.match(/^\[([^\]]+)\](?::(\d{1,5}))?$/);
  if (bracketed) {
    host = bracketed[1];
    port = bracketed[2] ?? "";
  } else if ((a.match(/:/g) ?? []).length === 1) {
    [host, port] = a.split(":");
  }
  host = host.replace(/\.+$/, "");
  return `${host}:${Number(port) > 0 ? Number(port) : 25565}`;
}

// Vrai si un AUTRE serveur gele utilise deja cette adresse. exceptServerId : la fiche modifiee
// elle-meme (un serveur gele garde le droit de corriger sa propre fiche).
export async function addressUsedByFrozenServer(ip: string, exceptServerId?: string): Promise<boolean> {
  const target = normalizeServerAddress(ip);
  const rows = ((await execSql(`SELECT "id", "ip" FROM "server" WHERE "frozenAt" IS NOT NULL`)) as unknown as { id: string; ip: string }[]) ?? [];
  return rows.some((r) => r.id !== exceptServerId && normalizeServerAddress(r.ip ?? "") === target);
}
