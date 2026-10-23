"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageSquare, PencilSimple, Plus, Trash, UsersThree } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { ImageDropzone } from "@/components/ImageDropzone";
import { TeamAvatar } from "@/components/TeamAvatar";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  deleteTeamAction,
  saveTeamAction,
  setServerTeamAction,
  submitTeamRequestAction,
  type TeamActionState,
  type TeamRequestActionState,
} from "@/lib/actions/team";
import type { MyServer, MyTeam, MyTeamRequest } from "@/lib/teams";
import {
  TEAM_DESCRIPTION_MAX,
  TEAM_FREE_COUNT,
  TEAM_NAME_MAX,
  TEAM_REQUEST_PROOF_MAX,
  TEAM_REQUEST_REASON_MAX,
  cleanTeamDescription,
  cleanTeamName,
  teamDescriptionError,
  teamNameError,
} from "@/lib/teamRules";

// Onglet « Ma team » du tableau de bord (teams, 19/10). Choix de Rushi (preview « Teams : choisir
// et plusieurs teams », A + A) : une carte par team (nom, icone, description), un interrupteur
// « Dans la team » par serveur (un serveur peut n'etre dans aucune team). Jusqu'a 3 teams sans
// demande (« 3 teams libres », 20/10) ; a partir de la 4e, « Demander une autre team » avec une
// preuve, validee par un admin. Les regles sont verifiees en direct ici
// (lib/teamRules.ts) puis revérifiees par le serveur (lib/teams.ts).
export function TeamEditor({
  teams,
  servers,
  lastRequest,
}: {
  teams: MyTeam[];
  servers: MyServer[];
  lastRequest: MyTeamRequest | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(teams[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const active = teams.find((x) => x.id === activeId) ?? teams[0] ?? null;

  if (!teams.length) {
    return creating ? (
      <TeamForm team={null} onDone={() => setCreating(false)} onSaved={() => router.refresh()} />
    ) : (
      <div className="panel mt-8 flex flex-col items-center gap-3 p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-raised text-muted">
          <UsersThree className="h-6 w-6" />
        </span>
        <p className="text-base font-semibold text-foreground">{t("team.emptyTitle")}</p>
        <p className="max-w-md text-sm text-muted">{t("team.intro")}</p>
        <button type="button" onClick={() => setCreating(true)} className="btn-fill">
          <Plus className="h-4 w-4" />
          {t("team.create")}
        </button>
      </div>
    );
  }

  return (
    <>
      {teams.length > 1 ? (
        <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label={t("team.title")}>
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              role="tab"
              aria-selected={team.id === active?.id}
              onClick={() => setActiveId(team.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 pr-3 text-sm font-semibold ${
                team.id === active?.id ? "border-accent text-foreground" : "border-border text-muted hover:text-foreground"
              }`}
            >
              <TeamAvatar team={team} size={22} />
              {team.name}
            </button>
          ))}
        </div>
      ) : null}
      {creating ? (
        <TeamForm
          team={null}
          onDone={() => setCreating(false)}
          onSaved={(id) => {
            setActiveId(id);
            router.refresh();
          }}
        />
      ) : teams.length < TEAM_FREE_COUNT ? (
        <div className="mt-4">
          <button type="button" onClick={() => setCreating(true)} className="btn-secondary">
            <Plus className="h-4 w-4" />
            {t("team.createAnother")}
          </button>
        </div>
      ) : null}
      {active ? <TeamCard key={active.id} team={active} onDeleted={() => router.refresh()} /> : null}
      {active ? <ServersPanel key={`s-${active.id}`} team={active} teams={teams} servers={servers} /> : null}
      {teams.length >= TEAM_FREE_COUNT ? <RequestPanel lastRequest={lastRequest} /> : null}
    </>
  );
}

function TeamCard({ team, onDeleted }: { team: MyTeam; onDeleted: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function remove() {
    const ok = await confirm({ title: t("team.deleteConfirmTitle"), body: t("team.deleteConfirmBody"), confirmLabel: t("team.delete"), tone: "danger" });
    if (!ok) return;
    startDelete(async () => {
      await deleteTeamAction(team.id);
      onDeleted();
    });
  }

  if (editing) {
    return (
      <>
        <TeamForm team={team} onDone={() => setEditing(false)} onSaved={() => router.refresh()} onDelete={remove} deleting={deleting} />
        {dialog}
      </>
    );
  }
  return (
    <div className="panel mt-6 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <TeamAvatar team={team} size={56} className="text-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-foreground">{team.name}</p>
          {team.description ? <p className="mt-1 text-sm text-muted">{team.description}</p> : null}
          <Link href={`/team/${team.slug}`} className="mt-2 inline-block text-[13px] text-accent hover:underline">
            omniscientlauncher.com/team/{team.slug}
          </Link>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="btn-secondary shrink-0 px-3 py-1.5 text-sm">
          <PencilSimple className="h-4 w-4" />
          {t("team.edit")}
        </button>
      </div>
    </div>
  );
}

function TeamForm({
  team,
  onDone,
  onSaved,
  onDelete,
  deleting,
}: {
  team: MyTeam | null;
  onDone: () => void;
  onSaved: (id: string) => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const { t, locale } = useI18n();
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [iconUrl, setIconUrl] = useState(team?.iconUrl ?? "");
  const [state, formAction, pending] = useActionState<TeamActionState, FormData>(saveTeamAction, undefined);
  // Les rappels changent a chaque rendu du parent : seul un nouvel enregistrement les declenche.
  const callbacks = useRef({ onSaved, onDone });
  callbacks.current = { onSaved, onDone };

  useEffect(() => {
    if (state && "savedAt" in state) {
      callbacks.current.onSaved(state.id);
      callbacks.current.onDone();
    }
  }, [state]);

  const liveNameError = name ? teamNameError(cleanTeamName(name)) : null;
  // « Nom reserve » n'est pas montre en direct : l'admin peut poser ces noms, le serveur tranche.
  const nameError = liveNameError === "nameReserved" ? null : liveNameError;
  const descriptionError = teamDescriptionError(cleanTeamDescription(description));
  const serverError = state && "error" in state ? state.error : null;
  const renameDate = team?.renameAllowedAt ? new Date(team.renameAllowedAt).toLocaleDateString(locale, { day: "numeric", month: "long" }) : null;
  const preview = { name: cleanTeamName(name) || "?", iconUrl: iconUrl || null };

  return (
    <form action={formAction} className="panel mt-6 flex flex-col gap-5 p-5">
      <input type="hidden" name="teamId" value={team?.id ?? ""} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="team-name" className="field-label">
          {t("team.nameLabel")}
        </label>
        <input
          id="team-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={TEAM_NAME_MAX + 8}
          required
          className="field-input"
          autoComplete="off"
        />
        <p className="text-xs text-muted">{t("team.nameHint")}</p>
        {renameDate ? <p className="text-xs text-muted">{t("team.renameAfter", { date: renameDate })}</p> : null}
        {nameError ? <p className="text-xs text-danger">{t(`team.errors.${nameError}`)}</p> : null}
      </div>

      <div className="max-w-[220px]">
        <ImageDropzone
          name="iconUrl"
          field="icon"
          defaultValue={iconUrl}
          label={t("team.iconLabel")}
          hint={t("team.iconHint")}
          placeholder={t("team.iconPlaceholder")}
          icon={ImageSquare}
          onChange={setIconUrl}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="team-description" className="field-label">
          {t("team.descriptionLabel")}
        </label>
        <textarea
          id="team-description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={TEAM_DESCRIPTION_MAX + 40}
          className="field-input"
        />
        <p className="flex justify-between gap-3 text-xs text-muted">
          <span>{t("team.descriptionHint")}</span>
          <span className={`tabular-nums ${cleanTeamDescription(description).length > TEAM_DESCRIPTION_MAX ? "text-danger" : ""}`}>
            {cleanTeamDescription(description).length} / {TEAM_DESCRIPTION_MAX}
          </span>
        </p>
        {descriptionError ? <p className="text-xs text-danger">{t(`team.errors.${descriptionError}`)}</p> : null}
      </div>

      {/* Apercu : la ligne affichee sous le nom de chaque serveur mis dans cette team. */}
      <div className="rounded-lg border border-border bg-surface-raised px-3 py-2.5">
        <p className="mb-1 text-[11px] uppercase tracking-[0.04em] text-muted">{t("team.preview")}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
          {t("team.by")}
          <TeamAvatar team={preview} />
          <span className="font-semibold text-foreground">{preview.name}</span>
        </p>
      </div>

      {serverError ? (
        <p role="alert" className="text-sm text-danger">
          {t(`team.errors.${serverError}`)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !!nameError || !!descriptionError || !name.trim()} className="btn-fill text-sm">
          {pending ? t("team.saving") : team ? t("team.save") : t("team.create")}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary text-sm">
          {t("team.cancel")}
        </button>
        {onDelete ? (
          <button type="button" onClick={onDelete} disabled={deleting} className="ml-auto inline-flex items-center gap-1.5 text-sm text-danger hover:underline">
            <Trash className="h-4 w-4" />
            {t("team.delete")}
          </button>
        ) : null}
      </div>
    </form>
  );
}

// Un interrupteur par serveur du compte : dans cette team, ou pas. Un serveur deja dans une autre
// team du compte y passe directement (un serveur n'a qu'une team).
function ServersPanel({ team, teams, servers }: { team: MyTeam; teams: MyTeam[]; servers: MyServer[] }) {
  const { t } = useI18n();
  const [teamOf, setTeamOf] = useState<Record<string, string | null>>(() => Object.fromEntries(servers.map((s) => [s.id, s.teamId])));
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const nameOf = (id: string | null) => teams.find((x) => x.id === id)?.name ?? null;

  async function toggle(serverId: string) {
    const before = teamOf[serverId] ?? null;
    const next = before === team.id ? null : team.id;
    setTeamOf((m) => ({ ...m, [serverId]: next }));
    setBusy(serverId);
    setFailed(false);
    const { ok } = await setServerTeamAction(serverId, next);
    if (!ok) {
      setTeamOf((m) => ({ ...m, [serverId]: before }));
      setFailed(true);
    }
    setBusy(null);
  }

  return (
    <section className="panel mt-6 p-5">
      <h2 className="text-xs font-bold uppercase tracking-[0.07em] text-accent">{t("team.serversTitle")}</h2>
      <p className="mt-1 text-[13px] text-muted">{t("team.serversHint")}</p>
      {servers.length ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {servers.map((s) => {
            const current = teamOf[s.id] ?? null;
            const on = current === team.id;
            const other = current && !on ? nameOf(current) : null;
            return (
              <li key={s.id} className="flex items-center gap-2.5 rounded-lg bg-surface-raised px-3 py-2 text-sm text-foreground">
                <span className="server-icon h-7 w-7 shrink-0 overflow-hidden text-xs">
                  {s.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    s.name.trim().charAt(0).toUpperCase() || "?"
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                <span className="hidden shrink-0 text-xs text-muted sm:inline">
                  {on ? t("team.inTeam") : other ? t("team.inOtherTeam", { name: other }) : t("team.noTeam")}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t("team.switchLabel", { server: s.name, team: team.name })}
                  disabled={busy === s.id}
                  onClick={() => toggle(s.id)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "border border-border bg-surface"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all ${on ? "left-[18px] bg-accent-foreground" : "left-[3px] bg-muted"}`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("team.serversEmpty")}</p>
      )}
      {failed ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {t("team.errors.generic")}
        </p>
      ) : null}
    </section>
  );
}

// « Demander une autre team » : une seule demande en attente a la fois. La premiere team se cree
// directement (au-dessus) ; celle-ci est validee par un admin, qui regarde la preuve.
function RequestPanel({ lastRequest }: { lastRequest: MyTeamRequest | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [state, formAction, pending] = useActionState<TeamRequestActionState, FormData>(submitTeamRequestAction, undefined);

  useEffect(() => {
    if (state && "sentAt" in state) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ferme le formulaire apres l'envoi
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const pendingRequest = lastRequest?.status === "pending" ? lastRequest : null;
  const refused = lastRequest?.status === "refused" ? lastRequest : null;
  const nameError = name ? teamNameError(cleanTeamName(name)) : null;
  const error = state && "error" in state ? state.error : null;
  const canSend = !!cleanTeamName(name) && !nameError && !!cleanTeamDescription(reason) && (!!proof.trim() || !!proofImageUrl);

  return (
    <section className="panel mt-6 p-5">
      <h2 className="text-xs font-bold uppercase tracking-[0.07em] text-accent">{t("team.requestTitle")}</h2>
      <p className="mt-1 text-[13px] text-muted">{t("team.requestIntro")}</p>
      {pendingRequest ? (
        <p className="mt-3 rounded-lg bg-surface-raised px-3 py-2 text-sm text-foreground">{t("team.requestPending", { name: pendingRequest.name })}</p>
      ) : null}
      {refused && !pendingRequest ? (
        <p className="mt-3 rounded-lg bg-surface-raised px-3 py-2 text-sm text-foreground">
          {t("team.requestRefused", { name: refused.name })} {refused.refuseReason}
        </p>
      ) : null}
      {state && "sentAt" in state ? (
        <p role="status" className="mt-3 text-sm" style={{ color: "var(--success)" }}>
          ✓ {t("team.requestSent")}
        </p>
      ) : null}

      {!pendingRequest && !open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary mt-3 text-sm">
          <Plus className="h-4 w-4" />
          {t("team.requestOpen")}
        </button>
      ) : null}

      {!pendingRequest && open ? (
        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="team-request-name" className="field-label">
              {t("team.requestName")}
            </label>
            <input
              id="team-request-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={TEAM_NAME_MAX + 8}
              required
              className="field-input"
              autoComplete="off"
            />
            {nameError ? <p className="text-xs text-danger">{t(`team.errors.${nameError}`)}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="team-request-reason" className="field-label">
              {t("team.requestReason")}
            </label>
            <textarea
              id="team-request-reason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={TEAM_REQUEST_REASON_MAX}
              required
              className="field-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="team-request-proof" className="field-label">
              {t("team.requestProof")}
            </label>
            <input
              id="team-request-proof"
              name="proof"
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              maxLength={TEAM_REQUEST_PROOF_MAX}
              className="field-input"
              autoComplete="off"
            />
            <p className="text-xs text-muted">{t("team.requestProofHint")}</p>
          </div>
          <div className="max-w-[320px]">
            <ImageDropzone
              name="proofImageUrl"
              field="gallery"
              defaultValue=""
              label={t("team.requestProofImage")}
              hint={t("team.requestProofImageHint")}
              placeholder={t("team.iconPlaceholder")}
              icon={ImageSquare}
              onChange={setProofImageUrl}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {t(`team.requestErrors.${error}`)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending || !canSend} className="btn-fill text-sm">
              {pending ? t("team.saving") : t("team.requestSend")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">
              {t("team.cancel")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
