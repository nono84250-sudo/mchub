import { ImageResponse } from "next/og";

// Image Open Graph / Twitter partagee par defaut sur tout le site (ecrasee
// par une fiche serveur via son propre bannerUrl quand elle en a un, voir
// servers/[slug]/page.tsx). Reprend le repere de marque du nav (LogoMark.tsx :
// carre pivote a 45°, contour accent) et les couleurs du theme sombre par
// defaut (globals.css) — ImageResponse (Satori) ne lit pas les variables CSS,
// donc les valeurs sont dupliquees ici en dur plutot qu'importees.
export const alt = "Omniscient — Annuaire de serveurs Minecraft";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BACKGROUND = "#161826";
const ACCENT = "#5fa3d3";
const FOREGROUND = "#e9e9ed";
const MUTED = "#9a9aa8";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: BACKGROUND,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              border: `4px solid ${ACCENT}`,
              transform: "rotate(45deg)",
            }}
          />
          <div style={{ fontSize: 88, fontWeight: 700, color: FOREGROUND, letterSpacing: -1 }}>
            Omniscient
          </div>
        </div>
        <div style={{ marginTop: 28, fontSize: 32, color: MUTED }}>
          Annuaire de serveurs Minecraft
        </div>
      </div>
    ),
    { ...size },
  );
}
