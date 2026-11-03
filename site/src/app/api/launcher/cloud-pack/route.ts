import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { isVisibleRow, limitInviteAttempts, proofFromRequest } from "@/lib/public-servers";
import { requireLauncherFeature } from "@/lib/features";
import { countInstall, finalizePackJars, launcherInstallPayload, publicPackInfo, serverCloudPackRow, setPackRefs, startLauncherUpload, storeUploadedPack } from "@/lib/cloudPacks";
import { withD1Busy } from "@/lib/d1Busy";
import { playLauncherUser } from "@/lib/playLauncher";
import { getUserOffer } from "@/lib/playWorlds";
import { revalidatePath } from "next/cache";

// Mon cloud (03/11) : modpack relié à un serveur par son propriétaire.
//   GET /api/launcher/cloud-pack?slug=<serveur>            → { pack } (fiche du serveur dans le launcher,
//        et savoir s'il est « Obligatoire pour rejoindre ») ; { pack: null } s'il n'y en a pas, ou si
//        l'interrupteur du Laboratoire est caché pour ce joueur (le serveur se lance alors comme avant).
//   GET /api/launcher/cloud-pack?slug=<serveur>&install=1  → ce que le launcher installe (liens Modrinth
//        + lien signé des configs) ; &first=1 = première installation chez ce joueur (compteur).
// Rangé ici plutôt que sous servers/[slug]/ : un chemin moins profond (copie vers le dossier local).
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const limited = rateLimitResponse(request, "launcher-cloud-pack", 120) ?? limitInviteAttempts(request);
  if (limited) return limited;
  const url = new URL(request.url);
  const install = url.searchParams.get("install") === "1";
  const off = await requireLauncherFeature(request, "cloudPacks");
  if (off) return install ? off : NextResponse.json({ pack: null });
  const slug = url.searchParams.get("slug") ?? "";
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(slug)) return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  const server = await db.orm.public.Server.select("id", "published", "verificationStatus", "isPrivate", "inviteCode")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug })
    .first();
  if (!server || !(await isVisibleRow(server, proofFromRequest(request)))) return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  const row = await serverCloudPackRow(server.id).catch(() => null);
  if (!install) return NextResponse.json({ pack: row ? publicPackInfo(row) : null });
  if (!row) return NextResponse.json({ error: "Ce serveur n'a pas de modpack relié." }, { status: 404 });
  if (url.searchParams.get("first") === "1") await countInstall(row.id);
  return NextResponse.json(launcherInstallPayload(row));
}

export const GET = withD1Busy(handleGET);

// « Envoyer dans le cloud » depuis le launcher (03/11), identité du joueur VÉRIFIÉE :
//   POST ?start=1                    → { key, url } : lien de dépôt direct du .mrpack (1 h, 100 Mo au plus)
//   POST ?upload=1&name=…&key=…      le site relit le .mrpack déposé, le contrôle → { id, name, mods, configs }
//   POST ?refs=1&pack=<id>           corps = { curseforge: [...], custom: [...] } → liens de dépôt des mods perso
//   POST ?finalize=1&pack=<id>       contrôle des mods perso déposés → gardés / liens / refusés
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
async function handlePOST(request: Request) {
  const url = new URL(request.url);
  const who = await playLauncherUser(request, url.searchParams.get("minecraftUuid"), { bucket: "launcher-cloud-upload", limit: 60, feature: "cloudPacks" });
  if ("response" in who) return who.response;
  const offer = await getUserOffer(who.userId);
  const pack = url.searchParams.get("pack") ?? "";
  // Le fichier ne passe jamais par le site (Rushi, 03/11) : lien de dépôt direct vers le stockage.
  if (url.searchParams.get("start") === "1") return NextResponse.json({ ok: true, ...startLauncherUpload(who.userId) });
  if (url.searchParams.get("upload") === "1") {
    const r = await storeUploadedPack(who.userId, offer, url.searchParams.get("name") ?? "", url.searchParams.get("key") ?? "");
    if (!r.ok) return err(r.error);
    revalidatePath("/dashboard/cloud");
    return NextResponse.json(r);
  }
  if (url.searchParams.get("refs") === "1") {
    const input = await request.json().catch(() => null);
    if (!input || typeof input !== "object") return err("Liste des mods illisible.");
    const r = await setPackRefs(who.userId, offer, pack, input);
    if (!r.ok) return err(r.error);
    revalidatePath("/dashboard/cloud");
    return NextResponse.json(r);
  }
  if (url.searchParams.get("finalize") === "1") {
    const r = await finalizePackJars(who.userId, offer, pack);
    if (!r.ok) return err(r.error);
    revalidatePath("/dashboard/cloud");
    return NextResponse.json(r);
  }
  return err("Demande inconnue.");
}

export const POST = withD1Busy(handlePOST);
