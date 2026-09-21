"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pause, Play, Copy, Trash2, ExternalLink } from "lucide-react";

// Boutons d'action de "Vue d'ensemble" — avec confirmation avant toute
// action destructive/impactante (l'utilisateur a signale que le formulaire
// brut sans confirmation etait dangereux). La suppression est isolee dans
// son propre encadre (voir maquette "Nocturne") plutot que d'avoir le meme
// poids visuel que les actions courantes juste au-dessus.
export function ManageActions({
  slug,
  published,
  onTogglePublished,
  onDuplicate,
  onDelete,
}: {
  slug: string;
  published: boolean;
  onTogglePublished: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function run(key: string, message: string, action: () => Promise<void>) {
    if (!window.confirm(message)) return;
    setPending(key);
    try {
      await action();
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <span className="tag-chip tag-chip-accent self-start">{published ? "Publié" : "En pause"}</span>

        <button
          type="button"
          disabled={pending !== null}
          onClick={() =>
            run(
              "toggle",
              published
                ? "Mettre ce serveur en pause ? Il disparaîtra de l'annuaire public, de sa fiche et du launcher jusqu'à ce que tu le republies."
                : "Republier ce serveur ?",
              onTogglePublished,
            )
          }
          className="btn-secondary text-sm"
        >
          {published ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {pending === "toggle" ? "..." : published ? "Mettre en pause" : "Republier"}
        </button>

        {published ? (
          <Link href={`/servers/${slug}`} className="btn-secondary text-sm">
            <ExternalLink className="h-4 w-4" />
            Voir la fiche publique
          </Link>
        ) : null}

        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("duplicate", "Dupliquer ce serveur ? Une copie sera créée avec sa propre fiche.", onDuplicate)}
          className="btn-secondary text-sm"
        >
          <Copy className="h-4 w-4" />
          {pending === "duplicate" ? "..." : "Dupliquer"}
        </button>
      </div>

      <div
        className="flex flex-col items-start gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}
      >
        <div>
          <p className="text-sm font-medium text-foreground">Supprimer ce serveur</p>
          <p className="text-xs text-muted">Définitif — retire la fiche de partout.</p>
        </div>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("delete", "Supprimer définitivement ce serveur ? Cette action est irréversible.", onDelete)}
          className="btn-secondary btn-secondary-danger text-sm flex-shrink-0"
        >
          <Trash2 className="h-4 w-4" />
          {pending === "delete" ? "..." : "Supprimer"}
        </button>
      </div>
    </div>
  );
}
