"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GlobeHemisphereWest, LockSimple, Copy, ArrowsClockwise, Image, Cube, ImageSquare } from "@phosphor-icons/react";
import type { ServerActionState } from "@/lib/actions/servers";
import { resetInviteCode } from "@/lib/actions/servers";
import { ImageDropzone } from "@/components/ImageDropzone";
import { ModpackPicker } from "@/components/ModpackPicker";
import { MinecraftVersionField } from "@/components/MinecraftVersionField";
import { DEFAULT_MODPACK_SOURCE, type ModpackSource } from "@/lib/modpack-types";
import { useI18n } from "@/i18n/I18nProvider";

type ServerFormValues = {
  name: string;
  description: string;
  bannerUrl: string;
  iconUrl: string;
  backgroundUrl: string;
  isPrivate: boolean;
  type: "vanilla" | "modded";
  minecraftVersion: string;
  ip: string;
  curseforgeModpackId: string;
  modpackSource: ModpackSource;
  curseforgeModpackName: string;
  curseforgeModpackVersion: string;
  recommendedRamGB: string;
};

const EMPTY_VALUES: ServerFormValues = {
  name: "",
  description: "",
  bannerUrl: "",
  iconUrl: "",
  backgroundUrl: "",
  isPrivate: false,
  type: "vanilla",
  minecraftVersion: "",
  ip: "",
  curseforgeModpackId: "",
  modpackSource: DEFAULT_MODPACK_SOURCE,
  curseforgeModpackName: "",
  curseforgeModpackVersion: "",
  recommendedRamGB: "",
};

type ServerFormProps = {
  action: (prevState: ServerActionState, formData: FormData) => ServerActionState | Promise<ServerActionState>;
  defaultValues?: Partial<ServerFormValues>;
  submitLabel: string;
  versions: string[];
  // Absents en creation (NewServerWizard gere sa propre visibilite sans lien
  // — un serveur qui n'existe pas encore n'a pas de code a afficher) :
  // seule la page /manage/[id]/settings les passe.
  serverId?: string;
  inviteCode?: string | null;
  // Section rendue entre les champs et le bouton d'enregistrement (voir
  // /manage/[id]/settings : Pause/Dupliquer/Supprimer, comme sur la maquette
  // "05 · Settings"). Ne doit contenir que des boutons type="button" —
  // jamais un autre <form>, invalide a l'interieur de celui-ci.
  children?: ReactNode;
};

