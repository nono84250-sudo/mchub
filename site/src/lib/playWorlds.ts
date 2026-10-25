import { unstable_cache } from "next/cache";
import { execSql } from "@/lib/db";
import { featureState } from "@/lib/features";
import { abortMultipart, deleteObjects, deletePrefix, userWorldsPrefix, worldPrefix } from "@/lib/worldStorage";

// Mode « Jouer » (bêta, 24/10) : offres, mondes en ligne et packs officiels. Tables créées par
// d1/migrations/2026-10-24-mode-jouer.sql. Le quota et la durée de conservation viennent TOUJOURS
// de la table playOffer (jamais écrits ici) ; le paiement n'existe pas encore : l'offre d'un
// joueur est réglée à la main dans l'admin (source 'simulated').

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const now = () => new Date().toISOString();

// --- Badge « Bêta » --------------------------------------------------------------------------
// Depuis le Laboratoire (25/10) : le badge suit l'état de « Mode Jouer » (/admin/laboratoire).
// Allumé tant qu'il n'est pas « Pour tous ». Remplace l'ancien réglage play.betaBadge.
export const PLAY_TAG = "play-settings";
export async function getPlayBeta(): Promise<boolean> {
  return (await featureState("play")) !== "all";
}

// --- Offres ----------------------------------------------------------------------------------
export type PlayOffer = {
  id: string;
  name: { fr: string; en: string };
  cloud: boolean;
  quotaBytes: number;
  keepDays: number;
  priceCents: number;
  cloudVersions: number; // versions en ligne par monde, au maximum (le launcher en garde 1 à ce nombre)
};
const toOffer = (r: Row): PlayOffer => ({
  id: r.id,
  name: { fr: r.nameFr, en: r.nameEn },
  cloud: !!r.cloud,
  quotaBytes: Number(r.quotaBytes) || 0,
  keepDays: Number(r.keepDays) || 0,
  priceCents: Number(r.priceCents) || 0,
  cloudVersions: Number(r.cloudVersions) || 10,
});

export const listOffers = unstable_cache(
  async (): Promise<PlayOffer[]> => (await execSql('SELECT * FROM "playOffer" ORDER BY "sortOrder"')).map(toOffer),
  // Clé changée le 25/10 (colonne cloudVersions, quota 10 Go) : l'ancienne liste gardée en cache
  // affichait encore 10,7 Go. À changer aussi après chaque modification de la table des offres.
  ["play-offers-v2"],
  { revalidate: 300, tags: [PLAY_TAG] },
);

// Offre du joueur : sans ligne (ou expirée), l'offre gratuite.
export async function getUserOffer(userId: string): Promise<PlayOffer & { source: string | null }> {
  const offers = await listOffers();
  const free = offers.find((o) => o.id === "free") ?? { id: "free", name: { fr: "Gratuit", en: "Free" }, cloud: false, quotaBytes: 0, keepDays: 0, priceCents: 0, cloudVersions: 0 };
  const [row] = await execSql('SELECT "offerId", "source", "expiresAt" FROM "userPlayOffer" WHERE "userId" = ?', [userId]);
  if (!row || (row.expiresAt && row.expiresAt < now())) return { ...free, source: null };
  const offer = offers.find((o) => o.id === row.offerId);
  return offer ? { ...offer, source: row.source } : { ...free, source: null };
}

// Admin : offre simulée pour les tests (le paiement n'existe pas encore).
export async function setSimulatedOffer(userId: string, offerId: string | null): Promise<void> {
  if (!offerId || offerId === "free") {
    await execSql('DELETE FROM "userPlayOffer" WHERE "userId" = ?', [userId]);
    return;
  }
  await execSql(
    'INSERT INTO "userPlayOffer" ("userId", "offerId", "source", "updatedAt") VALUES (?, ?, \'simulated\', ?) ON CONFLICT ("userId") DO UPDATE SET "offerId" = excluded."offerId", "source" = excluded."source", "updatedAt" = excluded."updatedAt"',
    [userId, offerId, now()],
  );
}

