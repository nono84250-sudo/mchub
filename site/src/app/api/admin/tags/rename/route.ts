import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { TAG_CATALOG_CACHE_TAG, getTagCatalog, renameTag } from "@/lib/tagRequests";
import { TAG_NAME_MAX, findExistingTag, isKnownTag } from "@/lib/tagCatalog";

// « Modifier » dans la liste des etiquettes existantes (page /admin/etiquettes, preview validee le
// 23/10, https://claude.ai/artifact/LRmjXBxZRFqr6JJEDuJu4x) : nouveau nom FR/EN, meme identifiant,
// donc meme place sur toutes les fiches. Meme garde que les autres actions du panel.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const clean = (v: FormDataEntryValue | null) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  const tagId = clean(form.get("tagId"));
  const nameFr = clean(form.get("nameFr"));
  const nameEn = clean(form.get("nameEn"));
  if (!tagId || !nameFr || !nameEn || nameFr.length > TAG_NAME_MAX || nameEn.length > TAG_NAME_MAX) {
    return backToServers(request, "/admin/etiquettes?error=name");
  }
  const catalog = await getTagCatalog();
  if (!isKnownTag(tagId, catalog.custom)) return backToServers(request, "/admin/etiquettes?error=generic");
  if (findExistingTag(nameFr, catalog, tagId) || findExistingTag(nameEn, catalog, tagId)) {
    return backToServers(request, "/admin/etiquettes?error=exists");
  }
  try {
    if (!(await renameTag({ id: tagId, nameFr, nameEn }, catalog))) return backToServers(request, "/admin/etiquettes?error=generic");
  } catch (err) {
    console.error("[tags] renommage impossible :", err);
    return backToServers(request, "/admin/etiquettes?error=generic");
  }
  revalidateTag(TAG_CATALOG_CACHE_TAG, { expire: 0 });
  refreshServersCache();
  return backToServers(request, "/admin/etiquettes?done=renamed#etiquettes-existantes");
}
