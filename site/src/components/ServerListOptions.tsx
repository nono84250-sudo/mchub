"use client";

import { supportsAutoConnect } from "@/lib/minecraft-version-constants";
import { useI18n } from "@/i18n/I18nProvider";

// Liste Multijoueur + connexion directe (21/10), partages par ServerForm.tsx et
// NewServerWizard.tsx. Sans liste Multijoueur, la connexion directe est le seul moyen d'entrer :
// sa case est alors cochee et grisee (readForm dans lib/actions/servers.ts la force aussi).
type Props = {
  addToServerList: boolean;
  onAddToServerListChange: (value: boolean) => void;
  autoConnect: boolean;
  onAutoConnectChange: (value: boolean) => void;
  minecraftVersion: string;
};

export function ServerListOptions({ addToServerList, onAddToServerListChange, autoConnect, onAutoConnectChange, minecraftVersion }: Props) {
  const { t } = useI18n();
  const forced = !addToServerList;
  const tooOld = Boolean(minecraftVersion) && !supportsAutoConnect(minecraftVersion);

  return (
    <div className="flex flex-col gap-3">
      {/* FormData.get() renvoie la PREMIERE entree du meme nom en ordre DOM : chaque case doit
          venir avant son hidden de repli (bug trouve par l'audit du 2026-10-10). */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            name="addToServerList"
            value="true"
            checked={addToServerList}
            onChange={(event) => onAddToServerListChange(event.target.checked)}
          />
          {t("serverForm.addToServerList")}
        </label>
        <input type="hidden" name="addToServerList" value="false" />
        <p className="text-xs text-muted">{t("serverForm.addToServerListHelp")}</p>
        {forced ? (
          <div className="rounded-md px-3 py-2.5 text-xs text-warn" style={{ background: "color-mix(in srgb, currentColor 10%, transparent)" }}>
            <p className="font-semibold">{t("serverForm.addToServerListOffTitle")}</p>
            <p>{t("serverForm.addToServerListOffText")}</p>
            {tooOld ? <p className="mt-1 font-semibold">{t("serverForm.addToServerListVersionWarning")}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={`flex items-center gap-2 text-sm text-foreground ${forced ? "cursor-not-allowed opacity-65" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            name="autoConnect"
            value="true"
            checked={forced || autoConnect}
            disabled={forced}
            onChange={(event) => onAutoConnectChange(event.target.checked)}
          />
          {t("serverForm.autoConnect")}
        </label>
        <input type="hidden" name="autoConnect" value="false" />
        <p className="text-xs text-muted">{t(forced ? "serverForm.autoConnectForced" : "serverForm.autoConnectHelp")}</p>
        {!forced && autoConnect && tooOld ? (
          <p className="text-xs text-warn">{t("serverForm.autoConnectVersionWarning")}</p>
        ) : null}
      </div>
    </div>
  );
}
