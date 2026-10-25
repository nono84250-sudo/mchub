import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, execSql } from "@/lib/db";
import { launcherIdentityUuid, normalizeMinecraftUuid } from "@/lib/launcherAuth";

// Laboratoire (25/10, demande de Rushi) : un interrupteur par fonctionnalité, réglé dans
// /admin/laboratoire, lu par le site ET le launcher. C'est TOUJOURS le site qui décide : le
// launcher demande la liste (/api/launcher/features) et chaque route d'une fonctionnalité
// vérifie elle-même son interrupteur (requireLauncherFeature / featureVisibleOnSite). Une
// fonctionnalité cachée est donc refusée par le serveur, pas seulement masquée à l'écran.
//
// Rangé dans platformSetting (une ligne « feature.<id> » par fonctionnalité, plus
// « feature.testers ») : aucune table à créer. Une ligne absente vaut le défaut du catalogue
// ci-dessous ; toute NOUVELLE fonctionnalité arrive avec le défaut « hidden ».

export const FEATURE_STATES = ["hidden", "test", "betaTesters", "beta", "all"] as const;
export type FeatureState = (typeof FEATURE_STATES)[number];

export type FeatureDef = {
  id: string;
  parent?: string;
  defaultState: FeatureState;
  where: ("site" | "launcher")[];
  minLauncher?: string;
  group: "play" | "social" | "launcher";
  name: { fr: string; en: string };
  description: { fr: string; en: string };
};

// À chaque nouvelle fonctionnalité : une entrée ici (défaut « hidden »), puis
// requireLauncherFeature / featureVisibleOnSite dans ses routes et ses pages.
export const FEATURES: FeatureDef[] = [
  {
    id: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    name: { fr: "Mode Jouer et packs officiels", en: "Play mode and official packs" },
    description: {
      fr: "Onglet Jouer du launcher : versions de Minecraft, packs officiels, Mes mondes sur le PC et leurs sauvegardes.",
      en: "Launcher Play tab: Minecraft versions, official packs, My worlds on the PC and their backups.",
    },
  },
  {
    id: "worlds",
    parent: "play",
    defaultState: "hidden",
    where: ["launcher", "site"],
    minLauncher: "0.4.0",
    group: "play",
    name: { fr: "Mondes en ligne (cloud)", en: "Online worlds (cloud)" },
    description: {
      fr: "Envoi des mondes en ligne, versions gardées, mondes sur plusieurs PC, page Mes mondes du site.",
      en: "Sending worlds online, kept versions, worlds on several PCs, the site's My worlds page.",
    },
  },
  {
    id: "liveSave",
    parent: "play",
    defaultState: "hidden",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    name: { fr: "Sauvegarde en jeu (F6)", en: "In-game save (F6)" },
    description: {
      fr: "F6 et Maj+F6 pendant la partie, sauvegarde automatique toutes les 30 min et en quittant un monde.",
      en: "F6 and Shift+F6 while playing, automatic save every 30 min and when leaving a world.",
    },
  },
  {
    id: "team",
    defaultState: "test",
    where: ["site"],
    group: "social",
    name: { fr: "Ma team", en: "My team" },
    description: {
      fr: "Onglet Ma team du tableau de bord : créer sa team, y rattacher ses serveurs, demander une team.",
      en: "Dashboard My team tab: create a team, attach servers, request a team.",
    },
  },
  {
    id: "friends",
    defaultState: "all",
    where: ["launcher", "site"],
    group: "social",
    name: { fr: "Amis", en: "Friends" },
    description: { fr: "Demandes d'amis et qui joue où.", en: "Friend requests and who plays where." },
  },
  {
    id: "tour",
    defaultState: "betaTesters",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "launcher",
    name: { fr: "Visite guidée", en: "Guided tour" },
    description: { fr: "Bulles qui présentent le menu au premier lancement.", en: "Bubbles that present the menu on first launch." },
  },
];

