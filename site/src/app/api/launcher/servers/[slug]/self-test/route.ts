import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { db } from "@/lib/db";
import { SERVERS_CACHE_TAG, isProvenOwner, proofFromRequest } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";
import { runAndStoreChecks } from "@/lib/verification";
import { MANUAL_MODS_READY, parseManualMods } from "@/lib/manualMods";
import { withD1Busy } from "@/lib/d1Busy";

// Recoit le resultat de l'auto-test de publication lance depuis le launcher (voir
// "Tester pour publication" dans Mes instances, renderer.js/runSelfTest) — 3 controles :
// jointabilite (ping direct), installation du modpack, demarrage du jeu (voir selftest:run
// dans main.js). Un 4e controle ("Connexion au serveur") existait mais a ete retire le
// 2026-10-11 : intestable de maniere fiable pour le moment.
// 2026-10-11 : un test reussi envoie DIRECTEMENT la fiche dans la file d'attente admin (plus
// besoin de repasser par le site pour decocher "prive") — meme enchainement que le site
// (isPrivate -> false, verificationStatus -> "pending", runAndStoreChecks, voir updateServer
// dans lib/actions/servers.ts). Avant ce changement, le test ne faisait que debloquer le
// controle "Publier" du site sans jamais soumettre la fiche nulle part — un joueur qui ne
// savait pas qu'il fallait repasser par le site voyait son serveur "disparaitre dans le
// neant" (bouton de test disparu, rien dans la file admin).
// Seul le PROPRIETAIRE du serveur peut rapporter un resultat pour SA fiche (meme preuve que
// canSeeServer/getServerWithIpBySlug — jeton Mojang ou session de lanceur) : sans ce controle,
// n'importe qui connaissant le slug pourrait debloquer la publication d'un serveur qui n'est
// pas le sien.
async function handlePOST(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/self-test">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Ecrit en base : meme palier que report (10/min/adresse) — un joueur legitime ne lance
  // son propre auto-test qu'occasionnellement, jamais en boucle.
  const limited = rateLimitResponse(request, "launcher-self-test", 10);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const server = await db.orm.public.Server.select("id", "slug", "verificationStatus")
    .include("owner", (o) => o.select("minecraftUuid", "name"))
    .where({ slug })
    .first();
  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }
  // Pas le code d'invitation d'un simple joueur ayant rejoint : SEUL le proprietaire (jeton
  // Mojang ou session de lanceur identifiant son UUID) peut rapporter un auto-test.
  if (!(await isProvenOwner(server.owner, proofFromRequest(request)))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) ?? {};
  const checks = {
    reachable: body.checks?.reachable === true,
    modpackInstalled: body.checks?.modpackInstalled === true,
    gameStarted: body.checks?.gameStarted === true,
  };
  const detectedVersion = typeof body.detectedVersion === "string" ? body.detectedVersion.trim().slice(0, 100) || null : null;
  // Lot 5 (18/10) : mods a ajouter a la main (bloques par CurseForge, absents de Modrinth). Le
  // launcher met modpackInstalled a true quand seuls ce genre de mods manquent : le test passe.
  const manualMods = parseManualMods(body.manualMods);

  // Lot 5 : avec des mods a ajouter a la main, le jeu peut ne pas avoir ete demarre pendant le
  // test (le proprietaire n'a pas ajoute les mods) : la publication reste possible.
  const allPassed = checks.reachable && checks.modpackInstalled && (checks.gameStarted || manualMods.length > 0);
  // Un echec partiel n'ecrit RIEN : jamais de debloquage silencieux de la publication sur un
  // test incomplet (voir le controle "Publier" masque sur ServerForm.tsx tant que
  // selfTestPassedAt est vide).
  if (!allPassed) {
    return NextResponse.json({ ok: true, passed: false });
  }

  const isResubmission = server.verificationStatus === "rejected";
  await db.orm.public.Server.where({ id: server.id }).update({
    selfTestPassedAt: new Date().toISOString(),
    selfTestDetectedVersion: detectedVersion,
    ...(MANUAL_MODS_READY ? { manualModsCount: manualMods.length, manualModsJson: manualMods.length ? JSON.stringify(manualMods) : null } : {}),
    isPrivate: false,
    verificationReason: null,
  });
  // Memes controles automatiques (ping, ecart de version, nom trop proche, mots bannis) que
  // la demande de publication depuis le site — ecrit aussi verificationStatus: "pending" et
  // l'historique (voir lib/verification.ts).
  await runAndStoreChecks(server.id, server.owner?.name ?? "le propriétaire", isResubmission);

  // "Mes instances" (launcher), la page Parametres et la console de gestion du site doivent
  // refleter l'entree en file tout de suite, comme les autres mutations de fiche (voir
  // modpack/route.ts : revalidateTag, pas updateTag — reserve aux Server Actions).
  revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });
  revalidatePath(`/manage/${server.id}/settings`);
  revalidatePath(`/manage/${server.id}`);
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, passed: true });
}

export const POST = withD1Busy(handlePOST);
