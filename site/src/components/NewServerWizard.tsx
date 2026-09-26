"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Globe, PuzzlePiece, ArrowRight, Info, GlobeHemisphereWest, LockSimple, Image, Cube, ImageSquare } from "@phosphor-icons/react";
import type { ServerActionState } from "@/lib/actions/servers";
import { ImageDropzone } from "@/components/ImageDropzone";
import { ModpackPicker, type ModpackValue } from "@/components/ModpackPicker";
import { MinecraftVersionField } from "@/components/MinecraftVersionField";
import { DEFAULT_MODPACK_SOURCE } from "@/lib/modpack-types";
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

  // Modpack choisi dans <ModpackPicker> (recherche CurseForge ou saisie
  // manuelle) : l'assistant n'a besoin que de l'identifiant, pour ne pas
  // laisser continuer un serveur modde sans modpack.
  const [modpack, setModpack] = useState<ModpackValue>({ id: "", name: "", version: "", source: DEFAULT_MODPACK_SOURCE });

  // Version de Minecraft + chargeur du modpack choisi dans la recherche
  // CurseForge, montres sous le champ "Version de Minecraft" pour que le
  // proprietaire n'ait pas a aller les chercher lui-meme.
  const modpackDetails =
    type === "modded"
      ? [modpack.minecraftVersion ? `Minecraft ${modpack.minecraftVersion}` : null, modpack.loader].filter(Boolean).join(" · ")
      : "";

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

        {/* Monte en permanence, juste masque en vanilla : la selection survit a un
            aller-retour Vanilla/Modde. Les champs caches partent aussi en vanilla,
            createServer les ignore (voir lib/actions/servers.ts). */}
        <div className={type === "modded" ? undefined : "hidden"}>
          <ModpackPicker onChange={setModpack} />
        </div>

        <div className="mt-2 flex justify-end gap-2.5">
          <Link href="/dashboard" className="btn-secondary">{t("wizard.back")}</Link>
          <button
            type="button" onClick={next}
            disabled={!name || !description || (type === "modded" && !modpack.id)}
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
          <MinecraftVersionField versions={versions} defaultValue={minecraftVersion} onChange={setMinecraftVersion}>
            {modpackDetails ? (
              <div className="flex items-start gap-1.5 text-xs text-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" />
                <div className="flex flex-col gap-0.5">
                  <span>{t("wizard.modpackChosen", { name: modpack.name })}</span>
                  <span>{modpackDetails}</span>
                </div>
              </div>
            ) : null}
          </MinecraftVersionField>
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
