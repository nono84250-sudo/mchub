import { NextResponse } from "next/server";
import { execSql } from "@/lib/db";
import { withD1Busy } from "@/lib/d1Busy";
import { playLauncherUser } from "@/lib/playLauncher";
import { addCloudVersion, getUserOffer, pruneCloud } from "@/lib/playWorlds";
import {
  abortMultipart,
  completeMultipart,
  deleteObjects,
  listUploadedParts,
  objectSize,
  partSizeFor,
  presignPart,
  startMultipart,
  worldObjectKey,
} from "@/lib/worldStorage";

// Envoi d'un monde dans le cloud (mode Jouer, 24/10), en 4 étapes appelées par le launcher :
//   start    → crée (ou reprend) l'envoi : taille des morceaux et morceaux déjà reçus ;
//   parts    → liens signés pour envoyer des morceaux directement à R2 (50 au plus par appel) ;
//   complete → assemble les morceaux, vérifie la taille, puis enregistre la nouvelle version ;
//   abort    → abandonne l'envoi.
// Le launcher envoie une copie figée (un .zip fait jeu fermé) et compare l'empreinte MD5 de chaque
// morceau avec celle renvoyée par R2 : un morceau abîmé est renvoyé. Le monde n'est marqué « dans
// le cloud » qu'après complete.
const KEY_RE = /^[\w-]{8,64}$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const UPLOAD_DAYS = 7;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : null);

type Upload = { id: string; userId: string; worldKey: string; uploadId: string; objectKey: string; sizeBytes: number; sha256: string; partSize: number; meta: string; expiresAt: string };

async function findUpload(userId: string, id: unknown): Promise<Upload | null> {
  if (typeof id !== "string") return null;
  const [row] = await execSql('SELECT * FROM "cloudUpload" WHERE "id" = ? AND "userId" = ?', [id, userId]);
  return (row as Upload) ?? null;
}
async function dropUpload(u: Upload) {
  await abortMultipart(u.objectKey, u.uploadId);
  await execSql('DELETE FROM "cloudUpload" WHERE "id" = ?', [u.id]);
}
const partCount = (u: Pick<Upload, "sizeBytes" | "partSize">) => Math.max(1, Math.ceil(u.sizeBytes / u.partSize));
const err = (error: string, code: string, status = 400) => NextResponse.json({ error, code }, { status });

