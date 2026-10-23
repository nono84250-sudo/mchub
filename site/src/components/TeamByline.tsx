"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { TeamAvatar } from "@/components/TeamAvatar";
import type { TeamBadge } from "@/lib/teamRules";

// Ligne sous le nom d'un serveur (teams, 19/10, choix « B » de Rushi) :
//   team normale     : « Par la team [icone] Nom » (lien vers la page de team) ;
//   team Omniscient  : « Proposé par [icone] Omniscient · C'est ton serveur ? », qui deplie la
//                      description et un bouton « Nous contacter » (page Contact, sujet
//                      « C'est mon serveur » deja choisi).
// Meme logique dans le launcher (renderer.js, renderTeamByline).
export function TeamByline({ team, serverSlug, className = "" }: { team: TeamBadge; serverSlug: string; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const name = (
    <Link href={`/team/${team.slug}`} className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-accent">
      <TeamAvatar team={team} />
      {team.name}
    </Link>
  );

  if (!team.official) {
    return (
      <p className={`flex flex-wrap items-center gap-1.5 text-[13px] text-muted ${className}`}>
        {t("team.by")} {name}
      </p>
    );
  }

  return (
    <div className={className}>
      <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        {t("team.proposedBy")} {name}
        <span aria-hidden="true">·</span>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="font-semibold text-accent hover:underline">
          {t("team.isItYours")}
        </button>
      </p>
      {open ? (
        <div className="mt-2 flex max-w-xl flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-foreground">
          <span className="min-w-0 flex-1 basis-56">{team.description || t("team.officialFallback")}</span>
          <Link href={`/contact?sujet=claim&serveur=${encodeURIComponent(serverSlug)}`} className="btn-fill px-3 py-1.5 text-[13px]">
            {t("team.contactUs")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