// --- Mondes en ligne -------------------------------------------------------------------------
export type CloudVersion = {
  id: string;
  sizeBytes: number;
  sha256: string;
  minecraftVersion: string | null;
  reason: string | null;
  createdAt: string;
  deviceId: string | null;
  deviceName: string | null;
  backupId: string | null; // sauvegarde du launcher dont vient cette version (miroir, 25/10)
  label: string | null; // nom donné par le joueur (Maj+F6, « Sauvegarder maintenant »)
};
export type CloudWorld = {
  id: string;
  worldKey: string;
  name: string;
  minecraftVersion: string | null;
  packName: string | null;
  sizeBytes: number; // version à continuer (headVersionId, sinon la plus récente)
  totalBytes: number; // toutes les versions (compte dans le quota)
  updatedAt: string;
  restoreVersionId: string | null;
  restorePending: boolean;
  // Plusieurs PC (24/10) : version à continuer, et l'autre version quand deux PC ont avancé
  // chacun de leur côté (le joueur choisit laquelle continuer ; rien n'est écrasé).
  headVersionId: string | null;
  headDeviceName: string | null;
  split: { versionId: string; deviceName: string | null; createdAt: string } | null;
  lastDeviceName: string | null;
  lastPlayedAt: string | null;
  versions: CloudVersion[]; // la plus récente en premier
};

export async function listCloudWorlds(userId: string): Promise<CloudWorld[]> {
  const [worlds, versions] = await Promise.all([
    execSql('SELECT * FROM "cloudWorld" WHERE "userId" = ? ORDER BY "updatedAt" DESC', [userId]),
    execSql(
      'SELECT "id", "worldId", "sizeBytes", "sha256", "minecraftVersion", "reason", "createdAt", "deviceId", "deviceName", "backupId", "label" FROM "cloudWorldVersion" WHERE "userId" = ? ORDER BY "createdAt" DESC',
      [userId],
    ),
  ]);
  return worlds
    .map((w: Row) => {
      const vs: CloudVersion[] = versions
        .filter((v: Row) => v.worldId === w.id)
        .map((v: Row) => ({
          id: v.id,
          sizeBytes: Number(v.sizeBytes),
          sha256: v.sha256,
          minecraftVersion: v.minecraftVersion,
          reason: v.reason,
          createdAt: v.createdAt,
          deviceId: v.deviceId ?? null,
          deviceName: v.deviceName ?? null,
          backupId: v.backupId ?? null,
          label: v.label ?? null,
        }));
      const head = vs.find((v) => v.id === w.headVersionId) ?? vs[0];
      const split = w.splitVersionId ? vs.find((v) => v.id === w.splitVersionId && v.id !== head?.id) : undefined;
      return {
        id: w.id,
        worldKey: w.worldKey,
        name: w.name,
        minecraftVersion: w.minecraftVersion,
        packName: w.packName,
        sizeBytes: head?.sizeBytes ?? 0,
        totalBytes: vs.reduce((a, v) => a + v.sizeBytes, 0),
        updatedAt: vs[0]?.createdAt ?? w.updatedAt,
        restoreVersionId: w.restoreVersionId,
        restorePending: !!w.restoreVersionId && vs.some((v) => v.id === w.restoreVersionId),
        headVersionId: head?.id ?? null,
        headDeviceName: head?.deviceName ?? null,
        split: split ? { versionId: split.id, deviceName: split.deviceName, createdAt: split.createdAt } : null,
        lastDeviceName: w.lastDeviceName ?? null,
        lastPlayedAt: w.lastPlayedAt ?? null,
        versions: vs,
      };
    })
    .filter((w) => w.versions.length);
}