export function ServerForm({ action, defaultValues, submitLabel, versions, serverId, inviteCode, children }: ServerFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const values = { ...EMPTY_VALUES, ...defaultValues };
  const [state, formAction, pending] = useActionState(action, undefined);
  const [type, setType] = useState<"vanilla" | "modded">(values.type);
  const [visibility, setVisibility] = useState<"public" | "private">(values.isPrivate ? "private" : "public");
  const [resettingCode, setResettingCode] = useState(false);

  // Lu apres le montage seulement (jamais pendant le rendu serveur, ou
  // location n'existe pas) — un state vide au premier rendu evite tout
  // mismatch d'hydratation, le lien apparait juste un instant apres.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteLink = inviteCode ? `${origin}/join/${inviteCode}` : "";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="field-label">
          {t("serverForm.name")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={values.name}
          placeholder={t("serverForm.namePlaceholder")}
          className="field-input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="field-label">
          {t("serverForm.description")}
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          defaultValue={values.description}
          placeholder={t("serverForm.descriptionPlaceholder")}
          className="field-input"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)]">
        <ImageDropzone
          name="bannerUrl"
          field="banner"
          defaultValue={values.bannerUrl}
          label={t("serverForm.bannerUrl")}
          hint={t("serverForm.bannerHint")}
          placeholder={t("serverForm.dropBanner")}
          icon={Image}
        />
        <ImageDropzone
          name="iconUrl"
          field="icon"
          defaultValue={values.iconUrl}
          label={t("serverForm.iconUrl")}
          hint={t("serverForm.iconHint")}
          placeholder=""
          icon={Cube}
        />
        <ImageDropzone
          name="backgroundUrl"
          field="background"
          defaultValue={values.backgroundUrl}
          label={t("serverForm.backgroundUrl")}
          hint={t("serverForm.backgroundHint")}
          placeholder={t("serverForm.dropBackground")}
          icon={ImageSquare}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="field-label">{t("serverForm.visibility")}</span>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <label
            className="flex flex-1 items-start gap-2.5 rounded-md border p-3 cursor-pointer"
            style={
              visibility === "public"
                ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
                : { borderColor: "var(--border)" }
            }
          >
            <input
              type="radio" name="visibility" value="public" className="sr-only"
              checked={visibility === "public"} onChange={() => setVisibility("public")}
            />
            <GlobeHemisphereWest className="h-[17px] w-[17px] mt-0.5 flex-shrink-0" style={{ color: visibility === "public" ? "var(--accent)" : "var(--muted)" }} />
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium text-foreground">{t("serverForm.visibilityPublic")}</span>
              <span className="text-xs text-muted leading-relaxed">{t("serverForm.visibilityPublicHelp")}</span>
            </span>
          </label>
          <label
            className="flex flex-1 items-start gap-2.5 rounded-md border p-3 cursor-pointer"
            style={
              visibility === "private"
                ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
                : { borderColor: "var(--border)" }
            }
          >
            <input
              type="radio" name="visibility" value="private" className="sr-only"
              checked={visibility === "private"} onChange={() => setVisibility("private")}
            />
            <LockSimple className="h-[17px] w-[17px] mt-0.5 flex-shrink-0" style={{ color: visibility === "private" ? "var(--accent)" : "var(--muted)" }} />
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium text-foreground">{t("serverForm.visibilityPrivate")}</span>
              <span className="text-xs text-muted leading-relaxed">{t("serverForm.visibilityPrivateHelp")}</span>
            </span>
          </label>
        </div>

        {visibility === "private" && serverId ? (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <span className="text-xs text-muted">{t("serverForm.inviteLinkLabel")}</span>
            {inviteCode ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="flex-1 min-w-[180px] h-[34px] flex items-center px-2.5 rounded-md border border-border bg-background text-xs font-mono truncate">
                    {inviteLink}
                  </code>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => navigator.clipboard?.writeText(inviteLink)}
                  >
                    <Copy className="h-3.5 w-3.5" /> {t("serverForm.inviteLinkCopy")}
                  </button>
                  <button
                    type="button"
                    disabled={resettingCode}
                    className="btn-secondary text-xs"
                    onClick={async () => {
                      if (!serverId || !window.confirm(t("serverForm.inviteLinkResetConfirm"))) return;
                      setResettingCode(true);
                      try {
                        await resetInviteCode(serverId);
                        router.refresh();
                      } finally {
                        setResettingCode(false);
                      }
                    }}
                  >
                    <ArrowsClockwise className="h-3.5 w-3.5" /> {t("serverForm.inviteLinkReset")}
                  </button>
                </div>
                <span className="text-[11.5px] text-muted">
                  {t("serverForm.inviteLinkHelp", { code: inviteCode })}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted">{t("serverForm.inviteLinkPending")}</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="field-label">{t("serverForm.type")}</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="type"
              value="vanilla"
              checked={type === "vanilla"}
              onChange={() => setType("vanilla")}
            />
            {t("serverForm.vanilla")}
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="type"
              value="modded"
              checked={type === "modded"}
              onChange={() => setType("modded")}
            />
            {t("serverForm.modded")}
          </label>
        </div>
      </div>

      <MinecraftVersionField versions={versions} defaultValue={values.minecraftVersion} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ip" className="field-label">
          {t("serverForm.ip")}
        </label>
        <input
          id="ip"
          name="ip"
          type="text"
          required
          placeholder={t("serverForm.ipPlaceholder")}
          defaultValue={values.ip}
          className="field-input"
        />
        <p className="text-xs text-muted">{t("serverForm.ipHelp")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="recommendedRamGB" className="field-label">
          {t("serverForm.ram")}
        </label>
        <input
          id="recommendedRamGB"
          name="recommendedRamGB"
          type="number"
          min={1}
          max={32}
          step={1}
          placeholder={t("serverForm.ramPlaceholder")}
          defaultValue={values.recommendedRamGB}
          className="field-input"
        />
        <p className="text-xs text-muted">{t("serverForm.ramHelp")}</p>
      </div>

      {type === "modded" ? (
        // Meme composant que l'assistant de creation : recherche CurseForge, avec
        // saisie manuelle en repli. Demonte quand on repasse en Vanilla ; en
        // revenant a Modde il repart du modpack enregistre.
        <ModpackPicker
          defaultValue={{
            id: values.curseforgeModpackId,
            name: values.curseforgeModpackName,
            version: values.curseforgeModpackVersion,
            source: values.modpackSource,
          }}
        />
      ) : null}

      {children}

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary self-start">
        {pending ? t("manage.saving") : submitLabel}
      </button>
    </form>
  );
}
