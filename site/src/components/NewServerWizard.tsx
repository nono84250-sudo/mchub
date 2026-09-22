"use client";

import { useActionState, useState } from "react";
import { Globe, Puzzle, ArrowRight, ArrowLeft, Info } from "lucide-react";
import type { ServerActionState } from "@/lib/actions/servers";

type Props = {
  action: (prevState: ServerActionState, formData: FormData) => ServerActionState | Promise<ServerActionState>;
  versions: string[];
};

const STEPS = [
  { label: "Infos" },
  { label: "Connexion" },
  { label: "Vérification" },
];

// Assistant en 3 etapes pour la publication (maquette "Nocturne" — la
// console de gestion garde le formulaire simple existant pour l'edition,
// seule la creation passe par cet assistant). Un seul <form>/<action> pour
// les 3 etapes : les champs des etapes precedentes restent montes (juste
// masques en CSS) pour que leurs valeurs fassent partie de la soumission
// finale, plutot que de dupliquer un state parallele pour chaque champ.
export function NewServerWizard({ action, versions }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"vanilla" | "modded">("vanilla");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ip, setIp] = useState("");
  const [minecraftVersion, setMinecraftVersion] = useState("");
  const [recommendedRamGB, setRecommendedRamGB] = useState("");
  const [curseforgeModpackId, setCurseforgeModpackId] = useState("");

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
          <h2 className="text-xl font-heading text-foreground mb-1">Dis-nous en plus sur ton serveur</h2>
          <p className="text-sm text-muted">Ces infos apparaissent sur ta fiche publique et dans le launcher.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="field-label">Nom du serveur</label>
          <input
            id="name" name="name" type="text" required
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="ex : Frostpeak SMP" className="field-input"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="field-label">Description</label>
          <textarea
            id="description" name="description" required rows={3}
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Qu'est-ce qui rend ce monde intéressant ?" className="field-input"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bannerUrl" className="field-label">URL de la bannière (optionnel)</label>
            <input id="bannerUrl" name="bannerUrl" type="url" placeholder="https://..." className="field-input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="iconUrl" className="field-label">URL de l&apos;icône (optionnel)</label>
            <input id="iconUrl" name="iconUrl" type="url" placeholder="https://..." className="field-input" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="field-label">Type de serveur</span>
          <div className="inline-flex border border-border rounded-md overflow-hidden w-fit">
            <label
              className="flex cursor-pointer items-center gap-1.5 px-3.5 py-2 text-sm"
              style={type === "vanilla" ? { boxShadow: "inset 0 0 0 1px var(--accent)", color: "var(--accent)" } : { color: "var(--muted)" }}
            >
              <input type="radio" name="type" value="vanilla" checked={type === "vanilla"} onChange={() => setType("vanilla")} className="sr-only" />
              <Globe className="h-4 w-4" /> Vanilla
            </label>
            <label
              className="flex cursor-pointer items-center gap-1.5 border-l border-border px-3.5 py-2 text-sm"
              style={type === "modded" ? { boxShadow: "inset 0 0 0 1px var(--accent)", color: "var(--accent)" } : { color: "var(--muted)" }}
            >
              <input type="radio" name="type" value="modded" checked={type === "modded"} onChange={() => setType("modded")} className="sr-only" />
              <Puzzle className="h-4 w-4" /> Moddé (CurseForge)
            </label>
          </div>
        </div>

        {type === "modded" ? (
          <div className="flex flex-col gap-4 rounded-lg p-4" style={{ border: "1px solid var(--accent)" }}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="curseforgeModpackId" className="field-label">Identifiant du modpack CurseForge</label>
              <input
                id="curseforgeModpackId" name="curseforgeModpackId" type="text" required={type === "modded"}
                value={curseforgeModpackId} onChange={(e) => setCurseforgeModpackId(e.target.value)}
                className="field-input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="curseforgeModpackName" className="field-label">Nom du modpack</label>
              <input id="curseforgeModpackName" name="curseforgeModpackName" type="text" className="field-input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="curseforgeModpackVersion" className="field-label">Version du modpack</label>
              <input id="curseforgeModpackVersion" name="curseforgeModpackVersion" type="text" className="field-input" />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              Les joueurs téléchargent ce modpack automatiquement au premier lancement.
            </p>
          </div>
        ) : null}

        <div className="mt-2 flex justify-end">
          <button
            type="button" onClick={next}
            disabled={!name || !description || (type === "modded" && !curseforgeModpackId)}
            className="btn-primary"
          >
            Continuer <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Etape 2 — Connexion */}
      <div className={step === 1 ? "flex flex-col gap-5" : "hidden"}>
        <div>
          <h2 className="text-xl font-heading text-foreground mb-1">Comment les joueurs se connectent</h2>
          <p className="text-sm text-muted">L&apos;adresse n&apos;est jamais affichée publiquement — seul le launcher la reçoit.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ip" className="field-label">Adresse de connexion (IP)</label>
          <input
            id="ip" name="ip" type="text" required
            value={ip} onChange={(e) => setIp(e.target.value)}
            placeholder="play.monserveur.fr:25565" className="field-input"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="minecraftVersion" className="field-label">Version de Minecraft</label>
            <input
              id="minecraftVersion" name="minecraftVersion" type="text" list="mc-versions" required
              value={minecraftVersion} onChange={(e) => setMinecraftVersion(e.target.value)}
              placeholder="ex : 1.21.4" className="field-input"
            />
            <datalist id="mc-versions">
              {versions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recommendedRamGB" className="field-label">RAM recommandée (Go, optionnel)</label>
            <input
              id="recommendedRamGB" name="recommendedRamGB" type="number" min={1} max={32} step={1}
              value={recommendedRamGB} onChange={(e) => setRecommendedRamGB(e.target.value)}
              placeholder="ex : 4" className="field-input"
            />
          </div>
        </div>

        <div className="mt-2 flex justify-between">
          <button type="button" onClick={back} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
          <button type="button" onClick={next} disabled={!ip || !minecraftVersion} className="btn-primary">
            Continuer <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Etape 3 — Verification */}
      <div className={step === 2 ? "flex flex-col gap-5" : "hidden"}>
        <div>
          <h2 className="text-xl font-heading text-foreground mb-1">Vérifie avant de publier</h2>
          <p className="text-sm text-muted">Tu pourras tout modifier plus tard depuis la console de gestion.</p>
        </div>

        <div className="panel divide-y divide-border">
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">Nom</span>
            <span className="font-medium text-foreground">{name || "—"}</span>
          </div>
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">Type</span>
            <span className="font-medium text-foreground">{type === "modded" ? "Moddé" : "Vanilla"}</span>
          </div>
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">Version</span>
            <span className="font-medium text-foreground">{minecraftVersion || "—"}</span>
          </div>
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">Adresse</span>
            <span className="font-medium text-foreground">{ip || "—"}</span>
          </div>
          {recommendedRamGB ? (
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-muted">RAM recommandée</span>
              <span className="font-medium text-foreground">{recommendedRamGB} Go</span>
            </div>
          ) : null}
        </div>

        {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <div className="mt-2 flex justify-between">
          <button type="button" onClick={back} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Publication..." : "Publier le serveur"}
          </button>
        </div>
      </div>
    </form>
  );
}