export async function usedBytes(userId: string): Promise<number> {
  const [row] = await execSql('SELECT COALESCE(SUM("sizeBytes"), 0) AS "total" FROM "cloudWorldVersion" WHERE "userId" = ?', [userId]);
  return Number(row?.total) || 0;
}

export async function findCloudWorld(userId: string, by: { id?: string; worldKey?: string }): Promise<Row | null> {
  const [row] = by.id
    ? await execSql('SELECT * FROM "cloudWorld" WHERE "userId" = ? AND "id" = ?', [userId, by.id])
    : await execSql('SELECT * FROM "cloudWorld" WHERE "userId" = ? AND "worldKey" = ?', [userId, by.worldKey]);
  return row ?? null;
}

export async function findCloudVersion(userId: string, versionId: string): Promise<Row | null> {
  const [row] = await execSql('SELECT * FROM "cloudWorldVersion" WHERE "userId" = ? AND "id" = ?', [userId, versionId]);
  return row ?? null;
}

// Nouvelle version reçue (envoi terminé et vérifié).
export async function addCloudVersion(
  userId: string,
  v: {
    id: string;
    worldKey: string;
    objectKey: string;
    sizeBytes: number;
    sha256: string;
    name: string;
    minecraftVersion: string | null;
    packName: string | null;
    reason: string | null;
    deviceId?: string | null;
    deviceName?: string | null;
    baseVersionId?: string | null;
    backupId?: string | null;
    label?: string | null;
    createdAt?: string | null; // date de la sauvegarde sur le PC (pas celle de l'envoi)
  },
): Promise<{ worldId: string; split: boolean }> {
  let world = await findCloudWorld(userId, { worldKey: v.worldKey });
  // Versions miroir (25/10) : toutes les sauvegardes du PC partent, même les anciennes, avec leur
  // vraie date. Seule une sauvegarde PLUS RÉCENTE que la version à continuer la remplace.
  const createdAt = v.createdAt && !Number.isNaN(Date.parse(v.createdAt)) && v.createdAt < now() ? new Date(v.createdAt).toISOString() : now();
  const head = world ? await currentHead(world) : null;
  const newer = !head || createdAt >= head.createdAt;
  // Plusieurs PC : la copie envoyée part-elle de la version à continuer ? Sinon, un autre appareil
  // a avancé entre-temps (« Jouer avec la copie de ce PC ») : on garde les deux, le joueur choisira.
  let splitFrom: string | null = null;
  if (newer && head && head.id !== v.baseVersionId && head.deviceId && v.deviceId && head.deviceId !== v.deviceId) splitFrom = head.id;
  if (!world) {
    // Deux PC qui envoient le même nouveau monde en même temps : le second reprend la ligne du premier.
    await execSql('INSERT INTO "cloudWorld" ("id", "userId", "worldKey", "name", "minecraftVersion", "packName") VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT ("userId", "worldKey") DO NOTHING', [
      crypto.randomUUID(), userId, v.worldKey, v.name, v.minecraftVersion, v.packName,
    ]);
    world = await findCloudWorld(userId, { worldKey: v.worldKey });
    if (!world) throw new Error("Monde du cloud introuvable après sa création.");
  }
  await execSql(
    'INSERT INTO "cloudWorldVersion" ("id", "worldId", "userId", "objectKey", "sizeBytes", "sha256", "minecraftVersion", "reason", "deviceId", "deviceName", "baseVersionId", "backupId", "label", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [v.id, world.id, userId, v.objectKey, v.sizeBytes, v.sha256, v.minecraftVersion, v.reason, v.deviceId ?? null, v.deviceName ?? null, v.baseVersionId ?? null, v.backupId ?? null, v.label ?? null, createdAt],
  );
  if (!newer) return { worldId: world.id, split: false };
  // La nouvelle version devient celle à continuer ; en cas de split, l'ancienne reste proposée.
  await execSql(
    'UPDATE "cloudWorld" SET "name" = ?, "minecraftVersion" = ?, "packName" = ?, "headVersionId" = ?, "splitVersionId" = COALESCE(?, "splitVersionId"), "updatedAt" = ? WHERE "id" = ?',
    [v.name, v.minecraftVersion, v.packName, v.id, splitFrom, now(), world.id],
  );
  return { worldId: world.id, split: !!splitFrom };
}

