"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { submitTagRequest, type TagRequestError } from "@/lib/actions/tagRequests";
import type { OwnerTagPanel, TagRequestStatus } from "@/lib/tagRequests";
import {
  TAG_MONTHLY_MAX,
  TAG_PENDING_MAX,
  TAG_WORD_MAX,
  findExistingTag,
  isBannedTagWord,
  normalizeTagWord,
  tagName,
  type CustomTag,
} from "@/lib/tagCatalog";

// Bloc « Il te manque une etiquette ? » de l'editeur de fiche (preview validee le 16/10,
// https://claude.ai/artifact/LqxLYcE8EmKzvYQKcK4CXE). Le mot tape n'est jamais affiche en public :
// l'equipe l'accepte, le relie a une etiquette existante ou le refuse (panel admin, page
// Etiquettes). Les memes controles sont refaits cote serveur (actions/tagRequests.ts) ; ici ils
// ne servent qu'a prevenir avant l'envoi. Les alias ne sont connus que du serveur : un doublon
// par alias est signale apres l'envoi, avec le meme message.

const PILL: Record<TagRequestStatus, string> = {
  pending: "bg-[color-mix(in_srgb,#d39b2a_22%,transparent)] text-foreground",
  accepted: "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success",
  merged: "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent",
  refused: "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger",
};

export function TagRequestBox({
  serverId,
  initial,
  custom,
  hasTag,
  onAdd,
}: {
  serverId: string;
  initial: OwnerTagPanel;
  custom: CustomTag[];
  hasTag: (tag: string) => boolean;
  onAdd: (tag: string) => boolean; // false : plus de place sur la fiche
}) {
  const { t, locale } = useI18n();
  const [panel, setPanel] = useState(initial);
  const [word, setWord] = useState("");
  const [serverExists, setServerExists] = useState<{ word: string; tag: string } | null>(null);
  const [error, setError] = useState<TagRequestError | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const name = (tag: string) => tagName(tag, locale, custom) || tag;
  const trimmed = word.trim();
  const normalized = normalizeTagWord(trimmed);
  const localExists = trimmed ? findExistingTag(trimmed, { custom, aliases: {} }) : null;
  const existsTag = localExists ?? (serverExists && serverExists.word === trimmed ? serverExists.tag : null);
  const banned = normalized.length >= 2 && isBannedTagWord(normalized);
  const tooShort = !!trimmed && normalized.length < 2;
  const limit = panel.pending >= TAG_PENDING_MAX ? "limitPending" : panel.month >= TAG_MONTHLY_MAX ? "limitMonth" : null;
  const canSend = !!trimmed && !banned && !tooShort && !existsTag && !limit && !pending;

  const say = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash((m) => (m === msg ? null : m)), 2500);
  };

  const send = () => {
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const res = await submitTagRequest(serverId, trimmed);
      if ("ok" in res) {
        setPanel(res.panel);
        setWord("");
        say(t("tagRequests.sent"));
      } else if ("exists" in res) setServerExists({ word: trimmed, tag: res.exists });
      else setError(res.error);
    });
  };

  const addExisting = (tag: string) => {
    if (onAdd(tag)) {
      setWord("");
      setServerExists(null);
      say(t("tagRequests.added"));
    } else setError("full" as TagRequestError);
  };

  const notice = (kind: "info" | "warn" | "bad", body: React.ReactNode) => (
    <div
      role="status"
      className={`rounded-lg px-3 py-2 text-sm text-foreground ${
        kind === "info"
          ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
          : kind === "warn"
            ? "bg-[color-mix(in_srgb,#d39b2a_18%,transparent)]"
            : "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]"
      }`}
    >
      {body}
    </div>
  );

  const detail = (r: OwnerTagPanel["requests"][number]) => {
    const tag = r.resultTagId;
    const onPage = !!tag && hasTag(tag);
    if (r.status === "pending") return t("tagRequests.dPending");
    if (r.status === "refused") return t("tagRequests.dRefused", { reason: t(`tagRequests.reasons.${r.refuseReason ?? 0}`) });
    const key = r.status === "accepted" ? (onPage ? "dAccepted" : "dAcceptedList") : onPage ? "dMerged" : "dMergedList";
    return t(`tagRequests.${key}`, { tag: tag ? name(tag) : "" });
  };

  const errorText = (e: string) => t(`tagRequests.errors.${e}`);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-3">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-foreground">{t("tagRequests.title")}</span>
        <p className="text-xs text-muted">{t("tagRequests.lead")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={word}
          maxLength={TAG_WORD_MAX}
          onChange={(e) => {
            setWord(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t("tagRequests.placeholder")}
          aria-label={t("tagRequests.title")}
          className="min-w-0 flex-[1_1_180px] rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        />
        <button type="button" onClick={send} disabled={!canSend} className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-45">
          {t("tagRequests.send")}
        </button>
      </div>

      {existsTag
        ? notice(
            "info",
            <>
              {t("tagRequests.exists", { tag: name(existsTag) })}
              {!hasTag(existsTag) ? (
                <button
                  type="button"
                  onClick={() => addExisting(existsTag)}
                  className="ml-2 rounded-md border border-border bg-surface px-2.5 py-0.5 text-[13px] font-medium text-foreground hover:border-accent"
                >
                  {t("tagRequests.addIt")}
                </button>
              ) : null}
            </>,
          )
        : null}
      {banned ? notice("bad", errorText("banned")) : null}
      {tooShort ? notice("warn", errorText("short")) : null}
      {limit ? notice("warn", errorText(limit)) : null}
      {error && error !== limit ? notice(error === "banned" ? "bad" : "warn", errorText(error)) : null}
      {flash ? <p role="status" className="text-xs font-medium text-success">{flash}</p> : null}

      <div className="flex flex-wrap gap-4 text-[13px] tabular-nums text-muted">
        <span>
          {t("tagRequests.pending")} <b className="font-semibold text-foreground">{panel.pending}/{TAG_PENDING_MAX}</b>
        </span>
        <span>
          {t("tagRequests.month")} <b className="font-semibold text-foreground">{panel.month}/{TAG_MONTHLY_MAX}</b>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t("tagRequests.mine")}</span>
        {panel.requests.length ? (
          <ul className="flex flex-col gap-2">
            {panel.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-background p-2.5">
                <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <span className="break-words text-sm font-semibold text-foreground">{r.word}</span>
                  <span className="text-xs text-muted">
                    {detail(r)} · {new Date(r.createdAt).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" })}
                  </span>
                  {(r.status === "accepted" || r.status === "merged") && r.resultTagId && !hasTag(r.resultTagId) ? (
                    <button
                      type="button"
                      onClick={() => addExisting(r.resultTagId!)}
                      className="mt-1 w-fit rounded-md border border-border bg-surface px-2.5 py-0.5 text-[12.5px] font-medium text-foreground hover:border-accent"
                    >
                      {t("tagRequests.addIt")}
                    </button>
                  ) : null}
                </div>
                <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[r.status]}`}>
                  {t(`tagRequests.status.${r.status}`)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border px-3 py-5 text-center text-muted">
            <strong className="text-sm font-semibold text-foreground">{t("tagRequests.emptyTitle")}</strong>
            <span className="text-xs">{t("tagRequests.emptyText")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