export const POST = withD1Busy(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const auth = await playLauncherUser(request, typeof body.minecraftUuid === "string" ? body.minecraftUuid : null, {
    bucket: action === "parts" ? "launcher-worlds-parts" : "launcher-worlds-write",
    limit: action === "parts" ? 120 : 30,
  });
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  if (action === "start") {
    const worldKey = str(body.worldKey, 64);
    const sha256 = str(body.sha256, 64)?.toLowerCase() ?? "";
    const sizeBytes = Number(body.sizeBytes);
    if (!worldKey || !KEY_RE.test(worldKey) || !SHA_RE.test(sha256) || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return err("Demande invalide", "invalid");
    const offer = await getUserOffer(userId);
    if (!offer.cloud) return err("La sauvegarde en ligne n'est pas incluse dans ton offre.", "noCloud", 403);
    if (sizeBytes > offer.quotaBytes) return err("Ce monde est plus gros que ton espace en ligne.", "tooBig", 413);
    // Versions miroir (25/10) : cette sauvegarde du PC est déjà en ligne → rien à renvoyer.
    const backupId = str(body.backupId, 80);
    if (backupId) {
      const [dup] = await execSql(
        'SELECT v."id", v."worldId" FROM "cloudWorldVersion" v JOIN "cloudWorld" w ON w."id" = v."worldId" WHERE v."userId" = ? AND w."worldKey" = ? AND v."backupId" = ?',
        [userId, worldKey, backupId],
      );
      if (dup) return NextResponse.json({ already: true, versionId: dup.id, worldId: dup.worldId });
    }
    // Toutes les versions comptent dans le quota. Plein : refusé (rien n'est supprimé pour faire
    // de la place), le launcher s'arrête et dit combien de sauvegardes n'ont pas pu partir.
    const [used] = await execSql('SELECT COALESCE(SUM("sizeBytes"), 0) AS "total" FROM "cloudWorldVersion" WHERE "userId" = ?', [userId]);
    if (Number(used?.total) + sizeBytes > offer.quotaBytes) return err("Ton espace en ligne est plein.", "quotaFull", 413);

    // Reprise : même monde, même fichier, envoi pas expiré.
    const [existing] = (await execSql('SELECT * FROM "cloudUpload" WHERE "userId" = ? AND "worldKey" = ?', [userId, worldKey])) as Upload[];
    if (existing && existing.sha256 === sha256 && Number(existing.sizeBytes) === sizeBytes && existing.expiresAt > new Date().toISOString()) {
      const uploaded = await listUploadedParts(existing.objectKey, existing.uploadId).catch(() => null);
      if (uploaded) return NextResponse.json({ id: existing.id, partSize: existing.partSize, partCount: partCount(existing), uploaded });
    }
    if (existing) await dropUpload(existing);

    const id = crypto.randomUUID();
    const partSize = partSizeFor(sizeBytes);
    const objectKey = worldObjectKey(userId, worldKey, id);
    const uploadId = await startMultipart(objectKey);
    const meta = {
      name: str(body.name, 100) || "Monde",
      minecraftVersion: str(body.minecraftVersion, 40),
      packName: str(body.packName, 100),
      reason: str(body.reason, 20),
      backupId,
      label: str(body.label, 80),
      createdAt: str(body.createdAt, 40),
    };
    await execSql(
      'INSERT INTO "cloudUpload" ("id", "userId", "worldKey", "uploadId", "objectKey", "sizeBytes", "sha256", "partSize", "meta", "expiresAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, worldKey, uploadId, objectKey, sizeBytes, sha256, partSize, JSON.stringify(meta), new Date(Date.now() + UPLOAD_DAYS * 86_400_000).toISOString()],
    );
    return NextResponse.json({ id, partSize, partCount: partCount({ sizeBytes, partSize }), uploaded: [] });
  }

  const upload = await findUpload(userId, body.id);
  if (!upload) return err("Envoi introuvable : recommence.", "noUpload", 404);

  if (action === "parts") {
    const total = partCount(upload);
    const numbers = Array.isArray(body.partNumbers) ? body.partNumbers.map(Number).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= total) : [];
    if (!numbers.length || numbers.length > 50) return err("Demande invalide", "invalid");
    return NextResponse.json({ urls: numbers.map((n: number) => ({ partNumber: n, url: presignPart(upload.objectKey, upload.uploadId, n) })) });
  }

  if (action === "complete") {
    const total = partCount(upload);
    const parts: { partNumber: number; etag: string }[] = Array.isArray(body.parts)
      ? body.parts.map((p: { partNumber?: unknown; etag?: unknown }) => ({ partNumber: Number(p?.partNumber), etag: String(p?.etag ?? "").replace(/"/g, "") }))
      : [];
    const numbers = new Set(parts.map((p) => p.partNumber));
    if (parts.length !== total || numbers.size !== total || [...numbers].some((n) => !(n >= 1 && n <= total)) || parts.some((p) => !/^[0-9a-f-]{8,80}$/i.test(p.etag))) {
      return err("Morceaux incomplets", "invalid");
    }
    try {
      await completeMultipart(upload.objectKey, upload.uploadId, parts);
    } catch (error) {
      return err(`Assemblage refusé par le stockage : ${error instanceof Error ? error.message : String(error)}`, "complete");
    }
    const size = await objectSize(upload.objectKey);
    if (size !== Number(upload.sizeBytes)) {
      await deleteObjects([upload.objectKey]);
      await execSql('DELETE FROM "cloudUpload" WHERE "id" = ?', [upload.id]);
      return err("Le fichier reçu n'a pas la bonne taille : il sera renvoyé.", "sizeMismatch", 422);
    }
    const meta = (() => {
      try {
        return JSON.parse(upload.meta);
      } catch {
        return {};
      }
    })();
    // Plusieurs PC : appareil qui envoie, et version dont sa copie est partie (split si un autre
    // appareil a avancé entre-temps ; les deux versions sont gardées).
    const deviceId = str(body.deviceId, 64);
    const { worldId, split } = await addCloudVersion(userId, {
      id: upload.id,
      worldKey: upload.worldKey,
      objectKey: upload.objectKey,
      sizeBytes: Number(upload.sizeBytes),
      sha256: upload.sha256,
      name: meta.name || "Monde",
      minecraftVersion: meta.minecraftVersion ?? null,
      packName: meta.packName ?? null,
      reason: meta.reason ?? null,
      deviceId: deviceId && KEY_RE.test(deviceId) ? deviceId : null,
      deviceName: str(body.deviceName, 60),
      baseVersionId: str(body.baseVersionId, 64),
      backupId: meta.backupId ?? null,
      label: meta.label ?? null,
      createdAt: meta.createdAt ?? null,
    });
    await execSql('DELETE FROM "cloudUpload" WHERE "id" = ?', [upload.id]);
    await pruneCloud(userId, await getUserOffer(userId));
    return NextResponse.json({ ok: true, versionId: upload.id, worldId, split });
  }

  if (action === "abort") {
    await dropUpload(upload);
    return NextResponse.json({ ok: true });
  }
  return err("Action inconnue", "invalid");
});
