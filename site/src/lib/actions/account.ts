"use server";

import { revalidateTag } from "next/cache";
import { auth, signOut } from "@/auth";
import { db, execSql } from "@/lib/db";
import { deleteAllR2Images, deleteR2ImageIfOwned } from "@/lib/serverImages";
import { markAccountDeleted } from "@/lib/users";
import { normalizeMinecraftUuid } from "@/lib/launcherSession";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";
import { deleteAllCloudData } from "@/lib/playWorlds";
import { deleteUserSubmissions } from "@/lib/omniPacks";
import { removeTester } from "@/lib/features";
import { TEAMS_READY } from "@/lib/teamRules";

// Suppression definitive du compte (droit a l'effacement RGPD), en libre-service depuis la
// page Compte. Le cascade DB (ON DELETE CASCADE sur server/serverEvent/report/playerWarning/
// adminNote via user.id) a ete verifie en conditions reelles sur D1 le 2026-10-13 — mais les
// images R2 et les notifications (recipientMinecraftUuid est un champ brut, pas une FK, voir
// lib/notifications.ts) n'en beneficient pas et sont nettoyees ici a la main, avant la ligne
// user elle-meme.
// Codes d'erreur plutot que des phrases : le texte vient du dictionnaire (FR/EN) cote
// DeleteAccountSection. Mot de confirmation accepte dans les deux langues.
export type DeleteAccountError = "confirm" | "session" | "notFound";
const CONFIRM_WORDS = ["supprimer", "delete"];

export async function deleteAccount(confirmation: string): Promise<{ error: DeleteAccountError } | void> {
  if (!CONFIRM_WORDS.includes(confirmation.trim().toLowerCase())) return { error: "confirm" };
  const session = await auth();
  if (!session?.user?.id) return { error: "session" };

  const user = await db.orm.public.User.select("id", "minecraftUuid").where({ id: session.user.id }).first();
  if (!user) return { error: "notFound" };

  const servers = await db.orm.public.Server.select("id", "bannerUrl", "iconUrl", "backgroundUrl", "pageConfig").where({ ownerId: user.id }).all();
  for (const server of servers) await deleteAllR2Images(server, server.id);
  // Mode Jouer (24/10) : mondes sauvegardés en ligne (fichiers R2 et envois en cours). Les lignes
  // cloudWorld/cloudWorldVersion partent ensuite avec le cascade de "user".
  await deleteAllCloudData(user.id);
  // Audit du 01/11 : ce qui restait après la suppression. Icônes de team et images de preuve : les
  // lignes partent avec le cascade, les fichiers R2 non. Packs proposés : fichiers effacés (un pack
  // déjà accepté reste, sans le pseudo de son auteur). Liste des testeurs du Laboratoire : par UUID.
  if (TEAMS_READY) {
    const teamImages = (await execSql(
      `SELECT "iconUrl" AS "url" FROM "team" WHERE "ownerId" = ? UNION ALL SELECT "proofImageUrl" FROM "teamRequest" WHERE "userId" = ?`,
      [user.id, user.id],
    )) as unknown as { url: string | null }[];
    await execSql(`DELETE FROM "teamRequest" WHERE "userId" = ?`, [user.id]);
    await execSql(`DELETE FROM "team" WHERE "ownerId" = ?`, [user.id]);
    for (const { url } of teamImages) await deleteR2ImageIfOwned(url, null);
  }
  await deleteUserSubmissions(user.id);
  if (user.minecraftUuid) await removeTester(user.minecraftUuid);

  if (user.minecraftUuid) {
    await execSql(`DELETE FROM notification WHERE recipientMinecraftUuid = ?`, [user.minecraftUuid]);
    // Serveurs suivis : rattaches a l'UUID tel que le launcher l'a envoye (avec ou sans tirets),
    // pas a user.id, donc pas de cascade (audit 14/10).
    await execSql(`DELETE FROM "instanceWatch" WHERE lower(replace("minecraftUuid", '-', '')) = ?`, [
      normalizeMinecraftUuid(user.minecraftUuid),
    ]);
    // Signalements et problemes d'installation envoyes PAR le joueur (sur ses serveurs ou ceux
    // des autres) : rattaches a l'UUID, pas a user.id, donc pas de cascade non plus. « Supprimer
    // mon compte » doit tout effacer (23/10).
    const uuid = normalizeMinecraftUuid(user.minecraftUuid);
    await execSql(`DELETE FROM "report" WHERE lower(replace("reporterMinecraftUuid", '-', '')) = ?`, [uuid]);
    await execSql(`DELETE FROM "installProblem" WHERE lower(replace("reporterMinecraftUuid", '-', '')) = ?`, [uuid]);
  }

  // Empreinte du compte supprime : le launcher, s'il reste connecte, ne le recreera pas tout
  // seul (voir findOrCreateUserByMinecraft). Ecrite AVANT la suppression : si elle echoue, rien
  // n'est supprime et le joueur peut reessayer.
  if (user.minecraftUuid) await markAccountDeleted(user.minecraftUuid);
  await db.orm.public.User.where({ id: user.id }).delete();
  // Sans ca, l'annuaire public (/servers) et "Mes instances" dans le launcher continuent de
  // montrer les serveurs supprimes jusqu'a l'expiration naturelle du cache (unstable_cache,
  // voir lib/public-servers.ts) — trouve en testant une vraie suppression de compte.
  revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });

  await signOut({ redirectTo: "/" });
}
