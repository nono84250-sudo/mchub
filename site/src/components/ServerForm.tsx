"use client";

import { useActionState, useState } from "react";
import type { ServerActionState } from "@/lib/actions/servers";
import { OTHER_VERSION_VALUE } from "@/lib/minecraft-versions";
import { useI18n } from "@/i18n/I18nProvider";

type ServerFormValues = {
  name: string;
  description: string;
  bannerUrl: string;
  iconUrl: string;
  backgroundUrl: string;
  type: "vanilla" | "modded";
  minecraftVersion: string;
  ip: string;
  curseforgeModpackId: string;
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
  type: "vanilla",
  minecraftVersion: "",
  ip: "",
  curseforgeModpackId: "",
  curseforgeModpackName: "",
  curseforgeModpackVersion: "",
  recommendedRamGB: "",
};

type ServerFormProps = {
  action: (prevState: ServerActionState, formData: FormData) => ServerActionState | Promise<ServerActionState>;
  defaultValues?: Partial<ServerFormValues>;
  submitLabel: string;
  versions: string[];
};

export function ServerForm({ action, defaultValues, submitLabel, versions }: ServerFormProps) {
  const { t } = useI18n();
  const values = { ...EMPTY_VALUES, ...defaultValues };
  const [state, formAction, pending] = useActionState(action, undefined);
  const [type, setType] = useState<"vanilla" | "modded">(values.type);

  const isKnownVersion = values.minecraftVersion !== "" && versions.includes(values.minecraftVersion);
  const [versionChoice, setVersionChoice] = useState(
    values.minecraftVersion === "" ? "" : isKnownVersion ? values.minecraftVersion : OTHER_VERSION_VALUE,
  );
  const [customVersion, setCustomVersion] = useState(isKnownVersion ? "" : values.minecraftVersion);

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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bannerUrl" className="field-label">
          {t("serverForm.bannerUrl")}
        </label>
        <input
          id="bannerUrl"
          name="bannerUrl"
          type="url"
          defaultValue={values.bannerUrl}
          placeholder="https://..."
          className="field-input"
        />
        <p className="text-xs text-muted">{t("serverForm.bannerHelp")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="iconUrl" className="field-label">
          {t("serverForm.iconUrl")}
        </label>
        <input
          id="iconUrl"
          name="iconUrl"
          type="url"
          defaultValue={values.iconUrl}
          placeholder="https://..."
          className="field-input"
        />
        <p className="text-xs text-muted">{t("serverForm.iconHelp")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="backgroundUrl" className="field-label">
          {t("serverForm.backgroundUrl")}
        </label>
        <input
          id="backgroundUrl"
          name="backgroundUrl"
          type="url"
          defaultValue={values.backgroundUrl}
          placeholder="https://..."
          className="field-input"
        />
        <p className="text-xs text-muted">{t("serverForm.backgroundHelp")}</p>
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="minecraftVersionSelect" className="field-label">
          {t("serverForm.version")}
        </label>
        <select
          id="minecraftVersionSelect"
          required
          value={versionChoice}
          onChange={(event) => setVersionChoice(event.target.value)}
          className="field-input"
        >
          <option value="" disabled>
            {t("serverForm.chooseVersion")}
          </option>
          {versions.map((version) => (
            <option key={version} value={version}>
              {version}
            </option>
          ))}
          <option value={OTHER_VERSION_VALUE}>{t("serverForm.otherVersion")}</option>
        </select>

        {versionChoice === OTHER_VERSION_VALUE ? (
          <input
            name="minecraftVersion"
            type="text"
            required
            placeholder={t("serverForm.otherVersionPlaceholder")}
            value={customVersion}
            onChange={(event) => setCustomVersion(event.target.value)}
            className="field-input"
          />
        ) : (
          <input type="hidden" name="minecraftVersion" value={versionChoice} />
        )}
        <p className="text-xs text-muted">{t("serverForm.versionHelp")}</p>
      </div>

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
        <div className="panel flex flex-col gap-4 p-4">
          <p className="text-sm font-medium text-foreground">{t("serverForm.modpackSection")}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="curseforgeModpackId" className="field-label">
              {t("serverForm.modpackId")}
            </label>
            <input
              id="curseforgeModpackId"
              name="curseforgeModpackId"
              type="text"
              required={type === "modded"}
              defaultValue={values.curseforgeModpackId}
              className="field-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="curseforgeModpackName" className="field-label">
              {t("serverForm.modpackName")}
            </label>
            <input
              id="curseforgeModpackName"
              name="curseforgeModpackName"
              type="text"
              defaultValue={values.curseforgeModpackName}
              className="field-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="curseforgeModpackVersion" className="field-label">
              {t("serverForm.modpackVersion")}
            </label>
            <input
              id="curseforgeModpackVersion"
              name="curseforgeModpackVersion"
              type="text"
              defaultValue={values.curseforgeModpackVersion}
              className="field-input"
            />
          </div>
        </div>
      ) : null}

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary self-start">
        {pending ? t("manage.saving") : submitLabel}
      </button>
    </form>
  );
}
