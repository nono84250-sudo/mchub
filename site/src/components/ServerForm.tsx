"use client";

import { useActionState, useState } from "react";
import type { ServerActionState } from "@/lib/actions/servers";
import { OTHER_VERSION_VALUE } from "@/lib/minecraft-versions";

type ServerFormValues = {
  name: string;
  description: string;
  bannerUrl: string;
  iconUrl: string;
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
          Nom du serveur
        </label>
        <input id="name" name="name" type="text" required defaultValue={values.name} className="field-input" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="field-label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          defaultValue={values.description}
          className="field-input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bannerUrl" className="field-label">
          URL de la bannière (optionnel)
        </label>
        <input
          id="bannerUrl"
          name="bannerUrl"
          type="url"
          defaultValue={values.bannerUrl}
          placeholder="https://..."
          className="field-input"
        />
        <p className="text-xs text-muted">
          Image affichée en fond sur la fiche publique et l&apos;annuaire — idéalement large (16:9).
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="iconUrl" className="field-label">
          URL de l&apos;icône (optionnel)
        </label>
        <input
          id="iconUrl"
          name="iconUrl"
          type="url"
          defaultValue={values.iconUrl}
          placeholder="https://..."
          className="field-input"
        />
        <p className="text-xs text-muted">
          Petit logo carré affiché à côté du nom du serveur — sans image, une pastille avec l&apos;initiale du
          nom est utilisée à la place.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="field-label">Type de serveur</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="type"
              value="vanilla"
              checked={type === "vanilla"}
              onChange={() => setType("vanilla")}
            />
            Vanilla
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="type"
              value="modded"
              checked={type === "modded"}
              onChange={() => setType("modded")}
            />
            Moddé (modpack CurseForge)
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="minecraftVersionSelect" className="field-label">
          Version de Minecraft
        </label>
        <select
          id="minecraftVersionSelect"
          required
          value={versionChoice}
          onChange={(event) => setVersionChoice(event.target.value)}
          className="field-input"
        >
          <option value="" disabled>
            Choisir une version...
          </option>
          {versions.map((version) => (
            <option key={version} value={version}>
              {version}
            </option>
          ))}
          <option value={OTHER_VERSION_VALUE}>Autre (saisir manuellement)</option>
        </select>

        {versionChoice === OTHER_VERSION_VALUE ? (
          <input
            name="minecraftVersion"
            type="text"
            required
            placeholder="ex : 1.21.5"
            value={customVersion}
            onChange={(event) => setCustomVersion(event.target.value)}
            className="field-input"
          />
        ) : (
          <input type="hidden" name="minecraftVersion" value={versionChoice} />
        )}
        <p className="text-xs text-muted">
          Version pas dans la liste ? Choisis « Autre » pour la saisir toi-même.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ip" className="field-label">
          Adresse de connexion (IP)
        </label>
        <input
          id="ip"
          name="ip"
          type="text"
          required
          placeholder="play.monserveur.fr:25565"
          defaultValue={values.ip}
          className="field-input"
        />
        <p className="text-xs text-muted">
          Jamais affichée publiquement sur le site — uniquement transmise par le launcher.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="recommendedRamGB" className="field-label">
          RAM recommandée (Go, optionnel)
        </label>
        <input
          id="recommendedRamGB"
          name="recommendedRamGB"
          type="number"
          min={1}
          max={32}
          step={1}
          placeholder="ex : 4"
          defaultValue={values.recommendedRamGB}
          className="field-input"
        />
        <p className="text-xs text-muted">
          Suggérée au joueur dans le launcher avant de rejoindre (max 32 Go, la limite du launcher) —
          jamais imposée, et le launcher avertit si elle dépasse ce que sa machine peut raisonnablement
          fournir.
        </p>
      </div>

      {type === "modded" ? (
        <div className="panel flex flex-col gap-4 p-4">
          <p className="text-sm font-medium text-foreground">Modpack CurseForge</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="curseforgeModpackId" className="field-label">
              Identifiant du modpack
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
              Nom du modpack
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
              Version du modpack
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
        {pending ? "Enregistrement..." : submitLabel}
      </button>
    </form>
  );
}
