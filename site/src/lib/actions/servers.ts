"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ownTeamIdOrNull } from "@/lib/teams";
import { deleteR2ImageIfOwned, deleteAllR2Images, imagesUsedByAnotherOwner } from "@/lib/serverImages";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";
import { slugify } from "@/lib/slug";
import { generateUniqueInviteCode } from "@/lib/inviteCode";
import { DEFAULT_MODPACK_CHANNEL, parseModpackSource, type ModpackChannel, type ModpackSource } from "@/lib/modpack-types";
import { runAndStoreChecks } from "@/lib/verification";
import { requestServerAppeal } from "@/lib/appeals";
import { addressUsedByFrozenServer } from "@/lib/frozenAddress";
import { isOwnImageUrl } from "@/lib/ownImageUrl";
import { supportsAutoConnect } from "@/lib/minecraft-version-constants";
import { SERVER_TEMPLATES, isServerTemplate } from "@/lib/serverTemplates";
import { MANUAL_MODS_READY } from "@/lib/manualMods";
import { DEFAULT_PAGE_CONFIG, normalizePageConfig } from "@/lib/serverPage";

export type ServerActionState = { error: string } | undefined;

// Second audit du 14/10 (I2) : adresse deja utilisee par un serveur gele (voir lib/frozenAddress.ts).
const FROZEN_ADDRESS_ERROR = "Cette adresse est celle d'un serveur gelé par l'équipe : elle ne peut pas être utilisée pour une autre fiche.";
// Audit du 19/10 (S-I1) : image deja utilisee par la fiche d'un autre compte (voir lib/serverImages.ts).
const FOREIGN_IMAGE_ERROR = "Cette image appartient à la fiche d'un autre serveur : envoie ta propre image.";

type ServerFormValues = {
  name: string;
  description: string;
  bannerUrl: string | null;
  iconUrl: string | null;
  backgroundUrl: string | null;
  isPrivate: boolean;
  type: "vanilla" | "modded";
  minecraftVersion: string;
  ip: string;
  curseforgeModpackId: string | null;
  curseforgeModpackName: string | null;
  curseforgeModpackVersion: string | null;
  modpackSource: ModpackSource;
  modpackChannel: ModpackChannel;
  recommendedRamGB: number | null;
  autoConnect: boolean;
  addToServerList: boolean;
};

async function requestHost(): Promise<string | null> {
  return (await headers()).get("host");
}

type PreviousImages = { bannerUrl: string | null; iconUrl: string | null; backgroundUrl: string | null };

