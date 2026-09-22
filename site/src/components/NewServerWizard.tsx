"use client";

import { useActionState, useEffect, useState } from "react";
import { Globe, PuzzlePiece, ArrowRight, ArrowLeft, Info, MagnifyingGlass, CheckCircle } from "@phosphor-icons/react";
import type { ServerActionState } from "@/lib/actions/servers";
import { searchModpacks } from "@/lib/actions/curseforge";
import type { CurseforgeModpack } from "@/lib/curseforge";
import { useI18n } from "@/i18n/I18nProvider";

type Props = {
  action: (prevState: ServerActionState, formData: FormData) => ServerActionState | Promise<ServerActionState>;
  versions: string[];
};

// Assistant en 3 etapes pour la publication (maquette "Nocturne" — la
// console de gestion garde le formulaire simple existant pour l'edition,
// seule la creation passe par cet assistant). Un seul <form>/<action> pour
// les 3 etapes : les champs des etapes precedentes restent montes (juste
// masques en CSS) pour que leurs valeurs fassent partie de la soumission
// finale, plutot que de dupliquer un state parallele pour chaque champ.
export function NewServerWizard({ action, versions }: Props) {
  const { t, locale } = useI18n();
  const STEPS = [
    { label: t("wizard.stepBasics") },
    { label: t("wizard.stepConnection") },
    { label: t("wizard.stepReview") },
  ];
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"vanilla" | "modded">("vanilla");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ip, setIp] = useState("");
  const [minecraftVersion, setMinecraftVersion] = useState("");
  const [recommendedRamGB, setRecommendedRamGB] = useState("");

  // Recherche CurseForge (voir src/lib/curseforge.ts) avec repli en saisie
  // manuelle si l'API n'est pas configuree ou echoue — jamais bloquant pour
  // la publication d'un serveur modde.
  const [modpackQuery, setModpackQuery] = useState("");
  const [modpackResults, setModpackResults] = useState<CurseforgeModpack[]>([]);
  const [selectedModpack, setSelectedModpack] = useState<CurseforgeModpack | null>(null);
  const [modpackSearchState, setModpackSearchState] = useState<"idle" | "searching" | "error" | "not-configured">("idle");
  const [manualModpackEntry, setManualModpackEntry] = useState(false);
  const [manualModpack, setManualModpack] = useState({ id: "", name: "", version: "" });

  useEffect(() => {
    if (manualModpackEntry || selectedModpack || !modpackQuery.trim()) {
      setModpackResults([]);
      return;
    }
    setModpackSearchState("searching");
    const timeout = setTimeout(async () => {
      const result = await searchModpacks(modpackQuery);
      if (result.ok) {
        setModpackResults(result.results);
        setModpackSearchState("idle");
      } else {
        setModpackResults([]);
        setModpackSearchState(result.notConfigured ? "not-configured" : "error");
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [modpackQuery, manualModpackEntry, selectedModpack]);

  const effectiveModpackId = selectedModpack?.id ?? manualModpack.id;

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
                style={i <= step ? { borderColor: "var(--accent)", color: "var(--accent)" } : { borderColor: "var(--border)", color: "var(--muted)", opacity: 0.5 }}
              >
                {i + 1}
              </span>
              <span className={`text-sm whitespace-nowrap ${i <= step ? "text-foreground" : "text-muted opacity-50"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 ? <div className="mx-3 h-px flex-1 bg-border" /> : null}
          </div>
        ))}
      </div>

      {/* Etape 1 — Infos */}
      <div className={step === 0 ? "flex flex-col gap-5" : "hidden"}>
        <div>
          <h2 className="text-xl font-heading text-foreground mb-1">{t("wizard.basicsTitle")}</h2>
          <p className="text-sm text-muted">{t("wizard.basicsSubtitle")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="field-label">{t("serverForm.name")}</label>
          <input
            id="name" name="name" type="text" required
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder={t("serverForm.namePlaceholder")} className="field-input"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="field-label">{t("serverForm.description")}</label>
          <textarea
            id="description" name="description" required rows={3}
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={t("serverForm.descriptionPlaceholder")} className="field-input"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bannerUrl" className="field-label">{t("serverForm.bannerUrl")}</label>
            <input id="bannerUrl" name="bannerUrl" type="url" placeholder="https://..." className="field-input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="iconUrl" className="field-label">{t("serverForm.iconUrl")}</label>
            <input id="iconUrl" name="iconUrl" type="url" placeholder="https://..." className="field-input" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="field-label">{t("serverForm.type")}</span>
          <div className="inline-flex border border-border rounded-md overflow-hidden w-fit">
            <label
              className="flex cursor-pointer items-center gap-1.5 px-3.5 py-2 text-sm"
              style={type === "vanilla" ? { boxShadow: "inset 0 0 0 1px var(--accent)", color: "var(--accent)" } : { color: "var(--muted)" }}
            >
              <input type="radio" name="type" value="vanilla" checked={type === "vanilla"} onChange={() => setType("vanilla")} className="sr-only" />
              <Globe className="h-4 w-4" /> {t("serverForm.vanilla")}
            </label>
            <label
              className="flex cursor-pointer items-center gap-1.5 border-l border-border px-3.5 py-2 text-sm"
              style={type === "modded" ? { boxShadow: "inset 0 0 0 1px var(--accent)", color: "var(--accent)" } : { color: "var(--muted)" }}
            >
              <input type="radio" name="type" value="modded" checked={type === "modded"} onChange={() => setType("modded")} className="sr-only" />
              <PuzzlePiece className="h-4 w-4" /> {t("serverForm.modded")}
            </label>
          </div>
        </div>

        {type === "modded" ? (
          <div className="flex flex-col gap-4 rounded-lg p-4" style={{ border: "1px solid var(--accent)" }}>
            <input type="hidden" name="curseforgeModpackId" value={effectiveModpackId} />
            <input type="hidden" name="curseforgeModpackName" value={selectedModpack?.name ?? manualModpack.name} />
            <input type="hidden" name="curseforgeModpackVersion" value={selectedModpack?.latestVersion ?? manualModpack.version} />

            {manualModpackEntry ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="manualModpackId" className="field-label">{t("serverForm.modpackId")}</label>
                  <input
                    id="manualModpackId" type="text" required
                    value={manualModpack.id}
                    onChange={(e) => setManualModpack((m) => ({ ...m, id: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="manualModpackName" className="field-label">{t("serverForm.modpackName")}</label>
                  <input
                    id="manualModpackName" type="text"
                    value={manualModpack.name}
                    onChange={(e) => setManualModpack((m) => ({ ...m, name: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="manualModpackVersion" className="field-label">{t("serverForm.modpackVersion")}</label>
                  <input
                    id="manualModpackVersion" type="text"
                    value={manualModpack.version}
                    onChange={(e) => setManualModpack((m) => ({ ...m, version: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <button type="button" onClick={() => setManualModpackEntry(false)} className="self-start text-xs text-accent underline">
                  {t("wizard.modpackUseSearch")}
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="modpackSearch" className="field-label">{t("wizard.modpackSearchLabel")}</label>
                  <div className="field-with-icon">
                    <MagnifyingGlass className="h-4 w-4" />
                    <input
                      id="modpackSearch" type="text" className="field-input w-full"
                      placeholder={t("wizard.modpackSearchPlaceholder")}
                      value={selectedModpack ? selectedModpack.name : modpackQuery}
                      onChange={(e) => {
                        setSelectedModpack(null);
                        setModpackQuery(e.target.value);
                      }}
                      disabled={!!selectedModpack}
                    />
                  </div>
                </div>

                {selectedModpack ? (
                  <div className="flex items-center gap-3 rounded-md p-3" style={{ border: "1px solid var(--accent)", background: "var(--surface)" }}>
                    {selectedModpack.iconUrl ? (
                      <img src={selectedModpack.iconUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="server-icon h-8 w-8 flex-shrink-0 text-sm">{selectedModpack.name.charAt(0).toUpperCase()}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{selectedModpack.name}</p>
                      <p className="truncate text-xs text-muted">
                        {selectedModpack.latestVersion ? `${selectedModpack.latestVersion} · ` : ""}CurseForge · {t("wizard.modpackVerified")}
                      </p>
                    </div>
                    <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: "var(--success)" }} />
                    <button type="button" onClick={() => setSelectedModpack(null)} className="flex-shrink-0 text-xs text-muted underline">
                      {t("wizard.modpackChange")}
                    </button>
                  </div>
                ) : modpackSearchState === "not-configured" || modpackSearchState === "error" ? (
                  <p className="text-xs text-muted">{t("wizard.modpackSearchUnavailable")}</p>
                ) : modpackSearchState === "searching" ? (
                  <p className="text-xs text-muted">{t("wizard.modpackSearching")}</p>
                ) : modpackResults.length > 0 ? (
                  <div className="flex flex-col gap-1 rounded-md border border-border p-1">
                    {modpackResults.map((mod) => (
                      <button
                        key={mod.id} type="button"
                        onClick={() => {
                          setSelectedModpack(mod);
                          setModpackResults([]);
                        }}
                        className="flex items-center gap-3 rounded-md p-2 text-left hover:bg-surface-raised"
                      >
                        {mod.iconUrl ? (
                          <img src={mod.iconUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded object-cover" />
                        ) : (
                          <span className="server-icon h-7 w-7 flex-shrink-0 text-xs">{mod.name.charAt(0).toUpperCase()}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{mod.name}</p>
                          <p className="truncate text-xs text-muted">{mod.summary}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : modpackQuery.trim() && modpackSearchState === "idle" ? (
                  <p className="text-xs text-muted">{t("wizard.modpackNoResults")}</p>
                ) : null}

                <button type="button" onClick={() => setManualModpackEntry(true)} className="self-start text-xs text-accent underline">
                  {t("wizard.modpackEnterManually")}
                </button>
              </>
            )}

            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              {t("serverForm.modpackNote")}
            </p>
          </div>
        ) : null}

        <div className="mt-2 flex justify-end">
          <button
            type="button" onClick={next}
            disabled={!name || !description || (type === "modded" && !effectiveModpackId)}
            className="btn-primary"
          >
            {t("wizard.continue")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Etape 2 — Connexion */}
      <div className={step === 1 ? "flex flex-col gap-5" : "hidden"}>
        <div>
          <h2 className="text-xl font-heading text-foreground mb-1">{t("wizard.connectionTitle")}</h2>
          <p className="text-sm text-muted">{t("wizard.connectionSubtitle")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ip" className="field-label">{t("serverForm.ip")}</label>
          <input
            id="ip" name="ip" type="text" required
            value={ip} onChange={(e) => setIp(e.target.value)}
            placeholder={t("serverForm.ipPlaceholder")} className="field-input"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="minecraftVersion" className="field-label">{t("serverForm.version")}</label>
            <input
              id="minecraftVersion" name="minecraftVersion" type="text" list="mc-versions" required
              value={minecraftVersion} onChange={(e) => setMinecraftVersion(e.target.value)}
              placeholder={t("serverForm.versionPlaceholder")} className="field-input"
            />
            <datalist id="mc-versions">
              {versions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recommendedRamGB" className="field-label">{t("serverForm.ram")}</label>
            <input
              id="recommendedRamGB" name="recommendedRamGB" type="number" min={1} max={32} step={1}
              value={recommendedRamGB} onChange={(e) => setRecommendedRamGB(e.target.value)}
              placeholder={t("serverForm.ramPlaceholder")} className="field-input"
            />
          </div>
        </div>

        <div className="mt-2 flex justify-between">
          <button type="button" onClick={back} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> {t("wizard.back")}
          </button>
          <button type="button" onClick={next} disabled={!ip || !minecraftVersion} className="btn-primary">
            {t("wizard.continue")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Etape 3 — Verification */}
      <div className={step === 2 ? "flex flex-col gap-5" : "hidden"}>
        <div>
          <h2 className="text-xl font-heading text-foreground mb-1">{t("wizard.reviewTitle")}</h2>
          <p className="text-sm text-muted">{t("wizard.reviewSubtitle")}</p>
        </div>

        <div className="panel divide-y divide-border">
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">{t("wizard.reviewName")}</span>
            <span className="font-medium text-foreground">{name || "—"}</span>
          </div>
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">{t("wizard.reviewType")}</span>
            <span className="font-medium text-foreground">{type === "modded" ? t("serverForm.modded") : t("serverForm.vanilla")}</span>
          </div>
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">{t("wizard.reviewVersion")}</span>
            <span className="font-medium text-foreground">{minecraftVersion || "—"}</span>
          </div>
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">{t("wizard.reviewAddress")}</span>
            <span className="font-medium text-foreground">{ip || "—"}</span>
          </div>
          {recommendedRamGB ? (
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-muted">{t("wizard.reviewRam")}</span>
              <span className="font-medium text-foreground">{recommendedRamGB} {locale === "fr" ? "Go" : "GB"}</span>
            </div>
          ) : null}
        </div>

        {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <div className="mt-2 flex justify-between">
          <button type="button" onClick={back} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> {t("wizard.back")}
          </button>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? t("wizard.publishing") : t("wizard.publish")}
          </button>
        </div>
      </div>
    </form>
  );
}
