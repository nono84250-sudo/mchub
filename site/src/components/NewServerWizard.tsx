"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Globe, PuzzlePiece, ArrowRight, Info, MagnifyingGlass, CheckCircle, GlobeHemisphereWest, LockSimple, Image, Cube, ImageSquare } from "@phosphor-icons/react";
import type { ServerActionState } from "@/lib/actions/servers";
import { searchModpacks } from "@/lib/actions/curseforge";
import type { CurseforgeModpack } from "@/lib/curseforge";
import { ImageDropzone } from "@/components/ImageDropzone";
import { LogoMark } from "@/components/LogoMark";
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
  const [visibility, setVisibility] = useState<"public" | "private">("public");

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
    <div>
      <header>
        <div className="flex items-center gap-4 px-7 py-3.5">
          <Link href="/dashboard" className="font-heading flex items-center gap-2 text-[17px] font-semibold text-foreground">
            <LogoMark className="h-4 w-4" />
            Omniscient
          </Link>
          <div className="ml-auto text-[13px] text-muted">
            {t("wizard.stepOf", { current: String(step + 1), total: String(STEPS.length) })}
          </div>
        </div>
        <div className="divider-fade" />
      </header>

      <form action={formAction} className="onboarding mx-auto flex max-w-[640px] flex-col gap-9 px-6 pb-[72px] pt-14">
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
              <span className={`text-[13px] whitespace-nowrap ${i <= step ? "text-foreground" : "text-muted opacity-50"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 ? <div className="mx-3 h-px flex-1 bg-border" /> : null}
          </div>
        ))}
      </div>

      {/* Etape 1 — Infos */}
      <div className={step === 0 ? "flex flex-col gap-9" : "hidden"}>
        <div>
          <h2 className="text-[26px] font-heading text-foreground mb-1.5">{t("wizard.basicsTitle")}</h2>
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

        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)]">
          <ImageDropzone name="bannerUrl" field="banner" label={t("serverForm.bannerUrl")} hint={t("serverForm.bannerHint")} placeholder={t("serverForm.dropBanner")} icon={Image} />
          <ImageDropzone name="iconUrl" field="icon" label={t("serverForm.iconUrl")} hint={t("serverForm.iconHint")} placeholder="" icon={Cube} />
          <ImageDropzone name="backgroundUrl" field="background" label={t("serverForm.backgroundUrl")} hint={t("serverForm.backgroundHint")} placeholder={t("serverForm.dropBackground")} icon={ImageSquare} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="field-label">{t("serverForm.visibility")}</span>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <label
              className="flex min-w-0 flex-1 items-start gap-2.5 rounded-md border px-3.5 py-3 cursor-pointer"
              style={
                visibility === "public"
                  ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
                  : { borderColor: "var(--border)", background: "var(--surface)" }
              }
            >
              <input
                type="radio" name="visibility" value="public" className="sr-only"
                checked={visibility === "public"} onChange={() => setVisibility("public")}
              />
              <GlobeHemisphereWest className="h-[17px] w-[17px] mt-0.5 flex-shrink-0" style={{ color: visibility === "public" ? "var(--accent)" : "var(--muted)" }} />
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-[13.5px] font-medium text-foreground">{t("serverForm.visibilityPublic")}</span>
                <span className="text-xs text-muted leading-normal">{t("serverForm.visibilityPublicHelp")}</span>
              </span>
              <RadioDot selected={visibility === "public"} />
            </label>
            <label
              className="flex min-w-0 flex-1 items-start gap-2.5 rounded-md border px-3.5 py-3 cursor-pointer"
              style={
                visibility === "private"
                  ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
                  : { borderColor: "var(--border)", background: "var(--surface)" }
              }
            >
              <input
                type="radio" name="visibility" value="private" className="sr-only"
                checked={visibility === "private"} onChange={() => setVisibility("private")}
              />
              <LockSimple className="h-[17px] w-[17px] mt-0.5 flex-shrink-0" style={{ color: visibility === "private" ? "var(--accent)" : "var(--muted)" }} />
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-[13.5px] font-medium text-foreground">{t("serverForm.visibilityPrivate")}</span>
                <span className="text-xs text-muted leading-normal">{t("serverForm.visibilityPrivateHelp")}</span>
              </span>
              <RadioDot selected={visibility === "private"} />
            </label>
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
          <div className="flex flex-col gap-1.5">
            <input type="hidden" name="curseforgeModpackId" value={effectiveModpackId} />
            <input type="hidden" name="curseforgeModpackName" value={selectedModpack?.name ?? manualModpack.name} />
            <input type="hidden" name="curseforgeModpackVersion" value={selectedModpack?.latestVersion ?? manualModpack.version} />

            {manualModpackEntry ? (
              <div className="flex flex-col gap-4">
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
              </div>
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
                  <div className="mt-1.5 flex items-center gap-2.5 rounded-md px-3 py-2.5" style={{ border: "1px solid var(--accent)", background: "var(--surface)" }}>
                    {selectedModpack.iconUrl ? (
                      <img src={selectedModpack.iconUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="server-icon h-8 w-8 flex-shrink-0 text-sm">{selectedModpack.name.charAt(0).toUpperCase()}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-foreground">{selectedModpack.name}</p>
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

                <button type="button" onClick={() => setManualModpackEntry(true)} className="mt-1.5 self-start text-xs text-accent underline">
                  {t("wizard.modpackEnterManually")}
                </button>
              </>
            )}

            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted2">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              {t("serverForm.modpackNote")}
            </p>
          </div>
        ) : null}

        <div className="mt-2 flex justify-end gap-2.5">
          <Link href="/dashboard" className="btn-secondary">{t("wizard.back")}</Link>
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
      <div className={step === 1 ? "flex flex-col gap-9" : "hidden"}>
        <div>
          <h2 className="text-[26px] font-heading text-foreground mb-1.5">{t("wizard.connectionTitle")}</h2>
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

        <div className="mt-2 flex justify-end gap-2.5">
          <button type="button" onClick={back} className="btn-secondary">
            {t("wizard.back")}
          </button>
          <button type="button" onClick={next} disabled={!ip || !minecraftVersion} className="btn-primary">
            {t("wizard.continue")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Etape 3 — Verification */}
      <div className={step === 2 ? "flex flex-col gap-9" : "hidden"}>
        <div>
          <h2 className="text-[26px] font-heading text-foreground mb-1.5">{t("wizard.reviewTitle")}</h2>
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
            <span className="text-muted">{t("wizard.reviewVisibility")}</span>
            <span className="font-medium text-foreground">
              {visibility === "private" ? t("serverForm.visibilityPrivate") : t("serverForm.visibilityPublic")}
            </span>
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

        <div className="mt-2 flex justify-end gap-2.5">
          <button type="button" onClick={back} className="btn-secondary">
            {t("wizard.back")}
          </button>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? t("wizard.publishing") : t("wizard.publish")}
          </button>
        </div>
      </div>
      </form>
    </div>
  );
}

// Rond de selection a droite des cartes Public/Prive (maquette "02 · Onboarding") :
// anneau epais de la couleur accent quand la carte est choisie, fin et neutre sinon.
function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="mt-px h-4 w-4 flex-shrink-0 rounded-full"
      style={{ border: selected ? "5px solid var(--accent)" : "1.5px solid var(--border)" }}
    />
  );
}
