"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlass, CheckCircle, Info } from "@phosphor-icons/react";
import { searchModpacks } from "@/lib/actions/modpacks";
import {
  DEFAULT_MODPACK_SOURCE,
  MODPACK_SOURCES,
  type ModpackSearchResult,
  type ModpackSource,
} from "@/lib/modpack-types";
import { useI18n } from "@/i18n/I18nProvider";

// minecraftVersion / loader : uniquement connus quand le modpack vient de la
// recherche (jamais enregistres en base, juste transmis a l'appelant).
export type ModpackValue = {
  id: string;
  name: string;
  version: string;
  source: ModpackSource;
  minecraftVersion?: string | null;
  loader?: string | null;
};

type Chosen = ModpackValue & { iconUrl: string | null; verified: boolean };

const SOURCE_LABELS: Record<ModpackSource, string> = { curseforge: "CurseForge", modrinth: "Modrinth" };

// Choix du modpack d'un serveur moddé (CurseForge ou Modrinth) — partagé entre
// l'assistant de création et la page Paramètres. Recherche dans la source
// choisie, avec repli en saisie manuelle si elle est indisponible (clé
// CurseForge absente, API en panne) : jamais bloquant pour un serveur moddé.
// Rend les champs cachés modpackSource et curseforgeModpackId/Name/Version
// (noms historiques, voir contract.prisma) attendus par createServer/updateServer.
//
// `defaultValue` = modpack déjà enregistré (Paramètres) : affiché comme un
// modpack choisi, mais sans la mention "vérifié" — il a pu être saisi à la
// main, seule une sélection faite dans la recherche prouve que l'ID existe.
export function ModpackPicker({
  defaultValue,
  onChange,
}: {
  defaultValue?: ModpackValue;
  onChange?: (value: ModpackValue) => void;
}) {
  const { t } = useI18n();
  const [source, setSource] = useState<ModpackSource>(defaultValue?.id ? defaultValue.source : DEFAULT_MODPACK_SOURCE);
  const [chosen, setChosen] = useState<Chosen | null>(
    defaultValue?.id ? { ...defaultValue, iconUrl: null, verified: false } : null,
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModpackSearchResult[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "error" | "not-configured">("idle");
  const [manualEntry, setManualEntry] = useState(false);
  const [manual, setManual] = useState<{ id: string; name: string; version: string }>({ id: "", name: "", version: "" });
  const sourceLabel = SOURCE_LABELS[source];

  useEffect(() => {
    if (manualEntry || chosen || !query.trim()) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const result = await searchModpacks(query, source);
      if (cancelled) return;
      if (result.ok) {
        setResults(result.results);
        setSearchState("idle");
      } else {
        setResults([]);
        setSearchState(result.notConfigured ? "not-configured" : "error");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, source, manualEntry, chosen]);

  const value: ModpackValue = manualEntry
    ? { ...manual, source }
    : chosen
      ? chosen
      : { id: "", name: "", version: "", source };
  const { id, name, version, minecraftVersion, loader } = value;
  useEffect(() => {
    onChange?.({ id, name, version, source, minecraftVersion, loader });
  }, [id, name, version, source, minecraftVersion, loader, onChange]);

  // Un identifiant n'a de sens que dans sa source : changer de source repart de zéro.
  function changeSource(next: ModpackSource) {
    if (next === source) return;
    setSource(next);
    setChosen(null);
    setQuery("");
    setResults([]);
    setSearchState("idle");
    setManualEntry(false);
    setManual({ id: "", name: "", version: "" });
  }

  function startManualEntry() {
    // Repart de ce qui est déjà choisi plutôt que de champs vides (utile en
    // Paramètres, où l'on corrige souvent juste la version du modpack).
    setManual((current) =>
      current.id || current.name || current.version
        ? current
        : { id: chosen?.id ?? "", name: chosen?.name ?? "", version: chosen?.version ?? "" },
    );
    setManualEntry(true);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name="modpackSource" value={source} />
      <input type="hidden" name="curseforgeModpackId" value={id} />
      <input type="hidden" name="curseforgeModpackName" value={name} />
      <input type="hidden" name="curseforgeModpackVersion" value={version} />

      <span className="field-label">{t("wizard.modpackSourceLabel")}</span>
      <div role="radiogroup" aria-label={t("wizard.modpackSourceLabel")} className="inline-flex w-fit overflow-hidden rounded-md border border-border">
        {MODPACK_SOURCES.map((option, index) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={source === option}
            onClick={() => changeSource(option)}
            className={`px-3.5 py-2 text-sm ${index > 0 ? "border-l border-border" : ""}`}
            style={
              source === option
                ? { boxShadow: "inset 0 0 0 1px var(--accent)", color: "var(--accent)" }
                : { color: "var(--muted)" }
            }
          >
            {SOURCE_LABELS[option]}
          </button>
        ))}
      </div>
      <p className="mb-1 text-xs text-muted2">
        {source === "modrinth" ? t("wizard.modpackModrinthHint") : t("wizard.modpackCurseforgeHint")}
      </p>

      {manualEntry ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manualModpackId" className="field-label">{t("serverForm.modpackId")}</label>
            <input
              id="manualModpackId" type="text"
              value={manual.id}
              onChange={(e) => setManual((m) => ({ ...m, id: e.target.value }))}
              className="field-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manualModpackName" className="field-label">{t("serverForm.modpackName")}</label>
            <input
              id="manualModpackName" type="text"
              value={manual.name}
              onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
              className="field-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manualModpackVersion" className="field-label">{t("serverForm.modpackVersion")}</label>
            <input
              id="manualModpackVersion" type="text"
              value={manual.version}
              onChange={(e) => setManual((m) => ({ ...m, version: e.target.value }))}
              className="field-input"
            />
          </div>
          <button type="button" onClick={() => setManualEntry(false)} className="self-start text-xs text-accent underline">
            {t("wizard.modpackUseSearch")}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="modpackSearch" className="field-label">{t("wizard.modpackSearchLabel")}</label>
            <div className="field-with-icon">
              <MagnifyingGlass className="h-4 w-4" />
              <input
                id="modpackSearch" type="text" className="field-input w-full"
                placeholder={t("wizard.modpackSearchPlaceholder", { source: sourceLabel })}
                value={chosen ? chosen.name || chosen.id : query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchState(e.target.value.trim() ? "searching" : "idle");
                }}
                disabled={!!chosen}
              />
            </div>
          </div>

          {chosen ? (
            <div className="mt-1.5 flex items-center gap-2.5 rounded-md px-3 py-2.5" style={{ border: "1px solid var(--accent)", background: "var(--surface)" }}>
              {chosen.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- icone d'origine externe (CurseForge/Modrinth), pas un asset local optimisable
                <img src={chosen.iconUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-md object-cover" />
              ) : (
                <span className="server-icon h-8 w-8 flex-shrink-0 text-sm">{(chosen.name || chosen.id).charAt(0).toUpperCase()}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-foreground">{chosen.name || chosen.id}</p>
                <p className="truncate text-xs text-muted">
                  {chosen.version ? `${chosen.version} · ` : ""}{sourceLabel}{chosen.verified ? ` · ${t("wizard.modpackVerified")}` : ""}
                </p>
              </div>
              {chosen.verified ? <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: "var(--success)" }} /> : null}
              <button type="button" onClick={() => setChosen(null)} className="flex-shrink-0 text-xs text-muted underline">
                {t("wizard.modpackChange")}
              </button>
            </div>
          ) : searchState === "not-configured" || searchState === "error" ? (
            query.trim() ? <p className="text-xs text-muted">{t("wizard.modpackSearchUnavailable", { source: sourceLabel })}</p> : null
          ) : query.trim() && searchState === "searching" ? (
            <p className="text-xs text-muted">{t("wizard.modpackSearching")}</p>
          ) : query.trim() && results.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-md border border-border p-1">
              {results.map((mod) => (
                <button
                  key={mod.id} type="button"
                  onClick={() => {
                    setChosen({
                      id: mod.id,
                      name: mod.name,
                      version: mod.latestVersion ?? "",
                      source,
                      minecraftVersion: mod.minecraftVersion,
                      loader: mod.loader,
                      iconUrl: mod.iconUrl,
                      verified: true,
                    });
                    setResults([]);
                  }}
                  className="flex items-center gap-3 rounded-md p-2 text-left hover:bg-surface-raised"
                >
                  {mod.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- icone d'origine externe (CurseForge/Modrinth), pas un asset local optimisable
                    <img src={mod.iconUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded object-cover" />
                  ) : (
                    <span className="server-icon h-7 w-7 flex-shrink-0 text-xs">{mod.name.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{mod.name}</p>
                    <p className="truncate text-xs text-muted">{mod.summary}</p>
                  </div>
                  {mod.minecraftVersion || mod.loader ? (
                    <span className="flex-shrink-0 text-[11px] text-muted2">
                      {[mod.minecraftVersion, mod.loader].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : query.trim() && searchState === "idle" ? (
            <p className="text-xs text-muted">{t("wizard.modpackNoResults")}</p>
          ) : null}

          <button type="button" onClick={startManualEntry} className="mt-1.5 self-start text-xs text-accent underline">
            {t("wizard.modpackEnterManually")}
          </button>
        </>
      )}

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted2">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        {t("serverForm.modpackNote")}
      </p>
    </div>
  );
}
