"use server";

import { updateTag } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { markNotificationsRead } from "@/lib/notifications";
import { unreadTag } from "@/lib/unreadNotifications";

// Ouvrir /dashboard/notifications marque tout comme lu (lot 6, 18/10) et vide la pastille.
export async function markMyNotificationsReadAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  const user = await db.orm.public.User.select("minecraftUuid").where({ id: session.user.id }).first();
  if (user?.minecraftUuid) await markNotificationsRead(user.minecraftUuid);
  updateTag(unreadTag(session.user.id));
}