const FEATURE_BY_ID = new Map(FEATURES.map((f) => [f.id, f]));
const keyOf = (id: string) => `feature.${id}`;
const TESTERS_KEY = "feature.testers";
const FEATURES_TAG = "features";
const upsertSetting =
  'INSERT INTO "platformSetting" ("key", "value", "updatedAt") VALUES (?, ?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updatedAt" = excluded."updatedAt"';

export type Tester = { uuid: string; name: string };
type LabSnapshot = { states: Record<string, FeatureState>; updatedAt: Record<string, string | null>; testers: Tester[] };

const isState = (value: unknown): value is FeatureState => typeof value === "string" && (FEATURE_STATES as readonly string[]).includes(value);

// Lu à chaque appel du launcher et à chaque page qui affiche une fonctionnalité : une seule
// requête, gardée 60 s et vidée dès qu'un admin change un interrupteur (même principe que
// platformSettings.ts). Une erreur de base ne doit jamais tout montrer : les défauts du
// catalogue s'appliquent alors (les nouvelles fonctionnalités restent cachées).
const readLab = unstable_cache(
  async (): Promise<LabSnapshot> => {
    const rows = await execSql('SELECT "key", "value", "updatedAt" FROM "platformSetting" WHERE "key" LIKE ?', ["feature.%"]);
    const states: Record<string, FeatureState> = {};
    const updatedAt: Record<string, string | null> = {};
    let testers: Tester[] = [];
    for (const row of rows) {
      const key = String(row.key);
      if (key === TESTERS_KEY) {
        try {
          const parsed = JSON.parse(String(row.value));
          if (Array.isArray(parsed)) testers = parsed.filter((t) => t && typeof t.uuid === "string" && typeof t.name === "string");
        } catch {
          /* liste illisible : aucun testeur */
        }
        continue;
      }
      const id = key.slice("feature.".length);
      if (FEATURE_BY_ID.has(id) && isState(row.value)) {
        states[id] = row.value;
        updatedAt[id] = row.updatedAt ? String(row.updatedAt) : null;
      }
    }
    return { states, updatedAt, testers };
  },
  ["feature-lab"],
  { revalidate: 60, tags: [FEATURES_TAG] },
);

async function lab(): Promise<LabSnapshot> {
  try {
    return await readLab();
  } catch (error) {
    console.error("[features] lecture impossible, défauts du catalogue", error);
    return { states: {}, updatedAt: {}, testers: [] };
  }
}

const RANK: Record<FeatureState, number> = { hidden: 0, test: 1, betaTesters: 2, beta: 3, all: 4 };

// État réel : une fonctionnalité « enfant » n'est jamais plus visible que son parent.
function effectiveState(id: string, states: Record<string, FeatureState>): FeatureState {
  const def = FEATURE_BY_ID.get(id);
  if (!def) return "hidden";
  const own = states[id] ?? def.defaultState;
  if (!def.parent) return own;
  const parent = effectiveState(def.parent, states);
  return RANK[own] > RANK[parent] ? parent : own;
}

export type Viewer = { tester: boolean; betaChannel: boolean };
export type FeatureAccess = { visible: boolean; beta: boolean; state: FeatureState };

function accessFor(state: FeatureState, viewer: Viewer): FeatureAccess {
  const visible =
    state === "all" || state === "beta" || (state === "betaTesters" && (viewer.betaChannel || viewer.tester)) || (state === "test" && viewer.tester);
  return { visible, beta: visible && state !== "all", state };
}

// --- Lecture pour l'admin ---------------------------------------------------------------------
export async function getLabForAdmin(): Promise<{
  features: (FeatureDef & { state: FeatureState; effective: FeatureState; updatedAt: string | null })[];
  testers: Tester[];
}> {
  const snap = await lab();
  return {
    features: FEATURES.map((f) => ({
      ...f,
      state: snap.states[f.id] ?? f.defaultState,
      effective: effectiveState(f.id, snap.states),
      updatedAt: snap.updatedAt[f.id] ?? null,
    })),
    testers: snap.testers,
  };
}

