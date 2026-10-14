"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "@phosphor-icons/react";
import { addFriendAction, removeFriendAction, type AddFriendState } from "@/lib/actions/friends";
import { useI18n } from "@/i18n/I18nProvider";

export type FriendRow = {
  userId: string;
  minecraftUsername: string | null;
  online: boolean;
};

// Panneau "Amis" de la page /dashboard/amis — reçoit la liste initiale du Server Component
// parent (lib/friends.ts, lue avec la session courante), puis se raffraîchit lui-même
// (router.refresh()) après un ajout/retrait : addFriendAction() ne dit JAMAIS si l'ajout a
// réellement créé une amitié (anti-énumération, voir lib/friends.ts) — la seule façon pour le
// joueur de savoir si ça a marché est de voir l'ami apparaître (ou pas) dans la liste.
export function FriendsPanel({ friends }: { friends: FriendRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AddFriendState, FormData>(addFriendAction, undefined);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (state?.done) router.refresh();
  }, [state, router]);

  async function handleRemove(friendUserId: string) {
    setRemovingId(friendUserId);
    try {
      await removeFriendAction(friendUserId);
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

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
      {/* Message generique, jamais "ami ajouté" / "pseudo introuvable" : voir le commentaire
          au-dessus de ce composant. */}
      {state?.done ? <p className="mt-2 text-sm text-muted">{t("friends.addFeedback")}</p> : null}

      <ul className="mt-5 flex flex-col gap-2">
        {friends.length === 0 ? <p className="text-sm text-muted">{t("friends.empty")}</p> : null}
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
              onClick={() => handleRemove(friend.userId)}
              disabled={removingId === friend.userId}
              aria-label={t("friends.remove")}
              title={t("friends.remove")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-danger hover:bg-surface-raised"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
