import { isIPv4, isIPv6 } from "node:net";

// Empeche un serveur enregistre par un utilisateur (champ "ip", jamais
// verifie autrement) de faire sonder une adresse interne a l'infra
// d'hebergement par le ping de statut public (voir mc-ping.ts) — sondage
// TCP-connect exploitable pour scanner un reseau interne depuis Vercel.
// Verifie l'ADRESSE IP RESOLUE (pas le nom d'hote tel quel) et est appele a
// chaque ping, pas seulement a l'enregistrement, pour resister au DNS
// rebinding (un nom de domaine qui pointe vers une IP publique au moment de
// la sauvegarde puis vers une IP privee plus tard).
function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  const inRange = (base: string, maskBits: number) => {
    const baseValue = ipv4ToInt(base);
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (value & mask) === (baseValue & mask);
  };
  return (
    inRange("0.0.0.0", 8) || // "cette machine"
    inRange("10.0.0.0", 8) || // priv 24-bit
    inRange("100.64.0.0", 10) || // CGNAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local (inclut les metadonnees cloud, 169.254.169.254)
    inRange("172.16.0.0", 12) || // priv 20-bit
    inRange("192.168.0.0", 16) || // priv 16-bit
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserve
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // unique local (fc00::/7)
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

export function isPrivateOrReservedAddress(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateIPv4(ip);
  if (isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // ni IPv4 ni IPv6 valide : refuse par prudence plutot que de laisser passer
}
