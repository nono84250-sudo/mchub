// Pastille rouge des non-lus (lot 6, 18/10) : barre du haut, menu, colonne de gauche, menu
// telephone. Rien quand il n'y a rien a lire. Servira aussi au compteur de demandes d'amis.
export function UnreadBadge({ count, className = "" }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={`inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-semibold leading-none text-white ${className}`}
      style={{ background: "var(--danger)" }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
