"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { slugify } from "@/lib/slug";

export type ServerActionState = { error: string } | undefined;

type ServerFormValues = {
  name: string;
  description: string;
  bannerUrl: string | null;
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
  if (recommendedRamRaw && (!Number.isInteger(recommendedRamGB) || recommendedRamGB! < 1)) {
    return { error: "La RAM recommandée doit être un nombre entier de Go (1 ou plus)." };
  }

  return {
    name,
    description,
    bannerUrl,
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

export async function createServer(_prevState: ServerActionState, formData: FormData): Promise<ServerActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = readForm(formData);
  if ("error" in parsed) return parsed;

  const slug = await uniqueSlugFor(parsed.name);

  const server = await db.orm.public.Server.create({
    ...parsed,
    slug,
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

  const owned = await db.orm.public.Server.where({ id: serverId, ownerId: session.user.id }).first();
  if (!owned) return { error: "Ce serveur n'existe pas ou ne t'appartient pas." };

  const parsed = readForm(formData);
  if ("error" in parsed) return parsed;

  await db.orm.public.Server.where({ id: serverId }).update(parsed);

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

  await db.orm.public.Server.where({ id: serverId, ownerId: session.user.id }).delete();

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

  const owned = await db.orm.public.Server.select("id", "slug", "published").where({ id: serverId, ownerId: session.user.id }).first();
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

  const source = await db.orm.public.Server.where({ id: serverId, ownerId: session.user.id }).first();
  if (!source) redirect("/dashboard");

  const name = `${source.name} (copie)`;
  const slug = await uniqueSlugFor(name);

  const copy = await db.orm.public.Server.create({
    slug,
    name,
    description: source.description,
    bannerUrl: source.bannerUrl,
    type: source.type,
    minecraftVersion: source.minecraftVersion,
    ip: source.ip,
    curseforgeModpackId: source.curseforgeModpackId,
    curseforgeModpackName: source.curseforgeModpackName,
    curseforgeModpackVersion: source.curseforgeModpackVersion,
    recommendedRamGB: source.recommendedRamGB,
    ownerId: session.user.id,
  });

  revalidatePath("/dashboard");
  redirect(`/manage/${copy.id}`);
}
