"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOwnerTagPanel, getTagCatalog, insertTagRequest, type OwnerTagPanel } from "@/lib/tagRequests";
import { TAG_MONTHLY_MAX, TAG_PENDING_MAX, TAG_WORD_MAX, findExistingTag, isBannedTagWord, normalizeTagWord } from "@/lib/tagCatalog";

export type TagRequestError = "short" | "long" | "banned" | "duplicate" | "limitPending" | "limitMonth" | "notFound" | "generic";

export type TagRequestResult = { ok: true; panel: OwnerTagPanel } | { exists: string } | { error: TagRequestError };

// Envoi d'une demande d'etiquette depuis l'editeur de fiche (bloc « Il te manque une
// etiquette ? »). Tout est revérifié ici, rien n'est cru du navigateur : proprietaire du
// serveur, longueur, liste noire, doublon avec une etiquette ou un alias existant (les alias ne
// sont connus que du serveur), 2 demandes en attente max par serveur, 5 par mois par compte.
export async function submitTagRequest(serverId: string, rawWord: string): Promise<TagRequestResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "notFound" };
  const userId = session.user.id;

  const word = String(rawWord ?? "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (word.length > TAG_WORD_MAX) return { error: "long" };
  const normalized = normalizeTagWord(word);
  if (normalized.length < 2) return { error: "short" };
  if (isBannedTagWord(normalized)) return { error: "banned" };

  const owned = await db.orm.public.Server.select("id").where({ id: serverId, ownerId: userId }).first();
  if (!owned) return { error: "notFound" };

  const existing = findExistingTag(word, await getTagCatalog());
  if (existing) return { exists: existing };

  try {
    const panel = await getOwnerTagPanel(serverId, userId);
    if (panel.requests.some((r) => r.status === "pending" && normalizeTagWord(r.word) === normalized)) return { error: "duplicate" };
    if (panel.pending >= TAG_PENDING_MAX) return { error: "limitPending" };
    if (panel.month >= TAG_MONTHLY_MAX) return { error: "limitMonth" };
    await insertTagRequest({ serverId, ownerUserId: userId, word, normalized });
    return { ok: true, panel: await getOwnerTagPanel(serverId, userId) };
  } catch (err) {
    console.error("[tagRequests] envoi impossible :", err);
    return { error: "generic" };
  }
}
