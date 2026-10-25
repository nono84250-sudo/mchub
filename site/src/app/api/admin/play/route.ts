import { NextResponse } from "next/server";
import { adminForAction, backToServers } from "@/lib/adminServers";
import { deletePack, parseProjectList, savePack, setPackVersionState } from "@/lib/playPacks";
import { listOffers, setPlayBeta, setSimulatedOffer } from "@/lib/playWorlds";
import { db } from "@/lib/db";

// Actions de la page admin « Packs officiels (bêta) » (mode Jouer, 24/10) et de l'offre simulée
// sur la fiche joueur. Vrais formulaires (sans JavaScript), même garde que les autres actions du
// panel : administrateurs seulement, même origine.
const PAGE = "/admin/packs-officiels";
const clean = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, "").trim().slice(0, max);
const back = (request: Request, query: string, hash = "") => backToServers(request, `${PAGE}?${query}${hash}`);

export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const action = clean(form.get("action"), 40);

  if (action === "beta") {
    await setPlayBeta(form.get("on") === "1");
    return back(request, "done=beta");
  }

  if (action === "offer") {
    const userId = clean(form.get("userId"), 80);
    const offerId = clean(form.get("offerId"), 40);
    const user = userId ? await db.orm.public.User.select("id").where({ id: userId }).first() : null;
    if (!user || !(await listOffers()).some((o) => o.id === offerId)) return backToServers(request, `/admin/players/${encodeURIComponent(userId)}?offer=error`);
    await setSimulatedOffer(user.id, offerId);
    return backToServers(request, `/admin/players/${encodeURIComponent(user.id)}?offer=ok`);
  }

  if (action === "save") {
    const id = clean(form.get("packId"), 80) || undefined;
    const nameFr = clean(form.get("nameFr"), 60);
    const nameEn = clean(form.get("nameEn"), 60) || nameFr;
    const slug = (clean(form.get("slug"), 40) || nameFr)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const projects = parseProjectList(clean(form.get("projects"), 4000));
    if (!nameFr || !slug) return back(request, `error=${encodeURIComponent("Donne un nom au pack.")}`);
    if (!projects.length) return back(request, `error=${encodeURIComponent("Ajoute au moins un mod Modrinth (lien ou nom court).")}`);
    try {
      const { id: savedId, counts } = await savePack({
        id,
        slug,
        nameFr,
        nameEn,
        descriptionFr: clean(form.get("descriptionFr"), 200),
        descriptionEn: clean(form.get("descriptionEn"), 200),
        projects,
      });
      return back(request, `done=saved&pack=${savedId}&t=${counts.to_test ?? 0}&r=${counts.review ?? 0}&n=${counts.not_enough ?? 0}`, `#pack-${savedId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Nom court déjà pris (index unique sur slug).
      const text = /UNIQUE/i.test(message) ? "Un autre pack porte déjà ce nom court." : message;
      return back(request, `error=${encodeURIComponent(text.slice(0, 180))}`);
    }
  }

  if (action === "version") {
    const versionId = clean(form.get("versionId"), 80);
    const what = clean(form.get("what"), 20);
    const change =
      what === "tested" ? { status: "tested" as const } : what === "untested" ? { status: "to_test" as const } : what === "publish" ? { published: true } : what === "unpublish" ? { published: false } : null;
    if (!change) return back(request, "error=action");
    const problem = await setPackVersionState(versionId, change);
    const packId = clean(form.get("packId"), 80);
    return problem ? back(request, `error=${encodeURIComponent(problem)}`, `#pack-${packId}`) : back(request, `done=${what}&pack=${packId}`, `#pack-${packId}`);
  }

  if (action === "delete") {
    await deletePack(clean(form.get("packId"), 80));
    return back(request, "done=deleted");
  }

  return back(request, "error=action");
}
