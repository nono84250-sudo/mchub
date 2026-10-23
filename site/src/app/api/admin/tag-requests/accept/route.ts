import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminForAction, backToServers, refreshServersCache } from "@/lib/adminServers";
import { TAG_CATALOG_CACHE_TAG, acceptTagGroup, customTagIdTaken, getTagCatalog } from "@/lib/tagRequests";
import { TAG_NAME_MAX, customTagIdFrom, findExistingTag } from "@/lib/tagCatalog";

// Accepte un mot propose (page /admin/etiquettes) : cree l'etiquette (noms FR/EN), l'alias du
// mot, passe toutes les demandes en attente de ce mot en « acceptee » et ajoute l'etiquette aux
// fiches demandeuses s'il leur reste une place. Meme garde que les autres actions du panel.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const clean = (v: FormDataEntryValue | null) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  const normalized = clean(form.get("normalized"));
  const nameFr = clean(form.get("nameFr"));
  const nameEn = clean(form.get("nameEn"));
  if (!normalized || !nameFr || !nameEn || nameFr.length > TAG_NAME_MAX || nameEn.length > TAG_NAME_MAX) {
    return backToServers(request, "/admin/etiquettes?error=name");
  }
  const catalog = await getTagCatalog();
  if (findExistingTag(nameFr, catalog) || findExistingTag(nameEn, catalog)) return backToServers(request, "/admin/etiquettes?error=exists");
  try {
    const base = customTagIdFrom(nameEn);
    let id = base;
    for (let i = 2; await customTagIdTaken(id); i++) id = `${base}-${i}`;
    await acceptTagGroup(normalized, { id, nameFr, nameEn });
  } catch (err) {
    console.error("[tagRequests] acceptation impossible :", err);
    return backToServers(request, "/admin/etiquettes?error=generic");
  }
  revalidateTag(TAG_CATALOG_CACHE_TAG, { expire: 0 });
  refreshServersCache();
  return backToServers(request, "/admin/etiquettes?done=accepted");
}
