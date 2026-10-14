import { db } from "@/lib/db";

// Trouve (ou cree) le compte site correspondant a un profil Minecraft/Xbox DEJA verifie
// (voir verifyLauncherIdentity dans lib/launcherAuth.ts — n'appeler ceci qu'apres cette
// verification, jamais avant). Un joueur qui n'utilise QUE le launcher (jamais connecte sur le
// site via "Se connecter avec Microsoft") peut tres bien n'avoir encore aucune ligne "user" :
// meme logique de creation a la volee que auth.ts/jwt() au premier login web, necessaire ici
// pour que la presence et les amities (qui referencent "user" par id, voir schema.sql) marchent
// aussi pour ces joueurs — contrairement aux notifications/instanceWatch, qui contournent le
// probleme en gardant le minecraftUuid brut plutot qu'une relation User.
export async function findOrCreateUserByMinecraft(
  minecraftUuid: string,
  minecraftUsername: string | null,
): Promise<{ id: string }> {
  const existing = await db.orm.public.User.select("id", "minecraftUsername", "name").where({ minecraftUuid }).first();
  if (existing) {
    // Le pseudo Minecraft peut changer avec le temps — resynchronise ici aussi (meme
    // raisonnement que auth.ts), pour que la recherche d'ami par pseudo (lib/friends.ts) ne
    // reste pas bloquee sur un ancien pseudo.
    if (minecraftUsername && (existing.minecraftUsername !== minecraftUsername || existing.name !== minecraftUsername)) {
      const updated = await db.orm.public.User.where({ id: existing.id }).update({
        name: minecraftUsername,
        minecraftUsername,
      });
      if (updated) return updated;
    }
    return existing;
  }
  return db.orm.public.User.create({
    name: minecraftUsername ?? minecraftUuid,
    minecraftUuid,
    minecraftUsername: minecraftUsername ?? null,
  });
}
