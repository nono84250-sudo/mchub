import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

// Recours contre un gel de serveur : "second avis obligatoire à effet suspensif" plutôt
// qu'un système de tickets/messagerie (design validé avec l'utilisateur). Réutilise le pattern
// pending/approved/rejected + appendHistory déjà en place pour la vérification (voir
// lib/verification.ts) plutôt que de construire un nouveau flux de discussion.
//
// Un seul admin aujourd'hui, d'autres viendront plus tard : quand un AUTRE admin que celui qui
// a gelé existe, il est assigné (appealAssignedAdminId) et c'est un vrai second avis. S'il n'y
// en a aucun, on reste en "auto-révision" (appealAssignedAdminId = null) — le même admin qui a
// gelé réexamine après un délai de réflexion. Les deux cas utilisent exactement le même champ
// appealStatus/appealHistory ; seul le texte affiché au propriétaire diffère (jamais prétendre
// qu'un autre humain a regardé si ce n'est pas vrai).

export type AppealStatus = "pending" | "resolved";
export type AppealHistoryEntry = { at: string; text: string };
type HistoryEntry = AppealHistoryEntry;

const APPEAL_WINDOW_MS = 72 * 60 * 60 * 1000;

// Exportee pour la page admin (voir admin/servers/[slug]/page.tsx) : le detail du recours est
// pre-parse avant d'etre passe a serverDetailHtml (bind.ts), meme logique que
// getVerificationDetail pour verificationHistory — bind.ts ne fait jamais de JSON.parse lui-meme.
export function parseAppealHistory(raw: string | null | undefined): AppealHistoryEntry[] {
  return parseHistory(raw);
}

function parseHistory(raw: string | null | undefined): HistoryEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Demande du propriétaire ("Demander un second avis", manage/[id]/page.tsx) : fixe le délai de
// 72h et assigne un admin différent de celui qui a gelé quand c'est possible. Refuse si le
// serveur n'est pas gelé ou si une demande est déjà en cours (pas de spam).
export async function requestServerAppeal(serverId: string, ownerId: string): Promise<{ error: string } | undefined> {
  const server = await db.orm.public.Server.where({ id: serverId, ownerId }).first();
  if (!server) return { error: "Ce serveur n'existe pas ou ne t'appartient pas." };
  if (!server.frozenAt) return { error: "Ce serveur n'est pas gelé." };
  if (server.appealStatus === "pending") return { error: "Une demande est déjà en cours pour ce serveur." };

  const admins = await db.orm.public.AdminAccount.select("id", "username").all();
  const other = (admins as { id: string; username: string }[]).find((a) => a.username !== server.frozenBy);
  const assignedAdminId = other?.id ?? null;

  const now = new Date();
  const deadline = new Date(now.getTime() + APPEAL_WINDOW_MS);
  const history = parseHistory(server.appealHistory);
  history.push({
    at: now.toISOString(),
    text: assignedAdminId
      ? "Second avis demandé par le propriétaire — un autre administrateur doit statuer"
      : "Délai de réflexion demandé par le propriétaire — un seul administrateur actif, réexamen par la même personne",
  });

  await db.orm.public.Server.where({ id: serverId }).update({
    appealStatus: "pending",
    appealRequestedAt: now.toISOString(),
    appealDeadline: deadline.toISOString(),
    appealAssignedAdminId: assignedAdminId,
    appealHistory: JSON.stringify(history),
  });
  return undefined;
}

// Décision admin sur un recours en cours ("Confirmer le gel" / "Annuler le gel", fiche serveur
// admin). "cancelled" ne touche pas aux colonnes frozenAt/frozenReason/frozenBy/published : ça
// reste la responsabilité de la route unfreeze existante, qui appelle cette fonction juste après
// avoir dégelé pour clore le recours — voir /api/admin/servers/[id]/unfreeze.
export async function resolveServerAppeal(serverId: string, decision: "confirmed" | "cancelled", adminUsername: string): Promise<void> {
  const server = await db.orm.public.Server.where({ id: serverId }).first();
  if (!server) return;
  const history = parseHistory(server.appealHistory);
  history.push({
    at: new Date().toISOString(),
    text: decision === "confirmed" ? `Gel confirmé par ${adminUsername} après recours` : `Gel annulé par ${adminUsername} après recours`,
  });
  await db.orm.public.Server.where({ id: serverId }).update({
    appealStatus: "resolved",
    appealHistory: JSON.stringify(history),
  });
}

// Appelée par /api/cron/process-appeals (toutes les 5 min, voir cron-worker/src/index.js) :
// dégèle automatiquement tout serveur dont le délai de recours (72h) est écoulé sans décision
// admin — "effet suspensif" oblige, l'absence de décision ne doit jamais geler indéfiniment.
export async function processDueAppeals(): Promise<number> {
  const nowIso = new Date().toISOString();
  const rows = await db.orm.public.Server.select("id", "name", "appealHistory")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ appealStatus: "pending" })
    .where((s) => s.appealDeadline.lt(nowIso))
    .all();

  for (const row of rows as { id: string; name: string; appealHistory: string; owner: { minecraftUuid: string | null } | null }[]) {
    const history = parseHistory(row.appealHistory);
    history.push({ at: nowIso, text: "Dégelé automatiquement — délai de 72h écoulé sans décision" });
    await db.orm.public.Server.where({ id: row.id }).update({
      frozenAt: null,
      frozenReason: null,
      frozenBy: null,
      published: true,
      appealStatus: "resolved",
      appealHistory: JSON.stringify(history),
    });
    if (row.owner?.minecraftUuid) {
      await createNotification({
        recipientMinecraftUuid: row.owner.minecraftUuid,
        type: "admin_info",
        serverName: row.name,
        message: "Votre serveur a été dégelé automatiquement : le délai de recours de 72h est écoulé sans décision.",
      });
    }
  }
  return rows.length;
}
