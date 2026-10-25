import { createHash, createHmac } from "node:crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
} from "@aws-sdk/client-s3";
import { IMAGES_BUCKET, r2 } from "@/lib/r2";

// Stockage des mondes en ligne (mode Jouer, 24/10). Les .zip vont directement du launcher vers R2
// par des liens signés (une requête par morceau) : ils ne passent jamais par le site, qui est
// limité à 4,5 Mo par requête sur Vercel. Tout est sous le préfixe worlds/ (refusé par
// /api/images, voir isWorldObjectKey). Bucket à part possible avec R2_WORLDS_BUCKET ; sinon le
// bucket des images, avec le même jeton.
export const WORLDS_BUCKET = process.env.R2_WORLDS_BUCKET || IMAGES_BUCKET;
export const WORLDS_PREFIX = "worlds/";
// R2 : 5 Mio minimum par morceau (sauf le dernier), 10 000 morceaux maximum.
const MIN_PART = 5 * 1024 * 1024;
const MAX_PARTS = 10_000;
// Liens signés valables 1 h : le launcher en redemande quand il en a besoin.
export const PRESIGN_SECONDS = 3600;

export function isWorldObjectKey(key: string): boolean {
  return key.startsWith(WORLDS_PREFIX);
}

// Rangement : worlds/<id du compte>/<clé du monde>/<id de la version>.zip. Tout un joueur ou tout
// un monde s'efface donc d'un coup par son préfixe (voir deletePrefix).
export function userWorldsPrefix(userId: string): string {
  return `${WORLDS_PREFIX}${userId}/`;
}
export function worldPrefix(userId: string, worldKey: string): string {
  return `${WORLDS_PREFIX}${userId}/${worldKey}/`;
}
export function worldObjectKey(userId: string, worldId: string, versionId: string): string {
  return `${WORLDS_PREFIX}${userId}/${worldId}/${versionId}.zip`;
}

// 16 Mio par défaut ; plus gros si le monde dépasserait 10 000 morceaux.
export function partSizeFor(sizeBytes: number): number {
  let size = 16 * 1024 * 1024;
  while (Math.ceil(sizeBytes / size) > MAX_PARTS) size *= 2;
  return Math.max(MIN_PART, size);
}

export async function startMultipart(objectKey: string): Promise<string> {
  const out = await r2.send(new CreateMultipartUploadCommand({ Bucket: WORLDS_BUCKET, Key: objectKey, ContentType: "application/zip" }));
  if (!out.UploadId) throw new Error("R2 : envoi impossible à démarrer");
  return out.UploadId;
}

// Morceaux déjà reçus par R2 (reprise après une coupure).
export async function listUploadedParts(objectKey: string, uploadId: string): Promise<{ partNumber: number; etag: string; size: number }[]> {
  const parts: { partNumber: number; etag: string; size: number }[] = [];
  let marker: string | undefined;
  for (;;) {
    const out = await r2.send(new ListPartsCommand({ Bucket: WORLDS_BUCKET, Key: objectKey, UploadId: uploadId, PartNumberMarker: marker }));
    for (const p of out.Parts ?? []) if (p.PartNumber && p.ETag) parts.push({ partNumber: p.PartNumber, etag: p.ETag.replace(/"/g, ""), size: p.Size ?? 0 });
    if (!out.IsTruncated || !out.NextPartNumberMarker) return parts;
    marker = out.NextPartNumberMarker;
  }
}

export async function completeMultipart(objectKey: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void> {
  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: WORLDS_BUCKET,
      Key: objectKey,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.slice().sort((a, b) => a.partNumber - b.partNumber).map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    }),
  );
}

export async function abortMultipart(objectKey: string, uploadId: string): Promise<void> {
  await r2.send(new AbortMultipartUploadCommand({ Bucket: WORLDS_BUCKET, Key: objectKey, UploadId: uploadId })).catch(() => {});
}

export async function objectSize(objectKey: string): Promise<number | null> {
  try {
    const out = await r2.send(new HeadObjectCommand({ Bucket: WORLDS_BUCKET, Key: objectKey }));
    return out.ContentLength ?? null;
  } catch {
    return null;
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const safe = keys.filter(isWorldObjectKey);
  for (let i = 0; i < safe.length; i += 1000) {
    await r2.send(new DeleteObjectsCommand({ Bucket: WORLDS_BUCKET, Delete: { Objects: safe.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
  }
}

// Efface tout ce qui est sous un préfixe (un joueur ou un monde), y compris un fichier que la base
// aurait oublié. Refuse tout préfixe qui ne vise pas au moins un joueur précis.
export async function deletePrefix(prefix: string): Promise<number> {
  if (!/^worlds\/[^/]+\/(?:[^/]+\/)?$/.test(prefix)) throw new Error("Préfixe refusé");
  let deleted = 0;
  let token: string | undefined;
  do {
    const out = await r2.send(new ListObjectsV2Command({ Bucket: WORLDS_BUCKET, Prefix: prefix, ContinuationToken: token }));
    const keys = (out.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k);
    if (keys.length) await deleteObjects(keys);
    deleted += keys.length;
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

// --- Liens signés (AWS Signature V4, « query string ») -------------------------------------
// Écrit à la main : @aws-sdk/s3-request-presigner n'est pas installé. Référence :
// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s).digest();

function presign(method: "GET" | "PUT", objectKey: string, extra: Record<string, string>, seconds = PRESIGN_SECONDS, now = new Date()): string {
  const accountId = process.env.CF_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKey || !secret) throw new Error("R2 : clés manquantes");
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const path = `/${WORLDS_BUCKET}/${objectKey.split("/").map(rfc3986).join("/")}`;
  const query: Record<string, string> = {
    ...extra,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(seconds),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(query[k])}`)
    .join("&");
  const canonical = [method, path, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function presignPart(objectKey: string, uploadId: string, partNumber: number): string {
  return presign("PUT", objectKey, { partNumber: String(partNumber), uploadId });
}

// Téléchargement : le nom proposé au navigateur (site) vient de filename.
export function presignDownload(objectKey: string, filename?: string): string {
  const extra: Record<string, string> = {};
  if (filename) extra["response-content-disposition"] = `attachment; filename="${filename.replace(/[^\w.() -]/g, "_")}"`;
  return presign("GET", objectKey, extra);
}
