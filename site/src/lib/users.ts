import { db, execSql } from "@/lib/db";
import { normalizeMinecraftUuid } from "@/lib/launcherSession";

// Comptes supprimes par leur proprietaire (bouton « Supprimer le compte ») : on garde seulement
// une empreinte SHA-256 de l'UUID Minecraft et la date, dans la table "deletedAccount" (voir
// schema.sql). Sans ca, le signal de presence du launcher (toutes les 60 s) recreait un compte
// vide dans la minute qui suit la suppression (audit 14/10, B10). L'empreinte est retiree des
// que le joueur revient de lui-meme : connexion sur le site, ou action explicite dans le
// launcher (envoyer une demande d'ami).
async function uuidFingerprint(minecraftUuid: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeMinecraftUuid(minecraftUuid));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function markAccountDeleted(minecraftUuid: string): Promise<void> {
  await execSql(
    'INSERT INTO "deletedAccount" ("minecraftUuidHash", "deletedAt") VALUES (?, ?) ' +
      'ON CONFLICT ("minecraftUuidHash") DO UPDATE SET "deletedAt" = excluded."deletedAt"',
    [await uuidFingerprint(minecraftUuid), new Date().toISOString()],
  );
}

export async function clearAccountDeletion(minecraftUuid: string): Promise<void> {
  await execSql('DELETE FROM "deletedAccount" WHERE "minecraftUuidHash" = ?', [await uuidFingerprint(minecraftUuid)]);
}

async function wasDeletedByOwner(minecraftUuid: string): Promise<boolean> {
  const rows = (await execSql('SELECT 1 AS "found" FROM "deletedAccount" WHERE "minecraftUuidHash" = ? LIMIT 1', [
    await uuidFingerprint(minecraftUuid),
  ])) as unknown[];
  return rows.length > 0;
}

// Trouve (ou cree) le compte site correspondant a un profil Minecraft/Xbox DEJA verifie
// (voir verifyLauncherProfile dans lib/launcherAuth.ts — n'appeler ceci qu'apres cette
// verification, jamais avant). Un joueur qui n'utilise QUE le launcher (jamais connecte sur le
// site via "Se connecter avec Microsoft") peut tres bien n'avoir encore aucune ligne "user" :
// meme logique de creation a la volee que auth.ts/jwt() au premier login web, necessaire ici
// pour que la presence et les amities (qui referencent "user" par id, voir schema.sql) marchent
// aussi pour ces joueurs — contrairement aux notifications/instanceWatch, qui contournent le
// probleme en gardant le minecraftUuid brut plutot qu'une relation User.
//
// minecraftUsername : UNIQUEMENT le pseudo verifie (profil Mojang ou jeton de session signe),
// jamais celui du corps de la requete (audit 14/10, B2). null = on garde le pseudo connu.
//
// explicit : false pour un appel automatique (signal de presence) — il ne recree PAS un compte
// supprime par son proprietaire et renvoie null. true pour une action volontaire du joueur
// (demande d'ami) : le compte est recree et l'empreinte de suppression retiree.
export async function findOrCreateUserByMinecraft(
  minecraftUuid: string,
  minecraftUsername: string | null,
  options: { explicit: boolean },
): Promise<{ id: string } | null> {
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
  if (await wasDeletedByOwner(minecraftUuid)) {
    if (!options.explicit) return null;
    await clearAccountDeletion(minecraftUuid);
  }
  return db.orm.public.User.create({
    name: minecraftUsername ?? minecraftUuid,
    minecraftUuid,
    minecraftUsername: minecraftUsername ?? null,
  });
}
