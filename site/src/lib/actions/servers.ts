"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { slugify } from "@/lib/slug";
import { generateUniqueInviteCode } from "@/lib/inviteCode";

export type ServerActionState = { error: string } | undefined;

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
  recommendedRamGB: number | null;
};

function readForm(formData: FormData): ServerFormValues | { error: string } {
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
  const recommendedRamRaw = String(formData.get("recommendedRamGB") ?? "").trim();
  const recommendedRamGB = recommendedRamRaw ? Number(recommendedRamRaw) : null;

  if (!name || !description || !minecraftVersion || !ip) {
    return { error: "Nom, description, version et IP sont obligatoires." };
  }
  if (type === "modded" && !curseforgeModpackId) {
    return { error: "Un serveur moddé doit indiquer l'identifiant de son modpack CurseForge." };
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
    recommendedRamGB,
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

export async function createServer(_prevState: ServerActionState, formData: FormData): Promise<ServerActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = readForm(formData);
  if ("error" in parsed) return parsed;

  const slug = await uniqueSlugFor(parsed.name);
  const inviteCode = parsed.isPrivate ? await generateUniqueInviteCode() : null;

  const server = await db.orm.public.Server.create({
    ...parsed,
    slug,
    inviteCode,
    ownerId: session.user.id,
  });

  revalidatePath("/servers");
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

  const parsed = readForm(formData);
  if ("error" in parsed) return parsed;

  // Genere un code seulement en passant PUBLIC -> PRIVE sans code existant —
  // rebasculer en prive plus tard reutilise le meme code plutot que d'en
  // fabriquer un nouveau a chaque aller-retour (voir le commentaire sur
  // inviteCode dans contract.prisma).
  const inviteCode = parsed.isPrivate && !owned.inviteCode ? await generateUniqueInviteCode() : owned.inviteCode;

  await db.orm.public.Server.where({ id: serverId }).update({ ...parsed, inviteCode });

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

  revalidatePath("/servers");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Retire/republie la fiche de l'annuaire public et de l'API consommee par
// le launcher (voir published dans contract.prisma) sans supprimer la
// configuration — pratique pour une maintenance temporaire.
export async function toggleServerPublished(serverId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const owned = await getOwnedServer(serverId, session.user.id);
  if (!owned) redirect("/dashboard");

  await db.orm.public.Server.where({ id: serverId }).update({ published: !owned.published });

  revalidatePath("/servers");
  revalidatePath(`/servers/${owned.slug}`);
  revalidatePath("/dashboard");
  revalidatePath(`/manage/${serverId}`);
}

// Cree une copie de la fiche (nouveau slug, meme configuration sauf le nom)
// — pratique pour publier plusieurs serveurs similaires sans tout ressaisir.
export async function duplicateServer(serverId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const source = await getOwnedServer(serverId, session.user.id);
  if (!source) redirect("/dashboard");

  const name = `${source.name} (copie)`;
  const slug = await uniqueSlugFor(name);

  const copy = await db.orm.public.Server.create({
    slug,
    name,
    description: source.description,
    bannerUrl: source.bannerUrl,
    iconUrl: source.iconUrl,
    backgroundUrl: source.backgroundUrl,
    isPrivate: source.isPrivate,
    // Jamais le meme code que l'original : deux fiches distinctes ne
    // doivent pas partager un lien d'invitation.
    inviteCode: source.isPrivate ? await generateUniqueInviteCode() : null,
    type: source.type,
    minecraftVersion: source.minecraftVersion,
    ip: source.ip,
    curseforgeModpackId: source.curseforgeModpackId,
    curseforgeModpackName: source.curseforgeModpackName,
    curseforgeModpackVersion: source.curseforgeModpackVersion,
    recommendedRamGB: source.recommendedRamGB,
    // Une fiche mise en pause reste en pause dans sa copie — sans ça, un
    // serveur intentionnellement masque republiait automatiquement sa
    // copie (le defaut du schema est `true`).
    published: source.published,
    ownerId: session.user.id,
  });

  revalidatePath("/dashboard");
  redirect(`/manage/${copy.id}`);
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

  revalidatePath(`/manage/${serverId}/settings`);
}