function readForm(
  formData: FormData,
  host: string | null,
  previous?: PreviousImages,
): ServerFormValues | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const bannerUrl = String(formData.get("bannerUrl") ?? "").trim() || null;
  const iconUrl = String(formData.get("iconUrl") ?? "").trim() || null;
  const backgroundUrl = String(formData.get("backgroundUrl") ?? "").trim() || null;
  const isPrivate = formData.get("visibility") === "private";
  const type = formData.get("type") === "modded" ? "modded" : "vanilla";
  const minecraftVersion = String(formData.get("minecraftVersion") ?? "").trim();
  const ip = String(formData.get("ip") ?? "").trim();
  const curseforgeModpackId = String(formData.get("curseforgeModpackId") ?? "").trim() || null;
  const curseforgeModpackName = String(formData.get("curseforgeModpackName") ?? "").trim() || null;
  const curseforgeModpackVersion = String(formData.get("curseforgeModpackVersion") ?? "").trim() || null;
  const modpackSource: ModpackSource = parseModpackSource(formData.get("modpackSource"));
  const modpackChannel: ModpackChannel = formData.get("modpackChannel") === "beta" ? "beta" : DEFAULT_MODPACK_CHANNEL;
  const recommendedRamRaw = String(formData.get("recommendedRamGB") ?? "").trim();
  const recommendedRamGB = recommendedRamRaw ? Number(recommendedRamRaw) : null;
  // Coche par defaut (meme logique qu'un checkbox HTML absent du FormData quand decoche) :
  // seule sa presence explicite a "false" la desactive (voir ServerForm.tsx, qui envoie
  // toujours un champ hidden "0" a cote de la case pour ce cas precis).
  const addToServerList = formData.get("addToServerList") !== "false";
  // Sans liste Multijoueur, la connexion directe est le seul moyen d'entrer : forcee, meme si
  // le formulaire (case desactivee, donc absente du FormData) ou un appel trafique dit le contraire.
  const autoConnect = !addToServerList || formData.get("autoConnect") !== "false";

  if (!name || !description || !minecraftVersion || !ip) {
    return { error: "Nom, description, version et IP sont obligatoires." };
  }
  if (
    !isOwnImageUrl(bannerUrl, host, previous?.bannerUrl) ||
    !isOwnImageUrl(iconUrl, host, previous?.iconUrl) ||
    !isOwnImageUrl(backgroundUrl, host, previous?.backgroundUrl)
  ) {
    return { error: "Les images (bannière, icône, fond) doivent être envoyées depuis ce formulaire." };
  }
  // Avant 1.20, pas de connexion directe (Quick Play) : sans liste Multijoueur, personne n'entrerait.
  if (!addToServerList && !supportsAutoConnect(minecraftVersion)) {
    return { error: "Sur Minecraft avant 1.20, l'adresse doit rester dans la liste Multijoueur (la connexion directe n'existe pas)." };
  }
  if (type === "modded" && !curseforgeModpackId) {
    return { error: "Un serveur moddé doit indiquer son modpack (CurseForge, Modrinth ou FTB)." };
  }
  // Plafonnee a 32 Go : au-dela, le launcher clampe silencieusement la
  // valeur reelle utilisee (voir settingsStore.js/MAX_GB cote launcher),
  // ce qui ferait promettre au joueur une RAM que le jeu ne recevrait
  // jamais vraiment.
  if (recommendedRamRaw && (!Number.isInteger(recommendedRamGB) || recommendedRamGB! < 1 || recommendedRamGB! > 32)) {
    return { error: "La RAM recommandée doit être un nombre entier de Go, entre 1 et 32." };
  }

  return {
    name,
    description,
    bannerUrl,
    iconUrl,
    backgroundUrl,
    isPrivate,
    type,
    minecraftVersion,
    ip,
    curseforgeModpackId: type === "modded" ? curseforgeModpackId : null,
    curseforgeModpackName: type === "modded" ? curseforgeModpackName : null,
    curseforgeModpackVersion: type === "modded" ? curseforgeModpackVersion : null,
    modpackSource: type === "modded" ? modpackSource : "curseforge",
    modpackChannel: type === "modded" ? modpackChannel : DEFAULT_MODPACK_CHANNEL,
    recommendedRamGB,
    autoConnect,
    addToServerList,
  };
}

async function uniqueSlugFor(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let attempt = 1;
  while (await db.orm.public.Server.where({ slug }).first()) {
    slug = `${base}-${attempt++}`;
  }
  return slug;
}

// Point unique pour la verification de propriete d'un serveur — chacune des
// actions ci-dessous la reimplementait independamment (meme requete
// copiee-collee 5 fois), un risque concret si l'une des copies venait a
// oublier le filtre `ownerId` (acces/mutation d'un serveur d'un autre
// utilisateur). Ne decide pas de la reaction a un serveur introuvable :
// chaque appelant garde son propre comportement (retour d'erreur de
// formulaire ici, redirection ailleurs).
async function getOwnedServer(serverId: string, userId: string) {
  return db.orm.public.Server.where({ id: serverId, ownerId: userId }).first();
}

// Audit 25/10 : changer l'adresse d'une fiche gelee permettait de liberer l'ancienne adresse,
// puis de recreer une fiche avec elle (addressUsedByFrozenServer ne la voyait plus).
const FROZEN_SERVER_ADDRESS_ERROR = "Cette fiche est gelée : son adresse ne peut pas changer tant que le gel n'est pas levé.";

