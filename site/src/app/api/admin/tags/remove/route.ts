import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { TAG_CATALOG_CACHE_TAG, getTagCatalog, removeTag } from "@/lib/tagRequests";

// « Retirer » dans la liste des etiquettes existantes (page /admin/etiquettes, preview validee le
// 23/10) : l'etiquette sort de la liste et des fiches, ou est remplacee par une autre (swapTo).
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const tagId = String(form.get("tagId") ?? "").trim();
  const action = String(form.get("action") ?? "");
  const swapTo = action === "swap" ? String(form.get("swapTo") ?? "").trim() : null;
  if (!tagId || (action !== "strip" && action !== "swap") || (action === "swap" && !swapTo)) {
    return backToServers(request, "/admin/etiquettes?error=generic");
  }
  try {
    if ((await removeTag(tagId, swapTo, await getTagCatalog())) === null) return backToServers(request, "/admin/etiquettes?error=generic");
  } catch (err) {
    console.error("[tags] retrait impossible :", err);
    return backToServers(request, "/admin/etiquettes?error=generic");
  }
  revalidateTag(TAG_CATALOG_CACHE_TAG, { expire: 0 });
  refreshServersCache();
  return backToServers(request, "/admin/etiquettes?done=removed#etiquettes-existantes");
}
