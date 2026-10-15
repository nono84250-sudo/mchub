"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus, X } from "@phosphor-icons/react";
import { acceptFriendAction, addFriendAction, removeFriendAction, type AddFriendState } from "@/lib/actions/friends";
import { useI18n } from "@/i18n/I18nProvider";

export type FriendRow = {
  userId: string;
  minecraftUsername: string | null;
  online: boolean;
};

// Demande en attente (reçue ou envoyée) : jamais de statut en ligne, voir lib/friends.ts.
export type FriendRequestRow = {
  userId: string;
  minecraftUsername: string | null;
};

// Panneau "Amis" de la page /dashboard/amis — reçoit les listes initiales du Server Component
// parent (lib/friends.ts, lues avec la session courante), puis se raffraîchit lui-même
// (router.refresh()) après chaque action : addFriendAction() ne dit JAMAIS si la demande a
// réellement été créée (anti-énumération, voir lib/friends.ts).
export function FriendsPanel({
  friends,
  incoming,
  outgoing,
}: {
  friends: FriendRow[];
  incoming: FriendRequestRow[];
  outgoing: FriendRequestRow[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AddFriendState, FormData>(addFriendAction, undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (state?.done) router.refresh();
  }, [state, router]);

  async function run(userId: string, action: (id: string) => Promise<{ error: string } | void>) {
    setBusyId(userId);
    try {
      await action(userId);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const iconButton = "flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-raised";
  const nothing = friends.length === 0 && incoming.length === 0 && outgoing.length === 0;

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="username"
          placeholder={t("friends.addPlaceholder")}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        />
        <button type="submit" disabled={pending} className="btn-secondary flex items-center gap-1.5 text-sm">
          <UserPlus className="h-4 w-4" />
          {pending ? t("friends.adding") : t("friends.addButton")}
        </button>
      </form>

      {state?.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
      {/* Message generique, jamais "demande envoyée" / "pseudo introuvable" : voir le
          commentaire au-dessus de ce composant. */}
      {state?.done ? <p className="mt-2 text-sm text-muted">{t("friends.addFeedback")}</p> : null}

      {nothing ? <p className="mt-5 text-sm text-muted">{t("friends.empty")}</p> : null}

      {incoming.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t("friends.sectionIncoming")} ({incoming.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {incoming.map((request) => (
              <li
                key={request.userId}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                style={{ borderColor: "var(--accent)" }}
              >
                <span className="text-sm text-foreground">
                  {request.minecraftUsername ?? "?"}
                  <span className="ml-2 text-xs text-muted">{t("friends.incomingHint")}</span>
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => run(request.userId, acceptFriendAction)}
                    disabled={busyId === request.userId}
                    aria-label={t("friends.accept")}
                    title={t("friends.accept")}
                    className={`${iconButton} hover:text-success`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => run(request.userId, removeFriendAction)}
                    disabled={busyId === request.userId}
                    aria-label={t("friends.decline")}
                    title={t("friends.decline")}
                    className={`${iconButton} hover:text-danger`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {friends.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2">
          {friends.map((friend) => (
            <li
              key={friend.userId}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-foreground">
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    display: "inline-block",
                    flexShrink: 0,
                    background: friend.online ? "var(--success)" : "var(--muted)",
                  }}
                />
                {friend.minecraftUsername ?? "?"}
                <span className="text-xs text-muted">{friend.online ? t("friends.online") : t("friends.offline")}</span>
              </span>
              <button
                type="button"
                onClick={() => run(friend.userId, removeFriendAction)}
                disabled={busyId === friend.userId}
                aria-label={t("friends.remove")}
                title={t("friends.remove")}
                className={`${iconButton} hover:text-danger`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {outgoing.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t("friends.sectionOutgoing")} ({outgoing.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {outgoing.map((request) => (
              <li
                key={request.userId}
                className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2"
              >
                <span className="text-sm text-muted">
                  {request.minecraftUsername ?? "?"}
                  <span className="ml-2 text-xs">{t("friends.outgoingHint")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => run(request.userId, removeFriendAction)}
                  disabled={busyId === request.userId}
                  className="text-xs text-muted hover:text-danger"
                >
                  {t("friends.cancel")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
