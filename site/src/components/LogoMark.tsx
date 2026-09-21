// Repère de marque du systeme "Nocturne" (maquette client) : un simple carré
// pivoté à 45°, contour accent — remplace l'ancien cube isométrique dans la
// nav pour correspondre exactement à la maquette fournie.
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ border: "1.5px solid var(--accent)", transform: "rotate(45deg)", display: "inline-block", flexShrink: 0 }}
      aria-hidden="true"
    />
  );
}
