"use server";

import { revalidateTag } from "next/cache";
import { auth, signOut } from "@/auth";
import { db, execSql } from "@/lib/db";
import { deleteAllR2Images } from "@/lib/serverImages";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";

// Suppression definitive du compte (droit a l'effacement RGPD), en libre-service depuis la
// page Compte. Le cascade DB (ON DELETE CASCADE sur server/serverEvent/report/playerWarning/
// adminNote via user.id) a ete verifie en conditions reelles sur D1 le 2026-10-13 — mais les
// images R2 et les notifications (recipientMinecraftUuid est un champ brut, pas une FK, voir
// lib/notifications.ts) n'en beneficient pas et sont nettoyees ici a la main, avant la ligne
// user elle-meme.
export async function deleteAccount(confirmation: string): Promise<{ error: string } | void> {
  if (confirmation.trim().toLowerCase() !== "supprimer") {
    return { error: "Tape « supprimer » pour confirmer." };
  }
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée, reconnecte-toi." };

  const user = await db.orm.public.User.select("id", "minecraftUuid").where({ id: session.user.id }).first();
  if (!user) return { error: "Compte introuvable." };

  const servers = await db.orm.public.Server.select("id", "bannerUrl", "iconUrl", "backgroundUrl").where({ ownerId: user.id }).all();
  for (const server of servers) await deleteAllR2Images(server, server.id);

  if (user.minecraftUuid) {
    await execSql(`DELETE FROM notification WHERE recipientMinecraftUuid = ?`, [user.minecraftUuid]);
  }

  await db.orm.public.User.where({ id: user.id }).delete();
  // Sans ca, l'annuaire public (/servers) et "Mes instances" dans le launcher continuent de
  // montrer les serveurs supprimes jusqu'a l'expiration naturelle du cache (unstable_cache,
  // voir lib/public-servers.ts) — trouve en testant une vraie suppression de compte.
  revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });

  await signOut({ redirectTo: "/" });
}
