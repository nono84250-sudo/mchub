import type { NextConfig } from "next";

// En-tetes de securite de base, absents jusqu'ici (voir audit de securite du
// 2026-09-28) — sans risque de casser le site : ne touchent ni aux scripts, ni
// aux images externes (bannerUrl/iconUrl arbitraires, voir ServerCard.tsx), donc
// pas de Content-Security-Policy ici pour l'instant (en ajouter une correcte
// demande un inventaire des domaines autorises et un systeme de nonce pour le
// script inline de app/layout.tsx — a faire a part).
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