// Version à continuer : celle choisie (headVersionId), sinon la plus récente.
async function currentHead(world: Row): Promise<Row | null> {
  if (world.headVersionId) {
    const [h] = await execSql('SELECT * FROM "cloudWorldVersion" WHERE "id" = ? AND "worldId" = ?', [world.headVersionId, world.id]);
    if (h) return h;
  }
  const [last] = await execSql('SELECT * FROM "cloudWorldVersion" WHERE "worldId" = ? ORDER BY "createdAt" DESC LIMIT 1', [world.id]);
  return last ?? null;
}

// --- Plusieurs PC : verrou « monde ouvert » et conflits ----------------------------------------
// Le launcher prend le verrou en lançant un monde du cloud, le garde par un battement de cœur
// (toutes les 5 min) pendant la partie et jusqu'à la fin de l'envoi de la sauvegarde, puis le
// rend. Un verrou sans battement depuis LOCK_STALE_MS est périmé (PC planté ou éteint) : il ne
// bloque plus, mais on prévient que la dernière partie n'est peut-être pas arrivée.
export const LOCK_STALE_MS = 12 * 60_000;
export type DeviceConflict =
  | { kind: "open"; deviceName: string | null; since: string | null }
  | { kind: "played"; deviceName: string | null; at: string; versionId: string; sizeBytes: number }
  | { kind: "missing"; deviceName: string | null; at: string | null };

export async function deviceConflict(userId: string, worldKey: string, deviceId: string, baseVersionId: string | null): Promise<{ world: Row | null; conflict: DeviceConflict | null }> {
  const world = await findCloudWorld(userId, { worldKey });
  if (!world) return { world: null, conflict: null };
  const fresh = world.openBeatAt && Date.parse(world.openBeatAt) > Date.now() - LOCK_STALE_MS;
  if (world.openDeviceId && world.openDeviceId !== deviceId && fresh) return { world, conflict: { kind: "open", deviceName: world.openDeviceName, since: world.openSince } };
  const head = await currentHead(world);
  if (head && head.id !== baseVersionId && head.deviceId && head.deviceId !== deviceId) {
    return { world, conflict: { kind: "played", deviceName: head.deviceName, at: head.createdAt, versionId: head.id, sizeBytes: Number(head.sizeBytes) } };
  }
  // Verrou périmé d'un autre appareil, plus récent que la dernière version reçue.
  if (world.openDeviceId && world.openDeviceId !== deviceId && !fresh && (!head || (world.openSince && world.openSince > head.createdAt))) {
    return { world, conflict: { kind: "missing", deviceName: world.openDeviceName, at: world.openBeatAt } };
  }
  return { world, conflict: null };
}

export async function takeWorldLock(worldId: string, deviceId: string, deviceName: string): Promise<void> {
  const t = now();
  await execSql(
    'UPDATE "cloudWorld" SET "openDeviceId" = ?, "openDeviceName" = ?, "openSince" = ?, "openBeatAt" = ?, "lastDeviceId" = ?, "lastDeviceName" = ?, "lastPlayedAt" = ? WHERE "id" = ?',
    [deviceId, deviceName, t, t, deviceId, deviceName, t, worldId],
  );
}

export async function beatWorldLocks(userId: string, worldKeys: string[], deviceId: string): Promise<void> {
  for (const key of worldKeys.slice(0, 20)) {
    await execSql('UPDATE "cloudWorld" SET "openBeatAt" = ? WHERE "userId" = ? AND "worldKey" = ? AND "openDeviceId" = ?', [now(), userId, key, deviceId]);
  }
}

