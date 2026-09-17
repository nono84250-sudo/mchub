import type { CSSProperties } from "react";

// Petit repère visuel "voxel" (cube isometrique generique, pas un asset du
// jeu) pour ancrer la marque dans l'univers Minecraft au-dela du nom seul.
export function CubeLogo({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" className={className} style={style} aria-hidden="true">
      <polygon points="16,2 28,9 16,16 4,9" fill="var(--accent)" opacity="0.95" />
      <polygon points="4,9 16,16 16,30 4,23" fill="var(--accent)" opacity="0.55" />
      <polygon points="28,9 16,16 16,30 28,23" fill="var(--accent-2)" opacity="0.75" />
    </svg>
  );
}
