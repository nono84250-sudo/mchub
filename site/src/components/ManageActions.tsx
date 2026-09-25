"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pause, Play, Copy, Trash, ArrowSquareOut } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

// Boutons d'action de "Paramètres" (voir maquette "05 · Settings") — avec confirmation avant toute
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
  const { t } = useI18n();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, message: string, action: () => Promise<void>) {
    if (!window.confirm(message)) return;
    setPending(key);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      // redirect() (deleteServer notamment) fonctionne en lançant une
      // exception spéciale reconnue par Next.js via son digest — jamais une
      // vraie erreur à afficher, à laisser remonter pour que la navigation
      // ait bien lieu.
      if (err && typeof err === "object" && "digest" in err && typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      setError(t("manage.actionFailed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <span className="tag-chip tag-chip-accent self-start">{published ? t("manage.published") : t("manage.paused")}</span>

        <button
          type="button"
          disabled={pending !== null}
          onClick={() =>
            run("toggle", published ? t("manage.confirmToggleOff") : t("manage.confirmToggleOn"), onTogglePublished)
          }
          className="btn-secondary text-sm"
        >
          {published ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {pending === "toggle" ? "..." : published ? t("manage.pause") : t("manage.republish")}
        </button>

        {published ? (
          <Link href={`/servers/${slug}`} className="btn-secondary text-sm">
            <ArrowSquareOut className="h-4 w-4" />
            {t("manage.viewPublicPage")}
          </Link>
        ) : null}

        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("duplicate", t("manage.confirmDuplicate"), onDuplicate)}
          className="btn-secondary text-sm"
        >
          <Copy className="h-4 w-4" />
          {pending === "duplicate" ? "..." : t("manage.duplicate")}
        </button>
      </div>

      <div
        className="flex flex-col items-start gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}
      >
        <div>
          <p className="text-sm font-medium text-foreground">{t("manage.deleteTitle")}</p>
          <p className="text-xs text-muted">{t("manage.deleteBody")}</p>
        </div>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("delete", t("manage.confirmDelete"), onDelete)}
          className="btn-secondary btn-secondary-danger text-sm flex-shrink-0"
        >
          <Trash className="h-4 w-4" />
          {pending === "delete" ? "..." : t("manage.delete")}
        </button>
      </div>
    </div>
  );
}