export async function createServer(_prevState: ServerActionState, formData: FormData): Promise<ServerActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = readForm(formData, await requestHost());
  if ("error" in parsed) return parsed;
  if (await addressUsedByFrozenServer(parsed.ip)) return { error: FROZEN_ADDRESS_ERROR };
  if (await imagesUsedByAnotherOwner([parsed.bannerUrl, parsed.iconUrl, parsed.backgroundUrl], session.user.id)) {
    return { error: FOREIGN_IMAGE_ERROR };
  }

  const slug = await uniqueSlugFor(parsed.name);
  // Toute nouvelle fiche est privee, quoi qu'en dise le formulaire (visibilite retiree de
  // l'etape 1 de NewServerWizard, mais on le force aussi ici au cas ou — jamais fier d'un
  // champ client) : passer public exige d'abord l'auto-test de publication dans le launcher
  // (voir /api/launcher/servers/[slug]/self-test et selfTestPassedAt sur server). Decision
  // produit du 2026-10-10, en plus de la file de verification existante (verificationStatus).
  const isPrivate = true;
  const inviteCode = isPrivate ? await generateUniqueInviteCode() : null;

  // Pas de verificationStatus: "pending" ici (laisse le defaut 'approved' de la colonne,
  // schema.sql) et pas de runAndStoreChecks : une fiche neuve est toujours privee (ci-dessus),
  // donc invisible de l'annuaire quoi qu'il arrive — l'envoyer tout de suite dans la file de
  // verification admin encombrerait cette liste de fiches que le proprietaire ne publiera
  // peut-etre jamais (decision produit du 2026-10-10). La vraie entree en file se fait dans
  // updateServer, au moment ou le proprietaire demande reellement a passer public.
  // Modele de fiche choisi a l'etape 1 (design 2026-10-17, point 7) : seules ses etiquettes
  // sont gardees ici (description/type/RAM arrivent deja preremplies dans le formulaire).
  const template = formData.get("template");
  const pageConfig = isServerTemplate(template)
    ? JSON.stringify(normalizePageConfig({ ...DEFAULT_PAGE_CONFIG, tags: [...SERVER_TEMPLATES[template].tags] }))
    : undefined;

  // Team choisie a l'etape 1 (teams, 19/10) : seulement une team de ce compte, sinon aucune.
  const teamId = await ownTeamIdOrNull(session.user.id, String(formData.get("teamId") ?? "") || null);

  const server = await db.orm.public.Server.create({
    ...parsed,
    ...(pageConfig ? { pageConfig } : {}),
    ...(teamId ? { teamId } : {}),
    isPrivate,
    slug,
    inviteCode,
    ownerId: session.user.id,
  });

  updateTag(SERVERS_CACHE_TAG); // "Mes instances" (launcher) doit voir la nouvelle fiche tout de suite
  revalidatePath("/dashboard");
  redirect(`/manage/${server.id}`);
}

