import { NextResponse } from "next/server";
import { execSql, withD1Busy } from "@/lib/db";
import { playLauncherUser } from "@/lib/playLauncher";
import { findCloudVersion, findCloudWorld } from "@/lib/playWorlds";
import { presignDownload } from "@/lib/worldStorage";

// Lien signé (1 h) vers le .zip d'une version, pour « Télécharger sur ce PC » et pour appliquer
// une restauration demandée sur le site. Sans versionId : la dernière version du monde. Le
// launcher vérifie l'empreinte sha256 renvoyée avant d'utiliser le fichier.
export const GET = withD1Busy(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const auth = await playLauncherUser(request, params.get("minecraftUuid"), { bucket: "launcher-worlds", limit: 30 });
  if ("response" in auth) return auth.response;
  const worldId = params.get("worldId");
  const worldKey = params.get("worldKey");
  const world = await findCloudWorld(auth.userId, worldId ? { id: worldId } : { worldKey: worldKey ?? "" });
  if (!world) return NextResponse.json({ error: "Monde introuvable" }, { status: 404 });
  const versionId = params.get("versionId");
  // Sans versionId : la version à continuer (choisie après un conflit entre deux PC), sinon la
  // plus récente.
  const version = versionId
    ? await findCloudVersion(auth.userId, versionId)
    : (world.headVersionId ? await findCloudVersion(auth.userId, world.headVersionId) : null) ??
      (await execSql('SELECT * FROM "cloudWorldVersion" WHERE "worldId" = ? ORDER BY "createdAt" DESC LIMIT 1', [world.id]))[0];
  if (!version || version.worldId !== world.id) return NextResponse.json({ error: "Version introuvable" }, { status: 404 });
  return NextResponse.json({
    url: presignDownload(version.objectKey),
    versionId: version.id,
    sha256: version.sha256,
    sizeBytes: Number(version.sizeBytes),
    name: world.name,
    worldKey: world.worldKey,
    minecraftVersion: version.minecraftVersion,
    deviceName: version.deviceName ?? null,
    createdAt: version.createdAt,
    worldId: world.id,
    backupId: version.backupId ?? null,
    label: version.label ?? null,
    reason: version.reason ?? null,
  });
});
