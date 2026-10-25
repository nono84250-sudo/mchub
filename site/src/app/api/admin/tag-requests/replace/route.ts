import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { TAG_CATALOG_CACHE_TAG, getTagCatalog, replaceTagWithGroup } from "@/lib/tagRequests";
import { TAG_NAME_MAX, findExistingTag, isKnownTag } from "@/lib/tagCatalog";

// « Remplacer une etiquette » (page /admin/etiquettes, preview validee le 23/10,
// https://claude.ai/artifact/LRmjXBxZRFqr6JJEDuJu4x) : l'etiquette choisie prend le nom propose
// (FR/EN, corrige par l'equipe), garde son identifiant donc sa place sur toutes les fiches, et les
// demandes en attente de ce mot passent en « remplacee ». Meme garde que les autres actions du panel.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const clean = (v: FormDataEntryValue | null) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  const normalized = clean(form.get("normalized"));
  const tagId = clean(form.get("tagId"));
  const nameFr = clean(form.get("nameFr"));
  const nameEn = clean(form.get("nameEn"));
  if (!normalized || !tagId || !nameFr || !nameEn || nameFr.length > TAG_NAME_MAX || nameEn.length > TAG_NAME_MAX) {
    return backToServers(request, "/admin/etiquettes?error=name");
  }
  const catalog = await getTagCatalog();
  if (!isKnownTag(tagId, catalog.custom)) return backToServers(request, "/admin/etiquettes?error=generic");
  // Le nouveau nom ne doit pas etre celui d'une AUTRE etiquette (l'etiquette remplacee ne compte pas).
  if (findExistingTag(nameFr, catalog, tagId) || findExistingTag(nameEn, catalog, tagId)) {
    return backToServers(request, "/admin/etiquettes?error=exists");
  }
  try {
    if (!(await replaceTagWithGroup(normalized, { id: tagId, nameFr, nameEn }, catalog))) return backToServers(request, "/admin/etiquettes?error=generic");
  } catch (err) {
    console.error("[tagRequests] remplacement impossible :", err);
    return backToServers(request, "/admin/etiquettes?error=generic");
  }
  revalidateTag(TAG_CATALOG_CACHE_TAG, { expire: 0 });
  refreshServersCache();
  return backToServers(request, "/admin/etiquettes?done=replaced");
}
