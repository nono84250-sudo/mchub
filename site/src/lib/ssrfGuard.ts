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
    inRange("192.0.0.0", 24) || // affectations IETF
    inRange("192.0.2.0", 24) || // documentation (TEST-NET-1)
    inRange("192.168.0.0", 16) || // priv 16-bit
    inRange("198.18.0.0", 15) || // tests de performance
    inRange("198.51.100.0", 24) || // documentation (TEST-NET-2)
    inRange("203.0.113.0", 24) || // documentation (TEST-NET-3)
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserve
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true; // non specifiee / loopback
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // unique local (fc00::/7)
  // Prefixes de tunnel (audit §1.12) : encapsulent une adresse IPv4 potentiellement privee, ou
  // relaient vers un reseau que l'hebergeur ne maitrise pas forcement.
  if (normalized.startsWith("2002:")) return true; // 6to4 (2002::/16)
  if (normalized.startsWith("2001::") || /^2001:0{1,4}:/.test(normalized)) return true; // Teredo (2001::/32)
  if (normalized.startsWith("64:ff9b::") || normalized.startsWith("64:ff9b:1::")) return true; // NAT64 (64:ff9b::/96 et 64:ff9b:1::/48)
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

export function isPrivateOrReservedAddress(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateIPv4(ip);
  if (isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // ni IPv4 ni IPv6 valide : refuse par prudence plutot que de laisser passer
}
