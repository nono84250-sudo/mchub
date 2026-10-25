"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Globe, PuzzlePiece, ArrowRight, Info, LockSimple, Image, Cube, ImageSquare } from "@phosphor-icons/react";
import type { ServerActionState } from "@/lib/actions/servers";
import { ImageDropzone } from "@/components/ImageDropzone";
import { ModpackPicker, type ModpackValue } from "@/components/ModpackPicker";
import { MinecraftVersionField } from "@/components/MinecraftVersionField";
import { DEFAULT_MODPACK_CHANNEL, DEFAULT_MODPACK_SOURCE, type ModpackSource } from "@/lib/modpack-types";
import { ServerListOptions } from "@/components/ServerListOptions";
import { LogoMark } from "@/components/LogoMark";
import { useI18n } from "@/i18n/I18nProvider";
import { SERVER_TEMPLATES, type ServerTemplateId } from "@/lib/serverTemplates";
import { fallbackBanner } from "@/lib/fallbackBanner";

const TEMPLATE_KEYS: Record<ServerTemplateId, { title: string; sub: string; desc: string }> = {
  survival: { title: "wizard.tplSurvival", sub: "wizard.tplSurvivalSub", desc: "wizard.tplSurvivalDesc" },
  rpg: { title: "wizard.tplRpg", sub: "wizard.tplRpgSub", desc: "wizard.tplRpgDesc" },
  cobblemon: { title: "wizard.tplCobblemon", sub: "wizard.tplCobblemonSub", desc: "wizard.tplCobblemonDesc" },
};

type Props = {
  action: (prevState: ServerActionState, formData: FormData) => ServerActionState | Promise<ServerActionState>;
  versions: string[];
  sourceStates?: Record<ModpackSource, boolean>;
  sourceMaintenance?: { source: ModpackSource; message: string } | null;
  // Teams du compte (teams, 19/10) : liste « Team » de l'etape 1, « Aucune team » par defaut.
  teams?: { id: string; name: string }[];
};

