"use client";

import { useEffect, useState, type ReactNode } from "react";
import { OTHER_VERSION_VALUE } from "@/lib/minecraft-versions";
import { useI18n } from "@/i18n/I18nProvider";

// Choix de la version de Minecraft : liste deroulante alimentee en direct par
// getMinecraftVersions (voir lib/minecraft-versions.ts), avec "Autre version"
// pour un snapshot ou une version absente de la liste. Partage entre
// l'assistant de creation et la page Parametres. Rend le champ cache (ou le
// champ libre) "minecraftVersion" attendu par createServer/updateServer.
// `children` s'affiche juste sous la liste, avant le texte d'aide.
export function MinecraftVersionField({
  versions,
  defaultValue = "",
  onChange,
  children,
}: {
  versions: string[];
  defaultValue?: string;
  onChange?: (version: string) => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const isKnownVersion = defaultValue !== "" && versions.includes(defaultValue);
  const [choice, setChoice] = useState(defaultValue === "" ? "" : isKnownVersion ? defaultValue : OTHER_VERSION_VALUE);
  const [custom, setCustom] = useState(isKnownVersion ? "" : defaultValue);

  const value = choice === OTHER_VERSION_VALUE ? custom : choice;
  useEffect(() => {
    onChange?.(value);
  }, [value, onChange]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="minecraftVersionSelect" className="field-label">
        {t("serverForm.version")}
      </label>
      <select
        id="minecraftVersionSelect"
        required
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
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

      {choice === OTHER_VERSION_VALUE ? (
        <input
          name="minecraftVersion"
          type="text"
          required
          placeholder={t("serverForm.otherVersionPlaceholder")}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          className="field-input"
        />
      ) : (
        <input type="hidden" name="minecraftVersion" value={choice} />
      )}

      {children}

      <p className="text-xs text-muted">{t("serverForm.versionHelp")}</p>
    </div>
  );
}
