import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, IMAGES_BUCKET } from "@/lib/r2";

// Sert une image deposee par /api/upload depuis le bucket R2 IMAGES. La cle contient
// un UUID aleatoire : le cache navigateur peut donc garder la reponse longtemps.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const { key } = await params;
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) return new Response("Introuvable", { status: 404 });

  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: IMAGES_BUCKET, Key: key }));
    return new Response(object.Body as ReadableStream, {
      headers: {
        "Content-Type": object.ContentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
