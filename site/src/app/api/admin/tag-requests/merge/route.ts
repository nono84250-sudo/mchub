import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { TAG_CATALOG_CACHE_TAG, getTagCatalog, mergeTagGroup } from "@/lib/tagRequests";

// « C'est la meme que… » (page /admin/etiquettes) : le mot devient un alias de l'etiquette
// choisie, les demandes passent en « reliee » et l'etiquette est ajoutee aux fiches si possible.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const normalized = String(form.get("normalized") ?? "").trim();
  const tagId = String(form.get("tagId") ?? "").trim();
  if (!normalized || !tagId) return backToServers(request, "/admin/etiquettes?error=generic");
  try {
    if (!(await mergeTagGroup(normalized, tagId, await getTagCatalog()))) return backToServers(request, "/admin/etiquettes?error=generic");
  } catch (err) {
    console.error("[tagRequests] liaison impossible :", err);
    return backToServers(request, "/admin/etiquettes?error=generic");
  }
  revalidateTag(TAG_CATALOG_CACHE_TAG, { expire: 0 });
  refreshServersCache();
  return backToServers(request, "/admin/etiquettes?done=merged");
}
