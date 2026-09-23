import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";

// Emet le jeton d'upload direct-navigateur -> Vercel Blob consomme par
// ImageDropzone.tsx (bannerUrl/iconUrl/backgroundUrl de ServerForm et
// NewServerWizard) : le fichier ne transite jamais par cette route, elle ne
// fait qu'autoriser la requete puis rendre le jeton — c'est pour ca que
// seule une session valide (pas la propriete d'un serveur precis, inconnue
// a ce stade pour une creation) est verifiee ici.
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
        maximumSizeInBytes: 5 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // Pas d'appel possible depuis Vercel vers un serveur de dev local
        // (localhost) : rien a faire ici, l'URL renvoyee directement au
        // navigateur par upload() suffit a alimenter le champ cache du
        // formulaire (voir ImageDropzone.tsx).
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
