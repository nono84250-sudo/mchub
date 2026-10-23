"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { setServerTeamAction } from "@/lib/actions/team";

// Liste « Team » de Paramètres (teams, 19/10) : meme choix que l'interrupteur de « Ma team » et
// que la liste de la creation d'un serveur. Enregistre tout de suite, sans le bouton du
// formulaire principal (qui relance la verification d'un serveur public).
export function ServerTeamPicker({ serverId, teams, current }: { serverId: string; teams: { id: string; name: string }[]; current: string | null }) {
  const { t } = useI18n();
  const [value, setValue] = useState(current ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function change(next: string) {
    const before = value;
    setValue(next);
    setStatus("saving");
    const { ok } = await setServerTeamAction(serverId, next || null);
    if (ok) setStatus("saved");
    else {
      setValue(before);
      setStatus("error");
    }
  }

  return (
    <section className="panel mt-6 p-6 sm:p-8">
      <label htmlFor="server-team" className="field-label">
        {t("team.serverTeamLabel")}
      </label>
      {teams.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            id="server-team"
            value={value}
            onChange={(e) => change(e.target.value)}
            disabled={status === "saving"}
            className="field-input w-fit min-w-[220px]"
          >
            <option value="">{t("team.noTeam")}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          {status === "saved" ? (
            <span role="status" className="text-sm" style={{ color: "var(--success)" }}>
              ✓ {t("team.serverTeamSaved")}
            </span>
          ) : null}
          {status === "error" ? (
            <span role="alert" className="text-sm text-danger">
              {t("team.errors.generic")}
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        {teams.length ? t("team.serverTeamHint") : t("team.serverTeamNone")}{" "}
        <Link href="/dashboard/team" className="text-accent hover:underline">
          {t("team.title")}
        </Link>
      </p>
    </section>
  );
}