export async function releaseWorldLock(userId: string, worldKey: string, deviceId: string): Promise<void> {
  await execSql(
    'UPDATE "cloudWorld" SET "openDeviceId" = NULL, "openDeviceName" = NULL, "openSince" = NULL, "openBeatAt" = NULL, "lastPlayedAt" = ? WHERE "userId" = ? AND "worldKey" = ? AND "openDeviceId" = ?',
    [now(), userId, worldKey, deviceId],
  );
}

// « Choisir laquelle continuer » : la version gardée devient celle à continuer. L'autre reste
// dans les versions (sauvegardes) : rien n'est supprimé.
export async function resolveSplit(userId: string, worldKey: string, versionId: string): Promise<string | null> {
  const world = await findCloudWorld(userId, { worldKey });
  if (!world) return null;
  const v = await findCloudVersion(userId, versionId);
  if (!v || v.worldId !== world.id) return null;
  await execSql('UPDATE "cloudWorld" SET "headVersionId" = ?, "splitVersionId" = NULL, "updatedAt" = ? WHERE "id" = ?', [versionId, now(), world.id]);
  return versionId;
}

// Ménage : versions plus vieilles que la durée de l'offre, puis, si le quota est dépassé, les
// plus vieilles versions d'abord. La dernière version de chaque monde n'est jamais retirée ici.
// Audit du 25/10 : l'état des mondes est relu toutes les 2 min par chaque launcher. Le ménage
// (3 lectures au moins) n'y est fait qu'une fois par heure et par compte (`throttle`) ; il reste
// fait à chaque envoi terminé.
const lastPrune = new Map<string, number>();
const PRUNE_EVERY_MS = 3_600_000;

export async function pruneCloud(userId: string, offer: PlayOffer, { throttle = false }: { throttle?: boolean } = {}): Promise<number> {
  if (throttle) {
    const at = lastPrune.get(userId) ?? 0;
    if (Date.now() - at < PRUNE_EVERY_MS) return 0;
    if (lastPrune.size > 5000) lastPrune.clear();
  }
  lastPrune.set(userId, Date.now());
  // Envois jamais terminés (launcher fermé, monde retiré…) et expirés : abandonnés dans R2 pour ne
  // laisser aucun morceau dans le bucket, puis oubliés.
  for (const u of await execSql('SELECT "id", "objectKey", "uploadId" FROM "cloudUpload" WHERE "userId" = ? AND "expiresAt" < ?', [userId, now()])) {
    await abortMultipart(u.objectKey, u.uploadId).catch(() => {});
    await execSql('DELETE FROM "cloudUpload" WHERE "id" = ?', [u.id]);
  }
  const rows = await execSql('SELECT "id", "worldId", "objectKey", "sizeBytes", "createdAt", "label" FROM "cloudWorldVersion" WHERE "userId" = ? ORDER BY "createdAt" ASC', [userId]);
  const latest = new Map<string, string>();
  for (const r of rows) latest.set(r.worldId, r.id); // ordre croissant : la dernière gagne
  // Jamais retirées non plus : la version à continuer et l'autre version d'un monde en double.
  const kept = new Set<string>();
  for (const w of await execSql('SELECT "headVersionId", "splitVersionId" FROM "cloudWorld" WHERE "userId" = ?', [userId])) {
    if (w.headVersionId) kept.add(w.headVersionId);
    if (w.splitVersionId) kept.add(w.splitVersionId);
  }
  const limit = offer.keepDays > 0 ? new Date(Date.now() - offer.keepDays * 86_400_000).toISOString() : null;
  // Seule la durée de conservation de l'offre retire des versions ici. Quota plein : on ne
  // supprime rien en douce, ce sont les nouveaux envois qui sont refusés (le launcher le dit).
  // Les sauvegardes nommées par le joueur ne partent jamais toutes seules.
  const drop: Row[] = [];
  for (const r of rows) {
    if (latest.get(r.worldId) === r.id || kept.has(r.id) || r.label) continue;
    if (limit && r.createdAt < limit) drop.push(r);
  }
  if (!drop.length) return 0;
  await deleteObjects(drop.map((r) => r.objectKey));
  for (let i = 0; i < drop.length; i += 90) {
    const ids = drop.slice(i, i + 90).map((r) => r.id);
    await execSql(`DELETE FROM "cloudWorldVersion" WHERE "id" IN (${ids.map(() => "?").join(", ")})`, ids);
  }
  await execSql('UPDATE "cloudWorld" SET "restoreVersionId" = NULL WHERE "userId" = ? AND "restoreVersionId" NOT IN (SELECT "id" FROM "cloudWorldVersion" WHERE "userId" = ?)', [userId, userId]);
  return drop.length;
}

