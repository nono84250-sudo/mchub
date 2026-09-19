"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Boutons d'action de "Vue d'ensemble" — avec confirmation avant toute
// action destructive/impactante (l'utilisateur a signale que le formulaire
// brut sans confirmation etait dangereux) et un vrai style de bouton
// (btn-secondary) plutot que de simples liens texte.
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
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <span className="tag-chip">{published ? "Publié" : "En pause"}</span>

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
        {pending === "toggle" ? "..." : published ? "Mettre en pause" : "Republier"}
      </button>

      {published ? (
        <Link href={`/servers/${slug}`} className="btn-secondary text-sm">
          Voir la fiche publique
        </Link>
      ) : null}

      <button
        type="button"
        disabled={pending !== null}
        onClick={() => run("duplicate", "Dupliquer ce serveur ? Une copie sera créée avec sa propre fiche.", onDuplicate)}
        className="btn-secondary text-sm"
      >
        {pending === "duplicate" ? "..." : "Dupliquer ce serveur"}
      </button>

      <button
        type="button"
        disabled={pending !== null}
        onClick={() => run("delete", "Supprimer définitivement ce serveur ? Cette action est irréversible.", onDelete)}
        className="btn-secondary btn-secondary-danger text-sm"
      >
        {pending === "delete" ? "..." : "Supprimer ce serveur"}
      </button>
    </div>
  );
}
