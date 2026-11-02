import type { NextConfig } from "next";

// En-tetes de securite de base, absents jusqu'ici (voir audit de securite du
// 2026-09-28). Audit du 01/11 : une CSP, en deux temps. Ce qui ne peut rien casser s'applique
// tout de suite ; le reste est en observation seulement (les ecarts apparaissent dans la console du
// navigateur, rien n'est bloque). L'appliquer demandera un nonce pour le script inline de
// app/layout.tsx.
const CSP_ENFORCED = "object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
const CSP_OBSERVED = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src * data: blob:",
  "connect-src 'self' https://*.sentry.io https://*.ingest.de.sentry.io",
  "frame-src https://www.youtube-nocookie.com",
  "form-action 'self' https://login.microsoftonline.com",
  CSP_ENFORCED,
].join("; ");
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: CSP_ENFORCED },
  { key: "Content-Security-Policy-Report-Only", value: CSP_OBSERVED },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // L'ancienne page /account a rejoint le tableau de bord le 13/10 : les anciens liens (e-mails,
  // favoris, liens du launcher) ne doivent pas tomber sur une 404 (audit 14/10, F1).
  async redirects() {
    return [
      { source: "/account", destination: "/dashboard/parametres", permanent: true },
      // Audit du 01/11 : www répondait 200 sans rediriger (test si8).
      { source: "/:path*", has: [{ type: "host", value: "www.omniscientlauncher.com" }], destination: "https://omniscientlauncher.com/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
