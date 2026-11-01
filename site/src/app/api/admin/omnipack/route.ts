import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import {
  adminPackOwnerId,
  cancelSubmission,
  expectedPartSize,
  findSubmission,
  finishSubmission,
  makeTestToken,
  startSubmission,
} from "@/lib/omniPacks";
import { PACKS_BUCKET, omnipackPartKey, omnipackPrefix, putWorldObject } from "@/lib/worldStorage";

// « Ajouter un pack » et « Tester dans le launcher » de la page admin Packs officiels (31/10).
// L'admin ajoute son propre .omnipack comme le ferait un joueur (même vérification : mods Modrinth +
// configurations seulement) ; il est rattaché à son compte joueur et arrive dans « Packs proposés ».
//   POST JSON  { action: "start" | "finish" | "cancel" | "testLink", ... }
//   POST ?part=1&id=<envoi>&n=<numéro>  corps = les octets d'un morceau (4 Mio au plus)
// Administrateurs seulement, même origine (adminForAction).
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function handle(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const url = new URL(request.url);

  if (url.searchParams.has("part")) {
    const s = await findSubmission(url.searchParams.get("id") ?? "");
    const n = Number(url.searchParams.get("n"));
    if (!s || s.status !== "uploading") return err("Envoi introuvable.", 404);
    if (!Number.isInteger(n) || n < 0 || n >= Number(s.parts)) return err("Morceau invalide.");
    const body = new Uint8Array(await request.arrayBuffer());
    if (body.byteLength !== expectedPartSize(s, n)) return err("Morceau de mauvaise taille.");
    await putWorldObject(omnipackPartKey(omnipackPrefix(s.userId, s.id), n), body, PACKS_BUCKET);
    return NextResponse.json({ ok: true });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  if (action === "start") {
    const owner = await adminPackOwnerId();
    if (!owner) return err("Je ne trouve pas ton compte joueur (Rushifa). Connecte-toi une fois au site comme joueur, ou règle OMNIPACK_OWNER_USER_ID.");
    const r = await startSubmission(owner, { name: String(body?.name ?? ""), sizeBytes: Number(body?.sizeBytes), sha256: String(body?.sha256 ?? "") });
    return "error" in r ? err(r.error) : NextResponse.json(r);
  }
  const s = await findSubmission(String(body?.id ?? ""));
  if (!s) return err("Envoi introuvable.", 404);
  if (action === "finish") {
    if (s.status !== "uploading") return NextResponse.json({ ok: true });
    const problem = await finishSubmission(s);
    return problem ? err(problem) : NextResponse.json({ ok: true });
  }
  if (action === "cancel") return s.status === "uploading" && (await cancelSubmission(s)) ? NextResponse.json({ ok: true }) : err("Annulation impossible.");
  if (action === "testLink") {
    if (s.status !== "pending" && s.status !== "imported") return err("Ce pack n'est pas en attente.");
    return NextResponse.json({ url: `omniscient://test-pack/${makeTestToken(s.id)}` });
  }
  return err("Action inconnue.");
}

// Une erreur inattendue (variable manquante, base) arrive à l'écran avec son vrai message, pas « HTTP 500 ».
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error("[admin/omnipack]", error);
    return err(`Erreur du site : ${error instanceof Error ? error.message : String(error)}`.slice(0, 300), 500);
  }
}
