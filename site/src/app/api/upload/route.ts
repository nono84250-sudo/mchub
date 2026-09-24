import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";

// Contraintes autoritatives par champ (voir la maquette "02 Onboarding" —
// dimensions/formats/poids affiches sous chaque zone de depot dans
// ImageDropzone.tsx). Definies ici plutot que lues depuis le clientPayload
// envoye par le navigateur : ce payload n'est qu'une indication pour l'UX
// (message d'erreur, attribut accept du <input>), jamais une source fiable
// pour une limite de securite — un client malveillant pourrait l'usurper.
const FIELD_CONSTRAINTS: Record<string, { allowedContentTypes: string[]; maximumSizeInBytes: number }> = {
  banner: { allowedContentTypes: ["image/jpeg", "image/png", "image/webp"], maximumSizeInBytes: 5 * 1024 * 1024 },
  icon: { allowedContentTypes: ["image/png", "image/webp"], maximumSizeInBytes: 1 * 1024 * 1024 },
  background: { allowedContentTypes: ["image/jpeg", "image/webp"], maximumSizeInBytes: 8 * 1024 * 1024 },
};

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
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { field } = JSON.parse(clientPayload || "{}") as { field?: string };
        const constraints = (field && FIELD_CONSTRAINTS[field]) || {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 5 * 1024 * 1024,
        };
        return { ...constraints, addRandomSuffix: true };
      },
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
