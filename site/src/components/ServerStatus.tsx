type ServerStatusProps = {
  playerCount: number | null;
  playerCapacity: number | null;
};

export function ServerStatus({ playerCount, playerCapacity }: ServerStatusProps) {
  const online = playerCount !== null;

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span
        className={`h-1.5 w-1.5 rounded-full ${online ? "bg-success shadow-[0_0_6px_rgba(45,216,138,0.8)]" : "bg-muted"}`}
        aria-hidden="true"
      />
      {online ? (
        <span>
          {playerCount} joueur{playerCount === 1 ? "" : "s"} en ligne
          {playerCapacity !== null ? ` / ${playerCapacity}` : ""}
        </span>
      ) : (
        <span>Statut inconnu</span>
      )}
    </div>
  );
}
