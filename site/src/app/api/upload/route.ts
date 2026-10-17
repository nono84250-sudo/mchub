import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, IMAGES_BUCKET } from "@/lib/r2";
import { auth } from "@/auth";

// Contraintes autoritatives par champ (voir la maquette "02 Onboarding" —
// dimensions/formats/poids affiches sous chaque zone de depot dans
// ImageDropzone.tsx). Definies ici plutot que lues depuis le champ envoye par le
// navigateur : celui-ci n'est qu'une indication pour l'UX, jamais une source fiable
// pour une limite de securite — un client malveillant pourrait l'usurper.
const FIELD_CONSTRAINTS: Record<string, { allowedContentTypes: string[]; maximumSizeInBytes: number }> = {
  banner: { allowedContentTypes: ["image/jpeg", "image/png", "image/webp"], maximumSizeInBytes: 5 * 1024 * 1024 },
  icon: { allowedContentTypes: ["image/png", "image/webp"], maximumSizeInBytes: 1 * 1024 * 1024 },
  background: { allowedContentTypes: ["image/jpeg", "image/webp"], maximumSizeInBytes: 8 * 1024 * 1024 },
  // Captures de la galerie d'une fiche publique (voir lib/serverPage.ts).
  gallery: { allowedContentTypes: ["image/jpeg", "image/png", "image/webp"], maximumSizeInBytes: 5 * 1024 * 1024 },
};

const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Le Content-Type declare par le navigateur n'est qu'une etiquette : on verifie aussi les
// premiers octets reels du fichier, pour qu'un fichier renomme avec un faux Content-Type
// ne soit pas stocke et reserve tel quel (voir /api/images/[key]/route.ts, qui reserve
// exactement ce Content-Type).
const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

// Recoit le fichier (multipart), le range dans le bucket R2 IMAGES et renvoie l'URL
// absolue (origine de la requete) de /api/images/<cle> (app/api/images/[key]/route.ts) :
// le launcher affiche bannerUrl/iconUrl tels quels, sans connaitre l'origine du site.
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const form = await request.formData();
  const field = String(form.get("field") ?? "");
  const file = form.get("file");
  const constraints = FIELD_CONSTRAINTS[field] ?? {
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    maximumSizeInBytes: 5 * 1024 * 1024,
  };
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }
  if (!constraints.allowedContentTypes.includes(file.type)) {
    return NextResponse.json({ error: "Format non accepté." }, { status: 400 });
  }
  if (file.size > constraints.maximumSizeInBytes) {
    return NextResponse.json({ error: "Fichier trop lourd." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!SIGNATURES[file.type]?.(bytes)) {
    return NextResponse.json({ error: "Le fichier n'est pas une image valide." }, { status: 400 });
  }

  const key = `${crypto.randomUUID()}.${EXTENSION[file.type]}`;
  await r2.send(new PutObjectCommand({ Bucket: IMAGES_BUCKET, Key: key, Body: bytes, ContentType: file.type }));
  return NextResponse.json({ url: `${new URL(request.url).origin}/api/images/${key}` });
}
