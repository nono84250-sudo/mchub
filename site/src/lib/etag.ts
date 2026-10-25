import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

// « Pas de changement » (21/10, chantier cache des fiches) : la reponse JSON porte une empreinte
// courte de son contenu (ETag). Le launcher la renvoie (If-None-Match) ; si rien n'a change, le
// site repond 304 sans corps : moins de donnees a telecharger, et le launcher garde sa liste.
// L'empreinte vient du contenu lui-meme : aucune colonne ni migration en base.
export function jsonWithEtag(request: Request, body: unknown, headers: Record<string, string>): NextResponse {
  const text = JSON.stringify(body);
  const etag = `"${createHash("sha1").update(text).digest("base64url").slice(0, 16)}"`;
  const all = { ...headers, ETag: etag };
  const sent = request.headers.get("if-none-match");
  if (sent && sent.split(",").some((v) => v.trim().replace(/^W\//, "") === etag)) {
    return new NextResponse(null, { status: 304, headers: all });
  }
  return new NextResponse(text, { status: 200, headers: { ...all, "Content-Type": "application/json" } });
}
