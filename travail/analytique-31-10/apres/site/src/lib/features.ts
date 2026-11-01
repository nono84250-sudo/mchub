import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, execSql } from "@/lib/db";
import { isAuthorizedLauncherRequest, launcherIdentityUuid, normalizeMinecraftUuid } from "@/lib/launcherAuth";

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
  // Sous-groupe de « Jouer et mondes » dans /admin/laboratoire. Affichage seulement : la clé
  // feature.<id> et les états ne dépendent pas de ce champ.
  section?: "worldsSaves" | "importPack" | "buildPack" | "playPage" | "comfort";
  name: { fr: string; en: string };
  description: { fr: string; en: string };
};

// À chaque nouvelle fonctionnalité : une entrée ici (défaut « hidden »), puis
// requireLauncherFeature / featureVisibleOnSite dans ses routes et ses pages.
// Groupe « play » : choisir aussi sa section (sinon elle arrive dans « Autres » au Laboratoire).
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
    section: "worldsSaves",
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
    section: "worldsSaves",
    name: { fr: "Sauvegarde en jeu (F6)", en: "In-game save (F6)" },
    description: {
      fr: "F6 et Maj+F6 pendant la partie, sauvegarde automatique toutes les 30 min et en quittant un monde.",
      en: "F6 and Shift+F6 while playing, automatic save every 30 min and when leaving a world.",
    },
  },
  {
    id: "strictDirs",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "playPage",
    name: { fr: "Un dossier par version", en: "One folder per version" },
    description: {
      fr: "Dans Jouer, chaque version (vanilla ou modée) a son propre dossier de jeu ; les mondes existants y sont rangés après une sauvegarde.",
      en: "In Play, each version (vanilla or modded) has its own game folder; existing worlds are moved there after a backup.",
    },
  },
  {
    id: "myPack",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "buildPack",
    name: { fr: "Mon pack", en: "My pack" },
    description: {
      fr: "Créer son pack de mods (Modrinth), page d'un pack avec onglets et assistant « Corriger le pack ».",
      en: "Build your own mod pack (Modrinth), pack page with tabs and the « Fix the pack » assistant.",
    },
  },
  {
    id: "myPackCf",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "buildPack",
    name: { fr: "Mon pack : mods CurseForge", en: "My pack: CurseForge mods" },
    description: {
      fr: "Dans Mon pack, liste CurseForge : le joueur télécharge chaque mod lui-même, le launcher le trouve dans Téléchargements.",
      en: "In My pack, CurseForge list: the player downloads each mod, the launcher finds it in Downloads.",
    },
  },
  {
    id: "cfImport",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "importPack",
    name: { fr: "Importer un pack CurseForge", en: "Import a CurseForge pack" },
    description: {
      fr: "Importer un export CurseForge (.zip) avec ses mods, réglages, ressources, shaders et mondes.",
      en: "Import a CurseForge export (.zip) with its mods, settings, resources, shaders and worlds.",
    },
  },
  {
    id: "mrImport",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "importPack",
    name: { fr: "Importer un pack Modrinth", en: "Import a Modrinth pack" },
    description: {
      fr: "« Importer un pack » propose aussi Modrinth (.mrpack) : tous les mods se téléchargent seuls, avec réglages, ressources, shaders et mondes.",
      en: "“Import a pack” also offers Modrinth (.mrpack): every mod downloads by itself, with settings, resources, shaders and worlds.",
    },
  },
  {
    id: "crashHelp",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "comfort",
    name: { fr: "Aide au crash", en: "Crash help" },
    description: {
      fr: "À chaque fermeture du jeu, le launcher lit les logs et dit le problème (mod manquant, trop vieux…), avec « Corriger » et « Copier les logs ».",
      en: "Each time the game closes, the launcher reads the logs and tells the problem (missing or old mod…), with « Fix » and « Copy the logs ».",
    },
  },
  // 31/10 (preview « Catalogue de bugs » validée par Rushi) : défaut « Test ».
  {
    id: "bugCatalog",
    parent: "play",
    defaultState: "test",
    where: ["launcher", "site"],
    minLauncher: "0.4.0",
    group: "play",
    section: "comfort",
    name: { fr: "Catalogue de bugs", en: "Bug catalogue" },
    description: {
      fr: "Les bugs connus : le launcher les reconnaît à la fermeture du jeu, les corrige, propose « Corriger » ou montre la marche à suivre. Page publique /aide/bugs.",
      en: "Known bugs: the launcher recognises them when the game closes, fixes them, offers “Fix it” or shows the steps. Public page /aide/bugs.",
    },
  },
  // 27/10 (preview « Changement de version » validée par Rushi, « Ajoute le ») : défaut « Test ».
  {
    id: "versionGuard",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "worldsSaves",
    name: { fr: "Protéger les mondes au changement de version", en: "Protect worlds on version change" },
    description: {
      fr: "« Mettre à jour » une installation : ses mondes sont sauvegardés 🛡 et vérifiés avant. Version de chaque sauvegarde, et sauvegarde des mondes plus anciens avant de lancer une version plus récente.",
      en: "« Update » an installation: its worlds are backed up 🛡 and checked first. Each backup's version, and older worlds backed up before launching a newer version.",
    },
  },
  // 27/10 (preview « Page Jouer » C1 validée par Rushi, « Toute la C1 ») : défaut « Test ».
  {
    id: "playTiles",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "playPage",
    name: { fr: "Page Jouer en tuiles", en: "Play page as tiles" },
    description: {
      fr: "Mes installations en tuiles (clic = page de l'installation), leurs mondes dans un tiroir « Mondes », bande « Continuer », interrupteur Sauvegarde sur chaque monde, copies gardées étiquetées.",
      en: "My installations as tiles (click = installation page), their worlds in a « Worlds » drawer, « Continue » strip, Backup switch on each world, kept copies labelled.",
    },
  },
  // 27/10 (preview « Pack Omniscient » v22 validée par Rushi, « tu peux tout coder ») : défaut « Test ».
  {
    id: "vanillaPage",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "playPage",
    name: { fr: "Page des versions vanilla", en: "Vanilla version page" },
    description: {
      fr: "Un clic sur une version vanilla ouvre sa page : packs de ressources, mondes (chercher, importer une map), fichiers, bouton Retirer.",
      en: "Clicking a vanilla version opens its page: resource packs, worlds (search, import a map), files, Remove button.",
    },
  },
  {
    id: "dataPacks",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "buildPack",
    name: { fr: "Data packs", en: "Data packs" },
    description: {
      fr: "Onglet Data packs : chercher sur Modrinth ou ajouter un .zip, choisir les mondes (sauvegarde avant), ou tous les mondes avec Paxi / Global Packs.",
      en: "Data packs tab: search Modrinth or add a .zip, pick the worlds (backup first), or every world with Paxi / Global Packs.",
    },
  },
  {
    id: "packFiles",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "buildPack",
    name: { fr: "Explorateur de fichiers", en: "File explorer" },
    description: {
      fr: "Onglet Fichiers d'une version : naviguer, modifier les fichiers texte (copie .bak), voir les images, renommer, mettre à la Corbeille.",
      en: "A version's Files tab: browse, edit text files (.bak copy), view images, rename, move to the Recycle Bin.",
    },
  },
  {
    id: "packExport",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "buildPack",
    name: { fr: "Exporter pour un ami (.mrpack)", en: "Export for a friend (.mrpack)" },
    description: {
      fr: "Menu ⚙ d'une version : fichier .mrpack (mods en liens Modrinth, réglages, packs, mondes cochés). Jamais de mod CurseForge dans le fichier.",
      en: "A version's ⚙ menu: .mrpack file (Modrinth mod links, settings, packs, ticked worlds). Never a CurseForge mod in the file.",
    },
  },
  {
    id: "omniPack",
    parent: "play",
    defaultState: "test",
    where: ["launcher", "site"],
    minLauncher: "0.4.0",
    group: "play",
    section: "buildPack",
    name: { fr: "Pack Omniscient", en: "Omniscient pack" },
    description: {
      fr: "Créer un Pack Omniscient (Modrinth seulement ou vanilla), le générer pour d'autres versions, l'exporter en .omnipack ; page « Proposer un pack » du site et import dans l'admin (tester, publier).",
      en: "Create an Omniscient pack (Modrinth only or vanilla), generate it for other versions, export a .omnipack; the site's “Submit a pack” page and admin import (test, publish).",
    },
  },
  // 28/10 (preview « Packs Modrinth, CurseForge, FTB » B validée par Rushi, « tu peux coder tout ») :
  // défaut « Test ».
  {
    id: "packBrowse",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "importPack",
    name: { fr: "Packs existants (Modrinth, CurseForge, FTB)", en: "Existing packs (Modrinth, CurseForge, FTB)" },
    description: {
      fr: "« + Nouvelle version » propose 3 cartes : Créer, Un pack existant (chercher et installer un pack Modrinth, CurseForge ou FTB) et Importer. En-tête de Jouer allégé (menu « ⋯ »).",
      en: "« + New version » offers 3 cards: Create, An existing pack (search and install a Modrinth, CurseForge or FTB pack) and Import. Lighter Play header (« ⋯ » menu).",
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
  // 31/10 (preview « Panel Analytique » validée par Rushi) : défaut « Test ».
  {
    id: "analytics",
    defaultState: "test",
    where: ["site"],
    group: "social",
    name: { fr: "Analytique (admin) et signaux du site", en: "Analytics (admin) and site signals" },
    description: {
      fr: "Page Analytique de l'admin (visible dès que ce n'est pas « Cachée »). Signal du site : Test = comptes testeurs seulement, Bêta publique ou Pour tous = tous les visiteurs. Cachée : ni page, ni signal.",
      en: "Admin Analytics page (visible unless “Hidden”). Site signal: Test = tester accounts only, Public beta or For everyone = every visitor. Hidden: no page, no signal.",
    },
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
  // 28/10 (preview « Visite de Jouer » validée par Rushi) : défaut « Test ».
  {
    id: "playTour",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "launcher",
    name: { fr: "Visite de Jouer", en: "Play tour" },
    description: {
      fr: "9 bulles qui montrent la page Jouer (installations, mondes, sauvegarde auto, réglages des sauvegardes dans « ⋯ »). Proposée à la 1re ouverture de Jouer, depuis la visite guidée, Paramètres › Divers et l'Aide.",
      en: "9 bubbles that show the Play page (installations, worlds, auto backup, backup settings in « ⋯ »). Offered the first time Play opens, from the guided tour, Settings › Misc and Help.",
    },
  },  // 28/10 (preview « Jouer : premiers pas et ajouts » validée par Rushi) : défaut « Test ».
  {
    id: "firstInstall",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "playPage",
    name: { fr: "Première installation automatique", en: "Automatic first installation" },
    description: {
      fr: "Au tout premier lancement de Jouer, le launcher crée « Minecraft <dernière version> » (rien n'est téléchargé avant « Jouer »). Sans Internet, ou si le joueur retire tout, une carte « Commence ici ».",
      en: "The very first time Play opens, the launcher creates “Minecraft <latest version>” (nothing is downloaded before “Play”). Offline, or if the player removes everything, a “Start here” card.",
    },
  },
  {
    id: "contentCf",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "buildPack",
    name: { fr: "Ajouter depuis CurseForge (page d'une installation)", en: "Add from CurseForge (installation page)" },
    description: {
      fr: "La fenêtre « Ajouter » (packs de ressources, shaders, mondes, data packs) cherche aussi sur CurseForge et télécharge le fichier quand son auteur le permet ; sinon « Page ↗ ». Coupé : Modrinth et « Importer un fichier .zip » seulement.",
      en: "The “Add” window (resource packs, shaders, worlds, data packs) also searches CurseForge and downloads the file when its author allows it; otherwise “Page ↗”. Off: Modrinth and “Import a .zip file” only.",
    },
  },
  // 31/10 (preview « Menus d'ajout » validée par Rushi, « tu peux coder ces menus-là ») : défaut « Test ».
  {
    id: "addMenus",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "buildPack",
    name: { fr: "Nouveaux menus d'ajout (compatibilité et fiches)", en: "New add menus (compatibility and sheets)" },
    description: {
      fr: "Une seule fenêtre « Ajouter » (mods, packs de ressources, shaders, data packs, mondes) : seulement ce qui marche avec la version et le chargeur du pack (les autres comptés à part), fiche de chaque élément (versions × chargeurs, version minimale, mods nécessaires, images, soutenir l'auteur), « Créer une copie en … » sans jamais changer le pack. Aussi « Créer un pack » (mods d'abord ou version d'abord), « Un pack existant » avec la grille des versions, et « Exporter pour un ami » en .mrpack ou .zip CurseForge.",
      en: "A single “Add” window (mods, resource packs, shaders, data packs, worlds): only what works with the pack's version and loader (the others counted apart), a sheet per item (versions × loaders, minimum version, required mods, images, support the author), “Make a copy on …” without ever changing the pack. Also “Create a pack” (mods first or version first), “An existing pack” with the version grid, and “Export for a friend” as .mrpack or CurseForge .zip.",
    },
  },
  {
    id: "vanillaModded",
    parent: "vanillaPage",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "playPage",
    name: { fr: "Shaders en vanilla et « Basculer en version modée »", en: "Shaders in vanilla and “Switch to modded”" },
    description: {
      fr: "Onglet Shaders sur une installation vanilla ; un shader, ou « tous les mondes » pour un data pack, propose de passer l'installation en Fabric/NeoForge/Forge avec Iris ou Paxi (seulement s'ils existent pour sa version). Rien n'est supprimé.",
      en: "Shaders tab on a vanilla installation; a shader, or “every world” for a data pack, offers to switch the installation to Fabric/NeoForge/Forge with Iris or Paxi (only if they exist for its version). Nothing is deleted.",
    },
  },
  // 28/10 (demande de Rushi) : défaut « Test ».
  {
    id: "keysSync",
    parent: "play",
    defaultState: "test",
    where: ["launcher"],
    minLauncher: "0.4.0",
    group: "play",
    section: "comfort",
    name: { fr: "Mes touches (vanilla et modées)", en: "My key bindings (vanilla and modded)" },
    description: {
      fr: "Deux fichiers de touches communs (vanilla, modé) : les touches changées en jeu y sont reportées à la fermeture, et chaque nouvelle installation part de ces touches. Les installations existantes ne sont pas modifiées.",
      en: "Two shared key binding files (vanilla, modded): keys changed in game are saved there when the game closes, and every new installation starts from them. Existing installations are not changed.",
    },
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
// Audit du 25/10 : une seule lecture par requête (cache de React, Nav + pages + actions), et
// aucune lecture quand la liste des testeurs est vide.
export const siteViewer = cache(async (): Promise<Viewer> => {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { tester: false, betaChannel: false };
  if (!(await lab()).testers.length) return { tester: false, betaChannel: false };
  const user = await db.orm.public.User.select("minecraftUuid").where({ id: session.user.id }).first().catch(() => null);
  return { tester: await isTesterUuid(user?.minecraftUuid ?? null), betaChannel: false };
});

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
// Audit du 25/10 : qui regarde n'est cherché que si ça change la réponse (« Test » et « Bêta
// testeurs »), et jamais pour un appel sans la clé du launcher (pas d'appel à Mojang pour lui).
export async function requireLauncherFeature(request: Request, id: string): Promise<NextResponse | null> {
  const state = effectiveState(id, (await lab()).states);
  const off = () => NextResponse.json({ error: "Fonctionnalité indisponible.", code: "feature_off" }, { status: 404 });
  if (state === "all" || state === "beta") return null;
  if (state === "hidden") return off();
  const viewer = isAuthorizedLauncherRequest(request) ? await launcherViewer(request) : { tester: false, betaChannel: false };
  return accessFor(state, viewer).visible ? null : off();
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

// Teams en public (byline des cartes et des fiches, filtre Team, pages /team/…, launcher) : ces
// pages sont en cache, les mêmes pour tout le monde. Elles montrent les teams seulement quand
// « Ma team » est ouverte à tous (Bêta publique ou Pour tous) ; avant, seul l'onglet Ma team des
// testeurs existe.
export async function teamsPublic(): Promise<boolean> {
  const state = await featureState("team").catch(() => "hidden" as FeatureState);
  return state === "beta" || state === "all";
}
export function withoutTeam<T>(value: T): T {
  return value && typeof value === "object" && "team" in value ? { ...value, team: null } : value;
}
