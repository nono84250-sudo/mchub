import { NextResponse } from "next/server";
import { withD1Busy } from "@/lib/db";
import { playLauncherUser } from "@/lib/playLauncher";
import { deleteCloudWorld, findCloudWorld, getPlayBeta, getUserOffer, listCloudWorlds, pruneCloud, usedBytes } from "@/lib/playWorlds";

// Mode Jouer (bêta, 24/10) : offre du joueur (quota et conservation viennent de la table
// playOffer), place utilisée et mondes en ligne. Lu par le launcher (fenêtre de synchro, mondes
// « dans le cloud, pas sur ce PC », restauration demandée depuis le site).
export const GET = withD1Busy(async (request: Request) => {
  const minecraftUuid = new URL(request.url).searchParams.get("minecraftUuid");
  const auth = await playLauncherUser(request, minecraftUuid, { bucket: "launcher-worlds", limit: 30 });
  if ("response" in auth) return auth.response;
  const offer = await getUserOffer(auth.userId);
  if (offer.cloud) await pruneCloud(auth.userId, offer);
  const [worlds, used, beta] = await Promise.all([listCloudWorlds(auth.userId), usedBytes(auth.userId), getPlayBeta()]);
  return NextResponse.json({
    beta,
    offer,
    usedBytes: used,
    setupDone: worlds.length > 0,
    worlds: worlds.map(({ versions, ...w }) => {
      const head = versions.find((v) => v.id === w.headVersionId) ?? versions[0];
      return { ...w, versionCount: versions.length, latestVersionId: head?.id ?? null, latestSha256: head?.sha256 ?? null };
    }),
  });
});

// « Retirer du cloud » dans le launcher : toutes les versions en ligne du monde sont supprimées.
// Le monde reste sur le PC du joueur.
export const DELETE = withD1Busy(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const auth = await playLauncherUser(request, params.get("minecraftUuid"), { bucket: "launcher-worlds-write", limit: 20 });
  if ("response" in auth) return auth.response;
  const worldKey = params.get("worldKey");
  if (!worldKey) return NextResponse.json({ error: "worldKey manquant" }, { status: 400 });
  const world = await findCloudWorld(auth.userId, { worldKey });
  if (world) await deleteCloudWorld(auth.userId, world.id);
  return NextResponse.json({ ok: true });
});
