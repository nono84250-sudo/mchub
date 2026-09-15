"use client";

import { useActionState, useState } from "react";
import type { ServerActionState } from "@/lib/actions/servers";
import { OTHER_VERSION_VALUE } from "@/lib/minecraft-versions";

type ServerFormValues = {
  name: string;
  description: string;
  bannerUrl: string;
  type: "vanilla" | "modded";
  minecraftVersion: string;
  ip: string;
  curseforgeModpackId: string;
  curseforgeModpackName: string;
  curseforgeModpackVersion: string;
};

const EMPTY_VALUES: ServerFormValues = {
  name: "",
  description: "",
  bannerUrl: "",
  type: "vanilla",
  minecraftVersion: "",
  ip: "",
  curseforgeModpackId: "",
  curseforgeModpackName: "",
  curseforgeModpackVersion: "",
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
        <label htmlFor="name" className="text-sm text-muted">
          Nom du serveur
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={values.name}
          className="rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm text-muted">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          defaultValue={values.description}
          className="rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bannerUrl" className="text-sm text-muted">
          URL de la bannière (optionnel)
        </label>
        <input
          id="bannerUrl"
          name="bannerUrl"
          type="url"
          defaultValue={values.bannerUrl}
          placeholder="https://..."
          className="rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Type de serveur</span>
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
        <label htmlFor="minecraftVersionSelect" className="text-sm text-muted">
          Version de Minecraft
        </label>
        <select
          id="minecraftVersionSelect"
          required
          value={versionChoice}
          onChange={(event) => setVersionChoice(event.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
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
            className="rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        ) : (
          <input type="hidden" name="minecraftVersion" value={versionChoice} />
        )}
        <p className="text-xs text-muted">
          Version pas dans la liste ? Choisis « Autre » pour la saisir toi-même.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ip" className="text-sm text-muted">
          Adresse de connexion (IP)
        </label>
        <input
          id="ip"
          name="ip"
          type="text"
          required
          placeholder="play.monserveur.fr:25565"
          defaultValue={values.ip}
          className="rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
        />
        <p className="text-xs text-muted">
          Jamais affichée publiquement sur le site — uniquement transmise par le launcher.
        </p>
      </div>

      {type === "modded" ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium text-foreground">Modpack CurseForge</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="curseforgeModpackId" className="text-sm text-muted">
              Identifiant du modpack
            </label>
            <input
              id="curseforgeModpackId"
              name="curseforgeModpackId"
              type="text"
              required={type === "modded"}
              defaultValue={values.curseforgeModpackId}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="curseforgeModpackName" className="text-sm text-muted">
              Nom du modpack
            </label>
            <input
              id="curseforgeModpackName"
              name="curseforgeModpackName"
              type="text"
              defaultValue={values.curseforgeModpackName}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="curseforgeModpackVersion" className="text-sm text-muted">
              Version du modpack
            </label>
            <input
              id="curseforgeModpackVersion"
              name="curseforgeModpackVersion"
              type="text"
              defaultValue={values.curseforgeModpackVersion}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </div>
        </div>
      ) : null}

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:bg-accent-hover transition-colors disabled:opacity-60"
      >
        {pending ? "Enregistrement..." : submitLabel}
      </button>
    </form>
  );
}
