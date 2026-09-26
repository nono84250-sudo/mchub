import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { CurseforgeForbiddenError, CurseforgeNotConfiguredError, getFilesInfo } from "@/lib/curseforge";

// Nombre maximum de fichiers par appel : un gros modpack en compte quelques
// centaines, mais ca borne aussi l'usage de cette route comme relais vers
// l'API CurseForge (elle utilise NOTRE cle et son quota).
const MAX_FILE_IDS = 500;

// Liens de telechargement des mods d'un modpack (identifiants de fichiers lus
// dans le manifeste du modpack par le launcher — voir launcher/src/modpack.js).
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const fileIds: unknown = body?.fileIds;
  if (
    !Array.isArray(fileIds) ||
    fileIds.length === 0 ||
    fileIds.length > MAX_FILE_IDS ||
    !fileIds.every((id) => Number.isInteger(id) && id > 0)
  ) {
    return NextResponse.json({ error: `fileIds doit être une liste de 1 à ${MAX_FILE_IDS} entiers positifs` }, { status: 400 });
  }

  try {
    const files = await getFilesInfo(fileIds as number[]);
    return NextResponse.json({ files });
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof CurseforgeForbiddenError) {
      return NextResponse.json({ error: error.message, code: "curseforge_forbidden" }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message, code: "curseforge_error" }, { status: 502 });
  }
}
