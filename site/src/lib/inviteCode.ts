import { randomInt } from "node:crypto";
import { db } from "@/prisma/db";

// Meme alphabet que les autres codes du projet (minecraftLink, mots de
// passe oublies) — sans caracteres ambigus (0/O, 1/I), un code d'invitation
// se lit et se retape a la main, y compris depuis le launcher.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

// Genere un code unique (retente en cas de collision, improbable a 32^5
// combinaisons mais verifiee par securite plutot que de s'appuyer
// uniquement sur la contrainte unique en base).
export async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const clash = await db.orm.public.Server.where({ inviteCode: code }).first();
    if (!clash) return code;
  }
  throw new Error("Impossible de générer un code d'invitation, réessaie.");
}