// Plusieurs versions d'un même monde en une fois (« drop » du launcher). Audit du 25/10 : avant,
// ~6 appels D1 par version ; ici 5 appels en tout, quel que soit le nombre. Jamais la dernière
// version, la version à continuer ni l'autre version d'un monde en double ; les versions avec un
// nom seulement si `explicit`. Renvoie les ids vraiment retirés.
export async function deleteCloudVersions(userId: string, worldId: string, ids: string[], explicit: boolean): Promise<string[]> {
  const list = [...new Set(ids)].slice(0, 90); // D1 : 100 paramètres max par requête
  if (!list.length) return [];
  const marks = list.map(() => "?").join(", ");
  const rows = await execSql(`SELECT "id", "objectKey", "label" FROM "cloudWorldVersion" WHERE "userId" = ? AND "worldId" = ? AND "id" IN (${marks})`, [userId, worldId, ...list]);
  if (!rows.length) return [];
  const [last] = await execSql('SELECT "id" FROM "cloudWorldVersion" WHERE "worldId" = ? ORDER BY "createdAt" DESC LIMIT 1', [worldId]);
  const [w] = await execSql('SELECT "headVersionId", "splitVersionId" FROM "cloudWorld" WHERE "id" = ?', [worldId]);
  const keep = new Set([last?.id, w?.headVersionId, w?.splitVersionId].filter(Boolean));
  const drop = rows.filter((r) => !keep.has(r.id) && (explicit || !r.label));
  if (!drop.length) return [];
  await deleteObjects(drop.map((r) => r.objectKey));
  const dropIds = drop.map((r) => String(r.id));
  const dropMarks = dropIds.map(() => "?").join(", ");
  await execSql(`DELETE FROM "cloudWorldVersion" WHERE "id" IN (${dropMarks})`, dropIds);
  await execSql(`UPDATE "cloudWorld" SET "restoreVersionId" = NULL WHERE "id" = ? AND "restoreVersionId" IN (${dropMarks})`, [worldId, ...dropIds]);
  return dropIds;
}

export async function deleteCloudVersion(userId: string, versionId: string): Promise<"ok" | "notFound" | "current"> {
  const v = await findCloudVersion(userId, versionId);
  if (!v) return "notFound";
  const [last] = await execSql('SELECT "id" FROM "cloudWorldVersion" WHERE "worldId" = ? ORDER BY "createdAt" DESC LIMIT 1', [v.worldId]);
  const [w] = await execSql('SELECT "headVersionId", "splitVersionId" FROM "cloudWorld" WHERE "id" = ?', [v.worldId]);
  if (last?.id === v.id || w?.headVersionId === v.id || w?.splitVersionId === v.id) return "current";
  await deleteObjects([v.objectKey]);
  await execSql('DELETE FROM "cloudWorldVersion" WHERE "id" = ?', [v.id]);
  await execSql('UPDATE "cloudWorld" SET "restoreVersionId" = NULL WHERE "id" = ? AND "restoreVersionId" = ?', [v.worldId, v.id]);
  return "ok";
}

