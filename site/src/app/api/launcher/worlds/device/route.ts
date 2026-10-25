import { NextResponse } from "next/server";
import { withD1Busy } from "@/lib/d1Busy";
import { playLauncherUser } from "@/lib/playLauncher";
import { beatWorldLocks, deleteCloudVersion, deviceConflict, findCloudVersion, findCloudWorld, releaseWorldLock, resolveSplit, takeWorldLock } from "@/lib/playWorlds";

// Mode Jouer, plusieurs PC (24/10). Appelé par le launcher seulement pour un monde déjà dans le
// cloud (jamais pour un compte sans offre) :
//   open    → avant chaque « Jouer » : renvoie le conflit s'il y en a un (« ouvert ailleurs »,
//             « joué ailleurs », dernière partie pas arrivée), sinon prend le verrou. `force` :
//             le joueur a choisi de jouer quand même ;
//   check   → même vérification sans rien prendre (« Me prévenir quand il est fermé ») ;
//   beat    → battement de cœur du verrou (toutes les 5 min, plusieurs mondes par appel) ;
//   close   → rend le verrou (partie finie et sauvegarde envoyée) ;
//   resolve → « 2 versions de ce monde » : la version choisie devient celle à continuer ;
//   drop    → versions miroir : sauvegardes retirées du PC par la limite du monde, retirées aussi
//             du cloud (jamais la version à continuer ni l'autre version d'un monde en double ; le
//             launcher n'envoie les sauvegardes nommées que si le joueur les supprime à la main,
//             avec explicit: true).
const KEY_RE = /^[\w-]{8,64}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : null);
const bad = (error: string) => NextResponse.json({ error, code: "invalid" }, { status: 400 });

export const POST = withD1Busy(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const auth = await playLauncherUser(request, typeof body.minecraftUuid === "string" ? body.minecraftUuid : null, {
    bucket: action === "check" || action === "beat" ? "launcher-worlds" : "launcher-worlds-write",
    limit: action === "check" || action === "beat" ? 30 : 20,
  });
  if ("response" in auth) return auth.response;
  const { userId } = auth;
  const deviceId = str(body.deviceId, 64);
  if (!deviceId || !KEY_RE.test(deviceId)) return bad("Appareil inconnu");
  const deviceName = str(body.deviceName, 60) || "PC";

  if (action === "beat") {
    const keys = Array.isArray(body.worldKeys) ? body.worldKeys.filter((k: unknown) => typeof k === "string" && KEY_RE.test(k)) : [];
    await beatWorldLocks(userId, keys, deviceId);
    return NextResponse.json({ ok: true });
  }

  const worldKey = str(body.worldKey, 64);
  if (!worldKey || !KEY_RE.test(worldKey)) return bad("worldKey manquant");

  if (action === "close") {
    await releaseWorldLock(userId, worldKey, deviceId);
    return NextResponse.json({ ok: true });
  }

  if (action === "drop") {
    const world = await findCloudWorld(userId, { worldKey });
    const ids = Array.isArray(body.versionIds) ? body.versionIds.filter((x: unknown) => typeof x === "string").slice(0, 100) : [];
    // deletedIds : le launcher note lesquelles ne sont plus en ligne (« versions en ligne », 25/10).
    const deletedIds: string[] = [];
    if (world) {
      for (const id of ids) {
        const v = await findCloudVersion(userId, id);
        // explicit : supprimée à la main dans le launcher (même une version avec un nom).
        if (v && v.worldId === world.id && (body.explicit === true || !v.label) && (await deleteCloudVersion(userId, id)) === "ok") deletedIds.push(id);
      }
    }
    return NextResponse.json({ ok: true, deleted: deletedIds.length, deletedIds });
  }

  if (action === "resolve") {
    const versionId = await resolveSplit(userId, worldKey, str(body.versionId, 64) ?? "");
    if (!versionId) return NextResponse.json({ error: "Version introuvable", code: "notFound" }, { status: 404 });
    return NextResponse.json({ ok: true, headVersionId: versionId });
  }

  if (action === "open" || action === "check") {
    const { world, conflict } = await deviceConflict(userId, worldKey, deviceId, str(body.baseVersionId, 64));
    if (!world) return NextResponse.json({ ok: true, inCloud: false, conflict: null });
    if (action === "open" && (!conflict || body.force === true)) {
      await takeWorldLock(world.id, deviceId, deviceName);
      return NextResponse.json({ ok: true, inCloud: true, locked: true, conflict: null });
    }
    return NextResponse.json({ ok: true, inCloud: true, locked: false, conflict });
  }
  return bad("Action inconnue");
});