export async function updateServer(
  serverId: string,
  _prevState: ServerActionState,
  formData: FormData,
): Promise<ServerActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const owned = await getOwnedServer(serverId, session.user.id);
  if (!owned) return { error: "Ce serveur n'existe pas ou ne t'appartient pas." };

  const parsed = readForm(formData, await requestHost(), owned);
  if ("error" in parsed) return parsed;
  if (parsed.ip !== owned.ip && owned.frozenAt) return { error: FROZEN_SERVER_ADDRESS_ERROR };
  if (parsed.ip !== owned.ip && (await addressUsedByFrozenServer(parsed.ip, serverId))) return { error: FROZEN_ADDRESS_ERROR };
  const addedImages = (["bannerUrl", "iconUrl", "backgroundUrl"] as const).filter((k) => parsed[k] !== owned[k]).map((k) => parsed[k]);
  if (await imagesUsedByAnotherOwner(addedImages, session.user.id)) return { error: FOREIGN_IMAGE_ERROR };

  // Un changement d'IP, de version declaree ou de modpack rend l'auto-test precedent caduc —
  // meme esprit que runAndStoreChecks ci-dessous pour le controle automatique du site : une
  // fiche qui a change de config doit retester sa connexion avant de pouvoir (re)publier.
  const connectionChanged =
    parsed.ip !== owned.ip ||
    parsed.minecraftVersion !== owned.minecraftVersion ||
    parsed.curseforgeModpackId !== owned.curseforgeModpackId ||
    parsed.curseforgeModpackVersion !== owned.curseforgeModpackVersion ||
    parsed.modpackSource !== owned.modpackSource ||
    // Canal release/beta (2026-10-13) : change quel fichier est installe (voir
    // getModpackInstallFile/getModrinthModpackInstallFile), donc meme raisonnement que
    // modpackSource ci-dessus.
    parsed.modpackChannel !== owned.modpackChannel;

  // Passer PRIVE -> PUBLIC exige un auto-test de publication reussi dans le launcher (voir
  // selfTestPassedAt / /api/launcher/servers/[slug]/self-test) — sans ca, on reste prive quoi
  // qu'en dise le formulaire (le controle "Publier" du site est aussi masque dans ce cas,
  // voir ServerForm.tsx, mais on ne fait jamais confiance a ce qui vient du client). Un
  // changement de connexion invalide le test courant (ci-dessus) : meme si l'ancien
  // selfTestPassedAt existe encore en base a cet instant, il ne compte plus pour la nouvelle
  // config, donc on repasse prive aussi dans ce cas.
  const isPrivate = parsed.isPrivate || !owned.selfTestPassedAt || connectionChanged;

  // Genere un code seulement en passant PUBLIC -> PRIVE sans code existant —
  // rebasculer en prive plus tard reutilise le meme code plutot que d'en
  // fabriquer un nouveau a chaque aller-retour (voir le commentaire sur
  // inviteCode dans contract.prisma).
  const inviteCode = isPrivate && !owned.inviteCode ? await generateUniqueInviteCode() : owned.inviteCode;

  // Le vrai moment d'une "demande de publication" : ce n'est QUE cette transition precise
  // (prive -> public dans cette meme modification) qui doit faire entrer la fiche dans la
  // file de verification admin — jamais une simple modification d'un serveur deja prive, et
  // jamais une simple modification d'un serveur deja public et approuve (voir createServer/
  // duplicateServer pour le meme raisonnement a la creation). Sans cette distinction, chaque
  // modif d'un serveur encore prive renverrait inutilement des controles.
  const enteringPublicationQueue = owned.isPrivate && !isPrivate;

  // Nouvelle adresse : le statut enregistré ne vaut plus rien, on la re-mesure à la prochaine visite
  // (sans ça, un serveur resté « hors ligne » attendrait jusqu'à 5 minutes).
  await db.orm.public.Server.where({ id: serverId }).update({
    ...parsed,
    isPrivate,
    inviteCode,
    ...(parsed.ip !== owned.ip ? { lastPingedAt: null, playerCount: null, playerCapacity: null } : {}),
    ...(connectionChanged
      ? { selfTestPassedAt: null, selfTestDetectedVersion: null, ...(MANUAL_MODS_READY ? { manualModsCount: 0, manualModsJson: null } : {}) }
      : {}),
    // 2026-10-10 : verificationReason (motif du refus precedent) ne se vidait jamais — un
    // serveur refuse puis republie gardait l'ancien motif affiche (manage/[id]/page.tsx) meme
    // apres avoir ete remis en file et potentiellement reapprouve.
    ...(enteringPublicationQueue ? { verificationStatus: "pending", verificationReason: null } : {}),
  });

  // Image remplacee ou retiree : l'ancienne ne sert plus a rien sur R2 (sauf si une fiche
  // dupliquee la partage encore, verifie dans deleteR2ImageIfOwned). null : la fiche est deja a
  // jour en base et compte aussi (banniere devenue icone, image aussi dans la galerie...).
  if (parsed.bannerUrl !== owned.bannerUrl) await deleteR2ImageIfOwned(owned.bannerUrl, null);
  if (parsed.iconUrl !== owned.iconUrl) await deleteR2ImageIfOwned(owned.iconUrl, null);
  if (parsed.backgroundUrl !== owned.backgroundUrl) await deleteR2ImageIfOwned(owned.backgroundUrl, null);

  // Controles automatiques du site : lances au moment ou la fiche entre reellement dans la
  // file (ci-dessus), ou re-lances si une fiche deja en file (encore en attente/refusee,
  // donc toujours publique a ce stade) est modifiee — jamais pour une fiche privee ou deja
  // approuvee/publiee (voir le commentaire dans lib/verification.ts).
  if (enteringPublicationQueue || (!isPrivate && owned.verificationStatus !== "approved")) {
    await runAndStoreChecks(serverId, session.user.name ?? "le propriétaire", owned.verificationStatus === "rejected");
  }

  updateTag(SERVERS_CACHE_TAG);
  revalidatePath("/servers");
  revalidatePath(`/servers/${owned.slug}`);
  revalidatePath("/dashboard");
  revalidatePath(`/manage/${serverId}`);
  revalidatePath(`/manage/${serverId}/settings`);
  return undefined;
}

export async function deleteServer(serverId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const owned = await getOwnedServer(serverId, session.user.id);
  if (!owned) redirect("/dashboard");

  await db.orm.public.Server.where({ id: serverId }).delete();

  // Memes verifications que dans updateServer : une fiche dupliquee peut encore partager ces images.
  await deleteAllR2Images(owned, serverId);

  updateTag(SERVERS_CACHE_TAG);
  revalidatePath("/servers");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Retire/republie la fiche de l'annuaire public et de l'API consommee par
// le launcher (voir published dans contract.prisma) sans supprimer la
// configuration — pratique pour une maintenance temporaire.
// 2026-10-10 : renvoie desormais {error} dans les cas de rejet (serveur gele) plutot que de
// retourner silencieusement sans rien faire — meme convention que createServer/updateServer,
// pour que l'appelant (ManageActions) puisse l'afficher au lieu de laisser croire que le
// bouton n'a rien fait.
export async function toggleServerPublished(serverId: string): Promise<ServerActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const owned = await getOwnedServer(serverId, session.user.id);
  if (!owned) redirect("/dashboard");

  // Un serveur gelé par l'équipe ne se republie pas tout seul : seul un admin le dégèle.
  if (owned.frozenAt) return { error: "Ce serveur est gelé par l'équipe : seul un admin peut le dégeler." };
  await db.orm.public.Server.where({ id: serverId }).update({ published: !owned.published });

  updateTag(SERVERS_CACHE_TAG); // pause / republication : effet immediat pour tout le monde
  revalidatePath("/servers");
  revalidatePath(`/servers/${owned.slug}`);
  revalidatePath("/dashboard");
  revalidatePath(`/manage/${serverId}`);
  return undefined;
}