// Retire un monde du cloud (toutes ses versions). Le monde sur le PC du joueur n'est pas touché.
export async function deleteCloudWorld(userId: string, worldId: string): Promise<boolean> {
  const world = await findCloudWorld(userId, { id: worldId });
  if (!world) return false;
  const versions = await execSql('SELECT "objectKey" FROM "cloudWorldVersion" WHERE "worldId" = ?', [worldId]);
  await deleteObjects(versions.map((r: Row) => r.objectKey));
  // Filet : tout ce qui reste dans le dossier du monde (fichier oublié par la base).
  await deletePrefix(worldPrefix(userId, world.worldKey));
  await execSql('DELETE FROM "cloudWorldVersion" WHERE "worldId" = ?', [worldId]);
  await execSql('DELETE FROM "cloudWorld" WHERE "id" = ?', [worldId]);
  return true;
}

// Suppression de compte : fichiers R2 et envois en cours (les lignes partent avec le cascade).
export async function deleteAllCloudData(userId: string): Promise<void> {
  try {
    const versions = await execSql('SELECT "objectKey" FROM "cloudWorldVersion" WHERE "userId" = ?', [userId]);
    await deleteObjects(versions.map((r: Row) => r.objectKey));
    for (const u of await execSql('SELECT "objectKey", "uploadId" FROM "cloudUpload" WHERE "userId" = ?', [userId])) await abortMultipart(u.objectKey, u.uploadId);
    // Filet : tout le dossier du joueur, même un fichier que la base n'aurait plus.
    await deletePrefix(userWorldsPrefix(userId));
  } catch (error) {
    // Base pas encore migrée (tables du mode Jouer absentes) : rien à effacer, la suppression du
    // compte continue. Toute autre erreur l'arrête, pour ne pas laisser de fichiers derrière.
    if (error instanceof Error && /no such table/i.test(error.message)) return;
    throw error;
  }
}

export async function requestRestore(userId: string, versionId: string): Promise<boolean> {
  const v = await findCloudVersion(userId, versionId);
  if (!v) return false;
  await execSql('UPDATE "cloudWorld" SET "restoreVersionId" = ? WHERE "id" = ? AND "userId" = ?', [versionId, v.worldId, userId]);
  return true;
}

export async function clearRestore(userId: string, worldKey: string): Promise<void> {
  await execSql('UPDATE "cloudWorld" SET "restoreVersionId" = NULL WHERE "userId" = ? AND "worldKey" = ?', [userId, worldKey]);
}

// --- Packs officiels -------------------------------------------------------------------------
export type PackFile = { projectId: string; title?: string; url: string; filename: string; sha1?: string; size?: number };
export type PublicPack = {
  id: string;
  slug: string;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  versions: { id: string; minecraftVersion: string; loader: string; loaderVersion: string | null; files: PackFile[]; updatedAt: string }[];
};

const parse = <T,>(s: unknown, fallback: T): T => {
  try {
    return typeof s === "string" ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};

// Ce que voit le launcher : seulement les versions publiées.
export const listPublishedPacks = unstable_cache(
  async (): Promise<PublicPack[]> => {
    const [packs, versions] = await Promise.all([
      execSql('SELECT * FROM "playPack" ORDER BY "nameFr"'),
      execSql('SELECT * FROM "playPackVersion" WHERE "published" = 1'),
    ]);
    return packs
      .map((p: Row) => ({
        id: p.id,
        slug: p.slug,
        name: { fr: p.nameFr, en: p.nameEn },
        description: { fr: p.descriptionFr, en: p.descriptionEn },
        versions: versions
          .filter((v: Row) => v.packId === p.id)
          .map((v: Row) => ({ id: v.id, minecraftVersion: v.minecraftVersion, loader: v.loader, loaderVersion: v.loaderVersion, files: parse<PackFile[]>(v.files, []), updatedAt: v.updatedAt })),
      }))
      .filter((p) => p.versions.length);
  },
  ["play-packs"],
  { revalidate: 120, tags: [PLAY_TAG] },
);
