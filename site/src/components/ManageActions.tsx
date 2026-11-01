"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pause, Play, Copy, Trash, ArrowSquareOut } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { FROZEN_CHIP_STYLE, PENDING_CHIP_STYLE } from "@/lib/frozen";
import { useConfirm, type ConfirmOptions } from "@/components/ConfirmDialog";

// Boutons d'action de "Paramètres" (voir maquette "05 · Settings") — avec confirmation avant toute
// action destructive/impactante (l'utilisateur a signale que le formulaire
// brut sans confirmation etait dangereux). La suppression est isolee dans
// son propre encadre (voir maquette "Nocturne") plutot que d'avoir le meme
// poids visuel que les actions courantes juste au-dessus.
export function ManageActions({
  slug,
  serverName,
  published,
  isPrivate,
  frozen,
  verificationStatus,
  onTogglePublished,
  onDuplicate,
  onDelete,
}: {
  slug: string;
  // Nom du serveur : dans le titre des confirmations, et a recopier pour supprimer.
  serverName: string;
  published: boolean;
  // 2026-10-10 : une fiche privee n'a pas de fiche publique a afficher, meme si "published"
  // est a true (toute fiche privee le reste par defaut, voir lib/actions/servers.ts) — sans
  // cette prop le lien "Voir la fiche publique" menait a un 404.
  isPrivate: boolean;
  frozen: boolean;
  // 2026-10-10 : meme priorite d'affichage que manage/[id]/page.tsx (Overview) :
  // frozen > pending > rejected > published > paused.
  verificationStatus: "approved" | "pending" | "rejected";
  // 2026-10-10 : peut desormais renvoyer {error} (serveur gele) plutot que de reussir
  // silencieusement sans rien faire — voir lib/actions/servers.ts.
  onTogglePublished: () => Promise<{ error: string } | undefined>;
  onDuplicate: () => Promise<{ error: string } | undefined>;
  onDelete: () => Promise<void>;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const name = serverName;

  async function run(key: string, ask: ConfirmOptions, action: () => Promise<{ error: string } | undefined | void>) {
    if (!(await confirm(ask))) return;
    setPending(key);
    setError(null);
    try {
      const result = await action();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
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
      {dialog}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <span
          className={
            frozen || verificationStatus !== "approved" || !published || isPrivate
              ? "tag-chip self-start"
              : "tag-chip tag-chip-accent self-start"
          }
          style={
            frozen
              ? FROZEN_CHIP_STYLE
              : verificationStatus === "pending"
                ? PENDING_CHIP_STYLE
                : verificationStatus === "rejected"
                  ? { color: "var(--danger)" }
                  : undefined
          }
        >
          {frozen
            ? t("manage.frozen")
            : verificationStatus === "pending"
              ? t("manage.pendingVerification")
              : verificationStatus === "rejected"
                ? t("manage.rejectedVerification")
                : published && !isPrivate
                  ? t("manage.published")
                  : isPrivate
                    ? t("manage.notPublished")
                    : t("manage.paused")}
        </span>

        {frozen ? (
          <p className="text-sm text-muted">{t("manage.frozenHint")}</p>
        ) : (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() =>
              run(
                "toggle",
                published
                  ? { tone: "warn", title: t("manage.confirmPauseTitle", { name }), body: t("manage.confirmPauseBody"), confirmLabel: t("manage.confirmPauseBtn") }
                  : { tone: "ok", title: t("manage.confirmRepublishTitle", { name }), body: t("manage.confirmRepublishBody"), confirmLabel: t("manage.confirmRepublishBtn") },
                onTogglePublished,
              )
            }
            className="btn-secondary text-sm"
          >
            {published ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {pending === "toggle" ? "..." : published ? t("manage.pause") : t("manage.republish")}
          </button>
        )}

        {published && !isPrivate && verificationStatus === "approved" ? (
          <Link href={`/servers/${slug}`} className="btn-secondary text-sm">
            <ArrowSquareOut className="h-4 w-4" />
            {t("manage.viewPublicPage")}
          </Link>
        ) : null}

        <button
          type="button"
          disabled={pending !== null || frozen}
          onClick={() =>
            run(
              "duplicate",
              { tone: "ok", title: t("manage.confirmDuplicateTitle", { name }), body: t("manage.confirmDuplicateBody"), confirmLabel: t("manage.confirmDuplicateBtn") },
              onDuplicate,
            )
          }
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
          onClick={() =>
            run(
              "delete",
              {
                tone: "danger",
                title: t("manage.confirmDeleteTitle", { name }),
                body: t("manage.confirmDeleteBody"),
                confirmLabel: t("manage.confirmDeleteBtn"),
                // Choix de Rushi (18/10) : le bouton reste grise tant que le nom exact n'est pas tape.
                typeToConfirm: name,
              },
              onDelete,
            )
          }
          className="btn-secondary btn-secondary-danger text-sm flex-shrink-0"
        >
          <Trash className="h-4 w-4" />
          {pending === "delete" ? "..." : t("manage.delete")}
        </button>
      </div>
    </div>
  );
}
