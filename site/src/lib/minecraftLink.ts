import { randomInt } from "node:crypto";
import { db } from "@/prisma/db";

// Lie un compte Omniscient (site) a un profil Minecraft/Xbox, sans jamais
// faire transiter le mot de passe du site dans le launcher : le joueur
// genere un code ephemere ici, le saisit dans le launcher (deja connecte a
// son compte Microsoft, voir launcher/src/msAuth.js), et le launcher
// l'echange contre la liaison via POST /api/launcher/minecraft-link.

// Alphabet sans caracteres ambigus a l'oeil (0/O, 1/I) — le code est lu et
// retape a la main entre deux ecrans.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export type StartLinkResult = { code: string; expiresAt: string };

// Un seul code actif a la fois par compte : en generer un nouveau invalide
// silencieusement le precedent, pour eviter la confusion si le joueur
// relance l'action plusieurs fois (ex: apres expiration).
export async function startMinecraftLink(userId: string): Promise<StartLinkResult> {
  await db.orm.public.MinecraftLinkCode.where({ userId }).delete();

  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  // Collision improbable (32^6 combinaisons) mais retentee par securite
  // plutot que de laisser echouer sur la contrainte unique.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    const clash = await db.orm.public.MinecraftLinkCode.where({ code }).first();
    if (clash) continue;
    await db.orm.public.MinecraftLinkCode.create({ code, userId, expiresAt });
    return { code, expiresAt };
  }
  throw new Error("Impossible de générer un code de liaison, réessaie.");
}

export async function unlinkMinecraftAccount(userId: string): Promise<void> {
  await db.orm.public.User.where({ id: userId }).update({ minecraftUuid: null, minecraftUsername: null });
}

export type ConsumeLinkCodeResult =
  | { ok: true; userName: string }
  | { ok: false; error: "invalid_code" | "already_linked_elsewhere" };

// Appelee par la route /api/launcher/minecraft-link (authentifiee par
// LAUNCHER_API_KEY, pas par une session joueur) une fois que le launcher a
// recupere le code saisi par le joueur et son propre profil Minecraft/Xbox.
export async function consumeMinecraftLinkCode(
  code: string,
  minecraftUuid: string,
  minecraftUsername: string,
): Promise<ConsumeLinkCodeResult> {
  const row = await db.orm.public.MinecraftLinkCode.where({ code }).first();
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "invalid_code" };
  }

  const clash = await db.orm.public.User.where({ minecraftUuid }).first();
  if (clash && clash.id !== row.userId) {
    return { ok: false, error: "already_linked_elsewhere" };
  }

  const user = await db.orm.public.User.where({ id: row.userId }).update({ minecraftUuid, minecraftUsername });
  await db.orm.public.MinecraftLinkCode.where({ id: row.id }).delete();

  if (!user) return { ok: false, error: "invalid_code" };
  return { ok: true, userName: user.name };
}
