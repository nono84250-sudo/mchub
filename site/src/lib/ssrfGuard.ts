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

// Audit du 01/11 : comparaison sur les 8 groupes de 16 bits et non sur le texte, qui acceptait
// 0:0:0:0:0:0:0:1 ou une adresse mappee ecrite en hexadecimal (::ffff:7f00:1).
function ipv6Groups(ip: string): number[] {
  // Ecrit les 4 derniers octets d'une forme "...:1.2.3.4" en deux groupes hexadecimaux.
  const dotted = ip.toLowerCase().split("%")[0].replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_, a, b, c, d) => {
    return `${((Number(a) << 8) | Number(b)).toString(16)}:${((Number(c) << 8) | Number(d)).toString(16)}`;
  });
  const [head, tail] = dotted.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = dotted.includes("::") ? 8 - left.length - right.length : 0;
  return [...left, ...Array(missing).fill("0"), ...right].map((g) => parseInt(g, 16));
}

function isPrivateIPv6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (g.length !== 8 || g.some((n) => !Number.isInteger(n))) return true; // illisible : refuse par prudence
  const zeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeroUpTo(7) && g[7] <= 1) return true; // non specifiee / loopback
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local (fe80::/10)
  if ((g[0] & 0xfe00) === 0xfc00) return true; // unique local (fc00::/7)
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast (ff00::/8)
  // Prefixes de tunnel (audit §1.12) : encapsulent une adresse IPv4 potentiellement privee, ou
  // relaient vers un reseau que l'hebergeur ne maitrise pas forcement.
  if (g[0] === 0x2002) return true; // 6to4 (2002::/16)
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo (2001::/32)
  if (g[0] === 0x0064 && g[1] === 0xff9b) return true; // NAT64 (64:ff9b::/96 et 64:ff9b:1::/48)
  // IPv4 cachee : mappee (::ffff:a.b.c.d), traduite (::ffff:0:a.b.c.d) ou compatible (::a.b.c.d).
  if (zeroUpTo(5) && (g[5] === 0xffff || g[5] === 0)) return isPrivateIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  if (zeroUpTo(4) && g[4] === 0xffff && g[5] === 0) return isPrivateIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  return false;
}

export function isPrivateOrReservedAddress(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateIPv4(ip);
  if (isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // ni IPv4 ni IPv6 valide : refuse par prudence plutot que de laisser passer
}
