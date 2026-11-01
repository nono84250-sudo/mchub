import { sourceDisabledResponse } from "@/lib/platformSettings";
import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest, launcherIdentityUuid } from "@/lib/launcherAuth";
import { CurseforgeForbiddenError, CurseforgeNotConfiguredError, getFilesInfo } from "@/lib/curseforge";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { D1BusyError } from "@/lib/db";

// Nombre maximum de fichiers par appel : un gros modpack en compte quelques
// centaines, mais ca borne aussi l'usage de cette route comme relais vers
// l'API CurseForge (elle utilise NOTRE cle et son quota).
const MAX_FILE_IDS = 500;

// Liens de telechargement des mods d'un modpack (identifiants de fichiers lus
// dans le manifeste du modpack par le launcher — voir launcher/src/modpack.js).
async function handlePOST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const sourceOff = await sourceDisabledResponse("curseforge");
  if (sourceOff) return sourceOff;
  // Cette route consomme le quota CurseForge de NOTRE cle, et les fileIds ne sont rattaches a
  // aucun serveur visible par l'appelant (audit 2026-10-10 §1.7, severite basse) : un joueur
  // identifie peut demander les liens de n'importe quel fichier CurseForge, pas seulement ceux
  // d'un modpack d'un serveur qu'il peut voir. Lier chaque fileId au manifeste du serveur visible
  // demanderait de faire remonter un slug depuis le launcher ET de re-resoudre/comparer le
  // manifeste du modpack ici — risque de regression disproportionne pour une fuite de quota
  // basse severite (aucune donnee utilisateur, juste des liens de telechargement de mods publics).
  // Attenuation retenue : frein par adresse resserre (20/min au lieu de 60/min).
  const limited = rateLimitResponse(request, "launcher-curseforge-files", 20);
  if (limited) return limited;
  // Point 3 : le quota reserve a un joueur identifie (session ou jeton Mojang). La cle seule ne suffit plus.
  if (!(await launcherIdentityUuid(request))) {
    return NextResponse.json({ error: "Identité non vérifiée" }, { status: 401 });
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
    // Base saturee : laisse withD1Busy repondre 503. Le detail des autres erreurs (base,
    // API externe) reste dans les journaux du site, pas dans la reponse (audit 25/10).
    if (error instanceof D1BusyError) throw error;
    console.error("[launcher/curseforge/files]", error);
    return NextResponse.json({ error: "La source du modpack n'a pas répondu correctement. Réessaie dans un instant.", code: "curseforge_error" }, { status: 502 });
  }
}

export const POST = withD1Busy(handlePOST);