// Cree une copie de la fiche (nouveau slug, meme configuration sauf le nom)
// — pratique pour publier plusieurs serveurs similaires sans tout ressaisir.
export async function duplicateServer(serverId: string): Promise<ServerActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const source = await getOwnedServer(serverId, session.user.id);
  if (!source) redirect("/dashboard");
  // Audit 14/10 (S1) : la copie d'un serveur gele n'etait pas gelee. Le proprietaire pouvait
  // la passer en prive, partager le code d'invitation et revenir en ligne sans controle.
  if (source.frozenAt) return { error: "Ce serveur est gelé par l'équipe : il ne peut pas être dupliqué." };
  if (await addressUsedByFrozenServer(source.ip, source.id)) return { error: FROZEN_ADDRESS_ERROR };

  const name = `${source.name} (copie)`;
  const slug = await uniqueSlugFor(name);

  const copy = await db.orm.public.Server.create({
    slug,
    name,
    description: source.description,
    bannerUrl: source.bannerUrl,
    iconUrl: source.iconUrl,
    backgroundUrl: source.backgroundUrl,
    // Comme createServer : toute nouvelle fiche est privee, meme une copie d'une fiche deja
    // publique — elle doit repasser par son propre auto-test de publication (selfTestPassedAt
    // n'est pas copie de la source, un code different connecte a un autre reseau/config).
    isPrivate: true,
    // Jamais le meme code que l'original : deux fiches distinctes ne
    // doivent pas partager un lien d'invitation.
    inviteCode: await generateUniqueInviteCode(),
    type: source.type,
    minecraftVersion: source.minecraftVersion,
    ip: source.ip,
    curseforgeModpackId: source.curseforgeModpackId,
    curseforgeModpackName: source.curseforgeModpackName,
    curseforgeModpackVersion: source.curseforgeModpackVersion,
    modpackSource: source.modpackSource,
    modpackChannel: source.modpackChannel,
    recommendedRamGB: source.recommendedRamGB,
    autoConnect: source.autoConnect,
    addToServerList: source.addToServerList,
    // Meme team que l'original (teams, 19/10), si c'est bien une team de ce compte.
    ...((source as { teamId?: string | null }).teamId
      ? { teamId: await ownTeamIdOrNull(session.user.id, (source as { teamId?: string | null }).teamId ?? null) }
      : {}),
    // Une fiche mise en pause reste en pause dans sa copie — sans ça, un
    // serveur intentionnellement masque republiait automatiquement sa
    // copie (le defaut du schema est `true`).
    published: source.published,
    ownerId: session.user.id,
    // Pas de verificationStatus: "pending" ni runAndStoreChecks ici — meme raisonnement que
    // createServer : la copie est privee (ci-dessus), elle n'entre dans la file de
    // verification admin qu'au moment ou son proprietaire la republie reellement (voir
    // updateServer), pas a la simple duplication.
  });

  updateTag(SERVERS_CACHE_TAG);
  revalidatePath("/dashboard");
  redirect(`/manage/${copy.id}`);
}

// "Demander un second avis" (manage/[id]/page.tsx, serveur gelé) : voir lib/appeals.ts pour la
// mécanique complète (délai de 72h, assignation d'un admin différent quand c'est possible).
export async function requestAppeal(serverId: string): Promise<ServerActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const result = await requestServerAppeal(serverId, session.user.id);
  if (result?.error) return result;

  revalidatePath(`/manage/${serverId}`);
  return undefined;
}

// Invalide l'ancien lien/code d'invitation (voir le commentaire sur
// inviteCode dans contract.prisma : rebasculer Public->Prive->Public->Prive
// garde normalement le meme code, ce bouton est le seul moyen de forcer un
// nouveau code si l'ancien a fuite).
export async function resetInviteCode(serverId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const owned = await getOwnedServer(serverId, session.user.id);
  if (!owned || !owned.isPrivate) redirect("/dashboard");

  const inviteCode = await generateUniqueInviteCode();
  await db.orm.public.Server.where({ id: serverId }).update({ inviteCode });

  // L'ancien code doit cesser de marcher tout de suite (fiche en cache sinon 60 s).
  updateTag(SERVERS_CACHE_TAG);
  revalidatePath(`/manage/${serverId}/settings`);
}