export async function setFeatureStates(changes: Record<string, FeatureState>): Promise<void> {
  const at = new Date().toISOString();
  for (const [id, state] of Object.entries(changes)) {
    if (!FEATURE_BY_ID.has(id) || !isState(state)) continue;
    await execSql(upsertSetting, [keyOf(id), state, at]);
  }
  revalidateTag(FEATURES_TAG, { expire: 0 });
}

export async function setTesters(testers: Tester[]): Promise<void> {
  await execSql(upsertSetting, [TESTERS_KEY, JSON.stringify(testers.slice(0, 50)), new Date().toISOString()]);
  revalidateTag(FEATURES_TAG, { expire: 0 });
}

// --- Qui regarde ? ----------------------------------------------------------------------------
async function isTesterUuid(uuid: string | null): Promise<boolean> {
  if (!uuid) return false;
  const normalized = normalizeMinecraftUuid(uuid);
  return (await lab()).testers.some((t) => normalizeMinecraftUuid(t.uuid) === normalized);
}

// Launcher : l'UUID vient de la session SIGNÉE du launcher (jamais d'un paramètre cru sur
// parole) ; le canal bêta se lit dans la version envoyée par le launcher (0.4.0-beta.x).
export async function launcherViewer(request: Request): Promise<Viewer & { uuid: string | null }> {
  const uuid = await launcherIdentityUuid(request).catch(() => null);
  const version = request.headers.get("x-launcher-version") ?? "";
  return { uuid, tester: await isTesterUuid(uuid), betaChannel: /-beta/i.test(version) };
}

// Site : testeur = compte connecté dont le compte Minecraft est dans la liste. Être connecté à
// l'admin ne suffit pas (25/10, demande de Rushi : pouvoir s'ajouter puis se retirer pour vérifier
// que ça s'affiche puis disparaît). Le site n'a pas de canal bêta : « Bêta testeurs » n'y montre
// rien de plus qu'aux testeurs.
export async function siteViewer(): Promise<Viewer> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { tester: false, betaChannel: false };
  const user = await db.orm.public.User.select("minecraftUuid").where({ id: session.user.id }).first().catch(() => null);
  return { tester: await isTesterUuid(user?.minecraftUuid ?? null), betaChannel: false };
}

// État réel d'une fonctionnalité, pour tout le monde (badges globaux, ex. menu de l'admin).
export async function featureState(id: string): Promise<FeatureState> {
  return effectiveState(id, (await lab()).states);
}

export async function featuresFor(viewer: Viewer): Promise<Record<string, FeatureAccess>> {
  const snap = await lab();
  return Object.fromEntries(FEATURES.map((f) => [f.id, accessFor(effectiveState(f.id, snap.states), viewer)]));
}

export async function featureFor(id: string, viewer: Viewer): Promise<FeatureAccess> {
  const snap = await lab();
  return accessFor(effectiveState(id, snap.states), viewer);
}

// --- Verrous ------------------------------------------------------------------------------------
// À appeler en tête de chaque route launcher d'une fonctionnalité : null si elle est visible
// pour ce joueur, sinon la réponse 404 à renvoyer (comme si la route n'existait pas).
export async function requireLauncherFeature(request: Request, id: string): Promise<NextResponse | null> {
  const access = await featureFor(id, await launcherViewer(request));
  if (access.visible) return null;
  return NextResponse.json({ error: "Fonctionnalité indisponible.", code: "feature_off" }, { status: 404 });
}

// Pages et actions du site : vrai si la fonctionnalité est visible pour le visiteur.
export async function featureVisibleOnSite(id: string): Promise<boolean> {
  return (await featureFor(id, await siteViewer())).visible;
}

// Badge « Bêta » sur le site (menus, titres) : vrai tant que la fonctionnalité n'est pas « Pour tous ».
export async function featureOnSite(id: string): Promise<FeatureAccess> {
  return featureFor(id, await siteViewer());
}

// Enveloppe une route launcher : 404 « feature_off » tant que la fonctionnalité est cachée pour
// ce joueur, sinon la route elle-même.
export function withLauncherFeature<A extends [Request, ...unknown[]]>(id: string, handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => (await requireLauncherFeature(args[0], id)) ?? handler(...args);
}