// Assistant en 3 etapes pour la publication (maquette "Nocturne" — la
// console de gestion garde le formulaire simple existant pour l'edition,
// seule la creation passe par cet assistant). Un seul <form>/<action> pour
// les 3 etapes : les champs des etapes precedentes restent montes (juste
// masques en CSS) pour que leurs valeurs fassent partie de la soumission
// finale, plutot que de dupliquer un state parallele pour chaque champ.
export function NewServerWizard({ action, versions, sourceStates, sourceMaintenance, teams = [] }: Props) {
  const { t, locale } = useI18n();
  const STEPS = [
    { label: t("wizard.stepBasics") },
    { label: t("wizard.stepConnection") },
    { label: t("wizard.stepReview") },
  ];
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"vanilla" | "modded">("vanilla");
  // Toute nouvelle fiche est privee (decision produit du 2026-10-10) : passer publique exige
  // d'abord l'auto-test de publication reussi dans le launcher (voir selfTestPassedAt, et
  // ServerForm.tsx pour le controle "Publier" une fois la fiche creee). Plus de choix a la
  // creation : createServer le forcerait de toute facon meme si ce champ existait encore.
  const visibility = "private" as const;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ip, setIp] = useState("");
  const [minecraftVersion, setMinecraftVersion] = useState("");
  const [recommendedRamGB, setRecommendedRamGB] = useState("");
  const [autoConnect, setAutoConnect] = useState(true);
  const [addToServerList, setAddToServerList] = useState(true);
  // Modele de fiche (design 2026-10-17, point 7) : preremplit description, type et RAM ;
  // ses etiquettes partent avec le champ cache « template » (voir createServer).
  const [template, setTemplate] = useState<ServerTemplateId | null>(null);
  const pickTemplate = (id: ServerTemplateId) => {
    const next = template === id ? null : id;
    setTemplate(next);
    if (!next) return;
    const tpl = SERVER_TEMPLATES[next];
    setType(tpl.type);
    setRecommendedRamGB(String(tpl.ramGB));
    // Ne remplace jamais une description deja ecrite a la main.
    const known = (Object.keys(SERVER_TEMPLATES) as ServerTemplateId[]).map((k) => t(TEMPLATE_KEYS[k].desc));
    if (!description.trim() || known.includes(description)) setDescription(t(TEMPLATE_KEYS[next].desc));
  };

  // Modpack choisi dans <ModpackPicker> (recherche CurseForge ou saisie
  // manuelle) : l'assistant n'a besoin que de l'identifiant, pour ne pas
  // laisser continuer un serveur modde sans modpack.
  const [modpack, setModpack] = useState<ModpackValue>({ id: "", name: "", version: "", source: DEFAULT_MODPACK_SOURCE, channel: DEFAULT_MODPACK_CHANNEL });

  // Version de Minecraft + chargeur du modpack choisi dans la recherche
  // CurseForge, montres sous le champ "Version de Minecraft" pour que le
  // proprietaire n'ait pas a aller les chercher lui-meme.
  const modpackDetails =
    type === "modded"
      ? [modpack.minecraftVersion ? `Minecraft ${modpack.minecraftVersion}` : null, modpack.loader].filter(Boolean).join(" · ")
      : "";
  // Moddé + modpack vérifié par la recherche (CurseForge/Modrinth) : la version
  // Minecraft vient du modpack, impossible à ressaisir à la main (voir
  // decouverte du 2026-10-02 : un modpack peut changer de version MC). Reste
  // éditable seulement en saisie manuelle du modpack (pas de version connue).
  const showManualVersion = type !== "modded" || !modpack.minecraftVersion;
  const effectiveVersion = showManualVersion ? minecraftVersion : modpack.minecraftVersion!;

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

        <div className="flex flex-col gap-2">
          <span className="field-label">{t("wizard.templatesTitle")}</span>
          <input type="hidden" name="template" value={template ?? ""} />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {(Object.keys(SERVER_TEMPLATES) as ServerTemplateId[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={template === id}
                onClick={() => pickTemplate(id)}
                className={`overflow-hidden rounded-xl border bg-surface text-left transition-colors ${
                  template === id ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-border hover:border-accent"
                }`}
              >
                <span className="block h-[54px]" style={{ background: fallbackBanner(t(TEMPLATE_KEYS[id].title)) }} />
                <span className="block px-2.5 py-2">
                  <b className="block text-[13.5px] font-semibold text-foreground">{t(TEMPLATE_KEYS[id].title)}</b>
                  <small className="text-xs text-muted">{t(TEMPLATE_KEYS[id].sub)}</small>
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{t("wizard.templatesHint")}</p>
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

        {/* Team du serveur (choix de Rushi du 19/10) : la meme liste que dans Paramètres et que les
            interrupteurs de « Ma team ». Verifiee par createServer (team de ce compte seulement). */}
        {teams.length ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="teamId" className="field-label">{t("team.serverTeamLabel")}</label>
            <select id="teamId" name="teamId" defaultValue="" className="field-input w-fit min-w-[220px]">
              <option value="">{t("team.noTeam")}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted">{t("team.serverTeamHint")}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="field-label">{t("serverForm.visibility")}</span>
          {/* Plus de choix a la creation : toute nouvelle fiche est privee (voir le
              commentaire sur `visibility` ci-dessus). Champ cache quand meme envoye pour que
              readForm() (lib/actions/servers.ts) reste inchange cote lecture du formulaire. */}
          <input type="hidden" name="visibility" value="private" />
          <div className="flex items-start gap-1.5 rounded-md border px-3.5 py-3 text-xs text-foreground" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <LockSimple className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" />
            <span className="leading-normal">{t("wizard.visibilityPrivateOnlyNote")}</span>
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
          <ModpackPicker onChange={setModpack} sourceStates={sourceStates} sourceMaintenance={sourceMaintenance} />
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

        <div className="flex items-start gap-1.5 rounded-md border px-3.5 py-3 text-xs text-foreground" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" />
          <span className="leading-normal">{t("wizard.connectionVerificationNote")}</span>
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
          {showManualVersion ? (
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
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="field-label">{t("serverForm.version")}</span>
              <input type="hidden" name="minecraftVersion" value={effectiveVersion} />
              <div className="flex items-start gap-1.5 text-xs text-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" />
                <div className="flex flex-col gap-0.5">
                  <span>{t("wizard.modpackChosen", { name: modpack.name })}</span>
                  <span>{modpackDetails}</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recommendedRamGB" className="field-label">{t("serverForm.ram")}</label>
            <input
              id="recommendedRamGB" name="recommendedRamGB" type="number" min={1} max={32} step={1}
              value={recommendedRamGB} onChange={(e) => setRecommendedRamGB(e.target.value)}
              placeholder={t("serverForm.ramPlaceholder")} className="field-input"
            />
          </div>
        </div>

        <ServerListOptions
          addToServerList={addToServerList}
          onAddToServerListChange={setAddToServerList}
          autoConnect={autoConnect}
          onAutoConnectChange={setAutoConnect}
          minecraftVersion={effectiveVersion}
        />

        <div className="mt-2 flex justify-end gap-2.5">
          <button type="button" onClick={back} className="btn-secondary">
            {t("wizard.back")}
          </button>
          <button type="button" onClick={next} disabled={!ip || !effectiveVersion} className="btn-primary">
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
            <span className="font-medium text-foreground">{effectiveVersion || "—"}</span>
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
